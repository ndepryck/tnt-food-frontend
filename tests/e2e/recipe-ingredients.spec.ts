import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { fixtureSql } from "./fixtureSql";

test("Given an existing ingredient, When I add, edit and unlink it, Then each change persists and the catalogue ingredient remains selectable", async ({
  page,
  request,
}) => {
  const ingredientId = randomUUID();
  const name = `Riz ${ingredientId}`;
  let recipeUrl: string | undefined;
  const openPicker = async () => {
    await page.getByRole("button", { name: "Ajouter un ingrédient" }).click();
    await page.getByLabel("Rechercher un ingrédient").fill(name);
  };
  try {
    fixtureSql(
      `INSERT INTO recipes.ingredients(id,name) VALUES ('${ingredientId}','${name}')`,
    );
    const created = await request.post("/v1/recipes/recipes", {
      data: [{ name: `Plat ${ingredientId}`, description: "Pour le test." }],
    });
    expect(created.status()).toBe(201);
    const [{ id }] = await created.json();
    recipeUrl = `/v1/recipes/recipes/${id}`;
    await page.goto(`/recipes/${id}`);
    await openPicker();
    const suggestion = page.getByRole("button", { name, exact: true });
    await expect(suggestion).toBeEnabled();
    await suggestion.press("Enter");
    await page
      .getByRole("dialog")
      .getByRole("textbox", { name: "Quantité", exact: true })
      .fill("250 g");
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(page.getByText("250 g")).toBeVisible();
    await page.reload();
    await expect(page.getByText("250 g")).toBeVisible();
    await page
      .getByRole("button", { name: `Modifier la quantité : ${name}` })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("textbox", { name: "Quantité", exact: true })
      .fill("300 g");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("300 g")).toBeVisible();
    await page.reload();
    await expect(page.getByText("300 g")).toBeVisible();
    await page
      .getByRole("button", { name: `Retirer de la recette : ${name}` })
      .click();
    await expect(page.getByRole("dialog")).toContainText(name);
    await page.getByRole("button", { name: "Retirer", exact: true }).click();
    await expect(page.getByText("Aucun ingrédient.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Ajouter un ingrédient" }),
    ).toBeFocused();
    await page.reload();
    await expect(page.getByText("Aucun ingrédient.")).toBeVisible();
    await openPicker();
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  } finally {
    try {
      if (recipeUrl)
        expect((await request.delete(recipeUrl)).status()).toBe(204);
    } finally {
      fixtureSql(`DELETE FROM recipes.ingredients WHERE id='${ingredientId}'`);
    }
  }
});
