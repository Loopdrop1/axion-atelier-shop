import { useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import { PerspectiveCamera } from "three";
export function FitCamera() {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const aspect = size.width / Math.max(size.height, 1);
    camera.position.z = Math.max(6, 5.3 / Math.max(aspect, 0.1));
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}
