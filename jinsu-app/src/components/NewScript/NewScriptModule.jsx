import React, { useState, useRef } from "react";
import mammoth from "mammoth";
import { api } from "../../dispatch-jobs.js";
import { readTextFileAuto } from "../../utils.js";

export function NewScriptModule({ project, update, log, onSwitchTab }) {
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [outline, setOutline] = useState(null);

  const fileInputRef = useRef(null);

  // 处理文件上传（支持 txt/md 文本文件和 docx 文件）
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.replace(/\.[^/.]+$/, "");
    const ext = file.name.split('.').pop().toLowerCase();
    let scriptContent = "";

    setLoading(true);
    log(`正在读取文件：${file.name}`);

    try {
      if (ext === 'docx' || ext === 'doc') {
        // 使用 mammoth 解析 docx（避免 JSZip 缺失导致的乱码）
        try {
          const ab = await file.arrayBuffer();
          const res = await mammoth.extractRawText({ arrayBuffer: ab });
          scriptContent = res.value || res.errorMessage || "";
        } catch (zipErr) {
          scriptContent = "上传的 " + ext + " 文件解析失败：" + zipErr.message + "。请将文档内容复制粘贴到新建剧本中。";
        }
      } else {
        // txt/md 文本文件（自动检测 UTF-8 / GBK 编码，解决乱码）
        scriptContent = await readTextFileAuto(file);
        scriptContent = scriptContent.slice(0, 50000);
      }

      log("正在分析剧本内容...");
      try {
        // 调用 LLM 自动分集和提取人物
        const prompt = `你是一名专业竖屏短剧编剧。请将以下剧本内容拆分为多集，并提取所有人物信息。

要求：
1. 每集时长90-120秒，对应300-500字剧本内容
2. 每集必须有明确的冲突点和钩子（结尾留悬念）
3. 人物信息要详细，包含外貌特征（便于AI生图保持一致性）
4. 只输出纯JSON，不要markdown代码块，不要解释

剧本内容：
${scriptContent.slice(0, 8000)}

输出JSON格式：
{
  "synopsis": "故事梗概（必填，150-200字，含核心冲突和卖点，不能为空）",
  "episodes": [
    {"title": "第X集：吸引人的标题", "content": "本集完整剧本（300-500字，含场景描述和人物对话）"}
  ],
  "characters": [
    {"name": "角色名", "role": "身份/职业", "personality": "性格特点（3-5个关键词）", "appearance": "外貌描述（年龄/发型/脸型/服装/体型，便于AI生图）"}
  ],
  "scenes": [
    {"title": "场景名", "desc": "场景描述（时间/地点/环境/氛围）"}
  ]
}`;

        const res = await api("/api/llm/chat", {
          method: "POST",
          body: JSON.stringify({
            messages: [{ role: "user", content: prompt }]
          })
        });

        const text = res.choices?.[0]?.message?.content || "{}";
        console.log("[上传剧本LLM输出]", text);
        log("LLM返回长度：" + text.length + "字符");

        // 去除markdown代码块标记
        let cleanText = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

        let parsed;
        try {
          parsed = JSON.parse(cleanText);
        } catch {
          try {
            const match = cleanText.match(/\{[\s\S]*\}/);
            if (match) parsed = JSON.parse(match[0]);
            else throw new Error("no json");
          } catch {
            log("JSON解析失败，按字数智能分集");
            // 智能分集：按每集400字拆分
            const chunkSize = 400;
            const chunks = [];
            for (let i = 0; i < scriptContent.length; i += chunkSize) {
              chunks.push(scriptContent.slice(i, i + chunkSize));
            }
            parsed = {
              synopsis: scriptContent.slice(0, 100),
              episodes: chunks.map((c, i) => ({ title: `第${i + 1}集`, content: c })),
              characters: [],
              scenes: []
            };
          }
        }

        let episodes = (parsed.episodes || []).map((ep, i) => ({
          id: `ep_${i + 1}`,
          title: ep.title || `第${i + 1}集`,
          content: ep.content || ""
        }));

        // 如果episodes为空，按字数智能分集
        if (episodes.length === 0) {
          log("episodes为空，按字数智能分集");
          const chunkSize = 400;
          for (let i = 0; i < scriptContent.length; i += chunkSize) {
            episodes.push({
              id: `ep_${episodes.length + 1}`,
              title: `第${episodes.length + 1}集`,
              content: scriptContent.slice(i, i + chunkSize)
            });
          }
        }

        let characters = (parsed.characters || []).map((c, i) => ({
          id: `char_${i + 1}`,
          name: c.name || `角色${i + 1}`,
          role: c.role || "",
          personality: c.personality || "",
          appearance: c.appearance || "",
          image: null,
          locked: false
        }));

        // 如果characters为空，从剧本内容提取常见角色名或生成默认
        if (characters.length === 0) {
          log("characters为空，生成默认角色");
          characters = [
            { id: "char_1", name: "主角", role: "主角", personality: "坚韧", appearance: "", image: null, locked: false },
            { id: "char_2", name: "反派", role: "反派", personality: "狡诈", appearance: "", image: null, locked: false },
            { id: "char_3", name: "配角", role: "配角", personality: "善良", appearance: "", image: null, locked: false }
          ];
        }

        const scenes = (parsed.scenes || []).map((s, i) => ({
          id: `scene_${i + 1}`,
          title: s.title || `场景${i + 1}`,
          desc: s.desc || "",
          imageUrl: null,
          videoUrl: null
        }));

        // 从剧本中提取对话场景作为镜头
        const lines = scriptContent.split('\n').filter(l => l.includes('：') || l.includes(':'));
        const shots = lines.slice(0, 10).map((line, i) => ({
          id: `shot_${i + 1}`,
          episodeId: episodes[0]?.id || null,
          title: `镜头${i + 1}`,
          sceneDesc: line.slice(0, 200),
          sceneType: "中景",
          cameraMove: "固定",
          duration: 5,
          promptCn: line,
          characters: [],
          dialogue: "",
          imageUrl: null,
          videoUrl: null,
          status: "pending",
          progress: 0
        }));

        update({
          title: name,
          script: scriptContent,
          outline: {
            synopsis: parsed.synopsis || (scriptContent?.slice(0, 100) + "...") || "上传的剧本内容",
            characters: characters,
            relations: []
          },
          episodes,
          scenes,
          shots,
          materials: { characters }
        });

        log(`剧本分析完成：${episodes.length}集，${characters.length}个人物`);
      } catch (err) {
        log("分析失败，使用基础模式：" + err.message);
        update({
          title: name,
          script: scriptContent,
          outline: {
            synopsis: "上传的剧本内容",
            characters: []
          },
          episodes: [{ id: "ep_1", title: "第1集", content: scriptContent.slice(0, 2000) }],
          scenes: [{ id: "scene_1", title: "开场", desc: scriptContent.slice(0, 500) }],
          materials: { characters: [] }
        });
      } finally {
        setLoading(false);
      }
    } catch (uploadErr) {
      log("文件读取失败：" + uploadErr.message);
      setLoading(false);
    }
  };

  // 调用 LLM 生成剧本
  const generateScript = async (params) => {
    setLoading(true);
    try {
      const episodeCount = parseInt(params.episodes) || 5;
      const prompt = `你是一名爆款竖屏短剧编剧。请根据以下参数生成完整的剧本大纲和分集内容。

【创作要求】
1. 竖屏短剧，每集90-120秒（300-500字）
2. 开头3秒必须有强钩子（冲突/悬念/反转）
3. 每集结尾留悬念，引导看下一集
4. 节奏快，冲突密集，爽点充足
5. 人物设定要具体（外貌描述便于AI生图保持一致性）
6. 【重要】只输出纯JSON，不要markdown代码块，不要解释，不要多余文字

【参数】
- 剧本类型：${params.type}
- 剧本名称：${params.title || "未命名"}
- 集数：必须生成 ${episodeCount} 集，不能少
- 单集时长：${params.duration}秒
- 主角性别：${params.gender}
- 核心关键词：${params.keywords || "无"}

【输出JSON格式】（必须严格按照此格式，包含 ${episodeCount} 个episodes和至少3个characters）：
{
  "synopsis": "故事梗概（必填，50-100字，含核心冲突和卖点）",
  "characters": [
    {"name": "主角名", "role": "身份/职业", "personality": "性格标签", "appearance": "外貌描述"},
    {"name": "反派名", "role": "身份/职业", "personality": "性格标签", "appearance": "外貌描述"},
    {"name": "配角名", "role": "身份/职业", "personality": "性格标签", "appearance": "外貌描述"}
  ],
  "episodes": [
    {"title": "第1集：标题", "content": "本集完整剧本300-500字"},
    {"title": "第2集：标题", "content": "本集完整剧本300-500字"}
  ]
}`;

      const res = await api("/api/llm/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }]
        })
      });

      // 解析 LLM 返回的 JSON
      const text = res.choices?.[0]?.message?.content || "{}";
      console.log("[LLM原始输出]", text);
      log("LLM返回长度：" + text.length + "字符");

      // 去除markdown代码块标记
      let cleanText = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

      let parsed;
      try {
        // 尝试直接解析
        parsed = JSON.parse(cleanText);
      } catch {
        try {
          // 尝试提取第一个完整的JSON对象
          const match = cleanText.match(/\{[\s\S]*\}/);
          if (match) parsed = JSON.parse(match[0]);
          else throw new Error("no json found");
        } catch {
          // 解析失败，用原始文本作为第一集内容
          log("JSON解析失败，使用原始文本作为内容");
          parsed = {
            synopsis: cleanText.slice(0, 100),
            episodes: Array.from({ length: episodeCount }, (_, i) => ({
              title: `第${i + 1}集`,
              content: i === 0 ? cleanText : `第${i + 1}集内容待生成`
            })),
            characters: [
              { name: "主角", role: "主角", personality: "坚韧", appearance: "" },
              { name: "反派", role: "反派", personality: "狡诈", appearance: "" },
              { name: "配角", role: "配角", personality: "善良", appearance: "" }
            ]
          };
        }
      }

      // 确保episodes数量足够
      let episodes = (parsed.episodes || []).map((ep, i) => ({
        id: `ep_${i + 1}`,
        title: ep.title || `第${i + 1}集`,
        content: ep.content || ""
      }));

      // 如果episodes不够，自动补充
      if (episodes.length < episodeCount) {
        log(`警告：模型只返回了${episodes.length}集，补充到${episodeCount}集`);
        for (let i = episodes.length; i < episodeCount; i++) {
          episodes.push({
            id: `ep_${i + 1}`,
            title: `第${i + 1}集`,
            content: `第${i + 1}集内容待生成`
          });
        }
      }

      const scenes = episodes.map((ep, i) => ({
        id: `scene_${i + 1}`,
        title: ep.title,
        desc: ep.content?.slice(0, 200) || ""
      }));

      // 确保characters至少3个
      let characters = parsed.characters || [];
      if (characters.length === 0) {
        characters = [
          { name: "主角", role: "主角", personality: "坚韧", appearance: "" },
          { name: "反派", role: "反派", personality: "狡诈", appearance: "" },
          { name: "配角", role: "配角", personality: "善良", appearance: "" }
        ];
      }

      const synopsis = parsed.synopsis || (episodes[0]?.content?.slice(0, 80) + "...") || ("类型：" + params.type + "，关键词：" + (params.keywords || "无"));

      update({
        title: params.title || "新剧本",
        type: params.type,
        episodes,
        outline: { synopsis, characters },
        scenes,
        materials: { characters }
      });

      setOutline(parsed);
      log(`剧本生成成功：${episodes.length}集，${characters.length}个人物`);
    } catch (e) {
      log("生成失败：" + e.message);
      console.error("[生成失败]", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 16, height: "100%", overflow: "auto", color: "var(--text)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>🎬 剧本创作</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <label style={{ padding: "8px 16px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 13 }}>
            📁 上传剧本（AI分析 1积分）
            <input type="file" accept=".txt,.md,.docx" style={{ display: "none" }} onChange={handleUpload} />
          </label>
          <button style={{ padding: "8px 16px", border: "none", borderRadius: 6, background: "linear-gradient(135deg, #7A5CFF, #5CE1E6)", color: "#fff", cursor: "pointer" }} onClick={() => setNewModalOpen(true)}>
            + 新建剧本
          </button>
        </div>
      </div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
        支持上传剧本或AI生成完整剧本（大纲+分集+分镜）
      </div>

      {/* 大纲展示 */}
      {project.outline && (
        <div style={{ marginBottom: 16, padding: 16, border: "1px solid var(--border)", borderRadius: 12, background: "var(--panel-2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14 }}>📋 剧本大纲</h3>
            {project.episodes && project.episodes.length > 0 && (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{project.episodes.length} 集 · {project.outline.characters?.length || 0} 个人物</span>
            )}
          </div>
          {project.outline.synopsis && (
            <div style={{ marginBottom: 12, padding: 10, background: "var(--input-bg)", borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>故事梗概</div>
              <p style={{ fontSize: 13, margin: 0, lineHeight: 1.6 }}>{project.outline.synopsis}</p>
            </div>
          )}
          {project.outline.characters && project.outline.characters.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>人物关系</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {project.outline.characters.map((c, i) => (
                  <div key={i} style={{ padding: "6px 10px", background: "rgba(122,92,255,0.15)", borderRadius: 6, border: "1px solid rgba(122,92,255,0.3)" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#7A5CFF" }}>{c.name}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{c.role}{c.personality ? " · " + c.personality : ""}</div>
                  </div>
                ))}
              </div>
              {project.outline.relations && project.outline.relations.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
                  关系：{project.outline.relations.join("、")}
                </div>
              )}
            </div>
          )}
          {project.episodes && project.episodes.length > 0 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>分集列表（{project.episodes.length}集）</div>
                <button style={{ fontSize: 11, padding: "2px 8px", border: "1px solid var(--border)", borderRadius: 4, background: "transparent", color: "var(--text)", cursor: "pointer" }}
                  onClick={() => onSwitchTab("storyboard")}>前往分镜 →</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto" }}>
                {project.episodes.map((ep, i) => (
                  <div key={i} style={{ padding: "8px 12px", background: "var(--input-bg)", borderRadius: 6, fontSize: 12, cursor: "pointer", display: "flex", justifyContent: "space-between" }}
                    onClick={() => onSwitchTab("editor")}>
                    <span style={{ fontWeight: 500 }}>{ep.title}</span>
                    <span style={{ color: "var(--text-muted)" }}>{ep.content?.length || 0} 字</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {newModalOpen && <NewScriptModal onClose={() => setNewModalOpen(false)} onCreated={(s) => { log("新剧本：" + s.title); setNewModalOpen(false); }} onGenerated={generateScript} />}
      {loading && <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>🤖 AI 正在生成剧本...</div>}
    </div>
  );
}

function NewScriptModal({ onClose, onCreated, onGenerated }) {
  const [mode, setMode] = useState("select");
  const [isVip, setIsVip] = useState(false);
  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>新建剧本</h3>
          <button style={{ border: "none", background: "none", cursor: "pointer", fontSize: 18, color: "var(--text)" }} onClick={onClose}>×</button>
        </div>
        {mode === "select" && (
          <div style={{ display: "flex", gap: 12 }}>
            <button style={cardBtn} onClick={() => setMode("quick")}>
              <div style={{ fontSize: 24 }}>⚡</div>
              <div style={{ fontWeight: 600, marginTop: 8 }}>快速创建</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>填写基本信息，AI自动生成剧本</div>
            </button>
            <button style={{ ...cardBtn, opacity: isVip ? 1 : 0.5, position: "relative" }} onClick={isVip ? () => setMode("detail") : undefined}>
              <div style={{ fontSize: 24 }}>🎯</div>
              <div style={{ fontWeight: 600, marginTop: 8 }}>详细创建</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>VIP专属 · 4步完整配置</div>
              {!isVip && <div style={{ fontSize: 10, color: "#f59e0b", marginTop: 4 }}>🔒 VIP权限</div>}
            </button>
          </div>
        )}
        {mode === "quick" && <QuickCreate onDone={(s) => { onCreated(s); onClose(); }} onBack={() => setMode("select")} onGenerate={onGenerated} onClose={onClose} />}
        {mode === "detail" && isVip && <DetailWizard onDone={(s) => { onCreated(s); onClose(); }} onBack={() => setMode("select")} onClose={onClose} />}
        {mode === "detail" && !isVip && (
          <div style={{ textAlign: "center", padding: 20 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
            <div style={{ fontSize: 14, color: "var(--text)" }}>详细创建为 VIP 功能</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>订阅会员后可使用完整 4 步向导</div>
            <button style={{ marginTop: 16, padding: "8px 20px", border: "none", borderRadius: 6, background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", cursor: "pointer" }} onClick={() => { onClose(); onCreated({ vipRequired: true }); }}>
              立即开通 VIP
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function QuickCreate({ onDone, onBack, onGenerate, onClose }) {
  const [form, setForm] = useState({
    type: "revenge", title: "", episodes: 10, duration: 120, gender: "female", keywords: ""
  });
  const [loading, setLoading] = useState(false);
  const types = [
    { k: "revenge", n: "复仇", e: "🔥" }, { k: "sweet", n: "甜宠", e: "🍬" },
    { k: "inlaw", n: "婆媳", e: "🏠" }, { k: "counter", n: "逆袭", e: "🚀" },
    { k: "xuanhuan", n: "玄幻", e: "⚔️" }, { k: "modern", n: "都市", e: "🌆" },
    { k: "ancient", n: "古装", e: "👑" }, { k: "trans", n: "穿越", e: "🌀" },
    { k: "face", n: "打脸", e: "👊" }, { k: "suspense", n: "悬疑", e: "🔍" }
  ];
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));
  
  const handleSubmit = async () => {
    if (onGenerate) {
      setLoading(true);
      try {
        await onGenerate(form);
        onClose();
      } finally {
        setLoading(false);
      }
    } else {
      onDone({ ...form, id: "script_" + Date.now(), createdAt: Date.now() });
      onClose();
    }
  };
  
  return (
    <div>
      <button style={{ marginBottom: 12, padding: "6px 12px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", borderRadius: 6, cursor: "pointer" }} onClick={onBack}>← 返回</button>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>剧本类型</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {types.map(t => (
              <button key={t.k} style={{ padding: "4px 10px", border: form.type === t.k ? "2px solid #7A5CFF" : "1px solid var(--border)", borderRadius: 6, background: form.type === t.k ? "rgba(122,92,255,0.2)" : "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 }} onClick={() => update("type", t.k)}>{t.e} {t.n}</button>
            ))}
          </div>
        </div>
        <div>
          <label style={label}>剧本名称（可留空AI生成）</label>
          <input style={input} value={form.title} onChange={e => update("title", e.target.value)} placeholder="如：重生后我成了总裁" />
        </div>
        <div>
          <label style={label}>集数</label>
          <input style={input} type="number" value={form.episodes} onChange={e => update("episodes", e.target.value)} min={1} max={100} />
        </div>
        <div>
          <label style={label}>单集时长（秒）</label>
          <select style={input} value={form.duration} onChange={e => update("duration", e.target.value)}>
            <option value={90}>90秒</option>
            <option value={120}>120秒</option>
          </select>
        </div>
        <div>
          <label style={label}>主角性别</label>
          <select style={input} value={form.gender} onChange={e => update("gender", e.target.value)}>
            <option value="female">女频</option>
            <option value="male">男频</option>
            <option value="dual">双主角</option>
          </select>
        </div>
        <div>
          <label style={label}>核心关键词（选填）</label>
          <input style={input} value={form.keywords} onChange={e => update("keywords", e.target.value)} placeholder="如：失忆、豪门、真假千金" />
        </div>
      </div>
      <button style={submitBtn} onClick={handleSubmit} disabled={loading}>
        {loading ? "🤖 AI 生成中..." : "🎬 一键生成剧本（1积分）"}
      </button>
    </div>
  );
}

const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 };
const modal = { width: 600, maxWidth: "92vw", maxHeight: "90vh", overflow: "auto", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 };
const cardBtn = { flex: 1, padding: 20, border: "1px solid var(--border)", borderRadius: 10, background: "var(--panel-2)", cursor: "pointer", color: "var(--text)", textAlign: "center" };
const label = { display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 };
const input = { width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 13, boxSizing: "border-box" };
const submitBtn = { width: "100%", marginTop: 16, padding: "12px", border: "none", borderRadius: 8, background: "linear-gradient(135deg, #7A5CFF, #5CE1E6)", color: "#fff", cursor: "pointer", fontSize: 15, fontWeight: 600 };

function DetailWizard({ onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    title: "", type: "revenge", genre: "modern",
    characters: [{ name: "", role: "", personality: "", appearance: "" }],
    outline: "", keywords: ""
  });
  const [loading, setLoading] = useState(false);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const updateChar = (i, k, v) => {
    const chars = [...form.characters];
    chars[i] = { ...chars[i], [k]: v };
    update("characters", chars);
  };
  const addChar = () => update("characters", [...form.characters, { name: "", role: "", personality: "", appearance: "" }]);
  const removeChar = (i) => update("characters", form.characters.filter((_, idx) => idx !== i));

  const generateFull = async () => {
    if (!form.title.trim()) { alert("请输入剧本名称"); return; }
    setLoading(true);
    try {
      const charsJson = JSON.stringify(form.characters.filter(c => c.name.trim()));
      const prompt = `你是一名专业竖屏短剧编剧兼分镜导演。请根据以下详细设定生成完整的大纲和分集内容。

创作要求：
1. 竖屏短剧，每集90-120秒（300-500字）
2. 严格按照用户设定的人物和剧情生成，不要擅自更改
3. 开头3秒强钩子，每集结尾留悬念
4. 冲突密集，节奏快，爽点充足
5. 场景描述要具体（便于AI生图/生视频）
6. 只输出纯JSON，不要markdown代码块，不要解释

设定：
- 剧本名称：${form.title}
- 类型：${form.type}
- 时代：${form.genre}
- 核心关键词：${form.keywords || "无"}
- 故事大纲：${form.outline || "（用户未提供，根据类型和关键词创作）"}
- 人物设定：${charsJson}

输出JSON格式：
{
  "synopsis": "完整故事梗概（必填，200字，含核心冲突、人物关系、结局走向，不能为空）",
  "episodes": [
    {"title": "第X集：吸引人的标题", "content": "本集完整剧本（300-500字，含场景描述+人物对话+动作提示）"}
  ]
}`;

      const res = await api("/api/llm/chat", {
        method: "POST",
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }],  })
      });

      const text = res.choices?.[0]?.message?.content || "{}";
      console.log("[详细创建LLM输出]", text);
      log("LLM返回长度：" + text.length + "字符");

      // 去除markdown代码块标记
      let cleanText = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

      let parsed;
      try {
        parsed = JSON.parse(cleanText);
      } catch {
        try {
          const match = cleanText.match(/\{[\s\S]*\}/);
          if (match) parsed = JSON.parse(match[0]);
          else throw new Error("no json");
        } catch {
          log("JSON解析失败，使用原始文本");
          parsed = {
            synopsis: cleanText.slice(0, 100),
            episodes: [{ title: "第1集", content: cleanText }]
          };
        }
      }

      const targetEpisodes = parseInt(form.episodes) || 5;
      let episodes = (parsed.episodes || []).map((ep, i) => ({
        id: `ep_${i + 1}`,
        title: ep.title || `第${i + 1}集`,
        content: ep.content || ""
      }));

      // 确保集数足够
      if (episodes.length < targetEpisodes) {
        log(`警告：模型只返回${episodes.length}集，补充到${targetEpisodes}集`);
        for (let i = episodes.length; i < targetEpisodes; i++) {
          episodes.push({ id: `ep_${i + 1}`, title: `第${i + 1}集`, content: `第${i + 1}集内容待生成` });
        }
      }

      const scenes = episodes.map((ep, i) => ({
        id: `scene_${i + 1}`,
        title: ep.title,
        desc: ep.content?.slice(0, 200) || ""
      }));

      const characters = form.characters.filter(c => c.name.trim()).map(c => ({
        name: c.name, role: c.role, personality: c.personality,
        appearance: c.appearance
      }));

      const synopsis = parsed.synopsis || (episodes[0]?.content?.slice(0, 80) + "...") || (form.type + "题材短剧，" + (form.genre || "") + "风格");

      update({
        title: form.title,
        type: form.type,
        episodes,
        outline: { synopsis, characters },
        scenes,
        materials: { characters }
      });
      log(`剧本「${form.title}」生成成功，共 ${episodes.length} 集`);
      onClose();
    } catch (e) {
      log("生成失败：" + e.message);
    } finally {
      setLoading(false);
    }
  };

  const types = [
    { k: "revenge", n: "复仇", e: "🔥" }, { k: "sweet", n: "甜宠", e: "🍬" },
    { k: "inlaw", n: "婆媳", e: "🏠" }, { k: "counter", n: "逆袭", e: "🚀" },
    { k: "xuanhuan", n: "玄幻", e: "⚔️" }, { k: "modern", n: "都市", e: "🌆" },
    { k: "ancient", n: "古装", e: "👑" }, { k: "trans", n: "穿越", e: "🌀" },
    { k: "face", n: "打脸", e: "👊" }, { k: "suspense", n: "悬疑", e: "🔍" }
  ];
  const genres = [
    { k: "modern", n: "现代" }, { k: "ancient", n: "古装" },
    { k: "xianxia", n: "仙侠" }, { k: "sci-fi", n: "科幻" }
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[1, 2, 3, 4].map(s => (
          <div key={s} style={{ flex: 1, height: 4, background: s <= step ? "#7A5CFF" : "var(--border)", borderRadius: 2 }} />
        ))}
      </div>

      {step === 1 && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>步骤 1/4：基本信息</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={label}>剧本名称 *</label>
              <input style={input} value={form.title} onChange={e => update("title", e.target.value)} placeholder="如：重生之绝世神医" />
            </div>
            <div>
              <label style={label}>剧本类型</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {types.map(t => (
                  <button key={t.k} style={{ padding: "4px 10px", border: form.type === t.k ? "2px solid #7A5CFF" : "1px solid var(--border)", borderRadius: 6, background: form.type === t.k ? "rgba(122,92,255,0.2)" : "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 }} onClick={() => update("type", t.k)}>{t.e} {t.n}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={label}>时代背景</label>
              <div style={{ display: "flex", gap: 6 }}>
                {genres.map(g => (
                  <button key={g.k} style={{ flex: 1, padding: "6px 0", border: form.genre === g.k ? "2px solid #7A5CFF" : "1px solid var(--border)", borderRadius: 6, background: form.genre === g.k ? "rgba(122,92,255,0.2)" : "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 }} onClick={() => update("genre", g.k)}>{g.n}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={label}>核心关键词（选填）</label>
              <input style={input} value={form.keywords} onChange={e => update("keywords", e.target.value)} placeholder="如：失忆、豪门、复仇" />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button style={submitBtn} onClick={() => setStep(2)}>下一步 →</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>步骤 2/4：人物设定</div>
            <button style={{ padding: "4px 10px", border: "1px solid var(--border)", borderRadius: 4, background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 }} onClick={addChar}>+ 添加角色</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {form.characters.map((c, i) => (
              <div key={i} style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 8, background: "var(--input-bg)" }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input style={{ ...input, flex: 1 }} placeholder="角色姓名" value={c.name} onChange={e => updateChar(i, "name", e.target.value)} />
                  <input style={{ ...input, flex: 1 }} placeholder="角色身份" value={c.role} onChange={e => updateChar(i, "role", e.target.value)} />
                  <button style={{ padding: "4px 8px", border: "1px solid #ef4444", borderRadius: 4, background: "transparent", color: "#ef4444", cursor: "pointer" }} onClick={() => removeChar(i)}>✕</button>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input style={{ ...input, flex: 1 }} placeholder="性格标签" value={c.personality} onChange={e => updateChar(i, "personality", e.target.value)} />
                  <input style={{ ...input, flex: 1 }} placeholder="外貌描述" value={c.appearance} onChange={e => updateChar(i, "appearance", e.target.value)} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
            <button style={{ padding: "8px 16px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: "pointer" }} onClick={() => setStep(1)}>← 上一步</button>
            <button style={submitBtn} onClick={() => setStep(3)}>下一步 →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>步骤 3/4：故事大纲</div>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>完整故事梗概（AI 将根据此生成剧情）</label>
            <textarea style={{ ...input, minHeight: 120, resize: "vertical" }} value={form.outline} onChange={e => update("outline", e.target.value)} placeholder="请详细描述故事背景、主要冲突、人物关系和结局走向..." />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button style={{ padding: "8px 16px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: "pointer" }} onClick={() => setStep(2)}>← 上一步</button>
            <button style={submitBtn} onClick={() => setStep(4)}>下一步 →</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>步骤 4/4：确认生成</div>
          <div style={{ padding: 16, background: "var(--input-bg)", borderRadius: 8, marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}><strong>剧本名称：</strong>{form.title || "（未填写）"}</div>
            <div style={{ marginBottom: 8 }}><strong>类型：</strong>{types.find(t => t.k === form.type)?.n || form.type}</div>
            <div style={{ marginBottom: 8 }}><strong>时代：</strong>{genres.find(g => g.k === form.genre)?.n || form.genre}</div>
            <div style={{ marginBottom: 8 }}><strong>人物：</strong>{form.characters.filter(c => c.name.trim()).length} 位</div>
            <div><strong>大纲：</strong>{form.outline ? `${form.outline.length} 字` : "（未填写，将使用默认模板）"}</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button style={{ padding: "8px 16px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: "pointer" }} onClick={() => setStep(3)}>← 上一步</button>
            <button style={{ ...submitBtn, background: "linear-gradient(135deg, #10b981, #059669)" }} onClick={generateFull} disabled={loading}>
              {loading ? "🤖 AI 生成中..." : "🎬 确认生成剧本（1积分）"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}