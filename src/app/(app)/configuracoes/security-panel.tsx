"use client";

import { useCallback, useEffect, useState } from "react";
import { History, LogOut, ShieldCheck } from "lucide-react";
import { Alert, Badge, Button, EmptyState, Field, Input, SectionCard, Skeleton } from "@/components/ui";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth/errors";

interface HistoryItem {
  id: number;
  at: string;
  userAgent: string | null;
}

const when = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

/** Resume o navegador a partir do user agent (sem bibliotecas). */
function device(ua: string | null) {
  if (!ua) return "Aparelho não identificado";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  return os ? `${br} no ${os}` : br;
}

export function SecurityPanel({ history }: { history: HistoryItem[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <TwoFactorCard />
      <SectionCard title="Sessões abertas" icon={LogOut} description="Esqueceu a conta aberta em outro computador?">
        <p className="mb-4 text-sm text-muted">Encerra a sessão em todos os aparelhos, inclusive este.</p>
        <SignOutButton scope="global" variant="secondary" label="Sair de todos os aparelhos" />
      </SectionCard>
      <SectionCard title="Histórico de acessos" icon={History} description="Seus últimos 15 logins." className="lg:col-span-2">
        {history.length === 0 ? (
          <EmptyState icon={History} title="Nenhum acesso registrado ainda" />
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span>{device(h.userAgent)}</span>
                <span className="text-xs text-muted tabular-nums">{when.format(new Date(h.at))}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

type Enrollment = { factorId: string; qr: string; secret: string };

function TwoFactorCard() {
  const [loading, setLoading] = useState(true);
  const [verifiedId, setVerifiedId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await createClient().auth.mfa.listFactors();
    if (error) setMessage({ tone: "danger", text: authErrorMessage(error) });
    setVerifiedId(data?.totp.find((f) => f.status === "verified")?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function start() {
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    // remove tentativas anteriores não concluídas
    const { data: list } = await supabase.auth.mfa.listFactors();
    for (const f of list?.all ?? []) if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `App ${Date.now()}` });
    setBusy(false);
    if (error || !data) return setMessage({ tone: "danger", text: authErrorMessage(error) });
    setEnrolling({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirm() {
    if (!enrolling) return;
    if (!/^\d{6}$/.test(code.trim())) return setMessage({ tone: "danger", text: "O código tem 6 números." });
    setBusy(true);
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: enrolling.factorId, code: code.trim() });
    setBusy(false);
    if (error) return setMessage({ tone: "danger", text: authErrorMessage(error) });
    setEnrolling(null);
    setCode("");
    setMessage({ tone: "success", text: "Verificação em duas etapas ativada." });
    await load();
  }

  async function disable() {
    if (!verifiedId) return;
    setBusy(true);
    const { error } = await createClient().auth.mfa.unenroll({ factorId: verifiedId });
    setBusy(false);
    if (error) return setMessage({ tone: "danger", text: authErrorMessage(error) });
    setMessage({ tone: "success", text: "Verificação em duas etapas desativada." });
    await load();
  }

  return (
    <SectionCard
      title="Verificação em duas etapas"
      icon={ShieldCheck}
      description="Além da senha, pede um código do app autenticador (Google Authenticator, Authy...)."
      action={!loading && <Badge tone={verifiedId ? "success-soft" : "neutral"}>{verifiedId ? "Ativada" : "Desativada"}</Badge>}
    >
      <div className="flex flex-col gap-4">
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        {loading ? (
          <Skeleton className="h-9 w-40" />
        ) : enrolling ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">1. No app autenticador, leia este código QR:</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- QR gerado pelo Supabase como data URL */}
            <img src={enrolling.qr} alt="Código QR para o app autenticador" className="size-44 rounded-xl bg-white p-2" />
            <p className="text-xs text-muted">
              Sem câmera? Digite a chave: <code className="font-mono break-all">{enrolling.secret}</code>
            </p>
            <Field label="2. Digite o código de 6 números" htmlFor="totp">
              <Input
                id="totp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </Field>
            <div className="flex gap-2">
              <Button onClick={confirm} loading={busy}>
                Ativar
              </Button>
              <Button variant="secondary" onClick={() => setEnrolling(null)} disabled={busy}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : verifiedId ? (
          <Button variant="danger-outline" onClick={disable} loading={busy} className="self-start">
            Desativar
          </Button>
        ) : (
          <Button onClick={start} loading={busy} className="self-start">
            Ativar verificação
          </Button>
        )}
      </div>
    </SectionCard>
  );
}
