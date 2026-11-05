import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, Field, Input, SegmentedControl } from "@/components/ui";
import { formatBRL } from "@/lib/utils";
import { MODULES } from "@/lib/navigation";

describe("Button", () => {
  it("fica desabilitado e marcado como ocupado enquanto carrega", () => {
    render(<Button loading>Salvar</Button>);
    const btn = screen.getByRole("button", { name: "Salvar" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });

  it("é type=button por padrão, para não enviar formulários sem querer", () => {
    render(<Button>Ok</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });
});

describe("Field", () => {
  it("liga o rótulo ao campo e anuncia o erro", () => {
    render(
      <Field label="E-mail" htmlFor="email" error="Informe um e-mail válido.">
        <Input id="email" />
      </Field>,
    );
    const input = screen.getByLabelText("E-mail");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "email-erro");
    expect(screen.getByRole("alert")).toHaveTextContent("Informe um e-mail válido.");
  });
});

describe("SegmentedControl", () => {
  it("marca a opção escolhida e avisa a mudança", async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="Forma de aprovação"
        value="rapida"
        onChange={onChange}
        options={[
          { value: "rapida", label: "Rápida" },
          { value: "detalhada", label: "Detalhada" },
        ]}
      />,
    );
    expect(screen.getByRole("radio", { name: "Rápida" })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(screen.getByRole("radio", { name: "Detalhada" }));
    expect(onChange).toHaveBeenCalledWith("detalhada");
  });
});

describe("formatBRL", () => {
  it("formata em reais", () => {
    expect(formatBRL(1234.5).replace(/\s/g, " ")).toBe("R$ 1.234,50");
  });
});

describe("navegação", () => {
  it("tem slugs únicos e cobre os 27 itens do menu (17 + 10 em Mais áreas)", () => {
    const slugs = MODULES.map((m) => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(MODULES.filter((m) => m.group !== "mais")).toHaveLength(17);
    expect(MODULES.filter((m) => m.group === "mais")).toHaveLength(10);
  });

  it("só lista funcionalidades para módulos já levantados", () => {
    for (const m of MODULES) {
      if (m.status === "a-levantar") expect(m.features).toHaveLength(0);
      else expect(m.features.length).toBeGreaterThan(0);
    }
  });
});
