import { useInView } from "motion/react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Fragment, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import type { ShopImage } from "@/lib/commerce";
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
}: {
  image: ShopImage | undefined;
  className?: string;
  eager?: boolean;
}) {
  if (!image) return null;
  return (
    <img
      className={className}
      src={image.url}
      alt={image.altText}
      width={image.width}
      height={image.height}
      loading={eager ? "eager" : "lazy"}
    />
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

export function Panel({
  open,
  onOpenChange,
  title,
  children,
  kind = "right",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  kind?: "right" | "search" | "menu" | "bottom" | "zoom";
}) {
  const t = useT();
  const opener = useRef<HTMLElement | null>(null);
  const content = useRef<HTMLDivElement>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="shop-backdrop" />
        <Dialog.Content
          ref={content}
          className={`shop-panel panel-${kind}`}
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            opener.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
            if (kind === "search") {
              event.preventDefault();
              const input = content.current?.querySelector<HTMLInputElement>("input");
              input?.focus();
            }
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
          }}
        >
          <div className="panel-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="icon" size="icon" aria-label={t.common.close}>
                <X />
              </Button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
