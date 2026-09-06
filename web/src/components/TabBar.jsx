import Icon from './Icon.jsx';
import { navigate } from '../lib/router.js';

const TABS = [
  { key: 'today', label: 'Today', icon: 'today' },
  { key: 'inbox', label: 'Inbox', icon: 'inbox' },
  { key: 'orders', label: 'Orders', icon: 'orders' },
  { key: 'reminders', label: 'Alerts', icon: 'reminders' },
  { key: 'customers', label: 'Me', icon: 'customers' },
];

export default function TabBar({ active, inboxBadge }) {
  return (
    <nav className="tabbar">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          className="tabbar-item"
          aria-current={active === tab.key ? 'page' : undefined}
          onClick={() => navigate(`/${tab.key}`)}
        >
          <Icon name={tab.icon} />
          <span className="label">{tab.label}</span>
          {tab.key === 'inbox' && inboxBadge > 0 && (
            <span className="tabbar-badge">{inboxBadge}</span>
          )}
        </button>
      ))}
    </nav>
  );
}
