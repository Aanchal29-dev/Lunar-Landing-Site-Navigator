import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { type LunarCoordinate } from "../../domain/coordinates";
import { lunarCoordinateToSurfaceVector, surfaceVectorToLunarCoordinate } from "../../domain/globeCoordinates";

type LunarGlobeProps = {
  selectedCoordinate: LunarCoordinate | null;
  onSelect: (coordinate: LunarCoordinate) => void;
};

type GlobeRuntime = {
  marker: THREE.Group;
  moon: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
};

const MARKER_RADIUS = 1.018;

function moveMarker(marker: THREE.Group, coordinate: LunarCoordinate | null) {
  marker.visible = coordinate !== null;
  if (!coordinate) return;
  const position = lunarCoordinateToSurfaceVector(coordinate, MARKER_RADIUS);
  marker.position.set(position.x, position.y, position.z);
}

function createSelectionMarker() {
  const marker = new THREE.Group();
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.025, 0.04, 32),
    new THREE.MeshBasicMaterial({ color: 0xf4bc55, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }),
  );
  const pin = new THREE.Mesh(
    new THREE.SphereGeometry(0.024, 20, 12),
    new THREE.MeshBasicMaterial({ color: 0xff735c }),
  );
  marker.add(halo, pin);
  return marker;
}

export function LunarGlobe({ selectedCoordinate, onSelect }: LunarGlobeProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<GlobeRuntime | null>(null);
  const onSelectRef = useRef(onSelect);
  const [message, setMessage] = useState("Drag to rotate the Moon. Click a visible surface point to select it.");
  const [renderError, setRenderError] = useState<string | null>(null);

  onSelectRef.current = onSelect;

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (runtime) moveMarker(runtime.marker, selectedCoordinate);
  }, [selectedCoordinate]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let animationFrame = 0;
    let resizeObserver: ResizeObserver | null = null;
    const disposables: Array<THREE.BufferGeometry | THREE.Material | THREE.Texture> = [];

    try {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x07101d);

      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
      camera.position.set(1.85, 0.55, 2.45);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.domElement.className = "lunar-globe-canvas";
      renderer.domElement.setAttribute("aria-hidden", "true");
      renderer.domElement.style.touchAction = "none";
      host.append(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.07;
      controls.enablePan = false;
      controls.minDistance = 1.45;
      controls.maxDistance = 4.5;
      controls.rotateSpeed = 0.65;
      controls.target.set(0, 0, 0);

      scene.add(new THREE.HemisphereLight(0xddeeff, 0x101522, 1.85));
      const keyLight = new THREE.DirectionalLight(0xffffff, 2.3);
      keyLight.position.set(3, 2.5, 4);
      scene.add(keyLight);

      const geometry = new THREE.SphereGeometry(1, 192, 128);
      const material = new THREE.MeshStandardMaterial({ color: 0xd7d4ce, roughness: 0.94, metalness: 0 });
      disposables.push(geometry, material);
      const moon = new THREE.Mesh(geometry, material);
      scene.add(moon);

      const textureLoader = new THREE.TextureLoader();
      const texture = textureLoader.load(
        "/moon.jpg",
        (loadedTexture) => {
          loadedTexture.colorSpace = THREE.SRGBColorSpace;
          loadedTexture.anisotropy = renderer?.capabilities.getMaxAnisotropy() ?? 1;
          material.map = loadedTexture;
          material.needsUpdate = true;
        },
        undefined,
        () => setMessage("The Moon texture could not be loaded. Coordinate selection remains available."),
      );
      disposables.push(texture);

      const marker = createSelectionMarker();
      marker.visible = false;
      scene.add(marker);
      runtimeRef.current = { moon, marker };
      moveMarker(marker, selectedCoordinate);

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let pointerDown: { x: number; y: number } | null = null;

      const selectAtPointer = (event: PointerEvent) => {
        const rect = renderer?.domElement.getBoundingClientRect();
        if (!rect || !renderer) return;
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObject(moon, false)[0];
        if (!hit) return;
        const localPoint = moon.worldToLocal(hit.point.clone());
        const coordinate = surfaceVectorToLunarCoordinate(localPoint);
        moveMarker(marker, coordinate);
        onSelectRef.current(coordinate);
        setMessage(`Selected ${coordinate.latitude_deg.toFixed(4)}°, ${coordinate.longitude_deg.toFixed(4)}° east-positive.`);
      };

      const onPointerDown = (event: PointerEvent) => { pointerDown = { x: event.clientX, y: event.clientY }; };
      const onPointerUp = (event: PointerEvent) => {
        if (pointerDown && Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) < 7) selectAtPointer(event);
        pointerDown = null;
      };
      renderer.domElement.addEventListener("pointerdown", onPointerDown);
      renderer.domElement.addEventListener("pointerup", onPointerUp);

      const resize = () => {
        const { width, height } = host.getBoundingClientRect();
        if (!renderer || width === 0 || height === 0) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      resize();

      const render = () => {
        animationFrame = requestAnimationFrame(render);
        controls.update();
        marker.lookAt(camera.position);
        renderer?.render(scene, camera);
      };
      render();

      return () => {
        cancelAnimationFrame(animationFrame);
        resizeObserver?.disconnect();
        renderer?.domElement.removeEventListener("pointerdown", onPointerDown);
        renderer?.domElement.removeEventListener("pointerup", onPointerUp);
        controls.dispose();
        marker.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((markerMaterial) => markerMaterial.dispose());
        });
        disposables.forEach((item) => item.dispose());
        renderer?.dispose();
        renderer?.domElement.remove();
        runtimeRef.current = null;
      };
    } catch {
      setRenderError("This browser could not start the interactive globe. Use manual coordinates below.");
      return undefined;
    }
  }, []); // The WebGL scene is created once; current selection is synchronized above.

  return <div className="lunar-globe-wrap">
    <div ref={hostRef} className="lunar-globe" aria-label="Interactive lunar globe" />
    <p className="globe-instructions">{renderError ?? message}</p>
    <p className="globe-disclosure">This globe selects latitude and east-positive longitude only. It does not display scientific analysis results.</p>
  </div>;
}
