/**
 * DispatchGlmClient — 文本生成统一走调度机 /api/llm/chat（服务端托管 DeepSeek key + 计费）。
 * 桌面端不再自填/直连任何第三方 key；第三方直连逻辑已彻底移除。
 * 需用户已登录（localStorage DISPATCH_TOKEN）。调度机返回完整文本，这里按片段模拟流式以保留打字效果。
 */
export class DispatchGlmClient {
  constructor({ baseUrl = null, token = null } = {}) {
    this.baseUrl =
      baseUrl ||
      (typeof localStorage !== "undefined" && localStorage.getItem("DISPATCH_BASE_URL")) ||
      "https://api.jinsuai.cn";
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

  /** 文本生成（接口兼容原 GlmClient.chat）。调用后端 DeepSeek（非思考模式），按客户端定价计费。
   *  未登录或调度机失败时直接抛错，不再回退本地第三方 key。
   */
  async chat(
    prompt,
    { system = "你是一个专业的写作助手。", model, temperature = 0.8, maxTokens = 2000, onToken = null } = {}
  ) {
    if (!this.token) {
      throw new Error("未登录：文本生成需先登录调度机账号");
    }
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
  }
}

export default DispatchGlmClient;