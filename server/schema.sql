-- WhatsApp Business OS — core schema
-- One Postgres database can serve multiple businesses (multi-tenant via business_id).
-- This file is idempotent: `npm run migrate` is safe to run as many times as you like.

CREATE TABLE IF NOT EXISTS businesses (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL UNIQUE,   -- the business's WhatsApp number, e.g. "2348012345678"
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id            SERIAL PRIMARY KEY,
  business_id   INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  phone_number  TEXT NOT NULL,            -- customer's WhatsApp number (JID's user part)
  name          TEXT,                     -- pulled from WhatsApp profile name, editable by owner
  notes         TEXT,                     -- free-text notes the owner adds ("prefers fade cuts", "usually pays cash")
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, phone_number)
);

CREATE TABLE IF NOT EXISTS conversations (
  id              SERIAL PRIMARY KEY,
  business_id     INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  unread_count    INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, customer_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id              SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction       TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body            TEXT NOT NULL,
  wa_message_id   TEXT,                   -- WhatsApp's own message id, for dedup/status updates
  sent_by         TEXT,                   -- 'customer' | 'owner' | 'ai'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS orders (
  id              SERIAL PRIMARY KEY,
  business_id     INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  description     TEXT NOT NULL,          -- "2 shirts, blue fabric" / "haircut + beard trim"
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done', 'cancelled')),
  amount          NUMERIC(10, 2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follow_up_reminders (
  id              SERIAL PRIMARY KEY,
  business_id     INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  reason          TEXT,                   -- OWNER-FACING note: "hasn't responded in 3 days"
  due_at          TIMESTAMPTZ NOT NULL,
  resolved        BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Migrations for databases created before these columns existed ──────────

-- The exact text sent to the CUSTOMER when this reminder comes due.
-- NULL means "owner-facing nudge only" — the scheduler will never message the
-- customer, it just stays in GET /reminders until the owner deals with it.
ALTER TABLE follow_up_reminders ADD COLUMN IF NOT EXISTS customer_message TEXT;

-- Dedup: Baileys replays messages on reconnect. Drop any existing duplicates,
-- then stop new ones at the database level.
DELETE FROM messages a
  USING messages b
  WHERE a.wa_message_id IS NOT NULL
    AND a.wa_message_id = b.wa_message_id
    AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_wa_id
  ON messages(wa_message_id)
  WHERE wa_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_recent
  ON conversations(business_id, last_message_at DESC);

-- The exact JID WhatsApp addresses this customer by. Newer WhatsApp identifies
-- some contacts by a LID (e.g. 77666011095155@lid) rather than a phone number,
-- and "<lid>@s.whatsapp.net" is not a deliverable address. Always reply to the
-- JID we actually received from.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS wa_jid TEXT;
