import Image from "next/image";
import { ThemeToggle } from "@/components/shell/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <Image src="/brand/simbolo-amarelo.png" alt="" width={56} height={56} className="size-14 rounded-2xl" priority />
        <p className="text-lg font-semibold tracking-tight">
          Vai Aonde Capixaba<span className="text-brand-strong">?</span>
        </p>
      </div>
      <main className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-sm">{children}</main>
      <ThemeToggle />
    </div>
  );
}
