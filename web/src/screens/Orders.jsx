import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { api } from '../api.js';
import { useApi } from '../lib/useApi.js';
import { formatMoney, formatPhone, formatListTime } from '../lib/format.js';

/**
 * Status is changed by one tap — no menu, no confirmation step. The handoff is
 * explicit about that: a tailor touches this ten times a day with wet hands.
 * The change is optimistic and instantly reversible by tapping another status,
 * which is a better safety net than a dialog nobody reads.
 */
const STATUSES = [
  { key: 'pending', label: 'Pending' },
  { key: 'in_progress', label: 'Doing' },
  { key: 'done', label: 'Done' },
  { key: 'cancelled', label: 'Cancelled' },
];

function OrderCard({ order, onStatus }) {
  const who = order.customer_name || formatPhone(order.customer_phone);

  return (
    <article className="order">
      <div className="order-top">
        <div className="order-desc">{order.description}</div>
        <div className="order-amount tnum">{order.amount ? formatMoney(order.amount) : '—'}</div>
      </div>
      <div className="order-who tnum">
        {who} · {formatListTime(order.created_at)}
      </div>

      <div className="order-statuses" role="group" aria-label="Order status">
        {STATUSES.map((s) => (
          <button
            key={s.key}
            className={`order-status status-${s.key}${order.status === s.key ? ' is-on' : ''}`}
            aria-pressed={order.status === s.key}
            onClick={() => order.status !== s.key && onStatus(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>
    </article>
  );
}

export default function Orders({ conversations = [] }) {
  const { data, reload, loading } = useApi(() => api.orders(), { interval: 20000 });
  const [pending, setPending] = useState({}); // optimistic status overrides
  const [composing, setComposing] = useState(false);

  const orders = (data || []).map((o) => (pending[o.id] ? { ...o, status: pending[o.id] } : o));

  const today = new Date().toDateString();
  const takenToday = orders
    .filter((o) => o.status === 'done' && new Date(o.updated_at).toDateString() === today)
    .reduce((sum, o) => sum + Number(o.amount || 0), 0);

  async function setStatus(order, status) {
    setPending((p) => ({ ...p, [order.id]: status }));
    try {
      await api.updateOrder(order.id, { status });
      await reload();
    } catch {
      setPending((p) => { const next = { ...p }; delete next[order.id]; return next; });
    } finally {
      setPending((p) => { const next = { ...p }; delete next[order.id]; return next; });
    }
  }

  if (!loading && orders.length === 0) {
    return (
      <div className="screen">
        <div className="screen-header"><h2>Orders</h2></div>
        <div className="empty">
          <div className="empty-icon"><Icon name="orders" size={26} strokeWidth={1.4} /></div>
          <div className="empty-title">No orders yet</div>
          <p className="empty-body">
            Write down a job so you remember the price and who it is for.
            You can also add one straight from a chat.
          </p>
        </div>
        <div className="orders-cta">
          <button className="btn btn-cta" onClick={() => setComposing(true)}>Add your first order</button>
        </div>
        {composing && (
          <NewOrder
            conversations={conversations}
            onClose={() => setComposing(false)}
            onCreated={async () => { setComposing(false); await reload(); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="screen-header orders-header">
        <h2>Orders</h2>
        <span className="orders-total tnum">{formatMoney(takenToday)} today</span>
      </div>

      <div className="screen-scroll orders-scroll">
        <div className="orders-grid">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} onStatus={(s) => setStatus(o, s)} />
          ))}
        </div>
      </div>

      <div className="orders-cta">
        <button className="btn btn-cta" onClick={() => setComposing(true)}>New order</button>
      </div>

      {composing && (
        <NewOrder
          conversations={conversations}
          onClose={() => setComposing(false)}
          onCreated={async () => { setComposing(false); await reload(); }}
        />
      )}
    </div>
  );
}

/** Not in the handoff — the design has the button but no form behind it. */
function NewOrder({ conversations, onClose, onCreated }) {
  const [customerId, setCustomerId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const canSave = customerId && description.trim();

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.createOrder({
        customer_id: Number(customerId),
        description: description.trim(),
        amount: amount ? Number(amount) : null,
      });
      await onCreated();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog reminder-dialog" role="dialog" aria-label="New order">
        <div className="dialog-title">New order</div>

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
          <span>What is the job?</span>
          <input
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="2 shirts, blue fabric"
          />
        </label>

        <label className="field">
          <span>Price (₦) — optional</span>
          <input
            className="input tnum"
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="9000"
          />
        </label>

        {error && <p className="reminder-dialog-error">{error}</p>}

        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-cta reminder-save" disabled={!canSave || saving} onClick={save}>
            {saving ? 'Saving…' : 'Save order'}
          </button>
        </div>
      </div>
    </div>
  );
}
