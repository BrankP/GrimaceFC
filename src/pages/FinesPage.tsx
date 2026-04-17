import { FormEvent, useMemo, useState } from 'react';
import { useAppState } from '../App';

export function FinesPage() {
  const { data, addFine, getUserName, currentUser } = useAppState();
  const store = data!;
  const [isModalOpen, setModalOpen] = useState(false);
  const [whoFilter, setWhoFilter] = useState('');
  const [submitterFilter, setSubmitterFilter] = useState('');
  const [maxAmount, setMaxAmount] = useState<number | ''>('');

  const filtered = useMemo(
    () =>
      store.fines.filter((fine) => {
        if (whoFilter && fine.whoUserId !== whoFilter) return false;
        if (submitterFilter && fine.submittedByUserId !== submitterFilter) return false;
        if (maxAmount !== '' && fine.amount > maxAmount) return false;
        return true;
      }),
    [store.fines, whoFilter, submitterFilter, maxAmount],
  );

  const activeUserTotalOwed = useMemo(() => {
    if (!currentUser) return 0;
    return store.fines
      .filter((fine) => fine.whoUserId === currentUser.id)
      .reduce((total, fine) => total + fine.amount, 0);
  }, [store.fines, currentUser]);

  const onSubmitFine = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    void addFine({
      whoUserId: String(formData.get('whoUserId')),
      submittedByUserId: String(formData.get('submittedByUserId')),
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
          <strong>{getUserName(currentUser.id)}</strong> owes <strong>${activeUserTotalOwed.toFixed(2)}</strong>
        </p>
      )}
      <div className="row">
        <button onClick={() => setModalOpen(true)}>Fine Submission</button>
        <button className="secondary">Filter</button>
      </div>
      <div className="card filters">
        <select value={whoFilter} onChange={(e) => setWhoFilter(e.target.value)}>
          <option value="">All players</option>
          {store.users.map((user) => <option key={user.id} value={user.id}>{getUserName(user.id)}</option>)}
        </select>
        <select value={submitterFilter} onChange={(e) => setSubmitterFilter(e.target.value)}>
          <option value="">All submitters</option>
          {store.users.map((user) => <option key={user.id} value={user.id}>{getUserName(user.id)}</option>)}
        </select>
        <input
          type="number"
          value={maxAmount}
          onChange={(e) => setMaxAmount(e.target.value ? Number(e.target.value) : '')}
          placeholder="Max amount"
        />
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
            <input name="amount" type="number" min="0" step="0.5" placeholder="Amount" required />
            <input name="reason" placeholder="Reason" required />
            <select name="submittedByUserId" defaultValue={currentUser?.id} required>
              {store.users.map((user) => <option key={user.id} value={user.id}>{getUserName(user.id)}</option>)}
            </select>
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
