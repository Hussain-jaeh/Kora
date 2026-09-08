import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { api } from '../api.js';
import { useApi } from '../lib/useApi.js';
import { navigate } from '../lib/router.js';
import { avatarLabel, formatListTime, formatMoney, formatPhone } from '../lib/format.js';

const STATUS_LABEL = {
  pending: 'Pending',
  in_progress: 'Doing',
  done: 'Done',
  cancelled: 'Cancelled',
};

/** Customer list — not in the handoff, which only designs the detail screen. */
export function Customers() {
  const { data, loading } = useApi(() => api.customers(), { interval: 30000 });
  const customers = data || [];

  if (!loading && customers.length === 0) {
    return (
      <div className="screen">
        <div className="screen-header"><h2>Customers</h2></div>
        <div className="empty">
          <div className="empty-icon"><Icon name="customers" size={26} strokeWidth={1.4} /></div>
          <div className="empty-title">No customers yet</div>
          <p className="empty-body">Anyone who messages your WhatsApp number shows up here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="screen-header"><h2>Customers</h2></div>
      <div className="screen-scroll">
        {customers.map((c) => (
          <button key={c.id} className="conv-row" onClick={() => navigate(`/customers/${c.id}`)}>
            <span className={`avatar${c.name ? '' : ' tnum'}`}>{avatarLabel(c)}</span>
            <span className="conv-body">
              <span className="conv-top">
                <span className={`conv-name${c.name ? '' : ' tnum'}`}>
                  {c.name || formatPhone(c.phone_number)}
                </span>
              </span>
              <span className="conv-preview">
                {c.name ? formatPhone(c.phone_number) : (c.notes ? c.notes.split('\n')[0] : 'No notes yet')}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Customer({ customerId, conversations = [] }) {
  const { data: customer, reload } = useApi(() => api.customer(customerId), { deps: [customerId] });
  const { data: orders } = useApi(() => api.customerOrders(customerId), { deps: [customerId] });

  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (customer) {
      setName(customer.name || '');
      setNotes(customer.notes || '');
    }
  }, [customer?.id]);

  if (!customer) return <div className="screen" />;

  const conversation = conversations.find(
    (c) => String(c.customer_id) === String(customerId)
  );

  async function saveName() {
    const next = name.trim();
    if (next === (customer.name || '')) return;
    setSaving(true);
    try { await api.updateCustomer(customerId, { name: next || null }); await reload(); }
    finally { setSaving(false); }
  }

  async function saveNotes() {
    setSaving(true);
    try {
      await api.updateCustomer(customerId, { notes });
      await reload();
      setEditingNotes(false);
    } finally { setSaving(false); }
  }

  return (
    <div className="screen">
      <div className="thread-header">
        <button className="btn btn-icon thread-back" aria-label="Back" onClick={() => history.back()}>
          <Icon name="back" />
        </button>
        <div className="thread-title">Customer</div>
      </div>

      <div className="screen-scroll customer-body">
        <h2 className="customer-phone tnum">{formatPhone(customer.phone_number)}</h2>

        <label className="field customer-name-field">
          <span>Name — you can add one</span>
          <input
            className={`input customer-name${name ? '' : ' is-empty'}`}
            value={name}
            placeholder="Add a name"
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
          />
        </label>

        <div className="hairline" style={{ margin: '18px 0' }} />

        <div className="kicker">Notes · only you see these</div>
        {editingNotes ? (
          <>
            <textarea
              className="input customer-notes-edit"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={'Prefers fade cuts\nUsually pays cash'}
              autoFocus
            />
            <div className="customer-note-actions">
              <button className="btn btn-secondary" disabled={saving} onClick={saveNotes}>Save notes</button>
              <button
                className="btn btn-secondary"
                onClick={() => { setNotes(customer.notes || ''); setEditingNotes(false); }}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            {customer.notes ? (
              <div className="customer-notes">
                {customer.notes.split('\n').map((line, i) => <div key={i}>{line}</div>)}
              </div>
            ) : (
              <div className="customer-notes is-empty">
                Nothing noted yet. What should you remember about this person?
              </div>
            )}
            <button className="btn btn-ghost customer-add-note" onClick={() => setEditingNotes(true)}>
              {customer.notes ? '+ Edit notes' : '+ Add a note'}
            </button>
          </>
        )}

        <div className="hairline" style={{ margin: '14px 0 0' }} />
        <div className="kicker" style={{ marginTop: 16 }}>Orders</div>

        {(orders || []).length === 0 ? (
          <p className="customer-no-orders">No orders for this customer yet.</p>
        ) : (
          orders.map((o) => (
            <div className="customer-order" key={o.id}>
              <div>
                <div className="customer-order-desc">{o.description}</div>
                <div className="customer-order-date tnum">{formatListTime(o.created_at)}</div>
              </div>
              <div className="customer-order-right">
                <div className="customer-order-amount tnum">{o.amount ? formatMoney(o.amount) : '—'}</div>
                <span className={`tag ${o.status === 'done' || o.status === 'cancelled' ? 'tag-neutral' : 'tag-outline'} customer-order-tag`}>
                  {STATUS_LABEL[o.status]}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="customer-actions">
        <button className="btn btn-secondary" onClick={() => navigate('/orders')}>New order</button>
        <button
          className="btn btn-cta"
          disabled={!conversation}
          onClick={() => conversation && navigate(`/thread/${conversation.id}`)}
        >
          Open chat
        </button>
      </div>
    </div>
  );
}
