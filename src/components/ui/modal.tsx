"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Título; a parte em `accent` aparece na cor da marca ("Novo **cliente**"). */
  title: string;
  accent?: string;
  description?: string;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  children: React.ReactNode;
}

const widths = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-2xl", xl: "max-w-4xl" };

/** Modal acessível (foco preso, Esc fecha, rolagem interna com rodapé fixo). */
export function Modal({ open, onOpenChange, title, accent, description, footer, size = "md", children }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-surface shadow-2xl focus:outline-none data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in",
            widths[size],
          )}
        >
          <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
            <div>
              <Dialog.Title className="text-base font-semibold">
                {title} {accent && <span className="text-brand-strong">{accent}</span>}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-xs text-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{`${title} ${accent ?? ""}`}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="inline-flex size-8 items-center justify-center rounded-full border border-line text-muted hover:bg-surface-2"
              aria-label="Fechar"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
          {footer && (
            <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
