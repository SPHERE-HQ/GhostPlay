# GhostPlay

Test runner game untuk AI agent — simulate input, cek UI/HUD/canvas, monitor error JS & FPS, tanpa perlu manusia megang HP.

Dirancang supaya agent bisa **testing game sendiri** dan **debug sendiri**, bukan menunggu user download APK lalu lapor manual.

---

## Cara Kerja

```
Agent tulis scenario → GhostPlay buka game di browser headless
  → Simulate tap/swipe/input seperti pemain sungguhan
  → Monitor error JS real-time
  → Cek elemen HUD/UI ada dan visible
  → Ukur FPS
  → Screenshot tiap fase
  → Keluarkan log yang agent bisa baca & langsung perbaiki
```

---

## Install

```bash
npm install
npx playwright install chromium
```

---

## Jalankan Test

```bash
# Test Forge Frenzy (game harus jalan di localhost:5173 dulu)
npm run run:ff

# Atau dengan opsi:
npx tsx src/cli.ts run scenarios/forge-frenzy.ts --url http://localhost:5173 --headed
```

---

## Contoh Output

```
────────────────────────────────────────────────────────────
[GhostPlay] Forge Frenzy — Full Flow Test
  URL: http://localhost:5173
  Viewport: 390x844
────────────────────────────────────────────────────────────
[00:01.234] ℹ Halaman dimuat: http://localhost:5173
[00:01.300] ✓ Boot overlay muncul (45ms)
[00:02.800] ✓ Boot overlay hilang (1500ms)
[00:03.100] ✓ Input nickname muncul (280ms)
[00:03.500] ✓ Ketik nickname (380ms)
[00:03.600] ✓ Tap tombol LANJUT (90ms)
[00:04.200] ✓ Pilih hero BRIX (120ms)
[00:07.800] ✓ Canvas WebGL ada (30ms)
[00:07.810] ✓ HUD container ada (12ms)
[00:07.820] ✓ HP bar ada (8ms)
[00:07.830] ✓ Ammo display ada (9ms)
[00:07.840] ✗ Minimap canvas ada   ← elemen #minimap-canvas tidak ditemukan
[00:09.900] ⚠ FPS rata-rata 24 (min 18) — batas minimal 30
[00:10.100] ✗ Tidak ada JS error
         BotAI.ts:47 — Cannot read properties of undefined (reading 'pos')
         at BotAISystem.updateBot (BotAI.ts:47:18)
────────────────────────────────────────────────────────────
Results:
  ✓ Passed   11
  ⚠ Warned   1
  ✗ Failed   2
  ⏱ Total    10234ms
────────────────────────────────────────────────────────────
  ADA 2 TEST GAGAL ✗
```

Agent baca output ini → langsung tahu: minimap ID salah, ada crash di BotAI.ts baris 47, FPS kurang → perbaiki → run lagi.

---

## Tulis Scenario Sendiri

```typescript
// scenarios/game-saya.ts
import { defineScenario } from '../src/index';

export default defineScenario({
  name: 'Game Saya — Basic Test',
  url:  'http://localhost:5173',
  steps: [

    // Tunggu loading selesai
    { type: 'wait-for', selector: '#main-menu', timeout: 5000, label: 'Menu utama muncul' },
    { type: 'screenshot', label: '01_main_menu' },

    // Tap tombol mulai
    { type: 'tap-text', text: 'MAIN SEKARANG', label: 'Mulai game' },
    { type: 'wait', ms: 2000 },

    // Cek elemen UI
    { type: 'check-element', selector: '#hud-hp',   label: 'HP bar ada' },
    { type: 'check-element', selector: '#hud-ammo', label: 'Ammo ada' },
    { type: 'check-element', selector: 'canvas',    label: 'Canvas ada' },

    // Gerak dengan swipe
    { type: 'swipe', x1: 80, y1: 600, x2: 80, y2: 500, duration: 500, label: 'Maju' },

    // Cek performa
    { type: 'check-fps', min: 30, duration: 2000, label: 'FPS cukup' },

    // Pastikan tidak ada crash
    { type: 'check-no-errors', label: 'Tidak ada JS error' },
    { type: 'screenshot', label: '02_gameplay' },
  ],
});
```

---

## Step yang Tersedia

| Step | Parameter | Fungsi |
|---|---|---|
| `wait` | `ms` | Tunggu sekian milidetik |
| `wait-for` | `selector`, `timeout` | Tunggu elemen muncul |
| `tap` | `selector` atau `x,y` | Tap elemen atau koordinat |
| `tap-text` | `text` | Cari dan tap elemen berdasarkan teks |
| `swipe` | `x1,y1,x2,y2`, `duration` | Swipe seperti joystick |
| `type` | `selector`, `text` | Ketik teks ke input |
| `key` | `key` | Tekan tombol keyboard |
| `check-element` | `selector`, `exists` | Verifikasi elemen ada/visible |
| `check-text` | `selector`, `contains` | Verifikasi teks elemen |
| `check-fps` | `min`, `duration` | Cek FPS minimal |
| `check-no-errors` | — | Pastikan tidak ada JS error |
| `screenshot` | `label` | Ambil screenshot |
| `log` | `message` | Tulis pesan ke log |

---

## Kompatibel dengan Engine Apapun

GhostPlay tidak terikat ke Babylon.js, Three.js, atau engine tertentu. Selama game jalan di browser, GhostPlay bisa test.

---

© 2026 SPHERE-HQ
