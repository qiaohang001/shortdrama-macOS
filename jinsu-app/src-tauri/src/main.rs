#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command as StdCommand;
use tauri::Manager;
use base64::Engine;

/// 桌面端：从本机 ~/.agnes/api_key 读取 Agnes Key，供前端自动注入。
#[tauri::command]
fn read_agnes_key() -> Option<String> {
    let home = std::env::var("USERPROFILE").unwrap_or_default();
    let p = std::path::Path::new(&home).join(".agnes").join("api_key");
    std::fs::read_to_string(p).ok().map(|s| s.trim().to_string())
}

#[tauri::command]
fn open_director3d(app: tauri::AppHandle) -> Result<(), String> {
    let mut cands: Vec<std::path::PathBuf> = Vec::new();
    // 安装包场景：director3d-desktop.exe 与短剧 exe 一同打包进 resource_dir（最优先、确定性强）
    if let Ok(res) = app.path().resource_dir() {
        cands.push(res.join("director3d-desktop.exe"));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            cands.push(parent.join("director3d-desktop.exe"));
            cands.push(parent.join("director3d-desktop.new.exe"));
            // 允许带时间戳后缀的最近构建产物
            if let Ok(entries) = std::fs::read_dir(parent) {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.starts_with("director3d-desktop") && name.ends_with(".exe") {
                        cands.push(entry.path());
                    }
                }
            }
        }
    }
    let home = std::env::var("USERPROFILE").unwrap_or_default();
    cands.push(std::path::PathBuf::from(&home).join("JINSU").join("director3d-desktop.exe"));
    cands.push(std::path::PathBuf::from("D:/JINSU/director3d-desktop.exe"));
    if let Ok(entries) = std::fs::read_dir("D:/JINSU") {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with("director3d-desktop") && name.ends_with(".exe") {
                cands.push(entry.path());
            }
        }
    }
    // 在所有候选里选「最新修改」的 exe 启动，避免打开旧构建产物
    let mut best: Option<(std::path::PathBuf, std::time::SystemTime)> = None;
    for p in cands {
        if p.exists() {
            let mtime = std::fs::metadata(&p).and_then(|m| m.modified()).ok();
            match (mtime, &best) {
                (Some(t), Some((_, bt))) if t <= *bt => {}
                (Some(t), _) => best = Some((p.clone(), t)),
                (None, None) => best = Some((p.clone(), std::time::UNIX_EPOCH)),
                (None, Some(_)) => {}
            }
        }
    }
    if let Some((p, _)) = best {
        let _ = StdCommand::new(&p).spawn().map_err(|e| format!("启动失败: {e}"))?;
        return Ok(());
    }
    Err("找不到 director3d-desktop.exe。请确保 3D 导演台 exe 与短剧 exe 同目录，或位于 D:/JINSU/。".into())
}

#[tauri::command]
fn save_file(dir: String, filename: String, data: String) -> Result<String, String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&data)
        .map_err(|e| format!("解码失败: {e}"))?;
    let base = if dir.is_empty() {
        let home = std::env::var("USERPROFILE").unwrap_or_default();
        std::path::PathBuf::from(home).join("Downloads")
    } else {
        std::path::PathBuf::from(dir)
    };
    let path = base.join(&filename);
    std::fs::write(&path, bytes).map_err(|e| format!("写入失败: {e}"))?;
    Ok(path.to_string_lossy().to_string())
}

/// 桌面端：把短剧素材库生成的角色/场景 3D 模型元数据写入共享目录，
/// 供 3D 导演台（独立 exe）启动后自动载入。文件位于 D:/JINSU/jinsu-shared-assets.json。
#[tauri::command]
fn save_shared_assets(contents: String) -> Result<String, String> {
    let path = std::path::PathBuf::from("D:/JINSU/jinsu-shared-assets.json");
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::write(&path, contents).map_err(|e| format!("写入共享资源失败: {e}"))?;
    Ok(path.to_string_lossy().to_string())
}

/// 解析内置 ffmpeg 二进制路径：优先 resources 目录，回退到 exe 同级目录。
fn ffmpeg_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let mut cands: Vec<std::path::PathBuf> = Vec::new();
    if let Ok(res) = app.path().resource_dir() {
        cands.push(res.join("ffmpeg.exe"));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            cands.push(parent.join("ffmpeg.exe"));
        }
    }
    for p in cands {
        if p.exists() {
            return Ok(p);
        }
    }
    Err("找不到内置 ffmpeg 二进制（ffmpeg.exe）".into())
}

/// 把前端本地录制的 webm 经内置 ffmpeg 转码为 MP4(H.264/AAC, 无音轨则 -an)，保存到用户目录。
#[tauri::command]
fn export_intro_mp4(
    app: tauri::AppHandle,
    dir: String,
    filename: String,
    data: String,
) -> Result<String, String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&data)
        .map_err(|e| format!("解码失败: {e}"))?;
    let tmp = std::env::temp_dir();
    let in_path = tmp.join("intro_in.webm");
    let out_path = tmp.join("intro_out.mp4");
    std::fs::write(&in_path, &bytes).map_err(|e| format!("写临时文件失败: {e}"))?;

    let ff = ffmpeg_path(&app)?;
    let out = StdCommand::new(&ff)
        .args([
            "-y",
            "-i",
            in_path.to_str().unwrap(),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-an",
            "-movflags",
            "+faststart",
            out_path.to_str().unwrap(),
        ])
        .output()
        .map_err(|e| format!("执行 ffmpeg 失败: {e}"))?;
    if !out.status.success() {
        return Err(format!(
            "转码失败: {}",
            String::from_utf8_lossy(&out.stderr)
        ));
    }

    let base = if dir.is_empty() {
        let home = std::env::var("USERPROFILE").unwrap_or_default();
        std::path::PathBuf::from(home).join("Downloads")
    } else {
        std::path::PathBuf::from(dir)
    };
    let out_name = if filename.to_lowercase().ends_with(".mp4") {
        filename
    } else {
        format!("{filename}.mp4")
    };
    let final_path = base.join(out_name);
    std::fs::copy(&out_path, &final_path).map_err(|e| format!("保存失败: {e}"))?;
    Ok(final_path.to_string_lossy().to_string())
}

/// 桌面端：把多段视频经内置 ffmpeg 合并为单个 MP4（H.264/AAC）。
/// inputs: 各输入视频的 base64；burn_subtitles: 是否烧录分场字幕；labels: 分场标题（用于字幕）。
/// 返回合并后 MP4 的 base64（前端再转 Blob 用于预览/落盘）。
#[tauri::command]
fn merge_videos(
    app: tauri::AppHandle,
    inputs: Vec<String>,
    burn_subtitles: bool,
    labels: Vec<String>,
) -> Result<String, String> {
    if inputs.is_empty() {
        return Err("没有可合并的视频片段。".into());
    }
    let tmp = std::env::temp_dir();
    let ff = ffmpeg_path(&app)?;

    let mut names: Vec<String> = Vec::new();
    for (i, b64) in inputs.iter().enumerate() {
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(b64)
            .map_err(|e| format!("解码片段 {i} 失败: {e}"))?;
        let p = tmp.join(format!("mv_in{i}.mp4"));
        std::fs::write(&p, &bytes).map_err(|e| format!("写片段 {i} 失败: {e}"))?;
        names.push(format!("file '{}'", p.to_str().unwrap()));
    }
    let list = tmp.join("mv_list.txt");
    std::fs::write(&list, names.join("\n")).map_err(|e| format!("写列表失败: {e}"))?;

    let out = tmp.join("mv_out.mp4");

    let mut args: Vec<String> = vec![
        "-y".into(),
        "-f".into(),
        "concat".into(),
        "-safe".into(),
        "0".into(),
        "-i".into(),
        list.to_str().unwrap().into(),
    ];

    if burn_subtitles && !labels.is_empty() {
        // 生成 SRT（每段 5s 占位），通过 subtitles 滤镜烧录。
        let dur: u64 = 5;
        let mut srt = String::new();
        let fmt = |s: u64| -> String {
            let h = s / 3600;
            let m = (s % 3600) / 60;
            let sec = s % 60;
            format!("{h:02}:{m:02}:{sec:02},000")
        };
        for (i, lb) in labels.iter().enumerate() {
            let start = (i as u64) * dur;
            let end = ((i + 1) as u64) * dur;
            srt += &format!("{}\n{} --> {}\n{}\n\n", i + 1, fmt(start), fmt(end), lb);
        }
        let sub = tmp.join("mv_sub.srt");
        std::fs::write(&sub, srt).map_err(|e| format!("写字幕失败: {e}"))?;
        args.push("-vf".into());
        args.push(format!("subtitles={}", sub.to_str().unwrap()));
        args.push("-c:v".into());
        args.push("libx264".into());
        args.push("-preset".into());
        args.push("veryfast".into());
        args.push("-c:a".into());
        args.push("aac".into());
    } else {
        // 统一重编码为 H.264/yuv420p/AAC，保证不同来源片段均可拼接（比流拷贝更稳）。
        args.push("-c:v".into());
        args.push("libx264".into());
        args.push("-preset".into());
        args.push("veryfast".into());
        args.push("-pix_fmt".into());
        args.push("yuv420p".into());
        args.push("-c:a".into());
        args.push("aac".into());
    }
    args.push(out.to_str().unwrap().into());

    let res = StdCommand::new(&ff)
        .args(&args)
        .output()
        .map_err(|e| format!("执行 ffmpeg 失败: {e}"))?;
    if !res.status.success() {
        return Err(format!(
            "合并失败: {}",
            String::from_utf8_lossy(&res.stderr)
        ));
    }
    let data = std::fs::read(&out).map_err(|e| format!("读输出失败: {e}"))?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&data))
}

// ── 增强合并：支持分割(inpoint/outpoint)、转场(fade)、逐段字幕 ──
#[derive(Clone, serde::Deserialize)]
struct ClipIn {
    data: String,
    inpoint: f64,
    outpoint: f64,
    subtitle: String,
    duration: f64,
    transition: String,
}

fn effective_duration(c: &ClipIn) -> f64 {
    if c.outpoint > c.inpoint && c.outpoint > 0.0 {
        (c.outpoint - c.inpoint).max(0.1)
    } else {
        c.duration.max(0.1)
    }
}

fn srt_ts(s: f64) -> String {
    let total_ms = (s * 1000.0).round() as i64;
    let h = total_ms / 3_600_000;
    let m = (total_ms % 3_600_000) / 60_000;
    let sec = (total_ms % 60_000) / 1000;
    let ms = total_ms % 1000;
    format!("{:02}:{:02}:{:02},{:03}", h, m, sec, ms)
}

fn build_srt(clips: &[ClipIn]) -> String {
    let mut srt = String::new();
    let mut cur = 0.0_f64;
    let mut idx = 1;
    for c in clips {
        let eff = effective_duration(c);
        let sub = c.subtitle.trim();
        if !sub.is_empty() {
            let start = cur;
            let end = (cur + eff).max(cur + 0.5);
            srt += &format!("{}\n{} --> {}\n{}\n\n", idx, srt_ts(start), srt_ts(end), sub);
            idx += 1;
        }
        cur += eff;
    }
    srt
}

#[tauri::command]
fn merge_clips(
    app: tauri::AppHandle,
    clips: Vec<ClipIn>,
    burn_subtitles: bool,
) -> Result<String, String> {
    if clips.is_empty() {
        return Err("没有可合并的视频片段。".into());
    }
    let tmp = std::env::temp_dir();
    let ff = ffmpeg_path(&app)?;

    let mut paths: Vec<std::path::PathBuf> = Vec::new();
    for (i, c) in clips.iter().enumerate() {
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(&c.data)
            .map_err(|e| format!("解码片段 {i} 失败: {e}"))?;
        let p = tmp.join(format!("mc_in{i}.mp4"));
        std::fs::write(&p, &bytes).map_err(|e| format!("写片段 {i} 失败: {e}"))?;
        paths.push(p);
    }
    let out = tmp.join("mc_out.mp4");

    let srt = if burn_subtitles { build_srt(&clips) } else { String::new() };
    let use_sub = !srt.is_empty();
    let sub_path = if use_sub {
        let sub = tmp.join("mc_sub.srt");
        std::fs::write(&sub, srt).map_err(|e| format!("写字幕失败: {e}"))?;
        Some(sub)
    } else { None };

    // 先尝试带音频；若片段无音轨（:a 不匹配）则退回纯视频（-an）。
    let attempt = |with_audio: bool| -> Result<String, String> {
        let n = clips.len();
        let t_dur = 0.4_f64;
        let mut vf = String::new();
        for (i, c) in clips.iter().enumerate() {
            let (s, e) = if c.outpoint > c.inpoint && c.outpoint > 0.0 {
                (c.inpoint, c.outpoint)
            } else {
                (0.0, c.duration.max(0.1))
            };
            let eff = (e - s).max(0.1);
            let fade_in = i > 0 && clips[i - 1].transition == "fade";
            let fade_out = c.transition == "fade" && i < n - 1;
            let mut seg = format!("[{}:v]trim=start={:.3}:end={:.3},setpts=PTS-STARTPTS", i, s, e);
            if fade_in { let t = t_dur.min(eff / 2.0); seg += &format!(",fade=t=in:st=0.000:d={:.3}", t); }
            if fade_out { let t = t_dur.min(eff / 2.0); seg += &format!(",fade=t=out:st={:.3}:d={:.3}", (eff - t).max(0.0), t); }
            seg += &format!("[v{}];", i);
            vf += &seg;
            if with_audio {
                vf += &format!("[{}:a]atrim=start={:.3}:end={:.3},asetpts=PTS-STARTPTS[a{}];", i, s, e, i);
            }
        }
        let vids: Vec<String> = (0..n).map(|i| format!("[v{i}]")).collect();
        vf += &format!("{}concat=n={}:v=1:a=0[vout];", vids.join(""), n);
        if with_audio {
            let aids: Vec<String> = (0..n).map(|i| format!("[a{i}]")).collect();
            vf += &format!("{}concat=n={}:v=0:a=1[aout];", aids.join(""), n);
        }
        if let Some(ref sp) = sub_path {
            vf += &format!("[vout]subtitles={}[vburn];", sp.to_str().unwrap());
        }
        if vf.ends_with(';') { vf.pop(); }

        let mut args: Vec<String> = vec!["-y".into()];
        for p in &paths { args.push("-i".into()); args.push(p.to_str().unwrap().into()); }
        args.push("-filter_complex".into());
        args.push(vf);
        args.push("-map".into());
        args.push(if use_sub { "[vburn]".to_string() } else { "[vout]".to_string() });
        if with_audio {
            args.push("-map".into()); args.push("[aout]".to_string());
            args.push("-c:a".into()); args.push("aac".into());
        } else {
            args.push("-an".into());
        }
        args.push("-c:v".into()); args.push("libx264".into());
        args.push("-preset".into()); args.push("veryfast".into());
        args.push("-pix_fmt".into()); args.push("yuv420p".into());
        args.push(out.to_str().unwrap().into());

        let res = StdCommand::new(&ff).args(&args).output()
            .map_err(|e| format!("执行 ffmpeg 失败: {e}"))?;
        if !res.status.success() {
            return Err(format!("合并失败: {}", String::from_utf8_lossy(&res.stderr)));
        }
        let data = std::fs::read(&out).map_err(|e| format!("读输出失败: {e}"))?;
        Ok(base64::engine::general_purpose::STANDARD.encode(&data))
    };

    match attempt(true) {
        Ok(b64) => Ok(b64),
        Err(e) => {
            if e.contains("matches no streams") || e.contains("Stream specifier") {
                attempt(false)
            } else {
                Err(e)
            }
        }
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            read_agnes_key,
            save_file,
            save_shared_assets,
            open_director3d,
            export_intro_mp4,
            merge_videos,
            merge_clips
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
