"use client";

import { ThemeProvider as NextThemes } from "next-themes";

/** Tema claro/escuro salvo no navegador; padrão segue o sistema operacional. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}
