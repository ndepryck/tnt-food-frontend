import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("Given a filtered catalogue, When I create, edit, cancel and confirm deletion, Then the changes survive reload and Back without losing filters", async ({ page, request }) => {
  const token = randomUUID();
  const api = "/v1/recipes/recipes";
  const name = `Soupe ${token}`;
  const renamed = `Velouté ${token}`;
  let id: string | undefined;
  const modal = page.getByRole("dialog");
  try {
    await page.goto("/recipes");
    const search = page.getByRole("textbox", { name: "Rechercher une recette" });
    await search.fill(token);
    await page.getByRole("combobox").selectOption("descriptionDesc");
    await expect(page.getByText("Aucune recette ne correspond à ces filtres.")).toBeVisible();
    await page.getByRole("button", { name: "+ Nouvelle recette" }).click();
    await expect(modal.getByLabel("Nom")).toBeFocused();
    await modal.getByLabel("Nom").fill(name);
    await modal.getByLabel("Description").fill("Servir chaud.");
    const created = page.waitForResponse(r => new URL(r.url()).pathname === api && r.request().method() === "POST");
    await modal.getByRole("button", { name: "Créer" }).click();
    const response = await created;
    expect(response.status()).toBe(201);
    await expect(page).toHaveURL(/\/recipes\/[0-9a-f-]{36}$/);
    id = new URL(page.url()).pathname.split("/").pop();
    await expect(page.getByRole("heading", { name })).toBeFocused();
    await page.reload();
    await expect(page.getByText("Servir chaud.")).toBeVisible();

    await page.getByRole("button", { name: `Modifier la recette : ${name}` }).click();
    await expect(modal.getByLabel("Nom")).toHaveValue(name);
    await expect(modal.getByLabel("Description")).toHaveValue("Servir chaud.");
    await modal.getByLabel("Nom").fill(renamed);
    await modal.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByRole("heading", { name: renamed })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: renamed })).toBeVisible();
    await page.goBack();
    await expect(search).toHaveValue(token);
    await expect(page.getByRole("combobox")).toHaveValue("descriptionDesc");
    await page.getByRole("button", { name: `Modifier la recette : ${renamed}` }).click();
    await modal.getByLabel("Description").fill("Ajouter du persil.");
    await modal.getByRole("button", { name: "Enregistrer" }).click();
    await expect(modal).not.toBeVisible();
    await page.reload();
    const trash = page.getByRole("button", { name: `Supprimer la recette : ${renamed}` });
    await trash.click();
    await expect(modal.getByText(`Supprimer définitivement la recette « ${renamed} » ?`)).toBeVisible();
    await expect(modal.getByRole("button", { name: "Annuler" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(trash).toBeFocused();
    await page.getByRole("link", { name: renamed }).click();
    await expect(page.getByText("Ajouter du persil.")).toBeVisible();
    await trash.click();
    expect(await modal.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await modal.getByRole("button", { name: "Supprimer", exact: true }).click();
    await expect(page).toHaveURL("/recipes");
    await expect(page.getByRole("heading", { name: "Recettes" })).toBeFocused();
    await page.reload();
    await expect(search).toHaveValue(token);
    await expect(page.getByRole("combobox")).toHaveValue("descriptionDesc");
    await expect(page.getByText("Aucune recette ne correspond à ces filtres.")).toBeVisible();
    expect((await request.get(`${api}/${id}`)).status()).toBe(404);
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Recette introuvable" })).toBeVisible();
  } finally {
    if (!id) {
      const lookup = await request.post(`${api}/search`, { data: { filter: { attribute: "name", filterOperator: "EQ", value: name } } });
      expect(lookup.ok()).toBe(true);
      id = (await lookup.json()).items[0]?.id;
    }
    if (id) expect([204, 404]).toContain((await request.delete(`${api}/${id}`)).status());
  }
});
