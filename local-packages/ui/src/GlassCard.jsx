import React from "react";

/**
 * 玻璃拟态卡片。children 内容，可选 title。
 */
export function GlassCard({ title, children, style }) {
  return (
    <div style={{ ...styles.card, ...style }}>
      {title && <div style={styles.head}>{title}</div>}
      <div style={styles.body}>{children}</div>
    </div>
  );
}

const styles = {
  card: {
    background: "var(--glass, rgba(22,29,42,0.78))",
    border: "1px solid var(--glass-border, rgba(255,255,255,0.10))",
    borderRadius: "var(--radius-lg, 14px)",
    boxShadow: "var(--shadow, 0 8px 32px rgba(0,0,0,0.45))",
    backdropFilter: "blur(10px)",
    overflow: "hidden",
  },
  head: {
    padding: "12px 14px",
    borderBottom: "1px solid var(--border, rgba(255,255,255,0.08))",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text, #e8ecf3)",
  },
  body: { padding: 14 },
};
