import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { GeometryDocument, Point3 } from "../document/index.ts";
import { voxelCornerFromWorld } from "./voxel-commit.ts";

const AXIS_LABELS = [
  { text: "X", color: "#dc2626", position: [6, 0, 0] as const },
  { text: "Y", color: "#16a34a", position: [0, 6, 0] as const },
  { text: "Z", color: "#2563eb", position: [0, 0, 6] as const },
] as const;

export type VoxelPreview = Point3 | null;

export type Viewport3dPick =
  | { kind: "empty"; place: Point3 }
  | { kind: "voxel"; id: string; place: Point3 }
  | { kind: "none" };

export type Viewport3dProjector = {
  render: (document: GeometryDocument) => void;
  setPreview: (gesture: VoxelPreview) => void;
  pick: (screen: { x: number; y: number }) => Viewport3dPick;
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
  const voxelMaterial = new THREE.MeshLambertMaterial({ color: 0x3b82f6 });
  const previewMaterial = new THREE.MeshLambertMaterial({
    color: 0xf59e0b,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const voxelGroup = new THREE.Group();
  scene.add(voxelGroup);

  const previewMesh = new THREE.Mesh(boxGeometry, previewMaterial);
  previewMesh.visible = false;
  scene.add(previewMesh);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const groundHit = new THREE.Vector3();
  let destroyed = false;

  function paint(): void {
    if (destroyed) return;
    renderer.render(scene, camera);
  }

  function placeVoxelMesh(id: string, x: number, y: number, z: number): void {
    const mesh = new THREE.Mesh(boxGeometry, voxelMaterial);
    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    mesh.userData = { id, x, y, z } satisfies VoxelUserData;
    voxelGroup.add(mesh);
  }

  controls.addEventListener("change", paint);
  paint();

  return {
    render(document: GeometryDocument): void {
      voxelGroup.clear();
      if (document.space === "3d") {
        for (const primitive of document.primitives) {
          if (primitive.type === "voxel") {
            placeVoxelMesh(primitive.id, primitive.x, primitive.y, primitive.z);
          }
        }
      }
      paint();
    },
    setPreview(gesture: VoxelPreview): void {
      if (gesture === null) {
        previewMesh.visible = false;
        paint();
        return;
      }
      previewMesh.position.set(
        gesture.x + 0.5,
        gesture.y + 0.5,
        gesture.z + 0.5,
      );
      previewMesh.visible = true;
      paint();
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
      boxGeometry.dispose();
      voxelMaterial.dispose();
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
