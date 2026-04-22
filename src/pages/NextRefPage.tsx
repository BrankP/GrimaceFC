import { useEffect, useMemo, useState } from 'react';
import { useAppState } from '../App';
import { acceptNextRef, completeNextRef, getNextRef, getNextRefHistory, passNextRef } from '../services/dataService';
import type { NextRefHistoryEntry, NextRefState } from '../types/models';

const formatDateTime = (isoDate: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(isoDate));

export function NextRefPage() {
  const { currentUser } = useAppState();
  const [state, setState] = useState<NextRefState | null>(null);
  const [history, setHistory] = useState<NextRefHistoryEntry[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [isWorking, setWorking] = useState(false);
  const [error, setError] = useState('');

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

  const isCurrentRef = Boolean(currentUser && state?.currentRefUserId === currentUser.id);
  const isAccepted = state?.status === 'Accepted';
  const canComplete = isAccepted;

  const currentPassNames = useMemo(
    () => Array.from(new Set(state?.passList.map((entry) => entry.name) ?? [])),
    [state?.passList],
  );

  const runAction = async (action: () => Promise<NextRefState>) => {
    setWorking(true);
    try {
      const nextState = await action();
      setState(nextState);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setWorking(false);
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

      {state?.event ? (
        <article className="card next-ref-summary">
          <div className="next-ref-summary-grid">
            <div>
              <p className="next-ref-subtitle">Next Away Game</p>
              <h3>{state.event.opponent ? `vs ${state.event.opponent}` : 'Away Match'}</h3>
              <p>{formatDateTime(state.event.date)} • {state.event.location}</p>
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
            disabled={!isCurrentRef || isWorking || !state?.event || isAccepted}
            onClick={() => {
              if (!currentUser || !state?.event) return;
              void runAction(() => passNextRef({ userId: currentUser.id, eventId: state.event!.id }));
            }}
          >
            Pass Duty
          </button>
          <button
            type="button"
            disabled={!isCurrentRef || isWorking || !state?.event || isAccepted}
            onClick={() => {
              if (!currentUser || !state?.event) return;
              void runAction(() => acceptNextRef({ userId: currentUser.id, eventId: state.event!.id }));
            }}
          >
            Accept Duty
          </button>
        </div>

        <div className="row">
          <button
            type="button"
            className="secondary"
            disabled={!canComplete || !state?.event || isWorking}
            onClick={() => {
              if (!state?.event) return;
              void runAction(() => completeNextRef({ eventId: state.event!.id }));
            }}
          >
            Complete Duty
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
          {state?.roster.map((entry, index) => (
            <p
              key={entry.userId}
              className={`next-ref-roster-item ${index === 0 ? 'is-current' : ''}`}
            >
              #{entry.order + 1} {entry.name}
            </p>
          ))}
        </div>
      </article>

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
