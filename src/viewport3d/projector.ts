import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { GeometryDocument, Point3 } from "../document/index.ts";
import type { BoxPrimitive } from "./box-commit.ts";
import type { SolidPrimitive } from "./solid-commit.ts";
import { voxelCornerFromWorld } from "./voxel-commit.ts";

/** 底面局部 XZ 点 */
type BasePoint = { x: number; z: number };

/** 有向二倍面积（XZ 平面，z 上）：正值 = 逆时针，法线按约定朝外。 */
function signedArea2x(base: readonly BasePoint[]): number {
  const [a, b, c] = base;
  return (
    (b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z)
  );
}

/**
 * 单位四棱锥几何体：底面 y=0 的 1×1 方形（局部 XZ 逆时针）、顶点 (0,1,0)；
 * 共享几何体，每条图元用 scale(width, height, depth) 放大。
 */
function createPyramidGeometry(): THREE.BufferGeometry {
  const corners: readonly (readonly [number, number])[] = [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
  ];
  const apex: readonly number[] = [0, 1, 0];
  const positions: number[] = [];
  const push = (
    a: readonly number[],
    b: readonly number[],
    c: readonly number[],
  ): void => {
    positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  };
  const at = (corner: readonly [number, number]): readonly number[] => [
    corner[0],
    0,
    corner[1],
  ];
  // 底面两片（法线朝 -Y）
  push(at(corners[0]), at(corners[1]), at(corners[2]));
  push(at(corners[0]), at(corners[2]), at(corners[3]));
  // 侧面四片：每条有向边 (i→j) 一片 (bj, bi, apex)，法线朝外
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    push(at(corners[j]), at(corners[i]), apex);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * 三棱柱几何体：底面三点在局部 XZ、棱柱沿 y∈[0,height]；底三点任意，
 * 顺时针输入先翻转顺序保证面朝外。每条图元自建自毁（ownsGeometry）。
 */
function createPrismGeometry(
  base: readonly BasePoint[],
  height: number,
): THREE.BufferGeometry {
  const order =
    signedArea2x(base) < 0
      ? [base[1], base[0], base[2]]
      : [base[0], base[1], base[2]];
  const bottom = order.map(
    (point): readonly number[] => [point.x, 0, point.z],
  );
  const top = order.map(
    (point): readonly number[] => [point.x, height, point.z],
  );
  const positions: number[] = [];
  const push = (
    a: readonly number[],
    b: readonly number[],
    c: readonly number[],
  ): void => {
    positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  };
  // 底面（法线朝 -Y）与顶面（法线朝 +Y）
  push(bottom[0], bottom[1], bottom[2]);
  push(top[0], top[2], top[1]);
  // 三个侧面：每条有向边 (i→j) 两片，法线朝外
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    push(bottom[j], bottom[i], top[i]);
    push(bottom[j], top[i], top[j]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.computeVertexNormals();
  return geometry;
}

const AXIS_LABELS = [
  { text: "X", color: "#dc2626", position: [6, 0, 0] as const },
  { text: "Y", color: "#16a34a", position: [0, 6, 0] as const },
  { text: "Z", color: "#2563eb", position: [0, 0, 6] as const },
] as const;

const DEG = Math.PI / 180;

/** 跟随指针的放置预览：体素给最小角，参数体给锚点与尺寸 */
export type PlacementPreview =
  | { kind: "voxel"; corner: Point3 }
  | {
      kind: "box";
      anchor: Point3;
      width: number;
      depth: number;
      height: number;
    }
  | { kind: "cylinder" | "cone"; anchor: Point3; r: number; height: number }
  | { kind: "sphere"; center: Point3; r: number }
  | {
      kind: "pyramid";
      anchor: Point3;
      width: number;
      depth: number;
      height: number;
    }
  | {
      kind: "prism";
      anchor: Point3;
      height: number;
      base: readonly BasePoint[];
    }
  | null;

/** 把一条已提交形态的参数体映射成跟随指针的预览（默认尺寸、无旋转）。 */
export function solidPlacementPreview(
  solid: SolidPrimitive,
): Exclude<PlacementPreview, null> {
  switch (solid.type) {
    case "box":
      return {
        kind: "box",
        anchor: { x: solid.x, y: solid.y, z: solid.z },
        width: solid.width,
        depth: solid.depth,
        height: solid.height,
      };
    case "cylinder":
    case "cone":
      return {
        kind: solid.type,
        anchor: { x: solid.x, y: solid.y, z: solid.z },
        r: solid.r,
        height: solid.height,
      };
    case "sphere":
      return {
        kind: "sphere",
        center: { x: solid.x, y: solid.y, z: solid.z },
        r: solid.r,
      };
    case "pyramid":
      return {
        kind: "pyramid",
        anchor: { x: solid.x, y: solid.y, z: solid.z },
        width: solid.width,
        depth: solid.depth,
        height: solid.height,
      };
    case "triangularPrism":
      return {
        kind: "prism",
        anchor: { x: solid.x, y: solid.y, z: solid.z },
        height: solid.height,
        base: solid.base,
      };
  }
}

export type Viewport3dPick =
  | { kind: "empty"; place: Point3; world: Point3 }
  | { kind: "voxel"; id: string; place: Point3; world: Point3 }
  | { kind: "none" };

export type Viewport3dProjector = {
  render: (document: GeometryDocument) => void;
  /** 标记当前选中的体素（高亮材质）；null 清除标记。 */
  setSelection: (id: string | null) => void;
  setPreview: (preview: PlacementPreview) => void;
  pick: (screen: { x: number; y: number }) => Viewport3dPick;
  /** 射线打到指定高度的水平面：体素拖动取指针世界落点用。 */
  pickOnPlane: (screen: { x: number; y: number }, y: number) => Point3 | null;
  resize: (width: number, height: number) => void;
  destroy: () => void;
};

type VoxelUserData = { id: string; x: number; y: number; z: number };

function axisSprite(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (context !== null) {
    context.clearRect(0, 0, 64, 64);
    context.fillStyle = color;
    context.font = "48px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, 32, 32);
  }
  const material = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas),
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.8, 0.8, 0.8);
  return sprite;
}

export function createViewport3dProjector(
  container: HTMLDivElement,
): Viewport3dProjector {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf4f4f5);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
  camera.up.set(0, 1, 0);
  camera.position.set(10, 8, 10);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  container.style.touchAction = "none";
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableRotate = true;
  controls.enablePan = true;
  controls.enableZoom = true;
  // 左键让位给编辑器手势（选择/放置）；中键/右键拖转镜头，滚轮缩放不变。
  controls.mouseButtons = {
    LEFT: null,
    MIDDLE: THREE.MOUSE.ROTATE,
    RIGHT: THREE.MOUSE.ROTATE,
  };
  controls.target.set(0, 0, 0);
  controls.update();

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(6, 10, 4);
  scene.add(sun);

  const grid = new THREE.GridHelper(20, 20, 0xa1a1aa, 0xd4d4d8);
  scene.add(grid);
  scene.add(new THREE.AxesHelper(5));

  for (const axis of AXIS_LABELS) {
    const label = axisSprite(axis.text, axis.color);
    label.position.set(axis.position[0], axis.position[1], axis.position[2]);
    scene.add(label);
  }

  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  // 单位几何体 + 每图元 scale/rotate：圆柱/圆锥半径 1 高 1，球半径 1，四棱锥底 1×1 高 1。
  const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 32);
  const coneGeometry = new THREE.ConeGeometry(1, 1, 32);
  const sphereGeometry = new THREE.SphereGeometry(1, 24, 16);
  const pyramidGeometry = createPyramidGeometry();
  const voxelMaterial = new THREE.MeshLambertMaterial({ color: 0x3b82f6 });
  // 选中体素的高亮：亮黄，与橙色放置预览区分。
  const selectedVoxelMaterial = new THREE.MeshLambertMaterial({
    color: 0xfacc15,
  });
  const solidMaterial = new THREE.MeshLambertMaterial({ color: 0x10b981 });
  const previewMaterial = new THREE.MeshLambertMaterial({
    color: 0xf59e0b,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const voxelGroup = new THREE.Group();
  scene.add(voxelGroup);
  // 参数体与体素分开挂：体素组兼任拾取面，参数体渲染互不干扰
  const solidGroup = new THREE.Group();
  scene.add(solidGroup);

  // 预览网格换几何体不换材质：按预览种类在共享几何体间切换；
  // 三棱柱预览几何体按底面自建，换掉时单独释放
  const previewMesh: THREE.Mesh<THREE.BufferGeometry> = new THREE.Mesh(
    boxGeometry,
    previewMaterial,
  );
  previewMesh.visible = false;
  scene.add(previewMesh);
  let ownedPreviewGeometry: THREE.BufferGeometry | null = null;

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const UP = new THREE.Vector3(0, 1, 0);
  const ground = new THREE.Plane(UP.clone(), 0);
  // 体素拖动平面：与地面同法线、高度随按下格变化。
  const dragPlane = new THREE.Plane(UP.clone(), 0);
  const groundHit = new THREE.Vector3();
  let destroyed = false;
  let selectedId: string | null = null;
  let lastDocument: GeometryDocument | null = null;

  function paint(): void {
    if (destroyed) return;
    renderer.render(scene, camera);
  }

  function placeVoxelMesh(id: string, x: number, y: number, z: number): void {
    const mesh = new THREE.Mesh(
      boxGeometry,
      id === selectedId ? selectedVoxelMaterial : voxelMaterial,
    );
    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    mesh.userData = { id, x, y, z } satisfies VoxelUserData;
    voxelGroup.add(mesh);
  }

  function placeBoxMesh(box: BoxPrimitive): void {
    const mesh = new THREE.Mesh(boxGeometry, solidMaterial);
    // 底面中心定位：中心在 (x, y + height/2, z)；先沿局部轴缩放再整体旋转
    mesh.scale.set(box.width, box.height, box.depth);
    mesh.position.set(box.x, box.y + box.height / 2, box.z);
    mesh.rotation.set(
      box.rotationDegX * DEG,
      box.rotationDegY * DEG,
      box.rotationDegZ * DEG,
      "YXZ",
    );
    solidGroup.add(mesh);
  }

  function placeCylinderMesh(
    solid: Extract<SolidPrimitive, { type: "cylinder" }>,
  ): void {
    const mesh = new THREE.Mesh(cylinderGeometry, solidMaterial);
    mesh.scale.set(solid.r, solid.height, solid.r);
    mesh.position.set(solid.x, solid.y + solid.height / 2, solid.z);
    mesh.rotation.set(
      solid.rotationDegX * DEG,
      solid.rotationDegY * DEG,
      solid.rotationDegZ * DEG,
      "YXZ",
    );
    solidGroup.add(mesh);
  }

  function placeConeMesh(
    solid: Extract<SolidPrimitive, { type: "cone" }>,
  ): void {
    const mesh = new THREE.Mesh(coneGeometry, solidMaterial);
    mesh.scale.set(solid.r, solid.height, solid.r);
    mesh.position.set(solid.x, solid.y + solid.height / 2, solid.z);
    mesh.rotation.set(
      solid.rotationDegX * DEG,
      solid.rotationDegY * DEG,
      solid.rotationDegZ * DEG,
      "YXZ",
    );
    solidGroup.add(mesh);
  }

  function placeSphereMesh(
    solid: Extract<SolidPrimitive, { type: "sphere" }>,
  ): void {
    const mesh = new THREE.Mesh(sphereGeometry, solidMaterial);
    mesh.scale.set(solid.r, solid.r, solid.r);
    mesh.position.set(solid.x, solid.y, solid.z);
    solidGroup.add(mesh);
  }

  function placePyramidMesh(
    solid: Extract<SolidPrimitive, { type: "pyramid" }>,
  ): void {
    const mesh = new THREE.Mesh(pyramidGeometry, solidMaterial);
    // 单位几何体底面在局部 y=0：锚点即底面中心，不再加半高偏移
    mesh.scale.set(solid.width, solid.height, solid.depth);
    mesh.position.set(solid.x, solid.y, solid.z);
    mesh.rotation.set(
      solid.rotationDegX * DEG,
      solid.rotationDegY * DEG,
      solid.rotationDegZ * DEG,
      "YXZ",
    );
    solidGroup.add(mesh);
  }

  function placePrismMesh(
    solid: Extract<SolidPrimitive, { type: "triangularPrism" }>,
  ): void {
    const geometry = createPrismGeometry(solid.base, solid.height);
    const mesh = new THREE.Mesh(geometry, solidMaterial);
    mesh.position.set(solid.x, solid.y, solid.z);
    mesh.rotation.set(
      solid.rotationDegX * DEG,
      solid.rotationDegY * DEG,
      solid.rotationDegZ * DEG,
      "YXZ",
    );
    // 底面任意三角形只能逐条自建几何体：换掉前先按标记释放
    mesh.userData.ownsGeometry = true;
    solidGroup.add(mesh);
  }

  /** 释放组里自建几何体（三棱柱底面任意），共享几何体不在清理之列。 */
  function disposeOwnedGeometries(group: THREE.Group): void {
    for (const child of group.children) {
      if (
        child instanceof THREE.Mesh &&
        child.userData.ownsGeometry === true
      ) {
        child.geometry.dispose();
      }
    }
  }

  controls.addEventListener("change", paint);
  paint();

  function renderDocument(document: GeometryDocument): void {
    lastDocument = document;
    voxelGroup.clear();
    disposeOwnedGeometries(solidGroup);
    solidGroup.clear();
    if (document.space === "3d") {
      for (const primitive of document.primitives) {
        switch (primitive.type) {
          case "voxel":
            placeVoxelMesh(primitive.id, primitive.x, primitive.y, primitive.z);
            break;
          case "box":
            placeBoxMesh(primitive);
            break;
          case "cylinder":
            placeCylinderMesh(primitive);
            break;
          case "cone":
            placeConeMesh(primitive);
            break;
          case "sphere":
            placeSphereMesh(primitive);
            break;
          case "pyramid":
            placePyramidMesh(primitive);
            break;
          case "triangularPrism":
            placePrismMesh(primitive);
            break;
        }
      }
    }
    paint();
  }

  return {
    render: renderDocument,
    setSelection(id: string | null): void {
      if (selectedId === id) return;
      selectedId = id;
      // 换材质要重建 mesh：重放最近一次说明书即可。
      if (lastDocument !== null) {
        renderDocument(lastDocument);
      }
    },
    setPreview(preview: PlacementPreview): void {
      if (ownedPreviewGeometry !== null) {
        ownedPreviewGeometry.dispose();
        ownedPreviewGeometry = null;
      }
      if (preview === null) {
        previewMesh.visible = false;
        paint();
        return;
      }
      previewMesh.rotation.set(0, 0, 0);
      previewMesh.scale.set(1, 1, 1);
      switch (preview.kind) {
        case "voxel":
          previewMesh.geometry = boxGeometry;
          previewMesh.position.set(
            preview.corner.x + 0.5,
            preview.corner.y + 0.5,
            preview.corner.z + 0.5,
          );
          break;
        case "box":
          previewMesh.geometry = boxGeometry;
          previewMesh.scale.set(preview.width, preview.height, preview.depth);
          previewMesh.position.set(
            preview.anchor.x,
            preview.anchor.y + preview.height / 2,
            preview.anchor.z,
          );
          break;
        case "cylinder":
        case "cone":
          previewMesh.geometry =
            preview.kind === "cylinder" ? cylinderGeometry : coneGeometry;
          previewMesh.scale.set(preview.r, preview.height, preview.r);
          previewMesh.position.set(
            preview.anchor.x,
            preview.anchor.y + preview.height / 2,
            preview.anchor.z,
          );
          break;
        case "sphere":
          previewMesh.geometry = sphereGeometry;
          previewMesh.scale.set(preview.r, preview.r, preview.r);
          previewMesh.position.set(
            preview.center.x,
            preview.center.y,
            preview.center.z,
          );
          break;
        case "pyramid":
          previewMesh.geometry = pyramidGeometry;
          previewMesh.scale.set(preview.width, preview.height, preview.depth);
          previewMesh.position.set(
            preview.anchor.x,
            preview.anchor.y,
            preview.anchor.z,
          );
          break;
        case "prism":
          ownedPreviewGeometry = createPrismGeometry(
            preview.base,
            preview.height,
          );
          previewMesh.geometry = ownedPreviewGeometry;
          previewMesh.position.set(
            preview.anchor.x,
            preview.anchor.y,
            preview.anchor.z,
          );
          break;
      }
      previewMesh.visible = true;
      paint();
    },
    pickOnPlane(screen: { x: number; y: number }, y: number): Point3 | null {
      const width = Math.max(1, renderer.domElement.clientWidth);
      const height = Math.max(1, renderer.domElement.clientHeight);
      pointer.x = (screen.x / width) * 2 - 1;
      pointer.y = -(screen.y / height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      dragPlane.set(UP, -y);
      const hit = raycaster.ray.intersectPlane(dragPlane, groundHit);
      return hit === null ? null : { x: hit.x, y: hit.y, z: hit.z };
    },
    pick(screen: { x: number; y: number }): Viewport3dPick {
      const width = Math.max(1, renderer.domElement.clientWidth);
      const height = Math.max(1, renderer.domElement.clientHeight);
      pointer.x = (screen.x / width) * 2 - 1;
      pointer.y = -(screen.y / height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const hit = raycaster.intersectObjects(voxelGroup.children, false)[0];
      const face = hit?.face;
      if (hit !== undefined && face !== undefined && face !== null) {
        const data = hit.object.userData as VoxelUserData;
        const normal = face.normal.clone();
        normal.transformDirection(hit.object.matrixWorld);
        return {
          kind: "voxel",
          id: data.id,
          place: {
            x: data.x + Math.round(normal.x),
            y: data.y + Math.round(normal.y),
            z: data.z + Math.round(normal.z),
          },
          // 指针在体素面上的原始世界落点：参数体吃它，不吃整数角
          world: { x: hit.point.x, y: hit.point.y, z: hit.point.z },
        };
      }

      if (raycaster.ray.intersectPlane(ground, groundHit) === null) {
        return { kind: "none" };
      }
      return {
        kind: "empty",
        place: voxelCornerFromWorld({
          x: groundHit.x,
          y: 0,
          z: groundHit.z,
        }),
        world: { x: groundHit.x, y: 0, z: groundHit.z },
      };
    },
    resize(width: number, height: number): void {
      const nextWidth = Math.max(1, Math.floor(width));
      const nextHeight = Math.max(1, Math.floor(height));
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight, false);
      paint();
    },
    destroy(): void {
      destroyed = true;
      controls.removeEventListener("change", paint);
      controls.dispose();
      voxelGroup.clear();
      disposeOwnedGeometries(solidGroup);
      solidGroup.clear();
      if (ownedPreviewGeometry !== null) {
        ownedPreviewGeometry.dispose();
        ownedPreviewGeometry = null;
      }
      boxGeometry.dispose();
      cylinderGeometry.dispose();
      coneGeometry.dispose();
      sphereGeometry.dispose();
      pyramidGeometry.dispose();
      voxelMaterial.dispose();
      selectedVoxelMaterial.dispose();
      solidMaterial.dispose();
      previewMaterial.dispose();
      scene.traverse((object) => {
        if (!(object instanceof THREE.Sprite)) return;
        const material = object.material;
        material.map?.dispose();
        material.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
