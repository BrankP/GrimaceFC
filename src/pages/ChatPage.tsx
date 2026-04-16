import { FormEvent, useEffect, useRef, useState } from 'react';
import { useAppState } from '../App';
import { formatTime } from '../utils/date';

export function ChatPage() {
  const { data, addMessage, getDisplayName, saveNickname } = useAppState();
  const store = data!;
  const [text, setText] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [store.messages.length]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    void addMessage(text.trim());
    setText('');
  };

  return (
    <section className="chat-page">
      <h2>Team Chat</h2>
      <div className="chat-thread card">
        {store.messages.map((message) => (
          <article className="bubble" key={message.id}>
            <button
              type="button"
              className="name-btn"
              onClick={() => {
                setEditingUserId(message.userId);
                setNickname(getDisplayName(message.userId));
              }}
            >
              {getDisplayName(message.userId)}
            </button>
            <p>{message.text}</p>
            <small>{formatTime(message.createdAt)}</small>
          </article>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className="chat-input" onSubmit={onSubmit}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Send to team chat" />
        <button type="submit">Send</button>
      </form>

      {editingUserId && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form
            className="card modal"
            onSubmit={(event) => {
              event.preventDefault();
              void saveNickname(editingUserId, nickname);
              setEditingUserId(null);
            }}
          >
            <h3>Edit nickname</h3>
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} required />
            <div className="row">
              <button type="submit">Save</button>
              <button type="button" className="secondary" onClick={() => setEditingUserId(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
