/**
 * 烬序 JINSU 统一品牌深色主题系统。
 * 注入 CSS 变量到 :root，所有 UI 组件通过 var(--xxx) 读取。
 * 仅保留深色主题（品牌锁定），不再提供浅色 / 跟随系统 / 彩色写作变体，
 * 以保证「妙笔小说」「AI 视频短剧」两个桌面端视觉一致、界面不乱。
 *
 * 品牌基调：
 *   深蓝紫底（#0d1024 → #181f44）
 *   电光紫 #7A5CFF（主色 / accent）
 *   数据青 #5CE1E6（副色 / accent-2）
 *   主色 → 副色渐变（accent-gradient）
 */

const BRAND_DARK = {
  // 背景层级（深蓝紫，由深到浅）
  "--bg": "#0d1024",
  "--bg-elevated": "#141a38",
  "--panel": "#181f44",
  "--panel-2": "#20275a",
  // 描边（紫调，弱→强）
  "--border": "rgba(122,92,255,0.16)",
  "--border-strong": "rgba(122,92,255,0.32)",
  // 文字
  "--text": "#eaf0ff",
  "--text-secondary": "#9aa6d4",
  "--text-muted": "#646e9c",
  // 品牌主色 / 副色
  "--accent": "#7A5CFF",          // 电光紫（主）
  "--accent-2": "#5CE1E6",        // 数据青（副）
  "--accent-gradient": "linear-gradient(135deg, #7A5CFF 0%, #5CE1E6 100%)",
  "--accent-gradient-hover": "linear-gradient(135deg, #6a4ce0 0%, #4ccfd4 100%)",
  "--accent-text": "#ffffff",
  // 语义色（在深底上重新校准，保证可读）
  "--danger": "#ff5c7a",
  "--success": "#34d399",
  "--warning": "#fbbf24",
  // 玻璃拟态 / 阴影（紫调）
  "--glass": "rgba(20,26,56,0.78)",
  "--glass-border": "rgba(122,92,255,0.20)",
  "--shadow": "0 8px 32px rgba(0,0,0,0.55)",
  // 输入 / 交互态
  "--input-bg": "#0f1430",
  "--hover": "rgba(122,92,255,0.08)",
  "--active": "rgba(122,92,255,0.18)",
  // 圆角 / 字体
  "--radius-sm": "6px",
  "--radius": "10px",
  "--radius-lg": "14px",
  "--font": "system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif",
};

export const THEME_VARS = {
  dark: BRAND_DARK,
};

export const THEME_LABELS = {
  dark: "深色 · 烬序",
};

/**
 * 应用主题。品牌锁定为深色：任何传入值（含历史存储的 light/system/eye 等）
 * 都会回退到 dark，确保已发布版本升级后不会出现浅色界面。
 */
export function applyTheme(themeName) {
  const root = document.documentElement;
  const resolved = THEME_VARS[themeName] ? themeName : "dark";
  root.dataset.theme = resolved;
  const vars = THEME_VARS[resolved];
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  }
  injectBaseStyles();
  return resolved;
}

/** 注入统一的深色滚动条样式，覆盖所有 WebKit 滚动条。 */
function injectBaseStyles() {
  const id = "jinsu-base-styles";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    html, body { margin: 0; padding: 0; width: 100vw; height: 100vh; overflow: hidden; background: var(--bg, #0d1024); color: var(--text, #eaf0ff); }
    #root { width: 100%; height: 100%; }
    *, *::before, *::after { box-sizing: border-box; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: transparent; border-radius: 6px; }
    ::-webkit-scrollbar-thumb {
      background: linear-gradient(180deg, rgba(122,92,255,0.55), rgba(92,225,230,0.38));
      border-radius: 6px;
      border: 2px solid var(--bg, #0d1024);
    }
    ::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, rgba(122,92,255,0.85), rgba(92,225,230,0.6)); }
    ::-webkit-scrollbar-corner { background: transparent; }
    html, body, * { scrollbar-width: thin; scrollbar-color: rgba(122,92,255,0.5) transparent; }
  `;
  document.head.appendChild(style);
}

/** 品牌锁定深色，恒为 true。保留签名以兼容既有调用（如 MenuBar）。 */
export function isDark() {
  return true;
}
