import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export function EditExport({ project, log }) {
  const [busy, setBusy] = useState("");

  const exportTxt = () => {
    const text = project.script || "暂无内容";
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (project.title || "剧本") + ".txt";
    a.click();
    URL.revokeObjectURL(url);
    log("导出TXT成功");
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (project.title || "project") + ".json";
    a.click();
    URL.revokeObjectURL(url);
    log("导出JSON成功");
  };

  const exportPdf = async () => {
    setBusy("pdf");
    log("正在生成PDF...");
    try {
      // 生成纯文本格式的剧本内容
      let content = `${project.title || "剧本"}\n\n`;
      content += `类型：${project.type || "待定"}\n`;
      content += `集数：${project.episodes?.length || 0} 集\n`;
      content += `人物：${(project.outline?.characters || []).map(c => c.name).join("、") || "待定"}\n\n`;
      content += "═".repeat(40) + "\n\n";

      if (project.outline?.synopsis) {
        content += "【故事梗概】\n" + project.outline.synopsis + "\n\n";
      }

      if (project.episodes) {
        project.episodes.forEach((ep, i) => {
          content += `${"═".repeat(40)}\n`;
          content += `第${i + 1}集：${ep.title}\n`;
          content += "─".repeat(40) + "\n";
          content += ep.content || "(无内容)\n\n";
        });
      }

      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (project.title || "剧本") + "_剧本.txt";
      a.click();
      URL.revokeObjectURL(url);
      log("导出剧本文本成功（可用Word打开转PDF）");
    } catch (e) {
      log("导出失败：" + e.message);
    } finally {
      setBusy("");
    }
  };

  const exportZip = async () => {
    setBusy("zip");
    log("正在打包工程...");
    try {
      const data = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        project: {
          title: project.title,
          type: project.type,
          outline: project.outline,
          episodes: project.episodes,
          shots: project.shots,
          scenes: project?.scenes || [],
          materials: project.materials,
        }
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (project.title || "project") + "_工程包.json";
      a.click();
      URL.revokeObjectURL(url);
      log("导出工程包成功");
    } catch (e) {
      log("导出失败：" + e.message);
    } finally {
      setBusy("");
    }
  };

  const exportVideo = async () => {
    setBusy("video");
    log("正在合成视频...");
    try {
      // 检查是否有视频片段
      const videoShots = project.shots?.filter(s => s.videoUrl) || [];
      if (videoShots.length === 0) {
        log("没有已生成的视频片段，无法合成");
        return;
      }

      // 使用 Tauri invoke 调用 ffmpeg 合成
      const shots = videoShots.map(s => ({ title: s.title, url: s.videoUrl }));
      await invoke("merge_videos", { shots });
      log("视频合成成功");
    } catch (e) {
      log("视频合成失败：" + e.message);
    } finally {
      setBusy("");
    }
  };

  const totalVideos = project.shots?.filter(s => s.videoUrl)?.length || 0;
  const totalShots = project.shots?.length || 0;

  return (
    <div style={{ padding: 16, height: "100%", overflow: "auto", color: "var(--text)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>✂️ 剪辑导出</h2>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {totalVideos}/{totalShots} 个镜头已生成视频
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 8, background: "var(--panel-2)" }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>📄 文本导出</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btn} onClick={exportTxt} disabled={busy !== ""}>
              {busy === "txt" ? "导出中..." : "导出剧本 TXT"}
            </button>
            <button style={btn} onClick={exportPdf} disabled={busy !== ""}>
              {busy === "pdf" ? "导出中..." : "导出剧本文本"}
            </button>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
            TXT 适合快速查看，文本格式可用 Word 打开后另存为 PDF
          </div>
        </div>

        <div style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 8, background: "var(--panel-2)" }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>📦 工程导出</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btn} onClick={exportJson} disabled={busy !== ""}>
              {busy === "json" ? "导出中..." : "导出工程 JSON"}
            </button>
            <button style={btn} onClick={exportZip} disabled={busy !== ""}>
              {busy === "zip" ? "打包中..." : "打包工程包"}
            </button>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
            工程包包含所有剧本、分镜、素材链接，可用于备份或跨设备迁移
          </div>
        </div>

        <div style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 8, background: "var(--panel-2)" }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>🎬 视频合成</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button 
              style={{ ...btn, opacity: totalVideos > 0 ? 1 : 0.5 }} 
              onClick={exportVideo} 
              disabled={busy !== "" || totalVideos === 0}
            >
              {busy === "video" ? "合成中..." : "合成所有视频为 MP4"}
            </button>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
            将已生成的视频片段按顺序合并为完整剧集 MP4 文件
            {totalVideos === 0 && "（请先在视频生成模块生成视频片段）"}
          </div>
        </div>

        <div style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 8, background: "var(--panel-2)" }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>📊 数据统计</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, fontSize: 12 }}>
            <div style={{ padding: 12, background: "var(--input-bg)", borderRadius: 6 }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: "#7A5CFF" }}>
                {project.episodes?.length || 0}
              </div>
              <div style={{ color: "var(--text-muted)" }}>总集数</div>
            </div>
            <div style={{ padding: 12, background: "var(--input-bg)", borderRadius: 6 }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: "#5CE1E6" }}>
                {totalShots}
              </div>
              <div style={{ color: "var(--text-muted)" }}>总分镜</div>
            </div>
            <div style={{ padding: 12, background: "var(--input-bg)", borderRadius: 6 }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: "#10b981" }}>
                {totalVideos}
              </div>
              <div style={{ color: "var(--text-muted)" }}>已生成视频</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const btn = {
  padding: "10px 16px",
  border: "1px solid var(--border)",
  borderRadius: 6,
  background: "var(--input-bg)",
  color: "var(--text)",
  cursor: "pointer",
  fontSize: 13,
  textAlign: "left",
};
