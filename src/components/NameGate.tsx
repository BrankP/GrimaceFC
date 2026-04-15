import { FormEvent, useState } from 'react';

export function NameGate({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError('Please enter at least 2 characters.');
      return;
    }
    onSubmit(name.trim());
  };

  return (
    <main className="gate-wrap">
      <section className="card gate-card">
        <h1>Welcome to Grimace FC</h1>
        <p>Drop your name to enter the team hub.</p>
        <form onSubmit={handleSubmit} className="gate-form">
          <label htmlFor="name">Your name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex" />
          {error && <small className="error">{error}</small>}
          <button type="submit">Enter Chat</button>
        </form>
      </section>
    </main>
  );
}
