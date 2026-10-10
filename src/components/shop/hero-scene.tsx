import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { ExtrudeGeometry, Box3, Vector3, MathUtils, Color, Group } from "three";
import { useEffect, useMemo, useRef } from "react";
import { FitCamera } from "./fit-camera";
import { markPath } from "./logo";
function ObjectMark({ progress }: { progress: number }) {
  const ref = useRef<Group>(null);
  const start = useRef<number | null>(null);
  const geometries = useMemo(() => {
    const paths = new SVGLoader().parse(
      `<svg xmlns="http://www.w3.org/2000/svg"><path d="${markPath}"/></svg>`,
    ).paths;
    const geos = paths.flatMap((path) =>
      SVGLoader.createShapes(path).map(
        (shape) =>
          new ExtrudeGeometry(shape, {
            depth: 120,
            bevelEnabled: true,
            bevelThickness: 10,
            bevelSize: 10,
            bevelSegments: 6,
            curveSegments: 48,
          }),
      ),
    );
    const box = new Box3();
    geos.forEach((g) => {
      g.computeBoundingBox();
      if (g.boundingBox) box.union(g.boundingBox);
    });
    const center = box.getCenter(new Vector3());
    geos.forEach((g) => {
      g.translate(-center.x, -center.y, -center.z);
      g.scale(0.0031, -0.0031, 0.0031);
      const positions = g.getAttribute("position");
      for (let i = 0; i < positions.count; i += 3) {
        const b = new Vector3().fromBufferAttribute(positions, i + 1);
        const c = new Vector3().fromBufferAttribute(positions, i + 2);
        positions.setXYZ(i + 1, c.x, c.y, c.z);
        positions.setXYZ(i + 2, b.x, b.y, b.z);
      }
      g.computeVertexNormals();
    });
    return geos;
  }, []);
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);
  useFrame(({ clock, pointer }, delta) => {
    const group = ref.current;
    if (!group) return;
    const t = clock.elapsedTime;
    if (start.current === null) start.current = t;
    const intro = Math.min((t - start.current) / 1.6, 1);
    const ease = 1 - Math.pow(1 - intro, 3);
    group.rotation.y = MathUtils.damp(
      group.rotation.y,
      MathUtils.degToRad(
        -25 * (1 - ease) + Math.sin((t * Math.PI * 2) / 9) * 14 * ease + pointer.x * 10,
      ),
      5,
      delta,
    );
    group.rotation.x = MathUtils.damp(group.rotation.x, -pointer.y * 0.12, 4, delta);
    group.position.y = MathUtils.damp(
      group.position.y,
      -0.31 * (1 - ease) + progress * 0.18,
      5,
      delta,
    );
    group.scale.setScalar(1 - progress * 0.1);
  });
  const brass = useMemo(
    () =>
      new Color(
        getComputedStyle(document.documentElement).getPropertyValue("--gold-three").trim() ||
          "#B8955A",
      ),
    [],
  );
  return (
    <group ref={ref}>
      {geometries.map((geometry, i) => (
        <mesh key={i} geometry={geometry}>
          <meshPhysicalMaterial
            color={brass}
            envMapIntensity={2}
            metalness={0.9}
            roughness={0.3}
            clearcoat={0.2}
          />
        </mesh>
      ))}
    </group>
  );
}
export default function HeroScene({
  active,
  progress,
  onReady,
}: {
  active: boolean;
  progress: number;
  onReady: () => void;
}) {
  return (
    <Canvas
      className="hero-canvas"
      aria-hidden="true"
      camera={{ position: [0, 0, 6], fov: 40 }}
      dpr={[1, 1.75]}
      frameloop={active ? "always" : "never"}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        onReady();
      }}
    >
      <FitCamera />
      <ambientLight intensity={0.25} />
      <directionalLight position={[-4, 5, 4]} color="#F5E4C1" intensity={4} />
      <Environment resolution={128}>
        <Lightformer intensity={8} position={[-3, 3, 4]} scale={[5, 5, 1]} />
        <Lightformer intensity={4} position={[0, 0, 5]} scale={[5, 5, 1]} />
        <Lightformer intensity={2} position={[4, 1, 2]} scale={[2, 4, 1]} />
        <Lightformer intensity={1.5} position={[0, -3, 3]} scale={[5, 1, 1]} />
      </Environment>
      <ObjectMark progress={progress} />
    </Canvas>
  );
}
