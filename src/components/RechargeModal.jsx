import React from "react";
import { openPurchasePage } from "../utils/openExternal.js";

/**
 * 充值弹窗 - 已改为跳转到官网支付
 * 为了兼容旧代码，保留组件但内容改为跳转提示
 */
export function RechargeModal({ onClose, onSuccess }) {
  const handleGoToWebsite = async () => {
    await openPurchasePage("recharge");
    if (onClose) onClose();
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 9999,
    }} onClick={onClose}>
      <div style={{
        background: "var(--bg, #1a1d2e)", borderRadius: 12, padding: 30,
        width: 400, maxWidth: "90vw", textAlign: "center",
        border: "1px solid var(--border, #2a2d3e)",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 50, marginBottom: 15 }}>💰</div>
        <h3 style={{ color: "var(--text)", marginBottom: 10 }}>前往官网充值</h3>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
          为了提供更安全、便捷的支付体验，充值功能已迁移至官网。
          <br />
          点击下方按钮将在浏览器中打开官网充值页面。
        </p>
        <button
          onClick={handleGoToWebsite}
          style={{
            padding: "12px 30px", border: "none", borderRadius: 8,
            background: "linear-gradient(135deg, #7A5CFF, #5CE1E6)",
            color: "#fff", cursor: "pointer", fontSize: 15, fontWeight: 600,
            marginBottom: 10,
          }}
        >
          前往官网充值
        </button>
        <br />
        <button
          onClick={onClose}
          style={{
            padding: "8px 20px", border: "1px solid var(--border)",
            borderRadius: 6, background: "transparent", color: "var(--text-muted)",
            cursor: "pointer", fontSize: 13,
          }}
        >
          取消
        </button>
        <p style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 15 }}>
          支付成功后，请回到软件刷新查看积分
        </p>
      </div>
    </div>
  );
}

export default RechargeModal;
