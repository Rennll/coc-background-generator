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
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("coc-investigator-background.json");
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
