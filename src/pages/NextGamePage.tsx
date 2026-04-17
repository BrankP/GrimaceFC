import { DndContext, DragEndEvent, PointerSensor, TouchSensor, closestCenter, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useAppState } from '../App';
import { FORMATION_433, POSITION_LAYOUT } from '../constants/formation';
import type { Lineup } from '../types/models';

function DraggablePlayer({ playerId, label }: { playerId: string; label: string }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: `player:${playerId}` });
  return (
    <button ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform) }} className="chip" {...listeners} {...attributes}>
      {label}
    </button>
  );
}

function DropSlot({ id, children, className = '' }: { id: string; children: ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef} className={`${className} ${isOver ? 'slot-over' : ''}`}>{children}</div>;
}

export function NextGamePage() {
  const { data, saveLineup, getUserName, getAvailability } = useAppState();
  const store = data!;
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 8 },
    }),
  );

  const nextGame = useMemo(
    () => [...store.events].filter((e) => e.eventType === 'Game').sort((a, b) => +new Date(a.date) - +new Date(b.date))[0],
    [store.events],
  );

  const computedLineup = useMemo<Lineup | null>(() => {
    if (!nextGame) return null;
    const existing = store.lineups.find((l) => l.eventId === nextGame.id);
    const base =
      existing ?? {
        id: `lineup-${nextGame.id}`,
        eventId: nextGame.id,
        formation: '4-3-3' as const,
        positions: Object.fromEntries(FORMATION_433.map((pos) => [pos, null])),
        subs: [],
        notAvailable: [],
        beerDutyUserId: nextGame.beerDutyUserId ?? null,
        refDutyUserId: nextGame.refDutyUserId ?? null,
        updatedAt: new Date().toISOString(),
      };

    const availableUsers = store.users.filter((u) => getAvailability(nextGame.id, u.id) === 'available').map((u) => u.id);
    const notAvailable = store.users.filter((u) => getAvailability(nextGame.id, u.id) === 'not_available').map((u) => u.id);

    const positions = { ...base.positions };
    Object.keys(positions).forEach((pos) => {
      if (positions[pos] && !availableUsers.includes(positions[pos] as string)) positions[pos] = null;
    });

    const assigned = new Set(Object.values(positions).filter(Boolean) as string[]);
    const subs = availableUsers.filter((id) => !assigned.has(id));

    return { ...base, positions, subs, notAvailable };
  }, [store.events, store.lineups, store.users, nextGame, getAvailability]);

  const [draftLineup, setDraftLineup] = useState<Lineup | null>(null);

  useEffect(() => {
    setDraftLineup(computedLineup);
  }, [computedLineup]);

  const lineup = draftLineup ?? computedLineup;

  if (!lineup || !nextGame) return <p>No upcoming game found.</p>;

  const handleDrop = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const playerId = String(active.id).replace('player:', '');
    const target = String(over.id);

    const next: Lineup = {
      ...lineup,
      positions: { ...lineup.positions },
      subs: lineup.subs.filter((id) => id !== playerId),
      notAvailable: lineup.notAvailable.filter((id) => id !== playerId),
      beerDutyUserId: lineup.beerDutyUserId === playerId ? null : lineup.beerDutyUserId ?? null,
      refDutyUserId: lineup.refDutyUserId === playerId ? null : lineup.refDutyUserId ?? null,
    };

    Object.keys(next.positions).forEach((pos) => {
      if (next.positions[pos] === playerId) next.positions[pos] = null;
    });

    if (target.startsWith('position:')) {
      const pos = target.replace('position:', '');
      const existing = next.positions[pos];
      next.positions[pos] = playerId;
      if (existing && existing !== playerId) next.subs.push(existing);
    } else if (target === 'beerDuty') {
      const displaced = next.beerDutyUserId;
      next.beerDutyUserId = playerId;
      if (displaced && displaced !== playerId) next.subs.push(displaced);
    } else if (target === 'refDuty') {
      const displaced = next.refDutyUserId;
      next.refDutyUserId = playerId;
      if (displaced && displaced !== playerId) next.subs.push(displaced);
    } else if (target === 'subs') {
      if (!next.subs.includes(playerId)) next.subs.push(playerId);
    } else if (target === 'notAvailable') {
      if (!next.notAvailable.includes(playerId)) next.notAvailable.push(playerId);
    }

    setDraftLineup(next);
    void saveLineup(next);
  };

  return (
    <section>
      <h2>Next Game Lineup</h2>
      <p>{nextGame.opponent} • {new Date(nextGame.date).toLocaleDateString()}</p>
      <DndContext onDragEnd={handleDrop} collisionDetection={closestCenter} sensors={sensors}>
        <div className="lineup-layout">
          <div className="field card">
            {FORMATION_433.map((pos) => (
              <DropSlot key={pos} id={`position:${pos}`} className="position" >
                <div style={POSITION_LAYOUT[pos]} className="position-inner">
                  <small>{pos}</small>
                  {lineup.positions[pos] && (
                    <DraggablePlayer playerId={lineup.positions[pos] as string} label={getUserName(lineup.positions[pos] as string)} />
                  )}
                </div>
              </DropSlot>
            ))}
          </div>
          <aside className="stack">
            <DropSlot id="beerDuty" className="card">
              <h3>Beer Duty</h3>
              <div className="chip-wrap">
                {lineup.beerDutyUserId ? <DraggablePlayer playerId={lineup.beerDutyUserId} label={getUserName(lineup.beerDutyUserId)} /> : <small>Unassigned</small>}
              </div>
            </DropSlot>
            <DropSlot id="refDuty" className="card">
              <h3>Ref Duty</h3>
              <div className="chip-wrap">
                {lineup.refDutyUserId ? <DraggablePlayer playerId={lineup.refDutyUserId} label={getUserName(lineup.refDutyUserId)} /> : <small>Unassigned</small>}
              </div>
            </DropSlot>
            <DropSlot id="subs" className="card">
              <h3>Subs</h3>
              <div className="chip-wrap">
                {lineup.subs.map((id) => <DraggablePlayer key={id} playerId={id} label={getUserName(id)} />)}
              </div>
            </DropSlot>
            <DropSlot id="notAvailable" className="card">
              <h3>Not available</h3>
              <div className="chip-wrap">
                {lineup.notAvailable.map((id) => <DraggablePlayer key={id} playerId={id} label={getUserName(id)} />)}
              </div>
            </DropSlot>
          </aside>
        </div>
      </DndContext>
    </section>
  );
}
