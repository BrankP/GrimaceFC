import type { DataStore, LocalChanges } from '../types/models';

const CURRENT_USER_KEY = 'grimacefc.currentUserId';
const LOCAL_CHANGES_KEY = 'grimacefc.localChanges.v1';

const emptyChanges: LocalChanges = {
  users: [],
  fines: [],
  messages: [],
  nicknames: [],
  lineups: [],
};

export const readCurrentUserId = () => localStorage.getItem(CURRENT_USER_KEY);

export const writeCurrentUserId = (userId: string) => localStorage.setItem(CURRENT_USER_KEY, userId);

export const readLocalChanges = (): LocalChanges => {
  const raw = localStorage.getItem(LOCAL_CHANGES_KEY);
  if (!raw) return structuredClone(emptyChanges);

  try {
    const parsed = JSON.parse(raw) as Partial<LocalChanges>;
    return {
      users: parsed.users ?? [],
      fines: parsed.fines ?? [],
      messages: parsed.messages ?? [],
      nicknames: parsed.nicknames ?? [],
      lineups: parsed.lineups ?? [],
    };
  } catch {
    return structuredClone(emptyChanges);
  }
};

export const writeLocalChanges = (changes: LocalChanges) => {
  localStorage.setItem(LOCAL_CHANGES_KEY, JSON.stringify(changes));
};

const mergeById = <T extends { id: string }>(seeded: T[], local: T[]) => {
  const map = new Map<string, T>();
  [...seeded, ...local].forEach((item) => map.set(item.id, item));
  return [...map.values()];
};

export const mergeSeedAndLocal = (seed: DataStore, local: LocalChanges): DataStore => ({
  ...seed,
  users: mergeById(seed.users, local.users),
  fines: mergeById(seed.fines, local.fines).sort((a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt)),
  messages: mergeById(seed.messages, local.messages).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
  nicknames: mergeById(seed.nicknames, local.nicknames).sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)),
  lineups: mergeById(seed.lineups, local.lineups),
});

export const makeExportBundle = (changes: LocalChanges) => {
  const payload = {
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    source: 'GrimaceFC local static mode',
    changes,
  };
  return JSON.stringify(payload, null, 2);
};

export const pushLocalChange = <K extends keyof LocalChanges>(key: K, item: LocalChanges[K][number]) => {
  const current = readLocalChanges();
  const nextItems = current[key].filter((existing) => (existing as { id: string }).id !== (item as { id: string }).id);
  const next = { ...current, [key]: [...nextItems, item] };
  writeLocalChanges(next);
};
