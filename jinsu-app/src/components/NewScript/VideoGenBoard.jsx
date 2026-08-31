import React, { useState } from "react";
import { runDispatchJob } from "../../dispatch-jobs.js";

const VIDEO_MODES = [
  { key: "i2v", label: "图生视频 (I2V)", desc: "首帧(上一镜尾帧)+角色三视图，人物一致且画面连贯" },
  { key: "r2v", label: "首尾帧 (R2V)", desc: "上一镜尾帧作首帧+本镜尾帧，画面连贯" },
  { key: "t2v", label: "文生视频 (T2V)", desc: "纯文字描述生成，自由度最高" },
];

const RESOLUTIONS = [
  { key: "768p竖", label: "768P 竖屏" },
  { key: "1080p竖", label: "1080P 竖屏" },
  { key: "480p竖", label: "480P 竖屏" },
];

const DURATIONS = [
  { key: 5, label: "5秒" },
  { key: 10, label: "10秒" },
];

const WORKFLOW_ID = "minimax_h3_image_audio_to_video_v2";

// 从视频URL抽取最后一帧（尾帧），用于作为下一镜首帧
const extractLastFrame = (videoUrl) => new Promise((resolve) => {
  if (!videoUrl || typeof videoUrl !== "string") { resolve(null); return; }
  let done = false;
  let objectUrl = null;
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  video.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";
  document.body.appendChild(video);

  const cleanup = () => {
    try { video.pause(); } catch {}
    try { video.removeAttribute("src"); video.load(); } catch {}
    try { if (objectUrl) URL.revokeObjectURL(objectUrl); } catch {}
    try { video.parentNode && video.parentNode.removeChild(video); } catch {}
  };
  const finish = (url) => {
    if (done) return;
    done = true;
    cleanup();
    resolve(url);
  };
  const fail = (reason) => {
    console.warn("[extractLastFrame] failed:", reason);
    finish(null);
  };

  video.addEventListener("error", () => fail("video error"));
  video.addEventListener("loadedmetadata", () => {
    try {
      video.currentTime = Math.max(0, (video.duration || 1) - 0.1);
    } catch (e) { fail("seek error"); }
  });
  video.addEventListener("seeked", () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 720;
      canvas.height = video.videoHeight || 1280;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          objectUrl = URL.createObjectURL(blob);
          finish(objectUrl);
        } else {
          fail("toBlob null");
        }
      }, "image/jpeg", 0.9);
    } catch (e) { fail("canvas error: " + e.message); }
  });

  video.src = videoUrl;
  video.load().catch(() => fail("load error"));
  // 超时保护
  setTimeout(() => fail("timeout"), 15000);
});

export function VideoGenBoard({ project, update, log }) {
  const shots = project.shots || [];
  const characters = project.materials?.characters || [];
  const [busy, setBusy] = useState("");
  const [selectedMode, setSelectedMode] = useState("i2v");
  const [resolution, setResolution] = useState("768p竖");
  const [duration, setDuration] = useState(5);
  const [lastFrameUrl, setLastFrameUrl] = useState("");

  // 获取分镜涉及的角色图片
  const getShotCharacterImages = (sh) => {
    const shotCharNames = (sh.characters || []).map(n => n.trim());
    let matchedChars = [];
    if (shotCharNames.length > 0) {
      matchedChars = characters.filter(c =>
        c.image && shotCharNames.some(name => c.name?.includes(name) || name.includes(c.name))
      );
    }
    // 如果分镜没标角色，取所有有图的角色（最多3张）
    if (matchedChars.length === 0) {
      matchedChars = characters.filter(c => c.image).slice(0, 3);
    }
    return matchedChars.map(c => c.image).filter(Boolean);
  };

  // 找上一个分镜（同集内，按顺序）
  const getPrevShot = (sh) => {
    const idx = shots.findIndex(s => s.id === sh.id);
    if (idx <= 0) return null;
    // 优先找同集的上一个
    const sameEp = shots.filter(s => s.episodeId === sh.episodeId);
    const sameIdx = sameEp.findIndex(s => s.id === sh.id);
    if (sameIdx > 0) return sameEp[sameIdx - 1];
    return shots[idx - 1];
  };

  const genVideo = async (sh) => {
    setBusy(sh.id);
    log(`开始生成视频：${sh.title}（${selectedMode.toUpperCase()}）`);
    try {
      const sceneType = sh.sceneType || "中景";
      const cameraMove = sh.cameraMove || "固定";
      const desc = sh.promptCn || sh.sceneDesc || "";
      const shotDuration = sh.duration || duration;

      // 视频提示词：参考分镜描述 + 秒数 + 镜头语言
      const videoPrompt = `${sceneType}镜头，${cameraMove}运镜，时长${shotDuration}秒。${desc}。连续运镜，电影级竖屏短剧视觉，动态光影，画面流畅自然，主体清晰，背景有层次，无可见拍摄设备，一镜到底感。竖屏9:16构图，专业影视级画面。`;

      // AutoDL ComfyUI工作流参数
      const workflowParams = {
        prompt: videoPrompt,
        duration: shotDuration,
        resolution: resolution,
      };

      let refIdx = 0;

      if (selectedMode === "i2v") {
        // 图生视频：首帧(上一镜尾帧，可选) + 角色三视图(必须)
        const charImages = getShotCharacterImages(sh);
        if (charImages.length === 0) {
          log("⚠️ 没有可用的角色参考图，请先在「人物管理」生成角色三视图");
          setBusy("");
          return;
        }

        // 尝试提取上一镜尾帧作为首帧
        const prevShot = getPrevShot(sh);
        if (prevShot && prevShot.videoUrl) {
          log("正在提取上一镜尾帧作为首帧…");
          const firstFrame = await extractLastFrame(prevShot.videoUrl);
          if (firstFrame) {
            workflowParams.ref_image_0 = firstFrame;
            refIdx = 1;
            log(`首帧：来自「${prevShot.title}」尾帧 ✓`);
          } else {
            log("⚠️ 提取上一镜尾帧失败，将仅用角色图参考");
          }
        }

        // 角色三视图
        charImages.forEach((img) => {
          if (refIdx < 9) {
            workflowParams[`ref_image_${refIdx}`] = img;
            refIdx++;
          }
        });
        log(`参考图：首帧${workflowParams.ref_image_0 ? "✓" : "✗"} + 角色图${charImages.length}张`);
      } else if (selectedMode === "r2v") {
        // 首尾帧：首帧=上一镜尾帧（自动提取），尾帧=用户填写
        const prevShot = getPrevShot(sh);
        if (!prevShot || !prevShot.videoUrl) {
          log("⚠️ R2V模式需要上一镜已生成视频，用于提取尾帧作首帧");
          setBusy("");
          return;
        }
        if (!lastFrameUrl) {
          log("⚠️ R2V模式需要填写本镜尾帧图片URL");
          setBusy("");
          return;
        }
        log("正在提取上一镜尾帧作为首帧…");
        const firstFrame = await extractLastFrame(prevShot.videoUrl);
        if (!firstFrame) {
          log("⚠️ 提取上一镜尾帧失败，请检查上一镜视频是否可访问");
          setBusy("");
          return;
        }
        workflowParams.ref_image_0 = firstFrame;
        workflowParams.ref_image_1 = lastFrameUrl;
        log(`首尾帧：首帧（来自「${prevShot.title}」尾帧）✓ 尾帧✓`);
      }
      // t2v：不传参考图

      const res = await runDispatchJob({
        type: "video",
        payload: {
          workflow: WORKFLOW_ID,
          model: "MiniMax-H3",
          mode: selectedMode,
          ...workflowParams,
        },
        pollInterval: 5000,
        timeoutMs: 7200000
      });
      update({ shots: shots.map(s => s.id === sh.id ? { ...s, videoUrl: res.resultUrl } : s) });
      log(`✅ 视频生成成功：${sh.title}`);
    } catch (e) {
      log(`❌ 视频生成失败：${e.message}`);
    } finally {
      setBusy("");
    }
  };

  // 视频价格：720P=2积分/秒，1080P=3积分/秒
  const pricePerSec = resolution.includes("1080") ? 3 : 2;
  const currentCredits = pricePerSec * duration;
  const showLastFrame = selectedMode === "r2v";

  return (
    <div style={{ padding: 16, height: "100%", overflow: "auto", color: "var(--text)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>🎥 视频生成 · MiniMax-H3</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 12 }}
            value={selectedMode} onChange={e => setSelectedMode(e.target.value)}>
            {VIDEO_MODES.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
          <select style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 12 }}
            value={resolution} onChange={e => setResolution(e.target.value)}>
            {RESOLUTIONS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          <select style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 12 }}
            value={duration} onChange={e => setDuration(Number(e.target.value))}>
            {DURATIONS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        </div>
      </div>

      {/* 模式说明 */}
      <div style={{ marginBottom: 12, padding: "10px 14px", border: "1px solid rgba(122,92,255,0.3)", borderRadius: 8, background: "rgba(122,92,255,0.1)" }}>
        <div style={{ fontSize: 12, color: "#7A5CFF", fontWeight: 600, marginBottom: 4 }}>
          当前模式：{VIDEO_MODES.find(m => m.key === selectedMode)?.label}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
          {VIDEO_MODES.find(m => m.key === selectedMode)?.desc} · {resolution} {duration}秒 = {currentCredits} 积分（{pricePerSec}积分/秒）
        </div>
      </div>

      {/* R2V尾帧设置 */}
      {showLastFrame && (
        <div style={{ marginBottom: 16, padding: 12, border: "1px solid var(--border)", borderRadius: 8, background: "var(--panel-2)" }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>🖼️ 首尾帧设置</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
            首帧：自动提取上一镜视频的尾帧（无需手动填写）<br/>
            尾帧：填写本镜期望的结尾画面URL
          </div>
          <input style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 12 }}
            placeholder="尾帧图片 URL（必填）https://example.com/last-frame.jpg" value={lastFrameUrl} onChange={e => setLastFrameUrl(e.target.value)} />
        </div>
      )}

      {/* i2v提示 */}
      {selectedMode === "i2v" && (
        <div style={{ marginBottom: 16, padding: "10px 14px", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 8, background: "rgba(16,185,129,0.08)" }}>
          <div style={{ fontSize: 11, color: "#10b981", lineHeight: 1.6 }}>
            ✓ i2v模式将自动使用：<br/>
            &nbsp;&nbsp;1. 首帧 = 上一镜视频尾帧（保证画面连贯，无上一镜则跳过）<br/>
            &nbsp;&nbsp;2. 角色三视图 = 人物管理中已生成的角色图（保证人物一致）
          </div>
        </div>
      )}

      {shots.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎬</div>
          <div>暂无分镜</div>
          <div style={{ fontSize: 12, marginTop: 8 }}>请先在「分镜与生图」模块生成分镜</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {shots.map(sh => {
          const charImages = getShotCharacterImages(sh);
          const prevShot = getPrevShot(sh);
          const canI2V = charImages.length > 0;
          const canR2V = !!(prevShot && prevShot.videoUrl) && !!lastFrameUrl;
          return (
            <div key={sh.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "var(--panel-2)" }}>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ width: 120, height: 160, background: "var(--input-bg)", borderRadius: 8, flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                  {sh.videoUrl ? (
                    <video src={sh.videoUrl} controls style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : sh.imageUrl ? (
                    <img src={sh.imageUrl} alt={sh.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ fontSize: 32 }}>🎬</span>
                  )}
                  <div style={{ position: "absolute", top: 4, left: 4, background: "rgba(0,0,0,0.7)", borderRadius: 4, padding: "2px 6px", fontSize: 10, color: "#fff" }}>
                    {sh.sceneType || "中景"}
                  </div>
                  {sh.videoUrl && (
                    <div style={{ position: "absolute", bottom: 4, right: 4, background: "rgba(16,185,129,0.9)", borderRadius: 4, padding: "2px 6px", fontSize: 9, color: "#fff" }}>
                      ✓ 已生成
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{sh.title}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                    {sh.sceneType} · {sh.cameraMove} · {sh.duration || duration}秒
                    {sh.characters && sh.characters.length > 0 && ` · 角色：${sh.characters.join("、")}`}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text)", marginTop: 8, lineHeight: 1.5, maxHeight: 60, overflow: "hidden" }}>
                    {sh.sceneDesc || "无描述"}
                  </div>
                  {sh.dialogue && (
                    <div style={{ marginTop: 8, padding: "6px 10px", background: "rgba(122,92,255,0.1)", borderRadius: 6, fontSize: 12, fontStyle: "italic" }}>
                      💬 {sh.dialogue}
                    </div>
                  )}
                  {/* 模式可用性提示 */}
                  {selectedMode === "i2v" && !canI2V && (
                    <div style={{ marginTop: 6, fontSize: 11, color: "#f59e0b" }}>⚠️ 该分镜无匹配的角色参考图</div>
                  )}
                  {selectedMode === "r2v" && !canR2V && (
                    <div style={{ marginTop: 6, fontSize: 11, color: "#f59e0b" }}>
                      ⚠️ {!prevShot?.videoUrl ? "上一镜未生成视频" : "请填写尾帧URL"}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button
                  style={{ padding: "6px 12px", border: "none", borderRadius: 6, background: "linear-gradient(135deg, #7A5CFF, #5CE1E6)", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                  onClick={() => genVideo(sh)}
                  disabled={busy === sh.id}
                >
                  {busy === sh.id ? "⏳ 生成中…" : `🎬 生成视频 (${currentCredits}积分)`}
                </button>
                <button
                  style={{ padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 }}
                  onClick={() => {
                    const newPrompt = window.prompt("编辑视频提示词：", sh.promptCn || sh.sceneDesc || "");
                    if (newPrompt !== null) {
                      update({ shots: shots.map(s => s.id === sh.id ? { ...s, promptCn: newPrompt } : s) });
                    }
                  }}
                >
                  ✏️ 编辑提示词
                </button>
                {sh.videoUrl && (
                  <>
                    <button
                      style={{ padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 }}
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = sh.videoUrl;
                        a.download = `${sh.title}.mp4`;
                        a.click();
                      }}
                    >
                      ⬇️ 下载
                    </button>
                    <button
                      style={{ padding: "6px 12px", border: "1px solid #ef4444", borderRadius: 6, background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 12 }}
                      onClick={() => {
                        if (window.confirm("确定要清除这个视频吗？")) {
                          update({ shots: shots.map(s => s.id === sh.id ? { ...s, videoUrl: null } : s) });
                        }
                      }}
                    >
                      🗑 清除
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
