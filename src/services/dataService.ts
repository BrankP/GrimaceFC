import type { AvailabilityStatus, DataStore, Fine, Lineup, Message, NextRefHistoryEntry, NextRefState, TeamEvent, User } from '../types/models';
import { readTeamPasscode } from '../utils/storage';

const parse = async <T,>(response: Response): Promise<T> => {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
};

const api = async <T,>(path: string, init?: RequestInit) => {
  const headers = new Headers(init?.headers ?? {});
  headers.set('Content-Type', 'application/json');

  const isWrite = (init?.method ?? 'GET').toUpperCase() !== 'GET';
  if (isWrite) {
    const passcode = readTeamPasscode();
    if (passcode) headers.set('x-team-passcode', passcode);
  }

  const response = await fetch(`/api${path}`, { ...init, headers });
  return parse<T>(response);
};

export const loadAppData = async (): Promise<DataStore> => {
  const [events, nextGame, messages, fines] = await Promise.all([
    api<TeamEvent[]>('/events'),
    api<TeamEvent | null>('/next-game'),
    api<Message[]>('/messages'),
    api<Fine[]>('/fines'),
  ]);

  const users = await api<User[]>('/users');
  const availability = await api<DataStore['availability']>('/availability');
  const lineup = nextGame ? await api<Lineup | null>(`/lineup?eventId=${encodeURIComponent(nextGame.id)}`) : null;

  return { users, events, messages, fines, availability, lineups: lineup ? [lineup] : [] };
};

export const upsertUser = (payload: { id?: string; name: string; nickname?: string | null; createdYear?: number }) =>
  api<User>('/users/upsert', { method: 'POST', body: JSON.stringify(payload) });

export const postMessage = (payload: { userId: string; text: string }) =>
  api<Message>('/messages', { method: 'POST', body: JSON.stringify(payload) });

export const postFine = (payload: Omit<Fine, 'id' | 'submittedAt'>) =>
  api<Fine>('/fines', { method: 'POST', body: JSON.stringify(payload) });

export const postLineup = (payload: Omit<Lineup, 'id' | 'updatedAt'> & { id?: string }) =>
  api<Lineup>('/lineup', { method: 'POST', body: JSON.stringify(payload) });

export const postAvailability = (payload: { eventId: string; userId: string; status: AvailabilityStatus }) =>
  api<DataStore['availability'][number]>('/availability', { method: 'POST', body: JSON.stringify(payload) });

export const clearAvailability = (payload: { eventId: string; userId: string }) =>
  api<{ ok: true }>('/availability/clear', { method: 'POST', body: JSON.stringify(payload) });

export const getNextRef = () => api<NextRefState>('/next-ref');
export const passNextRef = (payload: { userId: string; eventId: string }) =>
  api<NextRefState>('/next-ref/pass', { method: 'POST', body: JSON.stringify(payload) });
export const acceptNextRef = (payload: { userId: string; eventId: string }) =>
  api<NextRefState>('/next-ref/accept', { method: 'POST', body: JSON.stringify(payload) });
export const completeNextRef = (payload: { eventId: string }) =>
  api<NextRefState>('/next-ref/complete', { method: 'POST', body: JSON.stringify(payload) });
export const getNextRefHistory = () => api<NextRefHistoryEntry[]>('/next-ref/history');
