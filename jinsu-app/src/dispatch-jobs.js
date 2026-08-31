/**
 * 短剧端对接调度机 Jobs API 的通用封装。
 *
 * 流程：precheck → submit → poll /api/jobs/{id}
 * 需要用户在「设置」里登录调度机（localStorage DISPATCH_TOKEN）。
 * 未登录时所有方法直接抛错，调用方可自行回退到 Agnes 本地直连。
 */

function baseUrl() {
  return ((typeof localStorage !== "undefined" && localStorage.getItem("DISPATCH_BASE_URL")) || "http://123.57.243.61").replace(/\/$/, "");
}

function token() {
  return (typeof localStorage !== "undefined" && localStorage.getItem("DISPATCH_TOKEN")) || "";
}

function headers() {
  const h = { "Content-Type": "application/json" };
  const t = token();
  if (t) h.Authorization = "Bearer " + t;
  return h;
}

class DispatchError extends Error {
  constructor(message, { status, needRecharge } = {}) {
    super(message);
    this.status = status;
    this.needRecharge = needRecharge;
  }
}

/**
 * 静默重新登录：用 localStorage 里保存的账号密码换取新 token。
 * 仅在 token 过期（401）时触发，成功返回 true 并刷新 DISPATCH_TOKEN。
 * 密码仅在本地保存（与 token 同风险等级），用于免手动续期。
 */
async function tryRelogin() {
  const user = (typeof localStorage !== "undefined" && localStorage.getItem("DISPATCH_USER")) || "";
  const pass = (typeof localStorage !== "undefined" && localStorage.getItem("DISPATCH_PASS")) || "";
  if (!user || !pass) return false;
  try {
    const res = await fetch(baseUrl() + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password: pass }),
    });
    const data = await res.json().catch(() => ({}));
    const t = data.token || (data.data && data.data.token);
    if (!res.ok || !t) return false;
    localStorage.setItem("DISPATCH_TOKEN", t);
    return true;
  } catch {
    return false;
  }
}

async function api(path, opts = {}, _retry = false) {
  const url = baseUrl() + path;
  const res = await fetch(url, { ...opts, headers: { ...headers(), ...(opts.headers || {}) } });
  let data = {};
  try {
    data = await res.json();
  } catch (_) {}
  if (!res.ok) {
    // token 过期：尝试静默重登一次再重试，避免用户手动操作
    if (res.status === 401 && !_retry) {
      const ok = await tryRelogin();
      if (ok) return api(path, opts, true);
    }
    // 未登录时抛出带提示的错误
    if (res.status === 401) {
      const err = new DispatchError("未登录调度机，请先在「设置」中登录。", { status: 401, needAuth: true });
      throw err;
    }
    const needRecharge = res.status === 402 || res.headers.get("X-Need-Recharge") === "1" || !!data.need_recharge;
    throw new DispatchError(data.detail || data.message || `HTTP ${res.status}`, { status: res.status, needRecharge });
  }
  return data;
}

export async function precheck(type, params = {}) {
  return await api("/api/jobs/precheck", { method: "POST", body: JSON.stringify({ type, params }) });
}

export async function submitJob(type, payload = {}) {
  return await api("/api/jobs/submit", { method: "POST", body: JSON.stringify({ type, payload }) });
}

export async function getJob(jobId) {
  return await api(`/api/jobs/${jobId}`, { method: "GET" });
}

/**
 * 归一化工人返回的 result_url，保证客户端一定能访问到：
 *  - 服务端把 base_url 配成 localhost / 127.0.0.1（默认配置）时，把 host 换成客户端配置的调度机地址；
 *  - 相对路径（/static/...）补上调度机地址前缀；
 * 否则原样返回。
 */
export function normalizeResultUrl(url) {
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

/**
 * 提交并轮询一个 GPU 任务，直到成功/失败/超时。
 *
 * @param {Object} options
 * @param {string} options.type - "video" | "tts" | "intro"
 * @param {Object} options.payload - 工人实际需要的参数
 * @param {Function} options.onProgress - (percent, statusText) => void
 * @param {number} options.pollInterval - 默认 5000 ms
 * @param {number} options.timeoutMs - 默认 20 分钟（1200000 ms）
 * @returns {Promise<{result_url, ...}>}
 */
export async function runDispatchJob({ type, payload, onProgress = () => {}, pollInterval = 5000, timeoutMs = 1200000 }) {
  const t = token();
  if (!t) {
    throw new DispatchError("未登录调度机，请先在「设置」中登录。", { status: 401 });
  }

  // 1) 预校验余额
  const pre = await precheck(type, payload);
  if (!pre.sufficient) {
    const err = new DispatchError(`余额不足：需要 ${pre.required_credits} 积分，当前 ${pre.balance} 积分`, { status: 402, needRecharge: true });
    throw err;
  }
  onProgress(5, `余额校验通过，需 ${pre.required_credits} 积分`);

  // 2) 提交任务
  const job = await submitJob(type, payload);
  const jobId = job.id;
  onProgress(10, `任务已提交 ${jobId}`);

  // 3) 轮询
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await getJob(jobId);
    const progress = status.progress || 0;
    const statusText = status.status || "unknown";
    onProgress(Math.max(10, Math.min(99, progress)), statusText);

    if (status.status === "succeeded") {
      if (!status.result_url) throw new DispatchError("任务完成但未返回结果地址");
      onProgress(100, "完成");
      return { jobId, resultUrl: normalizeResultUrl(status.result_url), rawResultUrl: status.result_url, ...status };
    }
    if (status.status === "failed") {
      throw new DispatchError(status.error || "任务失败");
    }
    if (status.status === "canceled") {
      throw new DispatchError("任务已取消");
    }
    await new Promise((r) => setTimeout(r, pollInterval));
  }
  throw new DispatchError("任务轮询超时");
}

/**
 * 图像生成：调用后端 /api/image/generate，自动计费。
 * @param {Object} params
 * @param {string} params.prompt - 生图提示词
 * @param {string} [params.model] - "Qwen-Image" | "Z-Image-Turbo"，默认 Qwen-Image
 * @param {string} [params.size]  - "1328x1328" | "1024x1024"，按 model 默认
 * @param {number} [params.n]     - 生成张数，默认 1
 * @returns {Promise<{image_url: string, credits_used: number}>}
 */
export async function generateImage({ prompt, model = "Qwen-Image", size = "", n = 1 }) {
  if (!token()) {
    throw new DispatchError("未登录调度机，请先在「设置」中登录。", { status: 401 });
  }
  const payload = { prompt, model, size, n };
  return await api("/api/image/generate", { method: "POST", body: JSON.stringify(payload) });
}

export { DispatchError };
export { api };
