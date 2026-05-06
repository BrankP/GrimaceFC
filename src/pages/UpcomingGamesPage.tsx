import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppState } from '../App';
import { formatDayAndMonth, formatDayOfMonth, formatLocalTime, getBrowserTimeZone, getMonthLabel } from '../utils/date';
import { getChronologicalEventTimeMs, getNextGameOnOrAfterToday } from '../utils/events';
import type { EventGoalDetail, TeamEvent } from '../types/models';

const SYSTEM_USER_ID = 'grimace-bot';

const getEventIndicator = (eventType: string, homeAway: string | null | undefined) => {
  if (eventType === 'Sesh') return { dot: '🟣', label: 'Sesh' };
  if (homeAway === 'Away') return { dot: '🟠', label: 'Away' };
  return { dot: '🔵', label: 'Home' };
};

export function UpcomingGamesPage() {
  const { data, currentUser, getAvailability, setAvailability, getUserName, canWrite, canEditScores, saveEventScore } = useAppState();
  const store = data!;

  const sortedEvents = useMemo(() => {
    return [...store.events].sort((a, b) => getChronologicalEventTimeMs(a) - getChronologicalEventTimeMs(b));
  }, [store.events]);
  const nextGameId = useMemo(() => getNextGameOnOrAfterToday(sortedEvents)?.id ?? null, [sortedEvents]);
  const playerUsers = useMemo(() => store.users.filter((user) => user.id !== SYSTEM_USER_ID), [store.users]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<TeamEvent | null>(null);
  const [grimaceScore, setGrimaceScore] = useState('0');
  const [opponentScore, setOpponentScore] = useState('0');
  const [goalRows, setGoalRows] = useState<Array<{ id: string; scorerUserId: string; assistUserId: string }>>([]);
  const [formError, setFormError] = useState('');
  const longPressTimer = useRef<number | null>(null);
  const suppressClickAfterLongPress = useRef<Record<string, boolean>>({});
  const eventCardRefs = useRef<Record<string, HTMLElement | null>>({});

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
  const ownGoalValue = '__own_goal__';

  const scoreSummary = (event: TeamEvent) => {
    if (event.eventType !== 'Game' || !event.score) return null;
    const { grimaceScore: gf, opponentScore: ga } = event.score;
    const tone = gf > ga ? 'win' : gf < ga ? 'loss' : 'draw';
    const prefix = tone === 'win' ? 'W' : tone === 'loss' ? 'L' : 'T';
    return { text: `${prefix} ${gf}-${ga}`, tone };
  };

  const openScoreModal = (event: TeamEvent) => {
    if (!canEditScores || event.eventType !== 'Game') return;
    setEditingEvent(event);
    setFormError('');
    const currentScore = event.score;
    setGrimaceScore(String(currentScore?.grimaceScore ?? 0));
    setOpponentScore(String(currentScore?.opponentScore ?? 0));
    const existingRows = (currentScore?.goalDetails ?? []).map((row: EventGoalDetail) => ({
      id: row.id,
      scorerUserId: row.isOwnGoal ? ownGoalValue : (row.scorerUserId ?? ''),
      assistUserId: row.assistUserId ?? '',
    }));
    setGoalRows(existingRows.length ? existingRows : [{ id: crypto.randomUUID(), scorerUserId: '', assistUserId: '' }]);
  };

  const closeModal = () => setEditingEvent(null);

  useEffect(() => () => {
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
  }, []);


  useEffect(() => {
    if (!expandedId) return;
    const expandedCard = eventCardRefs.current[expandedId];
    if (!expandedCard) return;

    const frame = window.requestAnimationFrame(() => {
      expandedCard.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [expandedId]);

  useEffect(() => {
    if (!nextGameId) return;
    const nextGameRow = eventCardRefs.current[nextGameId];
    if (!nextGameRow) return;
    nextGameRow.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [nextGameId]);

  return (
    <>
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
              const isNextGame = event.id === nextGameId;
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
                <article
                  key={event.id}
                  ref={(element) => {
                    eventCardRefs.current[event.id] = element;
                  }}
                  className={`sleek-event-row ${isNextGame ? 'next-up' : ''} ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}
                >
                  <div
                    className="sleek-event-header"
                    onClick={() => {
                      if (suppressClickAfterLongPress.current[event.id]) {
                        suppressClickAfterLongPress.current[event.id] = false;
                        return;
                      }
                      toggleExpanded(event.id);
                    }}
                    onDoubleClick={() => openScoreModal(event)}
                    onTouchStart={() => {
                      if (!canEditScores || event.eventType !== 'Game') return;
                      longPressTimer.current = window.setTimeout(() => {
                        suppressClickAfterLongPress.current[event.id] = true;
                        openScoreModal(event);
                      }, 450);
                    }}
                    onTouchEnd={() => {
                      if (longPressTimer.current !== null) {
                        window.clearTimeout(longPressTimer.current);
                        longPressTimer.current = null;
                      }
                    }}
                    onTouchMove={() => {
                      if (longPressTimer.current !== null) {
                        window.clearTimeout(longPressTimer.current);
                        longPressTimer.current = null;
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ' ? toggleExpanded(event.id) : null)}
                  >
                  <div className="sleek-event-date">
                    <strong>{formatDayOfMonth(event.date)}</strong>
                    <small>{formatDayAndMonth(event.date)}</small>
                    <p className="sleek-event-date-type">
                      <span className="sleek-dot" aria-hidden="true">{statusIcon}</span>
                      <span>{indicator.label}</span>
                    </p>
                  </div>

                  <div className="sleek-event-main">
                    {isNextGame && <p className="next-game-pill">Next Game</p>}
                    <p className="sleek-event-line">
                      <span>{formatEventTime(event.date, event.eventType)}</span>
                    </p>

                    <p className="sleek-event-line"><strong>{event.eventType === 'Game' ? `vs ${event.opponent}` : event.occasion}</strong></p>
                  </div>
                  <div className="sleek-event-score">
                    {(() => {
                      const result = scoreSummary(event);
                      if (!result) return null;
                      return <p className={`sleek-score sleek-score-${result.tone}`}>{result.text}</p>;
                    })()}
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
    {editingEvent && (
      <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={closeModal}>
        <form
          className="card modal"
          onClick={(e) => e.stopPropagation()}
          onSubmit={(e) => {
            e.preventDefault();
            const gf = Number(grimaceScore);
            const ga = Number(opponentScore);
            if (!Number.isInteger(gf) || gf < 0 || !Number.isInteger(ga) || ga < 0) {
              setFormError('Scores must be whole numbers greater than or equal to 0.');
              return;
            }

            const mappedRows = goalRows
              .filter((row) => row.scorerUserId || row.assistUserId)
              .map((row) => ({
                scorerUserId: row.scorerUserId === ownGoalValue ? null : (row.scorerUserId || null),
                assistUserId: row.assistUserId || null,
                isOwnGoal: row.scorerUserId === ownGoalValue,
              }));

            const hasInvalidScorer = mappedRows.some((row) => !row.isOwnGoal && !row.scorerUserId);
            if (hasInvalidScorer) {
              setFormError('Select a scorer for each non-own-goal row.');
              return;
            }

            void saveEventScore({
              eventId: editingEvent.id,
              grimaceScore: gf,
              opponentScore: ga,
              goalDetails: mappedRows,
            }).then(() => closeModal());
          }}
        >
          <h3>{editingEvent.score ? 'Edit score' : 'Enter score'}</h3>
          <p className="muted">{editingEvent.opponent ? `vs ${editingEvent.opponent}` : editingEvent.location}</p>
          <label>
            Grimace FC score
            <input className="no-spinner" type="number" min={0} step={1} value={grimaceScore} onChange={(e) => setGrimaceScore(e.target.value)} required />
          </label>
          <label>
            Opponent score
            <input className="no-spinner" type="number" min={0} step={1} value={opponentScore} onChange={(e) => setOpponentScore(e.target.value)} required />
          </label>
          <div className="stack">
            <p><strong>Goal scorer rows</strong></p>
            {goalRows.map((row, idx) => (
              <div key={row.id} className="row">
                <select
                  value={row.scorerUserId}
                  onChange={(e) => setGoalRows((current) => current.map((candidate) => (candidate.id === row.id ? { ...candidate, scorerUserId: e.target.value } : candidate)))}
                >
                  <option value="">Scorer</option>
                  <option value={ownGoalValue}>Own Goal</option>
                  {playerUsers.map((user) => (
                    <option key={user.id} value={user.id}>{getUserName(user.id)}</option>
                  ))}
                </select>
                <select
                  value={row.assistUserId}
                  onChange={(e) => setGoalRows((current) => current.map((candidate) => (candidate.id === row.id ? { ...candidate, assistUserId: e.target.value } : candidate)))}
                >
                  <option value="">Assist (optional)</option>
                  {playerUsers.map((user) => (
                    <option key={user.id} value={user.id}>{getUserName(user.id)}</option>
                  ))}
                </select>
                <button type="button" className="secondary" onClick={() => setGoalRows((current) => (current.length > 1 ? current.filter((candidate) => candidate.id !== row.id) : current))}>
                  Remove
                </button>
                <span className="muted">#{idx + 1}</span>
              </div>
            ))}
            <button type="button" className="secondary" onClick={() => setGoalRows((current) => [...current, { id: crypto.randomUUID(), scorerUserId: '', assistUserId: '' }])}>
              + Add goal row
            </button>
          </div>
          {formError ? <p className="error">{formError}</p> : null}
          <div className="row">
            <button type="submit">Save score</button>
            <button type="button" className="secondary" onClick={closeModal}>Cancel</button>
          </div>
        </form>
      </div>
    )}
    </>
  );
}
