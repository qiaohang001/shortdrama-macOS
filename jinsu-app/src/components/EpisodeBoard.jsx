import React, { useState } from "react";
import { parseSourceToScript, pushHistory, repairAndParse, dramaModifier, downloadUrl, getVideoSize, characterReferenceImages, computeShotEndPoint, backgroundInheritText } from "../utils.js";
import { ImageLightbox } from "./ImageLightbox.jsx";
import { VideoSizePicker } from "./VideoSizePicker.jsx";
import { runDispatchJob, DispatchError, generateImage } from "../dispatch-jobs.js";

// 分场剧本：显示「第几集第几场」，每场可细化分镜（5-10 秒）。
// 每个分镜包含景别、运镜、灯光、情绪、特效、中文生视频提示词。
// 生成视频时可选择「角色参考图」（素材库生成的四视图 / 上传的整张参考图）传给 LTX-Video 保持角色一致性。

function LabelField({ label, value, onChange, placeholder, type = "text", min, max }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-secondary, #8b95a7)", marginBottom: 4 }}>{label}</div>
      <input style={field} type={type} min={min} max={max} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function EpisodeBoard({ project, update, log }) {
  const { open: openRecharge } = useSession();
  const [progress, setProgress] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [activeEp, setActiveEp] = useState(project?.episodes?.[0] ? project.episodes[0].id : null);
  // ── 视频生成前模式选择弹窗：genModal 持有待生成视频的 shot ──
  const [genModal, setGenModal] = useState(null);
  // ── 人物列「添加角色」输入框临时状态（按 shot id 隔离）──
  const [newChar, setNewChar] = useState({});

  // ── 生成状态持久化：存到 project.generating，切换模块/页面后按钮状态不丢失 ──
  const generating = project?.generating || {};
  const genKey = (kind, id) => `${kind}_${id}`;
  const isGenerating = (kind, id) => !!generating[genKey(kind, id)];
  const startGenerating = (kind, id, label) => {
    update((p) => {
      const g = p.generating || {};
      return { generating: { ...g, [genKey(kind, id)]: { startedAt: Date.now(), label } } };
    });
  };
  const endGenerating = (kind, id) => {
    update((p) => {
      const g = p.generating || {};
      const next = { ...g };
      delete next[genKey(kind, id)];
      return { generating: next };
    });
  };

  const client = () => new GlmClient();

  const episodes = project?.episodes || [];
  const shots = project?.shots || [];
  const dialogues = project?.dialogues || [];
  const materials = project?.materials || { characters: [], scenes: [] };

  // 当前选中集（若失效则回退首集）
  const ep = episodes.find((e) => e.id === activeEp) || episodes[0] || null;
  const epShots = ep ? shots.filter((s) => s.episodeId === ep.id) : [];
  const epDialogues = ep ? dialogues.filter((d) => d.episodeId === ep.id) : [];

  // ── 梗概 → 生成分集分场（LLM，结构化 episodes/shots/dialogues）──
  const genEpisodes = async () => {
    if (!project.idea.trim()) { log("请先填写故事梗概。"); return; }
    startGenerating("eps", "global", "AI 补充分集分场");
    log("正在生成分集分场剧本…");
    try {
      const text = await client().chat(
        `你是一名短剧编剧。根据以下梗概，写出 ${3} 集短剧，每集含 3-5 个分场。\n` +
        `严格按格式输出：\n第1集\n场景1｜分场标题\n（画面描述与台词）\n场景2｜分场标题\n...\n第2集\n场景1｜...\n` +
        `要求：每集以「第N集」独占一行开头；每个分场以「场景k｜标题」开头，后面是该场画面描述与角色台词（角色：台词）。\n梗概：${project.idea}`,
        { maxTokens: 2400, temperature: 0.9 }
      );
      const parsed = parseSourceToScript(text);
      if (!parsed.episodes.length) { log("生成结果为空，请重试或换个梗概。"); return; }
      update({ episodes: parsed.episodes, shots: parsed.shots, dialogues: parsed.dialogues, convertedAt: Date.now() });
      update({ history: pushHistory(project.history, "分集分场", `生成 ${parsed.episodes.length} 集 / ${parsed.shots.length} 场`) });
      setActiveEp(parsed.episodes[0].id);
      log(`已生成 ${parsed.episodes.length} 集 / ${parsed.shots.length} 分场。`);
    } catch (e) { log("出错：" + e.message); }
    finally { endGenerating("eps", "global"); }
  };

  // ── 集操作 ──
  const addEpisode = () => {
    const id = "ep_" + Date.now() + "_" + episodes.length;
    const next = [...episodes, { id, title: "第" + (episodes.length + 1) + "集", summary: "", order: episodes.length }];
    update({ episodes: next }); setActiveEp(id);
  };
  const editEpisode = (id, patch) => update({ episodes: episodes.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  const delEpisode = (id) => {
    if (episodes.length <= 1) { log("至少保留一集。"); return; }
    update({ episodes: episodes.filter((e) => e.id !== id), shots: shots.filter((s) => s.episodeId !== id), dialogues: dialogues.filter((d) => d.episodeId !== id) });
    const rest = episodes.filter((e) => e.id !== id);
    setActiveEp(rest[0] ? rest[0].id : null);
  };

  // ── 场（镜头）操作 ──
  // #430 修复：改为函数式更新，读取最新 project.shots，避免连续添加角色时闭包旧数组回写覆盖。
  const editShot = (id, patch) => update((p) => ({ shots: p.shots.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const addShot = () => {
    if (!ep) { log("请先选择或新建一集。"); return; }
    const id = "sh_" + Date.now() + "_" + shots.length;
    update({ shots: [...shots, { id, episodeId: ep.id, title: "新分场", sceneDesc: "", shotType: "", camera: "", lighting: "", costume: "", environment: "", mood: "", vfx: "", cnPrompt: "", aspectRatio: "9:16", prompt: "", imageUrl: null, videoUrl: null, duration: 5, status: "todo", progress: 0, shotIndex: shots.length, sceneType: "", cameraMove: "", emotion: "", effect: "", promptCn: "", characters: [], dialogue: "", subtitle: "", innerMonologue: "", note: "", foreshadow: false, endPoint: "", lastFrame: null, characterImage: null, characterImages: {} }] });
  };
  const delShot = (id) => update({ shots: shots.filter((s) => s.id !== id), dialogues: dialogues.filter((d) => d.shotId !== id) });

  // 从台词与描述中提取可能用到的角色/场景名（简单匹配素材库）
  const referencedCast = (sh) => {
    const names = new Set();
    const txt = `${sh.sceneDesc} ${sh.cnPrompt} ${(epDialogues.filter((d) => d.shotId === sh.id).map((d) => d.character + " " + d.text).join(" "))}`;
    (materials.characters || []).forEach((c) => { if (txt.includes(c.name)) names.add(c.name); });
    return Array.from(names);
  };
  const referencedScenes = (sh) => {
    const names = new Set();
    const txt = `${sh.sceneDesc} ${sh.cnPrompt} ${sh.environment}`;
    (materials.scenes || []).forEach((s) => { if (txt.includes(s.name)) names.add(s.name); });
    return Array.from(names);
  };
  const referencedCastDetails = (sh) => {
    const names = referencedCast(sh);
    if (!names.length) return "";
    return (materials.characters || [])
      .filter((c) => names.includes(c.name))
      .map((c) => c.prompt || c.desc || c.appearance || c.name)
      .join("；");
  };
  const referencedSceneDetails = (sh) => {
    const names = referencedScenes(sh);
    if (!names.length) return "";
    return (materials.scenes || [])
      .filter((s) => names.includes(s.name))
      .map((s) => s.prompt || s.desc || s.atmosphere || s.name)
      .join("；");
  };

  // ── #428 分析本分镜出场人物：合并 shot.characters（AI/用户显式）+ 本镜台词角色 + 素材库文本匹配 ──
  // 修复 #430：不再一旦 shot.characters 非空就跳过 fallback，避免用户手动添加一个角色后把 AI 识别的其他角色挤掉。
  const shotCharacters = (sh) => {
    const nameToChar = (name) => ({ name, material: (materials.characters || []).find((c) => c.name === name) });
    const names = new Set();
    // 1. 用户/AI 显式指定的角色
    (sh.characters || []).forEach((x) => {
      const n = typeof x === "string" ? x : (x && x.name) || "";
      if (n) names.add(n);
    });
    // 2. 本镜（按 shotId）台词中出现的角色
    epDialogues.filter((d) => d.shotId === sh.id).forEach((d) => { if (d.character) names.add(d.character); });
    // 3. 兜底：素材库角色名文本匹配本镜画面/提示词/台词
    referencedCast(sh).forEach((n) => names.add(n));
    return Array.from(names).map(nameToChar);
  };
  // ── 本镜所有「已就绪参考图」（用于视频 R2V 角色锁定），去重并上限 9 张 ──
  const shotReferenceImages = (sh) => {
    const out = [];
    const seen = new Set();
    const push = (name, urls) =>
      urls.forEach((u, i) => {
        if (!u || seen.has(u)) return;
        seen.add(u);
        out.push({ tag: name + (urls.length > 1 ? `_view${i}` : ""), data: u });
      });
    shotCharacters(sh).forEach((c) => {
      if (c.material) push(c.name, characterReferenceImages(c.material));
    });
    if (sh.referenceCharId) {
      const rc = (materials.characters || []).find((x) => x.id === sh.referenceCharId);
      if (rc) push(rc.name, characterReferenceImages(rc));
    }
    return out.slice(0, 9);
  };
  const clampDuration = (d) => {
    const n = Number(d);
    if (!isFinite(n) || n < 1) return 1;
    if (n > 15) return 15;
    return n;
  };
  // #430 修复：函数式读取最新 shot.characters 再追加，杜绝旧数组覆盖。
  const addChar = (shId, name) => {
    const n = (name || "").trim();
    if (!n) return;
    update((p) => {
      const sh = p.shots.find((x) => x.id === shId);
      const cur = ((sh && sh.characters) || []).filter(Boolean);
      if (cur.includes(n)) return null; // 已存在则不重复添加
      return { shots: p.shots.map((s) => (s.id === shId ? { ...s, characters: [...cur, n] } : s)) };
    });
    setNewChar((s) => ({ ...s, [shId]: "" }));
  };
  const removeChar = (sh, name) => {
    editShot(sh.id, { characters: (sh.characters || []).filter((x) => x !== name) });
  };

  // ── 单镜头提示词细化：把当前中文提示词扩展成更适合视频生成的描述 ──
  const refinePrompt = async (sh) => {
    startGenerating("prompt", sh.id, `细化提示词 · ${sh.title}`);
    log(`正在细化「${sh.title}」的生视频提示词…`);
    try {
      const prompt = `你是一名短剧 AI 视频提示词工程师。请将以下分镜信息扩展成一段更专业、更适合 Wan2.2 等视频生成模型的中文提示词。

要求：
1. 必须包含：景别、运镜、灯光、情绪、特效、角色、场景。
2. 对以下维度做细化（只在原信息已有对应内容时强化，不凭空添加）：
   - 打斗动作：如有打斗，细化招式、力度、节奏、肢体接触细节。
   - 人物动作：细化表情、手势、姿态、眼神、互动。
   - 人物移动：细化走位、方向、速度、镜头跟随关系。
   - 特效效果：细化光效、粒子、烟雾、破碎、能量波动、颜色变化。
   - 环境：细化时间、天气、空间层次、前景/背景元素、氛围。
3. 保留原意，不要增加不存在的内容。
4. 只输出最终提示词，不要解释，不要 markdown。

原信息：
景别：${sh.shotType || "未指定"}
运镜：${sh.camera || "未指定"}
灯光：${sh.lighting || "未指定"}
情绪：${sh.mood || "未指定"}
特效：${sh.vfx || "未指定"}
环境：${sh.environment || "未指定"}
服饰：${sh.costume || "未指定"}
画面描述：${sh.sceneDesc || ""}
原标题：${sh.title || ""}
当前提示词：${sh.cnPrompt || ""}`;
      const res = await client().chat(prompt, { maxTokens: 1200, temperature: 0.75 });
      const refined = (res || "").trim();
      if (!refined) throw new Error("AI 返回为空");
      // #409 背景继承 + 镜头收束点：拼到 promptCn 结尾
      const idx = epShots.findIndex((s) => s.id === sh.id);
      const prev = idx > 0 ? epShots[idx - 1] : null;
      let finalCn = refined;
      const bg = prev ? backgroundInheritText(prev) : "";
      if (bg) finalCn += bg;
      const ep = computeShotEndPoint(sh);
      finalCn += (finalCn ? " " : "") + ep;
      editShot(sh.id, { cnPrompt: finalCn, promptCn: finalCn, endPoint: ep });
      update({ history: pushHistory(project.history, "细化提示词", sh.title) });
      log(`「${sh.title}」提示词已细化。`);
    } catch (e) {
      log("提示词细化失败：" + e.message);
    } finally {
      endGenerating("prompt", sh.id);
    }
  };

  const buildVideoPrompt = (sh, prevShot) => {
    const castDetails = referencedCastDetails(sh);
    const sceneDetails = referencedSceneDetails(sh);
    const hasFields = sh.camera || sh.cameraMove || sh.shotType || sh.environment || sh.lighting || sh.mood || sh.emotion || sh.vfx || sh.effect || sh.costume;

    // #431：参考内容含「台词·字幕·备注」，统一拼接到 prompt 末尾
    const dlgLines = epDialogues.filter((d) => d.shotId === sh.id);
    const dlgText = dlgLines.length ? "台词：" + dlgLines.map((d) => `${d.character}：${d.text}`).join("；") + "。" : "";
    const subText = sh.subtitle ? "字幕：" + sh.subtitle + "。" : "";
    const noteText = sh.note ? "备注：" + sh.note + "。" : "";

    let base = "";
    if (sh.cnPrompt && sh.cnPrompt.length > 60) {
      // 用户已写详细提示词：保留并追加素材参考
      base = sh.cnPrompt;
    } else if (hasFields) {
      const parts = [];
      if (sh.camera || sh.cameraMove) parts.push(`${sh.camera || sh.cameraMove}`);
      if (sh.shotType || sh.sceneType) parts.push(`${sh.shotType || sh.sceneType}镜头`);
      if (sh.environment || sh.sceneDesc) parts.push(`场景与画面：${sh.environment || sh.sceneDesc}`);
      if (sh.costume) parts.push(`角色造型：${sh.costume}`);
      if (sh.lighting) parts.push(`光线：${sh.lighting}`);
      if (sh.mood || sh.emotion) parts.push(`情绪氛围：${sh.mood || sh.emotion}`);
      if (sh.vfx || sh.effect) parts.push(`视觉特效：${sh.vfx || sh.effect}`);
      base = parts.join("，") + "，竖屏 9:16 构图";
    } else {
      base = `镜头语言呈现：${sh.title}。${(sh.sceneDesc || "").slice(0, 160)}`;
    }

    let refs = "";
    if (castDetails) refs += ` 角色设定参考：${castDetails}。`;
    if (sceneDetails) refs += ` 场景设定参考：${sceneDetails}。`;

    // #408 视频画质约束：人物稳固不崩坏、肢体正常、构图稳定（保留既有电影级后缀与句点守卫）
    const QUALITY_DIRECTIVES = "人物面部清晰不崩坏，动作流畅自然，无畸形肢体，无多余或缺失的手指，肢体比例正确，构图稳定，无扭曲变形";
    let full = `${base}。连续运镜，电影级竖屏短剧视觉，动态光影，高端视觉特效（VFX），超写实，电影级动态模糊，极具张力的画面节奏，无可见拍摄设备，一镜到底感。${refs}${dramaModifier(project.dramaType)} ${QUALITY_DIRECTIVES}`.replace(/。。/g, "。");

    // #431：画面 AI Prompt + 台词·字幕 + 备注
    const extra = [dlgText, subText, noteText].filter(Boolean).join("");
    if (extra) full += " " + extra;

    // #409 背景继承 + 镜头收束点（避免与 refinePrompt 已写入的重复）
    if (!full.includes("背景延续") && !full.includes("镜头收束")) {
      if (prevShot) {
        const bg = backgroundInheritText(prevShot);
        if (bg) full += bg;
      }
      const ep = computeShotEndPoint(sh);
      full += (full ? " " : "") + ep;
    }
    // 持久化 endPoint 字段（镜头收束点）
    const endPoint = computeShotEndPoint(sh);
    if (sh.endPoint !== endPoint) editShot(sh.id, { endPoint });
    return full;
  };

  // 从视频 URL 抽取最后一帧（尾帧），用于作为下一场视频的首帧，保证画面连贯。
  // 跨域安全：先 fetch 成 blob 再喂给 video，避免 canvas 被污染导致 toBlob 失败。
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

    video.addEventListener("error", (e) => fail("video error"));

    fetch(videoUrl)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`fetch ${r.status}`))))
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        video.src = objectUrl;
        // WebView2 中 detached video 可能不触发事件，必须挂到 DOM 并显式 load
        video.load();
        video.addEventListener("loadedmetadata", () => {
          const dur = video.duration;
          if (!isFinite(dur) || dur <= 0) { fail("invalid duration"); return; }
          try { video.currentTime = Math.max(0.05, dur - 0.05); } catch { fail("seek failed"); }
        });
        video.addEventListener("seeked", () => {
          try {
            const w = video.videoWidth || 1080;
            const h = video.videoHeight || 1920;
            const canvas = document.createElement("canvas");
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(video, 0, 0, w, h);
            canvas.toBlob((b) => { if (b) finish(URL.createObjectURL(b)); else fail("toBlob empty"); }, "image/png");
          } catch (e) { fail(e.message); }
        });
      })
      .catch((e) => fail(e.message));
    // 兜底：8 秒强制结束，避免 UI 卡死
    setTimeout(() => fail("timeout"), 8000);
  });

  // 注：「生成分镜图」按用户 2026-08-17 要求已取消（不再提供入口与函数）。

  // #407/#428 生成指定人物的肖像图：分析本分镜出场角色后逐人生成，强制单一人物无背景。
  // #9 修复：改用「文生图 + 身份参考图」(referenceImages)，而非图生图(imageUrl)，避免参考图里的场景被复现。
  const genShotCharImage = async (sh, char) => {
    const charName = char && char.name ? char.name : "角色";
    const genId = sh.id + "::" + charName;
    startGenerating("charimg", genId, `人物图 · ${charName}`);
    log(`生成人物图：${charName}（${sh.title}）`);
    try {
      const c = char && char.material;
      const refUrls = c ? characterReferenceImages(c) : [];
      const hasRef = refUrls.length > 0;
      // 强制：单一人物，纯净背景，不要任何场景/道具/其他人
      const FORCE = "单一人物，纯白色或纯色干净背景，绝对不要任何场景、建筑、道具、风景或其他人物，半身或全身肖像，高清摄影棚打光，面部清晰，主体占画面主要位置。";
      let prompt;
      if (hasRef) {
        const base = [c.role, c.prompt || c.desc || c.appearance, charName + "（本分镜出场角色）"].filter(Boolean).join("，");
        prompt = `人物肖像图：${base}。${dramaModifier(project.dramaType)} ${FORCE}`;
      } else {
        // 无参考角色：回退到本镜文案，但仍强制单人物无背景
        const base = sh.cnPrompt || sh.sceneDesc || sh.title || charName;
        prompt = `人物肖像图：${charName}。${base}。${dramaModifier(project.dramaType)} ${FORCE}`;
      }
      const img = await generateImage({ prompt, size: "768x1024", n: 1 });
      const nextImgs = { ...(sh.characterImages || {}), [charName]: img.image_url };
      editShot(sh.id, { characterImages: nextImgs });
      update({ assets: [{ id: "a" + Date.now(), type: "image", title: charName + " · 人物图", url: img.image_url, status: "done" }, ...(project.assets || [])] });
      update({ history: pushHistory(project.history, "人物图", charName + " · " + sh.title) });
      log(`人物图已生成：${charName}（已存入素材库「人物图」）。`);
    } catch (e) { log("出错：" + e.message); }
    finally { endGenerating("charimg", genId); }
  };

  // #431 视频生成三模式：
  //  - "t2v" 文生视频：仅 prompt（画面 AI Prompt + 台词·字幕 + 备注），无参考图/首尾帧。
  //  - "i2v" 参考首尾帧生成：取上一镜视频尾帧作为本镜首帧；取不到则退回 t2v。
  //  - "r2v" 参考人物生成：用本镜内所有人物图（sh.characterImages）锁定身份；无则退回 t2v。
  const genShotVideo = async (sh, mode = "t2v") => {
    startGenerating("vid", sh.id, `视频 · ${sh.title}`);
    const taskId = "t" + Date.now();
    const startedAt = Date.now();
    update({ tasks: [{ id: taskId, label: "视频 · " + sh.title, status: "queued", progress: 0, type: "video", targetId: sh.id, startedAt, updatedAt: startedAt }, ...(project.tasks || [])] });
    log(`提交视频任务：${sh.title}（走调度机 GPU，约 1-5 分钟）…`);
    try {
      const prompt = buildVideoPrompt(sh);
      let reference_images = [];
      let first_frame = null;
      let useMode = mode;
      if (mode === "r2v") {
        const charImgs = Object.values(sh.characterImages || {}).filter(Boolean);
        if (charImgs.length) {
          reference_images = charImgs;
          log(`参考人物生成：使用本镜 ${charImgs.length} 张人物图锁定身份。`);
        } else {
          useMode = "t2v";
          log("本镜无人物图，退回文生视频。");
        }
      } else if (mode === "i2v") {
        const idx = epShots.findIndex((s) => s.id === sh.id);
        const prev = idx > 0 ? epShots[idx - 1] : null;
        if (prev && prev.videoUrl) {
          log("正在提取上一镜尾帧作为首帧…");
          first_frame = await extractLastFrame(prev.videoUrl);
        }
        if (first_frame) {
          log("参考首尾帧生成：已取上一镜尾帧作为本镜首帧。");
        } else {
          useMode = "t2v";
          log("取不到上一镜尾帧，退回文生视频。");
        }
      }
      // 转换为AutoDL ComfyUI工作流参数格式
      const sizeMap = { "480x832": "480p竖", "720x1280": "768p竖", "832x480": "480p横", "1280x720": "768p横", "512x512": "768p竖" };
      const autoResolution = sizeMap[getVideoSize(project.videoSize).resolution] || "768p竖";
      
      // 构建参考图：首帧优先，然后是角色参考图
      const workflowParams = {
        prompt,
        duration: sh.duration || 5,
        resolution: autoResolution,
      };
      let refIdx = 0;
      if (first_frame) {
        workflowParams[`ref_image_${refIdx}`] = first_frame;
        refIdx++;
      }
      if (Array.isArray(reference_images)) {
        reference_images.forEach((img) => {
          if (img && refIdx < 9) {
            workflowParams[`ref_image_${refIdx}`] = img;
            refIdx++;
          }
        });
      }

      const res = await runDispatchJob({
        type: "video",
        payload: {
          workflow: "minimax_h3_image_audio_to_video_v2",
          model: "MiniMax-H3",
          mode: useMode,
          style: project.dramaType,
          ...workflowParams,
        },
        onProgress: (percent, statusText) => {
          update({ tasks: (project.tasks || []).map((t) => (t.id === taskId ? { ...t, progress: percent, status: statusText === "完成" ? "running" : (t.status || "running"), detail: statusText, updatedAt: Date.now() } : t)) });
        },
        timeoutMs: 1200000,
      });
      const videoUrl = res.resultUrl;
      editShot(sh.id, { videoUrl });
      update({ assets: [{ id: "v" + Date.now(), type: "video", title: sh.title + " · 成片", url: videoUrl, status: "done" }, ...(project.assets || [])] });
      update({ tasks: (project.tasks || []).map((t) => (t.id === taskId ? { ...t, status: "completed", progress: 100, url: videoUrl, finishedAt: Date.now(), updatedAt: Date.now() } : t)) });
      update({ history: pushHistory(project.history, "视频", sh.title) });
      log("视频生成完成！可在本镜头下方播放，或在「素材库」查看。");
    } catch (e) {
      const needRecharge = !!(e && e.needRecharge);
      const msg = needRecharge ? "余额不足，请先充值后再生成视频。" : "出错：" + (e && e.message);
      if (needRecharge) openRecharge();
      update({ tasks: (project.tasks || []).map((t) => (t.id === taskId ? { ...t, status: "failed", detail: e && e.message, finishedAt: Date.now(), updatedAt: Date.now() } : t)) });
      log(msg);
    } finally { endGenerating("vid", sh.id); }
  };

  // ── 台词配音（走调度机 TTS GPU 工人）──
  const genDialogueTts = async (d) => {
    startGenerating("tts", d.id, `配音 · ${d.character}`);
    const taskId = "t" + Date.now();
    const startedAt = Date.now();
    update({ tasks: [{ id: taskId, label: "配音 · " + d.character, status: "queued", progress: 0, type: "audio", targetId: d.id, startedAt, updatedAt: startedAt }, ...(project.tasks || [])] });
    log(`提交配音：${d.character} · ${d.text.slice(0, 20)}…`);
    try {
      const res = await runDispatchJob({
        type: "tts",
        payload: {
          text: d.text,
          voice: "default",
          emotion: "neutral",
          voice_design: "",
          ref_audio: null,
        },
        onProgress: (percent, statusText) => {
          update({ tasks: (project.tasks || []).map((t) => (t.id === taskId ? { ...t, progress: percent, status: t.status === "completed" ? "completed" : "running", detail: statusText, updatedAt: Date.now() } : t)) });
        },
        timeoutMs: 300000,
      });
      const ttsUrl = res.resultUrl;
      update({ dialogues: dialogues.map((x) => (x.id === d.id ? { ...x, ttsUrl } : x)) });
      update({ assets: [{ id: "t" + Date.now(), type: "audio", title: d.character + " · 配音", url: ttsUrl, status: "done" }, ...(project.assets || [])] });
      update({ tasks: (project.tasks || []).map((t) => (t.id === taskId ? { ...t, status: "completed", progress: 100, url: ttsUrl, finishedAt: Date.now(), updatedAt: Date.now() } : t)) });
      update({ history: pushHistory(project.history, "配音", d.character) });
      log("配音完成！");
    } catch (e) {
      const needRecharge = !!(e && e.needRecharge);
      const msg = needRecharge ? "余额不足，请先充值后再生成配音。" : "出错：" + (e && e.message);
      if (needRecharge) openRecharge();
      update({ tasks: (project.tasks || []).map((t) => (t.id === taskId ? { ...t, status: "failed", detail: e && e.message, finishedAt: Date.now(), updatedAt: Date.now() } : t)) });
      log(msg);
    } finally { endGenerating("tts", d.id); }
  };

  // ── 对当前集做 AI 逐镜细化（景别/运镜/灯光/情绪/特效/中文提示词/时长）──
  const refineEpisode = async () => {
    if (!ep) { log("请先选择一集。"); return; }
    if (!epShots.length) { log("该集还没有分场，无法细化。"); return; }
    startGenerating("refine", ep.id, `AI 细化 · ${ep.title}`);
    setProgress({ label: "正在准备分镜数据", percent: 10 });
    log(`正在 AI 细化「${ep.title}」的 ${epShots.length} 个分场…`);
    try {
      const shotsJson = epShots.map((s, i) => ({
        index: i + 1, title: s.title, sceneDesc: s.sceneDesc,
        sceneType: s.sceneType || s.shotType, cameraMove: s.cameraMove || s.camera, lighting: s.lighting, emotion: s.emotion || s.mood, effect: s.effect || s.vfx, environment: s.environment, costume: s.costume, promptCn: s.promptCn || s.cnPrompt, characters: s.characters || [], duration: s.duration,
      }));
      const epBody = (ep.content || ep.summary || project.idea || "").slice(0, 6000);
      const prompt = `你是一名短剧分镜导演。请根据以下第「${ep.title}」的完整剧本和现有镜头，逐镜细化并输出 JSON 数组。
要求：
1. 每个元素字段：title, sceneDesc（画面描述）, sceneType（景别，取值如：远景/中景/近景/特写/环绕/慢动作）, cameraMove（运镜）, lighting（灯光）, emotion（情绪）, effect（特效）, environment（环境）, costume（服饰）, duration（分镜时长 5-15 秒）, promptCn（中文生视频提示词，必须包含景别/运镜/灯光/情绪/特效/角色/场景）, characters（本镜出场人物名数组）, dialogues（数组 {character,text}）。
   为兼容旧字段，你也可以一并输出 shotType/camera/mood/vfx/cnPrompt 作为别名（与主字段保持一致）。
2. 保持镜头数量与顺序和输入一致。
3. 只输出 JSON 数组，不要解释，不要 markdown 代码块。
4. 如果某个字段输入已存在，请保留或优化；如果为空，请补全合理内容。

集剧本：
${epBody}

现有镜头：${JSON.stringify(shotsJson, null, 2)}`;
      setProgress({ label: "AI 正在细化本分镜", percent: 40 });
      let arr = [];
      let lastErr = null;
      for (let attempt = 0; attempt < 2 && arr.length === 0; attempt++) {
        try {
          const res = await client().chat(attempt === 0 ? prompt : prompt + "\n\n注意：必须输出完整 JSON 数组。", { maxTokens: 6000, temperature: 0.8 });
          const parsed = repairAndParse(res, "分镜细化 JSON");
          arr = Array.isArray(parsed) ? parsed : [];
        } catch (e) { lastErr = e; }
      }
      if (!Array.isArray(arr) || arr.length === 0) {
        throw new Error(lastErr ? lastErr.message : "AI 未返回有效分镜数组");
      }
      setProgress({ label: `已生成 ${arr.length} 个细化分镜，正在写入`, percent: 80 });
      const nextShots = shots.map((s) => ({ ...s }));
      let allNewDs = [];
      for (let i = 0; i < Math.min(arr.length, epShots.length); i++) {
        const src = arr[i];
        const target = epShots[i];
        const idx = nextShots.findIndex((x) => x.id === target.id);
        if (idx < 0) continue;
        nextShots[idx] = {
          ...nextShots[idx],
          title: src.title || nextShots[idx].title,
          sceneDesc: src.sceneDesc || src.description || nextShots[idx].sceneDesc,
          characters: Array.isArray(src.characters) ? src.characters.filter(Boolean) : nextShots[idx].characters,
          shotType: src.shotType || nextShots[idx].shotType,
          camera: src.camera || nextShots[idx].camera,
          lighting: src.lighting || nextShots[idx].lighting,
          mood: src.mood || src.emotion || nextShots[idx].mood,
          environment: src.environment || src.env || nextShots[idx].environment,
          costume: src.costume || nextShots[idx].costume,
          vfx: src.vfx || src.specialEffects || src.effects || nextShots[idx].vfx,
          cnPrompt: src.cnPrompt || src.cn_prompt || src.chinesePrompt || nextShots[idx].cnPrompt,
          duration: Math.min(15, Math.max(1, Number(src.duration) || nextShots[idx].duration || 5)),
        };
        const dls = Array.isArray(src.dialogues) ? src.dialogues : (Array.isArray(src.lines) ? src.lines : []);
        if (dls.length) {
          const newDs = dls.map((d, k) => ({ id: "d_" + Date.now() + "_" + k + "_" + i, shotId: target.id, episodeId: ep.id, character: d.character || d.role || "角色", text: d.text || d.line || "", ttsUrl: null, status: "todo" }));
          allNewDs = [...allNewDs, ...newDs];
        }
      }
      const nextDialogues = [...allNewDs, ...dialogues.filter((d) => !epShots.some((s) => s.id === d.shotId))];
      update({ shots: nextShots, dialogues: nextDialogues, history: pushHistory(project.history, "AI 细化分镜", ep.title) });
      setProgress({ label: "本分镜细化完成", percent: 100 });
      setTimeout(() => setProgress(null), 1500);
      log(`「${ep.title}」细化完成：${arr.length} 个镜头已补全景别/运镜/灯光/情绪/特效/中文提示词。`);
    } catch (e) {
      log("细化失败：" + e.message);
      setProgress(null);
    } finally { endGenerating("refine", ep.id); }
  };

  return (
    <div style={{ padding: 16, overflowY: "auto", height: "100%", boxSizing: "border-box", color: "var(--text, #e8ecf3)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={h3}>分镜</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btnPrimary} disabled={isGenerating("eps", "global")} onClick={genEpisodes}>{isGenerating("eps", "global") ? "生成中…" : "🤖 AI 补充分集分场（1积分）"}</button>
          <button style={miniBtn} onClick={addEpisode}>+ 添加一集</button>
        </div>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted, #5d6779)", marginBottom: 8 }}>
        分镜以 7 列表格编辑（镜头号 / 时长 / 画面 AI Prompt / 人物 / 台词·字幕 / 特效 / 备注）。时长可选 1–15 秒；「人物」列逐人生成人物图并自动识别本镜出场角色；生视频时参考素材库角色参考图。
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 8, alignItems: "flex-end" }}>
        <VideoSizePicker project={project} update={update} />
        <span style={{ fontSize: 11, color: "var(--text-muted, #5d6779)", alignSelf: "center" }}>所有「生视频」均使用此分辨率</span>
      </div>
      {episodes.length === 0 && <div style={ph}>还没有分集。先在「分集剧本」模块生成分集，再点击每集的「生成分场剧本」。</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
        {episodes.map((e, i) => (
          <div
            key={e.id}
            style={{ ...epChip, ...(ep && ep.id === e.id ? epChipOn : {}) }}
            onClick={() => setActiveEp(e.id)}
            title="点击切换查看该集分镜"
          >
            <input
              value={e.title} onChange={(ev) => editEpisode(e.id, { title: ev.target.value })}
              onMouseDown={(ev) => ev.stopPropagation()}
              style={{ background: "transparent", border: "none", outline: "none", color: "inherit", fontSize: 13, width: 90, fontWeight: 600 }}
            />
            {episodes.length > 1 && (
              <button style={chipX} title="删除该集" onClick={(ev) => { ev.stopPropagation(); delEpisode(e.id); }}>✕</button>
            )}
          </div>
        ))}
      </div>

      {ep && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18 }}>
            <h3 style={h3}>{ep.title} · 分场（{epShots.length}）</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={miniBtn} disabled={isGenerating("refine", ep.id)} onClick={refineEpisode}>{isGenerating("refine", ep.id) ? "细化中…" : "🤖 AI 细化本分镜（1积分）"}</button>
              <button style={miniBtn} onClick={addShot}>+ 添加分场</button>
            </div>
          </div>
          {progress && isGenerating("refine", ep.id) && (
            <div style={{ marginTop: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "var(--text-secondary, #8b95a7)", marginBottom: 4 }}>{progress.label} {progress.percent}%</div>
              <div style={{ height: 6, borderRadius: 3, background: "var(--panel-2, #1c2433)", overflow: "hidden" }}>
                <div style={{ width: progress.percent + "%", height: "100%", background: "var(--accent-gradient, linear-gradient(90deg, #7c3aed, #3b82f6))", transition: "width 0.3s ease" }} />
              </div>
            </div>
          )}
          {epShots.length === 0 && <div style={ph}>该集还没有分场。请去「分集剧本」模块点击「生成分场剧本」。</div>}

          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={{ ...th, width: 150 }}>镜头号</th>
                  <th style={{ ...th, width: 92 }}>时长</th>
                  <th style={{ ...th, width: 340 }}>画面 AI Prompt</th>
                  <th style={{ ...th, width: 280 }}>人物</th>
                  <th style={{ ...th, width: 220 }}>台词·字幕</th>
                  <th style={{ ...th, width: 150 }}>特效</th>
                  <th style={{ ...th, width: 170 }}>备注</th>
                  <th style={{ ...th, width: 140 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {epShots.map((sh, i) => {
                  const shotChars = shotCharacters(sh);
                  const dlgLines = epDialogues.filter((d) => d.shotId === sh.id);
                  return (
                    <tr key={sh.id} style={{ borderTop: "1px solid var(--border, rgba(255,255,255,0.08))" }}>
                      <td style={td}>
                        <div style={{ fontSize: 11, color: "var(--text-muted, #5d6779)", marginBottom: 2 }}>第 {i + 1} 场</div>
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <input style={cellTitle} value={sh.title} onChange={(e) => editShot(sh.id, { title: e.target.value })} />
                          <button style={cellDel} title="删除分场" onClick={() => delShot(sh.id)}>✕</button>
                        </div>
                      </td>
                      <td style={td}>
                        <select value={clampDuration(sh.duration)} onChange={(e) => editShot(sh.id, { duration: Number(e.target.value) })} style={cellSelect}>
                          {Array.from({ length: 15 }, (_, k) => k + 1).map((n) => (
                            <option key={n} value={n}>{n}秒</option>
                          ))}
                        </select>
                      </td>
                      <td style={td}>
                        <textarea style={cellText} value={sh.cnPrompt || ""} onChange={(e) => editShot(sh.id, { cnPrompt: e.target.value, promptCn: e.target.value })} placeholder="中文生视频提示词（景别/运镜/灯光/情绪/特效/角色/场景）" />
                      </td>
                      <td style={td}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, paddingRight: 2 }}>
                            {shotChars.length === 0 && <div style={mutedSmall}>无角色（AI 细化或下方添加）</div>}
                            {shotChars.map((c) => {
                              const genId = sh.id + "::" + c.name;
                              const img = sh.characterImages && sh.characterImages[c.name];
                              const gen = isGenerating("charimg", genId);
                              return (
                                <div key={c.name} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "6px 8px", borderRadius: "var(--radius-sm, 6px)", background: "var(--panel-2, #1c2433)" }}>
                                  <div style={{ display: "flex", gap: 4, alignItems: "center", justifyContent: "space-between" }}>
                                    <span style={{ fontSize: 12, color: "var(--text, #e8ecf3)", fontWeight: 600 }}>{c.name}</span>
                                    <button style={cellChipX} title="移除角色" onClick={() => removeChar(sh, c.name)}>✕</button>
                                  </div>
                                  <button style={{ ...cellMini, alignSelf: "flex-start" }} disabled={gen} onClick={() => genShotCharImage(sh, c)}>{gen ? "生成中…" : "🧍 生成人物图（3积分）"}</button>
                                  {img && <img src={img} alt={c.name} onClick={() => setLightbox({ src: img, alt: c.name })} style={cellThumb} title="点击查看原图" />}
                                </div>
                              );
                            })}
                          </div>
                          <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                            <input style={cellSelect} placeholder="添加角色名" value={newChar[sh.id] || ""} onChange={(e) => setNewChar((s) => ({ ...s, [sh.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") addChar(sh.id, newChar[sh.id]); }} />
                            <button style={cellMini} onClick={() => addChar(sh.id, newChar[sh.id])}>+ 添加</button>
                          </div>
                        </div>
                      </td>
                      <td style={td}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {dlgLines.length === 0 && <div style={mutedSmall}>无台词</div>}
                          {dlgLines.map((d) => (
                            <div key={d.id} style={{ fontSize: 11, lineHeight: 1.5 }}>
                              <b style={{ color: "var(--accent-2, #5CE1E6)" }}>{d.character}：</b>{d.text}
                            </div>
                          ))}
                          <textarea style={cellTextSm} value={sh.subtitle || ""} onChange={(e) => editShot(sh.id, { subtitle: e.target.value })} placeholder="字幕…" />
                        </div>
                      </td>
                      <td style={td}>
                        <textarea style={cellText} value={sh.vfx || sh.effect || ""} onChange={(e) => editShot(sh.id, { vfx: e.target.value, effect: e.target.value })} placeholder="视觉特效…" />
                      </td>
                      <td style={td}>
                        <textarea style={cellText} value={sh.note || ""} onChange={(e) => editShot(sh.id, { note: e.target.value })} placeholder="备注…" />
                      </td>
                      <td style={td}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <button style={cellMini} disabled={isGenerating("vid", sh.id)} onClick={() => setGenModal(sh)}>{isGenerating("vid", sh.id) ? "生成中…" : "🎬 生视频"}</button>
                          <button style={cellMini} disabled={isGenerating("prompt", sh.id)} onClick={() => refinePrompt(sh)}>{isGenerating("prompt", sh.id) ? "细化中…" : "✨ 细化提示词（1积分）"}</button>
                          {sh.videoUrl && (
                            <div>
                              <video src={sh.videoUrl} style={cellThumb} controls />
                              <button style={cellMini} onClick={() => downloadUrl(sh.videoUrl, (sh.title || "video") + ".mp4")}>📥 下载</button>
                            </div>
                          )}
                          {sh.imageUrl && <img src={sh.imageUrl} alt={sh.title} onClick={() => setLightbox({ src: sh.imageUrl, alt: sh.title })} style={cellThumb} title="点击查看原图" />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {epDialogues.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <h3 style={h3}>本集台词（{epDialogues.length}）</h3>
              <div style={{ fontSize: 13, color: "var(--text-secondary, #8b95a7)", lineHeight: 1.8 }}>
                {epDialogues.map((d) => (
                  <div key={d.id} style={{ padding: "4px 0", borderBottom: "1px solid var(--border, rgba(255,255,255,0.06))", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ flex: 1 }}><b style={{ color: "var(--accent-2, #5CE1E6)" }}>{d.character}：</b>{d.text}</span>
                    {d.ttsUrl ? (
                      <audio src={d.ttsUrl} controls style={{ height: 28, maxWidth: 240 }} />
                    ) : (
                      <button style={miniBtn} disabled={isGenerating("tts", d.id)} onClick={() => genDialogueTts(d)}>{isGenerating("tts", d.id) ? "配音中…" : "🎙 配音（1积分）"}</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {lightbox && <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}

      {genModal && (() => {
        const sh = genModal;
        const refChars = shotCharacters(sh);
        // #431：三模式可用性
        const charImgs = Object.values(sh.characterImages || {}).filter(Boolean);
        const canR2V = charImgs.length > 0;
        const idx = epShots.findIndex((s) => s.id === sh.id);
        const prev = idx > 0 ? epShots[idx - 1] : null;
        const canI2V = !!(prev && prev.videoUrl);
        const choose = (m) => { setGenModal(null); genShotVideo(sh, m); };
        return (
          <div style={modalBackdrop} onClick={() => setGenModal(null)}>
            <div style={modalCard} onClick={(e) => e.stopPropagation()}>
              <div style={modalTitle}>🎬 生成视频 · 选择模式</div>
              <div style={modalSub}>本镜：{sh.title}　·　出场角色：{refChars.length ? refChars.map((c) => c.name).join("、") : "未指定"}</div>
              <div style={{...modalSub, color: "#f59e0b", marginTop: 4}}>💰 视频定价：720P 2积分/秒，1080P 3积分/秒（5秒=10~15积分，10秒=20~30积分）</div>
              <button style={modalOpt} onClick={() => choose("t2v")}>
                ① 文生视频（T2V）
                <div style={modalOptNote}>仅用「画面 AI Prompt + 台词·字幕 + 备注」，不传参考图 / 首尾帧</div>
              </button>
              <button style={modalOpt} onClick={() => choose("i2v")}>
                ② 参考首尾帧生成（I2V）{canI2V ? "" : " · 无上一镜视频，将退回文生视频"}
                <div style={modalOptNote}>{canI2V ? `使用上一镜（${prev.title}）视频尾帧作为本镜首帧` : "需本镜在「同一集」有上一镜且已生成视频；否则自动退回文生视频"}</div>
              </button>
              <button style={modalOpt} onClick={() => choose("r2v")}>
                ③ 参考人物生成（R2V）{canR2V ? "" : " · 本镜无人物图，将退回文生视频"}
                <div style={modalOptNote}>{canR2V ? `使用本镜 ${charImgs.length} 张人物图锁定身份` : "需先在「人物」列为本镜生成人物图；否则自动退回文生视频"}</div>
              </button>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                <button style={miniBtn} onClick={() => setGenModal(null)}>取消</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

const h3 = { fontSize: 15, margin: "0 0 8px", color: "var(--text, #e8ecf3)" };
const btnPrimary = { marginTop: 8, padding: "8px 14px", border: "none", borderRadius: "var(--radius-sm, 6px)", background: "var(--accent-gradient, linear-gradient(135deg, #7c3aed, #3b82f6))", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 };
const miniBtn = { flex: 1, padding: "6px 0", border: "1px solid var(--border, rgba(255,255,255,0.14))", borderRadius: "var(--radius-sm, 6px)", background: "var(--panel-2, #1c2433)", cursor: "pointer", fontSize: 12, color: "var(--text-secondary, #8b95a7)" };
const card = { border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: "var(--radius, 10px)", padding: 12, marginBottom: 12, background: "var(--panel, #161d2a)" };
const cardHead = { display: "flex", gap: 6, alignItems: "center", marginBottom: 6, flexWrap: "wrap" };
const titleInput = { flex: 1, fontSize: 14, fontWeight: 600, border: "none", borderBottom: "1px solid var(--border, rgba(255,255,255,0.08))", outline: "none", padding: "4px 2px", background: "transparent", color: "var(--text, #e8ecf3)", minWidth: 120 };
const descInput = { width: "100%", minHeight: 64, padding: 8, fontSize: 13, border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: "var(--radius-sm, 6px)", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", background: "var(--input-bg, #0f141e)", color: "var(--text, #e8ecf3)" };
const field = { padding: "6px 8px", fontSize: 12, border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: "var(--radius-sm, 6px)", background: "var(--input-bg, #0f141e)", color: "var(--text, #e8ecf3)", outline: "none" };
const thumb = { width: "100%", maxHeight: 220, objectFit: "contain", borderRadius: "var(--radius-sm, 6px)", marginTop: 6, background: "var(--panel-2, #1c2433)" };
const del = { border: "none", background: "transparent", color: "var(--text-muted, #5d6779)", cursor: "pointer", fontSize: 14 };
const ph = { color: "var(--text-muted, #5d6779)", fontSize: 13, padding: 20, textAlign: "center", background: "var(--panel, #161d2a)", borderRadius: "var(--radius, 10px)", border: "1px dashed var(--border, rgba(255,255,255,0.14))" };
const epChip = { display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", border: "1px solid var(--border, rgba(255,255,255,0.14))", borderRadius: 999, background: "var(--panel-2, #1c2433)", color: "var(--text-secondary, #8b95a7)", cursor: "pointer" };
const epChipOn = { borderColor: "var(--accent-2, #3b82f6)", color: "#fff", background: "rgba(59,130,246,0.14)" };
const chipX = { border: "none", background: "transparent", color: "var(--text-muted, #5d6779)", cursor: "pointer", fontSize: 12, padding: 0 };

// ── #414 视频生成前模式选择弹窗（暗色遮罩）──
const modalBackdrop = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 };
const modalCard = { background: "var(--panel, #161d2a)", border: "1px solid var(--border, rgba(255,255,255,0.14))", borderRadius: "var(--radius, 10px)", padding: 18, width: 360, maxWidth: "90vw", boxShadow: "0 12px 40px rgba(0,0,0,0.5)" };
const modalTitle = { fontSize: 15, fontWeight: 600, color: "var(--text, #e8ecf3)", marginBottom: 4 };
const modalSub = { fontSize: 12, color: "var(--text-secondary, #8b95a7)", marginBottom: 14 };
const modalOpt = { display: "block", width: "100%", textAlign: "left", padding: "12px 14px", marginBottom: 10, border: "1px solid var(--border, rgba(255,255,255,0.14))", borderRadius: "var(--radius-sm, 6px)", background: "var(--panel-2, #1c2433)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text, #e8ecf3)" };
const modalOptDisabled = { opacity: 0.5, cursor: "not-allowed" };
const modalOptNote = { fontSize: 11, fontWeight: 400, color: "var(--text-secondary, #8b95a7)", marginTop: 4, lineHeight: 1.5 };

// ── #425/#426/#427 分镜 7 列表格样式 ──
const tableWrap = { overflowX: "auto", marginTop: 8, border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: "var(--radius, 10px)", background: "var(--panel, #161d2a)" };
const table = { borderCollapse: "collapse", width: "100%", minWidth: 1502, fontSize: 12, color: "var(--text, #e8ecf3)" };
const th = { position: "sticky", top: 0, textAlign: "left", padding: "8px 10px", background: "var(--panel-2, #1c2433)", color: "var(--text-secondary, #8b95a7)", fontSize: 12, fontWeight: 600, borderBottom: "1px solid var(--border, rgba(255,255,255,0.14))", whiteSpace: "nowrap" };
const td = { padding: "8px 10px", verticalAlign: "top", borderBottom: "1px solid var(--border, rgba(255,255,255,0.06))", background: "var(--panel, #161d2a)" };
const cellText = { width: "100%", minHeight: 72, maxHeight: 220, padding: 6, fontSize: 12, border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: "var(--radius-sm, 6px)", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", background: "var(--input-bg, #0f141e)", color: "var(--text, #e8ecf3)" };
const cellTextSm = { width: "100%", minHeight: 34, padding: 6, fontSize: 12, border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: "var(--radius-sm, 6px)", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", background: "var(--input-bg, #0f141e)", color: "var(--text, #e8ecf3)" };
const cellTitle = { flex: 1, minWidth: 90, fontSize: 13, fontWeight: 600, border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: "var(--radius-sm, 6px)", padding: "4px 6px", outline: "none", background: "var(--input-bg, #0f141e)", color: "var(--text, #e8ecf3)" };
const cellSelect = { width: "100%", padding: "6px 8px", fontSize: 12, border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: "var(--radius-sm, 6px)", background: "var(--input-bg, #0f141e)", color: "var(--text, #e8ecf3)", outline: "none" };
const cellMini = { padding: "5px 8px", border: "1px solid var(--border, rgba(255,255,255,0.14))", borderRadius: "var(--radius-sm, 6px)", background: "var(--panel-2, #1c2433)", cursor: "pointer", fontSize: 12, color: "var(--text-secondary, #8b95a7)", whiteSpace: "nowrap" };
const cellChipX = { border: "none", background: "transparent", color: "var(--text-muted, #5d6779)", cursor: "pointer", fontSize: 11, padding: "0 2px" };
const cellDel = { border: "none", background: "transparent", color: "var(--text-muted, #5d6779)", cursor: "pointer", fontSize: 13, padding: 0 };
const cellThumb = { width: "100%", maxHeight: 140, objectFit: "contain", borderRadius: "var(--radius-sm, 6px)", marginTop: 4, background: "var(--panel-2, #1c2433)", cursor: "zoom-in" };
const mutedSmall = { fontSize: 11, color: "var(--text-muted, #5d6779)" };
