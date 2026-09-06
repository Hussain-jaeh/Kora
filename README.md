# Kora

_WhatsApp Business OS — pilot scaffold_

WhatsApp-first assistant and lightweight business OS for small physical
businesses — barbers, tailors, phone shops, small restaurants, repair shops.

```
server/   WhatsApp socket + REST API + reminder scheduler  (Node, Postgres)
web/      Owner dashboard                                   (React + Vite)
```

Uses [Baileys](https://github.com/WhiskeySockets/Baileys) (unofficial — drives a real
WhatsApp Web session, no Meta approval needed). Fine for a paid pilot with a business
that knows it's early; plan to move to the official Meta Cloud API before scaling past
a handful of businesses, since the unofficial route risks the number getting banned.

## Quick start

```bash
npm run setup                                   # installs server/ and web/
cp server/.env.example server/.env              # then set DATABASE_URL
npm run migrate -- "Joe's Barbershop" 2348012345678
                                                # prints BUSINESS_ID -> put in server/.env
npm run server                                  # terminal 1 — WhatsApp + API on :3001
npm run web                                     # terminal 2 — dashboard on :5173
```

On first `npm run server`, scan the QR code with the **business's** WhatsApp
(Settings > Linked Devices > Link a Device). The session is saved to `server/auth/`
so you only scan once. `npm run migrate` is safe to re-run.

Every inbound message lands in `messages`, linked to a `customers` row keyed by phone
number and a `conversations` row per customer. Replays from WhatsApp reconnects are
rejected by a unique index on `wa_message_id`.

## API

Base URL `http://localhost:3001`. The dashboard reaches it through Vite's `/api` proxy
in development. If `API_TOKEN` is set in `server/.env`, every request needs
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

`web/src/api.js` wraps all of these — build screens against that, not raw `fetch`.

## Reminders: two different things

- **`customer_message`** — the exact text the customer receives. When the reminder comes
  due, the scheduler sends this and marks it resolved.
- **`reason`** — an internal note for the owner ("hasn't responded in 3 days"). It is
  **never** sent to anybody.

A reminder with no `customer_message` is an owner-facing nudge: it stays in
`GET /reminders` until the owner deals with it. Nothing is auto-sent.

## Privacy

Message bodies are stored in plaintext in Postgres, and this server is a linked
WhatsApp device — meaning the operator can read customers' conversations. Before
onboarding a real business: tell the owner what is stored and for how long, keep
message bodies out of application logs, and set a retention window.

## Not built yet

AI-suggested replies, daily summaries, owner sign-in, multi-tenancy. The API above is
everything the dashboard needs today.

## Notes for going from pilot to paid

- One Baileys process per business number. Several businesses means several instances
  with different `.env` / `auth/` — fine for a few pilots, consolidate onto the Cloud
  API before it gets unwieldy.
- Group chats are skipped in the inbound handler on purpose.
- Media isn't downloaded; images/voice notes are stored as `[image]`, `[voice note]`.
- **Never commit `server/.env` or `server/auth/`.** `auth/` is a live WhatsApp session —
  anyone holding it can send messages as the business. Both are gitignored.
