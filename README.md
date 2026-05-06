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
  → Validasi game terhadap blueprint spec
  → Inspect Babylon.js engine & scene
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

# Pakai scenario JSON (tidak perlu TypeScript)
npx tsx src/cli.ts run scenarios/example.json --url http://localhost:5173

# Mode watch — auto-run tiap kali file berubah (integrasi Replit workflow)
npx tsx src/cli.ts watch scenarios/forge-frenzy.ts --watch-dir src --watch-dir public

# Atau dengan opsi custom
npx tsx src/cli.ts run scenarios/forge-frenzy.ts --url http://localhost:5173 --headed
```

---

## Fitur Utama

### 1. Integrasi Replit Workflow — Auto-Run Test

Mode `watch` memantau direktori secara real-time. Setiap ada perubahan file, test langsung diulang otomatis:

```bash
ghostplay watch scenarios/my-game.ts --watch-dir src --watch-dir public --debounce 1000
```

Cocok dipasang sebagai Replit workflow terpisah — agent commit perubahan, test langsung jalan sendiri.

---

### 2. check-canvas-babylon — Inspector Babylon.js

Step baru untuk cek engine WebGL Babylon.js secara mendalam:

```typescript
{
  type: 'check-canvas-babylon',
  label: 'Babylon.js engine sehat',
  checks: {
    requireEngine:      true,    // BABYLON.Engine harus ada
    requireScene:       true,    // scene harus ada
    requireActiveCamera: true,   // harus ada kamera aktif
    minFps:             30,      // FPS minimal
    minMeshCount:       10,      // jumlah mesh minimal di scene
    customObjects:      ['game', 'playerController'],  // window.* yang harus ada
  }
}
```

GhostPlay juga otomatis cek pixel WebGL untuk memastikan canvas tidak blank/hitam.

---

### 3. Scenario JSON — Agent Generate Tanpa TypeScript

Agent bisa generate scenario langsung sebagai JSON, tidak perlu menulis TypeScript:

```json
{
  "name": "Nama Scenario",
  "url": "http://localhost:5173",
  "steps": [
    { "type": "wait-for",     "selector": "#main-menu", "timeout": 5000 },
    { "type": "tap-text",     "text": "MAIN SEKARANG" },
    { "type": "check-element","selector": "#hud-hp" },
    { "type": "check-canvas-babylon", "checks": { "minFps": 30 } },
    { "type": "check-no-errors" }
  ]
}
```

Jalankan langsung:
```bash
ghostplay run scenarios/my-game.json
```

---

### 4. check-blueprint — Solusi Agent Buat Game Tidak Sesuai Spec

Masalah: agent sering membuat game yang tidak sesuai dengan blueprint/desain asli — elemen UI salah ID, karakter hilang, minimap tidak ada, engine tidak di-expose ke window, dsb.

**Solusi:** Definisikan blueprint sekali di JSON, GhostPlay validasi otomatis setiap run:

```json
{
  "name": "Forge Frenzy Blueprint",
  "ui": {
    "elements": [
      { "selector": "#hud-hp",       "label": "HP bar",  "required": true },
      { "selector": "#minimap-canvas","label": "Minimap", "required": true }
    ]
  },
  "characters": [
    { "name": "BRIX", "selector": ".hero-brix", "hudHp": "#hud-hp-brix" }
  ],
  "babylon": {
    "checkEngine": true,
    "requireGlobals": ["engine", "scene", "game"]
  },
  "performance": { "minFps": 30 }
}
```

Tambahkan ke scenario:

```typescript
{ type: 'check-blueprint', blueprint: 'blueprints/forge-frenzy.blueprint.json', label: 'Validasi blueprint' }
// atau inline:
{ type: 'check-blueprint', blueprint: { name: '...', ui: { elements: [...] } } }
```

Output langsung memberi tahu agent apa yang salah dan cara memperbaikinya:

```
──────────────────────────────────────────────────────────
[Blueprint] Forge Frenzy — Full Blueprint

  UI Elements
  ✓ UI: HUD container utama
  ✓ UI: HP bar
  ✗ UI: Minimap
    ↳ "#minimap-canvas" tidak terlihat — elemen "Minimap" hilang atau selectornya salah

  Babylon.js Engine
  ✓ Babylon.js Engine berjalan
  ✗ window.game tersedia
    ↳ window.game tidak ditemukan — agent perlu expose object ini ke window

  Performance
  ⚠ FPS minimal 30
    ↳ FPS rata-rata 24, di bawah target 30 — optimasi rendering atau kurangi draw calls

──────────────────────────────────────────────────────────
  ✓ 4 sesuai blueprint   ✗ 2 tidak sesuai   ⚠ 1 peringatan

  GAME BELUM SESUAI BLUEPRINT — 2 item perlu diperbaiki
──────────────────────────────────────────────────────────
```

Agent baca output → langsung tahu persis apa yang perlu diperbaiki → fix → run lagi.

---

## Contoh Output Lengkap

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

---

## Semua Step yang Tersedia

| Step | Parameter | Fungsi |
|---|---|---|
| `wait` | `ms` | Tunggu sekian milidetik |
| `wait-for` | `selector`, `timeout` | Tunggu elemen muncul |
| `tap` | `selector` atau `x,y` | Tap elemen atau koordinat |
| `tap-text` | `text` | Cari dan tap elemen berdasarkan teks |
| `swipe` | `x1,y1,x2,y2`, `duration` | Swipe seperti joystick |
| `type` | `selector`, `text` | Ketik teks ke input |
| `key` | `key` | Tekan tombol keyboard |
| `scroll` | `x,y`, `selector` | Scroll halaman atau elemen |
| `check-element` | `selector`, `exists` | Verifikasi elemen ada/visible |
| `check-text` | `selector`, `contains` | Verifikasi teks elemen |
| `check-fps` | `min`, `duration` | Cek FPS minimal |
| `check-no-errors` | — | Pastikan tidak ada JS error |
| `check-canvas-babylon` | `checks` | Inspect Babylon.js engine & WebGL canvas |
| `check-blueprint` | `blueprint` | Validasi game terhadap blueprint spec |
| `screenshot` | `label` | Ambil screenshot |
| `log` | `message` | Tulis pesan ke log |

---

## Tulis Scenario Sendiri

```typescript
// scenarios/game-saya.ts
import { defineScenario } from '../src/index';

export default defineScenario({
  name: 'Game Saya — Basic Test',
  url:  'http://localhost:5173',
  steps: [
    { type: 'wait-for',          selector: '#main-menu', timeout: 5000, label: 'Menu muncul' },
    { type: 'tap-text',          text: 'MAIN SEKARANG', label: 'Mulai' },
    { type: 'wait',              ms: 2000 },
    { type: 'check-canvas-babylon', checks: { requireEngine: true, minFps: 30 }, label: 'Engine OK' },
    { type: 'check-blueprint',   blueprint: 'blueprints/game-saya.blueprint.json', label: 'Sesuai blueprint' },
    { type: 'check-no-errors',   label: 'Tidak ada error' },
    { type: 'screenshot',        label: 'final_state' },
  ],
});
```

---

## Kompatibel dengan Engine Apapun

GhostPlay tidak terikat ke Babylon.js, Three.js, atau engine tertentu. `check-canvas-babylon` hanyalah step opsional untuk project yang pakai Babylon.js. Selama game jalan di browser, GhostPlay bisa test.

---

© 2026 SPHERE-HQ
