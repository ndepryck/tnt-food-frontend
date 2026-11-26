import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";

const recipes = "/v1/recipes/recipes";
const headerRecipesLink = (page: Page) =>
  page
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("link", { name: "Recettes", exact: true });

test("Given a real recipe, When I navigate between catalogue and detail, Then reload and browser back preserve the page", async ({
  page,
  request,
}) => {
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
  await test.step("Given the recipe was deleted, When I reload and activate the header link, Then I return to the catalogue", async () => {
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Recette introuvable" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Retour au catalogue" }),
    ).toHaveAttribute("href", "/recipes");
    await headerRecipesLink(page).click();
    await expect(page).toHaveURL("/recipes");
    await expect(page.getByRole("heading", { name: "Recettes" })).toBeVisible();
  });
});

test("Given a filtered catalogue, When I repeatedly click its header link and press Enter, Then the document, results, filters and scroll stay put without a new search", async ({
  page,
  request,
}) => {
  const token = randomUUID();
  const filter = `Cible ${token}`;
  const titles = [`Alpha ${token}`, `Bravo ${token}`];
  const control = `Charlie ${token}`;
  const created = await request.post(recipes, {
    data: [
      ...titles.map((name) => ({ name, description: filter })),
      { name: control, description: "Recette temporaire hors filtre." },
    ],
  });
  expect(created.status()).toBe(201);
  const rows: { id: string }[] = await created.json();
  try {
    await page.setViewportSize({ width: 375, height: 500 });
    const documentRequests: string[] = [];
    const catalogueRequests: string[] = [];
    page.on("request", (req) => {
      if (req.isNavigationRequest() && req.resourceType() === "document")
        documentRequests.push(req.url());
      if (new URL(req.url()).pathname === `${recipes}/search`)
        catalogueRequests.push(req.url());
    });
    const input = page.getByRole("textbox", { name: "Rechercher une recette" });
    const sort = page.getByRole("combobox", { name: "Trier les recettes" });
    const cards = page
      .getByRole("list", { name: "Résultats des recettes" })
      .getByRole("link");
    const link = headerRecipesLink(page);
    const scrollPosition = () => page.evaluate(() => window.scrollY);
    const searchWith = async (text: string) => {
      const [response] = await Promise.all([
        page.waitForResponse((response) => {
          const req = response.request();
          if (
            req.method() !== "POST" ||
            new URL(req.url()).pathname !== `${recipes}/search`
          )
            return false;
          const { filter, sort, offset } = req.postDataJSON();
          return (
            offset === 0 &&
            sort?.attribute === "name" &&
            sort?.direction === "DESC" &&
            filter?.children?.some(
              (child: { attribute: string; value: string }) =>
                child.attribute === "description" && child.value === text,
            )
          );
        }),
        input.fill(text),
      ]);
      expect(response.status()).toBe(200);
    };

    for (const path of ["/", "/recipes", "/recipes/"]) {
      await test.step(`Given the catalogue at ${path}, When I activate “Recettes”, Then the filtered results do not reload`, async () => {
        await page.goto(path);
        await sort.selectOption("nameDesc");
        // The broader query proves these aren't cards restored from the
        // previous alias: its control must appear, then disappear again.
        await searchWith(token);
        await expect(cards).toHaveText([control, titles[1], titles[0]]);
        await searchWith(filter);
        await expect(cards).toHaveText([titles[1], titles[0]]);
        await expect(link).toHaveAttribute("href", "/recipes");
        await expect(link).toHaveAttribute("aria-current", "page");
        await page.evaluate(() => window.scrollTo(0, 16));
        await expect.poll(scrollPosition).toBe(16);

        const documentStart = await page.evaluate(() => performance.timeOrigin);
        const documents = documentRequests.length;
        const searches = catalogueRequests.length;
        await link.click();
        await link.click();
        await expect(link).toBeFocused();
        await page.keyboard.press("Enter");
        // Observe negative network behavior for longer than the 250 ms
        // catalogue debounce, starting from the last activation.
        await page.waitForTimeout(350);

        await expect(page).toHaveURL(path);
        await expect(link).toBeFocused();
        await expect(input).toHaveValue(filter);
        await expect(sort).toHaveValue("nameDesc");
        await expect(cards).toHaveText([titles[1], titles[0]]);
        expect(await scrollPosition()).toBe(16);
        expect(await page.evaluate(() => performance.timeOrigin)).toBe(
          documentStart,
        );
        expect(documentRequests).toHaveLength(documents);
        expect(catalogueRequests).toHaveLength(searches);
      });
    }
  } finally {
    const deleted = await Promise.all(
      rows.map(({ id }) => request.delete(`${recipes}/${id}`)),
    );
    expect(deleted.map((response) => response.status())).toEqual([
      204, 204, 204,
    ]);
  }
});

test("Given a real recipe, When I open its detail on mobile and desktop, Then the header link stays in place and returns to the catalogue", async ({
  page,
  request,
}) => {
  const name = `000 E2E ${randomUUID()}`;
  const created = await request.post(recipes, {
    data: [{ name, description: "Recette temporaire." }],
  });
  expect(created.status()).toBe(201);
  const [{ id }] = await created.json();
  try {
    for (const width of [375, 1440]) {
      await test.step(`Given a ${width}px viewport, When I open a recipe, Then the header link has the same coordinates`, async () => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto("/");
        const card = page.getByRole("link", { name });
        await expect(card).toBeVisible();
        const link = headerRecipesLink(page);
        const catalogueBounds = await link.boundingBox();
        expect(catalogueBounds).not.toBeNull();

        await card.click();
        await expect(page).toHaveURL(`/recipes/${id}`);
        await expect(page.getByRole("heading", { name })).toBeVisible();
        expect(await link.boundingBox()).toEqual(catalogueBounds);
        expect(await link.getAttribute("aria-current")).toBeNull();

        await link.click();
        await expect(page).toHaveURL("/recipes");
        await expect(card).toBeVisible();
        expect(await link.boundingBox()).toEqual(catalogueBounds);
        await expect(link).toHaveAttribute("aria-current", "page");
      });
    }
  } finally {
    expect((await request.delete(`${recipes}/${id}`)).status()).toBe(204);
  }
});
