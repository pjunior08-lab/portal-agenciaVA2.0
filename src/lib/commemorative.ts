/**
 * Datas comemorativas e feriados nacionais mais usados no calendário de conteúdo.
 * Calculadas a partir do ano (Páscoa pelo algoritmo de Meeus/Jones/Butcher), sem depender de serviço externo.
 */
export interface Commemorative {
  day: string; // AAAA-MM-DD
  name: string;
  holiday: boolean; // feriado nacional
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** Domingo de Páscoa (calendário gregoriano). */
export function easter(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(year, month, day);
}

function shift(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** n-ésimo dia da semana (0 = domingo) de um mês. */
function nthWeekday(year: number, month: number, weekday: number, n: number): string {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const day = 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
  return iso(year, month, day);
}

export function commemorativeDates(year: number): Commemorative[] {
  const e = easter(year);
  const list: Commemorative[] = [
    { day: iso(year, 1, 1), name: "Confraternização Universal", holiday: true },
    { day: shift(e, -48), name: "Carnaval (segunda)", holiday: false },
    { day: shift(e, -47), name: "Carnaval", holiday: false },
    { day: iso(year, 3, 8), name: "Dia Internacional da Mulher", holiday: false },
    { day: iso(year, 3, 15), name: "Dia do Consumidor", holiday: false },
    { day: shift(e, -2), name: "Sexta-feira Santa", holiday: true },
    { day: e, name: "Páscoa", holiday: false },
    { day: iso(year, 4, 21), name: "Tiradentes", holiday: true },
    { day: iso(year, 5, 1), name: "Dia do Trabalho", holiday: true },
    { day: nthWeekday(year, 5, 0, 2), name: "Dia das Mães", holiday: false },
    { day: shift(e, 60), name: "Corpus Christi", holiday: false },
    { day: iso(year, 6, 12), name: "Dia dos Namorados", holiday: false },
    { day: nthWeekday(year, 8, 0, 2), name: "Dia dos Pais", holiday: false },
    { day: iso(year, 9, 7), name: "Independência do Brasil", holiday: true },
    { day: iso(year, 9, 15), name: "Dia do Cliente", holiday: false },
    { day: iso(year, 10, 12), name: "Dia das Crianças e N. Sra. Aparecida", holiday: true },
    { day: iso(year, 11, 2), name: "Finados", holiday: true },
    { day: iso(year, 11, 15), name: "Proclamação da República", holiday: true },
    { day: iso(year, 11, 20), name: "Dia da Consciência Negra", holiday: true },
    { day: shift(nthWeekday(year, 11, 4, 4), 1), name: "Black Friday", holiday: false },
    { day: iso(year, 12, 25), name: "Natal", holiday: true },
    { day: iso(year, 12, 31), name: "Réveillon", holiday: false },
  ];
  return list.sort((a, b) => a.day.localeCompare(b.day));
}

/** Datas entre dois dias (inclusive), atravessando anos se preciso. */
export function commemorativeBetween(from: string, to: string): Commemorative[] {
  const years = new Set([Number(from.slice(0, 4)), Number(to.slice(0, 4))]);
  return [...years].flatMap(commemorativeDates).filter((c) => c.day >= from && c.day <= to);
}
