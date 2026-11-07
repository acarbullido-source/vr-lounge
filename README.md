# VR Lounge — Multi-User WebXR Virtual Watch Party

**Live WebXR App:** [https://acarbullido-source.github.io/vr-lounge/](https://acarbullido-source.github.io/vr-lounge/)

**VR Lounge** is a multi-user WebXR virtual cinema and watch-party application built with **React 19**, **TypeScript**, **Vite**, **Tailwind CSS v4**, **Three.js**, **`@react-three/fiber` v9**, **`@react-three/drei` v10**, **`@react-three/xr` v6**, **Supabase Realtime** (with built-in **Zero-Config Global Cloud Relay**), and **WebRTC**.

Friends can join a shared 3D screening room from **Meta Quest 3** headsets or **desktop browsers**, inhabit tracked 6DoF 3D avatars with **spatial voice chat**, exchange live 3D text chat & floating emoji reactions, and share control of a curved 16:9 cinema screen.

---

## Join a Watch Party Right Now

1. Open **[https://acarbullido-source.github.io/vr-lounge/](https://acarbullido-source.github.io/vr-lounge/)** on your PC or in **Meta Quest Browser**.
2. Enter your display name and a **Room Code** (e.g. `CINEMA-1`), then click the **Copy** icon to send a direct `?room=CINEMA-1` invite link to your friends.
3. Click **Enter VR (Quest 3 / WebXR)** on a headset, or **Join in Desktop / Companion Presenter Mode** on a computer to stream any browser tab (Netflix, YouTube, Twitch, etc.) onto the 3D theater screen.

> **Zero-Setup Global Rooms:** Out of the box, VR Lounge connects rooms across networks via encrypted WebSockets (`Global Cloud Relay`) + WebRTC STUN. If you optionally configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, it automatically switches to your dedicated **Supabase Realtime** project.

---

## Local Development

```bash
npm install
npm run dev
```

Vite launches with `@vitejs/plugin-basic-ssl` and `--host` on `https://localhost:5173/`.

---

## Cloud Stack & Automated Deployment

Pushes to `main` automatically typecheck, lint, build vendor-split bundles, and deploy to GitHub Pages via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), while [`.github/workflows/supabase-keepalive.yml`](.github/workflows/supabase-keepalive.yml) keeps free-tier Supabase projects active year-round:

- `VITE_LOUNGE_PASSCODE` — Optional secret passcode gate (renders a VR-laser & desktop keypad and remembers unlocked headsets/PCs in `localStorage`).
- `VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY` — Dedicated **Supabase Realtime** Presence & 20Hz Avatar Pose Broadcast channels (supports `sb_publishable_...` and legacy `anon` keys, with automatic Cloud Relay failover).
- `VITE_METERED_API_KEY` (plus optional `VITE_METERED_DOMAIN` / `VITE_METERED_TURN_URL`) — **Metered.ca OpenRelay TURN** (UDP/TCP/TLS on ports 80 & 443) for friends behind strict NATs, college Wi-Fi, or mobile hotspots.
- `VITE_YOUTUBE_PROXY_URL` — Optional custom Piped/Invidious relay override (defaults to persistent latency-ranked community relay failover).

### Optional Server-Side Room Layout & Clubhouse Tables (Supabase)

Room customizations (furniture, wall/floor themes, alcoves, screen transform, and lighting moods) as well as **Bar Games & Clubhouse** records (501/Cricket match wins, high checkouts, longest putting streaks, and `$1` prediction ledger balances) automatically persist per `roomCode` in every participant's `localStorage` and sync across peers via Realtime Broadcast with **zero SQL setup required**. If you also want cloud database persistence when all browsers clear storage, run this optional snippet in your Supabase SQL Editor:

```sql
create table if not exists public.room_layouts (
  room_code text primary key,
  layout_json jsonb not null,
  revision integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.room_layouts enable row level security;
create policy "Allow public room layout sync" on public.room_layouts
  for all to anon using (true) with check (true);

create table if not exists public.clubhouse_stats (
  room_code text primary key,
  clubhouse_json jsonb not null,
  revision integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.clubhouse_stats enable row level security;
create policy "Allow public clubhouse stats sync" on public.clubhouse_stats
  for all to anon using (true) with check (true);
```
