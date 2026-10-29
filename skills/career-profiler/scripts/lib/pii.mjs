// PII scanning for everything that leaves the store: regex detectors (assets/pii/detectors.json),
// the export policy (assets/export-policy.json), and the strongest check of all: the exact values
// of never-tier facts and unexported restricted fields must not appear in the artifact.

import path from 'node:path';
import { ASSETS_DIR, readJson } from './core.mjs';
import { SECTIONS, RESTRICTED_FIELDS, RESTRICTED_ENTRY_FIELDS, tierOf } from './schema.mjs';

let detectors;
let policy;
export function loadDetectors() { if (!detectors) detectors = readJson(path.join(ASSETS_DIR, 'pii', 'detectors.json')); return detectors; }
export function loadPolicy() { if (!policy) policy = readJson(path.join(ASSETS_DIR, 'export-policy.json')); return policy; }

const luhn = (digits) => { let sum = 0; let alt = false; for (let i = digits.length - 1; i >= 0; i--) { let d = Number(digits[i]); if (alt) { d *= 2; if (d > 9) d -= 9; } sum += d; alt = !alt; } return sum % 10 === 0; };
const mask = (s) => (s.length <= 4 ? '****' : `${s.slice(0, 2)}${'*'.repeat(Math.max(3, s.length - 4))}${s.slice(-2)}`);
const digitsOf = (s) => String(s || '').replace(/\D/g, '');

/** Values from the profile that must not appear in an artifact of this profile (never tier, unexported restricted fields). */
export function forbiddenValues(profile, { profileName = 'resume', include = [] } = {}) {
  const values = [];
  const add = (label, v, tier) => { if (v == null) return; const s = String(v).trim(); if (s.length >= 4 && !/^\d{1,3}$/.test(s)) values.push({ label, value: s, tier }); };
  for (const [name, fields] of Object.entries(RESTRICTED_FIELDS)) for (const f of fields) if (profile[name] && !include.includes(f)) add(`${name}.${f}`, profile[name][f], 'restricted');
  for (const name of Object.keys(SECTIONS)) {
    for (const e of profile[name] || []) {
      const tier = tierOf(e);
      if (tier === 'never') { for (const [k, v] of Object.entries(e)) if (typeof v === 'string' && !['id', 'tier'].includes(k)) add(`${e.id}.${k}`, v, 'never'); }
      for (const f of RESTRICTED_ENTRY_FIELDS[name] || []) if (!include.includes(f)) add(`${e.id}.${f}`, e[f], 'restricted');
      for (const a of e.achievements || []) if (tierOf(a) === 'never') add(`${a.id}.text`, a.text, 'never');
    }
  }
  return values;
}

/**
 * Scan text. Returns `{ hits: [{ detector, label, severity, line, sample }], blocks, reviews }`.
 * `allow` lists the chosen contact values (email, phone) that the extra-email/phone detectors ignore.
 */
export function scanText(text, { profileName = 'resume', profile = null, include = [], allow = null } = {}) {
  const det = loadDetectors();
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const hits = [];
  const allowed = allow || (profile ? { email: profile.identity && profile.identity.email, phone: profile.identity && profile.identity.phone, links: ((profile.identity && profile.identity.links) || []).map((l) => l && l.url) } : {});
  for (const d of det.detectors) {
    if (d.profiles && d.profiles.length && !d.profiles.includes(profileName)) continue;
    const re = new RegExp(d.pattern, `${d.flags || ''}g`);
    lines.forEach((line, i) => {
      let m;
      re.lastIndex = 0;
      while ((m = re.exec(line))) {
        const found = m[0];
        if (d.luhn) { const dg = digitsOf(found); if (dg.length < 13 || dg.length > 19 || !luhn(dg)) continue; if (/\b(?:19|20)\d{2}\b/.test(found) && dg.length < 15) continue; }
        if (d.allow === 'contact') {
          if (d.id === 'extra-email' && allowed.email && found.toLowerCase() === String(allowed.email).toLowerCase()) continue;
          if (d.id === 'extra-phone' && allowed.phone && digitsOf(found) === digitsOf(allowed.phone)) continue;
          if (d.id === 'extra-phone' && digitsOf(found).length < 9) continue;
          if (d.id === 'extra-phone' && /\b(?:19|20)\d{2}\b/.test(found) && digitsOf(found).length <= 10) continue;
        }
        hits.push({ detector: d.id, label: d.label, severity: d.severity, line: i + 1, sample: mask(found) });
      }
    });
  }
  if (profile) {
    // Punctuation, URL encoding and case must not hide a value: compare on letters and digits only.
    const safeDecode = (x) => { try { return decodeURIComponent(x); } catch { return x; } };
    const norm = (s) => safeDecode(String(s)).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const hay = norm(text);
    for (const fv of forbiddenValues(profile, { profileName, include })) {
      const v = norm(fv.value);
      let found = hay.includes(v);
      if (!found && fv.tier === 'never' && v.length > 40) {
        // A long never-tier fact leaks in pieces too: any run of six of its words is a hit.
        const words = v.split(' ');
        for (let i = 0; i + 6 <= words.length && !found; i++) { const chunk = words.slice(i, i + 6).join(' '); if (chunk.length >= 25 && hay.includes(chunk)) found = true; }
      }
      if (found) hits.push({ detector: 'store-value', label: `value of ${fv.label} (${fv.tier} tier) appears`, severity: 'block', line: null, sample: mask(fv.value) });
    }
  }
  return { hits, blocks: hits.filter((h) => h.severity === 'block').length, reviews: hits.filter((h) => h.severity === 'review').length };
}

/** Tier to assign to a new fact from its text: never when a detector of the never class fires. */
export function tierForFact(entry) {
  const text = Object.entries(entry).filter(([k, v]) => typeof v === 'string' && !['id', 'tier'].includes(k)).map(([, v]) => v).join('\n');
  const det = loadDetectors();
  const neverIds = new Set(['ssn-us', 'sin-ca', 'nino-uk', 'national-id-label', 'dob', 'age', 'street-address', 'iban', 'card-number', 'bank-label', 'marital-family', 'religion', 'health', 'ethnicity']);
  for (const d of det.detectors) {
    if (!neverIds.has(d.id)) continue;
    const re = new RegExp(d.pattern, d.flags || '');
    if (re.test(text)) return { tier: 'never', detector: d.id, label: d.label };
  }
  return null;
}
