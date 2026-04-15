export type EventType = 'Game' | 'Sesh';
export type AvailabilityStatus = 'available' | 'not_available';

export interface User {
  id: string;
  name: string;
  nickname?: string;
  createdYear: number;
  createdAt: string;
}

export interface TeamEvent {
  id: string;
  eventType: EventType;
  date: string;
  dayOfWeek: string;
  homeAway?: 'Home' | 'Away';
  duties?: string;
  location: string;
  opponent?: string;
  occasion?: string;
  teamName: string;
  isNextUp?: boolean;
}

export interface Fine {
  id: string;
  whoUserId: string;
  amount: number;
  reason: string;
  submittedByUserId: string;
  submittedAt: string;
}

export interface Message {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
}

export interface Nickname {
  id: string;
  userId: string;
  nickname: string;
  updatedAt: string;
  updatedByUserId: string;
}

export interface Lineup {
  id: string;
  eventId: string;
  formation: '4-3-3';
  positions: Record<string, string | null>;
  subs: string[];
  notAvailable: string[];
  updatedAt: string;
}

export interface Availability {
  id: string;
  eventId: string;
  userId: string;
  status: AvailabilityStatus;
  updatedAt: string;
}

export interface LocalChanges {
  users: User[];
  fines: Fine[];
  messages: Message[];
  nicknames: Nickname[];
  lineups: Lineup[];
  availability: Availability[];
}

export interface DataStore {
  users: User[];
  events: TeamEvent[];
  fines: Fine[];
  messages: Message[];
  nicknames: Nickname[];
  lineups: Lineup[];
  availability: Availability[];
}
