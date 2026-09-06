// Phone numbers are stored as 2348012345678 and shown as +234 801 234 5678.
export function formatPhone(raw) {
  if (!raw) return '';
  const d = String(raw).replace(/\D/g, '');
  if (d.startsWith('234') && d.length === 13) {
    return `+234 ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}`;
  }
  return `+${d}`;
}

// A name is the exception, not the rule — most customers only ever have a number.
export function displayName(customer) {
  return customer?.customer_name || customer?.name || formatPhone(customer?.customer_phone || customer?.phone_number);
}

export function hasName(customer) {
  return Boolean(customer?.customer_name || customer?.name);
}

// Avatar tile: initials when a name exists, otherwise the last three digits.
export function avatarLabel(customer) {
  const name = customer?.customer_name || customer?.name;
  if (name) {
    return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  }
  const d = String(customer?.customer_phone || customer?.phone_number || '').replace(/\D/g, '');
  return d.slice(-3);
}

const TIME = { hour: 'numeric', minute: '2-digit', hour12: true };

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatClock(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-NG', TIME).toLowerCase();
}

/** '2:14 pm' today, 'Yesterday' yesterday, otherwise a short date. */
export function formatListTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (isSameDay(d, now)) return formatClock(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}

export function formatDayKicker(iso) {
  const d = iso ? new Date(iso) : new Date();
  const now = new Date();
  if (isSameDay(d, now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'long' });
}

export function formatToday() {
  return new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** '2 hr 14 min' — how long someone has been waiting. */
export function formatWait(iso) {
  if (!iso) return '';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    const rest = mins % 60;
    return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
  }
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day' : `${days} days`;
}

export function formatMoney(amount) {
  const n = Number(amount || 0);
  return `₦${n.toLocaleString('en-NG', { maximumFractionDigits: n % 1 === 0 ? 0 : 2 })}`;
}

export function plural(n, one, many) {
  return n === 1 ? one : many;
}
