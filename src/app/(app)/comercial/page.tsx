import type { Metadata } from "next";
import { FunnelApp } from "./funnel-app";

export const metadata: Metadata = { title: "Comercial" };

export default function ComercialPage() {
  return <FunnelApp />;
}
