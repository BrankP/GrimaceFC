import { FormEvent, useState } from 'react';

type NameGateSubmitPayload = {
  firstName: string;
  lastName: string;
  passcode: string;
  isVisitor: boolean;
};

type NameGateProps = {
  onSubmit: (payload: NameGateSubmitPayload) => void;
  initialFirstName?: string;
  initialLastName?: string;
  serverError?: string;
};

export function NameGate({ onSubmit, initialFirstName = '', initialLastName = '', serverError = '' }: NameGateProps) {
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [passcode, setPasscode] = useState('');
  const [isVisitor, setIsVisitor] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedPasscode = passcode.trim();

    if (!trimmedFirst) {
      setError('First name is required.');
      return;
    }
    if (!trimmedLast) {
      setError('Last name is required.');
      return;
    }
    if (!isVisitor && trimmedPasscode.length < 2) {
      setError('Please enter your team passcode.');
      return;
    }

    setError('');
    onSubmit({ firstName: trimmedFirst, lastName: trimmedLast, passcode: trimmedPasscode, isVisitor });
  };

  return (
    <main className="gate-wrap">
      <section className="card gate-card">
        <h1>Welcome to Grimace FC</h1>
        <p>{isVisitor ? 'Visitor mode enabled (view-only).' : 'Enter your team passcode and your name to continue.'}</p>
        <form onSubmit={handleSubmit} className="gate-form">
          <label htmlFor="first-name">First name</label>
          <input id="first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="e.g. Alex" required />

          <label htmlFor="last-name">Last name</label>
          <input id="last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="e.g. Smith" required />

          <label className="visitor-toggle" htmlFor="visitor-mode">
            <input id="visitor-mode" type="checkbox" checked={isVisitor} onChange={(e) => setIsVisitor(e.target.checked)} />
            <span>Visitor</span>
          </label>

          {!isVisitor && (
            <>
              <label htmlFor="team-passcode">Team passcode</label>
              <input
                id="team-passcode"
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Team passcode"
                required
              />
            </>
          )}

          {(error || serverError) && <small className="error">{error || serverError}</small>}
          <button type="submit">{isVisitor ? 'Enter as Visitor' : 'Continue'}</button>
        </form>
      </section>
    </main>
  );
}
