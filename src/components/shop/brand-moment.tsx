// Marken-Abschnitt der Startseite: das Axion-Zeichen in 3D, ruhig und klein, dazu eine Zeile Text.
// Die 3D-Szene lädt erst, wenn der Abschnitt in Sicht kommt und das Gerät WebGL kann; sonst bleibt das flache
// Zeichen stehen. Bei «weniger Bewegung» gibt es keine Szene. Ausserhalb des Bildschirms ruht sie.
import { lazy, Suspense, useEffect, useRef, useState, Component, type ReactNode } from "react";
import type { HomeContent } from "@/lib/commerce";
import { Mark } from "./logo";
import { Lines, Reveal } from "./primitives";

const Scene = lazy(() => import("./hero-scene"));

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function BrandMoment({ content }: { content: HomeContent["brand"] }) {
  const ref = useRef<HTMLElement>(null);
  const [reduced, setReduced] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0.5);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
    if (media.matches) return;
    const node = ref.current;
    if (!node) return;
    let visible = false;
    const phone = window.matchMedia("(max-width: 767px)").matches;
    const device = navigator as Navigator & {
      connection?: { saveData?: boolean };
      deviceMemory?: number;
    };
    const permitted = !phone || (!device.connection?.saveData && (device.deviceMemory ?? 4) >= 4);
    // WebGL nur einmal prüfen und den Prüf-Kontext gleich wieder freigeben (Browser erlauben nur wenige)
    let probed = false;
    const enable = () => {
      if (probed || !permitted) return;
      probed = true;
      const canvas = document.createElement("canvas");
      try {
        const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
        if (gl) {
          gl.getExtension("WEBGL_lose_context")?.loseContext();
          setEnabled(true);
        }
      } catch {
        setEnabled(false);
      }
    };
    const update = () => setActive(visible && !document.hidden);
    // Fortschritt durch den Abschnitt: 0 = kommt unten herein, 1 = verlässt oben den Bildschirm.
    // Nur während der Abschnitt in Sicht ist und höchstens einmal pro Bild.
    let frame = 0;
    const measure = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      const total = window.innerHeight + rect.height;
      setProgress(Math.min(Math.max((window.innerHeight - rect.top) / total, 0), 1));
    };
    const scroll = () => {
      if (visible && !frame) frame = requestAnimationFrame(measure);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        update();
        if (visible) {
          enable();
          scroll();
        }
      },
      { rootMargin: "200px 0px", threshold: 0 },
    );
    observer.observe(node);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("scroll", scroll);
    };
  }, []);
  return (
    <section className="brand-moment" ref={ref}>
      <div className="container brand-inner">
        <div className={`brand-mark ${ready ? "scene-ready" : ""}`}>
          <Mark className="flat-mark" aria-hidden="true" />
          {enabled && !reduced && (
            <SceneBoundary>
              <Suspense fallback={null}>
                <Scene active={active} progress={progress} onReady={() => setReady(true)} />
              </Suspense>
            </SceneBoundary>
          )}
        </div>
        <Reveal className="brand-copy">
          <p className="eyebrow">{content.eyebrow}</p>
          <h2>
            <Lines text={content.title} />
          </h2>
        </Reveal>
      </div>
    </section>
  );
}
