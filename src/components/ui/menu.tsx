"use client";

import * as React from "react";
import * as DM from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
  /** Elemento à esquerda (ponto de cor, avatar...). */
  leading?: React.ReactNode;
}

interface FilterMenuProps {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  className?: string;
}

/** Botão em pílula que abre lista de opções com marca na selecionada (filtros e ordenação). */
export function FilterMenu({ label, value, options, onChange, icon, className }: FilterMenuProps) {
  const current = options.find((o) => o.value === value);
  return (
    <DM.Root>
      <DM.Trigger
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs font-medium hover:bg-surface-2 data-[state=open]:border-brand",
          className,
        )}
        aria-label={label}
      >
        {icon}
        <span>{current?.label ?? label}</span>
        <ChevronDown className="size-3.5 text-muted" aria-hidden />
      </DM.Trigger>
      <DM.Portal>
        <DM.Content
          align="start"
          sideOffset={6}
          className="z-50 min-w-48 rounded-xl border border-line bg-surface p-1 shadow-xl"
        >
          <DM.RadioGroup value={value} onValueChange={onChange}>
            {options.map((o) => (
              <DM.RadioItem
                key={o.value}
                value={o.value}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs outline-none data-[highlighted]:bg-surface-2"
              >
                {o.leading}
                <span className="flex-1">{o.label}</span>
                <DM.ItemIndicator>
                  <Check className="size-3.5" aria-hidden />
                </DM.ItemIndicator>
              </DM.RadioItem>
            ))}
          </DM.RadioGroup>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

export const Menu = DM.Root;
export const MenuTrigger = DM.Trigger;

export function MenuContent({ className, ...props }: DM.DropdownMenuContentProps) {
  return (
    <DM.Portal>
      <DM.Content
        sideOffset={6}
        className={cn("z-50 min-w-44 rounded-xl border border-line bg-surface p-1 shadow-xl", className)}
        {...props}
      />
    </DM.Portal>
  );
}

export function MenuItem({ className, ...props }: DM.DropdownMenuItemProps) {
  return (
    <DM.Item
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs outline-none data-[highlighted]:bg-surface-2 data-[disabled]:opacity-50 [&_svg]:size-3.5",
        className,
      )}
      {...props}
    />
  );
}

export function MenuLabel({ className, ...props }: DM.DropdownMenuLabelProps) {
  return <DM.Label className={cn("px-2.5 pt-2 pb-1 text-[10px] font-semibold tracking-wide text-muted uppercase", className)} {...props} />;
}

export function MenuSeparator({ className, ...props }: DM.DropdownMenuSeparatorProps) {
  return <DM.Separator className={cn("my-1 h-px bg-line", className)} {...props} />;
}
