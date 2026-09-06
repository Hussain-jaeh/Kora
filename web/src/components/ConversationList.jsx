import { avatarLabel, displayName, formatListTime, hasName } from '../lib/format.js';
import { useSuggestions } from '../lib/suggestions.js';
import Icon from './Icon.jsx';

export default function ConversationList({ conversations, selectedId, onOpen }) {
  const suggestions = useSuggestions();

  if (conversations.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon"><Icon name="check" size={28} strokeWidth={1.4} /></div>
        <div className="empty-title">You are all caught up</div>
        <p className="empty-body">
          Nobody is waiting on a reply. When a customer messages your WhatsApp number, it lands here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {conversations.map((c) => {
        const unread = Number(c.unread_count || 0);
        const suggestion = suggestions.get(String(c.id));
        const hasDraft = suggestion && (suggestion.state === 'suggested' || suggestion.state === 'editing');

        return (
          <button
            key={c.id}
            className={`conv-row${unread > 0 ? ' is-unread' : ''}${String(selectedId) === String(c.id) ? ' is-selected' : ''}`}
            onClick={() => onOpen(c.id)}
          >
            <span className={`avatar${hasName(c) ? '' : ' tnum'}`}>{avatarLabel(c)}</span>
            <span className="conv-body">
              <span className="conv-top">
                <span className={`conv-name${hasName(c) ? '' : ' tnum'}`}>{displayName(c)}</span>
                <span className="conv-time tnum">{formatListTime(c.last_message_at)}</span>
              </span>
              <span className="conv-bottom">
                <span className="conv-preview">{c.last_message || 'No messages yet'}</span>
                {unread > 0 && <span className="unread-pill">{unread}</span>}
              </span>
              {hasDraft && <span className="tag tag-outline tag-reply-ready">Reply ready</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
