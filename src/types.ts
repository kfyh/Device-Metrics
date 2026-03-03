export interface DeviceMetric {
  timestamp: string;
  sessionId: string;
  ua: UserAgentData;
  gpu: GpuData;
  screen: ScreenData;
  platform: PlatformData;
}

export interface UserAgentData {
  raw: string;
  client: ClientData;
  os: OsData;
  device: DeviceData;
  bot: BotData;
  inAppBrowser: boolean;
}

export interface ClientData {
  type: string | null;
  name: string | null;
  version: string | null;
  engine: string | null;
  engineVersion: string | null;
}

export interface OsData {
  name: string | null;
  version: string | null;
  platform: string | null;
}

export interface DeviceData {
  type: string | null;
  brand: string | null;
  model: string | null;
}

export interface BotData {
  detected: boolean;
  name: string | null;
  category: string | null;
  url: string | null;
  producerName: string | null;
}

export interface GpuData {
  webglVersion: number | null;
  vendor: string | null;
  renderer: string | null;
  unmaskedVendor: string | null;
  unmaskedRenderer: string | null;
  gpuTier: string | null;
  maxTextureSize: number | null;
  maxCubeMapTextureSize: number | null;
  maxRenderBufferSize: number | null;
  maxTextureImageUnits: number | null;
  maxVertexAttribs: number | null;
  maxVaryingVectors: number | null;
  maxFragmentUniformVectors: number | null;
  maxVertexUniformVectors: number | null;
  compressedTextures: CompressedTextures;
  webgpu: WebGpuData;
}

export interface CompressedTextures {
  astc: boolean;
  etc1: boolean;
  etc: boolean;
  pvrtc: boolean;
  s3tc: boolean;
  bptc: boolean;
  rgtc: boolean;
}

export interface WebGpuData {
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
}

export interface ScreenData {
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  physicalWidth: number;
  physicalHeight: number;
  availWidth: number;
  availHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  orientation: string | null;
  colorDepth: number;
  pixelDepth: number;
  hasNotch: boolean;
}

export interface PlatformData {
  deviceMemoryGB: number | null;
  hardwareConcurrency: number | null;
  connectionEffectiveType: string | null;
  connectionDownlinkMbps: number | null;
  connectionRtt: number | null;
  connectionSaveData: boolean | null;
  platform: string;
  maxTouchPoints: number;
  touchSupported: boolean;
  pointerTypes: string[];
  language: string;
  timezone: string | null;
}
