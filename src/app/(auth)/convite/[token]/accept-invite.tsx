"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth/errors";

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert>{error}</Alert>}
      <Button
        size="lg"
        loading={loading}
        onClick={async () => {
          setLoading(true);
          setError("");
          const supabase = createClient();
          const { error } = await supabase.rpc("accept_invitation", { token });
          if (error) {
            setLoading(false);
            return setError(authErrorMessage(error));
          }
          await supabase.rpc("log_access", { user_agent: navigator.userAgent });
          router.replace("/inicio");
          router.refresh();
        }}
      >
        Aceitar convite
      </Button>
    </div>
  );
}
