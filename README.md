# WhatsApp Business OS — pilot scaffold

Minimal pipe from a real WhatsApp number into Postgres, plus a REST API on top, so you
can get one business live fast and add inbox UI / AI replies on top once messages are
flowing.

Uses [Baileys](https://github.com/WhiskeySockets/Baileys) (unofficial — drives a real
WhatsApp Web session, no Meta approval needed). Fine for a paid pilot with a business
that knows it's early; plan to move to the official Meta Cloud API before scaling past
a handful of businesses, since the unofficial route risks the number getting banned.

## Setup

1. `npm install`
2. Have a Postgres database ready, copy `.env.example` to `.env` and set `DATABASE_URL`.
3. `npm run migrate -- "Joe's Barbershop" 2348012345678` — creates the tables and one
   business row. It prints a `BUSINESS_ID` — put that in `.env`. Safe to re-run.
4. `npm start` — scan the QR code with the **business's** WhatsApp (Settings > Linked
   Devices > Link a Device). The session is saved to `./auth/` so you only scan once.

`npm start` runs three things in one process: the WhatsApp socket, the REST API on
`API_PORT`, and a reminder scheduler that ticks every minute.

Every inbound message from a real customer lands in the `messages` table, linked to a
`customers` row keyed by phone number and a `conversations` row per customer. Duplicate
replays from WhatsApp reconnects are rejected by a unique index on `wa_message_id`.

## API

Base URL `http://localhost:3001`. If `API_TOKEN` is set in `.env`, every request needs
`Authorization: Bearer <token>` — leave it blank locally, set it before this is ever
reachable from a network.

| Method | Path | Does |
| --- | --- | --- |
| GET | `/conversations` | Inbox list, newest first, with last message + unread count |
| GET | `/conversations/:id/messages` | Thread history (`?limit=50`) |
| POST | `/conversations/:id/read` | Clear unread count |
| POST | `/conversations/:id/reply` | `{ text }` — sends over WhatsApp and logs it |
| GET | `/customers` · `/customers/:id` | Customer list / one customer |
| PATCH | `/customers/:id` | `{ name, notes }` |
| GET | `/customers/:id/orders` | That customer's orders |
| GET | `/orders` | All orders (`?status=pending`) |
| POST | `/orders` | `{ customer_id, description, amount }` |
| PATCH | `/orders/:id` | `{ status, description, amount }` |
| GET | `/reminders` | Open reminders, soonest first |
| POST | `/reminders` | `{ customer_id, due_at, reason, customer_message }` |
| POST | `/reminders/:id/resolve` | Mark done |

You can also call `sendMessage(phoneNumber, text, sentBy)` directly from `src/socket.js`.

## Reminders: two different things

- **`customer_message`** — the exact text the customer receives. When the reminder comes
  due, the scheduler sends this and marks it resolved.
- **`reason`** — an internal note for the owner ("hasn't responded in 3 days"). It is
  **never** sent to anybody.

A reminder with no `customer_message` is an owner-facing nudge: it just stays in
`GET /reminders` until the owner deals with it. Nothing is auto-sent.

## What's deliberately not built yet

No dashboard UI, no AI replies. Those come after messages are confirmed flowing for one
real business. The API above is everything an inbox UI needs.

## Notes for going from pilot to paid

- One Baileys process per business number (this script is written for exactly that).
  Running several businesses means several instances with different `.env` / `./auth`
  folders — fine for a handful of pilots, but plan to consolidate onto the Cloud API
  before this gets unwieldy.
- Group chats are skipped in the inbound handler on purpose — uncomment that check if
  a business wants group support later.
- Media isn't downloaded yet; images/voice notes are stored as `[image]`, `[voice note]`
  etc. so the thread still reads correctly.
- **Never commit `.env` or `auth/`.** `auth/` is a live WhatsApp session — anyone holding
  it can send messages as the business. Both are in `.gitignore`.
