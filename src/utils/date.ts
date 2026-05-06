export const parseDisplayDate = (isoDate: string) => {
  // Event payloads currently store team-local kickoff times with a trailing `Z`.
  // Stripping the suffix preserves the intended wall-clock time for display.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(isoDate)) {
    return new Date(isoDate.slice(0, -1));
  }
  return new Date(isoDate);
};

export const getMonthLabel = (isoDate: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(parseDisplayDate(isoDate));

export const getBrowserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const formatInBrowserTimeZone = (isoDate: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', { ...options, timeZone: getBrowserTimeZone() }).format(parseDisplayDate(isoDate));

export const formatLocalDateTime = (isoDate: string) =>
  formatInBrowserTimeZone(isoDate, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export const formatLocalDate = (isoDate: string) =>
  formatInBrowserTimeZone(isoDate, { month: 'numeric', day: 'numeric', year: 'numeric' });

export const formatLocalTime = (isoDate: string) =>
  formatInBrowserTimeZone(isoDate, { hour: 'numeric', minute: '2-digit' });

export const formatDayAndMonth = (isoDate: string) =>
  formatInBrowserTimeZone(isoDate, { month: 'short', weekday: 'short' });

export const formatDayOfMonth = (isoDate: string) =>
  formatInBrowserTimeZone(isoDate, { day: 'numeric' });

export const getDisplayDateDayStartMs = (isoDate: string) => {
  const displayDate = parseDisplayDate(isoDate);
  displayDate.setHours(0, 0, 0, 0);
  return displayDate.getTime();
};

export const getTodayStartMs = (today = new Date()) => {
  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);
  return startOfToday.getTime();
};
