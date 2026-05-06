import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useAppState } from '../App';
import type { Message } from '../types/models';

const formatDateHeading = (isoDate: string) =>
  new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(isoDate));

const formatDateTime = (isoDate: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(isoDate));

const EMOJI_OPTIONS = [
  '😀', '😃', '😄', '😁', '😆', '😂', '🤣', '😊', '😍', '😘', '😎', '🤩',
  '🥳', '😬', '😅', '😇', '🙂', '🙃', '😉', '😌', '😋', '🤪', '🤨', '🧐',
  '🤓', '😤', '😢', '😭', '😡', '🤬', '🤯', '🥶', '😱', '😴', '🤢', '🤮',
  '👍', '👎', '👏', '🙌', '💪', '🙏', '🤝', '👊', '✌️', '🤞', '👀', '🧠',
  '❤️', '💜', '💙', '💚', '💛', '🧡', '🔥', '💯', '⭐', '⚽', '🏆', '🍻',
];

export function ChatPage() {
  const {
    data,
    addMessage,
    editMessage,
    deleteMessage,
    toggleMessageReaction,
    getDisplayName,
    saveNickname,
    currentUser,
    canWrite,
  } = useAppState();
  const store = data!;
  const [text, setText] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [emojiPickerMessageId, setEmojiPickerMessageId] = useState<string | null>(null);
  const [actionMessageId, setActionMessageId] = useState<string | null>(null);
  const [detailsMessageId, setDetailsMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState('');
  const longPressTimer = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const messages = store.messages;
  const selectedNicknameUserName = editingUserId ? getDisplayName(editingUserId) : '';
  const getReactionUserNames = (reaction: Message['reactions'][number]) => reaction.users.map((user) => getDisplayName(user.id)).join(', ');
  const actionMessage = actionMessageId ? messages.find((message) => message.id === actionMessageId) ?? null : null;
  const detailsMessage = detailsMessageId ? messages.find((message) => message.id === detailsMessageId) ?? null : null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => () => {
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
  }, []);

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
            .map((user) => user.name.trim())
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
      .map((user) => ({ id: user.id, label: user.name.trim() }))
      .filter((user) => user.label.toLowerCase().startsWith(query))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [mentionQuery, mentionStart, store.users]);

  const renderTaggedText = (value: string): ReactNode => {
    if (!mentionLabels.length) return value;
    const escaped = mentionLabels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const matcher = new RegExp(`(^|[^\\w])(@(?:${escaped.join('|')}))(?=$|[^\\w])`, 'gi');
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
    const nextText = `${text.slice(0, mentionStart)}@${label} ${text.slice(caret)}`;
    setText(nextText);
    setMentionStart(null);
    setMentionQuery('');
    setActiveMentionIndex(0);

    requestAnimationFrame(() => {
      const cursor = mentionStart + label.length + 2;
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

  const startLongPress = (messageId: string) => () => {
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      setActionMessageId(messageId);
      setEmojiPickerMessageId(null);
    }, 550);
  };

  const clearLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const openEditMessage = (message: Message) => {
    setEditingMessageId(message.id);
    setEditingMessageText(message.text);
    setActionMessageId(null);
  };

  const submitEditedMessage = (event: FormEvent) => {
    event.preventDefault();
    if (!editingMessageId || !editingMessageText.trim()) return;
    void editMessage(editingMessageId, editingMessageText.trim());
    setEditingMessageId(null);
    setEditingMessageText('');
  };

  const ReactionDetails = ({ message }: { message: Message }) => (
    <div className="reaction-details-list">
      <h4>Reaction details</h4>
      {message.reactions.length ? (
        message.reactions.map((reaction) => (
          <p key={reaction.emoji} className="reaction-detail-row">
            <span className="reaction-detail-emoji">{reaction.emoji}</span>
            <span>{getReactionUserNames(reaction)}</span>
          </p>
        ))
      ) : (
        <p className="muted">No reactions yet.</p>
      )}
    </div>
  );

  return (
    <section className="chat-page">
      <div className="chat-thread">
        {groupedMessages.map((group) => (
          <div key={group.date} className="chat-day-group">
            <p className="chat-date-divider">{formatDateHeading(group.messages[0].createdAt)}</p>
            {group.messages.map((message) => {
              const isComposer = currentUser?.id === message.userId;
              const isPickerOpen = emojiPickerMessageId === message.id;
              return (
                <article
                  className="bubble modern-bubble"
                  key={message.id}
                  onPointerDown={startLongPress(message.id)}
                  onPointerUp={clearLongPress}
                  onPointerCancel={clearLongPress}
                  onPointerLeave={clearLongPress}
                >
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
                  {message.editedAt && <small className="edited-label">edited</small>}
                  <div className="message-reaction-row">
                    <button
                      type="button"
                      className="reaction-add-btn"
                      aria-label={canWrite ? 'Add reaction' : 'Visitors cannot react'}
                      disabled={!canWrite}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (!canWrite) return;
                        setEmojiPickerMessageId((current) => (current === message.id ? null : message.id));
                      }}
                    >
                      ☺
                    </button>
                    {message.reactions.map((reaction) => (
                      <button
                        type="button"
                        className={`reaction-tally${reaction.users.some((user) => user.id === currentUser?.id) ? ' reacted-by-me' : ''}`}
                        key={reaction.emoji}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          setDetailsMessageId(message.id);
                        }}
                        onDoubleClick={(event) => {
                          event.stopPropagation();
                          setDetailsMessageId(message.id);
                        }}
                        title={getReactionUserNames(reaction)}
                      >
                        <span>{reaction.emoji}</span>
                        <span>{reaction.count}</span>
                      </button>
                    ))}
                    {message.reactions.length > 0 && (
                      <button
                        type="button"
                        className="reaction-details-btn"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          setDetailsMessageId(message.id);
                        }}
                      >
                        Details
                      </button>
                    )}
                  </div>
                  {isPickerOpen && canWrite && (
                    <div className="emoji-picker" onPointerDown={(event) => event.stopPropagation()}>
                      {EMOJI_OPTIONS.map((emoji) => (
                        <button
                          type="button"
                          className="emoji-picker-option"
                          key={emoji}
                          onClick={(event) => {
                            event.stopPropagation();
                            void toggleMessageReaction(message.id, emoji);
                            setEmojiPickerMessageId(null);
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                  {isComposer && (
                    <button
                      type="button"
                      className="message-more-btn"
                      aria-label="Open message actions"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        setActionMessageId(message.id);
                      }}
                    >
                      ⋯
                    </button>
                  )}
                </article>
              );
            })}
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
            <h3>Edit nickname for {selectedNicknameUserName}</h3>
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} required />
            <div className="row">
              <button type="submit">Save</button>
              <button type="button" className="secondary" onClick={() => setEditingUserId(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {actionMessage && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setActionMessageId(null)}>
          <div className="card modal" onClick={(event) => event.stopPropagation()}>
            <h3>Message actions</h3>
            <ReactionDetails message={actionMessage} />
            {currentUser?.id === actionMessage.userId && (
              <div className="stack">
                <button type="button" onClick={() => openEditMessage(actionMessage)}>Edit message</button>
                <button
                  type="button"
                  className="secondary danger-action full-width"
                  onClick={() => {
                    void deleteMessage(actionMessage.id);
                    setActionMessageId(null);
                  }}
                >
                  Delete message
                </button>
              </div>
            )}
            <button type="button" className="secondary" onClick={() => setActionMessageId(null)}>Close</button>
          </div>
        </div>
      )}

      {detailsMessage && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setDetailsMessageId(null)}>
          <div className="card modal" onClick={(event) => event.stopPropagation()}>
            <ReactionDetails message={detailsMessage} />
            <button type="button" className="secondary" onClick={() => setDetailsMessageId(null)}>Close</button>
          </div>
        </div>
      )}

      {editingMessageId && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="card modal" onSubmit={submitEditedMessage}>
            <h3>Edit message</h3>
            <textarea className="message-edit-input" value={editingMessageText} onChange={(event) => setEditingMessageText(event.target.value)} required />
            <div className="row">
              <button type="submit">Save</button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setEditingMessageId(null);
                  setEditingMessageText('');
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
