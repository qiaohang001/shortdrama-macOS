import React from "react";

// 通用三栏布局：左侧列表 / 中间主工作区（自适应） / 右侧参数面板
// 参考图比例：中间编辑区占主体，两侧尽量窄。
export function ThreePane({ left, center, right, leftWidth = 200, rightWidth = 280 }) {
  return (
    <div style={styles.root}>
      <div style={{ ...styles.pane, ...styles.left, width: leftWidth, minWidth: leftWidth }}>{left}</div>
      <div style={{ ...styles.pane, ...styles.center }}>{center}</div>
      {right != null && right !== false && (
        <div style={{ ...styles.pane, ...styles.right, width: rightWidth, minWidth: rightWidth }}>{right}</div>
      )}
    </div>
  );
}

const styles = {
  root: {
    display: "flex",
    height: "100%",
    width: "100%",
    fontFamily: "var(--font, system-ui, -apple-system, 'PingFang SC', sans-serif)",
    color: "var(--text, #e8ecf3)",
    background: "var(--bg, #0b0f17)",
  },
  pane: { overflow: "hidden", boxSizing: "border-box", display: "flex", flexDirection: "column" },
  left: { background: "var(--bg-elevated, #111621)", borderRight: "1px solid var(--border, rgba(255,255,255,0.08))" },
  center: { flex: 1, minWidth: 0, background: "var(--panel, #161d2a)", borderRight: "1px solid var(--border, rgba(255,255,255,0.08))" },
  right: { background: "var(--bg, #0b0f17)", padding: 0, borderLeft: "1px solid var(--border, rgba(255,255,255,0.08))" },
};
