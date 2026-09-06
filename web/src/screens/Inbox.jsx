import ConversationList from '../components/ConversationList.jsx';
import { formatWait, plural } from '../lib/format.js';
import { navigate } from '../lib/router.js';

export default function Inbox({ conversations = [], selectedId, connected, lastChecked }) {
  const unread = conversations.filter((c) => c.unread_count > 0);
  const oldest = unread.map((c) => c.last_message_at).filter(Boolean).sort()[0];

  return (
    <div className="screen">
      <div className="screen-header"><h2>Inbox</h2></div>

      {unread.length > 0 && (
        <div className="waiting-banner">
          <div className="headline">
            {unread.length} {plural(unread.length, 'person is', 'people are')} waiting on you
          </div>
          <div className="sub">Oldest {formatWait(oldest)}</div>
        </div>
      )}

      <div className="screen-scroll">
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          onOpen={(id) => navigate(`/thread/${id}`)}
        />
      </div>

      {conversations.length === 0 && (
        <div className={`connection${connected ? '' : ' is-down'}`} style={{ padding: '0 18px 16px' }}>
          <span className="dot" />
          {connected ? 'WhatsApp connected' : 'WhatsApp not linked'}
          {lastChecked && ` · last checked ${lastChecked}`}
        </div>
      )}
    </div>
  );
}
