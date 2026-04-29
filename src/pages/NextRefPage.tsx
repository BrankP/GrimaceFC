import { useEffect, useMemo, useState } from 'react';
import { acceptNextRef, completeNextRef, getNextRef, getNextRefHistory, passNextRef } from '../services/dataService';
import type { NextRefHistoryEntry, NextRefState } from '../types/models';
import { useAppState } from '../App';
import { formatLocalDateTime, getBrowserTimeZone } from '../utils/date';

const formatDateTime = (isoDate: string) => formatLocalDateTime(isoDate);

export function NextRefPage() {
  const [state, setState] = useState<NextRefState | null>(null);
  const [history, setHistory] = useState<NextRefHistoryEntry[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [isWorking, setWorking] = useState(false);
  const [pendingAction, setPendingAction] = useState<'pass' | 'accept' | 'complete' | null>(null);
  const [error, setError] = useState('');
  const { canWrite, canEditLineup, isVisitor, refreshAppData } = useAppState();
  const [showRosterModal, setShowRosterModal] = useState(false);
  const userTimeZone = getBrowserTimeZone();

  const refresh = async () => {
    try {
      const [nextRef, nextRefHistory] = await Promise.all([getNextRef(), getNextRefHistory()]);
      setState(nextRef);
      setHistory(nextRefHistory);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Next Ref state');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 20_000);
    return () => clearInterval(timer);
  }, []);

  const isAccepted = state?.status === 'Accepted';

  const currentPassNames = useMemo(
    () => Array.from(new Set(state?.passList.map((entry) => entry.name) ?? [])),
    [state?.passList],
  );


  const currentRosterIndex = useMemo(() => {
    if (!state?.roster.length || !state.currentRefUserId) return -1;
    return state.roster.findIndex((entry) => entry.userId === state.currentRefUserId);
  }, [state?.roster, state?.currentRefUserId]);

  const rosterPreview = useMemo(() => {
    if (!state?.roster.length) return [];
    if (currentRosterIndex < 0) return state.roster.slice(0, 5);

    return [-2, -1, 0, 1, 2].map((offset) => {
      const index = (currentRosterIndex + offset + state.roster.length) % state.roster.length;
      return state.roster[index];
    });
  }, [state?.roster, currentRosterIndex]);

  const runAction = async (actionType: 'pass' | 'accept' | 'complete', action: () => Promise<NextRefState>) => {
    setWorking(true);
    setPendingAction(actionType);
    try {
      const nextState = await action();
      setState(nextState);
      await Promise.all([refresh(), refreshAppData()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setWorking(false);
      setPendingAction(null);
    }
  };

  if (isLoading) {
    return (
      <section>
        <h2>Next Ref</h2>
        <p className="card">Loading next referee duty...</p>
      </section>
    );
  }

  return (
    <section className="next-ref-page">
      <h2>Next Ref</h2>
      {error && <p className="error">{error}</p>}
      {isVisitor && <p className="muted">Visitor mode: Next Ref actions are disabled.</p>}
      {!isVisitor && !canEditLineup && <p className="muted">Only admins can complete duty or run override actions.</p>}

      {state?.event ? (
        <article className="card next-ref-summary">
          <div className="next-ref-summary-grid">
            <div>
              <p className="next-ref-subtitle">Next Away Game</p>
              <h3>{state.event.opponent ? `vs ${state.event.opponent}` : 'Away Match'}</h3>
              <p>{formatDateTime(state.event.date)} ({userTimeZone}) • {state.event.location}</p>
            </div>
            <div>
              <p className="next-ref-subtitle">Current Referee</p>
              <h3>{state?.currentRefName ?? 'Unassigned'}</h3>
              <p className={`status-badge ${isAccepted ? 'accepted' : 'pending'}`}>{state?.status ?? 'Pending Decision'}</p>
            </div>
            <div>
              <p className="next-ref-subtitle">Running Balance</p>
              <p className="next-ref-balance">${state?.runningBalance ?? 0}</p>
              {currentPassNames.length > 0 && <p className="next-ref-owed">Owed by: {currentPassNames.join(', ')}</p>}
            </div>
          </div>
        </article>
      ) : (
        <p className="card">No upcoming away games found.</p>
      )}

      <article className="card next-ref-actions">
        <div className="next-ref-action-grid">
          <button
            type="button"
            className={`next-ref-action-btn ${pendingAction === 'pass' ? 'is-pending' : ''}`}
            disabled={!canWrite || isWorking || isAccepted || !state?.event || !state?.currentRefUserId}
            onClick={() => {
              if (!state?.event || !state.currentRefUserId) return;
              void runAction('pass', () => passNextRef({ userId: state.currentRefUserId!, eventId: state.event!.id }));
            }}
          >
            {pendingAction === 'pass' ? 'Passing…' : 'Pass Duty'}
          </button>
          <button
            type="button"
            className={`next-ref-action-btn ${pendingAction === 'accept' ? 'is-pending' : ''}`}
            disabled={!canWrite || isWorking || isAccepted || !state?.event || !state?.currentRefUserId}
            onClick={() => {
              if (!state?.event || !state.currentRefUserId) return;
              void runAction('accept', () => acceptNextRef({ userId: state.currentRefUserId!, eventId: state.event!.id }));
            }}
          >
            {pendingAction === 'accept' ? 'Accepting…' : 'Accept Duty'}
          </button>
          <button
            type="button"
            className={`secondary next-ref-action-btn ${pendingAction === 'complete' ? 'is-pending' : ''}`}
            disabled={!canEditLineup || !state?.event || isWorking}
            onClick={() => {
              if (!state?.event) return;
              void runAction('complete', () => completeNextRef({ eventId: state.event!.id }));
            }}
          >
            {pendingAction === 'complete' ? 'Completing…' : 'Complete Duty'}
          </button>
        </div>
      </article>

      <article className="card">
        <p className="next-ref-subtitle">Pass List</p>
        {state?.passList.length ? (
          <div className="stack">
            {state.passList.map((entry) => (
              <p key={`${entry.userId}-${entry.passedAt}`} className="next-ref-pass-item">
                <strong>{entry.name}</strong> passed on {formatDateTime(entry.passedAt)}
              </p>
            ))}
          </div>
        ) : (
          <p>No one has passed yet.</p>
        )}
      </article>

      <article className="card">
        <p className="next-ref-subtitle">Ref Roster</p>
        <div className="stack">
          {rosterPreview.map((entry) => (
            <p
              key={`preview-${entry.userId}-${entry.order}`}
              className={`next-ref-roster-item ${entry.userId === state?.currentRefUserId ? 'is-current' : ''}`}
            >
              #{entry.order + 1} {entry.name}
            </p>
          ))}
        </div>
        <div className="row" style={{ marginTop: '.6rem' }}>
          <button type="button" className="secondary" onClick={() => setShowRosterModal(true)}>Expand Roster</button>
        </div>
      </article>

      {showRosterModal && (
        <div className="modal-backdrop" onClick={() => setShowRosterModal(false)}>
          <article className="card modal" onClick={(e) => e.stopPropagation()}>
            <p className="next-ref-subtitle">Full Ref Roster</p>
            <div className="next-ref-roster-scroll stack">
              {state?.roster.map((entry) => (
                <p
                  key={`modal-${entry.userId}-${entry.order}`}
                  className={`next-ref-roster-item ${entry.userId === state?.currentRefUserId ? 'is-current' : ''}`}
                >
                  #{entry.order + 1} {entry.name}
                </p>
              ))}
            </div>
            <button type="button" onClick={() => setShowRosterModal(false)}>Close</button>
          </article>
        </div>
      )}

      <article className="card">
        <p className="next-ref-subtitle">Completed History</p>
        {history.length ? (
          <div className="stack">
            {history.map((item) => (
              <div key={`${item.eventId}-${item.completedAt}`} className="next-ref-history-item">
                <p><strong>{item.opponent ? `vs ${item.opponent}` : item.location}</strong> ({formatDateTime(item.eventDate)})</p>
                <p>Ref: {item.refereeName}</p>
                <p>Final Balance: ${item.finalBalance}</p>
                <p>
                  Passed: {item.passed.length ? item.passed.map((entry) => entry.name).join(', ') : 'None'}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p>No completed referee duties yet.</p>
        )}
      </article>
    </section>
  );
}
