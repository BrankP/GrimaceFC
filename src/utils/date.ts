export const formatTime = (isoDate: string) =>
  new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(isoDate));

export const formatDate = (isoDate: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', weekday: 'short' }).format(new Date(isoDate));

export const getMonthLabel = (isoDate: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(isoDate));
