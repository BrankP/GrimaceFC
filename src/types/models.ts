export type EventType = 'Game' | 'Sesh';
export type AvailabilityStatus = 'available' | 'not_available';

export type NotificationPreference = 'all_chats' | 'tagged_only' | 'disabled';

export interface User {
  id: string;
  name: string;
  nickname?: string | null;
  goals?: number;
  assists?: number;
  notificationPreference?: NotificationPreference;
}

export interface TeamEvent {
  id: string;
  eventType: EventType;
  date: string;
  dayOfWeek: string;
  homeAway?: 'Home' | 'Away' | null;
  beerDutyUserId?: string | null;
  refDutyUserId?: string | null;
  pendingRefUserId?: string | null;
  location: string;
  mapAddress?: string | null;
  opponent?: string | null;
  occasion?: string | null;
  isNextUp?: boolean;
  score?: EventScore | null;
}

export interface EventGoalDetail {
  id: string;
  scorerUserId: string | null;
  assistUserId: string | null;
  isOwnGoal: boolean;
  sortOrder: number;
}

export interface EventScore {
  eventId: string;
  grimaceScore: number;
  opponentScore: number;
  goalDetails: EventGoalDetail[];
  updatedAt: string;
}

export interface Message {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
  notificationPreference?: NotificationPreference;
}

export interface Lineup {
  id: string;
  eventId: string;
  formation: '4-3-3';
  positions: Record<string, string | null>;
  subs: string[];
  notAvailable: string[];
  beerDutyUserId?: string | null;
  refDutyUserId?: string | null;
  updatedAt: string;
}

export interface Availability {
  id: string;
  eventId: string;
  userId: string;
  status: AvailabilityStatus;
  updatedAt: string;
}

export interface DataStore {
  users: User[];
  events: TeamEvent[];
  messages: Message[];
  lineups: Lineup[];
  availability: Availability[];
}

export type NextRefStatus = 'Pending Decision' | 'Accepted';

export interface NextRefPassEntry {
  userId: string;
  name: string;
  passedAt: string;
}

export interface NextRefRosterEntry {
  userId: string;
  name: string;
  order: number;
}

export interface NextRefState {
  event: TeamEvent | null;
  currentRefUserId: string | null;
  currentRefName: string | null;
  status: NextRefStatus | null;
  runningBalance: number;
  passList: NextRefPassEntry[];
  roster: NextRefRosterEntry[];
}

export interface NextRefHistoryEntry {
  eventId: string;
  eventDate: string;
  opponent: string | null;
  location: string;
  refereeUserId: string;
  refereeName: string;
  finalBalance: number;
  passed: NextRefPassEntry[];
  acceptedAt: string | null;
  completedAt: string;
}
