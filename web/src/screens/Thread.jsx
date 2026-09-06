import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { api } from '../api.js';
import { useApi } from '../lib/useApi.js';
import { navigate } from '../lib/router.js';
import { formatClock, formatDayKicker, formatPhone, hasName } from '../lib/format.js';
import { suggestions as drafts, useSuggestion } from '../lib/suggestions.js';

export default function Thread({ conversationId, conversation, onChanged }) {
  const { data: messages, reload } = useApi(
    () => api.messages(conversationId, 50),
    { interval: 4000, deps: [conversationId] }
  );

  const suggestion = useSuggestion(conversationId);
  const [text, setText] = useState('');
  const [outbox, setOutbox] = useState([]); // optimistic sends that haven't landed
  const endRef = useRef(null);

  // Opening a thread clears its unread count.
  useEffect(() => {
    api.markRead(conversationId).then(onChanged).catch(() => {});
  }, [conversationId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages?.length, outbox.length, suggestion?.state]);

  async function deliver(body, { fromSuggestion = false, retryId = null } = {}) {
    const id = retryId || `local-${Date.now()}`;
    setOutbox((o) => {
      const without = o.filter((m) => m.id !== id);
      return [...without, { id, body, status: 'sending', fromSuggestion }];
    });

    try {
      await api.reply(conversationId, body);
      setOutbox((o) => o.filter((m) => m.id !== id));
      if (fromSuggestion) drafts.markSent(conversationId);
      await reload();
      onChanged?.();
    } catch {
      setOutbox((o) => o.map((m) => (m.id === id ? { ...m, status: 'failed' } : m)));
    }
  }

  function sendTyped(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText('');
    deliver(body);
  }

  const title = hasName(conversation)
    ? conversation.customer_name
    : formatPhone(conversation?.customer_phone);

  const list = messages || [];
  let lastDay = null;

  return (
    <div className="thread">
      <div className="thread-header">
        <button className="btn btn-icon thread-back" aria-label="Back" onClick={() => navigate('/inbox')}>
          <Icon name="back" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={`thread-title${hasName(conversation) ? '' : ' tnum'}`}>{title}</div>
          <button className="thread-sub" onClick={() => navigate(`/customers/${conversation?.customer_id}`)}>
            {hasName(conversation)
              ? formatPhone(conversation?.customer_phone)
              : 'No name saved · tap to add'}
          </button>
        </div>
        <button
          className="btn btn-icon"
          aria-label="Customer details"
          onClick={() => navigate(`/customers/${conversation?.customer_id}`)}
        >
          <Icon name="customers" />
        </button>
      </div>

      <div className="quick-actions">
        <button className="btn btn-secondary" onClick={() => navigate(`/customers/${conversation?.customer_id}`)}>Add note</button>
        <button className="btn btn-secondary" onClick={() => navigate('/orders')}>New order</button>
        <button className="btn btn-secondary" onClick={() => navigate('/reminders')}>Set reminder</button>
      </div>

      <div className="messages">
        {list.map((m) => {
          const day = formatDayKicker(m.created_at);
          const showDay = day !== lastDay;
          lastDay = day;
          const outbound = m.direction === 'outbound';

          return (
            <div key={m.id} style={{ display: 'contents' }}>
              {showDay && <div className="day-kicker">{day}</div>}
              <div className={`msg ${outbound ? 'msg-out' : 'msg-in'}`}>
                <div className={`bubble ${outbound ? 'bubble-out' : 'bubble-in'}`}>{m.body}</div>
                <div className="msg-meta">
                  {outbound
                    ? `You · ${formatClock(m.created_at)}${m.sent_by === 'ai' ? ' · Sent from a suggestion' : ''}`
                    : formatClock(m.created_at)}
                </div>
              </div>
            </div>
          );
        })}

        {outbox.map((m) => (
          <div className="msg msg-out" key={m.id}>
            <div className={`bubble bubble-out${m.status === 'failed' ? ' bubble-failed' : ''}`}>{m.body}</div>
            {m.status === 'sending' ? (
              <div className="msg-meta">You · sending…</div>
            ) : (
              <>
                <div className="failed-actions">
                  <Icon name="warning" size={17} style={{ color: 'var(--color-accent-800)' }} />
                  <span className="failed-label">Not sent</span>
                  <button
                    className="btn btn-secondary"
                    style={{ minHeight: 40 }}
                    onClick={() => deliver(m.body, { fromSuggestion: m.fromSuggestion, retryId: m.id })}
                  >
                    Try again
                  </button>
                </div>
                <div className="failed-note">
                  The network dropped, so this message is being held on your phone.
                  The customer has not seen it.
                </div>
              </>
            )}
          </div>
        ))}

        {suggestion?.state === 'suggested' && (
          <div className="suggestion">
            <div className="suggestion-top">
              <span className="suggestion-kicker">Suggested reply · not sent</span>
              <button
                className="btn btn-icon suggestion-dismiss"
                aria-label="Dismiss suggestion"
                onClick={() => drafts.dismiss(conversationId)}
              >
                <Icon name="close" size={19} strokeWidth={1.8} />
              </button>
            </div>
            <p className="suggestion-text">{suggestion.draft}</p>
            <div className="suggestion-actions">
              <button className="btn btn-cta" onClick={() => deliver(suggestion.draft, { fromSuggestion: true })}>
                Send this reply
              </button>
              <button className="btn btn-secondary btn-wide" onClick={() => drafts.edit(conversationId)}>
                Edit before sending
              </button>
              <div className="suggestion-note">Nothing goes to the customer until you tap Send</div>
            </div>
          </div>
        )}

        {suggestion?.state === 'editing' && (
          <div className="suggestion">
            <div className="suggestion-kicker" style={{ paddingTop: 0, marginBottom: 8, display: 'block' }}>
              Editing · still not sent
            </div>
            <textarea
              className="input"
              value={suggestion.draft}
              onChange={(e) => drafts.updateDraft(conversationId, e.target.value)}
            />
            <button
              className="btn btn-cta"
              style={{ marginTop: 10 }}
              onClick={() => deliver(suggestion.draft, { fromSuggestion: true })}
            >
              Send this reply
            </button>
            <button className="btn btn-secondary btn-wide" onClick={() => drafts.cancelEdit(conversationId)}>
              Cancel
            </button>
          </div>
        )}

        {suggestion?.state === 'dismissed' && (
          <div className="dismissed-strip">
            <span>Suggestion dismissed. Nothing was sent.</span>
            <button className="btn btn-ghost" onClick={() => drafts.undo(conversationId)}>Undo</button>
          </div>
        )}

        <div ref={endRef} />
      </div>

      <form className="reply-bar" onSubmit={sendTyped}>
        <input
          className="input"
          placeholder="Write a message"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn btn-primary reply-send" aria-label="Send" type="submit">
          <Icon name="send" size={21} />
        </button>
      </form>
    </div>
  );
}
