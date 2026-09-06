import Icon from './Icon.jsx';
import { navigate } from '../lib/router.js';

const NAV = [
  { key: 'today', label: 'Today', icon: 'today' },
  { key: 'inbox', label: 'Inbox', icon: 'inbox' },
  { key: 'orders', label: 'Orders', icon: 'orders' },
  { key: 'reminders', label: 'Reminders', icon: 'reminders' },
  { key: 'customers', label: 'Customers', icon: 'customers' },
];

export default function SideRail({ active, inboxBadge, shopName, connected }) {
  return (
    <nav className="siderail">
      <div className="rail-brand">
        <div className="kicker kicker-accent">Counter</div>
        <div className="shop">{shopName}</div>
      </div>
      <div className="hairline" style={{ margin: '0 20px 12px' }} />

      {NAV.map((item) => (
        <button
          key={item.key}
          className="rail-item"
          aria-current={active === item.key ? 'page' : undefined}
          onClick={() => navigate(`/${item.key}`)}
        >
          <Icon name={item.icon} size={19} />
          <span className="label">{item.label}</span>
          {item.key === 'inbox' && inboxBadge > 0 && <span className="rail-badge">{inboxBadge}</span>}
        </button>
      ))}

      <div className="spacer" />
      <div className="hairline" style={{ margin: '12px 20px' }} />
      <div className={`connection${connected ? '' : ' is-down'}`} style={{ padding: '0 20px' }}>
        <span className="dot" />
        {connected ? 'WhatsApp connected' : 'WhatsApp not linked'}
      </div>
      <div style={{ padding: '10px 14px 0' }}>
        <button className="btn btn-ghost" style={{ fontSize: '13.5px', color: 'var(--color-neutral-800)' }}>
          Sign out
        </button>
      </div>
    </nav>
  );
}
