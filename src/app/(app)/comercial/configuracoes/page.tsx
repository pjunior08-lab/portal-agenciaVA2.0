import type { Metadata } from "next";
import { SettingsApp } from "./settings-app";

export const metadata: Metadata = { title: "Comercial · Configurações" };

export default function ConfiguracoesComercialPage() {
  return <SettingsApp />;
}
