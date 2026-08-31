/**
 * GLM Client — 智谱 AI GLM-4-Flash 文本 SDK (JavaScript / Node + 浏览器)
 *
 * 统一替换原 Agnes 文本后端：写作 / 续写 / 大纲 / 拆书 / 风格复刻等纯文本能力
 * 全部走智谱 GLM-4-Flash（OpenAI 兼容接口）。图像 / 视频仍由 Agnes 负责
 * （见 @dual/agnes-client），二者 key 互不干扰。
 *
 * 端点：https://open.bigmodel.cn/api/paas/v4  （OpenAI 兼容）
 * 模型：glm-4-flash-250414（免费非推理版，直接输出文本；glm-4.7-flash 为推理模型，content 常为空不适用写作）
 *
 * 浏览器: key 从 localStorage['ZHIPU_API_KEY'] 读取（切勿硬编码暴露）
 * Node:   key 从 process.env.ZHIPU_API_KEY 读取
 *
 * 用法:
 *   import { GlmClient } from "./glm-client.js";
 *   const c = new GlmClient();
 *   await c.chat("你好");
 *   await c.chat(prompt, { onToken: (d) => {...} }); // 流式
 */

const BASE_URL = "https://open.bigmodel.cn/api/paas/v4";

/**
 * 清洗模型码：把全角/异形横杠统一成 ASCII 半角连字符 '-'，并修正已知无效码。
 * 智谱 1214「modelCode：不存在」两大诱因：① model 串里混入了全角破折号(—)/连接号(–)/全角连字(－)；
 * ② 用了对客户端早已下线的旧码（如 glm-4-flash，官方有效码是 glm-4-flash-250414）。
 * 这里在发送前兜底清洗，从源头杜绝 1214。
 */
const _DASH_VARIANTS = /[—–－―‒‐‑⁃]/g; // em/en/fullwidth/horizontal/etc.
function normalizeModel(m) {
  if (!m) return m;
  let s = String(m).replace(_DASH_VARIANTS, "-").trim();
  // 旧码兼容：glm-4-flash -> glm-4-flash-250414（glm-4-flash 已不可直接用，会 1214）
  if (s === "glm-4-flash") s = "glm-4-flash-250414";
  if (s === "glm-4-flashx") s = "glm-4-flashx-250414";
  return s;
}

// 智谱免费模型硬性限制：每个模型同一时刻仅 1 个并发请求。
// 这里用一条 promise 链把所有 chat 串行化，避免触发并发错误。
const _chain = { p: Promise.resolve() };
function serialize(fn) {
  const next = _chain.p.then(fn, fn);
  _chain.p = next.then(() => {}, () => {});
  return next;
}

export class GlmClient {
  constructor({ apiKey, baseUrl = BASE_URL, model = "glm-4.7-flash", maxRetries = 3 } = {}) {
    this.apiKey = apiKey || GlmClient.resolveKey();
    if (!this.apiKey) throw new Error("未找到智谱 API Key（ZHIPU_API_KEY）");
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.model = normalizeModel(model);
    this.maxRetries = maxRetries;
  }

  static resolveKey() {
    // 浏览器 / 桌面端渲染进程(WebView)：从 localStorage 读取（key 由设置面板或 Rust 后端注入）
    try {
      if (typeof localStorage !== "undefined" && localStorage.getItem("ZHIPU_API_KEY"))
        return localStorage.getItem("ZHIPU_API_KEY").trim();
    } catch (_) {}
    // Node 独立脚本环境：从环境变量读取
    try {
      if (typeof process !== "undefined" && process.env && process.env.ZHIPU_API_KEY)
        return process.env.ZHIPU_API_KEY.trim();
    } catch (_) {}
    return null;
  }

  _headers() {
    return { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" };
  }

  async _post(path, payload, timeoutMs = 180000) {
    let lastErr;
    for (let i = 0; i < this.maxRetries; i++) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), timeoutMs);
        const r = await fetch(`${this.baseUrl}${path}`, {
          method: "POST",
          headers: this._headers(),
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        });
        clearTimeout(t);
        // 智谱限流(429) / 模型过载(1305) 均退避后重试
        if (r.status === 429 || r.status === 1305) { await new Promise((s) => setTimeout(s, 1500 * 2 ** i)); continue; }
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
        return await r.json();
      } catch (e) {
        lastErr = e;
        await new Promise((s) => setTimeout(s, 1000 * 2 ** i));
      }
    }
    throw new Error(`智谱请求失败(${path}): ${lastErr}`);
  }

  /** 文本生成（支持流式回调）。串行执行以满足单并发限制。 */
  chat(prompt, { system = "你是一个专业的写作助手。", model = this.model,
    temperature = 0.8, maxTokens = 2000, onToken = null } = {}) {
    model = normalizeModel(model);
    return serialize(async () => {
      const payload = {
        model, temperature, max_tokens: maxTokens, stream: !!onToken,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      };
      if (!onToken) {
        const data = await this._post("/chat/completions", payload, 180000);
        const content = data?.choices?.[0]?.message?.content;
        if (content == null) throw new Error("智谱返回异常: " + JSON.stringify(data).slice(0, 300));
        return content;
      }
      // 流式
      const r = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST", headers: this._headers(), body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "", full = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
          const s = line.trim();
          if (!s.startsWith("data:")) continue;
          const chunk = s.slice(5).trim();
          if (chunk === "[DONE]") break;
          try {
            const obj = JSON.parse(chunk);
            const delta = obj.choices?.[0]?.delta?.content || "";
            if (delta) { full += delta; onToken(delta); }
          } catch (_) {}
        }
      }
      return full;
    });
  }
}

/**
 * DispatchGlmClient — 文本生成改走调度机 /api/llm/chat（服务端托管 GLM key + 计费）。
 * 与 GlmClient 保持相同 chat() 接口，桌面端不再自填/直连智谱 key。
 * 需用户已登录（localStorage DISPATCH_TOKEN）。调度机返回完整文本，这里按片段模拟流式以保留打字效果。
 */
export class DispatchGlmClient {
  constructor({ baseUrl = null, token = null } = {}) {
    this.baseUrl =
      baseUrl ||
      (typeof localStorage !== "undefined" && localStorage.getItem("DISPATCH_BASE_URL")) ||
      "http://123.57.243.61";
    this.baseUrl = this.baseUrl.replace(/\/$/, "");
    this.token =
      token ||
      (typeof localStorage !== "undefined" && localStorage.getItem("DISPATCH_TOKEN")) ||
      "";
  }

  _headers() {
    const h = { "Content-Type": "application/json" };
    if (this.token) h.Authorization = "Bearer " + this.token;
    return h;
  }

  /** 文本生成（接口同 GlmClient.chat）。
   *  优先级：有登录 token → 走调度机 /api/llm/chat（服务端托管 GLM key + 计费）；
   *  调度机失败（非余额不足）/ 未登录 → 回退本地直连智谱（用户自填 ZHIPU_API_KEY），保证不回归。
   */
  async chat(
    prompt,
    { system = "你是一个专业的写作助手。", model, temperature = 0.8, maxTokens = 2000, onToken = null } = {}
  ) {
    // 1) 优先走调度机（服务端托管 GLM key + 计费）
    if (this.token) {
      try {
        const messages = [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ];
        const res = await fetch(this.baseUrl + "/api/llm/chat", {
          method: "POST",
          headers: this._headers(),
          body: JSON.stringify({ messages, max_tokens: maxTokens, temperature }),
        });
        let data = null;
        try { data = await res.json(); } catch (_) {}
        if (!res.ok) {
          const err = new Error((data && (data.detail || data.message)) || `HTTP ${res.status}`);
          err.status = res.status;
          err.needRecharge =
            res.headers.get("X-Need-Recharge") === "1" || !!(data && data.need_recharge);
          throw err;
        }
        const text = data?.text ?? "";
        if (onToken) {
          const step = 4; // 模拟流式：按 4 字片段回调，保留打字效果
          for (let i = 0; i < text.length; i += step) {
            onToken(text.slice(i, i + step));
            await new Promise((r) => setTimeout(r, 6));
          }
        }
        return text;
      } catch (e) {
        if (e && e.needRecharge) throw e; // 余额不足直接抛，提示充值
        console.warn("调度机文本生成失败，回退本地智谱：", e && e.message);
        // 否则回退到本地直连智谱，保证不回归
      }
    }
    // 2) 本地兜底（旧行为）：直连智谱 GLM-4.7-Flash（key 取自 localStorage ZHIPU_API_KEY）
    const local = new GlmClient();
    return local.chat(prompt, { system, model, temperature, maxTokens, onToken });
  }
}

export default GlmClient;
