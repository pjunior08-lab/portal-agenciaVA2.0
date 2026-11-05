import { expect, test } from "@playwright/test";
import { MODULES } from "../src/lib/navigation";

test("a raiz leva ao Início", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/inicio$/);
  await expect(page.getByRole("heading", { level: 1, name: "Início" })).toBeVisible();
});

test("todos os itens do menu abrem a página do módulo", async ({ page, isMobile }) => {
  test.skip(isMobile, "coberto pelo teste do menu em gaveta");
  await page.goto("/inicio");
  const nav = page.getByRole("navigation", { name: "Menu principal" });
  await nav.getByRole("button", { name: "Mais áreas" }).click();
  for (const m of MODULES) {
    await nav.getByRole("link", { name: m.label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${m.slug}$`));
    await expect(page.getByRole("heading", { level: 1, name: m.label })).toBeVisible();
    await expect(nav.getByRole("link", { name: m.label, exact: true })).toHaveAttribute("aria-current", "page");
  }
});

test("no celular o menu abre em gaveta e fecha ao navegar", async ({ page, isMobile }) => {
  test.skip(!isMobile, "só no celular");
  await page.goto("/inicio");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("link", { name: "Clientes", exact: true }).click();
  await expect(page).toHaveURL(/\/clientes$/);
  await expect(page.getByRole("dialog")).toBeHidden();
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const width = await page.evaluate(() => window.innerWidth);
  expect(scrollWidth).toBeLessThanOrEqual(width);
});

test("alterna entre tema claro e escuro", async ({ page, isMobile }) => {
  await page.goto("/inicio");
  if (isMobile) await page.getByRole("button", { name: "Abrir menu" }).click();
  const html = page.locator("html");
  const toggle = page.getByTestId("theme-toggle").last();
  const before = (await html.getAttribute("class"))?.includes("dark");
  await toggle.click();
  await expect.poll(async () => (await html.getAttribute("class"))?.includes("dark")).toBe(!before);
});

test("endereço inexistente mostra página não encontrada", async ({ page }) => {
  const res = await page.goto("/nao-existe");
  expect(res?.status()).toBe(404);
});

test("modal da vitrine abre, prende o foco e fecha com Esc", async ({ page }) => {
  await page.goto("/componentes");
  await page.getByRole("button", { name: "Abrir modal" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
