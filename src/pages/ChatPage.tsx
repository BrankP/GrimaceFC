import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useAppState } from '../App';

const formatDateHeading = (isoDate: string) =>
  new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(isoDate));

const formatDateTime = (isoDate: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(isoDate));

export function ChatPage() {
  const { data, addMessage, getDisplayName, saveNickname } = useAppState();
  const store = data!;
  const [text, setText] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messages = store.messages;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const groupedMessages = useMemo(() => {
    const groups: Array<{ date: string; messages: typeof messages }> = [];

    messages.forEach((message) => {
      const dateKey = new Date(message.createdAt).toDateString();
      const latestGroup = groups[groups.length - 1];
      if (!latestGroup || latestGroup.date !== dateKey) {
        groups.push({ date: dateKey, messages: [message] });
      } else {
        latestGroup.messages.push(message);
      }
    });

    return groups;
  }, [messages]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    void addMessage(text.trim());
    setText('');
  };

  return (
    <section className="chat-page">
      <div className="chat-thread">
        {groupedMessages.map((group) => (
          <div key={group.date} className="chat-day-group">
            <p className="chat-date-divider">{formatDateHeading(group.messages[0].createdAt)}</p>
            {group.messages.map((message) => (
              <article className="bubble modern-bubble" key={message.id}>
                <div className="chat-meta-row">
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
                  <small>{formatDateTime(message.createdAt)}</small>
                </div>
                <p>{message.text}</p>
              </article>
            ))}
          </div>
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
