import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useAppState } from '../App';

const formatDateHeading = (isoDate: string) =>
  new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(isoDate));

const formatDateTime = (isoDate: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(isoDate));

export function ChatPage() {
  const { data, addMessage, getDisplayName, saveNickname, canWrite } = useAppState();
  const store = data!;
  const [text, setText] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
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

  const mentionLabels = useMemo(
    () =>
      Array.from(
        new Set(
          store.users
            .map((user) => (user.nickname || user.name).trim())
            .filter((label) => Boolean(label)),
        ),
      ).sort((a, b) => b.length - a.length),
    [store.users],
  );

  const mentionCandidates = useMemo(() => {
    if (mentionStart === null) return [];
    const query = mentionQuery.trim().toLowerCase();
    if (!query) return [];

    return store.users
      .map((user) => ({ id: user.id, label: (user.nickname || user.name).trim() }))
      .filter((user) => user.label.toLowerCase().startsWith(query))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [mentionQuery, mentionStart, store.users]);

  const renderTaggedText = (value: string): ReactNode => {
    if (!mentionLabels.length) return value;
    const escaped = mentionLabels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const matcher = new RegExp(`(^|[^\\w])(${escaped.join('|')})(?=$|[^\\w])`, 'gi');
    const nodes: ReactNode[] = [];
    let lastIndex = 0;
    let match = matcher.exec(value);

    while (match) {
      const full = match[0];
      const prefix = match[1] ?? '';
      const tag = match[2];
      const matchIndex = match.index;
      const tagStart = matchIndex + prefix.length;

      if (matchIndex > lastIndex) nodes.push(value.slice(lastIndex, matchIndex));
      if (prefix) nodes.push(prefix);
      nodes.push(<span className="chat-tagged-user" key={`${tagStart}-${tag}`}>{tag}</span>);
      lastIndex = tagStart + tag.length;
      matcher.lastIndex = matchIndex + full.length;
      match = matcher.exec(value);
    }

    if (lastIndex < value.length) nodes.push(value.slice(lastIndex));
    return nodes.length ? nodes : value;
  };

  const applyMention = (label: string) => {
    if (mentionStart === null) return;
    const input = inputRef.current;
    const caret = input?.selectionStart ?? text.length;
    const nextText = `${text.slice(0, mentionStart)}${label} ${text.slice(caret)}`;
    setText(nextText);
    setMentionStart(null);
    setMentionQuery('');
    setActiveMentionIndex(0);

    requestAnimationFrame(() => {
      const cursor = mentionStart + label.length + 1;
      input?.setSelectionRange(cursor, cursor);
      input?.focus();
    });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    void addMessage(text.trim());
    setText('');
    setMentionQuery('');
    setMentionStart(null);
    setActiveMentionIndex(0);
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
                      if (!canWrite) return;
                      setEditingUserId(message.userId);
                      setNickname(getDisplayName(message.userId));
                    }}
                  >
                    {getDisplayName(message.userId)}
                  </button>
                  <small>{formatDateTime(message.createdAt)}</small>
                </div>
                <p>{renderTaggedText(message.text)}</p>
              </article>
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {canWrite ? (
      <form className="chat-input" onSubmit={onSubmit}>
        <div className="chat-input-wrap">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => {
              const nextValue = e.target.value;
              const caret = e.target.selectionStart ?? nextValue.length;
              const prefix = nextValue.slice(0, caret);
              const mentionMatch = prefix.match(/(?:^|\s)@([^\s@]*)$/);

              setText(nextValue);
              if (!mentionMatch) {
                setMentionStart(null);
                setMentionQuery('');
                setActiveMentionIndex(0);
                return;
              }

              const queryStart = caret - mentionMatch[1].length - 1;
              setMentionStart(queryStart);
              setMentionQuery(mentionMatch[1]);
              setActiveMentionIndex(0);
            }}
            onKeyDown={(event) => {
              if (!mentionCandidates.length) return;

              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveMentionIndex((current) => (current + 1) % mentionCandidates.length);
                return;
              }

              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveMentionIndex((current) => (current - 1 + mentionCandidates.length) % mentionCandidates.length);
                return;
              }

              if (event.key === 'Tab') {
                event.preventDefault();
                const target = mentionCandidates[activeMentionIndex] ?? mentionCandidates[0];
                if (target) applyMention(target.label);
              }
            }}
            placeholder="Send to team chat"
          />
          {mentionCandidates.length > 0 && (
            <ul className="mention-menu" role="listbox">
              {mentionCandidates.map((candidate, index) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    className={`mention-option${index === activeMentionIndex ? ' active' : ''}`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      applyMention(candidate.label);
                    }}
                  >
                    {candidate.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="submit">Send</button>
      </form>
      ) : (
      <p className="muted">Visitor mode: chat is view-only.</p>
      )}

      {canWrite && editingUserId && (
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
