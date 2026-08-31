#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command as StdCommand;
use tauri::Manager;
use base64::Engine;

#[tauri::command]
fn read_zhipu_key() -> Option<String> {
    let home = std::env::var("USERPROFILE").unwrap_or_default();
    let p = std::path::Path::new(&home).join(".dualstudio").join("glm_key");
    std::fs::read_to_string(p).ok().map(|s| s.trim().to_string())
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
/// Windows 使用 ffmpeg.exe，macOS/Linux 使用 ffmpeg。
fn ffmpeg_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    #[cfg(target_os = "windows")]
    let bin = "ffmpeg.exe";
    #[cfg(not(target_os = "windows"))]
    let bin = "ffmpeg";
    let mut cands: Vec<std::path::PathBuf> = Vec::new();
    if let Ok(res) = app.path().resource_dir() {
        cands.push(res.join(bin));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            cands.push(parent.join(bin));
        }
    }
    for p in cands {
        if p.exists() {
            return Ok(p);
        }
    }
    Err(format!("找不到内置 ffmpeg 二进制（{bin}）"))
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
        if let Some(ref _sp) = sub_path {
            // 用相对文件名 + cwd=tmp（见下方 current_dir），
            // 直接拼绝对路径会把 "C:\..." 的冒号当成滤镜参数分隔符，Windows 上必然报错。
            vf += "[vout]subtitles=mc_sub.srt[vburn];";
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

        let res = StdCommand::new(&ff)
            .current_dir(&tmp)
            .args(&args)
            .output()
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

// ══ 时间线导出：视频轨（变速/调色/音量/转场）+ 音频轨（变速/音量/起始位置）+ 文本烧录 ══
// 前端 EditExport 原先调 merge_videos，但其签名是 (inputs, burn_subtitles, labels)，
// 与前端传的 (shots, width, height, fps...) 完全不匹配，导出必然失败；
// 且音频轨 / 文本轨从未传给后端。这里提供专用命令。

fn decode_b64(b64: &str, idx: usize) -> Result<Vec<u8>, String> {
    base64::engine::general_purpose::STANDARD
        .decode(b64)
        .map_err(|e| format!("解码素材 {} 失败: {}", idx, e))
}

/// atempo 单级只支持 0.5~2.0，超出范围时串联多级（如 4x = atempo=2.0,atempo=2.0）
fn atempo_chain(speed: f64) -> String {
    let mut s = if speed > 0.0 { speed } else { 1.0 };
    let mut parts: Vec<String> = Vec::new();
    while s > 2.0 {
        parts.push("atempo=2.0".into());
        s /= 2.0;
    }
    while s < 0.5 {
        parts.push("atempo=0.5".into());
        s *= 2.0;
    }
    parts.push(format!("atempo={:.4}", s));
    parts.join(",")
}

fn def_speed() -> f64 { 1.0 }
fn def_hundred() -> f64 { 100.0 }

#[derive(Clone, serde::Deserialize)]
struct TlVideoClip {
    #[serde(default)] data: String,
    #[serde(default)] start: f64,
    #[serde(default)] duration: f64,
    #[serde(default = "def_speed")] speed: f64,
    #[serde(default = "def_speed")] volume: f64,
    #[serde(default)] transition: String,
    #[serde(default = "def_hundred")] brightness: f64,
    #[serde(default = "def_hundred")] contrast: f64,
    #[serde(default = "def_hundred")] saturation: f64,
}

#[derive(Clone, serde::Deserialize)]
struct TlAudioClip {
    #[serde(default)] data: String,
    #[serde(default)] start: f64,
    #[serde(default)] duration: f64,
    #[serde(default = "def_speed")] speed: f64,
    #[serde(default = "def_speed")] volume: f64,
}

#[derive(Clone, serde::Deserialize)]
struct TlTextClip {
    #[serde(default)] start: f64,
    #[serde(default)] duration: f64,
    #[serde(default)] text: String,
}

/// 视频轨：纯色背景画布 + 逐段按时间线位置 overlay（变速/调色/淡入转场/字幕烧录）
fn build_video_filter(
    clips: &[TlVideoClip],
    use_sub: bool,
    w: u32,
    h: u32,
    fpsv: u32,
    bg: &str,
    total: f64,
) -> (String, String) {
    let mut vf = format!("color=c={}:s={}x{}:d={:.3}:r={}[bg];", bg, w, h, total, fpsv);
    let mut cur = "bg".to_string();

    for (i, c) in clips.iter().enumerate() {
        let speed = if c.speed > 0.0 { c.speed } else { 1.0 };
        let src = (c.duration.max(0.1) * speed).max(0.1);

        let mut seg = format!(
            "[{}:v]trim=start=0:end={:.3},setpts=(PTS-STARTPTS)/{:.4},\
scale={}:{}:force_original_aspect_ratio=decrease,\
pad={}:{}:(ow-iw)/2:(oh-ih)/2:color={},setsar=1,fps={}",
            i, src, speed, w, h, w, h, bg, fpsv
        );

        // 调色（前端以 100 为基准：brightness 100→0，contrast/saturation 100→1）
        let bright = (c.brightness - 100.0) / 100.0;
        let contra = c.contrast / 100.0;
        let satur = c.saturation / 100.0;
        if bright.abs() > 0.001 || (contra - 1.0).abs() > 0.001 || (satur - 1.0).abs() > 0.001 {
            seg += &format!(
                ",eq=brightness={:.3}:contrast={:.3}:saturation={:.3}",
                bright, contra, satur
            );
        }

        // 转场：与上一段之间做淡入
        if i > 0 && clips[i - 1].transition == "fade" {
            let d = 0.4_f64.min(c.duration.max(0.1) / 2.0);
            seg += &format!(",fade=t=in:st=0:d={:.3}", d);
        }
        seg += &format!("[v{}];", i);
        vf += &seg;

        let st = c.start.max(0.0);
        let en = (c.start + c.duration.max(0.1)).max(st + 0.05);
        let next = format!("o{}", i);
        vf += &format!(
            "[{}][v{}]overlay=0:0:enable='between(t,{:.3},{:.3})'[{}];",
            cur, i, st, en, next
        );
        cur = next;
    }

    let video_map = if use_sub {
        // 必须显式带上一段输出的 label；否则 filter_complex 会把 subtitles 挂到
        // 第一个未使用的输入流上，画面和字幕对不上且大概率报错。
        vf += &format!("[{}]subtitles=et_sub.srt[vburn];", cur);
        "[vburn]".to_string()
    } else {
        format!("[{}]", cur)
    };
    (vf, video_map)
}

/// 音频轨：视频原音 + 音频轨，各自变速(atempo)/音量/延迟后混流。
/// 不用 amix：内置 ffmpeg 4.1 的 amix 会按输入数归一化，把每路音量除以 N。
/// 改用 amerge + pan 下混求和 = 线性叠加，且不受 ffmpeg 版本影响。
fn build_audio_filter(
    clips: &[TlVideoClip],
    audios: &[TlAudioClip],
    with_src_audio: bool,
) -> (Vec<String>, Option<String>) {
    let mut parts: Vec<String> = Vec::new();
    let mut labels: Vec<String> = Vec::new();

    // 视频原音：跟随所属片段的变速与音量
    if with_src_audio {
        for (i, c) in clips.iter().enumerate() {
            let speed = if c.speed > 0.0 { c.speed } else { 1.0 };
            let src = (c.duration.max(0.1) * speed).max(0.1);
            let delay = (c.start.max(0.0) * 1000.0).round();
            let vol = c.volume.max(0.0);
            let lab = format!("av{}", i);
            parts.push(format!(
                // aformat 必须在 adelay 之前：adelay 要求每声道一个延迟值（D|D），
                // 若源是单声道（TTS 配音很常见）会直接报 delays 数量不匹配。
                "[{}:a]atrim=0:{:.3},asetpts=PTS-STARTPTS,{},volume={:.3},\
aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,adelay={:.0}|{:.0}[{}]",
                i, src, atempo_chain(speed), vol, delay, delay, lab
            ));
            labels.push(lab);
        }
    }

    // 音频轨（输入序号排在视频之后）
    for (j, a) in audios.iter().enumerate() {
        let idx = clips.len() + j;
        let speed = if a.speed > 0.0 { a.speed } else { 1.0 };
        let src = (a.duration.max(0.1) * speed).max(0.1);
        let delay = (a.start.max(0.0) * 1000.0).round();
        let vol = a.volume.max(0.0);
        let lab = format!("au{}", j);
        parts.push(format!(
            "[{}:a]atrim=0:{:.3},asetpts=PTS-STARTPTS,{},volume={:.3},\
aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,adelay={:.0}|{:.0}[{}]",
                idx, src, atempo_chain(speed), vol, delay, delay, lab
            ));
        labels.push(lab);
    }

    if labels.is_empty() {
        return (parts, None);
    }
    if labels.len() == 1 {
        return (parts, Some(format!("[{}]", labels[0])));
    }

    let merged: String = labels.iter().map(|l| format!("[{}]", l)).collect();
    let left: Vec<String> = (0..labels.len()).map(|k| format!("c{}", 2 * k)).collect();
    let right: Vec<String> = (0..labels.len()).map(|k| format!("c{}", 2 * k + 1)).collect();
    parts.push(format!(
        "{}amerge=inputs={},pan=stereo|c0={}|c1={}[aout]",
        merged,
        labels.len(),
        left.join("+"),
        right.join("+")
    ));
    (parts, Some("[aout]".to_string()))
}

#[allow(clippy::too_many_arguments)]
fn run_export(
    ff: &std::path::Path,
    tmp: &std::path::Path,
    clips: &[TlVideoClip],
    audios: &[TlAudioClip],
    with_src_audio: bool,
    use_sub: bool,
    w: u32,
    h: u32,
    fpsv: u32,
    bg: &str,
    total: f64,
    bitrate: &str,
    out: &str,
) -> Result<(), String> {
    let (mut vf, video_map) = build_video_filter(clips, use_sub, w, h, fpsv, bg, total);
    let (af, audio_map) = build_audio_filter(clips, audios, with_src_audio);
    for p in af {
        vf += &p;
        vf += ";";
    }
    if vf.ends_with(';') {
        vf.pop();
    }

    let mut args: Vec<String> = vec!["-y".into()];
    for i in 0..clips.len() {
        args.push("-i".into());
        args.push(format!("et_v{}.mp4", i));
    }
    for j in 0..audios.len() {
        args.push("-i".into());
        args.push(format!("et_a{}.mp3", j));
    }
    args.push("-filter_complex".into());
    args.push(vf);
    args.push("-map".into());
    args.push(video_map);
    match audio_map {
        Some(l) => {
            args.push("-map".into());
            args.push(l);
            args.push("-c:a".into());
            args.push("aac".into());
            args.push("-b:a".into());
            args.push("192k".into());
        }
        None => {
            args.push("-an".into());
        }
    }
    args.push("-c:v".into());
    args.push("libx264".into());
    args.push("-preset".into());
    args.push("veryfast".into());
    args.push("-pix_fmt".into());
    args.push("yuv420p".into());
    args.push("-b:v".into());
    args.push(bitrate.to_string());
    args.push("-r".into());
    args.push(fpsv.to_string());
    args.push("-t".into());
    args.push(format!("{:.3}", total));
    args.push("-movflags".into());
    args.push("+faststart".into());
    args.push(out.to_string());

    // 所有素材路径用相对名 + cwd=tmp，规避 Windows 盘符冒号破坏滤镜语法
    let res = StdCommand::new(ff)
        .current_dir(tmp)
        .args(&args)
        .output()
        .map_err(|e| format!("执行 ffmpeg 失败: {}", e))?;
    if !res.status.success() {
        return Err(format!("合成失败: {}", String::from_utf8_lossy(&res.stderr)));
    }
    Ok(())
}

/// 导出时间线成片：视频轨 + 音频轨 + 文本轨 → 单个 MP4，保存到下载目录并返回完整路径。
#[tauri::command]
fn export_timeline(
    app: tauri::AppHandle,
    clips: Vec<TlVideoClip>,
    audios: Vec<TlAudioClip>,
    texts: Vec<TlTextClip>,
    width: u32,
    height: u32,
    fps: u32,
    bitrate: String,
    bg_color: String,
    filename: String,
) -> Result<String, String> {
    if clips.is_empty() {
        return Err("时间线上没有视频片段。".into());
    }

    let tmp = std::env::temp_dir();
    let ff = ffmpeg_path(&app)?;
    let w = if width == 0 { 1920 } else { width };
    let h = if height == 0 { 1080 } else { height };
    let fpsv = if fps == 0 { 30 } else { fps };
    let bg = format!("0x{}", bg_color.trim_start_matches('#'));
    let br = if bitrate.trim().is_empty() { "8M".to_string() } else { bitrate };

    for (i, c) in clips.iter().enumerate() {
        let bytes = decode_b64(&c.data, i)?;
        std::fs::write(tmp.join(format!("et_v{}.mp4", i)), &bytes)
            .map_err(|e| format!("写视频片段 {} 失败: {}", i, e))?;
    }
    for (j, a) in audios.iter().enumerate() {
        let bytes = decode_b64(&a.data, j)?;
        std::fs::write(tmp.join(format!("et_a{}.mp3", j)), &bytes)
            .map_err(|e| format!("写音频片段 {} 失败: {}", j, e))?;
    }

    // 文本轨 → SRT
    let mut srt = String::new();
    let mut sub_idx = 1;
    for t in texts.iter() {
        let tx = t.text.trim();
        if tx.is_empty() {
            continue;
        }
        let st = t.start.max(0.0);
        let en = (t.start + t.duration.max(0.3)).max(st + 0.3);
        srt += &format!(
            "{}\n{} --> {}\n{}\n\n",
            sub_idx,
            srt_ts(st),
            srt_ts(en),
            tx.replace('\n', " ")
        );
        sub_idx += 1;
    }
    let use_sub = sub_idx > 1;
    if use_sub {
        std::fs::write(tmp.join("et_sub.srt"), &srt)
            .map_err(|e| format!("写字幕失败: {}", e))?;
    }

    let mut total = 0.0_f64;
    for c in clips.iter() {
        total = total.max(c.start + c.duration.max(0.1));
    }
    for a in audios.iter() {
        total = total.max(a.start + a.duration.max(0.1));
    }
    total = total.max(0.5);

    let out = "et_out.mp4";
    // 先尝试带视频原音；素材无音轨时 ffmpeg 报 "matches no streams"，回退为仅音频轨
    if let Err(e) = run_export(
        &ff, &tmp, &clips, &audios, true, use_sub, w, h, fpsv, &bg, total, &br, out,
    ) {
        if e.contains("matches no streams")
            || e.contains("Stream specifier")
            || e.contains("Invalid file index")
        {
            run_export(
                &ff, &tmp, &clips, &audios, false, use_sub, w, h, fpsv, &bg, total, &br, out,
            )?;
        } else {
            return Err(e);
        }
    }

    // 落盘到「下载」目录，返回路径给前端
    let home = std::env::var("USERPROFILE").unwrap_or_default();
    let dir = std::path::PathBuf::from(&home).join("Downloads");
    let _ = std::fs::create_dir_all(&dir);
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let name = if filename.trim().is_empty() {
        format!("烬序成片_{}.mp4", stamp)
    } else {
        // 只取文件名部分，防止前端传入 "../.." 之类的路径遍历写到任意目录
        std::path::Path::new(&filename)
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| format!("烬序成片_{}.mp4", stamp))
    };
    let target = dir.join(&name);
    std::fs::copy(tmp.join(out), &target).map_err(|e| format!("保存失败: {}", e))?;
    Ok(target.to_string_lossy().to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            read_zhipu_key,
            save_file,
            save_shared_assets,
            export_intro_mp4,
            merge_videos,
            merge_clips,
            export_timeline
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
