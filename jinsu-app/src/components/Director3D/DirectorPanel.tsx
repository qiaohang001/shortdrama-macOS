import { useState } from 'react';
import {
  User,
  Box,
  Camera,
  Settings,
  Plus,
  Trash2,
  Move,
  Eye,
  Download,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useDirectorStore } from './store';
import { ASPECT_RATIOS, CAMERA_MOVEMENTS } from './types';

function PanelHeader({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: any;
  title: string;
  count?: number;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ borderBottom: '1px solid #2a2a3a', marginBottom: '8px' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 12px',
          cursor: 'pointer',
          background: '#1a1a2e',
        }}
      >
        {open ? (
          <ChevronDown size={14} style={{ marginRight: 6 }} />
        ) : (
          <ChevronRight size={14} style={{ marginRight: 6 }} />
        )}
        <Icon size={14} style={{ marginRight: 6, color: '#4facfe' }} />
        <span style={{ fontSize: '13px', fontWeight: 600, flex: 1 }}>
          {title}
        </span>
        {count !== undefined && (
          <span
            style={{
              fontSize: '11px',
              background: '#2a2a4a',
              padding: '1px 6px',
              borderRadius: '8px',
            }}
          >
            {count}
          </span>
        )}
      </div>
      {open && <div style={{ padding: '8px 12px' }}>{children}</div>}
    </div>
  );
}

function Vector3Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: { x: number; y: number; z: number };
  onChange: (v: { x: number; y: number; z: number }) => void;
}) {
  return (
    <div style={{ marginBottom: '6px' }}>
      <div style={{ fontSize: '11px', color: '#888', marginBottom: '2px' }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: '4px' }}>
        {(['x', 'y', 'z'] as const).map((axis) => (
          <div key={axis} style={{ flex: 1 }}>
            <input
              type="number"
              step={0.1}
              value={value[axis]}
              onChange={(e) =>
                onChange({ ...value, [axis]: parseFloat(e.target.value) || 0 })
              }
              style={{
                width: '100%',
                background: '#0f0f1a',
                border: '1px solid #2a2a3a',
                borderRadius: '4px',
                padding: '3px 4px',
                color: '#fff',
                fontSize: '11px',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DirectorPanel() {
  const {
    characters,
    props,
    cameras,
    activeCameraId,
    selectedCharacterId,
    selectedPropId,
    scene,
    showGrid,
    addCharacter,
    updateCharacter,
    removeCharacter,
    selectCharacter,
    addProp,
    updateProp,
    removeProp,
    selectProp,
    addCamera,
    updateCamera,
    removeCamera,
    setActiveCamera,
    updateScene,
    toggleGrid,
    exportScene,
    exportCameraReference,
  } = useDirectorStore();

  const selectedChar = characters.find((c) => c.id === selectedCharacterId);
  const selectedPropItem = props.find((p) => p.id === selectedPropId);
  const activeCamera = cameras.find((c) => c.id === activeCameraId);

  const handleAddCameraFromView = () => {
    // 从当前视角添加机位（简化版，用默认位置）
    addCamera(
      { x: 8, y: 6, z: 8 },
      { x: 0, y: 1, z: 0 }
    );
  };

  return (
    <div
      style={{
        width: '280px',
        height: '100%',
        background: '#12121f',
        borderRight: '1px solid #2a2a3a',
        overflowY: 'auto',
        color: '#fff',
      }}
    >
      {/* 顶部标题 */}
      <div
        style={{
          padding: '12px',
          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          fontWeight: 700,
          fontSize: '14px',
        }}
      >
        🎬 3D 导演台
      </div>

      {/* 角色管理 */}
      <PanelHeader icon={User} title="角色" count={characters.length}>
        <button
          onClick={() => addCharacter()}
          style={{
            width: '100%',
            padding: '6px',
            background: '#2a2a4a',
            border: 'none',
            borderRadius: '4px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '12px',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <Plus size={12} /> 添加角色
        </button>
        {characters.map((c) => (
          <div
            key={c.id}
            onClick={() => selectCharacter(c.id)}
            style={{
              padding: '6px 8px',
              background:
                selectedCharacterId === c.id ? '#2a3a5a' : '#1a1a2e',
              borderRadius: '4px',
              marginBottom: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: c.color,
              }}
            />
            <span style={{ fontSize: '12px', flex: 1 }}>{c.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeCharacter(c.id);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#f5576c',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {selectedChar && (
          <div
            style={{
              marginTop: '8px',
              padding: '8px',
              background: '#0f0f1a',
              borderRadius: '4px',
            }}
          >
            <div style={{ fontSize: '11px', color: '#4facfe', marginBottom: '6px' }}>
              编辑：{selectedChar.name}
            </div>
            <input
              type="text"
              value={selectedChar.name}
              onChange={(e) =>
                updateCharacter(selectedChar.id, { name: e.target.value })
              }
              style={{
                width: '100%',
                background: '#0f0f1a',
                border: '1px solid #2a2a3a',
                borderRadius: '4px',
                padding: '4px',
                color: '#fff',
                fontSize: '11px',
                marginBottom: '6px',
              }}
            />
            <Vector3Input
              label="位置"
              value={selectedChar.position}
              onChange={(v) => updateCharacter(selectedChar.id, { position: v })}
            />
            <Vector3Input
              label="旋转"
              value={selectedChar.rotation}
              onChange={(v) => updateCharacter(selectedChar.id, { rotation: v })}
            />
            <div style={{ marginBottom: '6px' }}>
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '2px' }}>
                缩放: {selectedChar.scale.toFixed(1)}
              </div>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={selectedChar.scale}
                onChange={(e) =>
                  updateCharacter(selectedChar.id, {
                    scale: parseFloat(e.target.value),
                  })
                }
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ marginBottom: '6px' }}>
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '2px' }}>
                颜色
              </div>
              <input
                type="color"
                value={selectedChar.color}
                onChange={(e) =>
                  updateCharacter(selectedChar.id, { color: e.target.value })
                }
                style={{ width: '100%', height: '24px', border: 'none', borderRadius: '4px' }}
              />
            </div>
          </div>
        )}
      </PanelHeader>

      {/* 道具管理 */}
      <PanelHeader icon={Box} title="道具" count={props.length}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '8px' }}>
          {(['box', 'sphere', 'cylinder', 'plane'] as const).map((type) => (
            <button
              key={type}
              onClick={() => addProp(type)}
              style={{
                padding: '5px',
                background: '#2a2a4a',
                border: 'none',
                borderRadius: '4px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '11px',
              }}
            >
              + {type}
            </button>
          ))}
        </div>
        {props.map((p) => (
          <div
            key={p.id}
            onClick={() => selectProp(p.id)}
            style={{
              padding: '6px 8px',
              background: selectedPropId === p.id ? '#2a3a5a' : '#1a1a2e',
              borderRadius: '4px',
              marginBottom: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Box size={12} color={p.color} />
            <span style={{ fontSize: '12px', flex: 1 }}>{p.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeProp(p.id);
              }}
              style={{ background: 'none', border: 'none', color: '#f5576c', cursor: 'pointer', padding: 0 }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {selectedPropItem && (
          <div style={{ marginTop: '8px', padding: '8px', background: '#0f0f1a', borderRadius: '4px' }}>
            <Vector3Input
              label="位置"
              value={selectedPropItem.position}
              onChange={(v) => updateProp(selectedPropItem.id, { position: v })}
            />
            <Vector3Input
              label="缩放"
              value={selectedPropItem.scale}
              onChange={(v) => updateProp(selectedPropItem.id, { scale: v })}
            />
          </div>
        )}
      </PanelHeader>

      {/* 机位管理 */}
      <PanelHeader icon={Camera} title="机位" count={cameras.length}>
        <button
          onClick={handleAddCameraFromView}
          style={{
            width: '100%',
            padding: '6px',
            background: '#2a2a4a',
            border: 'none',
            borderRadius: '4px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '12px',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <Camera size={12} /> 从当前视角新增机位
        </button>
        {cameras.map((cam) => (
          <div
            key={cam.id}
            onClick={() => setActiveCamera(cam.id)}
            style={{
              padding: '6px 8px',
              background: activeCameraId === cam.id ? '#3a3a1a' : '#1a1a2e',
              borderRadius: '4px',
              marginBottom: '4px',
              cursor: 'pointer',
              border: activeCameraId === cam.id ? '1px solid #ffd700' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Camera size={12} color={activeCameraId === cam.id ? '#ffd700' : '#888'} />
              <span style={{ fontSize: '12px', flex: 1 }}>{cam.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeCamera(cam.id);
                }}
                style={{ background: 'none', border: 'none', color: '#f5576c', cursor: 'pointer', padding: 0 }}
              >
                <Trash2 size={12} />
              </button>
            </div>
            <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
              {cam.aspect} · {CAMERA_MOVEMENTS.find((m) => m.value === cam.movement)?.label}
            </div>
          </div>
        ))}
        {activeCamera && (
          <div style={{ marginTop: '8px', padding: '8px', background: '#0f0f1a', borderRadius: '4px' }}>
            <div style={{ fontSize: '11px', color: '#ffd700', marginBottom: '6px' }}>
              编辑机位：{activeCamera.name}
            </div>
            <input
              type="text"
              value={activeCamera.name}
              onChange={(e) => updateCamera(activeCamera.id, { name: e.target.value })}
              style={{ width: '100%', background: '#0f0f1a', border: '1px solid #2a2a3a', borderRadius: '4px', padding: '4px', color: '#fff', fontSize: '11px', marginBottom: '6px' }}
            />
            <Vector3Input
              label="机位位置"
              value={activeCamera.position}
              onChange={(v) => updateCamera(activeCamera.id, { position: v })}
            />
            <Vector3Input
              label="注视点"
              value={activeCamera.target}
              onChange={(v) => updateCamera(activeCamera.id, { target: v })}
            />
            <div style={{ marginBottom: '6px' }}>
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '2px' }}>画幅</div>
              <select
                value={activeCamera.aspect}
                onChange={(e) => updateCamera(activeCamera.id, { aspect: e.target.value })}
                style={{ width: '100%', background: '#0f0f1a', border: '1px solid #2a2a3a', borderRadius: '4px', padding: '4px', color: '#fff', fontSize: '11px' }}
              >
                {ASPECT_RATIOS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '6px' }}>
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '2px' }}>运镜方式</div>
              <select
                value={activeCamera.movement}
                onChange={(e) => updateCamera(activeCamera.id, { movement: e.target.value as any })}
                style={{ width: '100%', background: '#0f0f1a', border: '1px solid #2a2a3a', borderRadius: '4px', padding: '4px', color: '#fff', fontSize: '11px' }}
              >
                {CAMERA_MOVEMENTS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '6px' }}>
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '2px' }}>
                焦距: {activeCamera.fov}°
              </div>
              <input
                type="range"
                min="20"
                max="100"
                value={activeCamera.fov}
                onChange={(e) => updateCamera(activeCamera.id, { fov: parseInt(e.target.value) })}
                style={{ width: '100%' }}
              />
            </div>
            <button
              onClick={() => {
                const ref = exportCameraReference(activeCamera.id);
                console.log('机位参考数据:', ref);
                alert('机位参考数据已输出到控制台，可对接生图/生视频API');
              }}
              style={{ width: '100%', padding: '6px', background: 'linear-gradient(135deg, #4facfe, #00f2fe)', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '11px', marginTop: '4px' }}
            >
              📤 导出机位参考（对接生图）
            </button>
          </div>
        )}
      </PanelHeader>

      {/* 场景设置 */}
      <PanelHeader icon={Settings} title="场景设置">
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '2px' }}>背景色</div>
          <input
            type="color"
            value={scene.background}
            onChange={(e) => updateScene({ background: e.target.value })}
            style={{ width: '100%', height: '24px', border: 'none', borderRadius: '4px' }}
          />
        </div>
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '2px' }}>地面色</div>
          <input
            type="color"
            value={scene.groundColor}
            onChange={(e) => updateScene({ groundColor: e.target.value })}
            style={{ width: '100%', height: '24px', border: 'none', borderRadius: '4px' }}
          />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', marginBottom: '6px', cursor: 'pointer' }}>
          <input type="checkbox" checked={showGrid} onChange={toggleGrid} />
          显示网格
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', marginBottom: '6px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={scene.fogEnabled}
            onChange={(e) => updateScene({ fogEnabled: e.target.checked })}
          />
          场景雾效
        </label>
        <button
          onClick={() => {
            const data = exportScene();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'director-scene.json';
            a.click();
          }}
          style={{ width: '100%', padding: '6px', background: '#2a2a4a', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '12px', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
        >
          <Download size={12} /> 导出场景配置
        </button>
      </PanelHeader>
    </div>
  );
}
