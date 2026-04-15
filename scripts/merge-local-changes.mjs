import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'public', 'data');
const EXPORT_PATH = process.argv[2];

if (!EXPORT_PATH) {
  console.error('Usage: node scripts/merge-local-changes.mjs <path-to-export.json>');
  process.exit(1);
}

const tableMap = {
  users: 'users.json',
  fines: 'fines.json',
  messages: 'messages.json',
  nicknames: 'nicknames.json',
  lineups: 'lineups.json',
};

const dedupe = (seed, incoming) => {
  const map = new Map();
  [...seed, ...incoming].forEach((record) => map.set(record.id, record));
  return [...map.values()];
};

const raw = await fs.readFile(path.resolve(ROOT, EXPORT_PATH), 'utf8');
const bundle = JSON.parse(raw);

if (!bundle?.changes) {
  throw new Error('Invalid export bundle: expected top-level "changes" key.');
}

for (const [key, filename] of Object.entries(tableMap)) {
  const file = path.join(DATA_DIR, filename);
  const current = JSON.parse(await fs.readFile(file, 'utf8'));
  const next = dedupe(current, bundle.changes[key] ?? []);
  await fs.writeFile(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  console.log(`Merged ${key}: ${current.length} -> ${next.length}`);
}

console.log('Done. Review git diff, run tests/build, then commit.');
