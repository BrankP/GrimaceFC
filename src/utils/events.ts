import type { TeamEvent } from '../types/models';
import { getDisplayDateDayStartMs, getTodayStartMs, parseDisplayDate } from './date';

export const getChronologicalEventTimeMs = (event: TeamEvent) => parseDisplayDate(event.date).getTime();

export const isGameOnOrAfterToday = (event: TeamEvent, today = new Date()) =>
  event.eventType === 'Game' && getDisplayDateDayStartMs(event.date) >= getTodayStartMs(today);

export const getNextGameOnOrAfterToday = (events: TeamEvent[], today = new Date()) =>
  [...events]
    .filter((event) => isGameOnOrAfterToday(event, today))
    .sort((a, b) => getChronologicalEventTimeMs(a) - getChronologicalEventTimeMs(b))[0] ?? null;
