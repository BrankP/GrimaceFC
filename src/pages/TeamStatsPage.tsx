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
  const { data } = useAppState();

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

  const topContributor = useMemo(() => {
    if (!hasAnyStats) return null;
    return [...players].sort((a, b) => b.goalContributions - a.goalContributions || b.goals - a.goals || a.name.localeCompare(b.name))[0] ?? null;
  }, [players, hasAnyStats]);

  return (
    <section className="team-stats-page">
      <h2>Team Stats</h2>

      <div className="team-summary-grid">
        <article className="card team-summary-card">
          <p className="team-summary-icon" aria-hidden="true">⚽</p>
          <p className="team-summary-value">{totals.totalGoals}</p>
          <p className="team-summary-label">Total Goals</p>
        </article>
        <article className="card team-summary-card">
          <p className="team-summary-icon" aria-hidden="true">🎯</p>
          <p className="team-summary-value">{totals.totalAssists}</p>
          <p className="team-summary-label">Total Assists</p>
        </article>
        <article className="card team-summary-card">
          <p className="team-summary-icon" aria-hidden="true">✨</p>
          <p className="team-summary-value">{totals.totalGoalContributions}</p>
          <p className="team-summary-label">Goal Contributions</p>
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
