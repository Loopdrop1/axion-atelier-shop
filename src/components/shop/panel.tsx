import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";

/** Dialog-Panel (Radix). Eigenes Modul, damit Dialog nicht im ersten Ladevorgang landet. */
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
