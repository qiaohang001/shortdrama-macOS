import React, { useState, useRef, useEffect } from 'react';
import { runDispatchJob, api } from '../../dispatch-jobs.js';

const BGM_TRACKS = [
  { id: 'bgm_1', name: '古风·意境', duration: 60, genre: '古风' },
  { id: 'bgm_2', name: '紧张·悬疑', duration: 45, genre: '悬疑' },
  { id: 'bgm_3', name: '温馨·日常', duration: 60, genre: '日常' },
  { id: 'bgm_4', name: '励志·激昂', duration: 50, genre: '励志' },
];

const TRANSITIONS = [
  { id: 'none', name: '无转场', icon: '✂️' },
  { id: 'fade', name: '淡入淡出', icon: '🌫️' },
  { id: 'dissolve', name: '溶解', icon: '💧' },
  { id: 'wipe', name: '擦除', icon: '➡️' },
  { id: 'zoom', name: '缩放', icon: '🔍' },
];

export function VisualEditor({ project, update, log }) {
  const shots = project.shots || [];
  const [generating, setGenerating] = useState(false);
  const [selectedBgm, setSelectedBgm] = useState(null);
  const [enableTts, setEnableTts] = useState(false);
  const [enableSubtitles, setEnableSubtitles] = useState(true);
  const [timeline, setTimeline] = useState(shots.map(s => s.id));
  const [finalVideo, setFinalVideo] = useState(null);
  const [selectedClipId, setSelectedClipId] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transition, setTransition] = useState('fade');
  const [dragIndex, setDragIndex] = useState(null);
  const [showBgmPanel, setShowBgmPanel] = useState(false);
  const videoRef = useRef(null);
  const timelineRef = useRef(null);

  // 计算总时长
  const totalDuration = timeline.reduce((sum, id) => {
    const shot = shots.find(s => s.id === id);
    return sum + (shot?.duration || 5);
  }, 0);

  // 获取当前播放的片段
  const getCurrentClip = () => {
    let acc = 0;
    for (const id of timeline) {
      const shot = shots.find(s => s.id === id);
      const dur = shot?.duration || 5;
      if (currentTime < acc + dur) return { shot, startTime: acc, index: timeline.indexOf(id) };
      acc += dur;
    }
    return null;
  };

  const currentClip = getCurrentClip();

  // 播放控制
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentTime(t => {
        if (t >= totalDuration) {
          setIsPlaying(false);
          return 0;
        }
        return t + 0.1;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying, totalDuration]);

  const togglePlay = () => setIsPlaying(!isPlaying);
  const seekTo = (time) => {
    setCurrentTime(Math.max(0, Math.min(totalDuration, time)));
  };
  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // 片段操作
  const moveClip = (from, to) => {
    if (to < 0 || to >= timeline.length) return;
    const newTimeline = [...timeline];
    const [removed] = newTimeline.splice(from, 1);
    newTimeline.splice(to, 0, removed);
    setTimeline(newTimeline);
  };

  const removeClip = (shotId) => {
    setTimeline(timeline.filter(id => id !== shotId));
    if (selectedClipId === shotId) setSelectedClipId(null);
    log(`已从时间线移除镜头`);
  };

  const addToTimeline = (shotId) => {
    if (!timeline.includes(shotId)) {
      setTimeline([...timeline, shotId]);
      log(`已添加到时间线`);
    }
  };

  // 拖拽
  const handleDragStart = (index) => setDragIndex(index);
  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== index) {
      moveClip(dragIndex, index);
      setDragIndex(index);
    }
  };
  const handleDragEnd = () => setDragIndex(null);

  // 生成字幕
  const generateSubtitles = async () => {
    setGenerating(true);
    log('正在生成字幕...');
    try {
      const dialogueText = shots.filter(s => s.dialogue).map(s => s.title + ': ' + s.dialogue).join('\n');
      if (!dialogueText) { log('没有对话内容'); setGenerating(false); return; }
      const prompt = `你是一名专业字幕工程师。请为以下短剧对话生成标准SRT格式字幕文件。

要求：
1. 严格遵循SRT格式：序号 → 时间码(00:00:00,000 --> 00:00:00,000) → 字幕内容 → 空行
2. 每句台词对应一条字幕，时间码根据台词长度合理分配（每句约2-4秒）
3. 字幕内容简洁，保留核心台词，去除语气词冗余
4. 中文短剧字幕，每行不超过15字，最多2行
5. 只输出纯SRT内容，不要markdown代码块，不要解释，不要额外文字

剧本对话：
${dialogueText}`;
      const res = await api('/api/llm/chat', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }) });
      const text = res.choices?.[0]?.message?.content || '';
      update({ subtitles: text });
      log('字幕生成完成');
    } catch (e) {
      log('字幕生成失败: ' + e.message);
    } finally {
      setGenerating(false);
    }
  };

  // 生成配音
  const generateTts = async (shotId) => {
    setGenerating(true);
    log('正在生成配音...');
    try {
      const shot = shots.find(s => s.id === shotId);
      if (!shot?.dialogue) { log('该镜头没有台词'); setGenerating(false); return; }
      const res = await runDispatchJob({ type: 'tts', payload: { text: shot.dialogue, voice: 'zh-CN-XiaoxiaoNeural' }, pollInterval: 5000, timeoutMs: 120000 });
      update({ shots: shots.map(s => s.id === shotId ? { ...s, audioUrl: res.resultUrl } : s) });
      log('配音生成成功');
    } catch (e) {
      log('配音生成失败: ' + e.message);
    } finally {
      setGenerating(false);
    }
  };

  // 合成视频
  const mergeVideo = async () => {
    setGenerating(true);
    log('正在合成视频...');
    try {
      const videoShots = timeline.map(id => shots.find(s => s.id === id)).filter(Boolean).filter(s => s.videoUrl);
      if (videoShots.length === 0) { log('没有已生成的视频片段'); setGenerating(false); return; }
      const result = await runDispatchJob({
        type: 'merge',
        payload: { clips: videoShots.map(s => ({ url: s.videoUrl, duration: s.duration || 5 })), bgm: selectedBgm, enableTts, enableSubtitles, transition },
        pollInterval: 10000, timeoutMs: 600000
      });
      setFinalVideo(result.resultUrl);
      update({ finalVideo: result.resultUrl });
      log('视频合成完成');
    } catch (e) {
      log('视频合成失败: ' + e.message);
    } finally {
      setGenerating(false);
    }
  };

  const downloadSubtitles = () => {
    const text = project.subtitles || '';
    if (!text) { log('没有字幕内容'); return; }
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = (project.title || '剧本') + '.srt'; a.click();
    URL.revokeObjectURL(url);
  };

  // 时间线点击跳转
  const handleTimelineClick = (e) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    seekTo(percent * totalDuration);
  };

  const selectedShot = selectedClipId ? shots.find(s => s.id === selectedClipId) : null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg, #0b0f17)', color: 'var(--text)', overflow: 'hidden' }}>
      {/* 顶部：预览窗口 + 工具栏 */}
      <div style={{ display: 'flex', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
        {/* 视频预览窗口 */}
        <div style={{ width: 360, flexShrink: 0 }}>
          <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#000', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {currentClip?.shot?.videoUrl ? (
                <video ref={videoRef} src={currentClip.shot.videoUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} autoPlay muted loop />
              ) : currentClip?.shot?.imageUrl ? (
                <img src={currentClip.shot.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="" />
              ) : (
                <div style={{ color: '#555', fontSize: 14 }}>
                  {timeline.length === 0 ? '时间线为空' : '当前片段无视频'}
                </div>
              )}
            </div>
            {currentClip && (
              <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.7)', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>
                {currentClip.shot?.title || `镜头${currentClip.index + 1}`}
              </div>
            )}
          </div>
          {/* 播放控制 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <button style={ctrlBtn} onClick={() => seekTo(currentTime - 1)}>⏮</button>
            <button style={{ ...ctrlBtn, ...ctrlBtnPrimary }} onClick={togglePlay}>
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button style={ctrlBtn} onClick={() => seekTo(currentTime + 1)}>⏭</button>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              {formatTime(currentTime)} / {formatTime(totalDuration)}
            </span>
          </div>
          {/* 进度条 */}
          <div style={{ marginTop: 6, height: 4, background: 'var(--input-bg)', borderRadius: 2, cursor: 'pointer', position: 'relative' }}
            onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); seekTo(((e.clientX - rect.left) / rect.width) * totalDuration); }}>
            <div style={{ height: '100%', width: `${(currentTime / totalDuration) * 100}%`, background: 'linear-gradient(90deg, #7A5CFF, #5CE1E6)', borderRadius: 2 }} />
          </div>
        </div>

        {/* 右侧：工具栏 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>✂️ 剪辑工作台</h2>
            <button style={{ ...btn, ...btnPrimary }} onClick={mergeVideo} disabled={generating}>
              {generating ? '合成中...' : '🎬 合成导出'}
            </button>
          </div>

          {/* 工具按钮行 */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button style={toolBtn} onClick={generateSubtitles} disabled={generating}>📝 生成字幕（1积分）</button>
            {project.subtitles && <button style={toolBtn} onClick={downloadSubtitles}>⬇️ 下载字幕</button>}
            <button style={toolBtn} onClick={() => setShowBgmPanel(!showBgmPanel)}>🎵 背景音乐</button>
            <label style={{ ...toolBtn, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input type="checkbox" checked={enableTts} onChange={e => setEnableTts(e.target.checked)} style={{ margin: 0 }} />
              AI配音
            </label>
            <label style={{ ...toolBtn, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input type="checkbox" checked={enableSubtitles} onChange={e => setEnableSubtitles(e.target.checked)} style={{ margin: 0 }} />
              自动字幕
            </label>
          </div>

          {/* 转场效果 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>转场：</span>
            {TRANSITIONS.map(t => (
              <button key={t.id} style={{ ...chipBtn, ...(transition === t.id ? chipBtnActive : {}) }} onClick={() => setTransition(t.id)}>
                {t.icon} {t.name}
              </button>
            ))}
          </div>

          {/* BGM面板 */}
          {showBgmPanel && (
            <div style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--panel-2)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>选择背景音乐</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {BGM_TRACKS.map(bgm => (
                  <button key={bgm.id} style={{ ...chipBtn, ...(selectedBgm === bgm.id ? chipBtnActive : {}) }} onClick={() => setSelectedBgm(selectedBgm === bgm.id ? null : bgm.id)}>
                    {bgm.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 选中片段信息 */}
          {selectedShot && (
            <div style={{ padding: 10, border: '1px solid #7A5CFF', borderRadius: 8, background: 'rgba(122,92,255,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>📌 {selectedShot.title}</span>
                <button style={{ ...iconBtn, color: '#ef4444', borderColor: '#ef4444' }} onClick={() => removeClip(selectedShot.id)}>🗑 移除</button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 12 }}>
                <span>时长：{selectedShot.duration || 5}s</span>
                <span>类型：{selectedShot.sceneType || '-'}</span>
                <span>运镜：{selectedShot.cameraMove || '-'}</span>
              </div>
              {selectedShot.dialogue && (
                <div style={{ fontSize: 11, color: '#5CE1E6', marginTop: 4 }}>💬 {selectedShot.dialogue}</div>
              )}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {selectedShot.dialogue && <button style={miniBtn} onClick={() => generateTts(selectedShot.id)} disabled={generating}>🎙 生成配音（1积分）</button>}
                {selectedShot.audioUrl && <span style={{ fontSize: 11, color: '#10b981', alignSelf: 'center' }}>✓ 已有配音</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 底部：多轨道时间线 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>📊 多轨道时间线（{timeline.length} 个片段 · 总时长 {formatTime(totalDuration)}）</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>💡 拖拽片段调整顺序 · 点击时间轴跳转 · 点击片段选中</span>
        </div>

        {/* 时间刻度 */}
        <div ref={timelineRef} style={{ position: 'relative', height: 24, marginBottom: 4, cursor: 'pointer' }} onClick={handleTimelineClick}>
          {Array.from({ length: Math.ceil(totalDuration / 5) + 1 }).map((_, i) => {
            const t = i * 5;
            if (t > totalDuration) return null;
            return (
              <div key={i} style={{ position: 'absolute', left: `${(t / totalDuration) * 100}%`, bottom: 0, fontSize: 9, color: 'var(--text-muted)', transform: 'translateX(-50%)' }}>
                {formatTime(t)}
              </div>
            );
          })}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: 'var(--border)' }} />
        </div>

        {/* 视频轨 */}
        <div style={{ display: 'flex', alignItems: 'stretch', marginBottom: 4 }}>
          <div style={{ width: 70, flexShrink: 0, display: 'flex', alignItems: 'center', fontSize: 11, color: 'var(--text-muted)', paddingRight: 8 }}>
            🎬 视频轨
          </div>
          <div style={{ flex: 1, display: 'flex', gap: 2, minHeight: 64, background: 'var(--panel-2)', borderRadius: 6, padding: 4, position: 'relative', overflow: 'hidden' }}
            onClick={handleTimelineClick}>
            {timeline.length === 0 && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                从下方「可用镜头」拖拽或点击添加到时间线
              </div>
            )}
            {timeline.map((shotId, index) => {
              const shot = shots.find(s => s.id === shotId);
              if (!shot) return null;
              const dur = shot.duration || 5;
              const widthPercent = (dur / totalDuration) * 100;
              const isSelected = selectedClipId === shotId;
              const isCurrent = currentClip?.index === index;
              return (
                <div
                  key={shotId}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  onClick={(e) => { e.stopPropagation(); setSelectedClipId(shotId); }}
                  style={{
                    width: `${widthPercent}%`, minWidth: 60, background: isSelected ? 'rgba(122,92,255,0.3)' : isCurrent ? 'rgba(92,225,230,0.2)' : 'var(--input-bg)',
                    border: `2px solid ${isSelected ? '#7A5CFF' : isCurrent ? '#5CE1E6' : 'var(--border)'}`, borderRadius: 4, padding: 4,
                    cursor: 'move', overflow: 'hidden', position: 'relative', transition: 'all 0.15s'
                  }}
                >
                  {shot.videoUrl ? (
                    <video src={shot.videoUrl} style={{ width: '100%', height: 36, objectFit: 'cover', borderRadius: 2 }} muted />
                  ) : shot.imageUrl ? (
                    <img src={shot.imageUrl} style={{ width: '100%', height: 36, objectFit: 'cover', borderRadius: 2 }} alt="" />
                  ) : (
                    <div style={{ width: '100%', height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🎬</div>
                  )}
                  <div style={{ fontSize: 9, color: 'var(--text)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {shot.title || `镜头${index + 1}`}
                  </div>
                  <div style={{ fontSize: 8, color: 'var(--text-muted)' }}>{dur}s</div>
                  {index < timeline.length - 1 && transition !== 'none' && (
                    <div style={{ position: 'absolute', right: -4, top: '50%', transform: 'translateY(-50%)', fontSize: 10, zIndex: 1 }}>✨</div>
                  )}
                </div>
              );
            })}
            {/* 播放头 */}
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${(currentTime / totalDuration) * 100}%`, width: 2, background: '#ef4444', zIndex: 10, pointerEvents: 'none' }} />
          </div>
        </div>

        {/* 音频轨 */}
        <div style={{ display: 'flex', alignItems: 'stretch', marginBottom: 4 }}>
          <div style={{ width: 70, flexShrink: 0, display: 'flex', alignItems: 'center', fontSize: 11, color: 'var(--text-muted)', paddingRight: 8 }}>
            🎵 音频轨
          </div>
          <div style={{ flex: 1, minHeight: 40, background: 'var(--panel-2)', borderRadius: 6, padding: 4, position: 'relative', overflow: 'hidden' }}>
            {timeline.map((shotId, index) => {
              const shot = shots.find(s => s.id === shotId);
              if (!shot?.audioUrl) return null;
              const dur = shot.duration || 5;
              const widthPercent = (dur / totalDuration) * 100;
              let acc = 0;
              for (let i = 0; i < index; i++) { acc += (shots.find(s => s.id === timeline[i])?.duration || 5); }
              return (
                <div key={shotId} style={{ position: 'absolute', left: `${(acc / totalDuration) * 100}%`, width: `${widthPercent}%`, height: '100%', background: 'rgba(16,185,129,0.3)', border: '1px solid #10b981', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#10b981' }}>
                  🔊 配音
                </div>
              );
            })}
            {selectedBgm && (
              <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg, rgba(245,158,11,0.1), rgba(245,158,11,0.1) 5px, transparent 5px, transparent 10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#f59e0b' }}>
                🎵 BGM: {BGM_TRACKS.find(b => b.id === selectedBgm)?.name}
              </div>
            )}
          </div>
        </div>

        {/* 字幕轨 */}
        <div style={{ display: 'flex', alignItems: 'stretch', marginBottom: 8 }}>
          <div style={{ width: 70, flexShrink: 0, display: 'flex', alignItems: 'center', fontSize: 11, color: 'var(--text-muted)', paddingRight: 8 }}>
            📝 字幕轨
          </div>
          <div style={{ flex: 1, minHeight: 32, background: 'var(--panel-2)', borderRadius: 6, padding: 4, position: 'relative', overflow: 'hidden' }}>
            {enableSubtitles && timeline.map((shotId, index) => {
              const shot = shots.find(s => s.id === shotId);
              if (!shot?.dialogue) return null;
              const dur = shot.duration || 5;
              const widthPercent = (dur / totalDuration) * 100;
              let acc = 0;
              for (let i = 0; i < index; i++) { acc += (shots.find(s => s.id === timeline[i])?.duration || 5); }
              return (
                <div key={shotId} style={{ position: 'absolute', left: `${(acc / totalDuration) * 100}%`, width: `${widthPercent}%`, height: '100%', background: 'rgba(59,130,246,0.2)', border: '1px solid #3b82f6', borderRadius: 3, padding: '0 4px', display: 'flex', alignItems: 'center', fontSize: 9, color: '#3b82f6', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {shot.dialogue}
                </div>
              );
            })}
            {!enableSubtitles && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--text-muted)' }}>字幕已关闭</div>}
          </div>
        </div>

        {/* 可用镜头列表 */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>🎬 可用镜头（点击添加到时间线）</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {shots.filter(s => !timeline.includes(s.id)).map(shot => (
              <div key={shot.id} style={{ width: 120, padding: 6, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--panel-2)', cursor: 'pointer' }} onClick={() => addToTimeline(shot.id)}>
                {shot.videoUrl ? (
                  <video src={shot.videoUrl} style={{ width: '100%', height: 60, objectFit: 'cover', borderRadius: 4 }} muted />
                ) : shot.imageUrl ? (
                  <img src={shot.imageUrl} style={{ width: '100%', height: 60, objectFit: 'cover', borderRadius: 4 }} alt="" />
                ) : (
                  <div style={{ width: '100%', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, background: 'var(--input-bg)', borderRadius: 4 }}>🎬</div>
                )}
                <div style={{ fontSize: 10, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shot.title}</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{shot.duration || 5}s · 点击添加</div>
              </div>
            ))}
            {shots.filter(s => !timeline.includes(s.id)).length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 20 }}>所有镜头都已在时间线上</div>
            )}
          </div>
        </div>
      </div>

      {/* 合成结果 */}
      {finalVideo && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, width: 320, padding: 12, border: '1px solid #10b981', borderRadius: 10, background: 'rgba(16,185,129,0.1)', backdropFilter: 'blur(10px)', zIndex: 100 }}>
          <div style={{ fontWeight: 600, color: '#10b981', marginBottom: 8, fontSize: 13 }}>✅ 视频合成完成</div>
          <video src={finalVideo} controls style={{ width: '100%', borderRadius: 6 }} />
          <button style={{ ...btn, ...btnPrimary, width: '100%', marginTop: 8 }} onClick={() => { const a = document.createElement('a'); a.href = finalVideo; a.download = project.title + '.mp4'; a.click(); }}>
            ⬇️ 下载视频
          </button>
        </div>
      )}
    </div>
  );
}

// 样式
const btn = { padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 12 };
const btnPrimary = { border: 'none', background: 'linear-gradient(135deg, #7A5CFF, #5CE1E6)', color: '#fff', fontWeight: 600 };
const toolBtn = { padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--panel-2)', color: 'var(--text)', cursor: 'pointer', fontSize: 11 };
const chipBtn = { padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 12, background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11 };
const chipBtnActive = { borderColor: '#7A5CFF', background: 'rgba(122,92,255,0.2)', color: '#7A5CFF' };
const ctrlBtn = { width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--panel-2)', color: 'var(--text)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const ctrlBtnPrimary = { borderColor: '#7A5CFF', background: 'rgba(122,92,255,0.2)', color: '#7A5CFF' };
const miniBtn = { padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 4, background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 10 };
const iconBtn = { padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 4, background: 'transparent', cursor: 'pointer', fontSize: 10 };
