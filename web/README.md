# web — owner dashboard

React + Vite. Talks to the server in `../server` through `/api`, which Vite
proxies to `http://localhost:3001` in development (see `vite.config.js`), so
there is no CORS setup and no API token in the browser while developing.

```bash
npm install
npm run dev        # http://localhost:5173
```

The server must be running too — `npm run server` from the repo root.

`src/api.js` already wraps every endpoint the server exposes. Build the screens
against it; don't call `fetch` directly from components.

In production, set `VITE_API_URL` to the deployed API's URL at build time.

## Seeing AI suggestions

There is no suggestions endpoint on the server yet. `src/lib/suggestions.js` holds
drafts in memory only — deliberately, since a draft must never be stored as an
outbound message before the owner sends it. To see the suggested / editing /
sent / dismissed states while developing:

```bash
VITE_MOCK_AI=1 npm run dev
```

When the AI layer lands, replace `seedMock()` with a fetch. Nothing else in the
UI has to change.

## Design source

Built from `design_handoff_owner_dashboard`. `src/styles/classical.css` is the
Classical design system, copied verbatim — resolve values through its tokens
rather than typing hex codes.
