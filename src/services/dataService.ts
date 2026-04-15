import type { Availability, DataStore, Fine, Lineup, Message, Nickname, TeamEvent, User } from '../types/models';

const withBase = (path: string) => `${import.meta.env.BASE_URL}${path}`.replace(/([^:]\/)\/+/, '$1');

const readJson = async <T,>(path: string): Promise<T> => {
  const response = await fetch(withBase(path));
  if (!response.ok) throw new Error(`Failed loading ${withBase(path)}`);
  return (await response.json()) as T;
};

export const loadSeedData = async (): Promise<DataStore> => {
  const [users, events, fines, messages, nicknames, lineups, availability] = await Promise.all([
    readJson<User[]>('data/users.json'),
    readJson<TeamEvent[]>('data/events.json'),
    readJson<Fine[]>('data/fines.json'),
    readJson<Message[]>('data/messages.json'),
    readJson<Nickname[]>('data/nicknames.json'),
    readJson<Lineup[]>('data/lineups.json'),
    readJson<Availability[]>('data/availability.json'),
  ]);

  return { users, events, fines, messages, nicknames, lineups, availability };
};
