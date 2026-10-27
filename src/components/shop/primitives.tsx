import { useInView } from "motion/react";
import { Fragment, useRef, type ReactNode } from "react";
import type { ShopImage } from "@/lib/commerce";
import { buildSrcSet } from "@/lib/commerce/variants";
/** Text mit Zeilenumbrüchen (\n) als <br /> – für Titel aus dem Admin. */
export function Lines({ text }: { text: string }) {
  const parts = text.split("\n");
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {part}
        </Fragment>
      ))}
    </>
  );
}
export function Photo({
  image,
  className = "",
  eager = false,
  priority = false,
  fallback = null,
  sizes,
}: {
  image: ShopImage | undefined;
  className?: string;
  eager?: boolean;
  /** Wichtigstes Bild der Seite (z. B. Einstieg): zuerst laden */
  priority?: boolean;
  /** Wird gezeigt, wenn kein Bild vorhanden ist (Standard: nichts) */
  fallback?: ReactNode;
  /** Anzeigebreite fürs srcset (siehe SIZES in variants.ts); wirkt nur, wenn das Bild Fassungen hat */
  sizes?: string;
}) {
  if (!image) return <>{fallback}</>;
  const srcSet = buildSrcSet(image, image.variants);
  const img = (
    <img
      className={className}
      src={image.url}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt={image.altText}
      width={image.width}
      height={image.height}
      loading={eager || priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
    />
  );
  if (!image.mobile) return img;
  return (
    <picture>
      <source
        media="(max-width: 767px)"
        srcSet={buildSrcSet(image.mobile, image.mobile.variants) ?? image.mobile.url}
        sizes={buildSrcSet(image.mobile, image.mobile.variants) ? sizes : undefined}
        width={image.mobile.width}
        height={image.mobile.height}
      />
      {img}
    </picture>
  );
}
export function Reveal({
  children,
  image = false,
  className = "",
}: {
  children: ReactNode;
  image?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { once: true, margin: "0px 0px 100px 0px", amount: 0.05 });
  return (
    <div ref={ref} className={className}>
      <div className={`reveal ${image ? "reveal-image" : ""} ${visible ? "revealed" : ""}`}>
        {children}
      </div>
    </div>
  );
}
