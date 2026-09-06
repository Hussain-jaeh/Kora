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
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const jid = msg.key.remoteJid;
      if (!jid || jid.endsWith('@g.us')) continue;

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
        const customer = await upsertCustomer(BUSINESS_ID, phoneNumber, profileName);
        const conversation = await upsertConversation(BUSINESS_ID, customer.id);
        const stored = await insertMessage(conversation.id, {
          direction: 'inbound',
          body,
          waMessageId: msg.key.id,
          sentBy: 'customer',
        });
        if (!stored) continue; // duplicate replay — already in the database
        await bumpUnread(conversation.id);
        console.log(`[in] ${profileName || phoneNumber}: ${body}`);
      } catch (err) {
        console.error('Failed to store inbound message:', err);
      }
    }
  });
}

export async function sendMessage(phoneNumber, text, sentBy = 'owner') {
  if (!sock) throw new Error('WhatsApp socket not connected yet');

  const jid = `${phoneNumber}@s.whatsapp.net`;
  const result = await sock.sendMessage(jid, { text });

  const customer = await upsertCustomer(BUSINESS_ID, phoneNumber, null);
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
