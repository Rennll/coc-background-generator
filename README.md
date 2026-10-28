# CoC 7e 調查員背景產生器

Vanilla JavaScript、HTML、CSS 的純靜態網站。沒有後端、帳號、AI、自動儲存或資料庫。

## 開啟方式

由於瀏覽器通常會限制 `file://` 頁面載入 JSON，請使用本機 HTTP 靜態伺服器。

```bash
python -m http.server 8000
```

接著在瀏覽器開啟 `http://localhost:8000`。

## 測試

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
    └── e2e.spec.js
```

## 已實作

- 依資料檔顯示問卷，使用穩定題目／選項 ID。
- Q3a→Q3b、Q4→Q5、Q6→Q7、Q10→Q11 四組條件分支。
- 修改前置答案時清除不再有效的後續答案；上一題保留有效答案。
- Q10 自訂職業輸入及 Q11 通用分支。
- 產生八個背景欄位及五個基本資料欄位。
- 預覽欄位可編輯；空白欄位仍顯示。
- 複製完整背景、複製單一欄位、匯出 JSON。
- 重新產生前確認；沒有列印及自動儲存。
- 職業預覽選單可選預設職業、自訂職業或不設定職業，並顯示來源核實狀態。

## 資料狀態與限制

- `questions.json` 已依 Notion 規格校正 Q7、Q8、Q9、Q10、Q11 的選項與分支；Q10 自訂職業使用 `other_custom` 通用分支。正式題目編號有 11 個數字題號，但因 Q3a/Q3b 拆成兩個步驟，流程共有 12 個題目 ID／步驟。
- `templates.json` 已調整重要之人、珍貴之物與恐懼／擔憂欄位的分句標點，並新增句末標點設定；`character.js` 會套用可選的結尾標點。新增測試會逐一遍歷四組條件分支的選項，檢查八個欄位都有句末標點且沒有常見重複標點。程式測試仍無法取代真人閱讀，語意重複與敘事自然度仍需抽樣審閱。
- `occupations.json` 是 22 筆初步資料，不是官方完整職業清單。每筆資料另列英文職稱、來源狀態、手冊標籤、1920 年代適用性及繁中譯名核實狀態。英文候選職稱是供比對的工作欄位，不代表已確認為手冊正式條目；繁中譯名均未宣稱為官方譯名。部分項目僅有官方商品頁範例、類別佐證或尚待核對；補充項目會明確標示，不可宣稱為官方已核實條目。
- JSON 匯出是本專案自訂格式，不是 Chaosium 官方 JSON 標準。
- `tests/core.test.js` 覆蓋資料合約、條件分支、答案清除、模板、空白欄位、手動編輯與 JSON 匯出。`tests/e2e.spec.js` 以 Playwright/Chromium 測試標準問卷、自訂職業、預覽編輯、JSON 下載內容、修改前置答案後清除舊分支、重新產生確認，以及空白欄位與剪貼簿行為。GitHub Actions 最近一次已通過核心測試及 4 項 Chromium E2E 測試；之後新增了背景欄位句末標點與所有條件分支組合的核心測試，職業來源標記也再做校正。最新程式提交的 CI 正在重新執行，通過後再更新此驗收紀錄。已通過的瀏覽器測試紀錄：[workflow run](https://github.com/Rennll/coc-background-generator/actions/runs/40615678504)。

規格文件：[Notion 規格書](https://app.notion.com/p/CoC-4066bb2da397814999b8f86d64fc24e4?pvs=204)


## 驗收紀錄（2026-10-28）

- Repository 初始 HEAD：`190fd96043e04fda4186cadbacd34e443c02b550`（main）。
- 對照 Notion 規格後，已在 `audit/spec-alignment` 分支調整問卷選項、背景模板、核心測試與 Chromium E2E 測試。
- 職業資料維持 22 筆初步清單；官方商品頁僅能佐證部分範例，不代表逐項核實或官方完整清單。
- 官方規則 Wiki 已補入職業資料來源。來源頁面可佐證部分英文職業範例，但無法核實完整 1920 年代清單或官方繁中譯名。
- 已完成驗證的基準：核心測試通過，Chromium E2E 4/4 通過，涵蓋標準問卷與 JSON 內容、自訂職業、修改 Q10 後清除舊 Q11 答案、空白欄位與剪貼簿行為。之後新增的模板句末標點／分支組合測試與職業來源修訂仍待最新 CI 完成。先前通過紀錄：[GitHub Actions](https://github.com/Rennll/coc-background-generator/actions/runs/40615678504)。
