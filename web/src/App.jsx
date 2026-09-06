import { useEffect, useState } from 'react';
import { api } from './api.js';

/**
 * Placeholder shell. It only proves the browser can reach the API — replace it
 * with the real dashboard screens from the design.
 */
export default function App() {
  const [state, setState] = useState({ status: 'checking' });

  useEffect(() => {
    api.conversations()
      .then((rows) => setState({ status: 'ok', count: rows.length }))
      .catch((err) => setState({ status: 'error', message: err.message }));
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 520 }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Business OS</h1>
      <p style={{ color: '#666', marginTop: 0 }}>Dashboard shell — no UI yet.</p>

      {state.status === 'checking' && <p>Contacting the API…</p>}

      {state.status === 'ok' && (
        <p style={{ color: '#2f9e44' }}>
          API reachable — {state.count} conversation{state.count === 1 ? '' : 's'} so far.
        </p>
      )}

      {state.status === 'error' && (
        <div style={{ color: '#e03131' }}>
          <p><strong>Can't reach the API.</strong> {state.message}</p>
          <p style={{ color: '#666' }}>Is the server running? <code>npm run server</code></p>
        </div>
      )}
    </main>
  );
}
