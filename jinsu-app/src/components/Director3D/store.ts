import { create } from 'zustand';
import {
  Character,
  Prop,
  CameraShot,
  SceneConfig,
  DEFAULT_SCENE,
  Vector3,
} from './types';

const genId = () => Math.random().toString(36).substring(2, 10);

interface DirectorStore {
  // 状态
  characters: Character[];
  props: Prop[];
  cameras: CameraShot[];
  activeCameraId: string | null;
  selectedCharacterId: string | null;
  selectedPropId: string | null;
  scene: SceneConfig;
  showGrid: boolean;
  showGizmos: boolean;

  // 角色操作
  addCharacter: (name?: string) => void;
  updateCharacter: (id: string, updates: Partial<Character>) => void;
  removeCharacter: (id: string) => void;
  selectCharacter: (id: string | null) => void;

  // 道具操作
  addProp: (type: Prop['type']) => void;
  updateProp: (id: string, updates: Partial<Prop>) => void;
  removeProp: (id: string) => void;
  selectProp: (id: string | null) => void;

  // 机位操作
  addCamera: (position: Vector3, target: Vector3) => void;
  updateCamera: (id: string, updates: Partial<CameraShot>) => void;
  removeCamera: (id: string) => void;
  setActiveCamera: (id: string | null) => void;

  // 场景操作
  updateScene: (updates: Partial<SceneConfig>) => void;
  toggleGrid: () => void;
  toggleGizmos: () => void;

  // 导出
  exportScene: () => object;
  exportCameraReference: (cameraId: string) => object;
}

export const useDirectorStore = create<DirectorStore>((set, get) => ({
  characters: [
    {
      id: 'char-1',
      name: '主角',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: 1,
      color: '#4facfe',
    },
    {
      id: 'char-2',
      name: '反派',
      position: { x: 3, y: 0, z: 0 },
      rotation: { x: 0, y: Math.PI, z: 0 },
      scale: 1,
      color: '#f5576c',
    },
  ],
  props: [],
  cameras: [],
  activeCameraId: null,
  selectedCharacterId: null,
  selectedPropId: null,
  scene: DEFAULT_SCENE,
  showGrid: true,
  showGizmos: true,

  addCharacter: (name) => {
    const id = genId();
    const count = get().characters.length;
    set((s) => ({
      characters: [
        ...s.characters,
        {
          id,
          name: name || `角色${count + 1}`,
          position: { x: count * 2, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: 1,
          color: `hsl(${Math.random() * 360}, 70%, 60%)`,
        },
      ],
    }));
  },

  updateCharacter: (id, updates) =>
    set((s) => ({
      characters: s.characters.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),

  removeCharacter: (id) =>
    set((s) => ({
      characters: s.characters.filter((c) => c.id !== id),
      selectedCharacterId:
        s.selectedCharacterId === id ? null : s.selectedCharacterId,
    })),

  selectCharacter: (id) => set({ selectedCharacterId: id, selectedPropId: null }),

  addProp: (type) => {
    const id = genId();
    const count = get().props.length;
    const colors: Record<string, string> = {
      box: '#a8edea',
      sphere: '#fed6e3',
      cylinder: '#d299c2',
      plane: '#fef9d7',
    };
    set((s) => ({
      props: [
        ...s.props,
        {
          id,
          name: `道具${count + 1}`,
          type,
          position: { x: -2 + count * 1.5, y: type === 'plane' ? 0 : 0.5, z: 2 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          color: colors[type] || '#ccc',
        },
      ],
    }));
  },

  updateProp: (id, updates) =>
    set((s) => ({
      props: s.props.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),

  removeProp: (id) =>
    set((s) => ({
      props: s.props.filter((p) => p.id !== id),
      selectedPropId: s.selectedPropId === id ? null : s.selectedPropId,
    })),

  selectProp: (id) => set({ selectedPropId: id, selectedCharacterId: null }),

  addCamera: (position, target) => {
    const id = genId();
    const count = get().cameras.length;
    set((s) => ({
      cameras: [
        ...s.cameras,
        {
          id,
          name: `镜头${count + 1}`,
          position: { ...position },
          target: { ...target },
          fov: 50,
          aspect: '16:9',
          movement: 'static',
          movementSpeed: 1,
        },
      ],
      activeCameraId: id,
    }));
  },

  updateCamera: (id, updates) =>
    set((s) => ({
      cameras: s.cameras.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),

  removeCamera: (id) =>
    set((s) => ({
      cameras: s.cameras.filter((c) => c.id !== id),
      activeCameraId: s.activeCameraId === id ? null : s.activeCameraId,
    })),

  setActiveCamera: (id) => set({ activeCameraId: id }),

  updateScene: (updates) =>
    set((s) => ({ scene: { ...s.scene, ...updates } })),

  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleGizmos: () => set((s) => ({ showGizmos: !s.showGizmos })),

  exportScene: () => {
    const { characters, props, cameras, scene } = get();
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      characters,
      props,
      cameras,
      scene,
    };
  },

  exportCameraReference: (cameraId) => {
    const camera = get().cameras.find((c) => c.id === cameraId);
    const { characters, props, scene } = get();
    if (!camera) return {};
    return {
      camera,
      characters: characters.map((c) => ({
        name: c.name,
        position: c.position,
        rotation: c.rotation,
        color: c.color,
      })),
      props,
      scene: {
        background: scene.background,
        fog: scene.fogEnabled,
      },
      prompt: `镜头：${camera.name}，画幅：${camera.aspect}，运镜：${camera.movement}。场景包含${characters.length}个角色：${characters.map((c) => c.name).join('、')}。`,
    };
  },
}));
