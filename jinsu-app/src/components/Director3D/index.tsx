import { DirectorCanvas } from './DirectorCanvas';
import { DirectorPanel } from './DirectorPanel';
import { useDirectorStore } from './store';

export interface Director3DProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: React.CSSProperties;
  onExport?: (data: object) => void;
  onCameraReference?: (cameraId: string, data: object) => void;
}

/**
 * 3D导演台组件
 * 
 * 功能：
 * - 3D虚拟场景搭建（角色、道具）
 * - 多机位管理（位置、焦距、画幅、运镜）
 * - 导出机位参考图（对接生图/生视频API）
 * 
 * 使用示例：
 * ```tsx
 * <Director3D
 *   width="100%"
 *   height="600px"
 *   onExport={(data) => console.log('场景数据:', data)}
 *   onCameraReference={(id, data) => console.log('机位参考:', id, data)}
 * />
 * ```
 */
export function Director3D({
  width = '100%',
  height = '100%',
  className,
  style,
  onExport,
  onCameraReference,
}: Director3DProps) {
  const { exportScene, exportCameraReference, activeCameraId } = useDirectorStore();

  const handleExport = () => {
    const data = exportScene();
    onExport?.(data);
  };

  const handleCameraRef = () => {
    if (activeCameraId) {
      const data = exportCameraReference(activeCameraId);
      onCameraReference?.(activeCameraId, data);
    }
  };

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        width,
        height,
        background: '#0a0a12',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* 左侧控制面板 */}
      <DirectorPanel />

      {/* 右侧3D画布 */}
      <div style={{ flex: 1, position: 'relative' }}>
        <DirectorCanvas />

        {/* 顶部工具栏 */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            right: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              background: 'rgba(0,0,0,0.7)',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#fff',
              pointerEvents: 'auto',
            }}
          >
            🖱️ 左键旋转 · 右键平移 · 滚轮缩放 · 点击选中物体
          </div>
          <div style={{ display: 'flex', gap: '8px', pointerEvents: 'auto' }}>
            <button
              onClick={handleCameraRef}
              style={{
                padding: '6px 12px',
                background: 'linear-gradient(135deg, #4facfe, #00f2fe)',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              📸 生成机位参考图
            </button>
            <button
              onClick={handleExport}
              style={{
                padding: '6px 12px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              💾 保存场景
            </button>
          </div>
        </div>

        {/* 底部状态栏 */}
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            background: 'rgba(0,0,0,0.7)',
            padding: '4px 10px',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#888',
          }}
        >
          角色: {useDirectorStore.getState().characters.length} · 道具: {useDirectorStore.getState().props.length} · 机位: {useDirectorStore.getState().cameras.length}
        </div>
      </div>
    </div>
  );
}

export { useDirectorStore } from './store';
export * from './types';
