const CURRENT_USER_KEY = 'grimacefc.currentUserId';
const TEAM_PASSCODE_KEY = 'grimacefc.teamPasscode';

export const readCurrentUserId = () => localStorage.getItem(CURRENT_USER_KEY);
export const writeCurrentUserId = (userId: string) => localStorage.setItem(CURRENT_USER_KEY, userId);

export const readTeamPasscode = () => localStorage.getItem(TEAM_PASSCODE_KEY) ?? '';
export const writeTeamPasscode = (value: string) => localStorage.setItem(TEAM_PASSCODE_KEY, value);


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
