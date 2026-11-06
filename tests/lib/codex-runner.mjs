import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
export function writeJSON(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  const fd = fs.openSync(temp, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temp, file);
}
export function childEnv(source = process.env) {
  const allowed = ['PATH', 'HOME', 'USERPROFILE', 'SystemRoot', 'TEMP', 'TMP', 'TMPDIR', 'LANG', 'LC_ALL', 'CODEX_HOME', 'HTTPS_PROXY', 'HTTP_PROXY', 'ALL_PROXY', 'NO_PROXY', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'NODE_EXTRA_CA_CERTS'];
  return Object.fromEntries(allowed.filter((k) => source[k] !== undefined).map((k) => [k, source[k]]));
}
export function redact(text) {
  return text.replace(/\b(?:sk-[\w-]{12,}|gh[pousr]_[\w]{16,})\b/g, '[REDACTED]')
    .replace(/(Bearer\s+)[\w.\-/+=]+/gi, '$1[REDACTED]')
    .replace(/((?:access_token|refresh_token|api_key|authorization)["'\s:=]+)[^\s",}]+/gi, '$1[REDACTED]');
}
export function classify({ code, events, stderr = '', timedOut = false, error }) {
  const errors = events.filter((e) => ['error', 'turn.failed'].includes(e.type));
  const message = redact([error?.message, stderr, ...errors.map((e) => JSON.stringify(e))].filter(Boolean).join('\n')).slice(-8000);
  // Classify host errors only. An assistant legitimately discussing rate limits is not a refusal.
  if (/unauthorized|authentication|sign(?:ing)? in|401\b|invalid.*token/i.test(message)) return { state: 'blocked-auth', message };
  if (/usage.limit|rate.limit|quota|credits|429\b|limit.*reset|hit your.*limit/i.test(message)) return { state: 'paused-quota', message };
  if (timedOut) return { state: 'interrupted', message: message || 'CLI turn timed out' };
  if (code !== 0 || errors.length || !events.some((e) => e.type === 'turn.completed')) return { state: 'blocked-infrastructure', message: message || `CLI exited ${code} without turn.completed` };
  return { state: 'completed', message: null };
}
export function codexArgs({ model, effort, cwd, session, output, schema, readOnly = false, addDir }) {
  return ['exec', ...(session ? ['resume', session] : []), '--ignore-user-config', '--skip-git-repo-check', '--json', '-m', model,
    '-c', `model_reasoning_effort=${JSON.stringify(effort)}`,
    // A resume uses the session's saved sandbox and working directory.
    ...(!session ? ['-C', cwd, '-s', readOnly ? 'read-only' : 'workspace-write', ...(addDir && !readOnly ? ['--add-dir', addDir] : [])] : []),
    ...(output ? ['-o', output] : []), ...(schema ? ['--output-schema', schema] : []), '-'];
}
export async function runCodex(options) {
  const { log, prompt, onEvent = () => {}, timeoutMs = 300000, env = childEnv(), bin = 'codex' } = options;
  fs.mkdirSync(path.dirname(log), { recursive: true });
  const fd = fs.openSync(log, 'a', 0o600);
  const events = [];
  let stderr = '', buffer = '', timedOut = false, spawnError;
  const child = spawn(bin, codexArgs(options), { cwd: options.cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const consume = (line) => {
    fs.writeSync(fd, redact(line) + '\n');
    let event; try { event = JSON.parse(line); } catch { return; }
    events.push(event); onEvent(event);
  };
  child.stdout.on('data', (bytes) => {
    buffer += bytes.toString();
    let nl; while ((nl = buffer.indexOf('\n')) >= 0) { consume(buffer.slice(0, nl)); buffer = buffer.slice(nl + 1); }
  });
  child.stderr.on('data', (bytes) => { const text = redact(bytes.toString()); stderr = (stderr + text).slice(-8000); fs.writeSync(fd, text); });
  child.on('error', (error) => { spawnError = error; });
  child.stdin.on('error', () => {});
  child.stdin.end(prompt);
  const kill = () => { child.kill('SIGTERM'); escalation = setTimeout(() => child.kill('SIGKILL'), 5000); escalation.unref(); };
  let escalation;
  const timer = setTimeout(() => { timedOut = true; kill(); }, timeoutMs);
  const stop = () => { timedOut = true; kill(); };
  process.once('SIGTERM', stop); process.once('SIGINT', stop);
  const code = await new Promise((resolve) => child.once('close', resolve));
  clearTimeout(timer); clearTimeout(escalation);
  process.removeListener('SIGTERM', stop); process.removeListener('SIGINT', stop);
  if (buffer) consume(buffer);
  fs.fsyncSync(fd); fs.closeSync(fd);
  return { ...classify({ code, events, stderr, timedOut, error: spawnError }), events };
}
export function acquireLock(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    const fd = fs.openSync(file, 'wx', 0o600); fs.writeFileSync(fd, String(process.pid)); fs.closeSync(fd);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const pid = Number(fs.readFileSync(file, 'utf8'));
    if (!Number.isInteger(pid) || pid <= 0) throw Error('invalid runner lock; inspect before removing');
    try { process.kill(pid, 0); } catch (e) { if (e.code === 'ESRCH') { fs.unlinkSync(file); return acquireLock(file); } throw e; }
    throw Error(`GPT eval runner already active (pid ${pid})`);
  }
  let released = false;
  return () => { if (!released) { released = true; fs.rmSync(file, { force: true }); } };
}
