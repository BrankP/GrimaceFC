import type { DataStore, Fine, Lineup, Message, Nickname, TeamEvent, User } from '../types/models';

const readJson = async <T,>(path: string): Promise<T> => {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed loading ${path}`);
  return (await response.json()) as T;
};

export const loadSeedData = async (): Promise<DataStore> => {
  const [users, events, fines, messages, nicknames, lineups] = await Promise.all([
    readJson<User[]>('/data/users.json'),
    readJson<TeamEvent[]>('/data/events.json'),
    readJson<Fine[]>('/data/fines.json'),
    readJson<Message[]>('/data/messages.json'),
    readJson<Nickname[]>('/data/nicknames.json'),
    readJson<Lineup[]>('/data/lineups.json'),
  ]);

  return { users, events, fines, messages, nicknames, lineups };
};
