# GhostPlay

Test runner game untuk AI agent — simulate input, cek UI/HUD/canvas, monitor error JS & FPS, validasi blueprint, inspect Babylon.js, dan verifikasi asset file 3D/tekstur/audio.

Dirancang supaya agent bisa **testing game sendiri** dan **debug sendiri**, bukan menunggu user download APK lalu lapor manual.

---

## Cara Kerja

```
Developer berikan:
  ├── blueprint.json   → spec UI, karakter, map, engine, performa
  └── asset files      → model 3D (GLB/GLTF/OBJ), tekstur (PNG/JPG), audio (MP3)

Agent tulis scenario → GhostPlay buka game di browser headless
  → Validasi asset file (ada? kontennya benar? mesh/animasi sesuai?)
  → Simulate tap/swipe/input seperti pemain sungguhan
  → Monitor error JS real-time
  → Cek elemen HUD/UI ada dan visible
  → Inspect Babylon.js engine (FPS, mesh count, draw calls, WebGL pixels)
  → Validasi game terhadap blueprint spec
  → Silang-cek asset yang ter-load di scene runtime
  → Ukur FPS
  → Screenshot tiap fase
  → Keluarkan laporan lengkap: apa yang salah dan cara memperbaikinya
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

# Mode watch — auto-run tiap kali file berubah (integrasi Replit workflow)
npm run watch:ff

# Pakai scenario JSON (agent generate tanpa TypeScript)
npx tsx src/cli.ts run scenarios/example.json --url http://localhost:5173

# Custom
npx tsx src/cli.ts run scenarios/forge-frenzy.ts --url http://localhost:5173 --headed
npx tsx src/cli.ts watch scenarios/forge-frenzy.ts --watch-dir src --watch-dir public
```

---

## Fitur Lengkap

### 1. `check-assets` — Validasi Asset File + Scene Runtime

Ini inti dari "agent buat game tapi asset salah/hilang". GhostPlay tidak hanya cek blueprint UI, tapi juga baca langsung file model 3D, tekstur, dan audio — lalu silang-cek ke Babylon.js scene yang sedang berjalan.

**Yang dicek per model GLB/GLTF:**
- File ada dan bisa di-parse
- Nama mesh sesuai (misal "Brix_Body", "Brix_Head")
- Nama animasi sesuai (misal "idle", "run", "attack")
- Nama material sesuai
- Ada rig/skeleton (wajib untuk karakter beranimasi)
- Polygon count minimal
- Ter-load di Babylon.js scene runtime (nama mesh muncul di `scene.meshes`)
- AnimationGroup aktif di scene runtime

**Yang dicek per tekstur PNG/JPG:**
- File ada
- Dimensi minimal (misal minimal 512x512)

**Yang dicek per audio:**
- File ada dan ukurannya wajar

**Contoh output:**

```
──────────────────────────────────────────────────────────
[AssetCheck] Validasi Asset File & Scene

  3D Model
  ✓ Model: Karakter BRIX (file ada)
  ✓ Model BRIX: mesh "Brix_Body"
  ✓ Model BRIX: mesh "Brix_Head"
  ✗ Model BRIX: mesh "Brix_Gun"
    ↳ Mesh "Brix_Gun" tidak ada di file. Mesh tersedia: [Brix_Body, Brix_Head, Weapon, ...]
      — cek nama mesh di Blender/editor, mungkin namanya "Weapon" bukan "Brix_Gun"
  ✓ Model BRIX: animasi "idle"
  ✗ Model BRIX: animasi "death"
    ↳ Animasi "death" tidak ada. Animasi tersedia: [idle, run, attack]
      — export animasi death dari Blender, atau rename yang sudah ada
  ✗ Model: Map Forge Frenzy (file ada)
    ↳ "public/models/map_forge.glb" tidak ditemukan — file model belum di-export atau path salah

  Scene Runtime (Babylon.js)
  ✓ Scene: "Karakter BRIX" ter-load
  ✗ Scene: "Map Forge Frenzy" ter-load
    ↳ Asset "Map Forge Frenzy" TIDAK ter-load di scene. Pattern: "ground".
      Mesh di scene: [skybox, Brix_Body, Brix_Head, ...]
      — pastikan SceneLoader.ImportMesh dipanggil dengan path yang benar

  Tekstur
  ✓ Tekstur: BRIX (diffuse) — 1024x1024px (512.0 KB)
  ✗ Tekstur: Tekstur tanah map
    ↳ "public/textures/map_ground.jpg" tidak ditemukan

  Audio
  ✓ Audio: BGM Forge Frenzy (245.3 KB)
  ✗ Audio: SFX reload
    ↳ "public/audio/sfx_reload.mp3" tidak ditemukan

──────────────────────────────────────────────────────────
  ✓ 8 sesuai  ✗ 4 tidak sesuai  ⚠ 0 peringatan
  ASSET TIDAK LENGKAP — 4 item perlu diperbaiki
──────────────────────────────────────────────────────────
```

Agent baca output → langsung tahu: mesh mana yang namanya beda, animasi mana yang belum di-export, file mana yang belum ada → perbaiki → run lagi.

---

### 2. `check-blueprint` — Validasi UI & Engine vs Spec

```typescript
{ type: 'check-blueprint', blueprint: 'blueprints/forge-frenzy.blueprint.json' }
```

Validasi elemen UI, karakter, map landmark, Babylon.js globals, dan performa terhadap blueprint spec.

---

### 3. `check-canvas-babylon` — Inspector Babylon.js Engine

```typescript
{
  type: 'check-canvas-babylon',
  checks: {
    requireEngine:       true,
    requireScene:        true,
    requireActiveCamera: true,
    minFps:              30,
    minMeshCount:        10,
    customObjects:       ['game', 'playerController'],
  }
}
```

Baca langsung dari `BABYLON.Engine` dan `scene`: FPS, mesh count, draw calls, activeCamera, apakah engine sudah disposed, serta verifikasi pixel WebGL (deteksi canvas blank).

---

### 4. Watch Mode — Integrasi Replit Workflow

```bash
ghostplay watch scenarios/forge-frenzy.ts --watch-dir src --watch-dir public
```

Pantau direktori secara real-time. Setiap file berubah → test otomatis jalan ulang. Pasang sebagai workflow terpisah di Replit.

---

### 5. JSON Scenario — Agent Generate Langsung

```json
{
  "name": "My Game Test",
  "url":  "http://localhost:5173",
  "steps": [
    { "type": "wait-for",      "selector": "#main-menu", "timeout": 5000 },
    { "type": "check-assets",  "assets": "blueprints/my-game.blueprint.json" },
    { "type": "check-canvas-babylon", "checks": { "minFps": 30 } },
    { "type": "check-blueprint","blueprint": "blueprints/my-game.blueprint.json" },
    { "type": "check-no-errors" }
  ]
}
```

---

## Format Blueprint + Asset Spec

```json
{
  "name": "My Game Blueprint",
  "ui": {
    "elements": [
      { "selector": "#hud-hp",  "label": "HP bar",  "required": true },
      { "selector": "#minimap", "label": "Minimap", "required": true }
    ]
  },
  "babylon": {
    "checkEngine": true,
    "requireGlobals": ["engine", "scene", "game"]
  },
  "performance": { "minFps": 30 },
  "assets": {
    "rootDir": ".",
    "models": [
      {
        "file":               "public/models/hero.glb",
        "label":              "Hero Character",
        "expectedMeshes":     ["Hero_Body", "Hero_Head"],
        "expectedAnimations": ["idle", "run", "attack"],
        "requireRig":         true,
        "minPolyCount":       5000,
        "inScene":            true,
        "sceneNamePattern":   "hero"
      }
    ],
    "textures": [
      { "file": "public/textures/hero_diffuse.png", "label": "Hero texture", "minWidth": 512 }
    ],
    "audio": [
      { "file": "public/audio/bgm.mp3", "label": "Background music" }
    ]
  }
}
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
| `check-assets` | `assets` | Validasi asset file 3D/tekstur/audio + scene runtime |
| `screenshot` | `label` | Ambil screenshot |
| `log` | `message` | Tulis pesan ke log |

---

## Struktur File

```
GhostPlay/
├── src/
│   ├── core/
│   │   ├── GhostPlay.ts         # Orkestrasi utama
│   │   ├── AssetChecker.ts      # Validasi asset file + GLB/GLTF parser
│   │   ├── BabylonChecker.ts    # Inspector Babylon.js engine & WebGL
│   │   ├── BlueprintChecker.ts  # Validasi game vs blueprint spec
│   │   ├── FileWatcher.ts       # Watch mode (Replit workflow integration)
│   │   ├── InputSimulator.ts    # Simulasi tap/swipe/type/key
│   │   ├── DOMChecker.ts        # Cek elemen DOM
│   │   ├── ErrorCollector.ts    # Tangkap JS error real-time
│   │   ├── PerfMonitor.ts       # Monitor FPS via rAF
│   │   └── Reporter.ts          # Format output terminal
│   ├── cli.ts                   # CLI entrypoint (run + watch command)
│   ├── index.ts                 # Public exports
│   └── types.ts                 # Semua type definitions
├── scenarios/
│   ├── forge-frenzy.ts          # Scenario lengkap Forge Frenzy
│   └── example.json             # Contoh scenario JSON
└── blueprints/
    └── forge-frenzy.blueprint.json  # Blueprint + asset spec Forge Frenzy
```

---

## Kompatibel dengan Engine Apapun

GhostPlay tidak terikat ke Babylon.js, Three.js, atau engine tertentu. `check-canvas-babylon` hanyalah step opsional untuk project Babylon.js. `check-assets` bekerja untuk format GLB/GLTF/OBJ apapun. Selama game jalan di browser, GhostPlay bisa test.

---

© 2026 SPHERE-HQ
