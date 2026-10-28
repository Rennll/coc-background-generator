# CoC 7e 調查員背景產生器

Vanilla JavaScript、HTML、CSS 的純靜態網站。沒有後端、帳號、AI、自動儲存或資料庫。

## 開啟方式

由於瀏覽器通常會限制 `file://` 頁面載入 JSON，請使用本機 HTTP 靜態伺服器。

```bash
python -m http.server 8000
```

接著在瀏覽器開啟 `http://localhost:8000`。

## 測試

需要 Node.js 18 或更新版本。專案沒有第三方 npm 相依套件。

```bash
npm test
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
└── tests/
    └── core.test.js
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
- `templates.json` 已調整重要之人、珍貴之物的分句標點，並清理恐懼與擔憂的重複句末標點；仍需進行真人閱讀與完整組合抽樣。
- `occupations.json` 是 22 筆初步資料，不是官方完整職業清單。部分項目僅有官方商品頁範例、類別佐證或尚待核對；補充項目會明確標示，不可宣稱為官方已核實條目。
- JSON 匯出是本專案自訂格式，不是 Chaosium 官方 JSON 標準。
- `tests/core.test.js` 覆蓋資料合約、條件分支、答案清除、模板、空白欄位、手動編輯與 JSON 匯出。新增 `tests/e2e.spec.js` 與 GitHub Actions Chromium 測試工作流程；需以 CI 實際執行結果作為瀏覽器驗收依據，本次尚未在互動式瀏覽器中直接執行。

規格文件：[Notion 規格書](https://app.notion.com/p/CoC-4066bb2da397814999b8f86d64fc24e4?pvs=204)
\n\n## 驗收紀錄（2026-10-28）\n\n- Repository 初始 HEAD：`190fd96043e04fda4186cadbacd34e443c02b550`（main）。\n- 對照 Notion 規格後，已在 `audit/spec-alignment` 分支調整問卷選項、背景模板、核心測試與 Chromium E2E 測試。\n- 職業資料維持 22 筆初步清單；官方商品頁僅能佐證部分範例，不代表逐項核實或官方完整清單。\n- 本環境可直接讀寫 GitHub，但沒有可供此回合啟動的互動式瀏覽器／本機 npm 執行環境；請以新分支上的 CI 測試結果補完實際執行紀錄。\n