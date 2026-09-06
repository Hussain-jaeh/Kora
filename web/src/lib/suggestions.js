import { useSyncExternalStore } from 'react';

/**
 * AI suggestions live ONLY in memory, on purpose.
 *
 * The handoff is explicit: a draft is not part of the thread until the owner
 * sends it, and it must never be persisted as an outbound message beforehand.
 * So nothing here touches the API until `send`, which goes through the normal
 * POST /conversations/:id/reply path like any owner message.
 *
 * There is no suggestions endpoint on the server yet. Until there is, this
 * store is filled by seedMock() when VITE_MOCK_AI=1, so the four states are
 * real and testable. Replace seedMock with a fetch when the AI layer lands —
 * nothing else in the UI needs to change.
 */

const store = new Map(); // conversationId -> { text, state, draft }
const listeners = new Set();

function emit() {
  snapshot = null;
  listeners.forEach((l) => l());
}

let snapshot = null;
function getSnapshot() {
  if (!snapshot) snapshot = new Map(store);
  return snapshot;
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSuggestions() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function useSuggestion(conversationId) {
  const all = useSuggestions();
  return conversationId == null ? null : all.get(String(conversationId)) || null;
}

export const suggestions = {
  set(conversationId, text) {
    store.set(String(conversationId), { text, draft: text, state: 'suggested' });
    emit();
  },
  edit(conversationId) {
    const s = store.get(String(conversationId));
    if (s) { store.set(String(conversationId), { ...s, state: 'editing' }); emit(); }
  },
  updateDraft(conversationId, draft) {
    const s = store.get(String(conversationId));
    if (s) { store.set(String(conversationId), { ...s, draft }); emit(); }
  },
  cancelEdit(conversationId) {
    const s = store.get(String(conversationId));
    if (s) { store.set(String(conversationId), { ...s, draft: s.text, state: 'suggested' }); emit(); }
  },
  dismiss(conversationId) {
    const s = store.get(String(conversationId));
    if (s) { store.set(String(conversationId), { ...s, state: 'dismissed' }); emit(); }
  },
  undo(conversationId) {
    const s = store.get(String(conversationId));
    if (s) { store.set(String(conversationId), { ...s, state: 'suggested' }); emit(); }
  },
  markSent(conversationId) {
    const s = store.get(String(conversationId));
    if (s) { store.set(String(conversationId), { ...s, state: 'sent' }); emit(); }
  },
  clear(conversationId) {
    store.delete(String(conversationId));
    emit();
  },
};

/** Conversations with a suggestion still awaiting a decision. */
export function pendingSuggestions(all) {
  return [...all.entries()]
    .filter(([, s]) => s.state === 'suggested' || s.state === 'editing')
    .map(([conversationId, s]) => ({ conversationId, ...s }));
}

const MOCK_REPLIES = [
  'Yes, 11 am works. A fade cut is ₦2,500. See you then.',
  'We open 10 am to 6 pm today. Come any time that suits you.',
];

/** Dev-only. Seeds a draft on the newest unread conversations. */
export function seedMock(conversations) {
  if (!import.meta.env.VITE_MOCK_AI) return;
  conversations
    .filter((c) => c.unread_count > 0)
    .slice(0, MOCK_REPLIES.length)
    .forEach((c, i) => {
      if (!store.has(String(c.id))) store.set(String(c.id), {
        text: MOCK_REPLIES[i], draft: MOCK_REPLIES[i], state: 'suggested',
      });
    });
  emit();
}
