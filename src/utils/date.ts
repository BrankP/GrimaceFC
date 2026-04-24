export const getMonthLabel = (isoDate: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(isoDate));

export const getBrowserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const formatInBrowserTimeZone = (isoDate: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', { ...options, timeZone: getBrowserTimeZone() }).format(new Date(isoDate));

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
