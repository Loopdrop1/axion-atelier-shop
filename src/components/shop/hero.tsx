// Einstieg der Startseite: Bild oder Video über die ganze Breite, Text unten links.
// Bild und Video kommen aus dem Admin (Startseite → Einstieg); ohne eigenes Bild das Look-Foto.
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocaleParam, useT } from "@/i18n";
import type { HomeContent } from "@/lib/commerce";
import { Lines, Photo } from "./primitives";

type HeroVideoSource = HomeContent["hero"]["video"];

/** Stummes Video in Schleife über dem Bild. Nicht bei «weniger Bewegung» oder Datensparmodus; aufs Handy
 *  nur ein eigenes Hochformat-Video (spart Daten, ein Querformat wäre stark beschnitten). Pausiert
 *  ausserhalb des Bildschirms und lässt sich anhalten. Erst sichtbar, wenn es läuft (kein schwarzes Bild). */
function useHeroVideo(video: HeroVideoSource) {
  const ref = useRef<HTMLVideoElement>(null);
  const stopped = useRef(false);
  const [src, setSrc] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const url = video?.url;
  const mobileUrl = video?.mobileUrl;
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const device = navigator as Navigator & { connection?: { saveData?: boolean } };
    if (reduced || device.connection?.saveData) return;
    const phone = window.matchMedia("(max-width: 767px)").matches;
    setSrc((phone ? mobileUrl : url) ?? null);
  }, [url, mobileUrl]);
  useEffect(() => {
    const node = ref.current;
    if (!node || !src) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !stopped.current) void node.play().catch(() => undefined);
        else node.pause();
      },
      { threshold: 0.05 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [src]);
  const toggle = () => {
    const node = ref.current;
    if (!node) return;
    stopped.current = !stopped.current;
    setPaused(stopped.current);
    if (stopped.current) node.pause();
    else void node.play().catch(() => undefined);
  };
  return { ref, src, playing, paused, toggle, onPlaying: () => setPlaying(true) };
}

export function Hero({ content }: { content: HomeContent["hero"] }) {
  const t = useT();
  const lp = useLocaleParam();
  const video = useHeroVideo(content.video);
  return (
    <section className="hero">
      <div className="hero-media">
        <Photo image={content.image} eager priority className="hero-image" />
        {video.src && (
          <video
            ref={video.ref}
            className={`hero-video ${video.playing ? "playing" : ""}`}
            src={video.src}
            muted
            loop
            playsInline
            autoPlay
            preload="auto"
            aria-hidden="true"
            tabIndex={-1}
            onPlaying={video.onPlaying}
          />
        )}
      </div>
      <div className="container hero-inner">
        <div className="hero-copy">
          <p className="eyebrow">{content.eyebrow}</p>
          <h1>
            <Lines text={content.title} />
          </h1>
          {content.text && <p>{content.text}</p>}
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
      </div>
      <div className="hero-bottom">
        <a className="scroll-cue" href="#kollektionen" aria-label={t.home.scrollCue} />
        <div className="hero-bottom-end">
          {video.src && (
            <button
              type="button"
              className="hero-video-toggle"
              aria-label={video.paused ? t.home.videoPlay : t.home.videoPause}
              onClick={video.toggle}
            >
              {video.paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
            </button>
          )}
          <span className="hero-location">{t.home.location}</span>
        </div>
      </div>
    </section>
  );
}
