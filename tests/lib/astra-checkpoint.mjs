// Checkpoints contain synthetic eval workspaces only, never the user's home or account files.
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function checkpoint(work, destination) {
  const files = {};
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (dir === work && ['skill', 'request.md', 'resume.md'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) {
        const bytes = fs.readFileSync(full);
        files[path.relative(work, full).split(path.sep).join('/')] = { mode: fs.statSync(full).mode & 0o777, sha256: digest(bytes), base64: bytes.toString('base64') };
      } else throw new Error(`unsupported checkpoint entry: ${full}`);
    }
  };
  visit(work);
  const payload = { schema: 'cp-astra-checkpoint/1', at: new Date().toISOString(), files };
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const tmp = `${destination}.${randomUUID()}.tmp`;
  const fd = fs.openSync(tmp, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(payload)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, destination);
}
export function restoreCheckpoint(work, source) {
  const payload = JSON.parse(fs.readFileSync(source, 'utf8'));
  if (payload.schema !== 'cp-astra-checkpoint/1') throw Error('unknown checkpoint schema');
  const entries = Object.entries(payload.files).map(([rel, value]) => {
    const dest = path.resolve(work, rel);
    if (!dest.startsWith(path.resolve(work) + path.sep)) throw Error('unsafe checkpoint path');
    const bytes = Buffer.from(value.base64, 'base64');
    if (digest(bytes) !== value.sha256) throw Error(`checkpoint checksum mismatch: ${rel}`);
    return { dest, bytes, mode: value.mode };
  });
  for (const { dest, bytes, mode } of entries) { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, bytes, { mode }); }
  return payload;
}
