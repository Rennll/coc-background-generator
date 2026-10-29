import { test, expect } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";

async function generateCandidateByCulture(page, targetCulture) {
  const selector = page.locator("[data-name-culture]");
  const current = await selector.inputValue();
  const target = targetCulture;
  expect(["taiwanHan", "japanese", "american"]).toContain(target);
  expect(target).not.toBe(current);
  await selector.selectOption(target);
  await expect(page.locator(".name-candidate")).toContainText(target === "japanese" ? "日本" : target === "american" ? "美國" : "台灣漢人");
}

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
  // This route uses a custom/unresolved occupation, so the English field is intentionally blank.
  // Known occupation bilingual export is covered by the dedicated test below.
  expect(exported.profile.occupation_en).toBe("");
  expect(exported.profile.name).toBe("林明遠");
  expect(exported.profile.birthplace).toBe("臺南市");
  expect(exported.profile.residence).toBe("臺北市");
  expect(exported.profile.age).toBeNull();
  expect(Object.keys(exported).sort()).toEqual(["background","meta","profile","version"]);
  expect(Object.keys(exported.profile).sort()).toEqual(["age","birthplace","name","occupation","occupation_en","residence"]);
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

test("clipboard fallback works without inline styles when Clipboard API is unavailable", async ({page}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    document.execCommand = (command) => {
      if (command !== "copy") return false;
      window.__copiedText = document.querySelector(".clipboard-fallback")?.value ?? "";
      window.__fallbackHadInlineStyle = document.querySelector(".clipboard-fallback")?.hasAttribute("style") ?? false;
      return true;
    };
  });
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
  await page.locator('[data-copy="background:belief"]').click();
  await expect.poll(() => page.evaluate(() => window.__copiedText)).not.toBe("");
  expect(await page.evaluate(() => window.__fallbackHadInlineStyle)).toBe(false);
  await expect(page.locator(".clipboard-fallback")).toHaveCount(0);
});
 
test("Content Security Policy is present and allows the app to run without inline scripts", async ({page}) => {
  await page.goto("/");
  const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  expect(policy).toContain("default-src 'self'");
  expect(policy).toContain("script-src 'self'");
  expect(policy).toContain("style-src 'self'");
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content","no-referrer");
  expect(policy.match(/style-src[^;]*/)?.[0]).not.toContain("'unsafe-inline'");
  expect(policy).toContain("object-src 'none'");
  expect(policy).toContain("base-uri 'none'");
  expect(policy.match(/script-src[^;]*/)?.[0]).not.toContain("'unsafe-inline'");
  await expect(page.getByRole("heading", {name:"你的角色長什麼樣子？"})).toBeVisible();
});

test("user-edited preview text is rendered as text rather than interpreted as HTML", async ({page}) => {
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

  const payload = '<img src=x onerror="alert(1)"> & "quoted"';
  await page.locator('[data-edit="background:belief"]').click();
  await page.locator("#editor").fill(payload);
  await page.locator('[data-save="background:belief"]').click();

  const belief = page.locator(".field").filter({has:page.getByRole("heading",{name:"信念",exact:true})});
  await expect(belief.locator(".value-button")).toHaveText(payload);
  await expect(page.locator("img")).toHaveCount(0);
  await expect(belief.locator("script")).toHaveCount(0);

  const occupation = page.locator(".field").filter({has:page.getByRole("heading",{name:"職業",exact:true})});
  await occupation.locator('[data-edit="profile:occupation"]').click();
  await page.locator("#occupation-select").selectOption("other_custom");
  await page.locator("#occupation-custom").fill(payload);
  await occupation.locator('[data-save="profile:occupation"]').click();
  await expect(occupation.locator(".value-button")).toHaveText(payload);
  await expect(page.locator("img")).toHaveCount(0);
});

test("editing one background field leaves other generated fields unchanged in preview and export", async ({page}) => {
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

  const appearance = page.locator(".field").filter({has:page.getByRole("heading",{name:"外貌描述",exact:true})});
  const appearanceEditor = page.locator('[data-edit="background:appearance"]');
  const hook = page.locator(".field").filter({has:page.getByRole("heading",{name:"與調查的連結",exact:true})});
  const hookEditor = page.locator('[data-edit="background:investigation_hook"]');
  await appearanceEditor.click();
  const originalAppearance = await page.locator("#editor").inputValue();
  await page.locator('[data-cancel="background:appearance"]').click();
  await hookEditor.click();
  const originalHook = await page.locator("#editor").inputValue();
  await page.locator('[data-cancel="background:investigation_hook"]').click();

  await page.locator('[data-edit="background:belief"]').click();
  await page.locator("#editor").fill("我只相信能夠查證的事實。");
  await page.locator('[data-save="background:belief"]').click();

  await expect(appearance).toContainText(originalAppearance);
  await expect(hook).toContainText(originalHook);
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export").click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let text = "";
  for await (const chunk of stream) text += chunk.toString("utf8");
  const exported = JSON.parse(text);
  expect(exported.background.belief).toBe("我只相信能夠查證的事實。");
  expect(exported.background.appearance).toBe(originalAppearance);
  expect(exported.background.investigation_hook).toBe(originalHook);
});

test("all 13 preview editors expose field-specific accessible names", async ({page}) => {
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

  await page.locator('[data-edit-value="background:belief"]').click();
  await expect(page.locator("#editor")).toHaveAttribute("aria-label","信念");
  await page.locator('[data-cancel="background:belief"]').click();

  const fields=[
    ["profile:name","姓名"],["profile:occupation","職業"],["profile:age","年齡"],
    ["profile:birthplace","出生地"],["profile:residence","居住地"],
    ["background:appearance","外貌描述"],["background:belief","信念"],
    ["background:significant_person","重要之人"],["background:treasured_possession","珍貴之物"],
    ["background:fear_or_concern","恐懼與擔憂"],["background:personality","個性"],
    ["background:meaningful_location","有意義的地點"],["background:investigation_hook","與調查的連結"]
  ];
  for (const [key,label] of fields) {
    await page.locator(`[data-edit="${key}"]`).click();
    if (key==="profile:occupation") {
      await expect(page.getByLabel("選擇職業")).toBeVisible();
    } else {
      await expect(page.locator("#editor")).toHaveAttribute("aria-label",label);
    }
    await expect(page.locator(`[data-save="${key}"]`)).toHaveAttribute("aria-label",`儲存：${label}`);
    await expect(page.locator(`[data-cancel="${key}"]`)).toHaveAttribute("aria-label",`取消編輯：${label}`);
    await page.locator(`[data-cancel="${key}"]`).click();
  }
});

test("preview occupation can be cleared and exported as an empty string", async ({page}) => {
  await page.goto("/");
  for (const optionId of [
    "neat_reliable","truth_above_comfort","family_member","family_secret",
    "mysterious_object","mystery_wrongness","deceived_again","deceived_misunderstood",
    "quiet_listener","hometown","other_custom","custom_work_unusual_detail"
  ]) {
    if (optionId === "other_custom") await answer(page,optionId,{customOccupation:"鐘錶匠"});
    else await answer(page,optionId);
  }
  await expect(page.getByRole("heading",{name:"背景預覽"})).toBeVisible();
  const occupationField=page.locator(".field").filter({has:page.getByRole("heading",{name:"職業",exact:true})});
  await occupationField.locator('[data-edit="profile:occupation"]').click();
  await page.locator("#occupation-select").selectOption("other_custom");
  await page.locator("#occupation-custom").fill("");
  await occupationField.locator('[data-save="profile:occupation"]').click();
  await expect(occupationField.getByText("尚未填寫")).toBeVisible();

  const downloadPromise=page.waitForEvent("download");
  await page.locator("#export").click();
  const download=await downloadPromise;
  const stream=await download.createReadStream();
  let exportedText="";
  for await (const chunk of stream) exportedText+=chunk.toString("utf8");
  const exported=JSON.parse(exportedText);
  expect(exported.profile.occupation).toBe("");
  expect(exported.profile.occupation_en).toBe("");
  expect(exported).not.toHaveProperty("customOccupation");
  expect(exported).not.toHaveProperty("answers");
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

  await page.locator("#prev").click();
  await page.locator('input[name="answer"][value="other_custom"]').check();
  await expect(page.locator("#customOccupation")).toHaveValue("");
  await expect(page.locator('input[name="answer"][value="knowledge_research"]')).not.toBeChecked();
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

test("occupation selector keeps English names and custom entry without verbose metadata", async ({page}) => {
  await page.goto("/");
  for (const optionId of [
    "neat_reliable","truth_above_comfort","family_member","family_secret",
    "mysterious_object","mystery_wrongness","deceived_again","deceived_misunderstood",
    "quiet_listener","hometown","knowledge_research","research_contradiction"
  ]) await answer(page,optionId);
  const occupationField=page.locator(".field").filter({has:page.getByRole("heading",{name:"職業",exact:true})});
  await occupationField.locator('[data-edit="profile:occupation"]').click();
  const selector=page.locator("#occupation-select");
  const occupationData=JSON.parse(await readFile(new URL("../data/occupations.json",import.meta.url),"utf8"));
  await expect(selector.locator("option")).toHaveCount(occupationData.occupations.length+2);
  for(const occupation of occupationData.occupations){
    await expect(selector.locator(`option[value="${occupation.id}"]`),occupation.englishCandidate).toHaveCount(1);
  }
  await expect(selector.locator("option")).toHaveCount(93);
  await expect(selector.locator('option[value="acrobat"]')).toContainText("雜技演員（Acrobat）");
  await expect(selector.locator('option[value="computer_programmer_technician_hacker"]')).toContainText("Computer Programmer/Technician/Hacker");
  await expect(selector.locator('option[value="antiquarian"]')).toContainText("Antiquarian");
  await expect(selector.locator('option[value="computer_programmer_technician_hacker"]')).not.toContainText("Modern");
  await expect(selector.locator('option[value="antiquarian"]')).not.toContainText("Lovecraftian");
  await expect(selector.locator('option[value="antiquarian"]')).not.toContainText("官方規則 Wiki");
  await expect(selector.locator('option[value="accountant"]')).not.toContainText("1920年代");
  await expect(page.getByText("依分類選擇職業，或自行填寫清單以外的職業。括號內為英文原名。")).toBeVisible();
  for(const id of ["criminal","physician","pilot","butler_valet_maid","computer_programmer_technician_hacker","driver","journalist","laborer","photographer"]){
    const option=occupationData.occupations.find(o=>o.id===id);
    expect(option,"canonical occupation " + id).toBeTruthy();
    if(option.crossReferences?.length) expect(option.crossReferences.length).toBeGreaterThan(0);
  }
  await selector.selectOption("other_custom");
  await page.locator("#occupation-custom").fill("鐘錶匠");
  await occupationField.locator('[data-save="profile:occupation"]').click();
  await expect(occupationField.getByText("鐘錶匠")).toBeVisible();
});
test("known occupation is bilingual in copied text and JSON export", async ({page}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async text=>{window.__copiedText=String(text);}}});
  });
  await page.goto("/");
  for (const optionId of [
    "neat_reliable","truth_above_comfort","family_member","family_secret",
    "mysterious_object","mystery_wrongness","deceived_again","deceived_misunderstood",
    "quiet_listener","hometown","knowledge_research","research_contradiction"
  ]) await answer(page,optionId);
  const occupationField=page.locator(".field").filter({has:page.getByRole("heading",{name:"職業",exact:true})});
  await occupationField.locator('[data-edit="profile:occupation"]').click();
  await page.locator("#occupation-select").selectOption("journalist");
  await occupationField.locator('[data-save="profile:occupation"]').click();
  await expect(occupationField.locator(".value-button")).toHaveText("新聞記者");

  await occupationField.locator('[data-copy="profile:occupation"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__copiedText)).toBe("新聞記者（Journalist）");

  await page.locator("#copyAll").click();
  await expect.poll(()=>page.evaluate(()=>window.__copiedText)).toContain("職業：新聞記者（Journalist）");

  const downloadPromise=page.waitForEvent("download");
  await page.locator("#export").click();
  const download=await downloadPromise;
  const stream=await download.createReadStream();
  let exportedText="";
  for await (const chunk of stream) exportedText+=chunk.toString("utf8");
  const exported=JSON.parse(exportedText);
  expect(exported.version).toBe(2);
  expect(exported.profile.occupation).toBe("新聞記者");
  expect(exported.profile.occupation_en).toBe("Journalist");
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
test("questionnaire and preview remain free of horizontal overflow at mobile, tablet, and desktop widths", async ({page}) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({width, height: 900});
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("coc-background-generator.progress.v1"));
    await page.reload();
    await expect(page.getByRole("heading", {name:"你的角色長什麼樣子？"})).toBeVisible();
    const questionnaireOverflow = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth
    }));
    expect(questionnaireOverflow.document, `questionnaire document overflow at ${width}px: ${JSON.stringify(questionnaireOverflow)}`).toBeLessThanOrEqual(width);
    expect(questionnaireOverflow.body, `questionnaire body overflow at ${width}px: ${JSON.stringify(questionnaireOverflow)}`).toBeLessThanOrEqual(width);

    for (const optionId of [
      "neat_reliable", "truth_above_comfort", "family_member", "family_secret",
      "mysterious_object", "mystery_wrongness", "deceived_again",
      "deceived_misunderstood", "quiet_listener", "hometown",
      "knowledge_research", "research_contradiction"
    ]) {
      await answer(page, optionId);
    }
    await expect(page.getByRole("heading", {name:"背景預覽"})).toBeVisible();
    const previewOverflow = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth
    }));
    expect(previewOverflow.document, `preview document overflow at ${width}px: ${JSON.stringify(previewOverflow)}`).toBeLessThanOrEqual(width);
    expect(previewOverflow.body, `preview body overflow at ${width}px: ${JSON.stringify(previewOverflow)}`).toBeLessThanOrEqual(width);
    for (const label of ["姓名","職業","年齡","出生地","居住地","外貌描述","信念","重要之人","珍貴之物","恐懼與擔憂","個性","有意義的地點","與調查的連結"]) {
      const field = page.locator(".field").filter({has:page.getByRole("heading",{name:label,exact:true})});
      await expect(field, `${label} remains visible at ${width}px`).toBeVisible();
    }
    await expect(page.locator("#copyAll"), `full-background copy control visible at ${width}px`).toBeVisible();
    await expect(page.locator("#export"), `JSON export control visible at ${width}px`).toBeVisible();
  }
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
  await expect(page.getByRole("status")).toContainText("已複製完整背景。");
  const fullText=await page.evaluate(()=>navigator.clipboard.readText());
  expect(fullText).not.toContain("信念：");
  expect(fullText).toContain("外貌描述：");

  await beliefField.locator('[data-copy="background:belief"]').click();
  await expect(page.getByRole("status")).toContainText("已複製欄位內容。");
  await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toBe("");
});


test("name generator candidate can be cancelled, rerolled, confirmed, and manually edited", async ({ page }) => {
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
  const nameField = page.locator(".field").filter({has:page.getByRole("heading",{name:"姓名",exact:true})});
  await expect(nameField.locator("[data-name-culture]")).toHaveCount(0);
  await nameField.locator('[data-edit="profile:name"]').click();
  await expect(nameField.locator("[data-name-culture]")).toHaveValue("taiwanHan");
  await expect(nameField.locator(".name-candidate")).toContainText("台灣漢人");
  await expect(nameField.locator("[data-name-candidate]")).toBeVisible();
  await nameField.locator("[data-name-culture]").selectOption("japanese");
  await expect(nameField.locator("[data-name-candidate]")).toBeVisible();
  await expect(nameField.getByText("候選姓名：")).toBeVisible();
  await expect(nameField.locator(".name-candidate")).toContainText("日本");
  await nameField.locator("[data-name-culture]").selectOption("taiwanHan");
  await expect(nameField.locator(".name-candidate")).toContainText("台灣漢人");
  await nameField.locator("[data-name-culture]").selectOption("japanese");
  await expect(nameField.locator(".name-candidate")).toContainText("日本");
  const firstCandidate = await nameField.locator("[data-name-candidate]").textContent();
  await nameField.getByRole("button",{name:"取消",exact:true}).click();
  await expect(page.locator("#editor")).toHaveValue("");
  await expect(nameField.locator("[data-name-candidate]")).toHaveCount(0);
  await expect(nameField.locator("[data-name-classification]")).toHaveCount(0);
  await generateCandidateByCulture(page, "taiwanHan");
  await nameField.getByRole("button",{name:"重新抽取"}).click();
  const candidate = (await nameField.locator("[data-name-candidate]").textContent())?.trim();
  expect(candidate).toBeTruthy();
  expect(candidate).not.toBe(firstCandidate);
  await nameField.getByRole("button",{name:"確認套用"}).click();
  await expect(nameField.locator("#editor")).toHaveCount(0);
  await expect(nameField.locator(".name-candidate")).toHaveCount(0);
  await expect(nameField.locator('[data-save="profile:name"]')).toHaveCount(0);
  await expect(nameField.locator(".value-button")).toHaveText(candidate);
  await expect(nameField.locator("[data-name-classification]")).toContainText(/男性常用名|女性常用名/);
  await expect(nameField.locator("[data-name-culture]")).toHaveCount(0);
  await nameField.locator('[data-edit="profile:name"]').click();
  await page.locator("#editor").fill("手動自訂姓名");
  await nameField.getByRole("button",{name:"儲存"}).click();
  await expect(nameField).toContainText("手動自訂姓名");
  await expect(nameField.locator("[data-name-classification]")).toHaveCount(0);
  await nameField.locator('[data-edit="profile:name"]').click();
  await generateCandidateByCulture(page, "japanese");
  await nameField.getByRole("button",{name:"確認套用"}).click();
  const regeneratedName = (await nameField.locator(".value-button").textContent())?.trim();
  expect(regeneratedName).toBeTruthy();
  await expect(nameField.locator("#editor")).toHaveCount(0);
  await expect(nameField.locator(".name-candidate")).toHaveCount(0);
  await expect(nameField.locator("[data-name-classification]")).toContainText(/男性常用名|女性常用名/);
  await expect(nameField.locator(".value-button")).toHaveText(regeneratedName);
  await expect(nameField.locator("[data-name-classification]")).toContainText(/男性常用名|女性常用名/);
  await nameField.locator('[data-edit="profile:name"]').click();
  await page.locator("#editor").fill("取消不應保存");
  await nameField.locator('[data-cancel="profile:name"]').click();
  await expect(nameField.locator(".value-button")).toHaveText(regeneratedName);
  await expect(nameField.locator("[data-name-classification]")).toContainText(/男性常用名|女性常用名/);
  await expect(page.getByRole("heading",{name:"性別",exact:true})).toHaveCount(0);
});


test("American name candidate supports cancel, reroll, confirm, and manual edit", async ({ page }) => {
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

  const nameField = page.locator(".field").filter({has:page.getByRole("heading",{name:"姓名",exact:true})});
  await nameField.locator('[data-edit="profile:name"]').click();
  await nameField.locator("[data-name-culture]").selectOption("american");
  await expect(nameField.locator(".name-candidate")).toContainText("美國");
  const cancelledCandidate = (await nameField.locator("[data-name-candidate]").textContent())?.trim();
  expect(cancelledCandidate).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);

  await nameField.locator("[data-name-cancel]").click();
  await expect(nameField.locator("[data-name-candidate]")).toHaveCount(0);
  await expect(nameField.locator("#editor")).toHaveValue("");

  await nameField.locator('[data-edit="profile:name"]').click();
  await expect(nameField.locator("[data-name-culture]")).toHaveValue("american");
  const beforeReroll = (await nameField.locator("[data-name-candidate]").textContent())?.trim();
  await nameField.locator("[data-name-reroll]").click();
  const rerolledCandidate = (await nameField.locator("[data-name-candidate]").textContent())?.trim();
  expect(rerolledCandidate).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
  // The generator tracks generatedNames and passes them as excludeNames, so a reroll must be a new full name unless the pool is exhausted.
  expect(rerolledCandidate).not.toBe(beforeReroll);

  await nameField.locator("[data-name-confirm]").click();
  await expect(nameField.locator(".name-candidate")).toHaveCount(0);
  await expect(nameField.locator(".value-button")).toHaveText(rerolledCandidate);
  await expect(nameField.locator("[data-name-classification]")).toContainText(/男性常用名|女性常用名/);

  await nameField.locator('[data-edit="profile:name"]').click();
  await page.locator("#editor").fill("手動編輯的美國姓名");
  await nameField.locator('[data-save="profile:name"]').click();
  await expect(nameField.locator(".value-button")).toHaveText("手動編輯的美國姓名");
  await expect(nameField.locator("[data-name-classification]")).toHaveCount(0);
});


test("capture real name-generator screenshots for CI artifacts", async ({ page }) => {
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

  const nameField = page.locator(".field").filter({has:page.getByRole("heading",{name:"姓名",exact:true})});
  await expect(nameField.locator("[data-name-culture]")).toHaveCount(0);
  await nameField.locator('[data-edit="profile:name"]').click();
  await mkdir("test-results", { recursive: true });
  for (const [culture, filename] of [
    ["japanese", "test-results/random-name-japan.png"],
    ["taiwanHan", "test-results/random-name-taiwan.png"],
    ["american", "test-results/random-name-american.png"]
  ]) {
    await page.locator("[data-name-culture]").selectOption(culture);
    await expect(page.locator(".name-candidate")).toContainText(culture === "japanese" ? "日本" : culture === "american" ? "美國" : "台灣漢人");
    await expect(page.getByRole("group",{name:"姓名候選"})).toBeVisible();
    await expect(page.locator("[data-name-candidate]")).toBeVisible();
    await page.screenshot({ path: filename, fullPage: true, animations: "disabled" });
    await page.locator("[data-name-cancel]").click();
  }
});

test("saved generated and manual names survive candidate cancellation and culture changes", async ({ page }) => {
  await page.goto("/");
  for (const optionId of [
    "neat_reliable","truth_above_comfort","family_member","family_secret",
    "mysterious_object","mystery_wrongness","deceived_again","deceived_misunderstood",
    "quiet_listener","hometown","knowledge_research","research_contradiction"
  ]) {
    await answer(page, optionId);
  }
  await expect(page.getByRole("heading",{name:"背景預覽"})).toBeVisible();

  const nameField = page.locator(".field").filter({has:page.getByRole("heading",{name:"姓名",exact:true})});
  await expect(nameField.locator("[data-name-culture]")).toHaveCount(0);
  await nameField.locator('[data-edit="profile:name"]').click();
  await generateCandidateByCulture(page, "japanese");
  const initialCandidate = (await nameField.locator("[data-name-candidate]").textContent())?.trim();
  expect(initialCandidate).toBeTruthy();
  await nameField.getByRole("button",{name:"確認套用"}).click();
  await expect(nameField.locator(".name-candidate")).toHaveCount(0);
  await expect(nameField.locator("#editor")).toHaveCount(0);
  await expect(nameField.locator('[data-save="profile:name"]')).toHaveCount(0);

  const savedGeneratedName = (await nameField.locator(".value-button").textContent())?.trim();
  const savedGeneratedClassification = (await nameField.locator("[data-name-classification]").textContent())?.trim();
  expect(savedGeneratedName).toBe(initialCandidate);
  expect(savedGeneratedClassification).toMatch(/男性常用名|女性常用名/);

  await nameField.locator('[data-edit="profile:name"]').click();
  await generateCandidateByCulture(page, "taiwanHan");
  await expect(nameField.locator("[data-name-candidate]")).toBeVisible();
  await nameField.getByRole("button",{name:"取消",exact:true}).click();
  await nameField.locator('[data-cancel="profile:name"]').click();
  await expect(nameField.locator(".value-button")).toHaveText(savedGeneratedName);
  await expect(nameField.locator("[data-name-classification]")).toHaveText(savedGeneratedClassification);

  await nameField.locator('[data-edit="profile:name"]').click();
  await generateCandidateByCulture(page, "japanese");
  await expect(nameField.locator("[data-name-candidate]")).toBeVisible();
  await nameField.locator("[data-name-culture]").selectOption("taiwanHan");
  await expect(nameField.locator(".name-candidate")).toContainText("台灣漢人");
  await expect(nameField.locator("#editor")).toHaveValue(savedGeneratedName);
  await expect(nameField.locator("[data-name-classification]")).toHaveText(savedGeneratedClassification);

  await nameField.locator('[data-cancel="profile:name"]').click();
  await nameField.locator('[data-edit="profile:name"]').click();
  await page.locator("#editor").fill("手動覆寫姓名");
  await nameField.getByRole("button",{name:"儲存"}).click();
  await expect(nameField.locator(".value-button")).toHaveText("手動覆寫姓名");
  await expect(nameField.locator("[data-name-classification]")).toHaveCount(0);

  await nameField.locator('[data-edit="profile:name"]').click();
  await generateCandidateByCulture(page, "japanese");
  await expect(nameField.locator("[data-name-candidate]")).toBeVisible();
  await nameField.getByRole("button",{name:"取消",exact:true}).click();
  await nameField.locator('[data-cancel="profile:name"]').click();
  await expect(nameField.locator(".value-button")).toHaveText("手動覆寫姓名");
  await expect(nameField.locator("[data-name-classification]")).toHaveCount(0);

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export").click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let exportedText = "";
  for await (const chunk of stream) exportedText += chunk.toString("utf8");
  const exported = JSON.parse(exportedText);
  expect(exported.profile.name).toBe("手動覆寫姓名");
});

test("name candidate omits removed helper text and remains usable on a narrow viewport", async ({page}) => {
  await page.setViewportSize({width:375,height:812});
  await page.goto("/");
  for (const optionId of [
    "neat_reliable","truth_above_comfort","family_member","family_secret",
    "mysterious_object","mystery_wrongness","deceived_again","deceived_misunderstood",
    "quiet_listener","hometown","knowledge_research","research_contradiction"
  ]) {
    await answer(page,optionId);
  }
  await expect(page.getByRole("heading",{name:"背景預覽"})).toBeVisible();
  await page.locator('[data-edit="profile:name"]').click();

  await expect(page.locator(".name-candidate")).toBeVisible();
  await expect(page.locator("[data-name-candidate]")).toBeVisible();
  await expect(page.locator(".name-tools")).not.toContainText("不需選擇性別");
  await expect(page.locator(".name-tools")).not.toContainText("系統會一起抽選男性或女性常用名");
  await expect(page.locator("[data-name-culture]")).toBeVisible();
  await expect(page.locator("[data-name-cancel]")).toBeVisible();
  await expect(page.locator("[data-name-reroll]")).toBeVisible();
  await expect(page.locator("[data-name-confirm]")).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});


test("background preview keeps reading hierarchy and responsive layout on desktop and mobile", async ({page}) => {
  await page.setViewportSize({width:1280,height:900});
  await page.goto("/");
  for (const optionId of [
    "neat_reliable","truth_above_comfort","family_member","family_secret",
    "mysterious_object","mystery_wrongness","deceived_again","deceived_misunderstood",
    "quiet_listener","hometown","knowledge_research","research_contradiction"
  ]) {
    await answer(page,optionId);
  }

  const grid = page.locator(".grid");
  const nameField = page.locator(".field").filter({has:page.getByRole("heading",{name:"姓名",exact:true})});
  const backgroundField = page.locator(".field.full").first();
  await expect(page.getByRole("heading",{name:"背景預覽"})).toBeVisible();
  await expect(nameField).toBeVisible();
  await expect(backgroundField).toBeVisible();

  const desktop = await page.evaluate(() => {
    const grid = document.querySelector(".grid");
    const backgroundField = document.querySelector(".field.full");
    const primary = document.querySelector(".btn-primary");
    const regular = document.querySelector(".btn");
    return {
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
      columns: getComputedStyle(grid).gridTemplateColumns,
      backgroundColumnEnd: getComputedStyle(backgroundField).gridColumnEnd,
      buttonRadius: getComputedStyle(regular).borderRadius,
      primaryRadius: getComputedStyle(primary).borderRadius,
      buttonPadding: getComputedStyle(regular).padding,
      primaryPadding: getComputedStyle(primary).padding
    };
  });
  expect(desktop.content).toBeLessThanOrEqual(desktop.viewport);
  expect(desktop.backgroundColumnEnd).toBe("-1");
  expect(desktop.buttonRadius).toBe(desktop.primaryRadius);
  expect(desktop.buttonPadding).toBe(desktop.primaryPadding);

  await nameField.locator('[data-edit="profile:name"]').click();
  const candidate = nameField.locator(".name-candidate");
  await expect(candidate).toBeVisible();
  const candidateBorder = await candidate.evaluate(el => getComputedStyle(el).borderTopStyle);
  const fieldBorder = await nameField.evaluate(el => getComputedStyle(el).borderTopStyle);
  expect(candidateBorder).toBe("dashed");
  expect(fieldBorder).toBe("solid");

  await page.setViewportSize({width:375,height:812});
  const mobile = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
    columns: getComputedStyle(document.querySelector(".grid")).gridTemplateColumns,
    backgroundColumnEnd: getComputedStyle(document.querySelector(".field.full")).gridColumnEnd
  }));
  expect(mobile.content).toBeLessThanOrEqual(mobile.viewport);
  expect(mobile.columns).not.toBe(desktop.columns);
  expect(mobile.backgroundColumnEnd).toBe("auto");
  await expect(nameField.locator("[data-name-culture]")).toBeVisible();
  await expect(nameField.locator("[data-name-cancel]")).toBeVisible();
  await expect(nameField.locator("[data-name-reroll]")).toBeVisible();
  await expect(nameField.locator("[data-name-confirm]")).toBeVisible();
});


test("questionnaire progress is restored after a page reload", async ({page}) => {
  await page.goto("/");
  await expect(page.getByRole("heading",{name:"你的角色長什麼樣子？"})).toBeVisible();
  await page.locator('input[name="answer"][value="neat_reliable"]').check();
  await page.locator("#next").click();
  await expect(page.getByRole("heading",{name:"他／她相信什麼？"})).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading",{name:"他／她相信什麼？"})).toBeVisible();
  await page.locator("#prev").click();
  await expect(page.locator('input[name="answer"][value="neat_reliable"]')).toBeChecked();
  await page.locator("#next").click();
  await expect(page.getByRole("heading",{name:"他／她相信什麼？"})).toBeVisible();
});

test("completed character and manual edits survive reload, and restart clears saved progress", async ({page}) => {
  await page.goto("/");
  for (const optionId of [
    "neat_reliable","truth_above_comfort","family_member","family_secret",
    "mysterious_object","mystery_wrongness","deceived_again","deceived_misunderstood",
    "quiet_listener","hometown","knowledge_research","research_contradiction"
  ]) await answer(page,optionId);
  await expect(page.getByRole("heading",{name:"背景預覽"})).toBeVisible();
  const nameField=page.locator(".field").filter({has:page.getByRole("heading",{name:"姓名",exact:true})});
  await nameField.locator('[data-edit="profile:name"]').click();
  await page.locator("#editor").fill("林測試保存");
  await nameField.getByRole("button",{name:"儲存"}).click();
  await page.reload();
  await expect(page.getByRole("heading",{name:"背景預覽"})).toBeVisible();
  await expect(nameField.locator(".value-button")).toHaveText("林測試保存");
  await page.once("dialog",dialog=>dialog.accept());
  await page.locator("#restart").click();
  await expect(page.getByRole("heading",{name:"你的角色長什麼樣子？"})).toBeVisible();
  const saved=await page.evaluate(()=>localStorage.getItem("coc-background-generator.progress.v1"));
  expect(saved).toBeNull();
});

test("optional JSON datasets are not fetched before their features are needed", async ({page}) => {
  const dataRequests=[];
  page.on("request",request=>{
    const url=new URL(request.url());
    if(url.pathname.endsWith(".json")) dataRequests.push(url.pathname);
  });
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("coc-background-generator.progress.v1"));
  await page.reload();
  await expect(page.getByRole("heading",{name:"你的角色長什麼樣子？"})).toBeVisible();
  expect(dataRequests).toContain("/data/questions.json");
  expect(dataRequests).not.toContain("/data/templates.json");
  expect(dataRequests).not.toContain("/data/occupations.json");
  expect(dataRequests).not.toContain("/data/names.json");
});
