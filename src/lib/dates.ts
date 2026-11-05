/**
 * Datas do sistema. "Dia" sempre no fuso de São Paulo, como 'AAAA-MM-DD',
 * para que "hoje" e "atrasada" não mudem conforme o servidor ou o navegador.
 */
export const TZ = "America/Sao_Paulo";

const isoFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** Dia (AAAA-MM-DD) de um instante, em São Paulo. */
export function dayOf(d: Date | string | number): string {
  return isoFmt.format(new Date(d));
}

export function today(): string {
  return dayOf(new Date());
}

/** Soma dias a um 'AAAA-MM-DD' (sem depender de fuso). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Diferença em dias entre dois 'AAAA-MM-DD' (b − a). */
export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);
}

/** Dia da semana (0 = domingo) de um 'AAAA-MM-DD'. */
export function weekday(day: string): number {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

/** Início da semana (domingo) que contém o dia. */
export function startOfWeek(day: string): string {
  return addDays(day, -weekday(day));
}

export function startOfMonth(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

export function addMonths(day: string, n: number): string {
  const [y, m] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return t.toISOString().slice(0, 10);
}

/** As 6 semanas (42 dias) exibidas na grade de um mês, começando no domingo. */
export function monthGrid(day: string): string[] {
  const first = startOfWeek(startOfMonth(day));
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const WEEKDAYS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function monthLabel(day: string): string {
  const [y, m] = day.split("-").map(Number);
  return `${MONTHS[m - 1]} de ${y}`;
}

/** "5 nov" */
export function shortDate(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)}`;
}

/** "qui, 5 nov" */
export function weekdayDate(day: string): string {
  return `${WEEKDAYS_SHORT[weekday(day)]}, ${shortDate(day)}`;
}

const timeFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
export function timeOf(d: string | Date): string {
  return timeFmt.format(new Date(d));
}

/** Converte "AAAA-MM-DD" + "HH:MM" (horário de São Paulo) em ISO UTC. */
export function localToIso(day: string, time: string): string {
  // São Paulo não tem horário de verão desde 2019: UTC−03:00 fixo.
  return new Date(`${day}T${time}:00-03:00`).toISOString();
}

/** Converte um instante ISO no valor de um <input type="datetime-local"> em São Paulo. */
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  return `${dayOf(iso)}T${timeOf(iso)}`;
}

/** Converte o valor de um <input type="datetime-local"> (horário de São Paulo) em ISO UTC. */
export function localInputToIso(v: string): string | null {
  if (!v) return null;
  const [d, t] = v.split("T");
  return localToIso(d, t.slice(0, 5));
}
