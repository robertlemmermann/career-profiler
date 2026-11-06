// CLI evidence never counts toward the existing Work or Claude gates.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const HOST = process.env.CP_EVAL_HOST || 'chatgpt-work-fresh-thread';
if (!['chatgpt-work-fresh-thread', 'codex-cli'].includes(HOST)) throw Error('unsupported eval host');
export const MODEL = HOST === 'codex-cli' ? process.env.CP_EVAL_MODEL || 'gpt-6-astra' : 'gpt-6-astra';
export const EFFORT = HOST === 'codex-cli' ? process.env.CP_EVAL_EFFORT || 'high' : 'high';
if (!/^[a-zA-Z0-9._-]+$/.test(MODEL) || !['low', 'medium', 'high', 'xhigh', 'max', 'ultra'].includes(EFFORT)) throw Error('invalid eval profile');
export const DIR = path.join(ROOT, 'evals/ledger', HOST === 'codex-cli' ? `codex/${MODEL}/${EFFORT}` : 'astra');
export const BRIDGE_ENV = HOST === 'codex-cli' ? `env CP_EVAL_HOST=codex-cli CP_EVAL_MODEL=${MODEL} CP_EVAL_EFFORT=${EFFORT} ` : '';
