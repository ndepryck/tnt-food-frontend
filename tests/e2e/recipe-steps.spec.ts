import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("Given an empty recipe, When I append, insert, drag, edit, reposition and delete steps, Then canonical numbering persists", async ({
  page,
  request,
}) => {
  const created = await request.post("/v1/recipes/recipes", {
    data: [{ name: `Steps ${randomUUID()}`, description: "Test." }],
  });
  expect(created.status()).toBe(201);
  const [{ id }] = await created.json();
  const route = `/v1/recipes/recipes/${id}`;
  const prep = page.getByRole("region", { name: "Préparation" });
  const button = (name: string) =>
    prep.getByRole("button", { name, exact: true });
  const submit = (name: string) =>
    page.getByRole("dialog").getByRole("button", { name, exact: true });
  async function checkOrder(...descriptions: string[]) {
    const numbered = descriptions.map(
      (description, i) => `${i + 1}.${description}`,
    );
    await expect(prep.locator(".step-instruction")).toHaveText(numbered);
    const response = await request.get(`${route}/steps`);
    expect(response.ok()).toBe(true);
    expect(
      (await response.json()).map(
        (s: { position: number; description: string }) =>
          `${s.position}.${s.description}`,
      ),
    ).toEqual(numbered);
    await page.reload();
    await expect(prep.locator(".step-instruction")).toHaveText(numbered);
  }
  try {
    await page.goto(`/recipes/${id}`);
    for (const [description, position] of [
      ["Servir.", ""],
      ["Mélanger.", "1"],
    ]) {
      await button("Ajouter une étape").click();
      await page.getByLabel("Instruction").fill(description);
      if (position)
        await page.getByLabel("Position (facultative)").fill(position);
      await submit("Ajouter").click();
      await checkOrder(...(position ? ["Mélanger.", "Servir."] : ["Servir."]));
    }
    const handle = button("Déplacer l’étape 1");
    await handle.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(handle).toBeFocused();
    await handle.scrollIntoViewIfNeeded();
    await prep.getByText("Servir.", { exact: true }).scrollIntoViewIfNeeded();
    const source = await handle.boundingBox();
    const target = await prep
      .getByText("Servir.", { exact: true })
      .boundingBox();
    assert(source, "Expected the first step's drag handle.");
    assert(target, "Expected the drop target for “Servir.”.");
    await page.mouse.move(
      source.x + source.width / 2,
      source.y + source.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      target.x + target.width / 2,
      target.y + target.height / 2,
      { steps: 8 },
    );
    await expect(prep.getByRole("listitem").nth(1)).toHaveAttribute(
      "data-drop",
      "after",
    );
    await page.mouse.up();
    await checkOrder("Servir.", "Mélanger.");
    await button("Modifier l’étape 2").click();
    await page.getByLabel("Instruction").fill("Mixer.");
    await submit("Enregistrer").click();
    await checkOrder("Servir.", "Mixer.");
    await button("Modifier l’étape 2").press("Enter");
    await page.getByLabel("Position", { exact: true }).fill("1");
    await submit("Enregistrer").press("Enter");
    await checkOrder("Mixer.", "Servir.");
    await button("Supprimer l’étape 1").click();
    await expect(page.getByRole("dialog")).toContainText("Mixer.");
    await submit("Supprimer").click();
    await checkOrder("Servir.");
  } finally {
    expect((await request.delete(route)).status()).toBe(204);
  }
});

test("Given a long preparation, When I hold the drag at the viewport edge, Then I can drop onto the initially offscreen last step", async ({
  page,
  request,
}) => {
  const created = await request.post("/v1/recipes/recipes", {
    data: [{ name: `Long ${randomUUID()}`, description: "Test." }],
  });
  expect(created.status()).toBe(201);
  const [{ id }] = await created.json();
  const route = `/v1/recipes/recipes/${id}`;
  try {
    const count = 14;
    for (let n = 1; n <= count; n++) {
      expect(
        (
          await request.post(`${route}/steps`, {
            data: { description: `Instruction ${n}` },
          })
        ).status(),
      ).toBe(201);
    }
    await page.setViewportSize({ width: 390, height: 540 });
    await page.goto(`/recipes/${id}`);
    const handle = page.getByRole("button", {
      name: "Déplacer l’étape 1",
      exact: true,
    });
    await handle.scrollIntoViewIfNeeded();
    const last = page
      .getByRole("region", { name: "Préparation" })
      .getByRole("listitem")
      .last();
    const lastBox = await last.boundingBox();
    assert(lastBox, "Expected the last step to have a layout box.");
    expect(lastBox.y).toBeGreaterThan(540);
    const box = await handle.boundingBox();
    assert(box, "Expected the first step's drag handle.");
    const x = box.x + box.width / 2;
    await page.mouse.move(x, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(x, 536, { steps: 8 });
    await expect(last).toHaveAttribute("data-drop", "after");
    await page.mouse.up();
    await expect(last.locator(".step-instruction span")).toHaveText(
      "Instruction 1",
    );
    await page.reload();
    await expect(last.locator(".step-instruction")).toHaveText(
      `${count}.Instruction 1`,
    );
    const lastHandle = last.getByRole("button", {
      name: `Déplacer l’étape ${count}`,
    });
    await lastHandle.scrollIntoViewIfNeeded();
    const first = page
      .getByRole("region", { name: "Préparation" })
      .getByRole("listitem")
      .first();
    const firstBox = await first.boundingBox();
    assert(firstBox, "Expected the first step to have a layout box.");
    expect(firstBox.y + firstBox.height).toBeLessThan(0);
    const end = await lastHandle.boundingBox();
    assert(end, "Expected the last step's drag handle.");
    await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2);
    await page.mouse.down();
    await page.mouse.move(x, 4, { steps: 8 });
    await expect(first).toHaveAttribute("data-drop", "before");
    await page.mouse.up();
    await expect(first.locator(".step-instruction")).toHaveText(
      "1.Instruction 1",
    );
  } finally {
    expect((await request.delete(route)).status()).toBe(204);
  }
});
