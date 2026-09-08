// One client for every endpoint the server exposes.
// In dev, Vite proxies /api -> http://localhost:3001 (see vite.config.js).
const BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error || `${method} ${path} failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  // Status — shop name + whether WhatsApp is linked
  status: () => request('/status'),

  // Conversations
  conversations: () => request('/conversations'),
  messages: (id, limit = 50) => request(`/conversations/${id}/messages?limit=${limit}`),
  markRead: (id) => request(`/conversations/${id}/read`, { method: 'POST' }),
  reply: (id, text) => request(`/conversations/${id}/reply`, { method: 'POST', body: { text } }),

  // Customers
  customers: () => request('/customers'),
  customer: (id) => request(`/customers/${id}`),
  updateCustomer: (id, fields) => request(`/customers/${id}`, { method: 'PATCH', body: fields }),
  customerOrders: (id) => request(`/customers/${id}/orders`),

  // Orders
  orders: (status) => request(status ? `/orders?status=${status}` : '/orders'),
  createOrder: (order) => request('/orders', { method: 'POST', body: order }),
  updateOrder: (id, fields) => request(`/orders/${id}`, { method: 'PATCH', body: fields }),

  // Reminders — customer_message is SENT to the customer; reason is internal only.
  reminders: () => request('/reminders'),
  createReminder: (reminder) => request('/reminders', { method: 'POST', body: reminder }),
  updateReminder: (id, fields) => request(`/reminders/${id}`, { method: 'PATCH', body: fields }),
  resolveReminder: (id) => request(`/reminders/${id}/resolve`, { method: 'POST' }),
};
