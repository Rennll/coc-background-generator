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

- `questions.json` 已依目前可讀取的 Notion 規格書整理；仍應在 UI 實測時逐題校對顯示與分支。
- `templates.json` 的組合規則為初稿，尤其 Q3a/Q3b、Q4/Q5、Q6/Q7 的敘事銜接仍可進行文字潤飾。
- `occupations.json` 是 22 筆初步資料，不是官方完整職業清單。部分項目僅有官方商品頁範例、類別佐證或尚待核對；補充項目會明確標示，不可宣稱為官方已核實條目。
- JSON 匯出是本專案自訂格式，不是 Chaosium 官方 JSON 標準。
- 尚未完成完整的真實瀏覽器互動測試。核心商業邏輯目前有 Node 內建測試覆蓋，但不能取代跨瀏覽器及實際操作測試。

規格文件：[Notion 規格書](https://app.notion.com/p/CoC-4066bb2da397814999b8f86d64fc24e4?pvs=204)
