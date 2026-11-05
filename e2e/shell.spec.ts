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
    await expect(page.getByRole("alert")).toContainText(/incorretos|tentativas/);
  });

  test("convite inválido é recusado", async ({ page }) => {
    await page.goto("/convite/token-que-nao-existe");
    await expect(page.getByText("Convite inválido")).toBeVisible();
  });

  test("recuperar senha não revela se a conta existe", async ({ page }) => {
    await page.goto("/recuperar-senha");
    await expect(page.getByRole("heading", { name: "Recuperar senha" })).toBeVisible();
  });

  test("página de cadastro abre", async ({ page }) => {
    await page.goto("/cadastro");
    await expect(page.getByRole("heading").first()).toBeVisible();
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
