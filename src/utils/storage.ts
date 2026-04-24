const CURRENT_USER_KEY = 'grimacefc.currentUserId';
const UI_PREFS_KEY = 'grimacefc.uiPrefs';
const TEAM_PASSCODE_KEY = 'grimacefc.teamPasscode';

export const readCurrentUserId = () => localStorage.getItem(CURRENT_USER_KEY);
export const writeCurrentUserId = (userId: string) => localStorage.setItem(CURRENT_USER_KEY, userId);

export type UiPrefs = {
  activeTab?: string;
};

export const readUiPrefs = (): UiPrefs => {
  const raw = localStorage.getItem(UI_PREFS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as UiPrefs;
  } catch {
    return {};
  }
};

export const writeUiPrefs = (prefs: UiPrefs) => {
  localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs));
};

export const readTeamPasscode = () => localStorage.getItem(TEAM_PASSCODE_KEY) ?? '';
export const writeTeamPasscode = (value: string) => localStorage.setItem(TEAM_PASSCODE_KEY, value);

// kept for backwards compatibility with historical imports in older branches
export const makeExportBundle = (payload: unknown) => JSON.stringify(payload);


// backwards compatibility for older components still importing this symbol
export const readLocalChanges = () => ({ users: [], messages: [], nicknames: [], lineups: [], availability: [] });


const VISITOR_SESSION_KEY = 'grimacefc.visitorSession';

export type VisitorSession = {
  firstName: string;
  lastName: string;
};

export const readVisitorSession = (): VisitorSession | null => {
  const raw = localStorage.getItem(VISITOR_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VisitorSession;
  } catch {
    return null;
  }
};

export const writeVisitorSession = (session: VisitorSession | null) => {
  if (!session) {
    localStorage.removeItem(VISITOR_SESSION_KEY);
    return;
  }
  localStorage.setItem(VISITOR_SESSION_KEY, JSON.stringify(session));
};
