
import { DeviceMetric } from './types';
import { inspectDevice } from './device-inspector';

let _metrics: DeviceMetric | null = null;

function escHtml(s: string): string {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function renderValue(val: any, depth = 0): string {
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

function toggleNode(id: string, btn: HTMLElement) {
  const el = document.getElementById(id);
  const isCollapsed = btn.classList.toggle("collapsed");
  el!.classList.toggle("hidden", isCollapsed);
}

function makeSection(
  id: string,
  icon: string,
  title: string,
  subtitle: string,
  bodyHTML: string,
  startOpen: boolean = true
): string {
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

function toggleSection(header: HTMLElement) {
  const body = header.nextElementSibling as HTMLElement;
  header.classList.toggle("open");
  body.classList.toggle("open");
  header.querySelector(".chevron")!.classList.toggle("open");
}

function makeSummaryCards(d: DeviceMetric) {
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
        : `<div class="value" title="${c.value ?? ''}">${c.value}</div>`}
      ${c.sub ? `<div class="sub">${c.sub}</div>` : ""}
    </div>`).join("")}
  </div>`;
}

function makeTextureMatrix(ct: DeviceMetric['gpu']['compressedTextures']) {
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
      <div class="texture-item ${ct[f.key as keyof typeof ct] ? "supported" : "unsupported"}" title="${f.desc}">
        <span class="texture-dot"></span>
        <span>${f.label}</span>
        <span style="font-size:10px;opacity:0.6">${ct[f.key as keyof typeof ct] ? "✓" : "✗"}</span>
      </div>`).join("")}
  </div>`;
}

function renderPage(d: DeviceMetric) {
  const content = document.getElementById("content");
  const ts = document.getElementById("ts");
  const pill = document.getElementById("statusPill");

  ts!.textContent = d.timestamp;
  pill!.textContent = "Complete";
  pill!.className = "status-pill done";

  content!.innerHTML = [
    makeSection("sec-summary", "📊", "Summary", "Key metrics at a glance", makeSummaryCards(d), true),
    makeSection("sec-ua", "🌐", "User Agent", `${d.ua.client.name ?? "?"} on ${d.ua.os.name ?? "?"}`, `<div class="json-tree">${renderValue(d.ua)}</div>`),
    makeSection("sec-gpu", "🎮", "GPU / WebGL", `${d.gpu.gpuTier ?? "No WebGL"} · WebGL ${d.gpu.webglVersion ?? "N/A"}`, `<div class="json-tree">${renderValue({ webglVersion: d.gpu.webglVersion, vendor: d.gpu.vendor, renderer: d.gpu.renderer, unmaskedVendor: d.gpu.unmaskedVendor, unmaskedRenderer: d.gpu.unmaskedRenderer, gpuTier: d.gpu.gpuTier, maxTextureSize: d.gpu.maxTextureSize, maxCubeMapTextureSize: d.gpu.maxCubeMapTextureSize, maxRenderBufferSize: d.gpu.maxRenderBufferSize, maxTextureImageUnits: d.gpu.maxTextureImageUnits, maxVertexAttribs: d.gpu.maxVertexAttribs, maxVaryingVectors: d.gpu.maxVaryingVectors, maxFragmentUniformVectors: d.gpu.maxFragmentUniformVectors, maxVertexUniformVectors: d.gpu.maxVertexUniformVectors })}</div>`),
    makeSection("sec-webgpu", "⚡", "WebGPU", d.gpu.webgpu.supported ? "Supported" : "Not supported", `<div class="json-tree">${renderValue(d.gpu.webgpu)}</div>`, false),
    makeSection("sec-textures", "🗜", "Compressed Textures", "Supported formats", makeTextureMatrix(d.gpu.compressedTextures) + `<div style="padding:0 16px 14px"><div class="json-tree">${renderValue(d.gpu.compressedTextures)}</div></div>`),
    makeSection("sec-screen", "📱", "Screen", `${d.screen.physicalWidth}×${d.screen.physicalHeight}px · DPR ${d.screen.devicePixelRatio}`, `<div class="json-tree">${renderValue(d.screen)}</div>`),
    makeSection("sec-platform", "💻", "Platform", `${d.platform.language} · ${d.platform.timezone ?? "?"}`, `<div class="json-tree">${renderValue(d.platform)}</div>`, false),
    makeSection("sec-raw", "{ }", "Full JSON", "Complete metrics object", `<div class="json-tree">${renderValue(d)}</div>`, false),
  ].join("");
}

function expandAll() {
  document.querySelectorAll(".collapsible-toggle.collapsed").forEach(el => {
    const id = el.getAttribute("onclick")!.match(/'([^']+)'/)?.[1];
    if (id) (window as any).toggleNode(id, el);
  });
  document.querySelectorAll(".json-body:not(.open)").forEach(b => {
    b.classList.add("open");
    b.previousElementSibling!.classList.add("open");
    b.previousElementSibling!.querySelector(".chevron")?.classList.add("open");
  });
}

function collapseAll() {
  document.querySelectorAll(".collapsible-toggle:not(.collapsed)").forEach(el => {
    const id = el.getAttribute("onclick")!.match(/'([^']+)'/)?.[1];
    if (id) (window as any).toggleNode(id, el);
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

function setActive(el: HTMLElement) {
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  el.classList.add("active");
}

(window as any).toggleNode = toggleNode;
(window as any).toggleSection = toggleSection;
(window as any).expandAll = expandAll;
(window as any).collapseAll = collapseAll;
(window as any).copyJSON = copyJSON;
(window as any).downloadJSON = downloadJSON;
(window as any).setActive = setActive;

(async () => {
  try {
    _metrics = await inspectDevice();
    renderPage(_metrics);
  } catch (err: any) {
    document.getElementById("content")!.innerHTML = `
      <div class="error-panel">
        <strong>Inspection failed</strong><br>${err.message}
      </div>`;
    document.getElementById("statusPill")!.textContent = "Error";
    document.getElementById("statusPill")!.className = "status-pill error";
  }
})();


