import { useEffect } from 'react';
import { api } from './api.js';
import { useApi } from './lib/useApi.js';
import { useRoute, navigate } from './lib/router.js';
import { seedMock } from './lib/suggestions.js';
import { formatClock } from './lib/format.js';
import TabBar from './components/TabBar.jsx';
import SideRail from './components/SideRail.jsx';
import ConversationList from './components/ConversationList.jsx';
import Icon from './components/Icon.jsx';
import Home from './screens/Home.jsx';
import Reminders from './screens/Reminders.jsx';
import Orders from './screens/Orders.jsx';
import Customer, { Customers } from './screens/Customer.jsx';
import Inbox from './screens/Inbox.jsx';
import Thread from './screens/Thread.jsx';

export default function App() {
  const { section, param } = useRoute();

  const conversations = useApi(() => api.conversations(), { interval: 5000 });
  const orders = useApi(() => api.orders(), { interval: 30000 });
  const status = useApi(() => api.status(), { interval: 15000 });

  const rows = conversations.data || [];
  const connected = status.data?.whatsapp === 'connected';
  const shopName = status.data?.business?.name;
  const peopleWaiting = rows.filter((c) => c.unread_count > 0).length;

  useEffect(() => { if (rows.length) seedMock(rows); }, [rows.length]);

  // A failed refresh keeps the last good data on screen rather than blanking it.
  const stale = Boolean(conversations.error && conversations.data);

  const openThread = section === 'thread' ? rows.find((c) => String(c.id) === String(param)) : null;

  function screen() {
    switch (section) {
      case 'reminders':
        return <Reminders conversations={rows} />;
      case 'orders':
        return <Orders conversations={rows} />;
      case 'customers':
        return param
          ? <Customer customerId={param} conversations={rows} />
          : <Customers />;
      default:
        return <Home conversations={rows} orders={orders.data || []} shopName={shopName} />;
    }
  }

  // Desktop shows the list and the thread side by side; phone shows one at a time.
  const twoPane = section === 'inbox' || section === 'thread';

  return (
    <div className="app">
      <SideRail
        active={section === 'thread' ? 'inbox' : section}
        inboxBadge={peopleWaiting}
        shopName={shopName}
        connected={connected}
      />

      <div className="app-main">
        {status.data && !connected && <DisconnectedBanner state={status.data.whatsapp} />}
        {stale && (
          <div className="banner-stale">
            <Icon name="signal" size={17} />
            Slow connection. Showing what you last had
            {conversations.fetchedAt && ` · ${formatClock(conversations.fetchedAt)}`}.
          </div>
        )}

        {twoPane ? (
          <div className={`two-pane${section === 'thread' ? ' with-thread' : ''}`}>
            <div className="pane-list">
              <Inbox
                conversations={rows}
                selectedId={param}
                connected={connected}
                lastChecked={conversations.fetchedAt ? formatClock(conversations.fetchedAt) : null}
              />
            </div>
            <div className="pane-detail">
              {section === 'thread'
                ? (openThread
                    ? <Thread conversationId={param} conversation={openThread} onChanged={conversations.reload} />
                    : (conversations.loading ? <div className="screen" /> : <NotFound />))
                : <ChooseConversation />}
            </div>
          </div>
        ) : (
          screen()
        )}

        {section !== 'thread' && <TabBar active={section} inboxBadge={peopleWaiting} />}
      </div>
    </div>
  );
}

function DisconnectedBanner({ state }) {
  return (
    <div className="banner-disconnected">
      <div className="headline">
        <Icon name="warning" size={21} style={{ color: 'var(--color-accent-700)' }} />
        WhatsApp is not linked
      </div>
      <p>
        {state === 'reconnecting'
          ? 'Trying to reconnect. New messages will not arrive until the link is back.'
          : 'Messages are not arriving. Your orders, notes and reminders are safe.'}
      </p>
      <button className="btn btn-cta">Re-link WhatsApp</button>
    </div>
  );
}

function ChooseConversation() {
  return (
    <div className="screen">
      <div className="empty">
        <p className="empty-body">Choose a conversation</p>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="screen">
      <div className="empty">
        <div className="empty-title">Conversation not found</div>
        <p className="empty-body">It may have been removed.</p>
        <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => navigate('/inbox')}>
          Back to inbox
        </button>
      </div>
    </div>
  );
}
