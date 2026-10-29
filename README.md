# Words in Life

**拍下生活，發現單字。** Discover words in everyday life.

拍照探索生活中的英文單字，把生活場景變成照片單字卡，再透過翻卡與每日尋寶持續複習。

這是以 React 19、TypeScript、Vite 8、Tailwind CSS 4 與 Motion 建立的前端應用程式。相機、圖片處理與學習資料儲存皆在瀏覽器執行；照片辨識與個人化任務從瀏覽器直接呼叫 Google Gemini，可部署至靜態主機。

## 專案命名

應用與專案名稱統一為 **Words in Life**，npm 套件識別名為 `words-in-life`。頁面標題、分享資訊、應用介面與設計系統皆使用新名稱。

IndexedDB 名稱為 `words-in-life-storage`、API key 儲存鍵為 `words-in-life-gemini-key-v1`，相機偏好儲存鍵為 `words-in-life-camera-enabled-v1`。不讀取或遷移舊名稱的資料與設定。`vs-` 樣式與 token 前綴繼續作為內部設計系統命名空間。

本機 checkout 資料夾名稱與外部 Git 專案名稱需在各自環境另行調整；程式執行不依賴 checkout 資料夾名稱。

## 專案文件

- [專案互動導覽](public/docs/index.html)：功能、架構地圖、辨識／收藏／複習／任務流程、程式目錄、資料儲存與開發指令。支援點選節點、逐步流程、目錄搜尋與指令複製。
- [設計系統規範](DESIGN.md)：視覺 tokens、共用元件 API、可及性與應用畫面規範。
- [儲存與核心架構](docs/architecture/2026-10-27-storage-clean-architecture-plan.md)：現行 Domain／Repository／Usecases 設計、交易與照片生命週期，以及實作驗證紀錄。
- [AI 個人化每日任務](docs/architecture/2026-10-27-ai-missions.md)：選題規則、請求資料、每日快取、跨分頁競態與失敗備援。
- [早期重構紀錄](docs/architecture/2026-10-27-refactor.md)：歷史設計；其中的四層架構與 migration 規劃已由現行儲存架構文件取代。

啟動開發伺服器後，可開啟 [本機專案導覽](http://localhost:3000/docs/index.html)。導覽是無外部依賴的單一 HTML，可直接以瀏覽器開啟離線閱讀，無須 API key。建置後會一併輸出至 `dist/docs/index.html`。

文件基準：2026-10-27。文件依目前程式人工維護，修改功能或架構時，請同步更新 README、互動導覽及相關設計文件。

## 主要功能

| 功能 | 說明 |
| --- | --- |
| 拍照辨識 | 首頁直接開啟後置相機，也能選取圖片。辨識場景、英文單字、繁中、音標、例句與物件位置，並產生方形照片裁切。 |
| 單字收藏 | 三欄照片格狀與列表瀏覽、中英文搜尋、分類篩選、單字詳情與原始照片。分類採英文關鍵字規則，未命中時歸入其他。 |
| 翻卡複習 | 先看照片回想單字，翻面後記錄記住／未記住；保存複習次數、記住次數、最近複習時間與記住比例。 |
| 每日尋寶 | 開啟任務時由 AI 安排一項收藏複習、兩項新探索；空收藏時為三項新探索。顯示分類、提示與選題理由，三項全部完成才計入連續完成天數。 |
| 範例與設定 | 提供咖啡館、美食、街景與書桌四組範例；可儲存或清除 Gemini API key。發音使用瀏覽器內建語音合成。 |

首頁下方左側可選取圖片，右側照片計數開啟收藏，觀景窗任務列開啟今日尋寶與範例。單字詳情的三點選單提供發音練習、片語與原圖等工具。

## 本機啟動

需要 Node.js 與 npm；目前 Vite 套件要求 Node.js `^20.19.0 || >=22.12.0`。

```sh
npm install
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000)，從首頁進入「設定」，輸入並儲存自己的 Gemini API key，即可辨識真實照片與生成 AI 任務。儲存 key 不會向 Google 驗證其有效性；未設定時，真實辨識會提示前往設定，仍可體驗範例。

API key 保存在目前瀏覽器的 localStorage。照片辨識會直接將照片與 key 傳送給 Google Gemini；任務生成則傳送日期、月份、時區與有大小上限的單字／複習摘要，不包含照片。專案沒有應用後端，也不透過環境變數設定 API key。共用裝置使用完畢後請清除 key。

## 設計系統

開啟 [本機元件目錄](http://localhost:3000/design-system) 查看互動元件與正式畫面預覽，無須 API key。也可使用 `npx vite --host 127.0.0.1` 啟動，依終端顯示的網址開啟 `/design-system`。

應用採暖奶油紙色、咖啡棕、橘色快門與拍立得照片框，主畫面在桌面維持置中的相機尺寸構圖。目錄的畫面預覽重用正式 React 元件，資料僅存在記憶體，不會請求辨識；嵌入預覽也禁止相機與麥克風權限。共用元件、樣式層與版面規則詳見 [DESIGN.md](DESIGN.md)。

## 程式架構

核心由三個部分組成：Domain 定義純規則、Repository 定義契約並實作外部服務、Usecases 協調功能流程。`src/createServices.ts` 組裝依賴，既有 React hooks 管理畫面狀態與生命週期。

| 路徑 | 責任 |
| --- | --- |
| `src/main.tsx`、`src/App.tsx` | 依路徑延遲載入應用或設計系統，組合畫面並管理服務生命週期。 |
| `src/domain/` | 單字與照片型別、辨識驗證、複習統計、任務匹配與 AI 選題規則。 |
| `src/usecases/` | 初始化、收藏、刪除、複習、任務生成／完成，以及辨識壓縮與裁切流程。 |
| `src/repository/` | 圖庫、辨識與任務生成契約；IndexedDB 交易、照片引用及共用 Blob URL。 |
| `src/repository/gemini/` | Prompt、JSON schema、SDK 呼叫、回應解碼、模型 fallback 與錯誤轉換。 |
| `src/hooks/`、`src/features/` | 圖庫訂閱、相機、對話框、辨識狀態、收藏與每日任務 hooks。 |
| `src/components/` | 相機、場景結果、收藏、翻卡、每日任務、設定與錯誤恢復畫面。 |
| `src/design-system/`、`src/styles/` | 視覺 tokens、共用元件、元件目錄與應用畫面構圖。 |
| `src/utils/` | 圖片壓縮／裁切、語音、分類、API key 與錯誤訊息工具。 |
| `src/data/`、`src/assets/`、`public/` | 範例資料、照片、紙張紋理與互動文件。 |
| `tests/` | Domain／Usecases 測試、Repository 共用契約、依賴邊界與瀏覽器整合測試。 |

辨識 usecase 協調壓縮、辨識、驗證與裁切，共用 25 秒期限與取消訊號；hook 處理列印動畫、畫面切換與過期結果防護。Gemini SDK 在真實辨識或 AI 任務生成需要時才載入。模型 fallback 與暫時性錯誤重試集中於 Gemini 實作，資料庫衝突只重試提交，不重送 AI 請求。任務保存失敗時保留已辨識的場景，另顯示儲存錯誤。

## 本機資料與同步

IndexedDB 資料庫 `words-in-life-storage` 將單字 metadata 與照片 Blob 分開保存：

| Object store | 內容 |
| --- | --- |
| `words` | 單字、例句、照片參照、收藏時間與複習摘要。 |
| `learning` | 當日任務、生成狀態、完成進度與連續完成天數。 |
| `photos` | 依內容 SHA-256 識別並共用的照片 Blob。 |
| `photoMetadata` | 照片 MIME、大小與引用次數。 |
| `operations` | 依 commandId 保存操作結果，避免重複套用。 |
| `meta` | revision 與初始化標記。 |

每次提交只更新受影響的紀錄，照片與引用計數在同一交易中更新；最後一個資料引用移除時回收照片。讀取 metadata 與記錄複習不讀寫照片 Blob。畫面按需取得共用 object URL，最後一個使用者釋放後才撤銷 URL。

交易會核對 revision，發生衝突時重新讀取、計算與提交，最多嘗試三次。成功後以 BroadcastChannel 通知其他分頁，頁面回到前景時也重新載入。

首次初始化加入四個範例單字，清空收藏後重新載入會維持空白。目前沒有登入、雲端同步、資料匯入或匯出。此版本不讀取、遷移或清除舊名稱的資料庫及 localStorage；收藏、API key 與相機偏好皆使用新命名空間。

### 每日任務規則

- 依本機日期更新任務，每 15 秒或回到前景時檢查跨日；開啟「今日尋寶」才觸發 AI 生成。
- 請求最多提供 500 個已知單字名稱與 30 個優先複習候選摘要，優先考量尚未複習、記住比例偏低與久未複習。時區不作為所在地或天氣的證據。
- 生成前以交易取得當日生成權，避免多分頁重複呼叫；結果保存在 IndexedDB。缺 key、逾時、無效回應或服務失敗時，固定使用當日本機備援題庫。
- 請求中斷後，生成權超過 30 秒會於下一次檢查改用備援。已固定的任務不因當天補上 key、修改收藏或重新整理而重抽；開始或完成任務後也不會被晚到回應覆蓋。
- 範例與真實辨識共用完成規則，一次分析至多完成一項任務，同一 analysisId 不重複計算；三項全數完成才計入連續天數。

程式驗證任務格式、目標／別名不重疊及複習／新字比例；別名語意與物件實際可取得性仍取決於模型品質。複習紀錄目前是統計摘要，尚未實作間隔複習排程。選題 prompt 與 schema 位於 `src/repository/gemini/missionRequest.ts`。

## 開發與驗證

| 指令 | 用途 |
| --- | --- |
| `npm run dev` / `npm start` | 啟動 Vite 開發伺服器，預設 port 3000。 |
| `npm run lint` | 執行 strict TypeScript 型別檢查。 |
| `npm test` | 執行 Node 測試，涵蓋純規則、usecases、共用 Repository 契約與依賴邊界，無須瀏覽器或 Gemini key。 |
| `npm run build` | 建置正式版本至 `dist/`。 |
| `npm run check` | 依序執行型別檢查、Node 測試與正式建置。 |
| `npm run test:e2e` | 在 port 4179 啟動隔離 Vite 伺服器，執行九組瀏覽器測試。 |
| `npm run preview` | 本機預覽正式建置。 |
| `npm run clean` | 刪除 `dist/` 建置產物。 |

瀏覽器測試先安裝 Chromium：

```sh
npx playwright install chromium
npm run test:e2e
```

也可設定 `CHROME_PATH` 指向已安裝的 Chrome 執行檔。設定 `TEST_BASE_URL` 可使用既有 Vite 伺服器；`TEST_OUTPUT_DIR` 可調整截圖位置，預設為忽略追蹤的 `test-results/`。契約測試透過 Vite 匯入測試模組，不會包入正式建置。

若要以 WebKit 驗證儲存契約與多分頁交易，先安裝引擎，另啟動開發伺服器後執行：

```sh
npx playwright install webkit
TEST_BROWSER=webkit TEST_BASE_URL=http://localhost:3000 node tests/storage-flow.cjs
```

WebKit 儲存測試使用獨立暫存 profile 以支援 Blob，結束後刪除。瀏覽器測試使用隔離情境與測試資料，涵蓋設定、模擬相機、收藏／對話框、翻卡動態、照片轉場／取消、正確照片重試、跨日、IndexedDB 契約、容量／交易失敗回滾、照片引用／URL、多分頁，以及攔截 Gemini 的辨識與任務生成／快取／備援。

模擬請求與相機不代表已驗證真實 Gemini 模型可用性、生成品質、實體相機或語音服務；真實辨識需要有效的 API key。

## 靜態部署

執行 `npm run build`，將 `dist/` 部署至靜態主機。相機需要 HTTPS 或 localhost 安全環境；使用設計系統路徑時，主機需設定 SPA fallback 至 `index.html`。互動導覽部署後位於 `/docs/index.html`。

網站圖示使用 `public/icons/logo.png` 的原始品牌圖，另提供多尺寸 favicon、Apple Touch Icon 與 Web App Manifest。社群分享圖片為 `public/social/words-in-life-og-v5.png`（1200 × 630），採用簡約奶油紙底、紙張壓印專案相機 Logo、Words 對焦角標與「單字」標籤；三張暖色拍立得由標記 mug、plant、book 的場景主卡，以及植物、馬克杯兩張特寫單字卡組成，搭配「Words in Life｜拍下生活，發現單字」。`index.html` 已設定繁中標題、搜尋摘要、Open Graph 與 Twitter summary_large_image 卡片，`metadata.json` 同步應用描述。

正式網址為 [https://words-in-life.pages.dev/](https://words-in-life.pages.dev/)。`index.html` 的 canonical、`og:url`、`og:image` 與 `twitter:image` 均使用此網域的 HTTPS 絕對網址；變更網域時需一併更新。
