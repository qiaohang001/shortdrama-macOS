import React from "react";

export function PricingGuide({ onClose }) {
  const modalStyle = {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center",
    justifyContent: "center", zIndex: 9999, padding: 20,
  };
  const cardStyle = {
    background: "var(--panel, #1a1f2e)", borderRadius: 12, padding: 24,
    maxWidth: 680, width: "100%", maxHeight: "85vh", overflow: "auto",
    color: "var(--text, #e8ecf3)", border: "1px solid var(--border, rgba(255,255,255,0.1))",
  };
  const tableStyle = {
    width: "100%", borderCollapse: "collapse", marginTop: 12, fontSize: 13,
  };
  const thStyle = {
    padding: "8px 10px", textAlign: "left", borderBottom: "2px solid var(--accent, #7c3aed)",
    color: "var(--text-secondary, #8b95a7)", fontWeight: 600, fontSize: 12,
  };
  const tdStyle = {
    padding: "8px 10px", borderBottom: "1px solid var(--border, rgba(255,255,255,0.06))",
  };
  const sectionTitle = {
    fontSize: 15, fontWeight: 600, marginTop: 20, marginBottom: 8,
    color: "var(--accent, #7c3aed)",
  };

  return (
    <div style={modalStyle} onClick={onClose}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>💰 收费标准</h2>
          <button onClick={onClose} style={{ border: "none", background: "none", color: "var(--text-muted)", fontSize: 24, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
          汇率：<b style={{ color: "#f59e0b" }}>1 元 = 5 积分</b>（1 积分 = 0.2 元）
        </div>

        <div style={sectionTitle}>一、单次功能消耗</div>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>功能</th>
              <th style={thStyle}>定价</th>
              <th style={thStyle}>折合人民币</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>文本生成（剧本/分镜/字幕）</td>
              <td style={tdStyle}><b>1 积分</b> / 次</td>
              <td style={tdStyle}>¥0.2</td>
            </tr>
            <tr>
              <td style={tdStyle}>生图（人物图/分镜图，768P含参考图）</td>
              <td style={tdStyle}><b>3 积分</b> / 张</td>
              <td style={tdStyle}>¥0.6</td>
            </tr>
            <tr>
              <td style={tdStyle}>视频生成 720P</td>
              <td style={tdStyle}><b>2 积分</b> / 秒</td>
              <td style={tdStyle}>5秒=¥2，10秒=¥4</td>
            </tr>
            <tr>
              <td style={tdStyle}>视频生成 1080P</td>
              <td style={tdStyle}><b>3 积分</b> / 秒</td>
              <td style={tdStyle}>5秒=¥3，10秒=¥6</td>
            </tr>
            <tr>
              <td style={tdStyle}>AI 配音（TTS）</td>
              <td style={tdStyle}><b>1 积分</b> / 集</td>
              <td style={tdStyle}>¥0.2</td>
            </tr>
          </tbody>
        </table>

        <div style={sectionTitle}>二、充值套餐</div>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>套餐</th>
              <th style={thStyle}>价格</th>
              <th style={thStyle}>到账积分</th>
              <th style={thStyle}>赠送</th>
              <th style={thStyle}>折合汇率</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style={tdStyle}>体验包</td><td style={tdStyle}>¥6</td><td style={tdStyle}>30</td><td style={tdStyle}>-</td><td style={tdStyle}>1:5</td></tr>
            <tr><td style={tdStyle}>基础包</td><td style={tdStyle}>¥30</td><td style={tdStyle}>160</td><td style={tdStyle}>+10</td><td style={tdStyle}>1:5.3</td></tr>
            <tr><td style={tdStyle}>创作包</td><td style={tdStyle}>¥98</td><td style={tdStyle}>550</td><td style={tdStyle}>+60</td><td style={tdStyle}>1:5.6</td></tr>
            <tr><td style={tdStyle}>工作室包</td><td style={tdStyle}>¥298</td><td style={tdStyle}>1800</td><td style={tdStyle}>+300</td><td style={tdStyle}>1:6</td></tr>
            <tr><td style={tdStyle}>企业包</td><td style={tdStyle}>¥698</td><td style={tdStyle}>4500</td><td style={tdStyle}>+1000</td><td style={tdStyle}>1:6.4</td></tr>
          </tbody>
        </table>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
          充得越多送得越多。新用户首充额外送 20 积分。
        </div>

        <div style={sectionTitle}>三、会员体系（订阅制 + 积分折扣）</div>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>会员</th>
              <th style={thStyle}>价格</th>
              <th style={thStyle}>每月赠送积分</th>
              <th style={thStyle}>功能折扣</th>
              <th style={thStyle}>额外权益</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style={tdStyle}>月卡</td><td style={tdStyle}>¥29/月</td><td style={tdStyle}>100</td><td style={tdStyle}>9折</td><td style={tdStyle}>优先队列、去水印</td></tr>
            <tr><td style={tdStyle}>季卡</td><td style={tdStyle}>¥79/季</td><td style={tdStyle}>350</td><td style={tdStyle}>85折</td><td style={tdStyle}>月卡全部 + 高清导出</td></tr>
            <tr><td style={tdStyle}>年卡</td><td style={tdStyle}>¥268/年</td><td style={tdStyle}>1500</td><td style={tdStyle}>8折</td><td style={tdStyle}>季卡全部 + 专属模型、客服优先</td></tr>
          </tbody>
        </table>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
          会员折扣和积分可叠加：年卡用户生成视频原价12积分，8折后仅9.6积分。
        </div>

        <div style={sectionTitle}>四、新用户引导</div>
        <table style={tableStyle}>
          <thead>
            <tr><th style={thStyle}>环节</th><th style={thStyle}>策略</th></tr>
          </thead>
          <tbody>
            <tr><td style={tdStyle}>注册</td><td style={tdStyle}>送 20 积分（够生成1次文本 + 2张图，体验完整流程）</td></tr>
            <tr><td style={tdStyle}>首次生成视频</td><td style={tdStyle}>弹出"首充6元得30积分"引导</td></tr>
            <tr><td style={tdStyle}>积分不足</td><td style={tdStyle}>弹出充值套餐，默认选中¥30基础包</td></tr>
          </tbody>
        </table>

        <div style={{ marginTop: 24, textAlign: "center" }}>
          <button onClick={onClose} style={{
            padding: "10px 32px", border: "none", borderRadius: 8,
            background: "linear-gradient(135deg, #7c3aed, #3b82f6)", color: "#fff",
            cursor: "pointer", fontSize: 14, fontWeight: 600,
          }}>我知道了</button>
        </div>
      </div>
    </div>
  );
}
