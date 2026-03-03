// ── Inline device-detector-js stub (replace with real npm import when bundling)
// When using webpack: import DeviceDetector from 'device-detector-js';
// This stub provides basic parsing for the standalone HTML demo.
const DeviceDetectorStub = {
  parse(ua) {
    const result = { client: {}, os: {}, device: {}, bot: null };

    // Browser
    const browsers = [
      [/Chrome\/(\S+)/i, "Chrome", "Blink"],
      [/Firefox\/(\S+)/i, "Firefox", "Gecko"],
      [/Safari\/(\S+)/i, "Safari", "WebKit"],
      [/Edg\/(\S+)/i, "Edge", "Blink"],
      [/OPR\/(\S+)/i, "Opera", "Blink"],
      [/SamsungBrowser\/(\S+)/i, "Samsung Internet", "Blink"],
    ];
    for (const [rx, name, engine] of browsers) {
      const m = ua.match(rx);
      if (m) {
        result.client = { type: "browser", name, version: m[1], engine, engineVersion: m[1] };
        break;
      }
    }

    // OS
    const oses = [
      [/iPhone OS ([\d_]+)/i, "iOS"],
      [/iPad.*OS ([\d_]+)/i, "iPadOS"],
      [/Android ([\d.]+)/i, "Android"],
      [/Windows NT ([\d.]+)/i, "Windows"],
      [/Mac OS X ([\d_]+)/i, "macOS"],
      [/Linux/i, "Linux"],
      [/CrOS/i, "ChromeOS"],
    ];
    for (const [rx, name] of oses) {
      const m = ua.match(rx);
      if (m) {
        result.os = { name, version: m[1]?.replace(/_/g, ".") ?? null, platform: /arm|aarch/i.test(ua) ? "arm" : "x86" };
        break;
      }
    }

    // Device
    if (/iPhone/i.test(ua)) result.device = { type: "smartphone", brand: "Apple", model: "iPhone" };
    else if (/iPad/i.test(ua)) result.device = { type: "tablet", brand: "Apple", model: "iPad" };
    else if (/Android/i.test(ua)) {
      const m = ua.match(/;\s*([^;)]+)\s+Build\//i);
      result.device = { type: "smartphone", brand: null, model: m?.[1]?.trim() ?? null };
    } else if (/Windows|Macintosh|Linux/i.test(ua)) {
      result.device = { type: "desktop", brand: null, model: null };
    }

    // Bot detection
    if (/bot|crawl|spider|slurp|googlebot|bingbot/i.test(ua)) {
      result.bot = { name: "Unknown Bot", category: "Search bot", url: null, producer: { name: null } };
    }

    return result;
  }
};

// ── GPU tier inference
function inferGpuTier(renderer) {
  if (!renderer) return null;
  if (/apple a1[6-9]|apple m[2-9]/i.test(renderer)) return "Apple — High-end (A16+/M2+)";
  if (/apple a1[3-5]/i.test(renderer)) return "Apple — Mid-high (A13–A15)";
  if (/apple a[7-9]|apple a1[0-2]/i.test(renderer)) return "Apple — Mid (A7–A12)";
  if (/apple/i.test(renderer)) return "Apple — Unknown generation";
  if (/adreno.*(7[4-9]\d|8\d\d)/i.test(renderer)) return "Adreno — High-end (740+)";
  if (/adreno.*(6[4-9]\d|7[0-3]\d)/i.test(renderer)) return "Adreno — Mid-high (640–730)";
  if (/adreno.*(5\d\d|6[0-3]\d)/i.test(renderer)) return "Adreno — Mid (500–630)";
  if (/adreno/i.test(renderer)) return "Adreno — Low/Unknown";
  if (/mali-g[7-9]\d\d/i.test(renderer)) return "Mali — High-end (G710+)";
  if (/mali-g[4-6]\d/i.test(renderer)) return "Mali — Mid (G41–G68)";
  if (/mali/i.test(renderer)) return "Mali — Low/Unknown";
  if (/powervr/i.test(renderer)) return "PowerVR";
  if (/nvidia/i.test(renderer)) return "NVIDIA (Desktop/Laptop)";
  if (/amd|radeon/i.test(renderer)) return "AMD (Desktop/Laptop)";
  if (/intel/i.test(renderer)) return "Intel (Integrated)";
  if (/swiftshader|llvmpipe|software/i.test(renderer)) return "Software Renderer";
  return "Unknown";
}

// ── Main inspector (mirrors device-inspector.ts)
async function inspectDevice() {
  // UA
  const raw = navigator.userAgent;
  const parsed = DeviceDetectorStub.parse(raw);
  const inAppBrowser = /FBAN|FBAV|Instagram|Twitter|TikTok|Pinterest|Snapchat|WeChat|Line\/|MicroMessenger/i.test(raw);

  const ua = {
    raw,
    client: {
      type: parsed.client?.type ?? null,
      name: parsed.client?.name ?? null,
      version: parsed.client?.version ?? null,
      engine: parsed.client?.engine ?? null,
      engineVersion: parsed.client?.engineVersion ?? null,
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
    bot: {
      detected: !!parsed.bot,
      name: parsed.bot?.name ?? null,
      category: parsed.bot?.category ?? null,
      url: parsed.bot?.url ?? null,
      producerName: parsed.bot?.producer?.name ?? null,
    },
    inAppBrowser,
  };

  // GPU
  const canvas = document.createElement("canvas");
  const gl2 = canvas.getContext("webgl2");
  const gl1 = !gl2 ? (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) : null;
  const gl = gl2 || gl1;

  let unmaskedVendor = null, unmaskedRenderer = null, vendor = null, renderer = null;
  const ext = gl?.getExtension("WEBGL_debug_renderer_info");
  if (gl) {
    vendor = gl.getParameter(gl.VENDOR);
    renderer = gl.getParameter(gl.RENDERER);
    if (ext) {
      unmaskedVendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL);
      unmaskedRenderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
    }
  }

  const gp = (param) => { try { const v = gl?.getParameter(param); return typeof v === "number" ? v : null; } catch { return null; } };
  const hasExt = (name) => { try { return !!gl?.getExtension(name); } catch { return false; } };

  // WebGPU
  let webgpu = {
    supported: false,
    adapterVendor: null, adapterArchitecture: null, adapterDevice: null, adapterDescription: null,
    maxTextureDimension1D: null, maxTextureDimension2D: null, maxTextureDimension3D: null,
    maxTextureArrayLayers: null, maxBufferSize: null, maxBindGroups: null,
    maxSampledTexturesPerShaderStage: null, maxStorageBuffersPerShaderStage: null,
    maxComputeWorkgroupSizeX: null, maxComputeWorkgroupSizeY: null, maxComputeWorkgroupSizeZ: null,
  };
  if ("gpu" in navigator) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        const device = await adapter.requestDevice();
        const info = await adapter.requestAdapterInfo?.().catch(() => null);
        const lim = device.limits;
        webgpu = {
          supported: true,
          adapterVendor: info?.vendor ?? null,
          adapterArchitecture: info?.architecture ?? null,
          adapterDevice: info?.device ?? null,
          adapterDescription: info?.description ?? null,
          maxTextureDimension1D: lim.maxTextureDimension1D ?? null,
          maxTextureDimension2D: lim.maxTextureDimension2D ?? null,
          maxTextureDimension3D: lim.maxTextureDimension3D ?? null,
          maxTextureArrayLayers: lim.maxTextureArrayLayers ?? null,
          maxBufferSize: lim.maxBufferSize ?? null,
          maxBindGroups: lim.maxBindGroups ?? null,
          maxSampledTexturesPerShaderStage: lim.maxSampledTexturesPerShaderStage ?? null,
          maxStorageBuffersPerShaderStage: lim.maxStorageBuffersPerShaderStage ?? null,
          maxComputeWorkgroupSizeX: lim.maxComputeWorkgroupSizeX ?? null,
          maxComputeWorkgroupSizeY: lim.maxComputeWorkgroupSizeY ?? null,
          maxComputeWorkgroupSizeZ: lim.maxComputeWorkgroupSizeZ ?? null,
        };
        device.destroy();
      }
    } catch {}
  }

  const gpu = {
    webglVersion: gl2 ? 2 : gl1 ? 1 : null,
    vendor, renderer, unmaskedVendor, unmaskedRenderer,
    gpuTier: inferGpuTier(unmaskedRenderer),
    maxTextureSize: gp(gl?.MAX_TEXTURE_SIZE),
    maxCubeMapTextureSize: gp(gl?.MAX_CUBE_MAP_TEXTURE_SIZE),
    maxRenderBufferSize: gp(gl?.MAX_RENDERBUFFER_SIZE),
    maxTextureImageUnits: gp(gl?.MAX_TEXTURE_IMAGE_UNITS),
    maxVertexAttribs: gp(gl?.MAX_VERTEX_ATTRIBS),
    maxVaryingVectors: gp(gl?.MAX_VARYING_VECTORS),
    maxFragmentUniformVectors: gp(gl?.MAX_FRAGMENT_UNIFORM_VECTORS),
    maxVertexUniformVectors: gp(gl?.MAX_VERTEX_UNIFORM_VECTORS),
    compressedTextures: {
      astc: hasExt("WEBGL_compressed_texture_astc"),
      etc1: hasExt("WEBGL_compressed_texture_etc1"),
      etc: hasExt("WEBGL_compressed_texture_etc"),
      pvrtc: hasExt("WEBGL_compressed_texture_pvrtc"),
      s3tc: hasExt("WEBGL_compressed_texture_s3tc"),
      bptc: hasExt("EXT_texture_compression_bptc"),
      rgtc: hasExt("EXT_texture_compression_rgtc"),
    },
    webgpu,
  };

  // Screen
  const dpr = window.devicePixelRatio ?? 1;
  let hasNotch = false;
  try {
    if (CSS.supports("padding-top: env(safe-area-inset-top)")) {
      const el = document.createElement("div");
      el.style.cssText = "position:fixed;padding-top:env(safe-area-inset-top);pointer-events:none";
      document.body.appendChild(el);
      hasNotch = parseFloat(getComputedStyle(el).paddingTop) > 0;
      document.body.removeChild(el);
    }
  } catch {}

  const screen_ = {
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

  // Platform
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const pointerTypes = [];
  if (window.matchMedia("(pointer: fine)").matches) pointerTypes.push("fine");
  if (window.matchMedia("(pointer: coarse)").matches) pointerTypes.push("coarse");
  if (window.matchMedia("(any-pointer: fine)").matches) pointerTypes.push("any-fine");
  if (window.matchMedia("(any-pointer: coarse)").matches) pointerTypes.push("any-coarse");

  const platform = {
    deviceMemoryGB: navigator.deviceMemory ?? null,
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

  return {
    timestamp: new Date().toISOString(),
    sessionId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    ua, gpu, screen: screen_, platform,
  };
}

// ── JSON Tree renderer
function renderValue(val, depth = 0) {
  if (val === null) return `<span class="jnull">null</span>`;
  if (val === true) return `<span class="jbt">true</span>`;
  if (val === false) return `<span class="jbf">false</span>`;
  if (typeof val === "number") return `<span class="jn">${val}</span>`;
  if (typeof val === "string") return `<span class="js">"${escHtml(val)}"</span>`;
  if (Array.isArray(val)) {
    if (val.length === 0) return `<span class="jbrace">[]</span>`;
    const items = val.map(v => `<li>${renderValue(v, depth + 1)}</li>`).join("");
    const id = `node-${Math.random().toString(36).slice(2)}`;
    return `<span class="jbrace">[</span>
      <span class="collapsible-toggle" onclick="toggleNode('${id}', this)"></span>
      <ul id="${id}" class="collapsible-children">${items}</ul>
      <span class="collapsed-preview jmuted">…${val.length} items</span>
      <span class="jbrace">]</span>`;
  }
  if (typeof val === "object") {
    const keys = Object.keys(val);
    if (keys.length === 0) return `<span class="jbrace">{}</span>`;
    const id = `node-${Math.random().toString(36).slice(2)}`;
    const items = keys.map((k, i) => {
      const comma = i < keys.length - 1 ? `<span class="jcomma">,</span>` : "";
      return `<li><span class="jk">"${escHtml(k)}"</span><span class="jmuted">: </span>${renderValue(val[k], depth + 1)}${comma}</li>`;
    }).join("");
    return `<span class="jbrace">{</span>
      <span class="collapsible-toggle" onclick="toggleNode('${id}', this)"></span>
      <ul id="${id}" class="collapsible-children">${items}</ul>
      <span class="collapsed-preview jmuted">…${keys.length} keys</span>
      <span class="jbrace">}</span>`;
  }
  return String(val);
}

function escHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function toggleNode(id, btn) {
  const el = document.getElementById(id);
  const isCollapsed = btn.classList.toggle("collapsed");
  el.classList.toggle("hidden", isCollapsed);
}

// ── Section builder
function makeSection(id, icon, title, subtitle, bodyHTML, startOpen = true) {
  return `
    <div class="json-section" id="${id}">
      <div class="json-section-header ${startOpen ? "open" : ""}" onclick="toggleSection(this)">
        <div class="section-icon" style="background:rgba(0,212,255,0.08)">${icon}</div>
        <div style="flex:1">
          <div class="section-title">${title}</div>
          <div class="section-subtitle">${subtitle}</div>
        </div>
        <svg class="chevron ${startOpen ? "open" : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      <div class="json-body ${startOpen ? "open" : ""}">
        ${bodyHTML}
      </div>
    </div>`;
}

function toggleSection(header) {
  const body = header.nextElementSibling;
  header.classList.toggle("open");
  body.classList.toggle("open");
  header.querySelector(".chevron").classList.toggle("open");
}

// ── Summary cards
function makeSummaryCards(d) {
  const cards = [
    { label: "Browser", value: `${d.ua.client.name ?? "?"} ${d.ua.client.version?.split(".")[0] ?? ""}`, sub: d.ua.client.engine },
    { label: "OS", value: `${d.ua.os.name ?? "?"}`, sub: d.ua.os.version },
    { label: "Device Type", value: d.ua.device.type ?? "Unknown", sub: [d.ua.device.brand, d.ua.device.model].filter(Boolean).join(" ") || "—" },
    { label: "GPU Tier", value: d.gpu.gpuTier ?? "Unknown", sub: null },
    { label: "WebGL", value: d.gpu.webglVersion ? `v${d.gpu.webglVersion}` : "None", sub: `Max texture: ${d.gpu.maxTextureSize?.toLocaleString() ?? "?"} px` },
    { label: "WebGPU", value: "", badge: d.gpu.webgpu.supported, sub: d.gpu.webgpu.supported ? `Max 2D: ${d.gpu.webgpu.maxTextureDimension2D?.toLocaleString()}` : "Not supported" },
    { label: "Screen (CSS)", value: `${d.screen.screenWidth} × ${d.screen.screenHeight}`, sub: `DPR ${d.screen.devicePixelRatio}` },
    { label: "Physical px", value: `${d.screen.physicalWidth} × ${d.screen.physicalHeight}`, sub: `${d.screen.colorDepth}-bit colour` },
    { label: "Viewport", value: `${d.screen.viewportWidth} × ${d.screen.viewportHeight}`, sub: d.screen.orientation ?? "—" },
    { label: "RAM", value: d.platform.deviceMemoryGB ? `≥${d.platform.deviceMemoryGB} GB` : "Unknown", sub: `${d.platform.hardwareConcurrency ?? "?"} logical cores` },
    { label: "Touch", value: "", badge: d.platform.touchSupported, sub: `${d.platform.maxTouchPoints} touch points` },
    { label: "Bot", value: "", badge: !d.ua.bot.detected, badgeYesLabel: "Clean", badgeNoLabel: "Bot!", sub: d.ua.inAppBrowser ? "In-app WebView" : "Standard browser" },
  ];

  return `<div class="summary-grid">${cards.map(c => `
    <div class="summary-card">
      <div class="label">${c.label}</div>
      ${"badge" in c
        ? `<div class="value"><span class="badge ${c.badge ? "yes" : "no"}">${c.badge ? (c.badgeYesLabel ?? "Yes") : (c.badgeNoLabel ?? "No")}</span></div>`
        : `<div class="value" title="${c.value}">${c.value}</div>`}
      ${c.sub ? `<div class="sub">${c.sub}</div>` : ""}
    </div>`).join("")}
  </div>`;
}

// ── Compressed texture matrix
function makeTextureMatrix(ct) {
  const formats = [
    { key: "astc", label: "ASTC", desc: "Modern iOS + Android flagship" },
    { key: "etc", label: "ETC2", desc: "Android (OpenGL ES 3.0+)" },
    { key: "etc1", label: "ETC1", desc: "Older Android" },
    { key: "pvrtc", label: "PVRTC", desc: "Older Apple GPUs" },
    { key: "s3tc", label: "S3TC / DXT", desc: "Desktop + some Android" },
    { key: "bptc", label: "BPTC / BC7", desc: "Modern desktop" },
    { key: "rgtc", label: "RGTC / BC4-5", desc: "Desktop" },
  ];
  return `<div class="texture-matrix">
    ${formats.map(f => `
      <div class="texture-item ${ct[f.key] ? "supported" : "unsupported"}" title="${f.desc}">
        <span class="texture-dot"></span>
        <span>${f.label}</span>
        <span style="font-size:10px;opacity:0.6">${ct[f.key] ? "✓" : "✗"}</span>
      </div>`).join("")}
  </div>`;
}

// ── Full page render
function renderPage(d) {
  const content = document.getElementById("content");
  const ts = document.getElementById("ts");
  const pill = document.getElementById("statusPill");

  ts.textContent = d.timestamp;
  pill.textContent = "Complete";
  pill.className = "status-pill done";

  content.innerHTML = [
    // Summary
    makeSection("sec-summary", "📊", "Summary", "Key metrics at a glance",
      makeSummaryCards(d), true),

    // User Agent
    makeSection("sec-ua", "🌐", "User Agent", `${d.ua.client.name ?? "?"} on ${d.ua.os.name ?? "?"}`,
      `<div class="json-tree">${renderValue(d.ua)}</div>`),

    // GPU / WebGL
    makeSection("sec-gpu", "🎮", "GPU / WebGL", `${d.gpu.gpuTier ?? "No WebGL"} · WebGL ${d.gpu.webglVersion ?? "N/A"}`,
      `<div class="json-tree">${renderValue({ webglVersion: d.gpu.webglVersion, vendor: d.gpu.vendor, renderer: d.gpu.renderer, unmaskedVendor: d.gpu.unmaskedVendor, unmaskedRenderer: d.gpu.unmaskedRenderer, gpuTier: d.gpu.gpuTier, maxTextureSize: d.gpu.maxTextureSize, maxCubeMapTextureSize: d.gpu.maxCubeMapTextureSize, maxRenderBufferSize: d.gpu.maxRenderBufferSize, maxTextureImageUnits: d.gpu.maxTextureImageUnits, maxVertexAttribs: d.gpu.maxVertexAttribs, maxVaryingVectors: d.gpu.maxVaryingVectors, maxFragmentUniformVectors: d.gpu.maxFragmentUniformVectors, maxVertexUniformVectors: d.gpu.maxVertexUniformVectors })}</div>`),

    // WebGPU
    makeSection("sec-webgpu", "⚡", "WebGPU", d.gpu.webgpu.supported ? "Supported" : "Not supported",
      `<div class="json-tree">${renderValue(d.gpu.webgpu)}</div>`, false),

    // Compressed Textures
    makeSection("sec-textures", "🗜", "Compressed Textures", "Supported formats",
      makeTextureMatrix(d.gpu.compressedTextures) + `<div style="padding:0 16px 14px"><div class="json-tree">${renderValue(d.gpu.compressedTextures)}</div></div>`),

    // Screen
    makeSection("sec-screen", "📱", "Screen", `${d.screen.physicalWidth}×${d.screen.physicalHeight}px · DPR ${d.screen.devicePixelRatio}`,
      `<div class="json-tree">${renderValue(d.screen)}</div>`),

    // Platform
    makeSection("sec-platform", "💻", "Platform", `${d.platform.language} · ${d.platform.timezone ?? "?"}`,
      `<div class="json-tree">${renderValue(d.platform)}</div>`, false),

    // Full JSON
    makeSection("sec-raw", "{ }", "Full JSON", "Complete metrics object",
      `<div class="json-tree">${renderValue(d)}</div>`, false),
  ].join("");
}

// ── Toolbar actions
let _metrics = null;

function expandAll() {
  document.querySelectorAll(".collapsible-toggle.collapsed").forEach(el => {
    const id = el.getAttribute("onclick").match(/'([^']+)'/)?.[1];
    if (id) toggleNode(id, el);
  });
  document.querySelectorAll(".json-body:not(.open)").forEach(b => {
    b.classList.add("open");
    b.previousElementSibling.classList.add("open");
    b.previousElementSibling.querySelector(".chevron")?.classList.add("open");
  });
}

function collapseAll() {
  document.querySelectorAll(".collapsible-toggle:not(.collapsed)").forEach(el => {
    const id = el.getAttribute("onclick").match(/'([^']+)'/)?.[1];
    if (id) toggleNode(id, el);
  });
}

function copyJSON() {
  if (_metrics) navigator.clipboard.writeText(JSON.stringify(_metrics, null, 2));
}

function downloadJSON() {
  if (!_metrics) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(_metrics, null, 2)], { type: "application/json" }));
  a.download = `device-metrics-${_metrics.sessionId}.json`;
  a.click();
}

function setActive(el) {
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  el.classList.add("active");
}

// ── Bootstrap
(async () => {
  try {
    _metrics = await inspectDevice();
    renderPage(_metrics);
  } catch (err) {
    document.getElementById("content").innerHTML = `
      <div class="error-panel">
        <strong>Inspection failed</strong><br>${err.message}
      </div>`;
    document.getElementById("statusPill").textContent = "Error";
    document.getElementById("statusPill").className = "status-pill error";
  }
})();
