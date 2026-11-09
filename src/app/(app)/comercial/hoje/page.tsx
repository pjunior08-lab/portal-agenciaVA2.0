import type { Metadata } from "next";
import { TodayApp } from "./today-app";

export const metadata: Metadata = { title: "Comercial · Hoje" };

export default function HojePage() {
  return <TodayApp />;
}
