import { describe, expect, it } from "vitest";
import { commemorativeBetween, commemorativeDates, easter } from "./commemorative";

describe("datas comemorativas", () => {
  it("calcula a Páscoa", () => {
    expect(easter(2025)).toBe("2025-04-20");
    expect(easter(2026)).toBe("2026-04-05");
    expect(easter(2027)).toBe("2027-03-28");
  });
  it("datas móveis de 2026", () => {
    const d = Object.fromEntries(commemorativeDates(2026).map((c) => [c.name, c.day]));
    expect(d["Carnaval"]).toBe("2026-02-17");
    expect(d["Dia das Mães"]).toBe("2026-05-10");
    expect(d["Dia dos Pais"]).toBe("2026-08-09");
    expect(d["Corpus Christi"]).toBe("2026-06-04");
    expect(d["Black Friday"]).toBe("2026-11-27");
  });
  it("filtra por período atravessando o ano", () => {
    const list = commemorativeBetween("2026-12-20", "2027-01-05").map((c) => c.name);
    expect(list).toEqual(["Natal", "Réveillon", "Confraternização Universal"]);
  });
});
