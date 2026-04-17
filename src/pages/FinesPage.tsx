import { FormEvent, useMemo, useState } from 'react';
import { useAppState } from '../App';

export function FinesPage() {
  const { data, addFine, getUserName, currentUser } = useAppState();
  const store = data!;
  const [isModalOpen, setModalOpen] = useState(false);
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

  const onSubmitFine = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    void addFine({
      whoUserId: String(formData.get('whoUserId')),
      submittedByUserId: currentUser?.id ?? '',
      amount: Number(formData.get('amount')),
      reason: String(formData.get('reason')),
    });
    setModalOpen(false);
    event.currentTarget.reset();
  };

  return (
    <section>
      <h2>Fines</h2>
      {currentUser && (
        <p className="card">
          <strong>You owe ${activeUserTotalOwed.toFixed(2)}</strong> for <strong>{activeUserFineCount} fines</strong>
        </p>
      )}
      <div className="row">
        <button onClick={() => setModalOpen(true)}>Fine Submission</button>
      </div>
      <div className="card filters">
        <select value={whoFilter} onChange={(e) => setWhoFilter(e.target.value)}>
          <option value="">All players</option>
          {store.users.map((user) => <option key={user.id} value={user.id}>{getUserName(user.id)}</option>)}
        </select>
      </div>
      <div className="stack">
        {filtered.map((fine) => (
          <article className="card" key={fine.id}>
            <p><strong>Who:</strong> {getUserName(fine.whoUserId)}</p>
            <p><strong>Amount:</strong> ${fine.amount.toFixed(2)}</p>
            <p><strong>Fuck up:</strong> {fine.reason}</p>
            <p><strong>Submitted by:</strong> {getUserName(fine.submittedByUserId)}</p>
          </article>
        ))}
      </div>

      {isModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="card modal" onSubmit={onSubmitFine}>
            <h3>Submit Fine</h3>
            <select name="whoUserId" required>
              {store.users.map((user) => <option key={user.id} value={user.id}>{getUserName(user.id)}</option>)}
            </select>
            <input className="no-spinner" name="amount" type="number" min="0" step="0.5" placeholder="Amount" defaultValue={5} required />
            <input name="reason" placeholder="Reason" required />
            <div className="row">
              <button type="submit">Save Fine</button>
              <button type="button" className="secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
