import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("Given a real recipe, When I navigate between catalogue and detail, Then reload and browser back preserve the page", async ({
  page,
  request,
}) => {
  const recipes = "/v1/recipes/recipes";
  const name = `000 E2E ${randomUUID()}`;
  const description = "Recette temporaire de vérification.";
  const created = await request.post(recipes, {
    data: [{ name, description }],
  });
  expect(created.status()).toBe(201);
  const [{ id }] = await created.json();
  try {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Recettes" })).toBeVisible();
    const link = page.getByRole("link", { name });
    await expect(link).toBeVisible();
    for (
      let i = 0;
      i < 24 && !(await link.evaluate((el) => el === document.activeElement));
      i++
    ) {
      await page.keyboard.press("Tab");
    }
    await expect(link).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(`/recipes/${id}`);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await page.reload();
    await expect(page.getByText(description)).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.goBack();
    await expect(link).toBeVisible();
    await page.goto(`/recipes/${id}`);
    await expect(page.getByRole("heading", { name })).toBeVisible();
  } finally {
    expect((await request.delete(`${recipes}/${id}`)).status()).toBe(204);
  }
  await test.step("Given the recipe was deleted, When I reload, Then the missing-recipe page links back to the catalogue", async () => {
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Recette introuvable" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Retour au catalogue" }).click();
    await expect(page).toHaveURL("/recipes");
    await expect(page.getByRole("heading", { name: "Recettes" })).toBeVisible();
  });
});
