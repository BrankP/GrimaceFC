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
import { formatLocalDate, getBrowserTimeZone } from '../utils/date';
import { getNextGameOnOrAfterToday } from '../utils/events';

type DropTarget = `position:${string}` | 'subs' | 'notAvailable' | 'unknowns';
type DragDimension = 'primary';
const SYSTEM_USER_ID = 'grimace-bot';

const buildDragId = (dimension: DragDimension, source: string, playerId: string) => `${dimension}|${source}|${playerId}`;

const parseDragId = (dragId: string): { dimension: DragDimension; source: string; playerId: string } | null => {
  const [dimension, source, playerId] = dragId.split('|');
  if (!dimension || !source || !playerId) return null;
  if (dimension !== 'primary') return null;
  return { dimension, source, playerId };
};

function DraggablePlayer({ dragId, label, canDrag = true }: { dragId: string; label: string; canDrag?: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: dragId, disabled: !canDrag });
  return (
    <button
      ref={setNodeRef}
      type="button"
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`chip ${canDrag ? '' : 'chip-static'}`}
      {...(canDrag ? listeners : {})}
      {...(canDrag ? attributes : {})}
    >
      {label}
    </button>
  );
}

function DropSlot({ id, children, className = '', canDrop = true }: { id: DropTarget; children: ReactNode; className?: string; canDrop?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !canDrop });
  return <div ref={setNodeRef} className={`${className} ${isOver ? 'slot-over' : ''}`}>{children}</div>;
}

function PositionDropSlot({
  position,
  playerId,
  getUserName,
  canDrop,
  canDrag,
}: {
  position: string;
  playerId: string | null;
  getUserName: (userId: string) => string;
  canDrop: boolean;
  canDrag: boolean;
}) {
  const dropId: DropTarget = `position:${position}`;
  const { setNodeRef, isOver } = useDroppable({ id: dropId, disabled: !canDrop });

  return (
    <div className="position">
      <div ref={setNodeRef} style={POSITION_LAYOUT[position]} className={`position-inner ${isOver ? 'slot-over' : ''}`}>
        <small>{position}</small>
        {playerId && <DraggablePlayer dragId={buildDragId('primary', dropId, playerId)} label={getUserName(playerId)} canDrag={canDrag} />}
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

const addToPrimaryPlacement = (lineup: Lineup, target: DropTarget, playerId: string): { displacedUserId: string | null } => {
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
    return { displacedUserId: null };
  }

  return { displacedUserId: null };
};

export function NextGamePage() {
  const { data, saveLineup, getUserName, getAvailability, setAvailability, clearAvailability, canEditLineup } = useAppState();
  const store = data!;
  const userTimeZone = getBrowserTimeZone();
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
  );

  const nextGame = useMemo(() => getNextGameOnOrAfterToday(store.events), [store.events]);
  const playerUsers = useMemo(() => store.users.filter((user) => user.id !== SYSTEM_USER_ID), [store.users]);

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

    const availableUsers = playerUsers.filter((u) => getAvailability(nextGame.id, u.id) === 'available').map((u) => u.id);
    const notAvailable = playerUsers.filter((u) => getAvailability(nextGame.id, u.id) === 'not_available').map((u) => u.id);

    const positions = { ...base.positions };
    Object.keys(positions).forEach((pos) => {
      if (positions[pos] && !availableUsers.includes(positions[pos] as string)) positions[pos] = null;
    });

    const assigned = new Set(Object.values(positions).filter(Boolean) as string[]);
    const subs = availableUsers.filter((id) => !assigned.has(id));

    return { ...base, positions, subs, notAvailable };
  }, [store.lineups, playerUsers, nextGame, getAvailability]);

  const [draftLineup, setDraftLineup] = useState<Lineup | null>(null);
  const [hasPendingSave, setHasPendingSave] = useState(false);

  useEffect(() => {
    if (!hasPendingSave) {
      if (draftLineup && computedLineup) {
        const draftTs = Date.parse(draftLineup.updatedAt);
        const computedTs = Date.parse(computedLineup.updatedAt);
        if (Number.isFinite(draftTs) && Number.isFinite(computedTs) && computedTs < draftTs) return;
      }
      setDraftLineup(computedLineup);
    }
  }, [computedLineup, hasPendingSave, draftLineup]);

  const lineup = draftLineup ?? computedLineup;
  if (!lineup || !nextGame) return <p>No upcoming game found.</p>;

  const unknowns = playerUsers.filter((u) => getAvailability(nextGame.id, u.id) === null).map((u) => u.id);

  const handleDrop = ({ active, over }: DragEndEvent) => {
    if (!canEditLineup) return;
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

    let nextStatus: 'available' | 'not_available' | 'unknown' = 'unknown';
    let displacedUserId: string | null = null;

    const isFieldSwap =
      parsed.source.startsWith('position:') &&
      target.startsWith('position:') &&
      Boolean(lineup.positions[target.replace('position:', '')]);

    if (target === 'unknowns') {
      removeFromPrimaryPlacement(next, parsed.playerId);
      nextStatus = 'unknown';
    } else if (isFieldSwap) {
      const sourcePos = parsed.source.replace('position:', '');
      const targetPos = target.replace('position:', '');
      const targetPlayer = lineup.positions[targetPos] as string | null;
      const sourcePlayer = lineup.positions[sourcePos] as string | null;

      if (targetPlayer && sourcePlayer === parsed.playerId) {
        next.positions[sourcePos] = targetPlayer;
        next.positions[targetPos] = parsed.playerId;
      }
      nextStatus = 'available';
    } else {
      removeFromPrimaryPlacement(next, parsed.playerId);
      const primaryResult = addToPrimaryPlacement(next, target, parsed.playerId);
      displacedUserId = primaryResult.displacedUserId;
      nextStatus = target === 'notAvailable' ? 'not_available' : 'available';
    }

    setDraftLineup(next);
    setHasPendingSave(true);
    void (async () => {
      try {
        const writes: Array<Promise<void>> = [saveLineup(next)];
        if (nextStatus === 'unknown') writes.push(clearAvailability(nextGame.id, parsed.playerId));
        if (nextStatus === 'available' || nextStatus === 'not_available') writes.push(setAvailability(nextGame.id, parsed.playerId, nextStatus));
        if (displacedUserId) writes.push(setAvailability(nextGame.id, displacedUserId, 'available'));
        await Promise.all(writes);
      } finally {
        setHasPendingSave(false);
      }
    })();
  };

  return (
    <section>
      <h2>Next Game Lineup</h2>
      <p>{nextGame.opponent} • {formatLocalDate(nextGame.date)} ({userTimeZone})</p>
      {!canEditLineup && <p className="muted">View mode: lineup drag-and-drop is disabled.</p>}
      <DndContext onDragEnd={handleDrop} collisionDetection={closestCenter} sensors={sensors}>
        <div className="lineup-layout">
          <div className={`field card ${canEditLineup ? '' : 'field-readonly'}`}>
            {FORMATION_433.map((pos) => (
              <PositionDropSlot
                key={pos}
                position={pos}
                playerId={lineup.positions[pos] as string | null}
                getUserName={getUserName}
                canDrop={canEditLineup}
                canDrag={canEditLineup}
              />
            ))}
          </div>
          <aside className="stack">
            <DropSlot id="subs" className="card" canDrop={canEditLineup}>
              <h3>Subs</h3>
              <div className="chip-wrap">
                {lineup.subs.map((id) => (
                  <DraggablePlayer key={`subs-${id}`} dragId={buildDragId('primary', 'subs', id)} label={getUserName(id)} canDrag={canEditLineup} />
                ))}
              </div>
            </DropSlot>
            <DropSlot id="notAvailable" className="card" canDrop={canEditLineup}>
              <h3>Not available</h3>
              <div className="chip-wrap">
                {lineup.notAvailable.map((id) => (
                  <DraggablePlayer key={`notavail-${id}`} dragId={buildDragId('primary', 'notAvailable', id)} label={getUserName(id)} canDrag={canEditLineup} />
                ))}
              </div>
            </DropSlot>
            <DropSlot id="unknowns" className="card" canDrop={canEditLineup}>
              <h3>The Unknowns</h3>
              <div className="chip-wrap">
                {unknowns.map((id) => (
                  <DraggablePlayer key={`unknown-${id}`} dragId={buildDragId('primary', 'unknowns', id)} label={getUserName(id)} canDrag={canEditLineup} />
                ))}
              </div>
            </DropSlot>
          </aside>
        </div>
      </DndContext>
      <img
        className="next-game-banner"
        src={encodeURI('/ChatGPT Image Apr 17, 2026, 07_43_26 PM.png')}
        alt="Grimace FC banner"
      />
    </section>
  );
}
