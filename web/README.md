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
