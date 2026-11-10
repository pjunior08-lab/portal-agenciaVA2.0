"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

/** Sai da conta neste aparelho (ou em todos, com scope="global"). */
export function SignOutButton({
  scope = "local",
  label = "Sair",
  ...props
}: { scope?: "local" | "global"; label?: string } & Omit<ButtonProps, "onClick">) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <Button
      variant="ghost"
      title={label}
      {...props}
      loading={loading}
      onClick={async () => {
        setLoading(true);
        await createClient().auth.signOut({ scope });
        router.replace(scope === "global" ? "/login?motivo=sessoes-encerradas" : "/login");
        router.refresh();
      }}
    >
      <LogOut aria-hidden />
      <span className="nav-label">{label}</span>
    </Button>
  );
}
