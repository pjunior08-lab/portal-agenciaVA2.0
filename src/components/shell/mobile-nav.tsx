"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { Brand } from "./brand";
import { SidebarContent, type ShellUser } from "./sidebar";
import { NotificationBell } from "./notification-bell";

/** Barra superior com botão que abre o menu em gaveta (telas menores que 1024 px). */
export function MobileNav({ user }: { user: ShellUser }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-2 backdrop-blur lg:hidden print:hidden">
      <Brand />
      <div className="flex items-center gap-1">
        <NotificationBell className="size-10 bg-surface" />
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger
            className="inline-flex size-10 items-center justify-center rounded-full bg-surface"
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
            <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-bg p-3 shadow-2xl focus:outline-none data-[state=closed]:animate-drawer-out data-[state=open]:animate-drawer-in">
              <Dialog.Title className="sr-only">Menu</Dialog.Title>
              <Dialog.Description className="sr-only">Navegação entre os módulos</Dialog.Description>
              <Dialog.Close
                className="absolute top-3 right-3 z-10 inline-flex size-9 items-center justify-center rounded-full bg-surface"
                aria-label="Fechar menu"
              >
                <X className="size-4" />
              </Dialog.Close>
              <SidebarContent user={user} onNavigate={() => setOpen(false)} hideBell />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </div>
  );
}
