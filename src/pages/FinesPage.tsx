import { useMemo, useState } from 'react';
import { useAppState } from '../App';

export function FinesPage() {
  const { data, getUserName, currentUser } = useAppState();
  const store = data!;
  const [whoFilter, setWhoFilter] = useState('');

  const filtered = useMemo(
    () =>
      store.fines.filter((fine) => {
        if (whoFilter && fine.whoUserId !== whoFilter) return false;
        return true;
      }),
    [store.fines, whoFilter],
  );

  const activeUserTotalOwed = useMemo(() => {
    if (!currentUser) return 0;
    return store.fines
      .filter((fine) => fine.whoUserId === currentUser.id)
      .reduce((total, fine) => total + fine.amount, 0);
  }, [store.fines, currentUser]);

  const activeUserFineCount = useMemo(() => {
    if (!currentUser) return 0;
    return store.fines.filter((fine) => fine.whoUserId === currentUser.id).length;
  }, [store.fines, currentUser]);

  const formatTimeSince = (isoDate: string) => {
    const deltaMs = Date.now() - new Date(isoDate).getTime();
    const hours = Math.floor(deltaMs / (1000 * 60 * 60));
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <section>
      <h2>Fines</h2>
      {currentUser && (
        <p className="card">
          <strong>You owe ${activeUserTotalOwed.toFixed(2)}</strong> for <strong>{activeUserFineCount} fines</strong>
        </p>
      )}
      <div className="card filters">
        <select value={whoFilter} onChange={(e) => setWhoFilter(e.target.value)}>
          <option value="">All players</option>
          {store.users.map((user) => <option key={user.id} value={user.id}>{getUserName(user.id)}</option>)}
        </select>
      </div>
      <div className="stack fines-list">
        {filtered.map((fine) => (
          <article className="fine-row" key={fine.id}>
            <div>
              <p className="fine-row-name">{getUserName(fine.whoUserId)}</p>
              <p className="fine-row-reason">{fine.reason}</p>
              <p className="fine-row-meta">Added by {getUserName(fine.submittedByUserId)} • {formatTimeSince(fine.submittedAt)}</p>
            </div>
            <p className="fine-row-amount">${fine.amount.toFixed(0)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
