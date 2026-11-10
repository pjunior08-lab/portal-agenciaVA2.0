/** Recriado a cada troca de página: o conteúdo entra com um leve deslize. */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
