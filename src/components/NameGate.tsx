import { FormEvent, useState } from 'react';

type NameGateProps = {
  onSubmit: (name: string, passcode: string) => void;
  initialName?: string;
  serverError?: string;
};

export function NameGate({ onSubmit, initialName = '', serverError = '' }: NameGateProps) {
  const [name, setName] = useState(initialName);
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError('Please enter at least 2 characters for your name.');
      return;
    }
    if (passcode.trim().length < 2) {
      setError('Please enter your team passcode.');
      return;
    }
    setError('');
    onSubmit(name.trim(), passcode.trim());
  };

  return (
    <main className="gate-wrap">
      <section className="card gate-card">
        <h1>Welcome to Grimace FC</h1>
        <p>Enter your team passcode and your name to get into chat.</p>
        <form onSubmit={handleSubmit} className="gate-form">
          <label htmlFor="team-passcode">Team passcode</label>
          <input
            id="team-passcode"
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Team passcode"
            required
          />
          <label htmlFor="name">Your name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex" required />
          {(error || serverError) && <small className="error">{error || serverError}</small>}
          <button type="submit">Enter Chat</button>
        </form>
      </section>
    </main>
  );
}
