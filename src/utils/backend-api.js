/**
 * 烬序·影墟后端API封装（统一走调度机）
 *
 * 注意：本文件保留函数名是为了兼容旧组件引用，
 * 实际所有认证和用户信息都基于调度机的 DISPATCH_TOKEN。
 *
 * 积分相关：余额 / 预校验 / 会员状态一律实时查云端调度机，
 * 不再返回本地硬编码的假值。
 */
const DEFAULT_API_BASE = "https://api.jinsuai.cn";

// 与 dispatch-jobs.js 保持一致：允许用户在「设置」里自定义调度机地址。
// 之前这里是写死的常量，导致用户改了 DISPATCH_BASE_URL 后本文件的请求仍然打向官方地址。
function baseUrl() {
  return ((typeof localStorage !== "undefined" && localStorage.getItem("DISPATCH_BASE_URL")) ||
    DEFAULT_API_BASE
  ).replace(/\/$/, "");
}

// 调度机Token存储key
const DISPATCH_TOKEN_KEY = "DISPATCH_TOKEN";
const DISPATCH_USER_KEY = "DISPATCH_USER";

/**
 * 获取调度机Token
 */
export function getAccessToken() {
  return localStorage.getItem(DISPATCH_TOKEN_KEY);
}

/**
 * 获取当前用户基本信息（从localStorage读取）
 */
export function getCurrentUser() {
  const username = localStorage.getItem(DISPATCH_USER_KEY);
  if (!username) return null;
  return {
    username,
    nickname: username,
    phone: username,
  };
}

/**
 * 清除认证信息（登出）
 */
export function clearAuthData() {
  // 清除调度机相关存储
  localStorage.removeItem("DISPATCH_TOKEN");
  localStorage.removeItem("DISPATCH_USER");
  // 历史版本曾把明文密码写进这两个键，一并清理，避免旧数据继续留在磁盘上
  localStorage.removeItem("DISPATCH_PASS");
  localStorage.removeItem("JINSU_LOGIN_PASSWORD");
}

/**
 * 检查是否已登录（检查调度机Token）
 */
export function isLoggedIn() {
  return !!localStorage.getItem(DISPATCH_TOKEN_KEY);
}

/**
 * 通用请求函数（用调度机Token）
 */
async function request(path, options = {}) {
  const url = `${baseUrl()}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  // 添加调度机Authorization头
  const token = localStorage.getItem(DISPATCH_TOKEN_KEY);
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  // 请求超时：默认90秒，防止网络挂起时无限等待；长任务可传 timeout(ms) 覆盖
  const { timeout = 90000, signal: externalSignal, ...fetchOpts } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  if (externalSignal) {
    externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  try {
    const response = await fetch(url, { ...fetchOpts, headers, signal: controller.signal });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || data.detail || "请求失败");
    }
    return data;
  } catch (error) {
    console.error("API请求错误:", error);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// ========== 认证相关API ==========

/**
 * 注册（调用调度机注册接口）
 */
export async function register(phone, password, nickname) {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ username: phone, email: `${phone}@jinsuai.cn`, password }),
  });
}

/**
 * 登录（调用调度机登录接口）
 */
export async function login(phone, password) {
  const data = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: phone, password }),
  });

  // 登录成功，只保存 token 与账号。
  // 旧实现还把明文密码写进 DISPATCH_PASS / JINSU_LOGIN_PASSWORD 用于"自动登录"，
  // 登录态恢复已改为用 token 校验，这里不再留存密码。
  if (data.token) {
    localStorage.setItem("DISPATCH_TOKEN", data.token);
    localStorage.setItem("DISPATCH_USER", phone);
    localStorage.removeItem("DISPATCH_PASS");
    localStorage.removeItem("JINSU_LOGIN_PASSWORD");
  }
  return data;
}

/**
 * 登出
 */
export async function logout() {
  clearAuthData();
}

// ========== 用户相关API ==========

/**
 * 修改密码
 * 调度机目前未提供改密接口（云端仅有 /api/auth/login、/register、/me），
 * 这里保持明确报错，避免用户反复提交一个注定失败的表单。
 */
export async function changePassword(oldPassword, newPassword) {
  throw new Error("云端调度机暂未提供修改密码接口，请联系管理员处理");
}

// ========== 积分相关API ==========
// 余额和校验一律实时查云端调度机（/api/auth/me、/api/jobs/precheck）。
// 扣减不在本地做：云端在 /api/jobs/submit 提交任务时统一扣除，
// 这里只负责在扣/退之后把最新余额同步回界面，避免顶栏数字失真。

/**
 * 实时拉取云端用户信息（含积分与会员）
 */
export async function fetchMe() {
  return request("/api/auth/me", { method: "GET" });
}

/** 把最新余额推给顶栏（App.jsx 注册的 window.onCreditUpdate） */
function pushBalance(credits) {
  try {
    if (typeof window !== "undefined" && typeof window.onCreditUpdate === "function") {
      window.onCreditUpdate(Number(credits) || 0);
    }
  } catch {
    /* 顶栏刷新失败不影响主流程 */
  }
}

/**
 * 获取积分余额（实时查云端）
 */
export async function getCreditBalance() {
  const me = await fetchMe();
  const c = Number(me?.credits ?? me?.balance ?? 0) || 0;
  return { balance: c, credits: c };
}

/**
 * 积分预校验（实时查云端 /api/jobs/precheck）
 * 返回字段沿用旧约定：{ sufficient, balance, required }
 */
export async function precheckCredits(amount, type = "video", description = "") {
  // 未登录时明确报错，而不是像旧实现那样假装余额充足（会导致任务提交后才失败）
  if (!getAccessToken()) {
    throw new Error("未登录调度机，无法校验积分。请先在「设置 → 调度机」中登录。");
  }
  const r = await request("/api/jobs/precheck", {
    method: "POST",
    body: JSON.stringify({ type, params: {} }),
    timeout: 15000,
  });
  const balance = Number(r?.balance ?? 0) || 0;
  pushBalance(balance);
  return {
    sufficient: !!r?.sufficient,
    balance,
    required: Number(r?.required_credits ?? amount) || amount,
  };
}

/**
 * 扣减积分：调用调度机 /api/billing/consume 接口真正扣费。
 */
export async function deductCredits(amount, type = "video", description = "", referenceId = "") {
  try {
    const r = await request("/api/billing/consume", {
      method: "POST",
      body: JSON.stringify({ type, params: {}, description: description || `${type} 扣费` }),
    });
    const balance = Number(r?.balance_after ?? r?.credits ?? 0) || 0;
    pushBalance(balance);
    return { success: true, amount, type, description, reference_id: referenceId, balance_after: balance };
  } catch (e) {
    console.error("扣积分失败:", e);
    // 扣费失败时刷新一次余额，确保显示正确
    try {
      const me = await fetchMe();
      pushBalance(me?.credits);
    } catch { /* ignore */ }
    return { success: false, error: e.message, amount, type, description };
  }
}

/**
 * 积分回退：调用调度机 /api/billing/refund 接口（如果调度机支持）。
 * 若调度机暂无回退接口，则仅刷新余额并返回成功（不阻塞业务）。
 */
export async function refundCredits(amount, reason = "", referenceId = "") {
  try {
    // 尝试调用调度机回退接口（如果存在）
    const r = await request("/api/billing/refund", {
      method: "POST",
      body: JSON.stringify({ amount, reason, reference_id: referenceId }),
    });
    const balance = Number(r?.balance_after ?? r?.credits ?? 0) || 0;
    pushBalance(balance);
    return { success: true, amount, reason, reference_id: referenceId, balance_after: balance };
  } catch (e) {
    // 调度机暂无回退接口时，仅刷新余额
    console.warn("积分回退接口不可用，仅刷新余额:", e.message);
    try {
      const me = await fetchMe();
      pushBalance(me?.credits);
    } catch { /* ignore */ }
    return { success: true, amount, reason, reference_id: referenceId, note: "调度机暂无回退接口，仅刷新余额" };
  }
}

// ========== 会员相关API ==========

/**
 * 获取会员状态（实时查云端 /api/auth/me）
 */
export async function getMembershipStatus() {
  const me = await fetchMe();
  const level = Number(me?.membership_level ?? 0) || 0;
  return {
    is_vip: level > 0,
    level,
    expired_at: me?.membership_expiry || null,
    monthly_quota: me?.monthly_quota,
    monthly_used: me?.monthly_used,
  };
}

// 默认导出（兼容旧引用）
export default {
  register,
  login,
  logout,
  isLoggedIn,
  getAccessToken,
  getCurrentUser,
  clearAuthData,
  fetchMe,
  changePassword,
  getCreditBalance,
  precheckCredits,
  deductCredits,
  refundCredits,
  getMembershipStatus,
};
