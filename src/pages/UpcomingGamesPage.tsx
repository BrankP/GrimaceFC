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

  const [expandedId, setExpandedId] = useState<string | null>(() => (sortedEvents[0] ? sortedEvents[0].id : null));

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

  const toggleExpanded = (eventId: string) => setExpandedId(eventId);
  const formatEventTime = (isoDate: string, eventType: string) =>
    eventType === 'Sesh' ? 'All day' : new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(isoDate));

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
              const isExpanded = expandedId === event.id;
              const loggedInUserHasDuty = Boolean(
                currentUser && (beerDutyUserId === currentUser.id || refDutyUserId === currentUser.id),
              );
              const statusIcon = loggedInUserHasDuty ? '⚠️' : indicator.dot;

              return (
                <article key={event.id} className={`sleek-event-row ${event.isNextUp ? 'next-up' : ''} ${isExpanded ? 'is-expanded' : 'is-collapsed'}`} onClick={() => toggleExpanded(event.id)}>
                  <div className="sleek-event-date">
                    <strong>{new Date(event.date).getDate()}</strong>
                    <small>{new Intl.DateTimeFormat('en-US', { month: 'short', weekday: 'short' }).format(new Date(event.date))}</small>
                    <p className="sleek-event-date-type">
                      <span className="sleek-dot" aria-hidden="true">{statusIcon}</span>
                      <span>{indicator.label}</span>
                    </p>
                  </div>

                  <div className="sleek-event-main">
                    <p className="sleek-event-line">
                      <span>{formatEventTime(event.date, event.eventType)}</span>
                    </p>

                    <p className="sleek-event-line"><strong>{event.eventType === 'Game' ? `vs ${event.opponent}` : event.occasion}</strong></p>
                  </div>

                  <div className="sleek-event-attendance" onClick={(e) => e.stopPropagation()}>
                    <div className="row avail-row-top">
                      <button
                        type="button"
                        className={`avail-pill ${status === 'available' ? 'active-yes' : ''}`}
                        onClick={() => void setAvailability(event.id, currentUser!.id, 'available')}
                        aria-label="Mark available"
                      >
                        ✅
                      </button>
                      <button
                        type="button"
                        className={`avail-pill ${status === 'not_available' ? 'active-no' : ''}`}
                        onClick={() => void setAvailability(event.id, currentUser!.id, 'not_available')}
                        aria-label="Mark not available"
                      >
                        ❌
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="sleek-event-expanded">
                      <p className="sleek-event-line muted">Type: {event.eventType}</p>
                      <p className="sleek-event-line muted">Location: {event.location}</p>
                      <p className="sleek-event-line muted">Occasion: {event.occasion || 'N/A'}</p>
                      <p className="sleek-event-line muted">Home/Away: {event.homeAway || 'N/A'}</p>
                      <p className="sleek-event-line muted">Beer Duty: {beerDutyUserId ? getUserName(beerDutyUserId) : 'N/A'}</p>
                      <p className="sleek-event-line muted">Ref Duty: {refDutyUserId ? getUserName(refDutyUserId) : 'N/A'}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
