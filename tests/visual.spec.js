import { test, expect } from "@playwright/test";

async function answer(page, optionId, {customOccupation} = {}) {
  await page.locator(`input[name="answer"][value="${optionId}"]`).check();
  if (customOccupation) await page.locator("#customOccupation").fill(customOccupation);
  await page.locator("#next").click();
}

async function reachPreview(page) {
  await page.goto("/");
  await expect(page.getByRole("heading", {name:"你的角色長什麼樣子？"})).toBeVisible();
  await answer(page,"neat_reliable");
  await answer(page,"truth_above_comfort");
  await answer(page,"family_member");
  await answer(page,"family_secret");
  await answer(page,"mysterious_object");
  await answer(page,"mystery_wrongness");
  await answer(page,"deceived_again");
  await answer(page,"deceived_misunderstood");
  await answer(page,"quiet_listener");
  await answer(page,"hometown");
  await answer(page,"knowledge_research");
  await answer(page,"research_contradiction");
  await expect(page.getByRole("heading",{name:"背景預覽"})).toBeVisible();
}

async function assertNoHorizontalOverflow(page, viewportWidth) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  expect(dimensions.viewport).toBe(viewportWidth);
  expect(dimensions.document, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.body, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport);
}

test("questionnaire and preview remain usable at phone, tablet, and desktop widths", async ({page}, testInfo) => {
  const viewports = [
    {width:320,height:800,name:"phone-320"},
    {width:390,height:844,name:"phone-390"},
    {width:768,height:1024,name:"tablet-768"},
    {width:1440,height:1000,name:"desktop-1440"}
  ];

  await page.setViewportSize({width:390,height:844});
  await page.goto("/");
  await expect(page.getByRole("heading",{name:"你的角色長什麼樣子？"})).toBeVisible();

  for (const viewport of viewports) {
    await page.setViewportSize({width:viewport.width,height:viewport.height});
    await assertNoHorizontalOverflow(page,viewport.width);
    await expect(page.getByRole("heading",{name:"你的角色長什麼樣子？"})).toBeVisible();
    await expect(page.locator(".option").first()).toBeVisible();
    await expect(page.locator("#next")).toBeVisible();
    if (viewport.name === "phone-390" || viewport.name === "desktop-1440") {
      await page.screenshot({path:testInfo.outputPath(`questionnaire-${viewport.name}.png`),fullPage:true});
    }
  }

  await reachPreview(page);
  for (const viewport of viewports) {
    await page.setViewportSize({width:viewport.width,height:viewport.height});
    await assertNoHorizontalOverflow(page,viewport.width);
    await expect(page.getByRole("heading",{name:"背景預覽"})).toBeVisible();
    await expect(page.locator(".field")).toHaveCount(13);
    await expect(page.getByRole("button",{name:"匯出 JSON"})).toBeVisible();
    await expect(page.getByRole("button",{name:"複製完整背景"})).toBeVisible();
    const lastField = page.locator(".field").last();
    await lastField.scrollIntoViewIfNeeded();
    await expect(lastField).toBeVisible();
    if (viewport.name === "phone-390" || viewport.name === "desktop-1440") {
      await page.screenshot({path:testInfo.outputPath(`preview-${viewport.name}.png`),fullPage:true});
    }
  }
});
