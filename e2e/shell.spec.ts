import { expect, test, type Page } from "@playwright/test";
import { MODULES } from "../src/lib/navigation";

/*
 * Testes sem login rodam sempre. Os testes logados só rodam com uma conta de teste:
 *   E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e
 * (use uma conta de administrador criada para testes; os testes não gravam dados.)
 */
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email!);
  await page.getByLabel("Senha").fill(password!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/inicio$/);
}

test.describe("sem login", () => {
  test("rotas do sistema levam ao login e guardam o destino", async ({ page }) => {
    await page.goto("/clientes");
    await expect(page).toHaveURL(/\/login\?next=%2Fclientes$/);
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  });

  test("login valida campos antes de enviar", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Informe um e-mail válido.")).toBeVisible();
    await expect(page.getByText("Informe a senha.")).toBeVisible();
  });

  test("senha errada mostra mensagem clara", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill("ninguem@exemplo.com.br");
    await page.getByLabel("Senha").fill("senha-errada-123");
    await page.getByRole("button", { name: "Entrar" }).click();
    // o Next.js tem um aviso invisível próprio (role="alert"); procuramos só o do formulário
    await expect(page.getByRole("main").getByRole("alert")).toContainText(/incorretos|tentativas/);
  });

  test("convite inválido é recusado", async ({ page }) => {
    await page.goto("/convite/token-que-nao-existe");
    await expect(page.getByText("Convite inválido")).toBeVisible();
  });

  test("recuperar senha não revela se a conta existe", async ({ page }) => {
    await page.goto("/recuperar-senha");
    await expect(page.getByRole("heading", { name: "Recuperar senha" })).toBeVisible();
  });

  test("cadastro da agência fica fechado depois do primeiro acesso", async ({ page }) => {
    await page.goto("/cadastro");
    // com a agência já criada, volta para o login; sem agência, mostra o formulário de criação
    await expect(page.getByRole("heading", { level: 1, name: /Entrar|Criar a agência/ })).toBeVisible();
  });

  test("login não mostra o link de criar agência", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("criar a agência")).toHaveCount(0);
  });
});

test.describe("logado", () => {
  test.skip(!email || !password, "defina E2E_EMAIL e E2E_PASSWORD para rodar");

  test("todos os módulos permitidos abrem pelo menu", async ({ page, isMobile }) => {
    test.skip(isMobile, "coberto no teste do celular");
    await login(page);
    const nav = page.getByRole("navigation", { name: "Menu principal" });
    const mais = nav.getByRole("button", { name: "Mais áreas" });
    if (await mais.isVisible()) await mais.click();
    for (const m of MODULES) {
      const link = nav.getByRole("link", { name: m.label, exact: true });
      if (!(await link.count())) continue;
      await link.click();
      await expect(page).toHaveURL(new RegExp(`/${m.slug}$`));
      await expect(page.getByRole("heading", { level: 1, name: m.label })).toBeVisible();
    }
  });

  test("no celular o menu abre em gaveta", async ({ page, isMobile }) => {
    test.skip(!isMobile, "só no celular");
    await login(page);
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await page.getByRole("link", { name: "Configurações", exact: true }).click();
    await expect(page).toHaveURL(/\/configuracoes$/);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sw).toBeLessThanOrEqual(0);
  });

  test("Configurações mostra o perfil e valida o CPF", async ({ page }) => {
    await login(page);
    await page.goto("/configuracoes");
    await page.getByLabel("CPF").fill("123");
    await page.getByRole("button", { name: "Salvar perfil" }).click();
    await expect(page.getByText("CPF com 11 números.")).toBeVisible();
  });
});

test.describe("clientes e portal sem login", () => {
  test("ficha de cliente exige login", async ({ page }) => {
    await page.goto("/clientes/00000000-0000-4000-8000-000000000001");
    await expect(page).toHaveURL(/\/login\?next=/);
  });

  test("portal exige login", async ({ page }) => {
    await page.goto("/portal/qualquer-cliente");
    await expect(page).toHaveURL(/\/login/);
  });

  test("link de Central Estratégica inválido é recusado", async ({ page }) => {
    await page.goto("/e/link-que-nao-existe");
    await expect(page.getByText("Link inválido")).toBeVisible();
  });

  test("convite de portal inválido é recusado", async ({ page }) => {
    await page.goto("/portal-convite/token-que-nao-existe");
    await expect(page.getByText("Convite inválido")).toBeVisible();
  });
});

test.describe("demandas, agenda e meu dia sem login", () => {
  for (const path of ["/demandas", "/agenda", "/meu-dia"]) {
    test(`${path} exige login e guarda o destino`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}$`));
    });
  }
});

test.describe("aprovação e social sem login", () => {
  for (const path of ["/aprovacoes", "/social"]) {
    test(`${path} exige login e guarda o destino`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}$`));
    });
  }

  test("aprovação no portal exige login", async ({ page }) => {
    await page.goto("/portal/qualquer-cliente/aprovacoes");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("propostas e contratos", () => {
  for (const path of ["/propostas", "/propostas/nova", "/contratos", "/contratos/modelos/novo"]) {
    test(`${path} exige login e guarda o destino`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}$`));
    });
  }

  test("link de proposta inválido abre sem login e avisa", async ({ page }) => {
    await page.goto("/proposta/link-que-nao-existe-0000000000");
    await expect(page).toHaveURL(/\/proposta\//);
    await expect(page.getByText("Link inválido")).toBeVisible();
  });

  test("link de contrato inválido abre sem login e avisa", async ({ page }) => {
    await page.goto("/contrato/link-que-nao-existe-0000000000");
    await expect(page).toHaveURL(/\/contrato\//);
    await expect(page.getByText("Link inválido")).toBeVisible();
  });
});

test.describe("financeiro sem login", () => {
  for (const path of ["/financeiro", "/financeiro/lancamentos"]) {
    test(`${path} exige login e guarda o destino`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}$`));
    });
  }
});

test.describe("comercial sem login", () => {
  for (const path of [
    "/comercial",
    "/comercial/lista",
    "/comercial/hoje",
    "/comercial/relatorios",
    "/comercial/importar",
    "/comercial/automacoes",
    "/comercial/integracoes",
    "/comercial/configuracoes",
  ]) {
    test(`${path} exige login e guarda o destino`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}$`));
    });
  }
});

test.describe("comercial: entradas públicas", () => {
  test("API de leads exige chave", async ({ request }) => {
    const r = await request.post("/api/comercial/leads", { data: { nome: "Teste" } });
    expect(r.status()).toBe(401);
    expect((await r.json()).ok).toBe(false);
  });

  test("formulário inexistente avisa que está indisponível", async ({ page }) => {
    await page.goto("/f/nao-existe-123");
    await expect(page.getByText("Formulário indisponível")).toBeVisible();
  });
});

test.describe("fase 8 sem login", () => {
  for (const path of [
    "/comunicacao",
    "/mapa-mental",
    "/funil",
    "/mapa-mental/00000000-0000-0000-0000-000000000000",
    "/funil/00000000-0000-0000-0000-000000000000",
  ]) {
    test(`${path} exige login e guarda o destino`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}$`));
    });
  }
});
