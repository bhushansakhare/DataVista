# SheetFlow Analytics

Turn Google Sheets into interactive dashboards. Full-stack SaaS: React + Node + MongoDB + Socket.io.

## Stack
- **Client:** React 18 (Vite), Tailwind CSS, Framer Motion, Recharts, Socket.io-client, React Router
- **Server:** Node.js, Express, MongoDB (Mongoose), Socket.io, JWT
- **Data source:** Google Sheets via public CSV export (`/export?format=csv`)

## Project layout
```
DataVista/
  server/    Express API + Socket.io
  client/    React SPA (Vite)
```

## Quick start

### 1. Server
```bash
cd server
cp .env.example .env        # then edit MONGO_URI / JWT_SECRET
npm install
npm run dev                  # starts on http://localhost:5000
```

### 2. Client
```bash
cd client
npm install
npm run dev                  # starts on http://localhost:5173
```

The client proxies `/api` and `/socket.io` to `http://localhost:5000` (see `client/vite.config.js`).

## Environment

`server/.env`:
```
PORT=5000
MONGO_URI=mongodb://localhost:27017/sheetflow
JWT_SECRET=change-me-to-a-long-random-string
JWT_EXPIRES=7d
CLIENT_URL=http://localhost:5173
SHEET_POLL_SECONDS=30
```

## Google Sheets

The sheet must be shared as **"Anyone with the link — Viewer"**. Paste any URL of the form:
`https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit#gid=<GID>`

The server fetches `https://docs.google.com/spreadsheets/d/<SHEET_ID>/export?format=csv&gid=<GID>`, parses, type-detects each column (number / date / string), and stores normalized JSON.

## Roles
- `superadmin` — global control, all workspaces, all users
- `admin` — workspace owner, can import sheets, build dashboards, share
- `user` — viewer of dashboards inside their workspace

The first registered user is auto-promoted to `superadmin`.

## Charts (12)
Bar, Line, Donut, Area, Stacked Bar, Horizontal Bar, Scatter, Treemap, Funnel, Radial Bar, Heatmap, Waterfall.

## Real-time
On sheet import, the server starts a poller (`SHEET_POLL_SECONDS`). When the CSV hash changes, it persists the new data and emits `sheet:updated` over Socket.io to all clients subscribed to that sheet's room. Open dashboards re-fetch and re-render.

## Public share
`POST /api/share/generate` returns a token. The public URL `/<client>/s/:token` renders the dashboard read-only without auth.

## API summary
- `POST /api/auth/register` `POST /api/auth/login` `GET /api/auth/me`
- `POST /api/sheet/import` `GET /api/sheet/:id` `POST /api/sheet/:id/refresh` `GET /api/sheet`
- `POST /api/dashboard` `GET /api/dashboard` `GET /api/dashboard/:id` `PUT /api/dashboard/:id` `DELETE /api/dashboard/:id`
- `POST /api/share/generate` `GET /api/share/:token`
- `GET /api/admin/stats` `GET /api/admin/users` `GET /api/admin/workspaces` (superadmin only)
