"use client";

import { useState, useTransition } from "react";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { ActionResult } from "@/features/configuracoes/actions";

/** Executa uma Server Action, mostra erros por campo e mensagem de sucesso/erro. */
export function useActionSubmit<V extends FieldValues, T = undefined>(
  action: (values: V) => Promise<ActionResult<T>>,
  setError?: UseFormSetError<V>,
) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  function submit(values: V, successText = "Alterações salvas.", onOk?: (data?: T) => void) {
    setMessage(null);
    start(async () => {
      const res = await action(values);
      if (res.ok) {
        setMessage({ tone: "success", text: successText });
        onOk?.(res.data);
      } else {
        setMessage({ tone: "danger", text: res.error });
        if (res.fieldErrors && setError) {
          for (const [k, v] of Object.entries(res.fieldErrors)) {
            if (v?.[0]) setError(k as Path<V>, { message: v[0] });
          }
        }
      }
    });
  }

  return { submit, pending, message, setMessage };
}
