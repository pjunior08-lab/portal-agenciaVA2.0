import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants, EmptyState, Card } from "@/components/ui";

export default function NotFound() {
  return (
    <Card>
      <EmptyState
        icon={SearchX}
        title="Página não encontrada"
        description="O endereço não existe ou foi movido."
        action={
          <Link href="/inicio" className={buttonVariants()}>
            Voltar ao início
          </Link>
        }
      />
    </Card>
  );
}
