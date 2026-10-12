import { lazy, Suspense, useEffect, useRef, useState, Component, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useLocaleParam, useT } from "@/i18n";
import type { HomeContent } from "@/lib/commerce";
import { Mark } from "./logo";
import { Lines } from "./primitives";
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
export function Hero({ content }: { content: HomeContent["hero"] }) {
  const t = useT();
  const lp = useLocaleParam();
  const ref = useRef<HTMLElement>(null);
  const [reduced, setReduced] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(true);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
    if (media.matches) return;
    const node = ref.current;
    if (!node) return;
    let visible = true;
    let scheduled = false;
    let loaded = false;
    let idle: number | undefined;
    let fallback: number | undefined;
    const phone = window.matchMedia("(max-width: 767px)").matches;
    const device = navigator as Navigator & {
      connection?: { saveData?: boolean };
      deviceMemory?: number;
    };
    const permitted = !phone || (!device.connection?.saveData && (device.deviceMemory ?? 4) >= 4);
    const enable = () => {
      if (!permitted || scheduled) return;
      scheduled = true;
      const load = () => {
        if (loaded) return;
        loaded = true;
        if (idle !== undefined) window.cancelIdleCallback(idle);
        if (fallback !== undefined) window.clearTimeout(fallback);
        const canvas = document.createElement("canvas");
        try {
          if (canvas.getContext("webgl2") || canvas.getContext("webgl")) setEnabled(true);
        } catch {
          setEnabled(false);
        }
      };
      if (phone) {
        if ("requestIdleCallback" in window)
          idle = window.requestIdleCallback(load, { timeout: 2000 });
        fallback = window.setTimeout(load, 2000);
      } else requestAnimationFrame(load);
    };
    const update = () => setActive(visible && !document.hidden);
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        update();
        if (visible) enable();
      },
      { threshold: 0.05 },
    );
    observer.observe(node);
    document.addEventListener("visibilitychange", update);
    const scroll = () => setProgress(Math.min(window.scrollY / node.offsetHeight, 1));
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      observer.disconnect();
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if (fallback !== undefined) window.clearTimeout(fallback);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("scroll", scroll);
    };
  }, []);
  return (
    <section className="hero" ref={ref}>
      <div className="container hero-inner">
        <div className="hero-copy">
          <p className="eyebrow">{content.eyebrow}</p>
          <h1>
            <Lines text={content.title} />
          </h1>
          <p>{content.text}</p>
          <div className="hero-buttons">
            <Button variant="dark" asChild>
              <Link to="/{-$locale}/kollektion/$handle" params={{ locale: lp, handle: "alle" }}>
                {content.primary}
              </Link>
            </Button>
            <Button variant="tailored" asChild>
              <Link to="/{-$locale}/kollektion/$handle" params={{ locale: lp, handle: "anzuege" }}>
                {content.secondary}
              </Link>
            </Button>
          </div>
        </div>
        <div className={`hero-mark ${ready ? "scene-ready" : ""}`}>
          <Mark className="flat-mark" aria-hidden="true" />
          {enabled && !reduced && (
            <SceneBoundary>
              <Suspense fallback={null}>
                <Scene active={active} progress={progress} onReady={() => setReady(true)} />
              </Suspense>
            </SceneBoundary>
          )}
        </div>
      </div>
      <div className="hero-bottom">
        <a className="scroll-cue" href="#kollektionen" aria-label={t.home.scrollCue} />
        <span>{t.home.location}</span>
      </div>
    </section>
  );
}
