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
          // Flach wie ein gegossenes Emblem, mit feiner Fase (wirkt edler als ein dicker Block)
          new ExtrudeGeometry(shape, {
            depth: 38,
            bevelEnabled: true,
            bevelThickness: 5,
            bevelSize: 4,
            bevelSegments: 10,
            curveSegments: 64,
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
  // Langsam: Beim Scrollen dreht sich das Zeichen von links nach rechts, dazu ein leichtes Atmen.
  useFrame(({ clock, pointer }, delta) => {
    const group = ref.current;
    if (!group) return;
    const t = clock.elapsedTime;
    if (start.current === null) start.current = t;
    const intro = Math.min((t - start.current) / 2.2, 1);
    const ease = 1 - Math.pow(1 - intro, 3);
    const turn = -30 + progress * 60 + Math.sin((t * Math.PI * 2) / 14) * 3 + pointer.x * 5;
    group.rotation.y = MathUtils.damp(group.rotation.y, MathUtils.degToRad(turn), 2.5, delta);
    group.rotation.x = MathUtils.damp(group.rotation.x, -pointer.y * 0.06, 2.5, delta);
    group.position.y = MathUtils.damp(group.position.y, -0.12 * (1 - ease), 3, delta);
    group.scale.setScalar(0.9 + 0.1 * ease);
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
            metalness={1}
            roughness={0.34}
            anisotropy={0.6}
            anisotropyRotation={Math.PI / 2}
            envMapIntensity={1.25}
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
      <ambientLight intensity={0.08} />
      <directionalLight position={[-3, 4, 5]} color="#F3E2BF" intensity={1.6} />
      {/* Studiolicht: weiches Streiflicht oben links, schmale Kante rechts, wenig Fülllicht */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={5} position={[-4, 3, 3]} scale={[8, 1.2, 1]} />
        <Lightformer form="rect" intensity={3.5} position={[4.5, 0.5, 1]} scale={[0.6, 7, 1]} />
        <Lightformer form="rect" intensity={2.2} position={[-5, -0.5, 2]} scale={[0.8, 6, 1]} />
        <Lightformer form="rect" intensity={1.4} position={[0, -2, 4]} scale={[6, 2, 1]} />
      </Environment>
      <ObjectMark progress={progress} />
    </Canvas>
  );
}
