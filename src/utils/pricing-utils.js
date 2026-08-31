/**
 * 全局价格配置工具函数
 * 价格从调度机 /api/pricing 接口动态获取，存储在 window.APP_PRICING
 */

// 默认价格（当调度机接口不可用时使用）
const DEFAULT_PRICING = {
  // 图片生成
  image_generate: 3.0,
  // 配音生成（按模型+条收费）
  tts_hd_per_line: 2.5,
  tts_turbo_per_line: 1.5,
  tts_min_charge: 1.0,
  // 兼容旧字段（按字符数收费）
  tts_hd_per_100_chars: 0.25,
  tts_turbo_per_100_chars: 0.2,
  // 文字创建音色（成本9.9元=49.5积分）
  voice_design_preview_per_10k_chars: 2.0,
  voice_design_first_use: 60.0,
  voice_design_min_charge: 1.0,
  // LLM文本生成
  llm_script_analyze: 1.0,
  llm_script_quick_create: 3.0,
  llm_script_one_click: 1.0,
  llm_script_detailed: 5.0,
  llm_storyboard_split: 3.0,
  llm_character_extract: 2.0,
  llm_prompt_refine: 1.0,
  llm_episode_refine: 1.0,
  llm_shot_refine: 1.0,
  llm_scene_extract: 1.0,
  llm_subtitle_generate: 1.0,
  // 视频生成
  video_t2v_480p: 1.0,
  video_t2v_768p: 2.0,
  video_t2v_1080p: 4.0,
  video_i2v_480p: 1.0,
  video_i2v_768p: 2.0,
  video_i2v_1080p: 4.0,
  video_r2v_480p: 2.0,
  video_r2v_768p: 3.0,
  video_r2v_1080p: 5.0,
  video_ia2v_480p: 2.0,
  video_ia2v_768p: 3.0,
  video_ia2v_1080p: 5.0,
  // 3D生成
  threed_character_four_views: 8.0,
  threed_character_3d_model: 25.0,
  threed_scene_concept_image: 3.0,
  threed_scene_3d_model: 25.0,
  // 充值套餐
  credit_packages: [
    { name: "体验包", price: 6, credits: 30, bonus: 0, desc: "1:5" },
    { name: "基础包", price: 30, credits: 160, bonus: 10, desc: "1:5.3" },
    { name: "创作包", price: 98, credits: 550, bonus: 60, desc: "1:5.6" },
    { name: "工作室包", price: 298, credits: 1800, bonus: 300, desc: "1:6" },
    { name: "企业包", price: 698, credits: 4500, bonus: 1000, desc: "1:6.4" },
  ],
  // 会员套餐
  membership_packages: [
    { name: "月卡", price: 29, credits: 100, discount: 0.9, discount_label: "9折", duration_days: 30, benefits: "优先队列、去水印" },
    { name: "季卡", price: 79, credits: 350, discount: 0.85, discount_label: "85折", duration_days: 90, benefits: "月卡全部 + 高清导出" },
    { name: "年卡", price: 268, credits: 1300, discount: 0.8, discount_label: "8折", duration_days: 365, benefits: "季卡全部 + 专属模型、客服优先" },
  ],
  // 汇率
  exchange_rate: 5.0,
  new_user_bonus: 8.0,
};

/**
 * 获取全局价格配置
 * @returns {Object} 价格配置对象
 */
export function getPricing() {
  return window.APP_PRICING || DEFAULT_PRICING;
}

/**
 * 获取单个价格项
 * @param {string} key - 价格项的key
 * @param {number} defaultValue - 默认值
 * @returns {number} 价格
 */
export function getPrice(key, defaultValue = 0) {
  const pricing = getPricing();
  return pricing[key] !== undefined ? pricing[key] : defaultValue;
}

/**
 * 计算配音生成价格（按模型+条收费）
 * @param {number} lineCount - 配音条数（默认1）
 * @param {string} model - 模型类型："hd" 或 "turbo"
 * @returns {number} 价格（积分）
 */
export function calcTtsPrice(lineCount = 1, model = "hd") {
  const pricing = getPricing();
  const perLine = model === "hd" ? (pricing.tts_hd_per_line || 2.0) : (pricing.tts_turbo_per_line || 1.0);
  const price = lineCount * perLine;
  return Math.max(pricing.tts_min_charge || 1.0, price);
}

/**
 * 计算视频生成价格
 * @param {string} mode - 模式："t2v" | "i2v" | "r2v" | "ia2v"
 * @param {string} resolution - 分辨率："480p" | "768p" | "1080p"
 * @param {number} duration - 时长（秒）
 * @returns {number} 价格（积分）
 */
export function calcVideoPrice(mode, resolution, duration) {
  const pricing = getPricing();
  const resKey = resolution.includes("1080") ? "1080p" : (resolution.includes("480") ? "480p" : "768p");
  const priceKey = `video_${mode}_${resKey}`;
  const perSec = getPrice(priceKey, 2.0);
  return perSec * duration;
}

/**
 * 获取充值套餐列表
 * @returns {Array} 充值套餐列表
 */
export function getCreditPackages() {
  return getPricing().credit_packages || DEFAULT_PRICING.credit_packages;
}

/**
 * 获取会员套餐列表
 * @returns {Array} 会员套餐列表
 */
export function getMembershipPackages() {
  return getPricing().membership_packages || DEFAULT_PRICING.membership_packages;
}
