/**
 * device-inspector.ts
 * 
 * A comprehensive device metrics inspector following the practical hybrid approach:
 *   1. UA string parsing (device-detector-js) → brand, model, browser, OS, bot detection
 *   2. Runtime WebGL/WebGPU queries         → GPU identity, texture limits, extension support
 *   3. Screen APIs                          → physical/CSS/viewport dimensions, DPR, orientation
 *   4. Platform APIs                        → memory, CPU cores, network, notch detection
 * 
 * Install dependencies:
 *   npm install device-detector-js
 *   npm install --save-dev @types/node typescript
 * 
 * This module exports a single async function: inspectDevice()
 * It is designed to run in a browser environment.
 */

import DeviceDetector from "node-device-detector";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type BotInfo = {
  detected: boolean;
  name: string | null;
  category: string | null;
  url: string | null;
  producerName: string | null;
};

export interface UAMetrics {
  raw: string;
  client: {
    type: string | null;
    name: string | null;
    version: string | null;
    engine: string | null;
    engineVersion: string | null;
  };
  os: {
    name: string | null;
    version: string | null;
    platform: string | null;
  };
  device: {
    type: string | null;
    brand: string | null;
    model: string | null;
  };
  bot: BotInfo;
  inAppBrowser: boolean;
}

export interface GPUMetrics {
  webglVersion: 1 | 2 | null;
  vendor: string | null;
  renderer: string | null;
  unmaskedVendor: string | null;
  unmaskedRenderer: string | null;
  gpuTier: string | null; // inferred human-readable tier
  maxTextureSize: number | null;
  maxCubeMapTextureSize: number | null;
  maxRenderBufferSize: number | null;
  maxTextureImageUnits: number | null;
  maxVertexAttribs: number | null;
  maxVaryingVectors: number | null;
  maxFragmentUniformVectors: number | null;
  maxVertexUniformVectors: number | null;
  compressedTextures: {
    astc: boolean;         // Modern iOS + Android flagship
    etc1: boolean;         // Older Android
    etc: boolean;          // Android (ETC2, OpenGL ES 3.0+)
    pvrtc: boolean;        // Older Apple GPUs (pre-A7)
    s3tc: boolean;         // Desktop / some Android
    bptc: boolean;         // Modern desktop
    rgtc: boolean;         // Desktop
  };
  webgpu: {
    supported: boolean;
    adapterVendor: string | null;
    adapterArchitecture: string | null;
    adapterDevice: string | null;
    adapterDescription: string | null;
    maxTextureDimension1D: number | null;
    maxTextureDimension2D: number | null;
    maxTextureDimension3D: number | null;
    maxTextureArrayLayers: number | null;
    maxBufferSize: number | null;
    maxBindGroups: number | null;
    maxSampledTexturesPerShaderStage: number | null;
    maxStorageBuffersPerShaderStage: number | null;
    maxComputeWorkgroupSizeX: number | null;
    maxComputeWorkgroupSizeY: number | null;
    maxComputeWorkgroupSizeZ: number | null;
  };
}

export interface ScreenMetrics {
  // CSS pixel dimensions of the full screen
  screenWidth: number;
  screenHeight: number;
  // Hardware pixel ratio
  devicePixelRatio: number;
  // True hardware pixel dimensions
  physicalWidth: number;
  physicalHeight: number;
  // Screen minus OS chrome (taskbar, dock etc.)
  availWidth: number;
  availHeight: number;
  // Actual browser rendering viewport (stable, excludes scrollbars)
  viewportWidth: number;
  viewportHeight: number;
  // Current orientation
  orientation: string | null;
  // Colour depth
  colorDepth: number;
  pixelDepth: number;
  // Notch / safe area presence
  hasNotch: boolean;
}

export interface PlatformMetrics {
  // Approximate RAM in GB (may be capped/rounded by browser)
  deviceMemoryGB: number | null;
  // Logical CPU core count
  hardwareConcurrency: number | null;
  // Network quality
  connectionEffectiveType: string | null;  // "4g" | "3g" | "2g" | "slow-2g"
  connectionDownlinkMbps: number | null;
  connectionRtt: number | null;
  connectionSaveData: boolean | null;
  // Platform string (deprecated but still informative)
  platform: string;
  // Touch capability
  maxTouchPoints: number;
  touchSupported: boolean;
  // Pointer capability
  pointerTypes: string[];
  // Language
  language: string;
  // Timezone
  timezone: string | null;
}

export interface DeviceMetrics {
  timestamp: string;
  sessionId: string;
  ua: UAMetrics;
  gpu: GPUMetrics;
  screen: ScreenMetrics;
  platform: PlatformMetrics;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function safeGetParameter(gl: WebGLRenderingContext | WebGL2RenderingContext, param: number): number | null {
  try {
    const val = gl.getParameter(param);
    return typeof val === "number" ? val : null;
  } catch {
    return null;
  }
}

function hasExtension(gl: WebGLRenderingContext | WebGL2RenderingContext, name: string): boolean {
  try {
    return gl.getExtension(name) !== null;
  } catch {
    return false;
  }
}

/**
 * Infer a human-readable GPU tier from the unmasked renderer string.
 * This is heuristic and not exhaustive — but useful for population bucketing.
 */
function inferGpuTier(renderer: string | null): string | null {
  if (!renderer) return null;
  const r = renderer.toLowerCase();

  // Apple Silicon tiers
  if (/apple a1[6-9]|apple m[2-9]/i.test(renderer)) return "Apple — High-end (A16+/M2+)";
  if (/apple a1[3-5]/i.test(renderer)) return "Apple — Mid-high (A13–A15)";
  if (/apple a[7-9]|apple a1[0-2]/i.test(renderer)) return "Apple — Mid (A7–A12)";
  if (/apple/i.test(renderer)) return "Apple — Unknown generation";

  // Qualcomm Adreno tiers
  if (/adreno.*(7[4-9][0-9]|8[0-9][0-9])/i.test(renderer)) return "Adreno — High-end (740+)";
  if (/adreno.*(6[4-9][0-9]|7[0-3][0-9])/i.test(renderer)) return "Adreno — Mid-high (640–730)";
  if (/adreno.*(5[0-9][0-9]|6[0-3][0-9])/i.test(renderer)) return "Adreno — Mid (500–630)";
  if (/adreno/i.test(renderer)) return "Adreno — Low/Unknown";

  // ARM Mali tiers
  if (/mali-g[7-9][0-9][0-9]/i.test(renderer)) return "Mali — High-end (G710+)";
  if (/mali-g[4-6][0-9]/i.test(renderer)) return "Mali — Mid (G41–G68)";
  if (/mali/i.test(renderer)) return "Mali — Low/Unknown";

  // Imagination PowerVR
  if (/powervr/i.test(renderer)) return "PowerVR";

  // Desktop NVIDIA / AMD / Intel
  if (/nvidia/i.test(renderer)) return "NVIDIA (Desktop/Laptop)";
  if (/amd|radeon/i.test(renderer)) return "AMD (Desktop/Laptop)";
  if (/intel/i.test(renderer)) return "Intel (Integrated)";

  // SwiftShader / software fallback
  if (/swiftshader|llvmpipe|software/i.test(renderer)) return "Software Renderer (No GPU)";

  return "Unknown";
}

function isInAppBrowser(ua: string): boolean {
  return /FBAN|FBAV|Instagram|Twitter|TikTok|Pinterest|Snapchat|WeChat|Line\/|MicroMessenger/i.test(ua);
}

function detectBot(raw: string): BotInfo {

   // Custom bot detection since node-device-detector doesn't have built-in bot detection
  const isBot = /bot|crawl|spider|slurp|googlebot|bingbot|yandexbot|duckduckbot|baiduspider|facebookexternalhit|twitterbot|rogerbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest|slackbot|vkShare|W3C_Validator|validator/i.test(raw);

  let botInfo: BotInfo = {
    detected: false,
    name: null,
    category: null,
    url: null,
    producerName: null
  };

  if (isBot) {
    // Simple bot detection - you might want to expand this
    botInfo = {
      detected: true,
      name: raw.match(/(bot|crawl|spider|slurp|googlebot|bingbot|yandexbot|duckduckbot|baiduspider|facebookexternalhit|twitterbot|rogerbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest|slackbot|vkShare|W3C_Validator|validator)/i)?.[0] ?? "Unknown Bot",
      category: "Search bot",
      url: null,
      producerName: null
    };
  }

  return botInfo;
}

// ─────────────────────────────────────────────────────────────────────────────
// UA Inspection
// ─────────────────────────────────────────────────────────────────────────────

function inspectUA(): UAMetrics {
  const raw = navigator.userAgent;
  const detector = new DeviceDetector();
  const parsed = detector.detect(raw);
  const botInfo = detectBot(raw);

  return {
    raw,
    client: {
      type: parsed.client?.type ?? null,
      name: parsed.client?.name ?? null,
      version: (parsed.client as any)?.version ?? null,
      engine: (parsed.client as any)?.engine ?? null,
      engineVersion: (parsed.client as any)?.engineVersion ?? null,
    },
    os: {
      name: parsed.os?.name ?? null,
      version: parsed.os?.version ?? null,
      platform: parsed.os?.platform ?? null,
    },
    device: {
      type: parsed.device?.type ?? null,
      brand: parsed.device?.brand ?? null,
      model: parsed.device?.model ?? null,
    },
    bot: botInfo,
    inAppBrowser: isInAppBrowser(raw),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GPU Inspection
// ─────────────────────────────────────────────────────────────────────────────

async function inspectGPU(): Promise<GPUMetrics> {
  const canvas = document.createElement("canvas");

  // Try WebGL2 first, fall back to WebGL1
  const gl2 = canvas.getContext("webgl2");
  const gl1 = !gl2 ? (canvas.getContext("webgl") || canvas.getContext("experimental-webgl") as WebGLRenderingContext | null) : null;
  const gl = (gl2 || gl1) as WebGLRenderingContext | WebGL2RenderingContext | null;

  let unmaskedVendor: string | null = null;
  let unmaskedRenderer: string | null = null;
  let vendor: string | null = null;
  let renderer: string | null = null;

  if (gl) {
    vendor = gl.getParameter(gl.VENDOR) ?? null;
    renderer = gl.getParameter(gl.RENDERER) ?? null;
    const debugExt = gl.getExtension("WEBGL_debug_renderer_info");
    if (debugExt) {
      unmaskedVendor = gl.getParameter(debugExt.UNMASKED_VENDOR_WEBGL) ?? null;
      unmaskedRenderer = gl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL) ?? null;
    }
  }

  // WebGPU
  let webgpuMetrics: GPUMetrics["webgpu"] = {
    supported: false,
    adapterVendor: null,
    adapterArchitecture: null,
    adapterDevice: null,
    adapterDescription: null,
    maxTextureDimension1D: null,
    maxTextureDimension2D: null,
    maxTextureDimension3D: null,
    maxTextureArrayLayers: null,
    maxBufferSize: null,
    maxBindGroups: null,
    maxSampledTexturesPerShaderStage: null,
    maxStorageBuffersPerShaderStage: null,
    maxComputeWorkgroupSizeX: null,
    maxComputeWorkgroupSizeY: null,
    maxComputeWorkgroupSizeZ: null,
  };

  if (typeof navigator !== "undefined" && "gpu" in navigator) {
    try {
      const adapter = await (navigator as any).gpu.requestAdapter();
      if (adapter) {
        const device = await adapter.requestDevice();
        const info = await adapter.requestAdapterInfo?.();
        const limits = device.limits;

        webgpuMetrics = {
          supported: true,
          adapterVendor: info?.vendor ?? null,
          adapterArchitecture: info?.architecture ?? null,
          adapterDevice: info?.device ?? null,
          adapterDescription: info?.description ?? null,
          maxTextureDimension1D: limits.maxTextureDimension1D ?? null,
          maxTextureDimension2D: limits.maxTextureDimension2D ?? null,
          maxTextureDimension3D: limits.maxTextureDimension3D ?? null,
          maxTextureArrayLayers: limits.maxTextureArrayLayers ?? null,
          maxBufferSize: limits.maxBufferSize ?? null,
          maxBindGroups: limits.maxBindGroups ?? null,
          maxSampledTexturesPerShaderStage: limits.maxSampledTexturesPerShaderStage ?? null,
          maxStorageBuffersPerShaderStage: limits.maxStorageBuffersPerShaderStage ?? null,
          maxComputeWorkgroupSizeX: limits.maxComputeWorkgroupSizeX ?? null,
          maxComputeWorkgroupSizeY: limits.maxComputeWorkgroupSizeY ?? null,
          maxComputeWorkgroupSizeZ: limits.maxComputeWorkgroupSizeZ ?? null,
        };

        device.destroy();
      }
    } catch {
      webgpuMetrics.supported = false;
    }
  }

  return {
    webglVersion: gl2 ? 2 : gl1 ? 1 : null,
    vendor,
    renderer,
    unmaskedVendor,
    unmaskedRenderer,
    gpuTier: inferGpuTier(unmaskedRenderer),
    maxTextureSize: gl ? safeGetParameter(gl, gl.MAX_TEXTURE_SIZE) : null,
    maxCubeMapTextureSize: gl ? safeGetParameter(gl, gl.MAX_CUBE_MAP_TEXTURE_SIZE) : null,
    maxRenderBufferSize: gl ? safeGetParameter(gl, gl.MAX_RENDERBUFFER_SIZE) : null,
    maxTextureImageUnits: gl ? safeGetParameter(gl, gl.MAX_TEXTURE_IMAGE_UNITS) : null,
    maxVertexAttribs: gl ? safeGetParameter(gl, gl.MAX_VERTEX_ATTRIBS) : null,
    maxVaryingVectors: gl ? safeGetParameter(gl, gl.MAX_VARYING_VECTORS) : null,
    maxFragmentUniformVectors: gl ? safeGetParameter(gl, gl.MAX_FRAGMENT_UNIFORM_VECTORS) : null,
    maxVertexUniformVectors: gl ? safeGetParameter(gl, gl.MAX_VERTEX_UNIFORM_VECTORS) : null,
    compressedTextures: {
      astc: gl ? hasExtension(gl, "WEBGL_compressed_texture_astc") : false,
      etc1: gl ? hasExtension(gl, "WEBGL_compressed_texture_etc1") : false,
      etc: gl ? hasExtension(gl, "WEBGL_compressed_texture_etc") : false,
      pvrtc: gl ? hasExtension(gl, "WEBGL_compressed_texture_pvrtc") : false,
      s3tc: gl ? hasExtension(gl, "WEBGL_compressed_texture_s3tc") : false,
      bptc: gl ? hasExtension(gl, "EXT_texture_compression_bptc") : false,
      rgtc: gl ? hasExtension(gl, "EXT_texture_compression_rgtc") : false,
    },
    webgpu: webgpuMetrics,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen Inspection
// ─────────────────────────────────────────────────────────────────────────────

function inspectScreen(): ScreenMetrics {
  const dpr = window.devicePixelRatio ?? 1;
  const hasNotch = CSS.supports("padding-top: env(safe-area-inset-top)") &&
    (() => {
      const el = document.createElement("div");
      el.style.paddingTop = "env(safe-area-inset-top)";
      document.body.appendChild(el);
      const val = parseFloat(getComputedStyle(el).paddingTop);
      document.body.removeChild(el);
      return val > 0;
    })();

  // Detect pointer types
  const pointerTypes: string[] = [];
  if (window.matchMedia("(pointer: fine)").matches) pointerTypes.push("fine (mouse)");
  if (window.matchMedia("(pointer: coarse)").matches) pointerTypes.push("coarse (touch)");
  if (window.matchMedia("(hover: hover)").matches) pointerTypes.push("hover-capable");

  return {
    screenWidth: screen.width,
    screenHeight: screen.height,
    devicePixelRatio: dpr,
    physicalWidth: Math.round(screen.width * dpr),
    physicalHeight: Math.round(screen.height * dpr),
    availWidth: screen.availWidth,
    availHeight: screen.availHeight,
    viewportWidth: document.documentElement.clientWidth,
    viewportHeight: document.documentElement.clientHeight,
    orientation: screen.orientation?.type ?? null,
    colorDepth: screen.colorDepth,
    pixelDepth: screen.pixelDepth,
    hasNotch,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform Inspection
// ─────────────────────────────────────────────────────────────────────────────

function inspectPlatform(): PlatformMetrics {
  const nav = navigator as any;
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;

  const pointerTypes: string[] = [];
  if (window.matchMedia("(pointer: fine)").matches) pointerTypes.push("fine");
  if (window.matchMedia("(pointer: coarse)").matches) pointerTypes.push("coarse");
  if (window.matchMedia("(any-pointer: fine)").matches) pointerTypes.push("any-fine");
  if (window.matchMedia("(any-pointer: coarse)").matches) pointerTypes.push("any-coarse");

  return {
    deviceMemoryGB: nav.deviceMemory ?? null,
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    connectionEffectiveType: conn?.effectiveType ?? null,
    connectionDownlinkMbps: conn?.downlink ?? null,
    connectionRtt: conn?.rtt ?? null,
    connectionSaveData: conn?.saveData ?? null,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    touchSupported: navigator.maxTouchPoints > 0 || "ontouchstart" in window,
    pointerTypes,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Collect a complete device metrics snapshot.
 * Call this once per session at initialisation time.
 * 
 * @returns Promise<DeviceMetrics> — the full metrics object
 */
export async function inspectDevice(): Promise<DeviceMetrics> {
  const [gpu, ua, screen_, platform] = await Promise.all([
    inspectGPU(),
    Promise.resolve(inspectUA()),
    Promise.resolve(inspectScreen()),
    Promise.resolve(inspectPlatform()),
  ]);

  return {
    timestamp: new Date().toISOString(),
    sessionId: generateSessionId(),
    ua,
    gpu,
    screen: screen_,
    platform,
  };
}

export default inspectDevice;
