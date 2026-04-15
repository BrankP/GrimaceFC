import type { DataStore } from '../types/models';

const readJson = async <T,>(path: string): Promise<T> => {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed loading ${path}`);
  return response.json() as Promise<T>;
};

export const loadSeedData = async (): Promise<DataStore> => {
  const [users, events, fines, messages, nicknames, lineups] = await Promise.all([
    readJson('/data/users.json'),
    readJson('/data/events.json'),
    readJson('/data/fines.json'),
    readJson('/data/messages.json'),
    readJson('/data/nicknames.json'),
    readJson('/data/lineups.json'),
  ]);

  return { users, events, fines, messages, nicknames, lineups };
};
