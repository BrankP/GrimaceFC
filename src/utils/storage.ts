const CURRENT_USER_KEY = 'grimacefc.currentUserId';
const UI_PREFS_KEY = 'grimacefc.uiPrefs';

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

// kept for backwards compatibility with historical imports in older branches
export const makeExportBundle = (payload: unknown) => JSON.stringify(payload);
