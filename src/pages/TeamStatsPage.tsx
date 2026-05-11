import { useEffect, useMemo, useState } from 'react';
import { useAppState } from '../App';
import { getSeasonLadder, refreshSeasonLadder } from '../services/dataService';
import type { SeasonLadderRow } from '../types/models';

const SYSTEM_USER_ID = 'grimace-bot';
const TEAM_STATS_START_DATE_ISO = '2026-04-01T00:00:00Z';
const TEAM_STATS_START_DATE_LABEL = 'After 1 April 2026';

type RankedPlayer = {
  id: string;
  name: string;
  goals: number;
  assists: number;
  goalContributions: number;
};

type LastFiveResult = 'W' | 'D' | 'L' | null;

type SeasonRecord = {
  mp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  lastFive: LastFiveResult[];
};

const toStatValue = (value: number | null | undefined) => {
  const normalized = Number(value ?? 0);
  if (!Number.isFinite(normalized) || normalized < 0) return 0;
  return Math.floor(normalized);
};

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

const rankToneClass = (rankIndex: number) => {
  if (rankIndex === 0) return 'is-gold';
  if (rankIndex === 1) return 'is-silver';
  if (rankIndex === 2) return 'is-bronze';
  return '';
};

const resultTypeForScores = (grimaceScore: number, opponentScore: number): Exclude<LastFiveResult, null> => {
  if (grimaceScore > opponentScore) return 'W';
  if (grimaceScore < opponentScore) return 'L';
  return 'D';
};

const isGameAfterTeamStatsStartDate = (eventDate: string) =>
  new Date(eventDate).getTime() > new Date(TEAM_STATS_START_DATE_ISO).getTime();

function RankedList({
  title,
  metricLabel,
  players,
}: {
  title: string;
  metricLabel: 'Goals' | 'Assists';
  players: RankedPlayer[];
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? players : players.slice(0, 5);

  return (
    <article className="card team-stats-card">
      <div className="team-stats-card-header">
        <h3>{title}</h3>
        <p className="muted">Sorted by {metricLabel.toLowerCase()}</p>
      </div>

      {!players.length ? (
        <p className="muted">No stats recorded yet.</p>
      ) : (
        <div className="team-rank-list" role="list">
          {visible.map((player, idx) => {
            const rank = idx + 1;
            const value = metricLabel === 'Goals' ? player.goals : player.assists;

            return (
              <div key={`${metricLabel}-${player.id}`} className="team-rank-row" role="listitem">
                <span className={`team-rank-badge ${rankToneClass(idx)}`}>#{rank}</span>
                <span className="team-initials-circle" aria-hidden="true">{getInitials(player.name)}</span>
                <p className="team-player-name">{player.name}</p>
                <p className="team-player-stat">{value}</p>
              </div>
            );
          })}
        </div>
      )}

      {players.length > 5 && (
        <div className="row" style={{ marginTop: '.5rem' }}>
          <button type="button" className="secondary" onClick={() => setShowAll((current) => !current)}>
            {showAll ? 'Show Less' : 'View All'}
          </button>
        </div>
      )}
    </article>
  );
}


function LadderLogo({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className="ladder-logo-placeholder" aria-hidden="true">–</span>;
  return <img className="ladder-logo" src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}

const formatLastUpdated = (value: string | null) => {
  if (!value) return 'Not synced yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

const resultBadgeClass = (result: string) => {
  const normalized = result.toUpperCase();
  if (normalized === 'W') return 'is-win';
  if (normalized === 'L') return 'is-loss';
  if (normalized === 'D') return 'is-draw';
  return 'is-empty';
};

function LiveLadderSection({ isAdmin }: { isAdmin: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [rows, setRows] = useState<SeasonLadderRow[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState<'success' | 'warning'>('success');

  const loadLadder = async () => {
    setIsLoading(true);
    setError('');
    try {
      const payload = await getSeasonLadder();
      setRows(payload.rows);
      setUpdatedAt(payload.updatedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the live ladder.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadLadder();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError('');
    setMessage('');
    setMessageKind('success');
    try {
      const payload = await refreshSeasonLadder();
      setRows(payload.rows);
      setUpdatedAt(payload.updatedAt);
      setMessage(payload.warning ?? 'Ladder refreshed successfully.');
      setMessageKind(payload.warning ? 'warning' : 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh the ladder.');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <article className="card live-ladder-card">
      <button type="button" className="live-ladder-toggle" aria-expanded={isOpen} onClick={() => setIsOpen((current) => !current)}>
        <span>
          <strong>Live Ladder</strong>
          <small>Last updated: {formatLastUpdated(updatedAt)}</small>
        </span>
        <span className="live-ladder-chevron" aria-hidden="true">{isOpen ? '▴' : '▾'}</span>
      </button>

      {isOpen && (
        <div className="live-ladder-content">
          <div className="live-ladder-toolbar">
            <p className="muted">Current Dribl ladder. Logos load from the source URLs.</p>
            {isAdmin && (
              <button type="button" className="secondary" onClick={() => void handleRefresh()} disabled={isRefreshing}>
                {isRefreshing ? 'Refreshing…' : 'Refresh ladder now'}
              </button>
            )}
          </div>

          {message && <p className={messageKind === 'warning' ? 'warning-text' : 'success-text'}>{message}</p>}
          {error && <p className="error">Unable to load ladder: {error}</p>}
          {isLoading && <p className="muted">Loading live ladder…</p>}
          {!isLoading && !error && !rows.length && <p className="muted">No ladder rows yet. An admin can refresh the ladder now.</p>}

          {!!rows.length && (
            <div className="live-ladder-scroll" role="region" aria-label="Live Ladder table" tabIndex={0}>
              <table className="live-ladder-table">
                <thead>
                  <tr>
                    <th>Position</th>
                    <th>Team</th>
                    <th>Played</th>
                    <th>Won</th>
                    <th>Drawn</th>
                    <th>Lost</th>
                    <th>Byes</th>
                    <th>Forfeits</th>
                    <th>GF</th>
                    <th>GA</th>
                    <th>GD</th>
                    <th>Adj.</th>
                    <th>Avg.</th>
                    <th>Pts</th>
                    <th>Recent Form</th>
                    <th>Up Next</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className={row.isOurTeam ? 'is-our-team' : ''}>
                      <td className="ladder-position">{row.position ?? '–'}</td>
                      <td className="ladder-team-cell">
                        <LadderLogo src={row.clubLogo} alt={`${row.teamName} logo`} />
                        <span>{row.teamName}</span>
                      </td>
                      <td>{row.played}</td>
                      <td>{row.won}</td>
                      <td>{row.drawn}</td>
                      <td>{row.lost}</td>
                      <td>{row.byes}</td>
                      <td>{row.forfeits}</td>
                      <td>{row.goalsFor}</td>
                      <td>{row.goalsAgainst}</td>
                      <td>{row.goalDifference}</td>
                      <td>{row.pointAdjustment}</td>
                      <td>{row.pointsPerGame.toFixed(2)}</td>
                      <td className="ladder-points">{row.points}</td>
                      <td>
                        <span className="ladder-form-row">
                          {row.recentForm.length ? row.recentForm.map((result, index) => (
                            <span key={`${row.id}-form-${index}`} className={`ladder-form-badge ${resultBadgeClass(result)}`}>{result}</span>
                          )) : <span className="muted">–</span>}
                        </span>
                      </td>
                      <td><LadderLogo src={row.upNextLogo} alt="Up next opponent logo" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export function TeamStatsPage() {
  const { data, currentUser, canEditScores } = useAppState();

  const players = useMemo<RankedPlayer[]>(() => {
    const playerStats = new Map<string, { goals: number; assists: number }>();

    (data?.events ?? [])
      .filter((event) => event.eventType === 'Game')
      .filter((event) => isGameAfterTeamStatsStartDate(event.date))
      .forEach((event) => {
        (event.score?.goalDetails ?? []).forEach((goalDetail) => {
          if (goalDetail.scorerUserId && !goalDetail.isOwnGoal) {
            const current = playerStats.get(goalDetail.scorerUserId) ?? { goals: 0, assists: 0 };
            playerStats.set(goalDetail.scorerUserId, { ...current, goals: current.goals + 1 });
          }

          if (goalDetail.assistUserId) {
            const current = playerStats.get(goalDetail.assistUserId) ?? { goals: 0, assists: 0 };
            playerStats.set(goalDetail.assistUserId, { ...current, assists: current.assists + 1 });
          }
        });
      });

    return (data?.users ?? [])
      .filter((user) => user.id !== SYSTEM_USER_ID)
      .map((user) => {
        const stats = playerStats.get(user.id);
        const goals = toStatValue(stats?.goals);
        const assists = toStatValue(stats?.assists);
        return {
          id: user.id,
          name: user.name,
          goals,
          assists,
          goalContributions: goals + assists,
        };
      });
  }, [data?.events, data?.users]);

  const seasonRecord = useMemo<SeasonRecord>(() => {
    const completedGames = (data?.events ?? [])
      .filter((event) => event.eventType === 'Game')
      .filter((event) => isGameAfterTeamStatsStartDate(event.date))
      .filter((event) => event.score !== null && event.score !== undefined)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let w = 0;
    let d = 0;
    let l = 0;
    let gf = 0;
    let ga = 0;
    const allResults: Exclude<LastFiveResult, null>[] = [];

    completedGames.forEach((event) => {
      const grimaceScore = Number(event.score?.grimaceScore ?? 0);
      const opponentScore = Number(event.score?.opponentScore ?? 0);
      gf += grimaceScore;
      ga += opponentScore;
      const result = resultTypeForScores(grimaceScore, opponentScore);
      allResults.push(result);
      if (result === 'W') w += 1;
      if (result === 'D') d += 1;
      if (result === 'L') l += 1;
    });

    const lastFive: LastFiveResult[] = allResults.slice(-5);

    return {
      mp: completedGames.length,
      w,
      d,
      l,
      gf,
      ga,
      gd: gf - ga,
      pts: (w * 3) + d,
      lastFive,
    };
  }, [data?.events]);

  const totals = useMemo(() => {
    const totalGoals = players.reduce((sum, player) => sum + player.goals, 0);
    const totalAssists = players.reduce((sum, player) => sum + player.assists, 0);
    const totalGoalContributions = totalGoals + totalAssists;
    return { totalGoals, totalAssists, totalGoalContributions };
  }, [players]);

  const scorers = useMemo(
    () => [...players].sort((a, b) => b.goals - a.goals || b.goalContributions - a.goalContributions || a.name.localeCompare(b.name)),
    [players],
  );

  const assisters = useMemo(
    () => [...players].sort((a, b) => b.assists - a.assists || b.goalContributions - a.goalContributions || a.name.localeCompare(b.name)),
    [players],
  );

  const hasAnyStats = totals.totalGoalContributions > 0;

  const myContributions = useMemo(() => {
    if (!currentUser) return 0;
    const me = players.find((player) => player.id === currentUser.id);
    return me ? me.goals + me.assists : 0;
  }, [players, currentUser]);

  const topContributor = useMemo(() => {
    if (!hasAnyStats) return null;
    return [...players].sort((a, b) => b.goalContributions - a.goalContributions || b.goals - a.goals || a.name.localeCompare(b.name))[0] ?? null;
  }, [players, hasAnyStats]);

  return (
    <section className="team-stats-page">
      <h2>Team Stats</h2>
      <p className="muted">{TEAM_STATS_START_DATE_LABEL}</p>

      <article className="card team-season-record-card">
        <div className="team-season-grid" role="table" aria-label="Season record summary">
          {[
            'MP', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts', 'Last 5',
          ].map((label) => (
            <p key={`season-label-${label}`} className={`team-season-col-label ${label === 'Pts' ? 'is-points' : ''}`} role="columnheader">{label}</p>
          ))}

          <p className="team-season-col-value" role="cell">{seasonRecord.mp}</p>
          <p className="team-season-col-value" role="cell">{seasonRecord.w}</p>
          <p className="team-season-col-value" role="cell">{seasonRecord.d}</p>
          <p className="team-season-col-value" role="cell">{seasonRecord.l}</p>
          <p className="team-season-col-value" role="cell">{seasonRecord.gf}</p>
          <p className="team-season-col-value" role="cell">{seasonRecord.ga}</p>
          <p className="team-season-col-value" role="cell">{seasonRecord.gd}</p>
          <p className="team-season-col-value is-points" role="cell">{seasonRecord.pts}</p>
          <div className="team-last-five-row" role="cell" aria-label="Last five results with most recent on the right">
            {seasonRecord.lastFive.map((result, index) => {
              const isMostRecent = index === seasonRecord.lastFive.length - 1;
              const tone = result === 'W' ? 'is-win' : result === 'L' ? 'is-loss' : result === 'D' ? 'is-draw' : 'is-empty';
              const symbol = result === 'W' ? '✓' : result === 'L' ? '✕' : '–';
              return (
                <span key={`last-five-${index}`} className={`team-last-five-dot ${tone} ${isMostRecent ? 'is-most-recent' : ''}`} aria-label={result ?? 'No result'}>
                  {symbol}
                </span>
              );
            })}
          </div>
        </div>
      </article>

      <div className="team-summary-grid">
        <article className="card team-summary-card">
          <p className="team-summary-icon" aria-hidden="true">⚽</p>
          <p className="team-summary-value">{totals.totalGoals}</p>
          <p className="team-summary-label">Goal Count</p>
        </article>
        <article className="card team-summary-card">
          <p className="team-summary-icon" aria-hidden="true">🎯</p>
          <p className="team-summary-value">{totals.totalAssists}</p>
          <p className="team-summary-label">Assist Count</p>
        </article>
        <article className="card team-summary-card">
          <p className="team-summary-icon" aria-hidden="true">✨</p>
          <p className="team-summary-value">{myContributions}</p>
          <p className="team-summary-label">My Contributions</p>
        </article>
      </div>

      <LiveLadderSection isAdmin={canEditScores} />

      {!hasAnyStats && <p className="card muted">No stats recorded yet.</p>}

      <RankedList title="Top Scorers" metricLabel="Goals" players={scorers.filter((player) => player.goals > 0)} />

      <RankedList title="Top Assisters" metricLabel="Assists" players={assisters.filter((player) => player.assists > 0)} />

      <article className="card team-top-contributor">
        <div>
          <p className="team-contributor-label">⭐ Top Contributor</p>
          {topContributor ? (
            <>
              <h3>{topContributor.name}</h3>
              <p className="muted">
                {topContributor.goalContributions} Goal Contributions ({topContributor.goals} Goals, {topContributor.assists} Assists)
              </p>
            </>
          ) : (
            <>
              <h3>No player yet</h3>
              <p className="muted">No stats recorded yet.</p>
            </>
          )}
        </div>

        <div className="team-contribution-total" aria-label="Top contributor total goal contributions">
          {topContributor?.goalContributions ?? 0}
        </div>
      </article>
    </section>
  );
}
