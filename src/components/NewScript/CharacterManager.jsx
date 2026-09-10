import React, { useState, useEffect } from "react";
import { api, generateImage } from "../../dispatch-jobs.js";
import { isLoggedIn, precheckCredits, deductCredits, getCreditBalance } from "../../utils/backend-api.js";
import { getPrice } from "../../utils/pricing-utils.js";

// 生图风格选项
const STYLE_OPTIONS = [
  { value: "wuxia", label: "武侠玄幻", desc: "武侠玄幻风格，东方古风美学，江湖意境，写实细腻光影" },
  { value: "cinematic", label: "电影级写实", desc: "电影级写实风格，胶片质感，专业光影，高对比度" },
  { value: "anime", label: "动漫风格", desc: "动漫风格，色彩鲜艳，表情生动，日式动画美学" },
  { value: "realistic", label: "超写实", desc: "超写实照片风格，真实皮肤质感，自然光影，极致细节" },
  { value: "noir", label: "黑色电影", desc: "黑色电影风格，黑白高反差，深邃阴影，神秘氛围" },
  { value: "cyberpunk", label: "赛博朋克", desc: "赛博朋克风格，霓虹灯光，未来都市，高科技低生活" },
  { value: "fantasy", label: "奇幻风格", desc: "奇幻风格，魔法氛围，空灵光线，梦幻意境" },
  { value: "horror", label: "恐怖风格", desc: "恐怖风格，黑暗氛围，阴森光线，悬疑惊悚" },
  { value: "comedy", label: "喜剧风格", desc: "喜剧风格，明亮色彩，欢快氛围，夸张表情" },
];

// 通用画质层（所有角色通用）
const QUALITY_LAYER = "8K超高清，专业角色设定图，电影级三点布光，柔光箱主光，轮廓光分离主体与背景，全局光照GI，环境光遮蔽AO，次表面散射SSS，锐利细节，干净背景，正交视图";

// 类型适配层（根据角色类型自动切换）
function getTypeLayer(appearance, role, name) {
  const text = (appearance + role + name).toLowerCase();
  const beastKeywords = ["兽", "妖", "怪", "龙", "虎", "狼", "狐", "鸟", "鱼", "虫", "兽首", "兽人", "妖兽", "怪物", "精", "灵", "魔"];
  const isBeast = beastKeywords.some(k => text.includes(k));
  if (isBeast) {
    return "毛发根根分明，兽类面部结构准确，瞳孔细节，爪子/蹄子/犄角细节，毛皮/鳞片纹理，生物结构合理";
  }
  return "皮肤毛孔级质感，发丝级细节，服装织物纹理，金属配饰反光，妆容精致";
}

// 通用负面提示词
const NEGATIVE_PROMPT = "模糊，低分辨率，变形，塑料感，蜡像感，过度磨皮，卡通，油画，AI感，多余肢体，结构错误，手指畸形";

// 从剧本内容识别默认风格（旧项目无 styleKey 时兜底；未识别返回空串）
export function detectStyleKey(text) {
  const st = (text || "").slice(0, 3000);
  if (/(科幻|星际|未来|机甲|赛博|末世|外太空)/.test(st)) return "cyberpunk";
  if (/(玄幻|修仙|仙侠|修真|武侠|江湖|武林|门派|侠客|剑客|古风|朝堂|帝王|将军|盟主)/.test(st)) return "wuxia";
  if (/(现代|都市|职场|校园|豪门|总裁|医院)/.test(st)) return "realistic";
  if (/(民国|军阀|旗袍|租界)/.test(st)) return "noir";
  return "";
}

// 基础提示词（不含风格描述，供剧本分析/细化/存储使用，生成图片时再注入风格）
export function buildCharacterBasePrompt(char) {
  const appearance = char.appearance || "";
  const personality = char.personality || "";
  const role = char.role || "";
  const genderHint = /(男主|先生|总裁|少爷|哥哥|弟弟|父亲|儿子|男|他)/.test(role + char.name + personality) ? "男性" :
                     /(女主|小姐|夫人|公主|姐姐|妹妹|母亲|女儿|女|她)/.test(role + char.name + personality) ? "女性" : "";
  const typeLayer = getTypeLayer(appearance, role, char.name);
  return `角色设定三视图加面部特写，${char.name}${genderHint ? "，" + genderHint : ""}，${role}，${appearance}，性格气质：${personality}。画面布局：上排并排展示同一角色三个全身视角——正面视图、侧面视图、背面视图；下排中央展示该角色上半身面部特写（胸部以上）。所有视图和特写中角色外貌完全一致：相同面部五官/头部结构、发型发色、服装款式与颜色、配饰、体型肤色，严格保持角色一致性。全身像自然站立姿势，双臂自然下垂，双脚与肩同宽。面部特写表情自然正视镜头，五官/头部细节清晰。纯白色无背景，无阴影，无环境元素，纯净角色设定图。${QUALITY_LAYER}，${typeLayer}，四个画面外貌完全统一。注意：此角色为「${char.name}」，请根据其身份「${role}」和性格「${personality}」生成独特的外貌和服装，不要与其他角色混淆。负面提示：${NEGATIVE_PROMPT}`;
}

// 完整提示词 = 基础提示词 + 风格描述（生成人物图片时使用）
export function buildCharacterPrompt(char, styleValue) {
  const styleObj = STYLE_OPTIONS.find(s => s.value === styleValue) || STYLE_OPTIONS[0];
  return `${buildCharacterBasePrompt(char)}${styleObj.desc}。`;
}

// 锁定图提示词（单张正面全身，用于视频生成时的人物锁定；特征最清晰，不用多视图布局）
export function buildCharacterLockPrompt(char) {
  const appearance = char.appearance || "";
  const personality = char.personality || "";
  const role = char.role || "";
  const existing = (char.promptCn || "").trim();
  // 复用细化提示词里的外貌描述部分（"画面布局"之前），保留完整外貌/服饰/配饰细节；
  // 去掉开头的"角色设定三视图加面部特写"等布局前缀残留，避免与单图锁定要求矛盾；
  // 若细化提示词已含"画面："段落（布局/构图描述），截断避免与锁定画面要求重复
  const descPart = (existing.split("画面布局")[0] || "")
    .trim()
    .replace(/^角色设定三视图加面部特写[，,、]?\s*/, "")
    .replace(/^角色设定图[，,、]?\s*/, "")
    .replace(/^三视图加面部特写[，,、]?\s*/, "")
    .split("画面：")[0]
    .split("画面:")[0]
    .trim() || `${char.name}，${role}，${appearance}，性格气质：${personality}`.replace(/[，,]+$/, "");
  const typeLayer = getTypeLayer(appearance, role, char.name);
  return `${descPart}。画面：一张全身照片，镜头正对人物正面，画面中只有一个人物（严禁第二个人物、严禁多视图拼图、严禁镜像倒影），全身完整入镜（头顶至脚底），自然站立，双臂自然下垂，双脚与肩同宽，面部正视镜头，表情沉稳。背景为纯白色摄影棚背景，无任何环境元素。${QUALITY_LAYER}，${typeLayer}。注意：此角色为「${char.name}」，请严格保持其外貌、服装与配饰的完整性和辨识度，不要改变或简化。负面提示：双人，多个人物，第二个人物，第三人，多人组合，多视图，三视图，多角度，拼图，并排，镜像，倒影，剪影，侧面视角，背面视角，${NEGATIVE_PROMPT}`;
}

// 生成图片时向已有提示词注入风格描述（插在"负面提示"之前；已含则不重复）
export function injectStyleDesc(p, styleDesc) {
  if (!styleDesc) return p;
  if (p && p.includes(styleDesc)) return p;
  const idx = (p || "").indexOf("负面提示");
  if (idx > -1) return p.slice(0, idx) + styleDesc + "。" + p.slice(idx);
  return p + "。" + styleDesc;
}

export function CharacterManager({ project, update, log }) {
  const characters = project.materials?.characters || [];

  // 自愈：旧版本数据修复——提示词串名（含其他角色名且不含自己）自动重建；缺失 id 自动补
  useEffect(() => {
    const chars = project.materials?.characters || [];
    if (!chars.length) return;
    const names = chars.map(c => c.name).filter(Boolean);
    const hasSelf = (prompt, nm) => !nm || (prompt && prompt.includes(nm));
    let dirty = false;
    const fixed = chars.map(ch => {
      let out = ch;
      if (!out.id) { dirty = true; out = { ...out, id: "char_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8) }; }
      if (out.appearance && out.name && new RegExp("^" + out.name + "[（(]").test(out.appearance)) { dirty = true; out = { ...out, appearance: "" }; }
      if (out.promptCn && names.some(nm => nm && nm !== out.name && out.promptCn.includes(nm)) && !hasSelf(out.promptCn, out.name)) {
        dirty = true; out = { ...out, promptCn: buildCharacterBasePrompt(out) };
      }
      return out;
    });
    // 风格兜底：旧项目无 styleKey 时按剧本内容自动识别
    if (!project.styleKey) {
      const sk = detectStyleKey(project.script || project.outline?.synopsis || "");
      if (sk && STYLE_OPTIONS.some(s => s.value === sk)) {
        try { update({ styleKey: sk }); } catch (e) {}
        setSelectedStyle(sk);
      }
    }
    if (dirty) {
      try { update({ materials: { ...project.materials, characters: fixed } }); } catch (e) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [generatingCharIds, setGeneratingCharIds] = useState({}); // {charId: true} 支持多个人物同时生成
  const [refiningCharId, setRefiningCharId] = useState(""); // 正在细化提示词的角色
  const [previewImage, setPreviewImage] = useState(null);
  const [selectedStyle, setSelectedStyle] = useState(() => {
    const k = project.styleKey;
    if (STYLE_OPTIONS.some(s => s.value === k)) return k;
    return detectStyleKey(project.script || project.outline?.synopsis || "") || STYLE_OPTIONS[0].value;
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [newChar, setNewChar] = useState({ name: "", role: "", personality: "", appearance: "" });

  // 从剧本中自动提取人物
  const analyzeCharacters = async () => {
    const script = project.script || "";
    const outline = project.outline?.synopsis || "";
    
    if (!script && !outline) {
      log("请先上传或创作剧本");
      return;
    }

    // 未登录用户不能使用
    if (!isLoggedIn()) {
      alert("请先登录后再使用角色提取功能");
      return;
    }

    // 积分预校验（角色描述生成价格从调度机获取）
    const charExtractPrice = getPrice("llm_character_extract", 2.0);
    try {
      const precheck = await precheckCredits(charExtractPrice, "text", "角色描述生成");
      if (!precheck.sufficient && precheck.sufficient !== undefined) {
        log(`❌ 积分不足：需要${charExtractPrice}积分，当前余额${precheck.balance || 0}积分`);
        alert(`积分不足！自动提取角色需要${charExtractPrice}积分，当前余额${precheck.balance || 0}积分。请充值后再试。`);
        return;
      }
    } catch (e) {
      log(`⚠️ 积分预校验失败：${e.message}`);
    }

    log("正在分析剧本提取人物...");
    try {
      const content = script || outline;
      const prompt = `你是一名短剧角色分析师。请从以下剧本内容中提取所有人物信息。

要求：
1. 提取所有有台词或重要动作的角色
2. 外貌描述要具体详细（年龄/性别/发型/脸型/五官/服装/体型/配饰），便于AI生图保持人物一致性
3. 性格用3-5个关键词概括
4. 只输出纯JSON，不要markdown代码块，不要解释

剧本内容：
${content.slice(0, 5000)}

输出JSON格式：
{
  "characters": [
    {
      "name": "角色姓名",
      "role": "身份/职业（如主角/反派/配角）",
      "personality": "性格特点（3-5个关键词，如高冷/腹黑/善良）",
      "appearance": "外貌描述（年龄/发型/脸型/五官/上衣/下装/鞋履/配饰/体型/表情神态，80-150字，要具体到能直接出图）"
    }
  ]
}`;

      const res = await api("/api/llm/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          llm_type: "character_extract"
        })
      });

      const text = res.text || "{}";
      let parsed;
      try {
        const match = text.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : { characters: [] };
      } catch {
        parsed = { characters: [] };
      }

      const newCharacters = (parsed.characters || []).map((c, i) => {
        const char = {
          id: `char_${Date.now()}_${i}`,
          name: c.name || `角色${i + 1}`,
          role: c.role || "",
          personality: c.personality || "",
          appearance: c.appearance || "",
          image: null,
          locked: false
        };
        // 剧本分析完立即生成提示词（基础版，不含风格描述），用户可在生成前修改；生成图片时再按所选风格注入
        char.promptCn = buildCharacterBasePrompt(char);
        return char;
      });

      // 合并现有角色和新提取的角色
      const existingNames = new Set(characters.map(c => c.name));
      const uniqueNewChars = newCharacters.filter(c => !existingNames.has(c.name));
      
      const allCharacters = [...uniqueNewChars, ...characters];
      
      update({
        materials: { ...project.materials, characters: allCharacters },
        outline: { ...project.outline, characters: allCharacters }
      });

      log(`成功提取 ${uniqueNewChars.length} 个人物，共 ${allCharacters.length} 人`);
      // 积分扣减（角色描述生成2积分/次）
      if (isLoggedIn()) {
        try {
                    log(`✅ 积分扣减成功：2积分`);
          try {
            const balanceData = await getCreditBalance();
            if (window.onCreditUpdate) window.onCreditUpdate(balanceData.balance || balanceData.credits || 0);
            if (window.refreshUserInfo) window.refreshUserInfo();
          } catch (e) {}
        } catch (e) {
          log(`⚠️ 积分扣减失败：${e.message}`);
        }
      }
    } catch (err) {
      log("提取人物失败：" + err.message);
    }
  };

  // AI细化人物提示词（整体穿着/面容细节/头发细节等）
  const refineCharacterPrompt = async (char) => {
    if (refiningCharId) return;
    if (!isLoggedIn()) { alert("请先登录后再使用提示词细化"); return; }
    const price = getPrice("llm_character_refine", 1.0);
    try {
      const precheck = await precheckCredits(price, "text", `细化人物提示词：${char.name}`);
      if (!precheck.sufficient && precheck.sufficient !== undefined) {
        log(`❌ 积分不足：需要${price}积分，当前余额${precheck.balance || 0}积分`);
        alert(`积分不足！提示词细化需要${price}积分，当前余额${precheck.balance || 0}积分。请充值后再试。`);
        return;
      }
    } catch (e) {
      log(`⚠️ 积分预校验失败：${e.message}`);
    }
    setRefiningCharId(char.id);
    log(`正在细化「${char.name}」人物提示词...`);
    try {
      const current = (char.promptCn || buildCharacterBasePrompt(char)).trim();
      const prompt = `你是专业的AI生图提示词工程师。请细化以下角色设定图的生图提示词，使其更精致、细节更丰富，可直接用于AI生图。
细化方向（必须逐项加强细节）：
1. 整体穿着：服装款式、颜色、面料材质、纹理纹样、层次搭配、腰带/玉佩/披风/护腕等配饰；
2. 面容细节：脸型、眉眼、鼻梁、嘴唇、肤色肤质、五官比例、神情气质；
3. 头发细节：发型、发长、发色、刘海/发髻/发冠/发饰；
4. 体型与随身道具。
要求：
1. 布局唯一：严格沿用原提示词开头指定的画面布局（如"角色设定三视图加面部特写"或"画面：一张全身照片"），全篇只保留这一种布局描述；若原提示词同时混入了其他视图/构图描述（多视图、拼图、镜像、侧面背面视角、多角度、全身照与三视图并存等），一律删除，只保留开头指定的那一种布局；
2. 负面提示与布局一致：三视图+面部特写布局时，负面提示不得包含"严禁多视图/多视图拼图/单张全身照"等与布局冲突的禁词；单张全身照布局时，负面提示应保留"严禁多视图、拼图、镜像、侧面背面视角"等禁词。
3. 不要包含任何风格/画风描述（如动漫、写实、武侠、奇幻等），风格由生成时统一注入；
4. 150-260字；
5. 只输出细化后的完整提示词本身，不要解释、不要markdown代码块。

角色：${char.name}（${char.role || "未知身份"}）
当前提示词：${current}`;
      const res = await api("/api/llm/chat", {
        method: "POST",
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }], max_tokens: 8192 }),
      });
      const text = (res.text || "").trim();
      if (!text) throw new Error("LLM未返回内容");
      update(prev => {
        const allChars = prev.materials?.characters || [];
        const newChars = allChars.map(x => x.id === char.id ? { ...x, promptCn: text } : x);
        return { materials: { ...prev.materials, characters: newChars } };
      });
      log(`✅ 「${char.name}」提示词已细化（${text.length}字符）`);
      try {
        const balanceData = await getCreditBalance();
        if (window.onCreditUpdate) window.onCreditUpdate(balanceData.balance || balanceData.credits || 0);
        if (window.refreshUserInfo) window.refreshUserInfo();
      } catch (e) {}
    } catch (err) {
      log(`❌ 提示词细化失败：${err.message}`);
    } finally {
      setRefiningCharId("");
    }
  };

  // AI根据人物描述生成参考图
  const generateCharacterImage = async (char) => {
    if (generatingCharIds[char.id]) return; // 该人物正在生成中，忽略重复点击
    setGeneratingCharIds(prev => ({ ...prev, [char.id]: true }));
    // 未登录用户不能使用
    if (!isLoggedIn()) {
      alert("请先登录后再使用角色生图功能");
      setGeneratingCharIds(prev => { const next = {...prev}; delete next[char.id]; return next; });
      return;
    }
    // 积分预校验（角色生图价格从调度机获取）
    const charImagePrice = getPrice("image_generate", 3.0);
    try {
      const precheck = await precheckCredits(charImagePrice, "image", `角色生图：${char.name}`);
      if (!precheck.sufficient && precheck.sufficient !== undefined) {
        log(`❌ 积分不足：需要${charImagePrice}积分，当前余额${precheck.balance || 0}积分`);
        alert(`积分不足！生成角色参考图需要${charImagePrice}积分，当前余额${precheck.balance || 0}积分。请充值后再试。`);
        setGeneratingCharIds(prev => { const next = {...prev}; delete next[char.id]; return next; });
        return;
      }
    } catch (e) {
      log(`⚠️ 积分预校验失败：${e.message}`);
    }
    log(`正在为「${char.name}」生成人物参考图...`);
    try {
      const styleObj = STYLE_OPTIONS.find(s => s.value === selectedStyle) || STYLE_OPTIONS[0];
      // 锁定图 = 单张正面全身（复用细化提示词的外貌描述 + 正面全身布局），视频生成时用这张做人物锁定
      const basePrompt = buildCharacterLockPrompt(char);
      // 生成时注入所选风格描述
      const prompt = injectStyleDesc(basePrompt, styleObj.desc);
      const res = await generateImage({ prompt, model: "Qwen/Qwen-Image", size: "1328x1328", n: 1 });
      const imageUrl = res.image_url || res.url || (res.images && res.images[0]) || res.result_url;
      if (!imageUrl) throw new Error("未返回图片地址");
      // 使用函数式更新，确保使用最新的状态，并使用ID匹配人物
      console.log("[人物生成] 更新图片，char.id=", char.id, "imageUrl=", imageUrl.substring(0, 50));
      update(prev => {
        const allChars = prev.materials?.characters || [];
        console.log("[人物生成] 当前人物列表:", allChars.map(c => ({id: c.id, name: c.name, hasImage: !!c.image})));
        const newChars = allChars.map(x => {
          const matched = (x.id && char.id) ? (x.id === char.id) : (x.name === char.name);
          if (matched) {
            console.log("[人物生成] 匹配到人物:", x.name, "，更新图片");
            return { ...x, image: imageUrl, promptCn: basePrompt };
          }
          return x;
        });
        return { materials: { ...prev.materials, characters: newChars } };
      });
      // 同时存入素材库（所有生成的角色图片都保存，不覆盖）
      try {
        const currentAssets = project?.assets || [];
        const newImageAsset = {
          id: "a_char_image_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8),
          type: "image",
          title: `${char.name}角色锁定图（${styleObj.label}，${new Date().toLocaleString('zh-CN', {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'})}）`,
          url: imageUrl,
          status: "ready",
          tags: ["角色锁定图", "角色生图", styleObj.label, char.name],
          favorite: false,
          characterId: char.id,
          characterName: char.name,
          style: selectedStyle,
          createdAt: Date.now()
        };
        update({ assets: [newImageAsset, ...currentAssets] });
        log(`✅ 角色图已存入素材库：${newImageAsset.title}`);
      } catch (e) {
        log(`⚠️ 角色图存入素材库失败：${e.message}`);
      }
      log(`「${char.name}」参考图生成成功`);
      // 积分扣减（角色生图价格从调度机获取）
      if (isLoggedIn()) {
        try {
                    log(`✅ 积分扣减成功：${charImagePrice}积分`);
          try {
            const balanceData = await getCreditBalance();
            if (window.onCreditUpdate) window.onCreditUpdate(balanceData.balance || balanceData.credits || 0);
            if (window.refreshUserInfo) window.refreshUserInfo();
          } catch (e) {}
        } catch (e) {
          log(`⚠️ 积分扣减失败：${e.message}`);
        }
      }
    } catch (err) {
      log(`生成失败：${err.message}`);
    } finally {
      setGeneratingCharIds(prev => { const next = {...prev}; delete next[char.id]; return next; });
    }
  };

  // 生成三视图+面部特写展示图（可选，另计费，用于人物卡/素材展示；不参与视频锁定）
  const generateCharacterSheet = async (char) => {
    if (generatingCharIds[char.id]) return;
    if (!isLoggedIn()) { alert("请先登录后再使用人物生图功能"); return; }
    const sheetPrice = getPrice("image_generate", 3.0);
    try {
      const precheck = await precheckCredits(sheetPrice, "image", `三视图展示图：${char.name}`);
      if (!precheck.sufficient && precheck.sufficient !== undefined) {
        log(`❌ 积分不足：需要${sheetPrice}积分，当前余额${precheck.balance || 0}积分`);
        alert(`积分不足！生成三视图展示图需要${sheetPrice}积分，当前余额${precheck.balance || 0}积分。请充值后再试。`);
        return;
      }
    } catch (e) {
      log(`⚠️ 积分预校验失败：${e.message}`);
    }
    setGeneratingCharIds(prev => ({ ...prev, [char.id]: true }));
    log(`正在为「${char.name}」生成三视图展示图...`);
    try {
      const styleObj = STYLE_OPTIONS.find(s => s.value === selectedStyle) || STYLE_OPTIONS[0];
      // 三视图展示图 = 四宫格布局（正/侧/背全身 + 面部特写），供人物卡/素材展示
      const basePrompt = (char.promptCn && char.promptCn.trim().length > 0) ? char.promptCn.trim() : buildCharacterBasePrompt(char);
      const prompt = injectStyleDesc(basePrompt, styleObj.desc);
      const res = await generateImage({ prompt, model: "Qwen/Qwen-Image", size: "1328x1328", n: 1 });
      const imageUrl = res.image_url || res.url || (res.images && res.images[0]) || res.result_url;
      if (!imageUrl) throw new Error("未返回图片地址");
      update(prev => {
        const allChars = prev.materials?.characters || [];
        const newChars = allChars.map(x => {
          const matched = (x.id && char.id) ? (x.id === char.id) : (x.name === char.name);
          if (matched) return { ...x, sheetImage: imageUrl };
          return x;
        });
        return { materials: { ...prev.materials, characters: newChars } };
      });
      try {
        const currentAssets = project?.assets || [];
        const newImageAsset = {
          id: "a_char_sheet_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8),
          type: "image",
          title: `${char.name}三视图展示图（${styleObj.label}，${new Date().toLocaleString('zh-CN', {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'})}）`,
          url: imageUrl,
          status: "ready",
          tags: ["三视图展示图", "角色生图", styleObj.label, char.name],
          favorite: false,
          characterId: char.id,
          characterName: char.name,
          style: selectedStyle,
          createdAt: Date.now()
        };
        update({ assets: [newImageAsset, ...currentAssets] });
        log(`✅ 三视图展示图已存入素材库：${newImageAsset.title}`);
      } catch (e) {
        log(`⚠️ 三视图展示图存入素材库失败：${e.message}`);
      }
      if (isLoggedIn()) {
        try {
          log(`✅ 积分扣减成功：${sheetPrice}积分`);
          try {
            const balanceData = await getCreditBalance();
            if (window.onCreditUpdate) window.onCreditUpdate(balanceData.balance || balanceData.credits || 0);
            if (window.refreshUserInfo) window.refreshUserInfo();
          } catch (e) {}
        } catch (e) {
          log(`⚠️ 积分扣减失败：${e.message}`);
        }
      }
      log(`✅ 「${char.name}」三视图展示图生成成功`);
    } catch (err) {
      log(`生成失败：${err.message}`);
    } finally {
      setGeneratingCharIds(prev => { const next = {...prev}; delete next[char.id]; return next; });
    }
  };

  return (
    <div style={{ padding: 16, height: "100%", overflow: "auto", color: "var(--text)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>👤 人物管理</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={selectedStyle}
            onChange={(e) => setSelectedStyle(e.target.value)}
            style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 13, cursor: "pointer" }}
            title="选择生图风格"
          >
            {STYLE_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <button 
            style={{ padding: "8px 16px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 13 }}
            onClick={analyzeCharacters}
          >
            🤖 AI分析人物（2积分）
          </button>
          <button 
            style={{ padding: "8px 16px", border: "none", borderRadius: 6, background: "linear-gradient(135deg, #7A5CFF, #5CE1E6)", color: "#fff", cursor: "pointer", fontSize: 13 }}
            onClick={() => {
              setNewChar({ name: "", role: "", personality: "", appearance: "" });
              setShowAddModal(true);
            }}
          >
            + 新增角色
          </button>
        </div>
      </div>
      
      {characters.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", border: "1px dashed var(--border)", borderRadius: 12 }}>
          暂无角色，点击「AI分析人物」或「新增角色」添加
        </div>
      )}
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
        {characters.map(c => (
          <div key={c.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--panel-2)" }}>
            <div style={{ width: "100%", height: 160, background: "var(--input-bg)", borderRadius: 8, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, position: "relative" }}>
              {c.image ? <img src={c.image} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8, cursor: "zoom-in" }} onClick={() => setPreviewImage(c.image)} /> : "👤"}
              {c.sheetImage && (
                <button
                  style={{ position: "absolute", right: 4, top: 4, padding: "2px 7px", fontSize: 10, border: "1px solid rgba(255,255,255,0.4)", borderRadius: 4, background: "rgba(0,0,0,0.6)", color: "#fff", cursor: "pointer", zIndex: 2 }}
                  onClick={(e) => { e.stopPropagation(); setPreviewImage(c.sheetImage); }}
                >
                  🖼 三视图
                </button>
              )}
            </div>
            <div style={{ fontWeight: 600 }}>{c.name}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{c.role || "未设定"}</div>
            {c.personality && <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>性格：{c.personality}</div>}
            <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 6, marginBottom: 2 }}>🎨 生成提示词（可编辑）</div>
            <textarea
              style={{ width: "100%", minHeight: 80, fontSize: 10, boxSizing: "border-box", resize: "vertical", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", padding: 6 }}
              value={c.promptCn || ""}
              onChange={(e) => update(prev => {
                const allChars = prev.materials?.characters || [];
                return { materials: { ...prev.materials, characters: allChars.map(x => x.id === c.id ? { ...x, promptCn: e.target.value } : x) } };
              })}
              placeholder="提示词已自动生成，可修改后点击生成"
            />
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <button
                style={{ flex: 1, minWidth: "45%", padding: "4px 0", border: generatingCharIds[c.id] ? "1px solid #f59e0b" : "1px solid #7A5CFF", borderRadius: 4, background: generatingCharIds[c.id] ? "rgba(245,158,11,0.15)" : "rgba(122,92,255,0.15)", color: generatingCharIds[c.id] ? "#f59e0b" : "#7A5CFF", fontSize: 11, cursor: generatingCharIds[c.id] ? "wait" : "pointer" }}
                onClick={() => generateCharacterImage(c)}
                disabled={generatingCharIds[c.id]}
                title="生成正面全身锁定图，用于视频生成时锁定人物"
              >
                {generatingCharIds[c.id] ? "⏳ 生成中..." : `🤖 锁定图（${getPrice("image_generate", 3.0)}积分）`}
              </button>
              <button
                style={{ flex: 1, minWidth: "45%", padding: "4px 0", border: "1px solid var(--border)", borderRadius: 4, background: "transparent", color: "var(--text)", fontSize: 11, cursor: generatingCharIds[c.id] ? "wait" : "pointer" }}
                onClick={() => generateCharacterSheet(c)}
                disabled={generatingCharIds[c.id]}
                title="生成三视图+面部特写展示图（可选，另计费，用于人物卡展示）"
              >
                {generatingCharIds[c.id] ? "⏳ 生成中..." : `🖼 三视图（${getPrice("image_generate", 3.0)}积分）`}
              </button>
              <button
                style={{ flex: 1, minWidth: "45%", padding: "4px 0", border: "1px solid var(--border)", borderRadius: 4, background: "transparent", color: "var(--text)", fontSize: 11, cursor: "pointer" }}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*";
                  input.onchange = (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const img = ev.target.result;
                      // 使用函数式更新，确保使用最新的状态，并使用ID匹配人物
                      update(prev => {
                        const allChars = prev.materials?.characters || [];
                        const newChars = allChars.map(x => 
                          x.id === c.id ? { ...x, image: img } : x
                        );
                        return { materials: { ...prev.materials, characters: newChars } };
                      });
                      log(`已上传角色 ${c.name} 的参考图`);
                    };
                    reader.readAsDataURL(file);
                  };
                  input.click();
                }}
              >
                📷 上传图片
              </button>
              <button
                style={{ flex: 1, padding: "4px 0", border: "1px solid var(--border)", borderRadius: 4, background: refiningCharId === c.id ? "rgba(122,92,255,0.3)" : "transparent", color: refiningCharId === c.id ? "#7A5CFF" : "var(--text)", fontSize: 11, cursor: "pointer" }}
                onClick={() => refineCharacterPrompt(c)}
                disabled={!!refiningCharId}
              >
                ✨ 细化提示词
              </button>
              <button
                style={{ flex: 1, padding: "4px 0", border: "1px solid var(--border)", borderRadius: 4, background: c.locked ? "rgba(122,92,255,0.3)" : "transparent", color: c.locked ? "#7A5CFF" : "var(--text)", fontSize: 11, cursor: "pointer" }} 
                onClick={() => {
                  update({ materials: { ...project.materials, characters: characters.map(x => x.id === c.id ? { ...x, locked: !x.locked } : x) } });
                  log(c.locked ? "已解锁角色" : "已锁定角色形象");
                }}
              >
                {c.locked ? "已锁定" : "锁定"}
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {/* 图片放大预览模态框 */}
      {previewImage && (
        <div 
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999, cursor: "zoom-out" }}
          onClick={() => setPreviewImage(null)}
        >
          <img src={previewImage} alt="预览大图" style={{ maxWidth: "92%", maxHeight: "92%", objectFit: "contain", borderRadius: 8 }} />
          <div style={{ position: "absolute", top: 20, right: 20, color: "#fff", fontSize: 14, background: "rgba(0,0,0,0.5)", padding: "6px 12px", borderRadius: 6 }}>点击任意处关闭</div>
        </div>
      )}

      {/* 新增角色表单弹窗 */}
      {showAddModal && (
        <div 
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99998 }}
          onClick={() => setShowAddModal(false)}
        >
          <div 
            style={{ width: 480, maxWidth: "92vw", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>➕ 新增角色</h3>
            
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>角色姓名 *</label>
              <input 
                style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 13, boxSizing: "border-box" }}
                value={newChar.name}
                onChange={e => setNewChar(f => ({ ...f, name: e.target.value }))}
                placeholder="如：林晚、沈砚"
                autoFocus
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>角色身份/定位</label>
              <input 
                style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 13, boxSizing: "border-box" }}
                value={newChar.role}
                onChange={e => setNewChar(f => ({ ...f, role: e.target.value }))}
                placeholder="如：主角、反派、女配、龙套"
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>性格特点</label>
              <input 
                style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 13, boxSizing: "border-box" }}
                value={newChar.personality}
                onChange={e => setNewChar(f => ({ ...f, personality: e.target.value }))}
                placeholder="如：坚韧果敢、阴险狡诈、温柔善良"
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>外貌描述（用于AI生图提示词）</label>
              <textarea 
                style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--input-bg)", color: "var(--text)", fontSize: 13, boxSizing: "border-box", minHeight: 80, resize: "vertical" }}
                value={newChar.appearance}
                onChange={e => setNewChar(f => ({ ...f, appearance: e.target.value }))}
                placeholder="如：25岁女性，黑色长发，冷白皮，穿红色风衣，眼神坚定，身材高挑..."
              />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button 
                style={{ padding: "8px 16px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 13 }}
                onClick={() => setShowAddModal(false)}
              >
                取消
              </button>
              <button 
                style={{ padding: "8px 16px", border: "none", borderRadius: 6, background: "linear-gradient(135deg, #7A5CFF, #5CE1E6)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                onClick={() => {
                  if (!newChar.name.trim()) {
                    alert("请输入角色姓名");
                    return;
                  }
                  const c = { 
                    id: "char_" + Date.now(), 
                    name: newChar.name.trim(), 
                    role: newChar.role.trim(), 
                    personality: newChar.personality.trim(), 
                    appearance: newChar.appearance.trim(), 
                    image: null, 
                    locked: false 
                  };
                  c.promptCn = buildCharacterBasePrompt(c);
                  update({ materials: { ...project.materials, characters: [c, ...characters] } });
                  log("新增角色：" + c.name);
                  setShowAddModal(false);
                }}
              >
                确认添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
