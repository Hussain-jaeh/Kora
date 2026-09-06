import { formatMoney, formatPhone, formatToday, formatWait, plural } from '../lib/format.js';
import { pendingSuggestions, useSuggestions } from '../lib/suggestions.js';
import { navigate } from '../lib/router.js';

export default function Home({ conversations = [], orders = [], shopName }) {
  const all = useSuggestions();
  const ready = pendingSuggestions(all);

  const unread = conversations.filter((c) => c.unread_count > 0);
  const messagesWaiting = unread.reduce((sum, c) => sum + Number(c.unread_count || 0), 0);
  const oldest = unread
    .map((c) => c.last_message_at)
    .filter(Boolean)
    .sort()[0];

  // NOTE: the design reads "Orders due today", which needs an orders.due_at the
  // schema doesn't have. Showing open orders instead — honest with the data we
  // hold. Add due_at if the label matters more than the field count.
  const openOrders = orders.filter((o) => o.status === 'pending' || o.status === 'in_progress').length;

  const today = new Date().toDateString();
  const moneyToday = orders
    .filter((o) => o.status === 'done' && new Date(o.updated_at).toDateString() === today)
    .reduce((sum, o) => sum + Number(o.amount || 0), 0);

  const conversationFor = (id) => conversations.find((c) => String(c.id) === String(id));

  return (
    <div className="screen">
      <div className="screen-scroll">
        <div className="home-columns">
          <div>
            <div className="home-head">
              <div className="kicker">{formatToday()}</div>
              <h2 className="home-shop">{shopName || 'Your shop'}</h2>
            </div>
            <div className="hairline" style={{ margin: '14px 18px' }} />

            {unread.length > 0 ? (
              <div className="waiting-card">
                <div className="kicker kicker-accent">Needs you now</div>
                <div className="waiting-headline">
                  {unread.length} {plural(unread.length, 'person is', 'people are')} waiting
                </div>
                <div className="waiting-sub">Longest wait {formatWait(oldest)}</div>
                <button className="btn btn-cta-soft" onClick={() => navigate('/inbox')}>Open inbox</button>
              </div>
            ) : (
              <div className="waiting-card">
                <div className="kicker kicker-accent">All clear</div>
                <div className="waiting-headline">Nobody is waiting</div>
                <div className="waiting-sub">Every customer has had a reply.</div>
                <button className="btn btn-cta-soft" onClick={() => navigate('/inbox')}>Open inbox</button>
              </div>
            )}

            <div className="figures">
              <div className="kicker" style={{ marginBottom: 6 }}>Today so far</div>
              <div className="figure-row">
                <span className="figure-label">Messages waiting</span>
                <span className="figure-value">{messagesWaiting}</span>
              </div>
              <div className="figure-row">
                <span className="figure-label">Orders open</span>
                <span className="figure-value">{openOrders}</span>
              </div>
              <div className="figure-row">
                <span className="figure-label">Money taken today</span>
                <span className="figure-value">{formatMoney(moneyToday)}</span>
              </div>
            </div>
          </div>

          <div>
            {ready.length > 0 && (
              <div className="ready">
                <div className="kicker">Replies ready for you · {ready.length}</div>
                {ready.map((s) => {
                  const conversation = conversationFor(s.conversationId);
                  return (
                    <div className="ready-row" key={s.conversationId}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="ready-phone">{formatPhone(conversation?.customer_phone)}</div>
                        <div className="ready-draft">{s.draft}</div>
                      </div>
                      <button
                        className="btn btn-secondary"
                        onClick={() => navigate(`/thread/${s.conversationId}`)}
                      >
                        Review
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
