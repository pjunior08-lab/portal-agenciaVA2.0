import type { Metadata } from "next";
import { ListApp } from "./list-app";

export const metadata: Metadata = { title: "Comercial · Lista" };

export default function ListaPage() {
  return <ListApp />;
}
