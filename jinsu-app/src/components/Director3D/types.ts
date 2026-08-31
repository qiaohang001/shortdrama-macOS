// 3D导演台类型定义

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Character {
  id: string;
  name: string;
  position: Vector3;
  rotation: Vector3; // 朝向
  scale: number;
  color: string;
  lookAtTarget?: string; // 注视目标角色ID
}

export interface Prop {
  id: string;
  name: string;
  type: 'box' | 'sphere' | 'cylinder' | 'plane';
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
  color: string;
}

export interface CameraShot {
  id: string;
  name: string;
  position: Vector3;
  target: Vector3; // 注视点
  fov: number; // 焦距
  aspect: string; // 画幅 16:9 / 9:16 / 1:1 / 2.35:1
  movement: 'static' | 'push' | 'pull' | 'pan' | 'tilt' | 'track' | 'orbit';
  movementSpeed: number;
  thumbnail?: string;
}

export interface SceneConfig {
  background: string;
  groundColor: string;
  fogEnabled: boolean;
  fogColor: string;
  fogDensity: number;
  ambientLightIntensity: number;
  directionalLightIntensity: number;
  directionalLightPosition: Vector3;
}

export interface Director3DState {
  characters: Character[];
  props: Prop[];
  cameras: CameraShot[];
  activeCameraId: string | null;
  selectedCharacterId: string | null;
  selectedPropId: string | null;
  scene: SceneConfig;
  showGrid: boolean;
  showGizmos: boolean;
}

export const DEFAULT_SCENE: SceneConfig = {
  background: '#1a1a2e',
  groundColor: '#16213e',
  fogEnabled: true,
  fogColor: '#1a1a2e',
  fogDensity: 0.02,
  ambientLightIntensity: 0.6,
  directionalLightIntensity: 1.2,
  directionalLightPosition: { x: 5, y: 10, z: 5 },
};

export const ASPECT_RATIOS = [
  { label: '横屏 16:9', value: '16:9', width: 1920, height: 1080 },
  { label: '竖屏 9:16', value: '9:16', width: 1080, height: 1920 },
  { label: '方形 1:1', value: '1:1', width: 1080, height: 1080 },
  { label: '电影 2.35:1', value: '2.35:1', width: 1920, height: 817 },
];

export const CAMERA_MOVEMENTS = [
  { label: '固定', value: 'static' },
  { label: '推镜', value: 'push' },
  { label: '拉镜', value: 'pull' },
  { label: '摇镜', value: 'pan' },
  { label: '俯仰', value: 'tilt' },
  { label: '跟拍', value: 'track' },
  { label: '环绕', value: 'orbit' },
];
