// src/core/AssetChecker.ts
// Validasi asset file (model 3D, tekstur, audio) + silang-cek ke Babylon.js scene runtime

import { Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { Reporter } from './Reporter.js';
import type { AssetsSpec, AssetModelSpec, AssetCheckReport, AssetRequirement } from '../types.js';

// ─── GLTF / GLB Parser (tanpa dependensi eksternal) ─────────────────────────

interface GltfData {
  meshes?:     { name?: string; primitives?: { attributes?: Record<string, number>; indices?: number; material?: number }[] }[];
  animations?: { name?: string; channels?: unknown[]; samplers?: unknown[] }[];
  materials?:  { name?: string; pbrMetallicRoughness?: unknown; normalTexture?: unknown }[];
  nodes?:      { name?: string; mesh?: number; children?: number[]; skin?: number }[];
  skins?:      { name?: string; joints?: number[] }[];
  textures?:   { source?: number; sampler?: number }[];
  images?:     { uri?: string; mimeType?: string }[];
  accessors?:  { count?: number; componentType?: number; type?: string }[];
}

function parseGltf(filePath: string): GltfData | null {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.gltf') {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as GltfData;
  }

  if (ext === '.glb') {
    const buf = fs.readFileSync(filePath);
    // GLB header: magic(4) + version(4) + length(4) = 12 bytes
    const magic = buf.readUInt32LE(0);
    if (magic !== 0x46546C67) return null; // 'glTF'
    // Chunk 0: length(4) + type(4) + data
    const chunk0Len  = buf.readUInt32LE(12);
    const chunk0Type = buf.readUInt32LE(16);
    if (chunk0Type !== 0x4E4F534A) return null; // 'JSON'
    const jsonStr = buf.subarray(20, 20 + chunk0Len).toString('utf-8');
    return JSON.parse(jsonStr) as GltfData;
  }

  if (ext === '.obj') {
    // OBJ: parse mesh names dari baris 'g' dan 'o'
    const raw = fs.readFileSync(filePath, 'utf-8');
    const meshNames = raw.split('\n')
      .filter(l => l.startsWith('g ') || l.startsWith('o '))
      .map(l => l.slice(2).trim())
      .filter(Boolean);
    return { meshes: meshNames.map(name => ({ name })) };
  }

  return null;
}

function getPolyCount(gltf: GltfData): number {
  if (!gltf.accessors || !gltf.meshes) return 0;
  let total = 0;
  for (const mesh of gltf.meshes) {
    for (const prim of mesh.primitives ?? []) {
      if (prim.indices !== undefined && gltf.accessors[prim.indices]) {
        const count = gltf.accessors[prim.indices].count ?? 0;
        total += Math.floor(count / 3);
      }
    }
  }
  return total;
}

// ─── AssetChecker class ──────────────────────────────────────────────────────

export class AssetChecker {
  constructor(private page: Page, private reporter: Reporter) {}

  async validate(spec: AssetsSpec): Promise<AssetCheckReport> {
    const requirements: AssetRequirement[] = [];
    const rootDir = spec.rootDir ?? process.cwd();

    this.reporter.info(`Validasi asset dari: ${rootDir}`);

    // ── Model 3D ─────────────────────────────────────────────────────────────
    for (const model of spec.models ?? []) {
      const modelReqs = await this.validateModel(model, rootDir);
      requirements.push(...modelReqs);
    }

    // ── Tekstur ──────────────────────────────────────────────────────────────
    for (const tex of spec.textures ?? []) {
      requirements.push(await this.validateTexture(tex, rootDir));
    }

    // ── Audio ─────────────────────────────────────────────────────────────────
    for (const audio of spec.audio ?? []) {
      const absPath = path.resolve(rootDir, audio.file);
      const exists  = fs.existsSync(absPath);
      const size    = exists ? fs.statSync(absPath).size : 0;
      requirements.push({
        label:    `Audio: ${audio.label}`,
        category: 'audio',
        status:   exists ? 'pass' : 'fail',
        message:  exists
          ? `"${audio.file}" ditemukan (${(size / 1024).toFixed(1)} KB)`
          : `"${audio.file}" tidak ditemukan — file audio belum ada di project`,
        file:     audio.file,
      });
    }

    // ── Cek runtime scene Babylon.js (jika ada model dengan inScene: true) ──
    const sceneModels = spec.models?.filter(m => m.inScene) ?? [];
    if (sceneModels.length > 0) {
      const sceneReqs = await this.validateSceneAssets(sceneModels);
      requirements.push(...sceneReqs);
    }

    const passed = requirements.filter(r => r.status === 'pass').length;
    const failed = requirements.filter(r => r.status === 'fail').length;
    const warned = requirements.filter(r => r.status === 'warn').length;

    this.printAssetReport(requirements);
    return { passed, failed, warned, requirements };
  }

  private async validateModel(model: AssetModelSpec, rootDir: string): Promise<AssetRequirement[]> {
    const reqs: AssetRequirement[] = [];
    const absPath = path.resolve(rootDir, model.file);
    const exists  = fs.existsSync(absPath);

    // 1. Cek file ada
    if (!exists) {
      reqs.push({
        label:    `Model: ${model.label}`,
        category: 'model',
        status:   'fail',
        message:  `"${model.file}" tidak ditemukan — file model belum di-export atau path salah`,
        file:     model.file,
      });
      return reqs; // tidak bisa lanjut parsing kalau file tidak ada
    }

    const stat = fs.statSync(absPath);
    const sizeKB = (stat.size / 1024).toFixed(1);

    reqs.push({
      label:    `Model: ${model.label} (file ada)`,
      category: 'model',
      status:   'pass',
      message:  `"${model.file}" ditemukan (${sizeKB} KB)`,
      file:     model.file,
    });

    // 2. Parse GLTF/GLB
    let gltf: GltfData | null = null;
    const ext = path.extname(model.file).toLowerCase();
    if (['.gltf', '.glb', '.obj'].includes(ext)) {
      try {
        gltf = parseGltf(absPath);
      } catch (err: any) {
        reqs.push({
          label:    `Model: ${model.label} (parse)`,
          category: 'model',
          status:   'fail',
          message:  `Gagal parse file: ${err.message} — file mungkin corrupt atau bukan format GLTF/GLB valid`,
          file:     model.file,
        });
        return reqs;
      }
    }

    if (!gltf) return reqs;

    // 3. Cek mesh yang diharapkan
    const actualMeshes = (gltf.meshes ?? []).map(m => m.name ?? '(unnamed)');
    if (model.expectedMeshes && model.expectedMeshes.length > 0) {
      for (const expectedMesh of model.expectedMeshes) {
        const found = actualMeshes.some(n =>
          n.toLowerCase() === expectedMesh.toLowerCase() ||
          n.toLowerCase().includes(expectedMesh.toLowerCase())
        );
        reqs.push({
          label:    `Model ${model.label}: mesh "${expectedMesh}"`,
          category: 'model',
          status:   found ? 'pass' : 'fail',
          message:  found
            ? `Mesh "${expectedMesh}" ditemukan di file ✓`
            : `Mesh "${expectedMesh}" tidak ada di file. Mesh yang tersedia: [${actualMeshes.slice(0, 6).join(', ')}${actualMeshes.length > 6 ? ', ...' : ''}] — cek nama mesh di Blender/editor`,
          file:     model.file,
        });
      }
    } else if (actualMeshes.length > 0) {
      // Info saja kalau tidak ada expected meshes
      reqs.push({
        label:    `Model ${model.label}: daftar mesh`,
        category: 'model',
        status:   'pass',
        message:  `${actualMeshes.length} mesh ditemukan: [${actualMeshes.slice(0, 5).join(', ')}${actualMeshes.length > 5 ? ', ...' : ''}]`,
        file:     model.file,
      });
    }

    // 4. Cek animasi
    const actualAnims = (gltf.animations ?? []).map(a => a.name ?? '(unnamed)');
    if (model.expectedAnimations && model.expectedAnimations.length > 0) {
      for (const expectedAnim of model.expectedAnimations) {
        const found = actualAnims.some(n =>
          n.toLowerCase() === expectedAnim.toLowerCase() ||
          n.toLowerCase().includes(expectedAnim.toLowerCase())
        );
        reqs.push({
          label:    `Model ${model.label}: animasi "${expectedAnim}"`,
          category: 'model',
          status:   found ? 'pass' : 'fail',
          message:  found
            ? `Animasi "${expectedAnim}" ditemukan ✓`
            : `Animasi "${expectedAnim}" tidak ada. Animasi yang tersedia: [${actualAnims.slice(0, 5).join(', ')}${actualAnims.length > 5 ? ', ...' : ''}] — export animasi dari Blender/editor`,
          file:     model.file,
        });
      }
    } else if (model.expectedAnimations !== undefined && actualAnims.length === 0) {
      reqs.push({
        label:    `Model ${model.label}: animasi`,
        category: 'model',
        status:   'warn',
        message:  `Tidak ada animasi di file. Jika karakter ini bergerak, pastikan animasi di-export`,
        file:     model.file,
      });
    }

    // 5. Cek material
    const actualMats = (gltf.materials ?? []).map(m => m.name ?? '(unnamed)');
    if (model.expectedMaterials && model.expectedMaterials.length > 0) {
      for (const expectedMat of model.expectedMaterials) {
        const found = actualMats.some(n =>
          n.toLowerCase() === expectedMat.toLowerCase() ||
          n.toLowerCase().includes(expectedMat.toLowerCase())
        );
        reqs.push({
          label:    `Model ${model.label}: material "${expectedMat}"`,
          category: 'model',
          status:   found ? 'pass' : 'fail',
          message:  found
            ? `Material "${expectedMat}" ditemukan ✓`
            : `Material "${expectedMat}" tidak ada. Material tersedia: [${actualMats.slice(0, 5).join(', ')}] — cek nama material di Blender`,
          file:     model.file,
        });
      }
    }

    // 6. Cek poly count minimum
    if (model.minPolyCount !== undefined) {
      const polyCount = getPolyCount(gltf);
      const ok = polyCount >= model.minPolyCount;
      reqs.push({
        label:    `Model ${model.label}: polygon count`,
        category: 'model',
        status:   ok ? 'pass' : 'warn',
        message:  ok
          ? `${polyCount.toLocaleString()} polygon ✓`
          : `Hanya ${polyCount.toLocaleString()} polygon, minimal ${model.minPolyCount.toLocaleString()} — model mungkin terlalu low-poly atau belum di-subdivide`,
        file:     model.file,
      });
    }

    // 7. Cek rig/skeleton
    if (model.requireRig) {
      const hasSkin = (gltf.skins ?? []).length > 0;
      reqs.push({
        label:    `Model ${model.label}: rig/skeleton`,
        category: 'model',
        status:   hasSkin ? 'pass' : 'fail',
        message:  hasSkin
          ? `Skeleton ditemukan (${gltf.skins![0].joints?.length ?? 0} bone) ✓`
          : `Tidak ada skeleton/rig — karakter ini butuh rig untuk animasi. Export dengan armature dari Blender`,
        file:     model.file,
      });
    }

    return reqs;
  }

  private async validateTexture(
    tex: { file: string; label: string; minWidth?: number; minHeight?: number; inScene?: boolean },
    rootDir: string,
  ): Promise<AssetRequirement> {
    const absPath = path.resolve(rootDir, tex.file);
    const exists  = fs.existsSync(absPath);

    if (!exists) {
      return {
        label:    `Tekstur: ${tex.label}`,
        category: 'texture',
        status:   'fail',
        message:  `"${tex.file}" tidak ditemukan — file tekstur belum ada di project`,
        file:     tex.file,
      };
    }

    const stat   = fs.statSync(absPath);
    const sizeKB = (stat.size / 1024).toFixed(1);

    // Untuk PNG/JPG, bisa cek dimensi via header bytes
    let dimInfo = '';
    try {
      const ext = path.extname(tex.file).toLowerCase();
      const buf = fs.readFileSync(absPath);
      if (ext === '.png' && buf[0] === 0x89 && buf[1] === 0x50) {
        const w = buf.readUInt32BE(16);
        const h = buf.readUInt32BE(20);
        dimInfo = ` ${w}x${h}px`;
        if (tex.minWidth && w < tex.minWidth) {
          return {
            label:    `Tekstur: ${tex.label}`,
            category: 'texture',
            status:   'warn',
            message:  `"${tex.file}" ${w}x${h}px — lebar minimal ${tex.minWidth}px. Gunakan tekstur resolusi lebih tinggi`,
            file:     tex.file,
          };
        }
      } else if ((ext === '.jpg' || ext === '.jpeg') && buf[0] === 0xFF && buf[1] === 0xD8) {
        // JPEG: cari SOF marker untuk dimensi
        for (let i = 2; i < Math.min(buf.length - 9, 65536); i++) {
          if (buf[i] === 0xFF && (buf[i + 1] === 0xC0 || buf[i + 1] === 0xC2)) {
            const h = buf.readUInt16BE(i + 5);
            const w = buf.readUInt16BE(i + 7);
            dimInfo = ` ${w}x${h}px`;
            break;
          }
        }
      }
    } catch { /* dimensi tidak kritis */ }

    return {
      label:    `Tekstur: ${tex.label}`,
      category: 'texture',
      status:   'pass',
      message:  `"${tex.file}"${dimInfo} (${sizeKB} KB) ✓`,
      file:     tex.file,
    };
  }

  // Silang-cek model dengan Babylon.js scene yang sedang berjalan
  private async validateSceneAssets(models: AssetModelSpec[]): Promise<AssetRequirement[]> {
    const reqs: AssetRequirement[] = [];

    // Ambil semua mesh name yang ada di scene sekarang
    const sceneMeshNames = await this.page.evaluate(() => {
      const win = window as any;
      const engine =
        win.BABYLON?.Engine?.Instances?.[0] ??
        win.engine ?? win._engine ?? null;
      const scene =
        engine?.scenes?.[0] ??
        win.scene ?? win._scene ?? null;

      if (!scene) return { meshes: [], textures: [], ok: false };

      return {
        ok: true,
        meshes:   (scene.meshes   ?? []).map((m: any) => m.name as string),
        textures: (scene.textures ?? []).map((t: any) => (t.name ?? t.url ?? '') as string),
        animGroups: (scene.animationGroups ?? []).map((a: any) => a.name as string),
      };
    });

    if (!sceneMeshNames.ok) {
      reqs.push({
        label:    'Scene runtime: Babylon.js scene belum aktif',
        category: 'scene',
        status:   'warn',
        message:  'Tidak bisa cek scene — jalankan check-assets setelah game sudah load penuh',
      });
      return reqs;
    }

    for (const model of models) {
      const pattern = model.sceneNamePattern ?? path.basename(model.file, path.extname(model.file));
      const patternLower = pattern.toLowerCase().replace(/\*/g, '');

      const found = sceneMeshNames.meshes.some((name: string) =>
        name.toLowerCase().includes(patternLower)
      );

      reqs.push({
        label:    `Scene: "${model.label}" ter-load`,
        category: 'scene',
        status:   found ? 'pass' : 'fail',
        message:  found
          ? `Asset "${model.label}" ditemukan di scene (pattern: "${pattern}") ✓`
          : `Asset "${model.label}" TIDAK ter-load di scene. Pattern dicari: "${pattern}". Mesh di scene: [${sceneMeshNames.meshes.slice(0, 6).join(', ')}${sceneMeshNames.meshes.length > 6 ? ', ...' : ''}] — pastikan SceneLoader.ImportMesh dipanggil dengan path yang benar`,
        file:     model.file,
      });

      // Cek animasi di runtime
      if (model.expectedAnimations && model.expectedAnimations.length > 0 && sceneMeshNames.animGroups) {
        for (const anim of model.expectedAnimations) {
          const animFound = sceneMeshNames.animGroups.some((n: string) =>
            n.toLowerCase().includes(anim.toLowerCase())
          );
          reqs.push({
            label:    `Scene: "${model.label}" animasi "${anim}"`,
            category: 'scene',
            status:   animFound ? 'pass' : 'warn',
            message:  animFound
              ? `AnimationGroup "${anim}" aktif di scene ✓`
              : `AnimationGroup "${anim}" tidak ditemukan di scene. Pastikan animasi di-start setelah load`,
            file:     model.file,
          });
        }
      }
    }

    return reqs;
  }

  private printAssetReport(reqs: AssetRequirement[]): void {
    const C = {
      reset: '\x1b[0m', bold: '\x1b[1m',
      green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
      cyan: '\x1b[36m', blue: '\x1b[34m', gray: '\x1b[90m',
    };
    const line = `${C.gray}${'─'.repeat(60)}${C.reset}`;

    console.log(line);
    console.log(`${C.bold}${C.blue}[AssetCheck] Validasi Asset File & Scene${C.reset}`);
    console.log(line);

    const grouped: Record<string, AssetRequirement[]> = {};
    for (const r of reqs) {
      (grouped[r.category] ??= []).push(r);
    }

    const catLabel: Record<string, string> = {
      model:   '3D Model',
      texture: 'Tekstur',
      audio:   'Audio',
      scene:   'Scene Runtime (Babylon.js)',
    };

    for (const [cat, items] of Object.entries(grouped)) {
      console.log(`\n${C.bold}  ${catLabel[cat] ?? cat}${C.reset}`);
      for (const req of items) {
        const icon =
          req.status === 'pass' ? `${C.green}✓${C.reset}` :
          req.status === 'warn' ? `${C.yellow}⚠${C.reset}` :
                                  `${C.red}✗${C.reset}`;
        console.log(`  ${icon} ${req.label}`);
        if (req.status !== 'pass') {
          console.log(`    ${C.gray}↳ ${req.message}${C.reset}`);
        }
      }
    }

    const passed = reqs.filter(r => r.status === 'pass').length;
    const failed = reqs.filter(r => r.status === 'fail').length;
    const warned = reqs.filter(r => r.status === 'warn').length;

    console.log(`\n${line}`);
    console.log(`  ${C.green}✓ ${passed} sesuai${C.reset}  ${C.red}✗ ${failed} tidak sesuai${C.reset}  ${C.yellow}⚠ ${warned} peringatan${C.reset}`);
    if (failed > 0) {
      console.log(`\n  ${C.bold}${C.red}ASSET TIDAK LENGKAP — ${failed} item perlu diperbaiki${C.reset}`);
    } else if (warned > 0) {
      console.log(`\n  ${C.bold}${C.yellow}ASSET LENGKAP (ada ${warned} peringatan)${C.reset}`);
    } else {
      console.log(`\n  ${C.bold}${C.green}SEMUA ASSET SESUAI SPEC ✓${C.reset}`);
    }
    console.log(line);
  }
}
