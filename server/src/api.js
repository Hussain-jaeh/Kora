import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import {
  getConversations,
  getConversation,
  getConversationHistory,
  markConversationRead,
  getCustomers,
  getCustomer,
  updateCustomer,
  createOrder,
  getOrdersByBusiness,
  getOrdersByCustomer,
  updateOrder,
  createReminder,
  getPendingReminders,
  resolveReminder,
  getBusiness,
} from './db.js';
import { sendMessage, getConnectionState } from './socket.js';

const app = express();
app.use(cors());
app.use(express.json());

const BUSINESS_ID = Number(process.env.BUSINESS_ID || 1);
const API_TOKEN = process.env.API_TOKEN || '';

// Optional shared-secret auth. Unset = open (fine on localhost, never in public).
app.use((req, res, next) => {
  if (!API_TOKEN) return next();
  if (req.headers.authorization === `Bearer ${API_TOKEN}`) return next();
  res.status(401).json({ error: 'Unauthorized' });
});

// Wraps an async handler so a rejected promise reaches the error middleware.
const route = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const notFound = (res) => res.status(404).json({ error: 'Not found' });

// ── Status ─────────────────────────────────────────────────────────────────

// Shop name for the header, and whether WhatsApp is actually linked. The
// dashboard stops showing message counts as numbers when this says otherwise.
app.get('/status', route(async (req, res) => {
  res.json({
    whatsapp: getConnectionState(),
    business: await getBusiness(BUSINESS_ID),
  });
}));

// ── Conversations ──────────────────────────────────────────────────────────

app.get('/conversations', route(async (req, res) => {
  res.json(await getConversations(BUSINESS_ID));
}));

app.get('/conversations/:id/messages', route(async (req, res) => {
  const limit = Number(req.query.limit) || 50;
  res.json(await getConversationHistory(req.params.id, limit));
}));

app.post('/conversations/:id/read', route(async (req, res) => {
  const updated = await markConversationRead(req.params.id);
  updated ? res.json(updated) : notFound(res);
}));

// Send a reply to the customer in this conversation, and log it.
app.post('/conversations/:id/reply', route(async (req, res) => {
  const { text, sent_by } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  const conversation = await getConversation(req.params.id);
  if (!conversation) return notFound(res);

  await sendMessage(conversation.customer_phone, text, sent_by || 'owner');
  res.status(201).json({ ok: true, to: conversation.customer_phone, text });
}));

// ── Customers ──────────────────────────────────────────────────────────────

app.get('/customers', route(async (req, res) => {
  res.json(await getCustomers(BUSINESS_ID));
}));

app.get('/customers/:id', route(async (req, res) => {
  const customer = await getCustomer(req.params.id);
  customer ? res.json(customer) : notFound(res);
}));

app.patch('/customers/:id', route(async (req, res) => {
  const { name, notes } = req.body;
  const updated = await updateCustomer(req.params.id, { name, notes });
  updated ? res.json(updated) : notFound(res);
}));

app.get('/customers/:id/orders', route(async (req, res) => {
  res.json(await getOrdersByCustomer(req.params.id));
}));

// ── Orders ─────────────────────────────────────────────────────────────────

app.get('/orders', route(async (req, res) => {
  res.json(await getOrdersByBusiness(BUSINESS_ID, req.query.status || null));
}));

app.post('/orders', route(async (req, res) => {
  const { customer_id, description, amount } = req.body;
  if (!customer_id || !description)
    return res.status(400).json({ error: 'customer_id and description are required' });
  res.status(201).json(await createOrder(BUSINESS_ID, customer_id, { description, amount }));
}));

app.patch('/orders/:id', route(async (req, res) => {
  const { status, description, amount } = req.body;
  const updated = await updateOrder(req.params.id, { status, description, amount });
  updated ? res.json(updated) : notFound(res);
}));

// ── Reminders ──────────────────────────────────────────────────────────────

app.get('/reminders', route(async (req, res) => {
  res.json(await getPendingReminders(BUSINESS_ID));
}));

// customer_message is what the customer receives. Omit it to create an
// owner-facing nudge that is never auto-sent to anyone.
app.post('/reminders', route(async (req, res) => {
  const { customer_id, reason, due_at, customer_message } = req.body;
  if (!customer_id || !due_at)
    return res.status(400).json({ error: 'customer_id and due_at are required' });
  const reminder = await createReminder(BUSINESS_ID, customer_id, {
    reason,
    dueAt: due_at,
    customerMessage: customer_message || null,
  });
  res.status(201).json(reminder);
}));

app.post('/reminders/:id/resolve', route(async (req, res) => {
  const resolved = await resolveReminder(req.params.id);
  resolved ? res.json(resolved) : notFound(res);
}));

// ── Errors ─────────────────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error('[api]', err.message);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.API_PORT || 3001;

export function startApi() {
  app.listen(PORT, () => {
    console.log(`API listening on port ${PORT}`);
    if (!API_TOKEN) console.warn('[api] API_TOKEN is not set — the API is unauthenticated.');
  });
}
