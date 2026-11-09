"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { ArrowLeftRight, ChevronDown, ChevronUp, MinusCircle, PlusCircle, Repeat, Trash2 } from "lucide-react";
import { Alert, Button, Field, Input, Modal, SegmentedControl, Select, Switch, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { today } from "@/lib/dates";
import { REPEATS, SUBTYPES, SUBTYPE_IDS, transactionSchema, type RepeatId, type TransactionFormValues } from "@/features/financeiro/schemas";
import { createTransaction, deleteTransaction, updateTransaction } from "@/features/financeiro/actions";
import type { TxView } from "@/features/financeiro/data";
import { useFinance } from "./finance-shell";

type Kind = "receita" | "despesa" | "transferencia";

export function TransactionModal({
  tx,
  kind: initialKind,
  preset,
  onClose,
}: {
  tx: TxView | null;
  kind: Kind;
  preset?: { subtype?: "fixa" | "variavel" | "imposto" | "pessoa"; due_date?: string };
  onClose: () => void;
}) {
  const router = useRouter();
  const { base, canEdit } = useFinance();
  const [error, setError] = useState("");
  const [more, setMore] = useState(!!(tx?.client_id || tx?.person || tx?.notes));
  const [scope, setScope] = useState<"um" | "proximos">("um");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const inSeries = !!tx?.recurrence_id;

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<TransactionFormValues, unknown, z.output<typeof transactionSchema>>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      kind: initialKind,
      subtype: tx?.subtype ?? preset?.subtype ?? (initialKind === "despesa" ? "fixa" : ""),
      amount: tx ? String(tx.amount).replace(".", ",") : "",
      description: tx?.description ?? "",
      account_id: tx?.account_id ?? (base.accounts.length === 1 ? base.accounts[0].id : ""),
      to_account_id: tx?.to_account_id ?? "",
      category_id: tx?.category_id ?? "",
      due_date: tx?.due_date ?? preset?.due_date ?? today(),
      paid: tx ? tx.paid : true,
      repeat: "nao",
      installments: 2,
      client_id: tx?.client_id ?? "",
      person: tx?.person ?? "",
      notes: tx?.notes ?? "",
    },
  });
  const kind = useWatch({ control, name: "kind" });
  const subtype = useWatch({ control, name: "subtype" });
  const paid = useWatch({ control, name: "paid" });
  const repeat = useWatch({ control, name: "repeat" }) as RepeatId;

  const categories = base.categories.filter((c) => c.kind === kind && (kind !== "despesa" || !c.subtype || c.subtype === subtype));
  const color = kind === "receita" ? "text-success" : kind === "despesa" ? "text-danger" : "text-info";

  const done = () => {
    onClose();
    router.refresh();
  };
  const onSubmit = handleSubmit(() =>
    start(async () => {
      setError("");
      const r = tx ? await updateTransaction(tx.id, getValues(), scope) : await createTransaction(getValues());
      if (!r.ok) return setError(r.error);
      done();
    }),
  );

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={tx ? "Editar" : "Novo"}
      accent="lançamento"
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          {tx && canEdit && (
            confirmDelete ? (
              <Button
                variant="danger"
                size="sm"
                loading={pending}
                onClick={() =>
                  start(async () => {
                    const r = await deleteTransaction(tx.id, scope);
                    if (!r.ok) return setError(r.error);
                    done();
                  })
                }
              >
                Confirmar exclusão
              </Button>
            ) : (
              <Button variant="danger-outline" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 /> Excluir
              </Button>
            )
          )}
          <span className="flex-1" />
          <Button variant="secondary" onClick={onClose}>
            {canEdit ? "Cancelar" : "Fechar"}
          </Button>
          {canEdit && (
            <Button type="submit" form="form-lancamento" loading={pending && !confirmDelete}>
              Salvar
            </Button>
          )}
        </div>
      }
    >
      <form id="form-lancamento" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}
        <fieldset disabled={!canEdit} className="flex flex-col gap-4">
          {!tx && (
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Tipo de lançamento">
              {(
                [
                  ["despesa", "Despesa", MinusCircle, "bg-danger text-white"],
                  ["receita", "Receita", PlusCircle, "bg-success text-white"],
                  ["transferencia", "Transferência", ArrowLeftRight, "bg-info text-white"],
                ] as const
              ).map(([k, label, Icon, on]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => {
                    setValue("kind", k);
                    setValue("category_id", "");
                    setValue("subtype", k === "despesa" ? "fixa" : "");
                  }}
                  className={cn("inline-flex h-9 items-center justify-center gap-1.5 rounded-full text-xs font-medium", kind === k ? on : "bg-surface-2 text-muted hover:bg-surface-3")}
                >
                  <Icon className="size-3.5" aria-hidden /> {label}
                </button>
              ))}
            </div>
          )}

          <Field label={repeat === "parcelado" ? "Valor total" : "Valor"} htmlFor="tx-amount" required error={errors.amount?.message}>
            <div className="relative">
              <span className={cn("pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-lg", color)}>R$</span>
              <Input id="tx-amount" autoFocus={!tx} inputMode="decimal" placeholder="0,00" className={cn("h-14 pl-12 text-2xl", color)} {...register("amount")} />
            </div>
          </Field>

          <Field label="Descrição" htmlFor="tx-desc" required error={errors.description?.message}>
            <Input
              id="tx-desc"
              placeholder={kind === "receita" ? "Ex.: Mensalidade do cliente" : kind === "despesa" ? "Ex.: Assinatura de ferramenta" : "Ex.: Reserva para impostos"}
              {...register("description")}
            />
          </Field>

          {kind === "despesa" && (
            <fieldset>
              <legend className="mb-1.5 text-xs font-medium text-muted">Tipo da despesa</legend>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {SUBTYPE_IDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={subtype === s}
                    onClick={() => {
                      setValue("subtype", s);
                      setValue("category_id", "");
                    }}
                    className={cn("h-8 rounded-full text-xs font-medium", subtype === s ? "bg-panel text-panel-ink" : "bg-surface-2 text-muted hover:bg-surface-3")}
                  >
                    {SUBTYPES[s]}
                  </button>
                ))}
              </div>
              {errors.subtype && <p className="mt-1 text-xs text-danger">{errors.subtype.message}</p>}
              <p className="mt-1 text-[11px] text-muted">Mostra só as categorias desse tipo.</p>
            </fieldset>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={kind === "receita" ? "Entra em" : kind === "despesa" ? "Sai de" : "Sai de"}
              htmlFor="tx-acc"
              error={errors.account_id?.message}
              hint={base.accounts.length === 0 ? "Cadastre contas em Mais áreas › Contas." : undefined}
            >
              <Select id="tx-acc" {...register("account_id")}>
                <option value="">Sem conta</option>
                {base.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            {kind === "transferencia" ? (
              <Field label="Vai para" htmlFor="tx-to" error={errors.to_account_id?.message}>
                <Select id="tx-to" {...register("to_account_id")}>
                  <option value="">Escolha</option>
                  {base.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field label="Categoria" htmlFor="tx-cat" error={errors.category_id?.message}>
                <Select id="tx-cat" {...register("category_id")}>
                  <option value="">Sem categoria</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={kind === "transferencia" ? "Data" : "Vencimento"} htmlFor="tx-date" error={errors.due_date?.message}>
              <Input id="tx-date" type="date" {...register("due_date")} />
            </Field>
            {kind !== "transferencia" && (
              <label className="flex items-center gap-3 self-end rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm">
                <Switch checked={!!paid} onCheckedChange={(v) => setValue("paid", v)} aria-label={kind === "receita" ? "Já foi recebido" : "Já foi pago"} />
                {kind === "receita" ? "Já foi recebido" : "Já foi pago"}
              </label>
            )}
          </div>

          {!tx && kind !== "transferencia" && (
            <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
              <Field label="Repetição" htmlFor="tx-repeat" hint={REPEATS[repeat].hint}>
                <Select id="tx-repeat" {...register("repeat")}>
                  {(Object.keys(REPEATS) as RepeatId[]).map((r) => (
                    <option key={r} value={r}>
                      {REPEATS[r].label}
                    </option>
                  ))}
                </Select>
              </Field>
              {repeat === "parcelado" && (
                <Field label="Parcelas" htmlFor="tx-inst" error={errors.installments?.message}>
                  <Input id="tx-inst" type="number" min={2} max={120} {...register("installments")} />
                </Field>
              )}
            </div>
          )}

          {inSeries && (
            <div className="rounded-xl bg-surface-2 p-3 text-xs">
              <p className="mb-2 flex items-center gap-1.5 font-medium">
                <Repeat className="size-3.5" aria-hidden /> Faz parte de uma série
                {tx?.installment && tx.installments ? ` (parcela ${tx.installment} de ${tx.installments})` : ""}
              </p>
              <SegmentedControl
                label="Aplicar a"
                value={scope}
                onChange={setScope}
                options={[
                  { value: "um", label: "Só este" },
                  { value: "proximos", label: "Este e os próximos em aberto" },
                ]}
              />
            </div>
          )}

          <button type="button" onClick={() => setMore(!more)} className="inline-flex items-center gap-1 self-start text-xs text-muted hover:text-ink" aria-expanded={more}>
            {more ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />} Mais opções
          </button>
          {more && (
            <div className="flex flex-col gap-4">
              {kind !== "transferencia" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Cliente" htmlFor="tx-client">
                    <Select id="tx-client" {...register("client_id")}>
                      <option value="">Nenhum</option>
                      {base.clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label={kind === "despesa" && subtype === "pessoa" ? "Pessoa" : "Pessoa ou fornecedor"}
                    htmlFor="tx-person"
                    hint={kind === "despesa" && subtype === "pessoa" ? "Entra em “Gastos por pessoa”." : undefined}
                  >
                    <Input id="tx-person" maxLength={120} {...register("person")} />
                  </Field>
                </div>
              )}
              <Field label="Observações" htmlFor="tx-notes">
                <Textarea id="tx-notes" rows={2} maxLength={2000} {...register("notes")} />
              </Field>
            </div>
          )}
        </fieldset>
      </form>
    </Modal>
  );
}
