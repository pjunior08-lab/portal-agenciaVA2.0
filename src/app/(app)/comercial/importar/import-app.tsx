"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { Alert, Button, Card, Field, Input, SegmentedControl, Select } from "@/components/ui";
import { cn, formatBRL, formatBytes } from "@/lib/utils";
import {
  IMPORT_FIELDS,
  IMPORT_LIMIT_BYTES,
  IMPORT_LIMIT_ROWS,
  OPEN_STAGES,
  STAGES,
  buildImportRows,
  guessMapping,
  splitList,
  toCsv,
} from "@/features/comercial/schemas";
import { importOpportunities } from "@/features/comercial/actions";
import { useCrm } from "../crm-shell";

const STEPS = ["Arquivo", "Colunas", "Regras", "Prévia", "Importar"];
// lotes menores que o limite de envio das ações do servidor
const BATCH = 800;

type Sheet = { name: string; size: number; headers: string[]; rows: string[][] };

/** Converte qualquer célula (texto, número, data) em texto. */
function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

async function readFile(file: File): Promise<string[][]> {
  if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import("read-excel-file/browser");
    const data = await readSheet(file);
    return data.map((r) => r.map(cellText));
  }
  const Papa = (await import("papaparse")).default;
  const text = await file.text();
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
  return parsed.data.map((r) => r.map(cellText));
}

export function ImportApp() {
  const router = useRouter();
  const { base, userId } = useCrm();
  const [step, setStep] = useState(0);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [fileError, setFileError] = useState("");
  const [reading, setReading] = useState(false);
  const [mapping, setMapping] = useState<Record<string, number | null>>({});
  const [stage, setStage] = useState<(typeof OPEN_STAGES)[number]>("novo_lead");
  const [owner, setOwner] = useState(base.people.some((p) => p.id === userId) ? userId : "");
  const [duplicates, setDuplicates] = useState<"pular" | "atualizar">("pular");
  const [tagsText, setTagsText] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
    error?: string;
  } | null>(null);

  const customFields = base.fields.map((f) => ({ key: f.key, label: f.label }));
  const built = useMemo(() => (sheet ? buildImportRows(sheet.rows, mapping) : []), [sheet, mapping]);
  const valid = built.filter((r) => r.data);
  const invalid = built.filter((r) => !r.data);
  const existingDocs = useMemo(() => new Set(base.opps.map((o) => o.document).filter(Boolean)), [base.opps]);
  const dupCount = valid.filter((r) => r.data!.document && existingDocs.has(r.data!.document)).length;

  async function onFile(file: File | undefined) {
    setFileError("");
    if (!file) return;
    if (!/\.(csv|xlsx)$/i.test(file.name)) return setFileError("Envie um arquivo .csv ou .xlsx.");
    if (file.size > IMPORT_LIMIT_BYTES)
      return setFileError(`Arquivo maior que ${formatBytes(IMPORT_LIMIT_BYTES)}.`);
    setReading(true);
    try {
      const all = (await readFile(file)).filter((r) => r.some((c) => c));
      if (all.length < 2)
        return setFileError("O arquivo precisa de uma linha de cabeçalho e ao menos uma linha de dados.");
      if (all.length - 1 > IMPORT_LIMIT_ROWS)
        return setFileError(`O arquivo tem ${all.length - 1} linhas; o limite é ${IMPORT_LIMIT_ROWS}.`);
      const headers = all[0].map((h, i) => h || `Coluna ${i + 1}`);
      setSheet({ name: file.name, size: file.size, headers, rows: all.slice(1) });
      setMapping(guessMapping(headers, customFields));
      setResult(null);
      setStep(1);
    } catch {
      setFileError("Não foi possível ler o arquivo. Confira se ele não está protegido ou corrompido.");
    } finally {
      setReading(false);
    }
  }

  function downloadTemplate() {
    const csv = toCsv([
      [
        ...IMPORT_FIELDS.map((f) => f.label.replace(" (separadas por vírgula)", "")),
        ...base.fields.map((f) => f.label),
      ],
    ]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    Object.assign(document.createElement("a"), {
      href: url,
      download: "modelo-importacao-comercial.csv",
    }).click();
    URL.revokeObjectURL(url);
  }

  async function runImport() {
    // repetidos dentro do arquivo: vale a primeira linha
    const seen = new Set<string>();
    const rows = valid
      .map((r) => r.data!)
      .filter((d) => !d.document || (!seen.has(d.document) && !!seen.add(d.document)));
    const skippedInFile = valid.length - rows.length;
    const total = { created: 0, updated: 0, skipped: skippedInFile };
    setStep(4);
    setProgress({ done: 0, total: rows.length });
    for (let i = 0; i < rows.length; i += BATCH) {
      const r = await importOpportunities({
        rows: rows.slice(i, i + BATCH),
        stage,
        owner_id: owner,
        duplicates,
        extraTags: splitList(tagsText).slice(0, 10),
      });
      if (!r.ok) {
        setResult({ ...total, error: r.error });
        setProgress(null);
        router.refresh();
        return;
      }
      total.created += r.data!.created;
      total.updated += r.data!.updated;
      total.skipped += r.data!.skipped;
      setProgress({ done: Math.min(rows.length, i + BATCH), total: rows.length });
    }
    setResult(total);
    setProgress(null);
    router.refresh();
  }

  function reset() {
    setSheet(null);
    setStep(0);
    setResult(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-wrap gap-2" aria-label="Passos da importação">
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={i === step ? "step" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium",
              i === step
                ? "bg-brand text-brand-ink"
                : i < step
                  ? "bg-surface text-ink"
                  : "bg-surface text-muted-2",
            )}
          >
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full text-[10px]",
                i < step ? "bg-success text-white" : "bg-surface-2 text-ink",
              )}
            >
              {i < step ? <Check className="size-3" aria-label="concluído" /> : i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>

      <Card className="flex flex-col gap-4">
        {step === 0 && (
          <>
            <div>
              <h2 className="text-sm font-semibold">Escolha a planilha</h2>
              <p className="text-xs text-muted">
                Arquivo .csv ou .xlsx, até {formatBytes(IMPORT_LIMIT_BYTES)} e{" "}
                {IMPORT_LIMIT_ROWS.toLocaleString("pt-BR")} linhas. A primeira linha deve ter os nomes das
                colunas; no .xlsx vale a primeira aba.
              </p>
            </div>
            {fileError && <Alert>{fileError}</Alert>}
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-2 p-10 text-center hover:bg-surface-2">
              <Upload className="size-6 text-muted" aria-hidden />
              <span className="text-sm font-medium">
                {reading ? "Lendo arquivo…" : "Clique para escolher o arquivo"}
              </span>
              <span className="text-xs text-muted">CSV (vírgula ou ponto e vírgula) ou Excel</span>
              <input
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                disabled={reading}
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </label>
            <div>
              <Button variant="secondary" size="sm" onClick={downloadTemplate}>
                <Download /> Baixar planilha modelo
              </Button>
            </div>
          </>
        )}

        {step === 1 && sheet && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <FileSpreadsheet className="size-4" aria-hidden /> {sheet.name} · {formatBytes(sheet.size)} ·{" "}
              {sheet.rows.length} linha(s)
            </div>
            <div>
              <h2 className="text-sm font-semibold">Ligue cada campo a uma coluna</h2>
              <p className="text-xs text-muted">
                Sugerimos pelo nome do cabeçalho. Só o nome do contato é obrigatório.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ...IMPORT_FIELDS.map((f) => ({
                  key: f.key as string,
                  label: f.label,
                  required: "required" in f,
                })),
                ...customFields.map((c) => ({
                  key: `custom:${c.key}`,
                  label: `${c.label} (personalizado)`,
                  required: false,
                })),
              ].map((f) => (
                <Field key={f.key} label={f.label} htmlFor={`map-${f.key}`} required={f.required}>
                  <Select
                    id={`map-${f.key}`}
                    value={mapping[f.key] ?? ""}
                    onChange={(e) =>
                      setMapping({
                        ...mapping,
                        [f.key]: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  >
                    <option value="">Não importar</option>
                    {sheet.headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h}
                        {sheet.rows[0]?.[i] ? ` — ex.: ${sheet.rows[0][i].slice(0, 30)}` : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
              ))}
            </div>
            <Nav
              onBack={reset}
              backLabel="Trocar arquivo"
              onNext={() => setStep(2)}
              nextDisabled={mapping.name === null || mapping.name === undefined}
              nextHint="Escolha a coluna do nome do contato."
            />
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-sm font-semibold">Regras da importação</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Etapa inicial" htmlFor="imp-stage">
                <Select
                  id="imp-stage"
                  value={stage}
                  onChange={(e) => setStage(e.target.value as typeof stage)}
                >
                  {OPEN_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {STAGES[s].label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Responsável" htmlFor="imp-owner">
                <Select id="imp-owner" value={owner} onChange={(e) => setOwner(e.target.value)}>
                  <option value="">Sem responsável</option>
                  {base.people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Tags para todas as linhas"
                htmlFor="imp-tags"
                hint="Separe por vírgula. Ex.: lista-evento-2026"
              >
                <Input id="imp-tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
              </Field>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted">Mesmo CNPJ/CPF já cadastrado</span>
                <SegmentedControl
                  label="O que fazer com CNPJ/CPF repetido"
                  value={duplicates}
                  onChange={setDuplicates}
                  options={[
                    { value: "pular", label: "Pular a linha" },
                    { value: "atualizar", label: "Atualizar o cadastro" },
                  ]}
                />
                <span className="text-[11px] text-muted-2">
                  {duplicates === "pular"
                    ? "O cadastro existente fica como está."
                    : "Só os campos preenchidos na planilha são trocados; a etapa não muda."}
                </span>
              </div>
            </div>
            <Nav onBack={() => setStep(1)} onNext={() => setStep(3)} />
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-sm font-semibold">Confira antes de importar</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Mini label="Linhas no arquivo" value={built.length} />
              <Mini label="Prontas para importar" value={valid.length} tone="success" />
              <Mini
                label="Com erro (ficam de fora)"
                value={invalid.length}
                tone={invalid.length ? "danger" : undefined}
              />
              <Mini
                label={duplicates === "pular" ? "Já cadastradas (puladas)" : "Já cadastradas (atualizadas)"}
                value={dupCount}
              />
            </div>
            {invalid.length > 0 && (
              <details className="rounded-xl bg-danger-soft p-3 text-xs" open={invalid.length <= 10}>
                <summary className="flex cursor-pointer items-center gap-1.5 font-medium text-danger">
                  <AlertTriangle className="size-3.5" aria-hidden /> {invalid.length} linha(s) com erro
                </summary>
                <ul className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto">
                  {invalid.slice(0, 200).map((r) => (
                    <li key={r.line}>
                      Linha {r.line}: {r.errors.join(" ")}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {valid.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <caption className="mb-2 text-left text-muted">
                    Primeiras {Math.min(10, valid.length)} linhas
                  </caption>
                  <thead className="text-muted">
                    <tr className="border-b border-line">
                      {["Linha", "Contato", "Empresa", "CNPJ/CPF", "Telefone", "Valor", "Tags"].map((h) => (
                        <th key={h} scope="col" className="px-2 py-1.5 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {valid.slice(0, 10).map((r) => (
                      <tr key={r.line} className="border-b border-line last:border-0">
                        <td className="px-2 py-1.5 text-muted">{r.line}</td>
                        <td className="px-2 py-1.5">{r.data!.name}</td>
                        <td className="px-2 py-1.5">{r.data!.company ?? "—"}</td>
                        <td className="px-2 py-1.5">{r.data!.document ?? "—"}</td>
                        <td className="px-2 py-1.5">{r.data!.phone ?? "—"}</td>
                        <td className="px-2 py-1.5">
                          {r.data!.value == null ? "—" : formatBRL(r.data!.value)}
                        </td>
                        <td className="px-2 py-1.5">
                          {[...r.data!.tags, ...splitList(tagsText)].join(", ") || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Nav
              onBack={() => setStep(2)}
              onNext={runImport}
              nextLabel={`Importar ${valid.length} linha(s)`}
              nextDisabled={!valid.length}
              nextHint="Nenhuma linha válida para importar."
            />
          </>
        )}

        {step === 4 && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            {progress ? (
              <>
                <p className="text-sm font-medium" role="status">
                  Importando… {progress.done} de {progress.total}
                </p>
                <div className="h-2 w-full max-w-sm rounded-full bg-surface-2">
                  <div
                    className="h-2 rounded-full bg-brand transition-all"
                    style={{ width: `${Math.max(3, (progress.done / Math.max(1, progress.total)) * 100)}%` }}
                  />
                </div>
              </>
            ) : result ? (
              <>
                {result.error ? (
                  <AlertTriangle className="size-8 text-danger" aria-hidden />
                ) : (
                  <CheckCircle2 className="size-8 text-success" aria-hidden />
                )}
                <p className="text-sm font-medium" role="status">
                  {result.error ? "A importação parou no meio" : "Importação concluída"}
                </p>
                <p className="text-xs text-muted">
                  {result.created} criada(s) · {result.updated} atualizada(s) · {result.skipped} pulada(s)
                  {invalid.length ? ` · ${invalid.length} com erro` : ""}
                </p>
                {result.error && <Alert>{result.error}</Alert>}
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={reset}>
                    Importar outro arquivo
                  </Button>
                  <Button onClick={() => router.push("/comercial")}>Ver no funil</Button>
                </div>
              </>
            ) : null}
          </div>
        )}
      </Card>
    </div>
  );
}

function Nav({
  onBack,
  backLabel = "Voltar",
  onNext,
  nextLabel = "Continuar",
  nextDisabled,
  nextHint,
}: {
  onBack: () => void;
  backLabel?: string;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextHint?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
      <Button variant="ghost" onClick={onBack}>
        {backLabel}
      </Button>
      <div className="flex items-center gap-2">
        {nextDisabled && nextHint && <span className="text-xs text-muted">{nextHint}</span>}
        <Button onClick={onNext} disabled={nextDisabled}>
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: number; tone?: "success" | "danger" }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p
        className={cn(
          "text-xl font-semibold tabular-nums",
          tone === "success" && "text-success",
          tone === "danger" && "text-danger",
        )}
      >
        {value}
      </p>
    </div>
  );
}
