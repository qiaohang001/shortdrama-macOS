import React, { useState, useEffect } from "react";
import { downloadUrl, saveBlob } from "../../utils.js";
import { runDispatchJob, api } from "../../dispatch-jobs.js";
import { isLoggedIn, precheckCredits, getCreditBalance } from "../../utils/backend-api.js";
import { getAppSetting } from "../../utils/app-settings.js";
import { calcVideoPrice } from "../../utils/pricing-utils.js";

const VIDEO_MODES = [
  { key: "i2v", label: "图生视频 (I2V)", desc: "角色参考图驱动，人物外貌一致，模型自由发挥画面" },
  { key: "r2v", label: "首尾帧 (R2V/lightx2v)", desc: "首帧+尾帧精确控制画面起止，minimax_h3_lightx2v工作流" },
  { key: "ia2v", label: "全能参考 (Ref2VA/v2)", desc: "参考图片+参考音频+文本，最多9图3音，minimax_h3_image_audio_to_video_v2工作流" },
  { key: "t2v", label: "文生视频 (T2V)", desc: "纯文字描述生成，自由度最高" },
];

// 视频生成价格：从调度机全局价格配置获取
function getVideoPricePerSec(mode, resolution) {
  return calcVideoPrice(mode, resolution, 1);
}

// I2V支持的分辨率（lightx2v_v5支持1080P和1:1）
// 按分辨率分组，横屏竖屏交替显示，方便用户选择
const RESOLUTIONS_I2V = [
  { key: "1080p横", label: "1080P 横屏（16:9）" },
  { key: "1080p竖", label: "1080P 竖屏（9:16）" },
  { key: "1080p(1:1)", label: "1080P 方形（1:1）" },
  { key: "768p横", label: "768P 横屏（16:9）" },
  { key: "768p竖", label: "768P 竖屏（9:16）" },
  { key: "768p(1:1)", label: "768P 方形（1:1）" },
  { key: "480p横", label: "480P 横屏（16:9）" },
  { key: "480p竖", label: "480P 竖屏（9:16）" },
  { key: "480p(1:1)", label: "480P 方形（1:1）" },
];

// R2V/T2V支持的分辨率（不支持1080P）
// 按分辨率分组，横屏竖屏交替显示
const RESOLUTIONS_BASIC = [
  { key: "768p横", label: "768P 横屏（16:9）" },
  { key: "768p竖", label: "768P 竖屏（9:16）" },
  { key: "480p横", label: "480P 横屏（16:9）" },
  { key: "480p竖", label: "480P 竖屏（9:16）" },
];

// 根据模式获取可用分辨率
const getResolutions = (mode) => {
  if (mode === "i2v") return RESOLUTIONS_I2V;
  if (mode === "ia2v") return RESOLUTIONS_IA2V;
  return RESOLUTIONS_BASIC;
};

// 根据模式获取可用时长（I2V/IA2V=1-10秒，R2V/T2V=1-15秒）
const getDurations = (mode) => {
  if (mode === "i2v" || mode === "ia2v") return DURATIONS.filter(d => d.key <= 10);
  return DURATIONS;
};

// 根据模式获取最大时长
const getMaxDuration = (mode) => {
  return (mode === "i2v" || mode === "ia2v") ? 10 : 15;
};

const DURATIONS = [
  { key: 1, label: "1秒" },
  { key: 2, label: "2秒" },
  { key: 3, label: "3秒" },
  { key: 4, label: "4秒" },
  { key: 5, label: "5秒" },
  { key: 6, label: "6秒" },
  { key: 7, label: "7秒" },
  { key: 8, label: "8秒" },
  { key: 9, label: "9秒" },
  { key: 10, label: "10秒" },
  { key: 11, label: "11秒" },
  { key: 12, label: "12秒" },
  { key: 13, label: "13秒" },
  { key: 14, label: "14秒" },
  { key: 15, label: "15秒" },
];

const I2V_WORKFLOW_ID = "minimax_h3_lightx2v_v5";
const R2V_WORKFLOW_ID = "minimax_h3_lightx2v";
const IA2V_WORKFLOW_ID = "minimax_h3_image_audio_to_video_v2";
const T2V_WORKFLOW_ID = "minimax_h3_lightx2v_no_pic";

// 视频风格选项
const VIDEO_STYLES = [
  { key: "cinematic", label: "电影级写实", desc: "Cinematic realism, high contrast lighting, professional color grading" },
  { key: "anime", label: "动漫风格", desc: "Anime style, vibrant colors, expressive characters, Japanese animation aesthetic" },
  { key: "realistic", label: "超写实", desc: "Hyper-realistic, photorealistic, ultra detailed, natural lighting" },
  { key: "noir", label: "黑色电影", desc: "Film noir, black and white, high contrast shadows, mysterious atmosphere" },
  { key: "cyberpunk", label: "赛博朋克", desc: "Cyberpunk, neon lights, futuristic city, high tech low life" },
  { key: "fantasy", label: "奇幻风格", desc: "Fantasy style, magical atmosphere, ethereal lighting, dreamlike" },
  { key: "horror", label: "恐怖风格", desc: "Horror style, dark atmosphere, eerie lighting, suspenseful" },
  { key: "comedy", label: "喜剧风格", desc: "Comedy style, bright colors, cheerful atmosphere, exaggerated expressions" },
];

// 视频生成提示词固定后缀（所有模式都加入）
const PROMPT_FIXED_SUFFIX = "连续运镜，电影级3D短剧视觉，动态光影，画面流畅自然，超高清画质，锐利细节，所有人物清晰可见，主角和配角同等清晰度，无角色虚化，场景细节丰富，所有环境元素清晰可见，无背景虚化，景深适中，全员入镜，无可见拍摄设备，一镜到底感。专业影视级画面。";

// 图音生视频(Ref2VA)支持的分辨率
const RESOLUTIONS_IA2V = [
  { key: "1080p横", label: "1080P 横屏（16:9）" },
  { key: "1080p竖", label: "1080P 竖屏（9:16）" },
  { key: "768p横", label: "768P 横屏（16:9）" },
  { key: "768p竖", label: "768P 竖屏（9:16）" },
  { key: "480p横", label: "480P 横屏（16:9）" },
  { key: "480p竖", label: "480P 竖屏（9:16）" },
];

// 通过调度机API提取视频最后一帧（避免前端CORS问题）
const extractLastFrameViaAPI = async (videoUrl, log) => {
  try {
    if (log) log("正在通过调度机提取视频尾帧…");
    const result = await api("/api/video/extract-last-frame", {
      method: "POST",
      body: JSON.stringify({ video_url: videoUrl }),
    });
    if (result && result.image_url) {
      if (log) log(`调度机提取尾帧成功：${result.image_url.substring(0, 80)}...`);
      return result.image_url;
    }
    if (log) log("⚠️ 调度机提取尾帧返回空，将尝试前端提取");
    return null;
  } catch (e) {
    if (log) log(`⚠️ 调度机提取尾帧失败（${e.message}），将尝试前端提取`);
    return null;
  }
};

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
  try { video.load(); } catch (e) { fail("load error: " + e.message); }
  // 超时保护
  setTimeout(() => fail("timeout"), 15000);
});

// 把本地图片（blob URL或base64）上传到调度机，获取公网URL
const uploadImageToServer = async (imageUrl, log) => {
  if (!imageUrl) return null;
  
  // 如果已经是腾讯云COS的URL（永久URL），直接返回，不需要重复上传
  if (imageUrl.includes("myqcloud.com") || imageUrl.includes("cdn.jinsuai.cn")) {
    if (log) log(`✅ 图片已是腾讯云COS永久URL，无需上传：${imageUrl.substring(0, 80)}...`);
    return imageUrl;
  }
  
  try {
    const imgType = imageUrl.startsWith("blob:") ? "blob" : imageUrl.startsWith("data:") ? "base64" : imageUrl.startsWith("http") ? "http-url" : "other";
    if (log) log(`正在上传图片（${imgType}格式，长度${imageUrl.length}）：${imageUrl.substring(0, 80)}${imageUrl.length > 80 ? "..." : ""}`);
    
    const baseUrl = (typeof localStorage !== "undefined" && localStorage.getItem("DISPATCH_BASE_URL")) || "https://api.jinsuai.cn";
    // 上传接口用http（避免自签名证书问题），返回的图片URL用https
    const uploadBaseUrl = baseUrl;
    const imageBaseUrl = baseUrl;
    
    // 获取认证token
    const authToken = (typeof localStorage !== "undefined" && localStorage.getItem("DISPATCH_TOKEN")) || "";
    const authHeaders = {};
    if (authToken) {
      authHeaders["Authorization"] = "Bearer " + authToken;
    }
    
    // 对于所有http/https URL，都传给调度机下载并保存
    if (imageUrl.startsWith("http")) {
      if (log) log(`URL传调度机下载并保存：${uploadBaseUrl}/api/upload/image`);
      const formData = new FormData();
      formData.append("url", imageUrl);
      const res = await fetch(uploadBaseUrl + "/api/upload/image", {
        method: "POST",
        headers: authHeaders,
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        let publicUrl = data.url;
        if (publicUrl && publicUrl.startsWith("/")) {
          publicUrl = imageBaseUrl + publicUrl;
        }
        if (log) log(`图片上传成功：${publicUrl}`);
        return publicUrl;
      }
      const errText = await res.text().catch(() => "");
      if (log) log(`❌ 图片上传失败：HTTP ${res.status} ${errText}`);
      console.warn("[uploadImage] 上传失败:", res.status, errText);
      return null;
    }
    
    // 对于blob/base64，转换成文件上传
    let file;
    if (imageUrl.startsWith("blob:")) {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      file = new File([blob], `image_${Date.now()}.jpg`, { type: blob.type || "image/jpeg" });
    } else if (imageUrl.startsWith("data:")) {
      const commaIdx = imageUrl.indexOf(",");
      const header = commaIdx > 0 ? imageUrl.substring(0, commaIdx) : "data:image/jpeg;base64";
      const data = commaIdx > 0 ? imageUrl.substring(commaIdx + 1) : imageUrl;
      const mimeMatch = header.match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
      const bstr = atob(data);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      file = new File([u8arr], `image_${Date.now()}.jpg`, { type: mime });
    } else {
      if (log) log(`❌ 不支持的图片格式`);
      return null;
    }
    
    if (log) log(`上传文件到调度机：${uploadBaseUrl}/api/upload/image`);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(uploadBaseUrl + "/api/upload/image", {
      method: "POST",
      headers: authHeaders,
      body: formData,
    });
    if (res.ok) {
      const data = await res.json();
      let publicUrl = data.url;
      if (publicUrl && publicUrl.startsWith("/")) {
        publicUrl = imageBaseUrl + publicUrl;
      }
      if (log) log(`图片上传成功：${publicUrl}`);
      return publicUrl;
    }
    const errText = await res.text().catch(() => "");
    if (log) log(`❌ 图片上传失败：HTTP ${res.status} ${errText}`);
    console.warn("[uploadImage] 上传失败:", res.status, errText);
    return null;
  } catch (e) {
    if (log) log(`❌ 图片上传异常：${e.message}`);
    console.warn("[uploadImage] 异常:", e);
    return null;
  }
}

export const VideoGenBoard = ({ project, update, log, externalFirstFrame, onClearExternalFirstFrame }) => {
  const allShots = (project.shots || []).filter(Boolean);
  const episodes = (project.episodes || []).filter(Boolean);
  const characters = project.materials?.characters || [];
  const [busy, setBusy] = useState("");
  const [genProgress, setGenProgress] = useState({}); // {shotId: {text, queuePosition, status, progress}}
  const [selectedMode, setSelectedMode] = useState(() => String(getAppSetting("defaultVideoMode", "I2V")).toLowerCase());
  const [resolution, setResolution] = useState(() => getAppSetting("defaultResolution", "768p竖"));
  const [duration, setDuration] = useState(() => Number(getAppSetting("defaultDuration", 5)));
  const [selectedStyle, setSelectedStyle] = useState(() => getAppSetting("defaultVideoStyle", "cinematic"));

  const [lastFrameUrl, setLastFrameUrl] = useState("");
  const [firstFrameUrl, setFirstFrameUrl] = useState("");
  // 全能参考(Ref2VA/v2)模式：参考音频URL数组（最多3个）和用户手动上传的参考图（选填）
  const [refAudioUrls, setRefAudioUrls] = useState(["", "", ""]);
  const [refImageUrl, setRefImageUrl] = useState("");
  // 素材库中的音频素材（用于快速选择已生成的配音）
  const [audioAssets, setAudioAssets] = useState([]);
  // 首帧来源选择：shot=本分镜分镜图，prev_video=上个视频尾帧，custom=用户手动上传
  const [firstFrameSource, setFirstFrameSource] = useState("shot");
  // 尾帧来源选择：next_shot=下一分镜分镜图，next_video=下个视频尾帧，custom=用户手动上传
  const [lastFrameSource, setLastFrameSource] = useState("next_shot");
  const [refiningShotId, setRefiningShotId] = useState("");
  const [editingShotId, setEditingShotId] = useState("");
  const [editingPrompt, setEditingPrompt] = useState("");
  const [selectedEpisode, setSelectedEpisode] = useState(episodes[0]?.id || "");
  const [selectedShotId, setSelectedShotId] = useState(allShots[0]?.id || "");
  const [showCharSelect, setShowCharSelect] = useState("");

  // 加载素材库中的音频素材（用于快速选择已生成的配音）
  useEffect(() => {
    const audios = (project?.assets || []).filter((a) => a.type === "audio" && a.url);
    setAudioAssets(audios);
  }, [project?.assets]);

  // 按集筛选分镜
  const shots = selectedEpisode === "all" ? allShots : allShots.filter(s => s && s.episodeId === selectedEpisode);

  // AI细化分镜提示词
  const refinePrompt = async (sh) => {
    if (refiningShotId) return;

    // 未登录用户不能使用
    if (!isLoggedIn()) {
      alert("请先登录后再使用AI细化提示词功能");
      return;
    }
    // 积分预校验（AI细化提示词1积分）
    try {
      const precheck = await precheckCredits(1, "text", "AI细化视频提示词");
      if (!precheck.sufficient && precheck.sufficient !== undefined) {
        log(`❌ 积分不足：需要1积分，当前余额${precheck.balance || 0}积分`);
        alert(`积分不足！AI细化提示词需要1积分，当前余额${precheck.balance || 0}积分。请充值后再试。`);
        return;
      }
    } catch (e) {
      log(`⚠️ 积分预校验失败：${e.message}`);
    }

    setRefiningShotId(sh.id);
    log(`正在为「${sh.title}」AI细化视频提示词...`);
    try {
      const sceneType = sh.sceneType || "中景";
      const cameraMove = sh.cameraMove || "固定";
      const shotDuration = duration;
      const desc = sh.sceneDesc || "";
      const dialogue = sh.dialogue || "";
      const characters = (sh.characters || []).join("、");
      
      const prompt = `你是一名专业的AI视频生成提示词工程师，精通MiniMax H3视频生成模型。
请将以下简单的分镜描述，细化成一段专业、详细、适合MiniMax H3视频生成模型的中文提示词。

细化要求：
必须按以下六大块结构输出（不要遗漏任何一块）：
镜头：景别与运镜描述（含时长，镜头运动质感，如“中景，平稳跟随跟镜，人物保持画面中心，9秒时长，电影运镜轻微呼吸感，无剧烈晃动”）
场景：环境细节描述（时间/地点/天气/动态环境元素，如雨丝、雾气、水洼反光等）
人物：角色名+着装+动作+神态（如“林屿，一身深色休闲装束，单手撑纯黑色长柄雨伞，快步疾走；面部神情紧绷警惕，呼吸急促，眼神锐利不安”）
光影色彩：色调与光线描述（冷/暖色调，光源，光线与环境的相互作用，如“冷青蓝调冷色调光线，夜晚环境光，细密雨丝垂落如同雨帘，地面水渍反射微光”）
氛围：情绪基调+画面质感+画质要求（如“压抑紧绷，悬疑紧张，孤寂危险，暗黑写实电影质感，颗粒细腻，景深适中，背景虚化”）
负面提示词：列出5-10个应避免的元素（逗号分隔，如“明亮日光，色彩艳丽，人物表情放松，镜头抖动剧烈，画面过曝，卡通画风”）
要求：
1. 输出纯中文，不要英文，不要解释，不要markdown代码块
2. 每块内容要具体细腻，贴合分镜描述，可合理扩充细节
3. 整体长度控制在300-500个中文字

分镜信息：
- 分镜标题：${sh.title}
- 场景类型：${sceneType}
- 运镜方式：${cameraMove}
- 时长：${shotDuration}秒
- 分镜描述：${desc}
- 对话内容：${dialogue}
- 出场角色：${characters}

直接输出细化后的中文提示词：`;
      
      const res = await api("/api/llm/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1024,
        })
      });
      const refinedText = (res.text || "").trim();
      if (!refinedText) throw new Error("LLM未返回内容");
      
      // 保存细化后的提示词到promptCn字段（虽然是英文，但字段名沿用）
      update({ shots: shots.map(s => s.id === sh.id ? { ...s, promptCn: refinedText } : s) });
      log(`✅「${sh.title}」提示词细化成功（${refinedText.length}字符）`);

      // 积分扣减已移至后端（/api/llm/chat 按 llm_type 扣费），前端仅刷新余额显示
      if (isLoggedIn()) {
        try {
          const balanceData = await getCreditBalance();
          if (window.onCreditUpdate) window.onCreditUpdate(balanceData.balance || balanceData.credits || 0);
          if (window.refreshUserInfo) window.refreshUserInfo();
        } catch (e) {}
      }
    } catch (err) {
      log(`❌ 提示词细化失败：${err.message}`);
    } finally {
      setRefiningShotId("");
    }
  };

  // 获取分镜涉及的角色图片（优先使用用户手动选择的角色）
  const getShotCharacterImages = (sh) => {
    // 如果用户手动选择了角色，优先使用
    if (sh.selectedCharIds && sh.selectedCharIds.length > 0) {
      const selectedChars = characters.filter(c => c.image && sh.selectedCharIds.includes(c.id));
      if (selectedChars.length > 0) {
        return selectedChars.map(c => c.image).filter(Boolean);
      }
    }
    // 否则按名字自动匹配
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

  // 切换角色选择
  const toggleCharSelection = (sh, charId) => {
    const selected = sh.selectedCharIds || [];
    const newSelected = selected.includes(charId)
      ? selected.filter(id => id !== charId)
      : [...selected, charId];
    update({ shots: allShots.map(s => s.id === sh.id ? { ...s, selectedCharIds: newSelected } : s) });
  };

  // 找上一个分镜（同集内，按顺序）
  const getPrevShot = (sh) => {
    if (!sh) return null;
    const idx = shots.findIndex(s => s && s.id === sh.id);
    if (idx <= 0) return null;
    // 只找同集的上一个分镜，且必须有有效videoUrl
    const sameEp = shots.filter(s => s && s.episodeId === sh.episodeId);
    const sameIdx = sameEp.findIndex(s => s && s.id === sh.id);
    if (sameIdx > 0) {
      const prev = sameEp[sameIdx - 1];
      if (prev && prev.videoUrl && prev.videoUrl.startsWith("http")) {
        return prev;
      }
    }
    return null;
  };

  // 获取本集内下一分镜（用于R2V尾帧）
  const getNextShot = (sh) => {
    if (!sh) return null;
    const sameEp = shots.filter(s => s && s.episodeId === sh.episodeId);
    const sameIdx = sameEp.findIndex(s => s && s.id === sh.id);
    if (sameIdx >= 0 && sameIdx < sameEp.length - 1) {
      const next = sameEp[sameIdx + 1];
      if (next && next.imageUrl && next.imageUrl.startsWith("http")) {
        return next;
      }
    }
    return null;
  };

  const genVideo = async (sh) => {
    setBusy(sh.id);
    log(`开始生成视频：${sh.title}（${selectedMode.toUpperCase()}）`);
    // 未登录用户不能使用
    if (!isLoggedIn()) {
      alert("请先登录后再使用视频生成功能");
      setBusy("");
      return;
    }
    try {
      // 积分预校验：按模式+分辨率分别定价
      const pricePerSec = getVideoPricePerSec(selectedMode, resolution);
      const needCredits = pricePerSec * duration;
      try {
        const precheck = await precheckCredits(needCredits, "video", `视频生成：${sh.title}`);
        if (!precheck.sufficient && precheck.sufficient !== undefined) {
          log(`❌ 积分不足：需要${needCredits}积分，当前余额${precheck.balance || 0}积分`);
          alert(`积分不足！生成此视频需要${needCredits}积分，当前余额${precheck.balance || 0}积分。请充值后再试。`);
          setBusy("");
          return;
        }
        log(`积分预校验通过：需要${needCredits}积分，余额充足`);
      } catch (e) {
        log(`⚠️ 积分预校验失败（${e.message}），继续生成`);
      }

      const sceneType = sh.sceneType || "中景";
      const cameraMove = sh.cameraMove || "固定";
      const shotDuration = duration;

      // 获取当前选择的风格描述
      const styleObj = VIDEO_STYLES.find(s => s.key === selectedStyle);
      const styleDesc = styleObj ? styleObj.desc : "";

      // 动态生成构图描述（根据用户选择的分辨率）
      let compositionDesc = "";
      if (resolution.includes("竖")) {
        compositionDesc = "竖屏9:16构图";
      } else if (resolution.includes("横")) {
        compositionDesc = "横屏16:9构图";
      } else if (resolution.includes("1:1") || resolution.includes("方")) {
        compositionDesc = "方形1:1构图";
      }

      // 事件描述：分镜标题 + 分镜描述
      const eventTitle = sh.title || "";
      const eventDesc = sh.sceneDesc || "";
      const eventFullDesc = eventTitle ? `${eventTitle}。${eventDesc}` : eventDesc;

      // 视频提示词：如果有AI细化后的提示词，直接使用；否则用中文模板构建
      let videoPrompt;
      if (sh.promptCn && sh.promptCn.length > 50) {
        videoPrompt = sh.promptCn;
        // 在AI细化提示词后面追加风格描述、构图描述和固定后缀
        const suffixParts = [];
        if (styleDesc) suffixParts.push(styleDesc);
        if (compositionDesc) suffixParts.push(compositionDesc);
        suffixParts.push(PROMPT_FIXED_SUFFIX);
        videoPrompt = `${videoPrompt}。${suffixParts.join("。")}`;
        log(`使用AI细化提示词（${sh.promptCn.length}字符）+ 风格：${styleObj?.label || "默认"} + 构图：${compositionDesc || "默认"} + 固定后缀`);
      } else {
        videoPrompt = `${sceneType}镜头，${cameraMove}运镜，时长${shotDuration}秒。${eventFullDesc}。${styleDesc ? styleDesc + "。" : ""}${compositionDesc ? compositionDesc + "。" : ""}${PROMPT_FIXED_SUFFIX}`;
        log(`使用默认模板提示词 + 风格：${styleObj?.label || "默认"} + 构图：${compositionDesc || "默认"}（建议先点击AI细化提示词）`);
      }

      // AutoDL ComfyUI工作流参数
      const workflowParams = {
        prompt: videoPrompt,
        duration: Math.min(10, shotDuration),
        resolution: resolution,
      };

      let refIdx = 0;
      let hasFirstFrame = false;

      if (selectedMode === "i2v") {
        // 图生视频（minimax_h3_lightx2v_v5）：只使用人物参考图，不用首帧
        const charImages = getShotCharacterImages(sh);
        if (charImages.length === 0) {
          log("⚠️ 没有可用的角色参考图，请先在「人物管理」生成角色三视图");
          setBusy("");
          return;
        }

        // 1. 上传人物参考图（从ref_image_0开始，最多9张）
        log(`找到${charImages.length}张角色图，开始上传…`);
        let refIdx = 0;
        for (let i = 0; i < charImages.length; i++) {
          if (refIdx >= 9) break; // lightx2v_v5支持ref_image_0到ref_image_8共9张
          const img = charImages[i];
          log(`正在上传第${i + 1}张角色图…`);
          const charPublicUrl = await uploadImageToServer(img, log);
          if (charPublicUrl) {
            workflowParams[`ref_image_${refIdx}`] = charPublicUrl;
            log(`第${i + 1}张角色图上传成功，ref_image_${refIdx} = ${charPublicUrl.substring(0, 80)}...`);
            refIdx++;
          } else {
            log(`❌ 第${i + 1}张角色图上传失败`);
          }
        }
        const charCount = refIdx; // 人物参考图数量

        // 2. 添加随机种子（seed）
        const seed = Math.floor(Math.random() * 2147483647);
        workflowParams.seed = seed;
        log(`随机种子：${seed}`);

        log(`参考图：人物${charCount}张（ref_image_0-ref_image_${charCount - 1}），不使用首帧`);
      } else if (selectedMode === "r2v") {
        // 首尾帧（minimax_h3_lightx2v）：首帧和尾帧都是必填，各有三种来源选择
        const prevShot = getPrevShot(sh);
        const nextShot = getNextShot(sh);

        // ========== 获取首帧 ==========
        let resolvedFirstFrame = null;
        let firstFrameDesc = "";

        if (firstFrameSource === "shot") {
          // 来源1：本分镜分镜图
          resolvedFirstFrame = sh.imageUrl;
          firstFrameDesc = `本分镜「${sh.title}」分镜图`;
        } else if (firstFrameSource === "prev_video") {
          // 来源2：上个视频的尾帧
          if (prevShot && prevShot.videoUrl) {
            log(`找到上一镜「${prevShot.title}」视频，正在提取尾帧作为首帧…`);
            resolvedFirstFrame = await extractLastFrameViaAPI(prevShot.videoUrl, log);
            if (!resolvedFirstFrame) {
              log("调度机提取失败，尝试前端提取…");
              const firstFrame = await extractLastFrame(prevShot.videoUrl);
              if (firstFrame) {
                resolvedFirstFrame = await uploadImageToServer(firstFrame, log);
              }
            }
            firstFrameDesc = `上一镜「${prevShot.title}」视频尾帧`;
          } else {
            throw new Error("首帧来源选择了「上个视频尾帧」，但上一镜没有生成视频。请先生成上一镜视频，或选择其他首帧来源。");
          }
        } else if (firstFrameSource === "custom") {
          // 来源3：用户手动上传
          resolvedFirstFrame = firstFrameUrl;
          firstFrameDesc = "用户手动上传";
        }

        if (!resolvedFirstFrame) {
          throw new Error(`首帧获取失败（来源：${firstFrameDesc}）。请检查图片是否有效，或选择其他首帧来源。`);
        }

        log(`首帧：${firstFrameDesc}`);
        const firstPublicUrl = await uploadImageToServer(resolvedFirstFrame, log);
        if (!firstPublicUrl) {
          throw new Error("首帧上传失败，请检查图片URL或重新上传。");
        }
        workflowParams.first_frame = firstPublicUrl;
        log(`首帧上传成功 ✓`);

        // ========== 获取尾帧（必填） ==========
        let resolvedLastFrame = null;
        let lastFrameDesc = "";

        if (lastFrameSource === "next_shot") {
          // 来源1：下一分镜分镜图
          if (nextShot && nextShot.imageUrl) {
            resolvedLastFrame = nextShot.imageUrl;
            lastFrameDesc = `下一分镜「${nextShot.title}」分镜图`;
          } else {
            throw new Error("尾帧来源选择了「下一分镜分镜图」，但下一分镜没有分镜图。请先生成下一分镜分镜图，或选择其他尾帧来源。");
          }
        } else if (lastFrameSource === "next_video") {
          // 来源2：下个视频的首帧
          if (nextShot && nextShot.videoUrl) {
            log(`找到下一镜「${nextShot.title}」视频，正在提取首帧作为尾帧…`);
            // 提取视频首帧
            try {
              const video = document.createElement("video");
              video.crossOrigin = "anonymous";
              video.src = nextShot.videoUrl;
              await new Promise((resolve, reject) => {
                video.onloadeddata = resolve;
                video.onerror = reject;
              });
              video.currentTime = 0;
              await new Promise((resolve) => {
                video.onseeked = resolve;
              });
              const canvas = document.createElement("canvas");
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const ctx = canvas.getContext("2d");
              ctx.drawImage(video, 0, 0);
              const firstFrameDataUrl = canvas.toDataURL("image/png");
              resolvedLastFrame = await uploadImageToServer(firstFrameDataUrl, log);
              lastFrameDesc = `下一镜「${nextShot.title}」视频首帧`;
            } catch (e) {
              log(`⚠️ 提取下一镜视频首帧失败：${e.message}`);
              throw new Error("尾帧来源选择了「下个视频首帧」，但提取下一镜视频首帧失败。请选择其他尾帧来源。");
            }
          } else {
            throw new Error("尾帧来源选择了「下个视频首帧」，但下一镜没有生成视频。请先生成下一镜视频，或选择其他尾帧来源。");
          }
        } else if (lastFrameSource === "custom") {
          // 来源3：用户手动上传
          resolvedLastFrame = lastFrameUrl;
          lastFrameDesc = "用户手动上传";
        }

        if (!resolvedLastFrame) {
          throw new Error(`尾帧获取失败（来源：${lastFrameDesc}）。尾帧是必填项，请检查图片是否有效，或选择其他尾帧来源。`);
        }

        log(`尾帧：${lastFrameDesc}`);
        const lastPublicUrl = await uploadImageToServer(resolvedLastFrame, log);
        if (!lastPublicUrl) {
          throw new Error("尾帧上传失败，请检查图片URL或重新上传。");
        }
        workflowParams.last_frame = lastPublicUrl;
        log(`尾帧上传成功 ✓`);

        log(`首尾帧（lightx2v）：首帧✓ 尾帧✓（均为必填）`);
      } else if (selectedMode === "ia2v") {
        // 全能参考（minimax_h3_image_audio_to_video_v2 / Ref2VA）：所有参数选填，支持最多9张参考图+3个参考音频
        // 1. 获取参考图片（优先用户手动上传，否则自动获取角色参考图，和I2V一样）
        let refImages = [];
        if (refImageUrl) {
          // 用户手动上传了参考图，优先使用
          refImages.push(refImageUrl);
          log("参考图片：使用用户手动上传的参考图");
        } else {
          // 自动获取角色参考图（和I2V一样）
          const charImages = getShotCharacterImages(sh);
          if (charImages.length > 0) {
            refImages = charImages;
            log(`参考图片：自动获取 ${charImages.length} 张角色参考图`);
          } else {
            log("⚠️ 没有角色参考图，也没有手动上传参考图，将纯文本生成");
          }
        }

        // 2. 上传参考图片（ref_image_0~8，最多9张）
        let refImgIdx = 0;
        for (let i = 0; i < refImages.length; i++) {
          if (refImgIdx >= 9) break;
          const img = refImages[i];
          const imgPublicUrl = await uploadImageToServer(img, log);
          if (imgPublicUrl) {
            workflowParams[`ref_image_${refImgIdx}`] = imgPublicUrl;
            refImgIdx++;
          }
        }

        // 3. 添加参考音频（ref_audio_0~2，最多3个，选填）
        let audioIdx = 0;
        for (let i = 0; i < refAudioUrls.length; i++) {
          const audioUrl = refAudioUrls[i]?.trim();
          if (audioUrl && audioUrl.startsWith("http")) {
            workflowParams[`ref_audio_${audioIdx}`] = audioUrl;
            audioIdx++;
          }
        }
        if (audioIdx === 0) {
          log("ℹ️ 未填写参考音频，将不使用音频参考");
        }

        // 4. 添加随机种子（seed）
        const seed = Math.floor(Math.random() * 2147483647);
        workflowParams.seed = seed;
        log(`随机种子：${seed}`);

        // 5. duration 已经在 workflowParams 中设置了（1-10秒）
        log(`全能参考（Ref2VA v2）：参考图${refImgIdx}张 + 参考音频${audioIdx}个 + 时长${workflowParams.duration}秒`);
      }
      // t2v：不传参考图

      // 根据模式选择不同的工作流ID
      let currentWorkflowId;
      if (selectedMode === "i2v") {
        currentWorkflowId = I2V_WORKFLOW_ID; // minimax_h3_lightx2v_v5
      } else if (selectedMode === "r2v") {
        currentWorkflowId = R2V_WORKFLOW_ID; // minimax_h3_lightx2v
      } else if (selectedMode === "ia2v") {
        currentWorkflowId = IA2V_WORKFLOW_ID; // minimax_h3_image_audio_to_video
      } else {
        currentWorkflowId = T2V_WORKFLOW_ID; // minimax_h3_lightx2v_no_pic
      }

      // 根据模式限制duration（I2V=1-10秒，R2V/T2V=1-15秒）
      const maxDuration = getMaxDuration(selectedMode);
      workflowParams.duration = Math.min(maxDuration, Math.max(1, workflowParams.duration));

      log(`提交视频生成任务，工作流：${currentWorkflowId}，模式：${selectedMode}`);

      const res = await runDispatchJob({
        type: "video",
        payload: {
          workflow: currentWorkflowId,
          model: "MiniMax-H3",
          mode: selectedMode,
          ...workflowParams,
        },
        pollInterval: 5000,
        timeoutMs: 7200000,
        onProgress: (progress, text, info) => {
          setGenProgress(prev => ({ ...prev, [sh.id]: { text, ...info } }));
        }
      });

      // 获取视频实际时长并更新
      const actualDuration = await new Promise((resolve) => {
        const v = document.createElement("video");
        v.preload = "metadata";
        v.onloadedmetadata = () => resolve(Math.round(v.duration));
        v.onerror = () => resolve(null);
        v.src = res.resultUrl;
      });
      const durationUpdate = actualDuration ? { duration: actualDuration } : {};

      // 1. 更新分镜的videoUrl（继续覆盖旧视频，保持最新）
      update({ shots: shots.map(s => s.id === sh.id ? { ...s, videoUrl: res.resultUrl, ...durationUpdate } : s) });
      // 2. 同时存入素材库（根据用户设置控制是否自动存入）
      if (getAppSetting("autoAddToAssets", true)) {
        try {
          const currentAssets = project?.assets || [];
          const newVideoAsset = {
            id: "a_video_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8),
            type: "video",
            title: `${sh.title}（${new Date().toLocaleString('zh-CN', {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'})}）`,
            url: res.resultUrl,
            status: "ready",
            tags: ["视频生成", selectedMode.toUpperCase(), sh.episodeId ? `第${sh.episodeId}集` : ""].filter(Boolean),
            favorite: false,
            shotId: sh.id,
            episodeId: sh.episodeId || "",
            duration: actualDuration || duration,
            resolution: resolution,
            mode: selectedMode,
            createdAt: Date.now()
          };
          update({ assets: [newVideoAsset, ...currentAssets] });
          log(`✅ 视频已存入素材库：${newVideoAsset.title}`);
        } catch (e) {
          log(`⚠️ 视频存入素材库失败：${e.message}`);
        }
      }
      log(`✅ 视频生成成功：${sh.title}${actualDuration ? `（实际时长${actualDuration}秒）` : ""}`);

      // 积分扣减已移至后端（/api/jobs/submit 按真实时长/分辨率/模式扣费），前端仅刷新余额显示
      if (isLoggedIn()) {
        try {
          const balanceData = await getCreditBalance();
          if (window.onCreditUpdate) window.onCreditUpdate(balanceData.balance || balanceData.credits || 0);
          if (window.refreshUserInfo) window.refreshUserInfo();
        } catch (e) {}
      }
    } catch (e) {
      log(`❌ 视频生成失败：${e.message}`);
    } finally {
      setBusy("");
      setGenProgress(prev => { const next = { ...prev }; delete next[sh.id]; return next; });
    }
  };

  // 视频价格：按模式+分辨率分别定价
  const pricePerSec = getVideoPricePerSec(selectedMode, resolution);
  const currentCredits = pricePerSec * duration;
  const showLastFrame = selectedMode === "r2v";

  return (
    <div style={{ padding: 16, height: "100%", overflow: "auto", color: "var(--text)" }}>
      {/* 来自3D导演台的首帧提示 */}
      {externalFirstFrame && (
        <div style={{ marginBottom: 12, padding: "10px 14px", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 8, background: "rgba(245,158,11,0.08)", display: "flex", alignItems: "center", gap: 12 }}>
          <img src={externalFirstFrame} alt="3D导演台首帧" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 4, border: "1px solid rgba(255,255,255,0.2)" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#f59e0b", marginBottom: 2 }}>🎬 已使用3D导演台渲染的首帧</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>i2v模式将优先使用此首帧作为参考图</div>
          </div>
          <button onClick={() => { onClearExternalFirstFrame?.(); log("已清除3D导演台首帧"); }} style={{ padding: "6px 12px", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 6, background: "transparent", color: "#f59e0b", cursor: "pointer", fontSize: 11 }}>
            清除
          </button>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>🎥 视频生成 · MiniMax-H3</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 12 }}
            value={selectedMode} onChange={e => {
              const newMode = e.target.value;
              setSelectedMode(newMode);
              // 自动校正分辨率（如果当前分辨率在新模式下不可用）
              const availableResolutions = getResolutions(newMode);
              if (!availableResolutions.find(r => r.key === resolution)) {
                setResolution("768p竖");
              }
              // 自动校正时长（如果当前时长超过新模式的最大值）
              const maxDur = getMaxDuration(newMode);
              if (duration > maxDur) {
                setDuration(maxDur);
              }
            }}>
            {VIDEO_MODES.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
          <select style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 12 }}
            value={resolution} onChange={e => setResolution(e.target.value)}>
            {getResolutions(selectedMode).map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          <select style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 12 }}
            value={duration} onChange={e => setDuration(Number(e.target.value))}>
            {getDurations(selectedMode).map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
          <select style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 12 }}
            value={selectedStyle} onChange={e => setSelectedStyle(e.target.value)}
            title="选择视频风格">
            {VIDEO_STYLES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <select style={{ padding: "6px 10px", border: "1px solid #7A5CFF", borderRadius: 6, background: "rgba(122,92,255,0.1)", color: "var(--text)", fontSize: 12 }}
            value={selectedEpisode} onChange={e => setSelectedEpisode(e.target.value)}>
            {episodes.map((ep, i) => {
              const epShots = allShots.filter(s => s && s.episodeId === ep.id);
              return <option key={ep.id} value={ep.id}>{ep.title || `第${i + 1}集`}（{epShots.length}个分镜）</option>;
            })}
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

      {/* R2V首尾帧设置 */}
      {showLastFrame && (
        <div style={{ marginBottom: 16, padding: 12, border: "1px solid var(--border)", borderRadius: 8, background: "var(--panel-2)" }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>🖼️ 首尾帧设置（首帧和尾帧均为必填，各有三种来源可选）</span>
            <span style={{ fontSize: 11, color: "#7A5CFF", fontWeight: 500 }}>
              当前分镜：{shots.find(s => s.id === selectedShotId)?.title || "请点击下方分镜卡片选择"}
            </span>
          </div>

          {/* 首帧设置 */}
          <div style={{ marginBottom: 12, padding: 10, border: "1px solid rgba(245,158,11,0.3)", borderRadius: 6, background: "rgba(245,158,11,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#f59e0b" }}>
                <span style={{ color: "#f59e0b", fontWeight: 600 }}>*</span> 首帧（必填）
              </span>
              <select
                value={firstFrameSource}
                onChange={(e) => setFirstFrameSource(e.target.value)}
                style={{ padding: "4px 8px", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 4, background: "var(--input-bg)", color: "var(--text)", fontSize: 11 }}
              >
                <option value="shot">本分镜分镜图</option>
                <option value="prev_video">上个视频尾帧</option>
                <option value="custom">用户手动上传</option>
              </select>
            </div>

            {/* 根据来源显示输入 */}
            {firstFrameSource === "custom" && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <input style={{ flex: 1, padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 12 }}
                  placeholder="首帧图片 URL" value={firstFrameUrl} onChange={e => setFirstFrameUrl(e.target.value)} />
                <input type="file" accept="image/*" style={{ display: "none" }} id="firstFrameUpload"
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    log("正在上传首帧图片…");
                    try {
                      const objectUrl = URL.createObjectURL(file);
                      const publicUrl = await uploadImageToServer(objectUrl, log);
                      if (publicUrl) { setFirstFrameUrl(publicUrl); log("首帧图片上传成功 ✓"); }
                      else { log("❌ 首帧图片上传失败"); }
                      URL.revokeObjectURL(objectUrl);
                    } catch (err) { log("❌ 首帧图片上传失败: " + err.message); }
                    e.target.value = "";
                  }} />
                <button onClick={() => document.getElementById("firstFrameUpload").click()}
                  style={{ padding: "6px 12px", border: "none", borderRadius: 6, background: "#f59e0b", color: "#fff", cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}>
                  📤 上传
                </button>
              </div>
            )}

            {/* 首帧预览 */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 80, height: 100, background: "var(--input-bg)", borderRadius: 4, overflow: "hidden", border: "1px solid var(--border)" }}>
                {(() => {
                  const currentShot = shots.find(s => s.id === selectedShotId);
                  const prevShot = currentShot ? getPrevShot(currentShot) : null;
                  let previewUrl = "";
                  if (firstFrameSource === "shot") previewUrl = currentShot?.imageUrl || "";
                  else if (firstFrameSource === "prev_video") previewUrl = prevShot?.videoUrl ? "" : "";
                  else if (firstFrameSource === "custom") previewUrl = firstFrameUrl || "";
                  return previewUrl ? <img src={previewUrl} alt="首帧预览" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> :
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "var(--text-muted)", textAlign: "center", padding: 4 }}>
                      {firstFrameSource === "shot" ? "无分镜图" : firstFrameSource === "prev_video" ? "需生成时提取" : "请上传图片"}
                    </div>;
                })()}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", flex: 1 }}>
                {firstFrameSource === "shot" && (shots.find(s => s.id === selectedShotId)?.imageUrl ? "✓ 使用本分镜分镜图" : "⚠️ 本分镜无分镜图，请先生成")}
                {firstFrameSource === "prev_video" && (getPrevShot(shots.find(s => s.id === selectedShotId))?.videoUrl ? "✓ 将提取上个视频尾帧" : "⚠️ 上个视频不存在，请先生成")}
                {firstFrameSource === "custom" && (firstFrameUrl ? "✓ 使用手动上传的首帧" : "⚠️ 请上传或填写首帧URL")}
              </div>
            </div>
          </div>

          {/* 尾帧设置（必填） */}
          <div style={{ padding: 10, border: "1px solid rgba(16,185,129,0.3)", borderRadius: 6, background: "rgba(16,185,129,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#10b981" }}>
                <span style={{ color: "#10b981", fontWeight: 600 }}>*</span> 尾帧（必填）
              </span>
              <select
                value={lastFrameSource}
                onChange={(e) => setLastFrameSource(e.target.value)}
                style={{ padding: "4px 8px", border: "1px solid rgba(16,185,129,0.4)", borderRadius: 4, background: "var(--input-bg)", color: "var(--text)", fontSize: 11 }}
              >
                <option value="next_shot">下一分镜分镜图</option>
                <option value="next_video">下个视频首帧</option>
                <option value="custom">用户手动上传</option>
              </select>
            </div>

            {/* 根据来源显示输入 */}
            {lastFrameSource === "custom" && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <input style={{ flex: 1, padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 12 }}
                  placeholder="尾帧图片 URL" value={lastFrameUrl} onChange={e => setLastFrameUrl(e.target.value)} />
                <input type="file" accept="image/*" style={{ display: "none" }} id="lastFrameUpload"
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    log("正在上传尾帧图片…");
                    try {
                      const objectUrl = URL.createObjectURL(file);
                      const publicUrl = await uploadImageToServer(objectUrl, log);
                      if (publicUrl) { setLastFrameUrl(publicUrl); log("尾帧图片上传成功 ✓"); }
                      else { log("❌ 尾帧图片上传失败"); }
                      URL.revokeObjectURL(objectUrl);
                    } catch (err) { log("❌ 尾帧图片上传失败: " + err.message); }
                    e.target.value = "";
                  }} />
                <button onClick={() => document.getElementById("lastFrameUpload").click()}
                  style={{ padding: "6px 12px", border: "none", borderRadius: 6, background: "#10b981", color: "#fff", cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}>
                  📤 上传
                </button>
              </div>
            )}

            {/* 尾帧预览 */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 80, height: 100, background: "var(--input-bg)", borderRadius: 4, overflow: "hidden", border: "1px solid var(--border)" }}>
                {(() => {
                  const currentShot = shots.find(s => s.id === selectedShotId);
                  const nextShot = currentShot ? getNextShot(currentShot) : null;
                  let previewUrl = "";
                  if (lastFrameSource === "next_shot") previewUrl = nextShot?.imageUrl || "";
                  else if (lastFrameSource === "next_video") previewUrl = "";
                  else if (lastFrameSource === "custom") previewUrl = lastFrameUrl || "";
                  return previewUrl ? <img src={previewUrl} alt="尾帧预览" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> :
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "var(--text-muted)", textAlign: "center", padding: 4 }}>
                      {lastFrameSource === "next_shot" ? "无分镜图" : lastFrameSource === "next_video" ? "需生成时提取" : "请上传图片"}
                    </div>;
                })()}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", flex: 1 }}>
                {lastFrameSource === "next_shot" && (getNextShot(shots.find(s => s.id === selectedShotId))?.imageUrl ? `✓ 使用下一分镜「${getNextShot(shots.find(s => s.id === selectedShotId))?.title}」分镜图` : "⚠️ 下一分镜无分镜图，请先生成")}
                {lastFrameSource === "next_video" && (getNextShot(shots.find(s => s.id === selectedShotId))?.videoUrl ? "✓ 将提取下个视频首帧" : "⚠️ 下个视频不存在，请先生成")}
                {lastFrameSource === "custom" && (lastFrameUrl ? "✓ 使用手动上传的尾帧" : "⚠️ 请上传或填写尾帧URL")}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 全能参考(Ref2VA/v2)设置 */}
      {selectedMode === "ia2v" && (
        <div style={{ marginBottom: 16, padding: 12, border: "1px solid var(--border)", borderRadius: 8, background: "var(--panel-2)" }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>🎛️ 全能参考设置（Ref2VA v2，所有参数选填，最多9图+3音）</span>
            <span style={{ fontSize: 11, color: "#7A5CFF", fontWeight: 500 }}>
              当前分镜：{shots.find(s => s.id === selectedShotId)?.title || "请点击下方分镜卡片选择"}
            </span>
          </div>
          {/* 参考图片 */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
              🖼️ 参考图片（选填，不填则自动使用角色参考图）
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input style={{ flex: 1, padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 4, background: "var(--input-bg)", color: "var(--text)", fontSize: 11 }}
                placeholder="参考图片 URL（不填则自动使用角色参考图）" value={refImageUrl} onChange={e => setRefImageUrl(e.target.value)} />
              <input type="file" accept="image/*" style={{ display: "none" }} id="refImageUpload"
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  log("正在上传参考图片…");
                  try {
                    const objectUrl = URL.createObjectURL(file);
                    const publicUrl = await uploadImageToServer(objectUrl, log);
                    if (publicUrl) {
                      setRefImageUrl(publicUrl);
                      log("✅ 参考图片上传成功");
                    }
                    URL.revokeObjectURL(objectUrl);
                  } catch (err) { log("❌ 参考图片上传失败: " + err.message); }
                  e.target.value = "";
                }} />
              <button onClick={() => document.getElementById("refImageUpload").click()}
                style={{ padding: "6px 12px", border: "none", borderRadius: 6, background: "#10b981", color: "#fff", cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}>
                📤 上传
              </button>
              {refImageUrl && <button onClick={() => setRefImageUrl("")} style={{ padding: "6px 10px", border: "1px solid #ef4444", borderRadius: 6, background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 11 }}>清除</button>}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
              {refImageUrl ? "✓ 使用手动上传的参考图片" : "ℹ️ 将自动使用人物管理中的角色参考图（最多9张）"}
            </div>
          </div>
          {/* 参考音频（最多3个） */}
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>🎵 参考音频 URL（选填，最多3个，支持 MP3/WAV/MP4/FLAC）</span>
              <button onClick={() => {
                // 前往生成本镜音频：触发父组件切换到配音模块
                if (window.switchToDubbing) {
                  window.switchToDubbing(selectedShotId);
                } else {
                  log("💡 请在「配音」模块生成本分镜的音频，生成后复制音频URL粘贴到此处");
                }
              }} style={{ padding: "4px 10px", border: "1px solid #7A5CFF", borderRadius: 4, background: "rgba(122,92,255,0.1)", color: "#7A5CFF", cursor: "pointer", fontSize: 10, whiteSpace: "nowrap" }}>
                🎙️ 前往生成本镜音频
              </button>
            </div>
            {[0, 1, 2].map(idx => (
              <div key={idx} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)", minWidth: 42 }}>音频 {idx + 1}</span>
                <input style={{ flex: 1, minWidth: 150, padding: "5px 8px", border: "1px solid var(--border)", borderRadius: 4, background: "var(--input-bg)", color: "var(--text)", fontSize: 11 }}
                  placeholder={`https://example.com/audio${idx + 1}.mp3`}
                  value={refAudioUrls[idx] || ""}
                  onChange={e => {
                    const newUrls = [...refAudioUrls];
                    newUrls[idx] = e.target.value;
                    setRefAudioUrls(newUrls);
                  }} />
                {/* 从素材库选择已生成的配音 */}
                {audioAssets.length > 0 && (
                  <select
                    value=""
                    onChange={e => {
                      const audioUrl = e.target.value;
                      if (audioUrl) {
                        const newUrls = [...refAudioUrls];
                        newUrls[idx] = audioUrl;
                        setRefAudioUrls(newUrls);
                        log(`✅ 已从素材库选择音频：${audioUrl.substring(0, 50)}...`);
                      }
                    }}
                    style={{ padding: "5px 8px", border: "1px solid #7A5CFF", borderRadius: 4, background: "rgba(122,92,255,0.1)", color: "#7A5CFF", fontSize: 10, cursor: "pointer", maxWidth: 180 }}
                  >
                    <option value="">📚 从素材库选择</option>
                    {audioAssets.map((a, i) => (
                      <option key={a.id || i} value={a.url}>
                        {(a.title || `音频${i+1}`).substring(0, 25)}
                      </option>
                    ))}
                  </select>
                )}
                <input type="file" accept="audio/*,.mp3,.wav,.mp4,.flac,.m4a,.aac,.ogg" style={{ display: "none" }} id={`refAudioUpload${idx}`}
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    log(`正在上传音频 ${idx + 1}：${file.name}（${(file.size / 1024 / 1024).toFixed(2)}MB）…`);
                    try {
                      // 上传音频文件到调度机
                      const formData = new FormData();
                      formData.append("file", file);
                      const uploadRes = await fetch((window.UPLOAD_BASE_URL || "https://api.jinsuai.cn") + "/api/upload/file", {
                        method: "POST",
                        body: formData,
                      });
                      if (uploadRes.ok) {
                        const data = await uploadRes.json();
                        let audioUrl = data.url || data.file_url || data.path;
                        if (audioUrl && audioUrl.startsWith("/")) {
                          audioUrl = (window.UPLOAD_BASE_URL || "https://api.jinsuai.cn") + audioUrl;
                        }
                        if (audioUrl) {
                          const newUrls = [...refAudioUrls];
                          newUrls[idx] = audioUrl;
                          setRefAudioUrls(newUrls);
                          log(`✅ 音频 ${idx + 1} 上传成功：${audioUrl.substring(0, 60)}...`);
                        } else {
                          log(`❌ 音频上传返回空URL`);
                        }
                      } else {
                        const errText = await uploadRes.text().catch(() => "");
                        log(`❌ 音频上传失败：HTTP ${uploadRes.status} ${errText}`);
                      }
                    } catch (err) {
                      log(`❌ 音频上传异常：${err.message}`);
                    }
                    e.target.value = "";
                  }} />
                <button onClick={() => document.getElementById(`refAudioUpload${idx}`).click()}
                  style={{ padding: "5px 10px", border: "none", borderRadius: 4, background: "#10b981", color: "#fff", cursor: "pointer", fontSize: 10, whiteSpace: "nowrap" }}>
                  📤 上传
                </button>
                {refAudioUrls[idx] && <button onClick={() => {
                  const newUrls = [...refAudioUrls];
                  newUrls[idx] = "";
                  setRefAudioUrls(newUrls);
                }} style={{ padding: "4px 8px", border: "1px solid #ef4444", borderRadius: 4, background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 10 }}>清除</button>}
              </div>
            ))}
            <div style={{ fontSize: 10, color: refAudioUrls.filter(u => u?.trim()).length > 0 ? "#10b981" : "var(--text-muted)", marginTop: 3 }}>
              {refAudioUrls.filter(u => u?.trim()).length > 0
                ? `✓ 已填写 ${refAudioUrls.filter(u => u?.trim()).length} 个参考音频`
                : "ℹ️ 未填写参考音频，将不使用音频参考（纯图/文生成）"}
            </div>
          </div>
        </div>
      )}

      {/* i2v提示 */}
      {selectedMode === "i2v" && (
        <div style={{ marginBottom: 16, padding: "10px 14px", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 8, background: "rgba(16,185,129,0.08)" }}>
          <div style={{ fontSize: 11, color: "#10b981", lineHeight: 1.6 }}>
            ✓ i2v模式（minimax_h3_lightx2v_v5）：<br/>
            &nbsp;&nbsp;1. 人物参考图 = 人物管理中已生成的角色图（保证人物一致，ref_image_0必填）<br/>
            &nbsp;&nbsp;2. 支持1080P和1:1方形分辨率，最多9张参考图，时长1-10秒<br/>
            &nbsp;&nbsp;3. 不使用首帧（纯人物参考图生成）
          </div>
        </div>
      )}

      {/* t2v提示 */}
      {selectedMode === "t2v" && (
        <div style={{ marginBottom: 16, padding: "10px 14px", border: "1px solid rgba(122,92,255,0.3)", borderRadius: 8, background: "rgba(122,92,255,0.08)" }}>
          <div style={{ fontSize: 11, color: "#7A5CFF", lineHeight: 1.6 }}>
            ✓ t2v模式（minimax_h3_lightx2v_no_pic）：<br/>
            &nbsp;&nbsp;1. 纯文字描述生成，自由度最高，不需要参考图<br/>
            &nbsp;&nbsp;2. 支持480P/768P竖屏/横屏，时长1-15秒<br/>
            &nbsp;&nbsp;3. 不支持1080P分辨率
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
          const nextShot = getNextShot(sh);
          const canI2V = charImages.length > 0;
          // R2V首尾帧模式（lightx2v）：首帧和尾帧都是必填，根据用户选择的来源判断
          let firstFrameAvailable = false;
          let lastFrameAvailable = false;
          if (firstFrameSource === "shot") firstFrameAvailable = !!sh.imageUrl;
          else if (firstFrameSource === "prev_video") firstFrameAvailable = !!(prevShot && prevShot.videoUrl);
          else if (firstFrameSource === "custom") firstFrameAvailable = !!firstFrameUrl;
          if (lastFrameSource === "next_shot") lastFrameAvailable = !!(nextShot && nextShot.imageUrl);
          else if (lastFrameSource === "next_video") lastFrameAvailable = !!(nextShot && nextShot.videoUrl);
          else if (lastFrameSource === "custom") lastFrameAvailable = !!lastFrameUrl;
          const canR2V = firstFrameAvailable && lastFrameAvailable;
          return (
            <div key={sh.id} onClick={() => setSelectedShotId(sh.id)} style={{ border: selectedShotId === sh.id ? "2px solid #7A5CFF" : "1px solid var(--border)", borderRadius: 12, padding: 16, background: "var(--panel-2)", cursor: "pointer", transition: "all 0.2s" }}>
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
                  {sh.promptCn && (
                    <div style={{ marginTop: 8, padding: "8px 10px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 6 }}>
                      <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 600, marginBottom: 4 }}>✨ AI细化提示词（将用于视频生成）</div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5, maxHeight: 80, overflow: "hidden", fontStyle: "italic" }}>
                        {sh.promptCn}
                      </div>
                    </div>
                  )}
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
                      ⚠️ R2V首尾帧模式：首帧来源「{firstFrameSource === "shot" ? "本分镜分镜图" : firstFrameSource === "prev_video" ? "上个视频尾帧" : "用户手动上传"}」{firstFrameAvailable ? "✓" : "✗"}，尾帧来源「{lastFrameSource === "next_shot" ? "下一分镜分镜图" : lastFrameSource === "next_video" ? "下个视频首帧" : "用户手动上传"}」{lastFrameAvailable ? "✓" : "✗"}。请确保首帧和尾帧都有有效来源。
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  style={{ padding: "6px 12px", border: "none", borderRadius: 6, background: "linear-gradient(135deg, #7A5CFF, #5CE1E6)", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                  onClick={() => genVideo(sh)}
                  disabled={busy === sh.id}
                >
                  {busy === sh.id ? "⏳ 生成中，请耐心等待…" : `🎬 生成视频 (${currentCredits}积分)`}
                </button>
                {busy === sh.id && genProgress[sh.id] && (
                  <span style={{ fontSize: 11, color: genProgress[sh.id].status === "queued" ? "#f59e0b" : "#10b981", fontWeight: 600 }}>
                    {genProgress[sh.id].status === "queued" 
                      ? `⏳ ${genProgress[sh.id].text}，预计等待${genProgress[sh.id].queuePosition * 2}分钟`
                      : `🎬 ${genProgress[sh.id].text}`}
                  </span>
                )}
                {busy === sh.id && (!genProgress[sh.id] || !genProgress[sh.id].status) && (
                  <span style={{ fontSize: 11, color: "#f59e0b" }}>
                    ⏱️ 正在提交任务，请稍候…
                  </span>
                )}
                {busy !== sh.id && (
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    💡 高峰期生成可能较慢，请耐心等待
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                <button
                  style={{ padding: "6px 12px", border: "1px solid #10b981", borderRadius: 6, background: sh.selectedCharIds?.length > 0 ? "rgba(16,185,129,0.15)" : "transparent", color: "#10b981", cursor: "pointer", fontSize: 12 }}
                  onClick={() => setShowCharSelect(showCharSelect === sh.id ? "" : sh.id)}
                >
                  👤 选择角色 {sh.selectedCharIds?.length > 0 ? `(${sh.selectedCharIds.length})` : ""}
                </button>
                <button
                  style={{ padding: "6px 12px", border: "1px solid #f59e0b", borderRadius: 6, background: "rgba(245,158,11,0.1)", color: "#f59e0b", cursor: refiningShotId ? "wait" : "pointer", fontSize: 12 }}
                  onClick={() => refinePrompt(sh)}
                  disabled={refiningShotId !== ""}
                >
                  {refiningShotId === sh.id ? "⏳ 细化中..." : "✨ AI细化提示词"}
                </button>
                <button
                  style={{ padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 }}
                  onClick={() => {
                    setEditingShotId(sh.id);
                    setEditingPrompt(sh.promptCn || sh.sceneDesc || "");
                  }}
                >
                  ✏️ 编辑提示词
                </button>
                {sh.videoUrl && (
                  <>
                    <button
                      style={{ padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 }}
                      onClick={async () => {
                        const filename = `${sh.title || 'video'}.mp4`;
                        if (sh.videoUrl.startsWith('blob:') || sh.videoUrl.startsWith('data:')) {
                          const r = await fetch(sh.videoUrl);
                          const b = await r.blob();
                          await saveBlob(filename, b);
                        } else {
                          const success = await downloadUrl(sh.videoUrl, filename);
                          if (!success) {
                            if (confirm('直接下载失败，是否在浏览器中打开？')) {
                              window.open(sh.videoUrl, '_blank');
                            }
                          }
                        }
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
              {/* 角色选择列表 */}
              {showCharSelect === sh.id && (
                <div style={{ marginTop: 12, padding: 12, border: "1px solid #10b981", borderRadius: 8, background: "rgba(16,185,129,0.05)" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#10b981", marginBottom: 8 }}>
                    👤 选择参考角色（不选则自动匹配）
                  </div>
                  {characters.filter(c => c.image).length === 0 ? (
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>暂无角色图片，请先在「人物管理」生成角色参考图</div>
                  ) : (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {characters.filter(c => c.image).map(c => {
                        const selected = sh.selectedCharIds?.includes(c.id);
                        return (
                          <div
                            key={c.id}
                            onClick={() => toggleCharSelection(sh, c.id)}
                            style={{
                              width: 60, height: 80, borderRadius: 6, overflow: "hidden", cursor: "pointer",
                              border: selected ? "2px solid #10b981" : "2px solid transparent",
                              boxShadow: selected ? "0 0 8px rgba(16,185,129,0.5)" : "none",
                              position: "relative"
                            }}
                          >
                            <img src={c.image} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            {selected && (
                              <div style={{ position: "absolute", top: 2, right: 2, background: "#10b981", color: "#fff", borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>✓</div>
                            )}
                            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 9, padding: "2px 4px", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ marginTop: 8, fontSize: 10, color: "var(--text-muted)" }}>
                    已选择 {sh.selectedCharIds?.length || 0} 个角色 · 点击角色图片可勾选/取消
                  </div>
                </div>
              )}
              {/* 模块内编辑提示词区域 */}
              {editingShotId === sh.id && (
                <div style={{ marginTop: 12, padding: 12, border: "1px solid #7A5CFF", borderRadius: 8, background: "rgba(122,92,255,0.05)" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#7A5CFF", marginBottom: 8 }}>✏️ 编辑视频提示词</div>
                  <textarea
                    value={editingPrompt}
                    onChange={(e) => setEditingPrompt(e.target.value)}
                    style={{ width: "100%", minHeight: 100, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 12, resize: "vertical", fontFamily: "inherit" }}
                    placeholder="输入视频生成提示词..."
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
                    <button
                      style={{ padding: "6px 16px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 }}
                      onClick={() => {
                        setEditingShotId("");
                        setEditingPrompt("");
                      }}
                    >
                      取消
                    </button>
                    <button
                      style={{ padding: "6px 16px", border: "none", borderRadius: 6, background: "linear-gradient(135deg, #7A5CFF, #5CE1E6)", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                      onClick={() => {
                        update({ shots: shots.map(s => s.id === sh.id ? { ...s, promptCn: editingPrompt } : s) });
                        setEditingShotId("");
                        setEditingPrompt("");
                        log(`「${sh.title}」提示词已更新`);
                      }}
                    >
                      保存
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
