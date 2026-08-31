import React, { useState } from "react";
import { generateImage, api } from "../../dispatch-jobs.js";

export function StoryboardBoard({ project, update, log }) {
  const scenes = project?.scenes || [];
  const shots = project.shots || [];
  const [busy, setBusy] = useState("");
  const [autoSplitting, setAutoSplitting] = useState(false);
  const [selectedEp, setSelectedEp] = useState(null);

  const genSceneImage = async (sc) => {
    setBusy(sc.id);
    log("生成分镜图：" + sc.title);
    try {
      const sceneType = sc.sceneType || "中景";
      const cameraMove = sc.cameraMove || "固定";
      const desc = sc.desc || sc.sceneDesc || "";
      const prompt = `竖屏短剧分镜画面，${sceneType}镜头，${cameraMove}运镜。${desc}。电影级光影，高对比度，氛围感强，色彩分级专业，画面构图严谨，主体突出，背景有层次。超高清细节，8K分辨率，胶片质感，竖屏9:16构图，专业影视级画面。无文字，无水印，无边框。`;
      const res = await generateImage({ prompt, size: "768x1024", n: 1 });
      update({ scenes: scenes.map(s => s.id === sc.id ? { ...s, imageUrl: res.image_url } : s) });
      log("分镜图生成成功");
    } catch (e) {
      log("生成失败：" + e.message);
    } finally {
      setBusy("");
    }
  };

  const autoSplitScript = async () => {
    if (!project.script && !project.outline?.synopsis) {
      log("请先创作剧本或填写故事梗概");
      return;
    }
    setAutoSplitting(true);
    log("正在AI自动拆分成镜头...");
    try {
      const context = project.script || project.outline?.synopsis || "";
      const prompt = `你是一名专业竖屏短剧分镜导演。请根据以下剧本内容，自动拆分成5-10个分镜。

要求：
1. 每个分镜必须包含完整的镜头语言信息
2. 景别选择：远景(环境交代)/全景(人物全身)/中景(腰部以上)/近景(胸部以上)/特写(面部或细节)
3. 运镜方式：固定/推(向前推进)/拉(向后拉开)/摇(左右摇动)/移(平行移动)/跟(跟随主体)
4. 画面描述要具体（50-100字），包含：时代场景、人物动作表情、光影氛围、环境细节
5. 台词要准确引用剧本原文
6. 只输出纯JSON数组，不要markdown代码块，不要解释

剧本内容：
${context.slice(0, 3000)}

输出JSON格式（数组）：
[
  {
    "shotIndex": 1,
    "title": "镜头标题（简洁概括画面内容）",
    "sceneType": "中景",
    "cameraMove": "推镜",
    "sceneDesc": "画面描述（50-100字，含时代/场景/人物动作/表情/光影/氛围）",
    "dialogue": "人物台词（无台词则为空字符串）",
    "characters": ["角色名1", "角色名2"]
  }
]`;

      const res = await api("/api/llm/chat", {
        method: "POST",
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }] })
      });

      const text = res.choices?.[0]?.message?.content || "[]";
      let parsed;
      try {
        const match = text.match(/\[[\s\S]*?\]/);
        parsed = match ? JSON.parse(match[0]) : { shots: [] };
      } catch {
        parsed = { shots: [] };
      }

      if (parsed.shots && parsed.shots.length > 0) {
        const newShots = parsed.shots.map((sh, i) => ({
          id: "shot_" + Date.now() + "_" + i,
          shotIndex: sh.shotIndex || i + 1,
          episodeId: selectedEp || null,
          title: sh.title || "镜头" + (i + 1),
          sceneDesc: sh.sceneDesc || "",
          sceneType: sh.sceneType || "中景",
          cameraMove: sh.cameraMove || "固定",
          lighting: "自然光",
          emotion: "正常",
          duration: 5,
          promptCn: sh.sceneDesc || "",
          characters: sh.characters || [],
          dialogue: sh.dialogue || "",
          subtitle: "",
          innerMonologue: "",
          note: "",
          imageUrl: null,
          videoUrl: null,
          status: "pending",
          progress: 0
        }));
        update({ shots: [...newShots, ...shots] });
        log("自动拆分完成：" + newShots.length + " 个镜头");
      } else {
        log("未能自动拆分，请检查剧本内容");
      }
    } catch (e) {
      log("自动拆分失败：" + e.message);
    } finally {
      setAutoSplitting(false);
    }
  };

  const currentShots = selectedEp
    ? shots.filter(s => s.episodeId === selectedEp)
    : shots;

  return (
    <div style={{ padding: 16, height: "100%", overflow: "auto", color: "var(--text)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>📝 分镜与生图</h2>
        <button
          style={{ padding: "8px 16px", border: "none", borderRadius: 6, background: "linear-gradient(135deg, #7A5CFF, #5CE1E6)", color: "#fff", cursor: "pointer", fontSize: 13 }}
          onClick={autoSplitScript}
          disabled={autoSplitting || (!project.script && !project.outline?.synopsis)}
        >
          {autoSplitting ? "拆分中..." : "🤖 AI 自动拆分镜头（1积分）"}
        </button>
      </div>

      {project.episodes && project.episodes.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>按集筛选：</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              style={{ padding: "4px 12px", border: "1px solid var(--border)", borderRadius: 4, background: selectedEp === null ? "rgba(122,92,255,0.3)" : "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 }}
              onClick={() => setSelectedEp(null)}
            >全部</button>
            {project.episodes.map((ep, i) => (
              <button
                key={i}
                style={{ padding: "4px 12px", border: "1px solid var(--border)", borderRadius: 4, background: selectedEp === ep.id ? "rgba(122,92,255,0.3)" : "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 }}
                onClick={() => setSelectedEp(ep.id)}
              >{ep.title}</button>
            ))}
          </div>
        </div>
      )}

      {currentShots.length === 0 && scenes.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎬</div>
          <div>暂无分镜</div>
          <div style={{ fontSize: 12, marginTop: 8 }}>点击「AI 自动拆分镜头」或将剧本内容导入后自动生成</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {currentShots.map((sh) => (
          <div key={sh.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "var(--panel-2)" }}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ width: 120, height: 160, background: "var(--input-bg)", borderRadius: 8, flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                {sh.imageUrl ? (
                  <img src={sh.imageUrl} alt={sh.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: 32 }}>🎬</span>
                )}
                <div style={{ position: "absolute", top: 4, left: 4, background: "rgba(0,0,0,0.7)", borderRadius: 4, padding: "2px 6px", fontSize: 10, color: "#fff" }}>
                  {sh.sceneType || "中景"}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{sh.title}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  {sh.sceneType} · {sh.cameraMove} · {sh.duration || 5}秒
                </div>
                <div style={{ fontSize: 12, color: "var(--text)", marginTop: 8, lineHeight: 1.5 }}>
                  {sh.sceneDesc || sh.desc || "无描述"}
                </div>
                {sh.dialogue && (
                  <div style={{ marginTop: 8, padding: "6px 10px", background: "rgba(122,92,255,0.1)", borderRadius: 6, fontSize: 12, fontStyle: "italic" }}>
                    {sh.dialogue}
                  </div>
                )}
                {sh.characters && sh.characters.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-secondary)" }}>
                    人物：{sh.characters.join("、")}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                style={{ padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 }}
                onClick={() => genSceneImage({ ...sh, id: sh.id })}
                disabled={busy === sh.id}
              >
                {busy === sh.id ? "生成中…" : "🎨 生成分镜图 (3积分)"}
              </button>
              <button
                style={{ padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 }}
                onClick={() => {
                  const newDesc = window.prompt("编辑镜头描述：", sh.sceneDesc || "");
                  if (newDesc !== null) {
                    update({ shots: shots.map(s => s.id === sh.id ? { ...s, sceneDesc: newDesc } : s) });
                  }
                }}
              >
                ✏️ 编辑
              </button>
              <button
                style={{ padding: "6px 12px", border: "1px solid #ef4444", borderRadius: 6, background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 12 }}
                onClick={() => {
                  if (window.confirm("删除此镜头？")) {
                    update({ shots: shots.filter(s => s.id !== sh.id) });
                    log("已删除镜头：" + sh.title);
                  }
                }}
              >
                🗑 删除
              </button>
            </div>
          </div>
        ))}

        {scenes.filter(s => !shots.some(sh => sh.title === s.title)).map(sc => (
          <div key={sc.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "var(--panel-2)" }}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ width: 120, height: 160, background: "var(--input-bg)", borderRadius: 8, flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {sc.imageUrl ? <img src={sc.imageUrl} alt={sc.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 32 }}>🎬</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{sc.title}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{sc.desc || "无描述"}</div>
              </div>
            </div>
            <button style={{ marginTop: 12, padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 }} onClick={() => genSceneImage(sc)} disabled={busy === sc.id}>
              {busy === sc.id ? "生成中…" : "🎨 生成分镜图 (3积分)"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
