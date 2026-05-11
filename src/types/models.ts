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

export interface MessageReactionUser {
  id: string;
  name: string;
}

export interface MessageReactionSummary {
  emoji: string;
  count: number;
  users: MessageReactionUser[];
}

export type MessageType = 'normal' | 'rev';

export interface Message {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
  editedAt?: string | null;
  messageType: MessageType;
  notificationPreference?: NotificationPreference;
  reactions: MessageReactionSummary[];
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

export interface SeasonLadderRow {
  id: string;
  position: number | null;
  teamHashId: string | null;
  teamName: string;
  clubName: string | null;
  clubCode: string | null;
  clubLogo: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  byes: number;
  forfeits: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  pointAdjustment: number;
  pointsPerGame: number;
  points: number;
  recentForm: Array<'W' | 'D' | 'L' | string>;
  upcomingMatches: unknown[];
  upNextLogo: string | null;
  isOurTeam: boolean;
  updatedAt: string;
}

export interface SeasonLadderResponse {
  updatedAt: string | null;
  rows: SeasonLadderRow[];
  refreshed?: boolean;
  warning?: string;
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
  slotId: string;
  skippedAt?: string | null;
}

export interface NextRefState {
  event: TeamEvent | null;
  currentRefUserId: string | null;
  currentRefSlotId: string | null;
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
