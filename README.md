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

## Optional Cloud Upgrades (Vercel / Supabase / TURN)

This repository also includes [vercel.json](vercel.json) and [api/stream-proxy.js](api/stream-proxy.js) if you ever want to deploy on Vercel with the server-side `/api/stream-proxy` CORS helper:

- `VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY` — Dedicated Supabase Realtime Presence & Broadcast channels.
- `VITE_TURN_URL`, `VITE_TURN_USERNAME`, & `VITE_TURN_CREDENTIAL` — Optional TURN relay for friends behind strict NAT / 5G cellular routers.
