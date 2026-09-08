import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { api } from '../api.js';
import { useApi } from '../lib/useApi.js';
import { formatClock, formatPhone } from '../lib/format.js';

/**
 * Two kinds of reminder that must never be confused.
 *
 *   customer_message !== null → WILL BE SENT to the customer at due_at
 *   customer_message === null → a private nudge; nothing is ever sent
 *
 * The handoff is explicit that this is a hard branch, not a styling variant:
 * mixing them up texts a customer an internal note. So they are separate
 * components with different shape, ground, border and actions — never one
 * component with a flag.
 */

function dayBucket(dueAt) {
  const d = new Date(dueAt);
  const now = new Date();
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (d < now) return 'Overdue';
  if (sameDay(d, now)) return 'Today';
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (sameDay(d, tomorrow)) return 'Tomorrow';
  return d.toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' });
}

function AutoSendCard({ reminder, onEdit, onCancel, busy }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(reminder.customer_message);

  return (
    <article className="reminder reminder-send">
      <header className="reminder-top">
        <span className="tag tag-outline reminder-tag-send">Will send to customer</span>
        <span className="reminder-time tnum">{formatClock(reminder.due_at)}</span>
      </header>

      <div className="reminder-to tnum">To {formatPhone(reminder.customer_phone)}</div>

      {editing ? (
        <>
          <textarea
            className="input reminder-edit"
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Message to send"
          />
          <div className="reminder-actions">
            <button
              className="btn btn-secondary"
              disabled={busy || !text.trim()}
              onClick={async () => { await onEdit(text.trim()); setEditing(false); }}
            >
              Save message
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => { setText(reminder.customer_message); setEditing(false); }}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <blockquote className="reminder-quote">“{reminder.customer_message}”</blockquote>
          <div className="reminder-actions">
            <button className="btn btn-secondary" onClick={() => setEditing(true)}>Edit message</button>
            <button className="btn btn-secondary" disabled={busy} onClick={onCancel}>Cancel send</button>
          </div>
        </>
      )}
    </article>
  );
}

function PrivateCard({ reminder, onDone, onSnooze, busy }) {
  return (
    <article className="reminder reminder-private">
      <header className="reminder-top">
        <span className="tag tag-neutral reminder-tag-private">
          <Icon name="lock" size={11} strokeWidth={2} />
          Private — only you
        </span>
        <span className="reminder-time tnum">{formatClock(reminder.due_at)}</span>
      </header>

      <div className="reminder-reason">{reminder.reason || 'Follow up'}</div>
      <div className="reminder-note">Nothing is sent to anyone. This shows on your phone only.</div>

      <div className="reminder-actions">
        <button className="btn btn-secondary on-bg" disabled={busy} onClick={onDone}>Mark done</button>
        <button className="btn btn-secondary on-bg" disabled={busy} onClick={onSnooze}>Snooze</button>
      </div>
    </article>
  );
}

export default function Reminders({ conversations = [] }) {
  const { data, reload, loading } = useApi(() => api.reminders(), { interval: 20000 });
  const [busyId, setBusyId] = useState(null);
  const [composing, setComposing] = useState(false);

  const reminders = data || [];

  async function act(id, fn) {
    setBusyId(id);
    try { await fn(); await reload(); } finally { setBusyId(null); }
  }

  const groups = reminders.reduce((acc, r) => {
    const key = dayBucket(r.due_at);
    (acc[key] ||= []).push(r);
    return acc;
  }, {});

  const order = ['Overdue', 'Today', 'Tomorrow'];
  const keys = [
    ...order.filter((k) => groups[k]),
    ...Object.keys(groups).filter((k) => !order.includes(k)),
  ];

  const autoSend = reminders.filter((r) => r.customer_message !== null);
  const private_ = reminders.filter((r) => r.customer_message === null);

  const card = (r) =>
    r.customer_message !== null ? (
      <AutoSendCard
        key={r.id}
        reminder={r}
        busy={busyId === r.id}
        onEdit={(text) => act(r.id, () => api.updateReminder(r.id, { customer_message: text }))}
        onCancel={() => act(r.id, () => api.resolveReminder(r.id))}
      />
    ) : (
      <PrivateCard
        key={r.id}
        reminder={r}
        busy={busyId === r.id}
        onDone={() => act(r.id, () => api.resolveReminder(r.id))}
        onSnooze={() =>
          act(r.id, () =>
            api.updateReminder(r.id, {
              due_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            })
          )
        }
      />
    );

  return (
    <div className="screen">
      <div className="screen-header"><h2>Reminders</h2></div>

      {!loading && reminders.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><Icon name="bell" size={28} strokeWidth={1.4} /></div>
          <div className="empty-title">Nothing to remember yet</div>
          <p className="empty-body">
            Set a reminder to follow up with a customer, or leave yourself a private note.
          </p>
        </div>
      ) : (
        <div className="screen-scroll reminders-scroll">
          {/* Phone: one time-ordered list. Desktop: the two kinds as two columns,
              so the difference is impossible to miss. */}
          <div className="reminders-by-day">
            {keys.map((key) => (
              <section key={key}>
                <div className="kicker reminders-day">{key}</div>
                {groups[key].map(card)}
              </section>
            ))}
          </div>

          <div className="reminders-columns">
            <section>
              <div className="kicker reminders-day">Will be sent · {autoSend.length}</div>
              {autoSend.length === 0
                ? <p className="reminders-column-empty">Nothing is scheduled to go out.</p>
                : autoSend.map(card)}
            </section>
            <section>
              <div className="kicker reminders-day">Private to you · {private_.length}</div>
              {private_.length === 0
                ? <p className="reminders-column-empty">No private notes.</p>
                : private_.map(card)}
            </section>
          </div>
        </div>
      )}

      <div className="reminders-cta">
        <button className="btn btn-cta" onClick={() => setComposing(true)}>New reminder</button>
      </div>

      {composing && (
        <NewReminder
          conversations={conversations}
          onClose={() => setComposing(false)}
          onCreated={async () => { setComposing(false); await reload(); }}
        />
      )}
    </div>
  );
}

/**
 * Not in the handoff — the design has a "New reminder" button but no form
 * behind it. Built to the same rule the cards follow: the choice between
 * "the customer gets a message" and "only you see this" is the first and
 * loudest decision on the form, not a checkbox at the bottom.
 */
function NewReminder({ conversations, onClose, onCreated }) {
  const [kind, setKind] = useState('private');
  const [customerId, setCustomerId] = useState('');
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('');
  const [when, setWhen] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setSeconds(0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const sending = kind === 'send';
  const canSave = when && (sending ? customerId && message.trim() : reason.trim());

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.createReminder({
        customer_id: sending ? Number(customerId) : Number(conversations[0]?.customer_id),
        due_at: new Date(when).toISOString(),
        reason: sending ? reason.trim() || null : reason.trim(),
        customer_message: sending ? message.trim() : null,
      });
      await onCreated();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog reminder-dialog" role="dialog" aria-label="New reminder">
        <div className="dialog-title">New reminder</div>

        <div className="kind-choice">
          <button
            className={`kind-option${!sending ? ' is-on' : ''}`}
            onClick={() => setKind('private')}
          >
            <span className="kind-label"><Icon name="lock" size={13} strokeWidth={2} /> Private note</span>
            <span className="kind-help">Only you see it. Nothing is sent.</span>
          </button>
          <button
            className={`kind-option${sending ? ' is-on' : ''}`}
            onClick={() => setKind('send')}
          >
            <span className="kind-label">Message a customer</span>
            <span className="kind-help">This text is sent to them automatically.</span>
          </button>
        </div>

        {sending ? (
          <>
            <label className="field">
              <span>Customer</span>
              <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Choose a customer</option>
                {conversations.map((c) => (
                  <option key={c.customer_id} value={c.customer_id}>
                    {c.customer_name || formatPhone(c.customer_phone)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Message they will receive</span>
              <textarea
                className="input"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Good afternoon. Your gown is ready for pickup."
              />
            </label>
          </>
        ) : (
          <label className="field">
            <span>What should you remember?</span>
            <input
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Call the supplier about clipper blades"
            />
          </label>
        )}

        <label className="field">
          <span>When</span>
          <input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </label>

        <p className="reminder-dialog-note">
          {sending
            ? 'At that time this exact message is sent to the customer over WhatsApp.'
            : 'Nothing is sent to anyone. This only shows here.'}
        </p>

        {error && <p className="reminder-dialog-error">{error}</p>}

        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-cta reminder-save" disabled={!canSave || saving} onClick={save}>
            {saving ? 'Saving…' : sending ? 'Schedule message' : 'Save note'}
          </button>
        </div>
      </div>
    </div>
  );
}
