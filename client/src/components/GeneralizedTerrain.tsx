import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { IngredientAnalysis } from "@/lib/robbyCompiler";

type Terrain = NonNullable<IngredientAnalysis["terrain"]>;

export default function GeneralizedTerrain({ terrain }: { terrain: Terrain }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#11100f");
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 8.6, 10.5);
    camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth || 320, host.clientHeight || 220, false);
    host.appendChild(renderer.domElement);

    const grid = terrain.grid_size;
    const geometry = new THREE.PlaneGeometry(8.4, 6.2, grid - 1, grid - 1);
    geometry.rotateX(-Math.PI / 2.55);
    const position = geometry.attributes.position;
    terrain.heights.forEach((height, index) => {
      if (index < position.count) position.setY(index, (height / 255) * 1.2);
    });
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
      color: "#e3442f",
      roughness: 0.88,
      metalness: 0.04,
      wireframe: true,
    });
    const surface = new THREE.Mesh(geometry, material);
    scene.add(surface);
    scene.add(new THREE.AmbientLight("#fff4df", 1.7));
    const key = new THREE.DirectionalLight("#e3442f", 2.2);
    key.position.set(-4, 8, 5);
    scene.add(key);

    let frame = 0;
    let raf = 0;
    const resize = () => {
      const width = host.clientWidth || 320;
      const height = host.clientHeight || 220;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const renderFrame = () => {
      frame += 1;
      surface.rotation.y = Math.sin(frame / 360) * 0.12;
      renderer.render(scene, camera);
    };
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const animate = () => {
      renderFrame();
      raf = requestAnimationFrame(animate);
    };
    if (reduceMotion) renderFrame();
    else animate();
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [terrain]);

  return <div ref={hostRef} className="generalized-terrain" role="img" aria-label="Generalized coarse terrain representation" />;
}
