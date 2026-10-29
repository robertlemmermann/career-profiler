// Term recognition: the shipped taxonomy (assets/taxonomy.json) plus the profile's own skill
// names and aliases, matched case-insensitively on word boundaries.

import path from 'node:path';
import { ASSETS_DIR, readJson } from './core.mjs';

let cached;
export function loadTaxonomy() {
  if (!cached) cached = readJson(path.join(ASSETS_DIR, 'taxonomy.json'));
  return cached;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Terms that are also ordinary words: matched only with their exact capitalisation. */
const CASE_SENSITIVE = new Set(['Go', 'Rust', 'Swift', 'Spring', 'Express', 'Flask', 'Rails', 'Word', 'Excel', 'Outlook', 'Lean', 'Dart', 'Epic', 'Impella', 'React']);

/**
 * A regex that matches `term` as a whole word (symbols like C++ and .NET handled). Aliases of up
 * to three characters (RN, ER, AWS, k8s) and the words in CASE_SENSITIVE match case-sensitively;
 * everything else is case-insensitive.
 */
export function termRegex(term) {
  const raw = term.trim();
  const t = escapeRe(raw);
  const lead = /^[a-z0-9]/i.test(raw) ? '(?<![a-z0-9])' : '(?<![a-z0-9#+])';
  const trail = /[a-z0-9]$/i.test(raw) ? '(?![a-z0-9])' : '(?![a-z0-9#+])';
  const flags = raw.length <= 3 || CASE_SENSITIVE.has(raw) ? 'g' : 'gi';
  // Spaces and hyphens are interchangeable; a dot between letters is optional (Node.js, nodejs, node js).
  const body = t.replace(/\\ /g, '[\\s-]+').replace(/ /g, '[\\s-]+').replace(/(?<=[a-z0-9])\\\.(?=[a-z])/gi, '[.\\s]?');
  return new RegExp(`${lead}${body}${trail}`, flags);
}

/**
 * Build the matcher table: `[{ canonical, category, patterns: [{ alias, re }], source }]` from the
 * taxonomy and, when given, the profile's skills (so a niche skill the taxonomy lacks still matches).
 */
export function buildMatchers(profile) {
  const tax = loadTaxonomy();
  const table = [];
  const byCanon = new Map();
  const add = (canonical, category, aliases, source) => {
    const key = canonical.toLowerCase();
    let row = byCanon.get(key);
    if (!row) { row = { canonical, category: category || 'other', patterns: [], source }; byCanon.set(key, row); table.push(row); }
    for (const a of [canonical, ...(aliases || [])]) {
      const alias = String(a).trim();
      if (!alias || alias.length < 2 || row.patterns.some((p) => p.alias.toLowerCase() === alias.toLowerCase())) continue;
      row.patterns.push({ alias, re: termRegex(alias) });
    }
  };
  for (const t of tax.terms) add(t.term, t.category, t.aliases, 'taxonomy');
  for (const s of (profile && profile.skills) || []) if (s && s.name) add(s.name, s.category, s.aliases, 'profile');
  return table;
}

/** Every canonical term found in `text` with the alias that matched and the count. */
export function findTerms(text, matchers) {
  const found = [];
  const hay = String(text || '');
  for (const row of matchers) {
    let count = 0;
    let via = null;
    for (const p of row.patterns) {
      p.re.lastIndex = 0;
      const m = hay.match(p.re);
      if (m && m.length) { count += m.length; via = via || p.alias; }
    }
    if (count) found.push({ term: row.canonical, category: row.category, via, count });
  }
  return found;
}

export const canonicalOf = (matchers, word) => {
  const w = String(word || '').trim();
  for (const row of matchers) for (const p of row.patterns) if (p.alias === w || (w.length > 3 && p.alias.toLowerCase() === w.toLowerCase())) return row.canonical;
  return null;
};
