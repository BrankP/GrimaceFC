import {
  DndContext,
  DragEndEvent,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
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

const addToPrimaryPlacement = (lineup: Lineup, target: PrimaryTarget, playerId: string): { displacedUserId: string | null } => {
  if (target.startsWith('position:')) {
    const pos = target.replace('position:', '');
    const displaced = lineup.positions[pos];
    lineup.positions[pos] = playerId;
    if (displaced && displaced !== playerId && !lineup.subs.includes(displaced)) {
      lineup.subs.push(displaced);
    }
    return { displacedUserId: displaced && displaced !== playerId ? displaced : null };
  }

  if (target === 'subs') {
    if (!lineup.subs.includes(playerId)) lineup.subs.push(playerId);
    return { displacedUserId: null };
  }

  if (target === 'notAvailable') {
    if (!lineup.notAvailable.includes(playerId)) lineup.notAvailable.push(playerId);
  }
  return { displacedUserId: null };
};

const isPrimaryTarget = (target: DropTarget): target is PrimaryTarget =>
  target.startsWith('position:') || target === 'subs' || target === 'notAvailable';

export function NextGamePage() {
  const { data, saveLineup, getUserName, getAvailability, setAvailability } = useAppState();
  const store = data!;
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
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
  const [hasPendingSave, setHasPendingSave] = useState(false);

  useEffect(() => {
    if (!hasPendingSave) {
      if (draftLineup && computedLineup) {
        const draftTs = Date.parse(draftLineup.updatedAt);
        const computedTs = Date.parse(computedLineup.updatedAt);
        // Do not overwrite optimistic state with older (possibly cached) server responses.
        if (Number.isFinite(draftTs) && Number.isFinite(computedTs) && computedTs < draftTs) return;
      }
      setDraftLineup(computedLineup);
    }
  }, [computedLineup, hasPendingSave, draftLineup]);

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
      subs: [...lineup.subs],
      notAvailable: [...lineup.notAvailable],
      beerDutyUserId: lineup.beerDutyUserId ?? null,
      refDutyUserId: lineup.refDutyUserId ?? null,
      updatedAt: new Date().toISOString(),
    };

    // Only primary placement is mutually exclusive (field/subs/not available)
    let draggedPrimaryStatus: 'available' | 'not_available' | null = null;
    let displacedUserId: string | null = null;
    if (isPrimaryTarget(target)) {
      removeFromPrimaryPlacement(next, parsed.playerId);
      const primaryResult = addToPrimaryPlacement(next, target, parsed.playerId);
      displacedUserId = primaryResult.displacedUserId;
      draggedPrimaryStatus = target === 'notAvailable' ? 'not_available' : 'available';
    }

    // Duty assignment dimensions are independent and additive.
    if (target === 'beerDuty') {
      next.beerDutyUserId = parsed.playerId;
    }
    if (target === 'refDuty') {
      next.refDutyUserId = parsed.playerId;
    }

    // If dragging from a specific duty token to primary space, only clear that duty token.
    if (isPrimaryTarget(target) && parsed.dimension === 'beerDuty') {
      if (next.beerDutyUserId === parsed.playerId) next.beerDutyUserId = null;
    }
    if (isPrimaryTarget(target) && parsed.dimension === 'refDuty') {
      if (next.refDutyUserId === parsed.playerId) next.refDutyUserId = null;
    }

    setDraftLineup(next);
    setHasPendingSave(true);
    void (async () => {
      try {
        const writes: Array<Promise<void>> = [saveLineup(next)];
        if (draggedPrimaryStatus) {
          writes.push(setAvailability(nextGame.id, parsed.playerId, draggedPrimaryStatus));
        }
        if (displacedUserId) {
          writes.push(setAvailability(nextGame.id, displacedUserId, 'available'));
        }
        await Promise.all(writes);
      } finally {
        setHasPendingSave(false);
      }
    })();
  };

  return (
    <section>
      <h2>Next Game Lineup</h2>
      <p>{nextGame.opponent} • {new Date(nextGame.date).toLocaleDateString()}</p>
      <DndContext onDragEnd={handleDrop} collisionDetection={closestCenter} sensors={sensors}>
        <div className="lineup-layout">
          <div className="field card">
            {FORMATION_433.map((pos) => (
              <PositionDropSlot key={pos} position={pos} playerId={lineup.positions[pos] as string | null} getUserName={getUserName} />
            ))}
          </div>
          <aside className="stack">
            <DropSlot id="beerDuty" className="card">
              <h3>Beer Duty</h3>
              <div className="chip-wrap">
                {lineup.beerDutyUserId ? (
                  <DraggablePlayer dragId={buildDragId('beerDuty', 'beerDuty', lineup.beerDutyUserId)} label={getUserName(lineup.beerDutyUserId)} />
                ) : (
                  <small>Unassigned</small>
                )}
              </div>
            </DropSlot>
            <DropSlot id="refDuty" className="card">
              <h3>Ref Duty</h3>
              <div className="chip-wrap">
                {lineup.refDutyUserId ? (
                  <DraggablePlayer dragId={buildDragId('refDuty', 'refDuty', lineup.refDutyUserId)} label={getUserName(lineup.refDutyUserId)} />
                ) : (
                  <small>Unassigned</small>
                )}
              </div>
            </DropSlot>
            <DropSlot id="subs" className="card">
              <h3>Subs</h3>
              <div className="chip-wrap">
                {lineup.subs.map((id) => (
                  <DraggablePlayer key={`subs-${id}`} dragId={buildDragId('primary', 'subs', id)} label={getUserName(id)} />
                ))}
              </div>
            </DropSlot>
            <DropSlot id="notAvailable" className="card">
              <h3>Not available</h3>
              <div className="chip-wrap">
                {lineup.notAvailable.map((id) => (
                  <DraggablePlayer key={`notavail-${id}`} dragId={buildDragId('primary', 'notAvailable', id)} label={getUserName(id)} />
                ))}
              </div>
            </DropSlot>
          </aside>
        </div>
      </DndContext>
    </section>
  );
}
