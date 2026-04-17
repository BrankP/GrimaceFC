import { useMemo, useState } from 'react';
import { useAppState } from '../App';
import { getMonthLabel } from '../utils/date';

const getEventIndicator = (eventType: string, homeAway: string | null | undefined) => {
  if (eventType === 'Sesh') return { dot: '🟣', label: 'Sesh' };
  if (homeAway === 'Away') return { dot: '🟠', label: 'Away' };
  return { dot: '🔵', label: 'Home' };
};

export function UpcomingGamesPage() {
  const { data, currentUser, getAvailability, setAvailability, getUserName } = useAppState();
  const store = data!;

  const sortedEvents = useMemo(() => [...store.events].sort((a, b) => +new Date(a.date) - +new Date(b.date)), [store.events]);

  const [expandedIds, setExpandedIds] = useState<string[]>(() => (sortedEvents[0] ? [sortedEvents[0].id] : []));

  const grouped = useMemo(
    () =>
      sortedEvents.reduce<Record<string, typeof sortedEvents>>((acc, event) => {
        const month = getMonthLabel(event.date);
        acc[month] = acc[month] ?? [];
        acc[month].push(event);
        return acc;
      }, {}),
    [sortedEvents],
  );

  const toggleExpanded = (eventId: string) => {
    setExpandedIds((existing) => (existing.includes(eventId) ? existing.filter((id) => id !== eventId) : [...existing, eventId]));
  };

  return (
    <section>
      <h2>Upcoming Games & Sessions</h2>
      {Object.entries(grouped).map(([month, events]) => (
        <div key={month} className="month-group sleek-list-wrap">
          <h3>{month}</h3>
          <div className="sleek-list">
            {events.map((event) => {
              const status = getAvailability(event.id, currentUser!.id);
              const lineup = store.lineups.find((candidate) => candidate.eventId === event.id);
              const beerDutyUserId = lineup?.beerDutyUserId ?? event.beerDutyUserId;
              const refDutyUserId = lineup?.refDutyUserId ?? event.refDutyUserId;
              const indicator = getEventIndicator(event.eventType, event.homeAway);
              const isExpanded = expandedIds.includes(event.id);

              return (
                <article key={event.id} className={`sleek-event-row ${event.isNextUp ? 'next-up' : ''}`} onClick={() => toggleExpanded(event.id)}>
                  <div className="sleek-event-date">
                    <strong>{new Date(event.date).getDate()}</strong>
                    <small>{new Intl.DateTimeFormat('en-US', { month: 'short', weekday: 'short' }).format(new Date(event.date))}</small>
                  </div>

                  <div className="sleek-event-main">
                    <p className="sleek-event-line">
                      <span className="sleek-dot" aria-hidden="true">{indicator.dot}</span>
                      <span>{indicator.label}</span>
                      <span>•</span>
                      <span>{event.eventType === 'Sesh' ? 'All day' : new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(event.date))}</span>
                    </p>

                    <p className="sleek-event-line"><strong>{event.eventType === 'Game' ? `vs ${event.opponent}` : event.occasion}</strong></p>
                    <p className="sleek-event-line muted">{event.location}</p>

                    {isExpanded && (
                      <>
                        {event.eventType === 'Game' && (
                          <p className="sleek-event-line muted">Beer: {beerDutyUserId ? getUserName(beerDutyUserId) : 'Unassigned'} · Ref: {refDutyUserId ? getUserName(refDutyUserId) : 'Unassigned'}</p>
                        )}
                        <div className="row avail-row" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className={`icon-toggle ${status === 'available' ? 'active-yes' : ''}`}
                            onClick={() => void setAvailability(event.id, currentUser!.id, 'available')}
                            aria-label="Mark available"
                          >
                            ✅ Available
                          </button>
                          <button
                            type="button"
                            className={`icon-toggle ${status === 'not_available' ? 'active-no' : ''}`}
                            onClick={() => void setAvailability(event.id, currentUser!.id, 'not_available')}
                            aria-label="Mark not available"
                          >
                            ❌ Not available
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
