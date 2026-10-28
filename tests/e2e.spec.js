import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

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
  await expect(page.locator(".field").filter({has:page.getByRole("heading",{name:"有意義的地點",exact:true})})).toContainText("對他／她而言，特別有意義的地方是成長的家鄉或童年住處。");
  for (const label of ["姓名","職業","年齡","出生地","居住地","外貌描述","信念","重要之人","珍貴之物","恐懼與擔憂","個性","有意義的地點","與調查的連結"]) {
    const field=page.locator(".field").filter({has:page.getByRole("heading",{name:label,exact:true})});
    await expect(field).toBeVisible();
    await expect(field.locator(`[data-edit]`)).toHaveAttribute("aria-label",`編輯：${label}`);
  }
  await page.locator('[data-edit="background:belief"]').click();
  await page.locator("#editor").fill("我只相信能夠查證的事實。");
  await page.locator('[data-save="background:belief"]').click();
  await expect(page.getByText("我只相信能夠查證的事實。")).toBeVisible();

  const occupationField=page.locator(".field").filter({has:page.getByRole("heading",{name:"職業",exact:true})});
  await occupationField.locator('[data-edit="profile:occupation"]').click();
  await page.locator("#occupation-select").selectOption("other_custom");
  await page.locator("#occupation-custom").fill("大學教授");
  await occupationField.locator('[data-save="profile:occupation"]').click();
  await expect(occupationField).toContainText("大學教授");

  // Exercise all remaining basic profile editors, including blank age -> JSON null.
  for (const [field,value] of [["profile:name","林明遠"],["profile:birthplace","臺南市"],["profile:residence","臺北市"]]) {
    await page.locator(`[data-edit="${field}"]`).click();
    await page.locator("#editor").fill(value);
    await page.locator(`[data-save="${field}"]`).click();
    await expect(page.locator(`.field [data-edit="${field}"]`).locator("..")).toBeVisible();
  }
  await page.locator('[data-edit="profile:age"]').click();
  await page.locator("#editor").fill("42");
  await page.locator('[data-save="profile:age"]').click();
  await expect(page.locator(".field").filter({has:page.getByRole("heading",{name:"年齡",exact:true})})).toContainText("42");
  await page.locator('[data-edit="profile:age"]').click();
  await page.locator("#editor").fill("");
  await page.locator('[data-save="profile:age"]').click();
  await expect(page.locator(".field").filter({has:page.getByRole("heading",{name:"年齡",exact:true})})).toContainText("尚未填寫");

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
  expect(exported.profile.name).toBe("林明遠");
  expect(exported.profile.birthplace).toBe("臺南市");
  expect(exported.profile.residence).toBe("臺北市");
  expect(exported.profile.age).toBeNull();
  expect(Object.keys(exported).sort()).toEqual(["background","meta","profile","version"]);
  expect(Object.keys(exported.profile).sort()).toEqual(["age","birthplace","name","occupation","residence"]);
  expect(Object.keys(exported.background).sort()).toEqual(["appearance","belief","fear_or_concern","investigation_hook","meaningful_location","personality","significant_person","treasured_possession"]);
  expect(Object.keys(exported.meta).sort()).toEqual(["created_at","generator"]);
  for (const forbidden of ["rawAnswers","answers","stats","skills","during_play","Q1"]) expect(exported).not.toHaveProperty(forbidden);
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
  await expect(page.getByRole("heading",{name:"他／她如何捲入這次調查？"})).toBeVisible();
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
  await expect(page.getByRole("heading",{name:"他／她如何捲入這次調查？"})).toBeVisible();
  await expect(page.locator('input[name="answer"][value="custom_work_unusual_detail"]')).toBeVisible();
  await page.locator("#prev").click();
  await expect(page.getByRole("heading",{name:"你平常靠什麼維生？"})).toBeVisible();
  await page.locator('input[name="answer"][value="knowledge_research"]').check();
  await page.locator("#next").click();
  await expect(page.getByRole("heading",{name:"他／她如何捲入這次調查？"})).toBeVisible();
  await expect(page.locator('input[name="answer"][value="custom_work_unusual_detail"]')).toHaveCount(0);
  await expect(page.locator('input[name="answer"][value="research_contradiction"]')).toBeVisible();
  await expect(page.locator('input[name="answer"][value="research_contradiction"]')).not.toBeChecked();
});

test("changing Q3a, Q4, and Q6 clears stale child answers in a real browser", async ({page}) => {
  await page.goto("/");
  await answer(page,"neat_reliable");
  await answer(page,"truth_above_comfort");
  await answer(page,"family_member");
  await answer(page,"family_secret");
  await page.locator("#prev").click();
  await page.locator("#prev").click();
  await page.locator('input[name="answer"][value="romantic_partner"]').check();
  await page.locator("#next").click();
  await expect(page.getByRole("heading",{name:"你們之間發生過什麼？"})).toBeVisible();
  await expect(page.locator('input[name="answer"][value="family_secret"]')).toHaveCount(0);
  await expect(page.locator('input[name="answer"][value="romance_unresolved_end"]')).toBeVisible();
  await answer(page,"romance_unresolved_end");

  await answer(page,"mysterious_object");
  await answer(page,"mystery_wrongness");
  await page.locator("#prev").click();
  await page.locator("#prev").click();
  await page.locator('input[name="answer"][value="profession_item"]').check();
  await page.locator("#next").click();
  await expect(page.getByRole("heading",{name:"那樣東西為什麼重要？"})).toBeVisible();
  await expect(page.locator('input[name="answer"][value="mystery_wrongness"]')).toHaveCount(0);
  await expect(page.locator('input[name="answer"][value="profession_first_recognition"]')).toBeVisible();
  await answer(page,"profession_first_recognition");

  await answer(page,"deceived_again");
  await answer(page,"deceived_misunderstood");
  await page.locator("#prev").click();
  await page.locator("#prev").click();
  await page.locator('input[name="answer"][value="helpless_witness"]').check();
  await page.locator("#next").click();
  await expect(page.getByRole("heading",{name:"這份擔憂從何而來？"})).toBeVisible();
  await expect(page.locator('input[name="answer"][value="deceived_misunderstood"]')).toHaveCount(0);
  await expect(page.locator('input[name="answer"][value="helpless_could_not_help"]')).toBeVisible();
  await answer(page,"helpless_could_not_help");

  await answer(page,"quiet_listener");
  await answer(page,"hometown");
  await answer(page,"knowledge_research");
  await answer(page,"research_contradiction");
  await expect(page.getByRole("heading",{name:"背景預覽"})).toBeVisible();
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
  const occupationData=JSON.parse(await readFile(new URL("../data/occupations.json",import.meta.url),"utf8"));
  await expect(selector.locator("option")).toHaveCount(occupationData.occupations.length+2);
  for(const occupation of occupationData.occupations){
    await expect(selector.locator(`option[value="${occupation.id}"]`),occupation.englishCandidate).toHaveCount(1);
  }
  await expect(selector.locator("option")).toHaveCount(93);
  await expect(selector.locator('option[value="acrobat"]')).toContainText("雜技演員（Acrobat）");
  await expect(selector.locator('option[value="computer_programmer_technician_hacker"]')).toContainText("Modern");
  await expect(selector.locator('option[value="antiquarian"]')).toContainText("Lovecraftian");
  await expect(selector.locator('option[value="antiquarian"]')).toContainText("官方規則 Wiki 範例已佐證");
  await expect(selector.locator('option[value="accountant"]')).toContainText("1920年代適用性未逐項核實");
  await expect(page.getByText("清單依使用者提供且已逐字與實體 Investigator Handbook 核對的英文清單整理。")).toBeVisible();
  await expect(selector.locator('option[value="criminal"]')).toContainText("另見：Gangster");
  await expect(selector.locator('option[value="physician"]')).toContainText("另見：Psychiatrist");
  await expect(selector.locator('option[value="pilot"]')).toContainText("另見：Aviator");
  await expect(selector.locator('option[value="butler_valet_maid"]')).toContainText("另見：Maid、Valet");
  await expect(selector.locator('option[value="computer_programmer_technician_hacker"]')).toContainText("另見：Hacker");
  await expect(selector.locator('option[value="driver"]')).toContainText("另見：Chauffeur、Taxi Driver");
  await expect(selector.locator('option[value="journalist"]')).toContainText("另見：Reporter");
  await expect(selector.locator('option[value="laborer"]')).toContainText("另見：Lumberjack、Miner");
  await expect(selector.locator('option[value="photographer"]')).toContainText("另見：Photojournalist");
  await expect(selector.locator('option[value="criminal"]')).toContainText("Assassin");
  await expect(selector.locator('option[value="criminal"]')).toContainText("Gun Moll");
  await selector.selectOption("other_custom");
  await page.locator("#occupation-custom").fill("鐘錶匠");
  await occupationField.getByRole("button",{name:"儲存"}).click();
  await expect(occupationField.getByText("鐘錶匠")).toBeVisible();
});
test("restart confirmation preserves edits on cancel and resets on accept", async ({page}) => {
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

  await page.locator('[data-edit="background:belief"]').click();
  await page.locator("#editor").fill("手動編輯後應該保留。");
  await page.locator('[data-save="background:belief"]').click();

  page.once("dialog",async dialog=>{
    expect(dialog.message()).toContain("重新產生會清除問卷答案與手動編輯");
    await dialog.dismiss();
  });
  await page.locator("#restart").click();
  await expect(page.getByRole("heading",{name:"背景預覽"})).toBeVisible();
  await expect(page.getByText("手動編輯後應該保留。")).toBeVisible();

  page.once("dialog",async dialog=>{ await dialog.accept(); });
  await page.locator("#restart").click();
  await expect(page.getByRole("heading",{name:"你的角色長什麼樣子？"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"背景預覽"})).toHaveCount(0);
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
  await beliefField.locator('[data-edit="background:belief"]').click();
  await page.locator("#editor").fill("");
  await beliefField.locator('[data-save="background:belief"]').click();
  await expect(beliefField).toBeVisible();
  await expect(beliefField.getByText("尚未填寫")).toBeVisible();

  await page.locator("#copyAll").click();
  const fullText=await page.evaluate(()=>navigator.clipboard.readText());
  expect(fullText).not.toContain("信念：");
  expect(fullText).toContain("外貌描述：");

  await beliefField.getByRole("button",{name:"複製欄位"}).click();
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe("");
});
