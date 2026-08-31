// 统一视频合并：桌面端走内置 ffmpeg.exe（离线可用、无需 CDN），
// Web 端降级走 ffmpeg.wasm（需联网加载内核）。两个分支都返回合并后 MP4 的 base64 字符串，
// 调用方统一用 b64ToBlob 转成 Blob 做预览或落盘，避免“两条 ffmpeg 路径”行为不一致。

import { invoke } from "@tauri-apps/api/core";
import { isTauri, blobToBase64 } from "@dual/ui";
import { concatVideos } from "./ffmpeg.js";

async function urlToBase64(url) {
  const r = await fetch(url);
  const blob = await r.blob();
  return await blobToBase64(blob);
}

/**
 * 合并多段视频为单个 MP4。
 * @param {string[]} urls 各视频地址（blob: 或 http(s):）
 * @param {{burnSubtitles?: boolean, labels?: string[]}} [opts]
 * @returns {Promise<string>} 合并后 MP4 的 base64
 */
export async function mergeVideos(urls, { burnSubtitles = false, labels = [] } = {}) {
  if (!urls || !urls.length) throw new Error("没有可合并的视频片段。");

  if (isTauri()) {
    const inputs = [];
    for (const u of urls) {
      try {
        inputs.push(await urlToBase64(u));
      } catch (e) {
        throw new Error(`视频获取失败：${u}（可能离线或跨域）`);
      }
    }
    return await invoke("merge_videos", { inputs, burnSubtitles, labels });
  }

  // Web 端：ffmpeg.wasm 合并，返回 Blob 后统一转 base64。
  const blob = await concatVideos(urls, { burnSubtitles, labels, returnBlob: true });
  return await blobToBase64(blob);
}

/**
 * 增强合并：支持分割(inpoint/outpoint)、转场(transition)、逐段字幕(subtitle)。
 * @param {Array<{url:string,inpoint:number,outpoint:number,subtitle:string,duration:number,transition:string}>} clips
 * @param {{burnSubtitles?: boolean}} [opts]
 * @returns {Promise<string>} 合并后 MP4 的 base64
 */
export async function mergeClips(clips, { burnSubtitles = true } = {}) {
  if (!clips || !clips.length) throw new Error("没有可合并的视频片段。");

  if (isTauri()) {
    const inputs = [];
    for (const c of clips) {
      try {
        inputs.push(await urlToBase64(c.url));
      } catch (e) {
        throw new Error(`视频获取失败：${c.url}（可能离线或跨域）`);
      }
    }
    const spec = clips.map((c, i) => ({
      data: inputs[i],
      inpoint: c.inpoint || 0,
      outpoint: c.outpoint || 0,
      subtitle: c.subtitle || "",
      duration: c.duration || 0,
      transition: c.transition || "none",
    }));
    return await invoke("merge_clips", { clips: spec, burnSubtitles });
  }

  // Web 端：退化为顺序拼接 + 字幕烧录（不支撑分割/转场）。
  return await mergeVideos(clips.map((c) => c.url), { burnSubtitles, labels: clips.map((c) => c.subtitle || "") });
}
