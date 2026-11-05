"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, KeyRound, MailPlus, Users } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  SectionCard,
  SegmentedControl,
} from "@/components/ui";
import {
  createInvitation,
  revokeInvitation,
  setMemberAccess,
  updateMemberRole,
  updateMemberStatus,
} from "@/features/configuracoes/actions";
import { inviteSchema, type AccessEntry, type InviteValues } from "@/features/configuracoes/schemas";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import type { AppRoleT, MemberStatusT } from "@/lib/supabase/database.types";
import { AccessMatrix, GRANTABLE, toEntries, toMap } from "./access-matrix";

export interface MemberRow {
  userId: string;
  name: string;
  email: string;
  jobTitle: string | null;
  role: AppRoleT;
  status: MemberStatusT;
  isSelf: boolean;
  access: AccessEntry[];
}

export interface InviteRow {
  id: string;
  email: string;
  role: AppRoleT;
  expiresAt: string;
  accessCount: number;
}

const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export function TeamPanel({ members, invites }: { members: MemberRow[]; invites: InviteRow[] }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [accessFor, setAccessFor] = useState<MemberRow | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError("");
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Não foi possível salvar.");
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {error && <Alert>{error}</Alert>}

      <SectionCard
        title="Equipe"
        icon={Users}
        description="Administradores têm acesso total. Colaboradores acessam só os módulos liberados."
        action={
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <MailPlus /> Convidar
          </Button>
        }
      >
        <ul className="flex flex-col divide-y divide-line" aria-busy={pending}>
          {members.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {m.name} {m.isSelf && <span className="text-xs font-normal text-muted">(você)</span>}
                </p>
                <p className="truncate text-xs text-muted">
                  {m.email}
                  {m.jobTitle ? ` · ${m.jobTitle}` : ""}
                </p>
              </div>
              {m.status === "desativado" && <Badge tone="danger">Desativado</Badge>}
              {m.role === "colaborador" && m.status === "ativo" && (
                <Badge>{m.access.length ? `${m.access.length} módulos` : "Sem módulos"}</Badge>
              )}
              <label className="sr-only" htmlFor={`papel-${m.userId}`}>
                Papel de {m.name}
              </label>
              <select
                id={`papel-${m.userId}`}
                value={m.role}
                disabled={pending}
                onChange={(e) => run(() => updateMemberRole({ userId: m.userId, role: e.target.value }))}
                className="h-8 rounded-full border border-line bg-surface px-3 text-xs"
              >
                <option value="admin">{ROLE_LABEL.admin}</option>
                <option value="colaborador">{ROLE_LABEL.colaborador}</option>
              </select>
              {m.role === "colaborador" && (
                <Button size="sm" variant="secondary" onClick={() => setAccessFor(m)} disabled={pending}>
                  <KeyRound /> Acessos
                </Button>
              )}
              {!m.isSelf && (
                <Button
                  size="sm"
                  variant={m.status === "ativo" ? "danger-outline" : "secondary"}
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      updateMemberStatus({ userId: m.userId, status: m.status === "ativo" ? "desativado" : "ativo" }),
                    )
                  }
                >
                  {m.status === "ativo" ? "Desativar" : "Reativar"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="Convites pendentes" icon={MailPlus} description="Cada convite vale 7 dias e só funciona para o e-mail convidado.">
        {invites.length === 0 ? (
          <EmptyState icon={MailPlus} title="Nenhum convite pendente" />
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{i.email}</p>
                  <p className="text-xs text-muted">
                    {ROLE_LABEL[i.role]}
                    {i.role === "colaborador" ? ` · ${i.accessCount} módulos` : ""} · vence em {date.format(new Date(i.expiresAt))}
                  </p>
                </div>
                <Button size="sm" variant="danger-outline" disabled={pending} onClick={() => run(() => revokeInvitation(i.id))}>
                  Cancelar convite
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <InviteModal open={inviteOpen} onOpenChange={setInviteOpen} />
      {accessFor && <AccessModal member={accessFor} onClose={() => setAccessFor(null)} />}
    </div>
  );
}

function InviteModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [access, setAccess] = useState<Record<string, "nenhum" | "ver" | "editar">>({});
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<InviteValues>({ resolver: zodResolver(inviteSchema), defaultValues: { email: "", role: "colaborador", access: [] } });
  const role = watch("role");

  const close = (v: boolean) => {
    if (!v) {
      reset();
      setAccess({});
      setLink("");
      setError("");
      setCopied(false);
    }
    onOpenChange(v);
  };

  const onSubmit = (values: InviteValues) => {
    setError("");
    start(async () => {
      const res = await createInvitation({ ...values, access: toEntries(access) });
      if (res.ok && res.data) setLink(res.data.link);
      else if (!res.ok) setError(res.error);
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={close}
      title="Convidar"
      accent="pessoa"
      size="lg"
      footer={
        link ? (
          <Button onClick={() => close(false)}>Concluir</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="form-convite" loading={pending}>
              Gerar convite
            </Button>
          </>
        )
      }
    >
      {link ? (
        <div className="flex flex-col gap-3">
          <Alert tone="success">Convite criado. Copie o link e envie para a pessoa (WhatsApp ou e-mail).</Alert>
          <div className="flex gap-2">
            <Input readOnly value={link} aria-label="Link do convite" onFocus={(e) => e.currentTarget.select()} />
            <Button
              variant="dark"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              }}
            >
              {copied ? <Check /> : <Copy />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
          <p className="text-xs text-muted">Por segurança, este link aparece só agora. Se perder, cancele e gere outro.</p>
        </div>
      ) : (
        <form id="form-convite" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          {error && <Alert>{error}</Alert>}
          <Field label="E-mail da pessoa" htmlFor="invite_email" required error={errors.email?.message}>
            <Input id="invite_email" type="email" {...register("email")} />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">Papel</span>
            <SegmentedControl
              label="Papel"
              value={role}
              onChange={(v) => setValue("role", v)}
              options={[
                { value: "colaborador", label: ROLE_LABEL.colaborador },
                { value: "admin", label: ROLE_LABEL.admin },
              ]}
            />
          </div>
          {role === "colaborador" ? (
            <AccessMatrix value={access} onChange={setAccess} />
          ) : (
            <Alert tone="info">Administradores têm acesso total, inclusive a Equipe e Agência.</Alert>
          )}
        </form>
      )}
    </Modal>
  );
}

function AccessModal({ member, onClose }: { member: MemberRow; onClose: () => void }) {
  const [access, setAccess] = useState(toMap(member.access));
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title="Acessos de"
      accent={member.name}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await setMemberAccess({ userId: member.userId, access: toEntries(access) });
                if (res.ok) onClose();
                else setError(res.error);
              })
            }
          >
            Salvar acessos
          </Button>
        </>
      }
    >
      {error && <Alert className="mb-3">{error}</Alert>}
      <AccessMatrix value={access} onChange={setAccess} />
      <p className="mt-3 text-xs text-muted">{GRANTABLE.length} módulos podem ser liberados.</p>
    </Modal>
  );
}
