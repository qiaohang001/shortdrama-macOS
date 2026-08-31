import { useState, useEffect } from "react";

// 调度机API地址
const DISPATCH_API_URL = "https://api.jinsuai.cn";

/**
 * 登录/注册弹窗组件
 * 直接调用调度机API，使用用户名+邮箱+验证码注册
 */
export default function AuthModal({ isOpen, onClose, onLoginSuccess, initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode); // login | register
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaId, setCaptchaId] = useState("");
  const [captchaCode, setCaptchaCode] = useState("");
  const [captchaImage, setCaptchaImage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 获取验证码
  const fetchCaptcha = async () => {
    try {
      const res = await fetch(`${DISPATCH_API_URL}/api/auth/captcha`);
      const data = await res.json();
      if (data.captcha_id && data.image) {
        setCaptchaId(data.captcha_id);
        setCaptchaImage(data.image);
      }
    } catch (e) {
      console.error("获取验证码失败:", e.message);
    }
  };

  // 切换到注册模式时自动获取验证码
  useEffect(() => {
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
        // 直接调用调度机登录API
        const res = await fetch(`${DISPATCH_API_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json();

        if (!res.ok || !data.token) {
          throw new Error(data.detail || data.message || "登录失败，请检查用户名和密码");
        }

        // 保存token和用户信息
        localStorage.setItem("DISPATCH_TOKEN", data.token);
        localStorage.setItem("DISPATCH_USER", username);
        localStorage.setItem("DISPATCH_PASS", password);

        console.log("[调度机] 登录成功:", username);
        onLoginSuccess?.({ username, token: data.token });
        onClose();
      } else {
        // 注册：需要验证码
        if (!captchaId || !captchaCode) {
          throw new Error("请输入验证码");
        }

        const res = await fetch(`${DISPATCH_API_URL}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            email,
            password,
            captcha_id: captchaId,
            captcha: captchaCode,
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          // 注册失败，刷新验证码
          fetchCaptcha();
          throw new Error(data.detail || data.message || "注册失败，请重试");
        }

        console.log("[调度机] 注册成功:", username);

        // 注册成功后自动登录
        const loginRes = await fetch(`${DISPATCH_API_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const loginData = await loginRes.json();

        if (!loginRes.ok || !loginData.token) {
          throw new Error("注册成功，但自动登录失败，请手动登录");
        }

        // 保存token和用户信息
        localStorage.setItem("DISPATCH_TOKEN", loginData.token);
        localStorage.setItem("DISPATCH_USER", username);
        localStorage.setItem("DISPATCH_PASS", password);

        console.log("[调度机] 注册后自动登录成功:", username);
        onLoginSuccess?.({ username, token: loginData.token });
        onClose();
      }
    } catch (err) {
      setError(err.message || "操作失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--panel-bg, #1a1a2e)",
          borderRadius: 16,
          padding: 32,
          width: 420,
          maxWidth: "90vw",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          border: "1px solid var(--border, #333)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 24, color: "var(--text, #fff)" }}>
            {mode === "login" ? "登录" : "注册"}
          </h2>
          <p style={{ margin: "8px 0 0", color: "var(--text-secondary, #999)", fontSize: 13 }}>
            烬序·影墟 AI短剧生成平台
          </p>
        </div>

        {/* 切换登录/注册 */}
        <div
          style={{
            display: "flex",
            background: "var(--input-bg, #2a2a3e)",
            borderRadius: 8,
            padding: 4,
            marginBottom: 20,
          }}
        >
          <button
            style={{
              flex: 1,
              padding: "10px 0",
              border: "none",
              borderRadius: 6,
              background: mode === "login" ? "linear-gradient(135deg, #7A5CFF, #5CE1E6)" : "transparent",
              color: mode === "login" ? "#fff" : "var(--text-secondary, #999)",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              transition: "all 0.2s",
            }}
            onClick={() => {
              setMode("login");
              setError("");
            }}
          >
            登录
          </button>
          <button
            style={{
              flex: 1,
              padding: "10px 0",
              border: "none",
              borderRadius: 6,
              background: mode === "register" ? "linear-gradient(135deg, #7A5CFF, #5CE1E6)" : "transparent",
              color: mode === "register" ? "#fff" : "var(--text-secondary, #999)",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              transition: "all 0.2s",
            }}
            onClick={() => {
              setMode("register");
              setError("");
            }}
          >
            注册
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit}>
          {/* 用户名 */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "var(--text-secondary, #999)" }}>
              用户名
            </label>
            <input
              id="username"
              name="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              maxLength={30}
              autoComplete="username"
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid var(--border, #333)",
                borderRadius: 8,
                background: "var(--input-bg, #2a2a3e)",
                color: "var(--text, #fff)",
                fontSize: 14,
                boxSizing: "border-box",
              }}
              required
            />
          </div>

          {/* 邮箱（仅注册） */}
          {mode === "register" && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "var(--text-secondary, #999)" }}>
                邮箱
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="请输入邮箱"
                autoComplete="email"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "1px solid var(--border, #333)",
                  borderRadius: 8,
                  background: "var(--input-bg, #2a2a3e)",
                  color: "var(--text, #fff)",
                  fontSize: 14,
                  boxSizing: "border-box",
                }}
                required
              />
            </div>
          )}

          {/* 密码 */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "var(--text-secondary, #999)" }}>
              密码
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码（至少6位）"
              minLength={6}
              autoComplete="current-password"
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid var(--border, #333)",
                borderRadius: 8,
                background: "var(--input-bg, #2a2a3e)",
                color: "var(--text, #fff)",
                fontSize: 14,
                boxSizing: "border-box",
              }}
              required
            />
          </div>

          {/* 验证码（仅注册） */}
          {mode === "register" && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "var(--text-secondary, #999)" }}>
                验证码
              </label>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  id="captcha"
                  name="captcha"
                  type="text"
                  value={captchaCode}
                  onChange={(e) => setCaptchaCode(e.target.value)}
                  placeholder="请输入验证码"
                  maxLength={6}
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    border: "1px solid var(--border, #333)",
                    borderRadius: 8,
                    background: "var(--input-bg, #2a2a3e)",
                    color: "var(--text, #fff)",
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                  required
                />
                {captchaImage ? (
                  <img
                    src={captchaImage}
                    alt="验证码"
                    onClick={fetchCaptcha}
                    style={{
                      height: 46,
                      borderRadius: 8,
                      cursor: "pointer",
                      border: "1px solid var(--border, #333)",
                    }}
                    title="点击刷新验证码"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={fetchCaptcha}
                    style={{
                      padding: "0 16px",
                      border: "1px solid var(--border, #333)",
                      borderRadius: 8,
                      background: "var(--input-bg, #2a2a3e)",
                      color: "var(--text, #fff)",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    获取验证码
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 8,
                color: "#ef4444",
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px 0",
              border: "none",
              borderRadius: 8,
              background: loading ? "#666" : "linear-gradient(135deg, #7A5CFF, #5CE1E6)",
              color: "#fff",
              fontSize: 16,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.2s",
            }}
          >
            {loading ? "处理中..." : mode === "login" ? "登录" : "注册并登录"}
          </button>
        </form>

        {/* 底部提示 */}
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "var(--text-secondary, #666)" }}>
          {mode === "login" ? (
            <>
              还没有账号？
              <span
                style={{ color: "#7A5CFF", cursor: "pointer", marginLeft: 4 }}
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
              >
                立即注册
              </span>
            </>
          ) : (
            <>
              已有账号？
              <span
                style={{ color: "#7A5CFF", cursor: "pointer", marginLeft: 4 }}
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
              >
                立即登录
              </span>
            </>
          )}
        </div>

        {/* 注册赠送积分提示 */}
        {mode === "register" && (
          <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: "#5CE1E6" }}>
            新用户注册即送 8 积分
          </div>
        )}
      </div>
    </div>
  );
}
