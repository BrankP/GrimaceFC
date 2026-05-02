import { useMemo, useState } from 'react';
import { useAppState } from '../App';

const SYSTEM_USER_ID = 'grimace-bot';

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

export function TeamStatsPage() {
  const { data, currentUser } = useAppState();

  const players = useMemo<RankedPlayer[]>(
    () =>
      (data?.users ?? [])
        .filter((user) => user.id !== SYSTEM_USER_ID)
        .map((user) => {
          const goals = toStatValue(user.goals);
          const assists = toStatValue(user.assists);
          return {
            id: user.id,
            name: user.name,
            goals,
            assists,
            goalContributions: goals + assists,
          };
        }),
    [data?.users],
  );

  const seasonRecord = useMemo<SeasonRecord>(() => {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), 3, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59, 999));

    const completedGames = (data?.events ?? [])
      .filter((event) => event.eventType === 'Game')
      .filter((event) => {
        const eventDate = new Date(event.date);
        if (Number.isNaN(eventDate.getTime())) return false;
        return eventDate >= start && eventDate <= end;
      })
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
    while (lastFive.length < 5) {
      lastFive.unshift(null);
    }

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
