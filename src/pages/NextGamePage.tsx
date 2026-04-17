import { DndContext, DragEndEvent, PointerSensor, TouchSensor, closestCenter, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useAppState } from '../App';
import { FORMATION_433, POSITION_LAYOUT } from '../constants/formation';
import type { Lineup } from '../types/models';

type PrimaryTarget = `position:${string}` | 'subs' | 'notAvailable';
type DutyTarget = 'beerDuty' | 'refDuty';
type DropTarget = PrimaryTarget | DutyTarget;
type DragDimension = 'primary' | 'beerDuty' | 'refDuty';

const buildDragId = (dimension: DragDimension, source: string, playerId: string) => `${dimension}|${source}|${playerId}`;

const parseDragId = (dragId: string): { dimension: DragDimension; source: string; playerId: string } | null => {
  const [dimension, source, playerId] = dragId.split('|');
  if (!dimension || !source || !playerId) return null;
  if (dimension !== 'primary' && dimension !== 'beerDuty' && dimension !== 'refDuty') return null;
  return { dimension, source, playerId };
};

function DraggablePlayer({ dragId, label }: { dragId: string; label: string }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: dragId });
  return (
    <button ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform) }} className="chip" {...listeners} {...attributes}>
      {label}
    </button>
  );
}

function DropSlot({ id, children, className = '' }: { id: DropTarget; children: ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef} className={`${className} ${isOver ? 'slot-over' : ''}`}>{children}</div>;
}

function PositionDropSlot({
  position,
  playerId,
  getUserName,
}: {
  position: string;
  playerId: string | null;
  getUserName: (userId: string) => string;
}) {
  const dropId: DropTarget = `position:${position}`;
  const { setNodeRef, isOver } = useDroppable({ id: dropId });

  return (
    <div className="position">
      <div ref={setNodeRef} style={POSITION_LAYOUT[position]} className={`position-inner ${isOver ? 'slot-over' : ''}`}>
        <small>{position}</small>
        {playerId && (
          <DraggablePlayer dragId={buildDragId('primary', dropId, playerId)} label={getUserName(playerId)} />
        )}
      </div>
    </div>
  );
}

const removeFromPrimaryPlacement = (lineup: Lineup, playerId: string) => {
  Object.keys(lineup.positions).forEach((pos) => {
    if (lineup.positions[pos] === playerId) lineup.positions[pos] = null;
  });
  lineup.subs = lineup.subs.filter((id) => id !== playerId);
  lineup.notAvailable = lineup.notAvailable.filter((id) => id !== playerId);
};

const addToPrimaryPlacement = (lineup: Lineup, target: PrimaryTarget, playerId: string) => {
  if (target.startsWith('position:')) {
    const pos = target.replace('position:', '');
    const displaced = lineup.positions[pos];
    lineup.positions[pos] = playerId;
    if (displaced && displaced !== playerId && !lineup.subs.includes(displaced)) {
      lineup.subs.push(displaced);
    }
    return;
  }

  if (target === 'subs') {
    if (!lineup.subs.includes(playerId)) lineup.subs.push(playerId);
    return;
  }

  if (target === 'notAvailable') {
    if (!lineup.notAvailable.includes(playerId)) lineup.notAvailable.push(playerId);
  }
};

const isPrimaryTarget = (target: DropTarget): target is PrimaryTarget =>
  target.startsWith('position:') || target === 'subs' || target === 'notAvailable';

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
    const parsed = parseDragId(String(active.id));
    if (!parsed) return;

    const target = String(over.id) as DropTarget;
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
