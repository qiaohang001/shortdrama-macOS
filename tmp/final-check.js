(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // src/main.jsx
  var import_react18 = __toESM(__require("react"), 1);
  var import_client = __require("react-dom/client");

  // src/App.jsx
  var import_react17 = __toESM(__require("react"), 1);
  var import_core3 = __require("@tauri-apps/api/core");
  var import_ui = __require("@dual/ui");

  // src/components/NewScript/NewScriptModule.jsx
  var import_react = __toESM(__require("react"), 1);
  var import_mammoth = __toESM(__require("mammoth"), 1);

  // src/dispatch-jobs.js
  function baseUrl() {
    return (typeof localStorage !== "undefined" && localStorage.getItem("DISPATCH_BASE_URL") || "https://api.jinsuai.cn").replace(/\/$/, "");
  }
  function token() {
    return typeof localStorage !== "undefined" && localStorage.getItem("DISPATCH_TOKEN") || "";
  }
  function headers() {
    const h = { "Content-Type": "application/json" };
    const t2 = token();
    if (t2) h.Authorization = "Bearer " + t2;
    return h;
  }
  var DispatchError = class extends Error {
    constructor(message, { status, needRecharge } = {}) {
      super(message);
      this.status = status;
      this.needRecharge = needRecharge;
    }
  };
  async function api(path, opts = {}, _retry = false) {
    const url = baseUrl() + path;
    const res = await fetch(url, { ...opts, headers: { ...headers(), ...opts.headers || {} } });
    let data = {};
    try {
      data = await res.json();
    } catch (_) {
    }
    if (!res.ok) {
      if (res.status === 401) {
        const err = new DispatchError("\u672A\u767B\u5F55\u8C03\u5EA6\u673A\uFF0C\u8BF7\u5148\u5728\u300C\u8BBE\u7F6E\u300D\u4E2D\u767B\u5F55\u3002", { status: 401, needAuth: true });
        throw err;
      }
      const needRecharge = res.status === 402 || res.headers.get("X-Need-Recharge") === "1" || !!data.need_recharge;
      throw new DispatchError(data.detail || data.message || `HTTP ${res.status}`, { status: res.status, needRecharge });
    }
    return data;
  }
  async function precheck(type, params = {}) {
    return await api("/api/jobs/precheck", { method: "POST", body: JSON.stringify({ type, params }) });
  }
  async function submitJob(type, payload = {}) {
    return await api("/api/jobs/submit", { method: "POST", body: JSON.stringify({ type, payload }) });
  }
  async function getJob(jobId) {
    return await api(`/api/jobs/${jobId}`, { method: "GET" });
  }
  function normalizeResultUrl(url) {
    if (!url || typeof url !== "string") return url;
    const base = baseUrl().replace(/\/$/, "");
    try {
      const u = new URL(url);
      if (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "0.0.0.0") {
        return base + u.pathname + u.search + u.hash;
      }
      return url;
    } catch {
      if (url.startsWith("/")) return base + url;
      return base + "/" + url;
    }
  }
  async function runDispatchJob({ type, payload, onProgress = () => {
  }, pollInterval = 5e3, timeoutMs = 12e5 }) {
    const t2 = token();
    if (!t2) {
      throw new DispatchError("\u672A\u767B\u5F55\u8C03\u5EA6\u673A\uFF0C\u8BF7\u5148\u5728\u300C\u8BBE\u7F6E\u300D\u4E2D\u767B\u5F55\u3002", { status: 401 });
    }
    const pre = await precheck(type, payload);
    if (!pre.sufficient) {
      const err = new DispatchError(`\u4F59\u989D\u4E0D\u8DB3\uFF1A\u9700\u8981 ${pre.required_credits} \u79EF\u5206\uFF0C\u5F53\u524D ${pre.balance} \u79EF\u5206`, { status: 402, needRecharge: true });
      throw err;
    }
    onProgress(5, `\u4F59\u989D\u6821\u9A8C\u901A\u8FC7\uFF0C\u9700 ${pre.required_credits} \u79EF\u5206`);
    const job = await submitJob(type, payload);
    const jobId = job.id;
    onProgress(10, `\u4EFB\u52A1\u5DF2\u63D0\u4EA4 ${jobId}`);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const status = await getJob(jobId);
      const progress = status.progress || 0;
      const statusText = status.status || "unknown";
      const queuePosition = status.queue_position || 0;
      let displayText = statusText;
      if (statusText === "queued" && queuePosition > 0) {
        displayText = `\u6392\u961F\u4E2D\uFF08\u7B2C${queuePosition}\u4F4D\uFF09`;
      } else if (statusText === "running") {
        displayText = `\u751F\u6210\u4E2D\uFF08${progress}%\uFF09`;
      }
      onProgress(Math.max(10, Math.min(99, progress)), displayText, { queuePosition, status: statusText, progress });
      if (status.status === "succeeded") {
        if (!status.result_url) throw new DispatchError("\u4EFB\u52A1\u5B8C\u6210\u4F46\u672A\u8FD4\u56DE\u7ED3\u679C\u5730\u5740");
        onProgress(100, "\u5B8C\u6210", { queuePosition: 0, status: "succeeded", progress: 100 });
        return { jobId, resultUrl: normalizeResultUrl(status.result_url), rawResultUrl: status.result_url, ...status };
      }
      if (status.status === "failed") {
        throw new DispatchError(status.error || "\u4EFB\u52A1\u5931\u8D25");
      }
      if (status.status === "canceled") {
        throw new DispatchError("\u4EFB\u52A1\u5DF2\u53D6\u6D88");
      }
      await new Promise((r) => setTimeout(r, pollInterval));
    }
    throw new DispatchError("\u4EFB\u52A1\u8F6E\u8BE2\u8D85\u65F6");
  }
  async function generateImage({ prompt, model = "Qwen/Qwen-Image", size = "", n = 1 }) {
    if (!token()) {
      throw new DispatchError("\u672A\u767B\u5F55\u8C03\u5EA6\u673A\uFF0C\u8BF7\u5148\u5728\u300C\u8BBE\u7F6E\u300D\u4E2D\u767B\u5F55\u3002", { status: 401 });
    }
    const payload = { prompt, model, size, n };
    return await api("/api/image/generate", { method: "POST", body: JSON.stringify(payload) });
  }
  async function getCurrentUser() {
    return await api("/api/auth/me", { method: "GET" });
  }
  async function subscribeMembership(tier) {
    return await api("/api/billing/membership", {
      method: "POST",
      body: JSON.stringify({ tier })
    });
  }
  var MEMBERSHIP_NAMES = {
    0: "\u514D\u8D39\u7528\u6237",
    1: "\u6708\u5361",
    2: "\u5B63\u5361",
    3: "\u5E74\u5361"
  };
  async function createRechargeOrder(tier, channel) {
    return await api("/api/billing/recharge", {
      method: "POST",
      body: JSON.stringify({ tier, channel })
    });
  }
  async function getOrderStatus(orderNo) {
    return await api(`/api/billing/order/${orderNo}`, { method: "GET" });
  }

  // src/utils.js
  async function readTextFileAuto(file) {
    const buf = await file.arrayBuffer();
    try {
      const decoder = new TextDecoder("utf-8", { fatal: true });
      return decoder.decode(buf);
    } catch (_) {
      try {
        const decoder = new TextDecoder("gbk");
        return decoder.decode(buf);
      } catch (_2) {
        return new TextDecoder("utf-8").decode(buf);
      }
    }
  }
  var DEFAULT_VIDEO_SIZE = "p480";
  function defaultProject(title2 = "\u65B0\u77ED\u5267") {
    return {
      id: "sd_" + Date.now(),
      title: title2,
      idea: "",
      script: "",
      dramaType: "real",
      // 短剧类型：real(仿真人)/anime(动漫)/semireal(半写实)/comic(漫剧)，全链路生成风格注入
      scenes: [],
      // [{id,title,desc,imageUrl,videoUrl}]  （旧版扁平分场，保留兼容）
      // ── 新：分集→分镜→台词 三级结构化数据（#140）──
      episodes: [],
      // [{id,title,summary,content,order}]
      shots: [],
      // 分镜对象（canonical 字段）:
      // { id, shotIndex, episodeId, title, sceneDesc,
      //   sceneType(景别), cameraMove(运镜), lighting(灯光), emotion(情绪), effect(特效),
      //   duration(秒), promptCn(中文Prompt), characters(人物名数组),
      //   dialogue(口头台词), subtitle(字幕), innerMonologue(内心独白),
      //   note(备注), foreshadow(伏笔标记), endPoint(镜头收束点), lastFrame,
      //   imageUrl, videoUrl, status, progress }
      // 兼容旧字段保留：shotType/camera/mood/vfx/cnPrompt
      dialogues: [],
      // [{id,shotId,episodeId,character,text,ttsUrl,status}]
      sourceName: null,
      // 导入的小说/剧本文件名
      sourceText: null,
      // 导入的原文
      sourceType: null,
      // "story"（小说/故事）| "script"（剧本）
      convertedAt: 0,
      // 最近一次解析为骨架的时间
      novels: [],
      // [{id,title,content,source:'upload'|'ai',createdAt}]
      scripts: [],
      // [{id,title,content,source:'upload'|'novel',novelId,createdAt}]
      materials: { characters: [], scenes: [] },
      // 素材库：角色/场景
      videoSize: DEFAULT_VIDEO_SIZE,
      // 视频生成分辨率预设 key（见 VIDEO_SIZE_PRESETS）
      assets: [],
      // [{id,type,title,url,status}]
      tasks: [],
      // [{id,label,status,progress,type,url}]
      canvas: [],
      // [{sceneId,x,y}] 无限画布位置
      history: [],
      // [{ts,type,summary}]
      createdAt: Date.now()
    };
  }
  function normalizeProject(p) {
    const d = p || {};
    return {
      ...d,
      scenes: Array.isArray(d.scenes) ? d.scenes : [],
      episodes: Array.isArray(d.episodes) ? d.episodes : [],
      shots: Array.isArray(d.shots) ? d.shots : [],
      dialogues: Array.isArray(d.dialogues) ? d.dialogues : [],
      sourceName: d.sourceName || null,
      sourceText: d.sourceText || null,
      sourceType: d.sourceType || null,
      dramaType: d.dramaType || "real",
      convertedAt: d.convertedAt || 0,
      novels: Array.isArray(d.novels) ? d.novels : [],
      scripts: Array.isArray(d.scripts) ? d.scripts : [],
      materials: d.materials && typeof d.materials === "object" ? d.materials : { characters: [], scenes: [] },
      videoSize: d.videoSize || DEFAULT_VIDEO_SIZE,
      assets: Array.isArray(d.assets) ? d.assets : [],
      tasks: Array.isArray(d.tasks) ? d.tasks : [],
      canvas: Array.isArray(d.canvas) ? d.canvas : [],
      history: Array.isArray(d.history) ? d.history : []
    };
  }
  function relTime(ts) {
    if (!ts) return "";
    const d = Date.now() - ts, m = 6e4, h = 36e5, dn = 864e5;
    if (d < m) return "\u521A\u521A";
    if (d < h) return Math.floor(d / m) + " \u5206\u949F\u524D";
    if (d < dn) return Math.floor(d / h) + " \u5C0F\u65F6\u524D";
    if (d < 7 * dn) return Math.floor(d / dn) + " \u5929\u524D";
    return new Date(ts).toLocaleDateString();
  }
  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1e3);
  }
  async function downloadUrl(url, filename) {
    try {
      const r = await fetch(url);
      const b = await r.blob();
      downloadBlob(filename, b);
      return true;
    } catch (e) {
      window.open(url, "_blank");
      return false;
    }
  }
  function pushHistory(history, type, summary) {
    return [{ ts: Date.now(), type, summary }, ...history || []].slice(0, 100);
  }
  var PROJECT_TEMPLATES = [
    {
      key: "sweet",
      name: "\u751C\u5BA0",
      emoji: "\u{1F36C}",
      idea: "\u4E00\u5BF9\u6B22\u559C\u51A4\u5BB6\u4ECE\u76F8\u9047\u5230\u76F8\u7231\u7684\u8F7B\u677E\u751C\u5BA0\u65E5\u5E38\u3002",
      script: "\u3010\u573A\u666F1\u3011\u521D\u9047\uFF1A\u5496\u5561\u9986\u91CC\u610F\u5916\u76F8\u649E\uFF0C\u5496\u5561\u6CFC\u4E86\u4E00\u8EAB\uFF0C\u4E24\u4EBA\u4E92\u4E0D\u76F8\u8BA9\u3002\n\n\u3010\u573A\u666F2\u3011\u518D\u9047\uFF1A\u516C\u53F8\u65B0\u6765\u7684\u5408\u4F19\u4EBA\u7ADF\u662F\u90A3\u4E2A\u201C\u6CFC\u5496\u5561\u7684\u201D\u3002\n\n\u3010\u573A\u666F3\u3011\u5FC3\u52A8\uFF1A\u96E8\u591C\u5171\u4F1E\uFF0C\u66A7\u6627\u6084\u7136\u53D1\u82BD\u3002"
    },
    {
      key: "revenge",
      name: "\u590D\u4EC7",
      emoji: "\u{1F525}",
      idea: "\u5973\u4E3B\u9690\u5FCD\u591A\u5E74\uFF0C\u4EE5\u5168\u65B0\u8EAB\u4EFD\u5F52\u6765\uFF0C\u5411\u5F53\u5E74\u80CC\u53DB\u5979\u7684\u4EBA\u4E00\u4E00\u6E05\u7B97\u3002",
      script: "\u3010\u573A\u666F1\u3011\u5F52\u6765\uFF1A\u5979\u4EE5\u96C6\u56E2\u987E\u95EE\u8EAB\u4EFD\u8E0F\u5165\u65E7\u5B85\uFF0C\u65E7\u4EBA\u7686\u672A\u8BA4\u51FA\u3002\n\n\u3010\u573A\u666F2\u3011\u4EA4\u950B\uFF1A\u4E0E\u53CD\u6D3E\u9996\u6B21\u6B63\u9762\u8FC7\u62DB\uFF0C\u4E0D\u52A8\u58F0\u8272\u57CB\u4E0B\u9690\u60A3\u3002\n\n\u3010\u573A\u666F3\u3011\u7FFB\u76D8\uFF1A\u5173\u952E\u8BC1\u636E\u66DD\u5149\uFF0C\u5C40\u52BF\u5F7B\u5E95\u9006\u8F6C\u3002"
    },
    {
      key: "inlaw",
      name: "\u5A46\u5AB3",
      emoji: "\u{1F3E0}",
      idea: "\u65B0\u5AB3\u5987\u5982\u4F55\u7528\u667A\u6167\u5316\u89E3\u5F3A\u52BF\u5A46\u5A46\u7684\u5201\u96BE\uFF0C\u628A\u5C0F\u5BB6\u7ECF\u8425\u5F97\u6709\u58F0\u6709\u8272\u3002",
      script: "\u3010\u573A\u666F1\u3011\u8FDB\u95E8\uFF1A\u7B2C\u4E00\u6B21\u5168\u5BB6\u5BB4\uFF0C\u6C14\u6C1B\u5FAE\u5999\u6697\u6D41\u6D8C\u52A8\u3002\n\n\u3010\u573A\u666F2\u3011\u51B2\u7A81\uFF1A\u80B2\u513F\u89C2\u5FF5\u4E4B\u4E89\u5728\u996D\u684C\u4E0A\u7206\u53D1\u3002\n\n\u3010\u573A\u666F3\u3011\u548C\u89E3\uFF1A\u4E00\u6B21\u610F\u5916\u8BA9\u4E24\u4EE3\u4EBA\u7EC8\u4E8E\u8BFB\u61C2\u5F7C\u6B64\u3002"
    },
    {
      key: "counter",
      name: "\u9006\u88AD",
      emoji: "\u{1F680}",
      idea: "\u5E95\u5C42\u5C0F\u4EBA\u7269\u6293\u4F4F\u65F6\u4EE3\u673A\u9047\uFF0C\u4E00\u8DEF\u9006\u98CE\u7FFB\u76D8\u3002",
      script: "\u3010\u573A\u666F1\u3011\u4F4E\u8C37\uFF1A\u88AB\u5408\u4F19\u4EBA\u80CC\u523A\uFF0C\u8D1F\u503A\u7D2F\u7D2F\u8D70\u6295\u65E0\u8DEF\u3002\n\n\u3010\u573A\u666F2\u3011\u8F6C\u673A\uFF1A\u4E00\u4EFD\u65E7\u5408\u540C\u91CC\u85CF\u7740\u7FFB\u76D8\u7684\u5173\u952E\u3002\n\n\u3010\u573A\u666F3\u3011\u9AD8\u5149\uFF1A\u7AD9\u5728\u53D1\u5E03\u4F1A\u805A\u5149\u706F\u4E0B\uFF0C\u6614\u4EBA\u54D7\u7136\u3002"
    },
    {
      key: "xuanhuan",
      name: "\u7384\u5E7B",
      emoji: "\u2694\uFE0F",
      idea: "\u5E9F\u67F4\u5C11\u5E74\u89C9\u9192\u8840\u8109\uFF0C\u8E0F\u4E0A\u9006\u5929\u4FEE\u884C\u7684\u70ED\u8840\u4E4B\u8DEF\u3002",
      script: "\u3010\u573A\u666F1\u3011\u89C9\u9192\uFF1A\u4F53\u5185\u5C01\u5370\u677E\u52A8\uFF0C\u7075\u6C14\u704C\u4F53\u60CA\u52A8\u5168\u65CF\u3002\n\n\u3010\u573A\u666F2\u3011\u8BD5\u70BC\uFF1A\u8E0F\u5165\u79D8\u5883\u906D\u9047\u5996\u517D\uFF0C\u7EDD\u5883\u4E2D\u9886\u609F\u5251\u610F\u3002\n\n\u3010\u573A\u666F3\u3011\u9006\u88AD\uFF1A\u4E00\u5251\u7834\u5929\uFF0C\u66FE\u7ECF\u8F7B\u89C6\u4ED6\u7684\u4EBA\u4FEF\u9996\u3002"
    }
  ];
  function templateProject(tpl, title2) {
    const base = defaultProject(title2 || tpl.name + "\u77ED\u5267");
    base.idea = tpl.idea || "";
    base.script = tpl.script || "";
    base.template = tpl.key;
    base.tags = [tpl.name];
    return base;
  }
  function dramaModifier(type) {
    switch (type) {
      case "anime":
        return "\u6574\u4F53\u4E3A\u4E8C\u6B21\u5143\u52A8\u6F2B\u98CE\u683C\uFF0C\u52A8\u753B\u8D5B\u7490\u7490\u4E0A\u8272\uFF0C\u65E5\u7CFB/\u56FD\u6F2B\u753B\u98CE\uFF0C\u9C9C\u660E\u8F6E\u5ED3\u7EBF\u4E0E\u5927\u9762\u79EF\u5E73\u6D82\u8272\u5757\uFF0C\u89D2\u8272\u4E3A\u52A8\u6F2B\u4EBA\u7269\uFF08\u975E\u771F\u4EBA\uFF09\uFF0C\u4E1C\u65B9\u4E9A\u6D32\u52A8\u6F2B\u9762\u5B54\uFF1B";
      case "semireal":
        return "\u6574\u4F53\u4E3A\u534A\u5199\u5B9E\u98CE\u683C\u5316\u6E32\u67D3\uFF0C\u4ECB\u4E8E\u771F\u4EBA\u4E0E\u52A8\u6F2B\u4E4B\u95F4\uFF0C\u67D4\u548C\u7B14\u89E6\u7ED3\u5408\u5199\u5B9E\u5149\u5F71\uFF0C\u89D2\u8272\u4E3A\u98CE\u683C\u5316\u4EBA\u7269\uFF1B";
      case "comic":
        return "\u6574\u4F53\u4E3A\u6F2B\u5267\u98CE\u683C\uFF0C\u6F2B\u753B\u5206\u955C\u52A8\u6001\u5316\uFF0C\u6E05\u6670\u9ED1\u8272\u63CF\u8FB9\u7EBF\u6761\u3001\u5E73\u6D82\u4E0A\u8272\u3001\u901F\u5EA6\u7EBF\u4E0E\u5BF9\u8BDD\u6846\u8D28\u611F\uFF0C\u89D2\u8272\u4E3A\u6F2B\u753B\u4EBA\u7269\uFF1B";
      case "real":
      default:
        return "\u6574\u4F53\u4E3A\u5199\u5B9E\u771F\u4EBA\u5F71\u89C6\u98CE\u683C\uFF0C\u771F\u4EBA\u6F14\u5458\u51FA\u6F14\uFF0C\u8D85\u5199\u5B9E\u76AE\u80A4\u4E0E\u6750\u8D28\uFF0C\u7535\u5F71\u7EA7\u6253\u5149\u4E0E\u666F\u6DF1\uFF0C\u65E0\u4E8C\u6B21\u5143/\u6F2B\u753B\u5316\u75D5\u8FF9\uFF1B";
    }
  }
  function cloneProject(project2, newTitle) {
    const copy = JSON.parse(JSON.stringify(project2 || {}));
    delete copy._trashAt;
    copy.id = "sd_" + Date.now();
    copy.title = newTitle || (project2 && project2.title || "\u9879\u76EE") + " \u526F\u672C";
    copy.createdAt = Date.now();
    return copy;
  }
  function packageProject(project2) {
    return {
      __type: "jinsu-sd-package",
      version: 1,
      exportedAt: Date.now(),
      app: "shortdrama",
      project: project2
    };
  }
  function isPackage(obj) {
    return obj && obj.__type === "jinsu-sd-package" && obj.project;
  }
  function metaOf(data) {
    return {
      title: data.title || "\u672A\u547D\u540D",
      tags: Array.isArray(data.tags) ? data.tags : [],
      pinned: !!data.pinned,
      archived: !!data.archived,
      template: data.template || "",
      thumbnail: data.thumbnail || null,
      createdAt: data.createdAt || Date.now()
    };
  }
  function repairAndParse(text, label2 = "JSON") {
    if (!text) throw new Error("AI \u672A\u8FD4\u56DE" + label2);
    try {
      return JSON.parse(text);
    } catch (_) {
    }
    let s2 = String(text).trim();
    s2 = s2.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    let cand = extractOuterJson(s2);
    if (!cand) cand = s2;
    cand = cand.replace(/\/\/.*$/gm, "").replace(/,\s*([}\]])/g, "$1");
    try {
      return JSON.parse(cand);
    } catch (_) {
    }
    cand = fixUnterminatedString(cand);
    cand = balanceBrackets(cand);
    cand = cand.replace(/,\s*([}\]])/g, "$1");
    try {
      return JSON.parse(cand);
    } catch (_) {
    }
    const prefix = longestValidJsonPrefix(cand);
    if (prefix) return prefix;
    try {
      const double = cand.replace(/([{,]\s*)'([^']+)'(\s*:)/g, '$1"$2"$3').replace(/:\s*'([^']*)'/g, ': "$1"');
      return JSON.parse(double);
    } catch (_) {
    }
    throw new Error(`AI \u8FD4\u56DE\u7684${label2}\u683C\u5F0F\u6709\u8BEF\uFF0C\u5DF2\u5C1D\u8BD5\u81EA\u52A8\u4FEE\u590D\u4ECD\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u6216\u6362\u4E2A\u6A21\u578B\u3002`);
  }
  function extractOuterJson(s2) {
    for (let i = 0; i < s2.length; i++) {
      const c = s2[i];
      if (c === "{" || c === "[") {
        const stack = [c === "{" ? "}" : "]"];
        let inStr = false;
        for (let j = i + 1; j < s2.length; j++) {
          const ch = s2[j];
          if (ch === "\\") {
            j++;
            continue;
          }
          if (ch === '"') {
            inStr = !inStr;
            continue;
          }
          if (inStr) continue;
          if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
          else if (ch === "}" || ch === "]") {
            if (stack[stack.length - 1] === ch) stack.pop();
            if (stack.length === 0) return s2.slice(i, j + 1);
          }
        }
      }
    }
    return "";
  }
  function longestValidJsonPrefix(s2) {
    for (let i = s2.length; i > 0; i--) {
      const ch = s2[i - 1];
      if (ch === "}" || ch === "]" || ch === '"') {
        const sub = s2.slice(0, i);
        try {
          return JSON.parse(sub);
        } catch (_) {
        }
      }
    }
    return null;
  }
  function fixUnterminatedString(s2) {
    let inStr = false;
    for (let i = 0; i < s2.length; i++) {
      const c = s2[i];
      if (c === "\\") {
        i++;
        continue;
      }
      if (c === '"') inStr = !inStr;
    }
    if (!inStr) return s2;
    return s2 + '"';
  }
  function balanceBrackets(s2) {
    let braces = 0, brackets = 0, inStr = false;
    for (let i = 0; i < s2.length; i++) {
      const c = s2[i];
      if (c === "\\") {
        i++;
        continue;
      }
      if (c === '"') {
        inStr = !inStr;
        continue;
      }
      if (inStr) continue;
      if (c === "{") braces++;
      else if (c === "}") braces--;
      else if (c === "[") brackets++;
      else if (c === "]") brackets--;
    }
    let tail = "";
    while (brackets-- > 0) tail += "]";
    while (braces-- > 0) tail += "}";
    return s2 + tail;
  }

  // src/utils/backend-api.js
  var DEFAULT_API_BASE = "https://api.jinsuai.cn";
  function baseUrl2() {
    return (typeof localStorage !== "undefined" && localStorage.getItem("DISPATCH_BASE_URL") || DEFAULT_API_BASE).replace(/\/$/, "");
  }
  var DISPATCH_TOKEN_KEY = "DISPATCH_TOKEN";
  var DISPATCH_USER_KEY = "DISPATCH_USER";
  function getAccessToken() {
    return localStorage.getItem(DISPATCH_TOKEN_KEY);
  }
  function getCurrentUser2() {
    const username = localStorage.getItem(DISPATCH_USER_KEY);
    if (!username) return null;
    return {
      username,
      nickname: username,
      phone: username
    };
  }
  function clearAuthData() {
    localStorage.removeItem("DISPATCH_TOKEN");
    localStorage.removeItem("DISPATCH_USER");
    localStorage.removeItem("DISPATCH_PASS");
    localStorage.removeItem("JINSU_LOGIN_PASSWORD");
  }
  function isLoggedIn() {
    return !!localStorage.getItem(DISPATCH_TOKEN_KEY);
  }
  async function request(path, options = {}) {
    const url = `${baseUrl2()}${path}`;
    const headers2 = {
      "Content-Type": "application/json",
      ...options.headers
    };
    const token2 = localStorage.getItem(DISPATCH_TOKEN_KEY);
    if (token2) {
      headers2["Authorization"] = `Bearer ${token2}`;
    }
    try {
      const response = await fetch(url, { ...options, headers: headers2 });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.detail || "\u8BF7\u6C42\u5931\u8D25");
      }
      return data;
    } catch (error) {
      console.error("API\u8BF7\u6C42\u9519\u8BEF:", error);
      throw error;
    }
  }
  async function logout() {
    clearAuthData();
  }
  async function changePassword(oldPassword, newPassword) {
    throw new Error("\u4E91\u7AEF\u8C03\u5EA6\u673A\u6682\u672A\u63D0\u4F9B\u4FEE\u6539\u5BC6\u7801\u63A5\u53E3\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458\u5904\u7406");
  }
  async function fetchMe() {
    return request("/api/auth/me", { method: "GET" });
  }
  function pushBalance(credits) {
    try {
      if (typeof window !== "undefined" && typeof window.onCreditUpdate === "function") {
        window.onCreditUpdate(Number(credits) || 0);
      }
    } catch {
    }
  }
  async function getCreditBalance() {
    const me = await fetchMe();
    const c = Number(me?.credits ?? me?.balance ?? 0) || 0;
    return { balance: c, credits: c };
  }
  async function precheckCredits(amount, type = "video", description = "") {
    if (!getAccessToken()) {
      throw new Error("\u672A\u767B\u5F55\u8C03\u5EA6\u673A\uFF0C\u65E0\u6CD5\u6821\u9A8C\u79EF\u5206\u3002\u8BF7\u5148\u5728\u300C\u8BBE\u7F6E \u2192 \u8C03\u5EA6\u673A\u300D\u4E2D\u767B\u5F55\u3002");
    }
    const r = await request("/api/jobs/precheck", {
      method: "POST",
      body: JSON.stringify({ type, params: {} })
    });
    const balance = Number(r?.balance ?? 0) || 0;
    pushBalance(balance);
    return {
      sufficient: !!r?.sufficient,
      balance,
      required: Number(r?.required_credits ?? amount) || amount
    };
  }
  async function deductCredits(amount, type = "video", description = "", referenceId = "") {
    try {
      const me = await fetchMe();
      pushBalance(me?.credits);
    } catch {
    }
    return { success: true, amount, type, description, reference_id: referenceId };
  }

  // src/utils/pricing-utils.js
  var DEFAULT_PRICING = {
    // 图片生成
    image_generate: 3,
    // 配音生成（按模型+条收费）
    tts_hd_per_line: 2.5,
    tts_turbo_per_line: 1.5,
    tts_min_charge: 1,
    // 兼容旧字段（按字符数收费）
    tts_hd_per_100_chars: 0.25,
    tts_turbo_per_100_chars: 0.2,
    // 文字创建音色（成本9.9元=49.5积分）
    voice_design_preview_per_10k_chars: 2,
    voice_design_first_use: 60,
    voice_design_min_charge: 1,
    // LLM文本生成
    llm_script_analyze: 1,
    llm_script_quick_create: 3,
    llm_script_one_click: 1,
    llm_script_detailed: 5,
    llm_storyboard_split: 3,
    llm_character_extract: 2,
    llm_prompt_refine: 1,
    llm_episode_refine: 1,
    llm_shot_refine: 1,
    llm_scene_extract: 1,
    llm_subtitle_generate: 1,
    // 视频生成
    video_t2v_480p: 1,
    video_t2v_768p: 2,
    video_t2v_1080p: 4,
    video_i2v_480p: 1,
    video_i2v_768p: 2,
    video_i2v_1080p: 4,
    video_r2v_480p: 2,
    video_r2v_768p: 3,
    video_r2v_1080p: 5,
    video_ia2v_480p: 2,
    video_ia2v_768p: 3,
    video_ia2v_1080p: 5,
    // 3D生成
    threed_character_four_views: 8,
    threed_character_3d_model: 25,
    threed_scene_concept_image: 3,
    threed_scene_3d_model: 25,
    // 充值套餐
    credit_packages: [
      { name: "\u4F53\u9A8C\u5305", price: 6, credits: 30, bonus: 0, desc: "1:5" },
      { name: "\u57FA\u7840\u5305", price: 30, credits: 160, bonus: 10, desc: "1:5.3" },
      { name: "\u521B\u4F5C\u5305", price: 98, credits: 550, bonus: 60, desc: "1:5.6" },
      { name: "\u5DE5\u4F5C\u5BA4\u5305", price: 298, credits: 1800, bonus: 300, desc: "1:6" },
      { name: "\u4F01\u4E1A\u5305", price: 698, credits: 4500, bonus: 1e3, desc: "1:6.4" }
    ],
    // 会员套餐
    membership_packages: [
      { name: "\u6708\u5361", price: 29, credits: 100, discount: 0.9, discount_label: "9\u6298", duration_days: 30, benefits: "\u4F18\u5148\u961F\u5217\u3001\u53BB\u6C34\u5370" },
      { name: "\u5B63\u5361", price: 79, credits: 350, discount: 0.85, discount_label: "85\u6298", duration_days: 90, benefits: "\u6708\u5361\u5168\u90E8 + \u9AD8\u6E05\u5BFC\u51FA" },
      { name: "\u5E74\u5361", price: 268, credits: 1300, discount: 0.8, discount_label: "8\u6298", duration_days: 365, benefits: "\u5B63\u5361\u5168\u90E8 + \u4E13\u5C5E\u6A21\u578B\u3001\u5BA2\u670D\u4F18\u5148" }
    ],
    // 汇率
    exchange_rate: 5,
    new_user_bonus: 8
  };
  function getPricing() {
    return window.APP_PRICING || DEFAULT_PRICING;
  }
  function getPrice(key, defaultValue = 0) {
    const pricing = getPricing();
    return pricing[key] !== void 0 ? pricing[key] : defaultValue;
  }
  function calcVideoPrice(mode, resolution, duration) {
    const pricing = getPricing();
    const resKey = resolution.includes("1080") ? "1080p" : resolution.includes("480") ? "480p" : "768p";
    const priceKey = `video_${mode}_${resKey}`;
    const perSec = getPrice(priceKey, 2);
    return perSec * duration;
  }
  function getCreditPackages() {
    return getPricing().credit_packages || DEFAULT_PRICING.credit_packages;
  }
  function getMembershipPackages() {
    return getPricing().membership_packages || DEFAULT_PRICING.membership_packages;
  }

  // src/components/NewScript/NewScriptModule.jsx
  var robustParseJSON = (text) => {
    if (!text) return null;
    let clean = text.trim();
    clean = clean.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const firstBrace = clean.indexOf("{");
    const lastBrace = clean.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      clean = clean.slice(firstBrace, lastBrace + 1);
    }
    try {
      return JSON.parse(clean);
    } catch (e) {
      console.log("[JSON\u89E3\u6790] \u76F4\u63A5\u89E3\u6790\u5931\u8D25\uFF0C\u5C1D\u8BD5\u4FEE\u590D:", e.message);
    }
    try {
      const fixed = clean.replace(/'/g, '"');
      return JSON.parse(fixed);
    } catch (e) {
      console.log("[JSON\u89E3\u6790] \u5355\u5F15\u53F7\u4FEE\u590D\u5931\u8D25:", e.message);
    }
    try {
      const fixed = clean.replace(/,\s*([}\]])/g, "$1");
      return JSON.parse(fixed);
    } catch (e) {
      console.log("[JSON\u89E3\u6790] \u53BB\u5C3E\u9017\u53F7\u5931\u8D25:", e.message);
    }
    try {
      const start = clean.indexOf("{");
      if (start === -1) return null;
      let truncated = clean.slice(start);
      if (!truncated.endsWith("}")) {
        const lastCompleteQuote = truncated.lastIndexOf('"');
        if (lastCompleteQuote > 0) {
          const beforeQuote = truncated.slice(0, lastCompleteQuote + 1);
          truncated = beforeQuote + "}";
        } else {
          truncated = truncated + "}";
        }
      }
      return JSON.parse(truncated);
    } catch (e) {
      console.log("[JSON\u89E3\u6790] \u622A\u65AD\u4FEE\u590D\u5931\u8D25:", e.message);
    }
    return null;
  };
  function NewScriptModule({ project: project2, update, log, onSwitchTab }) {
    const [newModalOpen, setNewModalOpen] = (0, import_react.useState)(false);
    const [loading, setLoading] = (0, import_react.useState)(false);
    const [debugInfo, setDebugInfo] = (0, import_react.useState)("");
    const [outline, setOutline] = (0, import_react.useState)(null);
    const fileInputRef = (0, import_react.useRef)(null);
    const handleUpload = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const name = file.name.replace(/\.[^/.]+$/, "");
      const ext = file.name.split(".").pop().toLowerCase();
      let scriptContent = "";
      setLoading(true);
      log(`\u6B63\u5728\u8BFB\u53D6\u6587\u4EF6\uFF1A${file.name}`);
      try {
        if (ext === "docx" || ext === "doc") {
          try {
            const ab = await file.arrayBuffer();
            const res = await import_mammoth.default.extractRawText({ arrayBuffer: ab });
            scriptContent = res.value || res.errorMessage || "";
          } catch (zipErr) {
            scriptContent = "\u4E0A\u4F20\u7684 " + ext + " \u6587\u4EF6\u89E3\u6790\u5931\u8D25\uFF1A" + zipErr.message + "\u3002\u8BF7\u5C06\u6587\u6863\u5185\u5BB9\u590D\u5236\u7C98\u8D34\u5230\u65B0\u5EFA\u5267\u672C\u4E2D\u3002";
          }
        } else {
          scriptContent = await readTextFileAuto(file);
          scriptContent = scriptContent.slice(0, 5e4);
        }
        log("\u6B63\u5728\u5206\u6790\u5267\u672C\u5185\u5BB9...");
        if (!isLoggedIn()) {
          alert("\u8BF7\u5148\u767B\u5F55\u540E\u518D\u4F7F\u7528\u4E0A\u4F20\u5267\u672CAI\u5206\u6790\u529F\u80FD");
          setLoading(false);
          return;
        }
        const analyzePrice = getPrice("llm_script_analyze", 1);
        try {
          const precheck2 = await precheckCredits(analyzePrice, "text", "\u4E0A\u4F20\u5267\u672CAI\u5206\u6790");
          if (!precheck2.sufficient && precheck2.sufficient !== void 0) {
            log(`\u274C \u79EF\u5206\u4E0D\u8DB3\uFF1A\u9700\u8981${analyzePrice}\u79EF\u5206\uFF0C\u5F53\u524D\u4F59\u989D${precheck2.balance || 0}\u79EF\u5206`);
            alert(`\u79EF\u5206\u4E0D\u8DB3\uFF01\u4E0A\u4F20\u5267\u672CAI\u5206\u6790\u9700\u8981${analyzePrice}\u79EF\u5206\uFF0C\u5F53\u524D\u4F59\u989D${precheck2.balance || 0}\u79EF\u5206\u3002\u8BF7\u5145\u503C\u540E\u518D\u8BD5\u3002`);
            setLoading(false);
            return;
          }
        } catch (e2) {
          log(`\u26A0\uFE0F \u79EF\u5206\u9884\u6821\u9A8C\u5931\u8D25\uFF1A${e2.message}`);
        }
        try {
          const prompt = `\u4F60\u662F\u4E00\u540D\u4E13\u4E1A\u7AD6\u5C4F\u77ED\u5267\u7F16\u5267\u3002\u8BF7\u5C06\u4EE5\u4E0B\u5267\u672C\u5185\u5BB9**\u5B8C\u6574\u62C6\u5206\u4E3A\u6240\u6709\u96C6**\uFF0C\u4E0D\u8981\u7701\u7565\u4EFB\u4F55\u5185\u5BB9\uFF0C\u5E76\u63D0\u53D6\u6240\u6709\u4EBA\u7269\u4FE1\u606F\u3002

\u8981\u6C42\uFF1A
1. **\u5FC5\u987B\u5B8C\u6574\u62C6\u5206\u6240\u6709\u96C6**\uFF0C\u6839\u636E\u5267\u672C\u5185\u5BB9\u5224\u65AD\u603B\u96C6\u6570\uFF0C\u4E0D\u8981\u53EA\u62C610\u96C6\uFF0C\u6709\u591A\u5C11\u96C6\u5C31\u62C6\u591A\u5C11\u96C6
2. \u6BCF\u96C6\u65F6\u957F90-120\u79D2\uFF0C\u5BF9\u5E94300-500\u5B57\u5267\u672C\u5185\u5BB9
3. \u6BCF\u96C6\u5FC5\u987B\u6709\u660E\u786E\u7684\u51B2\u7A81\u70B9\u548C\u94A9\u5B50\uFF08\u7ED3\u5C3E\u7559\u60AC\u5FF5\uFF09
4. \u4EBA\u7269\u4FE1\u606F\u8981\u8BE6\u7EC6\uFF0C\u5305\u542B\u5916\u8C8C\u7279\u5F81\uFF08\u4FBF\u4E8EAI\u751F\u56FE\u4FDD\u6301\u4E00\u81F4\u6027\uFF09
5. **\u53EA\u8F93\u51FA\u7EAFJSON\uFF0C\u4E0D\u8981markdown\u4EE3\u7801\u5757\uFF0C\u4E0D\u8981\u89E3\u91CA\uFF0C\u4E0D\u8981\u7701\u7565\u53F7**
6. episodes\u6570\u7EC4\u5FC5\u987B\u5305\u542B\u6240\u6709\u96C6\uFF0C\u4E0D\u80FD\u622A\u65AD

\u5267\u672C\u5185\u5BB9\uFF1A
${scriptContent.slice(0, 2e4)}

\u8F93\u51FAJSON\u683C\u5F0F\uFF1A
{
  "synopsis": "\u6545\u4E8B\u6897\u6982\uFF08\u5FC5\u586B\uFF0C150-200\u5B57\uFF0C\u542B\u6838\u5FC3\u51B2\u7A81\u548C\u5356\u70B9\uFF0C\u4E0D\u80FD\u4E3A\u7A7A\uFF09",
  "episodes": [
    {"title": "\u7B2CX\u96C6\uFF1A\u5438\u5F15\u4EBA\u7684\u6807\u9898", "content": "\u672C\u96C6\u5B8C\u6574\u5267\u672C\uFF08300-500\u5B57\uFF0C\u542B\u573A\u666F\u63CF\u8FF0\u548C\u4EBA\u7269\u5BF9\u8BDD\uFF09"}
  ],
  "characters": [
    {"name": "\u89D2\u8272\u540D", "role": "\u8EAB\u4EFD/\u804C\u4E1A", "personality": "\u6027\u683C\u7279\u70B9\uFF083-5\u4E2A\u5173\u952E\u8BCD\uFF09", "appearance": "\u5916\u8C8C\u63CF\u8FF0\uFF08\u5E74\u9F84/\u53D1\u578B/\u8138\u578B/\u670D\u88C5/\u4F53\u578B\uFF0C\u4FBF\u4E8EAI\u751F\u56FE\uFF09"}
  ],
  "scenes": [
    {"title": "\u573A\u666F\u540D", "desc": "\u573A\u666F\u63CF\u8FF0\uFF08\u65F6\u95F4/\u5730\u70B9/\u73AF\u5883/\u6C1B\u56F4\uFF09"}
  ]
}`;
          const res = await api("/api/llm/chat", {
            method: "POST",
            body: JSON.stringify({
              messages: [{ role: "user", content: prompt }],
              max_tokens: 16384
            })
          });
          const text = res.text || "{}";
          console.log("[\u4E0A\u4F20\u5267\u672CLLM\u8F93\u51FA]", text);
          log("LLM\u8FD4\u56DE\u957F\u5EA6\uFF1A" + text.length + "\u5B57\u7B26");
          let parsed = robustParseJSON(text);
          if (!parsed) {
            log("JSON\u89E3\u6790\u5931\u8D25\uFF0C\u6309\u5B57\u6570\u667A\u80FD\u5206\u96C6");
            const chunkSize = 400;
            const chunks = [];
            for (let i = 0; i < scriptContent.length; i += chunkSize) {
              chunks.push(scriptContent.slice(i, i + chunkSize));
            }
            parsed = {
              synopsis: scriptContent.slice(0, 100),
              episodes: chunks.map((c, i) => ({ title: `\u7B2C${i + 1}\u96C6`, content: c })),
              characters: [],
              scenes: []
            };
          }
          let episodes = (parsed.episodes || []).map((ep, i) => ({
            id: `ep_${i + 1}`,
            title: ep.title || `\u7B2C${i + 1}\u96C6`,
            content: ep.content || ""
          }));
          if (episodes.length === 0) {
            log("episodes\u4E3A\u7A7A\uFF0C\u6309\u5B57\u6570\u667A\u80FD\u5206\u96C6");
            const chunkSize = 400;
            for (let i = 0; i < scriptContent.length; i += chunkSize) {
              episodes.push({
                id: `ep_${episodes.length + 1}`,
                title: `\u7B2C${episodes.length + 1}\u96C6`,
                content: scriptContent.slice(i, i + chunkSize)
              });
            }
          }
          let characters = (parsed.characters || []).map((c, i) => ({
            id: `char_${i + 1}`,
            name: c.name || `\u89D2\u8272${i + 1}`,
            role: c.role || "",
            personality: c.personality || "",
            appearance: c.appearance || "",
            image: null,
            locked: false
          }));
          if (characters.length === 0) {
            log("characters\u4E3A\u7A7A\uFF0C\u751F\u6210\u9ED8\u8BA4\u89D2\u8272");
            characters = [
              { id: "char_1", name: "\u4E3B\u89D2", role: "\u4E3B\u89D2", personality: "\u575A\u97E7", appearance: "", image: null, locked: false },
              { id: "char_2", name: "\u53CD\u6D3E", role: "\u53CD\u6D3E", personality: "\u72E1\u8BC8", appearance: "", image: null, locked: false },
              { id: "char_3", name: "\u914D\u89D2", role: "\u914D\u89D2", personality: "\u5584\u826F", appearance: "", image: null, locked: false }
            ];
          }
          const scenes = (parsed.scenes || []).map((s2, i) => ({
            id: `scene_${i + 1}`,
            episodeId: episodes[i]?.id || episodes[0]?.id || null,
            title: s2.title || `\u573A\u666F${i + 1}`,
            desc: s2.desc || "",
            imageUrl: null,
            videoUrl: null
          }));
          const shots = [];
          update({
            title: name,
            script: scriptContent,
            outline: {
              synopsis: parsed.synopsis || scriptContent?.slice(0, 100) + "..." || "\u4E0A\u4F20\u7684\u5267\u672C\u5185\u5BB9",
              characters,
              relations: []
            },
            episodes,
            scenes,
            shots,
            materials: { characters }
          });
          log(`\u5267\u672C\u5206\u6790\u5B8C\u6210\uFF1A${episodes.length}\u96C6\uFF0C${characters.length}\u4E2A\u4EBA\u7269`);
          if (isLoggedIn()) {
            try {
              await deductCredits(analyzePrice, "text", "\u4E0A\u4F20\u5267\u672CAI\u5206\u6790", "");
              log(`\u2705 \u79EF\u5206\u6263\u51CF\u6210\u529F\uFF1A1\u79EF\u5206`);
              try {
                const balanceData = await getCreditBalance();
                if (window.onCreditUpdate) window.onCreditUpdate(balanceData.balance || balanceData.credits || 0);
                if (window.refreshUserInfo) window.refreshUserInfo();
              } catch (e2) {
              }
            } catch (e2) {
              log(`\u26A0\uFE0F \u79EF\u5206\u6263\u51CF\u5931\u8D25\uFF1A${e2.message}`);
            }
          }
        } catch (err) {
          log("\u5206\u6790\u5931\u8D25\uFF0C\u4F7F\u7528\u57FA\u7840\u6A21\u5F0F\uFF1A" + err.message);
          update({
            title: name,
            script: scriptContent,
            outline: {
              synopsis: "\u4E0A\u4F20\u7684\u5267\u672C\u5185\u5BB9",
              characters: []
            },
            episodes: [{ id: "ep_1", title: "\u7B2C1\u96C6", content: scriptContent.slice(0, 2e3) }],
            scenes: [{ id: "scene_1", title: "\u5F00\u573A", desc: scriptContent.slice(0, 500) }],
            materials: { characters: [] }
          });
        } finally {
          setLoading(false);
        }
      } catch (uploadErr) {
        log("\u6587\u4EF6\u8BFB\u53D6\u5931\u8D25\uFF1A" + uploadErr.message);
        setLoading(false);
      }
    };
    const generateScript = async (params) => {
      setLoading(true);
      if (!isLoggedIn()) {
        alert("\u8BF7\u5148\u767B\u5F55\u540E\u518D\u4F7F\u7528\u5267\u672C\u751F\u6210\u529F\u80FD");
        setLoading(false);
        return;
      }
      const quickCreatePrice = getPrice("llm_script_quick_create", 3);
      try {
        const precheck2 = await precheckCredits(quickCreatePrice, "text", "\u5267\u672C\u751F\u6210-\u5FEB\u901F\u521B\u5EFA");
        if (!precheck2.sufficient && precheck2.sufficient !== void 0) {
          log(`\u274C \u79EF\u5206\u4E0D\u8DB3\uFF1A\u9700\u8981${quickCreatePrice}\u79EF\u5206\uFF0C\u5F53\u524D\u4F59\u989D${precheck2.balance || 0}\u79EF\u5206`);
          alert(`\u79EF\u5206\u4E0D\u8DB3\uFF01\u5FEB\u901F\u521B\u5EFA\u5267\u672C\u9700\u8981${quickCreatePrice}\u79EF\u5206\uFF0C\u5F53\u524D\u4F59\u989D${precheck2.balance || 0}\u79EF\u5206\u3002\u8BF7\u5145\u503C\u540E\u518D\u8BD5\u3002`);
          setLoading(false);
          return;
        }
      } catch (e) {
        log(`\u26A0\uFE0F \u79EF\u5206\u9884\u6821\u9A8C\u5931\u8D25\uFF1A${e.message}`);
      }
      try {
        const episodeCount = parseInt(params.episodes) || 5;
        const prompt = `\u4F60\u662F\u4E00\u540D\u7206\u6B3E\u7AD6\u5C4F\u77ED\u5267\u7F16\u5267\u3002\u8BF7\u6839\u636E\u4EE5\u4E0B\u53C2\u6570\u751F\u6210\u5B8C\u6574\u7684\u5267\u672C\u5927\u7EB2\u548C\u5206\u96C6\u5185\u5BB9\u3002

\u3010\u521B\u4F5C\u8981\u6C42\u3011
1. \u7AD6\u5C4F\u77ED\u5267\uFF0C\u6BCF\u96C690-120\u79D2\uFF08300-500\u5B57\uFF09
2. \u5F00\u59343\u79D2\u5FC5\u987B\u6709\u5F3A\u94A9\u5B50\uFF08\u51B2\u7A81/\u60AC\u5FF5/\u53CD\u8F6C\uFF09
3. \u6BCF\u96C6\u7ED3\u5C3E\u7559\u60AC\u5FF5\uFF0C\u5F15\u5BFC\u770B\u4E0B\u4E00\u96C6
4. \u8282\u594F\u5FEB\uFF0C\u51B2\u7A81\u5BC6\u96C6\uFF0C\u723D\u70B9\u5145\u8DB3
5. \u4EBA\u7269\u8BBE\u5B9A\u8981\u5177\u4F53\uFF08\u5916\u8C8C\u63CF\u8FF0\u4FBF\u4E8EAI\u751F\u56FE\u4FDD\u6301\u4E00\u81F4\u6027\uFF09
6. \u3010\u91CD\u8981\u3011\u53F0\u8BCD\u683C\u5F0F\u5FC5\u987B\u89C4\u8303\uFF1A\u6BCF\u53E5\u53F0\u8BCD\u5FC5\u987B\u4EE5"\u89D2\u8272\u540D\uFF1A\u53F0\u8BCD\u5185\u5BB9"\u683C\u5F0F\u5F00\u5934\uFF0C\u89D2\u8272\u540D\u8981\u660E\u786E\uFF0C\u4E0D\u80FD\u7528"\u4ED6/\u5979/\u4ED6\u4EEC"\u7B49\u4EE3\u8BCD\uFF0C\u4F8B\u5982\uFF1A"\u82CF\u5FF5\uFF1A\u4F60\u7EC8\u4E8E\u6765\u4E86\u3002"\u3001"\u82CF\u5A49\uFF1A\u5E9F\u7269\uFF0C\u4ECA\u5929\u4F60\u82E5\u4E0D\u628A\u300A\u6731\u96C0\u8BC0\u300B\u4EA4\u51FA\u6765..."
7. \u3010\u53F0\u8BCD\u6253\u78E8\u3011\u53F0\u8BCD\u5FC5\u987B\u7ECF\u8FC7\u7CBE\u5FC3\u6253\u78E8\uFF0C\u7CBE\u70BC\u6709\u529B\uFF0C\u7B26\u5408\u4EBA\u7269\u6027\u683C\u548C\u8EAB\u4EFD\uFF0C\u6709\u8BB0\u5FC6\u70B9\u548C\u4F20\u64AD\u6027\uFF0C\u907F\u514D\u53E3\u6C34\u8BDD\u3001\u5E9F\u8BDD\u548C\u91CD\u590D\u8868\u8FBE\uFF1B\u5173\u952E\u53F0\u8BCD\u8981\u6709\u51B2\u51FB\u529B\u548C\u60C5\u7EEA\u5F20\u529B\uFF0C\u80FD\u8BA9\u89C2\u4F17\u4EA7\u751F\u5171\u9E23
8. \u3010\u91CD\u8981\u3011\u53EA\u8F93\u51FA\u7EAFJSON\uFF0C\u4E0D\u8981markdown\u4EE3\u7801\u5757\uFF0C\u4E0D\u8981\u89E3\u91CA\uFF0C\u4E0D\u8981\u591A\u4F59\u6587\u5B57\uFF0C\u3010\u91CD\u8981\u3011\u5FC5\u987B\u8FD4\u56DE\u5B8C\u6574\u95ED\u5408\u7684JSON\uFF0C\u4E0D\u8981\u622A\u65AD\uFF0C\u4E0D\u8981\u7701\u7565\u53F7

\u3010\u53C2\u6570\u3011
- \u5267\u672C\u7C7B\u578B\uFF1A${params.type}
- \u5267\u672C\u540D\u79F0\uFF1A${params.title || "\u672A\u547D\u540D"}
- \u96C6\u6570\uFF1A\u5FC5\u987B\u751F\u6210 ${episodeCount} \u96C6\uFF0C\u4E0D\u80FD\u5C11
- \u5355\u96C6\u65F6\u957F\uFF1A${params.duration}\u79D2
- \u4E3B\u89D2\u6027\u522B\uFF1A${params.gender}
- \u6838\u5FC3\u5173\u952E\u8BCD\uFF1A${params.keywords || "\u65E0"}

\u3010\u8F93\u51FAJSON\u683C\u5F0F\u3011\uFF08\u5FC5\u987B\u4E25\u683C\u6309\u7167\u6B64\u683C\u5F0F\uFF0C\u5305\u542B ${episodeCount} \u4E2Aepisodes\u548C\u81F3\u5C113\u4E2Acharacters\uFF09\uFF1A
{
  "synopsis": "\u6545\u4E8B\u6897\u6982\uFF08\u5FC5\u586B\uFF0C50-100\u5B57\uFF0C\u542B\u6838\u5FC3\u51B2\u7A81\u548C\u5356\u70B9\uFF09",
  "characters": [
    {"name": "\u4E3B\u89D2\u540D", "role": "\u8EAB\u4EFD/\u804C\u4E1A", "personality": "\u6027\u683C\u6807\u7B7E", "appearance": "\u5916\u8C8C\u63CF\u8FF0"},
    {"name": "\u53CD\u6D3E\u540D", "role": "\u8EAB\u4EFD/\u804C\u4E1A", "personality": "\u6027\u683C\u6807\u7B7E", "appearance": "\u5916\u8C8C\u63CF\u8FF0"},
    {"name": "\u914D\u89D2\u540D", "role": "\u8EAB\u4EFD/\u804C\u4E1A", "personality": "\u6027\u683C\u6807\u7B7E", "appearance": "\u5916\u8C8C\u63CF\u8FF0"}
  ],
  "episodes": [
    {"title": "\u7B2C1\u96C6\uFF1A\u6807\u9898", "content": "\u672C\u96C6\u5B8C\u6574\u5267\u672C300-500\u5B57"},
    {"title": "\u7B2C2\u96C6\uFF1A\u6807\u9898", "content": "\u672C\u96C6\u5B8C\u6574\u5267\u672C300-500\u5B57"}
  ]
}`;
        const res = await api("/api/llm/chat", {
          method: "POST",
          body: JSON.stringify({
            messages: [{ role: "user", content: prompt }],
            max_tokens: 16384
          })
        });
        const text = res.text || "{}";
        console.log("[LLM\u539F\u59CB\u8F93\u51FA]", text);
        log("LLM\u8FD4\u56DE\u957F\u5EA6\uFF1A" + text.length + "\u5B57\u7B26");
        let parsed = robustParseJSON(text);
        if (!parsed) {
          log("JSON\u89E3\u6790\u5931\u8D25\uFF0C\u4F7F\u7528\u539F\u59CB\u6587\u672C\u4F5C\u4E3A\u5185\u5BB9");
          parsed = {
            synopsis: text.slice(0, 100),
            episodes: Array.from({ length: episodeCount }, (_, i) => ({
              title: `\u7B2C${i + 1}\u96C6`,
              content: i === 0 ? text : `\u7B2C${i + 1}\u96C6\u5185\u5BB9\u5F85\u751F\u6210`
            })),
            characters: [
              { name: "\u4E3B\u89D2", role: "\u4E3B\u89D2", personality: "\u575A\u97E7", appearance: "" },
              { name: "\u53CD\u6D3E", role: "\u53CD\u6D3E", personality: "\u72E1\u8BC8", appearance: "" },
              { name: "\u914D\u89D2", role: "\u914D\u89D2", personality: "\u5584\u826F", appearance: "" }
            ]
          };
        }
        let episodes = (parsed.episodes || []).map((ep, i) => ({
          id: `ep_${i + 1}`,
          title: ep.title || `\u7B2C${i + 1}\u96C6`,
          content: ep.content || ""
        }));
        if (episodes.length < episodeCount) {
          log(`\u8B66\u544A\uFF1A\u6A21\u578B\u53EA\u8FD4\u56DE\u4E86${episodes.length}\u96C6\uFF0C\u8865\u5145\u5230${episodeCount}\u96C6`);
          for (let i = episodes.length; i < episodeCount; i++) {
            episodes.push({
              id: `ep_${i + 1}`,
              title: `\u7B2C${i + 1}\u96C6`,
              content: `\u7B2C${i + 1}\u96C6\u5185\u5BB9\u5F85\u751F\u6210`
            });
          }
        }
        const scenes = episodes.map((ep, i) => ({
          id: `scene_${i + 1}`,
          episodeId: ep.id,
          title: ep.title,
          desc: ep.content || ""
        }));
        let characters = parsed.characters || [];
        if (characters.length === 0) {
          characters = [
            { name: "\u4E3B\u89D2", role: "\u4E3B\u89D2", personality: "\u575A\u97E7", appearance: "" },
            { name: "\u53CD\u6D3E", role: "\u53CD\u6D3E", personality: "\u72E1\u8BC8", appearance: "" },
            { name: "\u914D\u89D2", role: "\u914D\u89D2", personality: "\u5584\u826F", appearance: "" }
          ];
        }
        const synopsis = parsed.synopsis || episodes[0]?.content?.slice(0, 80) + "..." || "\u7C7B\u578B\uFF1A" + params.type + "\uFF0C\u5173\u952E\u8BCD\uFF1A" + (params.keywords || "\u65E0");
        update({
          title: params.title || "\u65B0\u5267\u672C",
          type: params.type,
          episodes,
          outline: { synopsis, characters },
          scenes,
          materials: { characters }
        });
        setOutline(parsed);
        try {
          const currentAssets = project2?.assets || [];
          const scriptContent = JSON.stringify({ synopsis, characters, episodes, scenes }, null, 2);
          const newTextAsset = {
            id: "a_text_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8),
            type: "text",
            title: `${params.title || "\u65B0\u5267\u672C"}\uFF08\u5FEB\u901F\u521B\u5EFA\uFF0C${(/* @__PURE__ */ new Date()).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}\uFF09`,
            url: "",
            content: scriptContent,
            status: "ready",
            tags: ["\u5267\u672C\u751F\u6210", "\u5FEB\u901F\u521B\u5EFA", `${episodes.length}\u96C6`],
            favorite: false,
            episodeCount: episodes.length,
            characterCount: characters.length,
            createdAt: Date.now()
          };
          update({ assets: [newTextAsset, ...currentAssets] });
          log(`\u2705 \u5267\u672C\u5DF2\u5B58\u5165\u7D20\u6750\u5E93\uFF1A${newTextAsset.title}`);
        } catch (e) {
          log(`\u26A0\uFE0F \u5267\u672C\u5B58\u5165\u7D20\u6750\u5E93\u5931\u8D25\uFF1A${e.message}`);
        }
        log(`\u5267\u672C\u751F\u6210\u6210\u529F\uFF1A${episodes.length}\u96C6\uFF0C${characters.length}\u4E2A\u4EBA\u7269`);
        if (isLoggedIn()) {
          try {
            await deductCredits(quickCreatePrice, "text", "\u5267\u672C\u751F\u6210-\u5FEB\u901F\u521B\u5EFA", "");
            log(`\u2705 \u79EF\u5206\u6263\u51CF\u6210\u529F\uFF1A3\u79EF\u5206`);
            try {
              const balanceData = await getCreditBalance();
              if (window.onCreditUpdate) window.onCreditUpdate(balanceData.balance || balanceData.credits || 0);
              if (window.refreshUserInfo) window.refreshUserInfo();
            } catch (e) {
            }
          } catch (e) {
            log(`\u26A0\uFE0F \u79EF\u5206\u6263\u51CF\u5931\u8D25\uFF1A${e.message}`);
          }
        }
      } catch (e) {
        log("\u751F\u6210\u5931\u8D25\uFF1A" + e.message);
        console.error("[\u751F\u6210\u5931\u8D25]", e);
      } finally {
        setLoading(false);
      }
    };
    return /* @__PURE__ */ import_react.default.createElement("div", { style: { padding: 16, height: "100%", overflow: "auto", color: "var(--text)" } }, /* @__PURE__ */ import_react.default.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 } }, /* @__PURE__ */ import_react.default.createElement("h2", { style: { margin: 0, fontSize: 18 } }, "\u{1F3AC} \u5267\u672C\u521B\u4F5C"), /* @__PURE__ */ import_react.default.createElement("div", { style: { display: "flex", gap: 8 } }, /* @__PURE__ */ import_react.default.createElement("label", { style: { padding: "8px 16px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 13 } }, "\u{1F4C1} \u4E0A\u4F20\u5267\u672C\uFF08AI\u5206\u6790 $", getPrice("llm_script_analyze", 1), "\u79EF\u5206\uFF09", /* @__PURE__ */ import_react.default.createElement("input", { type: "file", accept: ".txt,.md,.docx", style: { display: "none" }, onChange: handleUpload })), /* @__PURE__ */ import_react.default.createElement("button", { style: { padding: "8px 16px", border: "none", borderRadius: 6, background: "linear-gradient(135deg, #7A5CFF, #5CE1E6)", color: "#fff", cursor: "pointer" }, onClick: () => setNewModalOpen(true) }, "+ \u65B0\u5EFA\u5267\u672C"))), /* @__PURE__ */ import_react.default.createElement("div", { style: { fontSize: 13, color: "var(--text-muted)", marginBottom: 16 } }, "\u652F\u6301\u4E0A\u4F20\u5267\u672C\u6216AI\u751F\u6210\u5B8C\u6574\u5267\u672C\uFF08\u5927\u7EB2+\u5206\u96C6+\u5206\u955C\uFF09"), project2.outline && /* @__PURE__ */ import_react.default.createElement("div", { style: { marginBottom: 16, padding: 16, border: "1px solid var(--border)", borderRadius: 12, background: "var(--panel-2)" } }, /* @__PURE__ */ import_react.default.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 } }, /* @__PURE__ */ import_react.default.createElement("h3", { style: { margin: 0, fontSize: 14 } }, "\u{1F4CB} \u5267\u672C\u5927\u7EB2"), project2.episodes && project2.episodes.length > 0 && /* @__PURE__ */ import_react.default.createElement("span", { style: { fontSize: 11, color: "var(--text-muted)" } }, project2.episodes.length, " \u96C6 \xB7 ", project2.outline.characters?.length || 0, " \u4E2A\u4EBA\u7269")), project2.outline.synopsis && /* @__PURE__ */ import_react.default.createElement("div", { style: { marginBottom: 12, padding: 10, background: "var(--input-bg)", borderRadius: 8 } }, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 } }, "\u6545\u4E8B\u6897\u6982"), /* @__PURE__ */ import_react.default.createElement("p", { style: { fontSize: 13, margin: 0, lineHeight: 1.6 } }, project2.outline.synopsis)), project2.outline.characters && project2.outline.characters.length > 0 && /* @__PURE__ */ import_react.default.createElement("div", { style: { marginBottom: 12 } }, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 } }, "\u4EBA\u7269\u5173\u7CFB"), /* @__PURE__ */ import_react.default.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 } }, project2.outline.characters.map((c, i) => /* @__PURE__ */ import_react.default.createElement("div", { key: i, style: { padding: "6px 10px", background: "rgba(122,92,255,0.15)", borderRadius: 6, border: "1px solid rgba(122,92,255,0.3)" } }, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: "#7A5CFF" } }, c.name), /* @__PURE__ */ import_react.default.createElement("div", { style: { fontSize: 10, color: "var(--text-muted)" } }, c.role, c.personality ? " \xB7 " + c.personality : "")))), project2.outline.relations && project2.outline.relations.length > 0 && /* @__PURE__ */ import_react.default.createElement("div", { style: { marginTop: 8, fontSize: 11, color: "var(--text-muted)" } }, "\u5173\u7CFB\uFF1A", project2.outline.relations.join("\u3001"))), project2.episodes && project2.episodes.length > 0 && /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 } }, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontSize: 11, color: "var(--text-secondary)" } }, "\u5206\u96C6\u5217\u8868\uFF08", project2.episodes.length, "\u96C6\uFF09"), /* @__PURE__ */ import_react.default.createElement(
      "button",
      {
        style: { fontSize: 11, padding: "2px 8px", border: "1px solid var(--border)", borderRadius: 4, background: "transparent", color: "var(--text)", cursor: "pointer" },
        onClick: () => onSwitchTab("storyboard")
      },
      "\u524D\u5F80\u5206\u955C \u2192"
    )), /* @__PURE__ */ import_react.default.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto" } }, project2.episodes.map((ep, i) => /* @__PURE__ */ import_react.default.createElement(
      "div",
      {
        key: i,
        style: { padding: "8px 12px", background: "var(--input-bg)", borderRadius: 6, fontSize: 12, cursor: "pointer", display: "flex", justifyContent: "space-between" },
        onClick: () => onSwitchTab("editor")
      },
      /* @__PURE__ */ import_react.default.createElement("span", { style: { fontWeight: 500 } }, ep.title),
      /* @__PURE__ */ import_react.default.createElement("span", { style: { color: "var(--text-muted)" } }, ep.content?.length || 0, " \u5B57")
    ))))), newModalOpen && /* @__PURE__ */ import_react.default.createElement(NewScriptModal, { onClose: () => setNewModalOpen(false), onCreated: (s2) => {
      log("\u65B0\u5267\u672C\uFF1A" + s2.title);
      setNewModalOpen(false);
    }, onGenerated: generateScript, log, update }), loading && /* @__PURE__ */ import_react.default.createElement("div", { style: { padding: 20, textAlign: "center", color: "var(--text-muted)" } }, "\u{1F916} AI \u6B63\u5728\u751F\u6210\u5267\u672C..."));
  }
  function NewScriptModal({ onClose, onCreated, onGenerated, log, update }) {
    const [mode, setMode] = (0, import_react.useState)("select");
    const [isVip, setIsVip] = (0, import_react.useState)(() => {
      try {
        return localStorage.getItem("USER_VIP_STATUS") === "true";
      } catch {
        return false;
      }
    });
    const [vipChecking, setVipChecking] = (0, import_react.useState)(true);
    (0, import_react.useEffect)(() => {
      const checkVip = () => {
        const explicitVipKeys = ["USER_VIP_STATUS", "VIP_STATUS", "MEMBERSHIP_STATUS", "IS_VIP", "IS_MEMBER"];
        for (const key of explicitVipKeys) {
          try {
            const val = localStorage.getItem(key);
            if (val === "true") {
              setIsVip(true);
              setVipChecking(false);
              return;
            }
          } catch {
          }
        }
        setIsVip(false);
        localStorage.setItem("USER_VIP_STATUS", "false");
        setVipChecking(false);
      };
      checkVip();
      const timer = setInterval(checkVip, 5e3);
      return () => clearInterval(timer);
    }, []);
    return /* @__PURE__ */ import_react.default.createElement("div", { style: overlay, onClick: onClose }, /* @__PURE__ */ import_react.default.createElement("div", { style: modal, onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ import_react.default.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: 16 } }, /* @__PURE__ */ import_react.default.createElement("h3", { style: { margin: 0 } }, "\u65B0\u5EFA\u5267\u672C"), /* @__PURE__ */ import_react.default.createElement("button", { style: { border: "none", background: "none", cursor: "pointer", fontSize: 18, color: "var(--text)" }, onClick: onClose }, "\xD7")), mode === "select" && /* @__PURE__ */ import_react.default.createElement("div", { style: { display: "flex", gap: 12 } }, /* @__PURE__ */ import_react.default.createElement("button", { style: cardBtn, onClick: () => setMode("quick") }, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontSize: 24 } }, "\u26A1"), /* @__PURE__ */ import_react.default.createElement("div", { style: { fontWeight: 600, marginTop: 8 } }, "\u5FEB\u901F\u521B\u5EFA"), /* @__PURE__ */ import_react.default.createElement("div", { style: { fontSize: 11, color: "var(--text-muted)", marginTop: 4 } }, "\u586B\u5199\u57FA\u672C\u4FE1\u606F\uFF0CAI\u81EA\u52A8\u751F\u6210\u5267\u672C")), /* @__PURE__ */ import_react.default.createElement("button", { style: { ...cardBtn, opacity: isVip ? 1 : 0.5, position: "relative" }, onClick: isVip ? () => setMode("detail") : void 0 }, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontSize: 24 } }, "\u{1F3AF}"), /* @__PURE__ */ import_react.default.createElement("div", { style: { fontWeight: 600, marginTop: 8 } }, "\u8BE6\u7EC6\u521B\u5EFA"), /* @__PURE__ */ import_react.default.createElement("div", { style: { fontSize: 11, color: "var(--text-muted)", marginTop: 4 } }, "VIP\u4E13\u5C5E \xB7 4\u6B65\u5B8C\u6574\u914D\u7F6E"), !isVip && /* @__PURE__ */ import_react.default.createElement("div", { style: { fontSize: 10, color: "#f59e0b", marginTop: 4 } }, "\u{1F512} VIP\u6743\u9650"))), mode === "quick" && /* @__PURE__ */ import_react.default.createElement(QuickCreate, { onDone: (s2) => {
      onCreated(s2);
      onClose();
    }, onBack: () => setMode("select"), onGenerate: onGenerated, onClose }), mode === "detail" && isVip && /* @__PURE__ */ import_react.default.createElement(DetailWizard, { onCreated: (s2) => {
      onCreated(s2);
      onClose();
    }, onClose, log, update }), mode === "detail" && !isVip && /* @__PURE__ */ import_react.default.createElement("div", { style: { textAlign: "center", padding: 20 } }, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontSize: 36, marginBottom: 12 } }, "\u{1F512}"), /* @__PURE__ */ import_react.default.createElement("div", { style: { fontSize: 14, color: "var(--text)" } }, "\u8BE6\u7EC6\u521B\u5EFA\u4E3A VIP \u529F\u80FD"), /* @__PURE__ */ import_react.default.createElement("div", { style: { fontSize: 12, color: "var(--text-muted)", marginTop: 8 } }, "\u8BA2\u9605\u4F1A\u5458\u540E\u53EF\u4F7F\u7528\u5B8C\u6574 4 \u6B65\u5411\u5BFC"), /* @__PURE__ */ import_react.default.createElement("button", { style: { marginTop: 16, padding: "8px 20px", border: "none", borderRadius: 6, background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", cursor: "pointer" }, onClick: () => {
      onClose();
      onCreated({ vipRequired: true });
    } }, "\u7ACB\u5373\u5F00\u901A VIP"))));
  }
  function QuickCreate({ onDone, onBack, onGenerate, onClose }) {
    const [form, setForm] = (0, import_react.useState)({
      type: "revenge",
      title: "",
      episodes: 10,
      duration: 120,
      gender: "female",
      keywords: ""
    });
    const [loading, setLoading] = (0, import_react.useState)(false);
    const [debugInfo, setDebugInfo] = (0, import_react.useState)("");
    const types = [
      { k: "revenge", n: "\u590D\u4EC7", e: "\u{1F525}" },
      { k: "sweet", n: "\u751C\u5BA0", e: "\u{1F36C}" },
      { k: "inlaw", n: "\u5A46\u5AB3", e: "\u{1F3E0}" },
      { k: "counter", n: "\u9006\u88AD", e: "\u{1F680}" },
      { k: "xuanhuan", n: "\u7384\u5E7B", e: "\u2694\uFE0F" },
      { k: "modern", n: "\u90FD\u5E02", e: "\u{1F306}" },
      { k: "ancient", n: "\u53E4\u88C5", e: "\u{1F451}" },
      { k: "trans", n: "\u7A7F\u8D8A", e: "\u{1F300}" },
      { k: "face", n: "\u6253\u8138", e: "\u{1F44A}" },
      { k: "suspense", n: "\u60AC\u7591", e: "\u{1F50D}" }
    ];
    const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const updateForm = update;
    const handleSubmit = async () => {
      if (onGenerate) {
        setLoading(true);
        try {
          await onGenerate(form);
          onClose();
        } finally {
          setLoading(false);
        }
      } else {
        onDone({ ...form, id: "script_" + Date.now(), createdAt: Date.now() });
        onClose();
      }
    };
    return /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("button", { style: { marginBottom: 12, padding: "6px 12px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", borderRadius: 6, cursor: "pointer" }, onClick: onBack }, "\u2190 \u8FD4\u56DE"), /* @__PURE__ */ import_react.default.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } }, /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 } }, "\u5267\u672C\u7C7B\u578B"), /* @__PURE__ */ import_react.default.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, types.map((t2) => /* @__PURE__ */ import_react.default.createElement("button", { key: t2.k, style: { padding: "4px 10px", border: form.type === t2.k ? "2px solid #7A5CFF" : "1px solid var(--border)", borderRadius: 6, background: form.type === t2.k ? "rgba(122,92,255,0.2)" : "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 }, onClick: () => updateForm("type", t2.k) }, t2.e, " ", t2.n)))), /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("label", { style: label }, "\u5267\u672C\u540D\u79F0\uFF08\u53EF\u7559\u7A7AAI\u751F\u6210\uFF09"), /* @__PURE__ */ import_react.default.createElement("input", { style: input, value: form.title, onChange: (e) => updateForm("title", e.target.value), placeholder: "\u5982\uFF1A\u91CD\u751F\u540E\u6211\u6210\u4E86\u603B\u88C1" })), /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("label", { style: label }, "\u96C6\u6570"), /* @__PURE__ */ import_react.default.createElement("input", { style: input, type: "number", value: form.episodes, onChange: (e) => updateForm("episodes", e.target.value), min: 1, max: 100 })), /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("label", { style: label }, "\u5355\u96C6\u65F6\u957F\uFF08\u79D2\uFF09"), /* @__PURE__ */ import_react.default.createElement("select", { style: input, value: form.duration, onChange: (e) => updateForm("duration", e.target.value) }, /* @__PURE__ */ import_react.default.createElement("option", { value: 90 }, "90\u79D2"), /* @__PURE__ */ import_react.default.createElement("option", { value: 120 }, "120\u79D2"))), /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("label", { style: label }, "\u4E3B\u89D2\u6027\u522B"), /* @__PURE__ */ import_react.default.createElement("select", { style: input, value: form.gender, onChange: (e) => updateForm("gender", e.target.value) }, /* @__PURE__ */ import_react.default.createElement("option", { value: "female" }, "\u5973\u9891"), /* @__PURE__ */ import_react.default.createElement("option", { value: "male" }, "\u7537\u9891"), /* @__PURE__ */ import_react.default.createElement("option", { value: "dual" }, "\u53CC\u4E3B\u89D2"))), /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("label", { style: label }, "\u6838\u5FC3\u5173\u952E\u8BCD\uFF08\u9009\u586B\uFF09"), /* @__PURE__ */ import_react.default.createElement("input", { style: input, value: form.keywords, onChange: (e) => updateForm("keywords", e.target.value), placeholder: "\u5982\uFF1A\u5931\u5FC6\u3001\u8C6A\u95E8\u3001\u771F\u5047\u5343\u91D1" }))), /* @__PURE__ */ import_react.default.createElement("button", { style: submitBtn, onClick: handleSubmit, disabled: loading }, loading ? "\u{1F916} AI \u751F\u6210\u4E2D..." : `\u{1F3AC} \u4E00\u952E\u751F\u6210\u5267\u672C\uFF08${getPrice("llm_script_one_click", 1)}\u79EF\u5206\uFF09`));
  }
  var overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 };
  var modal = { width: 600, maxWidth: "92vw", maxHeight: "90vh", overflow: "auto", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 };
  var cardBtn = { flex: 1, padding: 20, border: "1px solid var(--border)", borderRadius: 10, background: "var(--panel-2)", cursor: "pointer", color: "var(--text)", textAlign: "center" };
  var label = { display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 };
  var input = { width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 13, boxSizing: "border-box" };
  var submitBtn = { width: "100%", marginTop: 16, padding: "12px", border: "none", borderRadius: 8, background: "linear-gradient(135deg, #7A5CFF, #5CE1E6)", color: "#fff", cursor: "pointer", fontSize: 15, fontWeight: 600 };
  function DetailWizard({ onClose, onCreated, log, update }) {
    const [step, setStep] = (0, import_react.useState)(1);
    const [form, setForm] = (0, import_react.useState)({
      title: "",
      type: "revenge",
      customType: "",
      genre: "modern",
      characters: [{ name: "", role: "", personality: "", appearance: "" }],
      outline: "",
      keywords: "",
      episodes: 5,
      durationPerEpisode: 120
    });
    const [loading, setLoading] = (0, import_react.useState)(false);
    const [debugInfo, setDebugInfo] = (0, import_react.useState)("");
    const updateForm = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const updateChar = (i, k, v) => {
      const chars = [...form.characters];
      chars[i] = { ...chars[i], [k]: v };
      updateForm("characters", chars);
    };
    const addChar = () => updateForm("characters", [...form.characters, { name: "", role: "", personality: "", appearance: "" }]);
    const removeChar = (i) => updateForm("characters", form.characters.filter((_, idx) => idx !== i));
    const generateFull = async () => {
      console.log("[\u8BE6\u7EC6\u521B\u5EFA] \u70B9\u51FB\u751F\u6210\u6309\u94AE\uFF0Cform.title=", form.title, "form.type=", form.type, "form.episodes=", form.episodes, "form.durationPerEpisode=", form.durationPerEpisode);
      const _log = log || console.log;
      const _update = update || (() => {
      });
      const setDebug = (msg) => {
        setDebugInfo(msg);
        console.log("[\u8BE6\u7EC6\u521B\u5EFA]", msg);
      };
      const scriptTitle = form.title.trim() || `\u672A\u547D\u540D\u5267\u672C_${(/* @__PURE__ */ new Date()).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}`;
      setLoading(true);
      if (!isLoggedIn()) {
        alert("\u8BF7\u5148\u767B\u5F55\u540E\u518D\u4F7F\u7528\u8BE6\u7EC6\u521B\u5EFA\u529F\u80FD");
        setLoading(false);
        return;
      }
      const detailedPrice = getPrice("llm_script_detailed", 5);
      try {
        const precheck2 = await precheckCredits(detailedPrice, "text", "\u5267\u672C\u751F\u6210-\u8BE6\u7EC6\u521B\u5EFA");
        if (!precheck2.sufficient && precheck2.sufficient !== void 0) {
          _log(`\u274C \u79EF\u5206\u4E0D\u8DB3\uFF1A\u9700\u8981${detailedPrice}\u79EF\u5206\uFF0C\u5F53\u524D\u4F59\u989D${precheck2.balance || 0}\u79EF\u5206`);
          alert(`\u79EF\u5206\u4E0D\u8DB3\uFF01\u8BE6\u7EC6\u521B\u5EFA\u5267\u672C\u9700\u8981${detailedPrice}\u79EF\u5206\uFF0C\u5F53\u524D\u4F59\u989D${precheck2.balance || 0}\u79EF\u5206\u3002\u8BF7\u5145\u503C\u540E\u518D\u8BD5\u3002`);
          setLoading(false);
          return;
        }
      } catch (e) {
        _log(`\u26A0\uFE0F \u79EF\u5206\u9884\u6821\u9A8C\u5931\u8D25\uFF1A${e.message}`);
      }
      try {
        const charsJson = JSON.stringify(form.characters.filter((c) => c.name.trim()));
        const prompt = `\u4F60\u662F\u4E00\u540D\u4E13\u4E1A\u7AD6\u5C4F\u77ED\u5267\u7F16\u5267\u517C\u5206\u955C\u5BFC\u6F14\u3002\u8BF7\u6839\u636E\u4EE5\u4E0B\u8BE6\u7EC6\u8BBE\u5B9A\u751F\u6210\u5B8C\u6574\u7684\u5927\u7EB2\u548C\u5206\u96C6\u5185\u5BB9\u3002

\u521B\u4F5C\u8981\u6C42\uFF1A
1. \u7AD6\u5C4F\u77ED\u5267\uFF0C\u6BCF\u96C690-120\u79D2\uFF08300-500\u5B57\uFF09
2. \u4E25\u683C\u6309\u7167\u7528\u6237\u8BBE\u5B9A\u7684\u4EBA\u7269\u548C\u5267\u60C5\u751F\u6210\uFF0C\u4E0D\u8981\u64C5\u81EA\u66F4\u6539
3. \u5F00\u59343\u79D2\u5F3A\u94A9\u5B50\uFF0C\u6BCF\u96C6\u7ED3\u5C3E\u7559\u60AC\u5FF5
4. \u51B2\u7A81\u5BC6\u96C6\uFF0C\u8282\u594F\u5FEB\uFF0C\u723D\u70B9\u5145\u8DB3
5. \u573A\u666F\u63CF\u8FF0\u8981\u5177\u4F53\uFF08\u4FBF\u4E8EAI\u751F\u56FE/\u751F\u89C6\u9891\uFF09
6. \u3010\u91CD\u8981\u3011\u53F0\u8BCD\u683C\u5F0F\u5FC5\u987B\u89C4\u8303\uFF1A\u6BCF\u53E5\u53F0\u8BCD\u5FC5\u987B\u4EE5"\u89D2\u8272\u540D\uFF1A\u53F0\u8BCD\u5185\u5BB9"\u683C\u5F0F\u5F00\u5934\uFF0C\u89D2\u8272\u540D\u8981\u660E\u786E\uFF0C\u4E0D\u80FD\u7528"\u4ED6/\u5979/\u4ED6\u4EEC"\u7B49\u4EE3\u8BCD\uFF0C\u4F8B\u5982\uFF1A"\u82CF\u5FF5\uFF1A\u4F60\u7EC8\u4E8E\u6765\u4E86\u3002"\u3001"\u82CF\u5A49\uFF1A\u5E9F\u7269\uFF0C\u4ECA\u5929\u4F60\u82E5\u4E0D\u628A\u300A\u6731\u96C0\u8BC0\u300B\u4EA4\u51FA\u6765..."
7. \u3010\u53F0\u8BCD\u6253\u78E8\u3011\u53F0\u8BCD\u5FC5\u987B\u7ECF\u8FC7\u7CBE\u5FC3\u6253\u78E8\uFF0C\u7CBE\u70BC\u6709\u529B\uFF0C\u7B26\u5408\u4EBA\u7269\u6027\u683C\u548C\u8EAB\u4EFD\uFF0C\u6709\u8BB0\u5FC6\u70B9\u548C\u4F20\u64AD\u6027\uFF0C\u907F\u514D\u53E3\u6C34\u8BDD\u3001\u5E9F\u8BDD\u548C\u91CD\u590D\u8868\u8FBE\uFF1B\u5173\u952E\u53F0\u8BCD\u8981\u6709\u51B2\u51FB\u529B\u548C\u60C5\u7EEA\u5F20\u529B\uFF0C\u80FD\u8BA9\u89C2\u4F17\u4EA7\u751F\u5171\u9E23
8. \u53EA\u8F93\u51FA\u7EAFJSON\uFF0C\u4E0D\u8981markdown\u4EE3\u7801\u5757\uFF0C\u4E0D\u8981\u89E3\u91CA

\u8BBE\u5B9A\uFF1A
- \u5267\u672C\u540D\u79F0\uFF1A${scriptTitle}
- \u7C7B\u578B\uFF1A${form.type}
- \u65F6\u4EE3\uFF1A${form.genre}
- \u6838\u5FC3\u5173\u952E\u8BCD\uFF1A${form.keywords || "\u65E0"}
- \u6545\u4E8B\u5927\u7EB2\uFF1A${form.outline || "\uFF08\u7528\u6237\u672A\u63D0\u4F9B\uFF0C\u6839\u636E\u7C7B\u578B\u548C\u5173\u952E\u8BCD\u521B\u4F5C\uFF09"}
- \u4EBA\u7269\u8BBE\u5B9A\uFF1A${charsJson}
- \u96C6\u6570\uFF1A${form.episodes || 5}\u96C6
- \u6BCF\u96C6\u65F6\u957F\uFF1A${form.durationPerEpisode || 120}\u79D2\uFF08\u7EA6${Math.round((form.durationPerEpisode || 120) * 4)}\u5B57\uFF09

\u8F93\u51FAJSON\u683C\u5F0F\uFF1A
{
  "synopsis": "\u5B8C\u6574\u6545\u4E8B\u6897\u6982\uFF08\u5FC5\u586B\uFF0C200\u5B57\uFF0C\u542B\u6838\u5FC3\u51B2\u7A81\u3001\u4EBA\u7269\u5173\u7CFB\u3001\u7ED3\u5C40\u8D70\u5411\uFF0C\u4E0D\u80FD\u4E3A\u7A7A\uFF09",
  "episodes": [
    {"title": "\u7B2CX\u96C6\uFF1A\u5438\u5F15\u4EBA\u7684\u6807\u9898", "content": "\u672C\u96C6\u5B8C\u6574\u5267\u672C\uFF08\u7EA6${Math.round((form.durationPerEpisode || 120) * 4)}\u5B57\uFF0C\u542B\u573A\u666F\u63CF\u8FF0+\u4EBA\u7269\u5BF9\u8BDD+\u52A8\u4F5C\u63D0\u793A\uFF09"}
  ]
}`;
        setDebug("\u6B63\u5728\u8C03\u7528LLM API...");
        let res;
        try {
          res = await api("/api/llm/chat", {
            method: "POST",
            body: JSON.stringify({ messages: [{ role: "user", content: prompt }], max_tokens: 16384 })
          });
          setDebug("API\u8C03\u7528\u6210\u529F\uFF0C\u8FD4\u56DE\u7ED3\u6784\uFF1A" + JSON.stringify(res).slice(0, 200));
        } catch (apiErr) {
          setDebug("API\u8C03\u7528\u5931\u8D25\uFF1A" + apiErr.message);
          alert("\u5267\u672C\u751F\u6210\u5931\u8D25\uFF1A" + apiErr.message + "\n\n\u8BF7\u68C0\u67E5\u7F51\u7EDC\u8FDE\u63A5\u540E\u91CD\u8BD5\u3002");
          setLoading(false);
          return;
        }
        const text = res.text || "{}";
        setDebug("\u6A21\u578B\u8FD4\u56DEtext\u957F\u5EA6\uFF1A" + text.length + "\uFF0C\u524D100\u5B57\uFF1A" + text.slice(0, 100));
        if (!text || text === "{}" || text.length < 10) {
          setDebug("\u6A21\u578B\u8FD4\u56DE\u5185\u5BB9\u4E3A\u7A7A\uFF0C\u5B8C\u6574\u8FD4\u56DE\uFF1A" + JSON.stringify(res));
          alert("\u5267\u672C\u751F\u6210\u5931\u8D25\uFF1A\u6A21\u578B\u8FD4\u56DE\u5185\u5BB9\u4E3A\u7A7A\uFF0C\u8BF7\u91CD\u8BD5\u3002");
          setLoading(false);
          return;
        }
        let parsed = robustParseJSON(text);
        if (!parsed) {
          _log("JSON\u89E3\u6790\u5931\u8D25\uFF0C\u4F7F\u7528\u539F\u59CB\u6587\u672C");
          parsed = {
            synopsis: text.slice(0, 100),
            episodes: [{ title: "\u7B2C1\u96C6", content: text }]
          };
        }
        const targetEpisodes = parseInt(form.episodes) || 5;
        let episodes = (parsed.episodes || []).map((ep, i) => ({
          id: `ep_${i + 1}`,
          title: ep.title || `\u7B2C${i + 1}\u96C6`,
          content: ep.content || ""
        }));
        if (episodes.length < targetEpisodes) {
          _log(`\u8B66\u544A\uFF1A\u6A21\u578B\u53EA\u8FD4\u56DE${episodes.length}\u96C6\uFF0C\u8865\u5145\u5230${targetEpisodes}\u96C6`);
          for (let i = episodes.length; i < targetEpisodes; i++) {
            episodes.push({ id: `ep_${i + 1}`, title: `\u7B2C${i + 1}\u96C6`, content: `\u7B2C${i + 1}\u96C6\u5185\u5BB9\u5F85\u751F\u6210` });
          }
        }
        const scenes = episodes.map((ep, i) => ({
          id: `scene_${i + 1}`,
          episodeId: ep.id,
          title: ep.title,
          desc: ep.content || ""
        }));
        const characters = form.characters.filter((c) => c.name.trim()).map((c) => ({
          name: c.name,
          role: c.role,
          personality: c.personality,
          appearance: c.appearance
        }));
        const synopsis = parsed.synopsis || episodes[0]?.content?.slice(0, 80) + "..." || form.type + "\u9898\u6750\u77ED\u5267\uFF0C" + (form.genre || "") + "\u98CE\u683C";
        setDebug("\u6B63\u5728\u66F4\u65B0\u9879\u76EE\u72B6\u6001...");
        _update({
          title: scriptTitle,
          type: form.type,
          episodes,
          outline: { synopsis, characters },
          scenes,
          materials: { characters }
        });
        setDebug("\u9879\u76EE\u72B6\u6001\u66F4\u65B0\u5B8C\u6210\uFF0C\u5171 " + episodes.length + " \u96C6");
        try {
          const currentAssets = project?.assets || [];
          const scriptContent = JSON.stringify({ synopsis, characters, episodes, scenes }, null, 2);
          const newTextAsset = {
            id: "a_text_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8),
            type: "text",
            title: `${scriptTitle}\uFF08\u8BE6\u7EC6\u521B\u5EFA\uFF0C${(/* @__PURE__ */ new Date()).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}\uFF09`,
            url: "",
            content: scriptContent,
            status: "ready",
            tags: ["\u5267\u672C\u751F\u6210", "\u8BE6\u7EC6\u521B\u5EFA", `${episodes.length}\u96C6`],
            favorite: false,
            episodeCount: episodes.length,
            characterCount: characters.length,
            createdAt: Date.now()
          };
          update({ assets: [newTextAsset, ...currentAssets] });
          _log(`\u2705 \u5267\u672C\u5DF2\u5B58\u5165\u7D20\u6750\u5E93\uFF1A${newTextAsset.title}`);
        } catch (e) {
          _log(`\u26A0\uFE0F \u5267\u672C\u5B58\u5165\u7D20\u6750\u5E93\u5931\u8D25\uFF1A${e.message}`);
        }
        _log(`\u5267\u672C\u300C${scriptTitle}\u300D\u751F\u6210\u6210\u529F\uFF0C\u5171 ${episodes.length} \u96C6`);
        if (isLoggedIn()) {
          try {
            await deductCredits(detailedPrice, "text", "\u5267\u672C\u751F\u6210-\u8BE6\u7EC6\u521B\u5EFA", "");
            _log(`\u2705 \u79EF\u5206\u6263\u51CF\u6210\u529F\uFF1A5\u79EF\u5206`);
            try {
              const balanceData = await getCreditBalance();
              if (window.onCreditUpdate) window.onCreditUpdate(balanceData.balance || balanceData.credits || 0);
              if (window.refreshUserInfo) window.refreshUserInfo();
            } catch (e) {
            }
          } catch (e) {
            _log(`\u26A0\uFE0F \u79EF\u5206\u6263\u51CF\u5931\u8D25\uFF1A${e.message}`);
          }
        }
        setTimeout(() => onClose(), 500);
      } catch (e) {
        console.error("[\u8BE6\u7EC6\u521B\u5EFA] \u751F\u6210\u5F02\u5E38:", e);
        setDebug("\u751F\u6210\u5F02\u5E38\uFF1A" + e.message + "\n\u5806\u6808\uFF1A" + (e.stack || "").slice(0, 300));
      } finally {
        setLoading(false);
      }
    };
    const types = [
      { k: "revenge", n: "\u590D\u4EC7", e: "\u{1F525}" },
      { k: "sweet", n: "\u751C\u5BA0", e: "\u{1F36C}" },
      { k: "inlaw", n: "\u5A46\u5AB3", e: "\u{1F3E0}" },
      { k: "counter", n: "\u9006\u88AD", e: "\u{1F680}" },
      { k: "xuanhuan", n: "\u7384\u5E7B", e: "\u2694\uFE0F" },
      { k: "modern", n: "\u90FD\u5E02", e: "\u{1F306}" },
      { k: "ancient", n: "\u53E4\u88C5", e: "\u{1F451}" },
      { k: "trans", n: "\u7A7F\u8D8A", e: "\u{1F300}" },
      { k: "face", n: "\u6253\u8138", e: "\u{1F44A}" },
      { k: "suspense", n: "\u60AC\u7591", e: "\u{1F50D}" }
    ];
    const genres = [
      { k: "modern", n: "\u73B0\u4EE3" },
      { k: "ancient", n: "\u53E4\u88C5" },
      { k: "xianxia", n: "\u4ED9\u4FA0" },
      { k: "sci-fi", n: "\u79D1\u5E7B" }
    ];
    return /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 20 } }, [1, 2, 3, 4].map((s2) => /* @__PURE__ */ import_react.default.createElement("div", { key: s2, style: { flex: 1, height: 4, background: s2 <= step ? "#7A5CFF" : "var(--border)", borderRadius: 2 } }))), step === 1 && /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontSize: 14, fontWeight: 600, marginBottom: 12 } }, "\u6B65\u9AA4 1/4\uFF1A\u57FA\u672C\u4FE1\u606F"), /* @__PURE__ */ import_react.default.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } }, /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("label", { style: label }, "\u5267\u672C\u540D\u79F0\uFF08\u9009\u586B\uFF09"), /* @__PURE__ */ import_react.default.createElement("input", { style: input, value: form.title, onChange: (e) => updateForm("title", e.target.value), placeholder: "\u5982\uFF1A\u91CD\u751F\u4E4B\u7EDD\u4E16\u795E\u533B\uFF08\u4E0D\u586B\u5C06\u81EA\u52A8\u751F\u6210\uFF09" })), /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("label", { style: label }, "\u5267\u672C\u7C7B\u578B"), /* @__PURE__ */ import_react.default.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, types.map((t2) => /* @__PURE__ */ import_react.default.createElement("button", { key: t2.k, style: { padding: "4px 10px", border: form.type === t2.k && !form.customType ? "2px solid #7A5CFF" : "1px solid var(--border)", borderRadius: 6, background: form.type === t2.k && !form.customType ? "rgba(122,92,255,0.2)" : "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 }, onClick: () => {
      updateForm("type", t2.k);
      updateForm("customType", "");
    } }, t2.e, " ", t2.n))), /* @__PURE__ */ import_react.default.createElement("div", { style: { marginTop: 8 } }, /* @__PURE__ */ import_react.default.createElement("label", { style: { ...label, fontSize: 11 } }, "\u6216\u81EA\u5B9A\u4E49\u7C7B\u578B"), /* @__PURE__ */ import_react.default.createElement("input", { style: { ...input, fontSize: 12, padding: "6px 8px" }, value: form.customType, onChange: (e) => {
      updateForm("customType", e.target.value);
      if (e.target.value) updateForm("type", e.target.value);
    }, placeholder: "\u5982\uFF1A\u6B66\u4FA0\u3001\u79D1\u5E7B\u3001\u6821\u56ED..." }))), /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("label", { style: label }, "\u65F6\u4EE3\u80CC\u666F"), /* @__PURE__ */ import_react.default.createElement("div", { style: { display: "flex", gap: 6 } }, genres.map((g) => /* @__PURE__ */ import_react.default.createElement("button", { key: g.k, style: { flex: 1, padding: "6px 0", border: form.genre === g.k ? "2px solid #7A5CFF" : "1px solid var(--border)", borderRadius: 6, background: form.genre === g.k ? "rgba(122,92,255,0.2)" : "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 }, onClick: () => updateForm("genre", g.k) }, g.n)))), /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("label", { style: label }, "\u6838\u5FC3\u5173\u952E\u8BCD\uFF08\u9009\u586B\uFF09"), /* @__PURE__ */ import_react.default.createElement("input", { style: input, value: form.keywords, onChange: (e) => updateForm("keywords", e.target.value), placeholder: "\u5982\uFF1A\u5931\u5FC6\u3001\u8C6A\u95E8\u3001\u590D\u4EC7" })), /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("label", { style: label }, "\u96C6\u6570"), /* @__PURE__ */ import_react.default.createElement("input", { style: input, type: "number", min: "1", max: "100", value: form.episodes, onChange: (e) => updateForm("episodes", parseInt(e.target.value) || 5), placeholder: "\u5982\uFF1A5" })), /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("label", { style: label }, "\u6BCF\u96C6\u65F6\u957F\uFF08\u79D2\uFF09"), /* @__PURE__ */ import_react.default.createElement("input", { style: input, type: "number", min: "30", max: "300", value: form.durationPerEpisode, onChange: (e) => updateForm("durationPerEpisode", parseInt(e.target.value) || 120), placeholder: "\u5982\uFF1A120" }))), /* @__PURE__ */ import_react.default.createElement("div", { style: { display: "flex", justifyContent: "flex-end", marginTop: 16 } }, /* @__PURE__ */ import_react.default.createElement("button", { style: submitBtn, onClick: () => setStep(2) }, "\u4E0B\u4E00\u6B65 \u2192"))), step === 2 && /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 } }, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontSize: 14, fontWeight: 600 } }, "\u6B65\u9AA4 2/4\uFF1A\u4EBA\u7269\u8BBE\u5B9A"), /* @__PURE__ */ import_react.default.createElement("button", { style: { padding: "4px 10px", border: "1px solid var(--border)", borderRadius: 4, background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 }, onClick: addChar }, "+ \u6DFB\u52A0\u89D2\u8272")), /* @__PURE__ */ import_react.default.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 12 } }, form.characters.map((c, i) => /* @__PURE__ */ import_react.default.createElement("div", { key: i, style: { padding: 12, border: "1px solid var(--border)", borderRadius: 8, background: "var(--input-bg)" } }, /* @__PURE__ */ import_react.default.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 8 } }, /* @__PURE__ */ import_react.default.createElement("input", { style: { ...input, flex: 1 }, placeholder: "\u89D2\u8272\u59D3\u540D", value: c.name, onChange: (e) => updateChar(i, "name", e.target.value) }), /* @__PURE__ */ import_react.default.createElement("input", { style: { ...input, flex: 1 }, placeholder: "\u89D2\u8272\u8EAB\u4EFD", value: c.role, onChange: (e) => updateChar(i, "role", e.target.value) }), /* @__PURE__ */ import_react.default.createElement("button", { style: { padding: "4px 8px", border: "1px solid #ef4444", borderRadius: 4, background: "transparent", color: "#ef4444", cursor: "pointer" }, onClick: () => removeChar(i) }, "\u2715")), /* @__PURE__ */ import_react.default.createElement("div", { style: { display: "flex", gap: 8 } }, /* @__PURE__ */ import_react.default.createElement("input", { style: { ...input, flex: 1 }, placeholder: "\u6027\u683C\u6807\u7B7E", value: c.personality, onChange: (e) => updateChar(i, "personality", e.target.value) }), /* @__PURE__ */ import_react.default.createElement("input", { style: { ...input, flex: 1 }, placeholder: "\u5916\u8C8C\u63CF\u8FF0", value: c.appearance, onChange: (e) => updateChar(i, "appearance", e.target.value) }))))), /* @__PURE__ */ import_react.default.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 16 } }, /* @__PURE__ */ import_react.default.createElement("button", { style: { padding: "8px 16px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: "pointer" }, onClick: () => setStep(1) }, "\u2190 \u4E0A\u4E00\u6B65"), /* @__PURE__ */ import_react.default.createElement("button", { style: submitBtn, onClick: () => setStep(3) }, "\u4E0B\u4E00\u6B65 \u2192"))), step === 3 && /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontSize: 14, fontWeight: 600, marginBottom: 12 } }, "\u6B65\u9AA4 3/4\uFF1A\u6545\u4E8B\u5927\u7EB2"), /* @__PURE__ */ import_react.default.createElement("div", { style: { marginBottom: 12 } }, /* @__PURE__ */ import_react.default.createElement("label", { style: label }, "\u5B8C\u6574\u6545\u4E8B\u6897\u6982\uFF08AI \u5C06\u6839\u636E\u6B64\u751F\u6210\u5267\u60C5\uFF09"), /* @__PURE__ */ import_react.default.createElement("textarea", { style: { ...input, minHeight: 120, resize: "vertical" }, value: form.outline, onChange: (e) => updateForm("outline", e.target.value), placeholder: "\u8BF7\u8BE6\u7EC6\u63CF\u8FF0\u6545\u4E8B\u80CC\u666F\u3001\u4E3B\u8981\u51B2\u7A81\u3001\u4EBA\u7269\u5173\u7CFB\u548C\u7ED3\u5C40\u8D70\u5411..." })), /* @__PURE__ */ import_react.default.createElement("div", { style: { display: "flex", justifyContent: "space-between" } }, /* @__PURE__ */ import_react.default.createElement("button", { style: { padding: "8px 16px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: "pointer" }, onClick: () => setStep(2) }, "\u2190 \u4E0A\u4E00\u6B65"), /* @__PURE__ */ import_react.default.createElement("button", { style: submitBtn, onClick: () => setStep(4) }, "\u4E0B\u4E00\u6B65 \u2192"))), step === 4 && /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontSize: 14, fontWeight: 600, marginBottom: 12 } }, "\u6B65\u9AA4 4/4\uFF1A\u786E\u8BA4\u751F\u6210"), debugInfo && /* @__PURE__ */ import_react.default.createElement("div", { style: { padding: 10, background: "#1a1a2e", border: "1px solid #4facfe", borderRadius: 6, marginBottom: 12, fontSize: 11, color: "#4facfe", whiteSpace: "pre-wrap", maxHeight: 150, overflow: "auto" } }, /* @__PURE__ */ import_react.default.createElement("strong", null, "\u8C03\u8BD5\u4FE1\u606F\uFF1A"), "\\n", debugInfo), /* @__PURE__ */ import_react.default.createElement("div", { style: { padding: 16, background: "var(--input-bg)", borderRadius: 8, marginBottom: 16 } }, /* @__PURE__ */ import_react.default.createElement("div", { style: { marginBottom: 8 } }, /* @__PURE__ */ import_react.default.createElement("strong", null, "\u5267\u672C\u540D\u79F0\uFF1A"), form.title || "\uFF08\u672A\u586B\u5199\uFF0C\u5C06\u81EA\u52A8\u751F\u6210\uFF09"), /* @__PURE__ */ import_react.default.createElement("div", { style: { marginBottom: 8 } }, /* @__PURE__ */ import_react.default.createElement("strong", null, "\u7C7B\u578B\uFF1A"), form.customType || types.find((t2) => t2.k === form.type)?.n || form.type), /* @__PURE__ */ import_react.default.createElement("div", { style: { marginBottom: 8 } }, /* @__PURE__ */ import_react.default.createElement("strong", null, "\u65F6\u4EE3\uFF1A"), genres.find((g) => g.k === form.genre)?.n || form.genre), /* @__PURE__ */ import_react.default.createElement("div", { style: { marginBottom: 8 } }, /* @__PURE__ */ import_react.default.createElement("strong", null, "\u96C6\u6570\uFF1A"), form.episodes || 5, " \u96C6"), /* @__PURE__ */ import_react.default.createElement("div", { style: { marginBottom: 8 } }, /* @__PURE__ */ import_react.default.createElement("strong", null, "\u6BCF\u96C6\u65F6\u957F\uFF1A"), form.durationPerEpisode || 120, " \u79D2\uFF08\u7EA6", Math.round((form.durationPerEpisode || 120) * 4), "\u5B57\uFF09"), /* @__PURE__ */ import_react.default.createElement("div", { style: { marginBottom: 8 } }, /* @__PURE__ */ import_react.default.createElement("strong", null, "\u4EBA\u7269\uFF1A"), form.characters.filter((c) => c.name.trim()).length, " \u4F4D"), /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("strong", null, "\u5927\u7EB2\uFF1A"), form.outline ? `${form.outline.length} \u5B57` : "\uFF08\u672A\u586B\u5199\uFF0C\u5C06\u4F7F\u7528\u9ED8\u8BA4\u6A21\u677F\uFF09")), /* @__PURE__ */ import_react.default.createElement("div", { style: { display: "flex", justifyContent: "space-between" } }, /* @__PURE__ */ import_react.default.createElement("button", { style: { padding: "8px 16px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: "pointer" }, onClick: () => setStep(3) }, "\u2190 \u4E0A\u4E00\u6B65"), /* @__PURE__ */ import_react.default.createElement("button", { style: { ...submitBtn, background: "linear-gradient(135deg, #10b981, #059669)" }, onClick: generateFull, disabled: loading }, loading ? "\u{1F916} AI \u751F\u6210\u4E2D..." : `\u{1F3AC} \u786E\u8BA4\u751F\u6210\u5267\u672C\uFF08${getPrice("llm_script_detailed", 5)}\u79EF\u5206\uFF09`))));
  }

  // src/components/NewScript/CharacterManager.jsx
  var import_react2 = __toESM(__require("react"), 1);
  var STYLE_OPTIONS = [
    { value: "anime", label: "\u52A8\u6F2B/\u6E38\u620F\u539F\u753B", desc: "\u4E13\u4E1A\u89D2\u8272\u8BBE\u5B9A\u56FE\u98CE\u683C\uFF0C\u52A8\u6F2B/\u6E38\u620F\u539F\u753B\u54C1\u8D28" },
    { value: "realistic", label: "\u5199\u5B9E\u771F\u4EBA", desc: "\u8D85\u5199\u5B9E\u771F\u4EBA\u7167\u7247\u98CE\u683C\uFF0C\u771F\u5B9E\u76AE\u80A4\u8D28\u611F\uFF0C\u7535\u5F71\u7EA7\u5149\u5F71" },
    { value: "wuxia", label: "\u56FD\u98CE\u6B66\u4FA0", desc: "\u4E2D\u56FD\u53E4\u98CE\u6B66\u4FA0\u98CE\u683C\uFF0C\u6C34\u58A8\u610F\u5883\uFF0C\u4F20\u7EDF\u670D\u9970\uFF0C\u5DE5\u7B14\u91CD\u5F69" },
    { value: "cyberpunk", label: "\u8D5B\u535A\u670B\u514B", desc: "\u8D5B\u535A\u670B\u514B\u79D1\u5E7B\u98CE\u683C\uFF0C\u9713\u8679\u706F\u5149\uFF0C\u673A\u68B0\u4E49\u4F53\uFF0C\u672A\u6765\u90FD\u5E02" },
    { value: "moe", label: "\u4E8C\u6B21\u5143\u840C\u7CFB", desc: "\u65E5\u7CFB\u4E8C\u6B21\u5143\u840C\u7CFB\u98CE\u683C\uFF0C\u5927\u773C\u775B\uFF0C\u53EF\u7231\u753B\u98CE\uFF0C\u660E\u4EAE\u8272\u5F69" },
    { value: "3d", label: "3D\u6E32\u67D3", desc: "3D\u6E32\u67D3\u98CE\u683C\uFF0CPBR\u6750\u8D28\uFF0C\u6B21\u4E16\u4EE3\u6E38\u620F\u89D2\u8272\uFF0C\u7CBE\u7EC6\u5EFA\u6A21" }
  ];
  function CharacterManager({ project: project2, update, log }) {
    const characters = project2.materials?.characters || [];
    const [generatingCharIds, setGeneratingCharIds] = (0, import_react2.useState)({});
    const [previewImage, setPreviewImage] = (0, import_react2.useState)(null);
    const [selectedStyle, setSelectedStyle] = (0, import_react2.useState)("anime");
    const [showAddModal, setShowAddModal] = (0, import_react2.useState)(false);
    const [newChar, setNewChar] = (0, import_react2.useState)({ name: "", role: "", personality: "", appearance: "" });
    const analyzeCharacters = async () => {
      const script = project2.script || "";
      const outline = project2.outline?.synopsis || "";
      if (!script && !outline) {
        log("\u8BF7\u5148\u4E0A\u4F20\u6216\u521B\u4F5C\u5267\u672C");
        return;
      }
      if (!isLoggedIn()) {
        alert("\u8BF7\u5148\u767B\u5F55\u540E\u518D\u4F7F\u7528\u89D2\u8272\u63D0\u53D6\u529F\u80FD");
        return;
      }
      const charExtractPrice = getPrice("llm_character_extract", 2);
      try {
        const precheck2 = await precheckCredits(charExtractPrice, "text", "\u89D2\u8272\u63CF\u8FF0\u751F\u6210");
        if (!precheck2.sufficient && precheck2.sufficient !== void 0) {
          log(`\u274C \u79EF\u5206\u4E0D\u8DB3\uFF1A\u9700\u8981${charExtractPrice}\u79EF\u5206\uFF0C\u5F53\u524D\u4F59\u989D${precheck2.balance || 0}\u79EF\u5206`);
          alert(`\u79EF\u5206\u4E0D\u8DB3\uFF01\u81EA\u52A8\u63D0\u53D6\u89D2\u8272\u9700\u8981${charExtractPrice}\u79EF\u5206\uFF0C\u5F53\u524D\u4F59\u989D${precheck2.balance || 0}\u79EF\u5206\u3002\u8BF7\u5145\u503C\u540E\u518D\u8BD5\u3002`);
          return;
        }
      } catch (e) {
        log(`\u26A0\uFE0F \u79EF\u5206\u9884\u6821\u9A8C\u5931\u8D25\uFF1A${e.message}`);
      }
      log("\u6B63\u5728\u5206\u6790\u5267\u672C\u63D0\u53D6\u4EBA\u7269...");
      try {
        const content = script || outline;
        const prompt = `\u4F60\u662F\u4E00\u540D\u77ED\u5267\u89D2\u8272\u5206\u6790\u5E08\u3002\u8BF7\u4ECE\u4EE5\u4E0B\u5267\u672C\u5185\u5BB9\u4E2D\u63D0\u53D6\u6240\u6709\u4EBA\u7269\u4FE1\u606F\u3002

\u8981\u6C42\uFF1A
1. \u63D0\u53D6\u6240\u6709\u6709\u53F0\u8BCD\u6216\u91CD\u8981\u52A8\u4F5C\u7684\u89D2\u8272
2. \u5916\u8C8C\u63CF\u8FF0\u8981\u5177\u4F53\u8BE6\u7EC6\uFF08\u5E74\u9F84/\u6027\u522B/\u53D1\u578B/\u8138\u578B/\u4E94\u5B98/\u670D\u88C5/\u4F53\u578B/\u914D\u9970\uFF09\uFF0C\u4FBF\u4E8EAI\u751F\u56FE\u4FDD\u6301\u4EBA\u7269\u4E00\u81F4\u6027
3. \u6027\u683C\u75283-5\u4E2A\u5173\u952E\u8BCD\u6982\u62EC
4. \u53EA\u8F93\u51FA\u7EAFJSON\uFF0C\u4E0D\u8981markdown\u4EE3\u7801\u5757\uFF0C\u4E0D\u8981\u89E3\u91CA

\u5267\u672C\u5185\u5BB9\uFF1A
${content.slice(0, 5e3)}

\u8F93\u51FAJSON\u683C\u5F0F\uFF1A
{
  "characters": [
    {
      "name": "\u89D2\u8272\u59D3\u540D",
      "role": "\u8EAB\u4EFD/\u804C\u4E1A\uFF08\u5982\u4E3B\u89D2/\u53CD\u6D3E/\u914D\u89D2\uFF09",
      "personality": "\u6027\u683C\u7279\u70B9\uFF083-5\u4E2A\u5173\u952E\u8BCD\uFF0C\u5982\u9AD8\u51B7/\u8179\u9ED1/\u5584\u826F\uFF09",
      "appearance": "\u5916\u8C8C\u63CF\u8FF0\uFF08\u5E74\u9F84/\u53D1\u578B/\u8138\u578B/\u4E94\u5B98/\u4E0A\u8863/\u4E0B\u88C5/\u978B\u5C65/\u914D\u9970/\u4F53\u578B/\u8868\u60C5\u795E\u6001\uFF0C80-150\u5B57\uFF0C\u8981\u5177\u4F53\u5230\u80FD\u76F4\u63A5\u51FA\u56FE\uFF09"
    }
  ]
}`;
        const res = await api("/api/llm/chat", {
          method: "POST",
          body: JSON.stringify({
            messages: [{ role: "user", content: prompt }]
          })
        });
        const text = res.text || "{}";
        let parsed;
        try {
          const match = text.match(/\{[\s\S]*\}/);
          parsed = match ? JSON.parse(match[0]) : { characters: [] };
        } catch {
          parsed = { characters: [] };
        }
        const newCharacters = (parsed.characters || []).map((c, i) => ({
          id: `char_${Date.now()}_${i}`,
          name: c.name || `\u89D2\u8272${i + 1}`,
          role: c.role || "",
          personality: c.personality || "",
          appearance: c.appearance || "",
          image: null,
          locked: false
        }));
        const existingNames = new Set(characters.map((c) => c.name));
        const uniqueNewChars = newCharacters.filter((c) => !existingNames.has(c.name));
        const allCharacters = [...uniqueNewChars, ...characters];
        update({
          materials: { ...project2.materials, characters: allCharacters },
          outline: { ...project2.outline, characters: allCharacters }
        });
        log(`\u6210\u529F\u63D0\u53D6 ${uniqueNewChars.length} \u4E2A\u4EBA\u7269\uFF0C\u5171 ${allCharacters.length} \u4EBA`);
        if (isLoggedIn()) {
          try {
            await deductCredits(charExtractPrice, "text", "\u89D2\u8272\u63CF\u8FF0\u751F\u6210", "");
            log(`\u2705 \u79EF\u5206\u6263\u51CF\u6210\u529F\uFF1A2\u79EF\u5206`);
            try {
              const balanceData = await getCreditBalance();
              if (window.onCreditUpdate) window.onCreditUpdate(balanceData.balance || balanceData.credits || 0);
              if (window.refreshUserInfo) window.refreshUserInfo();
            } catch (e) {
            }
          } catch (e) {
            log(`\u26A0\uFE0F \u79EF\u5206\u6263\u51CF\u5931\u8D25\uFF1A${e.message}`);
          }
        }
      } catch (err) {
        log("\u63D0\u53D6\u4EBA\u7269\u5931\u8D25\uFF1A" + err.message);
      }
    };
    const generateCharacterImage = async (char) => {
      if (generatingCharIds[char.id]) return;
      setGeneratingCharIds((prev) => ({ ...prev, [char.id]: true }));
      if (!isLoggedIn()) {
        alert("\u8BF7\u5148\u767B\u5F55\u540E\u518D\u4F7F\u7528\u89D2\u8272\u751F\u56FE\u529F\u80FD");
        setGeneratingCharIds((prev) => {
          const next = { ...prev };
          delete next[char.id];
          return next;
        });
        return;
      }
      const charImagePrice = getPrice("image_generate", 3);
      try {
        const precheck2 = await precheckCredits(charImagePrice, "image", `\u89D2\u8272\u751F\u56FE\uFF1A${char.name}`);
        if (!precheck2.sufficient && precheck2.sufficient !== void 0) {
          log(`\u274C \u79EF\u5206\u4E0D\u8DB3\uFF1A\u9700\u8981${charImagePrice}\u79EF\u5206\uFF0C\u5F53\u524D\u4F59\u989D${precheck2.balance || 0}\u79EF\u5206`);
          alert(`\u79EF\u5206\u4E0D\u8DB3\uFF01\u751F\u6210\u89D2\u8272\u53C2\u8003\u56FE\u9700\u8981${charImagePrice}\u79EF\u5206\uFF0C\u5F53\u524D\u4F59\u989D${precheck2.balance || 0}\u79EF\u5206\u3002\u8BF7\u5145\u503C\u540E\u518D\u8BD5\u3002`);
          setGeneratingCharIds((prev) => {
            const next = { ...prev };
            delete next[char.id];
            return next;
          });
          return;
        }
      } catch (e) {
        log(`\u26A0\uFE0F \u79EF\u5206\u9884\u6821\u9A8C\u5931\u8D25\uFF1A${e.message}`);
      }
      log(`\u6B63\u5728\u4E3A\u300C${char.name}\u300D\u751F\u6210\u4EBA\u7269\u53C2\u8003\u56FE...`);
      try {
        const appearance = char.appearance || "";
        const personality = char.personality || "";
        const role = char.role || "";
        const genderHint = /(男主|先生|总裁|少爷|哥哥|弟弟|父亲|儿子|男|他)/.test(role + char.name + personality) ? "\u7537\u6027" : /(女主|小姐|夫人|公主|姐姐|妹妹|母亲|女儿|女|她)/.test(role + char.name + personality) ? "\u5973\u6027" : "";
        const styleObj = STYLE_OPTIONS.find((s2) => s2.value === selectedStyle) || STYLE_OPTIONS[0];
        const styleDesc = styleObj.desc;
        const prompt = `\u89D2\u8272\u8BBE\u5B9A\u4E09\u89C6\u56FE\uFF0C${char.name}\uFF0C${genderHint}\uFF0C${role}\uFF0C${appearance}\uFF0C\u6027\u683C\u6C14\u8D28\uFF1A${personality}\u3002\u540C\u4E00\u89D2\u8272\u7684\u4E09\u4E2A\u89C6\u89D2\u5E76\u6392\u5C55\u793A\uFF1A\u6B63\u9762\u89C6\u56FE\u3001\u4FA7\u9762\u89C6\u56FE\uFF08\u5DE6\u4FA7\uFF09\u3001\u80CC\u9762\u89C6\u56FE\u3002\u5168\u8EAB\u50CF\uFF0C\u81EA\u7136\u7AD9\u7ACB\u59FF\u52BF\uFF0C\u53CC\u81C2\u81EA\u7136\u4E0B\u5782\uFF0C\u53CC\u811A\u4E0E\u80A9\u540C\u5BBD\u3002\u7EAF\u767D\u8272\u65E0\u80CC\u666F\u80CC\u666F\uFF0C\u65E0\u9634\u5F71\uFF0C\u65E0\u73AF\u5883\u5143\u7D20\uFF0C\u7EAF\u51C0\u89D2\u8272\u8BBE\u5B9A\u56FE\u3002\u8D85\u9AD8\u6E05\u7EC6\u8282\uFF0C8K\u5206\u8FA8\u7387\uFF0C\u670D\u88C5\u7EB9\u7406\u6E05\u6670\uFF0C\u53D1\u578B\u51C6\u786E\uFF0C\u4F53\u578B\u4E00\u81F4\uFF0C\u4E09\u4E2A\u89C6\u89D2\u5916\u8C8C\u5B8C\u5168\u7EDF\u4E00\u3002${styleDesc}\u3002\u6CE8\u610F\uFF1A\u6B64\u89D2\u8272\u4E3A\u300C${char.name}\u300D\uFF0C\u8BF7\u6839\u636E\u5176\u8EAB\u4EFD\u300C${role}\u300D\u548C\u6027\u683C\u300C${personality}\u300D\u751F\u6210\u72EC\u7279\u7684\u5916\u8C8C\u548C\u670D\u88C5\uFF0C\u4E0D\u8981\u4E0E\u5176\u4ED6\u89D2\u8272\u6DF7\u6DC6\u3002`;
        const res = await generateImage({ prompt, model: "Qwen/Qwen-Image", size: "1328x1328", n: 1 });
        const imageUrl = res.image_url || res.url || res.images && res.images[0] || res.result_url;
        if (!imageUrl) throw new Error("\u672A\u8FD4\u56DE\u56FE\u7247\u5730\u5740");
        console.log("[\u4EBA\u7269\u751F\u6210] \u66F4\u65B0\u56FE\u7247\uFF0Cchar.id=", char.id, "imageUrl=", imageUrl.substring(0, 50));
        update((prev) => {
          const allChars = prev.materials?.characters || [];
          console.log("[\u4EBA\u7269\u751F\u6210] \u5F53\u524D\u4EBA\u7269\u5217\u8868:", allChars.map((c) => ({ id: c.id, name: c.name, hasImage: !!c.image })));
          const newChars = allChars.map((x) => {
            if (x.id === char.id) {
              console.log("[\u4EBA\u7269\u751F\u6210] \u5339\u914D\u5230\u4EBA\u7269:", x.name, "\uFF0C\u66F4\u65B0\u56FE\u7247");
              return { ...x, image: imageUrl };
            }
            return x;
          });
          return { materials: { ...prev.materials, characters: newChars } };
        });
        try {
          const currentAssets = project2?.assets || [];
          const newImageAsset = {
            id: "a_char_image_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8),
            type: "image",
            title: `${char.name}\u89D2\u8272\u53C2\u8003\u56FE\uFF08${styleObj.label}\uFF0C${(/* @__PURE__ */ new Date()).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}\uFF09`,
            url: imageUrl,
            status: "ready",
            tags: ["\u89D2\u8272\u751F\u56FE", styleObj.label, char.name],
            favorite: false,
            characterId: char.id,
            characterName: char.name,
            style: selectedStyle,
            createdAt: Date.now()
          };
          update({ assets: [newImageAsset, ...currentAssets] });
          log(`\u2705 \u89D2\u8272\u56FE\u5DF2\u5B58\u5165\u7D20\u6750\u5E93\uFF1A${newImageAsset.title}`);
        } catch (e) {
          log(`\u26A0\uFE0F \u89D2\u8272\u56FE\u5B58\u5165\u7D20\u6750\u5E93\u5931\u8D25\uFF1A${e.message}`);
        }
        log(`\u300C${char.name}\u300D\u53C2\u8003\u56FE\u751F\u6210\u6210\u529F`);
        if (isLoggedIn()) {
          try {
            await deductCredits(charImagePrice, "image", `\u89D2\u8272\u751F\u56FE\uFF1A${char.name}`, char.id);
            log(`\u2705 \u79EF\u5206\u6263\u51CF\u6210\u529F\uFF1A${charImagePrice}\u79EF\u5206`);
            try {
              const balanceData = await getCreditBalance();
              if (window.onCreditUpdate) window.onCreditUpdate(balanceData.balance || balanceData.credits || 0);
              if (window.refreshUserInfo) window.refreshUserInfo();
            } catch (e) {
            }
          } catch (e) {
            log(`\u26A0\uFE0F \u79EF\u5206\u6263\u51CF\u5931\u8D25\uFF1A${e.message}`);
          }
        }
      } catch (err) {
        log(`\u751F\u6210\u5931\u8D25\uFF1A${err.message}`);
      } finally {
        setGeneratingCharIds((prev) => {
          const next = { ...prev };
          delete next[char.id];
          return next;
        });
      }
    };
    return /* @__PURE__ */ import_react2.default.createElement("div", { style: { padding: 16, height: "100%", overflow: "auto", color: "var(--text)" } }, /* @__PURE__ */ import_react2.default.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 } }, /* @__PURE__ */ import_react2.default.createElement("h2", { style: { margin: 0, fontSize: 18 } }, "\u{1F464} \u4EBA\u7269\u7BA1\u7406"), /* @__PURE__ */ import_react2.default.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center" } }, /* @__PURE__ */ import_react2.default.createElement(
      "select",
      {
        value: selectedStyle,
        onChange: (e) => setSelectedStyle(e.target.value),
        style: { padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 13, cursor: "pointer" },
        title: "\u9009\u62E9\u751F\u56FE\u98CE\u683C"
      },
      STYLE_OPTIONS.map((s2) => /* @__PURE__ */ import_react2.default.createElement("option", { key: s2.value, value: s2.value }, s2.label))
    ), /* @__PURE__ */ import_react2.default.createElement(
      "button",
      {
        style: { padding: "8px 16px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 13 },
        onClick: analyzeCharacters
      },
      "\u{1F916} AI\u5206\u6790\u4EBA\u7269\uFF082\u79EF\u5206\uFF09"
    ), /* @__PURE__ */ import_react2.default.createElement(
      "button",
      {
        style: { padding: "8px 16px", border: "none", borderRadius: 6, background: "linear-gradient(135deg, #7A5CFF, #5CE1E6)", color: "#fff", cursor: "pointer", fontSize: 13 },
        onClick: () => {
          setNewChar({ name: "", role: "", personality: "", appearance: "" });
          setShowAddModal(true);
        }
      },
      "+ \u65B0\u589E\u89D2\u8272"
    ))), characters.length === 0 && /* @__PURE__ */ import_react2.default.createElement("div", { style: { padding: 40, textAlign: "center", color: "var(--text-muted)", border: "1px dashed var(--border)", borderRadius: 12 } }, "\u6682\u65E0\u89D2\u8272\uFF0C\u70B9\u51FB\u300CAI\u5206\u6790\u4EBA\u7269\u300D\u6216\u300C\u65B0\u589E\u89D2\u8272\u300D\u6DFB\u52A0"), /* @__PURE__ */ import_react2.default.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 } }, characters.map((c) => /* @__PURE__ */ import_react2.default.createElement("div", { key: c.id, style: { border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--panel-2)" } }, /* @__PURE__ */ import_react2.default.createElement("div", { style: { width: "100%", height: 160, background: "var(--input-bg)", borderRadius: 8, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48 } }, c.image ? /* @__PURE__ */ import_react2.default.createElement("img", { src: c.image, alt: c.name, style: { width: "100%", height: "100%", objectFit: "cover", borderRadius: 8, cursor: "zoom-in" }, onClick: () => setPreviewImage(c.image) }) : "\u{1F464}"), /* @__PURE__ */ import_react2.default.createElement("div", { style: { fontWeight: 600 } }, c.name), /* @__PURE__ */ import_react2.default.createElement("div", { style: { fontSize: 11, color: "var(--text-muted)", marginTop: 4 } }, c.role || "\u672A\u8BBE\u5B9A"), c.personality && /* @__PURE__ */ import_react2.default.createElement("div", { style: { fontSize: 10, color: "var(--text-secondary)", marginTop: 2 } }, "\u6027\u683C\uFF1A", c.personality), /* @__PURE__ */ import_react2.default.createElement("div", { style: { display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" } }, /* @__PURE__ */ import_react2.default.createElement(
      "button",
      {
        style: { flex: 1, minWidth: "45%", padding: "4px 0", border: generatingCharIds[c.id] ? "1px solid #f59e0b" : "1px solid #7A5CFF", borderRadius: 4, background: generatingCharIds[c.id] ? "rgba(245,158,11,0.15)" : "rgba(122,92,255,0.15)", color: generatingCharIds[c.id] ? "#f59e0b" : "#7A5CFF", fontSize: 11, cursor: generatingCharIds[c.id] ? "wait" : "pointer" },
        onClick: () => generateCharacterImage(c),
        disabled: generatingCharIds[c.id]
      },
      generatingCharIds[c.id] ? "\u23F3 \u751F\u6210\u4E2D..." : `\u{1F916} AI\u751F\u6210\uFF08${getPrice("image_generate", 3)}\u79EF\u5206\uFF09`
    ), /* @__PURE__ */ import_react2.default.createElement(
      "button",
      {
        style: { flex: 1, minWidth: "45%", padding: "4px 0", border: "1px solid var(--border)", borderRadius: 4, background: "transparent", color: "var(--text)", fontSize: 11, cursor: "pointer" },
        onClick: () => {
          const input2 = document.createElement("input");
          input2.type = "file";
          input2.accept = "image/*";
          input2.onchange = (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
              const img = ev.target.result;
              update((prev) => {
                const allChars = prev.materials?.characters || [];
                const newChars = allChars.map(
                  (x) => x.id === c.id ? { ...x, image: img } : x
                );
                return { materials: { ...prev.materials, characters: newChars } };
              });
              log(`\u5DF2\u4E0A\u4F20\u89D2\u8272 ${c.name} \u7684\u53C2\u8003\u56FE`);
            };
            reader.readAsDataURL(file);
          };
          input2.click();
        }
      },
      "\u{1F4F7} \u4E0A\u4F20\u56FE\u7247"
    ), /* @__PURE__ */ import_react2.default.createElement(
      "button",
      {
        style: { flex: 1, padding: "4px 0", border: "1px solid var(--border)", borderRadius: 4, background: "transparent", color: "var(--text)", fontSize: 11, cursor: "pointer" },
        onClick: () => {
          const url = window.prompt("\u6216\u901A\u8FC7 URL \u8BBE\u7F6E\u89D2\u8272\u56FE\u7247\uFF1A");
          if (url) update((prev) => {
            const allChars = prev.materials?.characters || [];
            const newChars = allChars.map((x) => x.id === c.id ? { ...x, image: url } : x);
            return { materials: { ...prev.materials, characters: newChars } };
          });
        }
      },
      "\u{1F517} URL \u56FE\u7247"
    ), /* @__PURE__ */ import_react2.default.createElement(
      "button",
      {
        style: { flex: 1, padding: "4px 0", border: "1px solid var(--border)", borderRadius: 4, background: c.locked ? "rgba(122,92,255,0.3)" : "transparent", color: c.locked ? "#7A5CFF" : "var(--text)", fontSize: 11, cursor: "pointer" },
        onClick: () => {
          update({ materials: { ...project2.materials, characters: characters.map((x) => x.id === c.id ? { ...x, locked: !x.locked } : x) } });
          log(c.locked ? "\u5DF2\u89E3\u9501\u89D2\u8272" : "\u5DF2\u9501\u5B9A\u89D2\u8272\u5F62\u8C61");
        }
      },
      c.locked ? "\u5DF2\u9501\u5B9A" : "\u9501\u5B9A"
    ))))), previewImage && /* @__PURE__ */ import_react2.default.createElement(
      "div",
      {
        style: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999, cursor: "zoom-out" },
        onClick: () => setPreviewImage(null)
      },
      /* @__PURE__ */ import_react2.default.createElement("img", { src: previewImage, alt: "\u9884\u89C8\u5927\u56FE", style: { maxWidth: "92%", maxHeight: "92%", objectFit: "contain", borderRadius: 8 } }),
      /* @__PURE__ */ import_react2.default.createElement("div", { style: { position: "absolute", top: 20, right: 20, color: "#fff", fontSize: 14, background: "rgba(0,0,0,0.5)", padding: "6px 12px", borderRadius: 6 } }, "\u70B9\u51FB\u4EFB\u610F\u5904\u5173\u95ED")
    ), showAddModal && /* @__PURE__ */ import_react2.default.createElement(
      "div",
      {
        style: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99998 },
        onClick: () => setShowAddModal(false)
      },
      /* @__PURE__ */ import_react2.default.createElement(
        "div",
        {
          style: { width: 480, maxWidth: "92vw", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 },
          onClick: (e) => e.stopPropagation()
        },
        /* @__PURE__ */ import_react2.default.createElement("h3", { style: { margin: "0 0 16px", fontSize: 16 } }, "\u2795 \u65B0\u589E\u89D2\u8272"),
        /* @__PURE__ */ import_react2.default.createElement("div", { style: { marginBottom: 12 } }, /* @__PURE__ */ import_react2.default.createElement("label", { style: { display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 } }, "\u89D2\u8272\u59D3\u540D *"), /* @__PURE__ */ import_react2.default.createElement(
          "input",
          {
            style: { width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 13, boxSizing: "border-box" },
            value: newChar.name,
            onChange: (e) => setNewChar((f) => ({ ...f, name: e.target.value })),
            placeholder: "\u5982\uFF1A\u6797\u665A\u3001\u6C88\u781A",
            autoFocus: true
          }
        )),
        /* @__PURE__ */ import_react2.default.createElement("div", { style: { marginBottom: 12 } }, /* @__PURE__ */ import_react2.default.createElement("label", { style: { display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 } }, "\u89D2\u8272\u8EAB\u4EFD/\u5B9A\u4F4D"), /* @__PURE__ */ import_react2.default.createElement(
          "input",
          {
            style: { width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 13, boxSizing: "border-box" },
            value: newChar.role,
            onChange: (e) => setNewChar((f) => ({ ...f, role: e.target.value })),
            placeholder: "\u5982\uFF1A\u4E3B\u89D2\u3001\u53CD\u6D3E\u3001\u5973\u914D\u3001\u9F99\u5957"
          }
        )),
        /* @__PURE__ */ import_react2.default.createElement("div", { style: { marginBottom: 12 } }, /* @__PURE__ */ import_react2.default.createElement("label", { style: { display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 } }, "\u6027\u683C\u7279\u70B9"), /* @__PURE__ */ import_react2.default.createElement(
          "input",
          {
            style: { width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 13, boxSizing: "border-box" },
            value: newChar.personality,
            onChange: (e) => setNewChar((f) => ({ ...f, personality: e.target.value })),
            placeholder: "\u5982\uFF1A\u575A\u97E7\u679C\u6562\u3001\u9634\u9669\u72E1\u8BC8\u3001\u6E29\u67D4\u5584\u826F"
          }
        )),
        /* @__PURE__ */ import_react2.default.createElement("div", { style: { marginBottom: 16 } }, /* @__PURE__ */ import_react2.default.createElement("label", { style: { display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 } }, "\u5916\u8C8C\u63CF\u8FF0\uFF08\u7528\u4E8EAI\u751F\u56FE\u63D0\u793A\u8BCD\uFF09"), /* @__PURE__ */ import_react2.default.createElement(
          "textarea",
          {
            style: { width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 13, boxSizing: "border-box", minHeight: 80, resize: "vertical" },
            value: newChar.appearance,
            onChange: (e) => setNewChar((f) => ({ ...f, appearance: e.target.value })),
            placeholder: "\u5982\uFF1A25\u5C81\u5973\u6027\uFF0C\u9ED1\u8272\u957F\u53D1\uFF0C\u51B7\u767D\u76AE\uFF0C\u7A7F\u7EA2\u8272\u98CE\u8863\uFF0C\u773C\u795E\u575A\u5B9A\uFF0C\u8EAB\u6750\u9AD8\u6311..."
          }
        )),
        /* @__PURE__ */ import_react2.default.createElement("div", { style: { display: "flex", gap: 10, justifyContent: "flex-end" } }, /* @__PURE__ */ import_react2.default.createElement(
          "button",
          {
            style: { padding: "8px 16px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 13 },
            onClick: () => setShowAddModal(false)
          },
          "\u53D6\u6D88"
        ), /* @__PURE__ */ import_react2.default.createElement(
          "button",
          {
            style: { padding: "8px 16px", border: "none", borderRadius: 6, background: "linear-gradient(135deg, #7A5CFF, #5CE1E6)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 },
            onClick: () => {
              if (!newChar.name.trim()) {
                alert("\u8BF7\u8F93\u5165\u89D2\u8272\u59D3\u540D");
                return;
              }
              const c = {
                id: "char_" + Date.now(),
                name: newChar.name.trim(),
                role: newChar.role.trim(),
                personality: newChar.personality.trim(),
                appearance: newChar.appearance.trim(),
                image: null,
                locked: false
              };
              update({ materials: { ...project2.materials, characters: [c, ...characters] } });
              log("\u65B0\u589E\u89D2\u8272\uFF1A" + c.name);
              setShowAddModal(false);
            }
          },
          "\u786E\u8BA4\u6DFB\u52A0"
        ))
      )
    ));
  }

  // src/components/NewScript/StoryboardBoard.jsx
  var import_react3 = __toESM(__require("react"), 1);
  var STYLE_OPTIONS2 = [
    { value: "cinematic", label: "\u7535\u5F71\u5199\u5B9E", desc: "\u7535\u5F71\u7EA7\u5199\u5B9E\u98CE\u683C\uFF0C\u80F6\u7247\u8D28\u611F\uFF0C\u4E13\u4E1A\u5149\u5F71\uFF0C\u9AD8\u5BF9\u6BD4\u5EA6" },
    { value: "anime", label: "\u52A8\u6F2B/\u6E38\u620F\u539F\u753B", desc: "\u4E13\u4E1A\u89D2\u8272\u8BBE\u5B9A\u56FE\u98CE\u683C\uFF0C\u52A8\u6F2B/\u6E38\u620F\u539F\u753B\u54C1\u8D28" },
    { value: "realistic", label: "\u8D85\u5199\u5B9E\u771F\u4EBA", desc: "\u8D85\u5199\u5B9E\u771F\u4EBA\u7167\u7247\u98CE\u683C\uFF0C\u771F\u5B9E\u76AE\u80A4\u8D28\u611F\uFF0C\u7535\u5F71\u7EA7\u5149\u5F71" },
    { value: "wuxia", label: "\u56FD\u98CE\u6B66\u4FA0", desc: "\u4E2D\u56FD\u53E4\u98CE\u6B66\u4FA0\u98CE\u683C\uFF0C\u6C34\u58A8\u610F\u5883\uFF0C\u4F20\u7EDF\u670D\u9970\uFF0C\u5DE5\u7B14\u91CD\u5F69" },
    { value: "cyberpunk", label: "\u8D5B\u535A\u670B\u514B", desc: "\u8D5B\u535A\u670B\u514B\u79D1\u5E7B\u98CE\u683C\uFF0C\u9713\u8679\u706F\u5149\uFF0C\u673A\u68B0\u4E49\u4F53\uFF0C\u672A\u6765\u90FD\u5E02" },
    { value: "3d", label: "3D\u6E32\u67D3", desc: "3D\u6E32\u67D3\u98CE\u683C\uFF0CPBR\u6750\u8D28\uFF0C\u6B21\u4E16\u4EE3\u6E38\u620F\u753B\u9762\uFF0C\u7CBE\u7EC6\u5EFA\u6A21" }
  ];
  var ASPECT_RATIO_OPTIONS = [
    { value: "9:16", label: "9:16 \u7AD6\u5C4F", desc: "\u7AD6\u5C4F\u77ED\u5267\u6784\u56FE", size: "1024x1820" },
    { value: "16:9", label: "16:9 \u6A2A\u5C4F", desc: "\u6A2A\u5C4F\u7535\u5F71\u6784\u56FE", size: "1820x1024" },
    { value: "1:1", label: "1:1 \u65B9\u5F62", desc: "\u65B9\u5F62\u6784\u56FE", size: "1024x1024" },
    { value: "4:3", label: "4:3 \u6807\u51C6", desc: "\u6807\u51C6\u6BD4\u4F8B\u6784\u56FE", size: "1152x864" },
    { value: "3:4", label: "3:4 \u7AD6\u7248", desc: "\u7AD6\u7248\u6784\u56FE", size: "864x1152" }
  ];
  function StoryboardBoard({ project: project2, update, log }) {
    const scenes = project2?.scenes || [];
    const shots = project2.shots || [];
    const [busy, setBusy] = (0, import_react3.useState)("");
    const [autoSplitting, setAutoSplitting] = (0, import_react3.useState)(false);
    const [selectedEp, setSelectedEp] = (0, import_react3.useState)(project2?.episodes?.[0]?.id || null);
    const [selectedStyle, setSelectedStyle] = (0, import_react3.useState)("cinematic");
    const [selectedAspectRatio, setSelectedAspectRatio] = (0, import_react3.useState)("9:16");
    (0, import_react3.useEffect)(() => {
      if (project2?.episodes?.length > 0 && !selectedEp) {
        setSelectedEp(project2.episodes[0].id);
      }
    }, [project2?.episodes, selectedEp]);
    const [editingShotId, setEditingShotId] = (0, import_react3.useState)(null);
    const [editContent, setEditContent] = (0, import_react3.useState)("");
    const [editingSceneId, setEditingSceneId] = (0, import_react3.useState)(null);
    const [editSceneDesc, setEditSceneDesc] = (0, import_react3.useState)("");
    const genSceneImage = async (sc) => {
      setBusy(sc.id);
      log("\u751F\u6210\u5206\u955C\u56FE\uFF1A" + sc.title);
      if (!isLoggedIn()) {
        alert("\u8BF7\u5148\u767B\u5F55\u540E\u518D\u4F7F\u7528\u5206\u955C\u751F\u56FE\u529F\u80FD");
        setBusy("");
        return;
      }
      const imagePrice = getPrice("image_generate", 3);
      try {
        const precheck2 = await precheckCredits(imagePrice, "image", `\u5206\u955C\u751F\u56FE\uFF1A${sc.title}`);
        if (!precheck2.sufficient && precheck2.sufficient !== void 0) {
          log(`\u274C \u79EF\u5206\u4E0D\u8DB3\uFF1A\u9700\u8981${imagePrice}\u79EF\u5206\uFF0C\u5F53\u524D\u4F59\u989D${precheck2.balance || 0}\u79EF\u5206`);
          alert(`\u79EF\u5206\u4E0D\u8DB3\uFF01\u751F\u6210\u5206\u955C\u56FE\u9700\u8981${imagePrice}\u79EF\u5206\uFF0C\u5F53\u524D\u4F59\u989D${precheck2.balance || 0}\u79EF\u5206\u3002\u8BF7\u5145\u503C\u540E\u518D\u8BD5\u3002`);
          setBusy("");
          return;
        }
      } catch (e) {
        log(`\u26A0\uFE0F \u79EF\u5206\u9884\u6821\u9A8C\u5931\u8D25\uFF1A${e.message}`);
      }
      try {
        const sceneType = sc.sceneType || "\u4E2D\u666F";
        const cameraMove = sc.cameraMove || "\u56FA\u5B9A";
        const desc = sc.desc || sc.sceneDesc || "";
        const styleObj = STYLE_OPTIONS2.find((s2) => s2.value === selectedStyle) || STYLE_OPTIONS2[0];
        const styleDesc = styleObj.desc;
        const aspectObj = ASPECT_RATIO_OPTIONS.find((a) => a.value === selectedAspectRatio) || ASPECT_RATIO_OPTIONS[0];
        const aspectDesc = aspectObj.desc;
        const imageSize = aspectObj.size;
        const cleanDesc = (desc || "").substring(0, 500);
        const prompt = `\u77ED\u5267\u5206\u955C\u753B\u9762\uFF0C${sceneType}\u955C\u5934\uFF0C${cameraMove}\u8FD0\u955C\u3002${cleanDesc}\u3002${styleDesc}\u3002${aspectDesc}\u3002\u7535\u5F71\u7EA7\u5149\u5F71\uFF0C\u9AD8\u5BF9\u6BD4\u5EA6\uFF0C\u6C1B\u56F4\u611F\u5F3A\uFF0C\u8272\u5F69\u5206\u7EA7\u4E13\u4E1A\uFF0C\u753B\u9762\u6784\u56FE\u4E25\u8C28\uFF0C\u4E3B\u4F53\u7A81\u51FA\uFF0C\u80CC\u666F\u6709\u5C42\u6B21\u3002\u8D85\u9AD8\u6E05\u7EC6\u8282\uFF0C\u4E13\u4E1A\u5F71\u89C6\u7EA7\u753B\u9762\u3002\u65E0\u6587\u5B57\uFF0C\u65E0\u6C34\u5370\uFF0C\u65E0\u8FB9\u6846\u3002`;
        console.log("[\u5206\u955C\u751F\u56FE] prompt\u957F\u5EA6:", prompt.length, "size:", imageSize, "\u6BD4\u4F8B:", selectedAspectRatio);
        const res = await generateImage({ prompt, size: imageSize, n: 1 });
        update({ scenes: scenes.map((s2) => s2.id === sc.id ? { ...s2, imageUrl: res.image_url } : s2) });
        try {
          const currentAssets = project2?.assets || [];
          const newImageAsset = {
            id: "a_image_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8),
            type: "image",
            title: `${sc.title}\u5206\u955C\u56FE\uFF08${styleObj.label}\uFF0C${(/* @__PURE__ */ new Date()).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}\uFF09`,
            url: res.image_url,
            status: "ready",
            tags: ["\u5206\u955C\u751F\u56FE", styleObj.label, sc.episodeId ? `\u7B2C${sc.episodeId}\u96C6` : ""].filter(Boolean),
            favorite: false,
            sceneId: sc.id,
            episodeId: sc.episodeId || "",
            style: selectedStyle,
            createdAt: Date.now()
          };
          update({ assets: [newImageAsset, ...currentAssets] });
          log(`\u2705 \u5206\u955C\u56FE\u5DF2\u5B58\u5165\u7D20\u6750\u5E93\uFF1A${newImageAsset.title}`);
        } catch (e) {
          log(`\u26A0\uFE0F \u5206\u955C\u56FE\u5B58\u5165\u7D20\u6750\u5E93\u5931\u8D25\uFF1A${e.message}`);
        }
        log("\u5206\u955C\u56FE\u751F\u6210\u6210\u529F\uFF08" + styleObj.label + "\u98CE\u683C\uFF09");
        if (isLoggedIn()) {
          try {
            await deductCredits(imagePrice, "image", `\u5206\u955C\u751F\u56FE\uFF1A${sc.title}`, sc.id);
            log(`\u2705 \u79EF\u5206\u6263\u51CF\u6210\u529F\uFF1A${splitPrice}\u79EF\u5206`);
            try {
              const balanceData = await getCreditBalance();
              if (window.onCreditUpdate) window.onCreditUpdate(balanceData.balance || balanceData.credits || 0);
              if (window.refreshUserInfo) window.refreshUserInfo();
            } catch (e) {
            }
          } catch (e) {
            log(`\u26A0\uFE0F \u79EF\u5206\u6263\u51CF\u5931\u8D25\uFF1A${e.message}`);
          }
        }
      } catch (e) {
        log("\u751F\u6210\u5931\u8D25\uFF1A" + e.message);
      } finally {
        setBusy("");
      }
    };
    const autoSplitScript = async () => {
      if (!selectedEp) {
        log("\u8BF7\u5148\u5728\u9876\u90E8\u9009\u62E9\u8981\u62C6\u5206\u7684\u96C6\u6570");
        return;
      }
      const currentEpisode = (project2.episodes || []).find((ep) => ep.id === selectedEp);
      if (!currentEpisode) {
        log("\u672A\u627E\u5230\u9009\u4E2D\u7684\u96C6\u6570\u5185\u5BB9");
        return;
      }
      const context = currentEpisode.content || currentEpisode.desc || "";
      if (!context || context.length < 10) {
        log("\u5F53\u524D\u96C6\u5185\u5BB9\u592A\u5C11\uFF0C\u65E0\u6CD5\u62C6\u5206");
        return;
      }
      setAutoSplitting(true);
      if (!isLoggedIn()) {
        alert("\u8BF7\u5148\u767B\u5F55\u540E\u518D\u4F7F\u7528\u5206\u955C\u62C6\u5206\u529F\u80FD");
        setAutoSplitting(false);
        return;
      }
      const splitPrice2 = getPrice("llm_storyboard_split", 3);
      try {
        const precheck2 = await precheckCredits(splitPrice2, "text", `\u5206\u955C\u62C6\u5206\uFF1A${currentEpisode.title || selectedEp}`);
        if (!precheck2.sufficient && precheck2.sufficient !== void 0) {
          log(`\u274C \u79EF\u5206\u4E0D\u8DB3\uFF1A\u9700\u8981${splitPrice2}\u79EF\u5206\uFF0C\u5F53\u524D\u4F59\u989D${precheck2.balance || 0}\u79EF\u5206`);
          alert(`\u79EF\u5206\u4E0D\u8DB3\uFF01\u62C6\u5206\u5F53\u524D\u96C6\u9700\u8981${splitPrice2}\u79EF\u5206\uFF0C\u5F53\u524D\u4F59\u989D${precheck2.balance || 0}\u79EF\u5206\u3002\u8BF7\u5145\u503C\u540E\u518D\u8BD5\u3002`);
          setAutoSplitting(false);
          return;
        }
      } catch (e) {
        log(`\u26A0\uFE0F \u79EF\u5206\u9884\u6821\u9A8C\u5931\u8D25\uFF1A${e.message}`);
      }
      log(`\u6B63\u5728\u62C6\u5206\u300C${currentEpisode.title || selectedEp}\u300D\u7684\u955C\u5934...`);
      try {
        const episodeTitle = currentEpisode.title || "";
        const prompt = `\u4F60\u662F\u4E00\u540D\u4E13\u4E1A\u7AD6\u5C4F\u77ED\u5267\u5206\u955C\u5BFC\u6F14\u3002\u8BF7\u6839\u636E\u4EE5\u4E0B\u3010\u7B2C${episodeTitle}\u3011\u7684\u5267\u672C\u5185\u5BB9\uFF0C\u62C6\u5206\u621010-15\u4E2A\u5206\u955C\uFF08\u6BCF\u96C690-120\u79D2\uFF0C\u6BCF\u4E2A\u5206\u955C\u7EA65-10\u79D2\uFF09\u3002

\u8981\u6C42\uFF1A
1. \u6BCF\u4E2A\u5206\u955C\u5FC5\u987B\u5305\u542B\u5B8C\u6574\u7684\u955C\u5934\u8BED\u8A00\u4FE1\u606F
2. \u666F\u522B\u9009\u62E9\uFF1A\u8FDC\u666F(\u73AF\u5883\u4EA4\u4EE3)/\u5168\u666F(\u4EBA\u7269\u5168\u8EAB)/\u4E2D\u666F(\u8170\u90E8\u4EE5\u4E0A)/\u8FD1\u666F(\u80F8\u90E8\u4EE5\u4E0A)/\u7279\u5199(\u9762\u90E8\u6216\u7EC6\u8282)
3. \u8FD0\u955C\u65B9\u5F0F\uFF1A\u56FA\u5B9A/\u63A8(\u5411\u524D\u63A8\u8FDB)/\u62C9(\u5411\u540E\u62C9\u5F00)/\u6447(\u5DE6\u53F3\u6447\u52A8)/\u79FB(\u5E73\u884C\u79FB\u52A8)/\u8DDF(\u8DDF\u968F\u4E3B\u4F53)
4. \u753B\u9762\u63CF\u8FF0\u8981\u5177\u4F53\uFF0850-100\u5B57\uFF09\uFF0C\u5305\u542B\uFF1A\u65F6\u4EE3\u573A\u666F\u3001\u4EBA\u7269\u52A8\u4F5C\u8868\u60C5\u3001\u5149\u5F71\u6C1B\u56F4\u3001\u73AF\u5883\u7EC6\u8282
5. \u53F0\u8BCD\u8981\u51C6\u786E\u5F15\u7528\u5267\u672C\u539F\u6587
6. \u53EA\u8F93\u51FA\u7EAFJSON\u6570\u7EC4\uFF0C\u4E0D\u8981markdown\u4EE3\u7801\u5757\uFF0C\u4E0D\u8981\u89E3\u91CA

\u5267\u672C\u5185\u5BB9\uFF1A
${context.slice(0, 3e3)}

\u8F93\u51FAJSON\u683C\u5F0F\uFF08\u6570\u7EC4\uFF09\uFF1A
[
  {
    "shotIndex": 1,
    "title": "\u955C\u5934\u6807\u9898\uFF08\u7B80\u6D01\u6982\u62EC\u753B\u9762\u5185\u5BB9\uFF09",
    "sceneType": "\u4E2D\u666F",
    "cameraMove": "\u63A8\u955C",
    "sceneDesc": "\u753B\u9762\u63CF\u8FF0\uFF0850-100\u5B57\uFF0C\u542B\u65F6\u4EE3/\u573A\u666F/\u4EBA\u7269\u52A8\u4F5C/\u8868\u60C5/\u5149\u5F71/\u6C1B\u56F4\uFF09",
    "dialogue": "\u4EBA\u7269\u53F0\u8BCD\uFF08\u65E0\u53F0\u8BCD\u5219\u4E3A\u7A7A\u5B57\u7B26\u4E32\uFF09",
    "characters": ["\u89D2\u8272\u540D1", "\u89D2\u8272\u540D2"]
  }
]`;
        const res = await api("/api/llm/chat", {
          method: "POST",
          body: JSON.stringify({ messages: [{ role: "user", content: prompt }], max_tokens: 8192 })
        });
        const text = res.text || "[]";
        console.log("[\u5206\u955C\u62C6\u5206LLM\u8F93\u51FA]", text);
        let parsed;
        try {
          let clean = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
          const firstBracket = clean.indexOf("[");
          const lastBracket = clean.lastIndexOf("]");
          if (firstBracket !== -1 && lastBracket !== -1) {
            clean = clean.slice(firstBracket, lastBracket + 1);
          }
          parsed = JSON.parse(clean);
        } catch (e) {
          console.log("[\u5206\u955C\u62C6\u5206] JSON\u89E3\u6790\u5931\u8D25:", e.message);
          parsed = [];
        }
        const shotsArray = Array.isArray(parsed) ? parsed : parsed.shots || [];
        if (shotsArray.length > 0) {
          const newShots = shotsArray.map((sh, i) => ({
            id: "shot_" + Date.now() + "_" + i,
            shotIndex: sh.shotIndex || i + 1,
            episodeId: selectedEp || null,
            title: sh.title || "\u955C\u5934" + (i + 1),
            sceneDesc: sh.sceneDesc || "",
            sceneType: sh.sceneType || "\u4E2D\u666F",
            cameraMove: sh.cameraMove || "\u56FA\u5B9A",
            lighting: "\u81EA\u7136\u5149",
            emotion: "\u6B63\u5E38",
            duration: Math.min(10, Math.max(3, Math.round((currentEpisode.duration || 120) / shotsArray.length))),
            promptCn: sh.sceneDesc || "",
            characters: sh.characters || [],
            dialogue: sh.dialogue || "",
            subtitle: "",
            innerMonologue: "",
            note: "",
            imageUrl: null,
            videoUrl: null,
            status: "pending",
            progress: 0
          }));
          update({ shots: [...newShots, ...shots] });
          log("\u81EA\u52A8\u62C6\u5206\u5B8C\u6210\uFF1A" + newShots.length + " \u4E2A\u955C\u5934");
          if (isLoggedIn()) {
            try {
              await deductCredits(splitPrice2, "text", `\u5206\u955C\u62C6\u5206\uFF1A${currentEpisode.title || selectedEp}`, "");
              log(`\u2705 \u79EF\u5206\u6263\u51CF\u6210\u529F\uFF1A${splitPrice2}\u79EF\u5206`);
              try {
                const balanceData = await getCreditBalance();
                if (window.onCreditUpdate) window.onCreditUpdate(balanceData.balance || balanceData.credits || 0);
                if (window.refreshUserInfo) window.refreshUserInfo();
              } catch (e) {
              }
            } catch (e) {
              log(`\u26A0\uFE0F \u79EF\u5206\u6263\u51CF\u5931\u8D25\uFF1A${e.message}`);
            }
          }
        } else {
          log("\u672A\u80FD\u81EA\u52A8\u62C6\u5206\uFF0C\u8BF7\u68C0\u67E5\u5267\u672C\u5185\u5BB9");
        }
      } catch (e) {
        log("\u81EA\u52A8\u62C6\u5206\u5931\u8D25\uFF1A" + e.message);
      } finally {
        setAutoSplitting(false);
      }
    };
    const firstEpId = project2?.episodes?.[0]?.id;
    const currentShots = selectedEp ? shots.filter((s2) => {
      const epId = s2.episodeId || firstEpId;
      return epId === selectedEp;
    }) : shots;
    return /* @__PURE__ */ import_react3.default.createElement("div", { style: { padding: 16, height: "100%", overflow: "auto", color: "var(--text)" } }, /* @__PURE__ */ import_react3.default.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 } }, /* @__PURE__ */ import_react3.default.createElement("h2", { style: { margin: 0, fontSize: 18 } }, "\u{1F4DD} \u5206\u955C\u4E0E\u751F\u56FE"), /* @__PURE__ */ import_react3.default.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } }, /* @__PURE__ */ import_react3.default.createElement(
      "select",
      {
        value: selectedStyle,
        onChange: (e) => setSelectedStyle(e.target.value),
        style: { padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 13, cursor: "pointer" },
        title: "\u9009\u62E9\u751F\u56FE\u98CE\u683C"
      },
      STYLE_OPTIONS2.map((s2) => /* @__PURE__ */ import_react3.default.createElement("option", { key: s2.value, value: s2.value }, s2.label))
    ), /* @__PURE__ */ import_react3.default.createElement(
      "select",
      {
        value: selectedAspectRatio,
        onChange: (e) => setSelectedAspectRatio(e.target.value),
        style: { padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 13, cursor: "pointer" },
        title: "\u9009\u62E9\u753B\u9762\u6BD4\u4F8B"
      },
      ASPECT_RATIO_OPTIONS.map((a) => /* @__PURE__ */ import_react3.default.createElement("option", { key: a.value, value: a.value }, a.label))
    ), /* @__PURE__ */ import_react3.default.createElement(
      "button",
      {
        style: { padding: "8px 16px", border: "none", borderRadius: 6, background: "linear-gradient(135deg, #7A5CFF, #5CE1E6)", color: "#fff", cursor: "pointer", fontSize: 13 },
        onClick: autoSplitScript,
        disabled: autoSplitting || !project2.script && !project2.outline?.synopsis
      },
      autoSplitting ? "\u62C6\u5206\u4E2D..." : `\u{1F916} \u62C6\u5206\u5F53\u524D\u96C6\uFF08${getPrice("llm_storyboard_split", 3)}\u79EF\u5206\uFF09`
    ))), project2.episodes && project2.episodes.length > 1 && /* @__PURE__ */ import_react3.default.createElement("div", { style: { marginBottom: 16 } }, /* @__PURE__ */ import_react3.default.createElement("div", { style: { fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 } }, "\u6309\u96C6\u7B5B\u9009\uFF1A"), /* @__PURE__ */ import_react3.default.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } }, project2.episodes.map((ep, i) => /* @__PURE__ */ import_react3.default.createElement(
      "button",
      {
        key: i,
        style: { padding: "4px 12px", border: "1px solid var(--border)", borderRadius: 4, background: selectedEp === ep.id ? "rgba(122,92,255,0.3)" : "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 },
        onClick: () => setSelectedEp(ep.id)
      },
      ep.title
    )))), currentShots.length === 0 && /* @__PURE__ */ import_react3.default.createElement("div", { style: { padding: 20, border: "1px solid var(--border)", borderRadius: 12, background: "var(--panel-2)", marginBottom: 16 } }, /* @__PURE__ */ import_react3.default.createElement("div", { style: { fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--text)" } }, "\u{1F4C4} \u5F53\u524D\u96C6\u5267\u672C\u5185\u5BB9\uFF08\u70B9\u51FB\u4E0A\u65B9\u300C\u62C6\u5206\u5F53\u524D\u96C6\u300D\u751F\u6210\u5206\u955C\uFF09"), /* @__PURE__ */ import_react3.default.createElement("div", { style: { fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8, maxHeight: 400, overflow: "auto", whiteSpace: "pre-wrap" } }, (project2.episodes || []).find((ep) => ep.id === selectedEp)?.content || "\u6682\u65E0\u5267\u672C\u5185\u5BB9")), /* @__PURE__ */ import_react3.default.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 12 } }, currentShots.map((sh) => /* @__PURE__ */ import_react3.default.createElement("div", { key: sh.id, style: { border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "var(--panel-2)" } }, /* @__PURE__ */ import_react3.default.createElement("div", { style: { display: "flex", gap: 12 } }, /* @__PURE__ */ import_react3.default.createElement("div", { style: { width: 120, height: 160, background: "var(--input-bg)", borderRadius: 8, flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" } }, sh.imageUrl ? /* @__PURE__ */ import_react3.default.createElement("img", { src: sh.imageUrl, alt: sh.title, style: { width: "100%", height: "100%", objectFit: "cover" } }) : /* @__PURE__ */ import_react3.default.createElement("span", { style: { fontSize: 32 } }, "\u{1F3AC}"), /* @__PURE__ */ import_react3.default.createElement("div", { style: { position: "absolute", top: 4, left: 4, background: "rgba(0,0,0,0.7)", borderRadius: 4, padding: "2px 6px", fontSize: 10, color: "#fff" } }, sh.sceneType || "\u4E2D\u666F")), /* @__PURE__ */ import_react3.default.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ import_react3.default.createElement("div", { style: { fontWeight: 600, fontSize: 14 } }, sh.title), /* @__PURE__ */ import_react3.default.createElement("div", { style: { fontSize: 11, color: "var(--text-muted)", marginTop: 4 } }, sh.sceneType, " \xB7 ", sh.cameraMove, " \xB7 ", sh.duration || 5, "\u79D2"), editingShotId === sh.id ? /* @__PURE__ */ import_react3.default.createElement("div", { style: { marginTop: 8 } }, /* @__PURE__ */ import_react3.default.createElement(
      "textarea",
      {
        value: editContent,
        onChange: (e) => setEditContent(e.target.value),
        style: { width: "100%", minHeight: 80, padding: 8, borderRadius: 6, border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--text)", fontSize: 12, resize: "vertical", boxSizing: "border-box" }
      }
    ), /* @__PURE__ */ import_react3.default.createElement("div", { style: { display: "flex", gap: 8, marginTop: 8 } }, /* @__PURE__ */ import_react3.default.createElement("button", { onClick: () => {
      update({ shots: shots.map((s2) => s2.id === sh.id ? { ...s2, sceneDesc: editContent } : s2) });
      setEditingShotId(null);
      log("\u5DF2\u66F4\u65B0\u955C\u5934\u63CF\u8FF0");
    }, style: { padding: "4px 12px", border: "none", borderRadius: 6, background: "var(--primary, #7a5cff)", color: "#fff", cursor: "pointer", fontSize: 12 } }, "\u4FDD\u5B58"), /* @__PURE__ */ import_react3.default.createElement("button", { onClick: () => setEditingShotId(null), style: { padding: "4px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 } }, "\u53D6\u6D88"))) : /* @__PURE__ */ import_react3.default.createElement("div", { style: { fontSize: 12, color: "var(--text)", marginTop: 8, lineHeight: 1.5 } }, sh.sceneDesc || sh.desc || "\u65E0\u63CF\u8FF0"), sh.dialogue && /* @__PURE__ */ import_react3.default.createElement("div", { style: { marginTop: 8, padding: "6px 10px", background: "rgba(122,92,255,0.1)", borderRadius: 6, fontSize: 12, fontStyle: "italic" } }, sh.dialogue), sh.characters && sh.characters.length > 0 && /* @__PURE__ */ import_react3.default.createElement("div", { style: { marginTop: 6, fontSize: 11, color: "var(--text-secondary)" } }, "\u4EBA\u7269\uFF1A", sh.characters.join("\u3001")))), /* @__PURE__ */ import_react3.default.createElement("div", { style: { display: "flex", gap: 8, marginTop: 12 } }, /* @__PURE__ */ import_react3.default.createElement(
      "button",
      {
        style: { padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 },
        onClick: () => genSceneImage({ ...sh, id: sh.id }),
        disabled: busy === sh.id
      },
      busy === sh.id ? "\u751F\u6210\u4E2D\u2026" : `\u{1F3A8} \u751F\u6210\u5206\u955C\u56FE (${getPrice("image_generate", 3)}\u79EF\u5206)`
    ), /* @__PURE__ */ import_react3.default.createElement(
      "button",
      {
        style: { padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 },
        onClick: () => {
          setEditingShotId(sh.id);
          setEditContent(sh.sceneDesc || "");
        }
      },
      "\u270F\uFE0F \u7F16\u8F91"
    ), /* @__PURE__ */ import_react3.default.createElement(
      "button",
      {
        style: { padding: "6px 12px", border: "1px solid #ef4444", borderRadius: 6, background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 12 },
        onClick: () => {
          if (window.confirm("\u5220\u9664\u6B64\u955C\u5934\uFF1F")) {
            update({ shots: shots.filter((s2) => s2.id !== sh.id) });
            log("\u5DF2\u5220\u9664\u955C\u5934\uFF1A" + sh.title);
          }
        }
      },
      "\u{1F5D1} \u5220\u9664"
    )))), currentShots.length > 0 && scenes.filter((s2, idx) => {
      let epId = s2.episodeId;
      if (!epId) {
        const matchedByTitle = (project2.episodes || []).find((ep) => ep.title === s2.title);
        if (matchedByTitle) epId = matchedByTitle.id;
      }
      if (!epId) {
        if (project2.episodes && project2.episodes[idx]) epId = project2.episodes[idx].id;
      }
      const matchesEpisode = !selectedEp || epId === selectedEp;
      const notInShots = !shots.some((sh) => sh.title === s2.title);
      return matchesEpisode && notInShots;
    }).map((sc) => /* @__PURE__ */ import_react3.default.createElement("div", { key: sc.id, style: { border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "var(--panel-2)" } }, /* @__PURE__ */ import_react3.default.createElement("div", { style: { display: "flex", gap: 12 } }, /* @__PURE__ */ import_react3.default.createElement("div", { style: { width: 120, height: 160, background: "var(--input-bg)", borderRadius: 8, flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" } }, sc.imageUrl ? /* @__PURE__ */ import_react3.default.createElement("img", { src: sc.imageUrl, alt: sc.title, style: { width: "100%", height: "100%", objectFit: "cover" } }) : /* @__PURE__ */ import_react3.default.createElement("span", { style: { fontSize: 32 } }, "\u{1F3AC}")), /* @__PURE__ */ import_react3.default.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ import_react3.default.createElement("div", { style: { fontWeight: 600, fontSize: 14 } }, sc.title), editingSceneId === sc.id ? /* @__PURE__ */ import_react3.default.createElement("div", { style: { marginTop: 8 } }, /* @__PURE__ */ import_react3.default.createElement(
      "textarea",
      {
        value: editSceneDesc,
        onChange: (e) => setEditSceneDesc(e.target.value),
        style: { width: "100%", minHeight: 100, padding: 8, borderRadius: 6, border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--text)", fontSize: 12, resize: "vertical", boxSizing: "border-box" }
      }
    ), /* @__PURE__ */ import_react3.default.createElement("div", { style: { display: "flex", gap: 8, marginTop: 8 } }, /* @__PURE__ */ import_react3.default.createElement("button", { onClick: () => {
      update({ scenes: scenes.map((s2) => s2.id === sc.id ? { ...s2, desc: editSceneDesc } : s2) });
      setEditingSceneId(null);
      log("\u5DF2\u66F4\u65B0\u5206\u96C6\u5185\u5BB9");
    }, style: { padding: "4px 12px", border: "none", borderRadius: 6, background: "var(--primary, #7a5cff)", color: "#fff", cursor: "pointer", fontSize: 12 } }, "\u4FDD\u5B58"), /* @__PURE__ */ import_react3.default.createElement("button", { onClick: () => setEditingSceneId(null), style: { padding: "4px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 } }, "\u53D6\u6D88"))) : /* @__PURE__ */ import_react3.default.createElement("div", { style: { fontSize: 12, color: "var(--text-muted)", marginTop: 4, whiteSpace: "pre-wrap", lineHeight: 1.6 } }, sc.desc || "\u65E0\u63CF\u8FF0"))), /* @__PURE__ */ import_react3.default.createElement("div", { style: { display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" } }, /* @__PURE__ */ import_react3.default.createElement("button", { style: { padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 }, onClick: () => genSceneImage(sc), disabled: busy === sc.id }, busy === sc.id ? "\u751F\u6210\u4E2D\u2026" : "\u{1F3A8} \u751F\u6210\u5206\u955C\u56FE (3\u79EF\u5206)"), /* @__PURE__ */ import_react3.default.createElement("button", { style: { padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 }, onClick: () => {
      setEditingSceneId(sc.id);
      setEditSceneDesc(sc.desc || "");
    } }, "\u270F\uFE0F \u7F16\u8F91\u5185\u5BB9"))))));
  }

  // src/components/NewScript/VideoGenBoard.jsx
  var import_react4 = __toESM(__require("react"), 1);

  // src/utils/app-settings.js
  var SETTINGS_KEY = "APP_SETTINGS";
  var DEFAULT_APP_SETTINGS = {
    autoSave: true,
    autoSaveInterval: 30,
    // 秒
    defaultResolution: "768p\u7AD6",
    defaultDuration: 5,
    // 秒
    defaultVideoMode: "I2V",
    showGenerateLog: true,
    autoAddToAssets: true,
    notificationSound: true,
    language: "zh-CN"
  };
  function getAppSettings() {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        return { ...DEFAULT_APP_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn("[AppSettings] \u8BFB\u53D6\u8BBE\u7F6E\u5931\u8D25:", e);
    }
    return { ...DEFAULT_APP_SETTINGS };
  }
  function getAppSetting(key, defaultValue = null) {
    const settings = getAppSettings();
    if (key in settings) {
      return settings[key];
    }
    return defaultValue !== null ? defaultValue : DEFAULT_APP_SETTINGS[key] ?? null;
  }
  var audioContext = null;
  function getAudioContext() {
    if (!audioContext) {
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        return null;
      }
    }
    return audioContext;
  }
  function playNotificationSound(type = "success") {
    if (!getAppSetting("notificationSound", true)) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      if (type === "success") {
        oscillator.frequency.setValueAtTime(880, ctx.currentTime);
        oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      } else if (type === "error") {
        oscillator.frequency.setValueAtTime(300, ctx.currentTime);
        oscillator.frequency.setValueAtTime(200, ctx.currentTime + 0.15);
      } else {
        oscillator.frequency.setValueAtTime(660, ctx.currentTime);
      }
      oscillator.type = "sine";
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.warn("[NotificationSound] \u64AD\u653E\u5931\u8D25:", e);
    }
  }

  // src/components/NewScript/VideoGenBoard.jsx
  var VIDEO_MODES = [
    { key: "i2v", label: "\u56FE\u751F\u89C6\u9891 (I2V)", desc: "\u89D2\u8272\u53C2\u8003\u56FE\u9A71\u52A8\uFF0C\u4EBA\u7269\u5916\u8C8C\u4E00\u81F4\uFF0C\u6A21\u578B\u81EA\u7531\u53D1\u6325\u753B\u9762" },
    { key: "r2v", label: "\u9996\u5C3E\u5E27 (R2V/lightx2v)", desc: "\u9996\u5E27+\u5C3E\u5E27\u7CBE\u786E\u63A7\u5236\u753B\u9762\u8D77\u6B62\uFF0Cminimax_h3_lightx2v\u5DE5\u4F5C\u6D41" },
    { key: "ia2v", label: "\u5168\u80FD\u53C2\u8003 (Ref2VA/v2)", desc: "\u53C2\u8003\u56FE\u7247+\u53C2\u8003\u97F3\u9891+\u6587\u672C\uFF0C\u6700\u591A9\u56FE3\u97F3\uFF0Cminimax_h3_image_audio_to_video_v2\u5DE5\u4F5C\u6D41" },
    { key: "t2v", label: "\u6587\u751F\u89C6\u9891 (T2V)", desc: "\u7EAF\u6587\u5B57\u63CF\u8FF0\u751F\u6210\uFF0C\u81EA\u7531\u5EA6\u6700\u9AD8" }
  ];
  function getVideoPricePerSec(mode, resolution) {
    return calcVideoPrice(mode, resolution, 1);
  }
  var RESOLUTIONS_I2V = [
    { key: "1080p\u6A2A", label: "1080P \u6A2A\u5C4F\uFF0816:9\uFF09" },
    { key: "1080p\u7AD6", label: "1080P \u7AD6\u5C4F\uFF089:16\uFF09" },
    { key: "1080p(1:1)", label: "1080P \u65B9\u5F62\uFF081:1\uFF09" },
    { key: "768p\u6A2A", label: "768P \u6A2A\u5C4F\uFF0816:9\uFF09" },
    { key: "768p\u7AD6", label: "768P \u7AD6\u5C4F\uFF089:16\uFF09" },
    { key: "768p(1:1)", label: "768P \u65B9\u5F62\uFF081:1\uFF09" },
    { key: "480p\u6A2A", label: "480P \u6A2A\u5C4F\uFF0816:9\uFF09" },
    { key: "480p\u7AD6", label: "480P \u7AD6\u5C4F\uFF089:16\uFF09" },
    { key: "480p(1:1)", label: "480P \u65B9\u5F62\uFF081:1\uFF09" }
  ];
  var RESOLUTIONS_BASIC = [
    { key: "768p\u6A2A", label: "768P \u6A2A\u5C4F\uFF0816:9\uFF09" },
    { key: "768p\u7AD6", label: "768P \u7AD6\u5C4F\uFF089:16\uFF09" },
    { key: "480p\u6A2A", label: "480P \u6A2A\u5C4F\uFF0816:9\uFF09" },
    { key: "480p\u7AD6", label: "480P \u7AD6\u5C4F\uFF089:16\uFF09" }
  ];
  var getResolutions = (mode) => {
    if (mode === "i2v") return RESOLUTIONS_I2V;
    if (mode === "ia2v") return RESOLUTIONS_IA2V;
    return RESOLUTIONS_BASIC;
  };
  var getDurations = (mode) => {
    if (mode === "i2v" || mode === "ia2v") return DURATIONS.filter((d) => d.key <= 10);
    return DURATIONS;
  };
  var getMaxDuration = (mode) => {
    return mode === "i2v" || mode === "ia2v" ? 10 : 15;
  };
  var DURATIONS = [
    { key: 1, label: "1\u79D2" },
    { key: 2, label: "2\u79D2" },
    { key: 3, label: "3\u79D2" },
    { key: 4, label: "4\u79D2" },
    { key: 5, label: "5\u79D2" },
    { key: 6, label: "6\u79D2" },
    { key: 7, label: "7\u79D2" },
    { key: 8, label: "8\u79D2" },
    { key: 9, label: "9\u79D2" },
    { key: 10, label: "10\u79D2" },
    { key: 11, label: "11\u79D2" },
    { key: 12, label: "12\u79D2" },
    { key: 13, label: "13\u79D2" },
    { key: 14, label: "14\u79D2" },
    { key: 15, label: "15\u79D2" }
  ];
  var I2V_WORKFLOW_ID = "minimax_h3_lightx2v_v5";
  var R2V_WORKFLOW_ID = "minimax_h3_lightx2v";
  var IA2V_WORKFLOW_ID = "minimax_h3_image_audio_to_video_v2";
  var T2V_WORKFLOW_ID = "minimax_h3_lightx2v_no_pic";
  var VIDEO_STYLES = [
    { key: "cinematic", label: "\u7535\u5F71\u7EA7\u5199\u5B9E", desc: "Cinematic realism, high contrast lighting, professional color grading" },
    { key: "anime", label: "\u52A8\u6F2B\u98CE\u683C", desc: "Anime style, vibrant colors, expressive characters, Japanese animation aesthetic" },
    { key: "realistic", label: "\u8D85\u5199\u5B9E", desc: "Hyper-realistic, photorealistic, ultra detailed, natural lighting" },
    { key: "noir", label: "\u9ED1\u8272\u7535\u5F71", desc: "Film noir, black and white, high contrast shadows, mysterious atmosphere" },
    { key: "cyberpunk", label: "\u8D5B\u535A\u670B\u514B", desc: "Cyberpunk, neon lights, futuristic city, high tech low life" },
    { key: "fantasy", label: "\u5947\u5E7B\u98CE\u683C", desc: "Fantasy style, magical atmosphere, ethereal lighting, dreamlike" },
    { key: "horror", label: "\u6050\u6016\u98CE\u683C", desc: "Horror style, dark atmosphere, eerie lighting, suspenseful" },
    { key: "comedy", label: "\u559C\u5267\u98CE\u683C", desc: "Comedy style, bright colors, cheerful atmosphere, exaggerated expressions" }
  ];
  var RESOLUTIONS_IA2V = [
    { key: "1080p\u6A2A", label: "1080P \u6A2A\u5C4F\uFF0816:9\uFF09" },
    { key: "1080p\u7AD6", label: "1080P \u7AD6\u5C4F\uFF089:16\uFF09" },
    { key: "768p\u6A2A", label: "768P \u6A2A\u5C4F\uFF0816:9\uFF09" },
    { key: "768p\u7AD6", label: "768P \u7AD6\u5C4F\uFF089:16\uFF09" },
    { key: "480p\u6A2A", label: "480P \u6A2A\u5C4F\uFF0816:9\uFF09" },
    { key: "480p\u7AD6", label: "480P \u7AD6\u5C4F\uFF089:16\uFF09" }
  ];
  var extractLastFrameViaAPI = async (videoUrl, log) => {
    try {
      if (log) log("\u6B63\u5728\u901A\u8FC7\u8C03\u5EA6\u673A\u63D0\u53D6\u89C6\u9891\u5C3E\u5E27\u2026");
      const result = await api("/api/video/extract-last-frame", {
        method: "POST",
        body: JSON.stringify({ video_url: videoUrl })
      });
      if (result && result.image_url) {
        if (log) log(`\u8C03\u5EA6\u673A\u63D0\u53D6\u5C3E\u5E27\u6210\u529F\uFF1A${result.image_url.substring(0, 80)}...`);
        return result.image_url;
      }
      if (log) log("\u26A0\uFE0F \u8C03\u5EA6\u673A\u63D0\u53D6\u5C3E\u5E27\u8FD4\u56DE\u7A7A\uFF0C\u5C06\u5C1D\u8BD5\u524D\u7AEF\u63D0\u53D6");
      return null;
    } catch (e) {
      if (log) log(`\u26A0\uFE0F \u8C03\u5EA6\u673A\u63D0\u53D6\u5C3E\u5E27\u5931\u8D25\uFF08${e.message}\uFF09\uFF0C\u5C06\u5C1D\u8BD5\u524D\u7AEF\u63D0\u53D6`);
      return null;
    }
  };
  var extractLastFrame = (videoUrl) => new Promise((resolve) => {
    if (!videoUrl || typeof videoUrl !== "string") {
      resolve(null);
      return;
    }
    let done = false;
    let objectUrl = null;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    video.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";
    document.body.appendChild(video);
    const cleanup = () => {
      try {
        video.pause();
      } catch {
      }
      try {
        video.removeAttribute("src");
        video.load();
      } catch {
      }
      try {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      } catch {
      }
      try {
        video.parentNode && video.parentNode.removeChild(video);
      } catch {
      }
    };
    const finish = (url) => {
      if (done) return;
      done = true;
      cleanup();
      resolve(url);
    };
    const fail = (reason) => {
      console.warn("[extractLastFrame] failed:", reason);
      finish(null);
    };
    video.addEventListener("error", () => fail("video error"));
    video.addEventListener("loadedmetadata", () => {
      try {
        video.currentTime = Math.max(0, (video.duration || 1) - 0.1);
      } catch (e) {
        fail("seek error");
      }
    });
    video.addEventListener("seeked", () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 720;
        canvas.height = video.videoHeight || 1280;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            objectUrl = URL.createObjectURL(blob);
            finish(objectUrl);
          } else {
            fail("toBlob null");
          }
        }, "image/jpeg", 0.9);
      } catch (e) {
        fail("canvas error: " + e.message);
      }
    });
    video.src = videoUrl;
    try {
      video.load();
    } catch (e) {
      fail("load error: " + e.message);
    }
    setTimeout(() => fail("timeout"), 15e3);
  });
  var uploadImageToServer = async (imageUrl, log) => {
    if (!imageUrl) return null;
    if (imageUrl.includes("myqcloud.com") || imageUrl.includes("cdn.jinsuai.cn")) {
      if (log) log(`\u2705 \u56FE\u7247\u5DF2\u662F\u817E\u8BAF\u4E91COS\u6C38\u4E45URL\uFF0C\u65E0\u9700\u4E0A\u4F20\uFF1A${imageUrl.substring(0, 80)}...`);
      return imageUrl;
    }
    try {
      const imgType = imageUrl.startsWith("blob:") ? "blob" : imageUrl.startsWith("data:") ? "base64" : imageUrl.startsWith("http") ? "http-url" : "other";
      if (log) log(`\u6B63\u5728\u4E0A\u4F20\u56FE\u7247\uFF08${imgType}\u683C\u5F0F\uFF0C\u957F\u5EA6${imageUrl.length}\uFF09\uFF1A${imageUrl.substring(0, 80)}${imageUrl.length > 80 ? "..." : ""}`);
      const baseUrl3 = typeof localStorage !== "undefined" && localStorage.getItem("DISPATCH_BASE_URL") || "https://api.jinsuai.cn";
      const uploadBaseUrl = baseUrl3;
      const imageBaseUrl = baseUrl3;
      const authToken = typeof localStorage !== "undefined" && localStorage.getItem("DISPATCH_TOKEN") || "";
      const authHeaders = {};
      if (authToken) {
        authHeaders["Authorization"] = "Bearer " + authToken;
      }
      if (imageUrl.startsWith("http")) {
        if (log) log(`URL\u4F20\u8C03\u5EA6\u673A\u4E0B\u8F7D\u5E76\u4FDD\u5B58\uFF1A${uploadBaseUrl}/api/upload/image`);
        const formData2 = new FormData();
        formData2.append("url", imageUrl);
        const res2 = await fetch(uploadBaseUrl + "/api/upload/image", {
          method: "POST",
          headers: authHeaders,
          body: formData2
        });
        if (res2.ok) {
          const data = await res2.json();
          let publicUrl = data.url;
          if (publicUrl && publicUrl.startsWith("/")) {
            publicUrl = imageBaseUrl + publicUrl;
          }
          if (log) log(`\u56FE\u7247\u4E0A\u4F20\u6210\u529F\uFF1A${publicUrl}`);
          return publicUrl;
        }
        const errText2 = await res2.text().catch(() => "");
        if (log) log(`\u274C \u56FE\u7247\u4E0A\u4F20\u5931\u8D25\uFF1AHTTP ${res2.status} ${errText2}`);
        console.warn("[uploadImage] \u4E0A\u4F20\u5931\u8D25:", res2.status, errText2);
        return null;
      }
      let file;
      if (imageUrl.startsWith("blob:")) {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        file = new File([blob], `image_${Date.now()}.jpg`, { type: blob.type || "image/jpeg" });
      } else if (imageUrl.startsWith("data:")) {
        const commaIdx = imageUrl.indexOf(",");
        const header = commaIdx > 0 ? imageUrl.substring(0, commaIdx) : "data:image/jpeg;base64";
        const data = commaIdx > 0 ? imageUrl.substring(commaIdx + 1) : imageUrl;
        const mimeMatch = header.match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
        const bstr = atob(data);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) u8arr[n] = bstr.charCodeAt(n);
        file = new File([u8arr], `image_${Date.now()}.jpg`, { type: mime });
      } else {
        if (log) log(`\u274C \u4E0D\u652F\u6301\u7684\u56FE\u7247\u683C\u5F0F`);
        return null;
      }
      if (log) log(`\u4E0A\u4F20\u6587\u4EF6\u5230\u8C03\u5EA6\u673A\uFF1A${uploadBaseUrl}/api/upload/image`);
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(uploadBaseUrl + "/api/upload/image", {
        method: "POST",
        headers: authHeaders,
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        let publicUrl = data.url;
        if (publicUrl && publicUrl.startsWith("/")) {
          publicUrl = imageBaseUrl + publicUrl;
        }
        if (log) log(`\u56FE\u7247\u4E0A\u4F20\u6210\u529F\uFF1A${publicUrl}`);
        return publicUrl;
      }
      const errText = await res.text().catch(() => "");
      if (log) log(`\u274C \u56FE\u7247\u4E0A\u4F20\u5931\u8D25\uFF1AHTTP ${res.status} ${errText}`);
      console.warn("[uploadImage] \u4E0A\u4F20\u5931\u8D25:", res.status, errText);
      return null;
    } catch (e) {
      if (log) log(`\u274C \u56FE\u7247\u4E0A\u4F20\u5F02\u5E38\uFF1A${e.message}`);
      console.warn("[uploadImage] \u5F02\u5E38:", e);
      return null;
    }
  };
  var VideoGenBoard = ({ project: project2, update, log, externalFirstFrame, onClearExternalFirstFrame }) => {
    const allShots = (project2.shots || []).filter(Boolean);
    const episodes = (project2.episodes || []).filter(Boolean);
    const characters = project2.materials?.characters || [];
    const [busy, setBusy] = (0, import_react4.useState)("");
    const [genProgress, setGenProgress] = (0, import_react4.useState)({});
    const [selectedMode, setSelectedMode] = (0, import_react4.useState)(() => String(getAppSetting("defaultVideoMode", "I2V")).toLowerCase());
    const [resolution, setResolution] = (0, import_react4.useState)(() => getAppSetting("defaultResolution", "768p\u7AD6"));
    const [duration, setDuration] = (0, import_react4.useState)(() => Number(getAppSetting("defaultDuration", 5)));
    const [selectedStyle, setSelectedStyle] = (0, import_react4.useState)(() => getAppSetting("defaultVideoStyle", "cinematic"));
    const [lastFrameUrl, setLastFrameUrl] = (0, import_react4.useState)("");
    const [firstFrameUrl, setFirstFrameUrl] = (0, import_react4.useState)("");
    const [refAudioUrls, setRefAudioUrls] = (0, import_react4.useState)(["", "", ""]);
    const [refImageUrl, setRefImageUrl] = (0, import_react4.useState)("");
    const [audioAssets, setAudioAssets] = (0, import_react4.useState)([]);
    const [firstFrameSource, setFirstFrameSource] = (0, import_react4.useState)("shot");
    const [lastFrameSource, setLastFrameSource] = (0, import_react4.useState)("next_shot");
    const [refiningShotId, setRefiningShotId] = (0, import_react4.useState)("");
    const [editingShotId, setEditingShotId] = (0, import_react4.useState)("");
    const [editingPrompt, setEditingPrompt] = (0, import_react4.useState)("");
    const [selectedEpisode, setSelectedEpisode] = (0, import_react4.useState)(episodes[0]?.id || "");
    const [selectedShotId, setSelectedShotId] = (0, import_react4.useState)(allShots[0]?.id || "");
    const [showCharSelect, setShowCharSelect] = (0, import_react4.useState)("");
    (0, import_react4.useEffect)(() => {
      const audios = (project2?.assets || []).filter((a) => a.type === "audio" && a.url);
      setAudioAssets(audios);
    }, [project2?.assets]);
    const shots = selectedEpisode === "all" ? allShots : allShots.filter((s2) => s2 && s2.episodeId === selectedEpisode);
    const refinePrompt = async (sh) => {
      if (refiningShotId) return;
      if (!isLoggedIn()) {
        alert("\u8BF7\u5148\u767B\u5F55\u540E\u518D\u4F7F\u7528AI\u7EC6\u5316\u63D0\u793A\u8BCD\u529F\u80FD");
        return;
      }
      try {
        const precheck2 = await precheckCredits(1, "text", "AI\u7EC6\u5316\u89C6\u9891\u63D0\u793A\u8BCD");
        if (!precheck2.sufficient && precheck2.sufficient !== void 0) {
          log(`\u274C \u79EF\u5206\u4E0D\u8DB3\uFF1A\u9700\u89811\u79EF\u5206\uFF0C\u5F53\u524D\u4F59\u989D${precheck2.balance || 0}\u79EF\u5206`);
          alert(`\u79EF\u5206\u4E0D\u8DB3\uFF01AI\u7EC6\u5316\u63D0\u793A\u8BCD\u9700\u89811\u79EF\u5206\uFF0C\u5F53\u524D\u4F59\u989D${precheck2.balance || 0}\u79EF\u5206\u3002\u8BF7\u5145\u503C\u540E\u518D\u8BD5\u3002`);
          return;
        }
      } catch (e) {
        log(`\u26A0\uFE0F \u79EF\u5206\u9884\u6821\u9A8C\u5931\u8D25\uFF1A${e.message}`);
      }
      setRefiningShotId(sh.id);
      log(`\u6B63\u5728\u4E3A\u300C${sh.title}\u300DAI\u7EC6\u5316\u89C6\u9891\u63D0\u793A\u8BCD...`);
      try {
        const sceneType = sh.sceneType || "\u4E2D\u666F";
        const cameraMove = sh.cameraMove || "\u56FA\u5B9A";
        const shotDuration = duration;
        const desc = sh.sceneDesc || "";
        const dialogue = sh.dialogue || "";
        const characters2 = (sh.characters || []).join("\u3001");
        const prompt = `\u4F60\u662F\u4E00\u540D\u4E13\u4E1A\u7684AI\u89C6\u9891\u751F\u6210\u63D0\u793A\u8BCD\u5DE5\u7A0B\u5E08\uFF0C\u7CBE\u901AMiniMax H3\u89C6\u9891\u751F\u6210\u6A21\u578B\u3002\u8BF7\u5C06\u4EE5\u4E0B\u7B80\u5355\u7684\u5206\u955C\u63CF\u8FF0\uFF0C\u7EC6\u5316\u6210\u4E00\u6BB5\u4E13\u4E1A\u3001\u8BE6\u7EC6\u3001\u9002\u5408MiniMax H3\u89C6\u9891\u751F\u6210\u6A21\u578B\u7684\u4E2D\u6587\u63D0\u793A\u8BCD\u3002

\u5206\u955C\u4FE1\u606F\uFF1A
- \u5206\u955C\u6807\u9898\uFF1A${sh.title}
- \u573A\u666F\u7C7B\u578B\uFF1A${sceneType}
- \u8FD0\u955C\u65B9\u5F0F\uFF1A${cameraMove}
- \u65F6\u957F\uFF1A${shotDuration}\u79D2
- \u5206\u955C\u63CF\u8FF0\uFF1A${desc}
- \u5BF9\u8BDD\u5185\u5BB9\uFF1A${dialogue}
- \u51FA\u573A\u89D2\u8272\uFF1A${characters2}

\u8981\u6C42\uFF1A
1. \u8F93\u51FA\u7EAF\u4E2D\u6587\u63D0\u793A\u8BCD\uFF0C\u4E0D\u8981\u82F1\u6587\uFF0C\u4E0D\u8981\u89E3\u91CA\uFF0C\u4E0D\u8981markdown
2. \u3010\u4EBA\u7269\u52A8\u4F5C\u7EC6\u5316\u3011\u8BE6\u7EC6\u63CF\u8FF0\u4EBA\u7269\u7684\u52A8\u4F5C\u3001\u8868\u60C5\u3001\u624B\u52BF\u3001\u59FF\u6001\u3001\u773C\u795E\u3001\u80A2\u4F53\u8BED\u8A00\uFF0C\u52A8\u4F5C\u8981\u5177\u4F53\u3001\u8FDE\u8D2F\u3001\u6709\u8282\u594F\u611F\uFF0C\u7B26\u5408\u4EBA\u7269\u6027\u683C\u548C\u60C5\u7EEA
3. \u3010\u7279\u6548\u6548\u679C\u7EC6\u5316\u3011\u8BE6\u7EC6\u63CF\u8FF0\u753B\u9762\u4E2D\u7684\u7279\u6548\u6548\u679C\uFF0C\u5305\u62EC\u5149\u6548\u3001\u7C92\u5B50\u3001\u70DF\u96FE\u3001\u706B\u7130\u3001\u6C34\u6D41\u3001\u80FD\u91CF\u6CE2\u52A8\u3001\u9B54\u6CD5\u6548\u679C\u3001\u7834\u788E\u3001\u7206\u70B8\u3001\u989C\u8272\u53D8\u5316\u7B49\uFF0C\u7279\u6548\u8981\u5177\u4F53\u3001\u6709\u5C42\u6B21\u3001\u6709\u52A8\u6001\u611F
4. \u8BE6\u7EC6\u63CF\u8FF0\u4E3B\u4F53\uFF08\u4EBA\u7269\u5916\u8C8C\u3001\u670D\u88C5\u3001\u8868\u60C5\u3001\u52A8\u4F5C\uFF09
5. \u8BE6\u7EC6\u63CF\u8FF0\u573A\u666F\u73AF\u5883\uFF08\u5730\u70B9\u3001\u5149\u7EBF\u3001\u6C1B\u56F4\u3001\u80CC\u666F\u5143\u7D20\uFF09
6. \u63CF\u8FF0\u955C\u5934\u8FD0\u52A8\uFF08\u63A8/\u62C9/\u6447/\u79FB/\u8DDF/\u5347\u964D/\u56FA\u5B9A\uFF09
7. \u63CF\u8FF0\u753B\u9762\u98CE\u683C\uFF08\u7535\u5F71\u7EA7\u3001\u5199\u5B9E\u3001\u52A8\u6F2B\u7B49\uFF09
8. \u63CF\u8FF0\u5149\u5F71\u6548\u679C\uFF08\u81EA\u7136\u5149\u3001\u4EBA\u5DE5\u5149\u3001\u660E\u6697\u5BF9\u6BD4\uFF09
9. \u63D0\u793A\u8BCD\u957F\u5EA6\u63A7\u5236\u5728300-500\u4E2A\u4E2D\u6587\u5B57
10. \u4E0D\u8981\u51FA\u73B0"\u955C\u5934"\u3001"\u753B\u9762"\u7B49\u5143\u63CF\u8FF0\uFF0C\u76F4\u63A5\u63CF\u8FF0\u89C6\u89C9\u5185\u5BB9
11. \u5FC5\u987B\u5F3A\u8C03\uFF1A\u8D85\u9AD8\u6E05\u753B\u8D28\uFF0C\u9510\u5229\u7EC6\u8282\uFF0C\u6240\u6709\u4EBA\u7269\u6E05\u6670\u53EF\u89C1\uFF0C\u4E3B\u89D2\u548C\u914D\u89D2\u540C\u7B49\u6E05\u6670\u5EA6\uFF0C\u65E0\u89D2\u8272\u865A\u5316
12. \u5FC5\u987B\u5F3A\u8C03\uFF1A\u573A\u666F\u7EC6\u8282\u4E30\u5BCC\uFF0C\u6240\u6709\u73AF\u5883\u5143\u7D20\u6E05\u6670\u53EF\u89C1\uFF0C\u65E0\u80CC\u666F\u865A\u5316\uFF0C\u666F\u6DF1\u9002\u4E2D\uFF0C\u5168\u5458\u5165\u955C
13. \u5FC5\u987B\u5305\u542B\uFF1A"\u8D85\u9AD8\u6E05\u753B\u8D28\uFF0C\u9510\u5229\u7EC6\u8282\uFF0C\u6240\u6709\u4EBA\u7269\u6E05\u6670\u5BF9\u7126\uFF0C\u65E0\u89D2\u8272\u865A\u5316\uFF0C\u80CC\u666F\u7EC6\u8282\u4E30\u5BCC\uFF0C\u65E0\u80CC\u666F\u865A\u5316\uFF0C\u5927\u666F\u6DF1"

\u76F4\u63A5\u8F93\u51FA\u7EC6\u5316\u540E\u7684\u4E2D\u6587\u63D0\u793A\u8BCD\uFF1A`;
        const res = await api("/api/llm/chat", {
          method: "POST",
          body: JSON.stringify({
            messages: [{ role: "user", content: prompt }],
            max_tokens: 1024
          })
        });
        const refinedText = (res.text || "").trim();
        if (!refinedText) throw new Error("LLM\u672A\u8FD4\u56DE\u5185\u5BB9");
        update({ shots: shots.map((s2) => s2.id === sh.id ? { ...s2, promptCn: refinedText } : s2) });
        log(`\u2705\u300C${sh.title}\u300D\u63D0\u793A\u8BCD\u7EC6\u5316\u6210\u529F\uFF08${refinedText.length}\u5B57\u7B26\uFF09`);
        if (isLoggedIn()) {
          try {
            await deductCredits(1, "text", "AI\u7EC6\u5316\u89C6\u9891\u63D0\u793A\u8BCD", sh.id);
            log(`\u2705 \u79EF\u5206\u6263\u51CF\u6210\u529F\uFF1A1\u79EF\u5206`);
            try {
              const balanceData = await getCreditBalance();
              if (window.onCreditUpdate) window.onCreditUpdate(balanceData.balance || balanceData.credits || 0);
              if (window.refreshUserInfo) window.refreshUserInfo();
            } catch (e) {
            }
          } catch (e) {
            log(`\u26A0\uFE0F \u79EF\u5206\u6263\u51CF\u5931\u8D25\uFF1A${e.message}`);
          }
        }
      } catch (err) {
        log(`\u274C \u63D0\u793A\u8BCD\u7EC6\u5316\u5931\u8D25\uFF1A${err.message}`);
      } finally {
        setRefiningShotId("");
      }
    };
    const getShotCharacterImages = (sh) => {
      if (sh.selectedCharIds && sh.selectedCharIds.length > 0) {
        const selectedChars = characters.filter((c) => c.image && sh.selectedCharIds.includes(c.id));
        if (selectedChars.length > 0) {
          return selectedChars.map((c) => c.image).filter(Boolean);
        }
      }
      const shotCharNames = (sh.characters || []).map((n) => n.trim());
      let matchedChars = [];
      if (shotCharNames.length > 0) {
        matchedChars = characters.filter(
          (c) => c.image && shotCharNames.some((name) => c.name?.includes(name) || name.includes(c.name))
        );
      }
      if (matchedChars.length === 0) {
        matchedChars = characters.filter((c) => c.image).slice(0, 3);
      }
      return matchedChars.map((c) => c.image).filter(Boolean);
    };
    const toggleCharSelection = (sh, charId) => {
      const selected = sh.selectedCharIds || [];
      const newSelected = selected.includes(charId) ? selected.filter((id) => id !== charId) : [...selected, charId];
      update({ shots: allShots.map((s2) => s2.id === sh.id ? { ...s2, selectedCharIds: newSelected } : s2) });
    };
    const getPrevShot = (sh) => {
      if (!sh) return null;
      const idx = shots.findIndex((s2) => s2 && s2.id === sh.id);
      if (idx <= 0) return null;
      const sameEp = shots.filter((s2) => s2 && s2.episodeId === sh.episodeId);
      const sameIdx = sameEp.findIndex((s2) => s2 && s2.id === sh.id);
      if (sameIdx > 0) {
        const prev = sameEp[sameIdx - 1];
        if (prev && prev.videoUrl && prev.videoUrl.startsWith("http")) {
          return prev;
        }
      }
      return null;
    };
    const getNextShot = (sh) => {
      if (!sh) return null;
      const sameEp = shots.filter((s2) => s2 && s2.episodeId === sh.episodeId);
      const sameIdx = sameEp.findIndex((s2) => s2 && s2.id === sh.id);
      if (sameIdx >= 0 && sameIdx < sameEp.length - 1) {
        const next = sameEp[sameIdx + 1];
        if (next && next.imageUrl && next.imageUrl.startsWith("http")) {
          return next;
        }
      }
      return null;
    };
    const genVideo = async (sh) => {
      setBusy(sh.id);
      log(`\u5F00\u59CB\u751F\u6210\u89C6\u9891\uFF1A${sh.title}\uFF08${selectedMode.toUpperCase()}\uFF09`);
      if (!isLoggedIn()) {
        alert("\u8BF7\u5148\u767B\u5F55\u540E\u518D\u4F7F\u7528\u89C6\u9891\u751F\u6210\u529F\u80FD");
        setBusy("");
        return;
      }
      try {
        const pricePerSec2 = getVideoPricePerSec(selectedMode, resolution);
        const needCredits = pricePerSec2 * duration;
        try {
          const precheck2 = await precheckCredits(needCredits, "video", `\u89C6\u9891\u751F\u6210\uFF1A${sh.title}`);
          if (!precheck2.sufficient && precheck2.sufficient !== void 0) {
            log(`\u274C \u79EF\u5206\u4E0D\u8DB3\uFF1A\u9700\u8981${needCredits}\u79EF\u5206\uFF0C\u5F53\u524D\u4F59\u989D${precheck2.balance || 0}\u79EF\u5206`);
            alert(`\u79EF\u5206\u4E0D\u8DB3\uFF01\u751F\u6210\u6B64\u89C6\u9891\u9700\u8981${needCredits}\u79EF\u5206\uFF0C\u5F53\u524D\u4F59\u989D${precheck2.balance || 0}\u79EF\u5206\u3002\u8BF7\u5145\u503C\u540E\u518D\u8BD5\u3002`);
            setBusy("");
            return;
          }
          log(`\u79EF\u5206\u9884\u6821\u9A8C\u901A\u8FC7\uFF1A\u9700\u8981${needCredits}\u79EF\u5206\uFF0C\u4F59\u989D\u5145\u8DB3`);
        } catch (e) {
          log(`\u26A0\uFE0F \u79EF\u5206\u9884\u6821\u9A8C\u5931\u8D25\uFF08${e.message}\uFF09\uFF0C\u7EE7\u7EED\u751F\u6210`);
        }
        const sceneType = sh.sceneType || "\u4E2D\u666F";
        const cameraMove = sh.cameraMove || "\u56FA\u5B9A";
        const shotDuration = duration;
        const styleObj = VIDEO_STYLES.find((s2) => s2.key === selectedStyle);
        const styleDesc = styleObj ? styleObj.desc : "";
        let videoPrompt;
        if (sh.promptCn && sh.promptCn.length > 50) {
          videoPrompt = sh.promptCn;
          if (styleDesc) {
            videoPrompt = `${videoPrompt}\u3002${styleDesc}\u3002`;
          }
          log(`\u4F7F\u7528AI\u7EC6\u5316\u63D0\u793A\u8BCD\uFF08${sh.promptCn.length}\u5B57\u7B26\uFF09+ \u98CE\u683C\uFF1A${styleObj?.label || "\u9ED8\u8BA4"}`);
        } else {
          const desc = sh.sceneDesc || "";
          videoPrompt = `${sceneType}\u955C\u5934\uFF0C${cameraMove}\u8FD0\u955C\uFF0C\u65F6\u957F${shotDuration}\u79D2\u3002${desc}\u3002${styleDesc ? styleDesc + "\u3002" : ""}\u8FDE\u7EED\u8FD0\u955C\uFF0C\u7535\u5F71\u7EA7\u7AD6\u5C4F\u77ED\u5267\u89C6\u89C9\uFF0C\u52A8\u6001\u5149\u5F71\uFF0C\u753B\u9762\u6D41\u7545\u81EA\u7136\uFF0C\u8D85\u9AD8\u6E05\u753B\u8D28\uFF0C\u9510\u5229\u7EC6\u8282\uFF0C\u6240\u6709\u4EBA\u7269\u6E05\u6670\u53EF\u89C1\uFF0C\u4E3B\u89D2\u548C\u914D\u89D2\u540C\u7B49\u6E05\u6670\u5EA6\uFF0C\u65E0\u89D2\u8272\u865A\u5316\uFF0C\u573A\u666F\u7EC6\u8282\u4E30\u5BCC\uFF0C\u6240\u6709\u73AF\u5883\u5143\u7D20\u6E05\u6670\u53EF\u89C1\uFF0C\u65E0\u80CC\u666F\u865A\u5316\uFF0C\u666F\u6DF1\u9002\u4E2D\uFF0C\u5168\u5458\u5165\u955C\uFF0C\u65E0\u53EF\u89C1\u62CD\u6444\u8BBE\u5907\uFF0C\u4E00\u955C\u5230\u5E95\u611F\u3002\u7AD6\u5C4F9:16\u6784\u56FE\uFF0C\u4E13\u4E1A\u5F71\u89C6\u7EA7\u753B\u9762\u3002`;
          log(`\u4F7F\u7528\u9ED8\u8BA4\u6A21\u677F\u63D0\u793A\u8BCD + \u98CE\u683C\uFF1A${styleObj?.label || "\u9ED8\u8BA4"}\uFF08\u5EFA\u8BAE\u5148\u70B9\u51FBAI\u7EC6\u5316\u63D0\u793A\u8BCD\uFF09`);
        }
        const workflowParams = {
          prompt: videoPrompt,
          duration: Math.min(10, shotDuration),
          resolution
        };
        let refIdx = 0;
        let hasFirstFrame = false;
        if (selectedMode === "i2v") {
          const charImages = getShotCharacterImages(sh);
          if (charImages.length === 0) {
            log("\u26A0\uFE0F \u6CA1\u6709\u53EF\u7528\u7684\u89D2\u8272\u53C2\u8003\u56FE\uFF0C\u8BF7\u5148\u5728\u300C\u4EBA\u7269\u7BA1\u7406\u300D\u751F\u6210\u89D2\u8272\u4E09\u89C6\u56FE");
            setBusy("");
            return;
          }
          log(`\u627E\u5230${charImages.length}\u5F20\u89D2\u8272\u56FE\uFF0C\u5F00\u59CB\u4E0A\u4F20\u2026`);
          let refIdx2 = 0;
          for (let i = 0; i < charImages.length; i++) {
            if (refIdx2 >= 9) break;
            const img = charImages[i];
            log(`\u6B63\u5728\u4E0A\u4F20\u7B2C${i + 1}\u5F20\u89D2\u8272\u56FE\u2026`);
            const charPublicUrl = await uploadImageToServer(img, log);
            if (charPublicUrl) {
              workflowParams[`ref_image_${refIdx2}`] = charPublicUrl;
              log(`\u7B2C${i + 1}\u5F20\u89D2\u8272\u56FE\u4E0A\u4F20\u6210\u529F\uFF0Cref_image_${refIdx2} = ${charPublicUrl.substring(0, 80)}...`);
              refIdx2++;
            } else {
              log(`\u274C \u7B2C${i + 1}\u5F20\u89D2\u8272\u56FE\u4E0A\u4F20\u5931\u8D25`);
            }
          }
          const charCount = refIdx2;
          const seed = Math.floor(Math.random() * 2147483647);
          workflowParams.seed = seed;
          log(`\u968F\u673A\u79CD\u5B50\uFF1A${seed}`);
          log(`\u53C2\u8003\u56FE\uFF1A\u4EBA\u7269${charCount}\u5F20\uFF08ref_image_0-ref_image_${charCount - 1}\uFF09\uFF0C\u4E0D\u4F7F\u7528\u9996\u5E27`);
        } else if (selectedMode === "r2v") {
          const prevShot = getPrevShot(sh);
          const nextShot = getNextShot(sh);
          let resolvedFirstFrame = null;
          let firstFrameDesc = "";
          if (firstFrameSource === "shot") {
            resolvedFirstFrame = sh.imageUrl;
            firstFrameDesc = `\u672C\u5206\u955C\u300C${sh.title}\u300D\u5206\u955C\u56FE`;
          } else if (firstFrameSource === "prev_video") {
            if (prevShot && prevShot.videoUrl) {
              log(`\u627E\u5230\u4E0A\u4E00\u955C\u300C${prevShot.title}\u300D\u89C6\u9891\uFF0C\u6B63\u5728\u63D0\u53D6\u5C3E\u5E27\u4F5C\u4E3A\u9996\u5E27\u2026`);
              resolvedFirstFrame = await extractLastFrameViaAPI(prevShot.videoUrl, log);
              if (!resolvedFirstFrame) {
                log("\u8C03\u5EA6\u673A\u63D0\u53D6\u5931\u8D25\uFF0C\u5C1D\u8BD5\u524D\u7AEF\u63D0\u53D6\u2026");
                const firstFrame = await extractLastFrame(prevShot.videoUrl);
                if (firstFrame) {
                  resolvedFirstFrame = await uploadImageToServer(firstFrame, log);
                }
              }
              firstFrameDesc = `\u4E0A\u4E00\u955C\u300C${prevShot.title}\u300D\u89C6\u9891\u5C3E\u5E27`;
            } else {
              throw new Error("\u9996\u5E27\u6765\u6E90\u9009\u62E9\u4E86\u300C\u4E0A\u4E2A\u89C6\u9891\u5C3E\u5E27\u300D\uFF0C\u4F46\u4E0A\u4E00\u955C\u6CA1\u6709\u751F\u6210\u89C6\u9891\u3002\u8BF7\u5148\u751F\u6210\u4E0A\u4E00\u955C\u89C6\u9891\uFF0C\u6216\u9009\u62E9\u5176\u4ED6\u9996\u5E27\u6765\u6E90\u3002");
            }
          } else if (firstFrameSource === "custom") {
            resolvedFirstFrame = firstFrameUrl;
            firstFrameDesc = "\u7528\u6237\u624B\u52A8\u4E0A\u4F20";
          }
          if (!resolvedFirstFrame) {
            throw new Error(`\u9996\u5E27\u83B7\u53D6\u5931\u8D25\uFF08\u6765\u6E90\uFF1A${firstFrameDesc}\uFF09\u3002\u8BF7\u68C0\u67E5\u56FE\u7247\u662F\u5426\u6709\u6548\uFF0C\u6216\u9009\u62E9\u5176\u4ED6\u9996\u5E27\u6765\u6E90\u3002`);
          }
          log(`\u9996\u5E27\uFF1A${firstFrameDesc}`);
          const firstPublicUrl = await uploadImageToServer(resolvedFirstFrame, log);
          if (!firstPublicUrl) {
            throw new Error("\u9996\u5E27\u4E0A\u4F20\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u56FE\u7247URL\u6216\u91CD\u65B0\u4E0A\u4F20\u3002");
          }
          workflowParams.first_frame = firstPublicUrl;
          log(`\u9996\u5E27\u4E0A\u4F20\u6210\u529F \u2713`);
          let resolvedLastFrame = null;
          let lastFrameDesc = "";
          if (lastFrameSource === "next_shot") {
            if (nextShot && nextShot.imageUrl) {
              resolvedLastFrame = nextShot.imageUrl;
              lastFrameDesc = `\u4E0B\u4E00\u5206\u955C\u300C${nextShot.title}\u300D\u5206\u955C\u56FE`;
            } else {
              throw new Error("\u5C3E\u5E27\u6765\u6E90\u9009\u62E9\u4E86\u300C\u4E0B\u4E00\u5206\u955C\u5206\u955C\u56FE\u300D\uFF0C\u4F46\u4E0B\u4E00\u5206\u955C\u6CA1\u6709\u5206\u955C\u56FE\u3002\u8BF7\u5148\u751F\u6210\u4E0B\u4E00\u5206\u955C\u5206\u955C\u56FE\uFF0C\u6216\u9009\u62E9\u5176\u4ED6\u5C3E\u5E27\u6765\u6E90\u3002");
            }
          } else if (lastFrameSource === "next_video") {
            if (nextShot && nextShot.videoUrl) {
              log(`\u627E\u5230\u4E0B\u4E00\u955C\u300C${nextShot.title}\u300D\u89C6\u9891\uFF0C\u6B63\u5728\u63D0\u53D6\u9996\u5E27\u4F5C\u4E3A\u5C3E\u5E27\u2026`);
              try {
                const video = document.createElement("video");
                video.crossOrigin = "anonymous";
                video.src = nextShot.videoUrl;
                await new Promise((resolve, reject) => {
                  video.onloadeddata = resolve;
                  video.onerror = reject;
                });
                video.currentTime = 0;
                await new Promise((resolve) => {
                  video.onseeked = resolve;
                });
                const canvas = document.createElement("canvas");
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(video, 0, 0);
                const firstFrameDataUrl = canvas.toDataURL("image/png");
                resolvedLastFrame = await uploadImageToServer(firstFrameDataUrl, log);
                lastFrameDesc = `\u4E0B\u4E00\u955C\u300C${nextShot.title}\u300D\u89C6\u9891\u9996\u5E27`;
              } catch (e) {
                log(`\u26A0\uFE0F \u63D0\u53D6\u4E0B\u4E00\u955C\u89C6\u9891\u9996\u5E27\u5931\u8D25\uFF1A${e.message}`);
                throw new Error("\u5C3E\u5E27\u6765\u6E90\u9009\u62E9\u4E86\u300C\u4E0B\u4E2A\u89C6\u9891\u9996\u5E27\u300D\uFF0C\u4F46\u63D0\u53D6\u4E0B\u4E00\u955C\u89C6\u9891\u9996\u5E27\u5931\u8D25\u3002\u8BF7\u9009\u62E9\u5176\u4ED6\u5C3E\u5E27\u6765\u6E90\u3002");
              }
            } else {
              throw new Error("\u5C3E\u5E27\u6765\u6E90\u9009\u62E9\u4E86\u300C\u4E0B\u4E2A\u89C6\u9891\u9996\u5E27\u300D\uFF0C\u4F46\u4E0B\u4E00\u955C\u6CA1\u6709\u751F\u6210\u89C6\u9891\u3002\u8BF7\u5148\u751F\u6210\u4E0B\u4E00\u955C\u89C6\u9891\uFF0C\u6216\u9009\u62E9\u5176\u4ED6\u5C3E\u5E27\u6765\u6E90\u3002");
            }
          } else if (lastFrameSource === "custom") {
            resolvedLastFrame = lastFrameUrl;
            lastFrameDesc = "\u7528\u6237\u624B\u52A8\u4E0A\u4F20";
          }
          if (!resolvedLastFrame) {
            throw new Error(`\u5C3E\u5E27\u83B7\u53D6\u5931\u8D25\uFF08\u6765\u6E90\uFF1A${lastFrameDesc}\uFF09\u3002\u5C3E\u5E27\u662F\u5FC5\u586B\u9879\uFF0C\u8BF7\u68C0\u67E5\u56FE\u7247\u662F\u5426\u6709\u6548\uFF0C\u6216\u9009\u62E9\u5176\u4ED6\u5C3E\u5E27\u6765\u6E90\u3002`);
          }
          log(`\u5C3E\u5E27\uFF1A${lastFrameDesc}`);
          const lastPublicUrl = await uploadImageToServer(resolvedLastFrame, log);
          if (!lastPublicUrl) {
            throw new Error("\u5C3E\u5E27\u4E0A\u4F20\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u56FE\u7247URL\u6216\u91CD\u65B0\u4E0A\u4F20\u3002");
          }
          workflowParams.last_frame = lastPublicUrl;
          log(`\u5C3E\u5E27\u4E0A\u4F20\u6210\u529F \u2713`);
          log(`\u9996\u5C3E\u5E27\uFF08lightx2v\uFF09\uFF1A\u9996\u5E27\u2713 \u5C3E\u5E27\u2713\uFF08\u5747\u4E3A\u5FC5\u586B\uFF09`);
        } else if (selectedMode === "ia2v") {
          let refImages = [];
          if (refImageUrl) {
            refImages.push(refImageUrl);
            log("\u53C2\u8003\u56FE\u7247\uFF1A\u4F7F\u7528\u7528\u6237\u624B\u52A8\u4E0A\u4F20\u7684\u53C2\u8003\u56FE");
          } else {
            const charImages = getShotCharacterImages(sh);
            if (charImages.length > 0) {
              refImages = charImages;
              log(`\u53C2\u8003\u56FE\u7247\uFF1A\u81EA\u52A8\u83B7\u53D6 ${charImages.length} \u5F20\u89D2\u8272\u53C2\u8003\u56FE`);
            } else {
              log("\u26A0\uFE0F \u6CA1\u6709\u89D2\u8272\u53C2\u8003\u56FE\uFF0C\u4E5F\u6CA1\u6709\u624B\u52A8\u4E0A\u4F20\u53C2\u8003\u56FE\uFF0C\u5C06\u7EAF\u6587\u672C\u751F\u6210");
            }
          }
          let refImgIdx = 0;
          for (let i = 0; i < refImages.length; i++) {
            if (refImgIdx >= 9) break;
            const img = refImages[i];
            const imgPublicUrl = await uploadImageToServer(img, log);
            if (imgPublicUrl) {
              workflowParams[`ref_image_${refImgIdx}`] = imgPublicUrl;
              refImgIdx++;
            }
          }
          let audioIdx = 0;
          for (let i = 0; i < refAudioUrls.length; i++) {
            const audioUrl = refAudioUrls[i]?.trim();
            if (audioUrl && audioUrl.startsWith("http")) {
              workflowParams[`ref_audio_${audioIdx}`] = audioUrl;
              audioIdx++;
            }
          }
          if (audioIdx === 0) {
            log("\u2139\uFE0F \u672A\u586B\u5199\u53C2\u8003\u97F3\u9891\uFF0C\u5C06\u4E0D\u4F7F\u7528\u97F3\u9891\u53C2\u8003");
          }
          const seed = Math.floor(Math.random() * 2147483647);
          workflowParams.seed = seed;
          log(`\u968F\u673A\u79CD\u5B50\uFF1A${seed}`);
          log(`\u5168\u80FD\u53C2\u8003\uFF08Ref2VA v2\uFF09\uFF1A\u53C2\u8003\u56FE${refImgIdx}\u5F20 + \u53C2\u8003\u97F3\u9891${audioIdx}\u4E2A + \u65F6\u957F${workflowParams.duration}\u79D2`);
        }
        let currentWorkflowId;
        if (selectedMode === "i2v") {
          currentWorkflowId = I2V_WORKFLOW_ID;
        } else if (selectedMode === "r2v") {
          currentWorkflowId = R2V_WORKFLOW_ID;
        } else if (selectedMode === "ia2v") {
          currentWorkflowId = IA2V_WORKFLOW_ID;
        } else {
          currentWorkflowId = T2V_WORKFLOW_ID;
        }
        const maxDuration = getMaxDuration(selectedMode);
        workflowParams.duration = Math.min(maxDuration, Math.max(1, workflowParams.duration));
        log(`\u63D0\u4EA4\u89C6\u9891\u751F\u6210\u4EFB\u52A1\uFF0C\u5DE5\u4F5C\u6D41\uFF1A${currentWorkflowId}\uFF0C\u6A21\u5F0F\uFF1A${selectedMode}`);
        const res = await runDispatchJob({
          type: "video",
          payload: {
            workflow: currentWorkflowId,
            model: "MiniMax-H3",
            mode: selectedMode,
            ...workflowParams
          },
          pollInterval: 5e3,
          timeoutMs: 72e5,
          onProgress: (progress, text, info) => {
            setGenProgress((prev) => ({ ...prev, [sh.id]: { text, ...info } }));
          }
        });
        const actualDuration = await new Promise((resolve) => {
          const v = document.createElement("video");
          v.preload = "metadata";
          v.onloadedmetadata = () => resolve(Math.round(v.duration));
          v.onerror = () => resolve(null);
          v.src = res.resultUrl;
        });
        const durationUpdate = actualDuration ? { duration: actualDuration } : {};
        update({ shots: shots.map((s2) => s2.id === sh.id ? { ...s2, videoUrl: res.resultUrl, ...durationUpdate } : s2) });
        if (getAppSetting("autoAddToAssets", true)) {
          try {
            const currentAssets = project2?.assets || [];
            const newVideoAsset = {
              id: "a_video_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8),
              type: "video",
              title: `${sh.title}\uFF08${(/* @__PURE__ */ new Date()).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}\uFF09`,
              url: res.resultUrl,
              status: "ready",
              tags: ["\u89C6\u9891\u751F\u6210", selectedMode.toUpperCase(), sh.episodeId ? `\u7B2C${sh.episodeId}\u96C6` : ""].filter(Boolean),
              favorite: false,
              shotId: sh.id,
              episodeId: sh.episodeId || "",
              duration: actualDuration || duration,
              resolution,
              mode: selectedMode,
              createdAt: Date.now()
            };
            update({ assets: [newVideoAsset, ...currentAssets] });
            log(`\u2705 \u89C6\u9891\u5DF2\u5B58\u5165\u7D20\u6750\u5E93\uFF1A${newVideoAsset.title}`);
          } catch (e) {
            log(`\u26A0\uFE0F \u89C6\u9891\u5B58\u5165\u7D20\u6750\u5E93\u5931\u8D25\uFF1A${e.message}`);
          }
        }
        log(`\u2705 \u89C6\u9891\u751F\u6210\u6210\u529F\uFF1A${sh.title}${actualDuration ? `\uFF08\u5B9E\u9645\u65F6\u957F${actualDuration}\u79D2\uFF09` : ""}`);
        if (isLoggedIn()) {
          try {
            const actualCredits = pricePerSec2 * (actualDuration || duration);
            await deductCredits(actualCredits, "video", `\u89C6\u9891\u751F\u6210\uFF1A${sh.title}`, sh.id);
            log(`\u2705 \u79EF\u5206\u6263\u51CF\u6210\u529F\uFF1A${actualCredits}\u79EF\u5206`);
            try {
              const balanceData = await getCreditBalance();
              if (window.onCreditUpdate) window.onCreditUpdate(balanceData.balance || balanceData.credits || 0);
              if (window.refreshUserInfo) window.refreshUserInfo();
            } catch (e) {
            }
          } catch (e) {
            log(`\u26A0\uFE0F \u79EF\u5206\u6263\u51CF\u5931\u8D25\uFF1A${e.message}`);
          }
        }
      } catch (e) {
        log(`\u274C \u89C6\u9891\u751F\u6210\u5931\u8D25\uFF1A${e.message}`);
      } finally {
        setBusy("");
        setGenProgress((prev) => {
          const next = { ...prev };
          delete next[sh.id];
          return next;
        });
      }
    };
    const pricePerSec = getVideoPricePerSec(selectedMode, resolution);
    const currentCredits = pricePerSec * duration;
    const showLastFrame = selectedMode === "r2v";
    return /* @__PURE__ */ import_react4.default.createElement("div", { style: { padding: 16, height: "100%", overflow: "auto", color: "var(--text)" } }, externalFirstFrame && /* @__PURE__ */ import_react4.default.createElement("div", { style: { marginBottom: 12, padding: "10px 14px", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 8, background: "rgba(245,158,11,0.08)", display: "flex", alignItems: "center", gap: 12 } }, /* @__PURE__ */ import_react4.default.createElement("img", { src: externalFirstFrame, alt: "3D\u5BFC\u6F14\u53F0\u9996\u5E27", style: { width: 60, height: 60, objectFit: "cover", borderRadius: 4, border: "1px solid rgba(255,255,255,0.2)" } }), /* @__PURE__ */ import_react4.default.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: "#f59e0b", marginBottom: 2 } }, "\u{1F3AC} \u5DF2\u4F7F\u75283D\u5BFC\u6F14\u53F0\u6E32\u67D3\u7684\u9996\u5E27"), /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 11, color: "var(--text-muted)" } }, "i2v\u6A21\u5F0F\u5C06\u4F18\u5148\u4F7F\u7528\u6B64\u9996\u5E27\u4F5C\u4E3A\u53C2\u8003\u56FE")), /* @__PURE__ */ import_react4.default.createElement("button", { onClick: () => {
      onClearExternalFirstFrame?.();
      log("\u5DF2\u6E05\u96643D\u5BFC\u6F14\u53F0\u9996\u5E27");
    }, style: { padding: "6px 12px", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 6, background: "transparent", color: "#f59e0b", cursor: "pointer", fontSize: 11 } }, "\u6E05\u9664")), /* @__PURE__ */ import_react4.default.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 } }, /* @__PURE__ */ import_react4.default.createElement("h2", { style: { margin: 0, fontSize: 18 } }, "\u{1F3A5} \u89C6\u9891\u751F\u6210 \xB7 MiniMax-H3"), /* @__PURE__ */ import_react4.default.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } }, /* @__PURE__ */ import_react4.default.createElement(
      "select",
      {
        style: { padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 12 },
        value: selectedMode,
        onChange: (e) => {
          const newMode = e.target.value;
          setSelectedMode(newMode);
          const availableResolutions = getResolutions(newMode);
          if (!availableResolutions.find((r) => r.key === resolution)) {
            setResolution("768p\u7AD6");
          }
          const maxDur = getMaxDuration(newMode);
          if (duration > maxDur) {
            setDuration(maxDur);
          }
        }
      },
      VIDEO_MODES.map((m) => /* @__PURE__ */ import_react4.default.createElement("option", { key: m.key, value: m.key }, m.label))
    ), /* @__PURE__ */ import_react4.default.createElement(
      "select",
      {
        style: { padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 12 },
        value: resolution,
        onChange: (e) => setResolution(e.target.value)
      },
      getResolutions(selectedMode).map((r) => /* @__PURE__ */ import_react4.default.createElement("option", { key: r.key, value: r.key }, r.label))
    ), /* @__PURE__ */ import_react4.default.createElement(
      "select",
      {
        style: { padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 12 },
        value: duration,
        onChange: (e) => setDuration(Number(e.target.value))
      },
      getDurations(selectedMode).map((d) => /* @__PURE__ */ import_react4.default.createElement("option", { key: d.key, value: d.key }, d.label))
    ), /* @__PURE__ */ import_react4.default.createElement(
      "select",
      {
        style: { padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 12 },
        value: selectedStyle,
        onChange: (e) => setSelectedStyle(e.target.value),
        title: "\u9009\u62E9\u89C6\u9891\u98CE\u683C"
      },
      VIDEO_STYLES.map((s2) => /* @__PURE__ */ import_react4.default.createElement("option", { key: s2.key, value: s2.key }, s2.label))
    ), /* @__PURE__ */ import_react4.default.createElement(
      "select",
      {
        style: { padding: "6px 10px", border: "1px solid #7A5CFF", borderRadius: 6, background: "rgba(122,92,255,0.1)", color: "var(--text)", fontSize: 12 },
        value: selectedEpisode,
        onChange: (e) => setSelectedEpisode(e.target.value)
      },
      episodes.map((ep, i) => {
        const epShots = allShots.filter((s2) => s2 && s2.episodeId === ep.id);
        return /* @__PURE__ */ import_react4.default.createElement("option", { key: ep.id, value: ep.id }, ep.title || `\u7B2C${i + 1}\u96C6`, "\uFF08", epShots.length, "\u4E2A\u5206\u955C\uFF09");
      })
    ))), /* @__PURE__ */ import_react4.default.createElement("div", { style: { marginBottom: 12, padding: "10px 14px", border: "1px solid rgba(122,92,255,0.3)", borderRadius: 8, background: "rgba(122,92,255,0.1)" } }, /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 12, color: "#7A5CFF", fontWeight: 600, marginBottom: 4 } }, "\u5F53\u524D\u6A21\u5F0F\uFF1A", VIDEO_MODES.find((m) => m.key === selectedMode)?.label), /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 11, color: "var(--text-secondary)" } }, VIDEO_MODES.find((m) => m.key === selectedMode)?.desc, " \xB7 ", resolution, " ", duration, "\u79D2 = ", currentCredits, " \u79EF\u5206\uFF08", pricePerSec, "\u79EF\u5206/\u79D2\uFF09")), showLastFrame && /* @__PURE__ */ import_react4.default.createElement("div", { style: { marginBottom: 16, padding: 12, border: "1px solid var(--border)", borderRadius: 8, background: "var(--panel-2)" } }, /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 12, fontWeight: 600, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" } }, /* @__PURE__ */ import_react4.default.createElement("span", null, "\u{1F5BC}\uFE0F \u9996\u5C3E\u5E27\u8BBE\u7F6E\uFF08\u9996\u5E27\u548C\u5C3E\u5E27\u5747\u4E3A\u5FC5\u586B\uFF0C\u5404\u6709\u4E09\u79CD\u6765\u6E90\u53EF\u9009\uFF09"), /* @__PURE__ */ import_react4.default.createElement("span", { style: { fontSize: 11, color: "#7A5CFF", fontWeight: 500 } }, "\u5F53\u524D\u5206\u955C\uFF1A", shots.find((s2) => s2.id === selectedShotId)?.title || "\u8BF7\u70B9\u51FB\u4E0B\u65B9\u5206\u955C\u5361\u7247\u9009\u62E9")), /* @__PURE__ */ import_react4.default.createElement("div", { style: { marginBottom: 12, padding: 10, border: "1px solid rgba(245,158,11,0.3)", borderRadius: 6, background: "rgba(245,158,11,0.05)" } }, /* @__PURE__ */ import_react4.default.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 } }, /* @__PURE__ */ import_react4.default.createElement("span", { style: { fontSize: 11, fontWeight: 600, color: "#f59e0b" } }, /* @__PURE__ */ import_react4.default.createElement("span", { style: { color: "#f59e0b", fontWeight: 600 } }, "*"), " \u9996\u5E27\uFF08\u5FC5\u586B\uFF09"), /* @__PURE__ */ import_react4.default.createElement(
      "select",
      {
        value: firstFrameSource,
        onChange: (e) => setFirstFrameSource(e.target.value),
        style: { padding: "4px 8px", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 4, background: "var(--input-bg)", color: "var(--text)", fontSize: 11 }
      },
      /* @__PURE__ */ import_react4.default.createElement("option", { value: "shot" }, "\u672C\u5206\u955C\u5206\u955C\u56FE"),
      /* @__PURE__ */ import_react4.default.createElement("option", { value: "prev_video" }, "\u4E0A\u4E2A\u89C6\u9891\u5C3E\u5E27"),
      /* @__PURE__ */ import_react4.default.createElement("option", { value: "custom" }, "\u7528\u6237\u624B\u52A8\u4E0A\u4F20")
    )), firstFrameSource === "custom" && /* @__PURE__ */ import_react4.default.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", marginBottom: 6 } }, /* @__PURE__ */ import_react4.default.createElement(
      "input",
      {
        style: { flex: 1, padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 12 },
        placeholder: "\u9996\u5E27\u56FE\u7247 URL",
        value: firstFrameUrl,
        onChange: (e) => setFirstFrameUrl(e.target.value)
      }
    ), /* @__PURE__ */ import_react4.default.createElement(
      "input",
      {
        type: "file",
        accept: "image/*",
        style: { display: "none" },
        id: "firstFrameUpload",
        onChange: async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          log("\u6B63\u5728\u4E0A\u4F20\u9996\u5E27\u56FE\u7247\u2026");
          try {
            const objectUrl = URL.createObjectURL(file);
            const publicUrl = await uploadImageToServer(objectUrl, log);
            if (publicUrl) {
              setFirstFrameUrl(publicUrl);
              log("\u9996\u5E27\u56FE\u7247\u4E0A\u4F20\u6210\u529F \u2713");
            } else {
              log("\u274C \u9996\u5E27\u56FE\u7247\u4E0A\u4F20\u5931\u8D25");
            }
            URL.revokeObjectURL(objectUrl);
          } catch (err) {
            log("\u274C \u9996\u5E27\u56FE\u7247\u4E0A\u4F20\u5931\u8D25: " + err.message);
          }
          e.target.value = "";
        }
      }
    ), /* @__PURE__ */ import_react4.default.createElement(
      "button",
      {
        onClick: () => document.getElementById("firstFrameUpload").click(),
        style: { padding: "6px 12px", border: "none", borderRadius: 6, background: "#f59e0b", color: "#fff", cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }
      },
      "\u{1F4E4} \u4E0A\u4F20"
    )), /* @__PURE__ */ import_react4.default.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center" } }, /* @__PURE__ */ import_react4.default.createElement("div", { style: { width: 80, height: 100, background: "var(--input-bg)", borderRadius: 4, overflow: "hidden", border: "1px solid var(--border)" } }, (() => {
      const currentShot = shots.find((s2) => s2.id === selectedShotId);
      const prevShot = currentShot ? getPrevShot(currentShot) : null;
      let previewUrl = "";
      if (firstFrameSource === "shot") previewUrl = currentShot?.imageUrl || "";
      else if (firstFrameSource === "prev_video") previewUrl = prevShot?.videoUrl ? "" : "";
      else if (firstFrameSource === "custom") previewUrl = firstFrameUrl || "";
      return previewUrl ? /* @__PURE__ */ import_react4.default.createElement("img", { src: previewUrl, alt: "\u9996\u5E27\u9884\u89C8", style: { width: "100%", height: "100%", objectFit: "cover" } }) : /* @__PURE__ */ import_react4.default.createElement("div", { style: { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "var(--text-muted)", textAlign: "center", padding: 4 } }, firstFrameSource === "shot" ? "\u65E0\u5206\u955C\u56FE" : firstFrameSource === "prev_video" ? "\u9700\u751F\u6210\u65F6\u63D0\u53D6" : "\u8BF7\u4E0A\u4F20\u56FE\u7247");
    })()), /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 10, color: "var(--text-muted)", flex: 1 } }, firstFrameSource === "shot" && (shots.find((s2) => s2.id === selectedShotId)?.imageUrl ? "\u2713 \u4F7F\u7528\u672C\u5206\u955C\u5206\u955C\u56FE" : "\u26A0\uFE0F \u672C\u5206\u955C\u65E0\u5206\u955C\u56FE\uFF0C\u8BF7\u5148\u751F\u6210"), firstFrameSource === "prev_video" && (getPrevShot(shots.find((s2) => s2.id === selectedShotId))?.videoUrl ? "\u2713 \u5C06\u63D0\u53D6\u4E0A\u4E2A\u89C6\u9891\u5C3E\u5E27" : "\u26A0\uFE0F \u4E0A\u4E2A\u89C6\u9891\u4E0D\u5B58\u5728\uFF0C\u8BF7\u5148\u751F\u6210"), firstFrameSource === "custom" && (firstFrameUrl ? "\u2713 \u4F7F\u7528\u624B\u52A8\u4E0A\u4F20\u7684\u9996\u5E27" : "\u26A0\uFE0F \u8BF7\u4E0A\u4F20\u6216\u586B\u5199\u9996\u5E27URL")))), /* @__PURE__ */ import_react4.default.createElement("div", { style: { padding: 10, border: "1px solid rgba(16,185,129,0.3)", borderRadius: 6, background: "rgba(16,185,129,0.05)" } }, /* @__PURE__ */ import_react4.default.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 } }, /* @__PURE__ */ import_react4.default.createElement("span", { style: { fontSize: 11, fontWeight: 600, color: "#10b981" } }, /* @__PURE__ */ import_react4.default.createElement("span", { style: { color: "#10b981", fontWeight: 600 } }, "*"), " \u5C3E\u5E27\uFF08\u5FC5\u586B\uFF09"), /* @__PURE__ */ import_react4.default.createElement(
      "select",
      {
        value: lastFrameSource,
        onChange: (e) => setLastFrameSource(e.target.value),
        style: { padding: "4px 8px", border: "1px solid rgba(16,185,129,0.4)", borderRadius: 4, background: "var(--input-bg)", color: "var(--text)", fontSize: 11 }
      },
      /* @__PURE__ */ import_react4.default.createElement("option", { value: "next_shot" }, "\u4E0B\u4E00\u5206\u955C\u5206\u955C\u56FE"),
      /* @__PURE__ */ import_react4.default.createElement("option", { value: "next_video" }, "\u4E0B\u4E2A\u89C6\u9891\u9996\u5E27"),
      /* @__PURE__ */ import_react4.default.createElement("option", { value: "custom" }, "\u7528\u6237\u624B\u52A8\u4E0A\u4F20")
    )), lastFrameSource === "custom" && /* @__PURE__ */ import_react4.default.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", marginBottom: 6 } }, /* @__PURE__ */ import_react4.default.createElement(
      "input",
      {
        style: { flex: 1, padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 12 },
        placeholder: "\u5C3E\u5E27\u56FE\u7247 URL",
        value: lastFrameUrl,
        onChange: (e) => setLastFrameUrl(e.target.value)
      }
    ), /* @__PURE__ */ import_react4.default.createElement(
      "input",
      {
        type: "file",
        accept: "image/*",
        style: { display: "none" },
        id: "lastFrameUpload",
        onChange: async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          log("\u6B63\u5728\u4E0A\u4F20\u5C3E\u5E27\u56FE\u7247\u2026");
          try {
            const objectUrl = URL.createObjectURL(file);
            const publicUrl = await uploadImageToServer(objectUrl, log);
            if (publicUrl) {
              setLastFrameUrl(publicUrl);
              log("\u5C3E\u5E27\u56FE\u7247\u4E0A\u4F20\u6210\u529F \u2713");
            } else {
              log("\u274C \u5C3E\u5E27\u56FE\u7247\u4E0A\u4F20\u5931\u8D25");
            }
            URL.revokeObjectURL(objectUrl);
          } catch (err) {
            log("\u274C \u5C3E\u5E27\u56FE\u7247\u4E0A\u4F20\u5931\u8D25: " + err.message);
          }
          e.target.value = "";
        }
      }
    ), /* @__PURE__ */ import_react4.default.createElement(
      "button",
      {
        onClick: () => document.getElementById("lastFrameUpload").click(),
        style: { padding: "6px 12px", border: "none", borderRadius: 6, background: "#10b981", color: "#fff", cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }
      },
      "\u{1F4E4} \u4E0A\u4F20"
    )), /* @__PURE__ */ import_react4.default.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center" } }, /* @__PURE__ */ import_react4.default.createElement("div", { style: { width: 80, height: 100, background: "var(--input-bg)", borderRadius: 4, overflow: "hidden", border: "1px solid var(--border)" } }, (() => {
      const currentShot = shots.find((s2) => s2.id === selectedShotId);
      const nextShot = currentShot ? getNextShot(currentShot) : null;
      let previewUrl = "";
      if (lastFrameSource === "next_shot") previewUrl = nextShot?.imageUrl || "";
      else if (lastFrameSource === "next_video") previewUrl = "";
      else if (lastFrameSource === "custom") previewUrl = lastFrameUrl || "";
      return previewUrl ? /* @__PURE__ */ import_react4.default.createElement("img", { src: previewUrl, alt: "\u5C3E\u5E27\u9884\u89C8", style: { width: "100%", height: "100%", objectFit: "cover" } }) : /* @__PURE__ */ import_react4.default.createElement("div", { style: { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "var(--text-muted)", textAlign: "center", padding: 4 } }, lastFrameSource === "next_shot" ? "\u65E0\u5206\u955C\u56FE" : lastFrameSource === "next_video" ? "\u9700\u751F\u6210\u65F6\u63D0\u53D6" : "\u8BF7\u4E0A\u4F20\u56FE\u7247");
    })()), /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 10, color: "var(--text-muted)", flex: 1 } }, lastFrameSource === "next_shot" && (getNextShot(shots.find((s2) => s2.id === selectedShotId))?.imageUrl ? `\u2713 \u4F7F\u7528\u4E0B\u4E00\u5206\u955C\u300C${getNextShot(shots.find((s2) => s2.id === selectedShotId))?.title}\u300D\u5206\u955C\u56FE` : "\u26A0\uFE0F \u4E0B\u4E00\u5206\u955C\u65E0\u5206\u955C\u56FE\uFF0C\u8BF7\u5148\u751F\u6210"), lastFrameSource === "next_video" && (getNextShot(shots.find((s2) => s2.id === selectedShotId))?.videoUrl ? "\u2713 \u5C06\u63D0\u53D6\u4E0B\u4E2A\u89C6\u9891\u9996\u5E27" : "\u26A0\uFE0F \u4E0B\u4E2A\u89C6\u9891\u4E0D\u5B58\u5728\uFF0C\u8BF7\u5148\u751F\u6210"), lastFrameSource === "custom" && (lastFrameUrl ? "\u2713 \u4F7F\u7528\u624B\u52A8\u4E0A\u4F20\u7684\u5C3E\u5E27" : "\u26A0\uFE0F \u8BF7\u4E0A\u4F20\u6216\u586B\u5199\u5C3E\u5E27URL"))))), selectedMode === "ia2v" && /* @__PURE__ */ import_react4.default.createElement("div", { style: { marginBottom: 16, padding: 12, border: "1px solid var(--border)", borderRadius: 8, background: "var(--panel-2)" } }, /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 12, fontWeight: 600, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" } }, /* @__PURE__ */ import_react4.default.createElement("span", null, "\u{1F39B}\uFE0F \u5168\u80FD\u53C2\u8003\u8BBE\u7F6E\uFF08Ref2VA v2\uFF0C\u6240\u6709\u53C2\u6570\u9009\u586B\uFF0C\u6700\u591A9\u56FE+3\u97F3\uFF09"), /* @__PURE__ */ import_react4.default.createElement("span", { style: { fontSize: 11, color: "#7A5CFF", fontWeight: 500 } }, "\u5F53\u524D\u5206\u955C\uFF1A", shots.find((s2) => s2.id === selectedShotId)?.title || "\u8BF7\u70B9\u51FB\u4E0B\u65B9\u5206\u955C\u5361\u7247\u9009\u62E9")), /* @__PURE__ */ import_react4.default.createElement("div", { style: { marginBottom: 10 } }, /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 11, color: "var(--text-muted)", marginBottom: 4 } }, "\u{1F5BC}\uFE0F \u53C2\u8003\u56FE\u7247\uFF08\u9009\u586B\uFF0C\u4E0D\u586B\u5219\u81EA\u52A8\u4F7F\u7528\u89D2\u8272\u53C2\u8003\u56FE\uFF09"), /* @__PURE__ */ import_react4.default.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center" } }, /* @__PURE__ */ import_react4.default.createElement(
      "input",
      {
        style: { flex: 1, padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 4, background: "var(--input-bg)", color: "var(--text)", fontSize: 11 },
        placeholder: "\u53C2\u8003\u56FE\u7247 URL\uFF08\u4E0D\u586B\u5219\u81EA\u52A8\u4F7F\u7528\u89D2\u8272\u53C2\u8003\u56FE\uFF09",
        value: refImageUrl,
        onChange: (e) => setRefImageUrl(e.target.value)
      }
    ), /* @__PURE__ */ import_react4.default.createElement(
      "input",
      {
        type: "file",
        accept: "image/*",
        style: { display: "none" },
        id: "refImageUpload",
        onChange: async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          log("\u6B63\u5728\u4E0A\u4F20\u53C2\u8003\u56FE\u7247\u2026");
          try {
            const objectUrl = URL.createObjectURL(file);
            const publicUrl = await uploadImageToServer(objectUrl, log);
            if (publicUrl) {
              setRefImageUrl(publicUrl);
              log("\u2705 \u53C2\u8003\u56FE\u7247\u4E0A\u4F20\u6210\u529F");
            }
            URL.revokeObjectURL(objectUrl);
          } catch (err) {
            log("\u274C \u53C2\u8003\u56FE\u7247\u4E0A\u4F20\u5931\u8D25: " + err.message);
          }
          e.target.value = "";
        }
      }
    ), /* @__PURE__ */ import_react4.default.createElement(
      "button",
      {
        onClick: () => document.getElementById("refImageUpload").click(),
        style: { padding: "6px 12px", border: "none", borderRadius: 6, background: "#10b981", color: "#fff", cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }
      },
      "\u{1F4E4} \u4E0A\u4F20"
    ), refImageUrl && /* @__PURE__ */ import_react4.default.createElement("button", { onClick: () => setRefImageUrl(""), style: { padding: "6px 10px", border: "1px solid #ef4444", borderRadius: 6, background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 11 } }, "\u6E05\u9664")), /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 10, color: "var(--text-muted)", marginTop: 3 } }, refImageUrl ? "\u2713 \u4F7F\u7528\u624B\u52A8\u4E0A\u4F20\u7684\u53C2\u8003\u56FE\u7247" : "\u2139\uFE0F \u5C06\u81EA\u52A8\u4F7F\u7528\u4EBA\u7269\u7BA1\u7406\u4E2D\u7684\u89D2\u8272\u53C2\u8003\u56FE\uFF08\u6700\u591A9\u5F20\uFF09")), /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 11, color: "var(--text-muted)", marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "center" } }, /* @__PURE__ */ import_react4.default.createElement("span", null, "\u{1F3B5} \u53C2\u8003\u97F3\u9891 URL\uFF08\u9009\u586B\uFF0C\u6700\u591A3\u4E2A\uFF0C\u652F\u6301 MP3/WAV/MP4/FLAC\uFF09"), /* @__PURE__ */ import_react4.default.createElement("button", { onClick: () => {
      if (window.switchToDubbing) {
        window.switchToDubbing(selectedShotId);
      } else {
        log("\u{1F4A1} \u8BF7\u5728\u300C\u914D\u97F3\u300D\u6A21\u5757\u751F\u6210\u672C\u5206\u955C\u7684\u97F3\u9891\uFF0C\u751F\u6210\u540E\u590D\u5236\u97F3\u9891URL\u7C98\u8D34\u5230\u6B64\u5904");
      }
    }, style: { padding: "4px 10px", border: "1px solid #7A5CFF", borderRadius: 4, background: "rgba(122,92,255,0.1)", color: "#7A5CFF", cursor: "pointer", fontSize: 10, whiteSpace: "nowrap" } }, "\u{1F399}\uFE0F \u524D\u5F80\u751F\u6210\u672C\u955C\u97F3\u9891")), [0, 1, 2].map((idx) => /* @__PURE__ */ import_react4.default.createElement("div", { key: idx, style: { display: "flex", gap: 6, alignItems: "center", marginBottom: 4, flexWrap: "wrap" } }, /* @__PURE__ */ import_react4.default.createElement("span", { style: { fontSize: 10, color: "var(--text-muted)", minWidth: 42 } }, "\u97F3\u9891 ", idx + 1), /* @__PURE__ */ import_react4.default.createElement(
      "input",
      {
        style: { flex: 1, minWidth: 150, padding: "5px 8px", border: "1px solid var(--border)", borderRadius: 4, background: "var(--input-bg)", color: "var(--text)", fontSize: 11 },
        placeholder: `https://example.com/audio${idx + 1}.mp3`,
        value: refAudioUrls[idx] || "",
        onChange: (e) => {
          const newUrls = [...refAudioUrls];
          newUrls[idx] = e.target.value;
          setRefAudioUrls(newUrls);
        }
      }
    ), audioAssets.length > 0 && /* @__PURE__ */ import_react4.default.createElement(
      "select",
      {
        value: "",
        onChange: (e) => {
          const audioUrl = e.target.value;
          if (audioUrl) {
            const newUrls = [...refAudioUrls];
            newUrls[idx] = audioUrl;
            setRefAudioUrls(newUrls);
            log(`\u2705 \u5DF2\u4ECE\u7D20\u6750\u5E93\u9009\u62E9\u97F3\u9891\uFF1A${audioUrl.substring(0, 50)}...`);
          }
        },
        style: { padding: "5px 8px", border: "1px solid #7A5CFF", borderRadius: 4, background: "rgba(122,92,255,0.1)", color: "#7A5CFF", fontSize: 10, cursor: "pointer", maxWidth: 180 }
      },
      /* @__PURE__ */ import_react4.default.createElement("option", { value: "" }, "\u{1F4DA} \u4ECE\u7D20\u6750\u5E93\u9009\u62E9"),
      audioAssets.map((a, i) => /* @__PURE__ */ import_react4.default.createElement("option", { key: a.id || i, value: a.url }, (a.title || `\u97F3\u9891${i + 1}`).substring(0, 25)))
    ), /* @__PURE__ */ import_react4.default.createElement(
      "input",
      {
        type: "file",
        accept: "audio/*,.mp3,.wav,.mp4,.flac,.m4a,.aac,.ogg",
        style: { display: "none" },
        id: `refAudioUpload${idx}`,
        onChange: async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          log(`\u6B63\u5728\u4E0A\u4F20\u97F3\u9891 ${idx + 1}\uFF1A${file.name}\uFF08${(file.size / 1024 / 1024).toFixed(2)}MB\uFF09\u2026`);
          try {
            const formData = new FormData();
            formData.append("file", file);
            const uploadRes = await fetch((window.UPLOAD_BASE_URL || "https://api.jinsuai.cn") + "/api/upload/file", {
              method: "POST",
              body: formData
            });
            if (uploadRes.ok) {
              const data = await uploadRes.json();
              let audioUrl = data.url || data.file_url || data.path;
              if (audioUrl && audioUrl.startsWith("/")) {
                audioUrl = (window.UPLOAD_BASE_URL || "https://api.jinsuai.cn") + audioUrl;
              }
              if (audioUrl) {
                const newUrls = [...refAudioUrls];
                newUrls[idx] = audioUrl;
                setRefAudioUrls(newUrls);
                log(`\u2705 \u97F3\u9891 ${idx + 1} \u4E0A\u4F20\u6210\u529F\uFF1A${audioUrl.substring(0, 60)}...`);
              } else {
                log(`\u274C \u97F3\u9891\u4E0A\u4F20\u8FD4\u56DE\u7A7AURL`);
              }
            } else {
              const errText = await uploadRes.text().catch(() => "");
              log(`\u274C \u97F3\u9891\u4E0A\u4F20\u5931\u8D25\uFF1AHTTP ${uploadRes.status} ${errText}`);
            }
          } catch (err) {
            log(`\u274C \u97F3\u9891\u4E0A\u4F20\u5F02\u5E38\uFF1A${err.message}`);
          }
          e.target.value = "";
        }
      }
    ), /* @__PURE__ */ import_react4.default.createElement(
      "button",
      {
        onClick: () => document.getElementById(`refAudioUpload${idx}`).click(),
        style: { padding: "5px 10px", border: "none", borderRadius: 4, background: "#10b981", color: "#fff", cursor: "pointer", fontSize: 10, whiteSpace: "nowrap" }
      },
      "\u{1F4E4} \u4E0A\u4F20"
    ), refAudioUrls[idx] && /* @__PURE__ */ import_react4.default.createElement("button", { onClick: () => {
      const newUrls = [...refAudioUrls];
      newUrls[idx] = "";
      setRefAudioUrls(newUrls);
    }, style: { padding: "4px 8px", border: "1px solid #ef4444", borderRadius: 4, background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 10 } }, "\u6E05\u9664"))), /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 10, color: refAudioUrls.filter((u) => u?.trim()).length > 0 ? "#10b981" : "var(--text-muted)", marginTop: 3 } }, refAudioUrls.filter((u) => u?.trim()).length > 0 ? `\u2713 \u5DF2\u586B\u5199 ${refAudioUrls.filter((u) => u?.trim()).length} \u4E2A\u53C2\u8003\u97F3\u9891` : "\u2139\uFE0F \u672A\u586B\u5199\u53C2\u8003\u97F3\u9891\uFF0C\u5C06\u4E0D\u4F7F\u7528\u97F3\u9891\u53C2\u8003\uFF08\u7EAF\u56FE/\u6587\u751F\u6210\uFF09"))), selectedMode === "i2v" && /* @__PURE__ */ import_react4.default.createElement("div", { style: { marginBottom: 16, padding: "10px 14px", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 8, background: "rgba(16,185,129,0.08)" } }, /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 11, color: "#10b981", lineHeight: 1.6 } }, "\u2713 i2v\u6A21\u5F0F\uFF08minimax_h3_lightx2v_v5\uFF09\uFF1A", /* @__PURE__ */ import_react4.default.createElement("br", null), "\xA0\xA01. \u4EBA\u7269\u53C2\u8003\u56FE = \u4EBA\u7269\u7BA1\u7406\u4E2D\u5DF2\u751F\u6210\u7684\u89D2\u8272\u56FE\uFF08\u4FDD\u8BC1\u4EBA\u7269\u4E00\u81F4\uFF0Cref_image_0\u5FC5\u586B\uFF09", /* @__PURE__ */ import_react4.default.createElement("br", null), "\xA0\xA02. \u652F\u63011080P\u548C1:1\u65B9\u5F62\u5206\u8FA8\u7387\uFF0C\u6700\u591A9\u5F20\u53C2\u8003\u56FE\uFF0C\u65F6\u957F1-10\u79D2", /* @__PURE__ */ import_react4.default.createElement("br", null), "\xA0\xA03. \u4E0D\u4F7F\u7528\u9996\u5E27\uFF08\u7EAF\u4EBA\u7269\u53C2\u8003\u56FE\u751F\u6210\uFF09")), selectedMode === "t2v" && /* @__PURE__ */ import_react4.default.createElement("div", { style: { marginBottom: 16, padding: "10px 14px", border: "1px solid rgba(122,92,255,0.3)", borderRadius: 8, background: "rgba(122,92,255,0.08)" } }, /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 11, color: "#7A5CFF", lineHeight: 1.6 } }, "\u2713 t2v\u6A21\u5F0F\uFF08minimax_h3_lightx2v_no_pic\uFF09\uFF1A", /* @__PURE__ */ import_react4.default.createElement("br", null), "\xA0\xA01. \u7EAF\u6587\u5B57\u63CF\u8FF0\u751F\u6210\uFF0C\u81EA\u7531\u5EA6\u6700\u9AD8\uFF0C\u4E0D\u9700\u8981\u53C2\u8003\u56FE", /* @__PURE__ */ import_react4.default.createElement("br", null), "\xA0\xA02. \u652F\u6301480P/768P\u7AD6\u5C4F/\u6A2A\u5C4F\uFF0C\u65F6\u957F1-15\u79D2", /* @__PURE__ */ import_react4.default.createElement("br", null), "\xA0\xA03. \u4E0D\u652F\u63011080P\u5206\u8FA8\u7387")), shots.length === 0 && /* @__PURE__ */ import_react4.default.createElement("div", { style: { padding: 40, textAlign: "center", color: "var(--text-muted)" } }, /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 48, marginBottom: 12 } }, "\u{1F3AC}"), /* @__PURE__ */ import_react4.default.createElement("div", null, "\u6682\u65E0\u5206\u955C"), /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 12, marginTop: 8 } }, "\u8BF7\u5148\u5728\u300C\u5206\u955C\u4E0E\u751F\u56FE\u300D\u6A21\u5757\u751F\u6210\u5206\u955C")), /* @__PURE__ */ import_react4.default.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 12 } }, shots.map((sh) => {
      const charImages = getShotCharacterImages(sh);
      const prevShot = getPrevShot(sh);
      const nextShot = getNextShot(sh);
      const canI2V = charImages.length > 0;
      let firstFrameAvailable = false;
      let lastFrameAvailable = false;
      if (firstFrameSource === "shot") firstFrameAvailable = !!sh.imageUrl;
      else if (firstFrameSource === "prev_video") firstFrameAvailable = !!(prevShot && prevShot.videoUrl);
      else if (firstFrameSource === "custom") firstFrameAvailable = !!firstFrameUrl;
      if (lastFrameSource === "next_shot") lastFrameAvailable = !!(nextShot && nextShot.imageUrl);
      else if (lastFrameSource === "next_video") lastFrameAvailable = !!(nextShot && nextShot.videoUrl);
      else if (lastFrameSource === "custom") lastFrameAvailable = !!lastFrameUrl;
      const canR2V = firstFrameAvailable && lastFrameAvailable;
      return /* @__PURE__ */ import_react4.default.createElement("div", { key: sh.id, onClick: () => setSelectedShotId(sh.id), style: { border: selectedShotId === sh.id ? "2px solid #7A5CFF" : "1px solid var(--border)", borderRadius: 12, padding: 16, background: "var(--panel-2)", cursor: "pointer", transition: "all 0.2s" } }, /* @__PURE__ */ import_react4.default.createElement("div", { style: { display: "flex", gap: 12 } }, /* @__PURE__ */ import_react4.default.createElement("div", { style: { width: 120, height: 160, background: "var(--input-bg)", borderRadius: 8, flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" } }, sh.videoUrl ? /* @__PURE__ */ import_react4.default.createElement("video", { src: sh.videoUrl, controls: true, style: { width: "100%", height: "100%", objectFit: "cover" } }) : sh.imageUrl ? /* @__PURE__ */ import_react4.default.createElement("img", { src: sh.imageUrl, alt: sh.title, style: { width: "100%", height: "100%", objectFit: "cover" } }) : /* @__PURE__ */ import_react4.default.createElement("span", { style: { fontSize: 32 } }, "\u{1F3AC}"), /* @__PURE__ */ import_react4.default.createElement("div", { style: { position: "absolute", top: 4, left: 4, background: "rgba(0,0,0,0.7)", borderRadius: 4, padding: "2px 6px", fontSize: 10, color: "#fff" } }, sh.sceneType || "\u4E2D\u666F"), sh.videoUrl && /* @__PURE__ */ import_react4.default.createElement("div", { style: { position: "absolute", bottom: 4, right: 4, background: "rgba(16,185,129,0.9)", borderRadius: 4, padding: "2px 6px", fontSize: 9, color: "#fff" } }, "\u2713 \u5DF2\u751F\u6210")), /* @__PURE__ */ import_react4.default.createElement("div", { style: { flex: 1, minWidth: 0 } }, /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontWeight: 600, fontSize: 14 } }, sh.title), /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 11, color: "var(--text-muted)", marginTop: 4 } }, sh.sceneType, " \xB7 ", sh.cameraMove, " \xB7 ", sh.duration || duration, "\u79D2", sh.characters && sh.characters.length > 0 && ` \xB7 \u89D2\u8272\uFF1A${sh.characters.join("\u3001")}`), /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 12, color: "var(--text)", marginTop: 8, lineHeight: 1.5, maxHeight: 60, overflow: "hidden" } }, sh.sceneDesc || "\u65E0\u63CF\u8FF0"), sh.promptCn && /* @__PURE__ */ import_react4.default.createElement("div", { style: { marginTop: 8, padding: "8px 10px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 6 } }, /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 10, color: "#f59e0b", fontWeight: 600, marginBottom: 4 } }, "\u2728 AI\u7EC6\u5316\u63D0\u793A\u8BCD\uFF08\u5C06\u7528\u4E8E\u89C6\u9891\u751F\u6210\uFF09"), /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5, maxHeight: 80, overflow: "hidden", fontStyle: "italic" } }, sh.promptCn)), sh.dialogue && /* @__PURE__ */ import_react4.default.createElement("div", { style: { marginTop: 8, padding: "6px 10px", background: "rgba(122,92,255,0.1)", borderRadius: 6, fontSize: 12, fontStyle: "italic" } }, "\u{1F4AC} ", sh.dialogue), selectedMode === "i2v" && !canI2V && /* @__PURE__ */ import_react4.default.createElement("div", { style: { marginTop: 6, fontSize: 11, color: "#f59e0b" } }, "\u26A0\uFE0F \u8BE5\u5206\u955C\u65E0\u5339\u914D\u7684\u89D2\u8272\u53C2\u8003\u56FE"), selectedMode === "r2v" && !canR2V && /* @__PURE__ */ import_react4.default.createElement("div", { style: { marginTop: 6, fontSize: 11, color: "#f59e0b" } }, "\u26A0\uFE0F R2V\u9996\u5C3E\u5E27\u6A21\u5F0F\uFF1A\u9996\u5E27\u6765\u6E90\u300C", firstFrameSource === "shot" ? "\u672C\u5206\u955C\u5206\u955C\u56FE" : firstFrameSource === "prev_video" ? "\u4E0A\u4E2A\u89C6\u9891\u5C3E\u5E27" : "\u7528\u6237\u624B\u52A8\u4E0A\u4F20", "\u300D", firstFrameAvailable ? "\u2713" : "\u2717", "\uFF0C\u5C3E\u5E27\u6765\u6E90\u300C", lastFrameSource === "next_shot" ? "\u4E0B\u4E00\u5206\u955C\u5206\u955C\u56FE" : lastFrameSource === "next_video" ? "\u4E0B\u4E2A\u89C6\u9891\u9996\u5E27" : "\u7528\u6237\u624B\u52A8\u4E0A\u4F20", "\u300D", lastFrameAvailable ? "\u2713" : "\u2717", "\u3002\u8BF7\u786E\u4FDD\u9996\u5E27\u548C\u5C3E\u5E27\u90FD\u6709\u6709\u6548\u6765\u6E90\u3002"))), /* @__PURE__ */ import_react4.default.createElement("div", { style: { display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" } }, /* @__PURE__ */ import_react4.default.createElement(
        "button",
        {
          style: { padding: "6px 12px", border: "none", borderRadius: 6, background: "linear-gradient(135deg, #7A5CFF, #5CE1E6)", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 },
          onClick: () => genVideo(sh),
          disabled: busy === sh.id
        },
        busy === sh.id ? "\u23F3 \u751F\u6210\u4E2D\uFF0C\u8BF7\u8010\u5FC3\u7B49\u5F85\u2026" : `\u{1F3AC} \u751F\u6210\u89C6\u9891 (${currentCredits}\u79EF\u5206)`
      ), busy === sh.id && genProgress[sh.id] && /* @__PURE__ */ import_react4.default.createElement("span", { style: { fontSize: 11, color: genProgress[sh.id].status === "queued" ? "#f59e0b" : "#10b981", fontWeight: 600 } }, genProgress[sh.id].status === "queued" ? `\u23F3 ${genProgress[sh.id].text}\uFF0C\u9884\u8BA1\u7B49\u5F85${genProgress[sh.id].queuePosition * 2}\u5206\u949F` : `\u{1F3AC} ${genProgress[sh.id].text}`), busy === sh.id && (!genProgress[sh.id] || !genProgress[sh.id].status) && /* @__PURE__ */ import_react4.default.createElement("span", { style: { fontSize: 11, color: "#f59e0b" } }, "\u23F1\uFE0F \u6B63\u5728\u63D0\u4EA4\u4EFB\u52A1\uFF0C\u8BF7\u7A0D\u5019\u2026"), busy !== sh.id && /* @__PURE__ */ import_react4.default.createElement("span", { style: { fontSize: 10, color: "var(--text-muted)" } }, "\u{1F4A1} \u9AD8\u5CF0\u671F\u751F\u6210\u53EF\u80FD\u8F83\u6162\uFF0C\u8BF7\u8010\u5FC3\u7B49\u5F85")), /* @__PURE__ */ import_react4.default.createElement("div", { style: { display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" } }, /* @__PURE__ */ import_react4.default.createElement(
        "button",
        {
          style: { padding: "6px 12px", border: "1px solid #10b981", borderRadius: 6, background: sh.selectedCharIds?.length > 0 ? "rgba(16,185,129,0.15)" : "transparent", color: "#10b981", cursor: "pointer", fontSize: 12 },
          onClick: () => setShowCharSelect(showCharSelect === sh.id ? "" : sh.id)
        },
        "\u{1F464} \u9009\u62E9\u89D2\u8272 ",
        sh.selectedCharIds?.length > 0 ? `(${sh.selectedCharIds.length})` : ""
      ), /* @__PURE__ */ import_react4.default.createElement(
        "button",
        {
          style: { padding: "6px 12px", border: "1px solid #f59e0b", borderRadius: 6, background: "rgba(245,158,11,0.1)", color: "#f59e0b", cursor: refiningShotId ? "wait" : "pointer", fontSize: 12 },
          onClick: () => refinePrompt(sh),
          disabled: refiningShotId !== ""
        },
        refiningShotId === sh.id ? "\u23F3 \u7EC6\u5316\u4E2D..." : "\u2728 AI\u7EC6\u5316\u63D0\u793A\u8BCD"
      ), /* @__PURE__ */ import_react4.default.createElement(
        "button",
        {
          style: { padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 },
          onClick: () => {
            setEditingShotId(sh.id);
            setEditingPrompt(sh.promptCn || sh.sceneDesc || "");
          }
        },
        "\u270F\uFE0F \u7F16\u8F91\u63D0\u793A\u8BCD"
      ), sh.videoUrl && /* @__PURE__ */ import_react4.default.createElement(import_react4.default.Fragment, null, /* @__PURE__ */ import_react4.default.createElement(
        "button",
        {
          style: { padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 },
          onClick: async () => {
            const filename = `${sh.title || "video"}.mp4`;
            if (sh.videoUrl.startsWith("blob:") || sh.videoUrl.startsWith("data:")) {
              const a = document.createElement("a");
              a.href = sh.videoUrl;
              a.download = filename;
              a.click();
            } else {
              const success = await downloadUrl(sh.videoUrl, filename);
              if (!success) {
                if (confirm("\u76F4\u63A5\u4E0B\u8F7D\u5931\u8D25\uFF0C\u662F\u5426\u5728\u6D4F\u89C8\u5668\u4E2D\u6253\u5F00\uFF1F")) {
                  window.open(sh.videoUrl, "_blank");
                }
              }
            }
          }
        },
        "\u2B07\uFE0F \u4E0B\u8F7D"
      ), /* @__PURE__ */ import_react4.default.createElement(
        "button",
        {
          style: { padding: "6px 12px", border: "1px solid #ef4444", borderRadius: 6, background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 12 },
          onClick: () => {
            if (window.confirm("\u786E\u5B9A\u8981\u6E05\u9664\u8FD9\u4E2A\u89C6\u9891\u5417\uFF1F")) {
              update({ shots: shots.map((s2) => s2.id === sh.id ? { ...s2, videoUrl: null } : s2) });
            }
          }
        },
        "\u{1F5D1} \u6E05\u9664"
      ))), showCharSelect === sh.id && /* @__PURE__ */ import_react4.default.createElement("div", { style: { marginTop: 12, padding: 12, border: "1px solid #10b981", borderRadius: 8, background: "rgba(16,185,129,0.05)" } }, /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: "#10b981", marginBottom: 8 } }, "\u{1F464} \u9009\u62E9\u53C2\u8003\u89D2\u8272\uFF08\u4E0D\u9009\u5219\u81EA\u52A8\u5339\u914D\uFF09"), characters.filter((c) => c.image).length === 0 ? /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 11, color: "var(--text-muted)" } }, "\u6682\u65E0\u89D2\u8272\u56FE\u7247\uFF0C\u8BF7\u5148\u5728\u300C\u4EBA\u7269\u7BA1\u7406\u300D\u751F\u6210\u89D2\u8272\u53C2\u8003\u56FE") : /* @__PURE__ */ import_react4.default.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } }, characters.filter((c) => c.image).map((c) => {
        const selected = sh.selectedCharIds?.includes(c.id);
        return /* @__PURE__ */ import_react4.default.createElement(
          "div",
          {
            key: c.id,
            onClick: () => toggleCharSelection(sh, c.id),
            style: {
              width: 60,
              height: 80,
              borderRadius: 6,
              overflow: "hidden",
              cursor: "pointer",
              border: selected ? "2px solid #10b981" : "2px solid transparent",
              boxShadow: selected ? "0 0 8px rgba(16,185,129,0.5)" : "none",
              position: "relative"
            }
          },
          /* @__PURE__ */ import_react4.default.createElement("img", { src: c.image, alt: c.name, style: { width: "100%", height: "100%", objectFit: "cover" } }),
          selected && /* @__PURE__ */ import_react4.default.createElement("div", { style: { position: "absolute", top: 2, right: 2, background: "#10b981", color: "#fff", borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 } }, "\u2713"),
          /* @__PURE__ */ import_react4.default.createElement("div", { style: { position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 9, padding: "2px 4px", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, c.name)
        );
      })), /* @__PURE__ */ import_react4.default.createElement("div", { style: { marginTop: 8, fontSize: 10, color: "var(--text-muted)" } }, "\u5DF2\u9009\u62E9 ", sh.selectedCharIds?.length || 0, " \u4E2A\u89D2\u8272 \xB7 \u70B9\u51FB\u89D2\u8272\u56FE\u7247\u53EF\u52FE\u9009/\u53D6\u6D88")), editingShotId === sh.id && /* @__PURE__ */ import_react4.default.createElement("div", { style: { marginTop: 12, padding: 12, border: "1px solid #7A5CFF", borderRadius: 8, background: "rgba(122,92,255,0.05)" } }, /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: "#7A5CFF", marginBottom: 8 } }, "\u270F\uFE0F \u7F16\u8F91\u89C6\u9891\u63D0\u793A\u8BCD"), /* @__PURE__ */ import_react4.default.createElement(
        "textarea",
        {
          value: editingPrompt,
          onChange: (e) => setEditingPrompt(e.target.value),
          style: { width: "100%", minHeight: 100, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 12, resize: "vertical", fontFamily: "inherit" },
          placeholder: "\u8F93\u5165\u89C6\u9891\u751F\u6210\u63D0\u793A\u8BCD..."
        }
      ), /* @__PURE__ */ import_react4.default.createElement("div", { style: { display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" } }, /* @__PURE__ */ import_react4.default.createElement(
        "button",
        {
          style: { padding: "6px 16px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 },
          onClick: () => {
            setEditingShotId("");
            setEditingPrompt("");
          }
        },
        "\u53D6\u6D88"
      ), /* @__PURE__ */ import_react4.default.createElement(
        "button",
        {
          style: { padding: "6px 16px", border: "none", borderRadius: 6, background: "linear-gradient(135deg, #7A5CFF, #5CE1E6)", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 },
          onClick: () => {
            update({ shots: shots.map((s2) => s2.id === sh.id ? { ...s2, promptCn: editingPrompt } : s2) });
            setEditingShotId("");
            setEditingPrompt("");
            log(`\u300C${sh.title}\u300D\u63D0\u793A\u8BCD\u5DF2\u66F4\u65B0`);
          }
        },
        "\u4FDD\u5B58"
      ))));
    })));
  };

  // src/components/NewScript/EditExport.jsx
  var import_react5 = __toESM(__require("react"), 1);
  var import_core = __require("@tauri-apps/api/core");
  var PIXELS_PER_SECOND = 50;
  var TRACK_HEIGHT = 48;
  var TIMELINE_HEIGHT = 260;
  var ASPECT_RATIOS = [
    { id: "16:9", label: "16:9 \u6A2A\u5C4F", w: 1920, h: 1080 },
    { id: "9:16", label: "9:16 \u7AD6\u5C4F", w: 1080, h: 1920 },
    { id: "1:1", label: "1:1 \u65B9\u5F62", w: 1080, h: 1080 },
    { id: "4:3", label: "4:3 \u6807\u51C6", w: 1440, h: 1080 },
    { id: "3:4", label: "3:4 \u7AD6\u7248", w: 1080, h: 1440 }
  ];
  var FILTERS = [
    { id: "none", name: "\u539F\u56FE", css: "" },
    { id: "grayscale", name: "\u9ED1\u767D", css: "grayscale(100%)" },
    { id: "sepia", name: "\u590D\u53E4", css: "sepia(80%)" },
    { id: "bright", name: "\u6E05\u65B0", css: "brightness(1.15) saturate(1.2)" },
    { id: "warm", name: "\u6696\u8272", css: "sepia(30%) saturate(1.3) brightness(1.05)" },
    { id: "cool", name: "\u51B7\u8272", css: "hue-rotate(180deg) saturate(0.8)" },
    { id: "contrast", name: "\u7535\u5F71", css: "contrast(1.2) brightness(0.95) saturate(1.1)" },
    { id: "fade", name: "\u892A\u8272", css: "contrast(0.8) brightness(1.1) saturate(0.7)" }
  ];
  var TRANSITIONS = [
    { id: "none", name: "\u65E0\u8F6C\u573A", icon: "\u2716" },
    { id: "fade", name: "\u6DE1\u5165\u6DE1\u51FA", icon: "\u{1F305}" },
    { id: "dissolve", name: "\u6EB6\u89E3", icon: "\u{1F4A7}" },
    { id: "wipe", name: "\u64E6\u9664", icon: "\u27A1\uFE0F" },
    { id: "zoom", name: "\u7F29\u653E", icon: "\u{1F50D}" },
    { id: "slide", name: "\u6ED1\u52A8", icon: "\u2194\uFE0F" },
    { id: "circle", name: "\u5706\u5F62", icon: "\u2B55" }
  ];
  var SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
  var formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s2 = Math.floor(seconds % 60);
    const ms = Math.floor(seconds % 1 * 100);
    return `${String(m).padStart(2, "0")}:${String(s2).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
  };
  var getVideoDuration = async (url) => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        resolve(video.duration || 5);
        video.remove();
      };
      video.onerror = () => {
        resolve(5);
        video.remove();
      };
      video.src = url;
    });
  };
  var getAudioDuration = (url) => {
    return new Promise((resolve) => {
      const a = document.createElement("audio");
      a.preload = "metadata";
      a.onloadedmetadata = () => {
        resolve(a.duration || 5);
        a.src = "";
      };
      a.onerror = () => resolve(5);
      a.src = url;
    });
  };
  var baseDuration = (clip) => clip.srcDuration || (clip.duration || 5) * (clip.speed || 1);
  var safePlay = (el) => {
    if (!el) return;
    try {
      const p = el.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          el.muted = true;
          const p2 = el.play();
          if (p2 && typeof p2.catch === "function") p2.catch(() => {
          });
        });
      }
    } catch {
    }
  };
  function EditExport({ project: project2, update, log, incomingAssets = [], onConsumeAssets }) {
    console.log("[EditExport] \u7EC4\u4EF6\u6E32\u67D3");
    const [timelineClips, setTimelineClips] = (0, import_react5.useState)([]);
    const [audioClips, setAudioClips] = (0, import_react5.useState)([]);
    const [textClips, setTextClips] = (0, import_react5.useState)([]);
    const [availableShots, setAvailableShots] = (0, import_react5.useState)([]);
    const [availableAudios, setAvailableAudios] = (0, import_react5.useState)([]);
    const [availableTexts, setAvailableTexts] = (0, import_react5.useState)([]);
    const [draggingType, setDraggingType] = (0, import_react5.useState)("video");
    const [isDragging, setIsDragging] = (0, import_react5.useState)(false);
    const [isOverTimeline, setIsOverTimeline] = (0, import_react5.useState)(false);
    const [currentTime, setCurrentTime] = (0, import_react5.useState)(0);
    const [isPlaying, setIsPlaying] = (0, import_react5.useState)(false);
    const [selectedClipId, setSelectedClipId] = (0, import_react5.useState)(null);
    const [selectedTrack, setSelectedTrack] = (0, import_react5.useState)("video");
    const [draggingShot, setDraggingShot] = (0, import_react5.useState)(null);
    const [zoom, setZoom] = (0, import_react5.useState)(1);
    const [durations, setDurations] = (0, import_react5.useState)({});
    const [activeTab, setActiveTab] = (0, import_react5.useState)("media");
    const [selectedTransition, setSelectedTransition] = (0, import_react5.useState)("none");
    const [busy, setBusy] = (0, import_react5.useState)("");
    const [aspectRatio, setAspectRatio] = (0, import_react5.useState)("16:9");
    const [bgColor, setBgColor] = (0, import_react5.useState)("#000000");
    const [bgBlur, setBgBlur] = (0, import_react5.useState)(0);
    const [showExportSettings, setShowExportSettings] = (0, import_react5.useState)(false);
    const [exportResolution, setExportResolution] = (0, import_react5.useState)("1080p");
    const [exportFps, setExportFps] = (0, import_react5.useState)(30);
    const [exportBitrate, setExportBitrate] = (0, import_react5.useState)("8M");
    const [history, setHistory] = (0, import_react5.useState)([]);
    const [historyIndex, setHistoryIndex] = (0, import_react5.useState)(-1);
    const [showProperties, setShowProperties] = (0, import_react5.useState)(true);
    const videoRef = (0, import_react5.useRef)(null);
    const audioRef = (0, import_react5.useRef)(null);
    const timelineRef = (0, import_react5.useRef)(null);
    const playIntervalRef = (0, import_react5.useRef)(null);
    const dragStateRef = (0, import_react5.useRef)(null);
    const timeRef = (0, import_react5.useRef)(0);
    const rafRef = (0, import_react5.useRef)(null);
    const lastTsRef = (0, import_react5.useRef)(0);
    const lastSyncRef = (0, import_react5.useRef)(0);
    const playingRef = (0, import_react5.useRef)(false);
    const clipsRef = (0, import_react5.useRef)([]);
    const audiosRef = (0, import_react5.useRef)([]);
    const mountedVideoIdRef = (0, import_react5.useRef)(null);
    const mountedAudioIdRef = (0, import_react5.useRef)(null);
    const playheadRef = (0, import_react5.useRef)(null);
    const timeTextRef = (0, import_react5.useRef)(null);
    const zoomRef = (0, import_react5.useRef)(1);
    const contentEndRef = (0, import_react5.useRef)(0);
    const pushHistory2 = (0, import_react5.useCallback)((clips, time) => {
      setHistory((prev) => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push({ clips: JSON.parse(JSON.stringify(clips)), time });
        return newHistory.slice(-50);
      });
      setHistoryIndex((prev) => Math.min(prev + 1, 49));
    }, [historyIndex]);
    const undo = () => {
      if (historyIndex <= 0) return;
      const newIndex = historyIndex - 1;
      const state = history[newIndex];
      if (state) {
        setTimelineClips(JSON.parse(JSON.stringify(state.clips)));
        setCurrentTime(state.time);
        setHistoryIndex(newIndex);
        log?.("\u64A4\u9500");
      }
    };
    const redo = () => {
      if (historyIndex >= history.length - 1) return;
      const newIndex = historyIndex + 1;
      const state = history[newIndex];
      if (state) {
        setTimelineClips(JSON.parse(JSON.stringify(state.clips)));
        setCurrentTime(state.time);
        setHistoryIndex(newIndex);
        log?.("\u91CD\u505A");
      }
    };
    (0, import_react5.useEffect)(() => {
      const shots = (project2?.shots || []).filter((s2) => s2.videoUrl);
      setAvailableShots(shots.map((s2) => ({
        id: s2.id,
        title: s2.title || "\u672A\u547D\u540D\u955C\u5934",
        url: s2.videoUrl,
        desc: s2.description || s2.desc || "",
        imageUrl: s2.imageUrl || null
      })));
      shots.forEach(async (s2) => {
        const dur = await getVideoDuration(s2.videoUrl);
        setDurations((prev) => ({ ...prev, [s2.id]: dur }));
      });
      const audios = (project2?.assets || []).filter((a) => a.type === "audio" && a.url);
      setAvailableAudios(audios.map((a, i) => ({
        id: a.id || `audio_${i}`,
        title: a.title || `\u97F3\u9891${i + 1}`,
        url: a.url,
        duration: a.duration || 5
      })));
      audios.forEach(async (a, i) => {
        const id = a.id || `audio_${i}`;
        const dur = await getAudioDuration(a.url);
        setAvailableAudios((prev) => prev.map((x) => x.id === id ? { ...x, duration: dur } : x));
      });
      const texts = [];
      (project2?.shots || []).forEach((shot, si) => {
        const dialogues = shot.dialogues || (shot.dialogue ? [{ character: shot.characters?.[0] || "\u89D2\u8272", text: shot.dialogue }] : []);
        dialogues.forEach((d, di) => {
          if (d.text || d.content) {
            texts.push({
              id: `text_${si}_${di}`,
              character: d.character || "\u89D2\u8272",
              text: d.text || d.content || "",
              shotId: shot.id,
              shotTitle: shot.title || `\u955C\u5934${si + 1}`
            });
          }
        });
      });
      setAvailableTexts(texts);
    }, [project2?.shots, project2?.assets]);
    const contentEnd = Math.max(
      timelineClips.reduce((max, c) => Math.max(max, c.start + c.duration), 0),
      audioClips.reduce((max, c) => Math.max(max, c.start + c.duration), 0),
      textClips.reduce((max, c) => Math.max(max, c.start + c.duration), 0),
      0
    );
    const totalDuration = Math.max(contentEnd + 30, 60);
    const timelineWidth = Math.max(totalDuration * PIXELS_PER_SECOND * zoom, 600);
    const markInterval = (0, import_react5.useMemo)(() => {
      const pxPerSec = PIXELS_PER_SECOND * zoom;
      const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300];
      return steps.find((s2) => s2 * pxPerSec >= 70) || 300;
    }, [zoom]);
    const selectedClip = selectedTrack === "audio" ? audioClips.find((c) => c.id === selectedClipId) : selectedTrack === "text" ? textClips.find((c) => c.id === selectedClipId) : timelineClips.find((c) => c.id === selectedClipId);
    (0, import_react5.useEffect)(() => {
      clipsRef.current = timelineClips;
    }, [timelineClips]);
    (0, import_react5.useEffect)(() => {
      audiosRef.current = audioClips;
    }, [audioClips]);
    (0, import_react5.useEffect)(() => {
      zoomRef.current = zoom;
    }, [zoom]);
    (0, import_react5.useEffect)(() => {
      contentEndRef.current = contentEnd;
    }, [contentEnd]);
    const findClipAt = (0, import_react5.useCallback)(
      (list, t2) => (list || []).find((c) => t2 >= c.start && t2 < c.start + c.duration) || null,
      []
    );
    const renderPlayhead = (0, import_react5.useCallback)((t2) => {
      const px = t2 * PIXELS_PER_SECOND * zoomRef.current + 60;
      if (playheadRef.current) playheadRef.current.style.transform = `translateX(${px}px)`;
      if (timeTextRef.current) timeTextRef.current.textContent = formatTime(t2);
    }, []);
    const mountVideo = (0, import_react5.useCallback)((clip, t2, autoplay) => {
      const v = videoRef.current;
      if (!v || !clip) return;
      const speed = clip.speed || 1;
      if (mountedVideoIdRef.current !== clip.id) {
        mountedVideoIdRef.current = clip.id;
        v.src = clip.url;
      }
      v.muted = !!clip.muted;
      v.volume = clip.muted ? 0 : Math.max(0, Math.min(1, (clip.volume ?? 100) / 100));
      const apply = () => {
        v.playbackRate = speed;
        const target = Math.max(0, (t2 - clip.start) * speed);
        if (Math.abs(v.currentTime - target) > 0.05) {
          try {
            v.currentTime = target;
          } catch {
          }
        }
        if (autoplay) safePlay(v);
        else v.pause();
      };
      if (v.readyState >= 1) apply();
      else v.addEventListener("loadedmetadata", apply, { once: true });
    }, []);
    const syncAudio = (0, import_react5.useCallback)((t2, autoplay) => {
      const a = audioRef.current;
      if (!a) return;
      const hit = findClipAt(audiosRef.current, t2);
      if (!hit) {
        if (mountedAudioIdRef.current) {
          a.pause();
          mountedAudioIdRef.current = null;
        }
        return;
      }
      const speed = hit.speed || 1;
      if (mountedAudioIdRef.current !== hit.id) {
        mountedAudioIdRef.current = hit.id;
        a.src = hit.url;
      }
      a.playbackRate = speed;
      a.muted = !!hit.muted;
      a.volume = hit.muted ? 0 : Math.max(0, Math.min(1, (hit.volume ?? 100) / 100));
      const apply = () => {
        const want = Math.max(0, (t2 - hit.start) * speed);
        if (Math.abs(a.currentTime - want) > 0.25) {
          try {
            a.currentTime = want;
          } catch {
          }
        }
        if (autoplay) safePlay(a);
        else a.pause();
      };
      if (a.readyState >= 1) apply();
      else a.addEventListener("loadedmetadata", apply, { once: true });
    }, [findClipAt]);
    const stopPlayback = (0, import_react5.useCallback)(() => {
      playingRef.current = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (videoRef.current) videoRef.current.pause();
      if (audioRef.current) audioRef.current.pause();
      setIsPlaying(false);
      setCurrentTime(timeRef.current);
    }, []);
    const stepRef = (0, import_react5.useRef)(null);
    const step = (0, import_react5.useCallback)((ts) => {
      if (!playingRef.current) return;
      const list = clipsRef.current;
      let t2 = timeRef.current;
      const clip = findClipAt(list, t2);
      if (clip) {
        const v = videoRef.current;
        const speed = clip.speed || 1;
        if (v && mountedVideoIdRef.current === clip.id && v.readyState >= 2) {
          v.playbackRate = speed;
          v.muted = !!clip.muted;
          v.volume = clip.muted ? 0 : Math.max(0, Math.min(1, (clip.volume ?? 100) / 100));
          t2 = clip.start + v.currentTime / speed;
          if (v.ended || v.currentTime >= baseDuration(clip) - 0.03) {
            const next = list.filter((c) => c.start > clip.start).sort((a, b) => a.start - b.start)[0];
            if (next) {
              t2 = next.start;
            } else {
              const end = contentEndRef.current;
              timeRef.current = end;
              stopPlayback();
              renderPlayhead(end);
              return;
            }
          }
        }
      } else {
        const dt = lastTsRef.current ? Math.min((ts - lastTsRef.current) / 1e3, 0.25) : 0;
        t2 += dt;
        const next = list.filter((c) => c.start > t2).sort((a, b) => a.start - b.start)[0];
        if (!next) {
          const end = contentEndRef.current;
          timeRef.current = end;
          stopPlayback();
          renderPlayhead(end);
          return;
        }
        if (t2 >= next.start) t2 = next.start;
      }
      lastTsRef.current = ts;
      const limit = contentEndRef.current;
      if (t2 >= limit) {
        timeRef.current = limit;
        stopPlayback();
        renderPlayhead(limit);
        return;
      }
      timeRef.current = t2;
      const nowClip = findClipAt(list, t2);
      if (nowClip && mountedVideoIdRef.current !== nowClip.id) mountVideo(nowClip, t2, true);
      syncAudio(t2, true);
      renderPlayhead(t2);
      if (ts - lastSyncRef.current > 80) {
        lastSyncRef.current = ts;
        setCurrentTime(t2);
      }
      rafRef.current = requestAnimationFrame(stepRef.current);
    }, [findClipAt, mountVideo, syncAudio, renderPlayhead, stopPlayback]);
    (0, import_react5.useEffect)(() => {
      stepRef.current = step;
    }, [step]);
    const startPlayback = (0, import_react5.useCallback)(() => {
      const list = clipsRef.current;
      if (!list.length) {
        log?.("\u65F6\u95F4\u7EBF\u4E0A\u6CA1\u6709\u89C6\u9891\u7247\u6BB5");
        return;
      }
      let t2 = timeRef.current;
      if (t2 >= contentEndRef.current - 0.05) t2 = 0;
      if (!findClipAt(list, t2)) {
        const next = list.filter((c) => c.start > t2).sort((a, b) => a.start - b.start)[0];
        t2 = next ? next.start : 0;
      }
      timeRef.current = t2;
      setCurrentTime(t2);
      renderPlayhead(t2);
      playingRef.current = true;
      setIsPlaying(true);
      mountVideo(findClipAt(list, t2), t2, true);
      syncAudio(t2, true);
      lastTsRef.current = 0;
      lastSyncRef.current = 0;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(stepRef.current);
    }, [findClipAt, mountVideo, syncAudio, renderPlayhead]);
    const togglePlay = (0, import_react5.useCallback)(() => {
      if (playingRef.current) stopPlayback();
      else startPlayback();
    }, [startPlayback, stopPlayback]);
    const seekTo = (0, import_react5.useCallback)((t2, autoplay = false) => {
      const clamped = Math.max(0, Math.min(t2, contentEndRef.current));
      timeRef.current = clamped;
      setCurrentTime(clamped);
      renderPlayhead(clamped);
      const clip = findClipAt(clipsRef.current, clamped);
      if (clip) mountVideo(clip, clamped, autoplay);
      else {
        if (videoRef.current) videoRef.current.pause();
        mountedVideoIdRef.current = null;
      }
      syncAudio(clamped, autoplay);
    }, [findClipAt, mountVideo, syncAudio, renderPlayhead]);
    (0, import_react5.useEffect)(() => {
      if (playingRef.current) return;
      const clip = findClipAt(clipsRef.current, currentTime);
      if (clip) mountVideo(clip, currentTime, false);
      else {
        if (videoRef.current) videoRef.current.pause();
        mountedVideoIdRef.current = null;
      }
      syncAudio(currentTime, false);
      renderPlayhead(currentTime);
    }, [currentTime, timelineClips, mountVideo, syncAudio, renderPlayhead, findClipAt]);
    (0, import_react5.useEffect)(() => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    }, []);
    (0, import_react5.useEffect)(() => {
      console.log("[\u5168\u5C40\u62D6\u653E] useEffect\u6267\u884C");
      const handleGlobalDragOver = (e) => {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = "copy";
        }
        const timeline = timelineRef.current;
        if (!timeline) return;
        const rect = timeline.getBoundingClientRect();
        const over = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
        if (over) {
          if (!window._globalDragOverLogged) {
            console.log("[\u5168\u5C40\u62D6\u653E] dragover\u5728\u65F6\u95F4\u7EBF\u4E0A\u89E6\u53D1");
            window._globalDragOverLogged = true;
            setTimeout(() => {
              window._globalDragOverLogged = false;
            }, 1e3);
          }
          setIsOverTimeline(true);
          setIsDragging(true);
        } else {
          setIsOverTimeline(false);
        }
      };
      const handleGlobalDrop = (e) => {
        const timeline = timelineRef.current;
        if (!timeline) return;
        const rect = timeline.getBoundingClientRect();
        const over = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
        if (over) {
          e.preventDefault();
          e.stopPropagation();
          console.log("[\u5168\u5C40\u62D6\u653E] drop\u5728\u65F6\u95F4\u7EBF\u4E0A\u89E6\u53D1, draggingShot:", draggingShot?.title || draggingShot?.id);
          setIsOverTimeline(false);
          setIsDragging(false);
          if (!draggingShot) {
            console.log("[\u5168\u5C40\u62D6\u653E] draggingShot\u4E3A\u7A7A\uFF0C\u8FD4\u56DE");
            return;
          }
          const x = e.clientX - rect.left - 60;
          const startTime = Math.max(0, x / (PIXELS_PER_SECOND * zoom));
          console.log("[\u5168\u5C40\u62D6\u653E] \u653E\u7F6E\u4F4D\u7F6E:", startTime, "\u79D2");
          if (draggingType === "audio") {
            const duration = draggingShot.duration || 5;
            const newClip = {
              id: `audio_${Date.now()}`,
              title: draggingShot.title || "\u97F3\u9891",
              url: draggingShot.url,
              start: startTime,
              duration,
              srcDuration: duration,
              speed: 1,
              volume: 100
            };
            setAudioClips((prev) => [...prev, newClip].sort((a, b) => a.start - b.start));
            setDraggingShot(null);
            log?.(`\u5DF2\u6DFB\u52A0\u97F3\u9891\u300C${newClip.title}\u300D\u5230\u97F3\u9891\u8F68\u9053\uFF08${formatTime(newClip.start)}\uFF09`);
          } else if (draggingType === "text") {
            const duration = 3;
            const newClip = {
              id: `text_${Date.now()}`,
              character: draggingShot.character || "\u89D2\u8272",
              text: draggingShot.text || draggingShot.content || "",
              start: startTime,
              duration,
              fontSize: 24,
              color: "#ffffff",
              position: "bottom"
            };
            setTextClips((prev) => [...prev, newClip].sort((a, b) => a.start - b.start));
            setDraggingShot(null);
            log?.(`\u5DF2\u6DFB\u52A0\u6587\u672C\u300C${newClip.character}\uFF1A${newClip.text.substring(0, 10)}...\u300D\u5230\u6587\u672C\u8F68\u9053\uFF08${formatTime(newClip.start)}\uFF09`);
          } else {
            const duration = durations[draggingShot.id] || 5;
            const newClip = {
              id: `clip_${Date.now()}`,
              shotId: draggingShot.id,
              title: draggingShot.title,
              url: draggingShot.url,
              start: startTime,
              duration,
              thumb: draggingShot.imageUrl,
              transition: selectedTransition !== "none" ? selectedTransition : void 0,
              speed: 1,
              srcDuration: duration,
              volume: 100,
              filter: "none",
              brightness: 100,
              contrast: 100,
              saturation: 100
            };
            setTimelineClips((prev) => [...prev, newClip].sort((a, b) => a.start - b.start));
            setSelectedClipId(newClip.id);
            setDraggingShot(null);
            log?.(`\u5DF2\u6DFB\u52A0\u300C${draggingShot.title}\u300D\u5230\u65F6\u95F4\u7EBF\uFF08${formatTime(newClip.start)}\uFF09`);
          }
        }
      };
      window.addEventListener("dragover", handleGlobalDragOver);
      window.addEventListener("drop", handleGlobalDrop);
      console.log("[\u5168\u5C40\u62D6\u653E] \u5DF2\u6DFB\u52A0\u5168\u5C40\u4E8B\u4EF6\u76D1\u542C\uFF08window\u7EA7\u522B\uFF09");
      return () => {
        window.removeEventListener("dragover", handleGlobalDragOver);
        window.removeEventListener("drop", handleGlobalDrop);
        console.log("[\u5168\u5C40\u62D6\u653E] \u5DF2\u79FB\u9664\u5168\u5C40\u4E8B\u4EF6\u76D1\u542C");
      };
    }, [draggingShot, draggingType, zoom, selectedTransition, durations]);
    (0, import_react5.useEffect)(() => {
      console.log("[\u539F\u751F\u62D6\u653E] useEffect\u6267\u884C\uFF0CtimelineRef.current:", timelineRef.current ? "\u5DF2\u8BBE\u7F6E" : "\u4E3Anull");
      const timer = setTimeout(() => {
        const timeline = timelineRef.current;
        if (!timeline) {
          console.error("[\u539F\u751F\u62D6\u653E] timelineRef.current\u4E3Anull\uFF0C\u65E0\u6CD5\u6DFB\u52A0\u4E8B\u4EF6\u76D1\u542C");
          return;
        }
        console.log("[\u539F\u751F\u62D6\u653E] \u5F00\u59CB\u6DFB\u52A0\u539F\u751F\u4E8B\u4EF6\u76D1\u542C\u5230\u65F6\u95F4\u7EBF");
        const handleNativeDragOver2 = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "copy";
          }
          setIsOverTimeline(true);
          setIsDragging(true);
          console.log("[\u539F\u751F\u62D6\u653E] dragover\u89E6\u53D1");
        };
        const handleNativeDragEnter2 = (e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOverTimeline(true);
          console.log("[\u539F\u751F\u62D6\u653E] dragenter\u89E6\u53D1");
        };
        const handleNativeDragLeave2 = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const rect = timeline.getBoundingClientRect();
          const x = e.clientX;
          const y = e.clientY;
          if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            setIsOverTimeline(false);
            console.log("[\u539F\u751F\u62D6\u653E] dragleave\u89E6\u53D1\uFF08\u771F\u7684\u79BB\u5F00\u4E86\uFF09");
          }
        };
        const handleNativeDrop2 = (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log("[\u539F\u751F\u62D6\u653E] drop\u89E6\u53D1, draggingShot:", draggingShot?.title || draggingShot?.id);
          setIsOverTimeline(false);
          setIsDragging(false);
          if (!draggingShot) {
            console.log("[\u539F\u751F\u62D6\u653E] draggingShot\u4E3A\u7A7A\uFF0C\u8FD4\u56DE");
            return;
          }
          const rect = timeline.getBoundingClientRect();
          const x = e.clientX - rect.left - 60;
          const startTime = Math.max(0, x / (PIXELS_PER_SECOND * zoom));
          console.log("[\u539F\u751F\u62D6\u653E] \u653E\u7F6E\u4F4D\u7F6E:", startTime, "\u79D2");
          if (draggingType === "audio") {
            const duration = draggingShot.duration || 5;
            const newClip = {
              id: `audio_${Date.now()}`,
              title: draggingShot.title || "\u97F3\u9891",
              url: draggingShot.url,
              start: startTime,
              duration,
              srcDuration: duration,
              speed: 1,
              volume: 100
            };
            setAudioClips((prev) => [...prev, newClip].sort((a, b) => a.start - b.start));
            setDraggingShot(null);
            log?.(`\u5DF2\u6DFB\u52A0\u97F3\u9891\u300C${newClip.title}\u300D\u5230\u97F3\u9891\u8F68\u9053\uFF08${formatTime(newClip.start)}\uFF09`);
          } else if (draggingType === "text") {
            const duration = 3;
            const newClip = {
              id: `text_${Date.now()}`,
              character: draggingShot.character || "\u89D2\u8272",
              text: draggingShot.text || draggingShot.content || "",
              start: startTime,
              duration,
              fontSize: 24,
              color: "#ffffff",
              position: "bottom"
            };
            setTextClips((prev) => [...prev, newClip].sort((a, b) => a.start - b.start));
            setDraggingShot(null);
            log?.(`\u5DF2\u6DFB\u52A0\u6587\u672C\u300C${newClip.character}\uFF1A${newClip.text.substring(0, 10)}...\u300D\u5230\u6587\u672C\u8F68\u9053\uFF08${formatTime(newClip.start)}\uFF09`);
          } else {
            const duration = durations[draggingShot.id] || 5;
            const newClip = {
              id: `clip_${Date.now()}`,
              shotId: draggingShot.id,
              title: draggingShot.title,
              url: draggingShot.url,
              start: startTime,
              duration,
              thumb: draggingShot.imageUrl,
              transition: selectedTransition !== "none" ? selectedTransition : void 0,
              speed: 1,
              srcDuration: duration,
              volume: 100,
              filter: "none",
              brightness: 100,
              contrast: 100,
              saturation: 100
            };
            setTimelineClips((prev) => [...prev, newClip].sort((a, b) => a.start - b.start));
            setSelectedClipId(newClip.id);
            setDraggingShot(null);
            log?.(`\u5DF2\u6DFB\u52A0\u300C${draggingShot.title}\u300D\u5230\u65F6\u95F4\u7EBF\uFF08${formatTime(newClip.start)}\uFF09`);
          }
        };
        timeline.addEventListener("dragover", handleNativeDragOver2);
        timeline.addEventListener("dragenter", handleNativeDragEnter2);
        timeline.addEventListener("dragleave", handleNativeDragLeave2);
        timeline.addEventListener("drop", handleNativeDrop2);
        console.log("[\u539F\u751F\u62D6\u653E] \u5DF2\u6DFB\u52A0\u539F\u751F\u4E8B\u4EF6\u76D1\u542C\u5230\u65F6\u95F4\u7EBF");
      }, 100);
      return () => {
        clearTimeout(timer);
        const timeline = timelineRef.current;
        if (timeline) {
          timeline.removeEventListener("dragover", handleNativeDragOver);
          timeline.removeEventListener("dragenter", handleNativeDragEnter);
          timeline.removeEventListener("dragleave", handleNativeDragLeave);
          timeline.removeEventListener("drop", handleNativeDrop);
        }
        console.log("[\u539F\u751F\u62D6\u653E] \u5DF2\u79FB\u9664\u539F\u751F\u4E8B\u4EF6\u76D1\u542C");
      };
    }, []);
    const updateClips = (updater, recordHistory = true) => {
      setTimelineClips((prev) => {
        const next = updater(prev);
        if (recordHistory) pushHistory2(next, currentTime);
        return next;
      });
    };
    const handleDragStart = (item, type, e) => {
      console.log("[\u62D6\u52A8] \u5F00\u59CB\u62D6\u52A8:", item.title || item.character || item.id, "\u7C7B\u578B:", type);
      console.log("[\u62D6\u52A8] \u62D6\u52A8\u6E90\u5143\u7D20:", e.target.tagName, e.target.className);
      setDraggingShot(item);
      setDraggingType(type);
      setIsDragging(true);
      try {
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData("text/plain", item.id || "clip");
        console.log("[\u62D6\u52A8] dataTransfer\u8BBE\u7F6E\u6210\u529F");
      } catch (err) {
        console.error("[\u62D6\u52A8] dataTransfer\u8BBE\u7F6E\u5931\u8D25:", err);
      }
    };
    const handleDragOver = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      if (!window._dragOverLogged) {
        console.log("[\u62D6\u52A8] handleDragOver\u89E6\u53D1\uFF0C\u76EE\u6807\u5143\u7D20:", e.target.tagName, e.target.className?.substring?.(0, 50));
        window._dragOverLogged = true;
        setTimeout(() => {
          window._dragOverLogged = false;
        }, 1e3);
      }
    };
    const handleDragEnter = (e) => {
      e.preventDefault();
      setIsDragging(true);
      console.log("[\u62D6\u52A8] \u8FDB\u5165\u65F6\u95F4\u7EBF\u533A\u57DF");
    };
    const handleDragLeave = (e) => {
      e.preventDefault();
      if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget)) {
        setIsDragging(false);
        console.log("[\u62D6\u52A8] \u79BB\u5F00\u65F6\u95F4\u7EBF\u533A\u57DF");
      }
    };
    const handleDrop = (e) => {
      e.preventDefault();
      console.log("[\u62D6\u52A8] \u653E\u7F6E\u5230\u65F6\u95F4\u7EBF\uFF0CdraggingShot:", draggingShot?.title || draggingShot?.id);
      setIsDragging(false);
      if (!draggingShot) return;
      const rect = timelineRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left - 60;
      const startTime = Math.max(0, x / (PIXELS_PER_SECOND * zoom));
      if (draggingType === "audio") {
        const duration = draggingShot.duration || 5;
        const newClip = {
          id: `audio_${Date.now()}`,
          title: draggingShot.title || "\u97F3\u9891",
          url: draggingShot.url,
          start: startTime,
          duration,
          srcDuration: duration,
          speed: 1,
          volume: 100
        };
        setAudioClips((prev) => [...prev, newClip].sort((a, b) => a.start - b.start));
        setDraggingShot(null);
        log?.(`\u5DF2\u6DFB\u52A0\u97F3\u9891\u300C${newClip.title}\u300D\u5230\u97F3\u9891\u8F68\u9053\uFF08${formatTime(newClip.start)}\uFF09`);
      } else if (draggingType === "text") {
        const duration = 3;
        const newClip = {
          id: `text_${Date.now()}`,
          character: draggingShot.character || "\u89D2\u8272",
          text: draggingShot.text || draggingShot.content || "",
          start: startTime,
          duration,
          fontSize: 24,
          color: "#ffffff",
          position: "bottom"
        };
        setTextClips((prev) => [...prev, newClip].sort((a, b) => a.start - b.start));
        setDraggingShot(null);
        log?.(`\u5DF2\u6DFB\u52A0\u6587\u672C\u300C${newClip.character}\uFF1A${newClip.text.substring(0, 10)}...\u300D\u5230\u6587\u672C\u8F68\u9053\uFF08${formatTime(newClip.start)}\uFF09`);
      } else {
        const duration = durations[draggingShot.id] || 5;
        const newClip = {
          id: `clip_${Date.now()}`,
          shotId: draggingShot.id,
          title: draggingShot.title,
          url: draggingShot.url,
          start: startTime,
          duration,
          thumb: draggingShot.imageUrl,
          transition: selectedTransition !== "none" ? selectedTransition : void 0,
          speed: 1,
          srcDuration: duration,
          volume: 100,
          filter: "none",
          brightness: 100,
          contrast: 100,
          saturation: 100
        };
        setTimelineClips((prev) => [...prev, newClip].sort((a, b) => a.start - b.start));
        setDraggingShot(null);
        setSelectedClipId(newClip.id);
        log?.(`\u5DF2\u6DFB\u52A0\u300C${draggingShot.title}\u300D\u5230\u65F6\u95F4\u7EBF\uFF08${formatTime(newClip.start)}\uFF09`);
      }
      setDraggingType("video");
      setDraggingShot(null);
      setIsDragging(false);
    };
    const handleDragEnd = (e) => {
      console.log("[\u62D6\u52A8] \u62D6\u52A8\u7ED3\u675F");
      setIsDragging(false);
      setDraggingShot(null);
    };
    const handleItemClick = (item, type, overrideDuration) => {
      console.log("[\u70B9\u51FB\u6DFB\u52A0] \u7D20\u6750:", item.title || item.character || item.id, "\u7C7B\u578B:", type);
      let maxEnd = 0;
      if (type === "audio") {
        audioClips.forEach((c) => {
          maxEnd = Math.max(maxEnd, c.start + c.duration);
        });
      } else if (type === "text") {
        textClips.forEach((c) => {
          maxEnd = Math.max(maxEnd, c.start + c.duration);
        });
      } else {
        timelineClips.forEach((c) => {
          maxEnd = Math.max(maxEnd, c.start + c.duration);
        });
      }
      const startTime = maxEnd;
      if (type === "audio") {
        const duration = overrideDuration || item.duration || 5;
        const newClip = {
          id: `audio_${Date.now()}`,
          title: item.title || "\u97F3\u9891",
          url: item.url,
          start: startTime,
          duration,
          srcDuration: duration,
          speed: 1,
          volume: 100
        };
        setAudioClips((prev) => [...prev, newClip].sort((a, b) => a.start - b.start));
        log?.(`\u5DF2\u6DFB\u52A0\u97F3\u9891\u300C${newClip.title}\u300D\u5230\u97F3\u9891\u8F68\u9053\uFF08${formatTime(newClip.start)}\uFF09`);
      } else if (type === "text") {
        const duration = 3;
        const newClip = {
          id: `text_${Date.now()}`,
          character: item.character || "\u89D2\u8272",
          text: item.text || item.content || "",
          start: startTime,
          duration,
          fontSize: 24,
          color: "#ffffff",
          position: "bottom"
        };
        setTextClips((prev) => [...prev, newClip].sort((a, b) => a.start - b.start));
        log?.(`\u5DF2\u6DFB\u52A0\u6587\u672C\u300C${newClip.character}\uFF1A${newClip.text.substring(0, 10)}...\u300D\u5230\u6587\u672C\u8F68\u9053\uFF08${formatTime(newClip.start)}\uFF09`);
      } else {
        const duration = overrideDuration || durations[item.id] || 5;
        const newClip = {
          id: `clip_${Date.now()}`,
          shotId: item.id,
          title: item.title,
          url: item.url,
          start: startTime,
          duration,
          thumb: item.imageUrl,
          transition: selectedTransition !== "none" ? selectedTransition : void 0,
          speed: 1,
          srcDuration: duration,
          volume: 100,
          filter: "none",
          brightness: 100,
          contrast: 100,
          saturation: 100
        };
        setTimelineClips((prev) => [...prev, newClip].sort((a, b) => a.start - b.start));
        setSelectedClipId(newClip.id);
        log?.(`\u5DF2\u6DFB\u52A0\u300C${item.title}\u300D\u5230\u65F6\u95F4\u7EBF\uFF08${formatTime(newClip.start)}\uFF09`);
      }
    };
    (0, import_react5.useEffect)(() => {
      if (!incomingAssets || incomingAssets.length === 0) return;
      let cancelled = false;
      (async () => {
        for (let a of incomingAssets) {
          const type = a.type === "audio" ? "audio" : a.type === "text" ? "text" : "video";
          let measured = 0;
          if (type === "video" && a.url && !durations[a.id]) {
            measured = await getVideoDuration(a.url);
          } else if (type === "audio" && a.url && !a.duration) {
            measured = await getAudioDuration(a.url);
          }
          if (cancelled) return;
          handleItemClick(a, type, measured || 0);
        }
        if (!cancelled) onConsumeAssets && onConsumeAssets();
      })();
      return () => {
        cancelled = true;
      };
    }, [incomingAssets]);
    const handleClipMouseDown = (clip, e) => {
      e.stopPropagation();
      setSelectedClipId(clip.id);
      const rect = timelineRef.current?.getBoundingClientRect();
      if (!rect) return;
      dragStateRef.current = { clipId: clip.id, startX: e.clientX, origStart: clip.start, rectLeft: rect.left + 60 };
      const handleMouseMove = (ev) => {
        const state = dragStateRef.current;
        if (!state) return;
        const dx = ev.clientX - state.startX;
        const newStart = Math.max(0, state.origStart + dx / (PIXELS_PER_SECOND * zoom));
        const clipId = state.clipId;
        setTimelineClips((prev) => prev.map((c) => c.id === clipId ? { ...c, start: newStart } : c).sort((a, b) => a.start - b.start));
      };
      const handleMouseUp = () => {
        if (dragStateRef.current) {
          pushHistory2(timelineClips, currentTime);
          dragStateRef.current = null;
        }
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    };
    const handleAnyClipMouseDown = (clip, trackType, e) => {
      e.stopPropagation();
      setSelectedClipId(clip.id);
      setSelectedTrack(trackType);
      const rect = timelineRef.current?.getBoundingClientRect();
      if (!rect) return;
      dragStateRef.current = { clipId: clip.id, trackType, startX: e.clientX, origStart: clip.start, rectLeft: rect.left + 60 };
      const handleMouseMove = (ev) => {
        const state = dragStateRef.current;
        if (!state) return;
        const dx = ev.clientX - state.startX;
        const newStart = Math.max(0, state.origStart + dx / (PIXELS_PER_SECOND * zoom));
        const clipId = state.clipId;
        const track = state.trackType;
        if (track === "video") {
          setTimelineClips((prev) => prev.map((c) => c.id === clipId ? { ...c, start: newStart } : c).sort((a, b) => a.start - b.start));
        } else if (track === "audio") {
          setAudioClips((prev) => prev.map((c) => c.id === clipId ? { ...c, start: newStart } : c).sort((a, b) => a.start - b.start));
        } else if (track === "text") {
          setTextClips((prev) => prev.map((c) => c.id === clipId ? { ...c, start: newStart } : c).sort((a, b) => a.start - b.start));
        }
      };
      const handleMouseUp = () => {
        if (dragStateRef.current) {
          pushHistory2(timelineClips, currentTime);
          dragStateRef.current = null;
        }
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    };
    const handleTimelineClick = (e) => {
      const rect = timelineRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left - 60;
      seekTo(x / (PIXELS_PER_SECOND * zoom));
    };
    const splitClip = () => {
      if (!selectedClipId) {
        log?.("\u8BF7\u5148\u9009\u4E2D\u8981\u5206\u5272\u7684\u7247\u6BB5");
        return;
      }
      const clip = timelineClips.find((c) => c.id === selectedClipId);
      if (!clip) return;
      if (currentTime <= clip.start || currentTime >= clip.start + clip.duration) {
        log?.("\u64AD\u653E\u5934\u9700\u8981\u5728\u9009\u4E2D\u7247\u6BB5\u5185\u624D\u80FD\u5206\u5272");
        return;
      }
      const splitPoint = currentTime - clip.start;
      const speed = clip.speed || 1;
      const srcTotal = clip.srcDuration || clip.duration * speed;
      const leftSrc = Math.max(0.1, splitPoint * speed);
      const rightSrc = Math.max(0.1, srcTotal - leftSrc);
      const leftClip = { ...clip, duration: splitPoint, srcDuration: leftSrc };
      const rightClip = { ...clip, id: `clip_${Date.now()}`, start: clip.start + splitPoint, duration: clip.duration - splitPoint, srcDuration: rightSrc };
      updateClips((prev) => prev.filter((c) => c.id !== clip.id).concat(leftClip, rightClip).sort((a, b) => a.start - b.start));
      setSelectedClipId(rightClip.id);
      log?.(`\u5DF2\u5728 ${formatTime(currentTime)} \u5904\u5206\u5272\u7247\u6BB5`);
    };
    const copyClip = () => {
      if (!selectedClip) return;
      const newClip = { ...selectedClip, id: `clip_${Date.now()}`, start: selectedClip.start + selectedClip.duration + 0.1 };
      updateClips((prev) => [...prev, newClip].sort((a, b) => a.start - b.start));
      setSelectedClipId(newClip.id);
      log?.(`\u5DF2\u590D\u5236\u7247\u6BB5\u300C${selectedClip.title}\u300D`);
    };
    const deleteSelectedClip = () => {
      if (!selectedClipId) return;
      let clipTitle = "";
      if (selectedTrack === "audio") {
        const clip = audioClips.find((c) => c.id === selectedClipId);
        clipTitle = clip?.title || "\u97F3\u9891";
        setAudioClips((prev) => prev.filter((c) => c.id !== selectedClipId));
      } else if (selectedTrack === "text") {
        const clip = textClips.find((c) => c.id === selectedClipId);
        clipTitle = clip?.character ? `${clip.character}\uFF1A${clip.text}`.substring(0, 20) : "\u6587\u672C";
        setTextClips((prev) => prev.filter((c) => c.id !== selectedClipId));
      } else {
        const clip = timelineClips.find((c) => c.id === selectedClipId);
        clipTitle = clip?.title || "\u89C6\u9891";
        updateClips((prev) => prev.filter((c) => c.id !== selectedClipId));
      }
      setSelectedClipId(null);
      log?.(`\u5DF2\u5220\u9664\u7247\u6BB5\u300C${clipTitle}\u300D`);
    };
    const selectAll = () => {
      if (timelineClips.length > 0) {
        setSelectedClipId(timelineClips[0].id);
        log?.(`\u5DF2\u9009\u4E2D ${timelineClips.length} \u4E2A\u7247\u6BB5`);
      }
    };
    const clearTimeline = () => {
      if (timelineClips.length === 0) return;
      updateClips(() => []);
      setCurrentTime(0);
      setSelectedClipId(null);
      log?.("\u5DF2\u6E05\u7A7A\u65F6\u95F4\u7EBF");
    };
    const autoArrange = () => {
      let cursor = 0;
      updateClips((prev) => prev.map((c) => {
        const nc = { ...c, start: cursor };
        cursor += nc.duration;
        return nc;
      }));
      log?.("\u5DF2\u81EA\u52A8\u6392\u5217\u6240\u6709\u7247\u6BB5\uFF08\u65E0\u7F1D\u62FC\u63A5\uFF09");
    };
    const updateSelectedClip = (updates) => {
      if (!selectedClipId) return;
      updateClips((prev) => prev.map((c) => c.id === selectedClipId ? { ...c, ...updates } : c));
    };
    const changeSpeed = (speed) => {
      if (!selectedClip) return;
      const base = baseDuration(selectedClip);
      updateSelectedClip({ speed, srcDuration: base, duration: base / speed });
      log?.(`\u300C${selectedClip.title}\u300D\u53D8\u901F\u4E3A ${speed}x\uFF0C\u65F6\u957F ${formatTime(base / speed)}`);
    };
    const changeAudioSpeed = (speed) => {
      const clip = audioClips.find((c) => c.id === selectedClipId);
      if (!clip) return;
      const base = baseDuration(clip);
      setAudioClips((prev) => prev.map((c) => c.id === selectedClipId ? { ...c, speed, srcDuration: base, duration: base / speed } : c));
      log?.(`\u300C${clip.title}\u300D\u97F3\u9891\u53D8\u901F\u4E3A ${speed}x\uFF0C\u65F6\u957F ${formatTime(base / speed)}`);
    };
    const toggleReverse = () => {
      if (!selectedClip) return;
      updateSelectedClip({ reverse: !selectedClip.reverse });
      log?.(`\u300C${selectedClip.title}\u300D${!selectedClip.reverse ? "\u5F00\u542F" : "\u5173\u95ED"}\u5012\u653E`);
    };
    const toggleFreeze = () => {
      if (!selectedClip) return;
      updateSelectedClip({ freeze: !selectedClip.freeze });
      log?.(`\u300C${selectedClip.title}\u300D${!selectedClip.freeze ? "\u5F00\u542F" : "\u5173\u95ED"}\u5B9A\u683C`);
    };
    const toggleMute = () => {
      if (!selectedClip) return;
      updateSelectedClip({ muted: !selectedClip.muted });
      log?.(`\u300C${selectedClip.title}\u300D${!selectedClip.muted ? "\u9759\u97F3" : "\u53D6\u6D88\u9759\u97F3"}`);
    };
    const urlToBase64 = async (url) => {
      const r = await fetch(url);
      const b = await r.blob();
      return await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result).split(",")[1] || "");
        fr.onerror = () => reject(new Error("\u7D20\u6750\u8BFB\u53D6\u5931\u8D25"));
        fr.readAsDataURL(b);
      });
    };
    const exportVideo = async () => {
      if (timelineClips.length === 0) {
        log?.("\u65F6\u95F4\u7EBF\u4E0A\u6CA1\u6709\u89C6\u9891\u7247\u6BB5\uFF0C\u65E0\u6CD5\u5BFC\u51FA");
        return;
      }
      setBusy("video");
      try {
        const ratio = ASPECT_RATIOS.find((r) => r.id === aspectRatio);
        log?.("\u6B63\u5728\u8BFB\u53D6\u7D20\u6750\u2026");
        const clips = [];
        for (const c of [...timelineClips].sort((a, b) => a.start - b.start)) {
          clips.push({
            data: await urlToBase64(c.url),
            start: c.start || 0,
            duration: c.duration || 0,
            speed: c.speed || 1,
            volume: (c.muted ? 0 : c.volume ?? 100) / 100,
            transition: c.transition || "none",
            brightness: c.brightness ?? 100,
            contrast: c.contrast ?? 100,
            saturation: c.saturation ?? 100
          });
        }
        const audios = [];
        for (const a of [...audioClips].sort((x, y) => x.start - y.start)) {
          audios.push({
            data: await urlToBase64(a.url),
            start: a.start || 0,
            duration: a.duration || 0,
            speed: a.speed || 1,
            volume: (a.muted ? 0 : a.volume ?? 100) / 100
          });
        }
        const texts = textClips.map((t2) => ({
          start: t2.start || 0,
          duration: t2.duration || 3,
          text: `${t2.character ? t2.character + "\uFF1A" : ""}${t2.text || ""}`
        }));
        log?.(`\u6B63\u5728\u5408\u6210 ${clips.length} \u6BB5\u89C6\u9891 + ${audios.length} \u6BB5\u97F3\u9891\u2026`);
        const path = await (0, import_core.invoke)("export_timeline", {
          clips,
          audios,
          texts,
          width: ratio?.w || 1920,
          height: ratio?.h || 1080,
          fps: exportFps || 30,
          bitrate: exportBitrate || "8M",
          bg_color: bgColor || "#000000",
          filename: `\u70EC\u5E8F\u6210\u7247_${Date.now()}.mp4`
        });
        log?.(`\u2705 \u5BFC\u51FA\u6210\u529F\uFF1A${path}`);
      } catch (e) {
        log?.(`\u274C \u5BFC\u51FA\u5931\u8D25\uFF1A${e?.message || e}`);
      } finally {
        setBusy("");
        setShowExportSettings(false);
      }
    };
    const currentClip = timelineClips.find((c) => currentTime >= c.start && currentTime < c.start + c.duration);
    const currentFilter = currentClip?.filter && currentClip.filter !== "none" ? FILTERS.find((f) => f.id === currentClip.filter)?.css : "";
    const rulerMarks = [];
    for (let t2 = 0; t2 <= Math.ceil(totalDuration || 10); t2 += markInterval) rulerMarks.push(t2);
    const gridBackground = (0, import_react5.useMemo)(() => {
      const px = PIXELS_PER_SECOND * zoom;
      return {
        backgroundImage: `repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 1px, transparent 1px ${px}px)`
      };
    }, [zoom]);
    (0, import_react5.useEffect)(() => {
      const handleKeyDown = (e) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        if ((e.ctrlKey || e.metaKey) && e.key === "z") {
          e.preventDefault();
          undo();
        } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.shiftKey && e.key === "Z")) {
          e.preventDefault();
          redo();
        } else if (e.key === "Delete" || e.key === "Backspace") {
          if (selectedClipId) {
            e.preventDefault();
            deleteSelectedClip();
          }
        } else if (e.key === " ") {
          e.preventDefault();
          togglePlay();
        } else if (e.key === "b" || e.key === "B") {
          splitClip();
        } else if ((e.ctrlKey || e.metaKey) && e.key === "a") {
          e.preventDefault();
          selectAll();
        } else if ((e.ctrlKey || e.metaKey) && e.key === "d") {
          e.preventDefault();
          copyClip();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selectedClipId, timelineClips, isPlaying, history, historyIndex, togglePlay]);
    return /* @__PURE__ */ import_react5.default.createElement("div", { style: { display: "flex", flexDirection: "column", height: "100%", background: "#1a1a2e", color: "#fff" } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", height: 44, borderBottom: "1px solid #2a2a4a", background: "#16162a" } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { display: "flex", alignItems: "center", gap: 4 } }, /* @__PURE__ */ import_react5.default.createElement("span", { style: { fontSize: 14, fontWeight: 700, marginRight: 8 } }, "\u2702\uFE0F \u526A\u8F91"), /* @__PURE__ */ import_react5.default.createElement("button", { onClick: undo, disabled: historyIndex <= 0, title: "\u64A4\u9500 Ctrl+Z", style: iconBtn }, "\u21A9\uFE0F"), /* @__PURE__ */ import_react5.default.createElement("button", { onClick: redo, disabled: historyIndex >= history.length - 1, title: "\u91CD\u505A Ctrl+Y", style: iconBtn }, "\u21AA\uFE0F"), /* @__PURE__ */ import_react5.default.createElement("div", { style: { width: 1, height: 20, background: "#2a2a4a", margin: "0 4px" } }), /* @__PURE__ */ import_react5.default.createElement("button", { onClick: autoArrange, title: "\u81EA\u52A8\u6392\u5217", style: iconBtn }, "\u{1F517}"), /* @__PURE__ */ import_react5.default.createElement("button", { onClick: splitClip, disabled: !selectedClipId, title: "\u5206\u5272 B", style: { ...iconBtn, opacity: selectedClipId ? 1 : 0.4 } }, "\u2702\uFE0F"), /* @__PURE__ */ import_react5.default.createElement("button", { onClick: copyClip, disabled: !selectedClipId, title: "\u590D\u5236 Ctrl+D", style: { ...iconBtn, opacity: selectedClipId ? 1 : 0.4 } }, "\u{1F4CB}"), /* @__PURE__ */ import_react5.default.createElement("button", { onClick: deleteSelectedClip, disabled: !selectedClipId, title: "\u5220\u9664 Del", style: { ...iconBtn, opacity: selectedClipId ? 1 : 0.4 } }, "\u{1F5D1}\uFE0F"), /* @__PURE__ */ import_react5.default.createElement("div", { style: { width: 1, height: 20, background: "#2a2a4a", margin: "0 4px" } }), /* @__PURE__ */ import_react5.default.createElement("select", { value: aspectRatio, onChange: (e) => setAspectRatio(e.target.value), style: selectStyle, title: "\u753B\u5E03\u6BD4\u4F8B" }, ASPECT_RATIOS.map((r) => /* @__PURE__ */ import_react5.default.createElement("option", { key: r.id, value: r.id }, r.label))), /* @__PURE__ */ import_react5.default.createElement("input", { id: "bgColor", name: "bgColor", type: "color", value: bgColor, onChange: (e) => setBgColor(e.target.value), style: { width: 28, height: 24, border: "none", borderRadius: 4, cursor: "grab", background: "transparent" }, title: "\u80CC\u666F\u989C\u8272" })), /* @__PURE__ */ import_react5.default.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6 } }, /* @__PURE__ */ import_react5.default.createElement("span", { style: { fontSize: 11, color: "#888" } }, timelineClips.length, "\u7247\u6BB5 \xB7 ", formatTime(contentEnd)), /* @__PURE__ */ import_react5.default.createElement("button", { onClick: () => setShowExportSettings(true), style: { padding: "5px 14px", border: "none", borderRadius: 6, background: timelineClips.length > 0 ? "linear-gradient(135deg, #7a5cff, #5ce1e6)" : "#333", color: "#fff", cursor: timelineClips.length > 0 ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 600 } }, "\u{1F3AC} \u5BFC\u51FA"))), /* @__PURE__ */ import_react5.default.createElement("div", { style: { flex: 1, display: "flex", overflow: "hidden" } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { width: 220, borderRight: "1px solid #2a2a4a", background: "#16162a", display: "flex", flexDirection: "column" } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { display: "flex", borderBottom: "1px solid #2a2a4a" } }, [
      { id: "media", name: "\u5A92\u4F53", icon: "\u{1F3AC}" },
      { id: "audio", name: "\u97F3\u9891", icon: "\u{1F3B5}" },
      { id: "text", name: "\u6587\u672C", icon: "\u{1F4DD}" },
      { id: "transition", name: "\u8F6C\u573A", icon: "\u2728" },
      { id: "filter", name: "\u6EE4\u955C", icon: "\u{1F3A8}" }
    ].map((tab) => /* @__PURE__ */ import_react5.default.createElement("button", { key: tab.id, onClick: () => setActiveTab(tab.id), style: { flex: 1, padding: "8px 0", border: "none", background: activeTab === tab.id ? "#1e1e35" : "transparent", color: activeTab === tab.id ? "#5ce1e6" : "#888", cursor: "grab", fontSize: 10, borderBottom: activeTab === tab.id ? "2px solid #5ce1e6" : "2px solid transparent" } }, tab.icon, /* @__PURE__ */ import_react5.default.createElement("br", null), tab.name))), /* @__PURE__ */ import_react5.default.createElement("div", { style: { flex: 1, overflow: "auto", padding: 8 } }, activeTab === "media" && /* @__PURE__ */ import_react5.default.createElement(import_react5.default.Fragment, null, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 10, color: "#888", marginBottom: 6 } }, "\u53EF\u7528\u955C\u5934\uFF08", availableShots.length, "\uFF09"), availableShots.length === 0 ? /* @__PURE__ */ import_react5.default.createElement("div", { style: { textAlign: "center", padding: 24, color: "#555", fontSize: 11 } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 28, marginBottom: 6 } }, "\u{1F3AC}"), "\u6682\u65E0\u5DF2\u751F\u6210\u89C6\u9891") : /* @__PURE__ */ import_react5.default.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 4 } }, availableShots.map((shot) => /* @__PURE__ */ import_react5.default.createElement("div", { key: shot.id, onClick: () => handleItemClick(shot, "video"), style: { display: "flex", gap: 6, padding: 4, border: "1px solid #2a2a4a", borderRadius: 4, background: "#1e1e35", cursor: "pointer" }, onMouseEnter: (e) => {
      e.currentTarget.style.borderColor = "#7a5cff";
    }, onMouseLeave: (e) => {
      e.currentTarget.style.borderColor = "#2a2a4a";
    } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { width: 48, height: 32, background: "#000", borderRadius: 3, overflow: "hidden", flexShrink: 0, position: "relative" } }, shot.imageUrl ? /* @__PURE__ */ import_react5.default.createElement("img", { src: shot.imageUrl, alt: "", draggable: "false", style: { width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" } }) : /* @__PURE__ */ import_react5.default.createElement("div", { style: { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 } }, "\u{1F3AC}"), /* @__PURE__ */ import_react5.default.createElement("div", { style: { position: "absolute", bottom: 0, right: 1, background: "rgba(0,0,0,0.7)", padding: "0 2px", borderRadius: 2, fontSize: 7, fontFamily: "monospace" } }, durations[shot.id] ? formatTime(durations[shot.id]) : "--")), /* @__PURE__ */ import_react5.default.createElement("div", { style: { flex: 1, minWidth: 0 } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 10, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, shot.title), /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 8, color: "#666", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, shot.desc || "\u70B9\u51FB\u6DFB\u52A0")))))), activeTab === "audio" && /* @__PURE__ */ import_react5.default.createElement("div", null, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 10, color: "#888", marginBottom: 6 } }, "\u53EF\u7528\u97F3\u9891\uFF08", availableAudios.length, "\uFF09"), availableAudios.length === 0 ? /* @__PURE__ */ import_react5.default.createElement("div", { style: { textAlign: "center", padding: 24, color: "#555", fontSize: 11 } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 28, marginBottom: 6 } }, "\u{1F3B5}"), "\u6682\u65E0\u97F3\u9891\u7D20\u6750", /* @__PURE__ */ import_react5.default.createElement("br", null), /* @__PURE__ */ import_react5.default.createElement("span", { style: { fontSize: 9 } }, "\u8BF7\u5148\u5728\u914D\u97F3\u6A21\u5757\u751F\u6210\u914D\u97F3")) : /* @__PURE__ */ import_react5.default.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 4 } }, availableAudios.map((audio) => /* @__PURE__ */ import_react5.default.createElement("div", { key: audio.id, onClick: () => handleItemClick(audio, "audio"), style: { display: "flex", gap: 6, padding: 4, border: "1px solid #2a2a4a", borderRadius: 4, background: "#1e1e35", cursor: "pointer" } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { width: 32, height: 32, background: "rgba(16,185,129,0.2)", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 } }, "\u{1F3B5}"), /* @__PURE__ */ import_react5.default.createElement("div", { style: { flex: 1, minWidth: 0 } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 10, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, audio.title || audio.name || "\u97F3\u9891"), /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 8, color: "#666", marginTop: 1 } }, audio.duration ? `${audio.duration}\u79D2` : "\u70B9\u51FB\u6DFB\u52A0")))))), activeTab === "text" && /* @__PURE__ */ import_react5.default.createElement("div", null, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 10, color: "#888", marginBottom: 6 } }, "\u53EF\u7528\u6587\u672C\uFF08", availableTexts.length, "\uFF09"), availableTexts.length === 0 ? /* @__PURE__ */ import_react5.default.createElement("div", { style: { textAlign: "center", padding: 24, color: "#555", fontSize: 11 } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 28, marginBottom: 6 } }, "\u{1F4DD}"), "\u6682\u65E0\u6587\u672C\u7D20\u6750", /* @__PURE__ */ import_react5.default.createElement("br", null), /* @__PURE__ */ import_react5.default.createElement("span", { style: { fontSize: 9 } }, "\u8BF7\u5148\u5728\u5206\u955C\u4E2D\u6DFB\u52A0\u53F0\u8BCD")) : /* @__PURE__ */ import_react5.default.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 4 } }, availableTexts.map((text) => /* @__PURE__ */ import_react5.default.createElement("div", { key: text.id, onClick: () => handleItemClick(text, "text"), style: { display: "flex", gap: 6, padding: 4, border: "1px solid #2a2a4a", borderRadius: 4, background: "#1e1e35", cursor: "pointer" } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { width: 32, height: 32, background: "rgba(245,158,11,0.2)", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 } }, "\u{1F4DD}"), /* @__PURE__ */ import_react5.default.createElement("div", { style: { flex: 1, minWidth: 0 } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 10, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, text.character || "\u53F0\u8BCD"), /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 8, color: "#666", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, text.text || text.content || "\u70B9\u51FB\u6DFB\u52A0")))))), activeTab === "transition" && /* @__PURE__ */ import_react5.default.createElement("div", null, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 10, color: "#888", marginBottom: 6 } }, "\u8F6C\u573A\uFF08\u9009\u4E2D\u540E\u65B0\u7247\u6BB5\u751F\u6548\uFF09"), /* @__PURE__ */ import_react5.default.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 } }, TRANSITIONS.map((t2) => /* @__PURE__ */ import_react5.default.createElement("button", { key: t2.id, onClick: () => setSelectedTransition(t2.id), style: { padding: "8px 2px", border: selectedTransition === t2.id ? "1px solid #5ce1e6" : "1px solid #2a2a4a", borderRadius: 4, background: selectedTransition === t2.id ? "rgba(92,225,230,0.1)" : "#1e1e35", color: selectedTransition === t2.id ? "#5ce1e6" : "#aaa", cursor: "grab", fontSize: 10 } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 16, marginBottom: 1 } }, t2.icon), t2.name)))), activeTab === "filter" && /* @__PURE__ */ import_react5.default.createElement("div", null, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 10, color: "#888", marginBottom: 6 } }, "\u6EE4\u955C\uFF08\u70B9\u51FB\u5E94\u7528\u5230\u9009\u4E2D\u7247\u6BB5\uFF09"), /* @__PURE__ */ import_react5.default.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 } }, FILTERS.map((f) => /* @__PURE__ */ import_react5.default.createElement("button", { key: f.id, onClick: () => selectedClip && updateSelectedClip({ filter: f.id }), disabled: !selectedClip, style: { padding: "8px 2px", border: selectedClip?.filter === f.id ? "1px solid #5ce1e6" : "1px solid #2a2a4a", borderRadius: 4, background: selectedClip?.filter === f.id ? "rgba(92,225,230,0.1)" : "#1e1e35", color: selectedClip?.filter === f.id ? "#5ce1e6" : "#aaa", cursor: selectedClip ? "pointer" : "not-allowed", fontSize: 10, opacity: selectedClip ? 1 : 0.5 } }, f.name))), !selectedClip && /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 9, color: "#555", marginTop: 8, textAlign: "center" } }, "\u8BF7\u5148\u9009\u4E2D\u7247\u6BB5")))), /* @__PURE__ */ import_react5.default.createElement("div", { style: { flex: 1, display: "flex", flexDirection: "column", background: "#0a0a15" } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", background: bgColor } }, /* @__PURE__ */ import_react5.default.createElement(
      "video",
      {
        ref: videoRef,
        playsInline: true,
        preload: "auto",
        style: { maxHeight: "100%", maxWidth: "100%", objectFit: "contain", filter: currentFilter || "none", display: currentClip ? "block" : "none" }
      }
    ), /* @__PURE__ */ import_react5.default.createElement("audio", { ref: audioRef, preload: "auto", style: { display: "none" } }), !currentClip && /* @__PURE__ */ import_react5.default.createElement("div", { style: { textAlign: "center", color: "#444" } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 56, marginBottom: 12 } }, "\u{1F3AC}"), /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 14 } }, "\u4ECE\u5DE6\u4FA7\u70B9\u51FB\u955C\u5934\u6DFB\u52A0\u5230\u65F6\u95F4\u7EBF"), /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 11, marginTop: 6, color: "#333" } }, "\u5FEB\u6377\u952E\uFF1A\u7A7A\u683C\u64AD\u653E \xB7 B\u5206\u5272 \xB7 Ctrl+Z\u64A4\u9500")), currentClip && /* @__PURE__ */ import_react5.default.createElement("div", { style: { position: "absolute", top: 10, left: 10, background: "rgba(0,0,0,0.6)", padding: "3px 8px", borderRadius: 4, fontSize: 11 } }, currentClip.title), textClips.filter((tc) => currentTime >= tc.start && currentTime < tc.start + tc.duration).map((tc) => /* @__PURE__ */ import_react5.default.createElement("div", { key: tc.id, style: {
      position: "absolute",
      bottom: tc.position === "top" ? 60 : 30,
      top: tc.position === "top" ? 30 : "auto",
      left: "50%",
      transform: "translateX(-50%)",
      background: "rgba(0,0,0,0.7)",
      color: tc.color || "#ffffff",
      fontSize: tc.fontSize || 20,
      padding: "6px 16px",
      borderRadius: 6,
      maxWidth: "80%",
      textAlign: "center",
      fontWeight: 600,
      textShadow: "0 1px 3px rgba(0,0,0,0.8)",
      zIndex: 5
    } }, tc.character && /* @__PURE__ */ import_react5.default.createElement("span", { style: { color: "#5ce1e6", marginRight: 8 } }, tc.character, "\uFF1A"), tc.text))), /* @__PURE__ */ import_react5.default.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderTop: "1px solid #2a2a4a", background: "#16162a" } }, /* @__PURE__ */ import_react5.default.createElement("button", { onClick: () => seekTo(currentTime - 5), style: playBtn }, "\u23EE"), /* @__PURE__ */ import_react5.default.createElement("button", { onClick: togglePlay, style: { width: 36, height: 36, borderRadius: "50%", border: "none", background: isPlaying ? "#ef4444" : "#7a5cff", color: "#fff", cursor: "grab", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" } }, isPlaying ? "\u23F8" : "\u25B6"), /* @__PURE__ */ import_react5.default.createElement("button", { onClick: () => seekTo(currentTime + 5), style: playBtn }, "\u23ED"), /* @__PURE__ */ import_react5.default.createElement("div", { ref: timeTextRef, style: { fontFamily: "monospace", fontSize: 13, color: "#5ce1e6", minWidth: 80 } }, formatTime(currentTime)), /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 11, color: "#555" } }, "/ ", formatTime(contentEnd)), /* @__PURE__ */ import_react5.default.createElement("div", { style: { flex: 1 } }), /* @__PURE__ */ import_react5.default.createElement("span", { style: { fontSize: 10, color: "#666" } }, "\u7F29\u653E"), /* @__PURE__ */ import_react5.default.createElement("input", { id: "timelineZoom", name: "timelineZoom", type: "range", min: "0.25", max: "3", step: "0.25", value: zoom, onChange: (e) => setZoom(parseFloat(e.target.value)), style: { width: 80 } }), /* @__PURE__ */ import_react5.default.createElement("span", { style: { fontSize: 10, color: "#666", minWidth: 24 } }, zoom, "x"))), selectedClip && showProperties && /* @__PURE__ */ import_react5.default.createElement("div", { style: { width: 200, borderLeft: "1px solid #2a2a4a", background: "#16162a", overflow: "auto" } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { padding: "10px 8px", borderBottom: "1px solid #2a2a4a", display: "flex", justifyContent: "space-between", alignItems: "center" } }, /* @__PURE__ */ import_react5.default.createElement("span", { style: { fontSize: 12, fontWeight: 600 } }, "\u5C5E\u6027"), /* @__PURE__ */ import_react5.default.createElement("button", { onClick: () => setShowProperties(false), style: { background: "none", border: "none", color: "#888", cursor: "grab", fontSize: 14 } }, "\xD7")), /* @__PURE__ */ import_react5.default.createElement("div", { style: { padding: 8 } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 11, color: "#5ce1e6", marginBottom: 6, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, selectedTrack === "text" ? `\u6587\u672C\uFF1A${selectedClip.character || ""}` : selectedTrack === "audio" ? `\u97F3\u9891\uFF1A${selectedClip.title || ""}` : selectedClip.title), selectedTrack === "text" && /* @__PURE__ */ import_react5.default.createElement(import_react5.default.Fragment, null, /* @__PURE__ */ import_react5.default.createElement("div", { style: { marginBottom: 10 } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 10, color: "#888", marginBottom: 3 } }, "\u6587\u672C\u5185\u5BB9\uFF08\u683C\u5F0F\uFF1A\u89D2\u8272\u540D\uFF1A\u53F0\u8BCD\uFF09"), /* @__PURE__ */ import_react5.default.createElement(
      "textarea",
      {
        value: `${selectedClip.character || ""}\uFF1A${selectedClip.text || ""}`,
        onChange: (e) => {
          const val = e.target.value;
          const sepIndex = val.indexOf("\uFF1A");
          if (sepIndex >= 0) {
            const character = val.substring(0, sepIndex);
            const text = val.substring(sepIndex + 1);
            setTextClips((prev) => prev.map((c) => c.id === selectedClipId ? { ...c, character, text } : c));
          } else {
            setTextClips((prev) => prev.map((c) => c.id === selectedClipId ? { ...c, character: "", text: val } : c));
          }
        },
        style: { width: "100%", padding: "4px 6px", background: "#1e1e35", border: "1px solid #2a2a4a", borderRadius: 4, color: "#fff", fontSize: 11, minHeight: 80, resize: "vertical" },
        placeholder: "\u89D2\u8272\u540D\uFF1A\u53F0\u8BCD\u5185\u5BB9"
      }
    )), /* @__PURE__ */ import_react5.default.createElement("div", { style: { marginBottom: 10 } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 10, color: "#888", marginBottom: 3 } }, "\u5B57\u4F53\u5927\u5C0F\uFF1A", selectedClip.fontSize || 20, "px"), /* @__PURE__ */ import_react5.default.createElement(
      "input",
      {
        type: "range",
        min: "12",
        max: "48",
        value: selectedClip.fontSize || 20,
        onChange: (e) => setTextClips((prev) => prev.map((c) => c.id === selectedClipId ? { ...c, fontSize: parseInt(e.target.value) } : c)),
        style: { width: "100%" }
      }
    )), /* @__PURE__ */ import_react5.default.createElement("div", { style: { marginBottom: 10 } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 10, color: "#888", marginBottom: 3 } }, "\u5B57\u4F53\u989C\u8272"), /* @__PURE__ */ import_react5.default.createElement("div", { style: { display: "flex", gap: 4, flexWrap: "wrap" } }, ["#ffffff", "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#f59e0b"].map((color) => /* @__PURE__ */ import_react5.default.createElement(
      "button",
      {
        key: color,
        onClick: () => setTextClips((prev) => prev.map((c) => c.id === selectedClipId ? { ...c, color } : c)),
        style: { width: 20, height: 20, background: color, border: selectedClip.color === color ? "2px solid #5ce1e6" : "1px solid #444", borderRadius: 3, cursor: "pointer" }
      }
    )))), /* @__PURE__ */ import_react5.default.createElement("div", { style: { marginBottom: 10 } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 10, color: "#888", marginBottom: 3 } }, "\u4F4D\u7F6E"), /* @__PURE__ */ import_react5.default.createElement("div", { style: { display: "flex", gap: 4 } }, /* @__PURE__ */ import_react5.default.createElement(
      "button",
      {
        onClick: () => setTextClips((prev) => prev.map((c) => c.id === selectedClipId ? { ...c, position: "top" } : c)),
        style: { flex: 1, padding: "4px 0", border: selectedClip.position === "top" ? "1px solid #5ce1e6" : "1px solid #2a2a4a", borderRadius: 4, background: selectedClip.position === "top" ? "rgba(92,225,230,0.1)" : "#1e1e35", color: selectedClip.position === "top" ? "#5ce1e6" : "#aaa", fontSize: 10, cursor: "pointer" }
      },
      "\u9876\u90E8"
    ), /* @__PURE__ */ import_react5.default.createElement(
      "button",
      {
        onClick: () => setTextClips((prev) => prev.map((c) => c.id === selectedClipId ? { ...c, position: "bottom" } : c)),
        style: { flex: 1, padding: "4px 0", border: selectedClip.position !== "top" ? "1px solid #5ce1e6" : "1px solid #2a2a4a", borderRadius: 4, background: selectedClip.position !== "top" ? "rgba(92,225,230,0.1)" : "#1e1e35", color: selectedClip.position !== "top" ? "#5ce1e6" : "#aaa", fontSize: 10, cursor: "pointer" }
      },
      "\u5E95\u90E8"
    ))), /* @__PURE__ */ import_react5.default.createElement("div", { style: { marginBottom: 10 } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 10, color: "#888", marginBottom: 3 } }, "\u65F6\u957F\uFF1A", selectedClip.duration || 3, "\u79D2"), /* @__PURE__ */ import_react5.default.createElement(
      "input",
      {
        type: "range",
        min: "1",
        max: "30",
        value: selectedClip.duration || 3,
        onChange: (e) => setTextClips((prev) => prev.map((c) => c.id === selectedClipId ? { ...c, duration: parseInt(e.target.value) } : c)),
        style: { width: "100%" }
      }
    ))), selectedTrack === "audio" && /* @__PURE__ */ import_react5.default.createElement(import_react5.default.Fragment, null, /* @__PURE__ */ import_react5.default.createElement("div", { style: { marginBottom: 10 } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 10, color: "#888", marginBottom: 3 } }, "\u53D8\u901F\uFF1A", selectedClip.speed || 1, "x"), /* @__PURE__ */ import_react5.default.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 3 } }, SPEED_OPTIONS.map((s2) => /* @__PURE__ */ import_react5.default.createElement("button", { key: s2, onClick: () => changeAudioSpeed(s2), style: { padding: "3px 6px", border: (selectedClip.speed || 1) === s2 ? "1px solid #5ce1e6" : "1px solid #2a2a4a", borderRadius: 3, background: (selectedClip.speed || 1) === s2 ? "rgba(92,225,230,0.1)" : "#1e1e35", color: (selectedClip.speed || 1) === s2 ? "#5ce1e6" : "#aaa", cursor: "pointer", fontSize: 9 } }, s2, "x")))), /* @__PURE__ */ import_react5.default.createElement("div", { style: { marginBottom: 10 } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 } }, /* @__PURE__ */ import_react5.default.createElement("span", { style: { fontSize: 10, color: "#888" } }, "\u97F3\u91CF"), /* @__PURE__ */ import_react5.default.createElement("button", { onClick: () => setAudioClips((prev) => prev.map((c) => c.id === selectedClipId ? { ...c, muted: !c.muted } : c)), style: { background: "none", border: "none", color: selectedClip.muted ? "#ef4444" : "#888", cursor: "pointer", fontSize: 12 } }, selectedClip.muted ? "\u{1F507}" : "\u{1F50A}")), /* @__PURE__ */ import_react5.default.createElement(
      "input",
      {
        type: "range",
        min: "0",
        max: "200",
        value: selectedClip.volume ?? 100,
        onChange: (e) => setAudioClips((prev) => prev.map((c) => c.id === selectedClipId ? { ...c, volume: parseInt(e.target.value) } : c)),
        style: { width: "100%" },
        disabled: selectedClip.muted
      }
    ), /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 9, color: "#666", textAlign: "right" } }, selectedClip.volume ?? 100, "%")), /* @__PURE__ */ import_react5.default.createElement("div", { style: { marginBottom: 10 } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 10, color: "#888", marginBottom: 3 } }, "\u7D20\u6750\u65F6\u957F\uFF1A", (selectedClip.srcDuration ?? selectedClip.duration ?? 5).toFixed(1), "\u79D2 \xB7 \u8F68\u9053\u5360\u4F4D ", formatTime(selectedClip.duration || 5)), /* @__PURE__ */ import_react5.default.createElement(
      "input",
      {
        type: "range",
        min: "1",
        max: "120",
        step: "0.5",
        value: Math.min(120, selectedClip.srcDuration ?? selectedClip.duration ?? 5),
        onChange: (e) => setAudioClips((prev) => prev.map((c) => c.id === selectedClipId ? { ...c, srcDuration: parseFloat(e.target.value), duration: parseFloat(e.target.value) / (c.speed || 1) } : c)),
        style: { width: "100%" }
      }
    ))), selectedTrack === "video" && /* @__PURE__ */ import_react5.default.createElement(import_react5.default.Fragment, null, /* @__PURE__ */ import_react5.default.createElement("div", { style: { marginBottom: 10 } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 10, color: "#888", marginBottom: 3 } }, "\u53D8\u901F\uFF1A", selectedClip.speed || 1, "x"), /* @__PURE__ */ import_react5.default.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 3 } }, SPEED_OPTIONS.map((s2) => /* @__PURE__ */ import_react5.default.createElement("button", { key: s2, onClick: () => changeSpeed(s2), style: { padding: "3px 6px", border: selectedClip.speed === s2 ? "1px solid #5ce1e6" : "1px solid #2a2a4a", borderRadius: 3, background: selectedClip.speed === s2 ? "rgba(92,225,230,0.1)" : "#1e1e35", color: selectedClip.speed === s2 ? "#5ce1e6" : "#aaa", cursor: "grab", fontSize: 9 } }, s2, "x")))), /* @__PURE__ */ import_react5.default.createElement("div", { style: { display: "flex", gap: 4, marginBottom: 10 } }, /* @__PURE__ */ import_react5.default.createElement("button", { onClick: toggleReverse, style: { flex: 1, padding: "5px 0", border: selectedClip.reverse ? "1px solid #f59e0b" : "1px solid #2a2a4a", borderRadius: 4, background: selectedClip.reverse ? "rgba(245,158,11,0.1)" : "#1e1e35", color: selectedClip.reverse ? "#f59e0b" : "#aaa", cursor: "grab", fontSize: 10 } }, "\u{1F504} \u5012\u653E"), /* @__PURE__ */ import_react5.default.createElement("button", { onClick: toggleFreeze, style: { flex: 1, padding: "5px 0", border: selectedClip.freeze ? "1px solid #f59e0b" : "1px solid #2a2a4a", borderRadius: 4, background: selectedClip.freeze ? "rgba(245,158,11,0.1)" : "#1e1e35", color: selectedClip.freeze ? "#f59e0b" : "#aaa", cursor: "grab", fontSize: 10 } }, "\u2744\uFE0F \u5B9A\u683C")), /* @__PURE__ */ import_react5.default.createElement("div", { style: { marginBottom: 10 } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 } }, /* @__PURE__ */ import_react5.default.createElement("span", { style: { fontSize: 10, color: "#888" } }, "\u97F3\u91CF"), /* @__PURE__ */ import_react5.default.createElement("button", { onClick: toggleMute, style: { background: "none", border: "none", color: selectedClip.muted ? "#ef4444" : "#888", cursor: "grab", fontSize: 12 } }, selectedClip.muted ? "\u{1F507}" : "\u{1F50A}")), /* @__PURE__ */ import_react5.default.createElement("input", { id: "clipVolume", name: "clipVolume", type: "range", min: "0", max: "200", value: selectedClip.volume ?? 100, onChange: (e) => updateSelectedClip({ volume: parseInt(e.target.value) }), style: { width: "100%" }, disabled: selectedClip.muted }), /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 9, color: "#666", textAlign: "right" } }, selectedClip.volume ?? 100, "%")), /* @__PURE__ */ import_react5.default.createElement("div", { style: { marginBottom: 10, paddingTop: 8, borderTop: "1px solid #2a2a4a" } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 10, color: "#888", marginBottom: 6, fontWeight: 600 } }, "\u753B\u9762\u8C03\u8282"), [
      { key: "brightness", label: "\u4EAE\u5EA6", min: 0, max: 200 },
      { key: "contrast", label: "\u5BF9\u6BD4\u5EA6", min: 0, max: 200 },
      { key: "saturation", label: "\u9971\u548C\u5EA6", min: 0, max: 200 }
    ].map((item) => /* @__PURE__ */ import_react5.default.createElement("div", { key: item.key, style: { marginBottom: 4 } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 9, color: "#888", marginBottom: 1 } }, /* @__PURE__ */ import_react5.default.createElement("span", null, item.label), /* @__PURE__ */ import_react5.default.createElement("span", null, selectedClip[item.key] ?? 100)), /* @__PURE__ */ import_react5.default.createElement("input", { id: `clipAdjust_${item.key}`, name: `clipAdjust_${item.key}`, type: "range", min: item.min, max: item.max, value: selectedClip[item.key] ?? 100, onChange: (e) => updateSelectedClip({ [item.key]: parseInt(e.target.value) }), style: { width: "100%" } })))), /* @__PURE__ */ import_react5.default.createElement("div", { style: { paddingTop: 8, borderTop: "1px solid #2a2a4a" } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 10, color: "#888", marginBottom: 3 } }, "\u7247\u6BB5\u65F6\u957F"), /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 14, color: "#5ce1e6", fontFamily: "monospace", fontWeight: 600 } }, formatTime(selectedClip.duration)), /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 9, color: "#666", marginTop: 2 } }, "\u8D77\u59CB\uFF1A", formatTime(selectedClip.start))))))), /* @__PURE__ */ import_react5.default.createElement("div", { ref: timelineRef, onDragOver: handleDragOver, onDragEnter: handleDragEnter, onDragLeave: handleDragLeave, onDrop: handleDrop, onClick: handleTimelineClick, style: { height: TIMELINE_HEIGHT, borderTop: isOverTimeline ? "2px solid #7a5cff" : "2px solid #2a2a4a", background: isOverTimeline ? "rgba(122, 92, 255, 0.1)" : "#16162a", overflowX: "auto", overflowY: "hidden", position: "relative", cursor: isDragging ? "copy" : "text", transition: "all 0.2s" } }, /* @__PURE__ */ import_react5.default.createElement("div", { onDragOver: (e) => e.preventDefault(), style: { width: timelineWidth + 60, position: "relative", height: "100%" } }, /* @__PURE__ */ import_react5.default.createElement("div", { onDragOver: (e) => e.preventDefault(), style: { height: 22, borderBottom: "1px solid #2a2a4a", position: "relative", background: "#12121f", marginLeft: 60 } }, rulerMarks.map((t2) => /* @__PURE__ */ import_react5.default.createElement("div", { key: t2, style: { position: "absolute", left: t2 * PIXELS_PER_SECOND * zoom, top: 0, height: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start" } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { width: 1, height: 6, background: "#444" } }), /* @__PURE__ */ import_react5.default.createElement("span", { style: { fontSize: 8, color: "#666", marginLeft: 2, marginTop: 1, fontFamily: "monospace" } }, formatTime(t2))))), [
      { id: "video", name: "\u{1F3AC} \u89C6\u9891", color: "rgba(122,92,255,0.03)" },
      { id: "audio", name: "\u{1F3B5} \u97F3\u9891", color: "rgba(16,185,129,0.03)" },
      { id: "text", name: "\u{1F4DD} \u6587\u672C", color: "rgba(245,158,11,0.03)" }
    ].map((track, idx) => /* @__PURE__ */ import_react5.default.createElement("div", { key: track.id, onDragOver: (e) => e.preventDefault(), style: { position: "relative" } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { position: "absolute", left: 0, top: idx * TRACK_HEIGHT, width: 60, height: TRACK_HEIGHT, background: "#12121f", borderRight: "1px solid #2a2a4a", borderTop: idx > 0 ? "1px solid #2a2a4a" : "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#888", zIndex: 2 } }, track.name), /* @__PURE__ */ import_react5.default.createElement("div", { onDragOver: (e) => e.preventDefault(), style: { position: "absolute", left: 60, top: idx * TRACK_HEIGHT, height: TRACK_HEIGHT, width: timelineWidth, background: track.color, borderTop: idx > 0 ? "1px solid #2a2a4a" : "none", ...gridBackground } }, track.id === "video" && timelineClips.map((clip) => /* @__PURE__ */ import_react5.default.createElement("div", { key: clip.id, onMouseDown: (e) => handleClipMouseDown(clip, e), onClick: (e) => {
      e.stopPropagation();
      setSelectedClipId(clip.id);
    }, style: { position: "absolute", left: clip.start * PIXELS_PER_SECOND * zoom, top: 3, width: Math.max(clip.duration * PIXELS_PER_SECOND * zoom, 24), height: TRACK_HEIGHT - 6, background: selectedClipId === clip.id ? "linear-gradient(135deg, rgba(122,92,255,0.7), rgba(92,225,230,0.5))" : "linear-gradient(135deg, rgba(122,92,255,0.35), rgba(92,225,230,0.2))", border: selectedClipId === clip.id ? "2px solid #5ce1e6" : "1px solid rgba(122,92,255,0.5)", borderRadius: 4, cursor: "grab", overflow: "hidden", display: "flex", alignItems: "center", padding: "0 6px", userSelect: "none", zIndex: selectedClipId === clip.id ? 3 : 1 } }, clip.thumb && /* @__PURE__ */ import_react5.default.createElement("img", { src: clip.thumb, alt: "", style: { height: 28, width: 36, objectFit: "cover", borderRadius: 2, marginRight: 6, flexShrink: 0 } }), /* @__PURE__ */ import_react5.default.createElement("div", { style: { flex: 1, overflow: "hidden", minWidth: 0 } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 10, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, clip.title), /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 8, color: "rgba(255,255,255,0.6)", fontFamily: "monospace" } }, formatTime(clip.duration), clip.speed !== 1 ? ` \xB7 ${clip.speed}x` : "", clip.reverse ? " \xB7 \u5012\u653E" : "", clip.filter && clip.filter !== "none" ? ` \xB7 ${FILTERS.find((f) => f.id === clip.filter)?.name}` : "")))), track.id === "audio" && audioClips.map((clip) => /* @__PURE__ */ import_react5.default.createElement("div", { key: clip.id, onMouseDown: (e) => handleAnyClipMouseDown(clip, "audio", e), onClick: (e) => {
      e.stopPropagation();
      setSelectedClipId(clip.id);
      setSelectedTrack("audio");
    }, style: { position: "absolute", left: clip.start * PIXELS_PER_SECOND * zoom, top: 3, width: Math.max(clip.duration * PIXELS_PER_SECOND * zoom, 24), height: TRACK_HEIGHT - 6, background: selectedClipId === clip.id && selectedTrack === "audio" ? "linear-gradient(135deg, rgba(16,185,129,0.7), rgba(92,225,230,0.5))" : "linear-gradient(135deg, rgba(16,185,129,0.35), rgba(92,225,230,0.2))", border: selectedClipId === clip.id && selectedTrack === "audio" ? "2px solid #5ce1e6" : "1px solid rgba(16,185,129,0.5)", borderRadius: 4, cursor: "grab", overflow: "hidden", display: "flex", alignItems: "center", padding: "0 6px", userSelect: "none" } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 12, marginRight: 4 } }, "\u{1F3B5}"), /* @__PURE__ */ import_react5.default.createElement("div", { style: { flex: 1, overflow: "hidden", minWidth: 0 } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 10, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, clip.title, clip.muted ? " \u{1F507}" : ""), /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 8, color: "rgba(255,255,255,0.6)", fontFamily: "monospace" } }, formatTime(clip.duration), clip.speed && clip.speed !== 1 ? ` \xB7 ${clip.speed}x` : "")))), track.id === "text" && textClips.map((clip) => /* @__PURE__ */ import_react5.default.createElement("div", { key: clip.id, onMouseDown: (e) => handleAnyClipMouseDown(clip, "text", e), onClick: (e) => {
      e.stopPropagation();
      setSelectedClipId(clip.id);
      setSelectedTrack("text");
    }, style: { position: "absolute", left: clip.start * PIXELS_PER_SECOND * zoom, top: 3, width: Math.max(clip.duration * PIXELS_PER_SECOND * zoom, 24), height: TRACK_HEIGHT - 6, background: selectedClipId === clip.id && selectedTrack === "text" ? "linear-gradient(135deg, rgba(245,158,11,0.7), rgba(92,225,230,0.5))" : "linear-gradient(135deg, rgba(245,158,11,0.35), rgba(92,225,230,0.2))", border: selectedClipId === clip.id && selectedTrack === "text" ? "2px solid #5ce1e6" : "1px solid rgba(245,158,11,0.5)", borderRadius: 4, cursor: "grab", overflow: "hidden", display: "flex", alignItems: "center", padding: "0 6px", userSelect: "none" } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 12, marginRight: 4 } }, "\u{1F4DD}"), /* @__PURE__ */ import_react5.default.createElement("div", { style: { flex: 1, overflow: "hidden", minWidth: 0 } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 10, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, clip.character), /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 8, color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, clip.text)))), track.id !== "video" && track.id !== "audio" && track.id !== "text" && /* @__PURE__ */ import_react5.default.createElement("div", { style: { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", fontSize: 10, color: "#333" } }, track.name.replace(/[🎬🎵📝]/g, "").trim(), "\u8F68\u9053\uFF08\u5F00\u53D1\u4E2D\uFF09")))), /* @__PURE__ */ import_react5.default.createElement("div", { ref: playheadRef, style: { position: "absolute", left: 0, top: 0, height: "100%", width: 2, background: "#ef4444", zIndex: 10, pointerEvents: "none", transform: `translateX(${currentTime * PIXELS_PER_SECOND * zoom + 60}px)` } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { position: "absolute", top: -1, left: -5, width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "8px solid #ef4444" } })))), showExportSettings && /* @__PURE__ */ import_react5.default.createElement("div", { style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1e3, display: "flex", alignItems: "center", justifyContent: "center" }, onClick: () => !busy && setShowExportSettings(false) }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { width: 360, background: "#1a1a2e", border: "1px solid #2a2a4a", borderRadius: 12, padding: 20 }, onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 } }, /* @__PURE__ */ import_react5.default.createElement("h3", { style: { margin: 0, fontSize: 16 } }, "\u{1F3AC} \u5BFC\u51FA\u8BBE\u7F6E"), /* @__PURE__ */ import_react5.default.createElement("button", { onClick: () => setShowExportSettings(false), style: { background: "none", border: "none", color: "#888", cursor: "grab", fontSize: 18 } }, "\xD7")), /* @__PURE__ */ import_react5.default.createElement("div", { style: { marginBottom: 12 } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 12, color: "#888", marginBottom: 4 } }, "\u5206\u8FA8\u7387"), /* @__PURE__ */ import_react5.default.createElement("select", { value: exportResolution, onChange: (e) => setExportResolution(e.target.value), style: exportSelect }, /* @__PURE__ */ import_react5.default.createElement("option", { value: "480p" }, "480p (\u6807\u6E05)"), /* @__PURE__ */ import_react5.default.createElement("option", { value: "720p" }, "720p (\u9AD8\u6E05)"), /* @__PURE__ */ import_react5.default.createElement("option", { value: "1080p" }, "1080p (\u5168\u9AD8\u6E05)"), /* @__PURE__ */ import_react5.default.createElement("option", { value: "2k" }, "2K (\u8D85\u9AD8\u6E05)"), /* @__PURE__ */ import_react5.default.createElement("option", { value: "4k" }, "4K (\u8D85\u6E05)"))), /* @__PURE__ */ import_react5.default.createElement("div", { style: { marginBottom: 12 } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 12, color: "#888", marginBottom: 4 } }, "\u5E27\u7387"), /* @__PURE__ */ import_react5.default.createElement("select", { value: exportFps, onChange: (e) => setExportFps(parseInt(e.target.value)), style: exportSelect }, /* @__PURE__ */ import_react5.default.createElement("option", { value: 24 }, "24 fps (\u7535\u5F71)"), /* @__PURE__ */ import_react5.default.createElement("option", { value: 25 }, "25 fps (PAL)"), /* @__PURE__ */ import_react5.default.createElement("option", { value: 30 }, "30 fps (\u6807\u51C6)"), /* @__PURE__ */ import_react5.default.createElement("option", { value: 60 }, "60 fps (\u6D41\u7545)"))), /* @__PURE__ */ import_react5.default.createElement("div", { style: { marginBottom: 16 } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 12, color: "#888", marginBottom: 4 } }, "\u7801\u7387"), /* @__PURE__ */ import_react5.default.createElement("select", { value: exportBitrate, onChange: (e) => setExportBitrate(e.target.value), style: exportSelect }, /* @__PURE__ */ import_react5.default.createElement("option", { value: "4M" }, "4 Mbps (\u4F4E\u8D28\u91CF)"), /* @__PURE__ */ import_react5.default.createElement("option", { value: "8M" }, "8 Mbps (\u6807\u51C6)"), /* @__PURE__ */ import_react5.default.createElement("option", { value: "12M" }, "12 Mbps (\u9AD8\u8D28\u91CF)"), /* @__PURE__ */ import_react5.default.createElement("option", { value: "20M" }, "20 Mbps (\u6781\u9AD8)"))), /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 11, color: "#666", marginBottom: 16, padding: "8px 10px", background: "#12121f", borderRadius: 6 } }, "\u753B\u5E03\u6BD4\u4F8B\uFF1A", ASPECT_RATIOS.find((r) => r.id === aspectRatio)?.label, /* @__PURE__ */ import_react5.default.createElement("br", null), "\u7247\u6BB5\u6570\uFF1A", timelineClips.length, " \xB7 \u603B\u65F6\u957F\uFF1A", formatTime(totalDuration)), /* @__PURE__ */ import_react5.default.createElement("button", { onClick: exportVideo, disabled: busy === "video", style: { width: "100%", padding: "12px 0", border: "none", borderRadius: 8, background: busy === "video" ? "#555" : "linear-gradient(135deg, #7a5cff, #5ce1e6)", color: "#fff", cursor: busy === "video" ? "wait" : "pointer", fontSize: 14, fontWeight: 600 } }, busy === "video" ? "\u5408\u6210\u4E2D..." : "\u{1F3AC} \u5F00\u59CB\u5BFC\u51FA"))));
  }
  var iconBtn = { width: 28, height: 28, border: "1px solid #2a2a4a", borderRadius: 4, background: "#1e1e35", color: "#aaa", cursor: "grab", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" };
  var playBtn = { width: 30, height: 30, borderRadius: "50%", border: "1px solid #2a2a4a", background: "#1e1e35", color: "#aaa", cursor: "grab", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" };
  var selectStyle = { padding: "4px 8px", border: "1px solid #2a2a4a", borderRadius: 4, background: "#1e1e35", color: "#aaa", cursor: "grab", fontSize: 11 };
  var exportSelect = { width: "100%", padding: "8px 10px", border: "1px solid #2a2a4a", borderRadius: 6, background: "#12121f", color: "#fff", fontSize: 13 };

  // src/components/Director3D/index.tsx
  var import_react8 = __require("react");

  // src/components/Director3D/DirectorCanvas.tsx
  var import_react6 = __require("react");
  var import_fiber = __require("@react-three/fiber");
  var import_drei = __require("@react-three/drei");
  var THREE = __toESM(__require("three"), 1);

  // src/components/Director3D/store.ts
  var import_zustand = __require("zustand");

  // src/components/Director3D/types.ts
  var CHARACTER_TEMPLATES = [
    { value: "male_standard", label: "\u6807\u51C6\u7537\u6027", gender: "male", desc: "\u666E\u901A\u6210\u5E74\u7537\u6027\u4F53\u578B" },
    { value: "female_standard", label: "\u6807\u51C6\u5973\u6027", gender: "female", desc: "\u666E\u901A\u6210\u5E74\u5973\u6027\u4F53\u578B" },
    { value: "male_athletic", label: "\u5065\u58EE\u7537\u6027", gender: "male", desc: "\u808C\u8089\u53D1\u8FBE\u7684\u7537\u6027" },
    { value: "female_elegant", label: "\u4F18\u96C5\u5973\u6027", gender: "female", desc: "\u7EA4\u7EC6\u4F18\u96C5\u7684\u5973\u6027" },
    { value: "child", label: "\u513F\u7AE5", gender: "male", desc: "\u513F\u7AE5\u4F53\u578B" }
  ];
  var DEFAULT_SCENE = {
    background: "#1a1a2e",
    groundColor: "#16213e",
    fogEnabled: true,
    fogColor: "#1a1a2e",
    fogDensity: 0.02,
    ambientLightIntensity: 0.6,
    directionalLightIntensity: 1.2,
    directionalLightPosition: { x: 5, y: 10, z: 5 }
  };
  var ASPECT_RATIOS2 = [
    { label: "\u6A2A\u5C4F 16:9", value: "16:9", width: 1920, height: 1080 },
    { label: "\u7AD6\u5C4F 9:16", value: "9:16", width: 1080, height: 1920 },
    { label: "\u65B9\u5F62 1:1", value: "1:1", width: 1080, height: 1080 },
    { label: "\u7535\u5F71 2.35:1", value: "2.35:1", width: 1920, height: 817 }
  ];
  var CAMERA_MOVEMENTS = [
    { label: "\u56FA\u5B9A", value: "static" },
    { label: "\u63A8\u955C", value: "push" },
    { label: "\u62C9\u955C", value: "pull" },
    { label: "\u6447\u955C", value: "pan" },
    { label: "\u4FEF\u4EF0", value: "tilt" },
    { label: "\u8DDF\u62CD", value: "track" },
    { label: "\u73AF\u7ED5", value: "orbit" }
  ];
  var SCENE_TEMPLATES = [
    { value: "empty", label: "\u7A7A\u573A\u666F", desc: "\u7EAF\u8272\u80CC\u666F\uFF0C\u81EA\u7531\u642D\u5EFA", background: "#1a1a2e", groundColor: "#16213e", ambientLight: 0.6, directionalLight: 1.2, fogEnabled: true, fogColor: "#1a1a2e", fogDensity: 0.02 },
    { value: "bedroom", label: "\u5367\u5BA4", desc: "\u6E29\u99A8\u7684\u5367\u5BA4\u573A\u666F", background: "#2d2a3e", groundColor: "#8b7355", wallColor: "#d4c5a9", ambientLight: 0.7, directionalLight: 0.8, fogEnabled: false, fogColor: "#2d2a3e", fogDensity: 0 },
    { value: "livingroom", label: "\u5BA2\u5385", desc: "\u73B0\u4EE3\u5BA2\u5385\u573A\u666F", background: "#2a2d3e", groundColor: "#a0826d", wallColor: "#e8ddd0", ambientLight: 0.75, directionalLight: 0.9, fogEnabled: false, fogColor: "#2a2d3e", fogDensity: 0 },
    { value: "office", label: "\u529E\u516C\u5BA4", desc: "\u73B0\u4EE3\u529E\u516C\u573A\u666F", background: "#252838", groundColor: "#6b7280", wallColor: "#d1d5db", ambientLight: 0.8, directionalLight: 1, fogEnabled: false, fogColor: "#252838", fogDensity: 0 },
    { value: "street", label: "\u8857\u9053", desc: "\u57CE\u5E02\u8857\u9053\u573A\u666F", background: "#1e2433", groundColor: "#374151", wallColor: "#4b5563", ambientLight: 0.5, directionalLight: 0.7, fogEnabled: true, fogColor: "#1e2433", fogDensity: 0.03 },
    { value: "palace", label: "\u5BAB\u6BBF", desc: "\u53E4\u4EE3\u5BAB\u6BBF\u573A\u666F", background: "#2a1f1a", groundColor: "#8b4513", wallColor: "#daa520", ambientLight: 0.65, directionalLight: 1.1, fogEnabled: true, fogColor: "#2a1f1a", fogDensity: 0.015 },
    { value: "forest", label: "\u68EE\u6797", desc: "\u6237\u5916\u68EE\u6797\u573A\u666F", background: "#1a2e1a", groundColor: "#2d5016", wallColor: "#3d6b22", ambientLight: 0.4, directionalLight: 0.6, fogEnabled: true, fogColor: "#1a2e1a", fogDensity: 0.04 },
    { value: "bar", label: "\u9152\u5427", desc: "\u591C\u5E97\u9152\u5427\u573A\u666F", background: "#1a0a1a", groundColor: "#2d1b2e", wallColor: "#4a1942", ambientLight: 0.3, directionalLight: 0.5, fogEnabled: true, fogColor: "#1a0a1a", fogDensity: 0.05 },
    { value: "hospital", label: "\u533B\u9662", desc: "\u533B\u9662\u75C5\u623F\u573A\u666F", background: "#e8f0f5", groundColor: "#d1d5db", wallColor: "#ffffff", ambientLight: 0.9, directionalLight: 1, fogEnabled: false, fogColor: "#e8f0f5", fogDensity: 0 }
  ];

  // src/components/Director3D/store.ts
  var genId = () => Math.random().toString(36).substring(2, 10);
  var useDirectorStore = (0, import_zustand.create)((set, get) => ({
    characters: [
      {
        id: "char-1",
        name: "\u4E3B\u89D2",
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: 1,
        color: "#4facfe",
        template: "male_standard",
        gender: "male",
        outfit: "#3b82f6",
        hairColor: "#2d1810"
      },
      {
        id: "char-2",
        name: "\u53CD\u6D3E",
        position: { x: 3, y: 0, z: 0 },
        rotation: { x: 0, y: Math.PI, z: 0 },
        scale: 1,
        color: "#f5576c",
        template: "female_elegant",
        gender: "female",
        outfit: "#ef4444",
        hairColor: "#1a1a1a"
      }
    ],
    props: [],
    cameras: [],
    activeCameraId: null,
    selectedCharacterId: null,
    selectedPropId: null,
    scene: DEFAULT_SCENE,
    showGrid: true,
    showGizmos: true,
    addCharacter: (name, template = "male_standard") => {
      const id = genId();
      const count = get().characters.length;
      const gender = template.includes("female") ? "female" : "male";
      const templateConfig = {
        male_standard: { scale: 1, color: "#4a90d9", outfit: "#2c3e50", hairColor: "#2d1810", bodyType: "standard" },
        female_standard: { scale: 0.92, color: "#e8a0bf", outfit: "#c0392b", hairColor: "#4a2c1a", bodyType: "standard" },
        male_athletic: { scale: 1.1, color: "#d4a574", outfit: "#1a1a2e", hairColor: "#1a1a1a", bodyType: "athletic" },
        female_elegant: { scale: 0.88, color: "#f5c6d6", outfit: "#8e44ad", hairColor: "#1a1a1a", bodyType: "elegant" },
        child: { scale: 0.65, color: "#ffd93d", outfit: "#6bcb77", hairColor: "#4a2c1a", bodyType: "child" }
      };
      const config = templateConfig[template] || templateConfig.male_standard;
      set((s2) => ({
        characters: [
          ...s2.characters,
          {
            id,
            name: name || `\u89D2\u8272${count + 1}`,
            position: { x: count * 2, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: config.scale,
            color: config.color,
            template,
            gender,
            outfit: config.outfit,
            hairColor: config.hairColor,
            bodyType: config.bodyType
          }
        ]
      }));
    },
    updateCharacter: (id, updates) => set((s2) => ({
      characters: s2.characters.map(
        (c) => c.id === id ? { ...c, ...updates } : c
      )
    })),
    removeCharacter: (id) => set((s2) => ({
      characters: s2.characters.filter((c) => c.id !== id),
      selectedCharacterId: s2.selectedCharacterId === id ? null : s2.selectedCharacterId
    })),
    selectCharacter: (id) => set({ selectedCharacterId: id, selectedPropId: null }),
    addProp: (type) => {
      const id = genId();
      const count = get().props.length;
      const colors = {
        box: "#a8edea",
        sphere: "#fed6e3",
        cylinder: "#d299c2",
        plane: "#fef9d7"
      };
      set((s2) => ({
        props: [
          ...s2.props,
          {
            id,
            name: `\u9053\u5177${count + 1}`,
            type,
            position: { x: -2 + count * 1.5, y: type === "plane" ? 0 : 0.5, z: 2 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            color: colors[type] || "#ccc"
          }
        ]
      }));
    },
    updateProp: (id, updates) => set((s2) => ({
      props: s2.props.map((p) => p.id === id ? { ...p, ...updates } : p)
    })),
    removeProp: (id) => set((s2) => ({
      props: s2.props.filter((p) => p.id !== id),
      selectedPropId: s2.selectedPropId === id ? null : s2.selectedPropId
    })),
    selectProp: (id) => set({ selectedPropId: id, selectedCharacterId: null }),
    addCamera: (position, target) => {
      const id = genId();
      const count = get().cameras.length;
      set((s2) => ({
        cameras: [
          ...s2.cameras,
          {
            id,
            name: `\u955C\u5934${count + 1}`,
            position: { ...position },
            target: { ...target },
            fov: 50,
            aspect: "16:9",
            movement: "static",
            movementSpeed: 1
          }
        ],
        activeCameraId: id
      }));
    },
    updateCamera: (id, updates) => set((s2) => ({
      cameras: s2.cameras.map(
        (c) => c.id === id ? { ...c, ...updates } : c
      )
    })),
    removeCamera: (id) => set((s2) => ({
      cameras: s2.cameras.filter((c) => c.id !== id),
      activeCameraId: s2.activeCameraId === id ? null : s2.activeCameraId
    })),
    setActiveCamera: (id) => set({ activeCameraId: id }),
    updateScene: (updates) => set((s2) => ({ scene: { ...s2.scene, ...updates } })),
    applySceneTemplate: (template) => {
      const tpl = SCENE_TEMPLATES.find((t2) => t2.value === template);
      if (!tpl) return;
      const sceneProps = {
        bedroom: [
          { type: "box", name: "\u5E8A", position: { x: 0, y: 0.3, z: 0 }, scale: { x: 2, y: 0.6, z: 3 }, color: "#8b4513" },
          { type: "box", name: "\u5E8A\u5934\u67DC", position: { x: -1.5, y: 0.25, z: -1 }, scale: { x: 0.5, y: 0.5, z: 0.5 }, color: "#654321" },
          { type: "box", name: "\u8863\u67DC", position: { x: 2, y: 1, z: -2 }, scale: { x: 1.5, y: 2, z: 0.6 }, color: "#5d4037" },
          { type: "cylinder", name: "\u53F0\u706F", position: { x: -1.5, y: 0.6, z: -1 }, scale: { x: 0.15, y: 0.4, z: 0.15 }, color: "#ffd700" }
        ],
        livingroom: [
          { type: "box", name: "\u6C99\u53D1", position: { x: 0, y: 0.4, z: 0 }, scale: { x: 3, y: 0.8, z: 1 }, color: "#4a5568" },
          { type: "box", name: "\u8336\u51E0", position: { x: 0, y: 0.2, z: 1.5 }, scale: { x: 1.2, y: 0.4, z: 0.6 }, color: "#8b4513" },
          { type: "box", name: "\u7535\u89C6\u67DC", position: { x: 0, y: 0.3, z: -2.5 }, scale: { x: 2, y: 0.6, z: 0.4 }, color: "#2d3748" },
          { type: "box", name: "\u7535\u89C6", position: { x: 0, y: 1, z: -2.7 }, scale: { x: 1.5, y: 0.9, z: 0.1 }, color: "#1a1a1a" }
        ],
        office: [
          { type: "box", name: "\u529E\u516C\u684C", position: { x: 0, y: 0.4, z: 0 }, scale: { x: 1.6, y: 0.8, z: 0.8 }, color: "#5d4037" },
          { type: "box", name: "\u529E\u516C\u6905", position: { x: 0, y: 0.5, z: 1.2 }, scale: { x: 0.6, y: 1, z: 0.6 }, color: "#2d3748" },
          { type: "box", name: "\u6587\u4EF6\u67DC", position: { x: -2, y: 0.9, z: -1 }, scale: { x: 0.8, y: 1.8, z: 0.4 }, color: "#718096" },
          { type: "cylinder", name: "\u7535\u8111\u663E\u793A\u5668", position: { x: 0, y: 1, z: -0.3 }, scale: { x: 0.4, y: 0.6, z: 0.05 }, color: "#1a1a1a" }
        ],
        street: [
          { type: "box", name: "\u5EFA\u7B511", position: { x: -4, y: 3, z: 0 }, scale: { x: 2, y: 6, z: 3 }, color: "#4a5568" },
          { type: "box", name: "\u5EFA\u7B512", position: { x: 4, y: 4, z: -2 }, scale: { x: 2.5, y: 8, z: 3 }, color: "#2d3748" },
          { type: "cylinder", name: "\u8DEF\u706F", position: { x: -2, y: 1.5, z: 2 }, scale: { x: 0.1, y: 3, z: 0.1 }, color: "#4a5568" },
          { type: "sphere", name: "\u8DEF\u706F\u706F\u6CE1", position: { x: -2, y: 3.2, z: 2 }, scale: { x: 0.2, y: 0.2, z: 0.2 }, color: "#ffd700" }
        ],
        palace: [
          { type: "box", name: "\u9F99\u6905", position: { x: 0, y: 0.8, z: -2 }, scale: { x: 1.5, y: 1.6, z: 0.8 }, color: "#daa520" },
          { type: "cylinder", name: "\u67F1\u5B501", position: { x: -3, y: 2, z: -1 }, scale: { x: 0.3, y: 4, z: 0.3 }, color: "#8b0000" },
          { type: "cylinder", name: "\u67F1\u5B502", position: { x: 3, y: 2, z: -1 }, scale: { x: 0.3, y: 4, z: 0.3 }, color: "#8b0000" },
          { type: "box", name: "\u53F0\u9636", position: { x: 0, y: 0.15, z: -1 }, scale: { x: 4, y: 0.3, z: 1.5 }, color: "#8b4513" }
        ],
        forest: [
          { type: "cylinder", name: "\u6811\u5E721", position: { x: -2, y: 1, z: 0 }, scale: { x: 0.3, y: 2, z: 0.3 }, color: "#5d4037" },
          { type: "sphere", name: "\u6811\u51A01", position: { x: -2, y: 2.5, z: 0 }, scale: { x: 1.2, y: 1.2, z: 1.2 }, color: "#228b22" },
          { type: "cylinder", name: "\u6811\u5E722", position: { x: 2, y: 1.2, z: -1 }, scale: { x: 0.4, y: 2.4, z: 0.4 }, color: "#5d4037" },
          { type: "sphere", name: "\u6811\u51A02", position: { x: 2, y: 3, z: -1 }, scale: { x: 1.5, y: 1.5, z: 1.5 }, color: "#2e8b57" },
          { type: "cylinder", name: "\u6811\u5E723", position: { x: 0, y: 0.8, z: 2 }, scale: { x: 0.25, y: 1.6, z: 0.25 }, color: "#5d4037" },
          { type: "sphere", name: "\u6811\u51A03", position: { x: 0, y: 2, z: 2 }, scale: { x: 1, y: 1, z: 1 }, color: "#3cb371" }
        ],
        bar: [
          { type: "box", name: "\u5427\u53F0", position: { x: 0, y: 0.6, z: -1 }, scale: { x: 4, y: 1.2, z: 0.6 }, color: "#2d1b2e" },
          { type: "cylinder", name: "\u5427\u69051", position: { x: -1, y: 0.5, z: 0.5 }, scale: { x: 0.3, y: 1, z: 0.3 }, color: "#4a1942" },
          { type: "cylinder", name: "\u5427\u69052", position: { x: 1, y: 0.5, z: 0.5 }, scale: { x: 0.3, y: 1, z: 0.3 }, color: "#4a1942" },
          { type: "sphere", name: "\u9713\u8679\u706F1", position: { x: -2, y: 2, z: -2 }, scale: { x: 0.3, y: 0.3, z: 0.3 }, color: "#ff00ff" },
          { type: "sphere", name: "\u9713\u8679\u706F2", position: { x: 2, y: 2, z: -2 }, scale: { x: 0.3, y: 0.3, z: 0.3 }, color: "#00ffff" }
        ],
        hospital: [
          { type: "box", name: "\u75C5\u5E8A", position: { x: 0, y: 0.4, z: 0 }, scale: { x: 1.2, y: 0.8, z: 2.5 }, color: "#ffffff" },
          { type: "box", name: "\u5E8A\u5934\u67DC", position: { x: -1, y: 0.3, z: -0.5 }, scale: { x: 0.4, y: 0.6, z: 0.4 }, color: "#d1d5db" },
          { type: "cylinder", name: "\u8F93\u6DB2\u67B6", position: { x: 1, y: 1, z: 0 }, scale: { x: 0.05, y: 2, z: 0.05 }, color: "#9ca3af" },
          { type: "box", name: "\u8F93\u6DB2\u74F6", position: { x: 1, y: 2, z: 0 }, scale: { x: 0.15, y: 0.25, z: 0.15 }, color: "#e0f2fe" }
        ],
        empty: []
      };
      const propsToAdd = sceneProps[template] || [];
      const newProps = propsToAdd.map((p, i) => ({
        id: genId(),
        name: p.name,
        type: p.type,
        position: p.position,
        rotation: { x: 0, y: 0, z: 0 },
        scale: p.scale,
        color: p.color
      }));
      set((s2) => ({
        scene: {
          ...s2.scene,
          background: tpl.background,
          groundColor: tpl.groundColor,
          fogEnabled: tpl.fogEnabled,
          fogColor: tpl.fogColor,
          fogDensity: tpl.fogDensity,
          ambientLightIntensity: tpl.ambientLight,
          directionalLightIntensity: tpl.directionalLight
        },
        props: newProps
      }));
    },
    toggleGrid: () => set((s2) => ({ showGrid: !s2.showGrid })),
    toggleGizmos: () => set((s2) => ({ showGizmos: !s2.showGizmos })),
    exportScene: () => {
      const { characters, props, cameras, scene } = get();
      return {
        version: "1.0",
        exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
        characters,
        props,
        cameras,
        scene
      };
    },
    exportCameraReference: (cameraId) => {
      const camera = get().cameras.find((c) => c.id === cameraId);
      const { characters, props, scene } = get();
      if (!camera) return {};
      return {
        camera,
        characters: characters.map((c) => ({
          name: c.name,
          position: c.position,
          rotation: c.rotation,
          color: c.color
        })),
        props,
        scene: {
          background: scene.background,
          fog: scene.fogEnabled
        },
        prompt: `\u955C\u5934\uFF1A${camera.name}\uFF0C\u753B\u5E45\uFF1A${camera.aspect}\uFF0C\u8FD0\u955C\uFF1A${camera.movement}\u3002\u573A\u666F\u5305\u542B${characters.length}\u4E2A\u89D2\u8272\uFF1A${characters.map((c) => c.name).join("\u3001")}\u3002`
      };
    }
  }));

  // src/components/Director3D/DirectorCanvas.tsx
  function CharacterMesh({ character }) {
    const { selectedCharacterId, selectCharacter, updateCharacter } = useDirectorStore();
    const isSelected = selectedCharacterId === character.id;
    const groupRef = (0, import_react6.useRef)(null);
    (0, import_fiber.useFrame)(() => {
      if (groupRef.current) {
        groupRef.current.position.set(
          character.position.x,
          character.position.y,
          character.position.z
        );
        groupRef.current.rotation.set(
          character.rotation.x,
          character.rotation.y,
          character.rotation.z
        );
        groupRef.current.scale.setScalar(character.scale);
      }
    });
    return /* @__PURE__ */ React.createElement(
      "group",
      {
        ref: groupRef,
        onClick: (e) => {
          e.stopPropagation();
          selectCharacter(character.id);
        }
      },
      /* @__PURE__ */ React.createElement("mesh", { position: [0, 0.75, 0] }, /* @__PURE__ */ React.createElement("capsuleGeometry", { args: [0.3, 1, 8, 16] }), /* @__PURE__ */ React.createElement(
        "meshStandardMaterial",
        {
          color: character.color,
          emissive: isSelected ? character.color : "#000",
          emissiveIntensity: isSelected ? 0.3 : 0
        }
      )),
      /* @__PURE__ */ React.createElement("mesh", { position: [0, 1.6, 0] }, /* @__PURE__ */ React.createElement("sphereGeometry", { args: [0.25, 16, 16] }), /* @__PURE__ */ React.createElement("meshStandardMaterial", { color: character.color })),
      /* @__PURE__ */ React.createElement("mesh", { position: [0, 1, 0.4], rotation: [Math.PI / 2, 0, 0] }, /* @__PURE__ */ React.createElement("coneGeometry", { args: [0.1, 0.3, 8] }), /* @__PURE__ */ React.createElement("meshStandardMaterial", { color: "#fff" })),
      /* @__PURE__ */ React.createElement(import_drei.Html, { position: [0, 2.2, 0], center: true, distanceFactor: 8 }, /* @__PURE__ */ React.createElement(
        "div",
        {
          style: {
            color: "#fff",
            fontSize: "12px",
            background: isSelected ? "rgba(79,172,254,0.9)" : "rgba(0,0,0,0.6)",
            padding: "2px 8px",
            borderRadius: "4px",
            whiteSpace: "nowrap",
            pointerEvents: "none"
          }
        },
        character.name
      )),
      isSelected && /* @__PURE__ */ React.createElement("mesh", { rotation: [-Math.PI / 2, 0, 0], position: [0, 0.01, 0] }, /* @__PURE__ */ React.createElement("ringGeometry", { args: [0.5, 0.6, 32] }), /* @__PURE__ */ React.createElement("meshBasicMaterial", { color: "#4facfe", side: THREE.DoubleSide }))
    );
  }
  function PropMesh({ prop }) {
    const { selectedPropId, selectProp } = useDirectorStore();
    const isSelected = selectedPropId === prop.id;
    const meshRef = (0, import_react6.useRef)(null);
    (0, import_fiber.useFrame)(() => {
      if (meshRef.current) {
        meshRef.current.position.set(
          prop.position.x,
          prop.position.y,
          prop.position.z
        );
        meshRef.current.rotation.set(
          prop.rotation.x,
          prop.rotation.y,
          prop.rotation.z
        );
        meshRef.current.scale.set(prop.scale.x, prop.scale.y, prop.scale.z);
      }
    });
    const renderGeometry = () => {
      switch (prop.type) {
        case "box":
          return /* @__PURE__ */ React.createElement("boxGeometry", { args: [1, 1, 1] });
        case "sphere":
          return /* @__PURE__ */ React.createElement("sphereGeometry", { args: [0.5, 16, 16] });
        case "cylinder":
          return /* @__PURE__ */ React.createElement("cylinderGeometry", { args: [0.5, 0.5, 1, 16] });
        case "plane":
          return /* @__PURE__ */ React.createElement("planeGeometry", { args: [2, 2] });
        default:
          return /* @__PURE__ */ React.createElement("boxGeometry", { args: [1, 1, 1] });
      }
    };
    return /* @__PURE__ */ React.createElement(
      "mesh",
      {
        ref: meshRef,
        onClick: (e) => {
          e.stopPropagation();
          selectProp(prop.id);
        }
      },
      renderGeometry(),
      /* @__PURE__ */ React.createElement(
        "meshStandardMaterial",
        {
          color: prop.color,
          emissive: isSelected ? prop.color : "#000",
          emissiveIntensity: isSelected ? 0.4 : 0,
          side: THREE.DoubleSide
        }
      )
    );
  }
  function CameraPreview({ camera }) {
    const { activeCameraId, setActiveCamera } = useDirectorStore();
    const isActive = activeCameraId === camera.id;
    const groupRef = (0, import_react6.useRef)(null);
    (0, import_fiber.useFrame)(() => {
      if (groupRef.current) {
        groupRef.current.position.set(
          camera.position.x,
          camera.position.y,
          camera.position.z
        );
        groupRef.current.lookAt(
          camera.target.x,
          camera.target.y,
          camera.target.z
        );
      }
    });
    return /* @__PURE__ */ React.createElement(
      "group",
      {
        ref: groupRef,
        onClick: (e) => {
          e.stopPropagation();
          setActiveCamera(camera.id);
        }
      },
      /* @__PURE__ */ React.createElement("mesh", null, /* @__PURE__ */ React.createElement("coneGeometry", { args: [0.15, 0.4, 8] }), /* @__PURE__ */ React.createElement(
        "meshStandardMaterial",
        {
          color: isActive ? "#ffd700" : "#888",
          emissive: isActive ? "#ffd700" : "#000",
          emissiveIntensity: isActive ? 0.5 : 0
        }
      )),
      /* @__PURE__ */ React.createElement("line", null, /* @__PURE__ */ React.createElement("bufferGeometry", null, /* @__PURE__ */ React.createElement(
        "bufferAttribute",
        {
          attach: "attributes-position",
          count: 2,
          array: new Float32Array([
            0,
            0,
            0,
            camera.target.x - camera.position.x,
            camera.target.y - camera.position.y,
            camera.target.z - camera.position.z
          ]),
          itemSize: 3
        }
      )), /* @__PURE__ */ React.createElement("lineBasicMaterial", { color: isActive ? "#ffd700" : "#666" })),
      /* @__PURE__ */ React.createElement(import_drei.Html, { position: [0, 0.5, 0], center: true, distanceFactor: 8 }, /* @__PURE__ */ React.createElement(
        "div",
        {
          style: {
            color: "#fff",
            fontSize: "10px",
            background: isActive ? "rgba(255,215,0,0.9)" : "rgba(0,0,0,0.6)",
            padding: "1px 6px",
            borderRadius: "3px",
            whiteSpace: "nowrap",
            pointerEvents: "none"
          }
        },
        "\u{1F4F7} ",
        camera.name
      ))
    );
  }
  function SceneContent() {
    const {
      characters,
      props,
      cameras,
      scene,
      showGrid,
      selectedCharacterId,
      selectedPropId,
      selectCharacter,
      selectProp
    } = useDirectorStore();
    const { scene: threeScene } = (0, import_fiber.useThree)();
    (0, import_react6.useEffect)(() => {
      threeScene.background = new THREE.Color(scene.background);
      if (scene.fogEnabled) {
        threeScene.fog = new THREE.FogExp2(scene.fogColor, scene.fogDensity);
      } else {
        threeScene.fog = null;
      }
    }, [scene, threeScene]);
    const EnvironmentModel = () => {
      if (!scene.environmentModelUrl || !scene.showEnvironmentModel) return null;
      return /* @__PURE__ */ React.createElement(CustomModel, { url: scene.environmentModelUrl, scale: 1 });
    };
    return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(EnvironmentModel, null), /* @__PURE__ */ React.createElement("ambientLight", { intensity: scene.ambientLightIntensity }), /* @__PURE__ */ React.createElement(
      "directionalLight",
      {
        position: [
          scene.directionalLightPosition.x,
          scene.directionalLightPosition.y,
          scene.directionalLightPosition.z
        ],
        intensity: scene.directionalLightIntensity,
        castShadow: true
      }
    ), /* @__PURE__ */ React.createElement("mesh", { rotation: [-Math.PI / 2, 0, 0], position: [0, 0, 0], receiveShadow: true }, /* @__PURE__ */ React.createElement("planeGeometry", { args: [50, 50] }), /* @__PURE__ */ React.createElement("meshStandardMaterial", { color: scene.groundColor })), showGrid && /* @__PURE__ */ React.createElement(
      import_drei.Grid,
      {
        args: [50, 50],
        cellSize: 1,
        cellThickness: 0.5,
        cellColor: "#2a2a4a",
        sectionSize: 5,
        sectionThickness: 1,
        sectionColor: "#4a4a6a",
        fadeDistance: 30,
        fadeStrength: 1,
        followCamera: false,
        infiniteGrid: true
      }
    ), characters.map((c) => /* @__PURE__ */ React.createElement(CharacterMesh, { key: c.id, character: c })), props.map((p) => /* @__PURE__ */ React.createElement(PropMesh, { key: p.id, prop: p })), cameras.map((cam) => /* @__PURE__ */ React.createElement(CameraPreview, { key: cam.id, camera: cam })), /* @__PURE__ */ React.createElement(
      "mesh",
      {
        position: [0, -0.01, 0],
        rotation: [-Math.PI / 2, 0, 0],
        onClick: () => {
          selectCharacter(null);
          selectProp(null);
        }
      },
      /* @__PURE__ */ React.createElement("planeGeometry", { args: [100, 100] }),
      /* @__PURE__ */ React.createElement("meshBasicMaterial", { transparent: true, opacity: 0 })
    ), /* @__PURE__ */ React.createElement(import_drei.GizmoHelper, { alignment: "bottom-right", margin: [80, 80] }, /* @__PURE__ */ React.createElement(import_drei.GizmoViewport, { axisColors: ["#ff6b6b", "#51cf66", "#339af0"], labelColor: "white" })), /* @__PURE__ */ React.createElement(
      import_drei.OrbitControls,
      {
        makeDefault: true,
        enableDamping: true,
        dampingFactor: 0.05,
        minDistance: 2,
        maxDistance: 30,
        maxPolarAngle: Math.PI / 2 - 0.05
      }
    ));
  }
  function DirectorCanvas({ canvasRef }) {
    return /* @__PURE__ */ React.createElement(
      import_fiber.Canvas,
      {
        shadows: true,
        camera: { position: [8, 6, 8], fov: 50 },
        style: { width: "100%", height: "100%" },
        gl: { antialias: true, preserveDrawingBuffer: true },
        ref: canvasRef
      },
      /* @__PURE__ */ React.createElement(SceneContent, null)
    );
  }

  // src/components/Director3D/DirectorPanel.tsx
  var import_react7 = __require("react");
  var import_lucide_react = __require("lucide-react");
  function PanelHeader({
    icon: Icon,
    title: title2,
    count,
    children
  }) {
    const [open, setOpen] = (0, import_react7.useState)(true);
    return /* @__PURE__ */ React.createElement("div", { style: { borderBottom: "1px solid #2a2a3a", marginBottom: "8px" } }, /* @__PURE__ */ React.createElement(
      "div",
      {
        onClick: () => setOpen(!open),
        style: {
          display: "flex",
          alignItems: "center",
          padding: "10px 12px",
          cursor: "pointer",
          background: "#1a1a2e"
        }
      },
      open ? /* @__PURE__ */ React.createElement(import_lucide_react.ChevronDown, { size: 14, style: { marginRight: 6 } }) : /* @__PURE__ */ React.createElement(import_lucide_react.ChevronRight, { size: 14, style: { marginRight: 6 } }),
      /* @__PURE__ */ React.createElement(Icon, { size: 14, style: { marginRight: 6, color: "#4facfe" } }),
      /* @__PURE__ */ React.createElement("span", { style: { fontSize: "13px", fontWeight: 600, flex: 1 } }, title2),
      count !== void 0 && /* @__PURE__ */ React.createElement(
        "span",
        {
          style: {
            fontSize: "11px",
            background: "#2a2a4a",
            padding: "1px 6px",
            borderRadius: "8px"
          }
        },
        count
      )
    ), open && /* @__PURE__ */ React.createElement("div", { style: { padding: "8px 12px" } }, children));
  }
  function Vector3Input({
    label: label2,
    value,
    onChange
  }) {
    return /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "6px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "11px", color: "#888", marginBottom: "2px" } }, label2), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "4px" } }, ["x", "y", "z"].map((axis) => /* @__PURE__ */ React.createElement("div", { key: axis, style: { flex: 1 } }, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        step: 0.1,
        value: value[axis],
        onChange: (e) => onChange({ ...value, [axis]: parseFloat(e.target.value) || 0 }),
        style: {
          width: "100%",
          background: "#0f0f1a",
          border: "1px solid #2a2a3a",
          borderRadius: "4px",
          padding: "3px 4px",
          color: "#fff",
          fontSize: "11px"
        }
      }
    )))));
  }
  function DirectorPanel({ project: project2, update, log }) {
    const [sceneList, setSceneList] = (0, import_react7.useState)([]);
    const [extractingScenes, setExtractingScenes] = (0, import_react7.useState)(false);
    const [generatingSceneImg, setGeneratingSceneImg] = (0, import_react7.useState)(false);
    const [generatingScene3D, setGeneratingScene3D] = (0, import_react7.useState)(false);
    const [selectedSceneTemplate, setSelectedSceneTemplate] = (0, import_react7.useState)("empty");
    const [showImportCharModal, setShowImportCharModal] = (0, import_react7.useState)(false);
    const {
      characters,
      props,
      cameras,
      activeCameraId,
      selectedCharacterId,
      selectedPropId,
      scene,
      showGrid,
      addCharacter,
      updateCharacter,
      removeCharacter,
      selectCharacter,
      addProp,
      updateProp,
      removeProp,
      selectProp,
      addCamera,
      updateCamera,
      removeCamera,
      setActiveCamera,
      updateScene,
      applySceneTemplate,
      toggleGrid,
      exportScene,
      exportCameraReference
    } = useDirectorStore();
    const selectedChar = characters.find((c) => c.id === selectedCharacterId);
    const selectedPropItem = props.find((p) => p.id === selectedPropId);
    const activeCamera = cameras.find((c) => c.id === activeCameraId);
    const handleAddCameraFromView = () => {
      addCamera(
        { x: 8, y: 6, z: 8 },
        { x: 0, y: 1, z: 0 }
      );
    };
    return /* @__PURE__ */ React.createElement(
      "div",
      {
        style: {
          width: "280px",
          height: "100%",
          background: "#12121f",
          borderRight: "1px solid #2a2a3a",
          overflowY: "auto",
          color: "#fff"
        }
      },
      /* @__PURE__ */ React.createElement(
        "div",
        {
          style: {
            padding: "12px",
            background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
            fontWeight: 700,
            fontSize: "14px"
          }
        },
        "\u{1F3AC} 3D \u5BFC\u6F14\u53F0"
      ),
      /* @__PURE__ */ React.createElement(PanelHeader, { icon: import_lucide_react.User, title: "\u89D2\u8272", count: characters.length }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "4px", marginBottom: "8px" } }, /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: () => addCharacter(),
          style: {
            flex: 1,
            padding: "6px",
            background: "#2a2a4a",
            border: "none",
            borderRadius: "4px",
            color: "#fff",
            cursor: "pointer",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "4px"
          }
        },
        /* @__PURE__ */ React.createElement(import_lucide_react.Plus, { size: 12 }),
        " \u6DFB\u52A0"
      ), /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: () => {
            const projectChars = project2?.materials?.characters || project2?.characters || project2?.outline?.characters || [];
            if (projectChars.length === 0) {
              log?.("\u9879\u76EE\u4E2D\u6CA1\u6709\u89D2\u8272\uFF0C\u8BF7\u5148\u5728\u4EBA\u7269\u7BA1\u7406\u4E2D\u6DFB\u52A0\u89D2\u8272");
              alert("\u9879\u76EE\u4E2D\u6CA1\u6709\u89D2\u8272\uFF0C\u8BF7\u5148\u5728\u4EBA\u7269\u7BA1\u7406\u4E2D\u6DFB\u52A0\u89D2\u8272");
              return;
            }
            setShowImportCharModal(true);
          },
          style: {
            flex: 1,
            padding: "6px",
            background: "linear-gradient(135deg, #7A5CFF, #5CE1E6)",
            border: "none",
            borderRadius: "4px",
            color: "#fff",
            cursor: "pointer",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "4px"
          }
        },
        "\u{1F4E5} \u5BFC\u5165\u89D2\u8272"
      )), characters.map((c) => /* @__PURE__ */ React.createElement(
        "div",
        {
          key: c.id,
          onClick: () => selectCharacter(c.id),
          style: {
            padding: "6px 8px",
            background: selectedCharacterId === c.id ? "#2a3a5a" : "#1a1a2e",
            borderRadius: "4px",
            marginBottom: "4px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }
        },
        /* @__PURE__ */ React.createElement(
          "div",
          {
            style: {
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: c.color
            }
          }
        ),
        /* @__PURE__ */ React.createElement("span", { style: { fontSize: "12px", flex: 1 } }, c.name),
        /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: (e) => {
              e.stopPropagation();
              removeCharacter(c.id);
            },
            style: {
              background: "none",
              border: "none",
              color: "#f5576c",
              cursor: "pointer",
              padding: 0
            }
          },
          /* @__PURE__ */ React.createElement(import_lucide_react.Trash2, { size: 12 })
        )
      )), selectedChar && /* @__PURE__ */ React.createElement(
        "div",
        {
          style: {
            marginTop: "8px",
            padding: "8px",
            background: "#0f0f1a",
            borderRadius: "4px"
          }
        },
        /* @__PURE__ */ React.createElement("div", { style: { fontSize: "11px", color: "#4facfe", marginBottom: "6px" } }, "\u7F16\u8F91\uFF1A", selectedChar.name),
        /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "text",
            value: selectedChar.name,
            onChange: (e) => updateCharacter(selectedChar.id, { name: e.target.value }),
            style: {
              width: "100%",
              background: "#0f0f1a",
              border: "1px solid #2a2a3a",
              borderRadius: "4px",
              padding: "4px",
              color: "#fff",
              fontSize: "11px",
              marginBottom: "6px"
            }
          }
        ),
        /* @__PURE__ */ React.createElement(
          Vector3Input,
          {
            label: "\u4F4D\u7F6E",
            value: selectedChar.position,
            onChange: (v) => updateCharacter(selectedChar.id, { position: v })
          }
        ),
        /* @__PURE__ */ React.createElement(
          Vector3Input,
          {
            label: "\u65CB\u8F6C",
            value: selectedChar.rotation,
            onChange: (v) => updateCharacter(selectedChar.id, { rotation: v })
          }
        ),
        /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "6px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "11px", color: "#888", marginBottom: "2px" } }, "\u7F29\u653E: ", selectedChar.scale.toFixed(1)), /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "range",
            min: "0.5",
            max: "2",
            step: "0.1",
            value: selectedChar.scale,
            onChange: (e) => updateCharacter(selectedChar.id, {
              scale: parseFloat(e.target.value)
            }),
            style: { width: "100%" }
          }
        )),
        /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "6px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "11px", color: "#888", marginBottom: "2px" } }, "\u4EBA\u7269\u6A21\u677F"), /* @__PURE__ */ React.createElement(
          "select",
          {
            value: selectedChar.template || "male_standard",
            onChange: (e) => {
              const tpl = CHARACTER_TEMPLATES.find((t2) => t2.value === e.target.value);
              const templateConfig = {
                male_standard: { scale: 1, color: "#4a90d9", outfit: "#2c3e50", hairColor: "#2d1810" },
                female_standard: { scale: 0.92, color: "#e8a0bf", outfit: "#c0392b", hairColor: "#4a2c1a" },
                male_athletic: { scale: 1.1, color: "#d4a574", outfit: "#1a1a2e", hairColor: "#1a1a1a" },
                female_elegant: { scale: 0.88, color: "#f5c6d6", outfit: "#8e44ad", hairColor: "#1a1a1a" },
                child: { scale: 0.65, color: "#ffd93d", outfit: "#6bcb77", hairColor: "#4a2c1a" }
              };
              const config = templateConfig[e.target.value] || templateConfig.male_standard;
              updateCharacter(selectedChar.id, {
                template: e.target.value,
                gender: tpl?.gender || "male",
                scale: config.scale,
                color: config.color,
                outfit: config.outfit,
                hairColor: config.hairColor
              });
            },
            style: { width: "100%", background: "#0f0f1a", border: "1px solid #2a2a3a", borderRadius: "4px", padding: "4px", color: "#fff", fontSize: "11px" }
          },
          CHARACTER_TEMPLATES.map((t2) => /* @__PURE__ */ React.createElement("option", { key: t2.value, value: t2.value }, t2.label, " - ", t2.desc))
        )),
        /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "6px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "11px", color: "#888", marginBottom: "2px" } }, "\u670D\u88C5\u989C\u8272"), /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "color",
            value: selectedChar.outfit || selectedChar.color,
            onChange: (e) => updateCharacter(selectedChar.id, { outfit: e.target.value }),
            style: { width: "100%", height: "24px", border: "none", borderRadius: "4px" }
          }
        )),
        /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "6px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "11px", color: "#888", marginBottom: "2px" } }, "\u53D1\u8272"), /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "color",
            value: selectedChar.hairColor || "#2d1810",
            onChange: (e) => updateCharacter(selectedChar.id, { hairColor: e.target.value }),
            style: { width: "100%", height: "24px", border: "none", borderRadius: "4px" }
          }
        )),
        /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "6px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "11px", color: "#888", marginBottom: "2px" } }, "\u989C\u8272\uFF08\u5907\u7528\uFF09"), /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "color",
            value: selectedChar.color,
            onChange: (e) => updateCharacter(selectedChar.id, { color: e.target.value }),
            style: { width: "100%", height: "24px", border: "none", borderRadius: "4px" }
          }
        )),
        /* @__PURE__ */ React.createElement("div", { style: { marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #2a2a3a" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "11px", color: "#4facfe", marginBottom: "6px", fontWeight: 600 } }, "\u{1F3B2} 3D\u4EBA\u7269\u6A21\u578B"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "10px", color: "#666", marginBottom: "6px" } }, "\u5F53\u524D\uFF1A", selectedChar.modelType === "custom" ? "\u81EA\u5B9A\u4E49\u6A21\u578B" : "\u7A0B\u5E8F\u5316\u6A21\u578B"), /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "file",
            accept: ".glb,.gltf,.obj",
            style: { display: "none" },
            id: `char-model-${selectedChar.id}`,
            onChange: (e) => {
              const file = e.target.files?.[0];
              if (file) {
                const url = URL.createObjectURL(file);
                updateCharacter(selectedChar.id, { modelUrl: url, modelType: "custom" });
              }
            }
          }
        ), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "4px" } }, /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => document.getElementById(`char-model-${selectedChar.id}`)?.click(),
            style: { flex: 1, padding: "5px", background: "#2a4a6a", border: "none", borderRadius: "4px", color: "#fff", cursor: "pointer", fontSize: "11px" }
          },
          "\u{1F4C1} \u4E0A\u4F20\u6A21\u578B"
        ), selectedChar.modelType === "custom" && /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => updateCharacter(selectedChar.id, { modelUrl: void 0, modelType: "procedural" }),
            style: { padding: "5px 8px", background: "#4a2a2a", border: "none", borderRadius: "4px", color: "#f5576c", cursor: "pointer", fontSize: "11px" }
          },
          "\u6E05\u9664"
        )), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "9px", color: "#555", marginTop: "4px" } }, "\u652F\u6301 GLB / GLTF / OBJ \u683C\u5F0F")),
        /* @__PURE__ */ React.createElement("div", { style: { marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #2a2a3a" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "11px", color: "#4facfe", marginBottom: "6px", fontWeight: 600 } }, "\u{1F3A8} AI\u751F\u6210\u56DB\u89C6\u56FE + 3D\u6A21\u578B"), selectedChar.fourViews && /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", marginBottom: "8px" } }, ["front", "left", "back", "right"].map((view) => /* @__PURE__ */ React.createElement("div", { key: view, style: { position: "relative", aspectRatio: "1", background: "#0f0f1a", borderRadius: "4px", overflow: "hidden", border: "1px solid #2a2a3a" } }, selectedChar.fourViews?.[view] ? /* @__PURE__ */ React.createElement("img", { src: selectedChar.fourViews[view], alt: view, style: { width: "100%", height: "100%", objectFit: "cover" } }) : /* @__PURE__ */ React.createElement("div", { style: { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "#555" } }, view === "front" ? "\u6B63\u9762" : view === "left" ? "\u5DE6\u9762" : view === "back" ? "\u540E\u9762" : "\u53F3\u9762")))), selectedChar.imageUrl && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "8px", textAlign: "center" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "10px", color: "#888", marginBottom: "4px" } }, "\u89D2\u8272\u53C2\u8003\u56FE\uFF08\u4ECE\u4EBA\u7269\u7BA1\u7406\u5BFC\u5165\uFF09"), /* @__PURE__ */ React.createElement("img", { src: selectedChar.imageUrl, alt: "\u89D2\u8272\u53C2\u8003\u56FE", style: { width: "80px", height: "80px", objectFit: "cover", borderRadius: "4px", border: "1px solid #2a2a3a" } })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "4px" } }, /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: async () => {
              if (!selectedChar) return;
              if (!isLoggedIn()) {
                alert("\u8BF7\u5148\u767B\u5F55\u540E\u518D\u4F7F\u75283D\u56DB\u89C6\u56FE\u751F\u6210\u529F\u80FD");
                return;
              }
              try {
                const precheck2 = await precheckCredits(8, "image", "3D\u89D2\u8272\u56DB\u89C6\u56FE\u751F\u6210");
                if (!precheck2.sufficient && precheck2.sufficient !== void 0) {
                  log?.(`\u274C \u79EF\u5206\u4E0D\u8DB3\uFF1A\u9700\u89818\u79EF\u5206\uFF0C\u5F53\u524D\u4F59\u989D${precheck2.balance || 0}\u79EF\u5206`);
                  alert(`\u79EF\u5206\u4E0D\u8DB3\uFF013D\u89D2\u8272\u56DB\u89C6\u56FE\u751F\u6210\u9700\u89818\u79EF\u5206\uFF0C\u5F53\u524D\u4F59\u989D${precheck2.balance || 0}\u79EF\u5206\u3002\u8BF7\u5145\u503C\u540E\u518D\u8BD5\u3002`);
                  return;
                }
              } catch (e) {
                log?.(`\u79EF\u5206\u9884\u6821\u9A8C\u5931\u8D25: ${e.message}`);
              }
              try {
                const hasRefImage = !!selectedChar.imageUrl;
                log?.(`\u6B63\u5728\u4E3A\u300C${selectedChar.name}\u300D\u751F\u6210\u56DB\u89C6\u56FE${hasRefImage ? "\uFF08\u53C2\u8003\u89D2\u8272\u56FE\uFF09" : ""}...`);
                const baseUrl3 = (localStorage.getItem("DISPATCH_BASE_URL") || "https://api.jinsuai.cn").replace(/\/$/, "");
                const token2 = localStorage.getItem("DISPATCH_TOKEN") || "";
                const body = {
                  character_name: selectedChar.name,
                  outfit: selectedChar.outfit || "",
                  hair_color: selectedChar.hairColor || "",
                  style: "\u52A8\u6F2B"
                };
                if (selectedChar.imageUrl) {
                  body.reference_image = selectedChar.imageUrl;
                }
                const response = await fetch(`${baseUrl3}/api/threed/character/four-views`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "Authorization": token2 ? `Bearer ${token2}` : "" },
                  body: JSON.stringify(body)
                });
                if (!response.ok) {
                  const err = await response.json();
                  throw new Error(err.detail || `HTTP ${response.status}`);
                }
                const result = await response.json();
                updateCharacter(selectedChar.id, { fourViews: { front: result.front, left: result.left, back: result.back, right: result.right } });
                log?.(`\u300C${selectedChar.name}\u300D\u56DB\u89C6\u56FE\u751F\u6210\u5B8C\u6210${hasRefImage ? "\uFF08\u53C2\u8003\u89D2\u8272\u56FE\uFF09" : ""}`);
                if (isLoggedIn()) {
                  try {
                    await deductCredits(8, "image", "3D\u89D2\u8272\u56DB\u89C6\u56FE\u751F\u6210", selectedChar.id);
                    log?.(`\u2705 \u79EF\u5206\u6263\u51CF\u6210\u529F\uFF1A8\u79EF\u5206`);
                    try {
                      const balanceData = await getCreditBalance();
                      if (window.onCreditUpdate) window.onCreditUpdate(balanceData.balance || balanceData.credits || 0);
                    } catch (e) {
                    }
                  } catch (e) {
                    log?.(`\u79EF\u5206\u6263\u51CF\u5931\u8D25: ${e.message}`);
                  }
                }
              } catch (e) {
                log?.(`\u56DB\u89C6\u56FE\u751F\u6210\u5931\u8D25: ${e.message}`);
              }
            },
            style: { width: "100%", padding: "6px", background: selectedChar.imageUrl ? "linear-gradient(135deg, #10b981, #059669)" : "linear-gradient(135deg, #7A5CFF, #5CE1E6)", border: "none", borderRadius: "4px", color: "#fff", cursor: "pointer", fontSize: "11px" }
          },
          selectedChar.imageUrl ? "\u{1F3A8} \u53C2\u8003\u56FE\u751F\u6210\u56DB\u89C6\u56FE\uFF088\u79EF\u5206\uFF09" : "\u{1F3A8} \u751F\u6210\u89D2\u8272\u56DB\u89C6\u56FE\uFF088\u79EF\u5206\uFF09"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            disabled: !selectedChar.fourViews?.front,
            onClick: async () => {
              if (!selectedChar?.fourViews?.front) return;
              if (!isLoggedIn()) {
                alert("\u8BF7\u5148\u767B\u5F55\u540E\u518D\u4F7F\u75283D\u6A21\u578B\u751F\u6210\u529F\u80FD");
                return;
              }
              try {
                const precheck2 = await precheckCredits(30, "image", "3D\u89D2\u8272\u6A21\u578B\u751F\u6210");
                if (!precheck2.sufficient && precheck2.sufficient !== void 0) {
                  log?.(`\u274C \u79EF\u5206\u4E0D\u8DB3\uFF1A\u9700\u898130\u79EF\u5206\uFF0C\u5F53\u524D\u4F59\u989D${precheck2.balance || 0}\u79EF\u5206`);
                  alert(`\u79EF\u5206\u4E0D\u8DB3\uFF013D\u89D2\u8272\u6A21\u578B\u751F\u6210\u9700\u898130\u79EF\u5206\uFF0C\u5F53\u524D\u4F59\u989D${precheck2.balance || 0}\u79EF\u5206\u3002\u8BF7\u5145\u503C\u540E\u518D\u8BD5\u3002`);
                  return;
                }
              } catch (e) {
                log?.(`\u79EF\u5206\u9884\u6821\u9A8C\u5931\u8D25: ${e.message}`);
              }
              try {
                log?.(`\u6B63\u5728\u4E3A\u300C${selectedChar.name}\u300D\u751F\u62103D\u6A21\u578B...`);
                const baseUrl3 = (localStorage.getItem("DISPATCH_BASE_URL") || "https://api.jinsuai.cn").replace(/\/$/, "");
                const token2 = localStorage.getItem("DISPATCH_TOKEN") || "";
                const response = await fetch(`${baseUrl3}/api/threed/character/3d`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": token2 ? `Bearer ${token2}` : ""
                  },
                  body: JSON.stringify({
                    front: selectedChar.fourViews.front || "",
                    left: selectedChar.fourViews.left || "",
                    back: selectedChar.fourViews.back || "",
                    right: selectedChar.fourViews.right || "",
                    quality: "standard"
                  })
                });
                if (!response.ok) {
                  const err = await response.json();
                  throw new Error(err.detail || `HTTP ${response.status}`);
                }
                const result = await response.json();
                if (result.model_url) {
                  updateCharacter(selectedChar.id, { modelUrl: result.model_url, modelType: "ai-generated" });
                  log?.(`\u300C${selectedChar.name}\u300D3D\u6A21\u578B\u751F\u6210\u5B8C\u6210`);
                  if (isLoggedIn()) {
                    try {
                      await deductCredits(30, "image", "3D\u89D2\u8272\u6A21\u578B\u751F\u6210", selectedChar.id);
                      log?.(`\u2705 \u79EF\u5206\u6263\u51CF\u6210\u529F\uFF1A30\u79EF\u5206`);
                      try {
                        const balanceData = await getCreditBalance();
                        if (window.onCreditUpdate) window.onCreditUpdate(balanceData.balance || balanceData.credits || 0);
                      } catch (e) {
                      }
                    } catch (e) {
                      log?.(`\u79EF\u5206\u6263\u51CF\u5931\u8D25: ${e.message}`);
                    }
                  }
                } else {
                  throw new Error("\u672A\u8FD4\u56DE\u6A21\u578BURL");
                }
              } catch (e) {
                log?.(`3D\u6A21\u578B\u751F\u6210\u5931\u8D25: ${e.message}`);
              }
            },
            style: { width: "100%", padding: "6px", background: selectedChar.fourViews?.front ? "linear-gradient(135deg, #f59e0b, #d97706)" : "#333", border: "none", borderRadius: "4px", color: "#fff", cursor: selectedChar.fourViews?.front ? "pointer" : "not-allowed", fontSize: "11px" }
          },
          "\u{1F3B2} \u751F\u62103D\u6A21\u578B\uFF0830\u79EF\u5206\uFF0CTripo-H3.1\uFF09"
        )), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "9px", color: "#555", marginTop: "4px" } }, "\u5148\u751F\u6210\u56DB\u89C6\u56FE\uFF0C\u518D\u751F\u62103D\u6A21\u578B"))
      )),
      /* @__PURE__ */ React.createElement(PanelHeader, { icon: import_lucide_react.Box, title: "\u9053\u5177", count: props.length }, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", marginBottom: "8px" } }, ["box", "sphere", "cylinder", "plane"].map((type) => /* @__PURE__ */ React.createElement(
        "button",
        {
          key: type,
          onClick: () => addProp(type),
          style: {
            padding: "5px",
            background: "#2a2a4a",
            border: "none",
            borderRadius: "4px",
            color: "#fff",
            cursor: "pointer",
            fontSize: "11px"
          }
        },
        "+ ",
        type
      ))), props.map((p) => /* @__PURE__ */ React.createElement(
        "div",
        {
          key: p.id,
          onClick: () => selectProp(p.id),
          style: {
            padding: "6px 8px",
            background: selectedPropId === p.id ? "#2a3a5a" : "#1a1a2e",
            borderRadius: "4px",
            marginBottom: "4px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }
        },
        /* @__PURE__ */ React.createElement(import_lucide_react.Box, { size: 12, color: p.color }),
        /* @__PURE__ */ React.createElement("span", { style: { fontSize: "12px", flex: 1 } }, p.name),
        /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: (e) => {
              e.stopPropagation();
              removeProp(p.id);
            },
            style: { background: "none", border: "none", color: "#f5576c", cursor: "pointer", padding: 0 }
          },
          /* @__PURE__ */ React.createElement(import_lucide_react.Trash2, { size: 12 })
        )
      )), selectedPropItem && /* @__PURE__ */ React.createElement("div", { style: { marginTop: "8px", padding: "8px", background: "#0f0f1a", borderRadius: "4px" } }, /* @__PURE__ */ React.createElement(
        Vector3Input,
        {
          label: "\u4F4D\u7F6E",
          value: selectedPropItem.position,
          onChange: (v) => updateProp(selectedPropItem.id, { position: v })
        }
      ), /* @__PURE__ */ React.createElement(
        Vector3Input,
        {
          label: "\u7F29\u653E",
          value: selectedPropItem.scale,
          onChange: (v) => updateProp(selectedPropItem.id, { scale: v })
        }
      ))),
      /* @__PURE__ */ React.createElement(PanelHeader, { icon: import_lucide_react.Camera, title: "\u673A\u4F4D", count: cameras.length }, /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: handleAddCameraFromView,
          style: {
            width: "100%",
            padding: "6px",
            background: "#2a2a4a",
            border: "none",
            borderRadius: "4px",
            color: "#fff",
            cursor: "pointer",
            fontSize: "12px",
            marginBottom: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "4px"
          }
        },
        /* @__PURE__ */ React.createElement(import_lucide_react.Camera, { size: 12 }),
        " \u4ECE\u5F53\u524D\u89C6\u89D2\u65B0\u589E\u673A\u4F4D"
      ), cameras.map((cam) => /* @__PURE__ */ React.createElement(
        "div",
        {
          key: cam.id,
          onClick: () => setActiveCamera(cam.id),
          style: {
            padding: "6px 8px",
            background: activeCameraId === cam.id ? "#3a3a1a" : "#1a1a2e",
            borderRadius: "4px",
            marginBottom: "4px",
            cursor: "pointer",
            border: activeCameraId === cam.id ? "1px solid #ffd700" : "none"
          }
        },
        /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "6px" } }, /* @__PURE__ */ React.createElement(import_lucide_react.Camera, { size: 12, color: activeCameraId === cam.id ? "#ffd700" : "#888" }), /* @__PURE__ */ React.createElement("span", { style: { fontSize: "12px", flex: 1 } }, cam.name), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: (e) => {
              e.stopPropagation();
              removeCamera(cam.id);
            },
            style: { background: "none", border: "none", color: "#f5576c", cursor: "pointer", padding: 0 }
          },
          /* @__PURE__ */ React.createElement(import_lucide_react.Trash2, { size: 12 })
        )),
        /* @__PURE__ */ React.createElement("div", { style: { fontSize: "10px", color: "#888", marginTop: "2px" } }, cam.aspect, " \xB7 ", CAMERA_MOVEMENTS.find((m) => m.value === cam.movement)?.label)
      )), activeCamera && /* @__PURE__ */ React.createElement("div", { style: { marginTop: "8px", padding: "8px", background: "#0f0f1a", borderRadius: "4px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "11px", color: "#ffd700", marginBottom: "6px" } }, "\u7F16\u8F91\u673A\u4F4D\uFF1A", activeCamera.name), /* @__PURE__ */ React.createElement(
        "input",
        {
          type: "text",
          value: activeCamera.name,
          onChange: (e) => updateCamera(activeCamera.id, { name: e.target.value }),
          style: { width: "100%", background: "#0f0f1a", border: "1px solid #2a2a3a", borderRadius: "4px", padding: "4px", color: "#fff", fontSize: "11px", marginBottom: "6px" }
        }
      ), /* @__PURE__ */ React.createElement(
        Vector3Input,
        {
          label: "\u673A\u4F4D\u4F4D\u7F6E",
          value: activeCamera.position,
          onChange: (v) => updateCamera(activeCamera.id, { position: v })
        }
      ), /* @__PURE__ */ React.createElement(
        Vector3Input,
        {
          label: "\u6CE8\u89C6\u70B9",
          value: activeCamera.target,
          onChange: (v) => updateCamera(activeCamera.id, { target: v })
        }
      ), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "6px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "11px", color: "#888", marginBottom: "2px" } }, "\u753B\u5E45"), /* @__PURE__ */ React.createElement(
        "select",
        {
          value: activeCamera.aspect,
          onChange: (e) => updateCamera(activeCamera.id, { aspect: e.target.value }),
          style: { width: "100%", background: "#0f0f1a", border: "1px solid #2a2a3a", borderRadius: "4px", padding: "4px", color: "#fff", fontSize: "11px" }
        },
        ASPECT_RATIOS2.map((a) => /* @__PURE__ */ React.createElement("option", { key: a.value, value: a.value }, a.label))
      )), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "6px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "11px", color: "#888", marginBottom: "2px" } }, "\u8FD0\u955C\u65B9\u5F0F"), /* @__PURE__ */ React.createElement(
        "select",
        {
          value: activeCamera.movement,
          onChange: (e) => updateCamera(activeCamera.id, { movement: e.target.value }),
          style: { width: "100%", background: "#0f0f1a", border: "1px solid #2a2a3a", borderRadius: "4px", padding: "4px", color: "#fff", fontSize: "11px" }
        },
        CAMERA_MOVEMENTS.map((m) => /* @__PURE__ */ React.createElement("option", { key: m.value, value: m.value }, m.label))
      )), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "6px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "11px", color: "#888", marginBottom: "2px" } }, "\u7126\u8DDD: ", activeCamera.fov, "\xB0"), /* @__PURE__ */ React.createElement(
        "input",
        {
          type: "range",
          min: "20",
          max: "100",
          value: activeCamera.fov,
          onChange: (e) => updateCamera(activeCamera.id, { fov: parseInt(e.target.value) }),
          style: { width: "100%" }
        }
      )), /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: () => {
            const ref = exportCameraReference(activeCamera.id);
            console.log("\u673A\u4F4D\u53C2\u8003\u6570\u636E:", ref);
            alert("\u673A\u4F4D\u53C2\u8003\u6570\u636E\u5DF2\u8F93\u51FA\u5230\u63A7\u5236\u53F0\uFF0C\u53EF\u5BF9\u63A5\u751F\u56FE/\u751F\u89C6\u9891API");
          },
          style: { width: "100%", padding: "6px", background: "linear-gradient(135deg, #4facfe, #00f2fe)", border: "none", borderRadius: "4px", color: "#fff", cursor: "pointer", fontSize: "11px", marginTop: "4px" }
        },
        "\u{1F4E4} \u5BFC\u51FA\u673A\u4F4D\u53C2\u8003\uFF08\u5BF9\u63A5\u751F\u56FE\uFF09"
      ))),
      /* @__PURE__ */ React.createElement(PanelHeader, { icon: import_lucide_react.Settings, title: "\u573A\u666F\u8BBE\u7F6E" }, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "10px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "11px", color: "#4facfe", marginBottom: "4px", fontWeight: 600 } }, "\u{1F3DB}\uFE0F \u573A\u666F\u6A21\u677F"), /* @__PURE__ */ React.createElement(
        "select",
        {
          value: selectedSceneTemplate,
          onChange: (e) => {
            setSelectedSceneTemplate(e.target.value);
            applySceneTemplate(e.target.value);
          },
          style: { width: "100%", background: "#0f0f1a", border: "1px solid #2a2a3a", borderRadius: "4px", padding: "5px", color: "#fff", fontSize: "11px" }
        },
        SCENE_TEMPLATES.map((t2) => /* @__PURE__ */ React.createElement("option", { key: t2.value, value: t2.value }, t2.label, " - ", t2.desc))
      ), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "9px", color: "#555", marginTop: "4px" } }, "\u4E00\u952E\u5207\u6362\u573A\u666F\u706F\u5149\u6C1B\u56F4")), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "8px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "11px", color: "#888", marginBottom: "2px" } }, "\u80CC\u666F\u8272"), /* @__PURE__ */ React.createElement(
        "input",
        {
          type: "color",
          value: scene.background,
          onChange: (e) => updateScene({ background: e.target.value }),
          style: { width: "100%", height: "24px", border: "none", borderRadius: "4px" }
        }
      )), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "8px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "11px", color: "#888", marginBottom: "2px" } }, "\u5730\u9762\u8272"), /* @__PURE__ */ React.createElement(
        "input",
        {
          type: "color",
          value: scene.groundColor,
          onChange: (e) => updateScene({ groundColor: e.target.value }),
          style: { width: "100%", height: "24px", border: "none", borderRadius: "4px" }
        }
      )), /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", marginBottom: "6px", cursor: "pointer" } }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: showGrid, onChange: toggleGrid }), "\u663E\u793A\u7F51\u683C"), /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", marginBottom: "6px", cursor: "pointer" } }, /* @__PURE__ */ React.createElement(
        "input",
        {
          type: "checkbox",
          checked: scene.fogEnabled,
          onChange: (e) => updateScene({ fogEnabled: e.target.checked })
        }
      ), "\u573A\u666F\u96FE\u6548"), /* @__PURE__ */ React.createElement("div", { style: { marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #2a2a3a" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "11px", color: "#4facfe", marginBottom: "8px", fontWeight: 600 } }, "\u{1F3DE}\uFE0F AI\u573A\u666F\u751F\u6210\uFF08\u5B8C\u6574\u6D41\u7A0B\uFF09"), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "8px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "10px", color: "#888", marginBottom: "2px" } }, "\u2460 \u9009\u62E9\u5F53\u524D\u96C6"), /* @__PURE__ */ React.createElement(
        "select",
        {
          value: scene.selectedEpisodeId || "",
          onChange: (e) => {
            updateScene({ selectedEpisodeId: e.target.value });
            setSceneList([]);
          },
          style: { width: "100%", background: "#0f0f1a", border: "1px solid #2a2a3a", borderRadius: "4px", padding: "4px", color: "#fff", fontSize: "11px" }
        },
        /* @__PURE__ */ React.createElement("option", { value: "" }, "\u8BF7\u9009\u62E9\u96C6\u6570"),
        (project2?.episodes || []).map((ep, i) => /* @__PURE__ */ React.createElement("option", { key: ep.id, value: ep.id }, ep.title || `\u7B2C${i + 1}\u96C6`))
      )), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "8px" } }, /* @__PURE__ */ React.createElement(
        "button",
        {
          disabled: !scene.selectedEpisodeId || extractingScenes,
          onClick: async () => {
            if (!scene.selectedEpisodeId) return;
            if (!isLoggedIn()) {
              alert("\u8BF7\u5148\u767B\u5F55\u540E\u518D\u4F7F\u7528AI\u63D0\u53D6\u573A\u666F\u529F\u80FD");
              return;
            }
            try {
              const precheck2 = await precheckCredits(1, "text", "AI\u63D0\u53D6\u573A\u666F");
              if (!precheck2.sufficient && precheck2.sufficient !== void 0) {
                log?.(`\u274C \u79EF\u5206\u4E0D\u8DB3\uFF1A\u9700\u89811\u79EF\u5206\uFF0C\u5F53\u524D\u4F59\u989D${precheck2.balance || 0}\u79EF\u5206`);
                alert(`\u79EF\u5206\u4E0D\u8DB3\uFF01AI\u63D0\u53D6\u573A\u666F\u9700\u89811\u79EF\u5206\uFF0C\u5F53\u524D\u4F59\u989D${precheck2.balance || 0}\u79EF\u5206\u3002\u8BF7\u5145\u503C\u540E\u518D\u8BD5\u3002`);
                return;
              }
            } catch (e) {
              log?.(`\u26A0\uFE0F \u79EF\u5206\u9884\u6821\u9A8C\u5931\u8D25\uFF1A${e.message}`);
            }
            setExtractingScenes(true);
            try {
              log?.("\u6B63\u5728AI\u4ECE\u5267\u672C\u63D0\u53D6\u573A\u666F\u5217\u8868...");
              const episode = (project2?.episodes || []).find((ep) => ep.id === scene.selectedEpisodeId);
              const episodeContent = episode?.content || episode?.script || "";
              const prompt = `\u4ECE\u4EE5\u4E0B\u5267\u672C\u5185\u5BB9\u4E2D\u63D0\u53D6\u6240\u6709\u6545\u4E8B\u53D1\u751F\u7684**\u7A7A\u573A\u666F**\uFF08\u73AF\u5883/\u5730\u70B9\uFF09\uFF0C\u4E0D\u8981\u63D0\u53D6\u5305\u542B\u4EBA\u7269\u7684\u573A\u666F\u3002\u6BCF\u4E2A\u573A\u666F\u53EA\u63CF\u8FF0\u73AF\u5883\u672C\u8EAB\uFF0C\u4E0D\u63CF\u8FF0\u4EBA\u7269\u52A8\u4F5C\u6216\u5BF9\u8BDD\u3002

\u8981\u6C42\uFF1A
1. \u53EA\u63D0\u53D6\u573A\u666F\u73AF\u5883\uFF08\u5730\u70B9\u3001\u5EFA\u7B51\u3001\u7A7A\u95F4\uFF09\uFF0C\u4E0D\u8981\u63D0\u53D6\u4EBA\u7269\u573A\u666F
2. \u573A\u666F\u63CF\u8FF0\u8981\u8BE6\u7EC6\uFF0C\u5305\u542B\uFF1A\u5EFA\u7B51\u7ED3\u6784\u3001\u5BA4\u5185/\u5BA4\u5916\u3001\u9053\u5177\u9648\u8BBE\u3001\u6C1B\u56F4\u3001\u5149\u7EBF\u3001\u65F6\u95F4\uFF08\u767D\u5929/\u591C\u665A\uFF09\u3001\u5929\u6C14\u7B49
3. \u4E0D\u8981\u63CF\u8FF0\u4EBA\u7269\u3001\u4EBA\u7269\u52A8\u4F5C\u3001\u4EBA\u7269\u5BF9\u8BDD
4. \u8FD4\u56DEJSON\u683C\u5F0F\uFF1A[{"name":"\u573A\u666F\u540D\u79F0","description":"\u8BE6\u7EC6\u7684\u7A7A\u573A\u666F\u73AF\u5883\u63CF\u8FF0\uFF0C\u5305\u542B\u5EFA\u7B51\u3001\u9053\u5177\u3001\u6C1B\u56F4\u3001\u5149\u5F71\u3001\u65F6\u95F4\u3001\u5929\u6C14\u7B49\uFF0C\u4E0D\u5305\u542B\u4EBA\u7269"}]

\u5267\u672C\u5185\u5BB9\uFF1A
${episodeContent.substring(0, 3e3)}`;
              const res = await api("/api/llm/chat", {
                method: "POST",
                body: JSON.stringify({
                  model: "qwen-turbo",
                  messages: [{ role: "user", content: prompt }],
                  max_tokens: 1e3
                })
              });
              const content = res.text || "[]";
              const parsed = JSON.parse(content);
              const scenes = Array.isArray(parsed) ? parsed : parsed.scenes || parsed.list || [];
              setSceneList(scenes);
              log?.(`\u63D0\u53D6\u5230 ${scenes.length} \u4E2A\u573A\u666F`);
              if (isLoggedIn()) {
                try {
                  await deductCredits(1, "text", "AI\u63D0\u53D6\u573A\u666F", "");
                  log?.(`\u2705 \u79EF\u5206\u6263\u51CF\u6210\u529F\uFF1A1\u79EF\u5206`);
                  try {
                    const balanceData = await getCreditBalance();
                    if (window.onCreditUpdate) window.onCreditUpdate(balanceData.balance || balanceData.credits || 0);
                  } catch (e) {
                  }
                } catch (e) {
                  log?.(`\u26A0\uFE0F \u79EF\u5206\u6263\u51CF\u5931\u8D25\uFF1A${e.message}`);
                }
              }
            } catch (e) {
              log?.(`\u573A\u666F\u63D0\u53D6\u5931\u8D25: ${e.message}`);
            } finally {
              setExtractingScenes(false);
            }
          },
          style: { width: "100%", padding: "6px", background: scene.selectedEpisodeId && !extractingScenes ? "linear-gradient(135deg, #10b981, #059669)" : "#333", border: "none", borderRadius: "4px", color: "#fff", cursor: scene.selectedEpisodeId && !extractingScenes ? "pointer" : "not-allowed", fontSize: "11px" }
        },
        extractingScenes ? "\u63D0\u53D6\u4E2D..." : "\u{1F916} \u2461 AI\u63D0\u53D6\u573A\u666F\u5217\u8868\uFF081\u79EF\u5206\uFF09"
      )), sceneList.length > 0 && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "8px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "10px", color: "#888", marginBottom: "2px" } }, "\u2462 \u9009\u62E9\u573A\u666F"), /* @__PURE__ */ React.createElement(
        "select",
        {
          value: scene.selectedSceneName || "",
          onChange: (e) => {
            const sceneItem = sceneList.find((s2) => s2.name === e.target.value);
            updateScene({ selectedSceneName: e.target.value, scenePrompt: sceneItem?.description || "" });
          },
          style: { width: "100%", background: "#0f0f1a", border: "1px solid #2a2a3a", borderRadius: "4px", padding: "4px", color: "#fff", fontSize: "11px" }
        },
        /* @__PURE__ */ React.createElement("option", { value: "" }, "\u8BF7\u9009\u62E9\u573A\u666F"),
        sceneList.map((s2, i) => /* @__PURE__ */ React.createElement("option", { key: i, value: s2.name }, s2.name))
      )), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "8px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "10px", color: "#888", marginBottom: "2px" } }, "\u2463 \u573A\u666F\u63D0\u793A\u8BCD\uFF08\u53EF\u7F16\u8F91\uFF09"), /* @__PURE__ */ React.createElement(
        "textarea",
        {
          value: scene.scenePrompt || "",
          onChange: (e) => updateScene({ scenePrompt: e.target.value }),
          placeholder: "\u573A\u666F\u63CF\u8FF0\uFF0C\u7528\u4E8E\u751F\u6210\u573A\u666F\u6982\u5FF5\u56FE",
          style: { width: "100%", background: "#0f0f1a", border: "1px solid #2a2a3a", borderRadius: "4px", padding: "4px", color: "#fff", fontSize: "11px", minHeight: "50px", resize: "vertical" }
        }
      )), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "6px" } }, /* @__PURE__ */ React.createElement(
        "button",
        {
          disabled: !scene.scenePrompt || generatingSceneImg,
          onClick: async () => {
            if (!scene.scenePrompt) return;
            if (!isLoggedIn()) {
              alert("\u8BF7\u5148\u767B\u5F55\u540E\u518D\u4F7F\u7528\u573A\u666F\u6982\u5FF5\u56FE\u751F\u6210\u529F\u80FD");
              return;
            }
            try {
              const precheck2 = await precheckCredits(3, "image", "3D\u573A\u666F\u6982\u5FF5\u56FE\u751F\u6210");
              if (!precheck2.sufficient && precheck2.sufficient !== void 0) {
                log?.(`\u274C \u79EF\u5206\u4E0D\u8DB3\uFF1A\u9700\u89813\u79EF\u5206\uFF0C\u5F53\u524D\u4F59\u989D${precheck2.balance || 0}\u79EF\u5206`);
                alert(`\u79EF\u5206\u4E0D\u8DB3\uFF013D\u573A\u666F\u6982\u5FF5\u56FE\u751F\u6210\u9700\u89813\u79EF\u5206\uFF0C\u5F53\u524D\u4F59\u989D${precheck2.balance || 0}\u79EF\u5206\u3002\u8BF7\u5145\u503C\u540E\u518D\u8BD5\u3002`);
                return;
              }
            } catch (e) {
              log?.(`\u79EF\u5206\u9884\u6821\u9A8C\u5931\u8D25: ${e.message}`);
            }
            setGeneratingSceneImg(true);
            try {
              log?.("\u6B63\u5728\u751F\u6210\u573A\u666F\u6982\u5FF5\u56FE...");
              const baseUrl3 = (localStorage.getItem("DISPATCH_BASE_URL") || "https://api.jinsuai.cn").replace(/\/$/, "");
              const token2 = localStorage.getItem("DISPATCH_TOKEN") || "";
              const response = await fetch(`${baseUrl3}/api/threed/scene/image`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": token2 ? `Bearer ${token2}` : "" },
                body: JSON.stringify({ prompt: scene.scenePrompt, scene_name: scene.selectedSceneName })
              });
              if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || `HTTP ${response.status}`);
              }
              const result = await response.json();
              updateScene({ sceneImageUrl: result.image_url });
              log?.("\u573A\u666F\u6982\u5FF5\u56FE\u751F\u6210\u5B8C\u6210");
              if (isLoggedIn()) {
                try {
                  await deductCredits(3, "image", "3D\u573A\u666F\u6982\u5FF5\u56FE\u751F\u6210", "");
                  log?.(`\u2705 \u79EF\u5206\u6263\u51CF\u6210\u529F\uFF1A3\u79EF\u5206`);
                  try {
                    const balanceData = await getCreditBalance();
                    if (window.onCreditUpdate) window.onCreditUpdate(balanceData.balance || balanceData.credits || 0);
                  } catch (e) {
                  }
                } catch (e) {
                  log?.(`\u79EF\u5206\u6263\u51CF\u5931\u8D25: ${e.message}`);
                }
              }
            } catch (e) {
              log?.(`\u573A\u666F\u56FE\u751F\u6210\u5931\u8D25: ${e.message}`);
            } finally {
              setGeneratingSceneImg(false);
            }
          },
          style: { width: "100%", padding: "6px", background: scene.scenePrompt && !generatingSceneImg ? "linear-gradient(135deg, #7A5CFF, #5CE1E6)" : "#333", border: "none", borderRadius: "4px", color: "#fff", cursor: scene.scenePrompt && !generatingSceneImg ? "pointer" : "not-allowed", fontSize: "11px" }
        },
        generatingSceneImg ? "\u751F\u6210\u4E2D..." : "\u{1F3A8} \u2464 \u751F\u6210\u573A\u666F\u6982\u5FF5\u56FE\uFF083\u79EF\u5206\uFF09"
      )), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "8px" } }, /* @__PURE__ */ React.createElement(
        "button",
        {
          disabled: !scene.sceneImageUrl || generatingScene3D,
          onClick: async () => {
            if (!scene.sceneImageUrl) return;
            if (!isLoggedIn()) {
              alert("\u8BF7\u5148\u767B\u5F55\u540E\u518D\u4F7F\u75283D\u573A\u666F\u751F\u6210\u529F\u80FD");
              return;
            }
            try {
              const precheck2 = await precheckCredits(40, "image", "3D\u573A\u666F\u6A21\u578B\u751F\u6210");
              if (!precheck2.sufficient && precheck2.sufficient !== void 0) {
                log?.(`\u274C \u79EF\u5206\u4E0D\u8DB3\uFF1A\u9700\u898130\u79EF\u5206\uFF0C\u5F53\u524D\u4F59\u989D${precheck2.balance || 0}\u79EF\u5206`);
                alert(`\u79EF\u5206\u4E0D\u8DB3\uFF013D\u573A\u666F\u6A21\u578B\u751F\u6210\u9700\u898130\u79EF\u5206\uFF0C\u5F53\u524D\u4F59\u989D${precheck2.balance || 0}\u79EF\u5206\u3002\u8BF7\u5145\u503C\u540E\u518D\u8BD5\u3002`);
                return;
              }
            } catch (e) {
              log?.(`\u79EF\u5206\u9884\u6821\u9A8C\u5931\u8D25: ${e.message}`);
            }
            setGeneratingScene3D(true);
            try {
              log?.("\u6B63\u5728\u751F\u62103D\u573A\u666F\u6A21\u578B...");
              const baseUrl3 = (localStorage.getItem("DISPATCH_BASE_URL") || "https://api.jinsuai.cn").replace(/\/$/, "");
              const token2 = localStorage.getItem("DISPATCH_TOKEN") || "";
              const response = await fetch(`${baseUrl3}/api/threed/scene/3d`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": token2 ? `Bearer ${token2}` : "" },
                body: JSON.stringify({ image_url: scene.sceneImageUrl, quality: "standard", scene_name: scene.selectedSceneName })
              });
              if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || `HTTP ${response.status}`);
              }
              const result = await response.json();
              if (result.model_url) {
                updateScene({ sceneModelUrl: result.model_url });
                log?.("3D\u573A\u666F\u6A21\u578B\u751F\u6210\u5B8C\u6210");
                if (isLoggedIn()) {
                  try {
                    await deductCredits(40, "image", "3D\u573A\u666F\u6A21\u578B\u751F\u6210", "");
                    log?.(`\u2705 \u79EF\u5206\u6263\u51CF\u6210\u529F\uFF1A30\u79EF\u5206`);
                    try {
                      const balanceData = await getCreditBalance();
                      if (window.onCreditUpdate) window.onCreditUpdate(balanceData.balance || balanceData.credits || 0);
                    } catch (e) {
                    }
                  } catch (e) {
                    log?.(`\u79EF\u5206\u6263\u51CF\u5931\u8D25: ${e.message}`);
                  }
                }
              } else {
                throw new Error("\u672A\u8FD4\u56DE\u6A21\u578BURL");
              }
            } catch (e) {
              log?.(`3D\u573A\u666F\u751F\u6210\u5931\u8D25: ${e.message}`);
            } finally {
              setGeneratingScene3D(false);
            }
          },
          style: { width: "100%", padding: "6px", background: scene.sceneImageUrl && !generatingScene3D ? "linear-gradient(135deg, #f59e0b, #d97706)" : "#333", border: "none", borderRadius: "4px", color: "#fff", cursor: scene.sceneImageUrl && !generatingScene3D ? "pointer" : "not-allowed", fontSize: "11px" }
        },
        generatingScene3D ? "\u751F\u6210\u4E2D..." : "\u{1F3B2} \u2465 \u751F\u62103D\u573A\u666F\uFF0840\u79EF\u5206\uFF0CTripo-H3.1\uFF09"
      )), scene.sceneImageUrl && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "8px" } }, /* @__PURE__ */ React.createElement("img", { src: scene.sceneImageUrl, alt: "\u573A\u666F\u6982\u5FF5\u56FE", style: { width: "100%", borderRadius: "4px", border: "1px solid #2a2a3a" } })), scene.sceneModelUrl && /* @__PURE__ */ React.createElement("div", { style: { fontSize: "10px", color: "#10b981", marginBottom: "4px" } }, "\u2713 3D\u573A\u666F\u6A21\u578B\u5DF2\u751F\u6210\uFF1A", scene.selectedSceneName || "\u672A\u547D\u540D\u573A\u666F")), /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: () => {
            const data = exportScene();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "director-scene.json";
            a.click();
          },
          style: { width: "100%", padding: "6px", background: "#2a2a4a", border: "none", borderRadius: "4px", color: "#fff", cursor: "pointer", fontSize: "12px", marginTop: "8px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }
        },
        /* @__PURE__ */ React.createElement(import_lucide_react.Download, { size: 12 }),
        " \u5BFC\u51FA\u573A\u666F\u914D\u7F6E"
      )),
      showImportCharModal && /* @__PURE__ */ React.createElement("div", { style: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999
      }, onClick: () => setShowImportCharModal(false) }, /* @__PURE__ */ React.createElement("div", { style: {
        background: "#1a1a2e",
        borderRadius: "8px",
        padding: "16px",
        width: "400px",
        maxHeight: "80vh",
        overflow: "auto"
      }, onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" } }, /* @__PURE__ */ React.createElement("h3", { style: { margin: 0, color: "#fff", fontSize: "16px" } }, "\u9009\u62E9\u8981\u5BFC\u5165\u7684\u89D2\u8272"), /* @__PURE__ */ React.createElement("button", { onClick: () => setShowImportCharModal(false), style: { background: "none", border: "none", color: "#888", fontSize: "20px", cursor: "pointer" } }, "\xD7")), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "11px", color: "#888", marginBottom: "12px" } }, "\u70B9\u51FB\u89D2\u8272\u5373\u53EF\u5BFC\u5165\uFF08\u4E00\u4E2A\u4E00\u4E2A\u5BFC\u5165\uFF09"), (project2?.materials?.characters || project2?.characters || project2?.outline?.characters || []).map((pc, index) => {
        const exists = characters.find((c) => c.name === pc.name);
        return /* @__PURE__ */ React.createElement(
          "div",
          {
            key: index,
            onClick: () => {
              if (exists) {
                alert(`\u89D2\u8272\u300C${pc.name}\u300D\u5DF2\u5B58\u5728\uFF0C\u65E0\u9700\u91CD\u590D\u5BFC\u5165`);
                return;
              }
              const template = pc.gender === "\u5973" ? "female_standard" : "male_standard";
              addCharacter(pc.name, template);
              setTimeout(() => {
                const char = useDirectorStore.getState().characters.find((c) => c.name === pc.name);
                if (char) {
                  updateCharacter(char.id, {
                    description: pc.description || pc.desc || pc.appearance || "",
                    imageUrl: pc.imageUrl || pc.avatar || pc.image || null
                  });
                }
              }, 100);
              log?.(`\u5BFC\u5165\u89D2\u8272\uFF1A${pc.name}`);
              alert(`\u6210\u529F\u5BFC\u5165\u89D2\u8272\uFF1A${pc.name}`);
            },
            style: {
              padding: "10px",
              marginBottom: "8px",
              borderRadius: "4px",
              background: exists ? "#2a2a3a" : "#2a2a4a",
              cursor: exists ? "not-allowed" : "pointer",
              border: "1px solid #3a3a5a",
              opacity: exists ? 0.5 : 1
            }
          },
          /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "10px" } }, pc.imageUrl || pc.avatar || pc.image ? /* @__PURE__ */ React.createElement("img", { src: pc.imageUrl || pc.avatar || pc.image, alt: pc.name, style: { width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover" } }) : /* @__PURE__ */ React.createElement("div", { style: { width: "40px", height: "40px", borderRadius: "50%", background: "#4a5568", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "16px" } }, pc.name?.charAt(0) || "?"), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { color: "#fff", fontSize: "14px", fontWeight: 600 } }, pc.name), /* @__PURE__ */ React.createElement("div", { style: { color: "#888", fontSize: "11px" } }, pc.gender || "\u672A\u77E5", " \xB7 ", pc.role || pc.personality || "\u65E0\u63CF\u8FF0"), exists && /* @__PURE__ */ React.createElement("div", { style: { color: "#f59e0b", fontSize: "10px", marginTop: "2px" } }, "\u5DF2\u5BFC\u5165")))
        );
      })))
    );
  }

  // src/components/Director3D/index.tsx
  function VipGate({ onUnlock }) {
    return /* @__PURE__ */ React.createElement("div", { style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      height: "100%",
      background: "linear-gradient(135deg, #0a0a12 0%, #1a1a2e 100%)",
      color: "#fff",
      padding: 40,
      textAlign: "center"
    } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 64, marginBottom: 20 } }, "\u{1F3AC}"), /* @__PURE__ */ React.createElement("h2", { style: { fontSize: 28, margin: "0 0 12px", background: "linear-gradient(135deg, #f59e0b, #d97706)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } }, "3D\u5BFC\u6F14\u53F0"), /* @__PURE__ */ React.createElement("p", { style: { fontSize: 16, color: "#999", margin: "0 0 8px", maxWidth: 500, lineHeight: 1.6 } }, "\u4E13\u4E1A\u7EA73D\u865A\u62DF\u573A\u666F\u642D\u5EFA\uFF0C\u591A\u673A\u4F4D\u7BA1\u7406\uFF0C\u6E32\u67D3\u9996\u5E27\u53C2\u8003\u56FE"), /* @__PURE__ */ React.createElement("p", { style: { fontSize: 14, color: "#666", margin: "0 0 24px" } }, "\u89D2\u8272/\u9053\u5177/\u573A\u666F\u642D\u5EFA \xB7 \u591A\u673A\u4F4D\u8FD0\u955C \xB7 \u9996\u5E27\u6E32\u67D3 \xB7 \u5BF9\u63A5\u56FE\u751F\u89C6\u9891"), /* @__PURE__ */ React.createElement("div", { style: {
      background: "rgba(245, 158, 11, 0.1)",
      border: "1px solid rgba(245, 158, 11, 0.3)",
      borderRadius: 12,
      padding: "16px 24px",
      marginBottom: 24
    } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, color: "#f59e0b", fontWeight: 600 } }, "\u{1F512} VIP\u4E13\u5C5E\u529F\u80FD"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#999", marginTop: 4 } }, "\u8BA2\u9605\u4F1A\u5458\u540E\u5373\u53EF\u4F7F\u75283D\u5BFC\u6F14\u53F0\u5168\u90E8\u529F\u80FD")), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: onUnlock,
        style: {
          padding: "12px 32px",
          background: "linear-gradient(135deg, #f59e0b, #d97706)",
          border: "none",
          borderRadius: 8,
          color: "#fff",
          cursor: "pointer",
          fontSize: 16,
          fontWeight: 600
        }
      },
      "\u7ACB\u5373\u5F00\u901A VIP"
    ));
  }
  function Director3D({
    width = "100%",
    height = "100%",
    className,
    style,
    onExport,
    onCameraReference,
    onRenderFrame,
    project: project2,
    update,
    log
  }) {
    const { exportScene, exportCameraReference, activeCameraId } = useDirectorStore();
    const canvasRef = (0, import_react8.useRef)(null);
    const [isVip, setIsVip] = (0, import_react8.useState)(() => {
      return localStorage.getItem("USER_VIP_STATUS") === "true";
    });
    const handleUnlockVip = () => {
      if (window.onOpenMembership) {
        window.onOpenMembership();
      } else {
        alert("\u8BF7\u5728\u8BBE\u7F6E\u4E2D\u5F00\u901AVIP\u4F1A\u5458\u540E\u4F7F\u75283D\u5BFC\u6F14\u53F0");
      }
    };
    if (!isVip) {
      return /* @__PURE__ */ React.createElement("div", { style: { width, height, ...style } }, /* @__PURE__ */ React.createElement(VipGate, { onUnlock: handleUnlockVip }));
    }
    const handleExport = () => {
      const data = exportScene();
      onExport?.(data);
    };
    const handleCameraRef = () => {
      if (activeCameraId) {
        const data = exportCameraReference(activeCameraId);
        onCameraReference?.(activeCameraId, data);
      }
    };
    const handleRenderFrame = () => {
      if (!canvasRef.current) {
        log?.("\u753B\u5E03\u672A\u5C31\u7EEA\uFF0C\u65E0\u6CD5\u6E32\u67D3");
        return;
      }
      try {
        const dataUrl = canvasRef.current.toDataURL("image/png");
        if (dataUrl && dataUrl.length > 100) {
          log?.("\u9996\u5E27\u6E32\u67D3\u6210\u529F\uFF0C\u6B63\u5728\u8DF3\u8F6C\u5230\u89C6\u9891\u751F\u6210...");
          onRenderFrame?.(dataUrl);
        } else {
          log?.("\u6E32\u67D3\u5931\u8D25\uFF0C\u753B\u5E03\u4E3A\u7A7A");
        }
      } catch (e) {
        log?.(`\u6E32\u67D3\u5931\u8D25: ${e.message}`);
      }
    };
    return /* @__PURE__ */ React.createElement(
      "div",
      {
        className,
        style: {
          display: "flex",
          width,
          height,
          background: "#0a0a12",
          position: "relative",
          overflow: "hidden",
          ...style
        }
      },
      /* @__PURE__ */ React.createElement(DirectorPanel, { project: project2, update, log }),
      /* @__PURE__ */ React.createElement("div", { style: { flex: 1, position: "relative" } }, /* @__PURE__ */ React.createElement(DirectorCanvas, { canvasRef }), /* @__PURE__ */ React.createElement(
        "div",
        {
          style: {
            position: "absolute",
            top: "12px",
            left: "12px",
            right: "12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            pointerEvents: "none"
          }
        },
        /* @__PURE__ */ React.createElement(
          "div",
          {
            style: {
              background: "rgba(0,0,0,0.7)",
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              color: "#fff",
              pointerEvents: "auto"
            }
          },
          "\u{1F5B1}\uFE0F \u5DE6\u952E\u65CB\u8F6C \xB7 \u53F3\u952E\u5E73\u79FB \xB7 \u6EDA\u8F6E\u7F29\u653E \xB7 \u70B9\u51FB\u9009\u4E2D\u7269\u4F53"
        ),
        /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "8px", pointerEvents: "auto" } }, /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: handleRenderFrame,
            style: {
              padding: "6px 12px",
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              border: "none",
              borderRadius: "6px",
              color: "#fff",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 600
            }
          },
          "\u{1F3AC} \u6E32\u67D3\u9996\u5E27\u5E76\u751F\u6210\u89C6\u9891"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: handleCameraRef,
            style: {
              padding: "6px 12px",
              background: "linear-gradient(135deg, #4facfe, #00f2fe)",
              border: "none",
              borderRadius: "6px",
              color: "#fff",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 600
            }
          },
          "\u{1F4F8} \u751F\u6210\u673A\u4F4D\u53C2\u8003\u56FE"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: handleExport,
            style: {
              padding: "6px 12px",
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "6px",
              color: "#fff",
              cursor: "pointer",
              fontSize: "12px"
            }
          },
          "\u{1F4BE} \u4FDD\u5B58\u573A\u666F"
        ))
      ), /* @__PURE__ */ React.createElement(
        "div",
        {
          style: {
            position: "absolute",
            bottom: "12px",
            left: "12px",
            background: "rgba(0,0,0,0.7)",
            padding: "4px 10px",
            borderRadius: "4px",
            fontSize: "11px",
            color: "#888"
          }
        },
        "\u89D2\u8272: ",
        useDirectorStore.getState().characters.length,
        " \xB7 \u9053\u5177: ",
        useDirectorStore.getState().props.length,
        " \xB7 \u673A\u4F4D: ",
        useDirectorStore.getState().cameras.length
      ))
    );
  }

  // src/components/DubbingBoard.jsx
  var import_react9 = __toESM(__require("react"), 1);
  var VOICE_CN_BASIC = [
    {
      id: "male-qn-qingse",
      name: "\u9752\u6DA9\u9752\u5E74",
      gender: "\u7537",
      style: "\u9752\u6DA9\u5C11\u5E74",
      desc: "\u9002\u5408\u5C11\u5E74\u3001\u9752\u5E74\u89D2\u8272"
    },
    {
      id: "male-qn-jingying",
      name: "\u7CBE\u82F1\u9752\u5E74",
      gender: "\u7537",
      style: "\u6C89\u7A33\u78C1\u6027",
      desc: "\u9002\u5408\u7537\u4E3B\u3001\u5927\u53D4\u3001\u7CBE\u82F1"
    },
    {
      id: "male-qn-badao",
      name: "\u9738\u9053\u9752\u5E74",
      gender: "\u7537",
      style: "\u9738\u9053\u603B\u88C1",
      desc: "\u9002\u5408\u9738\u603B\u3001\u53CD\u6D3E"
    },
    {
      id: "male-qn-daxuesheng",
      name: "\u5927\u5B66\u751F",
      gender: "\u7537",
      style: "\u9633\u5149\u5F00\u6717",
      desc: "\u9002\u5408\u5B66\u751F\u3001\u9752\u5E74"
    },
    {
      id: "female-shaonv",
      name: "\u5C11\u5973",
      gender: "\u5973",
      style: "\u751C\u7F8E\u53EF\u7231",
      desc: "\u9002\u5408\u5C11\u5973\u3001\u841D\u8389"
    },
    {
      id: "female-yujie",
      name: "\u5FA1\u59D0",
      gender: "\u5973",
      style: "\u6210\u719F\u5FA1\u59D0",
      desc: "\u9002\u5408\u5973\u4E3B\u3001\u5FA1\u59D0"
    },
    {
      id: "female-chengshu",
      name: "\u6210\u719F\u5973\u6027",
      gender: "\u5973",
      style: "\u6E29\u67D4\u77E5\u6027",
      desc: "\u9002\u5408\u65C1\u767D\u3001\u6210\u719F\u5973\u6027"
    },
    {
      id: "female-tianmei",
      name: "\u751C\u7F8E\u5973\u6027",
      gender: "\u5973",
      style: "\u6D3B\u6CFC\u5F00\u6717",
      desc: "\u9002\u5408\u641E\u7B11\u3001\u6D3B\u6CFC\u89D2\u8272"
    }
  ];
  var VOICE_CN_PREMIUM = [
    {
      id: "male-qn-qingse-jingpin",
      name: "\u9752\u6DA9\u9752\u5E74(\u7CBE\u54C1)",
      gender: "\u7537",
      style: "\u9752\u6DA9\u5C11\u5E74",
      desc: "\u7CBE\u54C1\u7248\uFF0C\u97F3\u8D28\u66F4\u597D"
    },
    {
      id: "male-qn-jingying-jingpin",
      name: "\u7CBE\u82F1\u9752\u5E74(\u7CBE\u54C1)",
      gender: "\u7537",
      style: "\u6C89\u7A33\u78C1\u6027",
      desc: "\u7CBE\u54C1\u7248\uFF0C\u97F3\u8D28\u66F4\u597D"
    },
    {
      id: "male-qn-badao-jingpin",
      name: "\u9738\u9053\u9752\u5E74(\u7CBE\u54C1)",
      gender: "\u7537",
      style: "\u9738\u9053\u603B\u88C1",
      desc: "\u7CBE\u54C1\u7248\uFF0C\u97F3\u8D28\u66F4\u597D"
    },
    {
      id: "male-qn-daxuesheng-jingpin",
      name: "\u5927\u5B66\u751F(\u7CBE\u54C1)",
      gender: "\u7537",
      style: "\u9633\u5149\u5F00\u6717",
      desc: "\u7CBE\u54C1\u7248\uFF0C\u97F3\u8D28\u66F4\u597D"
    },
    {
      id: "female-shaonv-jingpin",
      name: "\u5C11\u5973(\u7CBE\u54C1)",
      gender: "\u5973",
      style: "\u751C\u7F8E\u53EF\u7231",
      desc: "\u7CBE\u54C1\u7248\uFF0C\u97F3\u8D28\u66F4\u597D"
    },
    {
      id: "female-yujie-jingpin",
      name: "\u5FA1\u59D0(\u7CBE\u54C1)",
      gender: "\u5973",
      style: "\u6210\u719F\u5FA1\u59D0",
      desc: "\u7CBE\u54C1\u7248\uFF0C\u97F3\u8D28\u66F4\u597D"
    },
    {
      id: "female-chengshu-jingpin",
      name: "\u6210\u719F\u5973\u6027(\u7CBE\u54C1)",
      gender: "\u5973",
      style: "\u6E29\u67D4\u77E5\u6027",
      desc: "\u7CBE\u54C1\u7248\uFF0C\u97F3\u8D28\u66F4\u597D"
    },
    {
      id: "female-tianmei-jingpin",
      name: "\u751C\u7F8E\u5973\u6027(\u7CBE\u54C1)",
      gender: "\u5973",
      style: "\u6D3B\u6CFC\u5F00\u6717",
      desc: "\u7CBE\u54C1\u7248\uFF0C\u97F3\u8D28\u66F4\u597D"
    }
  ];
  var VOICE_CN_CHARACTER = [
    {
      id: "bingjiao_didi",
      name: "\u75C5\u5A07\u5F1F\u5F1F",
      gender: "\u7537",
      style: "\u75C5\u5A07",
      desc: "\u9002\u5408\u75C5\u5A07\u3001\u8179\u9ED1\u89D2\u8272"
    },
    {
      id: "junlang_nanyou",
      name: "\u4FCA\u6717\u7537\u53CB",
      gender: "\u7537",
      style: "\u4FCA\u6717",
      desc: "\u9002\u5408\u7537\u53CB\u3001\u7537\u4E3B\u89D2\u8272"
    },
    {
      id: "chunzhen_xuedi",
      name: "\u7EAF\u771F\u5B66\u5F1F",
      gender: "\u7537",
      style: "\u7EAF\u771F",
      desc: "\u9002\u5408\u5B66\u5F1F\u3001\u5C11\u5E74\u89D2\u8272"
    },
    {
      id: "lengdan_xiongzhang",
      name: "\u51B7\u6DE1\u5B66\u957F",
      gender: "\u7537",
      style: "\u51B7\u6DE1",
      desc: "\u9002\u5408\u5B66\u957F\u3001\u9AD8\u51B7\u89D2\u8272"
    },
    {
      id: "badao_shaoye",
      name: "\u9738\u9053\u5C11\u7237",
      gender: "\u7537",
      style: "\u9738\u9053",
      desc: "\u9002\u5408\u5C11\u7237\u3001\u9738\u603B\u89D2\u8272"
    },
    {
      id: "tianxin_xiaoling",
      name: "\u751C\u5FC3\u5C0F\u73B2",
      gender: "\u5973",
      style: "\u751C\u5FC3",
      desc: "\u9002\u5408\u751C\u5FC3\u3001\u53EF\u7231\u89D2\u8272"
    },
    {
      id: "qiaopi_mengmei",
      name: "\u4FCF\u76AE\u840C\u59B9",
      gender: "\u5973",
      style: "\u4FCF\u76AE",
      desc: "\u9002\u5408\u840C\u59B9\u3001\u4FCF\u76AE\u89D2\u8272"
    },
    {
      id: "wumei_yujie",
      name: "\u59A9\u5A9A\u5FA1\u59D0",
      gender: "\u5973",
      style: "\u59A9\u5A9A",
      desc: "\u9002\u5408\u5FA1\u59D0\u3001\u59A9\u5A9A\u89D2\u8272"
    },
    {
      id: "diadia_xuemei",
      name: "\u55F2\u55F2\u5B66\u59B9",
      gender: "\u5973",
      style: "\u55F2\u55F2",
      desc: "\u9002\u5408\u5B66\u59B9\u3001\u55F2\u55F2\u89D2\u8272"
    },
    {
      id: "danya_xuejie",
      name: "\u6DE1\u96C5\u5B66\u59D0",
      gender: "\u5973",
      style: "\u6DE1\u96C5",
      desc: "\u9002\u5408\u5B66\u59D0\u3001\u6DE1\u96C5\u89D2\u8272"
    }
  ];
  var VOICE_CN_CHILD = [
    {
      id: "clever_boy",
      name: "\u806A\u660E\u7537\u7AE5",
      gender: "\u7537",
      style: "\u806A\u660E\u4F36\u4FD0",
      desc: "\u9002\u5408\u513F\u7AE5\u89D2\u8272\u3001\u52A8\u753B"
    },
    {
      id: "cute_boy",
      name: "\u53EF\u7231\u7537\u7AE5",
      gender: "\u7537",
      style: "\u53EF\u7231\u5446\u840C",
      desc: "\u9002\u5408\u513F\u7AE5\u89D2\u8272\u3001\u52A8\u753B"
    },
    {
      id: "lovely_girl",
      name: "\u840C\u840C\u5973\u7AE5",
      gender: "\u5973",
      style: "\u840C\u840C\u53EF\u7231",
      desc: "\u9002\u5408\u513F\u7AE5\u89D2\u8272\u3001\u52A8\u753B"
    },
    {
      id: "cartoon_pig",
      name: "\u5361\u901A\u732A\u5C0F\u742A",
      gender: "\u5361\u901A",
      style: "\u5361\u901A\u641E\u7B11",
      desc: "\u9002\u5408\u5361\u901A\u3001\u641E\u7B11\u89D2\u8272"
    }
  ];
  var VOICE_CN_SPECIAL = [
    {
      id: "Chinese (Mandarin)_Reliable_Executive",
      name: "\u6C89\u7A33\u9AD8\u7BA1",
      gender: "\u7537",
      style: "\u6C89\u7A33",
      desc: "\u9002\u5408\u9AD8\u7BA1\u3001\u5546\u52A1\u89D2\u8272"
    },
    {
      id: "Chinese (Mandarin)_News_Anchor",
      name: "\u65B0\u95FB\u5973\u58F0",
      gender: "\u5973",
      style: "\u4E13\u4E1A",
      desc: "\u9002\u5408\u65B0\u95FB\u3001\u65C1\u767D"
    },
    {
      id: "Chinese (Mandarin)_Mature_Woman",
      name: "\u50B2\u5A07\u5FA1\u59D0",
      gender: "\u5973",
      style: "\u50B2\u5A07",
      desc: "\u9002\u5408\u5FA1\u59D0\u3001\u50B2\u5A07\u89D2\u8272"
    },
    {
      id: "Chinese (Mandarin)_Unrestrained_Young_Man",
      name: "\u4E0D\u7F81\u9752\u5E74",
      gender: "\u7537",
      style: "\u4E0D\u7F81",
      desc: "\u9002\u5408\u4E0D\u7F81\u3001\u53DB\u9006\u89D2\u8272"
    },
    {
      id: "Arrogant_Miss",
      name: "\u56A3\u5F20\u5C0F\u59D0",
      gender: "\u5973",
      style: "\u56A3\u5F20",
      desc: "\u9002\u5408\u5927\u5C0F\u59D0\u3001\u56A3\u5F20\u89D2\u8272"
    },
    {
      id: "Robot_Armor",
      name: "\u673A\u68B0\u6218\u7532",
      gender: "\u673A\u68B0",
      style: "\u673A\u68B0",
      desc: "\u9002\u5408\u673A\u5668\u4EBA\u3001\u673A\u68B0\u89D2\u8272"
    },
    {
      id: "Chinese (Mandarin)_Kind-hearted_Antie",
      name: "\u70ED\u5FC3\u5927\u5A76",
      gender: "\u5973",
      style: "\u70ED\u5FC3",
      desc: "\u9002\u5408\u5927\u5A76\u3001\u70ED\u5FC3\u89D2\u8272"
    },
    {
      id: "Chinese (Mandarin)_HK_Flight_Attendant",
      name: "\u6E2F\u666E\u7A7A\u59D0",
      gender: "\u5973",
      style: "\u6E2F\u666E",
      desc: "\u9002\u5408\u7A7A\u59D0\u3001\u6E2F\u666E\u89D2\u8272"
    },
    {
      id: "Chinese (Mandarin)_Humorous_Elder",
      name: "\u641E\u7B11\u5927\u7237",
      gender: "\u7537",
      style: "\u641E\u7B11",
      desc: "\u9002\u5408\u5927\u7237\u3001\u641E\u7B11\u89D2\u8272"
    },
    {
      id: "Chinese (Mandarin)_Gentleman",
      name: "\u6E29\u6DA6\u7537\u58F0",
      gender: "\u7537",
      style: "\u6E29\u6DA6",
      desc: "\u9002\u5408\u7EC5\u58EB\u3001\u6E29\u6DA6\u89D2\u8272"
    },
    {
      id: "Chinese (Mandarin)_Warm_Bestie",
      name: "\u6E29\u6696\u95FA\u871C",
      gender: "\u5973",
      style: "\u6E29\u6696",
      desc: "\u9002\u5408\u95FA\u871C\u3001\u6E29\u6696\u89D2\u8272"
    },
    {
      id: "Chinese (Mandarin)_Male_Announcer",
      name: "\u64AD\u62A5\u7537\u58F0",
      gender: "\u7537",
      style: "\u4E13\u4E1A",
      desc: "\u9002\u5408\u64AD\u62A5\u3001\u65C1\u767D"
    },
    {
      id: "Chinese (Mandarin)_Sweet_Lady",
      name: "\u751C\u7F8E\u5973\u58F0",
      gender: "\u5973",
      style: "\u751C\u7F8E",
      desc: "\u9002\u5408\u751C\u7F8E\u3001\u53EF\u7231\u89D2\u8272"
    },
    {
      id: "Chinese (Mandarin)_Southern_Young_Man",
      name: "\u5357\u65B9\u5C0F\u54E5",
      gender: "\u7537",
      style: "\u5357\u65B9\u53E3\u97F3",
      desc: "\u9002\u5408\u5357\u65B9\u5C0F\u54E5\u89D2\u8272"
    },
    {
      id: "Chinese (Mandarin)_Wise_Women",
      name: "\u9605\u5386\u59D0\u59D0",
      gender: "\u5973",
      style: "\u9605\u5386\u4E30\u5BCC",
      desc: "\u9002\u5408\u6210\u719F\u3001\u9605\u5386\u4E30\u5BCC\u89D2\u8272"
    },
    {
      id: "Chinese (Mandarin)_Gentle_Youth",
      name: "\u6E29\u6DA6\u9752\u5E74",
      gender: "\u7537",
      style: "\u6E29\u6DA6",
      desc: "\u9002\u5408\u6E29\u6DA6\u9752\u5E74\u89D2\u8272"
    },
    {
      id: "Chinese (Mandarin)_Warm_Girl",
      name: "\u6E29\u6696\u5C11\u5973",
      gender: "\u5973",
      style: "\u6E29\u6696",
      desc: "\u9002\u5408\u6E29\u6696\u5C11\u5973\u89D2\u8272"
    },
    {
      id: "Chinese (Mandarin)_Kind-hearted_Elder",
      name: "\u82B1\u7532\u5976\u5976",
      gender: "\u5973",
      style: "\u6148\u7965",
      desc: "\u9002\u5408\u5976\u5976\u3001\u6148\u7965\u89D2\u8272"
    },
    {
      id: "Chinese (Mandarin)_Cute_Spirit",
      name: "\u61A8\u61A8\u840C\u517D",
      gender: "\u5361\u901A",
      style: "\u61A8\u61A8",
      desc: "\u9002\u5408\u840C\u517D\u3001\u5361\u901A\u89D2\u8272"
    },
    {
      id: "Chinese (Mandarin)_Radio_Host",
      name: "\u7535\u53F0\u7537\u4E3B\u64AD",
      gender: "\u7537",
      style: "\u4E13\u4E1A",
      desc: "\u9002\u5408\u7535\u53F0\u3001\u4E3B\u6301\u89D2\u8272"
    }
  ];
  var VOICE_CN_FRESH = [
    {
      id: "Chinese (Mandarin)_Lyrical_Voice",
      name: "\u6292\u60C5\u7537\u58F0",
      gender: "\u7537",
      style: "\u6292\u60C5",
      desc: "\u9002\u5408\u6292\u60C5\u3001\u6E29\u67D4\u89D2\u8272"
    },
    {
      id: "Chinese (Mandarin)_Straightforward_Boy",
      name: "\u7387\u771F\u5F1F\u5F1F",
      gender: "\u7537",
      style: "\u7387\u771F",
      desc: "\u9002\u5408\u7387\u771F\u3001\u5F1F\u5F1F\u89D2\u8272"
    },
    {
      id: "Chinese (Mandarin)_Sincere_Adult",
      name: "\u771F\u8BDA\u9752\u5E74",
      gender: "\u7537",
      style: "\u771F\u8BDA",
      desc: "\u9002\u5408\u771F\u8BDA\u3001\u9752\u5E74\u89D2\u8272"
    },
    {
      id: "Chinese (Mandarin)_Gentle_Senior",
      name: "\u6E29\u67D4\u5B66\u59D0",
      gender: "\u5973",
      style: "\u6E29\u67D4",
      desc: "\u9002\u5408\u6E29\u67D4\u3001\u5B66\u59D0\u89D2\u8272"
    },
    {
      id: "Chinese (Mandarin)_Stubborn_Friend",
      name: "\u5634\u786C\u7AF9\u9A6C",
      gender: "\u7537",
      style: "\u5634\u786C",
      desc: "\u9002\u5408\u7AF9\u9A6C\u3001\u5634\u786C\u89D2\u8272"
    },
    {
      id: "Chinese (Mandarin)_Crisp_Girl",
      name: "\u6E05\u8106\u5C11\u5973",
      gender: "\u5973",
      style: "\u6E05\u8106",
      desc: "\u9002\u5408\u6E05\u8106\u3001\u5C11\u5973\u89D2\u8272"
    },
    {
      id: "Chinese (Mandarin)_Pure-hearted_Boy",
      name: "\u6E05\u6F88\u90BB\u5BB6\u5F1F\u5F1F",
      gender: "\u7537",
      style: "\u6E05\u6F88",
      desc: "\u9002\u5408\u6E05\u6F88\u3001\u90BB\u5BB6\u5F1F\u5F1F\u89D2\u8272"
    },
    {
      id: "Chinese (Mandarin)_Soft_Girl",
      name: "\u67D4\u548C\u5C11\u5973",
      gender: "\u5973",
      style: "\u67D4\u548C",
      desc: "\u9002\u5408\u67D4\u548C\u3001\u5C11\u5973\u89D2\u8272"
    }
  ];
  var VOICE_CANTONESE = [
    {
      id: "Cantonese_ProfessionalHost\uFF08F)",
      name: "\u4E13\u4E1A\u5973\u4E3B\u6301",
      gender: "\u5973",
      style: "\u4E13\u4E1A",
      desc: "\u9002\u5408\u7CA4\u8BED\u4E3B\u6301\u3001\u65C1\u767D"
    },
    {
      id: "Cantonese_GentleLady",
      name: "\u6E29\u67D4\u5973\u58F0",
      gender: "\u5973",
      style: "\u6E29\u67D4",
      desc: "\u9002\u5408\u7CA4\u8BED\u6E29\u67D4\u89D2\u8272"
    },
    {
      id: "Cantonese_ProfessionalHost\uFF08M)",
      name: "\u4E13\u4E1A\u7537\u4E3B\u6301",
      gender: "\u7537",
      style: "\u4E13\u4E1A",
      desc: "\u9002\u5408\u7CA4\u8BED\u4E3B\u6301\u3001\u65C1\u767D"
    },
    {
      id: "Cantonese_PlayfulMan",
      name: "\u6D3B\u6CFC\u7537\u58F0",
      gender: "\u7537",
      style: "\u6D3B\u6CFC",
      desc: "\u9002\u5408\u7CA4\u8BED\u6D3B\u6CFC\u89D2\u8272"
    },
    {
      id: "Cantonese_CuteGirl",
      name: "\u53EF\u7231\u5973\u5B69",
      gender: "\u5973",
      style: "\u53EF\u7231",
      desc: "\u9002\u5408\u7CA4\u8BED\u53EF\u7231\u89D2\u8272"
    },
    {
      id: "Cantonese_KindWoman",
      name: "\u5584\u826F\u5973\u58F0",
      gender: "\u5973",
      style: "\u5584\u826F",
      desc: "\u9002\u5408\u7CA4\u8BED\u5584\u826F\u89D2\u8272"
    }
  ];
  var VOICE_EN = [
    {
      id: "Santa_Claus",
      name: "Santa Claus",
      gender: "\u7537",
      style: "\u5723\u8BDE",
      desc: "\u5723\u8BDE\u8001\u4EBA\u97F3\u8272"
    },
    {
      id: "Grinch",
      name: "Grinch",
      gender: "\u7537",
      style: "\u53E4\u602A",
      desc: "\u683C\u6797\u5947\u97F3\u8272"
    },
    {
      id: "Rudolph",
      name: "Rudolph",
      gender: "\u7537",
      style: "\u9A6F\u9E7F",
      desc: "\u9C81\u9053\u592B\u97F3\u8272"
    },
    {
      id: "Arnold",
      name: "Arnold",
      gender: "\u7537",
      style: "\u5F3A\u58EE",
      desc: "\u963F\u8BFA\u5FB7\u97F3\u8272"
    },
    {
      id: "Charming_Santa",
      name: "Charming Santa",
      gender: "\u7537",
      style: "\u8FF7\u4EBA",
      desc: "\u8FF7\u4EBA\u5723\u8BDE\u8001\u4EBA"
    },
    {
      id: "Charming_Lady",
      name: "Charming Lady",
      gender: "\u5973",
      style: "\u8FF7\u4EBA",
      desc: "\u8FF7\u4EBA\u5973\u58EB"
    },
    {
      id: "Sweet_Girl",
      name: "Sweet Girl",
      gender: "\u5973",
      style: "\u751C\u7F8E",
      desc: "\u751C\u7F8E\u5973\u5B69"
    },
    {
      id: "Cute_Elf",
      name: "Cute Elf",
      gender: "\u5361\u901A",
      style: "\u53EF\u7231",
      desc: "\u53EF\u7231\u7CBE\u7075"
    },
    {
      id: "Attractive_Girl",
      name: "Attractive Girl",
      gender: "\u5973",
      style: "\u8FF7\u4EBA",
      desc: "\u8FF7\u4EBA\u5973\u5B69"
    },
    {
      id: "Serene_Woman",
      name: "Serene Woman",
      gender: "\u5973",
      style: "\u5B81\u9759",
      desc: "\u5B81\u9759\u5973\u58EB"
    },
    {
      id: "English_Trustworthy_Man",
      name: "Trustworthy Man",
      gender: "\u7537",
      style: "\u53EF\u9760",
      desc: "\u53EF\u9760\u7537\u58EB"
    },
    {
      id: "English_Graceful_Lady",
      name: "Graceful Lady",
      gender: "\u5973",
      style: "\u4F18\u96C5",
      desc: "\u4F18\u96C5\u5973\u58EB"
    },
    {
      id: "English_Aussie_Bloke",
      name: "Aussie Bloke",
      gender: "\u7537",
      style: "\u6FB3\u6D32",
      desc: "\u6FB3\u6D32\u5C0F\u4F19"
    },
    {
      id: "English_Whispering_girl",
      name: "Whispering Girl",
      gender: "\u5973",
      style: "\u8033\u8BED",
      desc: "\u8033\u8BED\u5973\u5B69"
    },
    {
      id: "English_Diligent_Man",
      name: "Diligent Man",
      gender: "\u7537",
      style: "\u52E4\u594B",
      desc: "\u52E4\u594B\u7537\u58EB"
    },
    {
      id: "English_Gentle-voiced_man",
      name: "Gentle-voiced Man",
      gender: "\u7537",
      style: "\u6E29\u67D4",
      desc: "\u6E29\u67D4\u7537\u58F0"
    }
  ];
  var VOICE_OPTIONS = [
    ...VOICE_CN_BASIC,
    ...VOICE_CN_PREMIUM,
    ...VOICE_CN_CHARACTER,
    ...VOICE_CN_CHILD,
    ...VOICE_CN_SPECIAL,
    ...VOICE_CN_FRESH,
    ...VOICE_CANTONESE,
    ...VOICE_EN
  ];
  var EMOTION_OPTIONS = [
    { id: "", name: "\u9ED8\u8BA4\uFF08\u81EA\u52A8\uFF09" },
    { id: "happy", name: "\u5F00\u5FC3" },
    { id: "sad", name: "\u60B2\u4F24" },
    { id: "angry", name: "\u6124\u6012" },
    { id: "calm", name: "\u5E73\u9759" },
    { id: "fear", name: "\u6050\u60E7" },
    { id: "surprise", name: "\u60CA\u8BB6" },
    { id: "disgust", name: "\u538C\u6076" }
  ];
  var MODEL_OPTIONS = [
    { id: "speech-2.8-hd", name: "\u9AD8\u6E05\uFF08HD\uFF09", desc: "\u97F3\u8D28\u66F4\u597D\uFF0C\u901F\u5EA6\u7A0D\u6162" },
    { id: "speech-2.8-turbo", name: "\u5FEB\u901F\uFF08Turbo\uFF09", desc: "\u901F\u5EA6\u66F4\u5FEB\uFF0C\u97F3\u8D28\u7A0D\u900A" }
  ];
  var VOICE_PROMPT_TEMPLATES = [
    {
      label: "\u6E29\u67D4\u5973\u4E3B",
      prompt: "\u6E29\u67D4\u7684\u5E74\u8F7B\u5973\u6027\u58F0\u97F3\uFF0C\u8BED\u901F\u9002\u4E2D\uFF0C\u60C5\u611F\u4E30\u5BCC\uFF0C\u7565\u5E26\u6C99\u54D1\uFF0C\u8BF4\u8BDD\u8282\u594F\u7F13\u6162"
    },
    {
      label: "\u6C89\u7A33\u7537\u4E3B",
      prompt: "\u6C89\u7A33\u7684\u4E2D\u5E74\u7537\u6027\u58F0\u97F3\uFF0C\u4F4E\u6C89\u6709\u78C1\u6027\uFF0C\u8BED\u901F\u504F\u6162\uFF0C\u8BED\u6C14\u575A\u5B9A\u6709\u529B"
    },
    {
      label: "\u9633\u5149\u5C11\u5E74",
      prompt: "\u9633\u5149\u5F00\u6717\u7684\u5C11\u5E74\u7537\u6027\u58F0\u97F3\uFF0C\u6E05\u4EAE\u6709\u6D3B\u529B\uFF0C\u8BED\u901F\u504F\u5FEB\uFF0C\u5145\u6EE1\u671D\u6C14"
    },
    {
      label: "\u51B7\u8273\u5FA1\u59D0",
      prompt: "\u51B7\u8273\u9AD8\u8D35\u7684\u6210\u719F\u5973\u6027\u58F0\u97F3\uFF0C\u7565\u5E26\u6C99\u54D1\uFF0C\u8BED\u901F\u9002\u4E2D\uFF0C\u6C14\u573A\u5F3A\u5927"
    },
    {
      label: "\u9634\u72E0\u53CD\u6D3E",
      prompt: "\u9634\u72E0\u72E1\u8BC8\u7684\u7537\u6027\u58F0\u97F3\uFF0C\u4F4E\u6C89\u9634\u51B7\uFF0C\u8BED\u901F\u504F\u6162\uFF0C\u8BED\u6C14\u4E2D\u5E26\u7740\u5A01\u80C1\u611F"
    },
    {
      label: "\u751C\u7F8E\u5C11\u5973",
      prompt: "\u751C\u7F8E\u7684\u5C11\u5973\u58F0\u97F3\uFF0C\u6E05\u4EAE\u53EF\u7231\uFF0C\u8BED\u901F\u504F\u5FEB\uFF0C\u5145\u6EE1\u6D3B\u529B\u548C\u9752\u6625\u611F"
    },
    {
      label: "\u6CA7\u6851\u8001\u4EBA",
      prompt: "\u6CA7\u6851\u7684\u8001\u5E74\u7537\u6027\u58F0\u97F3\uFF0C\u4F4E\u6C89\u6C99\u54D1\uFF0C\u8BED\u901F\u504F\u6162\uFF0C\u5E26\u7740\u5C81\u6708\u7684\u75D5\u8FF9"
    },
    {
      label: "\u6D3B\u6CFC\u641E\u7B11",
      prompt: "\u6D3B\u6CFC\u641E\u7B11\u7684\u5E74\u8F7B\u7537\u6027\u58F0\u97F3\uFF0C\u8BED\u901F\u5FEB\uFF0C\u8BED\u8C03\u5938\u5F20\uFF0C\u5145\u6EE1\u559C\u5267\u611F"
    }
  ];
  var DISPATCH_BASE_URL = "https://api.jinsuai.cn";
  function getAuthToken() {
    return localStorage.getItem("DISPATCH_TOKEN") || localStorage.getItem("dispatch_token") || localStorage.getItem("token") || "";
  }
  async function synthesizeSpeech(text, voiceId, speed = 1, emotion = "", model = "") {
    try {
      const token2 = getAuthToken();
      const response = await fetch(`${DISPATCH_BASE_URL}/api/tts/synthesize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...token2 ? { Authorization: `Bearer ${token2}` } : {}
        },
        body: JSON.stringify({
          text,
          voice_id: voiceId,
          speed,
          emotion,
          model: model || "speech-2.8-hd",
          format: "mp3"
        })
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`TTS API\u9519\u8BEF: ${response.status} - ${errText}`);
      }
      const data = await response.json();
      if (data.audio_url) {
        console.log(
          "[TTS] \u97F3\u9891\u5408\u6210\u6210\u529F:",
          data.audio_url,
          "\u4F7F\u7528\u79EF\u5206:",
          data.credits_used
        );
        return data.audio_url;
      }
      throw new Error("TTS\u5408\u6210\u5931\u8D25\uFF1A\u672A\u8FD4\u56DE\u97F3\u9891URL");
    } catch (e) {
      console.error("[TTS] \u5408\u6210\u5931\u8D25:", e);
      if (e.message === "Failed to fetch" || e.name === "TypeError") {
        throw new Error(
          "TTS API\u8BF7\u6C42\u5931\u8D25\uFF08\u7F51\u7EDC\u9519\u8BEF\uFF09\u3002\u8BF7\u68C0\u67E5\u7F51\u7EDC\u8FDE\u63A5\u6216\u7A0D\u540E\u91CD\u8BD5\u3002"
        );
      }
      throw e;
    }
  }
  async function loadCustomVoices() {
    try {
      const token2 = getAuthToken();
      if (!token2) return [];
      const response = await fetch(`${DISPATCH_BASE_URL}/api/tts/voices`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token2}`
        }
      });
      if (!response.ok) return [];
      const data = await response.json();
      if (Array.isArray(data)) {
        return data.map((v) => ({
          id: v.voice_id || `saved_${v.id}`,
          name: v.name,
          gender: "\u81EA\u5B9A\u4E49",
          style: (v.voice_design || "").substring(0, 20) + "...",
          desc: "\u5DF2\u4FDD\u5B58\u7684\u81EA\u5B9A\u4E49\u97F3\u8272",
          prompt: v.voice_design,
          isCustom: true,
          savedId: v.id
        })).filter((v) => v.id && v.id !== `saved_${v.savedId}`);
      }
      return [];
    } catch (e) {
      console.error("[TTS] \u52A0\u8F7D\u81EA\u5B9A\u4E49\u97F3\u8272\u5931\u8D25:", e);
      return [];
    }
  }
  async function saveCustomVoice(name, voiceDesign, voiceId) {
    try {
      const token2 = getAuthToken();
      if (!token2) return null;
      const response = await fetch(`${DISPATCH_BASE_URL}/api/tts/voices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token2}`
        },
        body: JSON.stringify({
          name,
          voice_design: voiceDesign,
          voice_id: voiceId
        })
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (e) {
      console.error("[TTS] \u4FDD\u5B58\u81EA\u5B9A\u4E49\u97F3\u8272\u5931\u8D25:", e);
      return null;
    }
  }
  async function createVoiceByPrompt(voicePrompt, previewText, preferredName = "custom") {
    try {
      const token2 = getAuthToken();
      const response = await fetch(`${DISPATCH_BASE_URL}/api/tts/voice-design`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...token2 ? { Authorization: `Bearer ${token2}` } : {}
        },
        body: JSON.stringify({
          voice_prompt: voicePrompt,
          preview_text: previewText,
          preferred_name: preferredName
        })
      });
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`\u58F0\u97F3\u8BBE\u8BA1\u5931\u8D25: ${response.status} - ${err}`);
      }
      const data = await response.json();
      if (data.success) {
        return {
          voiceId: data.voice_id,
          targetModel: data.target_model,
          requestId: data.request_id
        };
      }
      throw new Error("\u58F0\u97F3\u8BBE\u8BA1\u5931\u8D25\uFF1A\u672A\u8FD4\u56DEvoice_id");
    } catch (e) {
      if (e.message === "Failed to fetch" || e.name === "TypeError") {
        throw new Error("\u7F51\u7EDC\u8BF7\u6C42\u5931\u8D25\u3002\u8BF7\u68C0\u67E5\u7F51\u7EDC\u8FDE\u63A5\u6216\u7A0D\u540E\u91CD\u8BD5\u3002");
      }
      throw e;
    }
  }
  function extractDialogues(project2) {
    const dialogues = [];
    const shots = project2?.shots || [];
    shots.forEach((shot, shotIndex) => {
      const shotKey = shot.id || `idx${shotIndex}`;
      const shotDialogues = shot.dialogues || [];
      if (shotDialogues.length > 0) {
        shotDialogues.forEach((d, dIndex) => {
          dialogues.push({
            id: `dlg_${shotKey}_${dIndex}`,
            legacyId: `dlg_${shotIndex}_${dIndex}`,
            shotId: shot.id,
            shotTitle: shot.title || `\u955C\u5934${shotIndex + 1}`,
            character: d.character || "\u672A\u77E5",
            text: d.text || d.content || "",
            voiceId: null,
            emotion: "",
            audioUrl: null,
            status: "pending"
          });
        });
      } else if (shot.dialogue && shot.dialogue.trim()) {
        const character = shot.characters && shot.characters.length > 0 ? shot.characters[0] : "\u89D2\u8272";
        dialogues.push({
          id: `dlg_${shotKey}_0`,
          legacyId: `dlg_${shotIndex}_0`,
          shotId: shot.id,
          shotTitle: shot.title || `\u955C\u5934${shotIndex + 1}`,
          character,
          text: shot.dialogue,
          voiceId: null,
          emotion: "",
          audioUrl: null,
          status: "pending"
        });
      }
    });
    return dialogues;
  }
  function DubbingBoard({ project: project2, update, log, incomingChunk = "", incomingAudio = null, chunkNonce = 0 }) {
    const [dialogues, setDialogues] = (0, import_react9.useState)(() => extractDialogues(project2));
    const [selectedDialogueIds, setSelectedDialogueIds] = (0, import_react9.useState)([]);
    const [selectedVoice, setSelectedVoice] = (0, import_react9.useState)("female-yujie");
    const [speed, setSpeed] = (0, import_react9.useState)(1);
    const [emotion, setEmotion] = (0, import_react9.useState)("");
    const [ttsModel, setTtsModel] = (0, import_react9.useState)("speech-2.8-hd");
    const [generatingId, setGeneratingId] = (0, import_react9.useState)(null);
    const [playingId, setPlayingId] = (0, import_react9.useState)(null);
    const [characterVoices, setCharacterVoices] = (0, import_react9.useState)({});
    const [filterCharacter, setFilterCharacter] = (0, import_react9.useState)("all");
    const [customVoices, setCustomVoices] = (0, import_react9.useState)([]);
    const [showVoiceDesigner, setShowVoiceDesigner] = (0, import_react9.useState)(false);
    const [voicePrompt, setVoicePrompt] = (0, import_react9.useState)("");
    const [previewText, setPreviewText] = (0, import_react9.useState)("\u5927\u5BB6\u597D\uFF0C\u8FD9\u662F\u6211\u7528\u6587\u5B57\u521B\u5EFA\u7684\u4E13\u5C5E\u97F3\u8272\u3002");
    const [voiceName, setVoiceName] = (0, import_react9.useState)("");
    const [creatingVoice, setCreatingVoice] = (0, import_react9.useState)(false);
    const audioRef = (0, import_react9.useRef)(null);
    const [editingId, setEditingId] = (0, import_react9.useState)(null);
    const [editText, setEditText] = (0, import_react9.useState)("");
    const [editingCharacterId, setEditingCharacterId] = (0, import_react9.useState)(null);
    const [editCharacter, setEditCharacter] = (0, import_react9.useState)("");
    const [showAddDialog, setShowAddDialog] = (0, import_react9.useState)(false);
    const [addCharacter, setAddCharacter] = (0, import_react9.useState)("");
    const [addText, setAddText] = (0, import_react9.useState)("");
    (0, import_react9.useEffect)(() => {
      const newDialogues = extractDialogues(project2);
      const savedDubbingData = project2?.dubbingData || {};
      setDialogues((prev) => {
        const prevMap = new Map(prev.map((d) => [d.id, d]));
        return newDialogues.map((d) => {
          const prevDlg = prevMap.get(d.id) || prevMap.get(d.legacyId);
          const savedDlg = savedDubbingData[d.id] || savedDubbingData[d.legacyId];
          const audioUrl = prevDlg?.audioUrl || savedDlg?.audioUrl;
          if (audioUrl) {
            return {
              ...d,
              audioUrl,
              status: "done",
              voiceId: prevDlg?.voiceId || savedDlg?.voiceId,
              emotion: prevDlg?.emotion || savedDlg?.emotion
            };
          }
          return d;
        });
      });
      const loadVoices = async () => {
        const savedVoices = await loadCustomVoices();
        if (savedVoices.length > 0) {
          setCustomVoices((prev) => {
            const existingIds = new Set(prev.map((v) => v.id));
            const newVoices = savedVoices.filter((v) => !existingIds.has(v.id));
            return [...prev, ...newVoices];
          });
        }
      };
      loadVoices();
    }, [project2?.shots]);
    const characters = [
      ...new Set(dialogues.map((d) => d.character).filter(Boolean))
    ];
    const filteredDialogues = filterCharacter === "all" ? dialogues : dialogues.filter((d) => d.character === filterCharacter);
    const allVoices = [...VOICE_OPTIONS, ...customVoices];
    const handleAddDialog = () => {
      let charName = "\u81EA\u5B9A\u4E49";
      let dialogText = addText.trim();
      const colonIndex = addText.indexOf("\uFF1A");
      const colonIndexEn = addText.indexOf(":");
      const splitIndex = colonIndex !== -1 ? colonIndex : colonIndexEn;
      if (splitIndex > 0 && splitIndex < addText.length - 1) {
        charName = addText.substring(0, splitIndex).trim();
        dialogText = addText.substring(splitIndex + 1).trim();
      }
      if (!dialogText) {
        alert("\u8BF7\u586B\u5199\u53F0\u8BCD\u5185\u5BB9\uFF08\u683C\u5F0F\uFF1A\u89D2\u8272\u540D\uFF1A\u53F0\u8BCD\u5185\u5BB9\uFF09");
        return;
      }
      const newDialog = {
        id: "dlg_custom_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8),
        character: charName,
        text: dialogText,
        shotTitle: "\u81EA\u5B9A\u4E49",
        shotId: null,
        status: "pending",
        audioUrl: null,
        isCustom: true
      };
      setDialogues((prev) => [...prev, newDialog]);
      setAddCharacter("");
      setAddText("");
      setShowAddDialog(false);
      log(`\u2705 \u5DF2\u6DFB\u52A0\u81EA\u5B9A\u4E49\u53F0\u8BCD\uFF1A${charName} - ${dialogText.substring(0, 20)}...`);
    };
    (0, import_react9.useEffect)(() => {
      if (!chunkNonce) return;
      const raw = String(incomingChunk || "").trim();
      if (!raw) return;
      const m = raw.match(/^【素材·(.+?)】\s*([\s\S]*)$/);
      const charName = m ? m[1].trim() : "\u7D20\u6750";
      const body = (m ? m[2] : raw).trim() || charName;
      const newDialog = {
        id: "dlg_asset_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8),
        character: charName,
        text: body,
        shotTitle: "\u7D20\u6750\u5E93",
        shotId: null,
        status: "pending",
        audioUrl: incomingAudio || null,
        isCustom: true
      };
      setDialogues((prev) => [...prev, newDialog]);
      log?.(`\u2705 \u5DF2\u52A0\u5165\u7D20\u6750\u53F0\u8BCD\uFF1A${charName} - ${body.substring(0, 20)}...`);
    }, [chunkNonce]);
    const handleStartEdit = (dlg) => {
      setEditingId(dlg.id);
      setEditText(dlg.text);
    };
    const handleSaveEdit = (dlgId) => {
      if (!editText.trim()) {
        alert("\u53F0\u8BCD\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A");
        return;
      }
      setDialogues(
        (prev) => prev.map(
          (d) => d.id === dlgId ? {
            ...d,
            text: editText.trim(),
            status: d.audioUrl ? d.status : "pending"
          } : d
        )
      );
      setEditingId(null);
      setEditText("");
      log(`\u2705 \u53F0\u8BCD\u5DF2\u66F4\u65B0`);
    };
    const handleCancelEdit = () => {
      setEditingId(null);
      setEditText("");
    };
    const handleStartEditCharacter = (dlg) => {
      setEditingCharacterId(dlg.id);
      setEditCharacter(dlg.character);
    };
    const handleSaveEditCharacter = (dlgId) => {
      if (!editCharacter.trim()) {
        alert("\u89D2\u8272\u540D\u4E0D\u80FD\u4E3A\u7A7A");
        return;
      }
      setDialogues(
        (prev) => prev.map(
          (d) => d.id === dlgId ? { ...d, character: editCharacter.trim() } : d
        )
      );
      setEditingCharacterId(null);
      setEditCharacter("");
      log(`\u2705 \u89D2\u8272\u540D\u5DF2\u66F4\u65B0\u4E3A\uFF1A${editCharacter.trim()}`);
    };
    const handleCancelEditCharacter = () => {
      setEditingCharacterId(null);
      setEditCharacter("");
    };
    const handleDeleteDialog = (dlgId) => {
      if (!confirm("\u786E\u5B9A\u8981\u5220\u9664\u8FD9\u6761\u53F0\u8BCD\u5417\uFF1F")) return;
      setDialogues((prev) => prev.filter((d) => d.id !== dlgId));
      log(`\u{1F5D1}\uFE0F \u53F0\u8BCD\u5DF2\u5220\u9664`);
    };
    const generateOne = async (dlg) => {
      if (!dlg.text.trim()) {
        log(`\u26A0\uFE0F\u300C${dlg.character}\u300D\u53F0\u8BCD\u4E3A\u7A7A\uFF0C\u8DF3\u8FC7`);
        return;
      }
      if (!isLoggedIn()) {
        alert("\u8BF7\u5148\u767B\u5F55\u540E\u518D\u4F7F\u7528\u914D\u97F3\u751F\u6210\u529F\u80FD");
        return;
      }
      setGeneratingId(dlg.id);
      setDialogues(
        (prev) => prev.map((d) => d.id === dlg.id ? { ...d, status: "generating" } : d)
      );
      log(`\u6B63\u5728\u4E3A\u300C${dlg.character}\u300D\u751F\u6210\u914D\u97F3\uFF1A${dlg.text.substring(0, 20)}...`);
      try {
        const voiceId = dlg.voiceId || characterVoices[dlg.character] || selectedVoice;
        const dialogueEmotion = dlg.emotion !== void 0 && dlg.emotion !== "" ? dlg.emotion : emotion;
        const audioUrl = await synthesizeSpeech(
          dlg.text,
          voiceId,
          speed,
          dialogueEmotion,
          ttsModel
        );
        setDialogues(
          (prev) => prev.map(
            (d) => d.id === dlg.id ? {
              ...d,
              audioUrl,
              status: audioUrl ? "done" : "failed",
              voiceId,
              emotion: dialogueEmotion
            } : d
          )
        );
        if (audioUrl) {
          try {
            const currentAssets = project2?.assets || [];
            const newAudioAsset = {
              id: "a_audio_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8),
              type: "audio",
              title: `${dlg.character}\u914D\u97F3\uFF08${(/* @__PURE__ */ new Date()).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}\uFF09`,
              url: audioUrl,
              status: "ready",
              tags: ["\u914D\u97F3\u751F\u6210", dlg.character, voiceId],
              favorite: false,
              dialogueId: dlg.id,
              character: dlg.character,
              voiceId,
              text: dlg.text,
              createdAt: Date.now()
            };
            const currentDubbingData = project2?.dubbingData || {};
            const newDubbingData = {
              ...currentDubbingData,
              [dlg.id]: {
                audioUrl,
                voiceId,
                emotion: dialogueEmotion,
                character: dlg.character,
                text: dlg.text,
                createdAt: Date.now()
              }
            };
            update({
              assets: [newAudioAsset, ...currentAssets],
              dubbingData: newDubbingData
            });
            log(`\u2705 \u914D\u97F3\u5DF2\u5B58\u5165\u7D20\u6750\u5E93\uFF1A${newAudioAsset.title}`);
          } catch (e) {
            log(`\u26A0\uFE0F \u914D\u97F3\u5B58\u5165\u7D20\u6750\u5E93\u5931\u8D25\uFF1A${e.message}`);
          }
        }
        log(`\u2705\u300C${dlg.character}\u300D\u914D\u97F3\u751F\u6210\u6210\u529F`);
        if (isLoggedIn()) {
          try {
            const balanceData = await getCreditBalance();
            if (window.onCreditUpdate)
              window.onCreditUpdate(
                balanceData.balance || balanceData.credits || 0
              );
            if (window.refreshUserInfo) window.refreshUserInfo();
          } catch (e) {
          }
        }
      } catch (e) {
        setDialogues(
          (prev) => prev.map((d) => d.id === dlg.id ? { ...d, status: "failed" } : d)
        );
        log(`\u274C\u300C${dlg.character}\u300D\u914D\u97F3\u751F\u6210\u5931\u8D25\uFF1A${e.message}`);
      } finally {
        setGeneratingId(null);
      }
    };
    const generateAll = async () => {
      let pending;
      if (selectedDialogueIds.length > 0) {
        pending = filteredDialogues.filter(
          (d) => selectedDialogueIds.includes(d.id) && d.text.trim()
        );
        log(`\u5F00\u59CB\u6279\u91CF\u751F\u6210\u9009\u4E2D\u7684\u914D\u97F3\uFF0C\u5171${pending.length}\u6761...`);
      } else {
        pending = filteredDialogues.filter(
          (d) => d.status !== "done" && d.text.trim()
        );
        log(`\u5F00\u59CB\u6279\u91CF\u751F\u6210\u6240\u6709\u672A\u5B8C\u6210\u7684\u914D\u97F3\uFF0C\u5171${pending.length}\u6761...`);
      }
      for (const dlg of pending) {
        await generateOne(dlg);
      }
      log(`\u2705 \u6279\u91CF\u914D\u97F3\u751F\u6210\u5B8C\u6210`);
    };
    const toggleDialogueSelection = (id) => {
      setSelectedDialogueIds((prev) => {
        if (prev.includes(id)) {
          return prev.filter((i) => i !== id);
        } else {
          return [...prev, id];
        }
      });
    };
    const toggleSelectAll = () => {
      const pendingIds = filteredDialogues.filter((d) => d.status !== "done" && d.text.trim()).map((d) => d.id);
      if (selectedDialogueIds.length === pendingIds.length && pendingIds.length > 0) {
        setSelectedDialogueIds([]);
      } else {
        setSelectedDialogueIds(pendingIds);
      }
    };
    const playAudio = (dlg) => {
      if (!dlg.audioUrl) return;
      if (playingId === dlg.id) {
        audioRef.current?.pause();
        setPlayingId(null);
        return;
      }
      if (audioRef.current) audioRef.current.pause();
      audioRef.current = new Audio(dlg.audioUrl);
      audioRef.current.onended = () => setPlayingId(null);
      audioRef.current.play();
      setPlayingId(dlg.id);
    };
    const setCharacterVoice = (character, voiceId) => {
      setCharacterVoices((prev) => ({ ...prev, [character]: voiceId }));
      const voice = allVoices.find((v) => v.id === voiceId);
      log(`\u5DF2\u8BBE\u7F6E\u300C${character}\u300D\u7684\u97F3\u8272\u4E3A\uFF1A${voice?.name || voiceId}`);
    };
    const handleCreateVoice = async () => {
      if (!voicePrompt.trim()) {
        log("\u26A0\uFE0F \u8BF7\u8F93\u5165\u58F0\u97F3\u63CF\u8FF0");
        return;
      }
      if (!previewText.trim()) {
        log("\u26A0\uFE0F \u8BF7\u8F93\u5165\u9884\u89C8\u6587\u672C");
        return;
      }
      if (!isLoggedIn()) {
        alert("\u8BF7\u5148\u767B\u5F55\u540E\u518D\u4F7F\u7528\u6587\u5B57\u521B\u5EFA\u97F3\u8272\u529F\u80FD");
        return;
      }
      try {
        const precheck2 = await precheckCredits(5, "text", "\u6587\u5B57\u521B\u5EFA\u97F3\u8272");
        if (!precheck2.sufficient && precheck2.sufficient !== void 0) {
          log(`\u274C \u79EF\u5206\u4E0D\u8DB3\uFF1A\u9700\u89815\u79EF\u5206\uFF0C\u5F53\u524D\u4F59\u989D${precheck2.balance || 0}\u79EF\u5206`);
          alert(
            `\u79EF\u5206\u4E0D\u8DB3\uFF01\u6587\u5B57\u521B\u5EFA\u97F3\u8272\u9700\u89815\u79EF\u5206\uFF0C\u5F53\u524D\u4F59\u989D${precheck2.balance || 0}\u79EF\u5206\u3002\u8BF7\u5145\u503C\u540E\u518D\u8BD5\u3002`
          );
          return;
        }
      } catch (e) {
        log(`\u26A0\uFE0F \u79EF\u5206\u9884\u6821\u9A8C\u5931\u8D25\uFF1A${e.message}`);
      }
      setCreatingVoice(true);
      log(`\u6B63\u5728\u7528\u6587\u5B57\u521B\u5EFA\u97F3\u8272\uFF1A${voicePrompt.substring(0, 20)}...`);
      try {
        const result = await createVoiceByPrompt(
          voicePrompt,
          previewText,
          voiceName.trim() || `custom_${Date.now()}`
        );
        const newVoice = {
          id: result.voiceId,
          name: voiceName.trim() || `\u81EA\u5B9A\u4E49\u97F3\u8272${customVoices.length + 1}`,
          gender: "\u81EA\u5B9A\u4E49",
          style: voicePrompt.substring(0, 20) + "...",
          desc: "\u6587\u5B57\u521B\u5EFA\u7684\u4E13\u5C5E\u97F3\u8272",
          prompt: voicePrompt,
          isCustom: true
        };
        setCustomVoices((prev) => [...prev, newVoice]);
        log(`\u2705 \u97F3\u8272\u521B\u5EFA\u6210\u529F\uFF1A${newVoice.name}\uFF08ID: ${result.voiceId}\uFF09`);
        try {
          await saveCustomVoice(newVoice.name, voicePrompt, result.voiceId);
          log(`\u2705 \u97F3\u8272\u5DF2\u4FDD\u5B58\u5230\u4E91\u7AEF`);
        } catch (e) {
          log(`\u26A0\uFE0F \u97F3\u8272\u4FDD\u5B58\u5230\u4E91\u7AEF\u5931\u8D25\uFF1A${e.message}`);
        }
        if (isLoggedIn()) {
          try {
            await deductCredits(5, "text", "\u6587\u5B57\u521B\u5EFA\u97F3\u8272", result.voiceId);
            log(`\u2705 \u79EF\u5206\u6263\u51CF\u6210\u529F\uFF1A5\u79EF\u5206`);
            try {
              const balanceData = await getCreditBalance();
              if (window.onCreditUpdate)
                window.onCreditUpdate(
                  balanceData.balance || balanceData.credits || 0
                );
              if (window.refreshUserInfo) window.refreshUserInfo();
            } catch (e) {
            }
          } catch (e) {
            log(`\u26A0\uFE0F \u79EF\u5206\u6263\u51CF\u5931\u8D25\uFF1A${e.message}`);
          }
        }
        setShowVoiceDesigner(false);
        setVoicePrompt("");
        setVoiceName("");
      } catch (e) {
        log(`\u274C \u97F3\u8272\u521B\u5EFA\u5931\u8D25\uFF1A${e.message}`);
      } finally {
        setCreatingVoice(false);
      }
    };
    const exportDubbing = () => {
      const data = {
        version: "1.0",
        exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
        customVoices,
        characterVoices,
        dialogues: dialogues.filter((d) => d.audioUrl).map((d) => ({
          shotId: d.shotId,
          character: d.character,
          text: d.text,
          audioUrl: d.audioUrl
        }))
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json"
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project2?.title || "dubbing"}_\u914D\u97F3\u6570\u636E.json`;
      a.click();
      URL.revokeObjectURL(url);
      log(`\u2705 \u5DF2\u5BFC\u51FA\u914D\u97F3\u6570\u636E\uFF08${data.dialogues.length}\u6761\uFF09`);
    };
    const stats = {
      total: dialogues.length,
      done: dialogues.filter((d) => d.status === "done").length,
      pending: dialogues.filter((d) => d.status === "pending").length,
      failed: dialogues.filter((d) => d.status === "failed").length
    };
    return /* @__PURE__ */ import_react9.default.createElement(
      "div",
      {
        style: {
          display: "flex",
          height: "100%",
          background: "var(--bg, #0f0f1a)"
        }
      },
      /* @__PURE__ */ import_react9.default.createElement(
        "div",
        {
          style: {
            width: 280,
            background: "var(--panel, #1a1a2e)",
            borderRight: "1px solid var(--border, #2a2a4a)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }
        },
        /* @__PURE__ */ import_react9.default.createElement(
          "div",
          {
            style: {
              padding: 16,
              borderBottom: "1px solid var(--border, #2a2a4a)"
            }
          },
          /* @__PURE__ */ import_react9.default.createElement(
            "div",
            {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12
              }
            },
            /* @__PURE__ */ import_react9.default.createElement("h2", { style: { margin: 0, fontSize: 18, color: "var(--text, #fff)" } }, "\u{1F399}\uFE0F \u914D\u97F3\u5DE5\u4F5C\u5BA4"),
            /* @__PURE__ */ import_react9.default.createElement(
              "button",
              {
                onClick: () => setShowAddDialog(true),
                style: {
                  padding: "6px 14px",
                  border: "none",
                  borderRadius: 6,
                  background: "linear-gradient(135deg, #10b981, #059669)",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600
                }
              },
              "\u2795 \u6DFB\u52A0\u53F0\u8BCD"
            )
          ),
          /* @__PURE__ */ import_react9.default.createElement(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginBottom: 12
              }
            },
            /* @__PURE__ */ import_react9.default.createElement(
              "div",
              {
                style: {
                  padding: 8,
                  background: "rgba(122,92,255,0.1)",
                  borderRadius: 6,
                  textAlign: "center"
                }
              },
              /* @__PURE__ */ import_react9.default.createElement("div", { style: { fontSize: 18, fontWeight: 600, color: "#7a5cff" } }, stats.total),
              /* @__PURE__ */ import_react9.default.createElement("div", { style: { fontSize: 10, color: "var(--text-muted, #888)" } }, "\u603B\u53F0\u8BCD")
            ),
            /* @__PURE__ */ import_react9.default.createElement(
              "div",
              {
                style: {
                  padding: 8,
                  background: "rgba(16,185,129,0.1)",
                  borderRadius: 6,
                  textAlign: "center"
                }
              },
              /* @__PURE__ */ import_react9.default.createElement("div", { style: { fontSize: 18, fontWeight: 600, color: "#10b981" } }, stats.done),
              /* @__PURE__ */ import_react9.default.createElement("div", { style: { fontSize: 10, color: "var(--text-muted, #888)" } }, "\u5DF2\u5B8C\u6210")
            )
          )
        ),
        /* @__PURE__ */ import_react9.default.createElement(
          "div",
          {
            style: {
              padding: 12,
              borderBottom: "1px solid var(--border, #2a2a4a)"
            }
          },
          /* @__PURE__ */ import_react9.default.createElement(
            "div",
            {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8
              }
            },
            /* @__PURE__ */ import_react9.default.createElement("span", { style: { fontSize: 12, color: "var(--text-muted, #888)" } }, "\u9ED8\u8BA4\u97F3\u8272"),
            /* @__PURE__ */ import_react9.default.createElement(
              "button",
              {
                onClick: () => setShowVoiceDesigner(true),
                style: {
                  padding: "3px 8px",
                  border: "1px solid #7a5cff",
                  borderRadius: 4,
                  background: "rgba(122,92,255,0.1)",
                  color: "#7a5cff",
                  cursor: "pointer",
                  fontSize: 10,
                  fontWeight: 600
                }
              },
              "\u2728 \u6587\u5B57\u521B\u5EFA\u97F3\u8272"
            )
          ),
          /* @__PURE__ */ import_react9.default.createElement(
            "select",
            {
              value: selectedVoice,
              onChange: (e) => setSelectedVoice(e.target.value),
              style: {
                width: "100%",
                padding: "8px 10px",
                border: "1px solid var(--border, #2a2a4a)",
                borderRadius: 6,
                background: "var(--input-bg, #15152a)",
                color: "var(--text, #fff)",
                fontSize: 12,
                marginBottom: 8
              }
            },
            /* @__PURE__ */ import_react9.default.createElement("optgroup", { label: "\u4E2D\u6587-\u57FA\u7840\u97F3\u8272" }, VOICE_CN_BASIC.map((v) => /* @__PURE__ */ import_react9.default.createElement("option", { key: v.id, value: v.id }, v.name, "\uFF08", v.gender, "\uFF09- ", v.style))),
            /* @__PURE__ */ import_react9.default.createElement("optgroup", { label: "\u4E2D\u6587-\u7CBE\u54C1\u97F3\u8272(Beta)" }, VOICE_CN_PREMIUM.map((v) => /* @__PURE__ */ import_react9.default.createElement("option", { key: v.id, value: v.id }, v.name, "\uFF08", v.gender, "\uFF09- ", v.style))),
            /* @__PURE__ */ import_react9.default.createElement("optgroup", { label: "\u4E2D\u6587-\u89D2\u8272\u97F3\u8272" }, VOICE_CN_CHARACTER.map((v) => /* @__PURE__ */ import_react9.default.createElement("option", { key: v.id, value: v.id }, v.name, "\uFF08", v.gender, "\uFF09- ", v.style))),
            /* @__PURE__ */ import_react9.default.createElement("optgroup", { label: "\u4E2D\u6587-\u7279\u8272\u97F3\u8272" }, VOICE_CN_SPECIAL.map((v) => /* @__PURE__ */ import_react9.default.createElement("option", { key: v.id, value: v.id }, v.name, "\uFF08", v.gender, "\uFF09- ", v.style))),
            /* @__PURE__ */ import_react9.default.createElement("optgroup", { label: "\u4E2D\u6587-\u6E05\u65B0\u97F3\u8272" }, VOICE_CN_FRESH.map((v) => /* @__PURE__ */ import_react9.default.createElement("option", { key: v.id, value: v.id }, v.name, "\uFF08", v.gender, "\uFF09- ", v.style))),
            /* @__PURE__ */ import_react9.default.createElement("optgroup", { label: "\u4E2D\u6587-\u513F\u7AE5/\u5361\u901A\u97F3\u8272" }, VOICE_CN_CHILD.map((v) => /* @__PURE__ */ import_react9.default.createElement("option", { key: v.id, value: v.id }, v.name, "\uFF08", v.gender, "\uFF09- ", v.style))),
            /* @__PURE__ */ import_react9.default.createElement("optgroup", { label: "\u4E2D\u6587(\u7CA4\u8BED)\u97F3\u8272" }, VOICE_CANTONESE.map((v) => /* @__PURE__ */ import_react9.default.createElement("option", { key: v.id, value: v.id }, v.name, "\uFF08", v.gender, "\uFF09- ", v.style))),
            /* @__PURE__ */ import_react9.default.createElement("optgroup", { label: "\u82F1\u6587\u97F3\u8272" }, VOICE_EN.map((v) => /* @__PURE__ */ import_react9.default.createElement("option", { key: v.id, value: v.id }, v.name, "\uFF08", v.gender, "\uFF09- ", v.style))),
            customVoices.length > 0 && /* @__PURE__ */ import_react9.default.createElement("optgroup", { label: "\u81EA\u5B9A\u4E49\u97F3\u8272" }, customVoices.map((v) => /* @__PURE__ */ import_react9.default.createElement("option", { key: v.id, value: v.id }, v.name, "\uFF08\u81EA\u5B9A\u4E49\uFF09")))
          ),
          /* @__PURE__ */ import_react9.default.createElement(
            "div",
            {
              style: {
                fontSize: 12,
                color: "var(--text-muted, #888)",
                marginBottom: 4
              }
            },
            "\u8BED\u901F\uFF1A",
            speed.toFixed(1),
            "x"
          ),
          /* @__PURE__ */ import_react9.default.createElement(
            "input",
            {
              type: "range",
              min: "0.5",
              max: "2",
              step: "0.1",
              value: speed,
              onChange: (e) => setSpeed(parseFloat(e.target.value)),
              style: { width: "100%", marginBottom: 12 }
            }
          ),
          /* @__PURE__ */ import_react9.default.createElement(
            "div",
            {
              style: {
                fontSize: 12,
                color: "var(--text-muted, #888)",
                marginBottom: 4
              }
            },
            "\u60C5\u7EEA"
          ),
          /* @__PURE__ */ import_react9.default.createElement(
            "select",
            {
              value: emotion,
              onChange: (e) => setEmotion(e.target.value),
              style: {
                width: "100%",
                padding: "6px 8px",
                border: "1px solid var(--border, #2a2a4a)",
                borderRadius: 6,
                background: "var(--input-bg, #15152a)",
                color: "var(--text, #fff)",
                fontSize: 12,
                marginBottom: 12
              }
            },
            EMOTION_OPTIONS.map((e) => /* @__PURE__ */ import_react9.default.createElement("option", { key: e.id, value: e.id }, e.name))
          ),
          /* @__PURE__ */ import_react9.default.createElement(
            "div",
            {
              style: {
                fontSize: 12,
                color: "var(--text-muted, #888)",
                marginBottom: 4
              }
            },
            "\u97F3\u8D28\u6A21\u578B"
          ),
          /* @__PURE__ */ import_react9.default.createElement(
            "select",
            {
              value: ttsModel,
              onChange: (e) => setTtsModel(e.target.value),
              style: {
                width: "100%",
                padding: "6px 8px",
                border: "1px solid var(--border, #2a2a4a)",
                borderRadius: 6,
                background: "var(--input-bg, #15152a)",
                color: "var(--text, #fff)",
                fontSize: 12,
                marginBottom: 12
              }
            },
            MODEL_OPTIONS.map((m) => /* @__PURE__ */ import_react9.default.createElement("option", { key: m.id, value: m.id }, m.name, " - ", m.desc))
          ),
          /* @__PURE__ */ import_react9.default.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 8 } }, /* @__PURE__ */ import_react9.default.createElement(
            "button",
            {
              onClick: toggleSelectAll,
              style: {
                flex: 1,
                padding: "6px 0",
                border: "1px solid var(--border, #2a2a4a)",
                borderRadius: 6,
                background: "transparent",
                color: "var(--text, #aaa)",
                cursor: "pointer",
                fontSize: 11
              }
            },
            selectedDialogueIds.length === filteredDialogues.filter(
              (d) => d.status !== "done" && d.text.trim()
            ).length && filteredDialogues.filter(
              (d) => d.status !== "done" && d.text.trim()
            ).length > 0 ? "\u53D6\u6D88\u5168\u9009" : "\u5168\u9009"
          ), /* @__PURE__ */ import_react9.default.createElement(
            "div",
            {
              style: {
                flex: 1,
                padding: "6px 0",
                textAlign: "center",
                fontSize: 11,
                color: "var(--text-muted, #888)"
              }
            },
            "\u5DF2\u9009 ",
            selectedDialogueIds.length,
            " \u6761"
          )),
          /* @__PURE__ */ import_react9.default.createElement(
            "button",
            {
              onClick: generateAll,
              disabled: generatingId !== null,
              style: {
                width: "100%",
                padding: "10px 0",
                border: "none",
                borderRadius: 8,
                background: generatingId ? "#555" : "linear-gradient(135deg, #7a5cff, #5ce1e6)",
                color: "#fff",
                cursor: generatingId ? "wait" : "pointer",
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 8
              }
            },
            generatingId ? "\u751F\u6210\u4E2D..." : `\u{1F3AC} \u6279\u91CF\u751F\u6210${selectedDialogueIds.length > 0 ? `\uFF08\u5DF2\u9009${selectedDialogueIds.length}\u6761\uFF09` : `\uFF08\u5168\u90E8${stats.pending + stats.failed}\u6761\uFF09`}`
          ),
          /* @__PURE__ */ import_react9.default.createElement(
            "button",
            {
              onClick: exportDubbing,
              disabled: stats.done === 0,
              style: {
                width: "100%",
                padding: "8px 0",
                border: "1px solid var(--border, #2a2a4a)",
                borderRadius: 6,
                background: "transparent",
                color: stats.done === 0 ? "#555" : "var(--text, #aaa)",
                cursor: stats.done === 0 ? "not-allowed" : "pointer",
                fontSize: 12
              }
            },
            "\u{1F4E6} \u5BFC\u51FA\u914D\u97F3\u6570\u636E"
          )
        ),
        /* @__PURE__ */ import_react9.default.createElement("div", { style: { flex: 1, overflow: "auto", padding: 12 } }, /* @__PURE__ */ import_react9.default.createElement(
          "div",
          {
            style: {
              fontSize: 12,
              color: "var(--text-muted, #888)",
              marginBottom: 8
            }
          },
          "\u89D2\u8272\u97F3\u8272\u6620\u5C04"
        ), characters.length === 0 && /* @__PURE__ */ import_react9.default.createElement(
          "div",
          {
            style: {
              fontSize: 11,
              color: "var(--text-muted, #666)",
              textAlign: "center",
              padding: 20
            }
          },
          "\u6682\u65E0\u89D2\u8272\u53F0\u8BCD",
          /* @__PURE__ */ import_react9.default.createElement("br", null),
          "\u8BF7\u5148\u5728\u5206\u955C\u4E2D\u6DFB\u52A0\u53F0\u8BCD"
        ), characters.map((char) => /* @__PURE__ */ import_react9.default.createElement(
          "div",
          {
            key: char,
            style: {
              marginBottom: 8,
              padding: 8,
              border: "1px solid var(--border, #2a2a4a)",
              borderRadius: 6,
              background: "var(--panel-2, #15152a)"
            }
          },
          /* @__PURE__ */ import_react9.default.createElement(
            "div",
            {
              style: {
                fontSize: 12,
                color: "var(--text, #fff)",
                marginBottom: 4,
                fontWeight: 600
              }
            },
            char
          ),
          /* @__PURE__ */ import_react9.default.createElement(
            "select",
            {
              value: characterVoices[char] || selectedVoice,
              onChange: (e) => setCharacterVoice(char, e.target.value),
              style: {
                width: "100%",
                padding: "4px 6px",
                border: "1px solid var(--border, #2a2a4a)",
                borderRadius: 4,
                background: "var(--input-bg, #1a1a2e)",
                color: "var(--text, #fff)",
                fontSize: 11
              }
            },
            /* @__PURE__ */ import_react9.default.createElement("optgroup", { label: "\u4E2D\u6587-\u57FA\u7840\u97F3\u8272" }, VOICE_CN_BASIC.map((v) => /* @__PURE__ */ import_react9.default.createElement("option", { key: v.id, value: v.id }, v.name))),
            /* @__PURE__ */ import_react9.default.createElement("optgroup", { label: "\u4E2D\u6587-\u7CBE\u54C1\u97F3\u8272(Beta)" }, VOICE_CN_PREMIUM.map((v) => /* @__PURE__ */ import_react9.default.createElement("option", { key: v.id, value: v.id }, v.name))),
            /* @__PURE__ */ import_react9.default.createElement("optgroup", { label: "\u4E2D\u6587-\u89D2\u8272\u97F3\u8272" }, VOICE_CN_CHARACTER.map((v) => /* @__PURE__ */ import_react9.default.createElement("option", { key: v.id, value: v.id }, v.name))),
            /* @__PURE__ */ import_react9.default.createElement("optgroup", { label: "\u4E2D\u6587-\u7279\u8272\u97F3\u8272" }, VOICE_CN_SPECIAL.map((v) => /* @__PURE__ */ import_react9.default.createElement("option", { key: v.id, value: v.id }, v.name))),
            /* @__PURE__ */ import_react9.default.createElement("optgroup", { label: "\u4E2D\u6587-\u6E05\u65B0\u97F3\u8272" }, VOICE_CN_FRESH.map((v) => /* @__PURE__ */ import_react9.default.createElement("option", { key: v.id, value: v.id }, v.name))),
            /* @__PURE__ */ import_react9.default.createElement("optgroup", { label: "\u4E2D\u6587-\u513F\u7AE5/\u5361\u901A\u97F3\u8272" }, VOICE_CN_CHILD.map((v) => /* @__PURE__ */ import_react9.default.createElement("option", { key: v.id, value: v.id }, v.name))),
            /* @__PURE__ */ import_react9.default.createElement("optgroup", { label: "\u4E2D\u6587(\u7CA4\u8BED)\u97F3\u8272" }, VOICE_CANTONESE.map((v) => /* @__PURE__ */ import_react9.default.createElement("option", { key: v.id, value: v.id }, v.name))),
            /* @__PURE__ */ import_react9.default.createElement("optgroup", { label: "\u82F1\u6587\u97F3\u8272" }, VOICE_EN.map((v) => /* @__PURE__ */ import_react9.default.createElement("option", { key: v.id, value: v.id }, v.name))),
            customVoices.length > 0 && /* @__PURE__ */ import_react9.default.createElement("optgroup", { label: "\u81EA\u5B9A\u4E49\u97F3\u8272" }, customVoices.map((v) => /* @__PURE__ */ import_react9.default.createElement("option", { key: v.id, value: v.id }, v.name)))
          )
        )))
      ),
      /* @__PURE__ */ import_react9.default.createElement("div", { style: { flex: 1, overflow: "auto", padding: 16 } }, /* @__PURE__ */ import_react9.default.createElement(
        "div",
        {
          style: {
            display: "flex",
            gap: 8,
            marginBottom: 16,
            flexWrap: "wrap"
          }
        },
        /* @__PURE__ */ import_react9.default.createElement(
          "button",
          {
            onClick: () => setFilterCharacter("all"),
            style: {
              padding: "4px 12px",
              border: "1px solid var(--border, #2a2a4a)",
              borderRadius: 16,
              background: filterCharacter === "all" ? "rgba(122,92,255,0.2)" : "transparent",
              color: filterCharacter === "all" ? "#7a5cff" : "var(--text, #aaa)",
              cursor: "pointer",
              fontSize: 12
            }
          },
          "\u5168\u90E8"
        ),
        characters.map((char) => /* @__PURE__ */ import_react9.default.createElement(
          "button",
          {
            key: char,
            onClick: () => setFilterCharacter(char),
            style: {
              padding: "4px 12px",
              border: "1px solid var(--border, #2a2a4a)",
              borderRadius: 16,
              background: filterCharacter === char ? "rgba(122,92,255,0.2)" : "transparent",
              color: filterCharacter === char ? "#7a5cff" : "var(--text, #aaa)",
              cursor: "pointer",
              fontSize: 12
            }
          },
          char
        ))
      ), filteredDialogues.length === 0 && /* @__PURE__ */ import_react9.default.createElement(
        "div",
        {
          style: {
            textAlign: "center",
            padding: 60,
            color: "var(--text-muted, #666)"
          }
        },
        /* @__PURE__ */ import_react9.default.createElement("div", { style: { fontSize: 48, marginBottom: 16 } }, "\u{1F399}\uFE0F"),
        /* @__PURE__ */ import_react9.default.createElement("div", { style: { fontSize: 14 } }, "\u6682\u65E0\u53F0\u8BCD"),
        /* @__PURE__ */ import_react9.default.createElement("div", { style: { fontSize: 12, marginTop: 8 } }, "\u8BF7\u5148\u5728\u5206\u955C\u6A21\u5757\u4E2D\u6DFB\u52A0\u89D2\u8272\u53F0\u8BCD")
      ), filteredDialogues.map((dlg, index) => /* @__PURE__ */ import_react9.default.createElement(
        "div",
        {
          key: dlg.id,
          style: {
            marginBottom: 10,
            padding: 12,
            border: selectedDialogueIds.includes(dlg.id) ? "2px solid #7a5cff" : "1px solid var(--border, #2a2a4a)",
            borderRadius: 8,
            background: selectedDialogueIds.includes(dlg.id) ? "rgba(122,92,255,0.05)" : "var(--panel-2, #15152a)"
          }
        },
        /* @__PURE__ */ import_react9.default.createElement(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8
            }
          },
          /* @__PURE__ */ import_react9.default.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ import_react9.default.createElement(
            "input",
            {
              type: "checkbox",
              checked: selectedDialogueIds.includes(dlg.id),
              onChange: () => toggleDialogueSelection(dlg.id),
              style: {
                width: 16,
                height: 16,
                cursor: "pointer",
                accentColor: "#7a5cff"
              },
              title: "\u9009\u62E9\u6B64\u53F0\u8BCD\u7528\u4E8E\u6279\u91CF\u751F\u6210"
            }
          ), /* @__PURE__ */ import_react9.default.createElement(
            "span",
            {
              style: { fontSize: 11, color: "var(--text-muted, #666)" }
            },
            "#",
            index + 1
          ), editingCharacterId === dlg.id ? /* @__PURE__ */ import_react9.default.createElement(
            "div",
            {
              style: { display: "flex", alignItems: "center", gap: 4 }
            },
            /* @__PURE__ */ import_react9.default.createElement(
              "input",
              {
                value: editCharacter,
                onChange: (e) => setEditCharacter(e.target.value),
                style: {
                  padding: "2px 6px",
                  border: "1px solid #7a5cff",
                  borderRadius: 4,
                  background: "rgba(122,92,255,0.1)",
                  color: "#fff",
                  fontSize: 11,
                  width: 80
                },
                autoFocus: true,
                onKeyDown: (e) => {
                  if (e.key === "Enter") handleSaveEditCharacter(dlg.id);
                  if (e.key === "Escape") handleCancelEditCharacter();
                }
              }
            ),
            /* @__PURE__ */ import_react9.default.createElement(
              "button",
              {
                onClick: () => handleSaveEditCharacter(dlg.id),
                style: {
                  padding: "2px 6px",
                  border: "none",
                  borderRadius: 3,
                  background: "#10b981",
                  color: "#fff",
                  fontSize: 10,
                  cursor: "pointer"
                }
              },
              "\u2713"
            ),
            /* @__PURE__ */ import_react9.default.createElement(
              "button",
              {
                onClick: handleCancelEditCharacter,
                style: {
                  padding: "2px 6px",
                  border: "1px solid var(--border, #2a2a4a)",
                  borderRadius: 3,
                  background: "transparent",
                  color: "var(--text-muted, #888)",
                  fontSize: 10,
                  cursor: "pointer"
                }
              },
              "\u2717"
            )
          ) : /* @__PURE__ */ import_react9.default.createElement(
            "span",
            {
              onClick: () => handleStartEditCharacter(dlg),
              style: {
                padding: "2px 8px",
                background: "rgba(122,92,255,0.15)",
                borderRadius: 4,
                fontSize: 11,
                color: "#7a5cff",
                fontWeight: 600,
                cursor: "pointer",
                border: "1px dashed transparent"
              },
              onMouseEnter: (e) => {
                e.target.style.borderColor = "#7a5cff";
              },
              onMouseLeave: (e) => {
                e.target.style.borderColor = "transparent";
              },
              title: "\u70B9\u51FB\u7F16\u8F91\u89D2\u8272\u540D"
            },
            dlg.character,
            " \u270F\uFE0F"
          ), /* @__PURE__ */ import_react9.default.createElement(
            "span",
            {
              style: { fontSize: 11, color: "var(--text-muted, #666)" }
            },
            dlg.shotTitle
          )),
          /* @__PURE__ */ import_react9.default.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6 } }, dlg.status === "done" && /* @__PURE__ */ import_react9.default.createElement("span", { style: { fontSize: 11, color: "#10b981" } }, "\u2713 \u5DF2\u5B8C\u6210"), dlg.status === "failed" && /* @__PURE__ */ import_react9.default.createElement("span", { style: { fontSize: 11, color: "#ef4444" } }, "\u2717 \u5931\u8D25"), dlg.status === "generating" && /* @__PURE__ */ import_react9.default.createElement("span", { style: { fontSize: 11, color: "#f59e0b" } }, "\u751F\u6210\u4E2D..."), dlg.status === "pending" && /* @__PURE__ */ import_react9.default.createElement(
            "span",
            {
              style: { fontSize: 11, color: "var(--text-muted, #666)" }
            },
            "\u5F85\u751F\u6210"
          ))
        ),
        editingId === dlg.id ? /* @__PURE__ */ import_react9.default.createElement("div", { style: { marginBottom: 10 } }, /* @__PURE__ */ import_react9.default.createElement(
          "textarea",
          {
            value: editText,
            onChange: (e) => setEditText(e.target.value),
            style: {
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #7a5cff",
              borderRadius: 6,
              background: "rgba(122,92,255,0.1)",
              color: "#fff",
              fontSize: 13,
              resize: "vertical",
              minHeight: 60,
              fontFamily: "inherit"
            },
            placeholder: "\u8BF7\u8F93\u5165\u53F0\u8BCD\u5185\u5BB9..."
          }
        ), /* @__PURE__ */ import_react9.default.createElement("div", { style: { display: "flex", gap: 8, marginTop: 8 } }, /* @__PURE__ */ import_react9.default.createElement(
          "button",
          {
            onClick: () => handleSaveEdit(dlg.id),
            style: {
              padding: "4px 12px",
              border: "none",
              borderRadius: 4,
              background: "#10b981",
              color: "#fff",
              cursor: "pointer",
              fontSize: 11
            }
          },
          "\u2713 \u4FDD\u5B58"
        ), /* @__PURE__ */ import_react9.default.createElement(
          "button",
          {
            onClick: handleCancelEdit,
            style: {
              padding: "4px 12px",
              border: "1px solid var(--border, #2a2a4a)",
              borderRadius: 4,
              background: "transparent",
              color: "var(--text, #aaa)",
              cursor: "pointer",
              fontSize: 11
            }
          },
          "\u2717 \u53D6\u6D88"
        ))) : /* @__PURE__ */ import_react9.default.createElement(
          "div",
          {
            onClick: () => handleStartEdit(dlg),
            style: {
              fontSize: 13,
              color: "var(--text, #ddd)",
              lineHeight: 1.6,
              marginBottom: 10,
              padding: "8px 12px",
              background: "rgba(0,0,0,0.2)",
              borderRadius: 6,
              cursor: "pointer",
              border: "1px dashed transparent",
              transition: "all 0.2s"
            },
            onMouseEnter: (e) => {
              e.target.style.borderColor = "#7a5cff";
              e.target.style.background = "rgba(122,92,255,0.1)";
            },
            onMouseLeave: (e) => {
              e.target.style.borderColor = "transparent";
              e.target.style.background = "rgba(0,0,0,0.2)";
            },
            title: "\u70B9\u51FB\u7F16\u8F91\u53F0\u8BCD"
          },
          '"',
          dlg.text,
          '"',
          /* @__PURE__ */ import_react9.default.createElement(
            "span",
            {
              style: {
                fontSize: 10,
                color: "#7a5cff",
                marginLeft: 8,
                opacity: 0.7
              }
            },
            "\u270F\uFE0F \u70B9\u51FB\u7F16\u8F91"
          )
        ),
        /* @__PURE__ */ import_react9.default.createElement(
          "div",
          {
            style: {
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 8,
              alignItems: "center"
            }
          },
          /* @__PURE__ */ import_react9.default.createElement("span", { style: { fontSize: 11, color: "var(--text-muted, #888)" } }, "\u97F3\u8272\uFF1A"),
          /* @__PURE__ */ import_react9.default.createElement(
            "select",
            {
              value: dlg.voiceId || "",
              onChange: (e) => {
                const newVoiceId = e.target.value || null;
                setDialogues(
                  (prev) => prev.map(
                    (d) => d.id === dlg.id ? { ...d, voiceId: newVoiceId } : d
                  )
                );
              },
              style: {
                padding: "4px 8px",
                border: "1px solid var(--border, #2a2a4a)",
                borderRadius: 4,
                background: "var(--input-bg, #1a1a2e)",
                color: "var(--text, #ddd)",
                fontSize: 11,
                cursor: "pointer",
                minWidth: 140
              }
            },
            /* @__PURE__ */ import_react9.default.createElement("option", { value: "" }, "\u4F7F\u7528\u5168\u5C40/\u89D2\u8272\u6620\u5C04"),
            /* @__PURE__ */ import_react9.default.createElement("optgroup", { label: "\u4E2D\u6587\u57FA\u7840" }, VOICE_CN_BASIC.map((v) => /* @__PURE__ */ import_react9.default.createElement("option", { key: v.id, value: v.id }, v.name))),
            /* @__PURE__ */ import_react9.default.createElement("optgroup", { label: "\u4E2D\u6587\u7CBE\u54C1" }, VOICE_CN_PREMIUM.map((v) => /* @__PURE__ */ import_react9.default.createElement("option", { key: v.id, value: v.id }, v.name))),
            /* @__PURE__ */ import_react9.default.createElement("optgroup", { label: "\u89D2\u8272\u97F3\u8272" }, VOICE_CN_CHARACTER.map((v) => /* @__PURE__ */ import_react9.default.createElement("option", { key: v.id, value: v.id }, v.name))),
            /* @__PURE__ */ import_react9.default.createElement("optgroup", { label: "\u7279\u6B8A\u97F3\u8272" }, VOICE_CN_SPECIAL.map((v) => /* @__PURE__ */ import_react9.default.createElement("option", { key: v.id, value: v.id }, v.name))),
            /* @__PURE__ */ import_react9.default.createElement("optgroup", { label: "\u65B0\u97F3\u8272" }, VOICE_CN_FRESH.map((v) => /* @__PURE__ */ import_react9.default.createElement("option", { key: v.id, value: v.id }, v.name))),
            /* @__PURE__ */ import_react9.default.createElement("optgroup", { label: "\u7AE5\u58F0" }, VOICE_CN_CHILD.map((v) => /* @__PURE__ */ import_react9.default.createElement("option", { key: v.id, value: v.id }, v.name))),
            /* @__PURE__ */ import_react9.default.createElement("optgroup", { label: "\u7CA4\u8BED" }, VOICE_CANTONESE.map((v) => /* @__PURE__ */ import_react9.default.createElement("option", { key: v.id, value: v.id }, v.name))),
            /* @__PURE__ */ import_react9.default.createElement("optgroup", { label: "\u82F1\u6587" }, VOICE_EN.map((v) => /* @__PURE__ */ import_react9.default.createElement("option", { key: v.id, value: v.id }, v.name)))
          ),
          /* @__PURE__ */ import_react9.default.createElement(
            "span",
            {
              style: {
                fontSize: 11,
                color: "var(--text-muted, #888)",
                marginLeft: 8
              }
            },
            "\u60C5\u7EEA\uFF1A"
          ),
          /* @__PURE__ */ import_react9.default.createElement(
            "select",
            {
              value: dlg.emotion || "",
              onChange: (e) => {
                const newEmotion = e.target.value;
                setDialogues(
                  (prev) => prev.map(
                    (d) => d.id === dlg.id ? { ...d, emotion: newEmotion } : d
                  )
                );
              },
              style: {
                padding: "4px 8px",
                border: "1px solid var(--border, #2a2a4a)",
                borderRadius: 4,
                background: "var(--input-bg, #1a1a2e)",
                color: "var(--text, #ddd)",
                fontSize: 11,
                cursor: "pointer",
                minWidth: 100
              }
            },
            EMOTION_OPTIONS.map((e) => /* @__PURE__ */ import_react9.default.createElement("option", { key: e.id, value: e.id }, e.name))
          )
        ),
        /* @__PURE__ */ import_react9.default.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } }, /* @__PURE__ */ import_react9.default.createElement(
          "button",
          {
            onClick: () => generateOne(dlg),
            disabled: generatingId !== null,
            style: {
              padding: "6px 14px",
              border: "none",
              borderRadius: 6,
              background: generatingId ? "#555" : "#7a5cff",
              color: "#fff",
              cursor: generatingId ? "wait" : "pointer",
              fontSize: 12
            }
          },
          generatingId === dlg.id ? "\u751F\u6210\u4E2D..." : `\u{1F3A4} \u751F\u6210\u914D\u97F3\uFF08${Math.max(1, Math.ceil(dlg.text.length / 3))}\u79EF\u5206\uFF09`
        ), dlg.audioUrl && /* @__PURE__ */ import_react9.default.createElement(import_react9.default.Fragment, null, /* @__PURE__ */ import_react9.default.createElement(
          "button",
          {
            onClick: () => playAudio(dlg),
            style: {
              padding: "6px 14px",
              border: "1px solid #10b981",
              borderRadius: 6,
              background: playingId === dlg.id ? "rgba(16,185,129,0.2)" : "transparent",
              color: "#10b981",
              cursor: "pointer",
              fontSize: 12
            }
          },
          playingId === dlg.id ? "\u23F8 \u6682\u505C" : "\u25B6 \u64AD\u653E"
        ), /* @__PURE__ */ import_react9.default.createElement(
          "button",
          {
            onClick: async () => {
              try {
                const r = await fetch(dlg.audioUrl);
                const b = await r.blob();
                const url = URL.createObjectURL(b);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${dlg.character}_${index + 1}.mp3`;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                  URL.revokeObjectURL(url);
                  a.remove();
                }, 1e3);
              } catch (e) {
                alert("\u4E0B\u8F7D\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u6216\u68C0\u67E5\u7F51\u7EDC");
              }
            },
            style: {
              padding: "6px 14px",
              border: "1px solid var(--border, #2a2a4a)",
              borderRadius: 6,
              background: "transparent",
              color: "var(--text, #aaa)",
              cursor: "pointer",
              fontSize: 12
            }
          },
          "\u2B07 \u4E0B\u8F7D"
        )), editingId !== dlg.id && /* @__PURE__ */ import_react9.default.createElement(import_react9.default.Fragment, null, /* @__PURE__ */ import_react9.default.createElement(
          "button",
          {
            onClick: () => handleStartEdit(dlg),
            style: {
              padding: "6px 14px",
              border: "1px solid #f59e0b",
              borderRadius: 6,
              background: "transparent",
              color: "#f59e0b",
              cursor: "pointer",
              fontSize: 12
            }
          },
          "\u270F\uFE0F \u7F16\u8F91"
        ), /* @__PURE__ */ import_react9.default.createElement(
          "button",
          {
            onClick: () => handleDeleteDialog(dlg.id),
            style: {
              padding: "6px 14px",
              border: "1px solid #ef4444",
              borderRadius: 6,
              background: "transparent",
              color: "#ef4444",
              cursor: "pointer",
              fontSize: 12
            }
          },
          "\u{1F5D1}\uFE0F \u5220\u9664"
        )))
      ))),
      showAddDialog && /* @__PURE__ */ import_react9.default.createElement(
        "div",
        {
          style: {
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          },
          onClick: () => setShowAddDialog(false)
        },
        /* @__PURE__ */ import_react9.default.createElement(
          "div",
          {
            style: {
              width: 520,
              maxWidth: "90%",
              background: "var(--panel, #1a1a2e)",
              border: "1px solid var(--border, #2a2a4a)",
              borderRadius: 16,
              padding: 24,
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)"
            },
            onClick: (e) => e.stopPropagation()
          },
          /* @__PURE__ */ import_react9.default.createElement(
            "div",
            {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20
              }
            },
            /* @__PURE__ */ import_react9.default.createElement(
              "h3",
              {
                style: { margin: 0, fontSize: 18, color: "var(--text, #fff)" }
              },
              "\u2795 \u6DFB\u52A0\u81EA\u5B9A\u4E49\u53F0\u8BCD"
            ),
            /* @__PURE__ */ import_react9.default.createElement(
              "button",
              {
                onClick: () => setShowAddDialog(false),
                style: {
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted, #888)",
                  fontSize: 20,
                  cursor: "pointer"
                }
              },
              "\u2715"
            )
          ),
          /* @__PURE__ */ import_react9.default.createElement("div", { style: { marginBottom: 20 } }, /* @__PURE__ */ import_react9.default.createElement(
            "label",
            {
              style: {
                display: "block",
                fontSize: 12,
                color: "var(--text-muted, #888)",
                marginBottom: 6
              }
            },
            "\u53F0\u8BCD\u5185\u5BB9\uFF08\u683C\u5F0F\uFF1A\u89D2\u8272\u540D\uFF1A\u53F0\u8BCD\u5185\u5BB9\uFF09"
          ), /* @__PURE__ */ import_react9.default.createElement(
            "textarea",
            {
              value: addText,
              onChange: (e) => setAddText(e.target.value),
              placeholder: "\u4F8B\u5982\uFF1A\u7537\u4E3B\uFF1A\u4F60\u5FEB\u8D70\uFF0C\u4E0D\u8981\u7BA1\u6211\uFF01\n\u5973\u4E3B\uFF1A\u4E0D\uFF0C\u6211\u4E0D\u4F1A\u4E22\u4E0B\u4F60\u7684\uFF01",
              rows: 4,
              style: {
                width: "100%",
                padding: "10px 12px",
                border: "1px solid var(--border, #2a2a4a)",
                borderRadius: 8,
                background: "var(--input-bg, #15152a)",
                color: "var(--text, #fff)",
                fontSize: 13,
                resize: "vertical",
                boxSizing: "border-box",
                fontFamily: "inherit"
              }
            }
          ), /* @__PURE__ */ import_react9.default.createElement(
            "div",
            {
              style: {
                fontSize: 10,
                color: "var(--text-muted, #666)",
                marginTop: 6
              }
            },
            '\u63D0\u793A\uFF1A\u7528\u5192\u53F7\uFF08\uFF1A\u6216:\uFF09\u5206\u9694\u89D2\u8272\u540D\u548C\u53F0\u8BCD\uFF0C\u4E0D\u5199\u89D2\u8272\u540D\u9ED8\u8BA4"\u81EA\u5B9A\u4E49"'
          )),
          /* @__PURE__ */ import_react9.default.createElement("div", { style: { display: "flex", gap: 10 } }, /* @__PURE__ */ import_react9.default.createElement(
            "button",
            {
              onClick: handleAddDialog,
              style: {
                flex: 1,
                padding: "12px 0",
                border: "none",
                borderRadius: 10,
                background: "linear-gradient(135deg, #10b981, #059669)",
                color: "#fff",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600
              }
            },
            "\u2713 \u6DFB\u52A0\u53F0\u8BCD"
          ), /* @__PURE__ */ import_react9.default.createElement(
            "button",
            {
              onClick: () => setShowAddDialog(false),
              style: {
                padding: "12px 24px",
                border: "1px solid var(--border, #2a2a4a)",
                borderRadius: 10,
                background: "transparent",
                color: "var(--text, #aaa)",
                cursor: "pointer",
                fontSize: 14
              }
            },
            "\u53D6\u6D88"
          ))
        )
      ),
      showVoiceDesigner && /* @__PURE__ */ import_react9.default.createElement(
        "div",
        {
          style: {
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          },
          onClick: () => !creatingVoice && setShowVoiceDesigner(false)
        },
        /* @__PURE__ */ import_react9.default.createElement(
          "div",
          {
            style: {
              width: 650,
              maxWidth: "95%",
              background: "var(--panel, #1a1a2e)",
              border: "1px solid var(--border, #2a2a4a)",
              borderRadius: 16,
              padding: 28,
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)"
            },
            onClick: (e) => e.stopPropagation()
          },
          /* @__PURE__ */ import_react9.default.createElement(
            "div",
            {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20
              }
            },
            /* @__PURE__ */ import_react9.default.createElement(
              "h3",
              {
                style: { margin: 0, fontSize: 20, color: "var(--text, #fff)" }
              },
              "\u2728 \u6587\u5B57\u521B\u5EFA\u97F3\u8272"
            ),
            /* @__PURE__ */ import_react9.default.createElement(
              "button",
              {
                onClick: () => !creatingVoice && setShowVoiceDesigner(false),
                style: {
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted, #888)",
                  fontSize: 20,
                  cursor: "pointer"
                }
              },
              "\xD7"
            )
          ),
          /* @__PURE__ */ import_react9.default.createElement("div", { style: { marginBottom: 16 } }, /* @__PURE__ */ import_react9.default.createElement(
            "div",
            {
              style: {
                fontSize: 12,
                color: "var(--text-muted, #888)",
                marginBottom: 6
              }
            },
            "\u5FEB\u901F\u6A21\u677F"
          ), /* @__PURE__ */ import_react9.default.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, VOICE_PROMPT_TEMPLATES.map((t2, i) => /* @__PURE__ */ import_react9.default.createElement(
            "button",
            {
              key: i,
              onClick: () => setVoicePrompt(t2.prompt),
              style: {
                padding: "4px 10px",
                border: "1px solid var(--border, #2a2a4a)",
                borderRadius: 12,
                background: "var(--input-bg, #15152a)",
                color: "var(--text, #aaa)",
                cursor: "pointer",
                fontSize: 11
              }
            },
            t2.label
          )))),
          /* @__PURE__ */ import_react9.default.createElement("div", { style: { marginBottom: 16 } }, /* @__PURE__ */ import_react9.default.createElement(
            "div",
            {
              style: {
                fontSize: 12,
                color: "var(--text-muted, #888)",
                marginBottom: 6
              }
            },
            "\u58F0\u97F3\u63CF\u8FF0 *",
            " ",
            /* @__PURE__ */ import_react9.default.createElement("span", { style: { fontSize: 10, color: "#666" } }, "\uFF08\u63CF\u8FF0\u97F3\u8272\u7279\u5F81\uFF0C\u5982\u6027\u522B\u3001\u5E74\u9F84\u3001\u97F3\u8D28\u3001\u8BED\u901F\u3001\u60C5\u611F\uFF09")
          ), /* @__PURE__ */ import_react9.default.createElement(
            "textarea",
            {
              value: voicePrompt,
              onChange: (e) => setVoicePrompt(e.target.value),
              placeholder: "\u4F8B\u5982\uFF1A\u6E29\u67D4\u7684\u5E74\u8F7B\u5973\u6027\u58F0\u97F3\uFF0C\u8BED\u901F\u9002\u4E2D\uFF0C\u60C5\u611F\u4E30\u5BCC\uFF0C\u7565\u5E26\u6C99\u54D1\uFF0C\u8BF4\u8BDD\u8282\u594F\u7F13\u6162",
              rows: 3,
              style: {
                width: "100%",
                padding: "10px 12px",
                border: "1px solid var(--border, #2a2a4a)",
                borderRadius: 8,
                background: "var(--input-bg, #15152a)",
                color: "var(--text, #fff)",
                fontSize: 13,
                resize: "vertical",
                fontFamily: "inherit"
              },
              maxLength: 500
            }
          ), /* @__PURE__ */ import_react9.default.createElement(
            "div",
            {
              style: {
                fontSize: 10,
                color: "var(--text-muted, #666)",
                textAlign: "right",
                marginTop: 4
              }
            },
            voicePrompt.length,
            "/500"
          )),
          /* @__PURE__ */ import_react9.default.createElement("div", { style: { marginBottom: 16 } }, /* @__PURE__ */ import_react9.default.createElement(
            "div",
            {
              style: {
                fontSize: 12,
                color: "var(--text-muted, #888)",
                marginBottom: 6
              }
            },
            "\u9884\u89C8\u6587\u672C *",
            " ",
            /* @__PURE__ */ import_react9.default.createElement("span", { style: { fontSize: 10, color: "#666" } }, "\uFF08\u521B\u5EFA\u97F3\u8272\u65F6\u4F1A\u7528\u8FD9\u6BB5\u6587\u672C\u751F\u6210\u8BD5\u542C\u97F3\u9891\uFF09")
          ), /* @__PURE__ */ import_react9.default.createElement(
            "input",
            {
              type: "text",
              value: previewText,
              onChange: (e) => setPreviewText(e.target.value),
              placeholder: "\u8BF7\u8F93\u5165\u9884\u89C8\u6587\u672C",
              style: {
                width: "100%",
                padding: "10px 12px",
                border: "1px solid var(--border, #2a2a4a)",
                borderRadius: 8,
                background: "var(--input-bg, #15152a)",
                color: "var(--text, #fff)",
                fontSize: 13
              },
              maxLength: 200
            }
          )),
          /* @__PURE__ */ import_react9.default.createElement("div", { style: { marginBottom: 20 } }, /* @__PURE__ */ import_react9.default.createElement(
            "div",
            {
              style: {
                fontSize: 12,
                color: "var(--text-muted, #888)",
                marginBottom: 6
              }
            },
            "\u97F3\u8272\u540D\u79F0\uFF08\u9009\u586B\uFF09"
          ), /* @__PURE__ */ import_react9.default.createElement(
            "input",
            {
              type: "text",
              value: voiceName,
              onChange: (e) => setVoiceName(e.target.value),
              placeholder: "\u4F8B\u5982\uFF1A\u6E29\u67D4\u5973\u4E3B",
              style: {
                width: "100%",
                padding: "10px 12px",
                border: "1px solid var(--border, #2a2a4a)",
                borderRadius: 8,
                background: "var(--input-bg, #15152a)",
                color: "var(--text, #fff)",
                fontSize: 13
              },
              maxLength: 16
            }
          )),
          /* @__PURE__ */ import_react9.default.createElement(
            "button",
            {
              onClick: handleCreateVoice,
              disabled: creatingVoice || !voicePrompt.trim() || !previewText.trim(),
              style: {
                width: "100%",
                padding: "14px 0",
                border: "none",
                borderRadius: 10,
                background: creatingVoice ? "#555" : "linear-gradient(135deg, #7a5cff, #5ce1e6)",
                color: "#fff",
                cursor: creatingVoice ? "wait" : "pointer",
                fontSize: 15,
                fontWeight: 600
              }
            },
            creatingVoice ? "\u521B\u5EFA\u4E2D..." : "\u{1F3B5} \u521B\u5EFA\u97F3\u8272\uFF085\u79EF\u5206\uFF09"
          ),
          customVoices.length > 0 && /* @__PURE__ */ import_react9.default.createElement(
            "div",
            {
              style: {
                marginTop: 16,
                paddingTop: 16,
                borderTop: "1px solid var(--border, #2a2a4a)"
              }
            },
            /* @__PURE__ */ import_react9.default.createElement(
              "div",
              {
                style: {
                  fontSize: 12,
                  color: "var(--text-muted, #888)",
                  marginBottom: 8
                }
              },
              "\u5DF2\u521B\u5EFA\u7684\u81EA\u5B9A\u4E49\u97F3\u8272\uFF08",
              customVoices.length,
              "\uFF09"
            ),
            customVoices.map((v, i) => /* @__PURE__ */ import_react9.default.createElement(
              "div",
              {
                key: i,
                style: {
                  padding: "8px 10px",
                  background: "var(--input-bg, #15152a)",
                  borderRadius: 6,
                  marginBottom: 4,
                  fontSize: 12
                }
              },
              /* @__PURE__ */ import_react9.default.createElement("span", { style: { color: "#7a5cff", fontWeight: 600 } }, v.name),
              /* @__PURE__ */ import_react9.default.createElement(
                "span",
                {
                  style: {
                    color: "var(--text-muted, #666)",
                    marginLeft: 8,
                    fontSize: 10
                  }
                },
                v.id.substring(0, 20),
                "..."
              )
            ))
          )
        )
      )
    );
  }

  // src/components/TemplateMarket.jsx
  var import_react10 = __toESM(__require("react"), 1);
  var SCRIPT_TEMPLATES = [
    {
      id: "script_wuxia",
      name: "\u56FD\u98CE\u6B66\u4FA0\xB7\u590D\u4EC7\u7BC7",
      category: "\u56FD\u98CE\u6B66\u4FA0",
      duration: "60\u96C6",
      desc: "\u5C11\u5E74\u4FA0\u5BA2\u8EAB\u8D1F\u8840\u6D77\u6DF1\u4EC7\uFF0C\u8BEF\u5165\u79D8\u5883\u4E60\u5F97\u7EDD\u4E16\u6B66\u529F\uFF0C\u6700\u7EC8\u624B\u5203\u4EC7\u654C\u3001\u79F0\u9738\u6C5F\u6E56\u7684\u7ECF\u5178\u6B66\u4FA0\u6545\u4E8B\u3002",
      tags: ["\u6B66\u4FA0", "\u590D\u4EC7", "\u6210\u957F", "\u70ED\u8840"],
      outline: {
        synopsis: "\u5C11\u5E74\u6797\u58A8\u672C\u662F\u6B66\u6797\u4E16\u5BB6\u5B50\u5F1F\uFF0C\u4E00\u591C\u4E4B\u95F4\u5BB6\u65CF\u88AB\u795E\u79D8\u7EC4\u7EC7\u706D\u95E8\uFF0C\u552F\u6709\u4ED6\u4FA5\u5E78\u9003\u8131\u3002\u8EAB\u8D1F\u8840\u6D77\u6DF1\u4EC7\u7684\u4ED6\u8BEF\u5165\u79D8\u5883\uFF0C\u610F\u5916\u83B7\u5F97\u5931\u4F20\u5DF2\u4E45\u7684\u300A\u5929\u7384\u5251\u8BC0\u300B\u3002\u5341\u5E74\u78E8\u4E00\u5251\uFF0C\u6797\u58A8\u91CD\u51FA\u6C5F\u6E56\uFF0C\u4E00\u6B65\u6B65\u63ED\u5F00\u5BB6\u65CF\u706D\u95E8\u7684\u771F\u76F8\uFF0C\u6700\u7EC8\u624B\u5203\u4EC7\u654C\uFF0C\u6210\u4E3A\u4E00\u4EE3\u6B66\u6797\u76DF\u4E3B\u3002",
        themes: ["\u590D\u4EC7", "\u6210\u957F", "\u6C5F\u6E56\u6069\u6028", "\u6B63\u90AA\u5BF9\u51B3"],
        totalEpisodes: 60
      }
    },
    {
      id: "script_modern",
      name: "\u90FD\u5E02\u9006\u88AD\xB7\u8D58\u5A7F\u5D1B\u8D77",
      category: "\u90FD\u5E02\u723D\u6587",
      duration: "80\u96C6",
      desc: "\u9690\u85CF\u8EAB\u4EFD\u7684\u8C6A\u95E8\u7EE7\u627F\u4EBA\u5165\u8D58\u82CF\u5BB6\uFF0C\u53D7\u5C3D\u767D\u773C\uFF0C\u6700\u7EC8\u5C55\u9732\u5B9E\u529B\uFF0C\u9006\u88AD\u6210\u4E3A\u90FD\u5E02\u4F20\u5947\u3002",
      tags: ["\u90FD\u5E02", "\u9006\u88AD", "\u8D58\u5A7F", "\u723D\u6587"],
      outline: {
        synopsis: "\u82CF\u6674\u96EA\u4E3A\u4E86\u5BB6\u65CF\u5229\u76CA\uFF0C\u5AC1\u7ED9\u4E86\u4E00\u65E0\u6240\u6709\u7684\u9648\u51E1\u3002\u4E09\u5E74\u6765\uFF0C\u9648\u51E1\u5728\u82CF\u5BB6\u53D7\u5C3D\u767D\u773C\u548C\u7F9E\u8FB1\uFF0C\u88AB\u79F0\u4E3A'\u5E9F\u7269\u8D58\u5A7F'\u3002\u7136\u800C\u6CA1\u6709\u4EBA\u77E5\u9053\uFF0C\u9648\u51E1\u7684\u771F\u5B9E\u8EAB\u4EFD\u662F\u534E\u590F\u7B2C\u4E00\u8C6A\u95E8\u9648\u5BB6\u7684\u552F\u4E00\u7EE7\u627F\u4EBA\u3002\u5F53\u82CF\u5BB6\u906D\u9047\u706D\u9876\u4E4B\u707E\u65F6\uFF0C\u9648\u51E1\u7EC8\u4E8E\u5C55\u9732\u771F\u5B9E\u5B9E\u529B\uFF0C\u4E00\u6B65\u6B65\u9006\u88AD\uFF0C\u6210\u4E3A\u90FD\u5E02\u4F20\u5947\u3002",
        themes: ["\u9006\u88AD", "\u8EAB\u4EFD\u53CD\u8F6C", "\u5BB6\u65CF\u6597\u4E89", "\u90FD\u5E02\u5546\u6218"],
        totalEpisodes: 80
      }
    },
    {
      id: "script_xianxia",
      name: "\u4ED9\u4FA0\u4FEE\u771F\xB7\u95EE\u9053\u957F\u751F",
      category: "\u4ED9\u4FA0\u4FEE\u771F",
      duration: "100\u96C6",
      desc: "\u5C71\u6751\u5C11\u5E74\u8E0F\u4E0A\u4FEE\u4ED9\u4E4B\u8DEF\uFF0C\u4ECE\u65E0\u540D\u5C0F\u5352\u6210\u957F\u4E3A\u64BC\u52A8\u5929\u5730\u7684\u5927\u80FD\uFF0C\u8FFD\u5BFB\u957F\u751F\u5927\u9053\u3002",
      tags: ["\u4ED9\u4FA0", "\u4FEE\u771F", "\u6210\u957F", "\u70ED\u8840"],
      outline: {
        synopsis: "\u9752\u4E91\u6751\u5C11\u5E74\u53F6\u5C18\u5929\u751F\u5E9F\u8109\uFF0C\u65E0\u6CD5\u4FEE\u70BC\uFF0C\u88AB\u5168\u6751\u4EBA\u5632\u7B11\u3002\u4E00\u6B21\u610F\u5916\uFF0C\u4ED6\u83B7\u5F97\u4E0A\u53E4\u795E\u5668'\u6DF7\u6C8C\u73E0'\uFF0C\u4ECE\u6B64\u8E0F\u4E0A\u4FEE\u4ED9\u4E4B\u8DEF\u3002\u4ECE\u5E95\u5C42\u4FEE\u58EB\u5F00\u59CB\uFF0C\u53F6\u5C18\u5386\u7ECF\u65E0\u6570\u751F\u6B7B\u8003\u9A8C\uFF0C\u4E00\u6B65\u6B65\u63ED\u5F00\u4FEE\u771F\u754C\u7684\u60CA\u5929\u79D8\u5BC6\uFF0C\u6700\u7EC8\u98DE\u5347\u6210\u4ED9\uFF0C\u95EE\u9053\u957F\u751F\u3002",
        themes: ["\u4FEE\u4ED9", "\u6210\u957F", "\u9006\u5929\u6539\u547D", "\u5927\u9053\u4E89\u950B"],
        totalEpisodes: 100
      }
    },
    {
      id: "script_suspense",
      name: "\u60AC\u7591\u63A8\u7406\xB7\u6697\u591C\u8FFD\u51F6",
      category: "\u60AC\u7591\u63A8\u7406",
      duration: "30\u96C6",
      desc: "\u8FDE\u73AF\u6740\u4EBA\u6848\u8FF7\u96FE\u91CD\u91CD\uFF0C\u5929\u624D\u5211\u8B66\u4E0E\u9AD8\u667A\u5546\u7F6A\u72AF\u5C55\u5F00\u60CA\u5FC3\u52A8\u9B44\u7684\u732B\u9F20\u6E38\u620F\u3002",
      tags: ["\u60AC\u7591", "\u63A8\u7406", "\u72AF\u7F6A", "\u70E7\u8111"],
      outline: {
        synopsis: "\u57CE\u5E02\u4E2D\u53D1\u751F\u8FDE\u73AF\u6740\u4EBA\u6848\uFF0C\u6B7B\u8005\u4E4B\u95F4\u4F3C\u4E4E\u6BEB\u65E0\u5173\u8054\uFF0C\u5374\u90FD\u7559\u4E0B\u795E\u79D8\u7B26\u53F7\u3002\u5929\u624D\u5211\u8B66\u9648\u9ED8\u4E34\u5371\u53D7\u547D\uFF0C\u5728\u8C03\u67E5\u8FC7\u7A0B\u4E2D\u53D1\u73B0\u8FD9\u8D77\u6848\u4EF6\u80CC\u540E\u9690\u85CF\u7740\u4E00\u4E2A\u60CA\u5929\u9634\u8C0B\u3002\u968F\u7740\u8C03\u67E5\u6DF1\u5165\uFF0C\u9648\u9ED8\u53D1\u73B0\u51F6\u624B\u4F3C\u4E4E\u5BF9\u4ED6\u4E86\u5982\u6307\u638C\uFF0C\u4E00\u573A\u60CA\u5FC3\u52A8\u9B44\u7684\u732B\u9F20\u6E38\u620F\u5C31\u6B64\u5C55\u5F00\u3002",
        themes: ["\u60AC\u7591", "\u63A8\u7406", "\u72AF\u7F6A\u5FC3\u7406", "\u6B63\u4E49\u4E0E\u90AA\u6076"],
        totalEpisodes: 30
      }
    },
    {
      id: "script_romance",
      name: "\u751C\u5BA0\u7231\u60C5\xB7\u603B\u88C1\u7684\u5951\u7EA6\u59BB",
      category: "\u751C\u5BA0\u7231\u60C5",
      duration: "50\u96C6",
      desc: "\u5951\u7EA6\u5A5A\u59FB\u5047\u620F\u771F\u505A\uFF0C\u51B7\u9762\u603B\u88C1\u4E0E\u5143\u6C14\u5C11\u5973\u7684\u751C\u871C\u7231\u60C5\u6545\u4E8B\u3002",
      tags: ["\u751C\u5BA0", "\u7231\u60C5", "\u603B\u88C1", "\u5951\u7EA6\u5A5A\u59FB"],
      outline: {
        synopsis: "\u4E3A\u4E86\u6551\u75C5\u91CD\u7684\u5F1F\u5F1F\uFF0C\u6797\u5C0F\u590F\u88AB\u8FEB\u4E0E\u51B7\u9762\u603B\u88C1\u987E\u666F\u741B\u7B7E\u8BA2\u5951\u7EA6\u5A5A\u59FB\u3002\u672C\u4EE5\u4E3A\u53EA\u662F\u4E00\u573A\u4EA4\u6613\uFF0C\u5374\u5728\u76F8\u5904\u4E2D\u6E10\u751F\u60C5\u612B\u3002\u987E\u666F\u741B\u51B0\u51B7\u7684\u5FC3\u88AB\u6797\u5C0F\u590F\u7684\u6E29\u6696\u878D\u5316\uFF0C\u4E24\u4EBA\u4ECE\u5951\u7EA6\u592B\u59BB\u53D8\u6210\u771F\u5FC3\u76F8\u7231\uFF0C\u6700\u7EC8\u6536\u83B7\u751C\u871C\u7231\u60C5\u3002",
        themes: ["\u751C\u5BA0", "\u5951\u7EA6\u5A5A\u59FB", "\u5148\u5A5A\u540E\u7231", "\u6CBB\u6108"],
        totalEpisodes: 50
      }
    },
    {
      id: "script_horror",
      name: "\u6050\u6016\u60CA\u609A\xB7\u5348\u591C\u533B\u9662",
      category: "\u6050\u6016\u60CA\u609A",
      duration: "20\u96C6",
      desc: "\u5E9F\u5F03\u533B\u9662\u4E2D\u7684\u8BE1\u5F02\u4E8B\u4EF6\uFF0C\u80C6\u5927\u5984\u4E3A\u7684\u63A2\u9669\u8005\u4E00\u6B65\u6B65\u8E0F\u5165\u6B7B\u4EA1\u9677\u9631\u3002",
      tags: ["\u6050\u6016", "\u60CA\u609A", "\u60AC\u7591", "\u7075\u5F02"],
      outline: {
        synopsis: "\u4F20\u95FB\u57CE\u90CA\u5E9F\u5F03\u7684\u5723\u5FC3\u533B\u9662\u7ECF\u5E38\u53D1\u751F\u8BE1\u5F02\u4E8B\u4EF6\uFF0C\u4E94\u4E2A\u80C6\u5927\u7684\u5E74\u8F7B\u4EBA\u51B3\u5B9A\u6DF1\u591C\u53BB\u63A2\u9669\u3002\u7136\u800C\u4ED6\u4EEC\u4E0D\u77E5\u9053\uFF0C\u8FD9\u6240\u533B\u9662\u9690\u85CF\u7740\u4E0D\u4E3A\u4EBA\u77E5\u7684\u79D8\u5BC6\u3002\u968F\u7740\u63A2\u9669\u6DF1\u5165\uFF0C\u8BE1\u5F02\u4E8B\u4EF6\u63A5\u8FDE\u53D1\u751F\uFF0C\u4ED6\u4EEC\u53D1\u73B0\u81EA\u5DF1\u5DF2\u7ECF\u65E0\u6CD5\u79BB\u5F00\uFF0C\u4E00\u573A\u751F\u6B7B\u9003\u4EA1\u5C31\u6B64\u5C55\u5F00\u3002",
        themes: ["\u6050\u6016", "\u60CA\u609A", "\u7075\u5F02", "\u751F\u5B58"],
        totalEpisodes: 20
      }
    }
  ];
  var CHARACTER_TEMPLATES2 = [
    {
      id: "char_hero_male",
      name: "\u70ED\u8840\u7537\u4E3B",
      gender: "\u7537",
      role: "\u4E3B\u89D2",
      personality: "\u575A\u97E7\u4E0D\u62D4\u3001\u91CD\u60C5\u91CD\u4E49\u3001\u5AC9\u6076\u5982\u4EC7\u3001\u5076\u5C14\u51B2\u52A8",
      appearance: "20\u5C81\u5DE6\u53F3\u9752\u5E74\uFF0C\u5251\u7709\u661F\u76EE\uFF0C\u8EAB\u6750\u633A\u62D4\uFF0C\u5E38\u7A7F\u52B2\u88C5\uFF0C\u773C\u795E\u575A\u5B9A\u6709\u529B",
      bodyType: "muscular_male",
      color: "#c0392b"
    },
    {
      id: "char_heroine_female",
      name: "\u6E05\u51B7\u5973\u4E3B",
      gender: "\u5973",
      role: "\u4E3B\u89D2",
      personality: "\u5916\u51B7\u5185\u70ED\u3001\u806A\u6167\u8FC7\u4EBA\u3001\u72EC\u7ACB\u575A\u5F3A\u3001\u5FC3\u601D\u7F1C\u5BC6",
      appearance: "18\u5C81\u5C11\u5973\uFF0C\u51B7\u767D\u76AE\uFF0C\u9ED1\u8272\u957F\u53D1\uFF0C\u4E94\u5B98\u7CBE\u81F4\uFF0C\u6C14\u8D28\u6E05\u51B7\uFF0C\u5E38\u7A7F\u7D20\u8272\u957F\u88D9",
      bodyType: "elegant_female",
      color: "#2980b9"
    },
    {
      id: "char_villain",
      name: "\u9634\u9669\u53CD\u6D3E",
      gender: "\u7537",
      role: "\u53CD\u6D3E",
      personality: "\u5FC3\u72E0\u624B\u8FA3\u3001\u57CE\u5E9C\u6781\u6DF1\u3001\u91CE\u5FC3\u52C3\u52C3\u3001\u4E3A\u8FBE\u76EE\u7684\u4E0D\u62E9\u624B\u6BB5",
      appearance: "40\u5C81\u5DE6\u53F3\u4E2D\u5E74\uFF0C\u9762\u5BB9\u9634\u9E37\uFF0C\u773C\u795E\u9510\u5229\uFF0C\u5E38\u7A7F\u6DF1\u8272\u957F\u888D\uFF0C\u6C14\u8D28\u9634\u51B7",
      bodyType: "standard_male",
      color: "#2c3e50"
    },
    {
      id: "char_sidekick",
      name: "\u641E\u7B11\u914D\u89D2",
      gender: "\u7537",
      role: "\u914D\u89D2",
      personality: "\u5E7D\u9ED8\u98CE\u8DA3\u3001\u91CD\u60C5\u91CD\u4E49\u3001\u80C6\u5C0F\u4F46\u5173\u952E\u65F6\u523B\u9760\u8C31\u3001\u5403\u8D27",
      appearance: "20\u5C81\u5DE6\u53F3\u9752\u5E74\uFF0C\u5706\u8138\u5FAE\u80D6\uFF0C\u7B11\u5BB9\u53EF\u63AC\uFF0C\u5E38\u7A7F\u5BBD\u677E\u670D\u9970\uFF0C\u770B\u8D77\u6765\u61A8\u539A\u53EF\u7231",
      bodyType: "standard_male",
      color: "#f39c12"
    },
    {
      id: "char_master",
      name: "\u795E\u79D8\u5BFC\u5E08",
      gender: "\u7537",
      role: "\u5BFC\u5E08",
      personality: "\u6DF1\u4E0D\u53EF\u6D4B\u3001\u4EA6\u6B63\u4EA6\u90AA\u3001\u667A\u6167\u8D85\u7FA4\u3001\u884C\u8E2A\u4E0D\u5B9A",
      appearance: "60\u5C81\u5DE6\u53F3\u8001\u8005\uFF0C\u767D\u53D1\u767D\u987B\uFF0C\u773C\u795E\u6DF1\u9083\uFF0C\u5E38\u7A7F\u7070\u8272\u957F\u888D\uFF0C\u6C14\u8D28\u4ED9\u98CE\u9053\u9AA8",
      bodyType: "standard_male",
      color: "#7f8c8d"
    },
    {
      id: "char_femme_fatale",
      name: "\u9B45\u60D1\u5973\u914D",
      gender: "\u5973",
      role: "\u5973\u914D",
      personality: "\u98CE\u60C5\u4E07\u79CD\u3001\u5FC3\u673A\u6DF1\u6C89\u3001\u4EA6\u6B63\u4EA6\u90AA\u3001\u4E3A\u60C5\u6240\u56F0",
      appearance: "25\u5C81\u5DE6\u53F3\u5973\u6027\uFF0C\u7F8E\u8273\u52A8\u4EBA\uFF0C\u8EAB\u6750\u706B\u8FA3\uFF0C\u5E38\u7A7F\u7EA2\u8272\u670D\u9970\uFF0C\u773C\u795E\u52FE\u9B42\u6444\u9B44",
      bodyType: "standard_female",
      color: "#e74c3c"
    }
  ];
  var STORYBOARD_TEMPLATES = [
    {
      id: "sb_fight",
      name: "\u6B66\u4FA0\u6253\u6597\u573A\u666F",
      category: "\u52A8\u4F5C",
      shots: [
        { title: "\u9AD8\u624B\u5BF9\u5CD9", sceneType: "\u5168\u666F", cameraMove: "\u56FA\u5B9A", sceneDesc: "\u4E24\u4F4D\u9AD8\u624B\u5728\u5C71\u5DC5\u5BF9\u5CD9\uFF0C\u72C2\u98CE\u547C\u5578\uFF0C\u8863\u8882\u7FFB\u98DE\uFF0C\u6C14\u6C1B\u7D27\u5F20\u5230\u6781\u70B9\u3002" },
        { title: "\u62D4\u5251\u77AC\u95F4", sceneType: "\u7279\u5199", cameraMove: "\u5FEB\u901F\u63A8\u955C", sceneDesc: "\u4E3B\u89D2\u7F13\u7F13\u62D4\u51FA\u957F\u5251\uFF0C\u5251\u8EAB\u5728\u6708\u5149\u4E0B\u5BD2\u5149\u95EA\u70C1\uFF0C\u773C\u795E\u9510\u5229\u5982\u9E70\u3002" },
        { title: "\u98DE\u8EAB\u51FA\u62DB", sceneType: "\u4E2D\u666F", cameraMove: "\u8DDF\u62CD", sceneDesc: "\u4E3B\u89D2\u98DE\u8EAB\u8DC3\u8D77\uFF0C\u957F\u5251\u5212\u51FA\u4E00\u9053\u5BD2\u5149\uFF0C\u5411\u5BF9\u624B\u5288\u53BB\uFF0C\u52A8\u4F5C\u884C\u4E91\u6D41\u6C34\u3002" },
        { title: "\u5175\u5668\u76F8\u4EA4", sceneType: "\u8FD1\u666F", cameraMove: "\u56FA\u5B9A", sceneDesc: "\u53CC\u5251\u76F8\u4EA4\uFF0C\u706B\u82B1\u56DB\u6E85\uFF0C\u5DE8\u5927\u7684\u51B2\u51FB\u529B\u8BA9\u5468\u56F4\u7A7A\u6C14\u90FD\u5728\u9707\u98A4\u3002" },
        { title: "\u80DC\u8D1F\u5DF2\u5206", sceneType: "\u5168\u666F", cameraMove: "\u62C9\u8FDC", sceneDesc: "\u5BF9\u624B\u7F13\u7F13\u5012\u4E0B\uFF0C\u4E3B\u89D2\u6536\u5251\u800C\u7ACB\uFF0C\u5915\u9633\u897F\u4E0B\uFF0C\u80CC\u5F71\u5B64\u5BC2\u800C\u4F1F\u5CB8\u3002" }
      ]
    },
    {
      id: "sb_romance",
      name: "\u6D6A\u6F2B\u7EA6\u4F1A\u573A\u666F",
      category: "\u7231\u60C5",
      shots: [
        { title: "\u521D\u6B21\u76F8\u9047", sceneType: "\u4E2D\u666F", cameraMove: "\u7F13\u6162\u63A8\u955C", sceneDesc: "\u5496\u5561\u5385\u4E2D\uFF0C\u7537\u5973\u4E3B\u76EE\u5149\u76F8\u9047\uFF0C\u65F6\u95F4\u4EFF\u4F5B\u9759\u6B62\uFF0C\u7A7A\u6C14\u4E2D\u5F25\u6F2B\u7740\u66A7\u6627\u7684\u6C14\u606F\u3002" },
        { title: "\u7F9E\u6DA9\u4EA4\u8C08", sceneType: "\u8FD1\u666F", cameraMove: "\u56FA\u5B9A", sceneDesc: "\u4E24\u4EBA\u76F8\u5BF9\u800C\u5750\uFF0C\u5973\u4E3B\u7F9E\u6DA9\u5730\u4F4E\u5934\u6405\u62CC\u5496\u5561\uFF0C\u7537\u4E3B\u6E29\u67D4\u5730\u6CE8\u89C6\u7740\u5979\u3002" },
        { title: "\u5E76\u80A9\u6563\u6B65", sceneType: "\u5168\u666F", cameraMove: "\u8DDF\u62CD", sceneDesc: "\u5915\u9633\u4E0B\uFF0C\u4E24\u4EBA\u5E76\u80A9\u8D70\u5728\u6797\u836B\u9053\u4E0A\uFF0C\u5F71\u5B50\u88AB\u62C9\u5F97\u5F88\u957F\uFF0C\u6E29\u99A8\u800C\u6D6A\u6F2B\u3002" },
        { title: "\u5FC3\u52A8\u77AC\u95F4", sceneType: "\u7279\u5199", cameraMove: "\u56FA\u5B9A", sceneDesc: "\u7537\u4E3B\u8F7B\u8F7B\u62C2\u53BB\u5973\u4E3B\u53D1\u95F4\u7684\u843D\u53F6\uFF0C\u4E24\u4EBA\u56DB\u76EE\u76F8\u5BF9\uFF0C\u5FC3\u8DF3\u52A0\u901F\u3002" },
        { title: "\u751C\u871C\u7275\u624B", sceneType: "\u8FD1\u666F", cameraMove: "\u7F13\u6162\u63A8\u955C", sceneDesc: "\u7537\u4E3B\u9F13\u8D77\u52C7\u6C14\u7275\u8D77\u5973\u4E3B\u7684\u624B\uFF0C\u5973\u4E3B\u5FAE\u5FAE\u4E00\u6123\uFF0C\u7136\u540E\u9732\u51FA\u5E78\u798F\u7684\u7B11\u5BB9\u3002" }
      ]
    },
    {
      id: "sb_suspense",
      name: "\u60AC\u7591\u63A2\u6848\u573A\u666F",
      category: "\u60AC\u7591",
      shots: [
        { title: "\u6848\u53D1\u73B0\u573A", sceneType: "\u5168\u666F", cameraMove: "\u7F13\u6162\u63A8\u955C", sceneDesc: "\u660F\u6697\u7684\u623F\u95F4\u91CC\uFF0C\u8B66\u6212\u7EBF\u62C9\u8D77\uFF0C\u8B66\u5458\u4EEC\u6B63\u5728\u52D8\u67E5\u73B0\u573A\uFF0C\u6C14\u6C1B\u51DD\u91CD\u800C\u8BE1\u5F02\u3002" },
        { title: "\u53D1\u73B0\u7EBF\u7D22", sceneType: "\u7279\u5199", cameraMove: "\u56FA\u5B9A", sceneDesc: "\u5211\u8B66\u8E72\u4E0B\u8EAB\u5B50\uFF0C\u76EE\u5149\u9510\u5229\u5730\u76EF\u7740\u5730\u4E0A\u7684\u4E00\u679A\u7EBD\u6263\uFF0C\u8FD9\u662F\u5173\u952E\u7EBF\u7D22\u3002" },
        { title: "\u63A8\u7406\u5206\u6790", sceneType: "\u4E2D\u666F", cameraMove: "\u56FA\u5B9A", sceneDesc: "\u5211\u8B66\u7AD9\u5728\u767D\u677F\u524D\uFF0C\u4E0A\u9762\u8D34\u6EE1\u7167\u7247\u548C\u7EBF\u7D22\uFF0C\u4ED6\u6B63\u5728\u68B3\u7406\u6848\u4EF6\u7684\u6765\u9F99\u53BB\u8109\u3002" },
        { title: "\u8FFD\u8E2A\u5ACC\u7591\u4EBA", sceneType: "\u5168\u666F", cameraMove: "\u8DDF\u62CD", sceneDesc: "\u96E8\u591C\uFF0C\u5211\u8B66\u6491\u4F1E\u8DDF\u8E2A\u5ACC\u7591\u4EBA\uFF0C\u4E24\u4EBA\u4FDD\u6301\u8DDD\u79BB\uFF0C\u6C14\u6C1B\u7D27\u5F20\u800C\u538B\u6291\u3002" },
        { title: "\u771F\u76F8\u5927\u767D", sceneType: "\u4E2D\u666F", cameraMove: "\u56FA\u5B9A", sceneDesc: "\u5BA1\u8BAF\u5BA4\u4E2D\uFF0C\u5211\u8B66\u5C06\u8BC1\u636E\u4E00\u4E00\u6446\u51FA\uFF0C\u5ACC\u7591\u4EBA\u7684\u5FC3\u7406\u9632\u7EBF\u7EC8\u4E8E\u5D29\u6E83\u3002" }
      ]
    },
    {
      id: "sb_horror",
      name: "\u6050\u6016\u60CA\u609A\u573A\u666F",
      category: "\u6050\u6016",
      shots: [
        { title: "\u8FDB\u5165\u7981\u5730", sceneType: "\u5168\u666F", cameraMove: "\u7F13\u6162\u63A8\u955C", sceneDesc: "\u6DF1\u591C\uFF0C\u63A2\u9669\u8005\u4EEC\u63A8\u5F00\u5E9F\u5F03\u533B\u9662\u7684\u5927\u95E8\uFF0C\u94C1\u95E8\u53D1\u51FA\u523A\u8033\u7684\u58F0\u54CD\uFF0C\u9ED1\u6697\u4E2D\u4F3C\u4E4E\u6709\u4EC0\u4E48\u5728\u6CE8\u89C6\u7740\u4ED6\u4EEC\u3002" },
        { title: "\u8BE1\u5F02\u58F0\u54CD", sceneType: "\u8FD1\u666F", cameraMove: "\u56FA\u5B9A", sceneDesc: "\u8D70\u5ECA\u6DF1\u5904\u4F20\u6765\u8BE1\u5F02\u7684\u811A\u6B65\u58F0\uFF0C\u63A2\u9669\u8005\u4EEC\u505C\u4E0B\u811A\u6B65\uFF0C\u7D27\u5F20\u5730\u63E1\u7D27\u624B\u4E2D\u7684\u8BBE\u5907\u3002" },
        { title: "\u6050\u6016\u53D1\u73B0", sceneType: "\u7279\u5199", cameraMove: "\u5FEB\u901F\u63A8\u955C", sceneDesc: "\u624B\u7535\u7B52\u7684\u5149\u7167\u5230\u5899\u4E0A\uFF0C\u8D6B\u7136\u662F\u4E00\u4E2A\u7528\u8840\u5199\u6210\u7684\u8B66\u544A\u7B26\u53F7\uFF0C\u4F17\u4EBA\u8138\u8272\u715E\u767D\u3002" },
        { title: "\u4ED3\u7687\u9003\u8DD1", sceneType: "\u5168\u666F", cameraMove: "\u5FEB\u901F\u8DDF\u62CD", sceneDesc: "\u6050\u6016\u7684\u8EAB\u5F71\u51FA\u73B0\uFF0C\u63A2\u9669\u8005\u4EEC\u5C16\u53EB\u7740\u56DB\u6563\u5954\u9003\uFF0C\u8D70\u5ECA\u91CC\u56DE\u8361\u7740\u6025\u4FC3\u7684\u811A\u6B65\u58F0\u3002" },
        { title: "\u751F\u6B7B\u4E00\u7EBF", sceneType: "\u8FD1\u666F", cameraMove: "\u624B\u6301\u6643\u52A8", sceneDesc: "\u4E3B\u89D2\u8EB2\u5728\u67DC\u5B50\u91CC\uFF0C\u5C4F\u4F4F\u547C\u5438\uFF0C\u6050\u6016\u7684\u811A\u6B65\u58F0\u8D8A\u6765\u8D8A\u8FD1\uFF0C\u67DC\u95E8\u88AB\u7F13\u7F13\u6253\u5F00\u3002" }
      ]
    }
  ];
  function TemplateMarket({ project: project2, update, log, onClose }) {
    const [activeCategory, setActiveCategory] = (0, import_react10.useState)("script");
    const [selectedTemplate, setSelectedTemplate] = (0, import_react10.useState)(null);
    const categories = [
      { key: "script", label: "\u{1F4D6} \u5267\u672C\u6A21\u677F", count: SCRIPT_TEMPLATES.length },
      { key: "character", label: "\u{1F464} \u89D2\u8272\u6A21\u677F", count: CHARACTER_TEMPLATES2.length },
      { key: "storyboard", label: "\u{1F3AC} \u5206\u955C\u6A21\u677F", count: STORYBOARD_TEMPLATES.length }
    ];
    const getCurrentTemplates = () => {
      if (activeCategory === "script") return SCRIPT_TEMPLATES;
      if (activeCategory === "character") return CHARACTER_TEMPLATES2;
      return STORYBOARD_TEMPLATES;
    };
    const applyTemplate = (template) => {
      if (activeCategory === "script") {
        update({
          title: template.name,
          outline: template.outline,
          script: template.outline.synopsis
        });
        log(`\u2705 \u5DF2\u5E94\u7528\u5267\u672C\u6A21\u677F\uFF1A${template.name}`);
      } else if (activeCategory === "character") {
        const newChar = {
          id: "char_" + Date.now(),
          name: template.name,
          role: template.role,
          personality: template.personality,
          appearance: template.appearance,
          bodyType: template.bodyType,
          color: template.color,
          image: null
        };
        const existingChars = project2?.materials?.characters || [];
        update({
          materials: {
            ...project2.materials,
            characters: [...existingChars, newChar]
          }
        });
        log(`\u2705 \u5DF2\u6DFB\u52A0\u89D2\u8272\u6A21\u677F\uFF1A${template.name}`);
      } else if (activeCategory === "storyboard") {
        const newShots = template.shots.map((s2, i) => ({
          id: "shot_" + Date.now() + "_" + i,
          title: s2.title,
          sceneType: s2.sceneType,
          cameraMove: s2.cameraMove,
          sceneDesc: s2.sceneDesc,
          imageUrl: null,
          videoUrl: null,
          duration: 5
        }));
        const existingShots = project2?.shots || [];
        update({ shots: [...existingShots, ...newShots] });
        log(`\u2705 \u5DF2\u5E94\u7528\u5206\u955C\u6A21\u677F\uFF1A${template.name}\uFF08${newShots.length}\u4E2A\u955C\u5934\uFF09`);
      }
      setSelectedTemplate(null);
      if (onClose) onClose();
    };
    const templates = getCurrentTemplates();
    return /* @__PURE__ */ import_react10.default.createElement("div", { style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999 }, onClick: onClose }, /* @__PURE__ */ import_react10.default.createElement(
      "div",
      {
        style: { width: "90%", maxWidth: 1e3, maxHeight: "85vh", background: "var(--panel, #1a1a2e)", border: "1px solid var(--border, #2a2a4a)", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column" },
        onClick: (e) => e.stopPropagation()
      },
      /* @__PURE__ */ import_react10.default.createElement("div", { style: { padding: "16px 20px", borderBottom: "1px solid var(--border, #2a2a4a)", display: "flex", justifyContent: "space-between", alignItems: "center" } }, /* @__PURE__ */ import_react10.default.createElement("h2", { style: { margin: 0, fontSize: 18, color: "var(--text, #fff)" } }, "\u{1F3A8} \u6A21\u677F\u5E02\u573A"), /* @__PURE__ */ import_react10.default.createElement("button", { onClick: onClose, style: { border: "none", background: "transparent", color: "var(--text-muted, #888)", cursor: "pointer", fontSize: 20 } }, "\xD7")),
      /* @__PURE__ */ import_react10.default.createElement("div", { style: { display: "flex", borderBottom: "1px solid var(--border, #2a2a4a)" } }, categories.map((cat) => /* @__PURE__ */ import_react10.default.createElement(
        "button",
        {
          key: cat.key,
          onClick: () => {
            setActiveCategory(cat.key);
            setSelectedTemplate(null);
          },
          style: {
            flex: 1,
            padding: "12px 0",
            border: "none",
            background: activeCategory === cat.key ? "rgba(122,92,255,0.15)" : "transparent",
            color: activeCategory === cat.key ? "#7a5cff" : "var(--text-muted, #888)",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: activeCategory === cat.key ? 600 : 400,
            borderBottom: activeCategory === cat.key ? "2px solid #7a5cff" : "2px solid transparent"
          }
        },
        cat.label,
        " ",
        /* @__PURE__ */ import_react10.default.createElement("span", { style: { fontSize: 11, opacity: 0.7 } }, "(", cat.count, ")")
      ))),
      /* @__PURE__ */ import_react10.default.createElement("div", { style: { flex: 1, overflow: "auto", padding: 16 } }, /* @__PURE__ */ import_react10.default.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 } }, templates.map((tpl) => /* @__PURE__ */ import_react10.default.createElement(
        "div",
        {
          key: tpl.id,
          onClick: () => setSelectedTemplate(tpl),
          style: {
            padding: 14,
            border: selectedTemplate?.id === tpl.id ? "2px solid #7a5cff" : "1px solid var(--border, #2a2a4a)",
            borderRadius: 10,
            background: selectedTemplate?.id === tpl.id ? "rgba(122,92,255,0.08)" : "var(--panel-2, #15152a)",
            cursor: "pointer",
            transition: "all 0.2s"
          }
        },
        /* @__PURE__ */ import_react10.default.createElement("div", { style: { fontSize: 14, fontWeight: 600, color: "var(--text, #fff)", marginBottom: 6 } }, tpl.name),
        tpl.category && /* @__PURE__ */ import_react10.default.createElement("span", { style: { display: "inline-block", padding: "2px 8px", background: "rgba(122,92,255,0.15)", borderRadius: 4, fontSize: 10, color: "#7a5cff", marginBottom: 8 } }, tpl.category),
        tpl.duration && /* @__PURE__ */ import_react10.default.createElement("span", { style: { fontSize: 11, color: "var(--text-muted, #888)", marginLeft: 8 } }, tpl.duration),
        tpl.gender && /* @__PURE__ */ import_react10.default.createElement("span", { style: { fontSize: 11, color: "var(--text-muted, #888)", marginLeft: 8 } }, tpl.gender),
        tpl.role && /* @__PURE__ */ import_react10.default.createElement("span", { style: { fontSize: 11, color: "var(--text-muted, #888)", marginLeft: 8 } }, tpl.role),
        /* @__PURE__ */ import_react10.default.createElement("div", { style: { fontSize: 12, color: "var(--text-secondary, #aaa)", marginTop: 8, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } }, tpl.desc || tpl.personality || tpl.outline?.synopsis || `${tpl.shots?.length || 0}\u4E2A\u955C\u5934`),
        tpl.tags && /* @__PURE__ */ import_react10.default.createElement("div", { style: { display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 } }, tpl.tags.map((tag, i) => /* @__PURE__ */ import_react10.default.createElement("span", { key: i, style: { padding: "1px 6px", background: "var(--input-bg, #1a1a2e)", borderRadius: 3, fontSize: 10, color: "var(--text-muted, #888)" } }, tag)))
      )))),
      /* @__PURE__ */ import_react10.default.createElement("div", { style: { padding: "12px 20px", borderTop: "1px solid var(--border, #2a2a4a)", display: "flex", justifyContent: "space-between", alignItems: "center" } }, /* @__PURE__ */ import_react10.default.createElement("span", { style: { fontSize: 12, color: "var(--text-muted, #888)" } }, selectedTemplate ? `\u5DF2\u9009\u62E9\uFF1A${selectedTemplate.name}` : "\u70B9\u51FB\u9009\u62E9\u4E00\u4E2A\u6A21\u677F"), /* @__PURE__ */ import_react10.default.createElement("div", { style: { display: "flex", gap: 10 } }, /* @__PURE__ */ import_react10.default.createElement("button", { onClick: onClose, style: { padding: "8px 16px", border: "1px solid var(--border, #2a2a4a)", borderRadius: 6, background: "transparent", color: "var(--text, #aaa)", cursor: "pointer", fontSize: 13 } }, "\u53D6\u6D88"), /* @__PURE__ */ import_react10.default.createElement(
        "button",
        {
          onClick: () => selectedTemplate && applyTemplate(selectedTemplate),
          disabled: !selectedTemplate,
          style: { padding: "8px 20px", border: "none", borderRadius: 6, background: selectedTemplate ? "linear-gradient(135deg, #7a5cff, #5ce1e6)" : "#555", color: "#fff", cursor: selectedTemplate ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 600 }
        },
        "\u5E94\u7528\u6A21\u677F"
      )))
    ));
  }

  // src/components/AssetLibrary.jsx
  var import_react12 = __toESM(__require("react"), 1);
  var import_core2 = __require("@tauri-apps/api/core");
  var import_glm_client = __require("@dual/glm-client");
  var THREE2 = __toESM(__require("three"), 1);
  var import_GLTFExporter = __require("three/examples/jsm/exporters/GLTFExporter.js");

  // src/components/ImageLightbox.jsx
  var import_react11 = __toESM(__require("react"), 1);
  function ImageLightbox({ src, alt, onClose }) {
    (0, import_react11.useEffect)(() => {
      const onKey = (e) => {
        if (e.key === "Escape") onClose && onClose();
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);
    const handleDownload = async () => {
      if (!src) return;
      const filename = (alt || "image") + ".png";
      if (src.startsWith("blob:") || src.startsWith("data:")) {
        try {
          const response = await fetch(src);
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (e) {
          alert("\u4E0B\u8F7D\u5931\u8D25\uFF1A" + e.message);
        }
      } else {
        const success = await downloadUrl(src, filename);
        if (!success) {
          if (confirm("\u76F4\u63A5\u4E0B\u8F7D\u5931\u8D25\uFF0C\u662F\u5426\u5728\u6D4F\u89C8\u5668\u4E2D\u6253\u5F00\uFF1F")) {
            window.open(src, "_blank");
          }
        }
      }
    };
    if (!src) return null;
    return /* @__PURE__ */ import_react11.default.createElement(
      "div",
      {
        onClick: onClose,
        style: {
          position: "fixed",
          inset: 0,
          zIndex: 2e3,
          background: "rgba(6,8,16,0.86)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24
        }
      },
      /* @__PURE__ */ import_react11.default.createElement(
        "div",
        {
          onClick: (e) => e.stopPropagation(),
          style: { position: "relative", maxWidth: "92vw", maxHeight: "92vh", display: "flex", flexDirection: "column", alignItems: "center" }
        },
        /* @__PURE__ */ import_react11.default.createElement(
          "img",
          {
            src,
            alt: alt || "",
            style: { maxWidth: "92vw", maxHeight: "82vh", objectFit: "contain", borderRadius: 10, boxShadow: "0 12px 48px rgba(0,0,0,0.6)", background: "#000" }
          }
        ),
        /* @__PURE__ */ import_react11.default.createElement("div", { style: { display: "flex", gap: 10, marginTop: 12 } }, /* @__PURE__ */ import_react11.default.createElement(
          "button",
          {
            onClick: handleDownload,
            style: { padding: "7px 14px", borderRadius: 8, background: "var(--accent-gradient, linear-gradient(135deg,#7c3aed,#3b82f6))", color: "#fff", fontSize: 13, border: "none", cursor: "pointer", fontWeight: 600 }
          },
          "\u2B07 \u4E0B\u8F7D\u539F\u56FE"
        ), /* @__PURE__ */ import_react11.default.createElement(
          "button",
          {
            onClick: onClose,
            style: { padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", color: "#e8ecf3", fontSize: 13, cursor: "pointer" }
          },
          "\u2715 \u5173\u95ED\uFF08Esc\uFF09"
        )),
        alt && /* @__PURE__ */ import_react11.default.createElement("div", { style: { color: "var(--text-secondary,#8b95a7)", fontSize: 12, marginTop: 8, textAlign: "center" } }, alt)
      )
    );
  }

  // src/components/AssetLibrary.jsx
  var STYLE_OPTIONS3 = [
    { value: "cinematic", label: "\u7535\u5F71\u5199\u5B9E", desc: "\u7535\u5F71\u7EA7\u5199\u5B9E\u98CE\u683C\uFF0C\u80F6\u7247\u8D28\u611F\uFF0C\u4E13\u4E1A\u5149\u5F71\uFF0C\u9AD8\u5BF9\u6BD4\u5EA6" },
    { value: "anime", label: "\u52A8\u6F2B/\u6E38\u620F\u539F\u753B", desc: "\u4E13\u4E1A\u89D2\u8272\u8BBE\u5B9A\u56FE\u98CE\u683C\uFF0C\u52A8\u6F2B/\u6E38\u620F\u539F\u753B\u54C1\u8D28" },
    { value: "realistic", label: "\u8D85\u5199\u5B9E\u771F\u4EBA", desc: "\u8D85\u5199\u5B9E\u771F\u4EBA\u7167\u7247\u98CE\u683C\uFF0C\u771F\u5B9E\u76AE\u80A4\u8D28\u611F\uFF0C\u7535\u5F71\u7EA7\u5149\u5F71" },
    { value: "wuxia", label: "\u56FD\u98CE\u6B66\u4FA0", desc: "\u4E2D\u56FD\u53E4\u98CE\u6B66\u4FA0\u98CE\u683C\uFF0C\u6C34\u58A8\u610F\u5883\uFF0C\u4F20\u7EDF\u670D\u9970\uFF0C\u5DE5\u7B14\u91CD\u5F69" },
    { value: "cyberpunk", label: "\u8D5B\u535A\u670B\u514B", desc: "\u8D5B\u535A\u670B\u514B\u79D1\u5E7B\u98CE\u683C\uFF0C\u9713\u8679\u706F\u5149\uFF0C\u673A\u68B0\u4E49\u4F53\uFF0C\u672A\u6765\u90FD\u5E02" },
    { value: "3d", label: "3D\u6E32\u67D3", desc: "3D\u6E32\u67D3\u98CE\u683C\uFF0CPBR\u6750\u8D28\uFF0C\u6B21\u4E16\u4EE3\u6E38\u620F\u753B\u9762\uFF0C\u7CBE\u7EC6\u5EFA\u6A21" }
  ];
  var ASPECT_RATIO_OPTIONS2 = [
    { value: "1:1", label: "1:1 \u65B9\u5F62", size: "1328x1328" },
    { value: "16:9", label: "16:9 \u6A2A\u5C4F", size: "1820x1024" },
    { value: "9:16", label: "9:16 \u7AD6\u5C4F", size: "1024x1820" },
    { value: "4:3", label: "4:3 \u6807\u51C6", size: "1152x864" },
    { value: "3:4", label: "3:4 \u7AD6\u7248", size: "864x1152" }
  ];
  var TYPES = [
    ["all", "\u5168\u90E8"],
    ["image", "\u{1F5BC} \u56FE\u7247"],
    ["video", "\u{1F3AC} \u89C6\u9891"],
    ["audio", "\u{1F50A} \u97F3\u6548"],
    ["music", "\u{1F3B5} \u97F3\u4E50"],
    ["sticker", "\u{1F31F} \u8D34\u7EB8"],
    ["text", "\u{1F4DD} \u6587\u5B57"]
  ];
  var SECTIONS = [
    { k: "all", label: "\u5168\u90E8\u7D20\u6750" },
    { k: "characters", label: "\u{1F3AD} \u89D2\u8272" },
    { k: "scenes", label: "\u{1F3AA} \u573A\u666F" }
  ];
  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }
  function parseDescColor(desc, fallback) {
    const colors = { \u7EA2: 13386820, \u9EC4: 15645508, \u84DD: 4482764, \u7EFF: 4500070, \u9ED1: 2236962, \u767D: 16119285, \u7070: 8947848, \u7D2B: 8930508, \u7C89: 15632554, \u68D5: 9132587, \u6A59: 15632452, \u7C73: 14469288, \u9752: 4500138 };
    for (const [k, v] of Object.entries(colors)) {
      if ((desc || "").includes(k)) return v;
    }
    return fallback;
  }
  function arrayBufferToBase64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = "";
    const chunk = 32768;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }
  function exportGLB(scene) {
    return new Promise((resolve, reject) => {
      const exporter = new import_GLTFExporter.GLTFExporter();
      exporter.parse(scene, (gltf) => resolve(gltf), (err) => reject(err), { binary: true });
    });
  }
  function createCharacterGLB(desc) {
    const d = (desc || "").toLowerCase();
    const female = d.includes("\u5973") || d.includes("actress") || d.includes("lady") || d.includes("girl");
    const male = !female && (d.includes("\u7537") || d.includes("man") || d.includes("boy"));
    const height = d.includes("\u9AD8") || d.includes("tall") ? 1.85 : d.includes("\u77EE") || d.includes("short") ? 1.55 : 1.7;
    const skin = parseDescColor(desc, 16109744);
    const top = parseDescColor((desc || "") + " \u8863", female ? 14057396 : 3828382);
    const bottom = parseDescColor((desc || "") + " \u88E4", female ? 4868698 : 3029838);
    const scene = new THREE2.Scene();
    const group = new THREE2.Group();
    scene.add(group);
    const skinMat = new THREE2.MeshStandardMaterial({ color: skin, roughness: 0.6 });
    const topMat = new THREE2.MeshStandardMaterial({ color: top, roughness: 0.7 });
    const bottomMat = new THREE2.MeshStandardMaterial({ color: bottom, roughness: 0.7 });
    const hairMat = new THREE2.MeshStandardMaterial({ color: 2232576, roughness: 0.9 });
    const s2 = height / 1.7;
    const head = new THREE2.Mesh(new THREE2.SphereGeometry(0.12 * s2, 24, 24), skinMat);
    head.position.y = 1.55 * s2;
    group.add(head);
    const hair = new THREE2.Mesh(new THREE2.SphereGeometry(0.13 * s2, 24, 24), hairMat);
    hair.position.y = 1.6 * s2;
    hair.scale.set(1, 0.8, 1);
    group.add(hair);
    const torso = new THREE2.Mesh(new THREE2.CylinderGeometry(0.18 * s2, 0.15 * s2, 0.55 * s2, 16), topMat);
    torso.position.y = 1.18 * s2;
    group.add(torso);
    const armGeo = new THREE2.CylinderGeometry(0.05 * s2, 0.04 * s2, 0.55 * s2, 12);
    const leftArm = new THREE2.Mesh(armGeo, skinMat);
    leftArm.position.set(-0.25 * s2, 1.18 * s2, 0);
    group.add(leftArm);
    const rightArm = new THREE2.Mesh(armGeo, skinMat);
    rightArm.position.set(0.25 * s2, 1.18 * s2, 0);
    group.add(rightArm);
    const legGeo = new THREE2.CylinderGeometry(0.07 * s2, 0.06 * s2, 0.75 * s2, 12);
    const leftLeg = new THREE2.Mesh(legGeo, bottomMat);
    leftLeg.position.set(-0.1 * s2, 0.45 * s2, 0);
    group.add(leftLeg);
    const rightLeg = new THREE2.Mesh(legGeo, bottomMat);
    rightLeg.position.set(0.1 * s2, 0.45 * s2, 0);
    group.add(rightLeg);
    return exportGLB(scene);
  }
  function createSceneGLB(desc) {
    const d = (desc || "").toLowerCase();
    const floorColor = parseDescColor(desc, 5921370);
    const wallColor = parseDescColor((desc || "") + " \u5899", 9145227);
    const scene = new THREE2.Scene();
    const floor = new THREE2.Mesh(new THREE2.PlaneGeometry(8, 8), new THREE2.MeshStandardMaterial({ color: floorColor, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const wall1 = new THREE2.Mesh(new THREE2.PlaneGeometry(8, 4), new THREE2.MeshStandardMaterial({ color: wallColor, roughness: 0.9 }));
    wall1.position.set(0, 2, -4);
    scene.add(wall1);
    const wall2 = new THREE2.Mesh(new THREE2.PlaneGeometry(8, 4), new THREE2.MeshStandardMaterial({ color: wallColor, roughness: 0.9 }));
    wall2.rotation.y = Math.PI / 2;
    wall2.position.set(-4, 2, 0);
    scene.add(wall2);
    return exportGLB(scene);
  }
  function AssetLibrary({ project: project2, update, log, onUseDub, onUseEdit }) {
    const assets = project2?.assets || [];
    const trash = project2?.assetTrash || [];
    const materials = project2?.materials || { characters: [], scenes: [] };
    const characters = materials.characters || [];
    const scenes = materials.scenes || [];
    const [section, setSection] = (0, import_react12.useState)("all");
    const [filter, setFilter] = (0, import_react12.useState)("all");
    const [q, setQ] = (0, import_react12.useState)("");
    const [tagFilter, setTagFilter] = (0, import_react12.useState)("");
    const [sel, setSel] = (0, import_react12.useState)({});
    const [showTrash, setShowTrash] = (0, import_react12.useState)(false);
    const [adding, setAdding] = (0, import_react12.useState)(false);
    const [newTitle, setNewTitle] = (0, import_react12.useState)("");
    const [newType, setNewType] = (0, import_react12.useState)("image");
    const [newUrl, setNewUrl] = (0, import_react12.useState)("");
    const [newFile, setNewFile] = (0, import_react12.useState)(null);
    const [importingChar3d, setImportingChar3d] = (0, import_react12.useState)(null);
    const [importingScene3d, setImportingScene3d] = (0, import_react12.useState)(null);
    const [uploadingView, setUploadingView] = (0, import_react12.useState)(null);
    const [lightbox, setLightbox] = (0, import_react12.useState)(null);
    const [analyzeBusy, setAnalyzeBusy] = (0, import_react12.useState)(false);
    const [selectedStyle, setSelectedStyle] = (0, import_react12.useState)("cinematic");
    const [selectedAspectRatio, setSelectedAspectRatio] = (0, import_react12.useState)("1:1");
    const fileRef = import_react12.default.useRef(null);
    const char3dRef = import_react12.default.useRef(null);
    const scene3dRef = import_react12.default.useRef(null);
    const fourViewRef = import_react12.default.useRef(null);
    const sheetRef = import_react12.default.useRef(null);
    const setAssets = (next) => update({ assets: next });
    const setTrash = (next) => update({ assetTrash: next });
    const setMaterials = (next) => update({ materials: { ...materials, ...next } });
    const analyzeMaterials = async () => {
      const srcText = (project2.sourceText || project2.idea || "").trim();
      const fallback = (project2.shots || []).map((s2) => `${s2.title || ""}\u3002${s2.sceneDesc || ""} ${s2.cnPrompt || ""}`).join("\n").trim();
      const text = srcText || fallback;
      if (!text) {
        if (log) log("\u6682\u65E0\u53EF\u7528\u6587\u672C\uFF1A\u8BF7\u5148\u5BFC\u5165\u5C0F\u8BF4/\u5267\u672C\u6216\u586B\u5199\u6545\u4E8B\u6897\u6982/\u5206\u955C\u63CF\u8FF0\u3002");
        return;
      }
      setAnalyzeBusy(true);
      if (log) log("\u6B63\u5728\u7528 AI \u5206\u6790\u5168\u6587\u4E2D\u7684\u89D2\u8272\u4E0E\u573A\u666F\u2026");
      try {
        const prompt = `\u4F60\u662F\u4E00\u540D\u77ED\u5267\u89C6\u89C9\u7B56\u5212\u3002\u8BF7\u9605\u8BFB\u4EE5\u4E0B\u6545\u4E8B/\u5267\u672C\uFF0C\u63D0\u53D6\u4E3B\u8981\u89D2\u8272\u4E0E\u5173\u952E\u573A\u666F\uFF0C\u8F93\u51FA\u4E25\u683C JSON\u3002
\u8981\u6C42\uFF1A
1. characters \u6570\u7EC4\uFF1A\u81F3\u5C11\u63D0\u53D6 1-3 \u4F4D\u4E3B\u8981\u89D2\u8272\uFF0C\u6BCF\u4F4D\u5305\u542B\uFF1A
   - name\uFF08\u59D3\u540D/\u79F0\u547C\uFF09
   - role\uFF08\u8EAB\u4EFD\u5B9A\u4F4D\uFF0C\u5982\u4E3B\u89D2/\u53CD\u6D3E/\u5BFC\u5E08\uFF09
   - appearance\uFF08\u5916\u8C8C\uFF1A\u8138\u578B\u4E94\u5B98\u3001\u53D1\u578B\u3001\u8EAB\u6750\u3001\u5E74\u9F84\u6027\u522B\u3001\u7A7F\u7740\uFF09
   - desc\uFF08\u7EFC\u5408\u63CF\u8FF0 50-100 \u5B57\uFF0C\u7ED9\u4EBA\u7C7B\u770B\uFF0C\u6DB5\u76D6 \u5916\u8C8C/\u8EAB\u4EFD/\u6027\u683C/\u670D\u9970\uFF09
   - era\uFF08\u65F6\u4EE3\uFF1A\u53E4\u4EE3/\u73B0\u4EE3/\u6C11\u56FD/\u7384\u5E7B/\u672A\u6765\uFF09
   - prompt\uFF08\u7ED9 AI \u56FE\u50CF\u751F\u6210\u7528\u7684\u8BE6\u7EC6\u63D0\u793A\u8BCD 80-150 \u5B57\u4E2D\u6587\uFF0C\u5FC5\u987B\u5305\u542B\uFF1A\u65F6\u4EE3\u3001\u5E74\u9F84\u3001\u6027\u522B\u3001\u8138\u578B\u4E94\u5B98\u3001\u53D1\u578B\u3001\u4E0A\u8863\u3001\u4E0B\u88C5/\u88D9\u88C5\u3001\u978B\u5C65\u3001\u914D\u9970\u3001\u4F53\u6001\u3001\u8868\u60C5\u795E\u6001\u3001\u6574\u4F53\u8272\u8C03\uFF09
2. scenes \u6570\u7EC4\uFF1A\u81F3\u5C11\u63D0\u53D6 1-3 \u4E2A\u5173\u952E\u573A\u666F\uFF0C\u6BCF\u4E2A\u5305\u542B\uFF1A
   - name\uFF08\u573A\u666F\u540D\uFF09
   - environment\uFF08\u73AF\u5883\uFF1A\u5EFA\u7B51/\u81EA\u7136/\u5730\u70B9\uFF09
   - atmosphere\uFF08\u6C1B\u56F4\uFF09
   - era\uFF08\u65F6\u6BB5/\u65F6\u4EE3\uFF0C\u5982\u6E05\u6668/\u9EC4\u660F/\u96E8\u591C/\u73B0\u4EE3\uFF09
   - prompt\uFF08\u7ED9 AI \u56FE\u50CF\u751F\u6210\u7528\u7684\u8BE6\u7EC6\u573A\u666F\u63D0\u793A\u8BCD 80-150 \u5B57\u4E2D\u6587\uFF0C\u5FC5\u987B\u5305\u542B\uFF1A\u65F6\u4EE3/\u5730\u70B9\u3001\u65F6\u95F4/\u5929\u6C14\u3001\u5EFA\u7B51/\u81EA\u7136\u5143\u7D20\u3001\u4E3B\u8981\u9053\u5177\u3001\u5149\u7EBF\u3001\u8272\u8C03\u3001\u6C1B\u56F4\u3001\u753B\u9762\u98CE\u683C\uFF09
3. \u53EA\u8F93\u51FA JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981\u89E3\u91CA\uFF0C\u4E0D\u8981 markdown \u4EE3\u7801\u5757\u3002

\u539F\u6587\uFF08\u524D 12000 \u5B57\uFF09\uFF1A
${text.slice(0, 12e3)}`;
        const client = new import_glm_client.GlmClient();
        const res = await client.chat(prompt, { maxTokens: 4e3, temperature: 0.7 });
        let data = repairAndParse(res, "\u89D2\u8272\u573A\u666F JSON");
        if (Array.isArray(data) && data.length === 2 && Array.isArray(data[0]) && Array.isArray(data[1])) {
          data = { characters: data[0], scenes: data[1] };
        }
        const curChars = materials.characters || [];
        const curScenes = materials.scenes || [];
        const mergedChars = [...curChars];
        let addedChars = 0;
        (data.characters || []).forEach((c, i) => {
          const name = (c.name || "").trim();
          if (!name || mergedChars.some((x) => (x.name || "").trim() === name)) return;
          mergedChars.push({
            id: "char_" + Date.now() + "_" + i + "_" + addedChars,
            name,
            role: c.role || "",
            desc: c.desc || c.description || "",
            appearance: c.appearance || c.looks || "",
            era: c.era || "",
            prompt: c.prompt || "",
            fourViews: [],
            referenceSheet: "",
            model3d: { status: "none" },
            createdAt: Date.now()
          });
          addedChars++;
        });
        const mergedScenes = [...curScenes];
        let addedScenes = 0;
        (data.scenes || []).forEach((s2, i) => {
          const name = (s2.name || "").trim();
          if (!name || mergedScenes.some((x) => (x.name || "").trim() === name)) return;
          mergedScenes.push({
            id: "scn_" + Date.now() + "_" + i + "_" + addedScenes,
            name,
            desc: s2.desc || s2.description || "",
            environment: s2.environment || "",
            atmosphere: s2.atmosphere || s2.mood || "",
            era: s2.era || "",
            prompt: s2.prompt || "",
            imageUrl: "",
            model3d: { status: "none" },
            createdAt: Date.now()
          });
          addedScenes++;
        });
        setMaterials({ characters: mergedChars, scenes: mergedScenes });
        update({ history: pushHistory(project2.history, "AI \u5206\u6790\u89D2\u8272\u573A\u666F", `\u89D2\u8272 ${addedChars} / \u573A\u666F ${addedScenes}`) });
        if (log) log(`\u5206\u6790\u5B8C\u6210\uFF1A\u65B0\u589E ${addedChars} \u4F4D\u89D2\u8272\u3001${addedScenes} \u4E2A\u573A\u666F\uFF08\u5DF2\u53BB\u91CD\u5E76\u5165\u7D20\u6750\u5E93\uFF0C\u53EF\u5728\u300C\u89D2\u8272/\u573A\u666F\u300D\u4E2D\u751F\u6210\u53C2\u8003\u56FE\uFF09\u3002`);
      } catch (e) {
        console.error(e);
        if (log) log("\u5206\u6790\u5931\u8D25\uFF1A" + (e && e.message ? e.message : e));
      } finally {
        setAnalyzeBusy(false);
      }
    };
    const addCharacter = () => {
      const c = { id: "char_" + Date.now(), name: "\u65B0\u89D2\u8272 " + (characters.length + 1), desc: "", appearance: "", prompt: "", era: "", fourViews: [], referenceSheet: "", model3d: { status: "none" }, createdAt: Date.now() };
      setMaterials({ characters: [c, ...characters] });
    };
    const patchCharacter = (id, patch) => setMaterials({ characters: characters.map((c) => c.id === id ? { ...c, ...patch } : c) });
    const delCharacter = (id) => {
      if (!window.confirm("\u5220\u9664\u8BE5\u89D2\u8272\uFF1F")) return;
      setMaterials({ characters: characters.filter((c) => c.id !== id) });
    };
    const addScene = () => {
      const s2 = { id: "scn_" + Date.now(), name: "\u65B0\u573A\u666F " + (scenes.length + 1), desc: "", prompt: "", atmosphere: "", era: "", imageUrl: "", model3d: { status: "none" }, createdAt: Date.now() };
      setMaterials({ scenes: [s2, ...scenes] });
    };
    const patchScene = (id, patch) => setMaterials({ scenes: scenes.map((s2) => s2.id === id ? { ...s2, ...patch } : s2) });
    const delScene = (id) => {
      if (!window.confirm("\u5220\u9664\u8BE5\u573A\u666F\uFF1F")) return;
      setMaterials({ scenes: scenes.filter((s2) => s2.id !== id) });
    };
    const EASTERN_MODIFIER = "\u4E1C\u65B9\u4E2D\u56FD\u4EBA\u9762\u8C8C\uFF0C\u6C49\u65CF\u4E94\u5B98\u7279\u5F81\uFF0C\u81EA\u7136\u80A4\u8272\uFF0C\u9ED1\u8272\u6216\u6DF1\u68D5\u8272\u5934\u53D1\uFF0C\u4E9A\u6D32\u4EBA\u9762\u90E8\u7ED3\u6784\u3002";
    const faceModifier = (type) => {
      if (type === "anime") return "\u4E8C\u6B21\u5143\u52A8\u6F2B\u89D2\u8272\uFF0C\u4E1C\u65B9\u4E9A\u6D32\u52A8\u6F2B\u9762\u5B54\uFF0C\u5927\u773C\u775B\u3001\u9C9C\u660E\u8F6E\u5ED3\u7EBF\u3001\u8D5B\u7490\u7490\u4E0A\u8272\uFF0C\u5938\u5F20\u800C\u7CBE\u81F4\u7684\u53D1\u578B\uFF1B";
      if (type === "semireal") return "\u534A\u5199\u5B9E\u98CE\u683C\u5316\u89D2\u8272\uFF0C\u4E1C\u65B9\u4E9A\u6D32\u9762\u5B54\uFF0C\u67D4\u548C\u7B14\u89E6\u4E0E\u5199\u5B9E\u5149\u5F71\u7ED3\u5408\uFF1B";
      if (type === "comic") return "\u6F2B\u753B\u98CE\u683C\u89D2\u8272\uFF0C\u4E1C\u65B9\u4E9A\u6D32\u6F2B\u753B\u9762\u5B54\uFF0C\u6E05\u6670\u9ED1\u8272\u63CF\u8FB9\u7EBF\u6761\u3001\u5E73\u6D82\u4E0A\u8272\uFF1B";
      return EASTERN_MODIFIER;
    };
    const buildFourViewPrompt = (base, view, type) => {
      const core = (base || "").trim() || "\u4E00\u4F4D\u5E74\u8F7B\u7684\u4E2D\u56FD\u6F14\u5458\uFF0C\u73B0\u4EE3\u5F71\u89C6\u77ED\u5267\u9020\u578B\u3002";
      const viewSpec = {
        "\u6B63\u9762": "\u6B63\u9762\u7AD9\u7ACB\uFF0C\u5B8C\u6574\u5168\u8EAB\uFF0C\u9762\u90E8\u6B63\u5BF9\u955C\u5934\uFF0C\u53CC\u81C2\u81EA\u7136\u5782\u4E8E\u8EAB\u4F53\u4E24\u4FA7\uFF0C\u53CC\u817F\u5E76\u62E2\u7AD9\u7ACB",
        "\u4FA7\u9762": "90\u5EA6\u4FA7\u9762\u7AD9\u7ACB\uFF0C\u5B8C\u6574\u5168\u8EAB\uFF0C\u9762\u90E8\u671D\u5411\u753B\u9762\u5DE6\u4FA7\u6216\u53F3\u4FA7\u5747\u53EF\uFF0C\u53CC\u81C2\u81EA\u7136\u4E0B\u5782\uFF0C\u53CC\u817F\u5E76\u62E2\u7AD9\u7ACB",
        "\u80CC\u9762": "\u4E25\u683C\u4ECE\u4EBA\u7269\u6B63\u540E\u65B9\u62CD\u6444\u7684\u80CC\u9762\u89C6\u89D2\uFF1A\u540E\u8111\u52FA\u4E0E\u6574\u4E2A\u80CC\u90E8\u6B63\u5BF9\u955C\u5934\uFF0C\u9762\u90E8\u7EDD\u4E0D\u53EF\u89C1\uFF0C\u53CC\u81C2\u81EA\u7136\u4E0B\u5782\uFF0C\u53CC\u817F\u5E76\u62E2\u7AD9\u7ACB\uFF0C\u5B8C\u6574\u5C55\u73B0\u80CC\u90E8\u670D\u88C5\u3001\u53D1\u578B\u4E0E\u8863\u6446\u7EC6\u8282\u3002\u8FD9\u662F\u80CC\u9762\u5B9A\u5986\u7167\uFF0C\u7EDD\u4E0D\u662F\u6B63\u9762\u4E5F\u4E0D\u662F\u4FA7\u9762\uFF0C\u753B\u9762\u4E2D\u4E0D\u5F97\u51FA\u73B0\u8BE5\u89D2\u8272\u7684\u9762\u90E8\u3002",
        "\u7279\u5199": "\u9762\u90E8\u7279\u5199/\u4E0A\u534A\u8EAB\u8FD1\u666F\uFF0C\u6B63\u5BF9\u955C\u5934\uFF0C\u80A9\u8180\u4EE5\u4E0A\uFF0C\u6E05\u6670\u5C55\u73B0\u4E94\u5B98\u3001\u8868\u60C5\u3001\u773C\u795E\u3001\u53D1\u578B\u3001\u670D\u88C5\u9886\u53E3\u4E0E\u914D\u9970\u7EC6\u8282"
      }[view] || view;
      return `\u3010\u5F3A\u5236\u8981\u6C42\u3011\u53EA\u751F\u6210\u300C\u4EBA\u7269\u53C2\u8003\u56FE\u300D\uFF0C\u7EDD\u5BF9\u7981\u6B62\u51FA\u73B0\u4EFB\u4F55\u80CC\u666F\u3001\u573A\u666F\u3001\u73AF\u5883\u3001\u9053\u5177\u3001\u5730\u9762\u3001\u5BB6\u5177\u3001\u88C5\u9970\u7269\u3001\u5149\u5F71\u6C1B\u56F4\u6216\u6587\u5B57\uFF1B\u753B\u9762\u91CC\u4EC5\u5448\u73B0\u8BE5\u89D2\u8272\u4EBA\u7269\u672C\u8EAB\uFF0C\u4F7F\u7528\u7EAF\u8272\u6216\u900F\u660E\u80CC\u666F\uFF0C\u65E0\u9634\u5F71\u6C61\u67D3\u3002
\u6839\u636E\u4EE5\u4E0B\u89D2\u8272\u63CF\u8FF0\uFF0C\u5224\u65AD\u5176\u65F6\u4EE3\u80CC\u666F\uFF08\u53E4\u4EE3/\u73B0\u4EE3/\u6C11\u56FD/\u7384\u5E7B\u7B49\uFF09\u5E76\u636E\u6B64\u751F\u6210\u5BF9\u5E94\u670D\u9970\u3001\u53D1\u578B\u4E0E\u9053\u5177\u3002
\u89D2\u8272\u63CF\u8FF0\uFF1A${core}
${faceModifier(type)}
\u8981\u6C42\uFF1A${viewSpec}\u3002\u5355\u5F20\u72EC\u7ACB\u56FE\u7247\uFF0C\u753B\u9762\u91CC\u53EA\u51FA\u73B0\u4E00\u4E2A\u4EBA\u7269\uFF0C\u4E0D\u88C1\u5207\uFF0C\u81EA\u7136\u653E\u677E\uFF0C\u5747\u5300\u67D4\u548C\u6B63\u9762\u5149\u6E90\uFF0C\u9AD8\u6E05\u5199\u5B9E\uFF0C\u5F71\u89C6\u77ED\u5267/\u89D2\u8272\u5B9A\u5986\u7167\u98CE\u683C\uFF0C\u9762\u90E8\u7279\u5F81\u3001\u53D1\u578B\u3001\u670D\u88C5\u3001\u8EAB\u6750\u6BD4\u4F8B\u4E0E\u540C\u4E00\u89D2\u8272\u5176\u4ED6\u89C6\u89D2\u5B8C\u5168\u4E00\u81F4\uFF0C\u65E0\u6587\u5B57\u3001\u65E0\u6C34\u5370\u3001\u65E0\u8FB9\u6846\u3001\u65E0\u62FC\u8D34\u3001\u65E0\u56DB\u683C\u6392\u7248\u3001\u65E0\u7F51\u683C\u5E03\u5C40\u3001\u65E0\u4EFB\u4F55\u80CC\u666F\u5143\u7D20\u3002${dramaModifier(type)}`;
    };
    const genFourView = async (c) => {
      const base = c.prompt || c.desc || c.appearance || window.prompt("\u8BF7\u63CF\u8FF0\u8BE5\u89D2\u8272\u5916\u8C8C\u3001\u670D\u88C5\u3001\u6C14\u8D28\uFF08\u8D8A\u8BE6\u7EC6\u8D8A\u4E00\u81F4\uFF09\uFF1A", "\u5E74\u8F7B\u4E2D\u56FD\u5973\u6027\uFF0C\u957F\u53D1\u53CA\u80A9\uFF0C\u7A7F\u7C73\u8272\u98CE\u8863\uFF0C\u90FD\u5E02\u804C\u573A\u6C14\u8D28");
      if (!base) return;
      patchCharacter(c.id, { prompt: base, desc: c.desc || base, fourViews: [], model3d: { ...c.model3d || {}, status: "generating_fourview" } });
      try {
        const views = ["\u6B63\u9762", "\u4FA7\u9762", "\u80CC\u9762", "\u7279\u5199"];
        const urls = [];
        let frontUrl = null;
        for (let i = 0; i < views.length; i++) {
          const view = views[i];
          const prompt = buildFourViewPrompt(base, view, project2.dramaType);
          const res = await generateImage({ prompt, model: "Qwen/Qwen-Image", size: "1328x1328", n: 1 });
          if (!res.image_url) throw new Error(view + " \u89C6\u56FE\u751F\u6210\u672A\u8FD4\u56DE\u56FE\u7247 URL");
          urls.push({ view, url: res.image_url, at: Date.now() });
          if (i === 0) frontUrl = res.image_url;
          patchCharacter(c.id, { fourViews: urls });
        }
        patchCharacter(c.id, { fourViews: urls, model3d: { ...c.model3d || {}, status: "none" } });
        window.alert(`\u89D2\u8272\u300C${c.name}\u300D\u53C2\u8003\u56FE\u5DF2\u751F\u6210\u5B8C\u6BD5\uFF08\u5171 ${urls.length} \u5F20\u89C6\u89D2\uFF0C\u7EAF\u4EBA\u7269\u65E0\u80CC\u666F\uFF09\u3002`);
      } catch (e) {
        console.error(e);
        patchCharacter(c.id, { model3d: { ...c.model3d || {}, status: "fourview_error", error: e.message } });
        window.alert("\u53C2\u8003\u56FE\u751F\u6210\u5931\u8D25\uFF1A" + e.message);
      }
    };
    const genChar3D = async (c) => {
      const desc = c.prompt || c.desc || c.appearance || window.prompt("\u8BF7\u8F93\u5165\u89D2\u8272\u63CF\u8FF0\uFF0C\u7528\u4E8E\u751F\u6210 3D \u4EBA\u5076\uFF1A", "\u5E74\u8F7B\u4E2D\u56FD\u5973\u6027\uFF0C\u957F\u53D1\uFF0C\u7A7F\u7C73\u8272\u98CE\u8863\uFF0C\u90FD\u5E02\u804C\u573A\u6C14\u8D28");
      if (!desc) return;
      patchCharacter(c.id, { prompt: desc, desc: c.desc || desc, model3d: { ...c.model3d || {}, status: "generating_3d" } });
      try {
        const ab = await createCharacterGLB(desc);
        const blobUrl = URL.createObjectURL(new Blob([ab], { type: "model/gltf-binary" }));
        const b64 = arrayBufferToBase64(ab);
        patchCharacter(c.id, { model3d: { status: "exported", url: blobUrl, b64, exportedAt: Date.now() } });
        exportSharedAssets();
        window.alert(`\u89D2\u8272\u300C${c.name}\u300D3D \u6A21\u578B\u5DF2\u751F\u6210\u5E76\u5BFC\u51FA\uFF0C\u53EF\u5728\u300C3D \u5BFC\u6F14\u53F0\u300D\u67E5\u770B\u3002\u5F53\u524D\u4E3A\u7A0B\u5E8F\u5316\u89E3\u7801\u4EBA\u5076\uFF0C\u540E\u7EED\u4F1A\u63A5\u5165\u4E91\u7AEF\u9AD8\u7CBE\u5EA6\u6A21\u578B\u3002`);
      } catch (e) {
        console.error(e);
        patchCharacter(c.id, { model3d: { ...c.model3d || {}, status: "error_3d", error: e.message } });
        window.alert("3D \u6A21\u578B\u751F\u6210\u5931\u8D25\uFF1A" + e.message);
      }
    };
    const importChar3D = async (c, file) => {
      try {
        const dataUrl = await fileToDataUrl(file);
        const base64 = dataUrl.split(",")[1] || "";
        const bin = atob(base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blobUrl = URL.createObjectURL(new Blob([bytes], { type: "model/gltf-binary" }));
        patchCharacter(c.id, { model3d: { status: "exported", url: blobUrl, b64: base64, exportedAt: Date.now() } });
        exportSharedAssets();
      } catch (e) {
        window.alert("\u5BFC\u5165\u5931\u8D25\uFF1A" + e.message);
      }
    };
    const FOUR_VIEW_ORDER = ["\u6B63\u9762", "\u4FA7\u9762", "\u80CC\u9762", "\u7279\u5199"];
    const uploadFourView = async (c, view, file) => {
      try {
        const dataUrl = await fileToDataUrl(file);
        const existing = Array.isArray(c.fourViews) ? c.fourViews.filter((v) => v.view !== view) : [];
        const next = [...existing, { view, url: dataUrl, at: Date.now() }];
        next.sort((a, b) => FOUR_VIEW_ORDER.indexOf(a.view) - FOUR_VIEW_ORDER.indexOf(b.view));
        patchCharacter(c.id, { fourViews: next, model3d: { ...c.model3d || {}, status: "none" } });
      } catch (e) {
        window.alert(`\u4E0A\u4F20${view}\u5931\u8D25\uFF1A` + e.message);
      }
    };
    const uploadReferenceSheet = async (c, file) => {
      try {
        const dataUrl = await fileToDataUrl(file);
        patchCharacter(c.id, { referenceSheet: dataUrl, model3d: { ...c.model3d || {}, status: "none" } });
        window.alert(`\u89D2\u8272\u300C${c.name}\u300D\u7684\u6574\u5F20\u53C2\u8003\u56FE\u5DF2\u5BFC\u5165\u3002`);
      } catch (e) {
        window.alert("\u4E0A\u4F20\u6574\u5F20\u53C2\u8003\u56FE\u5931\u8D25\uFF1A" + e.message);
      }
    };
    const genSceneImage = async (s2) => {
      const desc = s2.prompt || s2.desc || window.prompt("\u8BF7\u8F93\u5165\u573A\u666F\u63CF\u8FF0\uFF1A", "\u73B0\u4EE3\u90FD\u5E02\u5BA2\u5385\uFF0C\u6D45\u7070\u6C99\u53D1\uFF0C\u843D\u5730\u7A97\uFF0C\u5348\u540E\u9633\u5149");
      if (!desc) return;
      patchScene(s2.id, { prompt: desc, desc: s2.desc || desc, model3d: { ...s2.model3d || {}, status: "generating_image" } });
      try {
        const styleObj = STYLE_OPTIONS3.find((s3) => s3.value === selectedStyle) || STYLE_OPTIONS3[0];
        const styleDesc = styleObj.desc;
        const aspectObj = ASPECT_RATIO_OPTIONS2.find((a) => a.value === selectedAspectRatio) || ASPECT_RATIO_OPTIONS2[0];
        const imageSize = aspectObj.size;
        const prompt = `\u7EAF\u573A\u666F\u7A7A\u955C/\u73AF\u5883\u6982\u5FF5\u56FE\uFF0C\u7EDD\u5BF9\u7981\u6B62\u51FA\u73B0\u4EFB\u4F55\u4EBA\u7269\u3001\u4EBA\u5F62\u3001\u526A\u5F71\u3001\u89D2\u8272\u6216\u62DF\u4EBA\u5F62\u8C61\uFF0C\u753B\u9762\u91CC\u53EA\u5448\u73B0\u73AF\u5883\u3001\u5EFA\u7B51\u3001\u81EA\u7136\u3001\u9053\u5177\u4E0E\u6C1B\u56F4\u3002
\u6839\u636E\u4EE5\u4E0B\u573A\u666F\u63CF\u8FF0\uFF0C\u5224\u65AD\u65F6\u4EE3\u80CC\u666F\uFF08\u53E4\u4EE3/\u73B0\u4EE3/\u6C11\u56FD/\u7384\u5E7B\u7B49\uFF09\u5E76\u751F\u6210\u5BF9\u5E94\u73AF\u5883\u3002
\u573A\u666F\u63CF\u8FF0\uFF1A${desc}
\u8981\u6C42\uFF1A${styleDesc}\uFF0C\u5F71\u89C6\u77ED\u5267\u7A7A\u955C/\u573A\u666F\u6982\u5FF5\u56FE\u98CE\u683C\uFF0C\u9AD8\u6E05\u5199\u5B9E\uFF0C\u6784\u56FE\u5B8C\u6574\uFF0C\u6C1B\u56F4\u9C9C\u660E\uFF0C\u5149\u5F71\u7EC6\u817B\uFF0C\u8272\u5F69\u534F\u8C03\uFF0C\u7A7A\u65E0\u4E00\u4EBA\u7684\u7EAF\u7CB9\u573A\u666F\uFF0C\u65E0\u4EBA\u7269\u4E3B\u4F53\u3001\u65E0\u4EBA\u5F62\u3001\u65E0\u526A\u5F71\u3001\u65E0\u89D2\u8272\u3001\u65E0\u4EFB\u4F55\u4E0E\u4EBA\u7C7B\u76F8\u5173\u7684\u5143\u7D20\uFF0C\u65E0\u6587\u5B57\u3001\u65E0\u6C34\u5370\u3001\u65E0\u8FB9\u6846\u3002${dramaModifier(project2.dramaType)}`;
        const res = await generateImage({ prompt, model: "Qwen/Qwen-Image", size: imageSize, n: 1 });
        patchScene(s2.id, { imageUrl: res.image_url, model3d: { ...s2.model3d || {}, status: "none" } });
      } catch (e) {
        patchScene(s2.id, { model3d: { ...s2.model3d || {}, status: "error_image", error: e.message } });
        window.alert("\u573A\u666F\u56FE\u751F\u6210\u5931\u8D25\uFF1A" + e.message);
      }
    };
    const genScene3D = async (s2) => {
      const desc = s2.prompt || s2.desc || window.prompt("\u8BF7\u8F93\u5165\u573A\u666F\u63CF\u8FF0\uFF0C\u7528\u4E8E\u751F\u6210 3D \u573A\u666F\uFF1A", "\u73B0\u4EE3\u90FD\u5E02\u5BA2\u5385\uFF0C\u6D45\u7070\u5899\u9762\uFF0C\u6728\u5730\u677F");
      if (!desc) return;
      patchScene(s2.id, { prompt: desc, desc: s2.desc || desc, model3d: { ...s2.model3d || {}, status: "generating_3d" } });
      try {
        const ab = await createSceneGLB(desc);
        const blobUrl = URL.createObjectURL(new Blob([ab], { type: "model/gltf-binary" }));
        const b64 = arrayBufferToBase64(ab);
        patchScene(s2.id, { model3d: { status: "exported", url: blobUrl, b64, exportedAt: Date.now() } });
        exportSharedAssets();
        window.alert(`\u573A\u666F\u300C${s2.name}\u300D3D \u573A\u666F\u5DF2\u751F\u6210\u5E76\u5BFC\u51FA\uFF0C\u53EF\u5728\u300C3D \u5BFC\u6F14\u53F0\u300D\u67E5\u770B\u3002`);
      } catch (e) {
        patchScene(s2.id, { model3d: { ...s2.model3d || {}, status: "error_3d", error: e.message } });
        window.alert("3D \u573A\u666F\u751F\u6210\u5931\u8D25\uFF1A" + e.message);
      }
    };
    const importScene3D = async (s2, file) => {
      try {
        const dataUrl = await fileToDataUrl(file);
        const base64 = dataUrl.split(",")[1] || "";
        const bin = atob(base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blobUrl = URL.createObjectURL(new Blob([bytes], { type: "model/gltf-binary" }));
        patchScene(s2.id, { model3d: { status: "exported", url: blobUrl, b64: base64, exportedAt: Date.now() } });
        exportSharedAssets();
      } catch (e) {
        window.alert("\u5BFC\u5165\u5931\u8D25\uFF1A" + e.message);
      }
    };
    const exportSharedAssets = () => {
      const data = {
        kind: "jinsu-shared-assets",
        version: 1,
        exportedAt: Date.now(),
        characters: characters.map((c) => ({ id: c.id, name: c.name, type: "character", enabled: c.model3d?.status === "exported", url: c.model3d?.url || "", modelB64: c.model3d?.b64 || "" })),
        scenes: scenes.map((s2) => ({ id: s2.id, name: s2.name, type: "scene", enabled: s2.model3d?.status === "exported", url: s2.model3d?.url || "", modelB64: s2.model3d?.b64 || "" }))
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "jinsu-shared-assets.json";
      a.click();
      URL.revokeObjectURL(url);
      (0, import_core2.invoke)("save_shared_assets", { contents: JSON.stringify(data) }).catch(() => {
      });
    };
    const onGroupChange = (id, v) => {
      if (v === "__new") {
        const g = window.prompt("\u8F93\u5165\u65B0\u5206\u7EC4\u540D\u79F0\uFF1A");
        if (g && g.trim()) setGroup(id, g.trim());
        return;
      }
      setGroup(id, v);
    };
    const allTags = Array.from(new Set(assets.flatMap((a) => a.tags || []))).filter(Boolean);
    const allGroups = Array.from(new Set(assets.map((a) => a.group).filter(Boolean)));
    const list = assets.filter((a) => {
      if (filter !== "all" && a.type !== filter) return false;
      if (tagFilter && !(a.tags || []).includes(tagFilter)) return false;
      if (q && !((a.title || "").toLowerCase().includes(q.toLowerCase()) || (a.tags || []).some((t2) => t2.toLowerCase().includes(q.toLowerCase())))) return false;
      return true;
    });
    const selIds = Object.keys(sel).filter((k) => sel[k]);
    const toggleSel = (id) => setSel((s2) => ({ ...s2, [id]: !s2[id] }));
    const clearSel = () => setSel({});
    const patchAsset = (id, patch) => setAssets(assets.map((a) => a.id === id ? { ...a, ...patch } : a));
    const toggleFav = (id) => {
      const a = assets.find((x) => x.id === id);
      patchAsset(id, { favorite: !a.favorite });
    };
    const addTag = (id, tag) => {
      const a = assets.find((x) => x.id === id);
      if (!a || !tag) return;
      patchAsset(id, { tags: Array.from(/* @__PURE__ */ new Set([...a.tags || [], tag])) });
    };
    const removeTag = (id, tag) => {
      const a = assets.find((x) => x.id === id);
      if (!a) return;
      patchAsset(id, { tags: (a.tags || []).filter((t2) => t2 !== tag) });
    };
    const setGroup = (id, g) => patchAsset(id, { group: g || void 0 });
    const batchDelete = () => {
      const move = assets.filter((a) => selIds.includes(a.id));
      const rest = assets.filter((a) => !selIds.includes(a.id));
      setTrash([...trash, ...move.map((a) => ({ ...a, _trashAt: Date.now() }))]);
      setAssets(rest);
      clearSel();
    };
    const batchFav = () => {
      setAssets(assets.map((a) => selIds.includes(a.id) ? { ...a, favorite: true } : a));
      clearSel();
    };
    const restoreAsset = (id) => {
      const a = trash.find((x) => x.id === id);
      if (!a) return;
      const { _trashAt, ...rest } = a;
      setAssets([...assets, rest]);
      setTrash(trash.filter((x) => x.id !== id));
    };
    const purgeAsset = (id) => setTrash(trash.filter((x) => x.id !== id));
    const emptyTrash = () => setTrash([]);
    const doAdd = async () => {
      if (!newTitle.trim() && !newFile) return;
      let url = newUrl;
      if (newFile) {
        try {
          url = await fileToDataUrl(newFile);
        } catch {
          url = "";
        }
      }
      const a = { id: "a_" + Date.now(), type: newType, title: newTitle.trim() || (newFile ? newFile.name : "\u7D20\u6750"), url: url || "", status: url ? "ready" : "pending", tags: [], favorite: false };
      setAssets([a, ...assets]);
      setAdding(false);
      setNewTitle("");
      setNewUrl("");
      setNewFile(null);
    };
    const onDragStart = (e, a) => {
      e.dataTransfer.setData("application/x-asset-id", a.id);
      e.dataTransfer.effectAllowed = "copy";
    };
    if (showTrash) {
      return /* @__PURE__ */ import_react12.default.createElement("div", { style: wrap }, /* @__PURE__ */ import_react12.default.createElement("div", { style: headRow }, /* @__PURE__ */ import_react12.default.createElement("h3", { style: h3 }, "\u{1F5D1} \u7D20\u6750\u56DE\u6536\u7AD9\uFF08", trash.length, "\uFF09"), /* @__PURE__ */ import_react12.default.createElement("div", { style: { display: "flex", gap: 8 } }, /* @__PURE__ */ import_react12.default.createElement("button", { style: btnDanger, disabled: !trash.length, onClick: emptyTrash }, "\u6E05\u7A7A"), /* @__PURE__ */ import_react12.default.createElement("button", { style: btn, onClick: () => setShowTrash(false) }, "\u8FD4\u56DE\u7D20\u6750\u5E93"))), trash.length === 0 ? /* @__PURE__ */ import_react12.default.createElement("div", { style: ph }, "\u56DE\u6536\u7AD9\u4E3A\u7A7A\u3002") : /* @__PURE__ */ import_react12.default.createElement("div", { style: grid }, trash.map((a) => /* @__PURE__ */ import_react12.default.createElement("div", { key: a.id, style: card }, a.type === "video" ? /* @__PURE__ */ import_react12.default.createElement("video", { src: a.url, style: thumb, controls: true }) : a.url ? /* @__PURE__ */ import_react12.default.createElement("img", { src: a.url, style: thumb, alt: a.title }) : /* @__PURE__ */ import_react12.default.createElement("div", { style: { ...thumb, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 } }, (TYPES.find((t2) => t2[0] === a.type) || [, "\u{1F4E6}"])[1]), /* @__PURE__ */ import_react12.default.createElement("div", { style: title }, a.title), /* @__PURE__ */ import_react12.default.createElement("div", { style: btnRow }, /* @__PURE__ */ import_react12.default.createElement("button", { style: miniBtnOn, onClick: () => restoreAsset(a.id) }, "\u6062\u590D"), /* @__PURE__ */ import_react12.default.createElement("button", { style: miniBtnD, onClick: () => purgeAsset(a.id) }, "\u5220\u9664"))))));
    }
    return /* @__PURE__ */ import_react12.default.createElement("div", { style: wrap }, /* @__PURE__ */ import_react12.default.createElement("div", { style: headRow }, /* @__PURE__ */ import_react12.default.createElement("h3", { style: h3 }, "\u{1F5C2} \u7D20\u6750\u5E93"), /* @__PURE__ */ import_react12.default.createElement("div", { style: { display: "flex", gap: 8 } }, /* @__PURE__ */ import_react12.default.createElement("button", { style: btnPrimary, disabled: analyzeBusy, onClick: analyzeMaterials }, analyzeBusy ? "\u5206\u6790\u4E2D\u2026" : "\u{1F916} AI \u5206\u6790\u89D2\u8272\u4E0E\u573A\u666F"), /* @__PURE__ */ import_react12.default.createElement("button", { style: btn, onClick: () => setShowTrash(true) }, "\u{1F5D1} \u56DE\u6536\u7AD9\uFF08", trash.length, "\uFF09"), section === "all" && /* @__PURE__ */ import_react12.default.createElement("button", { style: btnPrimary, onClick: () => setAdding(true) }, "\uFF0B \u6DFB\u52A0\u7D20\u6750"), section === "characters" && /* @__PURE__ */ import_react12.default.createElement("button", { style: btnPrimary, onClick: addCharacter }, "\uFF0B \u6DFB\u52A0\u89D2\u8272"), section === "scenes" && /* @__PURE__ */ import_react12.default.createElement("button", { style: btnPrimary, onClick: addScene }, "\uFF0B \u6DFB\u52A0\u573A\u666F"))), /* @__PURE__ */ import_react12.default.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", alignItems: "center", borderBottom: "1px solid var(--border, rgba(255,255,255,0.08))", paddingBottom: 10 } }, SECTIONS.map((s2) => /* @__PURE__ */ import_react12.default.createElement("button", { key: s2.k, style: { ...sectionBtn, ...section === s2.k ? sectionBtnOn : {} }, onClick: () => {
      setSection(s2.k);
      setFilter("all");
    } }, s2.label))), section === "all" && /* @__PURE__ */ import_react12.default.createElement(import_react12.default.Fragment, null, /* @__PURE__ */ import_react12.default.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", alignItems: "center" } }, TYPES.map(([k, t2]) => /* @__PURE__ */ import_react12.default.createElement("button", { key: k, style: { ...chip, ...filter === k ? chipOn : {} }, onClick: () => setFilter(k) }, t2)), /* @__PURE__ */ import_react12.default.createElement("input", { style: search, placeholder: "\u641C\u7D22\u6807\u9898 / \u6807\u7B7E\u2026", value: q, onChange: (e) => setQ(e.target.value) }), allTags.length > 0 && /* @__PURE__ */ import_react12.default.createElement("select", { style: miniSelect, value: tagFilter, onChange: (e) => setTagFilter(e.target.value) }, /* @__PURE__ */ import_react12.default.createElement("option", { value: "" }, "\u6807\u7B7E: \u5168\u90E8"), allTags.map((t2) => /* @__PURE__ */ import_react12.default.createElement("option", { key: t2, value: t2 }, t2)))), selIds.length > 0 && /* @__PURE__ */ import_react12.default.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 8, alignItems: "center", padding: "6px 10px", background: "var(--panel-2, #1c2433)", borderRadius: 8 } }, /* @__PURE__ */ import_react12.default.createElement("span", { style: { fontSize: 12, color: "var(--text-secondary, #8b95a7)" } }, "\u5DF2\u9009 ", selIds.length), /* @__PURE__ */ import_react12.default.createElement("button", { style: miniBtnOn, onClick: batchFav }, "\u6279\u91CF\u6536\u85CF"), /* @__PURE__ */ import_react12.default.createElement("button", { style: miniBtnD, onClick: batchDelete }, "\u6279\u91CF\u79FB\u5165\u56DE\u6536\u7AD9"), /* @__PURE__ */ import_react12.default.createElement("button", { style: miniBtn, onClick: clearSel }, "\u53D6\u6D88\u9009\u62E9")), /* @__PURE__ */ import_react12.default.createElement("div", { style: { fontSize: 11, color: "var(--text-muted, #5d6779)", marginBottom: 8 } }, "\u62D6\u62FD\u5361\u7247\u5230\u300C\u65E0\u9650\u753B\u5E03\u300D\u53EF\u653E\u7F6E\u7D20\u6750\u8282\u70B9\uFF1B\u6216\u7528\u4E0B\u65B9\u6309\u94AE\u4E00\u952E\u9001\u5165\u914D\u97F3 / \u526A\u8F91\u3002"), adding && /* @__PURE__ */ import_react12.default.createElement("div", { style: addBox }, /* @__PURE__ */ import_react12.default.createElement("div", { style: { fontSize: 13, fontWeight: 600, marginBottom: 8 } }, "\u6DFB\u52A0\u7D20\u6750"), /* @__PURE__ */ import_react12.default.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 } }, /* @__PURE__ */ import_react12.default.createElement("input", { style: inp, placeholder: "\u6807\u9898", value: newTitle, onChange: (e) => setNewTitle(e.target.value) }), /* @__PURE__ */ import_react12.default.createElement("select", { style: inp, value: newType, onChange: (e) => setNewType(e.target.value) }, TYPES.filter((t2) => t2[0] !== "all").map(([k, t2]) => /* @__PURE__ */ import_react12.default.createElement("option", { key: k, value: k }, t2))), /* @__PURE__ */ import_react12.default.createElement("button", { style: btn, onClick: () => fileRef.current?.click() }, "\u{1F4C1} \u9009\u62E9\u6587\u4EF6"), newFile && /* @__PURE__ */ import_react12.default.createElement("span", { style: { fontSize: 12, color: "var(--success, #22c55e)" } }, newFile.name)), /* @__PURE__ */ import_react12.default.createElement("input", { style: inp, placeholder: "\u6216\u7C98\u8D34\u8D44\u6E90 URL\uFF08\u56FE\u7247/\u89C6\u9891\uFF09", value: newUrl, onChange: (e) => setNewUrl(e.target.value) }), /* @__PURE__ */ import_react12.default.createElement("input", { ref: fileRef, type: "file", style: { display: "none" }, onChange: (e) => setNewFile(e.target.files && e.target.files[0]) }), /* @__PURE__ */ import_react12.default.createElement("div", { style: { display: "flex", gap: 8, marginTop: 8 } }, /* @__PURE__ */ import_react12.default.createElement("button", { style: btnPrimary, onClick: doAdd }, "\u6DFB\u52A0"), /* @__PURE__ */ import_react12.default.createElement("button", { style: btn, onClick: () => setAdding(false) }, "\u53D6\u6D88"))), list.length === 0 && /* @__PURE__ */ import_react12.default.createElement("div", { style: ph }, "\u6CA1\u6709\u5339\u914D\u7684\u7D20\u6750\u3002\u70B9\u300C\u6DFB\u52A0\u7D20\u6750\u300D\u4E0A\u4F20\uFF0C\u6216\u4ECE\u521B\u4F5C\u6D41\u7A0B\u751F\u6210\u3002"), /* @__PURE__ */ import_react12.default.createElement("div", { style: grid }, list.map((a) => /* @__PURE__ */ import_react12.default.createElement("div", { key: a.id, draggable: true, onDragStart: (e) => onDragStart(e, a), style: { ...card, ...sel[a.id] ? cardSel : {} } }, /* @__PURE__ */ import_react12.default.createElement("div", { style: { position: "relative" } }, a.type === "video" ? /* @__PURE__ */ import_react12.default.createElement("video", { src: a.url, style: thumb, controls: true }) : a.url ? /* @__PURE__ */ import_react12.default.createElement("img", { src: a.url, style: thumb, alt: a.title }) : /* @__PURE__ */ import_react12.default.createElement("div", { style: { ...thumb, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 } }, (TYPES.find((t2) => t2[0] === a.type) || [, "\u{1F4E6}"])[1]), /* @__PURE__ */ import_react12.default.createElement("input", { type: "checkbox", checked: !!sel[a.id], onChange: () => toggleSel(a.id), style: { position: "absolute", top: 6, left: 6 } }), /* @__PURE__ */ import_react12.default.createElement("button", { style: { ...favBtn, ...a.favorite ? favOn : {} }, title: "\u6536\u85CF", onClick: () => toggleFav(a.id) }, a.favorite ? "\u2605" : "\u2606")), /* @__PURE__ */ import_react12.default.createElement("div", { style: title }, a.title), /* @__PURE__ */ import_react12.default.createElement("div", { style: { fontSize: 10, color: "var(--text-muted, #5d6779)", padding: "0 8px" } }, a.type, a.group ? " \xB7 " + a.group : ""), /* @__PURE__ */ import_react12.default.createElement("div", { style: tagRow }, (a.tags || []).map((t2) => /* @__PURE__ */ import_react12.default.createElement("span", { key: t2, style: tagPill }, t2, /* @__PURE__ */ import_react12.default.createElement("button", { style: tagX, onClick: () => removeTag(a.id, t2) }, "\xD7"))), /* @__PURE__ */ import_react12.default.createElement("input", { style: tagInput, placeholder: "+\u6807\u7B7E", onKeyDown: (e) => {
      if (e.key === "Enter" && e.target.value.trim()) {
        addTag(a.id, e.target.value.trim());
        e.target.value = "";
      }
    } })), /* @__PURE__ */ import_react12.default.createElement("div", { style: { padding: "0 8px 6px" } }, /* @__PURE__ */ import_react12.default.createElement("select", { style: miniSelect, value: a.group || "", onChange: (e) => onGroupChange(a.id, e.target.value) }, /* @__PURE__ */ import_react12.default.createElement("option", { value: "" }, "\u5206\u7EC4: \u65E0"), allGroups.map((g) => /* @__PURE__ */ import_react12.default.createElement("option", { key: g, value: g }, g)), /* @__PURE__ */ import_react12.default.createElement("option", { value: "__new" }, "+ \u65B0\u5206\u7EC4\u2026"))), /* @__PURE__ */ import_react12.default.createElement("div", { style: btnRow }, a.url && /* @__PURE__ */ import_react12.default.createElement("button", { style: miniBtn, onClick: () => downloadUrl(a.url, (a.title || "asset") + (a.type === "video" ? ".mp4" : a.type === "image" ? ".png" : "")) }, "\u2B07 \u4E0B\u8F7D"), /* @__PURE__ */ import_react12.default.createElement("button", { style: miniBtn, disabled: !onUseDub, onClick: () => onUseDub && onUseDub(a) }, "\u{1F399} \u914D\u97F3"), /* @__PURE__ */ import_react12.default.createElement("button", { style: miniBtn, disabled: !onUseEdit || a.type !== "video", onClick: () => onUseEdit && onUseEdit(a) }, "\u{1F3AC} \u526A\u8F91"), /* @__PURE__ */ import_react12.default.createElement("button", { style: miniBtnD, onClick: () => {
      setTrash([...trash, { ...a, _trashAt: Date.now() }]);
      setAssets(assets.filter((x) => x.id !== a.id));
    } }, "\u{1F5D1}")))))), section === "characters" && /* @__PURE__ */ import_react12.default.createElement(import_react12.default.Fragment, null, /* @__PURE__ */ import_react12.default.createElement("div", { style: { fontSize: 11, color: "var(--text-muted, #5d6779)", marginBottom: 8 } }, "\u89D2\u8272\u5E93\uFF1A\u586B\u5199\u89D2\u8272\u63CF\u8FF0\u540E\uFF0C\u53EF\u751F\u6210\u300C\u89D2\u8272\u53C2\u8003\u56FE\u300D\uFF08Agnes \u751F\u56FE\uFF0C\u7EAF\u4EBA\u7269\u65E0\u80CC\u666F\uFF0C\u4E0D\u8017 GPU\uFF09\uFF0C\u6216\u4E0A\u4F20\u81EA\u5907\u7684\u56DB\u89C6\u56FE\u5408\u56FE\uFF1B\u4E5F\u53EF\u751F\u6210\u7A0B\u5E8F\u5316 3D \u4EBA\u5076 GLB \u5BFC\u5165 3D \u5BFC\u6F14\u53F0\u3002\u751F\u6210\u7684\u89D2\u8272\u53C2\u8003\u56FE\u4F1A\u5728\u89C6\u9891\u751F\u6210\u65F6\u81EA\u52A8\u7528\u4E8E\u4FDD\u6301\u89D2\u8272\u4E00\u81F4\u6027\u3002"), characters.length === 0 && /* @__PURE__ */ import_react12.default.createElement("div", { style: ph }, "\u6682\u65E0\u89D2\u8272\u3002\u70B9\u51FB\u53F3\u4E0A\u89D2\u300C\u6DFB\u52A0\u89D2\u8272\u300D\u3002"), /* @__PURE__ */ import_react12.default.createElement("div", { style: grid }, characters.map((c) => /* @__PURE__ */ import_react12.default.createElement("div", { key: c.id, style: card }, /* @__PURE__ */ import_react12.default.createElement("div", { style: { ...thumb, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 } }, "\u{1F3AD}"), /* @__PURE__ */ import_react12.default.createElement("input", { style: title, value: c.name, onChange: (e) => patchCharacter(c.id, { name: e.target.value }) }), /* @__PURE__ */ import_react12.default.createElement("textarea", { style: { ...title, minHeight: 54, fontSize: 12, resize: "none", lineHeight: 1.5, margin: "0 8px 8px", width: "calc(100% - 16px)", border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: 6, padding: 6, background: "var(--input-bg, #0f141e)", color: "var(--text, #e8ecf3)" }, value: c.desc || "", onChange: (e) => patchCharacter(c.id, { desc: e.target.value }), placeholder: "\u89D2\u8272\u63CF\u8FF0\uFF1A\u5916\u8C8C\u3001\u670D\u88C5\u3001\u6C14\u8D28\u3001\u65F6\u4EE3\u80CC\u666F\uFF08\u53E4\u4EE3/\u73B0\u4EE3\uFF09\u3002\u4ECE\u5168\u6587\u5206\u6790\u4F1A\u81EA\u52A8\u586B\u5165\u8BE6\u7EC6\u63D0\u793A\u8BCD\u3002" }), /* @__PURE__ */ import_react12.default.createElement("div", { style: { padding: "0 8px 8px", display: "flex", flexDirection: "column", gap: 6 } }, /* @__PURE__ */ import_react12.default.createElement("button", { style: miniBtn, disabled: c.model3d?.status === "generating_fourview", onClick: () => genFourView(c) }, c.model3d?.status === "generating_fourview" ? "\u751F\u6210\u53C2\u8003\u56FE\u4E2D\u2026" : "\u{1F5BC} \u751F\u6210\u89D2\u8272\u53C2\u8003\u56FE"), /* @__PURE__ */ import_react12.default.createElement("div", { style: { fontSize: 10, color: "var(--text-muted, #5d6779)", marginTop: 2 } }, "\u5206\u89C6\u89D2\u4E0A\u4F20\uFF08\u6B63\u9762/\u4FA7\u9762/\u80CC\u9762/\u7279\u5199\uFF09\uFF1A"), /* @__PURE__ */ import_react12.default.createElement("div", { style: { display: "flex", gap: 4, flexWrap: "wrap" } }, ["\u6B63\u9762", "\u4FA7\u9762", "\u80CC\u9762", "\u7279\u5199"].map((view) => /* @__PURE__ */ import_react12.default.createElement(
      "button",
      {
        key: view,
        style: { ...miniBtn, fontSize: 11, padding: "3px 6px", flex: "1 1 auto" },
        onClick: () => {
          setUploadingView({ charId: c.id, view });
          fourViewRef.current?.click();
        }
      },
      "\u4F20",
      view
    ))), /* @__PURE__ */ import_react12.default.createElement("button", { style: miniBtn, onClick: () => sheetRef.current?.click() }, "\u{1F4C1} \u4E0A\u4F20\u6574\u5F20\u53C2\u8003\u56FE"), /* @__PURE__ */ import_react12.default.createElement(
      "input",
      {
        ref: fourViewRef,
        type: "file",
        accept: "image/*",
        style: { display: "none" },
        onChange: (e) => {
          const f = e.target.files?.[0];
          const u = uploadingView;
          if (f && u) uploadFourView(characters.find((x) => x.id === u.charId), u.view, f);
          setUploadingView(null);
          e.target.value = "";
        }
      }
    ), /* @__PURE__ */ import_react12.default.createElement(
      "input",
      {
        ref: sheetRef,
        type: "file",
        accept: "image/*",
        style: { display: "none" },
        onChange: (e) => {
          const f = e.target.files?.[0];
          if (f) uploadReferenceSheet(characters.find((x) => x.id === c.id), f);
          e.target.value = "";
        }
      }
    ), /* @__PURE__ */ import_react12.default.createElement("button", { style: miniBtnOn, disabled: c.model3d?.status === "generating_3d", onClick: () => genChar3D(c) }, c.model3d?.status === "generating_3d" ? "\u751F\u62103D\u4E2D\u2026" : "\u{1F9CD} \u751F\u6210\u89D2\u8272 3D \u6A21\u578B"), /* @__PURE__ */ import_react12.default.createElement("button", { style: miniBtn, onClick: () => {
      setImportingChar3d(c.id);
      char3dRef.current?.click();
    } }, "\u{1F4C1} \u5BFC\u5165 GLB \u6A21\u578B"), /* @__PURE__ */ import_react12.default.createElement("input", { ref: char3dRef, type: "file", accept: ".glb,.gltf", style: { display: "none" }, onChange: (e) => {
      const f = e.target.files?.[0];
      if (f && importingChar3d) {
        importChar3D(characters.find((x) => x.id === importingChar3d), f);
        setImportingChar3d(null);
      }
      e.target.value = "";
    } }), /* @__PURE__ */ import_react12.default.createElement("div", { style: { fontSize: 10, color: "var(--text-muted, #5d6779)" } }, "3D\u72B6\u6001\uFF1A", c.model3d?.status === "exported" ? "\u5DF2\u5BFC\u51FA" : c.model3d?.status === "generating_3d" ? "\u751F\u62103D\u4E2D\u2026" : c.model3d?.status === "generating_fourview" ? "\u751F\u6210\u53C2\u8003\u56FE\u4E2D\u2026" : c.model3d?.status === "fourview_error" ? "\u53C2\u8003\u56FE\u5931\u8D25" : c.model3d?.status === "error_3d" ? "3D\u5931\u8D25" : c.model3d?.status === "need_gpu" ? "\u9700\u4E91\u7AEFGPU" : "\u672A\u751F\u6210"), c.referenceSheet && /* @__PURE__ */ import_react12.default.createElement("div", { style: { marginTop: 4 } }, /* @__PURE__ */ import_react12.default.createElement("div", { style: { fontSize: 10, color: "var(--text-muted, #5d6779)", marginBottom: 2 } }, "\u6574\u5F20\u89D2\u8272\u53C2\u8003\u56FE\uFF08\u7528\u4E8E\u89C6\u9891\u89D2\u8272\u4E00\u81F4\u6027\uFF09\uFF1A"), /* @__PURE__ */ import_react12.default.createElement(
      "img",
      {
        src: c.referenceSheet,
        alt: `${c.name} \u89D2\u8272\u53C2\u8003\u56FE`,
        onClick: () => setLightbox({ src: c.referenceSheet, alt: `${c.name} \xB7 \u89D2\u8272\u53C2\u8003\u56FE` }),
        style: { width: "100%", borderRadius: 6, border: "1px solid var(--electric, #7A5CFF)", cursor: "zoom-in" },
        title: "\u70B9\u51FB\u67E5\u770B\u539F\u56FE"
      }
    ), /* @__PURE__ */ import_react12.default.createElement("button", { style: { ...miniBtn, fontSize: 10, marginTop: 3 }, onClick: () => patchCharacter(c.id, { referenceSheet: "" }) }, "\u79FB\u9664\u6574\u5F20\u53C2\u8003\u56FE")), c.fourViews && c.fourViews.length > 0 && /* @__PURE__ */ import_react12.default.createElement("div", { style: { display: "flex", gap: 6, marginTop: 4, overflowX: "auto" } }, c.fourViews.map((v) => /* @__PURE__ */ import_react12.default.createElement("div", { key: v.view, style: { position: "relative", flex: "0 0 auto", width: 72 } }, /* @__PURE__ */ import_react12.default.createElement(
      "img",
      {
        src: v.url,
        alt: v.view,
        onClick: () => setLightbox({ src: v.url, alt: `${c.name} \xB7 ${v.view}` }),
        style: { width: 72, height: 96, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border, rgba(255,255,255,0.08))", cursor: "zoom-in" },
        title: "\u70B9\u51FB\u67E5\u770B\u539F\u56FE"
      }
    ), /* @__PURE__ */ import_react12.default.createElement("div", { style: { position: "absolute", bottom: 4, left: 4, fontSize: 10, color: "#fff", background: "rgba(0,0,0,0.6)", padding: "1px 5px", borderRadius: 4 } }, v.view)))), /* @__PURE__ */ import_react12.default.createElement("button", { style: miniBtnD, onClick: () => delCharacter(c.id) }, "\u5220\u9664")))))), section === "scenes" && /* @__PURE__ */ import_react12.default.createElement(import_react12.default.Fragment, null, /* @__PURE__ */ import_react12.default.createElement("div", { style: { fontSize: 11, color: "var(--text-muted, #5d6779)", marginBottom: 8 } }, "\u573A\u666F\u5E93\uFF1A\u586B\u5199\u573A\u666F\u63CF\u8FF0\u540E\uFF0C\u53EF\u751F\u6210\u573A\u666F\u56FE\uFF08Agnes \u751F\u56FE\uFF0C\u4E0D\u8017 GPU\uFF09\uFF0C\u6216\u751F\u6210\u7A0B\u5E8F\u5316 3D \u573A\u666F GLB \u5BFC\u5165 3D \u5BFC\u6F14\u53F0\uFF1B\u4E5F\u652F\u6301\u5BFC\u5165\u5916\u90E8 GLB\u3002"), /* @__PURE__ */ import_react12.default.createElement("div", { style: { display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" } }, /* @__PURE__ */ import_react12.default.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center" } }, /* @__PURE__ */ import_react12.default.createElement("span", { style: { fontSize: 11, color: "var(--text-muted, #5d6779)" } }, "\u751F\u56FE\u98CE\u683C"), /* @__PURE__ */ import_react12.default.createElement(
      "select",
      {
        value: selectedStyle,
        onChange: (e) => setSelectedStyle(e.target.value),
        style: { padding: "6px 10px", border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: 6, background: "var(--input-bg, #0f141e)", color: "var(--text, #e8ecf3)", fontSize: 12, cursor: "pointer" },
        title: "\u9009\u62E9\u751F\u56FE\u98CE\u683C"
      },
      STYLE_OPTIONS3.map((s2) => /* @__PURE__ */ import_react12.default.createElement("option", { key: s2.value, value: s2.value }, s2.label))
    )), /* @__PURE__ */ import_react12.default.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center" } }, /* @__PURE__ */ import_react12.default.createElement("span", { style: { fontSize: 11, color: "var(--text-muted, #5d6779)" } }, "\u753B\u9762\u6BD4\u4F8B"), /* @__PURE__ */ import_react12.default.createElement(
      "select",
      {
        value: selectedAspectRatio,
        onChange: (e) => setSelectedAspectRatio(e.target.value),
        style: { padding: "6px 10px", border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: 6, background: "var(--input-bg, #0f141e)", color: "var(--text, #e8ecf3)", fontSize: 12, cursor: "pointer" },
        title: "\u9009\u62E9\u753B\u9762\u6BD4\u4F8B"
      },
      ASPECT_RATIO_OPTIONS2.map((a) => /* @__PURE__ */ import_react12.default.createElement("option", { key: a.value, value: a.value }, a.label))
    ))), scenes.length === 0 && /* @__PURE__ */ import_react12.default.createElement("div", { style: ph }, "\u6682\u65E0\u573A\u666F\u3002\u70B9\u51FB\u53F3\u4E0A\u89D2\u300C\u6DFB\u52A0\u573A\u666F\u300D\u3002"), /* @__PURE__ */ import_react12.default.createElement("div", { style: grid }, scenes.map((s2) => /* @__PURE__ */ import_react12.default.createElement("div", { key: s2.id, style: card }, s2.imageUrl ? /* @__PURE__ */ import_react12.default.createElement("img", { src: s2.imageUrl, alt: s2.name, style: { ...thumb, objectFit: "cover" } }) : /* @__PURE__ */ import_react12.default.createElement("div", { style: { ...thumb, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 } }, "\u{1F3AA}"), /* @__PURE__ */ import_react12.default.createElement("input", { style: title, value: s2.name, onChange: (e) => patchScene(s2.id, { name: e.target.value }) }), /* @__PURE__ */ import_react12.default.createElement("textarea", { style: { ...title, minHeight: 54, fontSize: 12, resize: "none", lineHeight: 1.5, margin: "0 8px 8px", width: "calc(100% - 16px)", border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: 6, padding: 6, background: "var(--input-bg, #0f141e)", color: "var(--text, #e8ecf3)" }, value: s2.desc || "", onChange: (e) => patchScene(s2.id, { desc: e.target.value }), placeholder: "\u573A\u666F\u63CF\u8FF0\uFF1A\u73AF\u5883\u3001\u8272\u8C03\u3001\u98CE\u683C\u3001\u65F6\u4EE3\u80CC\u666F\u3002\u4ECE\u5168\u6587\u5206\u6790\u4F1A\u81EA\u52A8\u586B\u5165\u8BE6\u7EC6\u63D0\u793A\u8BCD\u3002" }), /* @__PURE__ */ import_react12.default.createElement("div", { style: { padding: "0 8px 8px", display: "flex", flexDirection: "column", gap: 6 } }, /* @__PURE__ */ import_react12.default.createElement("button", { style: miniBtn, disabled: s2.model3d?.status === "generating_image", onClick: () => genSceneImage(s2) }, s2.model3d?.status === "generating_image" ? "\u751F\u6210\u573A\u666F\u4E2D\u2026" : "\u{1F5BC} \u751F\u6210\u573A\u666F\u56FE"), /* @__PURE__ */ import_react12.default.createElement("button", { style: miniBtnOn, disabled: s2.model3d?.status === "generating_3d", onClick: () => genScene3D(s2) }, s2.model3d?.status === "generating_3d" ? "\u751F\u62103D\u4E2D\u2026" : "\u{1F3DB} \u751F\u6210\u573A\u666F 3D \u6A21\u578B"), /* @__PURE__ */ import_react12.default.createElement("button", { style: miniBtn, onClick: () => {
      setImportingScene3d(s2.id);
      scene3dRef.current?.click();
    } }, "\u{1F4C1} \u5BFC\u5165 GLB \u573A\u666F"), /* @__PURE__ */ import_react12.default.createElement("input", { ref: scene3dRef, type: "file", accept: ".glb,.gltf", style: { display: "none" }, onChange: (e) => {
      const f = e.target.files?.[0];
      if (f && importingScene3d) {
        importScene3D(scenes.find((x) => x.id === importingScene3d), f);
        setImportingScene3d(null);
      }
      e.target.value = "";
    } }), /* @__PURE__ */ import_react12.default.createElement("div", { style: { fontSize: 10, color: "var(--text-muted, #5d6779)" } }, "3D\u72B6\u6001\uFF1A", s2.model3d?.status === "exported" ? "\u5DF2\u5BFC\u51FA" : s2.model3d?.status === "generating_3d" ? "\u751F\u62103D\u4E2D\u2026" : s2.model3d?.status === "generating_image" ? "\u751F\u56FE\u4E2D\u2026" : s2.model3d?.status === "error_3d" ? "3D\u5931\u8D25" : s2.model3d?.status === "error_image" ? "\u751F\u56FE\u5931\u8D25" : s2.model3d?.status === "need_gpu" ? "\u9700\u4E91\u7AEFGPU" : "\u672A\u751F\u6210"), /* @__PURE__ */ import_react12.default.createElement("button", { style: miniBtnD, onClick: () => delScene(s2.id) }, "\u5220\u9664")))))), lightbox && /* @__PURE__ */ import_react12.default.createElement(ImageLightbox, { src: lightbox.src, alt: lightbox.alt, onClose: () => setLightbox(null) }));
  }
  var wrap = { padding: 16, overflowY: "auto", height: "100%", boxSizing: "border-box", color: "var(--text, #e8ecf3)" };
  var headRow = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 };
  var h3 = { fontSize: 15, margin: 0 };
  var sectionBtn = { padding: "6px 14px", border: "1px solid var(--border, rgba(255,255,255,0.14))", borderRadius: "var(--radius-sm, 6px)", background: "var(--panel-2, #1c2433)", cursor: "pointer", fontSize: 13, color: "var(--text-secondary, #8b95a7)" };
  var sectionBtnOn = { background: "var(--accent-gradient, linear-gradient(135deg, #7c3aed, #3b82f6))", color: "#fff", borderColor: "transparent" };
  var search = { flex: 1, minWidth: 120, padding: 6, border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: 14, fontSize: 12, boxSizing: "border-box", background: "var(--input-bg, #0f141e)", color: "var(--text, #e8ecf3)" };
  var chip = { padding: "4px 12px", border: "1px solid var(--border, rgba(255,255,255,0.14))", borderRadius: 14, background: "var(--panel-2, #1c2433)", cursor: "pointer", fontSize: 12, color: "var(--text-secondary, #8b95a7)" };
  var chipOn = { background: "var(--accent-gradient, linear-gradient(135deg, #7c3aed, #3b82f6))", color: "#fff", borderColor: "transparent" };
  var grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 };
  var card = { border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: "var(--radius, 10px)", overflow: "hidden", background: "var(--panel, #161d2a)", cursor: "grab" };
  var cardSel = { borderColor: "var(--accent-2, #3b82f6)" };
  var thumb = { width: "100%", height: 120, objectFit: "cover", display: "block", background: "var(--panel-2, #1c2433)" };
  var title = { padding: "6px 8px 0", fontSize: 13, fontWeight: 500, color: "var(--text, #e8ecf3)", border: "none", background: "transparent", width: "100%", boxSizing: "border-box" };
  var tagRow = { display: "flex", gap: 4, flexWrap: "wrap", padding: "6px 8px 0", alignItems: "center" };
  var tagPill = { fontSize: 10, color: "var(--accent-2, #3b82f6)", background: "rgba(59,130,246,0.12)", borderRadius: 4, padding: "2px 6px", display: "inline-flex", alignItems: "center", gap: 2 };
  var tagX = { border: "none", background: "transparent", color: "var(--accent-2, #3b82f6)", cursor: "pointer", fontSize: 11, padding: 0 };
  var tagInput = { width: 56, fontSize: 10, border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: 4, background: "var(--input-bg, #0f141e)", color: "var(--text, #e8ecf3)", padding: "2px 4px" };
  var miniSelect = { fontSize: 11, padding: "3px 6px", borderRadius: 6, border: "1px solid var(--border, rgba(255,255,255,0.08))", background: "var(--input-bg, #0f141e)", color: "var(--text, #e8ecf3)" };
  var btnRow = { display: "flex", gap: 4, padding: "6px 6px 8px" };
  var miniBtn = { flex: 1, padding: "5px 0", border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: 6, background: "var(--panel-2, #1c2433)", cursor: "pointer", fontSize: 11, color: "var(--text-secondary, #8b95a7)" };
  var miniBtnOn = { padding: "5px 10px", border: "none", borderRadius: 6, background: "var(--accent-gradient, linear-gradient(135deg, #7c3aed, #3b82f6))", color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600 };
  var miniBtnD = { padding: "5px 10px", border: "1px solid var(--danger, #ef4444)", borderRadius: 6, background: "transparent", color: "var(--danger, #ef4444)", cursor: "pointer", fontSize: 11 };
  var favBtn = { position: "absolute", top: 6, right: 6, border: "none", background: "rgba(0,0,0,0.4)", borderRadius: 6, cursor: "pointer", fontSize: 14, color: "#fff", padding: "2px 6px" };
  var favOn = { color: "#f59e0b" };
  var ph = { color: "var(--text-muted, #5d6779)", fontSize: 13, padding: 20, textAlign: "center", background: "var(--panel, #161d2a)", borderRadius: "var(--radius, 10px)", border: "1px dashed var(--border, rgba(255,255,255,0.14))" };
  var btn = { padding: "7px 12px", border: "1px solid var(--border, rgba(255,255,255,0.14))", borderRadius: "var(--radius-sm, 6px)", background: "var(--panel-2, #1c2433)", cursor: "pointer", fontSize: 12, color: "var(--text-secondary, #8b95a7)" };
  var btnPrimary = { padding: "7px 14px", border: "none", borderRadius: "var(--radius-sm, 6px)", background: "var(--accent-gradient, linear-gradient(135deg, #7c3aed, #3b82f6))", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 };
  var btnDanger = { padding: "7px 12px", border: "1px solid var(--danger, #ef4444)", borderRadius: "var(--radius-sm, 6px)", background: "transparent", color: "var(--danger, #ef4444)", cursor: "pointer", fontSize: 12 };
  var addBox = { border: "1px solid var(--border, rgba(255,255,255,0.12))", borderRadius: "var(--radius, 10px)", padding: 12, marginBottom: 12, background: "var(--panel, #161d2a)" };
  var inp = { padding: "6px 10px", border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: 6, fontSize: 12, background: "var(--input-bg, #0f141e)", color: "var(--text, #e8ecf3)", minWidth: 140 };

  // src/components/RechargeModal.jsx
  var import_react13 = __toESM(__require("react"), 1);
  function RechargeModal({ onClose, onSuccess }) {
    const [tab, setTab] = (0, import_react13.useState)("credits");
    const [selectedCredit, setSelectedCredit] = (0, import_react13.useState)(1);
    const [selectedMembership, setSelectedMembership] = (0, import_react13.useState)(0);
    const [payMethod, setPayMethod] = (0, import_react13.useState)("alipay");
    const [paying, setPaying] = (0, import_react13.useState)(false);
    const [orderInfo, setOrderInfo] = (0, import_react13.useState)(null);
    const [orderStatus, setOrderStatus] = (0, import_react13.useState)("idle");
    const [errorMsg, setErrorMsg] = (0, import_react13.useState)("");
    const pollRef = (0, import_react13.useRef)(null);
    const creditPackages = getCreditPackages();
    const membershipPackages = getMembershipPackages();
    const exchangeRate = getPrice("exchange_rate", 5);
    (0, import_react13.useEffect)(() => {
      return () => {
        if (pollRef.current) {
          clearInterval(pollRef.current);
        }
      };
    }, []);
    const startPolling = (orderNo) => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const order = await getOrderStatus(orderNo);
          if (order.status === "paid") {
            clearInterval(pollRef.current);
            setOrderStatus("paid");
            setTimeout(() => {
              if (onSuccess) onSuccess();
              onClose();
            }, 1500);
          }
        } catch (e) {
          console.error("\u8F6E\u8BE2\u8BA2\u5355\u72B6\u6001\u5931\u8D25:", e);
        }
      }, 3e3);
    };
    const handlePay = async () => {
      setErrorMsg("");
      setPaying(true);
      try {
        let tier, channel = payMethod;
        if (tab === "credits") {
          tier = creditPackages[selectedCredit]?.price;
        } else {
          const memberTier = membershipPackages[selectedMembership]?.yuan;
          if (memberTier) {
            const result2 = await subscribeMembership(memberTier);
            if (result2.ok) {
              setOrderStatus("paid");
              setTimeout(() => {
                if (onSuccess) onSuccess();
                onClose();
              }, 1500);
            }
            return;
          }
        }
        if (!tier) {
          setErrorMsg("\u8BF7\u9009\u62E9\u5145\u503C\u6863\u4F4D");
          setPaying(false);
          return;
        }
        const result = await createRechargeOrder(tier, channel);
        setOrderInfo(result);
        setOrderStatus("pending");
        if (channel === "alipay") {
          if (result.qr_content && !result.mock) {
            window.open(result.qr_content, "_blank");
          }
        }
        startPolling(result.order_id);
      } catch (e) {
        console.error("\u521B\u5EFA\u8BA2\u5355\u5931\u8D25:", e);
        setErrorMsg(e.message || "\u521B\u5EFA\u8BA2\u5355\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5");
        setOrderStatus("failed");
      } finally {
        setPaying(false);
      }
    };
    const handleMockPay = async () => {
      if (!orderInfo?.mock || !orderInfo?.order_id) return;
      try {
        const res = await fetch(
          `${localStorage.getItem("DISPATCH_BASE_URL") || "https://api.jinsuai.cn"}/api/billing/order/${orderInfo.order_id}/confirm`,
          {
            method: "POST",
            headers: {
              "Authorization": "Bearer " + (localStorage.getItem("DISPATCH_TOKEN") || "")
            }
          }
        );
        if (res.ok) {
          setOrderStatus("paid");
          setTimeout(() => {
            if (onSuccess) onSuccess();
            onClose();
          }, 1500);
        }
      } catch (e) {
        console.error("\u6A21\u62DF\u652F\u4ED8\u5931\u8D25:", e);
      }
    };
    const modalStyle = {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999
    };
    const contentStyle = {
      background: "var(--bg, #1a1d2e)",
      borderRadius: 16,
      padding: 24,
      width: 420,
      maxWidth: "90vw",
      maxHeight: "90vh",
      overflowY: "auto",
      border: "1px solid var(--line, #2a2d3e)"
    };
    const tabBtnStyle = (active) => ({
      flex: 1,
      padding: "10px",
      border: "none",
      borderRadius: 8,
      background: active ? "linear-gradient(135deg, #7A5CFF, #5CE1E6)" : "var(--input-bg, #252b3b)",
      color: active ? "#fff" : "var(--text-secondary)",
      cursor: "pointer",
      fontSize: 14,
      fontWeight: 600
    });
    const packageBtnStyle = (selected) => ({
      padding: 12,
      borderRadius: 10,
      border: "2px solid",
      borderColor: selected ? "#7A5CFF" : "var(--line, #2a2d3e)",
      background: selected ? "rgba(122,92,255,0.1)" : "var(--input-bg, #252b3b)",
      cursor: "pointer",
      textAlign: "left",
      width: "100%",
      marginBottom: 8
    });
    const payBtnStyle = (method) => ({
      flex: 1,
      padding: "10px",
      border: "2px solid",
      borderColor: payMethod === method ? "#7A5CFF" : "var(--line, #2a2d3e)",
      background: payMethod === method ? "rgba(122,92,255,0.1)" : "var(--input-bg, #252b3b)",
      color: "var(--text)",
      cursor: "pointer",
      fontSize: 14,
      fontWeight: 600,
      borderRadius: 8
    });
    if (orderStatus === "paid") {
      return /* @__PURE__ */ import_react13.default.createElement("div", { style: modalStyle, onClick: onClose }, /* @__PURE__ */ import_react13.default.createElement("div", { style: contentStyle, onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ import_react13.default.createElement("div", { style: { textAlign: "center", padding: "40px 20px" } }, /* @__PURE__ */ import_react13.default.createElement("div", { style: { fontSize: 60, marginBottom: 20 } }, "\u2705"), /* @__PURE__ */ import_react13.default.createElement("h2", { style: { color: "#10b981", marginBottom: 10 } }, "\u652F\u4ED8\u6210\u529F"), /* @__PURE__ */ import_react13.default.createElement("p", { style: { color: "var(--text-secondary)", fontSize: 14 } }, tab === "credits" ? `\u5DF2\u5145\u503C ${orderInfo?.credits || 0} \u79EF\u5206` : "\u4F1A\u5458\u5DF2\u5F00\u901A"), /* @__PURE__ */ import_react13.default.createElement("p", { style: { color: "var(--text-muted)", fontSize: 12, marginTop: 10 } }, "\u7A97\u53E3\u5373\u5C06\u81EA\u52A8\u5173\u95ED..."))));
    }
    if (orderStatus === "pending" && orderInfo) {
      return /* @__PURE__ */ import_react13.default.createElement("div", { style: modalStyle, onClick: onClose }, /* @__PURE__ */ import_react13.default.createElement("div", { style: contentStyle, onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ import_react13.default.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 } }, /* @__PURE__ */ import_react13.default.createElement("h3", { style: { margin: 0, color: "var(--text)" } }, "\u7B49\u5F85\u652F\u4ED8"), /* @__PURE__ */ import_react13.default.createElement("button", { onClick: onClose, style: { background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 20 } }, "\xD7")), /* @__PURE__ */ import_react13.default.createElement("div", { style: { textAlign: "center", padding: "20px 0" } }, /* @__PURE__ */ import_react13.default.createElement("div", { style: { fontSize: 32, fontWeight: 700, color: "#f59e0b", marginBottom: 10 } }, "\xA5", orderInfo.yuan), /* @__PURE__ */ import_react13.default.createElement("div", { style: { fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 } }, payMethod === "alipay" ? "\u652F\u4ED8\u5B9D\u652F\u4ED8" : "\u5FAE\u4FE1\u652F\u4ED8"), payMethod === "alipay" ? /* @__PURE__ */ import_react13.default.createElement("div", { style: { padding: 20, background: "var(--input-bg, #252b3b)", borderRadius: 10, marginBottom: 20 } }, /* @__PURE__ */ import_react13.default.createElement("div", { style: { fontSize: 40, marginBottom: 10 } }, "\u{1F499}"), /* @__PURE__ */ import_react13.default.createElement("p", { style: { fontSize: 14, color: "var(--text-secondary)", marginBottom: 10 } }, "\u5DF2\u5728\u65B0\u7A97\u53E3\u6253\u5F00\u652F\u4ED8\u5B9D\u652F\u4ED8\u9875\u9762"), /* @__PURE__ */ import_react13.default.createElement("p", { style: { fontSize: 12, color: "var(--text-muted)" } }, "\u5982\u679C\u6CA1\u6709\u81EA\u52A8\u8DF3\u8F6C\uFF0C\u8BF7\u70B9\u51FB\u4E0B\u65B9\u6309\u94AE"), !orderInfo.mock && /* @__PURE__ */ import_react13.default.createElement(
        "a",
        {
          href: orderInfo.qr_content,
          target: "_blank",
          rel: "noopener noreferrer",
          style: {
            display: "inline-block",
            marginTop: 10,
            padding: "8px 20px",
            background: "linear-gradient(135deg, #7A5CFF, #5CE1E6)",
            color: "#fff",
            borderRadius: 8,
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 600
          }
        },
        "\u6253\u5F00\u652F\u4ED8\u5B9D\u652F\u4ED8"
      )) : /* @__PURE__ */ import_react13.default.createElement("div", { style: { padding: 20, background: "var(--input-bg, #252b3b)", borderRadius: 10, marginBottom: 20 } }, orderInfo.qr_data_url ? /* @__PURE__ */ import_react13.default.createElement("img", { src: orderInfo.qr_data_url, alt: "\u652F\u4ED8\u4E8C\u7EF4\u7801", style: { width: 200, height: 200, borderRadius: 8 } }) : /* @__PURE__ */ import_react13.default.createElement("div", { style: { width: 200, height: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", borderRadius: 8 } }, /* @__PURE__ */ import_react13.default.createElement("span", { style: { color: "#999", fontSize: 12 } }, "\u4E8C\u7EF4\u7801\u751F\u6210\u4E2D...")), /* @__PURE__ */ import_react13.default.createElement("p", { style: { fontSize: 14, color: "var(--text-secondary)", marginTop: 10 } }, "\u8BF7\u4F7F\u7528\u5FAE\u4FE1\u626B\u7801\u652F\u4ED8")), orderInfo.mock && /* @__PURE__ */ import_react13.default.createElement(
        "button",
        {
          onClick: handleMockPay,
          style: {
            width: "100%",
            padding: "10px",
            border: "none",
            borderRadius: 8,
            background: "var(--input-bg, #252b3b)",
            color: "var(--text-secondary)",
            cursor: "pointer",
            fontSize: 13,
            marginTop: 10
          }
        },
        "\u{1F9EA} \u6F14\u793A\u6A21\u5F0F\uFF1A\u6A21\u62DF\u652F\u4ED8\u6210\u529F"
      ), /* @__PURE__ */ import_react13.default.createElement("p", { style: { fontSize: 12, color: "var(--text-muted)", marginTop: 15 } }, "\u652F\u4ED8\u5B8C\u6210\u540E\u5C06\u81EA\u52A8\u786E\u8BA4\uFF0C\u8BF7\u52FF\u5173\u95ED\u6B64\u7A97\u53E3"))));
    }
    return /* @__PURE__ */ import_react13.default.createElement("div", { style: modalStyle, onClick: onClose }, /* @__PURE__ */ import_react13.default.createElement("div", { style: contentStyle, onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ import_react13.default.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 } }, /* @__PURE__ */ import_react13.default.createElement("h3", { style: { margin: 0, color: "var(--text)" } }, "\u5145\u503C\u4E2D\u5FC3"), /* @__PURE__ */ import_react13.default.createElement("button", { onClick: onClose, style: { background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 20 } }, "\xD7")), /* @__PURE__ */ import_react13.default.createElement("div", { style: { display: "flex", gap: 10, marginBottom: 20 } }, /* @__PURE__ */ import_react13.default.createElement("button", { style: tabBtnStyle(tab === "credits"), onClick: () => setTab("credits") }, "\u79EF\u5206\u5145\u503C"), /* @__PURE__ */ import_react13.default.createElement("button", { style: tabBtnStyle(tab === "membership"), onClick: () => setTab("membership") }, "\u4F1A\u5458\u5F00\u901A")), tab === "credits" && /* @__PURE__ */ import_react13.default.createElement("div", { style: { marginBottom: 16 } }, creditPackages.map((pkg, idx) => /* @__PURE__ */ import_react13.default.createElement(
      "button",
      {
        key: idx,
        style: packageBtnStyle(selectedCredit === idx),
        onClick: () => setSelectedCredit(idx)
      },
      /* @__PURE__ */ import_react13.default.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, /* @__PURE__ */ import_react13.default.createElement("div", null, /* @__PURE__ */ import_react13.default.createElement("div", { style: { fontSize: 16, fontWeight: 600, color: "var(--text)" } }, pkg.credits, " \u79EF\u5206"), pkg.bonus > 0 && /* @__PURE__ */ import_react13.default.createElement("div", { style: { fontSize: 11, color: "#f59e0b", marginTop: 2 } }, "\u8D60\u9001 ", pkg.bonus, " \u79EF\u5206")), /* @__PURE__ */ import_react13.default.createElement("div", { style: { fontSize: 18, fontWeight: 700, color: "#f59e0b" } }, "\xA5", pkg.price))
    ))), tab === "membership" && /* @__PURE__ */ import_react13.default.createElement("div", { style: { marginBottom: 16 } }, membershipPackages.map((pkg, idx) => /* @__PURE__ */ import_react13.default.createElement(
      "button",
      {
        key: idx,
        style: packageBtnStyle(selectedMembership === idx),
        onClick: () => setSelectedMembership(idx)
      },
      /* @__PURE__ */ import_react13.default.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, /* @__PURE__ */ import_react13.default.createElement("div", null, /* @__PURE__ */ import_react13.default.createElement("div", { style: { fontSize: 16, fontWeight: 600, color: "var(--text)" } }, pkg.name), /* @__PURE__ */ import_react13.default.createElement("div", { style: { fontSize: 11, color: "var(--text-muted)", marginTop: 2 } }, pkg.duration_days, "\u5929 \xB7 ", pkg.discount_label, " \xB7 \u8D60\u9001", pkg.credits, "\u79EF\u5206")), /* @__PURE__ */ import_react13.default.createElement("div", { style: { fontSize: 18, fontWeight: 700, color: "#f59e0b" } }, "\xA5", pkg.price))
    ))), /* @__PURE__ */ import_react13.default.createElement("div", { style: { marginBottom: 16 } }, /* @__PURE__ */ import_react13.default.createElement("div", { style: { fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 } }, "\u9009\u62E9\u652F\u4ED8\u65B9\u5F0F"), /* @__PURE__ */ import_react13.default.createElement("div", { style: { display: "flex", gap: 10 } }, /* @__PURE__ */ import_react13.default.createElement("button", { style: payBtnStyle("wechat"), onClick: () => setPayMethod("wechat") }, "\u{1F49A} \u5FAE\u4FE1\u652F\u4ED8"), /* @__PURE__ */ import_react13.default.createElement("button", { style: payBtnStyle("alipay"), onClick: () => setPayMethod("alipay") }, "\u{1F499} \u652F\u4ED8\u5B9D"))), errorMsg && /* @__PURE__ */ import_react13.default.createElement("div", { style: { padding: 10, background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", borderRadius: 8, marginBottom: 16, fontSize: 13, color: "#ef4444" } }, errorMsg), /* @__PURE__ */ import_react13.default.createElement("div", { style: { padding: 12, background: "var(--input-bg, #252b3b)", borderRadius: 8, marginBottom: 16, textAlign: "center" } }, /* @__PURE__ */ import_react13.default.createElement("span", { style: { fontSize: 13, color: "var(--text-muted)" } }, "\u5E94\u4ED8\u91D1\u989D\uFF1A"), /* @__PURE__ */ import_react13.default.createElement("span", { style: { fontSize: 24, fontWeight: 700, color: "#f59e0b" } }, "\xA5", tab === "credits" ? creditPackages[selectedCredit]?.price : membershipPackages[selectedMembership]?.price)), /* @__PURE__ */ import_react13.default.createElement(
      "button",
      {
        onClick: handlePay,
        disabled: paying,
        style: {
          width: "100%",
          padding: "12px",
          border: "none",
          borderRadius: 8,
          background: paying ? "#666" : "linear-gradient(135deg, #7A5CFF, #5CE1E6)",
          color: "#fff",
          cursor: paying ? "not-allowed" : "pointer",
          fontSize: 15,
          fontWeight: 600
        }
      },
      paying ? "\u23F3 \u5904\u7406\u4E2D..." : "\u2705 \u786E\u8BA4\u652F\u4ED8"
    ), /* @__PURE__ */ import_react13.default.createElement("div", { style: { fontSize: 11, color: "var(--text-muted)", marginTop: 12, textAlign: "center" } }, "\u652F\u4ED8\u5373\u8868\u793A\u540C\u610F\u300A\u7528\u6237\u534F\u8BAE\u300B\u548C\u300A\u9690\u79C1\u653F\u7B56\u300B")));
  }

  // src/components/AuthModal.jsx
  var import_react14 = __require("react");
  var DISPATCH_API_URL = "https://api.jinsuai.cn";
  function AuthModal({ isOpen, onClose, onLoginSuccess, initialMode = "login" }) {
    const [mode, setMode] = (0, import_react14.useState)(initialMode);
    const [username, setUsername] = (0, import_react14.useState)("");
    const [email, setEmail] = (0, import_react14.useState)("");
    const [password, setPassword] = (0, import_react14.useState)("");
    const [captchaId, setCaptchaId] = (0, import_react14.useState)("");
    const [captchaCode, setCaptchaCode] = (0, import_react14.useState)("");
    const [captchaImage, setCaptchaImage] = (0, import_react14.useState)("");
    const [loading, setLoading] = (0, import_react14.useState)(false);
    const [error, setError] = (0, import_react14.useState)("");
    const fetchCaptcha = async () => {
      try {
        const res = await fetch(`${DISPATCH_API_URL}/api/auth/captcha`);
        const data = await res.json();
        if (data.captcha_id && data.image) {
          setCaptchaId(data.captcha_id);
          setCaptchaImage(data.image);
        }
      } catch (e) {
        console.error("\u83B7\u53D6\u9A8C\u8BC1\u7801\u5931\u8D25:", e.message);
      }
    };
    (0, import_react14.useEffect)(() => {
      if (mode === "register" && isOpen) {
        fetchCaptcha();
      }
    }, [mode, isOpen]);
    if (!isOpen) return null;
    const handleSubmit = async (e) => {
      e.preventDefault();
      setError("");
      setLoading(true);
      try {
        if (mode === "login") {
          const res = await fetch(`${DISPATCH_API_URL}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
          });
          const data = await res.json();
          if (!res.ok || !data.token) {
            throw new Error(data.detail || data.message || "\u767B\u5F55\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u7528\u6237\u540D\u548C\u5BC6\u7801");
          }
          localStorage.setItem("DISPATCH_TOKEN", data.token);
          localStorage.setItem("DISPATCH_USER", username);
          console.log("[\u8C03\u5EA6\u673A] \u767B\u5F55\u6210\u529F:", username);
          onLoginSuccess?.({ username, token: data.token });
          onClose();
        } else {
          if (!captchaId || !captchaCode) {
            throw new Error("\u8BF7\u8F93\u5165\u9A8C\u8BC1\u7801");
          }
          const res = await fetch(`${DISPATCH_API_URL}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username,
              email,
              password,
              captcha_id: captchaId,
              captcha: captchaCode
            })
          });
          const data = await res.json();
          if (!res.ok) {
            fetchCaptcha();
            throw new Error(data.detail || data.message || "\u6CE8\u518C\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5");
          }
          console.log("[\u8C03\u5EA6\u673A] \u6CE8\u518C\u6210\u529F:", username);
          const loginRes = await fetch(`${DISPATCH_API_URL}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
          });
          const loginData = await loginRes.json();
          if (!loginRes.ok || !loginData.token) {
            throw new Error("\u6CE8\u518C\u6210\u529F\uFF0C\u4F46\u81EA\u52A8\u767B\u5F55\u5931\u8D25\uFF0C\u8BF7\u624B\u52A8\u767B\u5F55");
          }
          localStorage.setItem("DISPATCH_TOKEN", loginData.token);
          localStorage.setItem("DISPATCH_USER", username);
          console.log("[\u8C03\u5EA6\u673A] \u6CE8\u518C\u540E\u81EA\u52A8\u767B\u5F55\u6210\u529F:", username);
          onLoginSuccess?.({ username, token: loginData.token });
          onClose();
        }
      } catch (err) {
        setError(err.message || "\u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5");
      } finally {
        setLoading(false);
      }
    };
    return /* @__PURE__ */ React.createElement(
      "div",
      {
        style: {
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999
        },
        onClick: onClose
      },
      /* @__PURE__ */ React.createElement(
        "div",
        {
          style: {
            background: "var(--panel-bg, #1a1a2e)",
            borderRadius: 16,
            padding: 32,
            width: 420,
            maxWidth: "90vw",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            border: "1px solid var(--border, #333)"
          },
          onClick: (e) => e.stopPropagation()
        },
        /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", marginBottom: 24 } }, /* @__PURE__ */ React.createElement("h2", { style: { margin: 0, fontSize: 24, color: "var(--text, #fff)" } }, mode === "login" ? "\u767B\u5F55" : "\u6CE8\u518C"), /* @__PURE__ */ React.createElement("p", { style: { margin: "8px 0 0", color: "var(--text-secondary, #999)", fontSize: 13 } }, "\u70EC\u5E8F\xB7\u5F71\u589F AI\u77ED\u5267\u751F\u6210\u5E73\u53F0")),
        /* @__PURE__ */ React.createElement(
          "div",
          {
            style: {
              display: "flex",
              background: "var(--input-bg, #2a2a3e)",
              borderRadius: 8,
              padding: 4,
              marginBottom: 20
            }
          },
          /* @__PURE__ */ React.createElement(
            "button",
            {
              style: {
                flex: 1,
                padding: "10px 0",
                border: "none",
                borderRadius: 6,
                background: mode === "login" ? "linear-gradient(135deg, #7A5CFF, #5CE1E6)" : "transparent",
                color: mode === "login" ? "#fff" : "var(--text-secondary, #999)",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                transition: "all 0.2s"
              },
              onClick: () => {
                setMode("login");
                setError("");
              }
            },
            "\u767B\u5F55"
          ),
          /* @__PURE__ */ React.createElement(
            "button",
            {
              style: {
                flex: 1,
                padding: "10px 0",
                border: "none",
                borderRadius: 6,
                background: mode === "register" ? "linear-gradient(135deg, #7A5CFF, #5CE1E6)" : "transparent",
                color: mode === "register" ? "#fff" : "var(--text-secondary, #999)",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                transition: "all 0.2s"
              },
              onClick: () => {
                setMode("register");
                setError("");
              }
            },
            "\u6CE8\u518C"
          )
        ),
        /* @__PURE__ */ React.createElement("form", { onSubmit: handleSubmit }, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: 6, fontSize: 13, color: "var(--text-secondary, #999)" } }, "\u7528\u6237\u540D"), /* @__PURE__ */ React.createElement(
          "input",
          {
            id: "username",
            name: "username",
            type: "text",
            value: username,
            onChange: (e) => setUsername(e.target.value),
            placeholder: "\u8BF7\u8F93\u5165\u7528\u6237\u540D",
            maxLength: 30,
            autoComplete: "username",
            style: {
              width: "100%",
              padding: "12px 14px",
              border: "1px solid var(--border, #333)",
              borderRadius: 8,
              background: "var(--input-bg, #2a2a3e)",
              color: "var(--text, #fff)",
              fontSize: 14,
              boxSizing: "border-box"
            },
            required: true
          }
        )), mode === "register" && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: 6, fontSize: 13, color: "var(--text-secondary, #999)" } }, "\u90AE\u7BB1"), /* @__PURE__ */ React.createElement(
          "input",
          {
            id: "email",
            name: "email",
            type: "email",
            value: email,
            onChange: (e) => setEmail(e.target.value),
            placeholder: "\u8BF7\u8F93\u5165\u90AE\u7BB1",
            autoComplete: "email",
            style: {
              width: "100%",
              padding: "12px 14px",
              border: "1px solid var(--border, #333)",
              borderRadius: 8,
              background: "var(--input-bg, #2a2a3e)",
              color: "var(--text, #fff)",
              fontSize: 14,
              boxSizing: "border-box"
            },
            required: true
          }
        )), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: 6, fontSize: 13, color: "var(--text-secondary, #999)" } }, "\u5BC6\u7801"), /* @__PURE__ */ React.createElement(
          "input",
          {
            id: "password",
            name: "password",
            type: "password",
            value: password,
            onChange: (e) => setPassword(e.target.value),
            placeholder: "\u8BF7\u8F93\u5165\u5BC6\u7801\uFF08\u81F3\u5C116\u4F4D\uFF09",
            minLength: 6,
            autoComplete: "current-password",
            style: {
              width: "100%",
              padding: "12px 14px",
              border: "1px solid var(--border, #333)",
              borderRadius: 8,
              background: "var(--input-bg, #2a2a3e)",
              color: "var(--text, #fff)",
              fontSize: 14,
              boxSizing: "border-box"
            },
            required: true
          }
        )), mode === "register" && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: 6, fontSize: 13, color: "var(--text-secondary, #999)" } }, "\u9A8C\u8BC1\u7801"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10 } }, /* @__PURE__ */ React.createElement(
          "input",
          {
            id: "captcha",
            name: "captcha",
            type: "text",
            value: captchaCode,
            onChange: (e) => setCaptchaCode(e.target.value),
            placeholder: "\u8BF7\u8F93\u5165\u9A8C\u8BC1\u7801",
            maxLength: 6,
            style: {
              flex: 1,
              padding: "12px 14px",
              border: "1px solid var(--border, #333)",
              borderRadius: 8,
              background: "var(--input-bg, #2a2a3e)",
              color: "var(--text, #fff)",
              fontSize: 14,
              boxSizing: "border-box"
            },
            required: true
          }
        ), captchaImage ? /* @__PURE__ */ React.createElement(
          "img",
          {
            src: captchaImage,
            alt: "\u9A8C\u8BC1\u7801",
            onClick: fetchCaptcha,
            style: {
              height: 46,
              borderRadius: 8,
              cursor: "pointer",
              border: "1px solid var(--border, #333)"
            },
            title: "\u70B9\u51FB\u5237\u65B0\u9A8C\u8BC1\u7801"
          }
        ) : /* @__PURE__ */ React.createElement(
          "button",
          {
            type: "button",
            onClick: fetchCaptcha,
            style: {
              padding: "0 16px",
              border: "1px solid var(--border, #333)",
              borderRadius: 8,
              background: "var(--input-bg, #2a2a3e)",
              color: "var(--text, #fff)",
              fontSize: 13,
              cursor: "pointer"
            }
          },
          "\u83B7\u53D6\u9A8C\u8BC1\u7801"
        ))), error && /* @__PURE__ */ React.createElement(
          "div",
          {
            style: {
              padding: "10px 14px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 8,
              color: "#ef4444",
              fontSize: 13,
              marginBottom: 16
            }
          },
          error
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            type: "submit",
            disabled: loading,
            style: {
              width: "100%",
              padding: "14px 0",
              border: "none",
              borderRadius: 8,
              background: loading ? "#666" : "linear-gradient(135deg, #7A5CFF, #5CE1E6)",
              color: "#fff",
              fontSize: 16,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.2s"
            }
          },
          loading ? "\u5904\u7406\u4E2D..." : mode === "login" ? "\u767B\u5F55" : "\u6CE8\u518C\u5E76\u767B\u5F55"
        )),
        /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", marginTop: 20, fontSize: 12, color: "var(--text-secondary, #666)" } }, mode === "login" ? /* @__PURE__ */ React.createElement(React.Fragment, null, "\u8FD8\u6CA1\u6709\u8D26\u53F7\uFF1F", /* @__PURE__ */ React.createElement(
          "span",
          {
            style: { color: "#7A5CFF", cursor: "pointer", marginLeft: 4 },
            onClick: () => {
              setMode("register");
              setError("");
            }
          },
          "\u7ACB\u5373\u6CE8\u518C"
        )) : /* @__PURE__ */ React.createElement(React.Fragment, null, "\u5DF2\u6709\u8D26\u53F7\uFF1F", /* @__PURE__ */ React.createElement(
          "span",
          {
            style: { color: "#7A5CFF", cursor: "pointer", marginLeft: 4 },
            onClick: () => {
              setMode("login");
              setError("");
            }
          },
          "\u7ACB\u5373\u767B\u5F55"
        ))),
        mode === "register" && /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", marginTop: 12, fontSize: 12, color: "#5CE1E6" } }, "\u65B0\u7528\u6237\u6CE8\u518C\u5373\u9001 8 \u79EF\u5206")
      )
    );
  }

  // src/components/MembershipModal.jsx
  var import_react15 = __toESM(__require("react"), 1);
  var DEFAULT_PLANS = [
    {
      id: "monthly",
      name: "\u6708\u5361",
      duration: 30,
      price: 29,
      tier: 29,
      tag: "\u70ED\u95E8",
      credits: 100,
      discount_label: "9\u6298",
      features: [
        "3D\u5BFC\u6F14\u53F0\u5168\u90E8\u529F\u80FD",
        "\u8BE6\u7EC6\u521B\u5EFA\u5267\u672C\uFF084\u6B65\u5411\u5BFC\uFF09",
        "\u6240\u6709AI\u751F\u6210\u529F\u80FD9\u6298\u4F18\u60E0",
        "\u6BCF\u6708\u8D60\u9001100\u79EF\u5206",
        "\u4F18\u5148\u5BA2\u670D\u652F\u6301"
      ]
    },
    {
      id: "quarterly",
      name: "\u5B63\u5361",
      duration: 90,
      price: 79,
      tier: 79,
      tag: "\u63A8\u8350",
      credits: 350,
      discount_label: "85\u6298",
      features: [
        "\u6708\u5361\u5168\u90E8\u6743\u76CA",
        "\u6240\u6709AI\u751F\u6210\u529F\u80FD85\u6298\u4F18\u60E0",
        "\u4E13\u5C5E\u4F1A\u5458\u6807\u8BC6",
        "\u6BCF\u6708\u8D60\u9001350\u79EF\u5206"
      ]
    },
    {
      id: "yearly",
      name: "\u5E74\u5361",
      duration: 365,
      price: 268,
      tier: 268,
      tag: "\u8D85\u503C",
      credits: 1500,
      discount_label: "8\u6298",
      features: [
        "\u5B63\u5361\u5168\u90E8\u6743\u76CA",
        "\u6240\u6709AI\u751F\u6210\u529F\u80FD8\u6298\u4F18\u60E0",
        "\u6BCF\u6708\u8D60\u90011500\u79EF\u5206",
        "\u65B0\u529F\u80FD\u4F18\u5148\u4F53\u9A8C",
        "\u4E13\u5C5E\u5BA2\u6237\u7ECF\u7406"
      ]
    }
  ];
  function MembershipModal({ isOpen, onClose, onSubscribeSuccess }) {
    const [selectedPlan, setSelectedPlan] = (0, import_react15.useState)("monthly");
    const [loading, setLoading] = (0, import_react15.useState)(false);
    const [plans, setPlans] = (0, import_react15.useState)([]);
    (0, import_react15.useEffect)(() => {
      const loadPlans = () => {
        if (window.APP_PRICING) {
          const pkgPlans = getMembershipPackages();
          const mappedPlans = pkgPlans.map((pkg, idx) => ({
            id: idx === 0 ? "monthly" : idx === 1 ? "quarterly" : "yearly",
            name: pkg.name,
            duration: pkg.duration_days || (idx === 0 ? 30 : idx === 1 ? 90 : 365),
            price: pkg.price,
            tier: pkg.price,
            tag: idx === 0 ? "\u70ED\u95E8" : idx === 1 ? "\u63A8\u8350" : "\u8D85\u503C",
            credits: pkg.credits,
            discount_label: pkg.discount_label,
            features: pkg.benefits ? pkg.benefits.split("\u3001") : DEFAULT_PLANS[idx].features
          }));
          setPlans(mappedPlans);
        }
      };
      loadPlans();
      const interval = setInterval(loadPlans, 500);
      return () => clearInterval(interval);
    }, [isOpen]);
    if (!isOpen) return null;
    const handleSubscribe = async (plan) => {
      if (!isLoggedIn()) {
        alert("\u8BF7\u5148\u767B\u5F55\u540E\u518D\u5F00\u901A\u4F1A\u5458");
        return;
      }
      alert(`\u652F\u4ED8\u529F\u80FD\u5F00\u53D1\u4E2D\uFF0C\u4F1A\u5458\u5F00\u901A\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458\u3002

\u60A8\u9009\u62E9\u7684\u5957\u9910\uFF1A${plan.name}
\u4EF7\u683C\uFF1A${plan.price}\u5143

\u7BA1\u7406\u5458\u53EF\u5728\u8C03\u5EA6\u673A\u7BA1\u7406\u540E\u53F0\u624B\u52A8\u4E3A\u60A8\u5F00\u901A\u4F1A\u5458\u3002`);
    };
    const displayPlans = plans.length > 0 ? plans : DEFAULT_PLANS;
    return /* @__PURE__ */ import_react15.default.createElement(
      "div",
      {
        style: {
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.8)",
          backdropFilter: "blur(8px)",
          zIndex: 99999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20
        },
        onClick: () => !loading && onClose()
      },
      /* @__PURE__ */ import_react15.default.createElement(
        "div",
        {
          style: {
            width: "100%",
            maxWidth: 900,
            maxHeight: "90vh",
            overflow: "auto",
            background: "linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            borderRadius: 20,
            padding: 32,
            boxShadow: "0 20px 80px rgba(245, 158, 11, 0.2)"
          },
          onClick: (e) => e.stopPropagation()
        },
        /* @__PURE__ */ import_react15.default.createElement("div", { style: { textAlign: "center", marginBottom: 32 } }, /* @__PURE__ */ import_react15.default.createElement("div", { style: { fontSize: 48, marginBottom: 12 } }, "\u{1F48E}"), /* @__PURE__ */ import_react15.default.createElement("h2", { style: { margin: "0 0 8px", fontSize: 28, color: "#fff", background: "linear-gradient(135deg, #f59e0b, #fbbf24)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } }, "\u70EC\u5E8F\xB7\u5F71\u589F VIP \u4F1A\u5458"), /* @__PURE__ */ import_react15.default.createElement("p", { style: { margin: 0, fontSize: 14, color: "#999" } }, "\u89E3\u9501\u5168\u90E8\u9AD8\u7EA7\u529F\u80FD\uFF0C\u4EAB\u53D7\u66F4\u4F18\u60E0\u7684\u79EF\u5206\u4EF7\u683C")),
        /* @__PURE__ */ import_react15.default.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 } }, displayPlans.map((plan) => /* @__PURE__ */ import_react15.default.createElement(
          "div",
          {
            key: plan.id,
            onClick: () => setSelectedPlan(plan.id),
            style: {
              position: "relative",
              padding: 20,
              borderRadius: 12,
              border: selectedPlan === plan.id ? "2px solid #f59e0b" : "1px solid rgba(255,255,255,0.1)",
              background: selectedPlan === plan.id ? "rgba(245, 158, 11, 0.1)" : "rgba(255,255,255,0.03)",
              cursor: "pointer",
              transition: "all 0.2s"
            }
          },
          plan.tag && /* @__PURE__ */ import_react15.default.createElement("div", { style: {
            position: "absolute",
            top: -10,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "2px 12px",
            background: "linear-gradient(135deg, #f59e0b, #d97706)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 10
          } }, plan.tag),
          /* @__PURE__ */ import_react15.default.createElement("div", { style: { fontSize: 18, fontWeight: 600, color: "#fff", marginBottom: 8, textAlign: "center" } }, plan.name),
          /* @__PURE__ */ import_react15.default.createElement("div", { style: { textAlign: "center", marginBottom: 16 } }, /* @__PURE__ */ import_react15.default.createElement("span", { style: { fontSize: 14, color: "#999" } }, "\xA5"), /* @__PURE__ */ import_react15.default.createElement("span", { style: { fontSize: 36, fontWeight: 700, color: "#f59e0b" } }, plan.price)),
          /* @__PURE__ */ import_react15.default.createElement("div", { style: { fontSize: 11, color: "#666", textAlign: "center", marginBottom: 12 } }, "\u7EA6 ", plan.duration, " \u5929"),
          /* @__PURE__ */ import_react15.default.createElement("div", { style: { borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 12 } }, plan.features?.map((feature, idx) => /* @__PURE__ */ import_react15.default.createElement("div", { key: idx, style: { fontSize: 12, color: "#ccc", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 } }, /* @__PURE__ */ import_react15.default.createElement("span", { style: { color: "#10b981" } }, "\u2713"), /* @__PURE__ */ import_react15.default.createElement("span", null, feature))))
        ))),
        /* @__PURE__ */ import_react15.default.createElement("div", { style: { background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 16, marginBottom: 24 } }, /* @__PURE__ */ import_react15.default.createElement("div", { style: { fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 8 } }, "\u{1F381} \u4F1A\u5458\u4E13\u5C5E\u6743\u76CA"), /* @__PURE__ */ import_react15.default.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 } }, /* @__PURE__ */ import_react15.default.createElement("div", { style: { fontSize: 12, color: "#999" } }, "\u2713 3D\u5BFC\u6F14\u53F0\u5168\u90E8\u529F\u80FD\uFF08\u573A\u666F/\u4EBA\u7269/\u673A\u4F4D\uFF09"), /* @__PURE__ */ import_react15.default.createElement("div", { style: { fontSize: 12, color: "#999" } }, "\u2713 \u8BE6\u7EC6\u521B\u5EFA\u5267\u672C\uFF084\u6B65\u5B8C\u6574\u5411\u5BFC\uFF09"), /* @__PURE__ */ import_react15.default.createElement("div", { style: { fontSize: 12, color: "#999" } }, "\u2713 AI\u751F\u6210\u529F\u80FD\u6298\u6263\uFF08\u6700\u9AD87\u6298\uFF09"), /* @__PURE__ */ import_react15.default.createElement("div", { style: { fontSize: 12, color: "#999" } }, "\u2713 \u9AD8\u6E05\u89C6\u9891\u5BFC\u51FA\uFF081080P\uFF09"), /* @__PURE__ */ import_react15.default.createElement("div", { style: { fontSize: 12, color: "#999" } }, "\u2713 \u6BCF\u6708\u8D60\u9001\u79EF\u5206"), /* @__PURE__ */ import_react15.default.createElement("div", { style: { fontSize: 12, color: "#999" } }, "\u2713 \u4F18\u5148\u5BA2\u670D\u652F\u6301"))),
        /* @__PURE__ */ import_react15.default.createElement("div", { style: { display: "flex", gap: 12, justifyContent: "center" } }, /* @__PURE__ */ import_react15.default.createElement(
          "button",
          {
            onClick: () => onClose(),
            style: {
              padding: "12px 32px",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 8,
              background: "transparent",
              color: "#999",
              cursor: "pointer",
              fontSize: 14
            }
          },
          "\u7A0D\u540E\u518D\u8BF4"
        ), /* @__PURE__ */ import_react15.default.createElement(
          "button",
          {
            onClick: () => {
              const plan = displayPlans.find((p) => p.id === selectedPlan);
              if (plan) handleSubscribe(plan);
            },
            disabled: loading,
            style: {
              padding: "12px 40px",
              border: "none",
              borderRadius: 8,
              background: loading ? "#555" : "linear-gradient(135deg, #f59e0b, #d97706)",
              color: "#fff",
              cursor: loading ? "wait" : "pointer",
              fontSize: 15,
              fontWeight: 600
            }
          },
          loading ? "\u5904\u7406\u4E2D..." : `\u7ACB\u5373\u5F00\u901A \xB7 \xA5${displayPlans.find((p) => p.id === selectedPlan)?.price || 29}`
        )),
        /* @__PURE__ */ import_react15.default.createElement("div", { style: { textAlign: "center", marginTop: 20, fontSize: 11, color: "#666" } }, "\u652F\u4ED8\u529F\u80FD\u5F00\u53D1\u4E2D\uFF0C\u656C\u8BF7\u671F\u5F85\u3002\u4F1A\u5458\u5F00\u901A\u540E\u7ACB\u5373\u751F\u6548\uFF0C\u53EF\u5728\u8BBE\u7F6E\u4E2D\u67E5\u770B\u4F1A\u5458\u72B6\u6001\u3002")
      )
    );
  }

  // src/components/CustomSettingsDialog.jsx
  var import_react16 = __toESM(__require("react"), 1);
  var DEFAULT_SETTINGS = {
    autoSave: true,
    autoSaveInterval: 30,
    // 秒
    defaultResolution: "768p\u7AD6",
    defaultDuration: 5,
    // 秒
    defaultVideoMode: "I2V",
    generateQuality: "standard",
    // standard/high
    showGenerateLog: true,
    autoAddToAssets: true,
    notificationSound: true,
    language: "zh-CN"
  };
  function CustomSettingsDialog({ open, onClose, theme, onThemeChange, appName }) {
    const [activeTab, setActiveTab] = (0, import_react16.useState)("general");
    const [settings, setSettings] = (0, import_react16.useState)(() => {
      try {
        const saved = localStorage.getItem("APP_SETTINGS");
        return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
      } catch {
        return DEFAULT_SETTINGS;
      }
    });
    if (!open) return null;
    const updateSetting = (key, value) => {
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);
      try {
        localStorage.setItem("APP_SETTINGS", JSON.stringify(newSettings));
      } catch {
      }
    };
    const tabs = [
      { id: "general", label: "\u5E38\u7528\u8BBE\u7F6E", icon: "\u2699\uFE0F" },
      { id: "about", label: "\u5173\u4E8E\u6211\u4EEC", icon: "\u2139\uFE0F" }
    ];
    return /* @__PURE__ */ import_react16.default.createElement(
      "div",
      {
        style: {
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(8px)",
          zIndex: 99999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20
        },
        onClick: () => onClose()
      },
      /* @__PURE__ */ import_react16.default.createElement(
        "div",
        {
          style: {
            width: "100%",
            maxWidth: 720,
            maxHeight: "85vh",
            overflow: "hidden",
            background: "var(--panel, #1a1a2e)",
            border: "1px solid var(--border, rgba(255,255,255,0.1))",
            borderRadius: 16,
            boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            display: "flex",
            flexDirection: "column"
          },
          onClick: (e) => e.stopPropagation()
        },
        /* @__PURE__ */ import_react16.default.createElement("div", { style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 24px",
          borderBottom: "1px solid var(--border, rgba(255,255,255,0.1))"
        } }, /* @__PURE__ */ import_react16.default.createElement("h2", { style: { margin: 0, fontSize: 18, color: "var(--text, #fff)" } }, "\u2699\uFE0F ", appName || "\u8BBE\u7F6E"), /* @__PURE__ */ import_react16.default.createElement(
          "button",
          {
            onClick: () => onClose(),
            style: {
              background: "transparent",
              border: "none",
              color: "var(--text-muted, #888)",
              fontSize: 20,
              cursor: "pointer",
              padding: "4px 8px"
            }
          },
          "\u2715"
        )),
        /* @__PURE__ */ import_react16.default.createElement("div", { style: {
          display: "flex",
          gap: 4,
          padding: "12px 24px",
          borderBottom: "1px solid var(--border, rgba(255,255,255,0.1))"
        } }, tabs.map((tab) => /* @__PURE__ */ import_react16.default.createElement(
          "button",
          {
            key: tab.id,
            onClick: () => setActiveTab(tab.id),
            style: {
              padding: "8px 16px",
              border: "none",
              borderRadius: 8,
              background: activeTab === tab.id ? "var(--accent, #7c3aed)" : "transparent",
              color: activeTab === tab.id ? "#fff" : "var(--text-muted, #888)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 600 : 400,
              transition: "all 0.2s"
            }
          },
          tab.icon,
          " ",
          tab.label
        ))),
        /* @__PURE__ */ import_react16.default.createElement("div", { style: { flex: 1, overflow: "auto", padding: 24 } }, activeTab === "general" && /* @__PURE__ */ import_react16.default.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 16 } }, /* @__PURE__ */ import_react16.default.createElement(
          SettingToggle,
          {
            label: "\u81EA\u52A8\u4FDD\u5B58",
            desc: "\u7F16\u8F91\u65F6\u81EA\u52A8\u4FDD\u5B58\u9879\u76EE\u5230\u672C\u5730",
            checked: settings.autoSave,
            onChange: (v) => updateSetting("autoSave", v)
          }
        ), settings.autoSave && /* @__PURE__ */ import_react16.default.createElement(
          SettingSelect,
          {
            label: "\u81EA\u52A8\u4FDD\u5B58\u95F4\u9694",
            desc: "\u81EA\u52A8\u4FDD\u5B58\u7684\u65F6\u95F4\u95F4\u9694\uFF08\u79D2\uFF09",
            value: settings.autoSaveInterval,
            options: [
              { value: 15, label: "15\u79D2" },
              { value: 30, label: "30\u79D2" },
              { value: 60, label: "1\u5206\u949F" },
              { value: 120, label: "2\u5206\u949F" }
            ],
            onChange: (v) => updateSetting("autoSaveInterval", Number(v))
          }
        ), /* @__PURE__ */ import_react16.default.createElement(
          SettingSelect,
          {
            label: "\u9ED8\u8BA4\u89C6\u9891\u5206\u8FA8\u7387",
            desc: "\u65B0\u751F\u6210\u89C6\u9891\u65F6\u7684\u9ED8\u8BA4\u5206\u8FA8\u7387",
            value: settings.defaultResolution,
            options: [
              { value: "480p\u7AD6", label: "480p \u7AD6\u5C4F" },
              { value: "768p\u7AD6", label: "768p \u7AD6\u5C4F" },
              { value: "1080p\u7AD6", label: "1080p \u7AD6\u5C4F" },
              { value: "480p\u6A2A", label: "480p \u6A2A\u5C4F" },
              { value: "768p\u6A2A", label: "768p \u6A2A\u5C4F" },
              { value: "1080p\u6A2A", label: "1080p \u6A2A\u5C4F" }
            ],
            onChange: (v) => updateSetting("defaultResolution", v)
          }
        ), /* @__PURE__ */ import_react16.default.createElement(
          SettingSelect,
          {
            label: "\u9ED8\u8BA4\u89C6\u9891\u65F6\u957F",
            desc: "\u65B0\u751F\u6210\u89C6\u9891\u65F6\u7684\u9ED8\u8BA4\u65F6\u957F\uFF08\u79D2\uFF09",
            value: settings.defaultDuration,
            options: [
              { value: 3, label: "3\u79D2" },
              { value: 5, label: "5\u79D2" },
              { value: 8, label: "8\u79D2" },
              { value: 10, label: "10\u79D2" }
            ],
            onChange: (v) => updateSetting("defaultDuration", Number(v))
          }
        ), /* @__PURE__ */ import_react16.default.createElement(
          SettingSelect,
          {
            label: "\u9ED8\u8BA4\u89C6\u9891\u6A21\u5F0F",
            desc: "\u65B0\u751F\u6210\u89C6\u9891\u65F6\u7684\u9ED8\u8BA4\u6A21\u5F0F",
            value: settings.defaultVideoMode,
            options: [
              { value: "T2V", label: "T2V \u7EAF\u6587\u672C" },
              { value: "I2V", label: "I2V \u56FE\u751F\u89C6\u9891" },
              { value: "R2V", label: "R2V \u9996\u5C3E\u5E27" },
              { value: "IA2V", label: "IA2V \u5168\u80FD\u53C2\u8003" }
            ],
            onChange: (v) => updateSetting("defaultVideoMode", v)
          }
        ), /* @__PURE__ */ import_react16.default.createElement(
          SettingToggle,
          {
            label: "\u663E\u793A\u751F\u6210\u65E5\u5FD7",
            desc: "\u751F\u6210\u89C6\u9891\u65F6\u663E\u793A\u8BE6\u7EC6\u65E5\u5FD7\u4FE1\u606F",
            checked: settings.showGenerateLog,
            onChange: (v) => updateSetting("showGenerateLog", v)
          }
        ), /* @__PURE__ */ import_react16.default.createElement(
          SettingToggle,
          {
            label: "\u81EA\u52A8\u5B58\u5165\u7D20\u6750\u5E93",
            desc: "\u751F\u6210\u7684\u5185\u5BB9\u81EA\u52A8\u5B58\u5165\u7D20\u6750\u5E93",
            checked: settings.autoAddToAssets,
            onChange: (v) => updateSetting("autoAddToAssets", v)
          }
        ), /* @__PURE__ */ import_react16.default.createElement(
          SettingToggle,
          {
            label: "\u901A\u77E5\u63D0\u793A\u97F3",
            desc: "\u751F\u6210\u5B8C\u6210\u65F6\u64AD\u653E\u63D0\u793A\u97F3",
            checked: settings.notificationSound,
            onChange: (v) => updateSetting("notificationSound", v)
          }
        ), /* @__PURE__ */ import_react16.default.createElement(
          SettingSelect,
          {
            label: "\u8BED\u8A00",
            desc: "\u754C\u9762\u663E\u793A\u8BED\u8A00",
            value: settings.language,
            options: [
              { value: "zh-CN", label: "\u7B80\u4F53\u4E2D\u6587" },
              { value: "en-US", label: "English" }
            ],
            onChange: (v) => updateSetting("language", v)
          }
        )), activeTab === "about" && /* @__PURE__ */ import_react16.default.createElement("div", { style: { textAlign: "center", padding: 20 } }, /* @__PURE__ */ import_react16.default.createElement("div", { style: { fontSize: 48, marginBottom: 12 } }, "\u{1F3AC}"), /* @__PURE__ */ import_react16.default.createElement("h3", { style: { margin: "0 0 8px", fontSize: 20, color: "var(--text, #fff)" } }, "\u70EC\u5E8F\xB7\u5F71\u589F"), /* @__PURE__ */ import_react16.default.createElement("div", { style: { fontSize: 12, color: "var(--accent-2, #5CE1E6)", marginBottom: 16 } }, "\u7248\u672C v0.3.0 \xB7 AI\u77ED\u5267\u5168\u6D41\u7A0B\u751F\u6210\u5E73\u53F0"), /* @__PURE__ */ import_react16.default.createElement("p", { style: { fontSize: 13, color: "var(--text-secondary, #8b95a7)", lineHeight: 1.8, maxWidth: 500, margin: "0 auto 20px" } }, "\u70EC\u5E8F\xB7\u5F71\u589F\u662F\u4E00\u6B3E\u9762\u5411\u7AD6\u5C4F\u77ED\u5267\u521B\u4F5C\u7684AI\u5168\u6D41\u7A0B\u684C\u9762\u5DE5\u5177\uFF0C \u5E2E\u52A9\u521B\u4F5C\u8005\u4ECE\u5267\u672C\u4E0A\u4F20\u6216AI\u751F\u6210\u51FA\u53D1\uFF0C\u81EA\u52A8\u5B8C\u6210\u5206\u96C6\u5267\u672C\u3001\u5206\u955C\u62C6\u5206\u3001 \u5206\u955C\u751F\u56FE\u3001\u89D2\u8272\u7BA1\u7406\u3001AI\u914D\u97F3\u3001\u89C6\u9891\u751F\u6210\u30013D\u5BFC\u6F14\u53F0\u3001\u7D20\u6750\u5E93\u7BA1\u7406\u3001 \u526A\u8F91\u6210\u7247\u5230\u5BFC\u51FA\u7684\u5B8C\u6574\u5DE5\u4F5C\u6D41\u3002"), /* @__PURE__ */ import_react16.default.createElement("div", { style: {
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 8,
          maxWidth: 400,
          margin: "0 auto",
          textAlign: "left"
        } }, /* @__PURE__ */ import_react16.default.createElement("div", { style: { fontSize: 12, color: "var(--text-muted, #888)" } }, "\u54C1\u724C\uFF1A\u70EC\u5E8F JINSU"), /* @__PURE__ */ import_react16.default.createElement("div", { style: { fontSize: 12, color: "var(--text-muted, #888)" } }, "\u5B98\u7F51\uFF1Ajinsuai.cn"), /* @__PURE__ */ import_react16.default.createElement("div", { style: { fontSize: 12, color: "var(--text-muted, #888)" } }, "\u6280\u672F\u6808\uFF1ATauri + React"), /* @__PURE__ */ import_react16.default.createElement("div", { style: { fontSize: 12, color: "var(--text-muted, #888)" } }, "\u66F4\u65B0\u65E5\u671F\uFF1A2026-08-24")))),
        /* @__PURE__ */ import_react16.default.createElement("div", { style: {
          display: "flex",
          justifyContent: "flex-end",
          padding: "12px 24px",
          borderTop: "1px solid var(--border, rgba(255,255,255,0.1))"
        } }, /* @__PURE__ */ import_react16.default.createElement(
          "button",
          {
            onClick: () => onClose(),
            style: {
              padding: "8px 24px",
              border: "none",
              borderRadius: 8,
              background: "var(--accent, #7c3aed)",
              color: "#fff",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600
            }
          },
          "\u5B8C\u6210"
        ))
      )
    );
  }
  function SettingToggle({ label: label2, desc, checked, onChange }) {
    return /* @__PURE__ */ import_react16.default.createElement("div", { style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 16px",
      background: "var(--panel-2, #15152a)",
      borderRadius: 8
    } }, /* @__PURE__ */ import_react16.default.createElement("div", null, /* @__PURE__ */ import_react16.default.createElement("div", { style: { fontSize: 13, color: "var(--text, #fff)", fontWeight: 500 } }, label2), desc && /* @__PURE__ */ import_react16.default.createElement("div", { style: { fontSize: 11, color: "var(--text-muted, #888)", marginTop: 2 } }, desc)), /* @__PURE__ */ import_react16.default.createElement(
      "button",
      {
        onClick: () => onChange(!checked),
        style: {
          width: 44,
          height: 24,
          borderRadius: 12,
          border: "none",
          background: checked ? "var(--accent, #7c3aed)" : "var(--border, #333)",
          cursor: "pointer",
          position: "relative",
          transition: "all 0.2s"
        }
      },
      /* @__PURE__ */ import_react16.default.createElement("div", { style: {
        position: "absolute",
        top: 2,
        left: checked ? 22 : 2,
        width: 20,
        height: 20,
        borderRadius: "50%",
        background: "#fff",
        transition: "all 0.2s"
      } })
    ));
  }
  function SettingSelect({ label: label2, desc, value, options, onChange }) {
    return /* @__PURE__ */ import_react16.default.createElement("div", { style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 16px",
      background: "var(--panel-2, #15152a)",
      borderRadius: 8
    } }, /* @__PURE__ */ import_react16.default.createElement("div", { style: { flex: 1, marginRight: 16 } }, /* @__PURE__ */ import_react16.default.createElement("div", { style: { fontSize: 13, color: "var(--text, #fff)", fontWeight: 500 } }, label2), desc && /* @__PURE__ */ import_react16.default.createElement("div", { style: { fontSize: 11, color: "var(--text-muted, #888)", marginTop: 2 } }, desc)), /* @__PURE__ */ import_react16.default.createElement(
      "select",
      {
        value,
        onChange: (e) => onChange(e.target.value),
        style: {
          padding: "6px 12px",
          border: "1px solid var(--border, rgba(255,255,255,0.1))",
          borderRadius: 6,
          background: "var(--input-bg, #0f141e)",
          color: "var(--text, #fff)",
          fontSize: 12,
          cursor: "pointer",
          minWidth: 120
        }
      },
      options.map((opt) => /* @__PURE__ */ import_react16.default.createElement("option", { key: opt.value, value: opt.value }, opt.label))
    ));
  }

  // src/assets/jinsu-logo.png
  var jinsu_logo_default = "data:image/png;base64,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";

  // src/assets/jinsu-logo-h.png
  var jinsu_logo_h_default = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABQAAAAGQCAYAAADxzc2nAADBgklEQVR4nO2dB5xcVfXHf29mtvea3U2ymwQSWui9pNA7gqBUKSqCSAARUQFBEFBURIr1b0XBBoIIojRpAWnSe8tuku29zO70/+e+2d1skt3ZmXnvzdxz3vn+zZ/Nzrw359xz38ybb24xQIS5i46NZTsGHTFseIZgE2n0UOvVkfpmE+db34X1zeA7ffZbN/sRUEb/1stihATumPSvH/8MrMA/e4PEdZQu/OvHuwVIRZ+V60jvFtI7OgoYWr76e2vvJFFaLYMU2ZccIv80QuSf6xD55wAi/wRtrj+riPzTtHVsgn4GVuCfvcg/3tDuwaSiF/lHu35aoqf8AyEpqEVAIvxSR+SfRoj8cx0i/xxA5J+gzfVnFZF/mraOTdDPwAr8sxf5xxvaPZhU9CL/aNdPS2jJP12FYFYDEPGXHiL/NELkn+sQ+ecAIv8Eba4/q4j807R1bIJ+Blbgn73IP97Q7sGkohf5R7t+WkJf/ukiAjP+wiL9rCHyTyNE/rkOkX8OIPJP0Ob6s4rIP01bxyboZ2AF/tmL/OMN7R5MKnqRf7TrpyW85F+2ZWDGXkzEn3VE/mmEyD/XIfLPAUT+Cdpcf1YR+adp69gE/QyswD97kX+8od2DSUUv8o92/bSEt/zLhgh0/EVE/NmDyD+NEPnnOkT+OYDIP0Gb688qIv80bR2boJ+BFfhnL/KPN7R7MKnoRf7Rrp+WuEf+TRID3lvnrAj0OHlykX/2IPJPI0T+uQ6Rfw4g8k/Q5vqzisg/TVvHJuhnYAX+2Yv84w3tHkwqepF/tOunJe6Uf4ol806JkctNxJ99iPzTCJF/rkPknwOI/BO0uf6sIvJP09axCfoZWIF/9iL/eEO7B5OKXuQf7fppiXvl36Y4MRrQ9hGAIv/sQ+SfRoj8cx0i/xxA5J+gzfVnFZF/mraOTdDPwAr8sxf5xxvaPZhU9CL/aNdPS0T+TcWJ0YC2CkCRf/Yh8k8jRP65DpF/DiDyT9Dm+rOKyD9NW8cm6GdgBf7Zi/zjDe0eTCp6kX+066clIv8yIQFtaWURf/Yi8k8jRP65DpF/DiDyT9Dm+rOKyD9NW8cm6GdgBf7Zi/zjDe0eTCp6kX+066clIv+SwY4pwZZHAIr8sxeRfxoh8s91iPxzAJF/gjbXn1VE/mnaOjZBPwMr8M9e5B9vaPdgUtGL/KNdPy0R+ZcsdowGtCQARf7Zi8g/jRD55zpE/jmAyD9Bm+vPKiL/NG0dm6CfgRX4Zy/yjze0ezCp6EX+0a6floj8y7QETFsAivyzF5F/GiHyz3WI/HMAkX+CNtefVUT+ado6NkE/Ayvwz17kH29o92BS0Yv8o10/LRH5lw0JmJYAFPlnLyL/NELkn+sQ+ecAIv8Eba4/q4j807R1bIJ+Blbgn73IP97Q7sGkohf5R7t+WiLyL1sSMGUBKPLPXkT+aYTIP9ch8s8BRP4J2lx/VhH5p2nr2AT9DKzAP3uRf7yh3YNJRS/yj3b9tETkXzYlYEoCUOSfvYj80wiRf65D5J8DiPwTtLn+rCLyT9PWsQn6GViBf/Yi/3hDuweTil7kH+36aYnIv2xLQMu7AAvpIfJPI0T+uQ6Rfw4g8k/Q5vqzisg/TVvHJuhnYAX+2Yv84w3tHkwqepF/tOunJSL/dCBpASij/+xD5J9GiPxzHSL/HEDkn6DN9WcVkX+ato5N0M/ACvyzF/nHG9o9mFT0Iv9o109LRP7pMgowKQEo8s8+RP5phMg/1yHyzwFE/gnaXH9WEfmnaevYBP0MrMA/e5F/vKHdg0lFL/KPdv20ROSfThJwVgEo8s8+RP5phMg/1yHyzwFE/gnaXH9WEfmnaevYBP0MrMA/e5F/vKHdg0lFL/KPdv20ROSfbhJQ1gDMECL/NELkn+sQ+ecAIv8Eba4/q4j807R1bIJ+Blbgn73IP97Q7sGkohf5R7t+WiLyT0cSCkAZ/WcPIv80QuSf6xD55wAi/wRtrj+riPzTtHVsgn4GVuCfvcg/3tDuwaSiF/lHu35aIvJP11GAMwpAkX/2IPJPI0T+uQ6Rfw4g8k/Q5vqzisg/TVvHJuhnYAX+2Yv84w3tHkwqepF/tOunJSL/dJaAMgXYQUT+aYTIP9ch8s8BRP4J2lx/VhH5p2nr2AT9DKzAP3uRf7yh3YNJRS/yj3b9tETkn+5MKwBl9J91RP5phMg/1yHyzwFE/gnaXH9WEfmnaevYBP0MrMA/e5F/vKHdg0lFL/KPdv20ROQfhVGAMgLQAUT+aYTIP9ch8s8BRP4J2lx/VhH5p2nr2AT9DKzAP3uRf7yh3YNJRS/yj3b9tETkHxU2E4Ay+s8aIv80QuSf6xD55wAi/wRtrj+riPzTtHVsgn4GVuCfvcg/3tDuwaSiF/lHu35aIvKP0ihAGQFoIyL/NELkn+sQ+ecAIv8Eba4/q4j807R1bIJ+Blbgn73IP97Q7sGkohf5R7t+WiLyjxoiAG1C5J9GiPxzHSL/HEDkn6DN9WcVkX+ato5N0M/ACvyzF/nHG9o9mFT0Iv9o109LRP6RF4Ay/Tc9RP5phMg/1yHyzwFE/gnaXH9WEfmnaevYBP0MrMA/e5F/vKHdg0lFL/KPdv20ROQfFTadBiwjAC0i8k8jRP65DpF/DiDyT9Dm+rOKyD9NW8cm6GdgBf7Zi/zjDe0eTCp6kX+066clIv8oMykAZfRf6oj80wiRf65D5J8DiPwTtLn+rCLyT9PWsQn6GViBf/Yi/3hDuweTil7kH+36aYnIP+qjAGUEYJqI/NMIkX+uQ+SfA4j8E7S5/qwi8k/T1rEJ+hlYgX/2Iv94Q7sHk4pe5B/t+mmJyD8OiABMA5F/GiHyz3WI/HMAkX+CNtefVUT+ado6NkE/Ayvwz17kH29o92BS0Yv8o10/LRH5xwURgCki8k8jRP65DpF/DiDyT9Dm+rOKyD9NW8cm6GdgBf7Zi/zjDe0eTCp6kX+066clIv/YCUBZ/y85RP5phMg/1yHyzwFE/gnaXH9WEfmnaevYBP0MrMA/e5F/vKHdg0lFL/KPdv20ROQfFybWAZQRgEki8k8jRP65DpF/DiDyT9Dm+rOKyD9NW8cm6GdgBf7Zi/zjDe0eTCp6kX+066clIv84IgIwCUT+aYTIP9ch8s8BRP4J2lx/VhH5p2nr2AT9DKzAP3uRf7yh3YNJRS/yj3b9tETkH1dEAM6CyD+NEPnnOkT+OYDIP0Gb688qIv80bR2boJ+BFfhnL/KPN7R7MKnoRf7Rrp+WiPzjjAjABIj80wiRf65D5J8DiPwTtLn+rCLyT9PWsQn6GViBf/Yi/3hDuweTil7kH+36aYnIP+4YsgHIDA0ze9PZXgxhBkT+uQ6Rfw4g8k/Q5vqzisg/TVvHJuhnYAX+2Yv84w3tHkwqepF/tOunJSL/3FBfGQE4Y9PM3nhCBhD55zpE/jmAyD9Bm+vPKiL/NG0dm6CfgRX4Zy/yjze0ezCp6EX+0a6floj8c0t9RQDO2DSzN57gMCL/XIfIPwcQ+Sdoc/1ZReSfpq1jE/QzsAL/7EX+8YZ2DyYVvcg/2vXTEpF/bqqvCMAZm2b2xhMcROSf6xD55wAi/wRtrj+riPzTtHVsgn4GVuCfvcg/3tDuwaSiF/lHu35aIvLPbfUVAThj08zeeIJDiPxzHSL/HEDkn6DN9WcVkX+ato5N0M/ACvyzF/nHG9o9mFT0Iv9o109LRP65sb4iAEX+6YXIP9ch8s8BRP4J2lx/VhH5p2nr2AT9DKzAP3uRf7yh3YNJRS/yj3b9tETkn1vr63oBKCP/NELkn+sQ+ecAIv8Eba4/q4j807R1bIJ+Blbgn73IP97Q7sGkohf5R7t+WiLyz831dbUAFPmnESL/XIfIPwcQ+Sdoc/1ZReSfpq1jE/QzsAL/7EX+8YZ2DyYVvcg/2vXTEpF/bq+vawWgyD+NEPnnOkT+OYDIP0Gb688qIv80bR2boJ+BFfhnL/KPN7R7MKnoRf7Rrp+WiPzjTXL1daUAFPmnESL/XIfIPwcQ+Sdoc/1ZReSfpq1jE/QzsAL/7EX+8YZ2DyYVvcg/2vXTEpF/vDGSfqbrBKDIP40Q+ec6RP45gMg/QZvrzyoi/zRtHZugn4EV+Gcv8o83tHswqehF/tGun5aI/OONkdKzXSUARf5phMg/1yHyzwFE/gnaXH9WEfmnaevYBP0MrMA/e5F/vKHdg0lFL/KPdv20ROQfb4yUj3CNABT5pxEi/1yHyD8HEPknaHP9WUXkn6atYxP0M7AC/+xF/vGGdg8mFb3IP9r10xKRf7wx0jrKFQJQ5J9GiPxzHSL/HEDkn6DN9WcVkX+ato5N0M/ACvyzF/nHG9o9mFT0Iv9o109LRP7xxkj7SPYCUOSfRoj8cx0i/xxA5J+gzfVnFZF/mraOTdDPwAr8sxf5xxvaPZhU9CL/aNdPS0T+8cawdDRrASjyTyNE/rkOkX8OIPJP0Ob6s4rIP01bxyboZ2AF/tmL/OMN7R5MKnqRf7TrpyUi/3hjWD4DWwEo8k8jRP65DpF/DiDyT9Dm+rOKyD9NW8cm6GdgBf7Zi/zjDe0eTCp6kX+066clIv94Y9hyFpYCUOSfRoj8cx0i/xxA5J+gzfVnFZF/mraOTdDPwAr8sxf5xxvaPZhU9CL/aNdPS0T+8caw7UzsBKDIP40Q+ec6RP45gMg/QZvrzyoi/zRtHZugn4EV+Gcv8o83tHswqehF/tGun5aI/OONYevZWAlAkX8aIfLPdYj8cwCRf4I2159VRP5p2jo2QT8DK/DPXuQfb2j3YFLRi/yjXT8tEfnHG8P2M7IRgCL/NELkn+sQ+ecAIv8Eba4/q4j807R1bIJ+Blbgn73IP97Q7sGkohf5R7t+WiLyjzeGI2dlIQBF/mmEyD/XIfLPAUT+Cdpcf1YR+adp69gE/QyswD97kX+8od2DSUUv8o92/bRE5B9vDMfOTF4AivzTCJF/rkPknwOI/BO0uf6sIvJP09axCfoZWIF/9iL/eEO7B5OKXuQf7fppicg/3hiOnp20ABT5pxEi/1yHyD8HEPknaHP9WUXkn6atYxP0M7AC/+xF/vGGdg8mFb3IP9r10xKRf7wxHD87WQEo8k8jRP65DpF/DiDyT9Dm+rOKyD9NW8cm6GdgBf7Zi/zjDe0eTCp6kX+066clIv94Y2Tk7CQFoMg/jRD55zpE/jmAyD9Bm+vPKiL/NG0dm6CfgRX4Zy/yjze0ezCp6EX+0a6floj8442RsbOTE4Ai/zRC5J/rEPnnACL/BG2uP6uI/NO0dWyCfgZW4J+9yD/e0O7BpKIX+Ue7floi8o83RkbPTkoAivzTCJF/rkPknwOI/BO0uf6sIvJP09axCfoZWIF/9iL/eEO7B5OKXuQf7fppicg/3hgZPzsZASjyTyNE/rkOkX8OIPJP0Ob6s4rIP01bxyboZ2AF/tmL/OMN7R5MKnqRf7TrpyUi/3hjZOXsJASgyD+NEPnnOkT+OYDIP0Gb688qIv80bR2boJ+BFfhnL/KPN7R7MKnoRf7Rrp+WiPzjjZG1s2svAEX+aYTIP9ch8s8BRP4J2lx/VhH5p2nr2AT9DKzAP3uRf7yh3YNJRS/yj3b9tETkH2+MrJ5dawEo8k8jRP65DpF/DiDyT9Dm+rOKu+Vffn4u8frNBv0MrMA/e5F/vKHdg0lFL/KPdv20ROQfb4ysn90HTRH5pxEi/1yHyD8HEPlHlqVLFyEYDOGjD1sRjkQcfz39b57dJ//mzKnArrttjd132xq77b41liyZh912PRtDQ36C9ZsN+hlYgX/2Iv94Q7sHk4pe5B/t+mmJyD/eGFqcXUsBKPJPI0T+uQ6Rfw4g8o80p512CE468UCEwxGsXduJNWva0Nrajda2HnR29qGrqx+PP/6yS26e3SH/dtttK+y73w7YfukiLN1+kSkAN2XffbfHv/71HLH6zQb9DKzAP3uRf7yh3YNJRS/yj3b9tETkH28Mbc6unQAU+acRIv9ch8g/BxD5R55wKD7qz+fzYuHCevPPVHp6BrDrbp93wc2zO+SfYu99luKiiz6V8DnLl++4kQDUv36zQT8DK/DPXuQfb2j3YFLRi/yjXT8tEfnHG0Ors2u1BqDIP40Q+ZccRrzXGh5v/O/eDZeU4ZnSo8d/b3jHn2f+BZs/PvWYDCPyzwFE/rEgFA4nfHzd+i4X3Dy7R/4p7vv707M+Z9nyHQnVbzboZ2AF/tmL/OMN7R5MKnqRf7TrpyUi/3hjaHd2bUYAivzTCJF/m6PEXHSThlHSLhKFJz8X0bFgXO55DcQiUZRs1Yihd1sw54i90fHPZ2HEYmaz+ooLEBoYRvnOi9H/8vuYe/xKtN77JGKx+LlzKssQ7O6fsTSG12OeX71WzMa1yET+OYDIPzaEQokFYFtrjy3X3znnfAKLF8+Dfmx4h3jggWfwn//YM91Z5zX/mps78Mor72OnnRbP+Jx582rM0aBrPm4Dbdz99Y1/9iL/eEO7B5OKXuQf7fppicg/3hhanl0LASjyTyNcLv8mBJv5s8eA6eViMeRWliLYPYDSHbbA4Gsfou7IfbDlquPR+ven0fSZw9H7/Jso3XahKQoj/gCqlm6B/g/XomGL+egbDsDf3mEKRG9BHoIDw6hbuiW6PmjB3C0b0Xvl2Rjr7EQ0GEFh/Rz42zrQ99Lb8K/vwVhLO8p33Rof//IfCLT3TMYWi8b/a+L1xAXjVEGpRiaOS8VZc7a5DbPxCtoh8o/lFOCZ6O0dtOXq2HvvpVixYifozH//+6Zrdvv9+9+fTigAFcuW7UBcALrw/dlV2Yv84w3tHkwqepF/tOunJSL/eGNoe/asC0CRfxrhVvnn88ZlmZJr421Qtc/2pswb/nAdtrv686jcdTv0vfIOtth/N7S8+h5qdlyCscFRLDjzKHi8XpTvtBje/HxExsbgqy7HQEsbvPl5aGtuheHxwJPjg6+gwHw8v6ocPc2t8E08bhgwcnzIKy5GcHAABXOqUXrSEfCvb0VpUwNG+4ax3WePRtea9QgNjyHcP4S82gr0v/YB1t35MIY+WIfI8OjGOal8JkYtJpCBIv8cQOQfO0Lh2QTgUFrn3fT6CwSC0J329l5XyD/F/f94Bt/85pnwJFiaYZ99t8fvb/83aKLB528W4Z+9yD/e0O7BpKIX+Ue7floi8o83htZnz6oAFPmnEW6Tf+PTd/MbqjDW1gtPQR52+M4XER4dxWhLJ5ZccCqi4ZA5qk4JvNGuTpQt3RLtza3Iry7HYMuGER8TakDJPUU0GDQzU1N0jXH5pv47+XgoZP5djeIzHzdbwkAkEDB/Dg0Pm39ihhF/nVgMXYOD8Oblm7GUNM3DWF8PGo87EItOOBD9za2IBoJY++fHMLKmDQ3H7Iee1a+h+8lXEejsi8u/8XzjLzYek+ON7MLbA5F/LAmFQgkf7x8YsuXqCAQSv44OqF2P3SD/FN3dA3j99Q+x445bzvicPffc1hSE0U2XiNAeF74/uyp7kX+8od2DSUUv8o92/bRE5B9vDO3PnjUBKPJPI1wg/9QmHbFoXNUt+tLx5hTbogX1WHrlOfC3tZvTfYvmN2BkXRvyj66Fv73NbJapUUZGR+Pizsa19xLGPPmD0oNKHAbNtQIDfb1mzYbXxUcPqsfVaMMdv/lZUwZWNjWgas+lWHr1FxH2+9HxyH/R8eBz6Hv1fYQHRkz5p0YtTuaRwnThNKJ3DyL/XDsFeGQ4LvetXh0UBKCV6c5JoZlHe/w/LycUgOXlxdh22wV4442PQQcXvj+7KnuRf7yh3YNJRS/yj3b9tETkH28MEmfPigAU+acRTOWfWstPodbMqzt6Xwy8/B4KGmqw5GunomHnrdHd3IqypgYMre80p8qqTTWU/FOCbayrc7MoJ0bqZZvJEYNT4jFHG8ZipvxT9LVM5NEFT04O5h59AKr32wmF9bUY/LAZnQ+/hPZ/PoPh99chpkY2qdGAar1D20aw6NFWGUXkH2vCs0h//+iYLVcHhSnA/f3DrpF/iscffwUXXvSphM/Ze5+lhASgC9+fXZW9yD/e0O7BpKIX+Ue7floi8o83BpmzZ1wAivzTCI7yzzBQtuOW5g68RVvMw5bnHYeFh+1tCj+1nt5Y7xB6WtpMgTYxjXdiOu7EzxTZNO6Jv6vpxmPdXebPw2tbkVdZiQWnH4m5n1yJwrpKdL/wJj648U/off6t+IFKnCoRmPaIQJrtZwmRf+yJhKdsujMNfn98+r7VqyMyMU1fU/z+MYRnWQ+Rk/xTvPbaB+jrHUJFZUlCAfh/v/iHYzGo9/O8vBzzT35+LvLy1J8c5Jk/5+ClF99N9kxwM/yzF/nHG9o9mFT0Iv9o109LRP7xxiB19owKQJF/GsFF/qnRe+a03ChyKkrQdMbh2PaCE9Hz7hoUza2Hx+czhZ9iaMq6fW5EtVN4ZBhhcxZwDMPNrajefTsYl56K8NAwAt1DePf63yHUN2U9s6lrB87+CnAdIv9cwWwjAEOhsC1XRyK59sor72PVqpvgHPEIDz98L1x22WemfcbwppsN2Xwd7bDjFvjJTy6GbhQV5yd8fNl+O+Cp1T9O+33Z4/HA643/UX+f+Fn93ufzIicn8a3aogWfTuaV4Gb4Zy/yjze0ezCp6EX+0a6floj8441B7uwZE4Ai/zSCi/wDkFdbiUB7D+adeAAWnHUkypYsiO/AW5CHQO+G3Sqpjuxzion2GG5pQ15NOebssjXGRsOo2H1rjLV2oeUPD6HrkRfgyc9FeNBvTqlWkjXBGeE6RP65hsgso95mG7mX7NWRSACq9QHXrYuP5rWfDRH2Tf0HgE0YHU1upGO615HX48HcuTWghtfn1TxuF74/uyp7kX+8od2DSUUv8o92/bRE5B9vDJJnz4gAFPmnEUzkX/XynbHw7KNRseM2GFnfisqtFmC4rdsUWs68Il/U9Oe+8fUDVcOVbLkAe992CfrbexDo7scHN/8FXY++uOEAjxGfJjyJC1tb5J+rCM8i+CIJRgimcnUkM5LQfpKP0HYBuMl15Nj0YlfjwvdnV2Uv8o83tHswqehF/tGun5aI/OONQfbsjgtAkX8aQVT+GVN2rC3ech6azjgCTScditCwH2N9PcgtK5lcz09Io303GR0ZGhlGz8iwWbrSJYuwzZVnYdEXj8XaOx5B671PiPwT+ec6ZhsBGJ1hA51U3/1s34x7VlKLMBi0UVBOk2sgqP8uyLRw99c3/tmL/OMN7R5MKnqRf7TrpyUi/3hjED47EN8q1SFE/mkEUfnnLS4w5Z+airrNtz6HPe/8Nho/dShG1rchODAAIwZEg/rvnElNCJp/YMDf1mbuJJxXXY6db1yFYz68C7WH7D7xzA0jAt2CyD9XEkpjZJqh/beQ1CO0bYTeDGmGQzIC0D5c9L7syuxF/vGGdg8mFb3IP9r10xKRf7wxCJ/d4RGAIv80gqj8azh2Gba78gvoeuYlFDbVo2K7LTG8th1h/wgoojbeoLYWoYpXCVYVuxplmVNUjK0uOx2LLz4ZAy+/j7HOXrT8/l8Idg8msU4gcUT+uZZoiv063atcXWeZIb0Io+O7pVsiZm0K9HPPje9YzgTP+KYfHrXxh8cDY2JDEM/477ye8Z1/x3cBzss11xxMDK3PGbvhn73IP97Q7sGkohf5R7t+WiLyjzcG4bM7LABF/mkEJfk3vrZc5R7bounMwzH3sH3g7+pH2dIt4cnLm1zfTzehZ/h8iIbD8OXnIzw6ipziYoRHRpBbVo5IYAy5pWWIBAPmjsSj3d3IVY/7/ZOPe3JyEejvQ05hEUL+kfiuxuMiQBdhOBGH2kVYjQzMqyzH/OMPgr+jE02nHo6Xz/s+ep/n9cV8I0T+uZpUxNd0V2xdXSXOOutIfPe7f8ig5JuJ9N9TZprqnDQx6yMtTzrxW3ASPd5xE+PxGHEpaIrBXIIZOAf/7EX+8YZ2DyYVvcg/2vXTEpF/vDEIn91hASjyTyMoyT8AhXNr0XTG4Vhw2tGIBAIYmiL8ogEHdp9MQ/SZ/1UjNPLyEQ2FUFhThoHmVpQ3NWCwtcNMPzLmRwwGgoMDptAcCwYQjcSQV5Rn1iQ04kcsGkGgrxcxxODzBZFbUmoeB8NATnEJSiuL0d/Vj4Kacgyv64CvoNCUhUo0ejwec+OOibiyMbJQCUz1R722WoNx6fe/hNDQCDoefA4f/fhusELkn+uJJCkAp7sK1QiuW265CLvvvo0pba666ldZbE9r7xO+WUeeWbuOQrOsMei0PKXy5UeJWL8/YP6hmYEz8M9e5B9vaPdgUtGL/KNdPy0R+ccbg/DZHRaAIv80gpD8U5t8qBF/C848CoV1Neb6ftlgqkhTzad+Kmmsx2BzKyoa69G3tt384lVYV4eQf9gcrTfUGoCvsNDcRdc8Ugm5SNQcJTcp6NSoGQMIjIzFzx+Nxn9vvoaBSDiMyPAAYvCY5wgND6F7eNB8dKjZj4LKMoz2DaBwTh1y8jymcFTkV1YityTfFKWbfjHOlBBUrzO8Lh6Prygfu33lZBRu0YCW2x/E4Csf0J8WLPJPSHLk20xX3MUXn2TKP8Xppx+GQCCI66///bTPVXLfOay/J+Tm5jh6HYXD2dgFmcuXH/oZWIF/9iL/eEO7B5OKXuQf7fppicg/3hiEz+6wABT5pxGE5F/d4Xuh6cwjUbP7tuZIt0zLvwnRl1tRgUBvL/JraswRfv6ODlQ11mOoT4k4oHdNq7lljnr+aEd7/GAl8ZS8i0Tw1P6r4r/zegAlAD1ec5Sfes5GW3uqx6MxGJ64KJxgUpSNH6+CWvHYbeZ/R3sHTdE22t4B//jzq+fXo3tdG8KjBYgZBjxeHwobahALAyOtrRkdHTgpTWMxdKzvRMXOi7Hk2BV44fKfoe3B/yLcP2y2qRq1SAqRf0KSawDOdIUdc8x+OO+84zb63dlnH4OiogJceeWvzPcO20bYpRVhauTm+hy9jsLhxO3s1ABA+l9+6GdgBf7Zi/zjDe0eTCp6kX+066clIv94YxA+u8MCUOSfRugu/8aFWPlOi83pvvM+sQJj3QMbTffNBL7CIuRXlcLf0YOSuioMrO+E4fUh0NeDqPoSGouhu7nNDNcUXAbwxMrzJ9cp3Ej2qf9OMC4KYrHo9N9YJx6PbPz7SRk4KRoMPHHAqvjx468/+boAlj9+qzl6MDw2psYamucbXtuKvIJ8c61BdUxJQw3GBvzmbsmZEILm+ceFxuDgGBaceywWfOEYvP7lW9D/ygcghcg/IY0pwFPZeecl+N73zpv2sVNOORjz59fivPNuxPDwqMMjAO273tUmFE5eR7ONAHRiCjD9Lz/0M7AC/+xF/vGGdg8mFb3IP9r10xKRf7zhKf9sEYAi/zRCd/mnvkDWlKPpzCOw8PSjzb9nbGOP8RFo6gt28bw5GFrbjuF1IyisqsBga5c5ks90k1Gl1YAnD7pwg5SbIsziU3djm8i8aeSA1S+qU49XP29yuidXrjLjMtRjnnjMyx67FYHRgPmzevrguk5zFKI3JwceX465XuFwW7e5duHUL9J2C0F1vmB/n/lzSWMDdrj5ywh092H93U9g3Z0PQ3tE/rmGv9/7HRQW5mPt2k60rO3Ahx+ux3vvrcX7769Db2989K8ikuI09kWLGvDLX34toTBbtmxH3H33tTjuuMvh949NrhdoL/Ze2ylNAU7jOgrP1s42C0D6X37oZ2AF/tmL/OMN7R5MKnqRf7TrpyUi/3hjED67wwJQ5J9GEJB/jacdgqazjkTJgnkYWZu5EX9Fc+vh7+hS8/hM+TfWPxyXdh4DI929cZmmspkyTVVN0Z3uS6dO69mZ8k8RjZnTgJ9UIxSnTCdW+Sx77BZT+IVDYYTWjsYHE/p8yC+vgK/Qh6Hm1slp0LbHpwTveJ3zqsqw77Xn4LWtm9Dyuwcx8uF6PdcHFPnnGpSoXrJkPgoK8rB48bzNHr/7b0/gK1+5LWXx1NBQjT/84UpUVpYmfN7QkB833fSXSfmX1gi7hNh/VSc9BTjN6ygyyy7AyZz22OOWoaqyFCP+MfhHxjA2FkQgEBr/E0Q4HDH/RMb/G43FzH8QUWu1Zn+H5s1Zt65L09vH7MI/e5F/vKHdg0lFL/KPdv20ROQfbwzCZ3dYAIr80wjN5V/tgbui6YwjMGe/nTDc2uW4/MurqkJocBD51dVm2wTVbruh0PimGm1m6E+q6bVTMNfkmzLNz9y4Q2M2a/1pJKXK58kDL4hvSBKJYNnjt8W/5KodJLu6kJNfMHmevMoqBHq6NxrtaCfm+oDtPahetgO2PO0wvHD+jeh68hVEhkfH216D9hb55yrq5lSa8m8mmteMr/WZgv+rqSk35V99fVXC57355sf40pduRHNzx0a/TxSPOvcJJ6x0/B1+t922nvGxRPHZdR0pMeedYS3EZATdSScdiD333BZcWLTg05rePmYP/tmL/OMN7R5MKnqRf7TrpyUi/3hjED67wwJQ5J9G6Cj/xtf5K9t5CeafeCCaPnUQAv3Djq/z583PR2FtBQaa16OgvBT+ttbxWM2F/PDkgWpa7/gIk/iWvZPf7LUQUE7ULxKd7CJPqRGCatqwGhn46M2IBEbNx2obahHzeREazjPXD4yqjU2CQVvfpNRoq6g6p2Eg4A9jyaWnYIsvfwqvXnAzht9tQdYR+ec6mhbUzSrpJpic9p+AurpK3HHHVVi4sD7h8+6882FcffVvEAyqf5TYmPz83ITTir///S8hm6jp0moa8HSx23UdqWnAMwnAZHZj5o8ut4/ZgX/2Iv94Q7sHk4pe5B/t+mmJyD/eGITP7rAAFPmnETrKP4WaPhuJYccbz0fxvLmT00CdwNzUwuNByfw6DK9rx2jvkCmZxvrj/zU37pga1+SBk/+PFJbrp6a6RaKT04VVm6i1Aw21zKDa3yQYRE5JifmQuVbgxJRoG0cGjnV3mXUr26IRu/ziUvjXtOOlM66NVyMbX/BF/rmSRbOIurfeWpP0yDM17fe73/0imprmzPgcJc0uv/wXuOuux2d8TiIBqAuVlSVob+917DpKtN6ijlN0M4tOt4+Zh3/2Iv94Q7sHk4pe5B/t+mmJyD/eGITP7rAAFPmnEbrKP3OH3QJUqilYHg9GWp2Rf4UN9Qj09pkj/kZ7BjHQ3BqfSjo0hCf3j2+Qsdm8PeKjR+x785jSDtFYfGTg+Csse+JWBAcH4cnJQfn8Oqiv4qptJ7542yUC1XnUBjCG14uybbfA4q+chJ5nXkfP6jeQUUT+uZYttpg742O9fUNoa+9J+lzXX39OwvX72tt7cM45P8BrryXeDbu0tAi6o9Y23EwA2ngdRRPsuBzVbc3QjKLb7WNm4Z+9yD/e0O7BpKIX+Ue7floi8o83BuGzOywARf5phMbyr2rfHbDNN89E+ZImjLT3mCPK7CS3rAw5xYUY7e4zN/Xwd/Uj5PfDo0b7rRgXWWonTWZfFI0MvcJT+19gSsHlj9+GvubWyanSyvsp6epfr35nxEde2iAD1ZTs8OgoFp19PCr23DazAlDkn6tRU2pn4q23Nkz/TaavJJJ/L7zwNs4770Z0dw/MGlN5eXz0rc5UVJQ4eh2pjTlmQm3Y4U50vH3MHPyzF/nHG9o9mFT0Iv9o109LRP7xxiB8docFoMg/jdBU/hUtakDTmUdgwcmHIzQ8avt6f56cXBTVV5nnDY+NIRoImL9/Yt9zNn+yyL/06zs+SvKpAy4wp/+qUZVqJ2HFWGe3uYNwUUMt/O3d5hRhO4iFw/C3tqF2l22w+51Xof3+Z7D2zoed3SVY5J/rWbRo5hGAb765xpb3z7/85TFz2m8iqTWViopi7etSVVXq6HWUaD3WRNODkyGkdkMPRRBR//AQiiAUDpsDxc1dgKf8cYqSksI0RnnqevuYGfhnL/KPN7R7MKnoRf7Rrp+WiPzjjUH47A4LQJF/GqGh/PPk5WDROcei8dTDkFdejpH19k/5LW6sN8XfaN+Q+eUsGhjDEyvHp/lON9WXEZka+bcpG3ZENvDUAReaf1ejAmOIYkit6RiLIaewCOFRv22RDK7rQEFDNXa99hwULZmPdXc+hOH31sF2RP65HrWb7fz5tbNuADJxdXjVqOJUulgshu9//0789Kf3Jn2MGlFbXq6/AKyoKHX0OopYnAJ81VW/Ro7Pi5GRMfhHxhAIBBEIhMw/2VpDUNX2xJMOwDcu+0zSx6h4f/Prf8LN6HzzbA8i/3hDuweTil7kH+36aYnIP94YhM/usAAU+acRGso/RfmOi7HzRSehc207/G32yr+C2lpEgiEEewfMUMJDw/H1/SZgLP6yKf+mF4FqVOAqc3TO8iduNY8NB8ZQNLcew+taN5zRwrRg9VrqC/pQ7zDqDt4DtSt3xguf+TbG1nfZt0uzyD8BwJZbzoVn6qZA0wjAqY/6ZtiVdjrGxoK4+OJb8eCD/02prWtry+H1zvw6t9/+L7z++odTfjNz/J/+9P7Yffdtpn3skUdexL///TzS5Y03Pnb0Oko0yi+RHJzg3XdatLr5amyag+/ecC722mu7pJ6v3gP/cd9qfO+GP6K1tRtuRZf6OYfIP97Q7sGkohf5R7t+WiLyjzcG4bM7LABF/mmEpvKvYvetseiLx6Knsy8+XdSmDSJyiouRV1kCf3svIsEAjFgMzx77DYQGhs0df81RHCL/LJJ6rSYk3JMr4hJ2+eO3Ynh8xGdVUwMGuvoRGR21FpVhIDQcH+lZ1tSAhuOWo/k3DyA8ZO288QSQMbL/5p/9CHRmyZLGGR/z+wNY8/EGqa3weJIbAdjXN4TPfvY7eOWV91OOqaGhJuHjd9/9xJRNRBLXV23S8fvfXzHtY4sXz8c553wf0XSlusPXUaJReslOpbar9ytp9/rrH2FkJPX3HzVq9LOfOxJfvvjEpHd3fuH5t3HddbfjtVc/gpvh/+4l8o83tHswqehF/tGun5aI/OONyD/FtN9qRP5phIbyr2BuNba77mzsefu1qNp9B0TGxmyRf4bXh5LGegSHhs0pv5HAGF6/9Cd4Yv9VCA/7N4xIE/lntaUt1woeA0+uXIVnDrvEnIbd09yGWDiE4vn15s6+liM0DAyt7zQF4FGv/h51R+4dfyDFqZiTiPwTprDVVvNnbI+3316zmRxLZgSgGq31qU99My35p2hoqE74eHNzW9LX7+rVr+PDD9dP+1hT0xwcdNBu+l5HCd7f1dp9mbq1O/eLn8Af7rwSf7v3OjQtqEvp2K23bsLf7rnOnPKbjPxrXtOOL557I0789FUi/8AdkX+8od2DSUUv8o92/bRE5B9vRP5NsNm3aZF/GqGR/DOljmFg8VdOxh53Xo2mTx+G0Y52jHXbM0WpaF49YpEwAmqUn1raT400238V+p5/y3zcsc0gNEOHab9JMS5IoqEwnlq5yqxZJBjG8NpWeHJzzc1C7NghWDEyEsTir56CxrOOiK/5mPKJ4KKbr+xHQIHttl046/p/U5ltDcD33luL44+/fEbplgyLF89LOLJwYGAk6fqqUXRqyvBMnH320dpeR4leJhyOOt77c3J8+P6NX8KlXzvVnCau6vL3+76DlSt3nvXY3NwcXPyVE3Hf/d/F9jtsMevz+/uHce01v8PBB30Z//7Xc66/fvm/e4n84w3tHkwqepF/tOunJSL/eCPybyobfasR+acRGsm/SRkTi2HBaUeaMtCuzT7yq6qRX1OLYF+/+ffgwBCeWHm++Sct2UMYMvJvGkmnRgM+pdZnNAyER0YQi0VNqWt1tKYaCRjo6UFBdTW2PO8E7Hv/9+K/T3YkoMg/YRq22XbBjO3yxhsfTSuFEnHZZT83p91aYautZp6W/P77a1O+fu+664lxabg5u+22NQ4/fM/kT5bB6yjxFOCwo+9uZWVFuP0PV+D441ds9Hu1c+8vf/11XHDhCTOOdt9l161w/z+/h/NXHT/riFG1G/Gvf/UA9l+xCr/+9QPjU5vd9Xm3KfyzF/nHG9o9mFT0Iv9o109LRP7xRuTfpkx+qxH5pxGayT9F2Q5bYN6JB5nyLxoKWZ7y6ysoREFNGYbXdyISCcEDD547+SqMtfWYcscc8cd8qi91+Tcd5vqAHgPLHrvZHA0IjwcFVVUY7eqy1GfU8R6fD7llJchvqEKgMy6MEyLyT5iG+roqVFaUzNg2as236XYNTkR394Dltt5mm6YZH/vf/1KfVuz3j+FXv7ofF1984rSPX3nlmXjiiVfN5yUkw2/DiQSgEmdOvbvV1VXid7+/YsaRmGo04EVf/jR23HFLXPzlWyflamFRPr761ZPxmdMPS7ixzARPPfUqrrry11jz8dR/RHP31zf+2Yv84w3tHkwqepF/tOunJSL/eCPybzrMYTQi/zRCJ/nn9cCTn4ulN3wRe95xLeYdewACvT3WdnqNxZBfXY3QqB+BIT+ikQgMeMwRf4GOXldN9+Um/6a+2lMrL4iP4IzFkFuYY/5eTQ1O+5yGYY42zC0vxx5/vBr7/OO7yJtTOfHg5geI/BNmYIcdZ56aGQiE8P776zb7fWFhYgHY3z9kqb2rq8vQ1DTzOnP/+997aZ3317/+pznNdDrq6qpmlIPZ/LKVaCfkUCji2LvbOed+IuE07An2P2AX3Hf/DVi6dCGWL98R/37oRpxx5uGzyr/2th6c/6WbcMZnrhP556ovryL/eEO7B5OKXuQf7fppicg/3oj8mwmfyD+N0En+KSJRRCNBVO25nTkN0y7Cfr8phoK9/eY6f5vuMusmuMm/qXV8+oCLEItGsPzx20xJV1xXhcGWNlMCpyuRRzs6zOPLt1qIXX75dTx79KWbjxQV+SckYMcdtpzxsXfeaZ52o4miovwZj1HPHxyMb1KULnvssW3Cx9MVgGr32l/+8h+45JKTp338rLOOwH//+yYeeeTFzR/M0ttxovUWg8GQY+9u11z9W4yNBU0ROBvz59fib/den9TmMGp6729+/U/cfPNf4R/ZdLSlu7++8c9e5B9vaPdgUtGL/KNdPy0R+ccbkX+JmGUhLXl7ca38AzDnsD2xx53fQsGcOQmnZSVLbkUFihoaEPL7TQH05MFfhpvhKP+mouSf4smV58OAgZH2bnOX55zCIkvnVX3H39ELX3E+9rr3O+b09A0vajXqFOLI3EtpGwFF1BTOmXjttQ+n/X1BwcwCUI2ws/r+uM8+S2d87OOP29DTk/4U49/85sEZ1ydUo9Z+9KNVWLJkk12Rs/hvMb4EIwCDwbBjvV/V8Ibv3oFLv/rTGacaTyUZ+ffcc2/hyCMuxXeu/73IP9e9e4n84w3tHkwqepF/tOunJSL/eCPyz4IAlLcXN8o/w+OBNz/XHF21648vRelWi8xRV1am/Xrz8kzxExoYwEhrfJdMNeV3QhC5Ee7yb1OUBAwFQxhsbkV4bBS+oiKzr6VLJBAw/1u5w2JsffXn4hJQXUcZ2jgm+62b/QgookaX7bTz4hkff/316QVgoinAPT2DluM68MBdZ3zsySdfsXRutcbfddfdPuPjRUUF+OUvv2ZOQzbJ8kBsr2/m94VAIOh477/rr//B6addO+MGKsnQ1dVvrhN48onfwvvvqQ1cNsXd1y//7EX+8YZ2DyYVvcg/2vXTEpF/vBH5lwwz3GnL24sb5Z8iFo0iMhZE4bwaDLe0IjRk7cttaWM9IsEgRrsHzDXcntz/AlMGmbhwyq8b5d8ET++vdgq+wBxpExoeQdG8Oebv0x09paT0cEsbKndYgm2u+Xz8lxnYOCb7rZv9CKiyzTYLUFQ482i+V1+dXgCWlRXPeExvr7X3yKVLF5nr8c3E449bE4CK++9/BqtXv55wSutf/3oN5s2tQbbx+XwJRwBmoverkXsnfPIKtLR0pHRcJBLF7377IA464CLce89TMzzL3dcv/+xF/vGGdg8mFb3IP9r10xKRf7wR+WdBAMrbixvln9p5V9F01hHY94EfoGTBAkuvoqSO+jPU2mVKGbXu39NHfjX+WknslMgVt8q/qf39qZWrzDCHWtpMQWyV4MAIcsqKsPcD39uwMQjb1s1+BJTZc49tZnzM7w/gww833wBEUZFg12CrAvCYY/ZNuCmJWqPPDq688lfm+WZiwYJ63HX3tZtPB84gSuoXFMy8WdDYaHzkbyb48MP1+OSxl+Pll5Pfgfm5/75pTiMeGpppTUh3X7/8sxf5xxvaPZhU9CL/aNdPS0T+8UbknwUBKG8vbpR/U3fe3e6yzyGvqhz+9jZL035zy8pQ09SAopJCM1U15TcyPn3LjZt9wO3ybxNMCQhgsLnNFMLevJlHZc1GaHDQTL1y20XY9XeXwfB5J4U2r9bNfgSUUa23777bz/j4m29+ZI7gmo7KypkFYHd3+uvzqTX4jjlm2YyPK/mnNqawg48+asX11/8+4XPmzKnAX/56DQ45ZHdkAyX/En3uKEmbSZTcPfXkq/Hwwy8k9fx99t0ed/3tWsybN91ISndfv/yzF/nHG9o9mFT0Iv9o109LRP7xRuRfqkz5lixvL26Vf4qiRQ3Y+vIzEBwcQWR0NO1X8eTmmuv9qRF/Xc2tePTwizdM+Z3hy7UbEPm3aYMYpgR8+7rfmbN2i+dUIGbhrk9tMqJGFBbPm4u82vJJoW0X2X93zH4ElDHGN23Yc8+Zd9tNNNKroqLUkRGAK1bsbEq3mUhWPCXL7bf/a/odf6dQVlaEn//iq7j2urORnz/zaDwnKEwwPVvhH910F13nUQL2vHNvxB1/eCip52+77QL8/R/fNWXgBtx9/fLPXuQfb2j3YFLRi/yjXT8tEfnHG5F/FgSgvL24Wf7l1VbgwEduxcIzjomv+ZfGyL+JKb9qvb+hdZ3IKSrGM5/4GsZau+F2RP5Nw/hafV2PvGiKwIGWNiBmoLDB4pRgA9j9j9/Cvv++UW0nCtgwEjD7747Zj4AyE623xx7bmBtezMQrryQSgM6MADzjjMNnfCwajeHf/34ednPppT9FaxLvy6eeejDu+8d3seuuW0EXATgynHkBqFAjQ795xS/xg+//Mannq/5y/PErzBGebr9++Wcv8o83tHswqehF/tGun5aI/OONyL908WT74nAVGso/xfyTD0J/SxtG1rem/yqGgbKmBnjzcoBoBM+degXCgzOtg+QeRP4lx5MrV5neOdDTC8PnS3tjkLHubrPNK5Y0ofH0Qy2POs3+u2P2I6DM1NZrbKzDW2+tMTd2UKP2lGCbyv/+9+6051Cj4IqLZxaH3d39acW2aFEDli/fccbHX3zxHUtycSb6+oZw1lnfwfDw7CO9Fy+eh7/edQ1++MPzUVs780hFu1CjDxMxMpL+6HQ7+MmP78E3vv7zGaeKK9av78Jnz/wOvnLxbYi6d9C7S969RP7xhnYPJhW9yD/a9dMSkX+8EflnhZm32xNYyz/D60VBQzWWfv88zNljKYY7ehENpLe+kq+oGPlVJfB39CISCMen/Lp4o48JRP6lgNdj7hC97LGbzVEzRfUN5jqU6TK0vhMLzjwCwY4+tD/wbFrnyH4Pzn4ElNm09f70p0fMPxPk5uagsbHW3Pyirq4SHR19056noaE64et0daUnAC+66NMJ17v75z//m9R5vF4vIpFISq/93rtr8dnPfhe//c03UFiUeNSdivG4Ty7HIYfujp/8+F789ncPwj/izEi8ysqZp1orBgZGNvvdaZ85FF6vB8NDfgyPjJkbhYyOBjAWCCIYCCMUCiMciSAaiab9DwtTWf30a/jO9b/H5Vecvln9HnroBdz4gz9h1D+GefNqkQlGRsZMqasb/N+9RP7xhnYPJhW9yD/a9dMSkX+8EflnFRGALpR/ilgkgtzaClQs3QoDza1pbfihvkwVz2/AyPp2DA0PmyO4Xjj16viDLt3oYwKRfykyPqLm6QMvxH6P3YKRtlYU1NRitKszvb4ZiaBobj2WXv1ZdD/5CiIjYyltPpP9m6/sR0CZZFovGAzhgw/Wm38SUV+fWACmM0pv220X4qij9pll+u9zs56nuroM99xzPX7xi/twxx0PbTaqcVrGn/LC82/jjDOvx29+842EIxwnUNOnv3rpyTj7C0fjt799EL/9zT+nFXJWqKxKLAD7pllv8Zxzj8HcudNtupF51OYpmd5A5dJLfoq77nocOsH/3UvkH29o92BS0Yv8o10/LRH5xxuRf3Zg/1aZgvbyT7Hw80djh++fN7kzb7oMr23DnPl1pvxTO/2Oru+C2xH5Z6311JqAhuGB4fGY8k+NVk2HkfVt8JVVoOmzRyI/BUGQ/Zuv7EdAGbtbb+7cxAKws3P6kYMzofr2lVeemVBsP/PM62hv7531XN/61mfNHWevueZzuOuua7HVVo0pfR69+MI7+PSnrkwph/LyYlx00aew+pmf4LLLPoOmpjmwi6pZRgD2ajjSLZsMDfnxQJojnJ2C/7uXyD/e0O7BpKIX+Ue7floi8o83Iv/sQgSgC+Vf5V5LsftlZ8KTk2Nu+pHOCKv86hoUzqkzk+xoacOTB16QZry8EPlnjdj4ollqGvloZwdySkpRPDf9qXTBgUHM/eQK7HPvDSheMg/GLJuCZP/mK/sRUMaJ1ks0BXhwcMTcJTZ5DJxxxmEJdyNW3H77v2c90wEH7IIjj9x78u8777wYDzxwAy699JTpd++d4fPo7beb8cnjrjD/mwpqRKAaDfifx2/BHXdeaY5ozMmxNqmgqqos4eN9vSIAp/L3e582pzvrAv93L5F/vKHdg0lFL/KPdv20ROQfb0T+2YkIQJfJv7IdtsDCcz6BrvZeRFNcN2oqo91dpqBRr6lG/sUsbrbAAZF/NuIxzI1BQkNDGGxpNdeZTIfwyIg5VT2/sgTzTz0kYT/N/s1X9iOgjFOtl2iEW2dnKuv/GVi4sN4UdIn4+OM2PProiwmfo6bsXnfd2dOuB/jFLx6LBx/8PnbbbeukP4/UxhUnHH8FHnxw9mnHm6L+AWmffZbi1tsuws03X2CpfnPnJR5tqTZvETbwpz8+qk1z8H/3EvnHG9o9mFT0Iv9o109LRP7xRuSf3YgAdJH8U9Qfsx/mrdgF0WAgvdf0eFDeWA9fXnyEyZP7n5/OWdgh8s9m1FpmMeDJFap/GSioKkl7AX8lKIbWtqPu8H0w/9SDp38Osk32I6CMk623ePH8GR8rKsqfddRaHAOFhfn42c8uQUFBXsJn3nrr3bOu5Xf55aejrq5qxsfVxiZ/+cvVuPrqz6JwltebwO8P4Lwv3ojrr/89IuHU/3Ho3Xda8LWv/QxW6jc3wWhLNdJSx80ussXrr31k7mqtA/zfvUT+8YZ2DyYVvcg/2vXTEpF/vBH55wSyCYiL5N/cTx2AmpW7YGBdhylT0pn66/HlYLCjx1w70NztVxD55+B1pNYBfNrcHfgWc+20onl1GFmXxu7AsRjyystRd+Q+WHvHw5rdfGU/Aso42XpqR+ottpg74+P19VW4++7rcMYZ16K5uX2GZxnme+0Pf3g+liyZWSYq3n9/He677+mEz1Gj7U466cBZY1evefrph2H//XfB17/2MzzzzBtIhv/7xT/w8svv49ZbLkRd/cyScSrDw6M4++zvmWvSWalfQ4K1Otvbeqb9/dq1neZmJCPDoxjxj2FkeAwjI6Px3X/DEUQi0fH/RhAKRSzvBLztdgtw8MG7zziS8q6/PgGrqI/mL33pOHh9M69/+qc/6TH6j/+7l8g/3tDuwaSiF/lHu35aIvKPNyL/nEIEoEvk39ZXnIFtPnsM+tt7EA0G05J/RfPq4e/oRiwYwivn/SCNWPkhI/+cvY4m1wTc/wIsf/wWc9MZb24OoqFQyqf1t7Wheo/tsedd38YHN/0ZPc++CSPru1XL7Z/OrdfYWDf9enqbTBH+29+uw1lnfQevvfbBtBF+9asn49BD95j19b73vTtNYTXbzr9KcKk1+JJh/vxa/OGOb+J3v/0XbrjhjqTWLFSbgxx22CX4znfOweFH7DXr8795xS9NEWelfmr9wNraihmf2zaDADzlpPGd5zPECSesnFEArlvXhZt/9FfLr7FixU4J5Z9/ZAz3/X01sg3/dy+Rf7yh3YNJRS/yj3b9tETkH29E/jmJTAHmLP/GJV9eXRUKm+rR09xqyr+U8XhQ1liP0c5u83i15t/QOy1wOyL/MngdqTUBV6wyG72oPvE6YYkIDY+ioKEGVftsr8Gbn9z+6d56s43Ym6CyshR//OO3THGzaYTnnPMJc12+2VAj9B55JPHaf4r77luNgw66GI899r+kYjMjMQycedbhuP+BG7D9DlskdYwaVXfeeT/EVy/5iTnCbyaeeOIV3HvvU0nHMhnTJn9fsLDeHHE5E60zCECOnHLa9EsVTPCPfzxjSuBswv/dS+Qfb2j3YFLRi/yjXT8tEfnHG5F/TpP978Ac0FH+KcanOu31p6tRf+DuaY36m3glNW1YTfv97wmXbzQyy62I/MvwdTQ+KuqpFasw2NyKwvr6ScGdCsGBfhTWV6Pu6H2x8++uMMWikUA6OIfc/lFovV12WZL0cwsL8/CrX30dn/jEfpMRfupT++PrXz911mPV9NRrrvlt0q/V3t6Dz33uu/jyl29Ff/9w0sep6cz3/O1aXHDhCfDOsiP2BHfd9TgOPeQrWL369WnijuK6a2+HHfXbYouGhMesS2OEIUXmzKkwd3ierSbZhP+7l8g/3tDuwaSiF/lHu35aIvKPNyL/MoEIQKbyb0JqzP3kcsRgYLgljXXT1JfahnoUNsxBQWkx1t7xEII9sgujyL/sXkfvXHs7Rlpb4SssTEsCmteCYaBihyUo3qoRsYxPA5bbPyqtt/vu26T0fLUL7w9/eAFOPvkg8++PP/4yHnjg2VmP+93v/oV33019VLUaeXfIIRfj4YdfSD5Gnxdf/vKn8cc/XmWuYZgMra3d+Mxp15pTfaeOPPv7vU+Z6xbaUb9Eay0q1qyZaY1FXj3wpJMPTChnW5o78NKL7yJb8H/3EvnHG9o9mFT0Iv9o109LRP7xRuRfphAByFD+KZTU8JUUYo8fXAhffnK7QG50vBo96PEg0NuL4bXr8ejy8/DxL/8BtyPyL/vXUdcjL+LVVT9CeGQExfPr0nvNaBTe3DzscMuF8BYXwEhyNJR15PaPSuvl5eVg++0XpXycmsZ6/fVfwOc/fxS6uvpx/vk3mRtkzLSDbUdHH2666S9px6le4wtf+D4u+cqPE07V3ZTd99gGD/7rBzjssD2T/kz4wx8eMqcfP/rIS+bvfvWrB2yr35ZbziIAP07vH7Eo9UAlZ0+cZYOXe+55EtmC/7uXyD/e0O7BpKIX+Ue7floi8o83Iv8yiQhAhvJPkV9fha2/eSYGuwcQGU19rSCPz4f6eXOAqNot2IPQ4HCWpkrqg8g/TW4SDQODr39kHjrU0gZvXuqCWzHa2YGyLRpRvXxHxGbZeMEe3H39UGu9nXZabG5MkS6XX346LrzwU+bPam2/ww+/BC+88PZmz7vqql+lJO6mJQbcffcTOOzQS/Dcc28lfVhZWRF++rOv4IADd036GLUb7+c/fwNOOvFbeOutNbbVb9vtFiZ8/OOsC0Dne+BBB+2KurrKhM+5557U11u0A/7vXiL/eEO7B5OKXuQf7fppicg/3oj8yzSyCzBD+aco234LLD7hQPSOT3dMiVgM0XAYPUMjCAeCeHL/8+O/zvqOqdkj2RZcULPM8ius6crOF7yMk253Gl/bUq0HuOyJW1E4p9IUgekQ6B/G1pefgeF312Lkw/VwDrn9o9Z6++23Q8LH//znR3HiiYlHa1100aeQm+vD97//R3Ok36mnfhvf+94Xceyx8feJf//7efOPXdfR+vVdOOXkq/Gl8z9pysfZ1vmLhCO4+urf4rFH4yP6UiEV0Thb/QoK8rBo0cxrAPb2DmJwcATce+BnPnNowsfV1F81BTjT8H/3EvnHG9o9mFT0Iv9o109LRP7xRuRfNhAByEr+qefFUHf43lj0xeMw0NVvTttKdfOP/NpalBT40NnShtVHfxVux7Bd9iV+henOy04K2nSTqCTg8sdvQW5lpTldPdW+HhoaQkljPRrPOAxvX/krOIPc/lFsvUMO2WPGx9asacPXv/4zvPrqB7j22i8k3L32vPOOM531D37wR4RCYXPjjpGRMRx11D745jd/aft1FI3GcOstd+PZZ97Arbd9ecYRZeqz4ZJLfpLWDr5212/rrRsTyspU1xmk2APVTtKLl8xL+Jy//S3z03/5v3uJ/OMN7R5MKnqRf7TrpyUi/3gj8i9biABkI/8m/R9q9t8FJYsaMdbdnZIQUV8I88rKMdbZBd+cKnx4y18RsTo1jTiGI8JvpleYmU1fm7QQtPMm0QA+uO1v2Of756Oz37PRCMFkGW7tQvXKnTD31IOx/o6HbQxuPECBXOs1NdVhyZL5Mz4+MWrvj3981NyF90c/ugC5uTkzPv9LX1ISMIobb/yz+Xcl/v70p0fM9fvSZpZu/uKL7+LIIy7FrbddhH32WbrZ49/73p1ayD/FTjsvTvj4O283g3sPVKMc99z9HDQ0VGPHnbbEDjtsgb333g5Lt19kCuZgMIQH7p99Qxk74f/uJfKPN7R7MKnoRf7Rrp+WiPzjjci/bCICkIv8myI+6g/dF8GBgbTW/SsoL0RgYABDnd1Y/7cn4GYWOiL87OkhZIWg3TeJMaD1rsfRueoExBBDWWM9BlOcDhwLh1E0vx4Nn1xhCkDD40EsaseagHL7R7X1Dj105tF/GwRgPMIHH3wOQ0M34Ne//nrCNQPPP/948y36hz/8s/mPLW+88bHj15GSSqeffh2u/OYZOP2MwyZ//9JL7+IXP78PutRvtt2W33kn9R2SqfZAteOy+vPgP/87uU7j3vssRVVVWUanQfN/9xL5xxvaPZhU9CL/aNdPS0T+8UbkX7aRTUCYyL+JDTqaPnskxnp7EAkGUzpeyRMlPQbWdZp/f+qAC+Fm8aez/JtJCDozQpHGTeKTK86HAQPD6zrhKyhM+fiRtW0o33oLlO20pcg/Dcj2zfNRR+0742NKzrzyygcb/e7pp1/DhRfeYk6/TcSqVcebowEzeR2pdf6uuurX+PY1vzPFo/pz+eX/N2usmazfrrttpdkIwGz3wA0MDIzgXw8+hzv+8JALs3cKkX+8od2DSUUv8o92/bRE5B9vRP7pgAhABvJvYoOO/IZq7HbFZ+HJyUl5LbSi+gZzBGEsEjE3/bBnBBQ96ee8+HP2zW9CBGonAzNwk6gkYCQaQUFNWdrn2OGmVfCVF8OYZfOExMjtHwi33tKli7D99otmfPy++1abEm1THnzwv7jyytnX9LvkkpNn3exhKmoaaGFhvuXr6Ne/fgBfveQn+M9j/8O7Do6oS7V+CxfWo6amfMbHlah87721cE8PzC78sxf5xxvaPZhU9CL/aNdPS0T+8Ubkny6IAGQg/xRFi+dhmyvOQH/PIKKhUNLHTYwI8bd3mPk+dchF2X7/zSiZk34TZK5xtRGBGbpJNDxe/PeYr2OwuRX5VdUpH6/WzCxeMBd1h++FWCRdAe6ii8cBdGi9U045OOHjf//70zM+dscdD+Pmm/8662tcffVnJ3cCTkRj4xz85jeX4YknbsVppx4Cr88LK9x99xNYtepH0Kl+K1bulPDxd95pxuhoAO7pgdmDf/Yi/3hDuweTil7kH+36aYnIP96I/NMJEYAM5J+iYtdt0HjYPgiPjKQ0+k89t6apAb68nPi9cSicpQ927uIvex9uWRWBmexL0QjCAyPxZvak99Y21j2ARV/6JEp3SrwpwfTI7Z8VdGg9NdLuE5/Yb8bH1Ug0JaQScfPNd+E//3l51vfdH/zgPBx00G4Jn3fVVWciLy8H1dVl+Pa1n8dDD92Igw/eHVbw+wNa1W/Fyp0TPv7Si+/CPT0we/DPXuQfb2j3YFLRi/yjXT8tEfnHG5F/uiECkLL8Gxd98046CAs/dxSGOnqnnZo2ExPP7e3oRWh0DE+sPB/cyY740+P2IOMiMJb51lVrYT69/4UY7exA0bz6lM8T9vtRPLcWjacflmYEQjro0nonn3zQhum20/DnPz+W1PvqV75yG9raehI+b2RkDMXFBTM+fuCBu+KAA3bd6HeLFjXgF//3Vfzpz99KOE2ZSv0KCvKw117bJXzOiy+8A/f0wOzAP3uRf7yh3YNJRS/yj3b9tETkH29E/umICECq8m/KYbX774q8ynJEAoGURv/lFBVhTmM9vLl5ePXiW8GZ7Ik//W4PMiICsyD/zJdVGxtEY3jhpG9hZF0bDG/qG50Pr+tA5R7bYtH5x6cRgZAqurSeklHnnnvsjI8HgyHcc8+TSZ2rr28IX/rSDxEOR6Z9/IUX3sbBB1+Me++dfvfu8vJiXHfdF2Y8/557bou/3/cd/ODGL2HOnApQrZ+SnGqEYyJefPEdl/TA7MA/e5F/vKHdg0lFL/KPdv20ROQfb0T+6YoIQKryTzG+i2P9wXuYU3/TGe3UPzKG4OAABl5+D1zJnvjT+/bAMQmYJfk3lUC7Gg0LFM+tSfmcagOcwroazDl8z/hrJNwQRN/6UkCn1jvttEPNqbYz8dBDL5hiL1lefvl9/PjHf5t2ncBTTrkGnZ19Mx573XVnzyr21D/2HH/8Cjz2n1uw6oLjkZ+fC2r1O+qYmXdbVqxd2znrSEo+PTDz8M9e5B9vaPdgUtGL/KNdPy0R+ccbkX86IwKQqvzzGPDk5WLxl0+Cv60b0RR37VXT1Arr6xHo7sNzp3wLHMnuqD8atwe2jwbUQP5N8PTKVRhsbkNOcXHK5x5Z34bSLRehYs9tE2wIon99dUan1lPTfs899xMJn3P77f9O+bw/+cm9aG5un/z7z372d1xxxf/NODJQcfTR++KII/ZO+jUKC/Nw8cUn4pFHb8KRRyV/XLbrV1JSiBUrEm8A8tijL8EdPTDz8M9e5B9vaPdgUtGL/KNdPy0R+ccbkX+6IwKQovxTRGMobKrDDqs+hWg4nPLZSpsa4G9vN8MIODrCIjtkV/zRuz2wRQJqJP+mPjGvsiSt11BT6pf+4EvIrS41hXuaEQjTl0UrlECrrCyd8fE33/zYnLabKmra8BVX/NL8+be/fRA33HDHrMc8+siLuOmmv2BkZDSl15o7twa33fZl/OUvV2PbbRdA9/od98nls07/feSRF+GOHphZ+Gcv8o83tHswqehF/tGun5aI/OONyD8KiACkKP/GafrMofCrTXtj0dQ2/ojFMLiuw1wvzdz4I4V1Aykg8i8LElBD+Wd4vXj20Esw1NyGgtralF8n0NeLinlz4huCjE+3Ty0CYdq6aNYs2223EGeeeUTC5yh5ly5PP/0aLr/8/3Dttb+b/cmx+C69t9x8F1YsvwC///2/EUkwWnA6dt9jG/zj/htw3fVno6IiPfmdifqddPKBCR8fGvLjuf++BWiWQTSFz1sd0e36sx+Rf7yh3YNJRS/yj3b9tETkH29E/lHB3QKQqvwbX5OscvdtMNLaBiOFcyopUtvUgJzCfLx93W/jv0xh52Cdyf6UX/q3B2lNCdZQ/ilikQgiYwG8+qUfIhIMpfxaSpb3Nrcit6aCTX2zjW6t5/V68J3vnGv+dybUGnR///vTll7nzjsfRmTGqeTTX0c9PQO48pu/wiGHfCXlqbAej4FTTjkY/3n8Fpx++qEJ88tG/XbaaTG23rop4XMef/zlhFOls5VBKBgGVXS7/uxH5B9vaPdgUtGL/KNdPy0R+ccbkX+UcK8ApCr/FONfJD0FeSnJOyU0lBTp6R5AaMiPLsemV2We7Is/XrcHSUtATeXfJB4DQ29+jEB/L4ob61N7PcMwp8pX7bPUSgSCxq2ndv3dfvtFCZ/zs5/di1DIYemT4Dr66KNWfO5zN+C0076Nd99pSem0ZWVFuPqaz5kjAtXIQF3q97nPHzXrc/55/7OwF3syKCzKB0V0vP7sReQfb2j3YFLRi/yjXT8tEfnHG5F/1HCnACQs/9SOpAVNdVjxxI/TmtZY0dQAw+PFK+ffCC6I/MuSBNRd/inGp+4+d+zlGGpuhScntZ1S/Z19iCGGmkP3iP9is7UAhWTQsdX22ms7fPnLJyZ8jtqp989/fszZQJK8jlY//TqOPPJSfPOKX6K/fzill9hmmyZzbcCbfrQKtbWJdxd2un5qrcLDxnfYnone3kE8ausGIPZlkGh9RV0H0+t4/dmLyD/e0O7BpKIX+Ue7floi8o83Iv8o4j4BSFj+KdSOpIXzauHJyTE38VCjlJIlt7QUgbEoQkODGHzzY3BA5F+WJCAF+TeFUN+QeaKi+qqUjouMjaGksQE7fOfc+FqZG60FKFC9ea6pKcctt1w069TYm2++C4FA6tPHkybF7qSmEf/hDw/hgP0vxB/vfATRFPvjsccuw2P/+RE+//mj4PV5s1K/z37uyFnb/d57nrJx+q99Gaidi4/5xH4JN33RDR2vP3sR+ccb2j2YVPQi/2jXT0tE/vFG5B9V3CUAicu/CeqO2AsFNVUpyT81/Tc4OAR/Rxue/eRlMDz0Sy/yL0sSkJj8M8/jMfDCCVdhqKUNuWVlKR07vLYd0QhQf9xym6JxDzrePOfk+MzdcpUETMR7763Fn//8qHOBWLiO+vqGcNllv8Cxn/gGXn/tw5SOLSoqwOVXnI5//vN72HPPbTNav+rqMpx8ykGzPu8vf7Fr1KV9GVRUluBnv7jEnFY9E6P+AHRCx+vPXkT+8YZ2DyYVvcg/2vXTEpF/vBH5Rxkf3AIT+aeo3X83+Ns7TamXrATMr6xEcGgA0XAsPhqKOCL/Mi8B13Q9RVL+KdSO14GuPvPnnOJCBAcGUjg4Zo6enX/KQWj72xPmNHw1Elegd/OsNsf40Y8uwB57JBZfiuuuu332jTvSxabr6PXXP8Kxx16G0z5zKL761ZNRXFyQ9LFLlszHn/78Ldx771O4/rrfo6ur3/H6nXvescjPTzwN/9VXP8B776614dWSy+DSr52Mww/fC+0dvejpHkRf/xD8I2PmCEQ1UrGsrBgLFtZh550XIzc3J+G52tt7oQs6Xn/2IvKPN7R7MKnoRf7Rrp+WiPzjjcg/6rhDADKSf3VH7oNwMGgO3UxlBKC3IB+xvl48uXIVqCPyLzssqB6XgBnAiatHjXp9asUq7PfErcgrL0ewf2PhkQh/exsqd9oaNQftxmrzHLfdPF9zzedxxBF7z/q8f//7eTz55KskvmypacC3/+5f+NeDz+Fb3zoLhx+xV8rTgg86aDfceOOf8Pvb/21KTyfqV15ebO5MPBu//tUDNrxa8hn8/e+rce4Xj0XTgjrLr/rxx23QAV2vP/sQ+ccb2j2YVPQi/2jXT0tE/vFG5B8H6M8DdZH8y6sux7Jbv4K84uKUm2C0sysel5KGKYhD3RD5l93rKOndgS3gZO9UU4EVgb4+cwRtskw8d4sLT4CvtBCYZQ0zN6Pru8shh+yBU089ZNbnDQ+P4qqrfkXuy5basOS8836IL55742aj+WZDjRy86qqzcN8/vovSkkJH4lMblxx+2CX40U1/mVGUrVvXhX8+8GxGe6DaWfn11z6CHbz4wjvINrpef/Yh8o83tHswqehF/tGun5aI/OONyD8u8P4Wy0j+KXFRsfs2GBgJIjiU2hTeksZ6c9OQsY4+vbcqnAWRf1lik+7ipAR08qMlFo2aU4GH321GUX1DSiNo1XNDI6PIrSxFdCwIyBTg6dsJ+vLQQ8/juOMuxzPPvJHwed/97h/QMfFeaScZetv917+ew8EHfRl33/1Eyse+/L/3MDTkh1M0r2nHLTffhQP3vxAnn/gt/OMfqxGZstnHr355v8Vp1+n1wL/85T+wypqP2/DWW2uQTXS+/uxB5B9vaPdgUtGL/KNdPy0R+ccbkX+c4CsAOck/teZYNIY5h+1hjlxKdfOPoZZW5FeW48Pb7hb5Z60ScB0zXEdOSMBMtK6aBvzhTXchODiY8khYdd2pQ2oO3s2x+Cij/9Vh4JVX3sepp16D0077Nt6cZif01atfx513PkL+y9bAwAgu+cqP8YWzv4+enuTWu3zjjY/x7Wt+h0zx3HNv4cJVN2P/lRfgT398FL29g/irpc0/0u+B/7hvNUKhsIXXBm677W/IJvpff1YR+ccb2j2YVPQi/2jXT0tE/vFG5B83eApARvJPMbHhQOVu28Hj9SZ/XCwGj88HX04ehte1oXu1Q2taOYyM/NPzOrJTAmbq1kGNAhx6ew1CI8MomZ/aml9KvhfV12DeqePrmBGeSm83BrEIlej7xCcuw803/xWRSGRyiuoll/w4panhSZHFAdcPP/wCDj74YnNUYCLUqL/zz/shgsEQMo2a9nvZN35ujgr0p72LrrUeODg4gv/+9620j//7vU/jnr9lZn1UmtefVUT+8YZ2DyYVvcg/2vXTEpF/vBH5xxFj3qLjaM4HdYn8m6CwqQ6H/+fH6G5pTfr11BfZqqYG9Lf34oXTr8bwB+tADaryr7Z065Se3zmY/bWj0r2OrG4MkvFbB48BT34e9vnn9+ArKEBkbCz5Q3NyEAkF8dyxVyA0OCJTgbN+62c9wu23X4QbbzwfP/zhn2cVZSmj0afryacchG9+8wwUFORt9tj5X7rJhrX3aPfA0z5zCK759udSOqa9rQe//L/78dvfPmhuxpIN9L/+rCLyjze0ezCp6EX+0a6floj8443IP67wEoAc5Z8aZRSLYfvvfwk1++2E8NhYSlOA8yqrMNbdhScPuAAUyb4ANGyXfdpLwRSvIysCMJu3Dmo34PLGegy0pLZzZ3FjPdbe/R+8cclP4HYMJhF6vd7JkYC2oeEn6xZbzMWtt12EbbZpmvzdX//yH3zt0p/C7T2wrq4Sq5/9yYyfr2NjQXzwwXq8/95avPrqh+YU5vfeXWv/iFFW159VRP7xhnYPJhW9yD/a9dMSkX+8EfnHGT4CkKP8G8dbkIf9/vVDGF4vYuEk1ymKxeArKUFoaBirj7gYkWCY3GglneWfU9Iv6zIwzXeDdCRgtm++8ufWYo8/f8ucFpzsxjjqy75aR3D4o1a8fOZ3zM151PqcbiTb9dM6Qo27RF5eDq6+5nM48cQDzN14jz7yUgtTb3nV9+KvnGi2j1pDUf3p7u5He1sv2tp6zJ2Vsyn76F1/VhH5xxvaPZhU9CL/aNdPS0T+8UbkH28M+MABpvJPyQU1AnDnn15irlc2tLY96WN9RUUIqd2CzXtoeks96ir/Mi3+Nn1dR0WghZtEtR5gKhIw+zdfBgob52DO3Fq0tbQlHY8aHVRQOwexWBQVe26Dvufenhyl6yayX7/ZEPk3E4FACN/42s/w4vNv49331or8m8IPb/wzKKD/9WcVkX+8od2DSUUv8o92/bRE5B9vRP65ob70zJBL5F/8ZQxzA5DCebUYbG5NSTJEIxEYPh8MGPD4PKRG/+km/5R8m/iTbRyLxYabxGQ3Bcn+zVc8gt7n3kRbcyvyKypTOnq0ox155ZXY4uJPx38h8k8zRP4l0zp33/0E3nj9I9Aj++8g2YR/9iL/eEO7B5OKXuQf7fppicg/3oj8c0t9aQtAzvJvfPff0qWLULZoXmrHxWLIKSxEQVUZ3v/RXxAe8jsWIz82l3+6YltsMTfdfE2JIBrDm1/7Gbx5m2+KMBve3BxTzBs5OXAT2a/fbIj807R1bIJ+Blbgn73IP97Q7sGkohf5R7t+WiLyjzci/9xUX7oCkLn8m6D+6H2Rzti9wpJ8+Dt60Xrvk6BEdkf/baivLiP+ZsNynDbfJCYaBZj9m6/NI1BTeEfa21A8vz4lwe7v6EAsEkPxkrnm2pxuIPv1mw2Rf5q2jk3Qz8AK/LMX+ccb2j2YVPQi/2jXT0tE/vFG5J/b6ktTALpA/hkerzkFuHLvpRhW039TILekBP3r2rP9fk1a/lEjrZgdukmcTgJmvytOF4ExKe+G17UnvcC/Wgcwr6ICnpwc1B2xN2Jq99gUduamiP7ZifzTtHVsgn4GVuCfvcg/3tDuwaSiF/lHu35aIvKPNyL/3FhfegLQBfJPEYtGzLXF8ipKTbmgpENSx8ViCPv98OYX4oOb/wqojUSEWTBIjfqbiZTid+u0342ImTsA9z33Fsrn1yV9jSmC/f0orKtE9cG7jp+K7yYg2a/fbIj807R1bIJ+Blbgn73IP97Q7sGkohf5R7t+WiLyjzci/9xaX1oC0CXyb4LqZTuhfG5t0iOTTAwDRfPmwFdQgGDvoLnOGQWyN/pvg/zjwqy5ZKBLTIwCzP7N1ywRxGL48Na7MbC+E4YntbfDQO8QvPl58JUVgSvZr99siPzTtHVsgn4GVuCfvcg/3tDuwaSiF/lHu35aIvKPNyL/3FxfOgLQZfJP0XDccvhHgikd4/F6EYsCo91d6H7iZcdi4wE/+TfBjDnJyL/NGFvbhWgkiuJ5c1Jq4+DQEIxYFOU7Lga8dN5K+dw8i/zTtHVsgn4GVuCfvcg/3tDuwaSiF/lHu35aIvKPNyL/3F5fGt9a3Sb/xmVC6bYLMNbTk9LURG9BAYbXteGF07+d7fdvzUf/8ZV/E2yWW4blX6INQTITQZLP9Hrx9MoLMNjSBm9+ftLHqVG2hteH2sP3ACJRVusA6p+JyD9NW8cm6GdgBf7Zi/zjDe0eTCp6kX+066clIv94I/KPN8nVV38B6Db5p4hE4S3KR15VZUpri5nr/42MmI02urYz+3loC3/5N8FkjjLyb0ZiqnHUdRaLITI2lnTbqucWz61F9fKdxk9EY7r9bOj/riHyT9PWsQn6GViBf/Yi/3hDuweTil7kH+36aYnIP96I/OONkfQz9RaAbpR/48w5aHeUVJWkfJzazEAJDV9hPgkhkfnRf+6RfxPUlmQu102vnsyPAkzj+o1EzfX/1K6+vsKilIT7SFuPeVxubQWLDXf0z0Dkn6atYxP0M7AC/+xF/vGGdg8mFb3IP9r10xKRf7wR+ccbI6Vn6ysA3Sr/1I6/OTmYc9heGOzqT+lQX34+hjp6se6PjyDsT34kk3twn/ybuI4ykXP2r570I1C7Ab97/R9QWF2a/KsZBvJrqhAJBlG9fIf4hjuEpwHrH7nIP01bxyboZ2AF/tmL/OMN7R5MKnqRf7TrpyUi/3gj8o83RspH6CkA3Sr/FLEYYqEQOh99CfmV5Smt/2d4vAiPjeHjn98Hg8BopMyO/nOv/JvAydwT9bbMjAK01t8Nrwc9T72CwZbWlEbOjnZ2ma9ctd/28V8QGHU7Hfq/W4j807R1bIJ+Blbgn73IP97Q7sGkohf5R7t+WiLyjzci/3hjpHWUfgLQzfJPMS78qvdZCn9HlznNMBnUs9Rzi2oqULLNAsTUaCRholHhdvk3gRNtkP2rx3oEsUgUVct3RG1jQ0qj+KKhEPKra9D299WgSvbrNxsi/zRtHZugn4EV+Gcv8o83tHswqehF/tGun5aI/OONyD/eGGkfqZcAdLv8G59WqCjbZYn5c7IjANWzymrL4e/qx9B7LQ5HSQm96psRZMOPtOi4/1l0tLSioLY26WPU2oH+9jZs/a3PgiL6Xx0i/zRtHZugn4EV+Gcv8o83tHswqehF/tGun5aI/OONyD/eGJaO1kcAivyLN0M0av63pLEe0Ugk6eZTmxf0rm2PN2Mkfg6dycz03w0Xh2tG/yVxHdnVFqm89TgzDdjGDzcl2z0G1P+N9fYmPfJWTfktaWyAMf58ClPvJ9A/UpF/mraOTdDPwAr8sxf5xxvaPZhU9CL/aNdPS0T+8UbkH28My0f7oAMi/zaieuXO8I7LwGRKrGSFmoqodiNd8+t/mBJCpgBnX/7Nr9wjqeet7X0+49eRapPOwXcI33wZ9q+9aRjwr2lD7bJdMLy2LcnDYuZzYwbgLS5AZDSQrbt1YvWbDZF/mraOTdDPwAr8sxf5xxvaPZhU9CL/aNdPS0T+8UbkH28MW47OvgAU+TdJfPSQB1X7LMVAS1t8Q4FkpgAbBnLLymB4ogj2D2kv/5wf/Ze9D7dkpd9Mx6QtAwlM+1WjANd0PZXFCGYhGsP7N/0VVXvslHwkhoGc0lLEIiEUL56LgZc/gO7of/Ms8k/T1rEJ+hlYgX/2Iv94Q7sHk4pe5B/t+mmJyD/eiPzjjWHb0dmdAizyb+PmiKlRfxFU7rEtPLm5Ka3/l1/og7+jG+vvehzu/ujZ+BUyNfpPSbx05J8t50nzJjGdtsn+zZeDERgGBl/5AP7ODhi+5P9tJDQ4CF9RCeadcjB0J/v1mw2Rf5q2jk3Qz8AK/LMX+ccb2j2YVPQi/2jXT0tE/vFG5B9vDFuPzp4AFPk3TZvEULigHnN3WIJoMJh0UypZ2NvcGv+L1wvDqyYQ6wdH+WeX+Ev7vBZvElNpo+zffBnOX39bNKCmsR6xcDiFw2LIzfeifIct4msJuvb6s4rIP01bxyboZ2AF/tmL/OMN7R5MKnqRf7TrpyUi/3gj8o83hu1HZ0cAivybHk98DbLOljb4ioqSbk4lC+c0NZjrkCESQSyFzUO4yr9M4IT4S+k1CEz7pRaB/8NWdDW3mpvwJIsaqTvaOwwjPze+lqArrz+riPzTtHVsgn4GVuCfvcg/3tDuwaSiF/lHu35aIvKPNyL/eGM4cnTmBaDIv5kZX7svt6QU4ZGRpHciVc9T0vDF067RchdSg9JusBrJv4SvRVT+pVf/zNb3rct/iaGJEbVJkl9ZPHm9Gl59NldX6PeOsCki/zRtHZugn4EV+Gcv8o83tHswqehF/tGun5aI/OONyD/eGI4dndlvqiL/EuPzIq+mAtFQ0JQJyawBOPE8w5QPBmIet8mH6V/Byem/mZR/076mzTeJidoq+zdfmY+gaGE9atSI2hQE/EhH74a/R6LQhezXbzZE/mnaOjZBPwMr8M9e5B9vaPdgUtGL/KNdPy0R+ccbkX+8MRw9OnO2SOTf7IQjqD14N+QUlyTfrgZQ0ViP/Kpy5NaUm+fQBZn264AEJDryj0wEHgNr//AQOptbYSQp05WAzysrQ25eHvLqKqEL2a/fbIj807R1bIJ+Blbgn73IP97Q7sGkohf5R7t+WiLyjzci/3hjOH50ZgSgyL+kqT9qX+QU+lLYAdhAX3MrxnoHMPDye9pMAc6m/HNq9F82Rv5tFkOVMzFs2mbZ70VZiiAGlO++NcpTGAGo8Hd0oLquCk1nHw0dyH79ZkPkn6atYxP0M7AC/+xF/vGGdg8mFb3IP9r10xKRf7wR+ccbIyNHOy8ARf6lRPtDL2CsdyilY6qaGpBbWICSpYsQG19HMJvM1PnsW/+P95p/2ZKAmWrd2ftBNuVQDGPru9Df0gqPz5fSoe1rOzDw4jvINvrfPIv807R1bIJ+Blbgn73IP97Q7sGkohf5R7t+WiLyjzci/3hjZOzo1L7hporIv5TJqy5BbkUJgsND5ui+WZs4FsNg7xCC/jEMvfERso1M+92cH/65Ysb2uvjEvrQl4Nqe58Hv5ivLERgGAu2qJgbyq6ox2tGe5GEGqubPQUHTHMdDTBgHdEfkn6atYxP0M7AC/+xF/vGGdg8mFb3IP9r10xKRf7wR+ccbI6NHOycARf6lhOH1IhaJoPbA3THS0pp8NSefEzV3H83mBgQ6yD8nN/+wU/xt+px0RaCdzCndGp2D2RzBpsftXyymrqEYggMDyW/GA6C7uRUFDdVwd+slQuSfpq1jE/QzsAL/7EX+8YZ2DyYVvcg/2vXTEpF/vBH5xxsj40c7MwVY5F/qTRaJb96RU1xoNl+yOwD78vIRGh5Gx7+fd73802Xqr5J6ycg/q8fYORU4+zdf2Y/ARK37FwPW/PwfKKwtT2EtTqC0qQFVy3d0PMSZXl9vRP5p2jo2QT8DK/DPXuQfb2j3YFLRi/yjXT8tEfnHG5F/vDGycrT9AlDkX9rU7L8z6ufWJv18JSc8ObmmtHjvxj/CzSP/dCFViWf38TRbN/sRbITXg2DPIIZa2lI6LDDghy+/ALnVZRndjEez1psGkX+ato5N0M/ACvyzF/nHG9o9mFT0Iv9o109LRP7xRuQfb4ysHW2vABT5lz6Gga7/vIz1za3w5OQkfVgkGETRvAbMO+EAZINkO1/6G4Bk78Mt1dF/dsm7VM5jdRRgtlp3Q3/Q8PYvEkXhgjpUNtandJi3oADhsTEEuwcythmPhq23CSL/NG0dm6CfgRX4Zy/yjze0ezCp6EX+0a6floj8443IP94Y2Ts6ZqcAFPlnsf1iyK0qRXVTA2LhcEoNP7K+DWvvfCijo44UMvLPuZF7mRgJmP2br+xHMB1qLc2uR15ET0ubOc0+GdTzzOtWpaSuQ6/Hpa03FZF/mraOTdDPwAr8sxf5xxvaPZhU9CL/aNdPS0T+8UbkH2+M7B09/nlkz7dUkX+WMTweVO6+Lfq7+lOTDtEockpKULLtQnP5MjfLP502ANGdmVpX2lCtxxlFxV7boj6FEYBqOn40FEJOYWF83UCHN+PR/+ZZ5J+mrWMT9DOwAv/sRf7xhnYPJhW9yD/a9dMSkX+8EfnHGyN7R0/5PLIuAEX+2YISeUauD8U1KWw8YBgorKtBcHAQ/jWt8Q0MXCr/sjn916nResmeN9VpwNlvXf1Zd8cjaGtpNcV80hgGQiMjqD92uZOhEaifyD9NW8cm6GdgBf7Zi/zjDe0eTCp6kX+066clIv94I/KPN0b2jt7k88iaABT5ZxuGx4u+l99Df3Nq0w4DvQMwYJgCET6v83EyeAU3I62bHJX7bY+6xob4dZUk5nMNoPXuxx1raP3rJ/JP09axCfoZWIF/9iL/eEO7B5OKXuQf7fppicg/3oj8442RvaOn+TxKXwCK/LOVWDSCit22Rl1TfUojANXGA97CQuSUFgPhiL1Bbfp6jp49M69gN06v1Wfn+em1bvbWAOx9+nW0t7TBm5ub9NthZHQUJTVVKNt5sSM3//rXT+Sfpq1jE/QzsAL/7EX+8YZ2DyYVvcg/2vXTEpF/vBH5xxsje0fP8HmUngAU+ecIbfc8ifbmtpSOCfv9iIVDCA+PpjZdMUVE/tFGbr6SR+3gm1NahKL6enOX7WTbt7C+GoOdPRh4+f2065To/Hoj8k/T1rEJ+hlYgX/2Iv94Q7sHk4pe5B/t+mmJyD/eiPzjjZG9oxN8HqVujET+OUbVPttjblN90lOAFbklpTByvIj4x1KarpgKIv9oIzdfKeIxULLtAox2diY9Gldds6GhgPl8X1kRDK/XRfUT+adp69gE/QyswD97kX+8od2DSUUv8o92/bRE5B9vRP7xxsje0bN8HqUmAEX+OYfHQM8zr2N9cxu8eXlJHzba0Y7C4kLUHry7I2GJ/KON3HylQSSK0h0XoWpubfLtbBgwfD7z5/DACGKRiEvqJ/JP09axCfoZWIF/9iL/eEO7B5OKXuQf7fppicg/3oj8442RvaOT+DxKXgCK/HOWaAy+0kJUNNUjGggkfVhpU4M57bDz4RdsD0nkH23k5it9mn/zILqaW1PakAfjI3ANjwF4PS6on8g/TVvHJuhnYAX+2Yv84w3tHkwqepF/tOunJSL/eCPyjzdG9o5O8vMouW+pIv8cR00ZLNt+Swy2dSOWwrTD4Y5e+HLzUbig3hbpMBmPbWfK3iu4GWlda9QftS8amhqSb2/DQCQYQE5BobmGoBpFyLt+Iv80bR2boJ+BFfhnL/KPN7R7MKnoRf7Rrp+WiPzjjcg/3hjZOzqFz6PZjZHIv4ygpgzm1VSgrL466eIr6ZBfVYlIKIRQ75Bl6TB5XlvOkt1XcDPSulYb0EDr355Aa3MbPCms5WcYHkRCQdQeube1l4fuiPzTtHVsgn4GVuCfvcg/3tDuwaSiF/lHu35aIvKPNyL/eGNk7+gUP48SC0CRfxnD8HrQ/cyr6G1pU0P7kh4BGOwfQCwaQWRsDPBZ33hA5F9qXHxin1bnl5svG4jFULCwHtVqQ54U1vJTIwCjoTA6H3g2Pg04DfSvn8g/TVvHJuhnYAX+2Yv84w3tHkwqepF/tOunJSL/eCPyjzdG9o5O4/NoZgEo8i+jxCJRVO65Heob680RSMmOAPTk5SG3tBQ5VaVA2NrGAyL/NrC293lQYW1PPFa5+bIBtZmHx4vqZTuir7U76bdBcw1Aw0BBVRlKtmqMTwNO9aWhOyL/NG0dm6CfgRX4Zy/yjze0ezCp6EX+0a6floj8443IP94Y2Ts6zc+j6QWgyL+s0P6P1WhraQU8ya/lFxkdheH1Yd5xK+B2+dc5+A44jQJM5bwG8TbUhljMHFHr8XlQ0lBtSvbkp+OXY7RnAEPvtjC8eXav/MutKkV+XaX5J6esyNbW8RbmIa+ucvKPnfiKCzY6tycnvkv19BjwFuVveH5tuW1xGB4PSrZbgJpDdsOco/ZC1bLtkd9QZdv5vfm5G7fhLNfsZs/3GASuP6uI/OMN7R5MKnqRf7TrpyUi/3gj8o83RvaOtvB5tPk3ApF/WaN8163R0NiA1ubWpMWDItDfhw9/ck/8i0+S04e5yT83I61rM14P+l96DwNqOn6SqKsuPBo0i2Hk+swRvcmuyal//dwr/xTbXPd5lGzbZP7c+a/n8d71d9jWOrWH7YFFF51g/hyLRvHMyi/DLuaedADmnX7I5N+b/+9+rPv9w9M8M55Bw/HL0fj5I8yfw4MjeO6oyy29vuHzYu6J+6PhxJXIKS/e7HH/R21Y89P70Pfc25Zep3L5DlhyxWmTf//voV9DZDQw4/Mr9l2Kra46ffLvLxx9OUIDI+CLyD/e6P8JwiZ6kX+066clIv94I/KPN0b2jrb4ebTxUDORf1lDrRnW/9I7aG1pgy8/P+nj1BplxfPqUb18J5F/WZwGbPcowGTPt258+q9gI5Eoag7eDcXz65M/JhZDcVEuDPUeGkl+F2D9b57dLf/o128D9cctM6VcJjLwlRZi+1tXoemco6aVf4rCRfXY9ntfwJyjrW2aIyRC5B9vKL0DEY9e5B/t+mmJyD/eiPzjjZG9o234PNogAEX+ZRW1Zlh+QzWK59YjHAjE1xRLgkgwiOG1rajYfRsYasfSFDYfyOTIvzVdT4E7dklApzcW0YE1XU9DZ2oP3g2jnb1JX4eK3tau+PftSMRcR5D+zbPIP01bJy1yq8tQc+AuzmfgMbDNd842p/1OMNbWg+5H/4e2e57G4KsfTgnBwBYXfwpFWzQ4E4urEfnHG2rvQISjF/lHu35aIvKPNyL/eGNk72ibPo/iAlDknxaMtXZjeH0rcotLkp4C7PH5zOdW7b00vmNpkrWUab/ObAZiVd6lcryM/nNmN+6cyhLkVpQhHBhL6jpUklA9S11/ntxcePJzzXUEE74OdEfkn6atY4mGT690PIM5h++B0u0XTv69+ZcP4H+nXId3r74dH910F15fdSve+urPEQ2E4pF4PWg652jH4nEnIv94Q/UdiGD0Iv9o109LRP7xRuQfb4zsHW3j55FH5J8eTIzeC3T0Izg8lPTIIyUdShrrUTSvFgVNc5KaBsxZ/umwiYWSeKmKwHSO4dh22Uat3WdKv1gMHm+iTRM2oJ6fU1pm/txy+78QHVNrARqEb55F/mnaOpYpWjwPZTsvdvQ1ag/fc/Ln3tVvYN3tD8fXxJyCWvev5Zf/nPx7xZ5bI7fGvo1HuNYvOUT+8YZ2DyYVvcg/2vXTEpF/vBH5xxsje0fb/HmU/HaztnVt+fiYDnP0XjRe3YKq5HcfVaJwsLkVwdFRjDZ3zDoFmLP802UUYCpSL13xJ6P/HMLrQXhkDOGxUcTC4aSvweDgAPLKy1H/iX3Mc8wk4vW/OkT+cWfDKEBnKN56/uTPfc++NePz2u9/dsN1Yhgo3WGRo3GZLwPuiPzjDe0eTCp6kX+066clIv94I/KPN0b2jnbg8yi5IS7jiPxzfiOQ1y/9MZY/eGvyxxgGiubWY6StY9ZOIvLPmgScX7lHWsfaPbJP5J+DqBGAeR4Uz2vAyLq2pK/B/KpqUwJ+dOs9M24Aov/Ns8g/rqgdhhWGx4PKvbdDwbwajK7rsv111PR3T27Ohl8k+IesyMgYht9dC29hfNMrT25KtyMpo//1ZxWRf7yh3YNJRS/yj3b9tETkH29E/vHGyN7RDn0eJT0CUOSf88Q8HkSDYfg72pOfAhyLYWR9mzmSIqeqzFxPSVf5l6mNQJyaypruSEAK8i+T03913wCk7qi9kasG8SX5rmteq4aBcDCI9geeJXrzLPKPM+GBEfQ88Vr8Lx4D9Z9a4cjrqOnvE2v7Kcp23jLh81/9wg/xv9OuN/90Pujc+6v+159VRP7xhnYPJhW9yD/a9dMSkX+8EfnHGyN7Rzv4eZSUABT5lyHCERTMrUZFU0PSU4AnRh958/NRu3IXxMIRLeUfF7IpAWXkn7OY8txjoGrlTuhrUVI9+WMD/X2onVuLkh222Py80B2Rf26g9S+PT/5ce/ge8JUUOvI6/S+9N/lz9f47oWrZ9sgm+l9/VhH5xxvaPZhU9CL/aNdPS0T+8UbkH2+M7B3t8OfRrAJQ5F9mpwD3vfgO+ppbkx4BqBjr6UZOUTHqPrHv5ueEO28PnBzRttahUXjZkn+y+Uccc6OCaAyhngFzWn1KEr6yCl2tXRh67cONH4PuiPzTtHVsZ+jNNeYfhTc/F3XH7O3I66y7/aHJKcdqZOzW134Wi79xCvLqKpFpONVvekT+8YZ2DyYVvcg/2vXTEpF/vBH5xxsje0dn4PMooQAU+ZdZYtEYSrdbhNoURgCax5lf6Hzoeux/G/3erfLPUWKZl4Ay8i9DjF9zBU11GF6XvIRXz/LkeODLy0NudenkRjz6Xx0i/zRtHccymDoKsP6Ty2D4vLa/6tBbzfjoh3dNbmqlris14nDXP16Bra4+E6U7bj5K1gno1282RP7xhnYPJhW9yD/a9dMSkX+8EfnHGyN7R2fo82hGASjyLzsMvvkROlvaUNJYn/QxqlahoVEsOPPIjX7nLOm9QqbWAXSETS7KTEhAbvJP9/X/FIWNc5BbUpL8CEAAeV4gPDaGYPegKT70v3kW+adp6ziagVoHMNDea/6cW1OO6pU7OfLq7fc9g7e+9gsEu/o3ROT1mFOCt791FXb8+cUo322JI69tvha4I/KPN7R7MKnoRf7Rrp+WiPzjjcg/3hjZOzqDn0fTCkCRf9lDfUl64/KfYzDFacDevFwY48/3eO0f1UHx9sDWqa0zlEJJQCdEoBJ/mZB/Mv13CuObeag1OEPDw0m3oSc3F71r2/HCyVebx+t/dYj807R1HM9ATc1tvevJyb83fHqlY1H0Pfc2Xjr1eqz52T8Q7Bnc6LHibRqx3Q/PM0cE2r0WIf36zYbIP97Q7sGkohf5R7t+WiLyjzci/3hjZO/oDH8ebSYARf5lfx2y6mU7oiqFacBKFPo7OlDcVI/CuTWIRTbfCMSttwe2CK4kLkq7RGCmxJ9C5N/mNHxyBcb84aTfh9W1Fw0GTQlYtMXcidm/GiPyT9PWyVgGHQ/8F5GRMfPn4q3no3SHRY5Fo3YFXn/no3jxhG/h3at+a04PnooaEbjjLy5Gfn2VYzHwQuQfb2i/A5GKXuQf7fppicg/3oj8442RvaOz8Hm0kQAU+acHzb99EL0tbTB8vqSer0ShLz8fo+3dyK0uczAyF94epHhRTojAVGTgxPO5TfeltgGPGn1bvGQeggMD8dGASR1ooKyxHr6iIhjRmLmOp76I/NO0dTKagZJ/SgJmYhTg1H/Y6v7PK3jt3JvMqcET05AV+XOrse2N58JXXOB4HLQR+ccb2u9ApKIX+Ue7floi8o83Iv94Y2Tv6Cx9bZw0TCL/NMEwEGjvMXuEx+dDJBxO6rBIIGCuG7jgc0fj1QtuciIw286k1gFcULMMmUKNdKst3TrjF2UqEjDTtw7ZGP2n8/p/cXEXQ9WKHeHJyUE0FEzqOMPjgRpvG+jpQe8zb0BfRP5N4MnNQdPZG9ZL7XzoBfjfXw/apFZfNQ24/oTlZv+t2m975DdkbgRe37Nv4eVXbzCn/1bsuY35u4J5NZh/1mH4+NZ7MhYHLUT+8Ya2fiEVvcg/2vXTEpF/vBH5xxsje0dnccyIOQJQ5J9GxGLIKS1GbnllSmsAqueG/CGUbr8ovpupN+EGz667PUhZeGXwonSD/KNATlkRardagLB/JOlj1OjboeZW879KpqhRhPoh8m8qnlwf5p64/+QftelL0qTwnqxzfdUIvN4nX4//xWOg4YQVyCQRfwDvXP5rjHzYOvm7OUfsmdauxPQ/nWZD5B9vaPdgUtGL/KNdPy0R+ccbkX+8MbJ3dJa/TtiwZJV8fNhNaHAYwf4+lMypTL4KhoFoMARfYWH8S2okalM0ztRX692AGcu/bKHz6D+FkndluyzBQGd/yuUvrK83j1EbLKipjnoh8m9ToqGNR1XPttaqJ2fDUgyRsRC41Hf9n/8z+XPtkXvCW5xvOZrGsw7D9j++0Pyz6KLjEz5XfV6tv+PRyb97i/JTHolo2CBltXS6k4j84w3tOwBS0Yv8o10/LRH5xxuRf7wxsne0BvedFoeryMeHU7z21dswuL4d8CRfomg0glgogJoDdrUpCl71TWrkG3P5J6P/pqmDxzDl3ZzD94yP5EuhPaORCPztbXj28EttHnVrByL/piMaCCEW2rBRkqcgN2Er+ko2rE0XGRkFl/oOvbnG/KPwFuSh7uh9LEeU11CF0u0Xmn+Kt5o/6/NH13dtNj071ewjgY2lrCc/8Tm8+RvXOzoagJ6I/OMN7fsrUtGL/KNdPy0R+ccbkX+8MVwt/xQWvrHKx4eTqC9CNXPrlNVL+pjQ0BBqGuZg/mcOtaFEPOubUICJ/HMlExt31CzfGbFoJKVp9768fLPfmBIhyV27M4PIv0QEOvsmfy5cUDfj89SotLzaism/j63vBqf6tv7liY1ytUqof3ijzT1muybyaso3Pr53KKnXMRIckz+3JvFrqrimbIiy6YhQPRD5xxudPiuYRy/yj3b9tETkH29E/vFG5J8FASgfH06i1hHrWf06OprbkFNamvxxhoH2lrbJL6yGJ/X1lMbPhEyQrWnA00pAkX+unf6rUFMP1ZT78NhYSseVzqlAbmkp8usrgXDy8tBZRP7N1joTI98UVSt22mia71Sq9995o4Uyht5qBqf69jzx6kY78lpl6PWPJ3/OKS9GxV7xTT5mouaQ3SZ/VnEEewdTzn7kg/WITbn2qlbuOPPBHgNVy7ef/Ovw2y3QD5F/vKF9/0wqepF/tOunJSL/eCPyjzci/ywIQPn4cJrJdcQMwONNTeKVN9ajqL4GOWXFiEXSERLuqO9GElDkn3sZH6FUtWxH9K9tT/nwoZ4hhIYGMdaqdu7WAZF/ybRO16P/m/xdXm05Fl92Kjx5G08dLdluARace/Tk39WGFf6P28Cpvmrqe9vd9v1DTN9zb28k8bb82kkoXFQ/7XPnHLUXqpbvMPn3zn+/kFb20bEg+v771uTf6z+5DGW7LZn2+KZzjkbBlE1fuh9/BXoh8o83tO+vSEUv8o92/bRE5B9vRP7xRuTfVKYf9jAj8vGRSXpXv455nzzInGo420L1Ewyu6zClRsMJK9H8q/uhe33VKMAFNcuQLQlYW7J1xl7PjWv+6T/6b3z674G7wFdUhPDwhimMs2IYCA0P462v/zy+/l/WNwAR+Zds6yhhpEYBKsmnqD5wF5TuvCX6n3/H3JxCTQue3FF9nLW/+Rc41rf9/mcx/6zD4C3Ms2V9xTU/uQ9LrjjN/HtuZSl2/L+voPPB5zHw0nuIjAbMEeqV+y1FxV7bbjT6b/2fNmxKkmr2625/GBX7bBffidvnxbY/OBfdD7+EvufeQWTYj7w5leZow5LtF04eo6R9VxLSMXOI/OMN7ftnUtGL/KNdPy0R+ccbkX+8EflnQQDKx0em6V79GppOPiRp+TcxoqNobj0ajltuCkA1nTi5nUldWN/YuAQsdV4CulH+UfqiUHfgnvC3dSZ/WCyG/OpqRP3DKN9t641GIGUHkX8ptU4shneu/A22v/WCyZ1nlayqPWyPaY9ff+ej6HnyVXCsr1oHr+OB/6LhUytsOV/XQy+a6/+pHYEVanp13TH7mH+mI9jVj7cu/YUZR7rZD7/TgjW3/R0LVx1rSlslAmsO3d38Mx3hIT/eu+q3prDUA5F/vKF9f0UqepF/tOunJSL/eCPyjzci/yxMAZaPj0yjxF37P5/FUHMbCuunn0I1k5gYXteK4sZ5yK0uM/+exKshm2RlLcBY5kSZW+Wf/qP/4lQt2wGGJ76jbyoUFuUi6A/g49v+huwi8i+d1lHi6dWzf2DKr5n+kSTQ2Y/3rv091vzsPnCub+tfnzD/8cgu1GjJt7/xfwmnTKvNN9rvewYvn/V9+Ne0W86+7a4n8M5lv0p4LkXfM2/itXNuwvC7a6EHIv94Q/v+mVT0Iv9o109LRP7xRuQfb0T+WRgBKB8f2WDiC6kBA8GBgaSPU6MFfYWFiPn9yCkpRLB7tmNdWN9pbhKdGgnoVvlHAo8Bw/CgbMctMaKmzitZnuRoW3Wd9a/v1ODqEflnpXXUSLAPbvgjmn9xP8p328ocDah2YFe72Q6/22JOE05uBHV69Dz12gZJFrO3vkps9r/0rvlzNJRYbqspuK+d+yN4C3LjodiwoU3v6jfR+8xbKFpUb061zqkqNUcDhgf98De3Y/C1jxKO+ksn+97Vb6D3mTfNdQfN16wogTc/B+HhMTPHwdc+RLAr+c9T5xH5x5vsf0K4JnqRf7TrpyUi/3gj8o83Iv8SYcxfeFyCj035+MgmqvUXnH00tv/Gmehvbk1pKrAaNbjmjgfwzjW/nuUV9CEjawEmcZNolwg0XCz+qIz+U+xx19UoXjjfXM8vGcw1OdV/DQMvnfptjLX2quGDyDwi/zRtHZugn4EV+Gcv8o83tHswqehF/tGun5aI/OONyD/eiPyzMAVYPj6yidn6HgN9z7+N0cGxlOSfIjIWQM3+O8f/ojYomP4V3EUscyLNzfKPEobPh7pdt0VwaCil44qbGpBfUoSynReL/NMQ+u9u9DOwAv/sRf7xhnYPJhW9yD/a9dMSkX+8EfnHG5F/FgSgfHxkk6mtP/DqBwj09aKkMfl1ABXqmNKmBsw/7dBpdifVs76OrgUYS12opSvVMtm6VuJ0Ckqj/+adtD/8Q4mnIU6HV+0iOuhHxz+eQeaRkX+ato5N0M/ACvyzF/nHG9o9mFT0Iv9o109LRP7xRuQfb0T+WRCA8vGRTTZq/Wj87ubNy3+OoZaZF1OfaZriWN8Iirdq2mRdM73r64gEtHCTmKpcy7T80w1K8k8x75SDEfL7kx5hq7pSbkkJhtp78Nr5N5mb9WQWkX+ato5N0M/ACvyzF/nHG9o9mFT0Iv9o109LRP7xRuQfb0T+pcIm317l4yObzNT6OeUlqE5xBODEZiDV++2A0qWLZnkFxsTsG2U3m3DLROsmG4swC4aBra48AzXbLEQshd1/PV4vckpKEAkEMPLh+gw3s8g/TVvHJuhnYAX+2Yv84w3tHkwqepF/tOunJSL/eCPyjzci/ywIQPn4yCaJWr/v+bfQ1dIKT05OSudUuwcbXgMNx68gVV/bRgE6cJM4k3xzunUpSD8yo//UqL1YDGU7b4ne5lbEwuHkjzUMjLS2orypASVbNTq6Q+wmLwx3fdlKDTrvbnwzsAL/7EX+8YZ2DyYVvcg/2vXTEpF/vBH5xxuRfxYEoHx8ZJPZWj/YPYCPfnoPiuqrUzpvZGwUJfPqULNyF1DDsgSMZW4knlNXD6XRfmTknyISheExULZky5Q211HT6tUIwNyKUrxzy1/M9Tkzg8g/TVvHJuhnYAX+2Yv84w3tHkwqepF/tOunJSL/eCPyjzci/9LFl+03P7eTbOuv//NjWHTuJ5FXXmaO7EuWobXtyCksQtmOizH4xocZHLFkjwRcULNM65tEVb/pBF1t6dYpnYeC5GMh/8aZc9Q+KCz0YTQWS1oCqqdVzKk0R+O2/PZf5ihC5xH5p2nr2AT9DKzAP3uRf7yh3YNJRS/yj3b9tETkH29E/vFG5J8VfJaOFjLXdZV98AB5ZYUpCUAlKXJLS7HovOPw8jnfA3syLP84Cj3uFG05F/NOPhC96zpSOs6Tk4veth7z51DfEJxH5J+mrWMT9DOwAv/sRf7xhnYPJhW9yD/a9dMSkX+8EfnHG5F/Vsn0FpZCul3XAJ5acb45ok9NRUyFkbZWbHnwHlj8lZN4TwXWRP65CYqj/xZfehIa9toeiEZTmgIcjUQQDgawesWFGdj9V+Sfpq1jE/QzsAL/7EX+8YZ2DyYVvcg/2vXTEpF/vBH5xxuRf3YgApBK143GULHndpgzvy6t12xvaUVeXZU5ktB5eZEFCSjyL+OQk3/jsq9yt6XxzT9SEOlqR+2SeXOQW1SMvLrKlCV8ioEia8iGHxnA3V/f+Gcv8o83tHswqehF/tGun5aI/OONyD/eiPyzC1omyOVdt++5N9He3Iai+obUXtMwUNrYgMo9tzOnBFNaBzApCSjyL+OQk3/j5M+pRGRsLC7Ckxz9Z27+kZsLf1c/QiPDCLT3mkLeGUT+ado6NkE/Ayvwz17kH29o92BS0Yv8o10/LRH5xxuRf7wR+WcnIgCJvTX97+zvIjg4ODmaKVkCA354vQYKF6Q3glBbCSjyLwt1oCn/jFgMNQfugvya6pSuRSUKo6EQcstK8M6Vv3EyQmQNGfmXAdz99Y1/9iL/eEO7B5OKXuQf7fppicg/3oj8443IP7sRAUjsrWnkg3XmKKTiFKcCq41DCutrsOhLnyQ3BXhGCSjyLwvtT1D+qdF+AOaffii2/PLJCPT2JX2oGv1neL2mAPS3daLnyVecChJZQ+RfBnD31zf+2Yv84w3tHkwqepF/tOunJSL/eCPyjzci/5yArgly61uT14PVR34VQy2t8Obnp3ToSFsPKnffBo2fPQKUMSWgyL8stPvTNN/kJtb+23cpouFwfApwKtPn59YiFonglc/f4FCEIv80bR2boJ+BFfhnL/KPN7R7MKnoRf7Rrp+WiPzjjcg/3oj8cwoRgNTemiJRRP1xgVFUW5HSodFQEMWN9Wg4Zlk8Ng/RW4tYirsDW4BoC9kOVfmn6heLxte8rF25J2KRcNLHTqz9N9zRi0g4hJEP1jsUYZaQkX8ZwN3vIPyzF/nHG9o9mFT0Iv9o109LRP7xRuQfb0T+OYkIQKJvTWpS40BzqykoUmG4pQ1F8+eiZLuFiDm2kYGDTAnZaQkoN1/05Z+a7u4rK8JWV52J0NCQOQIwFSrqqhAKjMEwnHirFPmnaevYBP0MrMA/e5F/vKHdg0lFL/KPdv20ROQfb0T+8Ubkn9OIACT60fP8ad9GSWMDIoFAysd6c3Ow6y+/gZzKEoD4TaJTElBuvujLP4Xa8Tq/rgqLzzwS4ZGRpHf+naCvvRcGYli94gLA63UgwixAwPvTv/7oZ2AF/tmL/OMN7R5MKnqRf7TrpyUi/3gj8o83Iv8ygQhAkh89BsbWdWJobRvyK6tSPnq0sxOFcyox9/j9weEm0W4JKDdfPOSfomLPbbHNd87GSN+wOaU3tRMZiISCyCutgLe4AIhEHIgww4j8ywDufgfhn73IP97Q7sGkohf5R7t+WiLyjzci/3gj8i9TiAAkKP8mePPSn8Kbl5fWWQK9Q1h4+uEo23kxONwk2iUB5eaLifwbH+lXsde2KN92K3P6byqj/wyvD7WN9cgtLsBb1/wfIsOjdkeYeUT+ZQB3v4Pwz17kH29o92BS0Yv8o10/LRH5xxuRf7wR+ZdJRAASlX/wGOh9/i3429pQNLc+5TOFhodROLcGCz9/zPipDfI3iUoCWhGBmrZAxsUfefmnGB/tN+eIvcypv6mgRgrGohH0dPQhODiC9nvsag+Rf5q2jk3Qz8AK/LMX+ccb2j2YVPQi/2jXT0tE/vFG5B9vRP5lGhGAFOWfYnwDjxdOvxb+9i4YntRLOby+C6XbLUBeXeWkMNGKNENKRwLKzRfdUX+b1k9t/KFoOH4FvHm5CA4NpngyAyXz65BbVIS3vvYzByLMMBpe2vyuP/oZWIF/9iL/eEO7B5OKXuQf7fppicg/3oj8443Iv2wgApCi/JvC6NoORMIhFM+bk/JZY5EwiubVY7ffXgYjNweGx2Bzk5iKBNQo66zBRf5NbPyh2OEH58Obn5fyxh/5FZVm9xvr6UHfc287EGEGEfmXAdz9DsI/e5F/vKHdg0lFL/KPdv20ROQfb0T+8UbkX7YQAUhY/pmPer148dRvY7C5Db7CwpTPPrKuDUXz56NityWIjY8qzDo2hZHMlGC333xRnvI7Xf2UxM6vr8LSH5yHQN8IImNjKZ9zrLcHw+s68NJnrjWn2tsbYQbR5HLmff3Rz8AK/LMX+ccb2j2YVPQi/2jXT0tE/vFG5B9vRP5lExGAhOWfIhaJYKy1CwZiyK8uS+9lolHseOMqU5xwvEmcSQK6/eaLsvibqX5KYhcurEfT8fsjODiQ8tqWFY318Ob6zOtqdG3n5FR7+yLMECL/MoC730H4Zy/yjze0ezCp6EX+0a6floj8443IP96I/Ms2IgAJy7/JZ3q9eOqQizHc3Ir86uqUX2mspxuFc6ox/9RDwPUmcdPRgG6++aI+6i9R/aoP3g1LrjoDI71DqW/8EYuhb30HIsEIVh94sUMRZgCRfxnAze8gbshe5B9vaPdgUtGL/KNdPy0R+ccbkX+8EfmnAyIAics/hRqtFAuF8dqXb0n7FUe7BjDvmGWoOWR3cL5JVBKw2cJOwZThIP5muzrKd1mCovo6hIeHU1r7z5uXh9qmBuQUF+GDG+4AIhGHInQYkX8ZwN1f3/hnL/KPN7R7MKnoRf7Rrp+WiPzjjcg/3oj80wURgMTl34bDDPS/8gFGu7pQNL8+5cPDo34UzqtF4ykHoaAh9VGEVG4SjRTWB+QCF/E349XhMWD4fNj6qjOxxReOQ3AojdF/kQj6egYR6h9Ex4PP2R1hZhD5lwHc/fWNf/Yi/3hDuweTil7kH+36aYnIP96I/OONyD+dEAHIQf4pYvG7redOvBLDa1tNIZIqauODksVN2P6m81G593bgKv+mwlkEchJ/Ca+OaAzewlwULmow+34sHE753IV1tfDk5OL1i251IkLnEfmXAdz99Y1/9iL/eEO7B5OKXuQf7fppicg/3oj8443IP91I3RK5FK3l3xSCnf0wYgaKG2ow1NKW0rGxaNQcSVi9+1JgVQzPP/umLTHN/ILIGLO17lQJuKBmGajCSfjNVj+146/a9KPh0/uj6QtHoXyLxpT7vKKwvh5h/xgCfb0YeOUDGyPMECL/MoC7v77xz17kH29o92BS0Yv8o10/LRH5xxuRf7wR+acjxvyFnyTw9TG7UJF/Jl4PckqLsPffrkdOaQlCKU6HnKCksR5tj72A/33+hvH4Ymzl30xQEoFcxV8y9dv7oR+gYE4tgv39KZ9bTf+FoQZCR/HCp65CsGtgcjStfRE6CIF3b/pffuhnYAX+2Yv84w3tHkwqepF/tOunJSL/eCPyjzci/3RFRgBykn+KSBShviHztHnlxWkLQH9HLwoXNsBbXIDI8Kjr5J9i06nBOglBzsIvqfp5PfDm5WLxV09CfnUVgn195ujVVM9e3VSP/s4eREYD5uhZGyN0HpF/GcDdX9/4Zy/yjze0ezCp6EX+0a6floj8443IP96I/NMZGQGYqHGcb35nzurxIBaLYtljt6BwTh1GOzvSOk9xYz2G13XiyeXnwfB6EItEXSP/kiGTQtAtwi+V+nnycrD/S79FoKcnvZF/yiPm5CIaCuHplRc4EKGDiPzLAO7++sY/e5F/vKHdg0lFL/KPdv20ROQfb0T+8Ubkn+7ICEBm8m9yLT8AL593I/a689vx38ViMFIcITW8th05xcWo2HM7DL75kfWRgIzkn2K6zUPskIJulH2p1q/mkN0x78QD0u7bvsJCVNSUY3BwBK9f/EsHInQQkX8ZwN1f3/hnL/KPN7R7MKnoRf7Rrp+WiPzjjcg/3oj8o4CMAJyuURi8gjkdMhbDssdvRW1jPXraexENBlI+TV5VFQK9Pebov/8edxlCSgKmMxKQmfzTPQLKzNZ6+Q3VOGL1T9HXN4LQ0GBaXdHj8yG3uBhjfX1YvfJCmyN0EJF/GcDd1y//7EX+8YZ2DyYVvcg/2vXTEpF/vBH5xxuRf1RQq98L3OSfYnyK47PHfB2dza3wxCLIq6hI+TRqeqUaYVW6YC7mHL2vyL9Zkds/J1vPV1qIpi8cja7WLgQHB1I+v+rLBTW18ObnY7S3F69ffJvNETqIyL8M4O7rl3/2Iv94Q7sHk4pe5B/t+mmJyD/eiPzjjcg/SsgIwKmNweAVpsNbmI99//kDFM2tw8j6trTO4cnJQSQQwLo/P4aPf/53cxOGpEYCysg/wY6rw2OgZOsm7H7nNcgrK8BQS3r92Jwu7PEA0Vga6/6J/NO0dWyCfgZW4J+9yD/e0O7BpKIX+Ue7floi8o83Iv94I/KPGjICkLn8U0T8Y/jvp69AqLcXhfX1aZ1DbZSgRgEuPudYFC+ZL/JvM+T2z9HWi8ZQuLAOYf8IBptb03qNnJJSFDc2mGtk/vfor8cldtJrB4r807R1bIJ+Blbgn73IP97Q7sGkohf5R7t+WiLyjzci/3gj8o8iIgCZy78Jgp39CIwGEOjvT0F6bIwadRUcDeKwf92ExjMPT/xkGfkn2LXm39wa7PDTr2Dn274Cw+tNecOPCdR6gdGxoNn/w0P+uMQenypvLUIHkWm/GSD778/ZhH/2Iv94Q7sHk4pe5B/t+mmJyD/eiPzjjcg/qrheALpB/k3w1MpViIyOomR+XdrniAQD6O0ZwsLPHxUfCTgdIv8EG6+O8l0Wo+mwvTDc0obI2FhabVvSGB/56u/sxuoVqUz9FfmnaevYBP0MrMA/e5F/vKHdg0lFL/KPdv20ROQfb0T+8UbkH2VcLQDdJP9MvB48e9xl5hTKnNJScz20VFGjr8IjwyhumIOmM46I/9IzJU+Rf0KyfWm2x70e1B29DxacfQwGO/vS6q9ml4zFMNjSBm9BAV7+7A0pHCnyT9PWsQn6GViBf/Yi/3hDuweTil7kH+36aYnIP96I/OONyD/quFYAuk7+KSJRhPqGsOZX95s7qOZXVaV9quH1najadyn2/Nt1qF65S1wCivwTbLw66o9fjn1v+TLy66vNkX/pTP3NKSlBeVMDCgoLsPaOf8P/UbLrB4r807R1bIJ+Blbgn73IP97Q7sGkohf5R7t+WiLyjzci/3gj8o8DrhSArpR/4xgeA2v/8BAMGBjr7UXR3PQ2BYlFIvAVFqJyx62wxfmfBCKZu0vMfutmPwLKJNN6vrJizD35ILQ3tyI0MpLWqD/1JzQ8jP7mVoz5R7HmZ3+3MUKHkDX/MoC7r1/+2Yv84w3tHkwqepF/tOunJSL/eCPyjzci/7jgOgHoZvmniEVjpgR8cuUqGIhhpLXd3FghHcJ+P0bWtqFmp62w3XfOQfFWM6wJyKp1sx8BZZJpPbXBzF73XY/qnbYyR/2lM/JPHVPV1ABvXp7589MrLkA0ELIpQocQ+ZcB3H398s9e5B9vaPdgUtGL/KNdPy0R+ccbkX+8EfnHCWP+wk8S+NppD26Xf5uHamC//9yMssYGc4ffdPHk5CASDKKiqQGvXPMrtPzmQXO9QXOXVVatm/0IKJOo9QyPB8VbN2KHWy5E6RbzzCnmapRpOnh8OcivrkZgoN/c9EbJP+sROgyBd2H6vZ9+Blbgn73IP97Q7sGkohf5R7t+WiLyjzci/3gj8o8brhkBKPJvmhu8WAxP73+BuSlIfk2NKU7SIRqKj6wKhYGtzzshvjuwyD8hhesvFo2icGEdcqsqzP6YrvybWPfP39Furhv44inXJHmUyD9NW8cm6GdgBf7Zi/zjDe0eTCp6kX+066clIv94I/KPNyL/OOIKASjyLwEx4O1v/RqjXV3ILS9Pv40NAyOtbQgDOPjfN2HhuZ+IP6BGApK/+cp+BJSZrfVyq0qx9AfnYfvvXYhYOJzWlN/4Cxkoa6zHWF8vfAUFaLtvNcbWd9sQoYPIyL8M4O7rl3/2Iv94Q7sHk4pe5B/t+mmJyD/eiPzjjcg/rrCfAizyLzk8ebnY9983omR+PYbXpj8dWI0q9OTlm6OvPv71/ei4bzVCA6lv4qDPzVf2I6DMTK2n1qFU61E2nX0UGk5YibLFTZb6ndrwQ4lDT36+Oe139coLTSGo+mN6EWYAAu+89Hs//QyswD97kX+8od2DSUUv8o92/bRE5B9vRP7xRuQfZ1iPABT5lzzRQND871jPALwFBTB8vjQb3UA0GEBBbS22OOdY7HXP9fAWF8BIYyRg9m++sh8BZRK1npJ/vtIi7HjZGcgpKbImnQHkV1ahtrEenhzfhhGEntn6nMg/TVvHJuhnYAX+2Yv84w3tHkwqepF/tOunJSL/eCPyjzci/3hj8BWAIv9S56mVqxDy+xEeHUVxQ42l9h/t6kQ0EkHJwrko3W4RYpNrAhpEbr6yHwFlZmu94iXzsOQbp2KwdwjRUFw+pzvyTwnr4NAgOlpaERoa2rDpR8J1BEX+8e799DOwAv/sRf7xhnYPJhW9yD/a9dMSkX+8EfnHG5F/bqgvyynAIv+ssfzxW817wsI5dfC3t6W/JpvakKG4BMGRIXhzcvHUwRchMjxK4OYr+xFQJlHrqdGgjWcejgVnHRXfrKPN2sg/RU1jPTpa2sx/zXjm0EsQHZtNKIr807R1bIJ+Blbgn73IP97Q7sGkohf5R7t+WiLyjzci/3gj8s8t9WUnAEX+2cOyx29FeWM9Bta2w/B4LO3KqihR5/poHfxr2vC/z92g8c1X9iOgTKLWq//kcjR+7khUbLsIw2vbk1ifLzGFDfUIDY0gFg0j7B/B08svjG86k3AHapF/vHs//QyswD97kX+8od2DSUUv8o92/bRE5B9vRP7xRuSfm+rLSgCK/LNfAipJU97UgIEW6yO1VEdTUrHjudfxwc13offZNzW7+cp+BJSZsfU8Hmx99ZlYfNrhGOzoRSQQsPQ65rTf3FwYXi8iY6OIwcDqiWm/6UXoPATeZen3fvoZWIF/9iL/eEO7B5OKXuQf7fppicg/3oj8443IP7fVl80agCL/7OepFavM6b/9LW0onl+f/sYgU2rk7x1C/txabPHlT6OgoXqjx7JL9iOgzLStN7EXR64PBfNq0dvSZln+KdR08tr6aoRG1XRyA88eekm6EWYGkX8ZwN3XL//sRf7xhnYPJhW9yD/a9dMSkX+8EfnHG5F/bqwvCwEo8s+5m8QnV6wyZ2oOt3bC4/Wao7nUCKx0CQ0Pm9OJ5+2+Hba9/mzUHLK7Bjdf2Y+AMjO1nhLGTWcfjf0euxm1K3a1pZXVVPJIKIieviG14bS54Uc0GE4zwgwg8i8DuPv65Z+9yD/e0O7BpKIX+Ue7floi8o83Iv94I/LPrfUlPwVY5J8DTNMjlj1xq9nY1fPr0d3SZqndlUBUIwvV2oL18+bgpR/fjXV3PISxth4YHgOxaCa7pNz+OdF6c47cGwvOPhqVOy7G0LoOIJpoXb4k+4zHA29+PsL+0Un5l36EGYDAOyv93k8/Ayvwz17kH29o92BS0Yv8o10/LRH5xxuRf7wR+efm+pIWgCL/HCA2y5qABsyRgHmVVRjr6rS+lltenjmiq3J+PZ469Sr0v/geYsEQTMNjcZOI2ZHbP7tbr3SXxWg643DMO2YZRrsGEB71ww58RUWorirFoH8U/u5+U/4ZXrU5jWz44d7eTz8DK/DPXuQfb2j3YFLRi/yjXT8tEfnHG5F/vBH552r5R1kAivxzgCR6QvWKnbDN1Z9FUUMD/G1ttr1sYW0tRru6EfGP4aUzr0OgvRfOIrd/trTeuKjNq69E4xmHoen0Y8zRfmM93XYUydzoo3huLYbXdyAaieKFT12JYGd/KhFmHgLvqPR7P/0MrMA/e5F/vKHdg0lFL/KPdv20ROQfb0T+8Ubkn9vlH6gKQJF/DpBKLzCA/f5zCwwYKG2qx5ANOwSbIcRiKG1qwGBzK4bebsaa/7sPA/97H/Yjt392tt780w9D41mHobhxLkbW2dMXFMWN9Rhe2w5vQT5CIyN4ZuVFaUaYQQi8m9Lv/fQzsAL/7EX+8YZ2DyYVvcg/2vXTEpF/vBH5xxuRf7wxkn6UnAAU+ecA6fQAw8Dyx29GDAbyKyoR6O2JjwazA48HHp8Pc+qq8Px3bsf6u/6DUO+QTesDyu2fXa1XffBuWPD5o1Gzx7YYXt+FWGS2zTiSx9xoxuOJTwOPAf/7zLUYXZvMlHORf5q2jk3Qz8AK/LMX+ccb2j2YVPQi/2jXT0tE/vFG5B9vRP7xxkjpUVICUOSfA8QsFCMGLH/iVsQQQ25xKULDQ5MbfFgOKxZDTlERQqOjKKqvwzPHfhVDb35s8axy+2cFj9oBOhpFyXYL0XjmYZh/wgEI9A6ZOzvbidroo7S2AqPd/RgbGcXTKy8A1A7UkcgsR4r807R1bIJ+Blbgn73IP97Q7sGkohf5R7t+WiLyjzci/3gj8o83RsqPkhGAIv8cwGLlJ0bkKQmozpVbUQ6P12fb+m8TIrBobgP87R0IDY6g7d4n0fLrf05u/jD7RhCT0doWk6sYX+NPtV5ORYkp/prOPAbe3ByMdnba/lol8+swvK7d3DTYQCzJnX7Ng5E1CLyD0u/99DOwAv/sRf7xhnYPJhW9yD/a9dMSkX+8EfnHG5F/vDHSepSEABT55wA2VX1CAio5tNe918PweJBTXIzg4KCtdVPhqpGFdfPr8PZdj+Gjn/wN/o/bk9wtWG7/0mJ8JKcRi6HhxAPQ9LkjULa4CcM2rfk4lcL6egT6+xEZHTWl7+sX3ILB1z5MNlBkDe3fPTn0fvoZWIF/9iL/eEO7B5OKXuQf7fppicg/3oj8443IP94YaT+qvQAU+ecATlTc6wEiUSx74lbUNtaje30nYpGIbVOCFea5xteFq2qsR29rF3qffQNjbT344MY/zTAaUG7/UsZjoGrfHbBo1SfR88QrqDlwV1TtvBVG2noQDQVhJ96CAhTUlGOouRVlDbUYaOvC6qRH/SlE/mnaOjZBPwMr8M9e5B9vaPdgUtGL/KNdPy0R+ccbkX+8EfnHG8PCo5oLQJF/DpCBaisJqHYIntNYh672HkSD9kojk1gMnrw8UzIW1tWi7dHnsOYn92Lg1am7BsvtX9LyVhGJomjLuWg883A0nXQoouEYggP98OYXINjf50AJY/B4vcitKMVYT79Z09UrL0zhDCL/NG0dm6CfgRX4Zy/yjze0ezCp6EX+0a6floj8443IP96I/OONYeFRzQWgyD8HyGClfYX52Puf30dufg7y51RjaG17ElN103ytoiJ48/IQHh1FZGwMXY+9hNa7n8TgGx/HX3N8dKIwTduVFJiiz0AUjWcdgQVnHY3c0lL42+2f5rspxY31CI0EEejpwQsnfguB9t4Ujhb5p2nr2AT9DKzAP3uRf7yh3YNJRS/yj3b9tETkH29E/vFG5B9vDAuPai4ARf45QCzz9fOVFmGvf3wXHp/PHBGo/hcJBm2bEjyVianGhteLsrm1WPfw8xjr7MPwOy1Y+4eHNjzRY5jPS27jEIZ4DCAa7wz1xy3Dlhd9CtFQGLFYFOVbNjkqaicoqJ2DSGAMRjiEwPAInk5p1J9C5J+mrWMT9DOwAv/sRf7xhnYPJhW9yD/a9dMSkX+8EfnHG5F/vDEsPKq5ABT5x0P+TWU/c5fg+Pp9hXV1GGlt3fB8m2XghAj05Oaisq4Kve09CI2MoPfJ19Hy+38jPDSCYPfghtf3ehGLRkhs5pAWZvvGzP9Vr9gJOZWl6P/fu1jy9VMx97C94e/sM0dNGj4fYuGwo6HklJQgr7wYY109CI0Fzb4yuctvUpu5mE9E1iDQR+h/+aGfgRX4Zy/yjze0ezCp6EX+0a6floj8443IP96I/OONYeFRzQWgyD9+8m9S7BjAssdvRQwx+PLyUTKnEoNt3YiGQs6lPbEBSSyGwrkNyPcBPc2tCA+PovWeJ9F615MIDwxvfCCD6cITOzN7C/MR8Y8hf36Nua7fwtOOjo/CDATN/6qptxmJx+dDcUMNhtd1IhqNmLsKv3jyNebmLROxJnkmZA1t3iU5f/mhn4EV+Gcv8o83tHswqehF/tGun5aI/OONyD/eiPzjjWHhUc0FoMg/hvJv6uMeD2LR+C7B8QFpMXh8OcivrsZoR7vj8amRgVMpb2qA0ny9b3+EYGcf1v7+YXQ9+tJmI9HMEYKRCHRjalyTEs3rQfGS+Rh+uxkLzj0a9cctx/C7a1Gxy9YorKvByPo2W3dlToai+fUYXtsKX34BwqNjZvNOjvpLCZF/mraOTdDPwAr8sxf5xxvaPZhU9CL/aNdPS0T+8UbkH29E/vHGsPCo5gJQ5B9v+TfdCLuJacHenBx4CwsRGhoyBWEm5NSEDJx4LU9ODirqqzE0OIax7i4MvdWMNb+8H6HuQYyu79rseMOn5Fs0nrgSb+o8Ez87wKTg83lhRKPjss8LRCJo+NQK5JaVoP/VD7DV105Fza5bo+/DtSjfYj6G23vgzc9HeGQk4xJTiV1FdHQEgWG/2dbpiT+FyD9NW8cm6GdgBf7Zi/zjDe0eTCp6kX+066clIv94I/KPNyL/eGNYeFRzASjyz0XybxomRwQaQFFdPUbaWuObdGRwpNpUIah+zq+sRElJPnrWdyLsH0X7fc8gNDyKmgN2Nn/u+s/LCPUMmMcUNM3BaHPHhhF5U0cQ+rxAOLLZtOKJ0ZCTj6vNS9RhUwSi4fWYkrFk6UIMvfExynZZjEBnv/nYdj/4Irw+H0Y+bkPjCQcgNDRmrnkYGh421zv0jMeS6dF+ZsqFhcivLsNYh1rnL7Cx+DOTTLWDivzTtHVsgn4GVuCfvcg/3tDuwaSiF/lHu35aIvKPNyL/eCPyjzeGhUc1F4Ai/9wt/yZkmZHjw34P/9CUgGp9wMI5lRhe35m1qbdTpwurHIubGjDWO4TCyhKExiIIDgyYsQ+8/REWrNgVrf97Fz3PvoH+599G95OvYtF5x2H9PU8g1DMIb34ecqpK4f+4DbUH747Oh18w1+bzFhcgPDgc3xhlYT2G3lyDeacejPV//Q8Wf+UkdD/5ChqOXY7FJ+yP9S++hdrdtsXA2vb4yLoYMNrdhdySkvjIySyIvk1ReRTPm4OhtR3xTVUMA698/nsYeX9diuv8bXRWZI2sj4t2w5cf+hlYgX/2Iv94Q7sHk4pe5B/t+mmJyD/eiPzjjcg/3hgWHtVcAIr8c7n8m3qu8RFrajRg1JRZHtMN5paVIdDXF39OlgTXptOFp/49p7jYHHXnzctDJBBAWWM9+tesR+2CuRgJAcNr18Gbl4ucklKM9fagZsFcBAAMt7Qhr6ISYz1qerGB4vlzMbyuFTVNDehas958XldzK0qbGjDUsmHdvqmiTwfpNxFD0dx6+Nu74CvKR2hwxFzfcXXa030nEPmnaevYBP0MrMA/e5F/vKHdg0lFz/QOnW90FBD5xxuRf7wR+ccbw8KjmgtAkX8OQFT+TS8Cb1PzYc0pspVz52BkOIjQ0KA5bVaXDTk2FXCTYnBieq/5F2NyOi4MD6BGxnk88YfU78Nh8/nRSGTyOJ0E30yoUYiRsTHkV5YgEgQig/0I+MfMTpj+On9TEfmnaevYBP0MrMA/e5F/vKHdg0lFL/KPdv20ROQfb0T+8UbkH28MC49qLgBF/jkAA/k3HWpEoEqtoKYSY129qGisR29LmxnDpiPzBOdRG4oU1lZgpK0b0XDIdLTmFG6PgWcOuQTRQBDwjH/532TX5eQR+adp69gE/QyswD97kX+8od2DSUUv8o92/bRE5B9vRP7xRuQfbwwLj2ouAEX+OQBT+WeKpPF14/Z7/Nbx/SPiu4UU1FSjsDAHves6ADUqUOPRcpSZbFdDTVOuw/C69vGRjNFJwTc54m9KvdJH5J+mrWMT9DOwAv/sRf7xhnYPJhW9yD/a9dMSkX+8EfnHG5F/vDEsPKq5ABT55wBc5d8MESx74hZzoxAlmrx5+eZvS+sq0dfcGt9JN9shMqJgzhyMdnSgaH49Aj2DCI+NIhqLwIgqIYj4Gn+b7G5sDZF/mraOTdDPwAr8sxf5xxvaPZhU9CL/aNdPS0T+8UbkH29E/vHGsPCo5gJQ5J8DuEz+TTIuneIbhkSRn5cHo6gYoZFhc2ONSGAMgf4+GKp9ZFRgyqiNV3KKCzHc2mZKViMaQTgYMiswMdrP8HoQs038bVLfTCO7/briHSSb8M9e5B9vaPdgUtGL/KNdPy0R+ccbkX+8EfnHG8PCo5oLQJF/DuBW+TcN+z1+S3x6sPqjRgbmeJFbVoGx7m7klpQgODQk04MT4MnNNTckUVN9C6rL4Ffr+0Vj5hp/8WnVBp5esQrOIfJP09axCfoZWIF/9iL/eEO7B5OKXuQf7fppicg/3oj8443IP94YFh7VXACK/HMAkX+bM77xxLLHb46vEwigvLYaefm56GxpMyVXNBiMPyLrBcKTl2e2h1rXb6ilDbnFhYiEIogGApNNqkb7qc09lFR1DpF/mraOTdDPwAr8sxf5xxvaPZhU9CL/aNdPS0T+8UbkH29E/vHGsPCo5gJQ5J8DiPxLityaMuxx17fNBjNXBjQMVMyvQygGDK+NC8FIIBDvoy6YJmz4fIiGQiicMwfRcBhjPb0ob6qHv3cAoRG/KfnUaL/JDT0cmea7WVTIGjLtNwPwv67cnb3IP97Q7sGkohf5R7t+WiLyjzci/3gj8o83hoVHNReAIv8cQORf2kxsHmKozWsNJQU9qG6sw+DAKEJDg4DHg1goFBeDweDklGFquwureBW5pWXmFN6coiLkFOZgsKUNcxrr0dvZa67nF1M7J5sDJw08vXzVBtlnzqXOREcT+adp69gE/QyswD97kX+8od2DSUUv8o92/bRE5B9vRP7xRuQfbwwLj2ouAEX+OYDIv/RR04MV41NZTRmo+mksvm6gatycwiJUVpeha32nKc9Cw0MoqK3GaFdPfOrwFBE4IdmyIQYn4pj4r1q7T43o8+TkoLShBv3NrahrakBna1c8xlgUhi8H4TE1tdfM2nR8T6+8cFL0KfmnfnZ2qu9URP5p2jo2QT8DK/DPXuQfb2j3YFLRi/yjXT8tEfnHG5F/vBH5xxvDwqOaC0CRfw4g8s9WNp3aqoTghBxT5JSVI9jfOz4aLr4rbiwSQVlVKbpb2lDRWI/+lrZJCefJyUU0FJeE5vnHBd3k600RdlP/m+hxs+wTvxufxpxfVY2xnm4Uza3H8LpWlDU1YLC5FTHDQEljPYKDwwgMDMVHOZonnsgohqdXXLhxI3i8QDSCzCPyT9PWsQn6GViBf/Yi/3hDuweTil7kH+36aYnIP96I/OONyD/eGBYe1VwAivxzAJF/mReCj9+y4XuuEnXxhQKRV5iHwMgoCivLzbXzDMOD2sY6dDS3obKpHqOjYQT6+lA4pwZjPX2mOPS3tyOvvByB/n4U1NSajxc11GC0ux95FeUYWd+KvIpKBPp6UTinzvxvUX01RnsGUVhVisDQGLwF+YiFIwgODiESDMDj8SIcCiE3LxchtWnHeKyeKVeguYFHTo45rdlEjfJzdD2/ZBD5p2nr2AT9DKzAP3uRf7yh3YNJRS/yj3b9tETkH29E/vFG5B9vDAuPai4ARf45gMi/7DFlLbwJQbjsiVvjRTH/NzFib7zzG0BBVSVGu3rhzfEgEo4gNz8P4XAUHq8HkWAIHp8XkVAYPq8PoXAIhYUFGPX74VU78kYipsCLhMPw5foQjcQQiaqhfBMjAuOjAE0fOX6xqRGCaiqvMWU0n6HWMlRPmnhiRtbzSwaRf5q2jk3Qz8AK/LMX+ccb2j2YVPQi/2jXT0tE/vFG5B9vRP7xxrDwqOYCUOSfA4j80xLDY8TXyvN5YaiNNNTPao3BaAz7PXFzXNKN//94CcfX3TOvko2Lqv6mnmWO3Jsy0nDqdOSnpuzKa+LzAuHI5Gsqyad+zNz6fekg8k/T1rEJ+hlYgX/2Iv94Q7sHk4pe5B/t+mmJyD/eiPzjjcg/3hgWHtVcAIr8cwCRf6RQG3GoNQI3EoSTj8VHD04+Z0LcTTzu8SIWjcRH7qkRfxuNPNxw3hlfG7oj8k/T1rEJ+hlYgX/2Iv94Q7sHk4pe5B/t+mmJyD/eiPzjjcg/3hgWHs0MnnQPFPnnACL/yDFV0m06Em9ibcHJ52z6+PjUXVP+mT9seFzkn5WiQHt0ePN3ewZW4J+9yD/e0O7BpKIX+Ue7floi8o83Iv94I/KPN4aFRzUXgCL/HEDkn6DN9WcVGfmnaevYBP0MrMA/e5F/vKHdg0lFL/KPdv20ROQfb0T+8UbkH28MC49qLgBF/jmAyD9Bm+vPKiL/NG0dm6CfgRX4Zy/yjze0ezCp6EX+0a6floj8443IP96I/OONYeFRzQWgyD8HEPknaHP9WUXkn6atYxP0M7AC/+xF/vGGdg8mFb3IP9r10xKRf7wR+ccbkX+8MSw8qrkAFPnnACL/BG2uP6uI/NO0dWyCfgZW4J+9yD/e0O7BpKIX+Ue7floi8o83Iv94I/KPN4aFRzUXgCL/HEDkn5Akur55bEDkn6atYxP0M7AC/+xF/vGGdg8mFb3IP9r10xKRf7wR+ccbkX+8MSw8qrkAFPnnACL/hCTR+c0jjsg/TVvHJuhnYAX+2Yv84w3tHkwqepF/tOunJSL/eCPyjzci/3hjWHhUcwEo8s8BRP4JSaL7m4fIP21bxyboZ2AF/tmL/OMN7R5MKnqRf7TrpyUi/3gj8o83Iv94Y1h4VHMBKPLPAUT+CUmi/5uHjPzTtHVsgn4GVuCfvcg/3tDuwaSiF/lHu35aIvKPNyL/eCPyjzeGhUc1F4Ai/xxA5J+QJPq/eYj807R1bIJ+Blbgn73IP97Q7sGkohf5R7t+WiLyjzci/3gj8o83hoVHNReAIv8cQOSfkCT6v3mI/NO0dWyCfgZW4J+9yD/e0O7BpKIX+Ue7floi8o83Iv94I/KPN4aFRzUXgCL/HEDkn5Ak+r95iPzTtHVsgn4GVuCfvcg/3tDuwaSiF/lHu35aIvKPNyL/eCPyjzeGhUc1F4Ai/xxA5J+QJPq/eYj807R1bIJ+Blbgn73IP97Q7sGkohf5R7t+WiLyjzci/3gj8o83hoVHNReAIv8cQOSfkCT6v3mI/NO0dWyCfgZW4J+9yD/e0O7BpKIX+Ue7floi8o83Iv94I/KPN4aFR/XGI/LPAUT+CUmi/5uHyD9NW8cm6GdgBf7Zi/zjDe0eTCp6kX+066clIv94I/KPNyL/eGNYeJToLsD2Qb150kDkn8Dm6hD5p2nr2AT9DKzAP3uRf7yh3YNJRS/yj3b9tETkH29E/vFG5B9vDAuPwu0CkEPzpIjIP4HN1SHyT9PWsQn6GViBf/Yi/3hDuweTil7kH+36aYnIP96I/OONyD/eGBYehdsFIJfmSQGRfwKbq0Pkn6atYxP0M7AC/+xF/vGGdg8mFb3IP9r10xKRf7wR+ccbkX+8MSw8CrcLQE7NkyQi/wQ2V4fIP01bxyboZ2AF/tmL/OMN7R5MKnqRf7TrpyUi/3gj8o83Iv94Y1h4FG4XgNyaJwlE/glsrg6Rf5q2jk3Qz8AK/LMX+ccb2j2YVPQi/2jXT0tE/vFG5B9vRP7xxrDwKNwuADk2zyyI/BPYXB0i/zRtHZugn4EV+Gcv8o83tHswqehF/tGun5aI/OONyD/eiPzjjWHhUbhdAHJtngSI/BPYXB0i/zRtHZugn4EV+Gcv8o83tHswqehF/tGun5aI/OONyD/eiPzjjWHhUbhdAHJunhkQ+SewuTpE/mnaOjZBPwMr8M9e5B9vaPdgUtGL/KNdPy0R+ccbkX+8EfnHG8PCo3C7AOTePNMg8k9gc3WI/NO0dWyCfgZW4J+9yD/e0O7BpKIX+Ue7floi8o83Iv94I/KPN4aFR+F2AeiG5tkEkX8Cm6tD5J+mrWMT9DOwAv/sRf7xhnYPJhW9yD/a9dMSkX+8EfnHG5F/vBH5Z0EAuvD2QOSfwObqEPmnaevYBP0MrMA/e5F/vKHdg0lFL/KPdv20ROQfb0T+8UbkH29E/lkQgC68PRD5J7C5OkT+ado6NkE/Ayvwz17kH29o92BS0Yv8o10/LRH5xxuRf7wR+ccbkX8WBKALbw9E/glsrg6Rf5q2jk3Qz8AK/LMX+ccb2j2YVPQi/2jXT0tE/vFG5B9vRP7xRuSfBQHowtsDkX8Cm6tD5J+mrWMT9DOwAv/sRf7xhnYPJhW9yD/a9dMSkX+8EfnHG5F/vBH5Z0EAuvD2QOSfAC5Xh8g/TVvHJuhnYAX+2Yv84w3tHkwqepF/tOunJSL/eCPyjzci/3gj8s+CAHTh7YHIPyFJ9L86RP5p2jo2QT8DK/DPXuQfb2j3YFLRi/yjXT8tEfnHG5F/vBH5xxuRfxYEoAtvD0T+CUmi/9Uh8k/T1rEJ+hlYgX/2Iv94Q7sHk4pe5B/t+mmJyD/eiPzjjcg/3oj8syAAXXh7IPJPSBL9rw6Rf5q2jk3Qz8AK/LMX+ccb2j2YVPQi/2jXT0tE/vFG5B9vRP7xRuSfBQHowtsDkX9Ckuh/dYj807R1bIJ+Blbgn73IP97Q7sGkohf5R7t+WiLyjzci/3gj8o83Iv8sCEAX3h6I/BOSRP+rQ+Sfpq1jE/QzsAL/7EX+8YZ2DyYVvcg/2vXTEpF/vBH5xxuRf7wR+WdBALrw9kDkn5Ak+l8dIv80bR2boJ+BFfhnL/KPN7R7MKnoRf7Rrp+WiPzjjcg/3oj8443Iv1TxtHz8N8O1twci/4Qk0f/qEPmnaevYBP0MrMA/e5F/vKHdg0lFL/KPdv20ROQfb0T+8UbkH29E/qXK2+t/b3hce3sg8k9IEv2vDpF/mraOTdDPwAr8sxf5xxvaPZhU9CL/aNdPS0T+8UbkH29E/vFG5J8DuwAzRuSfwObmWeSfpq1jE/QzsAL/7EX+8YZ2DyYVvcg/2vXTEpF/vBH5xxuRf7wR+WcF9wlAkX8Cm5tnkX+ato5N0M/ACvyzF/nHG9o9mFT0Iv9o109LRP7xRuQfb0T+8Ubkn1XcJQBF/glsbp5F/mnaOjZBPwMr8M9e5B9vaPdgUtGL/KNdPy0R+ccbkX+8EfnHG5F/tgnAlo/v5n+/IPJPSBL9LwaRf5q2jk3Qz8AK/LMX+ccb2j2YVPQi/2jXT0tE/vFG5B9vRP7xRuSfHRuAuGcEoMg/gc3Ns8g/TVvHJuhnYAX+2Yv84w3tHkwqepF/tOunJSL/eCPyjzci/3gj8s9O+AtAkX8Cm5tnkX+ato5N0M/ACvyzF/nHG9o9mFT0Iv9o109LRP7xRuQfb0T+8Ubkn93wFoAi/wQ2N88i/zRtHZugn4EV+Gcv8o83tHswqehF/tGun5aI/OONyD/eiPzjjcg/RwUgu3UARf4JSaJ/xxf5p2nr2AT9DKzAP3uRf7yh3YNJRS/yj3b9tETkH29E/vFG5B9vRP45sf4f3xGAIv8ENjfPIv80bR2boJ+BFfhnL/KPN7R7MKnoRf7Rrp+WiPzjjcg/3oj8443IPyfZSACyGAUo8k9IEv07u8g/TVvHJuhnYAX+2Yv84w3tHkwqepF/tOunJSL/eCPyjzci/3gj8s/J0X/8RgCK/BPY3DyL/NO0dWyCfgZW4J+9yD/e0O7BpKIX+Ue7floi8o83Iv94I/KPNyL/MgEfASjyT2Bz8yzyT9PWsQn6GViBf/Yi/3hDuweTil7kH+36aYnIP96I/OONyD/eiPzLmgAkOQ1Y5J+QJPp3bpF/mraOTdDPwAr8sxf5xxvaPZhU9CL/aNdPS0T+8UbkH29E/vFG5F+mpv/yGAEo8k9gc/Ms8k/T1rEJ+hlYgX/2Iv94Q7sHk4pe5B/t+mmJyD/eiPzjjcg/3oj8yzTTCkAyowBF/glJon+HFvmnaevYBP0MrMA/e5F/vKHdg0lFL/KPdv20ROQfb0T+8UbkH29E/mV69B/tEYAi/wQ2N88i/zRtHZugn4EV+Gcv8o83tHswqehF/tGun5aI/OONyD/eiPzjjci/bDGjANR6FKDIPyFJ9O3EE4j807R1bIJ+Blbgn73IP97Q7sGkohf5R7t+WiLyjzci/3gj8o83Iv+yNfpv1hGAWkpAkX9CkujXeTdF5J+mrWMT9DOwAv/sRf7xhnYPJhW9yD/a9dMSkX+8EfnHG5F/vBH5l035R28KsMg/gc3Ns8g/TVvHJuhnYAX+2Yv84w3tHkwqepF/tOunJSL/eCPyjzci/3gj8k8HZhWA2owCFPknJIkeHTYRIv80bR2boJ+BFfhnL/KPN7R7MKnoRf7Rrp+WiPzjjcg/3oj8443IPx1G/yU9AjDrElDkn8Dm5lnkn6atYxP0M7AC/+xF/vGGdg8mFb3IP9r10xKRf7wR+ccbkX+8Efmni/xLaQpw1iSgyD+Bzc2zyD9NW8cm6GdgBf7Zi/zjDe0eTCp6kX+066clIv94I/KPNyL/eCPyTyf5p/8agCL/BDY3zyL/NG0dm6CfgRX4Zy/yjze0ezCp6EX+0a6floj8443IP96I/OONyD8dSUkAZnQUoMg/gc3Ns8g/TVvHJuhnYAX+2Yv84w3tHkwqepF/tOunJSL/eCPyjzci/3gj8k/H0X9pjQDMiAQU+SewuXkW+adp69gE/QyswD97kX+8od2DSUUv8o92/bRE5B9vRP7xRuQfb0T+6Sr/0p4C7KgEFPknsLl5FvmnaevYBP0MrMA/e5F/vKHdg0lFL/KPdv20ROQfb0T+8UbkH29E/uks/yytAeiIBBT5J7C5eRb5p2nr2AT9DKzAP3uRf7yh3YNJRS/yj3b9tETkH29E/vFG5B9vRP7pLv8sbwJiqwQU+SewuXkW+adp69gE/QyswD97kX+8od2DSUUv8o92/bRE5B9vRP7xRuQfb0T+UZB/tuwCbIsEFPknsLl5FvmnaevYBP0MrMA/e5F/vKHdg0lFL/KPdv20ROQfb0T+8UbkH29E/lGRf7a/2zYuPD71Wz6RfwKbm2eRf5q2jk3Qz8AK/LMX+ccb2j2YVPQi/2jXT0tE/vFG5B9vRP7xRuQfFfFn2whAS6MBRf4JbG6eRf5p2jo2QT8DK/DPXuQfb2j3YFLRi/yjXT8tEfnHG5F/vBH5xxuRf9Tkn+0CMCUJKPJPYHPzLPJP09axCfoZWIF/9iL/eEO7B5OKXuQf7fppicg/3oj8443IP96I/KMo/xx/551xSrDIP4HNzbPIP01bxyboZ2AF/tmL/OMN7R5MKnqRf7TrpyUi/3gj8o83Iv94I/KPovhzbATgrKMBRf4JbG6eRf5p2jo2QT8DK/DPXuQfb2j3YFLRi/yjXT8tEfnHG5F/vBH5xxuRf5TlX0Y/Yc3RgCL/BDY3zyL/NG0dm6CfgRX4Zy/yjze0ezCp6EX+0a6floj8443IP96I/OONyD/K4i9rn7KNC9LYKZjczVf2I6CM/q0n8k/T1rEJ+hlYgX/2Iv94Q7sHk4pe5B/t+mmJyD/eiPzjjcg/3oj8oy7+tPikdUIGZv/mK/sRUEb/1hP5p2nr2AT9DKzAP3uRf7yh3YNJRS/yj3b9tETkH29E/vFG5B9vRP5Rl37a3a/YJQKzn0z2I6CM/q0n8k/T1rEJ+hlYgX/2Iv94Q7sHk4pe5B/t+mmJyD/eiPzjjcg/3oj84yL+Jsh6AHYJwewnkv0IKKN/64n807R1bIJ+Blbgn73IP97Q7sGkohf5R7t+WiLyjzci/3gj8o83Iv84CL9N0S6gdKRg9pPIfgSU0b/1RP5p2jo2QT8DK/DPXuQfb2j3YFLRi/yjXT8tEfnHG5F/vBH5xxuRf0gRHWXfdPw/91PI6b0hM2gAAAAASUVORK5CYII=";

  // src/App.jsx
  var TABS = [
    { k: "script", t: "\u5267\u672C\u521B\u4F5C", icon: "\u{1F3AC}" },
    { k: "characters", t: "\u4EBA\u7269\u7BA1\u7406", icon: "\u{1F464}" },
    { k: "storyboard", t: "\u5206\u955C\u4E0E\u751F\u56FE", icon: "\u{1F4DD}" },
    { k: "dub", t: "\u914D\u97F3\u5DE5\u4F5C\u5BA4", icon: "\u{1F399}\uFE0F" },
    { k: "video", t: "\u89C6\u9891\u751F\u6210", icon: "\u{1F3A5}" },
    { k: "editor", t: "\u526A\u8F91\u5BFC\u51FA", icon: "\u2702\uFE0F" },
    { k: "stage3d", t: "3D\u5BFC\u6F14\u53F0", icon: "\u{1F3AD}", vip: true },
    { k: "library", t: "\u7D20\u6750\u5E93", icon: "\u{1F5C2}" }
  ];
  var SD_RECENT_KEY = "SD_RECENT_OPEN";
  function recordRecentSd(id) {
    try {
      const arr = JSON.parse(localStorage.getItem(SD_RECENT_KEY) || "[]");
      const next = [{ id, t: Date.now() }, ...arr.filter((x) => x.id !== id)].slice(0, 16);
      localStorage.setItem(SD_RECENT_KEY, JSON.stringify(next));
    } catch (_) {
    }
  }
  function recentMapSd() {
    try {
      return new Map(JSON.parse(localStorage.getItem(SD_RECENT_KEY) || "[]").map((x) => [x.id, x.t]));
    } catch {
      return /* @__PURE__ */ new Map();
    }
  }
  function App() {
    const [db, setDb] = (0, import_react17.useState)(null);
    (0, import_react17.useEffect)(() => {
      try {
        const oldUrl = localStorage.getItem("DISPATCH_BASE_URL");
        if (oldUrl && oldUrl.startsWith("http://")) {
          const newUrl = oldUrl.replace("http://", "https://");
          localStorage.setItem("DISPATCH_BASE_URL", newUrl);
          console.log("[API\u5730\u5740\u8FC1\u79FB] \u5DF2\u5C06\u65E7\u7684HTTP\u5730\u5740\u5347\u7EA7\u4E3AHTTPS:", oldUrl, "->", newUrl);
        }
      } catch (e) {
      }
    }, []);
    const [projects, setProjects] = (0, import_react17.useState)([]);
    const [activeId, setActiveId] = (0, import_react17.useState)(null);
    const [project2, setProject] = (0, import_react17.useState)(null);
    const [tab, setTab] = (0, import_react17.useState)("script");
    const [logLines, setLogLines] = (0, import_react17.useState)([]);
    const [isVip, setIsVip] = (0, import_react17.useState)(() => {
      try {
        return localStorage.getItem("USER_VIP_STATUS") === "true";
      } catch {
        return false;
      }
    });
    const log = (0, import_react17.useCallback)((m) => {
      const ts = (/* @__PURE__ */ new Date()).toLocaleTimeString("zh-CN", { hour12: false });
      setLogLines((prev) => [...prev.slice(-50), `[${ts}] ${m}`]);
      try {
        if (m.includes("\u6210\u529F") || m.includes("\u2705") || m.includes("\u5B8C\u6210")) {
          playNotificationSound("success");
        } else if (m.includes("\u5931\u8D25") || m.includes("\u274C") || m.includes("\u9519\u8BEF") || m.includes("\u5F02\u5E38")) {
          playNotificationSound("error");
        }
      } catch (e) {
      }
    }, []);
    const [theme, setTheme] = (0, import_react17.useState)(() => localStorage.getItem("THEME") || "dark");
    const [showSettings, setShowSettings] = (0, import_react17.useState)(false);
    const [showRecharge, setShowRecharge] = (0, import_react17.useState)(false);
    const [showMembership, setShowMembership] = (0, import_react17.useState)(false);
    const [showTemplateMarket, setShowTemplateMarket] = (0, import_react17.useState)(false);
    const [showAccountSettings, setShowAccountSettings] = (0, import_react17.useState)(false);
    const [membershipInfo, setMembershipInfo] = (0, import_react17.useState)(null);
    const [pricing, setPricing] = (0, import_react17.useState)(null);
    const [currentUser, setCurrentUser] = (0, import_react17.useState)(() => getCurrentUser2());
    const [showAuth, setShowAuth] = (0, import_react17.useState)(false);
    const [creditBalance, setCreditBalance] = (0, import_react17.useState)(0);
    const [authMode, setAuthMode] = (0, import_react17.useState)("login");
    const [feat, setFeat] = (0, import_react17.useState)(() => {
      try {
        return JSON.parse(localStorage.getItem("SD_FEATURES") || "{}");
      } catch {
        return {};
      }
    });
    const fileInputRef = (0, import_react17.useRef)(null);
    const openUserManual2 = (0, import_react17.useCallback)(() => {
      alert("\u7528\u6237\u624B\u518C\u5DF2\u6253\u5305\u5230\u8F6F\u4EF6\u5B89\u88C5\u76EE\u5F55\u4E2D\u3002\n\n\u8BF7\u5728\u8F6F\u4EF6\u5B89\u88C5\u76EE\u5F55\u4E2D\u627E\u5230\u300C\u7528\u6237\u624B\u518C.md\u300D\u6587\u4EF6\uFF0C\u7528\u8BB0\u4E8B\u672C\u6216Markdown\u7F16\u8F91\u5668\u6253\u5F00\u67E5\u770B\u3002");
    }, []);
    const fetchPricing = (0, import_react17.useCallback)(async () => {
      try {
        const baseUrl3 = (localStorage.getItem("DISPATCH_BASE_URL") || "https://api.jinsuai.cn").replace(/\/$/, "");
        const resp = await fetch(`${baseUrl3}/api/pricing`);
        if (resp.ok) {
          const data = await resp.json();
          setPricing(data);
          window.APP_PRICING = data;
          console.log("[\u4EF7\u683C\u914D\u7F6E] \u4ECE\u8C03\u5EA6\u673A\u83B7\u53D6\u6210\u529F:", data);
        } else {
          console.warn("[\u4EF7\u683C\u914D\u7F6E] \u83B7\u53D6\u5931\u8D25\uFF0C\u4F7F\u7528\u9ED8\u8BA4\u4EF7\u683C");
        }
      } catch (e) {
        console.warn("[\u4EF7\u683C\u914D\u7F6E] \u83B7\u53D6\u5F02\u5E38:", e.message);
      }
    }, []);
    const fetchDispatchUserInfo = (0, import_react17.useCallback)(async () => {
      const dispatchToken = localStorage.getItem("DISPATCH_TOKEN");
      if (!dispatchToken) {
        console.log("[\u7528\u6237\u4FE1\u606F] \u6CA1\u6709DISPATCH_TOKEN\uFF0C\u8DF3\u8FC7\u83B7\u53D6");
        return;
      }
      try {
        console.log("[\u7528\u6237\u4FE1\u606F] \u5F00\u59CB\u4ECE\u8C03\u5EA6\u673A\u83B7\u53D6\u7528\u6237\u4FE1\u606F...");
        const user = await getCurrentUser();
        console.log("[\u7528\u6237\u4FE1\u606F] \u83B7\u53D6\u6210\u529F:", user);
        setCreditBalance(user.credits || 0);
        if (!currentUser) {
          setCurrentUser({
            username: user.username || user.phone || "\u7528\u6237",
            nickname: user.nickname || user.username || "\u7528\u6237",
            ...user
          });
        }
        const level = user.membership_level || 0;
        const isVip2 = level > 0;
        setIsVip(isVip2);
        try {
          localStorage.setItem("USER_VIP_STATUS", isVip2 ? "true" : "false");
        } catch {
        }
        let daysRemaining = 0;
        if (user.membership_expiry) {
          const expiry = new Date(user.membership_expiry);
          const now = /* @__PURE__ */ new Date();
          daysRemaining = Math.max(0, Math.ceil((expiry - now) / (1e3 * 60 * 60 * 24)));
        }
        const discountMap = { 0: 1, 1: 0.9, 2: 0.85, 3: 0.8 };
        setMembershipInfo({
          plan_name: MEMBERSHIP_NAMES[level] || "\u514D\u8D39\u7528\u6237",
          plan: MEMBERSHIP_NAMES[level] || "\u514D\u8D39\u7528\u6237",
          is_vip: isVip2,
          is_active: isVip2,
          level,
          expired_at: user.membership_expiry,
          days_remaining: daysRemaining,
          discount_rate: discountMap[level] || 1,
          monthly_quota: user.monthly_quota,
          monthly_used: user.monthly_used
        });
      } catch (e) {
        console.error("\u4ECE\u8C03\u5EA6\u673A\u83B7\u53D6\u7528\u6237\u4FE1\u606F\u5931\u8D25:", e);
      }
    }, []);
    const handleLoginSuccess = (0, import_react17.useCallback)((user) => {
      setCurrentUser(user);
      setShowAuth(false);
      fetchDispatchUserInfo();
    }, [fetchDispatchUserInfo]);
    const handleLogout = (0, import_react17.useCallback)(async () => {
      await logout();
      setCurrentUser(null);
      setCreditBalance(0);
    }, []);
    const [changePwdForm, setChangePwdForm] = (0, import_react17.useState)({ oldPassword: "", newPassword: "", confirmPassword: "" });
    const [changePwdLoading, setChangePwdLoading] = (0, import_react17.useState)(false);
    const [changePwdMsg, setChangePwdMsg] = (0, import_react17.useState)(null);
    const handleChangePassword = async () => {
      setChangePwdMsg(null);
      if (!changePwdForm.oldPassword || !changePwdForm.newPassword || !changePwdForm.confirmPassword) {
        setChangePwdMsg({ type: "error", text: "\u8BF7\u586B\u5199\u6240\u6709\u5BC6\u7801\u5B57\u6BB5" });
        return;
      }
      if (changePwdForm.newPassword !== changePwdForm.confirmPassword) {
        setChangePwdMsg({ type: "error", text: "\u4E24\u6B21\u8F93\u5165\u7684\u65B0\u5BC6\u7801\u4E0D\u4E00\u81F4" });
        return;
      }
      if (changePwdForm.newPassword.length < 6) {
        setChangePwdMsg({ type: "error", text: "\u65B0\u5BC6\u7801\u957F\u5EA6\u4E0D\u80FD\u5C11\u4E8E6\u4F4D" });
        return;
      }
      setChangePwdLoading(true);
      try {
        await changePassword(changePwdForm.oldPassword, changePwdForm.newPassword);
        setChangePwdMsg({ type: "success", text: "\u5BC6\u7801\u4FEE\u6539\u6210\u529F" });
        setChangePwdForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
      } catch (e) {
        setChangePwdMsg({ type: "error", text: e.message || "\u5BC6\u7801\u4FEE\u6539\u5931\u8D25" });
      } finally {
        setChangePwdLoading(false);
      }
    };
    const openLogin = (0, import_react17.useCallback)((mode = "login") => {
      setAuthMode(mode);
      setShowAuth(true);
    }, []);
    (0, import_react17.useEffect)(() => {
      const restoreDispatchSession = async () => {
        const token2 = localStorage.getItem("DISPATCH_TOKEN");
        if (!token2) return;
        try {
          const base = (localStorage.getItem("DISPATCH_BASE_URL") || "https://api.jinsuai.cn").replace(/\/$/, "");
          const res = await fetch(`${base}/api/auth/me`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token2}` }
          });
          if (!res.ok) {
            localStorage.removeItem("DISPATCH_TOKEN");
            localStorage.removeItem("DISPATCH_USER");
            console.log("[\u8C03\u5EA6\u673A] \u767B\u5F55\u6001\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55");
          }
        } catch (e) {
          console.error("[\u8C03\u5EA6\u673A] \u6821\u9A8C\u767B\u5F55\u6001\u5F02\u5E38:", e.message);
        }
      };
      restoreDispatchSession();
    }, []);
    (0, import_react17.useEffect)(() => {
      fetchPricing();
      const dispatchToken = localStorage.getItem("DISPATCH_TOKEN");
      if (dispatchToken && !currentUser) {
        const username = localStorage.getItem("DISPATCH_USER") || "\u7528\u6237";
        setCurrentUser({ username, nickname: username });
      }
      if (dispatchToken) {
        fetchDispatchUserInfo();
      }
      window.onCreditUpdate = (balance) => {
        setCreditBalance(balance);
      };
      window.refreshUserInfo = () => {
        if (localStorage.getItem("DISPATCH_TOKEN")) {
          fetchDispatchUserInfo();
        }
      };
      return () => {
        delete window.onCreditUpdate;
        delete window.refreshUserInfo;
      };
    }, [fetchDispatchUserInfo]);
    const [page, setPage] = (0, import_react17.useState)(null);
    const [externalFirstFrame, setExternalFirstFrame] = (0, import_react17.useState)(null);
    const [dubChunk, setDubChunk] = (0, import_react17.useState)("");
    const [dubNonce, setDubNonce] = (0, import_react17.useState)(0);
    const [dubAudio, setDubAudio] = (0, import_react17.useState)(null);
    const [editorAssets, setEditorAssets] = (0, import_react17.useState)([]);
    const [showTrash, setShowTrash] = (0, import_react17.useState)(false);
    const [trashList, setTrashList] = (0, import_react17.useState)([]);
    const [showTemplates, setShowTemplates] = (0, import_react17.useState)(false);
    const [, forceTick] = (0, import_react17.useState)(0);
    const useAssetDub = (a) => {
      const t2 = (a.text || a.title || "").trim();
      const line = t2 ? `\u3010\u7D20\u6750\xB7${a.title}\u3011
${t2}` : `\u3010\u7D20\u6750\xB7${a.title}\u3011\uFF08\u65E0\u6587\u672C\uFF0C\u97F3\u9891\u6E90\uFF1A${a.url || ""}\uFF09`;
      setDubChunk(line);
      setDubNonce((n) => n + 1);
      setDubAudio(a.type === "audio" ? a.url : null);
      setPage(null);
      setTab("dub");
      log(`\u5DF2\u5C06\u7D20\u6750\u300C${a.title}\u300D\u9001\u5165\u914D\u97F3\u3002`);
    };
    const useAssetEdit = (a) => {
      setEditorAssets((prev) => prev.some((x) => x.id === a.id) ? prev : [...prev, a]);
      setPage(null);
      setTab("editor");
      log(`\u5DF2\u5C06\u7D20\u6750\u300C${a.title}\u300D\u52A0\u5165\u526A\u8F91\u65F6\u95F4\u7EBF\u3002`);
    };
    const clearEditorAssets = (0, import_react17.useCallback)(() => setEditorAssets([]), []);
    (0, import_react17.useEffect)(() => {
      (0, import_ui.applyTheme)(theme);
    }, [theme]);
    const featOn = (k) => feat[k] !== false;
    const toggleFeat = (k) => setFeat((f) => {
      const n = { ...f, [k]: f[k] === false ? true : false };
      localStorage.setItem("SD_FEATURES", JSON.stringify(n));
      return n;
    });
    (0, import_react17.useEffect)(() => {
      let alive = true;
      (0, import_ui.openDB)().then(async (d) => {
        if (!alive) return;
        setDb(d);
        let list = (await d.listProjects("shortdrama")).map((p) => ({ id: p.id, ...metaOf(p.data), updatedAt: p.updatedAt }));
        if (list.length === 0) {
          const def = defaultProject("\u6211\u7684\u7B2C\u4E00\u90E8\u77ED\u5267");
          await d.saveProject("shortdrama", def.id, def);
          list = [{ id: def.id, ...metaOf(def), updatedAt: Date.now() }];
        }
        if (!alive) return;
        setProjects(list);
        setActiveId(list[0].id);
      }).catch((e) => {
        if (alive) log("\u6570\u636E\u5E93\u521D\u59CB\u5316\u5931\u8D25\uFF1A" + e.message);
      });
      return () => {
        alive = false;
      };
    }, []);
    (0, import_react17.useEffect)(() => {
      if (!db || !activeId) return;
      let alive = true;
      db.loadProject("shortdrama", activeId).then((data) => {
        if (alive && data) setProject(normalizeProject(data));
      });
      return () => {
        alive = false;
      };
    }, [db, activeId]);
    (0, import_react17.useEffect)(() => {
      const dispatchToken = localStorage.getItem("DISPATCH_TOKEN");
      if (!dispatchToken) {
        setIsVip(false);
        setMembershipInfo(null);
        try {
          localStorage.setItem("USER_VIP_STATUS", "false");
        } catch {
        }
        return;
      }
      fetchDispatchUserInfo();
      const timer = setInterval(fetchDispatchUserInfo, 6e4);
      return () => clearInterval(timer);
    }, [currentUser, fetchDispatchUserInfo]);
    (0, import_react17.useEffect)(() => {
      if (!db || !activeId || !project2) return;
      if (!getAppSetting("autoSave", true)) return;
      const interval = Number(getAppSetting("autoSaveInterval", 30)) * 1e3;
      const t2 = setTimeout(() => db.saveProject("shortdrama", activeId, project2), interval);
      return () => clearTimeout(t2);
    }, [db, activeId, project2]);
    const activeQueueLength = (project2?.tasks || []).filter((t2) => ["pending", "running", "paused"].includes(t2.status)).length;
    (0, import_react17.useEffect)(() => {
      if (activeQueueLength > 0) {
        const i = setInterval(() => forceTick((x) => x + 1), 1e3);
        return () => clearInterval(i);
      }
    }, [activeQueueLength]);
    if (!project2) {
      return /* @__PURE__ */ import_react17.default.createElement("div", { style: { padding: 40, color: "var(--text-muted, #5d6779)", background: "var(--bg, #0b0f17)", height: "100vh", boxSizing: "border-box", whiteSpace: "pre-wrap" } }, logLines.length ? /* @__PURE__ */ import_react17.default.createElement("span", { style: { color: "var(--danger, #ef4444)" } }, logLines.slice(-3).join("\n")) : "\u52A0\u8F7D\u4E2D\u2026");
    }
    if (!project2.scenes) project2.scenes = [];
    if (!project2.episodes) project2.episodes = [];
    if (!project2.shots) project2.shots = [];
    if (!project2.materials) project2.materials = { characters: [], scenes: [] };
    if (!project2.characters) project2.characters = [];
    if (!project2.tasks) project2.tasks = [];
    if (!project2.dramaType) project2.dramaType = "real";
    if (!project2.outline) project2.outline = { synopsis: "" };
    if (!project2.script) project2.script = "";
    const recent = recentMapSd();
    const update = (patch) => setProject((p) => ({ ...p, ...typeof patch === "function" ? patch(p) : patch }));
    const switchProject = (id) => {
      recordRecentSd(id);
      setActiveId(id);
    };
    const deleteProject = async () => {
      if (projects.length <= 1) {
        log("\u81F3\u5C11\u4FDD\u7559\u4E00\u4E2A\u9879\u76EE\u3002");
        return;
      }
      if (!window.confirm("\u5220\u9664\u5F53\u524D\u77ED\u5267\u9879\u76EE\uFF1F\u4E0D\u53EF\u64A4\u9500\u3002")) return;
      await db.deleteProject("shortdrama", activeId);
      const rest = projects.filter((p) => p.id !== activeId);
      setProjects(rest);
      setActiveId(rest[0].id);
    };
    const renameProject = (title2) => {
      setProject((p) => ({ ...p, title: title2 }));
      setProjects((l) => l.map((x) => x.id === activeId ? { ...x, title: title2 } : x));
    };
    const applyMeta = async (id, patch) => {
      if (!db) return;
      const rec = await db.loadProject("shortdrama", id);
      if (!rec) return;
      const next = { ...rec, ...patch };
      await db.saveProject("shortdrama", id, next);
      setProjects((l) => l.map((p) => p.id === id ? { ...p, ...metaOf(next) } : p));
      if (id === activeId) setProject((p) => ({ ...p, ...patch }));
    };
    const togglePin = (id) => {
      const p = projects.find((x) => x.id === id);
      applyMeta(id, { pinned: !(p && p.pinned) });
    };
    const toggleArchive = (id) => {
      const p = projects.find((x) => x.id === id);
      applyMeta(id, { archived: !(p && p.archived) });
    };
    const addTag = (id, tag) => {
      const p = projects.find((x) => x.id === id);
      if (!p || !tag) return;
      const tags = Array.from(/* @__PURE__ */ new Set([...p.tags || [], tag]));
      applyMeta(id, { tags });
    };
    const removeTag = (id, tag) => {
      const p = projects.find((x) => x.id === id);
      if (!p) return;
      applyMeta(id, { tags: (p.tags || []).filter((t2) => t2 !== tag) });
    };
    const newProject = async (tpl, dramaType) => {
      const def = tpl ? templateProject(tpl, null) : defaultProject("\u65B0\u77ED\u5267 " + (projects.length + 1));
      def.dramaType = dramaType || def.dramaType || "real";
      await db.saveProject("shortdrama", def.id, def);
      setProjects((l) => [{ id: def.id, ...metaOf(def) }, ...l]);
      setActiveId(def.id);
      setTab("script");
      setPage(null);
    };
    const cloneCurrent = async () => {
      const copy = cloneProject(project2, (project2.title || "\u9879\u76EE") + " \u526F\u672C");
      await db.saveProject("shortdrama", copy.id, copy);
      setProjects((l) => [{ id: copy.id, ...metaOf(copy) }, ...l]);
      setActiveId(copy.id);
      log("\u5DF2\u514B\u9686\u9879\u76EE\uFF1A" + copy.title);
    };
    const importProject = async (data) => {
      if (!data || typeof data !== "object") {
        log("\u6587\u4EF6\u683C\u5F0F\u65E0\u6548\u3002");
        return;
      }
      let p;
      if (isPackage(data)) p = { ...data.project, id: "sd_" + Date.now(), createdAt: Date.now() };
      else p = { ...data, id: "sd_" + Date.now(), createdAt: Date.now() };
      await db.saveProject("shortdrama", p.id, p);
      setProjects((l) => [{ id: p.id, ...metaOf(p) }, ...l]);
      setActiveId(p.id);
      setTab("script");
      setPage(null);
      log("\u5DF2\u5BFC\u5165\u5DE5\u7A0B\uFF1A" + (p.title || "(\u672A\u547D\u540D)") + (isPackage(data) ? "\uFF08\u5DE5\u7A0B\u5305\uFF09" : ""));
    };
    const moveToTrash = async (id) => {
      if (projects.length <= 1) {
        log("\u81F3\u5C11\u4FDD\u7559\u4E00\u4E2A\u9879\u76EE\u3002");
        return;
      }
      const rec = await db.loadProject("shortdrama", id);
      if (!rec) return;
      if (!window.confirm("\u5C06\u300C" + (rec.title || "\u672A\u547D\u540D") + "\u300D\u79FB\u5165\u56DE\u6536\u7AD9\uFF1F\u53EF\u4ECE\u56DE\u6536\u7AD9\u6062\u590D\u3002")) return;
      await db.saveProject("shortdrama_trash", id, { ...rec, _trashAt: Date.now() });
      await db.deleteProject("shortdrama", id);
      const rest = projects.filter((p) => p.id !== id);
      setProjects(rest);
      if (activeId === id) {
        setActiveId(rest[0]?.id);
        setPage(null);
      }
      log("\u5DF2\u79FB\u5165\u56DE\u6536\u7AD9\uFF1A" + (rec.title || ""));
    };
    const openTrash = async () => {
      const t2 = await db.listProjects("shortdrama_trash");
      setTrashList(t2.map((r) => ({ id: r.id, title: r.data.title, trashAt: r.data._trashAt, data: r.data })));
      setShowTrash(true);
    };
    const restoreTrash = async (id) => {
      const rec = await db.loadProject("shortdrama_trash", id);
      if (!rec) return;
      delete rec._trashAt;
      await db.saveProject("shortdrama", id, rec);
      await db.deleteProject("shortdrama_trash", id);
      setProjects((l) => [{ id, ...metaOf(rec) }, ...l]);
      setTrashList((l) => l.filter((x) => x.id !== id));
      log("\u5DF2\u4ECE\u56DE\u6536\u7AD9\u6062\u590D\uFF1A" + (rec.title || ""));
    };
    const purgeTrash = async (id) => {
      await db.deleteProject("shortdrama_trash", id);
      setTrashList((l) => l.filter((x) => x.id !== id));
      log("\u5DF2\u6C38\u4E45\u5220\u9664\u3002");
    };
    const emptyTrash = async () => {
      const t2 = await db.listProjects("shortdrama_trash");
      for (const r of t2) await db.deleteProject("shortdrama_trash", r.id);
      setTrashList([]);
      log("\u56DE\u6536\u7AD9\u5DF2\u6E05\u7A7A\u3002");
    };
    const exportPackage = async () => {
      const blob = new Blob([JSON.stringify(packageProject(project2), null, 2)], { type: "application/json" });
      const { saveFile } = await import("@dual/ui");
      const res = await saveFile((project2.title || "shortdrama") + "_\u5DE5\u7A0B\u5305.json", blob);
      if (res.ok) log("\u5DF2\u5BFC\u51FA\u5DE5\u7A0B\u5305\uFF08\u542B\u5168\u90E8\u8D44\u4EA7\u94FE\u63A5\uFF09\uFF1A" + (res.path || ""));
      else if (res.err) log("\u5BFC\u51FA\u5931\u8D25\uFF1A" + res.err);
    };
    const onPkgPicked = (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          importProject(JSON.parse(reader.result));
        } catch {
          log("\u5BFC\u5165\u5931\u8D25\uFF1A\u6587\u4EF6\u683C\u5F0F\u65E0\u6548");
        }
      };
      reader.readAsText(f);
      e.target.value = "";
    };
    const updateTask = (id, patch) => setProject((p) => ({ ...p, tasks: (p.tasks || []).map((t2) => t2.id === id ? { ...t2, ...patch } : t2) }));
    const cancelTask = (id) => updateTask(id, { status: "canceled" });
    const pauseTask = (id) => updateTask(id, { status: "paused" });
    const resumeTask = (id) => updateTask(id, { status: "pending" });
    const retryTask = (id) => updateTask(id, { status: "pending", error: null, progress: 0 });
    const setTaskPriority = (id, pri) => updateTask(id, { priority: pri });
    const batchCancelTasks = () => setProject((p) => ({ ...p, tasks: (p.tasks || []).map((t2) => ["pending", "running", "paused"].includes(t2.status) ? { ...t2, status: "canceled" } : t2) }));
    const visibleTabs = TABS.filter((t2) => {
      if (t2.dev) return false;
      if (t2.k === "editor") return featOn("video");
      return true;
    });
    const activeTab = visibleTabs.some((t2) => t2.k === tab) ? tab : visibleTabs[0]?.k || "script";
    const exportProject = async () => {
      const blob = new Blob([JSON.stringify(project2, null, 2)], { type: "application/json" });
      const { saveFile } = await import("@dual/ui");
      const res = await saveFile((project2.title || "shortdrama") + ".json", blob);
      if (res.ok) log("\u5DF2\u5BFC\u51FA\u9879\u76EE JSON\uFF1A" + (res.path || ""));
      else if (res.err) log("\u5BFC\u51FA\u5931\u8D25\uFF1A" + res.err);
    };
    const exportCastScenes = async () => {
      const shots2 = project2?.shots || [];
      const castCount = /* @__PURE__ */ new Map();
      shots2.forEach((sh) => (sh.dialogues || []).forEach((d) => {
        const nm = (d.character || "").trim();
        if (nm) castCount.set(nm, (castCount.get(nm) || 0) + 1);
      }));
      const cast = [...castCount.keys()].map((name, i) => ({ id: "cast_" + i, name, lines: castCount.get(name) }));
      const scenes2 = (project2?.scenes || []).map((s2) => ({ id: s2.id, title: s2.title || "\u573A\u666F", desc: s2.desc || "", imageUrl: s2.imageUrl || null }));
      const data = { kind: "shortdrama-cast-scenes", version: 1, projectTitle: project2.title || "", exportedAt: Date.now(), cast, scenes: scenes2 };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const { saveFile } = await import("@dual/ui");
      const res = await saveFile((project2.title || "shortdrama") + "_\u89D2\u8272\u573A\u666F.json", blob);
      if (res.ok) log(`\u5DF2\u5BFC\u51FA\u89D2\u8272\u4E0E\u573A\u666F\uFF1A\u300C${cast.length} \u4F4D\u89D2\u8272 / ${scenes2.length} \u4E2A\u573A\u666F\u300D\uFF0C\u53EF\u5728 3D \u5BFC\u6F14\u53F0\u300C\u5BFC\u5165\u77ED\u5267\u89D2\u8272/\u573A\u666F\u300D\u8F7D\u5165\uFF1A${res.path || ""}`);
      else if (res.err) log("\u5BFC\u51FA\u5931\u8D25\uFF1A" + res.err);
    };
    const importFile = () => {
      if (fileInputRef.current) fileInputRef.current.click();
    };
    const onFilePicked = (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          importProject(JSON.parse(reader.result));
        } catch {
          log("\u5BFC\u5165\u5931\u8D25\uFF1A\u6587\u4EF6\u683C\u5F0F\u65E0\u6548");
        }
      };
      reader.readAsText(f);
      e.target.value = "";
    };
    const dockItems = [
      { key: "home", icon: "\u{1F3E0}", label: "\u9996\u9875", group: "\u5165\u53E3", active: page === "home", onClick: () => setPage("home") },
      ...visibleTabs.map((t2) => ({
        key: t2.k,
        icon: t2.icon,
        label: t2.t,
        group: t2.k === "library" ? "\u8D44\u6E90" : "\u521B\u4F5C",
        active: page === null && activeTab === t2.k,
        onClick: () => {
          setPage(null);
          setTab(t2.k);
        }
      })),
      { key: "about", icon: "\u2139\uFE0F", label: "\u5173\u4E8E\u6211\u4EEC", group: "\u5173\u4E8E", active: page === "about", onClick: () => setPage("about") }
    ];
    let center;
    if (page !== "home" && page !== "about" && !project2) {
      center = /* @__PURE__ */ import_react17.default.createElement("div", { style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, textAlign: "center" } }, /* @__PURE__ */ import_react17.default.createElement("div", { style: { fontSize: 48, marginBottom: 16 } }, "\u{1F3AC}"), /* @__PURE__ */ import_react17.default.createElement("h2", { style: { margin: "0 0 8px", fontSize: 20 } }, "\u6B22\u8FCE\u4F7F\u7528\u70EC\u5E8F\xB7\u5F71\u589F"), /* @__PURE__ */ import_react17.default.createElement("p", { style: { color: "var(--text-muted)", fontSize: 14, maxWidth: 400, lineHeight: 1.6 } }, "\u8BF7\u5148\u521B\u5EFA\u4E00\u4E2A\u65B0\u9879\u76EE\uFF0C\u6216\u4ECE\u9996\u9875\u6253\u5F00\u5DF2\u6709\u9879\u76EE\uFF0C\u5F00\u59CB\u4F60\u7684\u77ED\u5267\u521B\u4F5C\u4E4B\u65C5\u3002"), /* @__PURE__ */ import_react17.default.createElement("div", { style: { display: "flex", gap: 12, marginTop: 24 } }, /* @__PURE__ */ import_react17.default.createElement("button", { onClick: () => newProject(), style: { padding: "10px 24px", border: "none", borderRadius: 8, background: "linear-gradient(135deg, #7c3aed, #3b82f6)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600 } }, "\u2728 \u521B\u5EFA\u65B0\u9879\u76EE"), /* @__PURE__ */ import_react17.default.createElement("button", { onClick: () => setPage("home"), style: { padding: "10px 24px", border: "1px solid var(--border)", borderRadius: 8, background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 14 } }, "\u{1F3E0} \u8FD4\u56DE\u9996\u9875")));
    }
    const allTags = Array.from(new Set(projects.flatMap((p) => p.tags || []))).filter(Boolean);
    const queue = project2?.tasks || [];
    const activeQueue = queue.filter((t2) => ["pending", "running", "paused"].includes(t2.status));
    const failedQueue = queue.filter((t2) => t2.status === "failed");
    const fmtClock = (ts) => ts ? new Date(ts).toLocaleTimeString("zh-CN", { hour12: false }) : "";
    const fmtElapsed = (t2) => {
      const start = t2.startedAt || t2.updatedAt || t2.createdAt;
      if (!start) return "";
      const end = t2.finishedAt || Date.now();
      const s2 = Math.max(0, Math.floor((end - start) / 1e3));
      const m = Math.floor(s2 / 60), sec = s2 % 60;
      return (m > 0 ? m + " \u5206 " : "") + sec + " \u79D2";
    };
    if (page === "home") center = /* @__PURE__ */ import_react17.default.createElement(
      HomePage,
      {
        projects,
        recentMap: recent,
        activeId,
        allTags,
        activeQueue,
        failedQueue,
        onNew: newProject,
        onOpen: (id) => {
          switchProject(id);
          setPage(null);
          setTab("script");
        },
        onEnter: () => {
          setPage(null);
          setTab("script");
        },
        onTogglePin: togglePin,
        onToggleArchive: toggleArchive,
        onClone: async (id) => {
          const rec = await db.loadProject("shortdrama", id);
          if (!rec) return;
          const c = cloneProject(rec);
          await db.saveProject("shortdrama", c.id, c);
          setProjects((l) => [{ id: c.id, ...metaOf(c) }, ...l]);
          log("\u5DF2\u514B\u9686\uFF1A" + c.title);
        },
        onTrash: moveToTrash,
        onArchive: toggleArchive,
        onOpenTemplates: () => setShowTemplates(true),
        onOpenAssets: () => {
          setPage(null);
          setTab("library");
        }
      }
    );
    else if (page === "about") center = /* @__PURE__ */ import_react17.default.createElement(AboutPage, { theme });
    else if (activeTab === "script") center = /* @__PURE__ */ import_react17.default.createElement(NewScriptModule, { project: project2, update, log, onSwitchTab: setTab });
    else if (activeTab === "characters") center = /* @__PURE__ */ import_react17.default.createElement(CharacterManager, { project: project2, update, log });
    else if (activeTab === "storyboard") center = /* @__PURE__ */ import_react17.default.createElement(StoryboardBoard, { project: project2, update, log });
    else if (activeTab === "video") center = /* @__PURE__ */ import_react17.default.createElement(VideoGenBoard, { project: project2, update, log, externalFirstFrame, onClearExternalFirstFrame: () => setExternalFirstFrame(null) });
    else if (activeTab === "editor") center = /* @__PURE__ */ import_react17.default.createElement(
      EditExport,
      {
        project: project2,
        update,
        log,
        incomingAssets: editorAssets,
        onConsumeAssets: clearEditorAssets
      }
    );
    else if (activeTab === "stage3d") {
      if (!isVip) {
        center = /* @__PURE__ */ import_react17.default.createElement("div", { style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, textAlign: "center" } }, /* @__PURE__ */ import_react17.default.createElement("div", { style: { fontSize: 64, marginBottom: 16 } }, "\u{1F3AD}"), /* @__PURE__ */ import_react17.default.createElement("h2", { style: { margin: "0 0 8px", fontSize: 20 } }, "3D\u5BFC\u6F14\u53F0"), /* @__PURE__ */ import_react17.default.createElement("p", { style: { color: "var(--text-muted)", fontSize: 14, maxWidth: 400, lineHeight: 1.6, marginBottom: 20 } }, "3D\u5BFC\u6F14\u53F0\u4E3AVIP\u4E13\u5C5E\u529F\u80FD\uFF0C\u8BA2\u9605\u4F1A\u5458\u540E\u5373\u53EF\u4F7F\u7528\u5B8C\u6574\u76843D\u573A\u666F\u7F16\u6392\u3001\u4EBA\u7269\u5E03\u5C40\u548C\u673A\u4F4D\u9884\u8BBE\u3002"), /* @__PURE__ */ import_react17.default.createElement("div", { style: { display: "flex", gap: 10 } }, /* @__PURE__ */ import_react17.default.createElement("button", { onClick: () => setShowMembership(true), style: { padding: "10px 20px", border: "none", borderRadius: 8, background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600 } }, "\u{1F48E} \u67E5\u770B\u4F1A\u5458\u5957\u9910")));
      } else {
        center = /* @__PURE__ */ import_react17.default.createElement(Director3D, { project: project2, update, log, onRenderFrame: (imageDataUrl) => {
          setExternalFirstFrame(imageDataUrl);
          setTab("video");
          log("\u5DF2\u4ECE3D\u5BFC\u6F14\u53F0\u6E32\u67D3\u9996\u5E27\uFF0C\u5207\u6362\u5230\u89C6\u9891\u751F\u6210\u6A21\u5757");
        } });
      }
    } else if (activeTab === "dub") center = /* @__PURE__ */ import_react17.default.createElement(
      DubbingBoard,
      {
        project: project2,
        update,
        log,
        incomingChunk: dubChunk,
        incomingAudio: dubAudio,
        chunkNonce: dubNonce
      }
    );
    else if (activeTab === "library") center = /* @__PURE__ */ import_react17.default.createElement(AssetLibrary, { project: project2, update, log, onUseDub: useAssetDub, onUseEdit: useAssetEdit });
    else center = /* @__PURE__ */ import_react17.default.createElement("div", { style: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" } }, "\u672A\u77E5\u6807\u7B7E\u9875");
    const episodes = project2?.episodes || [];
    const shots = project2?.shots || [];
    const scenes = project2?.scenes || [];
    const doneScenes = shots.filter((s2) => s2.videoUrl).length + scenes.filter((s2) => s2.videoUrl).length;
    const totalScenes = shots.length + scenes.length;
    const menus = [
      { label: "\u6587\u4EF6", items: [
        { label: "\u65B0\u5EFA\u9879\u76EE", onClick: () => newProject() },
        { label: "\u4ECE\u6A21\u677F\u65B0\u5EFA\u2026", onClick: () => setShowTemplates(true) },
        { label: "\u514B\u9686\u5F53\u524D\u9879\u76EE", onClick: () => cloneCurrent().catch(() => {
        }) },
        { label: "\u5F52\u6863\u5F53\u524D", onClick: () => toggleArchive(activeId) },
        { type: "separator" },
        { label: "\u5BFC\u51FA\u5DE5\u7A0B\u5305\uFF08\u542B\u7D20\u6750\uFF09\u2026", onClick: () => exportPackage().catch(() => {
        }) },
        { label: "\u5BFC\u5165\u5DE5\u7A0B / \u5DE5\u7A0B\u5305\u2026", onClick: () => importFile() },
        { label: "\u5BFC\u51FA\u5DE5\u7A0B JSON", onClick: () => {
          exportProject().catch(() => {
          });
        } },
        { label: "\u5BFC\u51FA\u89D2\u8272\u4E0E\u573A\u666F\uFF08\u4F9B 3D \u5BFC\u6F14\u53F0\uFF09\u2026", onClick: () => {
          exportCastScenes().catch(() => {
          });
        } },
        { type: "separator" },
        { label: "\u79FB\u5165\u56DE\u6536\u7AD9", onClick: () => moveToTrash(activeId) },
        { label: "\u56DE\u6536\u7AD9\u2026", onClick: () => openTrash().catch(() => {
        }) },
        { type: "separator" },
        { label: "\u6C38\u4E45\u5220\u9664\u5F53\u524D", onClick: deleteProject }
      ] },
      { label: "\u89C6\u56FE", items: visibleTabs.map((t2) => ({ label: t2.t, onClick: () => setTab(t2.k) })) },
      { label: "\u8BBE\u7F6E", items: [
        { label: "\u504F\u597D\u8BBE\u7F6E\u2026", onClick: () => setShowSettings(true) }
      ] },
      { label: "\u5E2E\u52A9", items: [
        { label: "\u7528\u6237\u624B\u518C", onClick: () => openUserManual2() },
        { label: "\u5173\u4E8E \u70EC\u5E8F\u30FB\u5F71\u589F", onClick: () => setPage("about") }
      ] }
    ];
    const isFullscreenCanvas = activeTab === "stage3d";
    return /* @__PURE__ */ import_react17.default.createElement(import_ui.SessionProvider, null, /* @__PURE__ */ import_react17.default.createElement("div", { style: { height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg, #0b0f17)", fontFamily: "var(--font)" } }, /* @__PURE__ */ import_react17.default.createElement(import_ui.MenuBar, { menus }), /* @__PURE__ */ import_react17.default.createElement(
      import_ui.TopBar,
      {
        title: /* @__PURE__ */ import_react17.default.createElement("span", { style: { display: "flex", alignItems: "center", gap: 10 } }, /* @__PURE__ */ import_react17.default.createElement("span", { style: s.badge }, "EXE"), /* @__PURE__ */ import_react17.default.createElement("b", null, "\u70EC\u5E8F\u30FB\u5F71\u589F")),
        actions: /* @__PURE__ */ import_react17.default.createElement("span", { style: { display: "flex", alignItems: "center", gap: 12 } }, /* @__PURE__ */ import_react17.default.createElement("span", { style: { color: "var(--text-muted, #5d6779)", fontSize: 12 } }, project2?.title || "\u672A\u547D\u540D\u9879\u76EE"), currentUser && /* @__PURE__ */ import_react17.default.createElement("span", { style: { display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 6, fontSize: 12, color: "#f59e0b" } }, "\u{1F4B0} ", creditBalance, " \u79EF\u5206"), /* @__PURE__ */ import_react17.default.createElement("button", { onClick: () => setShowRecharge(true), style: { border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 } }, "\u{1F4B0} \u5145\u503C"), currentUser && isVip && /* @__PURE__ */ import_react17.default.createElement("span", { style: { display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(234,88,12,0.1))", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 6, fontSize: 11, color: "#f59e0b" }, title: "\u5728\u8BBE\u7F6E\u83DC\u5355\u4E2D\u6253\u5F00\u8D26\u6237\u8BBE\u7F6E\u67E5\u770B\u8BE6\u60C5" }, "\u{1F48E} ", membershipInfo?.plan_name || membershipInfo?.plan || "VIP\u4F1A\u5458", " \xB7 ", membershipInfo?.days_remaining > 0 ? `\u5269${membershipInfo.days_remaining}\u5929` : membershipInfo ? "\u5DF2\u8FC7\u671F" : "\u52A0\u8F7D\u4E2D..."), currentUser ? /* @__PURE__ */ import_react17.default.createElement("span", { style: { display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ import_react17.default.createElement("button", { onClick: () => setShowAccountSettings(true), style: { border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px", background: "var(--panel, #161d2a)", color: "var(--text)", cursor: "pointer", fontSize: 12 }, title: "\u8D26\u6237\u8BBE\u7F6E" }, "\u{1F464} \u8D26\u6237"), /* @__PURE__ */ import_react17.default.createElement("span", { style: { fontSize: 12, color: "var(--text-muted)" } }, currentUser.nickname || currentUser.phone), /* @__PURE__ */ import_react17.default.createElement("button", { onClick: handleLogout, style: { border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 11 } }, "\u9000\u51FA")) : /* @__PURE__ */ import_react17.default.createElement("button", { onClick: () => openLogin("login"), style: { border: "none", borderRadius: 6, padding: "4px 12px", background: "linear-gradient(135deg, #7A5CFF, #5CE1E6)", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 } }, "\u767B\u5F55"))
      }
    ), /* @__PURE__ */ import_react17.default.createElement("div", { style: { flex: 1, minHeight: 0, display: "flex" } }, /* @__PURE__ */ import_react17.default.createElement(import_ui.DockNav, { items: dockItems, textOnly: true }), /* @__PURE__ */ import_react17.default.createElement("div", { style: { flex: 1, display: "flex", minWidth: 0 } }, isFullscreenCanvas ? /* @__PURE__ */ import_react17.default.createElement("div", { style: { width: "100%", height: "100%", overflow: "hidden" } }, center) : /* @__PURE__ */ import_react17.default.createElement(
      import_ui.ThreePane,
      {
        leftWidth: 200,
        right: null,
        left: /* @__PURE__ */ import_react17.default.createElement("div", { style: { display: "flex", flexDirection: "column", height: "100%", padding: 14 } }, /* @__PURE__ */ import_react17.default.createElement("div", { style: s.sdHead }, "\u9879\u76EE"), /* @__PURE__ */ import_react17.default.createElement("select", { style: s.select, value: activeId || "", onChange: (e) => switchProject(e.target.value) }, projects.map((p) => /* @__PURE__ */ import_react17.default.createElement("option", { key: p.id, value: p.id }, p.title))), /* @__PURE__ */ import_react17.default.createElement("input", { style: { ...s.select, marginTop: 10 }, value: project2?.title || "\u672A\u547D\u540D\u9879\u76EE", onChange: (e) => renameProject(e.target.value) }), /* @__PURE__ */ import_react17.default.createElement("div", { style: { display: "flex", gap: 8, marginTop: 10 } }, /* @__PURE__ */ import_react17.default.createElement("button", { style: s.ghostBtn, onClick: newProject }, "+ \u65B0\u9879\u76EE"), /* @__PURE__ */ import_react17.default.createElement("button", { style: s.ghostBtnDanger, onClick: deleteProject }, "\u5220\u9664")), /* @__PURE__ */ import_react17.default.createElement("div", { style: { borderTop: "1px solid var(--border, rgba(255,255,255,0.08))", margin: "14px 0", paddingTop: 10 } }, /* @__PURE__ */ import_react17.default.createElement("div", { style: { fontSize: 12, color: "var(--text-muted, #5d6779)", marginBottom: 8 } }, "\u8FDB\u5EA6"), /* @__PURE__ */ import_react17.default.createElement("div", { style: s.progressTrack }, /* @__PURE__ */ import_react17.default.createElement("div", { style: { ...s.progressFill, width: `${totalScenes ? doneScenes / totalScenes * 100 : 0}%` } })), /* @__PURE__ */ import_react17.default.createElement("div", { style: { fontSize: 11, color: "var(--text-muted, #5d6779)", marginTop: 4 } }, doneScenes, "/", totalScenes, " \u5206\u573A\u5DF2\u51FA\u7247")), /* @__PURE__ */ import_react17.default.createElement("div", { style: { flex: 1 } }), /* @__PURE__ */ import_react17.default.createElement("div", { style: { borderTop: "1px solid var(--border, rgba(255,255,255,0.08))", paddingTop: 10 } }, /* @__PURE__ */ import_react17.default.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 } }, /* @__PURE__ */ import_react17.default.createElement("span", { style: { fontSize: 12, color: "var(--text-muted, #5d6779)" } }, "\u4EFB\u52A1\u961F\u5217\uFF08", activeQueue.length, " \u8FDB\u884C\u4E2D\uFF09"), activeQueue.length > 0 && /* @__PURE__ */ import_react17.default.createElement("button", { style: s.miniLink, onClick: batchCancelTasks }, "\u5168\u90E8\u53D6\u6D88")), (project2?.tasks || []).length === 0 ? /* @__PURE__ */ import_react17.default.createElement("div", { style: { fontSize: 12, color: "var(--text-muted, #5d6779)" } }, "\u6682\u65E0\u4EFB\u52A1") : (project2.tasks || []).map((t2) => {
          const pct = Math.max(0, Math.min(100, t2.progress ?? 0));
          const stColor = { pending: "#f59e0b", running: "#3b82f6", paused: "#a855f7", done: "#22c55e", failed: "#ef4444", canceled: "#64748b" }[t2.status] || "#64748b";
          return /* @__PURE__ */ import_react17.default.createElement("div", { key: t2.id, style: { border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: 8, padding: "8px 10px", marginBottom: 8, background: "var(--panel, #161d2a)" } }, /* @__PURE__ */ import_react17.default.createElement("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 } }, /* @__PURE__ */ import_react17.default.createElement("span", { style: { color: "var(--text, #e8ecf3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130 } }, t2.label), /* @__PURE__ */ import_react17.default.createElement("span", { style: { color: stColor, fontSize: 11, flex: "0 0 auto", marginLeft: 6 } }, t2.status === "running" ? "\u6E32\u67D3\u4E2D" : t2.status === "pending" ? "\u6392\u961F" : t2.status === "paused" ? "\u5DF2\u6682\u505C" : t2.status === "done" ? "\u5B8C\u6210" : t2.status === "failed" ? "\u5931\u8D25" : t2.status === "canceled" ? "\u5DF2\u53D6\u6D88" : t2.status)), /* @__PURE__ */ import_react17.default.createElement("div", { style: s.progressTrack }, /* @__PURE__ */ import_react17.default.createElement("div", { style: { ...s.progressFill, width: pct + "%", background: stColor } })), /* @__PURE__ */ import_react17.default.createElement("div", { style: { fontSize: 10, color: "var(--text-muted, #5d6779)", marginTop: 4, lineHeight: 1.4 } }, ["pending", "running", "paused"].includes(t2.status) ? `\u5DF2\u7528 ${fmtElapsed(t2)} \xB7 \u5F00\u59CB ${fmtClock(t2.startedAt)}` : t2.status === "completed" ? `\u8017\u65F6 ${fmtElapsed(t2)} \xB7 \u5B8C\u6210 ${fmtClock(t2.finishedAt)}` : t2.status === "failed" ? `\u5931\u8D25\u4E8E ${fmtClock(t2.finishedAt)}` : t2.status === "canceled" ? `\u5DF2\u53D6\u6D88 ${fmtClock(t2.finishedAt)}` : ""), t2.status === "running" && t2.detail && /* @__PURE__ */ import_react17.default.createElement("div", { style: { fontSize: 10, color: "var(--text-muted, #5d6779)", marginTop: 2 } }, "\u72B6\u6001\uFF1A", t2.detail), t2.status === "failed" && (t2.detail || t2.error) && /* @__PURE__ */ import_react17.default.createElement("div", { style: { fontSize: 10, color: "var(--danger, #ef4444)", marginTop: 2, lineHeight: 1.4, maxHeight: 28, overflow: "hidden" } }, "\u26A0 ", t2.detail || t2.error), /* @__PURE__ */ import_react17.default.createElement("div", { style: { display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" } }, ["pending", "running"].includes(t2.status) && /* @__PURE__ */ import_react17.default.createElement("button", { style: s.miniBtn, onClick: () => cancelTask(t2.id) }, "\u53D6\u6D88"), t2.status === "running" && /* @__PURE__ */ import_react17.default.createElement("button", { style: s.miniBtn, onClick: () => pauseTask(t2.id) }, "\u6682\u505C"), t2.status === "paused" && /* @__PURE__ */ import_react17.default.createElement("button", { style: s.miniBtn, onClick: () => resumeTask(t2.id) }, "\u7EE7\u7EED"), t2.status === "failed" && /* @__PURE__ */ import_react17.default.createElement("button", { style: s.miniBtnOn, onClick: () => retryTask(t2.id) }, "\u91CD\u8BD5"), t2.url && (t2.type === "video" || t2.type === "audio") && /* @__PURE__ */ import_react17.default.createElement("a", { style: { ...s.miniBtn, textDecoration: "none", color: "#5ce1e6", textAlign: "center" }, href: t2.url, target: "_blank", rel: "noreferrer" }, "\u67E5\u770B"), t2.priority != null && /* @__PURE__ */ import_react17.default.createElement("span", { style: { fontSize: 10, color: "var(--text-muted, #5d6779)", alignSelf: "center" } }, "\u4F18\u5148\u7EA7 ", t2.priority)));
        })), getAppSetting("showGenerateLog", true) && /* @__PURE__ */ import_react17.default.createElement("div", { style: { marginTop: 12, borderTop: "1px solid var(--border, rgba(255,255,255,0.08))", paddingTop: 10 } }, /* @__PURE__ */ import_react17.default.createElement("div", { style: { fontSize: 12, color: "var(--text-muted, #5d6779)", marginBottom: 6 } }, "\u72B6\u6001\u65E5\u5FD7\uFF08\u5E26\u65F6\u95F4\uFF09"), /* @__PURE__ */ import_react17.default.createElement("div", { style: { fontSize: 10, lineHeight: 1.5, color: "var(--text-muted, #8b95a7)", maxHeight: 160, overflowY: "auto", whiteSpace: "pre-wrap", fontFamily: "ui-monospace, monospace", background: "var(--panel, #161d2a)", borderRadius: 6, padding: 6 } }, logLines.length === 0 ? "\uFF08\u6682\u65E0\u65E5\u5FD7\uFF09" : logLines.slice(-12).join("\n")))),
        center
      }
    ))), /* @__PURE__ */ import_react17.default.createElement(
      import_ui.StatusBar,
      {
        left: /* @__PURE__ */ import_react17.default.createElement(import_react17.default.Fragment, null, /* @__PURE__ */ import_react17.default.createElement("span", null, "\u{1F3AC} ", project2?.title || "\u672A\u547D\u540D\u9879\u76EE"), /* @__PURE__ */ import_react17.default.createElement("span", null, totalScenes, " \u5206\u573A \xB7 \u5DF2\u51FA\u7247 ", doneScenes)),
        right: /* @__PURE__ */ import_react17.default.createElement(import_react17.default.Fragment, null, /* @__PURE__ */ import_react17.default.createElement("span", null, "\u{1F4BE} \u81EA\u52A8\u4FDD\u5B58\u4E2D"), /* @__PURE__ */ import_react17.default.createElement("span", null, "\u{1F5A5} \u672C\u5730\u6570\u636E\u5DF2\u540C\u6B65"))
      }
    ), /* @__PURE__ */ import_react17.default.createElement("input", { ref: fileInputRef, type: "file", accept: "application/json", style: { display: "none" }, onChange: onFilePicked }), showSettings && /* @__PURE__ */ import_react17.default.createElement(
      CustomSettingsDialog,
      {
        open: showSettings,
        onClose: () => setShowSettings(false),
        appName: "\u70EC\u5E8F\u30FB\u5F71\u589F",
        theme,
        onThemeChange: setTheme
      }
    ), showTemplates && /* @__PURE__ */ import_react17.default.createElement(TemplatePicker, { templates: PROJECT_TEMPLATES, onPick: (t2) => {
      setShowTemplates(false);
      newProject(t2);
    }, onClose: () => setShowTemplates(false) }), showTrash && /* @__PURE__ */ import_react17.default.createElement(RecycleBin, { list: trashList, onRestore: restoreTrash, onPurge: purgeTrash, onEmpty: emptyTrash, onClose: () => setShowTrash(false) }), /* @__PURE__ */ import_react17.default.createElement(import_ui.BillingUI, null), showRecharge && /* @__PURE__ */ import_react17.default.createElement(RechargeModal, { onClose: () => setShowRecharge(false), onSuccess: () => {
      if (window.refreshUserInfo) window.refreshUserInfo();
    } }), showTemplateMarket && /* @__PURE__ */ import_react17.default.createElement(TemplateMarket, { project: project2, update, log, onClose: () => setShowTemplateMarket(false) }), showMembership && /* @__PURE__ */ import_react17.default.createElement(MembershipModal, { isOpen: showMembership, onClose: () => setShowMembership(false), onSubscribeSuccess: () => {
      setShowMembership(false);
    } }), showAuth && /* @__PURE__ */ import_react17.default.createElement(AuthModal, { isOpen: showAuth, onClose: () => setShowAuth(false), onLoginSuccess: handleLoginSuccess, initialMode: authMode }), showAccountSettings && /* @__PURE__ */ import_react17.default.createElement("div", { style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }, onClick: () => setShowAccountSettings(false) }, /* @__PURE__ */ import_react17.default.createElement("div", { style: { width: "min(520px, 92vw)", maxHeight: "86vh", overflowY: "auto", background: "var(--bg, #0b0f17)", border: "1px solid var(--border, rgba(255,255,255,0.12))", borderRadius: 12, padding: 24, color: "var(--text, #e8ecf3)" }, onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ import_react17.default.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 } }, /* @__PURE__ */ import_react17.default.createElement("h3", { style: { margin: 0, fontSize: 18 } }, "\u{1F464} \u8D26\u6237\u8BBE\u7F6E"), /* @__PURE__ */ import_react17.default.createElement("button", { onClick: () => setShowAccountSettings(false), style: { border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 20 } }, "\xD7")), /* @__PURE__ */ import_react17.default.createElement("div", { style: { marginBottom: 20, padding: 16, background: "var(--panel, #161d2a)", borderRadius: 8 } }, /* @__PURE__ */ import_react17.default.createElement("div", { style: { fontSize: 14, marginBottom: 8 } }, /* @__PURE__ */ import_react17.default.createElement("b", null, "\u6635\u79F0\uFF1A"), currentUser?.nickname || "\u672A\u8BBE\u7F6E"), /* @__PURE__ */ import_react17.default.createElement("div", { style: { fontSize: 14 } }, /* @__PURE__ */ import_react17.default.createElement("b", null, "\u624B\u673A\u53F7\uFF1A"), currentUser?.phone || "\u672A\u7ED1\u5B9A")), /* @__PURE__ */ import_react17.default.createElement("div", { style: { marginBottom: 20, padding: 16, background: isVip ? "linear-gradient(135deg, rgba(245,158,11,0.1), rgba(234,88,12,0.05))" : "var(--panel, #161d2a)", borderRadius: 8, border: isVip ? "1px solid rgba(245,158,11,0.3)" : "none" } }, /* @__PURE__ */ import_react17.default.createElement("div", { style: { fontSize: 15, fontWeight: 600, marginBottom: 12, color: isVip ? "#f59e0b" : "var(--text)" } }, "\u{1F48E} \u4F1A\u5458\u72B6\u6001"), isVip && membershipInfo ? /* @__PURE__ */ import_react17.default.createElement(import_react17.default.Fragment, null, /* @__PURE__ */ import_react17.default.createElement("div", { style: { fontSize: 13, marginBottom: 6 } }, /* @__PURE__ */ import_react17.default.createElement("b", null, "\u5957\u9910\uFF1A"), membershipInfo.plan_name || membershipInfo.plan || "VIP\u4F1A\u5458"), /* @__PURE__ */ import_react17.default.createElement("div", { style: { fontSize: 13, marginBottom: 6 } }, /* @__PURE__ */ import_react17.default.createElement("b", null, "\u5230\u671F\u65F6\u95F4\uFF1A"), membershipInfo.expired_at ? new Date(membershipInfo.expired_at).toLocaleString("zh-CN") : "\u6C38\u4E45"), /* @__PURE__ */ import_react17.default.createElement("div", { style: { fontSize: 13, marginBottom: 6 } }, /* @__PURE__ */ import_react17.default.createElement("b", null, "\u5269\u4F59\u5929\u6570\uFF1A"), membershipInfo.days_remaining, " \u5929"), /* @__PURE__ */ import_react17.default.createElement("div", { style: { fontSize: 13 } }, /* @__PURE__ */ import_react17.default.createElement("b", null, "\u6298\u6263\u7387\uFF1A"), Math.round(membershipInfo.discount_rate * 100), "%")) : /* @__PURE__ */ import_react17.default.createElement("div", { style: { fontSize: 13, color: "var(--text-muted)" } }, "\u60A8\u8FD8\u4E0D\u662FVIP\u4F1A\u5458\uFF0C\u5F00\u901A\u4F1A\u5458\u53EF\u4EAB\u53D7\u4E13\u5C5E\u529F\u80FD\u548C\u6298\u6263\u3002", /* @__PURE__ */ import_react17.default.createElement("button", { onClick: () => {
      setShowAccountSettings(false);
      setShowMembership(true);
    }, style: { marginTop: 10, display: "block", padding: "8px 16px", border: "none", borderRadius: 6, background: "linear-gradient(135deg, #f59e0b, #ea580c)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 } }, "\u{1F48E} \u5F00\u901A\u4F1A\u5458"))), /* @__PURE__ */ import_react17.default.createElement("div", { style: { padding: 16, background: "var(--panel, #161d2a)", borderRadius: 8 } }, /* @__PURE__ */ import_react17.default.createElement("div", { style: { fontSize: 15, fontWeight: 600, marginBottom: 12 } }, "\u{1F512} \u4FEE\u6539\u5BC6\u7801"), /* @__PURE__ */ import_react17.default.createElement("div", { style: { marginBottom: 10 } }, /* @__PURE__ */ import_react17.default.createElement("label", { style: { display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 } }, "\u539F\u5BC6\u7801"), /* @__PURE__ */ import_react17.default.createElement("input", { type: "password", value: changePwdForm.oldPassword, onChange: (e) => setChangePwdForm({ ...changePwdForm, oldPassword: e.target.value }), style: { width: "100%", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg, #0f141e)", color: "var(--text)", fontSize: 13, boxSizing: "border-box" }, placeholder: "\u8BF7\u8F93\u5165\u539F\u5BC6\u7801" })), /* @__PURE__ */ import_react17.default.createElement("div", { style: { marginBottom: 10 } }, /* @__PURE__ */ import_react17.default.createElement("label", { style: { display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 } }, "\u65B0\u5BC6\u7801"), /* @__PURE__ */ import_react17.default.createElement("input", { type: "password", value: changePwdForm.newPassword, onChange: (e) => setChangePwdForm({ ...changePwdForm, newPassword: e.target.value }), style: { width: "100%", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg, #0f141e)", color: "var(--text)", fontSize: 13, boxSizing: "border-box" }, placeholder: "\u8BF7\u8F93\u5165\u65B0\u5BC6\u7801\uFF08\u81F3\u5C116\u4F4D\uFF09" })), /* @__PURE__ */ import_react17.default.createElement("div", { style: { marginBottom: 12 } }, /* @__PURE__ */ import_react17.default.createElement("label", { style: { display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 } }, "\u786E\u8BA4\u65B0\u5BC6\u7801"), /* @__PURE__ */ import_react17.default.createElement("input", { type: "password", value: changePwdForm.confirmPassword, onChange: (e) => setChangePwdForm({ ...changePwdForm, confirmPassword: e.target.value }), style: { width: "100%", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg, #0f141e)", color: "var(--text)", fontSize: 13, boxSizing: "border-box" }, placeholder: "\u8BF7\u518D\u6B21\u8F93\u5165\u65B0\u5BC6\u7801" })), changePwdMsg && /* @__PURE__ */ import_react17.default.createElement("div", { style: { marginBottom: 10, padding: "8px 12px", borderRadius: 6, fontSize: 12, background: changePwdMsg.type === "success" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: changePwdMsg.type === "success" ? "#10b981" : "#ef4444" } }, changePwdMsg.text), /* @__PURE__ */ import_react17.default.createElement("button", { onClick: handleChangePassword, disabled: changePwdLoading, style: { width: "100%", padding: "10px", border: "none", borderRadius: 6, background: changePwdLoading ? "var(--text-muted)" : "linear-gradient(135deg, #7c3aed, #3b82f6)", color: "#fff", cursor: changePwdLoading ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600 } }, changePwdLoading ? "\u4FEE\u6539\u4E2D..." : "\u786E\u8BA4\u4FEE\u6539\u5BC6\u7801"))))));
  }
  function HomePage({ projects, recentMap, activeId, allTags, activeQueue, failedQueue, onNew, onOpen, onEnter, onTogglePin, onToggleArchive, onClone, onTrash, onOpenTemplates, onOpenAssets }) {
    const [q, setQ] = import_react17.default.useState("");
    const [tag, setTag] = import_react17.default.useState("all");
    const recent = recentMap || /* @__PURE__ */ new Map();
    const filtered = projects.filter((p) => !p.archived).filter((p) => tag === "all" ? true : (p.tags || []).includes(tag)).filter((p) => {
      if (!q.trim()) return true;
      const s2 = q.toLowerCase();
      return (p.title || "").toLowerCase().includes(s2) || (p.tags || []).some((t2) => t2.toLowerCase().includes(s2));
    }).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (recent.get(b.id) || 0) - (recent.get(a.id) || 0) || (b.updatedAt || 0) - (a.updatedAt || 0));
    const recentList = (recentMap ? Array.from(recentMap.entries()) : []).map(([id, t2]) => {
      const p = projects.find((x) => x.id === id);
      return p ? { ...p, lastOpened: t2 } : null;
    }).filter((p) => p && p.id && !p.archived).sort((a, b) => (b.lastOpened || 0) - (a.lastOpened || 0)).slice(0, 4);
    const thumbStyle = (p) => {
      const hue = (p.id || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
      return { background: `linear-gradient(135deg, hsl(${hue} 60% 32%), hsl(${(hue + 40) % 360} 55% 22%))` };
    };
    const tplEmoji = (k) => ({ sweet: "\u{1F36C}", revenge: "\u{1F525}", inlaw: "\u{1F3E0}", counter: "\u{1F680}", xuanhuan: "\u2694\uFE0F" })[k] || "\u{1F3AC}";
    return /* @__PURE__ */ import_react17.default.createElement("div", { style: { padding: 40, overflowY: "auto", height: "100%", boxSizing: "border-box", color: "var(--text, #e8ecf3)" } }, /* @__PURE__ */ import_react17.default.createElement("div", { style: { maxWidth: 880, margin: "0 auto" } }, /* @__PURE__ */ import_react17.default.createElement("div", { style: { textAlign: "center", marginBottom: 32 } }, /* @__PURE__ */ import_react17.default.createElement("img", { src: jinsu_logo_h_default, alt: "\u70EC\u5E8F JINSU", style: { height: 60, marginBottom: 16, borderRadius: 12 } }), /* @__PURE__ */ import_react17.default.createElement("div", { style: { fontSize: 12, color: "var(--accent-2, #3b82f6)", letterSpacing: 3, fontWeight: 700, marginBottom: 8 } }, "\u70EC\u5E8F\u30FB\u5F71\u589F"), /* @__PURE__ */ import_react17.default.createElement("h1", { style: { fontSize: 28, margin: "0 0 10px" } }, "\u7528 AI \u628A\u521B\u610F\u62CD\u6210\u7AD6\u5C4F\u77ED\u5267"), /* @__PURE__ */ import_react17.default.createElement("p", { style: { fontSize: 14, color: "var(--text-secondary, #8b95a7)", lineHeight: 1.7, margin: 0 } }, "\u5267\u672C\u751F\u6210 \u2192 \u5206\u955C\u62C6\u5206 \u2192 \u751F\u56FE \u2192 \u89C6\u9891\u751F\u6210 \u2192 \u914D\u97F3 \u2192 \u526A\u8F91\u5BFC\u51FA\uFF0C\u5168\u6D41\u7A0B AI \u8F85\u52A9")), /* @__PURE__ */ import_react17.default.createElement("div", { style: { display: "flex", gap: 12, justifyContent: "center", marginBottom: 36 } }, /* @__PURE__ */ import_react17.default.createElement("button", { style: { ...hp.btnPrimary, padding: "12px 28px", fontSize: 14 }, onClick: () => onNew() }, "\uFF0B \u65B0\u5EFA\u9879\u76EE"), /* @__PURE__ */ import_react17.default.createElement("button", { style: { ...hp.btn, padding: "12px 28px", fontSize: 14 }, onClick: onOpenTemplates }, "\u{1F3AD} \u4ECE\u6A21\u677F\u65B0\u5EFA")), recentList.length > 0 && /* @__PURE__ */ import_react17.default.createElement("div", { style: { marginBottom: 28 } }, /* @__PURE__ */ import_react17.default.createElement("h3", { style: { fontSize: 14, margin: "0 0 12px", color: "var(--text-secondary, #8b95a7)" } }, "\u{1F558} \u6700\u8FD1\u6253\u5F00"), /* @__PURE__ */ import_react17.default.createElement("div", { style: { display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 } }, recentList.map((p) => /* @__PURE__ */ import_react17.default.createElement("div", { key: p.id, onClick: () => onOpen(p.id), style: { flex: "0 0 auto", width: 150, cursor: "pointer", border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: 10, overflow: "hidden", background: "var(--panel, #161d2a)" } }, /* @__PURE__ */ import_react17.default.createElement("div", { style: hp.thumb, onClick: () => onOpen(p.id) }, /* @__PURE__ */ import_react17.default.createElement("span", { style: hp.thumbEmoji }, tplEmoji(p.template)), /* @__PURE__ */ import_react17.default.createElement("span", { style: hp.thumbTitle }, p.title)), /* @__PURE__ */ import_react17.default.createElement("div", { style: { padding: 8, fontSize: 11, color: "var(--text-muted, #5d6779)" } }, relTime(p.lastOpened)))))), /* @__PURE__ */ import_react17.default.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" } }, /* @__PURE__ */ import_react17.default.createElement("h3", { style: { fontSize: 15, margin: 0 } }, "\u{1F4C2} \u6211\u7684\u9879\u76EE\uFF08", filtered.length, "\uFF09"), /* @__PURE__ */ import_react17.default.createElement("input", { style: hp.search, placeholder: "\u641C\u7D22\u9879\u76EE\u2026", value: q, onChange: (e) => setQ(e.target.value) })), filtered.length === 0 ? /* @__PURE__ */ import_react17.default.createElement("div", { style: { textAlign: "center", padding: 60, color: "var(--text-muted, #5d6779)", fontSize: 14 } }, "\u8FD8\u6CA1\u6709\u9879\u76EE\uFF0C\u70B9\u51FB\u4E0A\u65B9\u300C\u65B0\u5EFA\u9879\u76EE\u300D\u5F00\u59CB\u521B\u4F5C") : /* @__PURE__ */ import_react17.default.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))", gap: 14 } }, filtered.map((p) => /* @__PURE__ */ import_react17.default.createElement("div", { key: p.id, style: { ...hp.card, ...p.id === activeId ? hp.cardActive : {} } }, /* @__PURE__ */ import_react17.default.createElement("div", { style: { ...hp.thumb, ...thumbStyle(p) }, onClick: () => onOpen(p.id) }, /* @__PURE__ */ import_react17.default.createElement("span", { style: hp.thumbEmoji }, tplEmoji(p.template)), p.pinned && /* @__PURE__ */ import_react17.default.createElement("span", { style: hp.pin }, "\u{1F4CC}"), /* @__PURE__ */ import_react17.default.createElement("span", { style: hp.thumbTitle }, p.title)), /* @__PURE__ */ import_react17.default.createElement("div", { style: { padding: 10 } }, /* @__PURE__ */ import_react17.default.createElement("div", { style: { display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 } }, (p.tags || []).slice(0, 2).map((t2) => /* @__PURE__ */ import_react17.default.createElement("span", { key: t2, style: hp.tag }, t2))), /* @__PURE__ */ import_react17.default.createElement("div", { style: { display: "flex", gap: 6 } }, /* @__PURE__ */ import_react17.default.createElement("button", { style: hp.cardBtn, onClick: () => onOpen(p.id) }, "\u6253\u5F00"), /* @__PURE__ */ import_react17.default.createElement("button", { style: hp.iconBtn, title: "\u7F6E\u9876", onClick: () => onTogglePin(p.id) }, p.pinned ? "\u{1F4CC}" : "\u{1F4CD}"), /* @__PURE__ */ import_react17.default.createElement("button", { style: hp.iconBtn, title: "\u514B\u9686", onClick: () => onClone(p.id) }, "\u29C9"), /* @__PURE__ */ import_react17.default.createElement("button", { style: hp.iconBtnDanger, title: "\u5220\u9664", onClick: () => onTrash(p.id) }, "\u{1F5D1}"))))))));
  }
  function AboutPage({ theme }) {
    const deps = [
      ["Tauri v2", "\u684C\u9762\u58F3\u5C42\uFF0C\u672C\u5730\u6570\u636E\u5B58\u50A8\u4E0E\u6587\u4EF6\u4FDD\u5B58"],
      ["React 18 + Vite", "\u524D\u7AEF\u6846\u67B6\u4E0E\u6784\u5EFA\u5DE5\u5177"],
      ["@dual/ui", "\u5171\u4EAB UI \u7EC4\u4EF6\u5305\uFF08ThreePane / DockNav / \u4E3B\u9898\u7B49\uFF09"],
      ["ffmpeg.wasm", "\u8FD0\u884C\u65F6\u4ECE esm.sh CDN \u52A8\u6001\u52A0\u8F7D\uFF0C\u7528\u4E8E\u6210\u7247\u5408\u5E76\uFF08\u79BB\u7EBF\u4E0D\u53EF\u7528\uFF09"],
      ["Three.js", "3D \u5BFC\u6F14\u53F0\u6E32\u67D3"],
      ["FastAPI + PostgreSQL", "\u540E\u7AEFAPI\u670D\u52A1\uFF0C\u7528\u6237/\u79EF\u5206/\u4F1A\u5458/\u8BA2\u5355\u7CFB\u7EDF"],
      ["\u817E\u8BAF\u4E91COS", "\u5BF9\u8C61\u5B58\u50A8\uFF0C\u4FDD\u5B58\u751F\u6210\u7684\u56FE\u7247/\u89C6\u9891/\u97F3\u9891\u6587\u4EF6"],
      ["\u963F\u91CC\u4E91\u767E\u70BC", "\u8BED\u97F3\u5408\u6210\uFF08cosyvoice-v1\uFF09\u30013D\u751F\u6210\uFF08Tripo-H3.1\uFF09\u3001LLM\uFF08qwen-turbo\uFF09"],
      ["AutoDL + ComfyUI", "GPU\u4E91\u670D\u52A1\u5668\uFF0C\u89C6\u9891\u751F\u6210\uFF08MiniMax H3\u7CFB\u5217\u6A21\u578B\uFF09"],
      ["Redis", "\u7F13\u5B58\u4E0E\u4F1A\u8BDD\u7BA1\u7406"]
    ];
    const shortcuts = [
      ["R / 0", "\u65E0\u9650\u753B\u5E03\u91CD\u7F6E\u89C6\u56FE"],
      ["\u7A7A\u683C + \u5DE6\u952E\u62D6\u62FD", "\u65E0\u9650\u753B\u5E03\u5E73\u79FB"],
      ["\u6EDA\u8F6E", "\u65E0\u9650\u753B\u5E03\u7F29\u653E\uFF080.1~10x\uFF09"],
      ["Ctrl/\u2318 + Z", "\u64A4\u9500"],
      ["Ctrl/\u2318 + Shift + Z / Y", "\u91CD\u505A"],
      ["Delete", "\u5220\u9664\u9009\u4E2D\u753B\u5E03\u8282\u70B9"]
    ];
    const faq = [
      ["\u751F\u6210\u5931\u8D25 / \u4E00\u76F4\u6392\u961F\uFF1F", "\u68C0\u67E5\u7F51\u7EDC\u8FDE\u63A5\u662F\u5426\u6B63\u5E38\uFF0C\u4E91\u7AEFGPU\u5DE5\u4EBA\u7E41\u5FD9\u65F6\u4F1A\u6392\u961F\u3002\u89C6\u9891\u751F\u6210\u5931\u8D25\u53EF\u67E5\u770B\u65E5\u5FD7\u9762\u677F\u7684\u5177\u4F53\u9519\u8BEF\u4FE1\u606F\uFF0C\u5E38\u89C1\u539F\u56E0\u5305\u62EC\uFF1A\u53C2\u8003\u56FEURL\u65E0\u6548\u3001\u65F6\u957F\u8D85\u8FC7\u9650\u5236\u3001\u79EF\u5206\u4E0D\u8DB3\u3002"],
      ["\u79EF\u5206\u5982\u4F55\u83B7\u53D6\uFF1F", "\u65B0\u7528\u6237\u6CE8\u518C\u8D60\u90015\u79EF\u5206\uFF0C\u53EF\u5728\u5145\u503C\u9875\u9762\u8D2D\u4E70\u79EF\u5206\u5305\uFF081\u5143=5\u79EF\u5206\uFF09\uFF0CVIP\u4F1A\u5458\u6BCF\u6708\u8D60\u9001\u989D\u5916\u79EF\u5206\u3002"],
      ["VIP\u4F1A\u5458\u6709\u4EC0\u4E48\u7528\uFF1F", "VIP\u53EF\u4F7F\u75283D\u5BFC\u6F14\u53F0\u5168\u90E8\u529F\u80FD\u548C\u8BE6\u7EC6\u521B\u5EFA\u5267\u672C\uFF084\u6B65\u5411\u5BFC\uFF09\uFF0C\u5E76\u4EAB\u53D7AI\u751F\u6210\u529F\u80FD\u6298\u6263\uFF08\u6700\u9AD87\u6298\uFF09\u3002"],
      ["\u79BB\u7EBF\u80FD\u7528\u5417\uFF1F", "\u672C\u5730\u529F\u80FD\uFF08\u9879\u76EE\u7BA1\u7406\u3001\u7D20\u6750\u5E93\u6D4F\u89C8\u30013D\u5BFC\u6F14\u53F0\u9884\u89C8\uFF09\u53EF\u7528\uFF1BAI\u751F\u6210\u529F\u80FD\uFF08\u751F\u56FE/\u751F\u89C6\u9891/\u914D\u97F3/3D\u751F\u6210\uFF09\u9700\u8054\u7F51\u3002"],
      ["\u6570\u636E\u4F1A\u4E22\u5417\uFF1F", "\u5DE5\u7A0B\u5B58\u4E8E\u672C\u5730IndexedDB\uFF0C\u6E05\u7406\u5E94\u7528\u7F13\u5B58\u4F1A\u4E22\u5931\uFF1B\u5EFA\u8BAE\u5B9A\u671F\u7528\u300C\u5BFC\u51FA\u5DE5\u7A0B\u300D\u5907\u4EFD\u3002\u751F\u6210\u7684\u56FE\u7247/\u89C6\u9891/\u97F3\u9891\u4FDD\u5B58\u5728\u817E\u8BAF\u4E91COS\u3002"],
      ["\u89C6\u9891\u751F\u6210\u6709\u54EA\u51E0\u79CD\u6A21\u5F0F\uFF1F", "4\u79CD\u6A21\u5F0F\uFF1AT2V\u7EAF\u6587\u672C\u751F\u6210\u3001I2V\u56FE\u751F\u89C6\u9891\uFF08\u652F\u6301\u4EBA\u7269\u53C2\u8003\u56FE\uFF09\u3001R2V\u9996\u5C3E\u5E27\u751F\u6210\u3001IA2V\u5168\u80FD\u53C2\u8003\uFF08\u56FE\u7247+\u97F3\u9891+\u6587\u672C\uFF09\u3002"],
      ["ffmpeg\u5408\u5E76\u5931\u8D25\uFF1F", "\u684C\u9762\u7AEF\u5DF2\u5185\u7F6Effmpeg\uFF0C\u79BB\u7EBF\u53EF\u7528\uFF1BWeb\u7AEF\u4F9D\u8D56ffmpeg.wasm\uFF0C\u9996\u6B21\u9700\u8054\u7F51\u4E0B\u8F7D\u5185\u6838\u3002"]
    ];
    const [diag, setDiag] = import_react17.default.useState(null);
    const runDiag = () => {
      const checks = [
        ["Web Speech API\uFF08\u79BB\u7EBF TTS\uFF09", typeof window !== "undefined" && "speechSynthesis" in window],
        ["MediaRecorder\uFF08\u5F55\u5236\u5BFC\u51FA\uFF09", typeof window !== "undefined" && "MediaRecorder" in window],
        ["WebGL\uFF083D \u5BFC\u6F14\u53F0\uFF09", (() => {
          try {
            const c = document.createElement("canvas");
            return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
          } catch {
            return false;
          }
        })()],
        ["IndexedDB\uFF08\u672C\u5730\u5B58\u50A8\uFF09", typeof window !== "undefined" && "indexedDB" in window],
        ["WebView2 / \u73B0\u4EE3\u6D4F\u89C8\u5668", typeof navigator !== "undefined" && /Edg|Chrome|Firefox/.test(navigator.userAgent)]
      ];
      setDiag(checks);
    };
    return /* @__PURE__ */ import_react17.default.createElement("div", { style: { padding: 32, overflowY: "auto", height: "100%", boxSizing: "border-box", color: "var(--text, #e8ecf3)" } }, /* @__PURE__ */ import_react17.default.createElement("div", { style: { maxWidth: 820, margin: "0 auto" } }, /* @__PURE__ */ import_react17.default.createElement("img", { src: jinsu_logo_default, alt: "\u70EC\u5E8F JINSU", style: { height: 84, marginBottom: 12, borderRadius: 14 } }), /* @__PURE__ */ import_react17.default.createElement("h1", { style: { fontSize: 26, margin: "0 0 6px" } }, "\u5173\u4E8E \u70EC\u5E8F\u30FB\u5F71\u589F"), /* @__PURE__ */ import_react17.default.createElement("div", { style: { fontSize: 12, color: "var(--accent-2, #5CE1E6)", marginBottom: 16 } }, "\u7248\u672C v0.3.0 \xB7 AI\u77ED\u5267\u5168\u6D41\u7A0B\u751F\u6210\u5E73\u53F0"), /* @__PURE__ */ import_react17.default.createElement("p", { style: { fontSize: 14, color: "var(--text-secondary, #8b95a7)", lineHeight: 1.8 } }, "\u70EC\u5E8F \xB7 \u5F71\u589F\u662F\u4E00\u6B3E\u9762\u5411\u7AD6\u5C4F\u77ED\u5267\u521B\u4F5C\u7684AI\u5168\u6D41\u7A0B\u684C\u9762\u5DE5\u5177\uFF0C\u5E2E\u52A9\u521B\u4F5C\u8005\u4ECE\u5267\u672C\u4E0A\u4F20\u6216AI\u751F\u6210\u51FA\u53D1\uFF0C \u81EA\u52A8\u5B8C\u6210\u5206\u96C6\u5267\u672C\u3001\u5206\u955C\u62C6\u5206\u3001\u5206\u955C\u751F\u56FE\u3001\u89D2\u8272\u7BA1\u7406\u3001AI\u914D\u97F3\u3001\u89C6\u9891\u751F\u6210\uFF084\u79CD\u6A21\u5F0F\uFF09\u30013D\u5BFC\u6F14\u53F0\u3001 \u7D20\u6750\u5E93\u7BA1\u7406\u3001\u526A\u8F91\u6210\u7247\u5230\u5BFC\u51FA\u7684\u5B8C\u6574\u5DE5\u4F5C\u6D41\u3002\u652F\u6301\u7528\u6237\u767B\u5F55\u3001\u79EF\u5206\u8BA1\u8D39\u3001\u4F1A\u5458\u4F53\u7CFB\uFF0C\u6240\u6709\u5DE5\u7A0B\u6570\u636E\u672C\u5730\u4FDD\u5B58\u3002"), /* @__PURE__ */ import_react17.default.createElement("h3", { style: { fontSize: 15, margin: "22px 0 10px" } }, "\u2328\uFE0F \u5FEB\u6377\u952E\u624B\u518C"), /* @__PURE__ */ import_react17.default.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: 8 } }, shortcuts.map(([k, v]) => /* @__PURE__ */ import_react17.default.createElement("div", { key: k, style: { display: "flex", gap: 10, fontSize: 13, padding: "8px 10px", border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: 8, background: "var(--panel, #161d2a)" } }, /* @__PURE__ */ import_react17.default.createElement("code", { style: { background: "var(--input-bg, #0f141e)", padding: "2px 6px", borderRadius: 4, color: "var(--accent, #7c3aed)", whiteSpace: "nowrap" } }, k), /* @__PURE__ */ import_react17.default.createElement("span", { style: { color: "var(--text-secondary, #8b95a7)" } }, v)))), /* @__PURE__ */ import_react17.default.createElement("h3", { style: { fontSize: 15, margin: "22px 0 10px" } }, "\u{1F680} \u65B0\u624B\u6559\u7A0B"), /* @__PURE__ */ import_react17.default.createElement("ol", { style: { fontSize: 13, color: "var(--text-secondary, #8b95a7)", lineHeight: 1.9, paddingLeft: 20 } }, /* @__PURE__ */ import_react17.default.createElement("li", null, "\u9996\u9875\u300C\u65B0\u5EFA\u9879\u76EE\u300D\uFF0C\u53EF\u9009\u62E9\u5FEB\u901F\u521B\u5EFA\uFF083\u79EF\u5206\uFF09\u6216\u8BE6\u7EC6\u521B\u5EFA\uFF08VIP\u4E13\u5C5E\uFF0C5\u79EF\u5206\uFF09\uFF0C\u6216\u76F4\u63A5\u4E0A\u4F20\u5DF2\u6709\u5267\u672C\uFF081\u79EF\u5206AI\u5206\u6790\uFF09\u3002"), /* @__PURE__ */ import_react17.default.createElement("li", null, "\u8FDB\u5165\u300C\u5206\u96C6\u5267\u672C\u300D\uFF0C\u67E5\u770B\u6BCF\u96C6\u5185\u5BB9\uFF0C\u70B9\u51FB\u300C\u62C6\u5206\u5F53\u524D\u96C6\u300D\u751F\u6210\u5206\u955C\uFF083\u79EF\u5206/\u96C6\uFF09\u3002"), /* @__PURE__ */ import_react17.default.createElement("li", null, "\u300C\u5206\u955C\u4E0E\u751F\u56FE\u300D\u6A21\u5757\uFF0C\u6309\u96C6\u663E\u793A\u5206\u955C\uFF0C\u53EFAI\u7EC6\u5316\u63D0\u793A\u8BCD\uFF081\u79EF\u5206/\u6B21\uFF09\uFF0C\u751F\u6210\u5206\u955C\u56FE\uFF083\u79EF\u5206/\u5F20\uFF09\u3002"), /* @__PURE__ */ import_react17.default.createElement("li", null, "\u300C\u89D2\u8272\u7BA1\u7406\u300D\u6DFB\u52A0\u89D2\u8272\uFF0C\u751F\u6210\u89D2\u8272\u63CF\u8FF0\uFF082\u79EF\u5206/\u6B21\uFF09\u548C\u89D2\u8272\u53C2\u8003\u56FE\uFF083\u79EF\u5206/\u5F20\uFF09\u3002"), /* @__PURE__ */ import_react17.default.createElement("li", null, "\u300C\u89C6\u9891\u751F\u6210\u300D\u6A21\u5757\uFF0C\u652F\u63014\u79CD\u6A21\u5F0F\uFF1AT2V\u7EAF\u6587\u672C\u3001I2V\u56FE\u751F\u89C6\u9891\u3001R2V\u9996\u5C3E\u5E27\u3001IA2V\u5168\u80FD\u53C2\u8003\uFF0C\u6309\u5206\u8FA8\u7387\u548C\u65F6\u957F\u6263\u79EF\u5206\u3002"), /* @__PURE__ */ import_react17.default.createElement("li", null, "\u300C\u914D\u97F3\u5DE5\u4F5C\u5BA4\u300D\u4E3A\u53F0\u8BCD\u751F\u6210AI\u914D\u97F3\uFF081\u79EF\u5206/\u79D2\uFF09\uFF0C\u652F\u6301\u6DFB\u52A0/\u4FEE\u6539/\u5220\u9664\u53F0\u8BCD\uFF0C\u6587\u5B57\u521B\u5EFA\u4E13\u5C5E\u97F3\u8272\u3002"), /* @__PURE__ */ import_react17.default.createElement("li", null, "\u300C3D\u5BFC\u6F14\u53F0\u300D\uFF08VIP\u4E13\u5C5E\uFF09\u642D\u5EFA3D\u573A\u666F\u548C\u4EBA\u7269\uFF0C\u6E32\u67D3\u9996\u5E27\u53C2\u8003\u56FE\uFF0C\u751F\u62103D\u6A21\u578B\u3002"), /* @__PURE__ */ import_react17.default.createElement("li", null, "\u300C\u526A\u8F91\u5BFC\u51FA\u300D\u6309\u526A\u6620\u98CE\u683C\u6392\u7248\uFF0C\u591A\u8F68\u9053\u7F16\u8F91\uFF0C\u6DFB\u52A0\u8F6C\u573A\u3001\u7279\u6548\uFF0C\u5BFC\u51FA\u6210\u7247\u3002"), /* @__PURE__ */ import_react17.default.createElement("li", null, "\u300C\u7D20\u6750\u5E93\u300D\u7EDF\u4E00\u7BA1\u7406\u6240\u6709\u751F\u6210\u7684\u89C6\u9891\u3001\u56FE\u7247\u3001\u97F3\u9891\u3001\u6587\u672C\uFF0C\u652F\u6301\u6536\u85CF\u548C\u5206\u7EC4\u3002")), /* @__PURE__ */ import_react17.default.createElement("h3", { style: { fontSize: 15, margin: "22px 0 10px" } }, "\u{1F6E0} \u5E38\u89C1\u62A5\u9519\u6392\u67E5"), /* @__PURE__ */ import_react17.default.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, faq.map(([q, a]) => /* @__PURE__ */ import_react17.default.createElement("div", { key: q, style: { padding: "10px 12px", border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: 8, background: "var(--panel, #161d2a)" } }, /* @__PURE__ */ import_react17.default.createElement("div", { style: { fontSize: 13, fontWeight: 600, color: "var(--text, #e8ecf3)" } }, q), /* @__PURE__ */ import_react17.default.createElement("div", { style: { fontSize: 12, color: "var(--text-secondary, #8b95a7)", marginTop: 4, lineHeight: 1.6 } }, a)))), /* @__PURE__ */ import_react17.default.createElement("h3", { style: { fontSize: 15, margin: "22px 0 10px" } }, "\u{1F50D} \u4E00\u952E\u73AF\u5883\u68C0\u6D4B"), /* @__PURE__ */ import_react17.default.createElement("div", { style: { display: "flex", gap: 10, flexWrap: "wrap" } }, /* @__PURE__ */ import_react17.default.createElement("button", { style: { padding: "8px 16px", border: "none", borderRadius: 6, background: "var(--accent-gradient, linear-gradient(135deg,#7c3aed,#3b82f6))", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }, onClick: runDiag }, diag ? "\u91CD\u65B0\u68C0\u6D4B" : "\u5F00\u59CB\u68C0\u6D4B"), /* @__PURE__ */ import_react17.default.createElement(
      "button",
      {
        style: { padding: "8px 16px", border: "1px solid #10b981", borderRadius: 6, background: "transparent", color: "#10b981", cursor: "pointer", fontSize: 13, fontWeight: 600 },
        onClick: () => openUserManual()
      },
      "\u{1F4D6} \u6253\u5F00\u7528\u6237\u624B\u518C"
    )), diag && /* @__PURE__ */ import_react17.default.createElement("div", { style: { marginTop: 10, display: "flex", flexDirection: "column", gap: 6 } }, diag.map(([name, ok]) => /* @__PURE__ */ import_react17.default.createElement("div", { key: name, style: { display: "flex", alignItems: "center", gap: 8, fontSize: 13 } }, /* @__PURE__ */ import_react17.default.createElement("span", { style: { color: ok ? "var(--success, #22c55e)" : "var(--danger, #ef4444)" } }, ok ? "\u2713" : "\u2717"), /* @__PURE__ */ import_react17.default.createElement("span", { style: { color: "var(--text-secondary, #8b95a7)" } }, name)))), /* @__PURE__ */ import_react17.default.createElement("h3", { style: { fontSize: 15, margin: "22px 0 10px" } }, "\u{1F9E9} \u4E3B\u8981\u4F9D\u8D56"), /* @__PURE__ */ import_react17.default.createElement("div", { style: { border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: "var(--radius, 10px)", overflow: "hidden" } }, deps.map(([name, desc], i) => /* @__PURE__ */ import_react17.default.createElement("div", { key: name, style: { display: "flex", gap: 12, padding: "10px 14px", borderBottom: i === deps.length - 1 ? "none" : "1px solid var(--border, rgba(255,255,255,0.08))", background: i % 2 ? "transparent" : "var(--panel, #161d2a)" } }, /* @__PURE__ */ import_react17.default.createElement("div", { style: { fontWeight: 600, fontSize: 13, minWidth: 130, color: "var(--text, #e8ecf3)" } }, name), /* @__PURE__ */ import_react17.default.createElement("div", { style: { fontSize: 13, color: "var(--text-secondary, #8b95a7)" } }, desc)))), /* @__PURE__ */ import_react17.default.createElement("h3", { style: { fontSize: 15, margin: "22px 0 10px" } }, "\u{1F4DD} \u66F4\u65B0\u65E5\u5FD7"), /* @__PURE__ */ import_react17.default.createElement("div", { style: { fontSize: 13, color: "var(--text-secondary, #8b95a7)", lineHeight: 1.8 } }, /* @__PURE__ */ import_react17.default.createElement("div", null, /* @__PURE__ */ import_react17.default.createElement("b", null, "v0.2.0"), "\uFF1A\u573A\u666F\u751F\u6210\u5F3A\u5236\u7EAF\u573A\u666F\u65E0\u4EBA\u7269\uFF1B\u56DB\u89C6\u56FE\u4FEE\u590D\uFF08\u80CC\u9762\u89C6\u89D2\u751F\u6548\u3001\u751F\u6210\u540E\u4E0D\u518D\u4E22\u5931\u67E5\u770B\uFF09\uFF1B\u5168\u94FE\u8DEF\u6309\u77ED\u5267\u7C7B\u578B\uFF08\u4EFF\u771F\u4EBA/\u52A8\u6F2B/\u534A\u5199\u5B9E/\u6F2B\u5267\uFF09\u6CE8\u5165\u751F\u6210\u98CE\u683C\uFF1B\u5C0F\u8BF4\u8F6C\u5267\u672C\u65B0\u589E\u76EE\u6807\u96C6\u6570\u4E14\u5185\u5BB9\u4E0D\u8DB3\u65F6 AI \u81EA\u52A8\u8865\u9F50\uFF1B\u89C6\u9891\u751F\u6210\u81EA\u52A8\u53C2\u8003\u4E0A\u4E00\u573A\u5C3E\u5E27\u4F5C\u9996\u5E27\u4FDD\u8BC1\u8FDE\u8D2F\uFF1B\u9879\u76EE\u6B63\u5F0F\u66F4\u540D\u4E3A\u300C\u70EC\u5E8F\u30FB\u5F71\u589F\u300D\u5E76\u63D0\u5347\u7248\u672C\u53F7\u3002"), /* @__PURE__ */ import_react17.default.createElement("div", null, /* @__PURE__ */ import_react17.default.createElement("b", null, "v0.1.2"), "\uFF1A\u79FB\u9664\u7247\u5934\u529F\u80FD\uFF1B\u526A\u8F91\u5668\u65B0\u589E\u89C6\u9891\u7247\u6BB5\u62D6\u62FD / \u97F3\u9891\u8F68 / \u5B57\u5E55\uFF08\u53F0\u8BCD\u751F\u6210\xB7SRT\xB7ASS \u5BFC\u5165\xB7\u8BED\u97F3\u8BC6\u522B\uFF09\uFF1B\u8865\u9F50\u4F7F\u7528\u8BF4\u660E\u3002"), /* @__PURE__ */ import_react17.default.createElement("div", null, /* @__PURE__ */ import_react17.default.createElement("b", null, "v0.1.1"), "\uFF1A\u65E0\u9650\u753B\u5E03\u652F\u6301\u591A\u96C6 / \u591A\u8282\u70B9 / \u8FDE\u7EBF / \u64A4\u56DE\u91CD\u505A / \u5BFC\u51FA\uFF1B3D \u5BFC\u6F14\u53F0\u52A0\u5165\u573A\u666F\u7F16\u8F91\u5668\u3001\u673A\u4F4D\u9884\u8BBE\u3001\u706F\u5149\u5929\u6C14\u3001\u673A\u4F4D\u622A\u56FE\u7ED1\u5B9A\u3001MD \u62C6\u955C\uFF1B\u65B0\u589E 4 \u5957\u4E3B\u9898\u4E0E\u300C\u4F59\u989D\u4E0D\u8DB3\u4E0D\u518D\u5F39\u7A97\u300D\u5F00\u5173\u3002"), /* @__PURE__ */ import_react17.default.createElement("div", null, /* @__PURE__ */ import_react17.default.createElement("b", null, "v0.1.0"), "\uFF1A\u521D\u7248\uFF0C\u5206\u573A\u5267\u672C / \u753B\u5E03 / \u526A\u8F91 / 3D \u5BFC\u6F14\u53F0 / \u914D\u97F3 / \u7D20\u6750\u5E93 / \u8BA1\u8D39\u9AA8\u67B6\u3002")), /* @__PURE__ */ import_react17.default.createElement("p", { style: { fontSize: 12, color: "var(--text-muted, #5d6779)", marginTop: 16 } }, "\u53CD\u9988\u4E0E\u5BA2\u670D\uFF1A\u4F7F\u7528\u4E2D\u9047\u5230\u95EE\u9898\u53EF\u5728\u300C\u8BBE\u7F6E \u2192 \u9AD8\u7EA7\u540E\u7AEF\u300D\u81EA\u67E5\u914D\u7F6E\uFF0C\u6216\u524D\u5F80\u54C1\u724C\u5B98\u7F51\u63D0\u4EA4\u53CD\u9988\u3002\u6210\u7247\u5408\u5E76\u4F9D\u8D56 ffmpeg.wasm\uFF0C\u9996\u6B21\u4F7F\u7528\u9700\u8054\u7F51\u4E0B\u8F7D\u5185\u6838\uFF08\u7EA6 30MB\uFF09\u3002")));
  }
  function TemplatePicker({ templates, onPick, onClose }) {
    return /* @__PURE__ */ import_react17.default.createElement("div", { style: overlay2, onClick: onClose }, /* @__PURE__ */ import_react17.default.createElement("div", { style: modal2, onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ import_react17.default.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 } }, /* @__PURE__ */ import_react17.default.createElement("h3", { style: { fontSize: 16, margin: 0 } }, "\u{1F3AD} \u9009\u62E9\u77ED\u5267\u6A21\u677F"), /* @__PURE__ */ import_react17.default.createElement("button", { style: xBtn, onClick: onClose }, "\u2715")), /* @__PURE__ */ import_react17.default.createElement("p", { style: { fontSize: 12, color: "var(--text-muted, #5d6779)", margin: "0 0 14px" } }, "\u6A21\u677F\u4F1A\u9884\u586B\u4E00\u53E5\u8BDD\u6897\u6982\u4E0E\u5206\u573A\u5267\u672C\u9AA8\u67B6\uFF0C\u65B0\u5EFA\u540E\u5373\u53EF\u6539\u5199\u3002"), /* @__PURE__ */ import_react17.default.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px,1fr))", gap: 12 } }, templates.map((t2) => /* @__PURE__ */ import_react17.default.createElement("button", { key: t2.key, onClick: () => onPick(t2), style: tplCard }, /* @__PURE__ */ import_react17.default.createElement("div", { style: { fontSize: 30 } }, t2.emoji), /* @__PURE__ */ import_react17.default.createElement("div", { style: { fontSize: 14, fontWeight: 600, margin: "6px 0 4px" } }, t2.name), /* @__PURE__ */ import_react17.default.createElement("div", { style: { fontSize: 11, color: "var(--text-muted, #5d6779)", lineHeight: 1.5 } }, t2.idea))))));
  }
  function RecycleBin({ list, onRestore, onPurge, onEmpty, onClose }) {
    return /* @__PURE__ */ import_react17.default.createElement("div", { style: overlay2, onClick: onClose }, /* @__PURE__ */ import_react17.default.createElement("div", { style: modal2, onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ import_react17.default.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 } }, /* @__PURE__ */ import_react17.default.createElement("h3", { style: { fontSize: 16, margin: 0 } }, "\u{1F5D1} \u56DE\u6536\u7AD9\uFF08", list.length, "\uFF09"), /* @__PURE__ */ import_react17.default.createElement("div", { style: { display: "flex", gap: 8 } }, /* @__PURE__ */ import_react17.default.createElement("button", { style: hp.miniBtnOn, disabled: !list.length, onClick: onEmpty }, "\u6E05\u7A7A\u56DE\u6536\u7AD9"), /* @__PURE__ */ import_react17.default.createElement("button", { style: xBtn, onClick: onClose }, "\u2715"))), /* @__PURE__ */ import_react17.default.createElement("p", { style: { fontSize: 12, color: "var(--text-muted, #5d6779)", margin: "0 0 12px" } }, "\u8BEF\u5220\u7684\u5DE5\u7A0B\u53EF\u5728\u6B64\u6062\u590D\uFF1B\u6C38\u4E45\u5220\u9664\u540E\u5C06\u65E0\u6CD5\u627E\u56DE\u3002"), list.length === 0 ? /* @__PURE__ */ import_react17.default.createElement("div", { style: hp.ph }, "\u56DE\u6536\u7AD9\u662F\u7A7A\u7684\u3002") : /* @__PURE__ */ import_react17.default.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" } }, list.map((r) => /* @__PURE__ */ import_react17.default.createElement("div", { key: r.id, style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: 8, background: "var(--panel, #161d2a)" } }, /* @__PURE__ */ import_react17.default.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ import_react17.default.createElement("div", { style: { fontSize: 13, color: "var(--text, #e8ecf3)" } }, r.title), /* @__PURE__ */ import_react17.default.createElement("div", { style: { fontSize: 11, color: "var(--text-muted, #5d6779)", marginTop: 2 } }, r.trashAt ? new Date(r.trashAt).toLocaleString("zh-CN", { hour12: false }) : "", " \u5220\u9664")), /* @__PURE__ */ import_react17.default.createElement("button", { style: hp.miniBtnOn, onClick: () => onRestore(r.id) }, "\u6062\u590D"), /* @__PURE__ */ import_react17.default.createElement("button", { style: s.ghostBtnDanger, onClick: () => onPurge(r.id) }, "\u6C38\u4E45\u5220\u9664"))))));
  }
  var overlay2 = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 };
  var modal2 = { width: "min(680px, 92vw)", maxHeight: "86vh", overflowY: "auto", background: "var(--bg, #0b0f17)", border: "1px solid var(--border, rgba(255,255,255,0.12))", borderRadius: "var(--radius, 12px)", padding: 20, color: "var(--text, #e8ecf3)" };
  var xBtn = { border: "none", background: "transparent", color: "var(--text-muted, #5d6779)", fontSize: 16, cursor: "pointer" };
  var tplCard = { textAlign: "left", padding: 14, border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: "var(--radius, 10px)", background: "var(--panel, #161d2a)", cursor: "pointer", color: "var(--text, #e8ecf3)" };
  var hp = {
    btnPrimary: { padding: "10px 18px", border: "none", borderRadius: "var(--radius-sm, 6px)", background: "var(--accent-gradient, linear-gradient(135deg, #7c3aed, #3b82f6))", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600 },
    btn: { padding: "10px 18px", border: "1px solid var(--border, rgba(255,255,255,0.14))", borderRadius: "var(--radius-sm, 6px)", background: "var(--panel-2, #1c2433)", cursor: "pointer", fontSize: 14, color: "var(--text-secondary, #8b95a7)" },
    ph: { color: "var(--text-muted, #5d6779)", fontSize: 13, padding: 16 },
    recent: { textAlign: "left", padding: "12px 14px", border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: "var(--radius, 10px)", background: "var(--panel, #161d2a)", cursor: "pointer", color: "var(--text, #e8ecf3)" },
    recentActive: { borderColor: "var(--accent-2, #3b82f6)" },
    search: { flex: 1, minWidth: 140, maxWidth: 220, padding: "6px 12px", border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: 16, fontSize: 13, boxSizing: "border-box", background: "var(--input-bg, #0f141e)", color: "var(--text, #e8ecf3)" },
    chip: { padding: "4px 12px", border: "1px solid var(--border, rgba(255,255,255,0.14))", borderRadius: 14, background: "var(--panel-2, #1c2433)", cursor: "pointer", fontSize: 12, color: "var(--text-secondary, #8b95a7)" },
    chipOn: { background: "var(--accent-gradient, linear-gradient(135deg, #7c3aed, #3b82f6))", color: "#fff", borderColor: "transparent" },
    board: { border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: "var(--radius, 10px)", background: "var(--panel, #161d2a)", padding: 12 },
    boardH: { fontSize: 13, fontWeight: 600, color: "var(--text, #e8ecf3)", marginBottom: 8 },
    boardEmpty: { fontSize: 12, color: "var(--text-muted, #5d6779)" },
    boardItem: { fontSize: 12, color: "var(--text-secondary, #8b95a7)", display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 0", borderBottom: "1px solid var(--border, rgba(255,255,255,0.06))" },
    card: { border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: "var(--radius, 10px)", overflow: "hidden", background: "var(--panel, #161d2a)" },
    cardActive: { borderColor: "var(--accent-2, #3b82f6)" },
    thumb: { position: "relative", height: 110, cursor: "pointer", display: "flex", alignItems: "flex-end", padding: 10, overflow: "hidden" },
    thumbEmoji: { position: "absolute", top: 10, left: 12, fontSize: 30 },
    pin: { position: "absolute", top: 8, right: 10, fontSize: 14 },
    thumbTitle: { fontSize: 14, fontWeight: 700, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.5)", zIndex: 1 },
    tag: { fontSize: 10, color: "var(--accent-2, #3b82f6)", background: "rgba(59,130,246,0.12)", borderRadius: 4, padding: "2px 6px" },
    cardBtn: { flex: 1, padding: "5px 0", fontSize: 12, borderRadius: 6, border: "none", background: "var(--accent-gradient, linear-gradient(135deg, #7c3aed, #3b82f6))", color: "#fff", cursor: "pointer" },
    iconBtn: { width: 30, padding: "5px 0", fontSize: 12, borderRadius: 6, border: "1px solid var(--border, rgba(255,255,255,0.14))", background: "var(--panel-2, #1c2433)", color: "var(--text-secondary, #8b95a7)", cursor: "pointer" },
    iconBtnDanger: { width: 30, padding: "5px 0", fontSize: 12, borderRadius: 6, border: "1px solid var(--danger, #ef4444)", background: "transparent", color: "var(--danger, #ef4444)", cursor: "pointer" }
  };
  var s = {
    badge: {
      padding: "3px 8px",
      borderRadius: 4,
      background: "var(--accent-gradient, linear-gradient(135deg, #7c3aed, #3b82f6))",
      color: "#fff",
      fontSize: 11,
      fontWeight: 700
    },
    sdHead: { fontSize: 13, fontWeight: 700, color: "var(--text, #e8ecf3)", marginBottom: 10 },
    select: {
      padding: "7px 10px",
      fontSize: 13,
      borderRadius: "var(--radius-sm, 6px)",
      border: "1px solid var(--border, rgba(255,255,255,0.08))",
      background: "var(--input-bg, #0f141e)",
      color: "var(--text, #e8ecf3)",
      outline: "none",
      width: "100%",
      boxSizing: "border-box"
    },
    ghostBtn: {
      flex: 1,
      padding: "6px 0",
      fontSize: 12,
      borderRadius: "var(--radius-sm, 6px)",
      cursor: "pointer",
      border: "1px solid var(--border, rgba(255,255,255,0.14))",
      background: "transparent",
      color: "var(--text-secondary, #8b95a7)"
    },
    ghostBtnDanger: {
      flex: 1,
      padding: "6px 0",
      fontSize: 12,
      borderRadius: "var(--radius-sm, 6px)",
      cursor: "pointer",
      border: "1px solid var(--danger, #ef4444)",
      background: "transparent",
      color: "var(--danger, #ef4444)"
    },
    miniLink: { background: "transparent", border: "none", color: "var(--accent-2, #3b82f6)", cursor: "pointer", fontSize: 11, padding: 0 },
    miniBtn: { padding: "3px 8px", fontSize: 11, borderRadius: 5, cursor: "pointer", border: "1px solid var(--border, rgba(255,255,255,0.14))", background: "var(--panel-2, #1c2433)", color: "var(--text-secondary, #8b95a7)" },
    miniBtnOn: { padding: "3px 8px", fontSize: 11, borderRadius: 5, cursor: "pointer", border: "none", background: "var(--accent-gradient, linear-gradient(135deg, #7c3aed, #3b82f6))", color: "#fff", fontWeight: 600 },
    progressTrack: { height: 6, borderRadius: 3, background: "var(--panel-2, #1c2433)", overflow: "hidden" },
    progressFill: { height: "100%", background: "var(--accent-gradient, linear-gradient(135deg, #7c3aed, #3b82f6))", transition: "width .3s ease" }
  };

  // src/main.jsx
  var import_ui2 = __require("@dual/ui");
  window.addEventListener("keydown", (e) => {
    if (e.key === "F5") {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  });
  async function bootstrap() {
    try {
      const tauri = window.__TAURI__;
      if (tauri && tauri.core && tauri.core.invoke) {
        try {
          const agnesKey = await tauri.core.invoke("read_agnes_key");
          if (agnesKey && !localStorage.getItem("AGNES_API_KEY")) {
            localStorage.setItem("AGNES_API_KEY", agnesKey);
          }
        } catch (_) {
        }
        try {
          const zhipuKey = await tauri.core.invoke("read_zhipu_key");
          if (zhipuKey && !localStorage.getItem("ZHIPU_API_KEY")) {
            localStorage.setItem("ZHIPU_API_KEY", zhipuKey);
          }
        } catch (_) {
        }
      }
    } catch (e) {
    }
    (0, import_client.createRoot)(document.getElementById("root")).render(
      /* @__PURE__ */ import_react18.default.createElement(import_ui2.ErrorBoundary, null, /* @__PURE__ */ import_react18.default.createElement(App, null))
    );
  }
  bootstrap();
})();
