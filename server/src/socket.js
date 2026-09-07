import 'dotenv/config';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import { upsertCustomer, upsertConversation, insertMessage, bumpUnread } from './db.js';

const BUSINESS_ID = Number(process.env.BUSINESS_ID || 1);
const logger = pino({ level: 'silent' });

let sock;
let connectionState = 'connecting'; // connecting | connected | reconnecting | disconnected

export async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\nScan this QR code in WhatsApp → Linked Devices:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      connectionState = shouldReconnect ? 'reconnecting' : 'disconnected';
      console.log('Connection closed.', shouldReconnect ? 'Reconnecting...' : 'Logged out — delete ./auth and re-scan.');
      if (shouldReconnect) setTimeout(start, 3000);
    } else if (connection === 'open') {
      connectionState = 'connected';
      console.log(`Connected. Listening for messages for business_id=${BUSINESS_ID}.`);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    // Anything that is not a live delivery is a history/offline sync. We do not
    // store those today, which means messages that arrived while this process
    // was stopped are never captured. Say so out loud rather than dropping them
    // in silence.
    if (type !== 'notify') {
      console.log(`[skip] ${messages.length} message(s) of type "${type}" — history sync, not stored`);
      return;
    }

    for (const msg of messages) {
      if (!msg.message) { console.log('[skip] message with no content'); continue; }
      if (msg.key.fromMe) { console.log(`[skip] our own message to ${msg.key.remoteJid}`); continue; }

      const jid = msg.key.remoteJid;
      if (!jid) { console.log('[skip] message with no remoteJid'); continue; }
      if (jid.endsWith('@g.us')) { console.log('[skip] group message'); continue; }

      const phoneNumber = jid.split('@')[0];
      const m = msg.message;
      const body =
        m.conversation ||
        m.extendedTextMessage?.text ||
        m.imageMessage?.caption ||
        m.videoMessage?.caption ||
        (m.audioMessage && '[voice note]') ||
        (m.imageMessage && '[image]') ||
        (m.videoMessage && '[video]') ||
        (m.documentMessage && '[document]') ||
        (m.locationMessage && '[location]') ||
        '[unsupported message type]';
      const profileName = msg.pushName || null;

      try {
        const customer = await upsertCustomer(BUSINESS_ID, phoneNumber, profileName, jid);
        const conversation = await upsertConversation(BUSINESS_ID, customer.id);
        const stored = await insertMessage(conversation.id, {
          direction: 'inbound',
          body,
          waMessageId: msg.key.id,
          sentBy: 'customer',
        });
        if (!stored) continue; // duplicate replay — already in the database
        await bumpUnread(conversation.id);
        console.log(`[in] ${profileName || phoneNumber} <${jid}> — ${body.length} chars`);
      } catch (err) {
        console.error('Failed to store inbound message:', err);
      }
    }
  });
}

/**
 * Resolve who we are actually sending to.
 *
 * WhatsApp does not address every contact by phone number any more — some
 * arrive as a LID (77666011095155@lid). Pasting "@s.whatsapp.net" onto a LID
 * produces an address that does not exist, and Baileys does NOT complain: it
 * returns a message key and the message silently goes nowhere. So: reply to the
 * JID we stored from their inbound message, and when we have no stored JID,
 * ask WhatsApp whether the number is reachable before sending.
 */
async function resolveJid(customer, phoneNumber) {
  if (customer?.wa_jid) return customer.wa_jid;

  const digits = String(phoneNumber).replace(/\D/g, '');
  const [found] = await sock.onWhatsApp(digits);
  if (!found?.exists) {
    throw new Error(
      `Cannot send: ${digits} is not reachable on WhatsApp and no JID is stored ` +
      `for this customer. (If this contact was created from a LID, we need an ` +
      `inbound message from them before we can reply.)`
    );
  }
  return found.jid;
}

export async function sendMessage(phoneNumber, text, sentBy = 'owner') {
  if (!sock) throw new Error('WhatsApp socket not connected yet');
  if (connectionState !== 'connected') {
    throw new Error(`Cannot send: WhatsApp link is ${connectionState}`);
  }

  const customer = await upsertCustomer(BUSINESS_ID, phoneNumber, null);
  const jid = await resolveJid(customer, phoneNumber);

  const result = await sock.sendMessage(jid, { text });
  console.log(`[out] -> ${jid} — ${text.length} chars (id ${result?.key?.id})`);

  const conversation = await upsertConversation(BUSINESS_ID, customer.id);
  await insertMessage(conversation.id, {
    direction: 'outbound',
    body: text,
    waMessageId: result?.key?.id,
    sentBy,
  });

  return result;
}

/** Whether the WhatsApp link is up — drives the dashboard's connection state. */
export function getConnectionState() {
  return connectionState;
}
