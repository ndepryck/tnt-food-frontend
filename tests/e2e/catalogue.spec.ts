import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

import { fixtureSql } from "./fixtureSql";

test("Given loaded suggestions, When I type while a search is delayed, Then the picker stays still and previous suggestions cannot be selected", async ({
  page,
}) => {
  const id = randomUUID();
  const name = `Menthe ${id}`;
  const missing = `${name} absente`;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    fixtureSql(
      `INSERT INTO recipes.ingredients(id,name) VALUES ('${id}','${name}')`,
    );
    await page.goto("/recipes");
    await page.getByRole("button", { name: "+ Ingrédient" }).click();
    const dialog = page.getByRole("dialog");
    const input = dialog.getByRole("textbox");
    const suggestion = dialog.getByRole("button", { name, exact: true });
    const bounds = () =>
      Promise.all([
        dialog.boundingBox(),
        dialog.getByRole("heading").boundingBox(),
        input.boundingBox(),
      ]);
    await input.fill(name);
    await expect(suggestion).toBeEnabled();
    const loaded = await bounds();
    await page.route("**/ingredients/search", async (route) => {
      if (route.request().postDataJSON().filter?.value === missing) await gate;
      await route.continue();
    });
    await input.fill(missing);
    await expect(suggestion).toBeVisible();
    await expect(suggestion).toBeDisabled();
    expect(await bounds()).toEqual(loaded);
    release();
    await expect(
      dialog.getByText("Aucun ingrédient disponible sur cette page."),
    ).toBeVisible();
    expect(await bounds()).toEqual(loaded);
    await expect(input).toBeFocused();
  } finally {
    release();
    fixtureSql(`DELETE FROM recipes.ingredients WHERE id='${id}'`);
  }
});

test("Given recipes with overlapping ingredients, When I combine live filters and reverse the sort, Then the matching cards and controls persist on return", async ({
  page,
  request,
}) => {
  const token = randomUUID();
  const ids = [randomUUID(), randomUUID()];
  const names = [`Basilic ${token}`, `Poivre ${token}`];
  const titles = [`Alpha ${token}`, `Bravo ${token}`, `Charlie ${token}`];
  const recipes = "/v1/recipes/recipes";
  let created: { id: string; name: string }[] = [];
  try {
    fixtureSql(
      `INSERT INTO recipes.ingredients(id,name) VALUES ('${ids[0]}','${names[0]}'),('${ids[1]}','${names[1]}')`,
    );
    const response = await request.post(recipes, {
      data: titles.map((name, index) => ({
        name,
        description: index === 2 ? "Salade de saison" : `Velouté ${token}`,
      })),
    });
    expect(response.status()).toBe(201);
    created = await response.json();
    for (const recipe of created) {
      const linked = recipe.name === titles[1] ? ids.slice(0, 1) : ids;
      expect(
        (
          await request.post(`${recipes}/${recipe.id}/ingredients`, {
            data: linked.map((ingredientId) => ({
              ingredientId,
              quantity: "1 g",
            })),
          })
        ).ok(),
      ).toBe(true);
    }
    await page.goto("/recipes");
    const input = page.getByRole("textbox", { name: "Rechercher une recette" });
    await input.fill(`inexistant ${token}`);
    await expect(
      page.getByText("Aucune recette ne correspond à ces filtres."),
    ).toBeVisible();
    await input.fill(`VELOUTÉ ${token}`);
    const cards = page
      .getByRole("list", { name: "Résultats des recettes" })
      .getByRole("link");
    await expect(cards).toHaveText(titles.slice(0, 2));
    for (const name of names) {
      await page.getByRole("button", { name: "+ Ingrédient" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("textbox").fill(name);
      const suggestion = dialog.getByRole("button", { name, exact: true });
      await expect(suggestion).toBeEnabled();
      await page.keyboard.press("Tab");
      await expect(suggestion).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(dialog).not.toBeVisible();
      await expect(
        page.getByRole("button", { name: "+ Ingrédient" }),
      ).toBeFocused();
    }
    await expect(page.getByRole("radio", { name: "Tous" })).toBeChecked();
    await expect(cards).toHaveText([titles[0]]);
    await page.getByRole("button", { name: "Effacer la recherche" }).click();
    await expect(input).toHaveValue("");
    await expect(cards).toHaveText([titles[0], titles[2]]);
    await expect(
      page.getByRole("button", { name: `Retirer ${names[0]}` }),
    ).toBeVisible();
    await page.getByRole("radio", { name: "Au moins un" }).check();
    await expect(cards).toHaveText(titles);
    await page.getByRole("combobox").selectOption({ label: "Nom Z–A" });
    await expect(cards).toHaveText([...titles].reverse());
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await cards.first().click();
    await expect(page.getByRole("heading", { name: titles[2] })).toBeVisible();
    await page.getByRole("link", { name: "Recettes", exact: true }).click();
    await expect(
      page.getByRole("radio", { name: "Au moins un" }),
    ).toBeChecked();
    await expect(cards).toHaveText([...titles].reverse());
  } finally {
    const cleanupFailures: string[] = [];
    for (const { id } of created) {
      try {
        const response = await request.delete(`${recipes}/${id}`);
        if (response.status() !== 204)
          cleanupFailures.push(`Recipe ${id}: HTTP ${response.status()}`);
      } catch (error) {
        cleanupFailures.push(`Recipe ${id}: ${error}`);
      }
    }
    try {
      fixtureSql(
        `DELETE FROM recipes.ingredients WHERE id IN ('${ids[0]}','${ids[1]}')`,
      );
    } catch (error) {
      cleanupFailures.push(`Ingredients ${ids.join(", ")}: ${error}`);
    }
    expect
      .soft(cleanupFailures, "Disposable fixture cleanup failures")
      .toEqual([]);
  }
});
