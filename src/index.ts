// src/index.ts
export { GhostPlay }         from './core/GhostPlay.js';
export { Reporter }          from './core/Reporter.js';
export { InputSimulator }    from './core/InputSimulator.js';
export { DOMChecker }        from './core/DOMChecker.js';
export { ErrorCollector }    from './core/ErrorCollector.js';
export { PerfMonitor }       from './core/PerfMonitor.js';
export { BabylonChecker }    from './core/BabylonChecker.js';
export { BlueprintChecker }  from './core/BlueprintChecker.js';
export { AssetChecker }      from './core/AssetChecker.js';
export { FileWatcher }       from './core/FileWatcher.js';

export type {
  GhostPlayConfig,
  Scenario,
  Step,
  StepResult,
  StepStatus,
  TestReport,
  CapturedError,
  Blueprint,
  BlueprintElement,
  BlueprintLandmark,
  BlueprintCharacter,
  BlueprintReport,
  BlueprintRequirement,
  BabylonChecks,
  BabylonReport,
  AssetsSpec,
  AssetModelSpec,
  AssetTextureSpec,
  AssetAudioSpec,
  AssetRequirement,
  AssetCheckReport,
} from './types.js';

// Helper: definisikan scenario dengan type-safety penuh
export function defineScenario(scenario: import('./types.js').Scenario): import('./types.js').Scenario {
  return scenario;
}

// Helper: definisikan blueprint dengan type-safety penuh
export function defineBlueprint(blueprint: import('./types.js').Blueprint): import('./types.js').Blueprint {
  return blueprint;
}

// Helper: definisikan asset spec dengan type-safety penuh
export function defineAssets(spec: import('./types.js').AssetsSpec): import('./types.js').AssetsSpec {
  return spec;
}
