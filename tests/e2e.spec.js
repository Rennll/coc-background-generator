import { test, expect } from "@playwright/test";

async function answer(page, optionId, {customOccupation} = {}) {
  await page.locator(`input[name="answer"][value="${optionId}"]`).check();
  if (customOccupation) await page.locator("#customOccupation").fill(customOccupation);
  await page.locator("#next").click();
}

test("standard route: branch navigation, editable preview, and JSON export", async ({ page }) => {
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
  for (const label of ["姓名","職業","年齡","出生地","居住地","外貌描述","信念","重要之人","珍貴之物","恐懼與擔憂","個性","有意義的地點","與調查的連結"]) {
    await expect(page.locator(".field").filter({has:page.getByRole("heading",{name:label,exact:true})})).toBeVisible();
  }
  await page.locator('[data-edit="background:belief"]').click();
  await page.locator("#editor").fill("我只相信能夠查證的事實。");
  await page.locator('[data-save="background:belief"]').click();
  await expect(page.getByText("我只相信能夠查證的事實。")).toBeVisible();

  const occupationField=page.locator(".field").filter({has:page.getByRole("heading",{name:"職業",exact:true})});
  await occupationField.getByRole("button",{name:"編輯"}).click();
  await page.locator("#occupation-select").selectOption("other_custom");
  await page.locator("#occupation-custom").fill("大學教授");
  await occupationField.getByRole("button",{name:"儲存"}).click();
  await expect(occupationField).toContainText("大學教授");

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("coc-investigator-background.json");
  const stream = await download.createReadStream();
  let exportedText = "";
  for await (const chunk of stream) exportedText += chunk.toString("utf8");
  const exported = JSON.parse(exportedText);
  expect(exported.background.belief).toBe("我只相信能夠查證的事實。");
  expect(exported.profile.occupation).toBe("大學教授");
  for (const forbidden of ["rawAnswers","answers","stats","skills","Q1"]) expect(exported).not.toHaveProperty(forbidden);
  page.once("dialog", dialog => dialog.dismiss());
  await page.locator("#restart").click();
  await expect(page.getByRole("heading",{name:"背景預覽"})).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await page.locator("#restart").click();
  await expect(page.getByRole("heading",{name:"你的角色長什麼樣子？"})).toBeVisible();
});

test("custom occupation uses the generic Q11 branch and remains editable in preview", async ({page}) => {
  await page.goto("/");
  await answer(page,"neat_reliable");
  await answer(page,"truth_above_comfort");
  await answer(page,"mentor");
  await answer(page,"mentor_unthanked");
  await answer(page,"profession_item");
  await answer(page,"profession_first_recognition");
  await answer(page,"helpless_witness");
  await answer(page,"helpless_could_not_help");
  await answer(page,"quick_trust");
  await answer(page,"private_corner");
  await answer(page,"other_custom",{customOccupation:"鐘錶匠"});
  await expect(page.getByRole("heading",{name:"這份工作如何牽連到調查？"})).toBeVisible();
  await answer(page,"custom_work_unusual_detail");
  await expect(page.getByRole("heading",{name:"背景預覽"})).toBeVisible();
  await expect(page.locator(".field").filter({has:page.getByRole("heading",{name:"職業",exact:true})})).toContainText("鐘錶匠");
  await expect(page.locator(".field").filter({has:page.getByRole("heading",{name:"與調查的連結",exact:true})})).toContainText("日常工作");
});

test("changing Q10 clears the stale Q11 child answer in a real browser", async ({page}) => {
  await page.goto("/");
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
  await answer(page,"other_custom",{customOccupation:"鐘錶匠"});
  await expect(page.getByRole("heading",{name:"這份工作如何牽連到調查？"})).toBeVisible();
  await expect(page.locator('input[name="answer"][value="custom_work_unusual_detail"]')).toBeVisible();
  await page.locator("#prev").click();
  await expect(page.getByRole("heading",{name:"他／她以什麼維生？"})).toBeVisible();
  await page.locator('input[name="answer"][value="knowledge_research"]').check();
  await page.locator("#next").click();
  await expect(page.getByRole("heading",{name:"這份工作如何牽連到調查？"})).toBeVisible();
  await expect(page.locator('input[name="answer"][value="custom_work_unusual_detail"]')).toHaveCount(0);
  await expect(page.locator('input[name="answer"][value="research_contradiction"]')).toBeVisible();
  await expect(page.locator('input[name="answer"][value="research_contradiction"]')).not.toBeChecked();
});

test("occupation selector preserves English names, source tags, and custom entry", async ({page}) => {
  await page.goto("/");
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
  const occupationField=page.locator(".field").filter({has:page.getByRole("heading",{name:"職業",exact:true})});
  await occupationField.getByRole("button",{name:"編輯"}).click();
  const selector=page.locator("#occupation-select");
  await expect(selector.locator("option")).toHaveCount(93);
  await expect(selector.locator('option[value="acrobat"]')).toContainText("雜技演員（Acrobat）");
  await expect(selector.locator('option[value="computer_programmer_technician_hacker"]')).toContainText("Modern");
  await expect(selector.locator('option[value="antiquarian"]')).toContainText("Lovecraftian");
  await selector.selectOption("other_custom");
  await page.locator("#occupation-custom").fill("鐘錶匠");
  await occupationField.getByRole("button",{name:"儲存"}).click();
  await expect(occupationField.getByText("鐘錶匠")).toBeVisible();
});
test("blank background fields stay visible, full copy skips them, and single-field copy is empty", async ({page,context}) => {
  await context.grantPermissions(["clipboard-read","clipboard-write"]);
  await page.goto("/");
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

  const beliefField=page.locator(".field").filter({has:page.getByRole("heading",{name:"信念",exact:true})});
  await beliefField.getByRole("button",{name:"編輯"}).click();
  await page.locator("#editor").fill("");
  await beliefField.getByRole("button",{name:"儲存"}).click();
  await expect(beliefField).toBeVisible();
  await expect(beliefField.getByText("尚未填寫")).toBeVisible();

  await page.locator("#copyAll").click();
  const fullText=await page.evaluate(()=>navigator.clipboard.readText());
  expect(fullText).not.toContain("信念：");
  expect(fullText).toContain("外貌描述：");

  await beliefField.getByRole("button",{name:"複製欄位"}).click();
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe("");
});
