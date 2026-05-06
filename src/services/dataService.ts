import type { AvailabilityStatus, DataStore, EventScore, Lineup, Message, NextRefHistoryEntry, NextRefState, NotificationPreference, TeamEvent, User } from '../types/models';
import { getNextGameOnOrAfterToday } from '../utils/events';
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
  const [events, messages] = await Promise.all([
    api<TeamEvent[]>('/events'),
    api<Message[]>('/messages'),
  ]);
  const nextGame = getNextGameOnOrAfterToday(events);

  const users = await api<User[]>('/users');
  const availability = await api<DataStore['availability']>('/availability');
  const lineup = nextGame ? await api<Lineup | null>(`/lineup?eventId=${encodeURIComponent(nextGame.id)}`) : null;

  return { users, events, messages, availability, lineups: lineup ? [lineup] : [] };
};

export const upsertUser = (payload: { id?: string; name: string; nickname?: string | null; createdYear?: number }) =>
  api<User>('/users/upsert', { method: 'POST', body: JSON.stringify(payload) });

export const postMessage = (payload: { userId: string; text: string }) =>
  api<Message>('/messages', { method: 'POST', body: JSON.stringify(payload) });

export const patchMessage = (payload: { messageId: string; userId: string; text: string }) =>
  api<Message>(`/messages/${encodeURIComponent(payload.messageId)}`, { method: 'PATCH', body: JSON.stringify({ userId: payload.userId, text: payload.text }) });

export const removeMessage = (payload: { messageId: string; userId: string }) =>
  api<{ ok: true }>(`/messages/${encodeURIComponent(payload.messageId)}`, { method: 'DELETE', body: JSON.stringify({ userId: payload.userId }) });

export const toggleReaction = (payload: { messageId: string; userId: string; emoji: string }) =>
  api<Message>(`/messages/${encodeURIComponent(payload.messageId)}/reactions`, { method: 'POST', body: JSON.stringify({ userId: payload.userId, emoji: payload.emoji }) });

export const getVapidPublicKey = () => api<{ publicKey: string | null }>('/push/vapid-public-key');

export const savePushSubscription = (payload: { userId: string; subscription: PushSubscriptionJSON }) =>
  api<{ ok: true }>('/push/subscription', { method: 'POST', body: JSON.stringify(payload) });

export const deletePushSubscription = (payload: { userId: string; endpoint: string }) =>
  api<{ ok: true }>('/push/subscription', { method: 'DELETE', body: JSON.stringify(payload) });


export const postLineup = (payload: Omit<Lineup, 'id' | 'updatedAt'> & { id?: string }) =>
  api<Lineup>('/lineup', { method: 'POST', body: JSON.stringify(payload) });

export const postAvailability = (payload: { eventId: string; userId: string; status: AvailabilityStatus }) =>
  api<DataStore['availability'][number]>('/availability', { method: 'POST', body: JSON.stringify(payload) });

export const clearAvailability = (payload: { eventId: string; userId: string }) =>
  api<{ ok: true }>('/availability/clear', { method: 'POST', body: JSON.stringify(payload) });

export const postEventScore = (payload: {
  eventId: string;
  grimaceScore: number;
  opponentScore: number;
  goalDetails: Array<{ scorerUserId: string | null; assistUserId: string | null; isOwnGoal: boolean }>;
}) => api<EventScore>('/event-score', { method: 'POST', body: JSON.stringify(payload) });

export const getNextRef = () => api<NextRefState>('/next-ref');
export const passNextRef = (payload: { userId: string; eventId: string }) =>
  api<NextRefState>('/next-ref/pass', { method: 'POST', body: JSON.stringify(payload) });
export const acceptNextRef = (payload: { userId: string; eventId: string }) =>
  api<NextRefState>('/next-ref/accept', { method: 'POST', body: JSON.stringify(payload) });
export const skipNextRef = (payload: { eventId: string }) =>
  api<NextRefState>('/next-ref/skip', { method: 'POST', body: JSON.stringify(payload) });
export const completeNextRef = (payload: { eventId: string }) =>
  api<NextRefState>('/next-ref/complete', { method: 'POST', body: JSON.stringify(payload) });
export const getNextRefHistory = () => api<NextRefHistoryEntry[]>('/next-ref/history');

export const saveNotificationPreference = (payload: { userId: string; preference: NotificationPreference }) =>
  api<{ ok: true }>('/users/notification-preference', { method: 'POST', body: JSON.stringify(payload) });
