# VR Lounge — Multi-User WebXR Virtual Watch Party

**VR Lounge** is a multi-user WebXR virtual cinema and watch-party application built with **React 19**, **TypeScript**, **Vite (HTTPS)**, **Tailwind CSS v4**, **Three.js**, **`@react-three/fiber` v9**, **`@react-three/drei` v10**, **`@react-three/xr` v6**, **Supabase Realtime**, and **WebRTC**.

Friends can join a shared 3D screening room from **Meta Quest 3** headsets or **desktop browsers**, inhabit tracked 6DoF 3D avatars with **spatial voice chat**, exchange live 3D text chat & floating emoji reactions, and share control of a curved 16:9 cinema screen.

---

## Quick Start

### 1. Install & Launch the HTTPS Dev Server

```bash
npm install
npm run dev
```

Vite starts with `@vitejs/plugin-basic-ssl` and `--host` enabled on port `5173`, printing both local and LAN HTTPS URLs:

```text
  ➜  Local:   https://localhost:5173/
  ➜  Network: https://192.168.x.x:5173/
```

> **Zero-Config Local Mode:** If `.env` is not configured yet, VR Lounge automatically runs in **Local Multi-Tab Broadcast Mode** (`BroadcastChannel` + `localStorage` presence + loopback WebRTC). Open two or more tabs at `https://localhost:5173` with the same Room Code to test multi-user avatars, presenter handoff, chat, and live tab sharing immediately.

---

### 2. Connect Across Devices & Meta Quest 3 Headsets (Supabase Realtime)

To connect standalone **Meta Quest 3** headsets and remote friends across networks:

1. Create a free project at [supabase.com](https://supabase.com) (no SQL tables are required — VR Lounge uses ephemeral Supabase Realtime **Presence** and **Broadcast** channels).
2. Copy `.env.example` to `.env` and fill in your project URL and anon key:
   ```bash
   cp .env.example .env
   ```
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-public-anon-key
   ```
3. Restart `npm run dev`.
4. Ensure your Meta Quest 3 is on the same Wi-Fi network as your dev machine (or deploy the `npm run build` output to any HTTPS host such as Vercel/Cloudflare Pages):
   - Open **Meta Quest Browser** on your headset and navigate to `https://<YOUR-LAN-IP>:5173`.
   - Accept the local self-signed development certificate prompt (*Advanced → Proceed*).
   - Enter your display name and the shared **Room Code**, then tap **Enter VR (Quest 3 / WebXR)**.

---

## Watch-Party Screen Modes & "Take Control" Handoff

Any participant in the room can click **Take Control** on either the **3D Spatial Control Dock** (in VR or desktop) or the **2D Companion Bar** (unless the room host enables **Lock Presenter**):

1. **Mode 1 — Live Browser Tab Stream (`Share Browser Tab`):**
   - Ideal for **Netflix, YouTube, Twitch, slides, or any website**.
   - Join the room from a desktop browser in **Companion Presenter Mode**, click **Take Control**, and click **Share Browser Tab** (be sure to check *"Also share tab audio"* in the browser prompt).
   - Video (30fps) and stereo tab audio stream peer-to-peer via WebRTC onto the curved `THREE.VideoTexture` cinema screen for everyone in VR and desktop.
2. **Mode 2 — Synchronized Direct / HLS Stream Player (`URL / Streams`):**
   - Ideal for **standalone headset control** without needing a PC presenter.
   - Paste any `.mp4` or `.m3u8` HLS URL (using the **3D In-VR Virtual Keyboard** or 2D drawer) or choose one of the built-in cinema reference streams.
   - Play, pause, and timeline scrubbing stay synchronized across all viewers with automatic `> 0.5s` drift correction and an integrated `/api/stream-proxy` CORS helper.

---

## Project Structure

- `src/services/realtime.ts` — Supabase Realtime (Presence + 20Hz pose broadcast + WebRTC signaling) with automatic `BroadcastChannel` fallback.
- `src/hooks/useRoomSession.ts` — Room roster, automatic seat assignment (`A1`–`B4`), Presenter State Machine, host lock, chat, and reactions.
- `src/hooks/useWebRTC.ts` — Perfect-negotiation `RTCPeerConnection` mesh separating spatial voice tracks from `getDisplayMedia` tab video/audio streams.
- `src/hooks/useMediaScreen.ts` — Offscreen HTML5 `<video>`, `hls.js` integration, CORS stream proxy fallback, playback drift sync, and `THREE.VideoTexture` (`SRGBColorSpace`).
- `src/components/xr/CinemaRoom.tsx` — Low-poly dark cinema lounge, curved 16:9 screen, reactive screen bounce light, and 8 interactive theater seats.
- `src/components/xr/AvatarManager.tsx` — 20Hz local 6DoF head/controller/hand capture, remote `lerp`/`slerp` interpolation, `AnalyserNode` speaking rings, and `THREE.PositionalAudio`.
- `src/components/xr/SpatialControlDock.tsx` — Floating 3D console operable via Quest controller rays, hand poke, and desktop mouse clicks.
- `src/components/xr/SpatialChatPanel.tsx` & `src/components/xr/VRKeyboard3D.tsx` — Toggleable 3D chat wall, rising 3D emoji particles, and in-VR QWERTY/URL keyboard.
- `src/components/ui/CompanionOverlay.tsx` — 2D Pre-Join Lobby and In-Room Companion Presenter HUD.
