import { useMemo, useState } from 'react';
import { useAppState } from '../App';
import { formatDayAndMonth, formatDayOfMonth, formatLocalTime, getBrowserTimeZone, getMonthLabel } from '../utils/date';

const SYSTEM_USER_ID = 'grimace-bot';

const getEventIndicator = (eventType: string, homeAway: string | null | undefined) => {
  if (eventType === 'Sesh') return { dot: '🟣', label: 'Sesh' };
  if (homeAway === 'Away') return { dot: '🟠', label: 'Away' };
  return { dot: '🔵', label: 'Home' };
};

export function UpcomingGamesPage() {
  const { data, currentUser, getAvailability, setAvailability, getUserName, canWrite } = useAppState();
  const store = data!;

  const sortedEvents = useMemo(() => [...store.events].sort((a, b) => +new Date(a.date) - +new Date(b.date)), [store.events]);
  const playerUsers = useMemo(() => store.users.filter((user) => user.id !== SYSTEM_USER_ID), [store.users]);

  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const toggleExpanded = (eventId: string) => setExpandedId((current) => (current === eventId ? null : eventId));
  const formatEventTime = (isoDate: string, eventType: string) => (eventType === 'Sesh' ? 'All day' : formatLocalTime(isoDate));
  const userTimeZone = getBrowserTimeZone();

  const getMapEmbedUrl = (address: string) => `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;

  return (
    <section>
      <h2>Upcoming Games & Sessions</h2>
      <p className="muted">Times shown in your local timezone ({userTimeZone}).</p>
      {Object.entries(grouped).map(([month, events]) => (
        <div key={month} className="month-group sleek-list-wrap">
          <h3>{month}</h3>
          <div className="sleek-list">
            {events.map((event) => {
              const status = getAvailability(event.id, currentUser!.id);
              const lineup = store.lineups.find((candidate) => candidate.eventId === event.id);
              const beerDutyUserId = lineup?.beerDutyUserId ?? event.beerDutyUserId;
              const refDutyUserId = lineup?.refDutyUserId ?? event.refDutyUserId;
              const pendingRefUserId = event.pendingRefUserId ?? null;
              const indicator = getEventIndicator(event.eventType, event.homeAway);
              const isExpanded = expandedId === event.id;
              const currentlyResponsibleRefUserId = refDutyUserId ?? (event.homeAway === 'Away' ? pendingRefUserId : null);
              const loggedInUserHasDuty = Boolean(
                currentUser && (beerDutyUserId === currentUser.id || currentlyResponsibleRefUserId === currentUser.id),
              );
              const statusIcon = loggedInUserHasDuty ? '⚠️' : indicator.dot;
              const attendees = playerUsers.filter((user) => getAvailability(event.id, user.id) === 'available');
              const nonAttendees = playerUsers.filter((user) => getAvailability(event.id, user.id) === 'not_available');
              const noResponse = playerUsers.filter((user) => getAvailability(event.id, user.id) === null);
              const mapAddress = event.mapAddress || event.location;

              return (
                <article key={event.id} className={`sleek-event-row ${event.isNextUp ? 'next-up' : ''} ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}>
                  <div className="sleek-event-header" onClick={() => toggleExpanded(event.id)} role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ' ? toggleExpanded(event.id) : null)}>
                  <div className="sleek-event-date">
                    <strong>{formatDayOfMonth(event.date)}</strong>
                    <small>{formatDayAndMonth(event.date)}</small>
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
                        onClick={() => void (canWrite ? setAvailability(event.id, currentUser!.id, 'available') : Promise.resolve())}
                        aria-label="Mark available"
                        disabled={!canWrite}
                      >
                        ✅
                      </button>
                      <button
                        type="button"
                        className={`avail-pill ${status === 'not_available' ? 'active-no' : ''}`}
                        onClick={() => void (canWrite ? setAvailability(event.id, currentUser!.id, 'not_available') : Promise.resolve())}
                        aria-label="Mark not available"
                        disabled={!canWrite}
                      >
                        ❌
                      </button>
                    </div>
                  </div>

                  </div>

                  {isExpanded && (
                    <div className="sleek-event-expanded">
                      {event.eventType === 'Game' && (
                        <div className="sleek-duty-grid">
                          <div className="sleek-duty-card">
                            <p className="sleek-duty-label">Beer Duty</p>
                            <p className="sleek-duty-value">{beerDutyUserId ? getUserName(beerDutyUserId) : 'Unassigned'}</p>
                          </div>
                          <div className="sleek-duty-card">
                            <p className="sleek-duty-label">Ref Duty</p>
                            <p className="sleek-duty-value">
                              {refDutyUserId
                                ? getUserName(refDutyUserId)
                                : event.homeAway === 'Away'
                                  ? (pendingRefUserId ? `Pending - ${getUserName(pendingRefUserId)}` : 'Pending')
                                  : 'N/A'}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="sleek-attendance-groups">
                        <div>
                          <p className="sleek-event-line muted"><strong>Attending ({attendees.length})</strong></p>
                          <p className="sleek-event-line muted">{attendees.length ? attendees.map((user) => getUserName(user.id)).join(', ') : 'None'}</p>
                        </div>
                        <div>
                          <p className="sleek-event-line muted"><strong>Not Attending ({nonAttendees.length})</strong></p>
                          <p className="sleek-event-line muted">{nonAttendees.length ? nonAttendees.map((user) => getUserName(user.id)).join(', ') : 'None'}</p>
                        </div>
                        <div>
                          <p className="sleek-event-line muted"><strong>No Response ({noResponse.length})</strong></p>
                          <p className="sleek-event-line muted">{noResponse.length ? noResponse.map((user) => getUserName(user.id)).join(', ') : 'None'}</p>
                        </div>
                      </div>

                      <iframe
                        className="sleek-event-map"
                        width="600"
                        height="450"
                        style={{ border: 0 }}
                        loading="lazy"
                        allowFullScreen
                        referrerPolicy="no-referrer-when-downgrade"
                        src={getMapEmbedUrl(mapAddress)}
                        title={`Map for ${event.location}`}
                      />
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
