import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ── Customers ──────────────────────────────────────────────────────────────

export async function upsertCustomer(businessId, phoneNumber, name, waJid = null) {
  const { rows } = await pool.query(
    `INSERT INTO customers (business_id, phone_number, name, wa_jid)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (business_id, phone_number)
     DO UPDATE SET
       name   = COALESCE(customers.name, EXCLUDED.name),
       wa_jid = COALESCE(EXCLUDED.wa_jid, customers.wa_jid)
     RETURNING *`,
    [businessId, phoneNumber, name || null, waJid]
  );
  return rows[0];
}

export async function getCustomers(businessId) {
  const { rows } = await pool.query(
    `SELECT * FROM customers WHERE business_id = $1 ORDER BY created_at DESC`,
    [businessId]
  );
  return rows;
}

export async function getCustomer(customerId) {
  const { rows } = await pool.query(
    `SELECT * FROM customers WHERE id = $1`,
    [customerId]
  );
  return rows[0] || null;
}

export async function updateCustomer(customerId, { name, notes }) {
  const { rows } = await pool.query(
    `UPDATE customers
     SET name  = COALESCE($2, name),
         notes = COALESCE($3, notes)
     WHERE id = $1
     RETURNING *`,
    [customerId, name || null, notes !== undefined ? notes : null]
  );
  return rows[0] || null;
}

// ── Conversations ──────────────────────────────────────────────────────────

export async function upsertConversation(businessId, customerId, { incrementUnread = false } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO conversations (business_id, customer_id, last_message_at, unread_count)
     VALUES ($1, $2, now(), $3)
     ON CONFLICT (business_id, customer_id)
     DO UPDATE SET
       last_message_at = now(),
       unread_count    = conversations.unread_count + $3
     RETURNING *`,
    [businessId, customerId, incrementUnread ? 1 : 0]
  );
  return rows[0];
}

export async function getConversations(businessId) {
  const { rows } = await pool.query(
    `SELECT c.*,
            cu.name         AS customer_name,
            cu.phone_number AS customer_phone,
            (SELECT body FROM messages m
             WHERE m.conversation_id = c.id
             ORDER BY m.created_at DESC LIMIT 1) AS last_message
     FROM conversations c
     JOIN customers cu ON cu.id = c.customer_id
     WHERE c.business_id = $1
     ORDER BY c.last_message_at DESC NULLS LAST`,
    [businessId]
  );
  return rows;
}

export async function markConversationRead(conversationId) {
  const { rows } = await pool.query(
    `UPDATE conversations SET unread_count = 0 WHERE id = $1 RETURNING *`,
    [conversationId]
  );
  return rows[0] || null;
}

// ── Messages ───────────────────────────────────────────────────────────────

export async function insertMessage(conversationId, { direction, body, waMessageId, sentBy }) {
  const { rows } = await pool.query(
    `INSERT INTO messages (conversation_id, direction, body, wa_message_id, sent_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (wa_message_id) WHERE wa_message_id IS NOT NULL DO NOTHING
     RETURNING *`,
    [conversationId, direction, body, waMessageId || null, sentBy || null]
  );
  // undefined => WhatsApp replayed a message we already stored.
  return rows[0] || null;
}

/** Bump unread only when a message was actually new. */
export async function bumpUnread(conversationId) {
  const { rows } = await pool.query(
    `UPDATE conversations
     SET unread_count = unread_count + 1, last_message_at = now()
     WHERE id = $1
     RETURNING *`,
    [conversationId]
  );
  return rows[0] || null;
}

export async function getConversationHistory(conversationId, limit = 50) {
  const { rows } = await pool.query(
    `SELECT * FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [conversationId, limit]
  );
  return rows.reverse();
}

// ── Orders ─────────────────────────────────────────────────────────────────

export async function createOrder(businessId, customerId, { description, amount = null }) {
  const { rows } = await pool.query(
    `INSERT INTO orders (business_id, customer_id, description, amount)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [businessId, customerId, description, amount]
  );
  return rows[0];
}

export async function getOrdersByBusiness(businessId, status = null) {
  const { rows } = await pool.query(
    `SELECT o.*, cu.name AS customer_name, cu.phone_number AS customer_phone
     FROM orders o
     JOIN customers cu ON cu.id = o.customer_id
     WHERE o.business_id = $1
       AND ($2::text IS NULL OR o.status = $2)
     ORDER BY o.created_at DESC`,
    [businessId, status]
  );
  return rows;
}

export async function getOrdersByCustomer(customerId) {
  const { rows } = await pool.query(
    `SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC`,
    [customerId]
  );
  return rows;
}

export async function updateOrder(orderId, { status, description, amount }) {
  const { rows } = await pool.query(
    `UPDATE orders
     SET status      = COALESCE($2, status),
         description = COALESCE($3, description),
         amount      = COALESCE($4, amount),
         updated_at  = now()
     WHERE id = $1
     RETURNING *`,
    [orderId, status || null, description || null, amount ?? null]
  );
  return rows[0] || null;
}

// ── Follow-up Reminders ────────────────────────────────────────────────────

export async function createReminder(businessId, customerId, { reason = null, dueAt, customerMessage = null }) {
  const { rows } = await pool.query(
    `INSERT INTO follow_up_reminders (business_id, customer_id, reason, due_at, customer_message)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [businessId, customerId, reason, dueAt, customerMessage]
  );
  return rows[0];
}

export async function getPendingReminders(businessId) {
  const { rows } = await pool.query(
    `SELECT r.*, cu.name AS customer_name, cu.phone_number AS customer_phone
     FROM follow_up_reminders r
     JOIN customers cu ON cu.id = r.customer_id
     WHERE r.business_id = $1
       AND r.resolved = false
     ORDER BY r.due_at ASC`,
    [businessId]
  );
  return rows;
}

export async function getDueReminders(businessId) {
  const { rows } = await pool.query(
    `SELECT r.*, cu.name AS customer_name, cu.phone_number AS customer_phone
     FROM follow_up_reminders r
     JOIN customers cu ON cu.id = r.customer_id
     WHERE r.business_id = $1
       AND r.resolved = false
       AND r.due_at <= now()
       AND r.customer_message IS NOT NULL
     ORDER BY r.due_at ASC`,
    [businessId]
  );
  return rows;
}

export async function resolveReminder(reminderId) {
  const { rows } = await pool.query(
    `UPDATE follow_up_reminders SET resolved = true WHERE id = $1 RETURNING *`,
    [reminderId]
  );
  return rows[0] || null;
}

/** One conversation plus the customer's name/phone — used when replying. */
export async function getConversation(conversationId) {
  const { rows } = await pool.query(
    `SELECT c.*, cu.name AS customer_name, cu.phone_number AS customer_phone
     FROM conversations c
     JOIN customers cu ON cu.id = c.customer_id
     WHERE c.id = $1`,
    [conversationId]
  );
  return rows[0] || null;
}

/** The business this process serves. */
export async function getBusiness(businessId) {
  const { rows } = await pool.query(
    `SELECT id, name, whatsapp_number, created_at FROM businesses WHERE id = $1`,
    [businessId]
  );
  return rows[0] || null;
}
