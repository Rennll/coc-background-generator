# CoC 7e 調查員背景產生器

Vanilla JavaScript、HTML、CSS 的純靜態網站。沒有後端、帳號、AI、自動儲存或資料庫。

## 開啟方式

由於瀏覽器通常會限制 `file://` 頁面載入 JSON，請使用本機 HTTP 靜態伺服器。

```bash
python -m http.server 8000
```

接著在瀏覽器開啟 `http://localhost:8000`。

## 測試

除了核心測試與 Playwright Chromium 端對端測試，CI 也會執行響應式介面檢查：320、390、768、1440 CSS px 四種視窗寬度，分別檢查問卷與預覽頁沒有水平溢位、13 個欄位仍存在且主要操作可見。CI 會上傳問卷與預覽的桌面／手機完整頁面截圖，作為人工視覺審查素材（保留 14 天）。使用者已檢視手機／桌面截圖並確認目前排版沒有問題。自動檢查不等於在實體手機上完成觸控驗收，因此實際裝置差異仍未宣稱已驗證。

需要 Node.js 20 或更新版本。核心邏輯使用 Node.js 內建測試；瀏覽器端到端測試使用 Playwright 與 Chromium。

```bash
npm install
npm test
npx playwright install --with-deps chromium
npm run test:e2e
```

## 專案結構

```text
/
├── index.html
├── style.css
├── main.js
├── package.json
├── data/
│   ├── questions.json
│   ├── templates.json
│   └── occupations.json
├── lib/
│   ├── questionnaire.js
│   ├── character.js
│   └── export.js
├── services/
│   └── browser.js
├── playwright.config.js
└── tests/
    ├── core.test.js
    ├── e2e.spec.js
    └── visual.spec.js
```

## 已實作

- 依資料檔顯示問卷，使用穩定題目／選項 ID。
- Q3a→Q3b、Q4→Q5、Q6→Q7、Q10→Q11 四組條件分支。
- 修改前置答案時清除不再有效的後續答案；上一題保留有效答案。
- Q10 自訂職業輸入及 Q11 通用分支。
- 產生八個背景欄位及五個基本資料欄位。
- 預覽欄位可點擊文字或編輯按鈕進入編輯；空白欄位仍顯示。
- 複製完整背景、複製單一欄位、匯出 JSON。
- 重新產生前確認；沒有列印及自動儲存。
- 職業預覽選單可選預設職業、自訂職業或不設定職業，並顯示來源核實狀態。

## 資料狀態與限制

- `questions.json` 已依 Notion 規格校正 Q7、Q8、Q9、Q10、Q11 的選項與分支；Q10 自訂職業使用 `other_custom` 通用分支。正式題目編號有 11 個數字題號，但因 Q3a/Q3b 拆成兩個步驟，流程共有 12 個題目 ID／步驟。
- `templates.json` 已調整重要之人、珍貴之物與恐懼／擔憂欄位的分句標點，並新增句末標點設定；`character.js` 會套用可選的結尾標點。新增測試會逐一遍歷四組條件分支的選項，檢查八個欄位都有句末標點且沒有常見重複標點。程式測試仍無法取代真人閱讀，語意重複與敘事自然度仍需抽樣審閱。
- `occupations.json` 已改為依使用者從 Investigator Handbook 貼上的清單建立 91 筆主要職業與 21 筆交叉參照。繁中顯示名稱採專案工作譯名，並依台灣用語調整；例如 Accountant 使用較中性的「會計人員」、Deprogrammer 使用能表達解除洗腦概念的「反洗腦專家」、Union Activist 使用「工會活動人士」，並以核心測試保護這些翻譯的語意。使用者已確認此清單已逐字與實體 Investigator Handbook 核對；此核對依據為使用者確認，非我獨立查閱實體書。 職業編輯器中的來源提示也已同步更新，並以 Chromium E2E 測試確認介面不再顯示過時的「尚未核對」聲明。保留 [Classic]、[Lovecraftian]、[Modern] 標籤；標籤不自動等於 1920 年代適用性。`Aviator` 與 `Gun Moll` 別名的 `[Classic]` 標籤已恢復並有回歸測試；另修正 `Aviator [Classic] – see Pilot` 的標籤不得錯誤轉移到 `Pilot`，並新增測試確保 Pilot 仍標示為年代尚未逐項核實。每筆 `see` 交叉參照也會顯示在對應主要職業的選單標籤中（例如 Driver 顯示 Chauffeur、Taxi Driver），並有核心資料測試與瀏覽器選單斷言。繁中名稱是專案工作譯名，並非已核實的官方繁中譯名。
- JSON 匯出是本專案自訂格式，不是 Chaosium 官方 JSON 標準。
- `tests/core.test.js` 覆蓋資料合約、四組條件分支的失效子題清除與有效子題保留、模板、空白欄位、手動編輯與 JSON 匯出欄位白名單（含禁止匯出的問卷答案、屬性與技能）。`tests/e2e.spec.js` 以 Playwright/Chromium 測試標準問卷、自訂職業、13 個預覽欄位固定顯示且都有編輯按鈕、五個基本資料欄位的實際編輯流程（含年齡填入／清空與 JSON `null`），以及負數、非整數、非數字年齡的拒絕驗證、預覽編輯、JSON 下載內容、在真實 Chromium 中逐一修改 Q3a、Q4、Q6、Q10 前置答案並清除舊分支、職業來源標籤、有意義地點文案、重新產生確認（取消保留編輯、接受後重設），以及空白欄位與剪貼簿行為。提交 `f57585e` 的核心測試與 Chromium E2E 全部通過：[workflow run](https://github.com/Rennll/coc-background-generator/actions/runs/40621268851)。後續新增每筆職業交叉參照都必須顯示於主要職業選單的核心回歸測試，以及實際瀏覽器選單斷言；並加入所有 91 筆主要職業均須出現在瀏覽器選單、14 筆來源標籤一致及每筆職業都有明確年代狀態的測試。之後修正 `Pilot` 不應繼承 `Aviator` 的 `[Classic]` 年代狀態。提交 `cd14d77` 的核心測試 16/16 與 Chromium E2E 6/6 通過：[GitHub Actions](https://github.com/Rennll/coc-background-generator/actions/runs/40623088535)。後續翻譯微調提交 `b7a200f` 的核心測試 16/16 與 Chromium E2E 6/6 亦通過：[GitHub Actions](https://github.com/Rennll/coc-background-generator/actions/runs/40623387140)。 最新來源提示修正提交 `8984a88` 的核心測試與 Chromium E2E 均通過：[GitHub Actions](https://github.com/Rennll/coc-background-generator/actions/runs/40623946392)。JSON 匯出也新增核心與瀏覽器斷言，確保只包含 `version`、`meta`、五個 `profile` 欄位及八個 `background` 欄位，不匯出問卷答案、屬性或技能。

規格文件：[Notion 規格書](https://app.notion.com/p/CoC-4066bb2da397814999b8f86d64fc24e4?pvs=204)


## 驗收紀錄（2026-10-28）

- JSON 年齡匯出與型別驗證加強提交 `b7a5252`：核心測試 16/16、Chromium E2E 10/10 通過。`exportJSON` 對空字串及純空白年齡輸出 `null`，合法數字字串轉成數字；初始資料、手動編輯與匯出均拒絕布林值、物件、負數及非整數，避免 `false` 被 JavaScript 轉成 0。CI 同時成功上傳視覺驗收截圖：[GitHub Actions](https://github.com/Rennll/coc-background-generator/actions/runs/40630038384)。



- 響應式視覺檢查提交 `80aa74a`：核心測試 16/16、Chromium E2E 8/8、響應式／鍵盤焦點視覺測試 2/2 通過。已在 320、390、768、1440 CSS px 檢查問卷與預覽頁無水平溢位，並由 CI 產生手機與桌面完整頁面截圖；截圖 Artifact 保留至 2026-11-11：[GitHub Actions 與截圖下載](https://github.com/Rennll/coc-background-generator/actions/runs/40628388355)。這是自動化視覺檢查，仍不等於真人實機驗收。


- 年齡空白值邊界測試提交 `af14998`：核心測試 16/16、Chromium E2E 8/8 通過。空字串與純空白字串都正規化為 `null`，不會被 JavaScript 的數字轉換誤判為 0；同時保留負數、非整數與非數字輸入拒絕驗證：[GitHub Actions](https://github.com/Rennll/coc-background-generator/actions/runs/40627619880)。


- Notion 最後一輪規格對照提交 `2178d66`：核心測試 16/16、Chromium E2E 8/8 通過。修正 Q7 四組與規格不一致的選項文案，點擊預覽文字即可編輯，並讓缺漏或多出的背景模板規則明確報錯：[GitHub Actions](https://github.com/Rennll/coc-background-generator/actions/runs/40627374805)。


- 預覽欄位無障礙標籤修正提交 `1f250f0`：核心測試 16/16、Chromium E2E 8/8 通過。13 個預覽欄位的編輯控制、輸入欄位、儲存與取消按鈕均有欄位專屬可存取名稱；測試逐欄開啟並取消編輯驗證：[GitHub Actions](https://github.com/Rennll/coc-background-generator/actions/runs/40626682645)。


- 最新條件分支回歸提交 `f6dd1ac`：核心測試 16/16、Chromium E2E 7/7 通過；新增 Q3a、Q4、Q6 修改前置答案後的真實瀏覽器測試，並確認 Q10→Q11 既有測試涵蓋失效答案清除及自訂職業通用分支：[GitHub Actions](https://github.com/Rennll/coc-background-generator/actions/runs/40625933935)。


- Repository 初始 HEAD：`190fd96043e04fda4186cadbacd34e443c02b550`（main）。
- 對照 Notion 規格後，已在 `audit/spec-alignment` 分支調整問卷選項、背景模板、核心測試與 Chromium E2E 測試。
- 職業資料以使用者從 Investigator Handbook 貼上且已自行逐字核對實體手冊的英文清單為基準，將 91 筆主要職業與 21 筆 see-alias 交叉參照分開保存，避免別名造成重複選項。英文原名保留於 `englishCandidate`；繁中顯示名稱採專案工作譯名，未宣稱為官方中文版。
- 使用者已確認提供的 Investigator Handbook 職業清單已逐字與實體手冊核對。Chaosium 官方規則 Wiki 可獨立佐證 Antiquarian、Author、Dilettante、Doctor of Medicine、Journalist、Police Detective、Private Investigator、Professor 為官方範例職業，但這項外部佐證不涵蓋繁中譯名；手冊清單的逐字核對由使用者確認完成。來源：[Chaosium 官方規則 Wiki](https://cthulhuwiki.chaosium.com/investigators/step-three-occupation-and-skills.html)、[Investigator Handbook 官方商品頁](https://www.chaosium.com/call-of-cthulhu-investigator-handbook-hardcover/)。
- 已通過的基準包含核心測試、模板句末標點／分支組合測試、職業資料結構、Q8–Q11 標題對齊、官方職業範例佐證與 Chromium E2E。後續將「有意義的地點」改為完整句子，並新增核心測試及瀏覽器預覽斷言；另新增重新產生確認的取消／接受兩條路徑測試。提交 `322fdd6` 的核心測試 16/16 與 Chromium E2E 6/6 已通過；其中包含重新產生確認取消／接受路徑：[workflow run](https://github.com/Rennll/coc-background-generator/actions/runs/40621000286)。後續發現 `Aviator`、`Gun Moll` 別名遺漏 `[Classic]` 標籤，已補回資料並加入回歸測試。另將全部 21 筆交叉參照名稱同步到各自的主要職業資料，避免選單只顯示部分 `see` 參照；核心測試與 Chromium E2E 新增了相應檢查，最新 CI 執行中。
