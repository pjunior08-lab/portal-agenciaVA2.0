"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Sparkles, Trash2 } from "lucide-react";
import { Alert, Button, Field, Input, Modal, SegmentedControl, Select } from "@/components/ui";
import { cn, formatBRL } from "@/lib/utils";
import { ACCOUNT_KINDS, SUBTYPES, SUBTYPE_IDS, accountSchema, categorySchema } from "@/features/financeiro/schemas";
import { createSuggestedCategories, deleteAccount, deleteCategory, saveAccount, saveCategory } from "@/features/financeiro/actions";
import type { FinAccount, FinCategory } from "@/features/financeiro/data";
import { useFinance } from "./finance-shell";

const ACCOUNT_COLORS = ["#2F7BE5", "#16A34A", "#7C3AED", "#DB2777", "#EA580C", "#111111"];
const errorsOf = (e: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } }) =>
  Object.fromEntries(Object.entries(e.flatten().fieldErrors).map(([k, v]) => [k, v?.[0]]));

export function AccountsModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { base, canEdit } = useFinance();
  const empty = { name: "", kind: "corrente" as FinAccount["kind"], initial_balance: "", color: ACCOUNT_COLORS[0] };
  const [form, setForm] = useState<typeof empty>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const total = base.accounts.reduce((s, a) => s + a.balance, 0);

  const save = () => {
    const parsed = accountSchema.safeParse(form);
    if (!parsed.success) return setErrors(errorsOf(parsed.error));
    setErrors({});
    start(async () => {
      const r = await saveAccount(editing, form);
      if (!r.ok) return setError(r.error);
      setError("");
      setForm(empty);
      setEditing(null);
      router.refresh();
    });
  };

  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title="Minhas" accent="contas" size="lg">
      <div className="flex flex-col gap-5">
        {error && <Alert>{error}</Alert>}
        {base.accounts.length > 0 && (
          <ul className="flex flex-col divide-y divide-line">
            {base.accounts.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2.5">
                <span className="size-3 shrink-0 rounded-full" style={{ background: a.color }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{a.name}</span>
                  <span className="text-[11px] text-muted">{ACCOUNT_KINDS[a.kind]}</span>
                </span>
                <span className={cn("text-sm tabular-nums", a.balance < 0 && "text-danger")}>{formatBRL(a.balance)}</span>
                {canEdit && (
                  <span className="flex">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Editar ${a.name}`}
                      onClick={() => {
                        setEditing(a.id);
                        setForm({ name: a.name, kind: a.kind, initial_balance: String(a.initial_balance).replace(".", ","), color: a.color });
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Excluir ${a.name}`}
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const r = await deleteAccount(a.id);
                          if (!r.ok) return setError(r.error);
                          router.refresh();
                        })
                      }
                    >
                      <Trash2 />
                    </Button>
                  </span>
                )}
              </li>
            ))}
            <li className="flex justify-between py-2.5 text-sm font-medium">
              <span>Saldo total</span>
              <span className="tabular-nums">{formatBRL(total)}</span>
            </li>
          </ul>
        )}
        {canEdit && (
          <form
            noValidate
            className="flex flex-col gap-3 rounded-xl bg-surface-2 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <p className="text-sm font-medium">{editing ? "Editar conta" : "Nova conta"}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Nome" htmlFor="acc-name" required error={errors.name}>
                <Input id="acc-name" placeholder="Ex.: Banco PJ" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Tipo" htmlFor="acc-kind">
                <Select id="acc-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as FinAccount["kind"] })}>
                  {(Object.keys(ACCOUNT_KINDS) as FinAccount["kind"][]).map((k) => (
                    <option key={k} value={k}>
                      {ACCOUNT_KINDS[k]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Saldo inicial (R$)" htmlFor="acc-ini" error={errors.initial_balance} hint="Saldo antes do 1º lançamento.">
                <Input id="acc-ini" inputMode="decimal" placeholder="0,00" value={form.initial_balance} onChange={(e) => setForm({ ...form, initial_balance: e.target.value })} />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted">Cor:</span>
              {ACCOUNT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  aria-label={`Cor ${c}`}
                  aria-pressed={form.color === c}
                  className={cn("size-6 rounded-full ring-offset-2 ring-offset-surface-2", form.color === c && "ring-2 ring-ink")}
                  style={{ background: c }}
                />
              ))}
              <span className="flex-1" />
              {editing && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(null);
                    setForm(empty);
                  }}
                >
                  Cancelar
                </Button>
              )}
              <Button type="submit" size="sm" loading={pending}>
                {editing ? "Salvar conta" : "Adicionar conta"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}

export function CategoriesModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { base, canEdit } = useFinance();
  const [kind, setKind] = useState<"despesa" | "receita">("despesa");
  const empty = { name: "", subtype: "" as "" | NonNullable<FinCategory["subtype"]>, monthly_goal: "" };
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [pending, start] = useTransition();
  const list = base.categories.filter((c) => c.kind === kind);

  const save = () => {
    const input = { ...form, kind };
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) return setErrors(errorsOf(parsed.error));
    setErrors({});
    start(async () => {
      const r = await saveCategory(editing, input);
      if (!r.ok) return setError(r.error);
      setError("");
      setForm(empty);
      setEditing(null);
      router.refresh();
    });
  };

  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title="Categorias" accent="e metas" size="lg">
      <div className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}
        {info && <Alert tone="success">{info}</Alert>}
        <SegmentedControl
          label="Tipo"
          value={kind}
          onChange={(k) => {
            setKind(k);
            setEditing(null);
            setForm(empty);
          }}
          options={[
            { value: "despesa", label: "Despesas" },
            { value: "receita", label: "Receitas" },
          ]}
          className="self-start"
        />
        {base.categories.length === 0 && canEdit && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-brand-soft p-3 text-xs">
            <span className="flex-1">Comece com categorias comuns em agências (dá para renomear ou excluir depois).</span>
            <Button
              size="sm"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await createSuggestedCategories();
                  if (!r.ok) return setError(r.error);
                  setInfo(`${r.data!.count} categorias criadas.`);
                  router.refresh();
                })
              }
            >
              <Sparkles /> Criar categorias sugeridas
            </Button>
          </div>
        )}
        {list.length === 0 ? (
          <p className="py-2 text-center text-xs text-muted">Nenhuma categoria de {kind === "despesa" ? "despesa" : "receita"}.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {list.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">{c.name}</span>
                  <span className="text-[11px] text-muted">
                    {c.kind === "despesa" ? (c.subtype ? SUBTYPES[c.subtype] : "Todos os tipos") : "Receita"}
                    {c.monthly_goal ? ` · meta ${formatBRL(c.monthly_goal)}/mês` : ""}
                  </span>
                </span>
                {canEdit && (
                  <span className="flex">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Editar ${c.name}`}
                      onClick={() => {
                        setEditing(c.id);
                        setForm({ name: c.name, subtype: c.subtype ?? "", monthly_goal: c.monthly_goal ? String(c.monthly_goal).replace(".", ",") : "" });
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Excluir ${c.name}`}
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const r = await deleteCategory(c.id);
                          if (!r.ok) return setError(r.error);
                          router.refresh();
                        })
                      }
                    >
                      <Trash2 />
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <form
            noValidate
            className="flex flex-col gap-3 rounded-xl bg-surface-2 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <p className="text-sm font-medium">{editing ? "Editar categoria" : "Nova categoria"}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Nome" htmlFor="cat-name" required error={errors.name}>
                <Input id="cat-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              {kind === "despesa" && (
                <Field label="Tipo" htmlFor="cat-sub">
                  <Select id="cat-sub" value={form.subtype} onChange={(e) => setForm({ ...form, subtype: e.target.value as typeof form.subtype })}>
                    <option value="">Todos os tipos</option>
                    {SUBTYPE_IDS.map((s) => (
                      <option key={s} value={s}>
                        {SUBTYPES[s]}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field
                label="Meta do mês (R$)"
                htmlFor="cat-goal"
                error={errors.monthly_goal}
                hint={kind === "despesa" ? "Limite de gasto. Opcional." : "Valor a alcançar. Opcional."}
              >
                <Input id="cat-goal" inputMode="decimal" placeholder="0,00" value={form.monthly_goal} onChange={(e) => setForm({ ...form, monthly_goal: e.target.value })} />
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              {editing && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(null);
                    setForm(empty);
                  }}
                >
                  Cancelar
                </Button>
              )}
              <Button type="submit" size="sm" loading={pending}>
                {editing ? "Salvar categoria" : "Adicionar categoria"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
