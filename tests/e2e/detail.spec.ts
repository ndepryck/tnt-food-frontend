import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { fixtureSql } from "./fixtureSql";

test("Given a disposable recipe, When I read it empty and reload it after seeding, Then I see its quantity and steps in API order", async ({ page, request }) => {
  const ingredientId = randomUUID();
  const name = `Soupe ${ingredientId}`;
  const ingredient = `Lentilles ${ingredientId}`;
  let route: string | undefined;
  try {
    const created = await request.post("/v1/recipes/recipes", { data: [{ name, description: "Aux légumes." }] });
    expect(created.status()).toBe(201);
    const [{ id }] = await created.json();
    route = `/v1/recipes/recipes/${id}`;
    await page.goto(`/recipes/${id}`);
    await expect(page.getByText("Aucun ingrédient.")).toBeVisible();
    await expect(page.getByText("Aucune étape.")).toBeVisible();
    fixtureSql(`INSERT INTO recipes.ingredients(id,name) VALUES ('${ingredientId}','${ingredient}')`);
    expect((await request.post(`${route}/ingredients`, { data: [{ ingredientId, quantity: "1 c. à café" }] })).ok()).toBe(true);
    for (const description of ["Servir.", "Mélanger."]) {
      expect((await request.post(`${route}/steps`, { data: { description, position: 1 } })).ok()).toBe(true);
    }
    await page.reload();
    await expect(page.getByRole("heading", { name })).toBeVisible();
    const ingredients = page.getByRole("region", { name: "Ingrédients" });
    const steps = page.getByRole("region", { name: "Préparation" });
    await expect(ingredients.getByRole("listitem").filter({ hasText: ingredient })).toContainText("1 c. à café");
    await expect(steps.locator(".step-instruction")).toHaveText(["1.Mélanger.", "2.Servir."]);
    for (const width of [375, 1536]) {
      await page.setViewportSize({ width, height: 800 });
      const left = (await ingredients.boundingBox())!;
      const right = (await steps.boundingBox())!;
      if (width === 375) expect(left.y + left.height).toBeLessThanOrEqual(right.y);
      else {
        expect(left.x + left.width).toBeLessThanOrEqual(right.x);
        expect(left.x).toBeGreaterThanOrEqual(60);
        expect(left.x).toBeLessThanOrEqual(80);
        const illustration = (await page.locator(".recipe-illustration").boundingBox())!;
        expect(illustration.width).toBeGreaterThan(480);
        expect(illustration.width).toBeLessThan(530);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  } finally {
    try {
      if (route) expect((await request.delete(route)).status()).toBe(204);
    } finally {
      fixtureSql(`DELETE FROM recipes.ingredients WHERE id='${ingredientId}'`);
    }
  }
});
