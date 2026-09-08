import 'dotenv/config';
import { start, sendMessage } from './socket.js';
import { startApi } from './api.js';
import { pool, getDueReminders, resolveReminder } from './db.js';

const BUSINESS_ID = Number(process.env.BUSINESS_ID || 1);
const REMINDER_INTERVAL_MS = 60_000; // check every minute

// Only reminders with a customer_message are ever sent to a customer. Reminders
// without one are owner-facing nudges: they stay open in GET /reminders until the
// owner deals with them. (Never send `reason` — that is an internal note.)
async function runReminderScheduler() {
  let due;
  try {
    due = await getDueReminders(BUSINESS_ID);
  } catch (err) {
    console.error('[reminder] Could not load due reminders:', err.message);
    return;
  }

  for (const reminder of due) {
    // One bad reminder must not block the rest of the batch.
    try {
      await sendMessage(reminder.customer_phone, reminder.customer_message, 'owner');
      await resolveReminder(reminder.id);
      console.log(`[reminder] #${reminder.id} sent to ${reminder.customer_phone} — ${reminder.customer_message.length} chars`);
    } catch (err) {
      console.error(`[reminder] #${reminder.id} failed, will retry next tick:`, err.message);
    }
  }
}

process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});

startApi();
start();
setInterval(runReminderScheduler, REMINDER_INTERVAL_MS);
