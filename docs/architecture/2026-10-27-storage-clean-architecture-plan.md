# 儲存與 Gemini 解耦重構計劃：Domain、Repository、Usecases

狀態：已依計劃實作；驗證結果見文末。
日期：2026-10-27
本版依使用者要求，將 Clean Architecture 簡化為三個部分：Domain、Repository、Usecases。

## 1. 範圍

本輪改善收藏、任務、複習與照片的儲存，並解耦 Gemini 辨識串接：

- 業務規則可以脫離 React、IndexedDB 與 Gemini SDK 測試。
- 照片辨識功能流程不依賴 Gemini 的模型名稱、prompt、SDK 請求或原始回應格式。
- 改成增量寫入，一次複習不讀寫照片、不重寫全部收藏。
- 多分頁交錯操作不覆蓋彼此已提交的資料。
- 單字、任務與照片引用維持交易原子性。

依使用者要求，排除資料升級、migration、備份復原、匯出與匯入。
新實作使用獨立的 `words-in-life-storage` 資料庫，首次 schema version 為 1；既有資料庫與舊收藏／任務 localStorage 保留原處，不讀取、轉入或清除。因此切換後使用新的資料集。

API key 與鏡頭偏好沿用目前設定來源。CI、全專案格式化、帳號、後端與雲端同步不納入本輪。

## 2. 三個部分的責任

| 部分 | 責任 | 不負責的事項 |
| --- | --- | --- |
| Domain | 單字識別、辨識結果與資料規則、任務匹配、跨日、連續天數、複習統計 | React、DB、Gemini SDK、照片解碼與 object URL |
| Repository | 儲存介面與 IndexedDB 實作；辨識服務介面與 Gemini 實作，各自分離 | 決定任務是否達成、複習成績、畫面流程 |
| Usecases | 協調辨識、圖片準備、結果處理、收藏與任務；處理儲存衝突重試 | 畫面、動畫、音效、IndexedDB 細節、Gemini 協定 |

現有 React hooks 保留，改為呼叫 usecases，處理 loading、pending、error 與畫面更新。
不再額外建立 application、infrastructure、presentation 等資料夾，也不新增通用 DI container、Unit of Work、BaseRepository 或全域狀態框架。

## 3. 結構與依賴方向

```text
src/
  domain/
    vocabulary.ts           # Word、WordId、正規化與收藏識別
    missions.ts             # 任務匹配、當日任務、streak
    reviews.ts              # 複習摘要計算
    photos.ts               # PhotoId、PhotoRef
    recognition.ts          # 與供應商無關的辨識結果、驗證與正規化
  repository/
    LibraryRepository.ts    # 儲存介面與請求／結果型別
    RecognitionRepository.ts # 辨識服務介面；不承擔持久化
    gemini/
      geminiRepository.ts   # SDK 呼叫、模型設定、有限重試與錯誤轉換
      request.ts            # prompt、Gemini schema、SDK payload
      response.ts           # Gemini 回應解碼及轉成通用辨識結果
    indexedDbRepository.ts  # IndexedDB 實作
    database.ts             # schema 建立、連線及交易 helper
    photos.ts               # 照片內容 hash、按需讀取／URL 生命週期 helper
  usecases/
    createLibraryUsecases.ts # 接收 repository，回傳可呼叫的函式
    collection.ts           # saveWord、removeWord、recordReview
    missions.ts             # ensureMissionDay、completeMission
    library.ts              # initialize、load、共用衝突重試
    recognition.ts          # recognizePhoto、prepareSampleScene、處理辨識結果
  features/                 # 保留現有 hooks，改接 usecases
  components/               # 保留現有畫面
```

```text
現有 hooks → Usecases → Domain
                   → Repository 介面
IndexedDB／Gemini 實作 → 各自的 Repository 介面與 Domain 型別
```

規則：

- Domain 不 import hooks、usecases、repository，也不使用瀏覽器 API。
- Usecases 只 import Domain 和 Repository 的介面／型別，不 import IndexedDB／Gemini 實作或 `@google/genai`。
- Repository 不 import React、feature hooks 或 usecases；IndexedDB 與 Gemini 實作不互相呼叫。外部格式轉換在各自實作內完成。
- 在現有 App 啟動處建立儲存 repository 與辨識 repository，透過參數傳給 usecases。時間及 ID 使用 `now`／`createId` 函式參數，測試可替換，不再各自建立 Clock／IdGenerator 類別。
- Gemini SDK 維持延遲載入，只有實際呼叫 Gemini 實作時才載入；使用範例不載入 SDK 或要求 API key。
- Hooks 不接觸 IDBTransaction，也不再接受任意 `update(previous => next)` 快照修改函式。
- 檔案按職責分組；不要求每個 use case、型別或方法各建立一個 class／檔案。

## 4. 資料與 Repository 介面

Domain 的單字與任務只持有照片引用：

- `PhotoRef = { kind: 'stored', photoId } | { kind: 'asset', path }`。
- 持久化資料不保存 data URL 或 blob URL。
- 目前元件的 `imageUrl` props 可保留，由 hook／圖片 helper 轉換，避免同步重寫全部畫面。

Repository 介面只保留實際需要的能力：

```ts
interface LibraryRepository {
  read(): Promise<LibrarySnapshot>;             // metadata 與 revision，不讀全部照片
  commit(request: CommitRequest): Promise<CommitResult>;
  readPhoto(photoId: PhotoId): Promise<PhotoContent>;
  subscribe(onChange: (revision: number) => void): () => void;
  close(): void;
}

interface CommitRequest {
  commandId: string;
  expectedRevision: number;
  changes: ChangeSet;                          // 明確的新增、刪除、更新操作
  photos: readonly PreparedPhoto[];            // 交易前已準備好的 bytes、MIME、PhotoId
}
```

`LibrarySnapshot` 包含單字 metadata、當日任務、streak 與 revision。
`ChangeSet` 表達受影響的紀錄，不允許直接替換整份資料庫。
`CommitResult` 區分成功、已處理、衝突與失敗，失敗保留可辨識的代碼與 cause。

`readPhoto` 按需回傳 `PhotoContent = { bytes: Uint8Array; mimeType: string }`，不額外引入圖片 repository。

圖片解碼、裁切與 hash 在 transaction 開始前完成；既有圖片工具可沿用。照片寫入必須隨 commit 一起完成，不能先獨立存圖、再存單字而留下部分資料。

## 5. Usecases 行為

| 操作 | 行為 |
| --- | --- |
| initialize | 交易內確認初始化標記，只建立一次預設範例；空收藏重新載入不重新種資料 |
| load | 讀取 metadata，提供目前畫面所需資料 |
| saveWord | 確保單字已收藏；已存在時不重設複習紀錄；不用過期 UI 快照做 toggle |
| removeWord | 移除指定單字及照片引用；不存在時視為操作已達成 |
| recordReview | 更新指定單字的複習摘要，以 commandId 避免重複計數；單字已刪除則回傳 NotFound |
| ensureMissionDay | 依傳入日期建立當日任務，同日不重置進度 |
| completeMission | 使用 domain 規則，一次分析至多完成一個任務；以 analysisId 避免重複處理 |

Usecases 共用小型重試函式：讀最新狀態、計算變更、提交，衝突時最多嘗試 3 次（含首次）。同一操作的 ID、時間與照片準備結果固定，不因重試產生新的操作或重複裁切。

## 6. 儲存設計

IndexedDB 使用以下 stores；它們是資料表劃分，不各自建立 repository class：

| Store | 內容 |
| --- | --- |
| `words` | 單字、原圖／裁切引用與複習摘要，以 WordId 為 key |
| `learning` | 當日任務、streak、lastCompletedDate，維持一份當前學習狀態 |
| `photos` | 依內容 PhotoId 儲存 Blob |
| `photoMetadata` | MIME、大小、引用數，讀 metadata 不需載入 Blob |
| `operations` | commandId 與小型操作結果，供重試去重；不保存完整資料快照 |
| `meta` | revision 與 initialized |

本輪只保存目前已有的複習摘要，不新增完整複習事件歷史；操作結果紀錄只用於冪等性，不承擔事件溯源，也不新增自動過期規則。

每次 commit：

1. 在同一 readwrite transaction 內檢查 commandId 是否已處理。
2. 比較 expectedRevision，過期則不寫入並回傳衝突。
3. 讀取受影響的舊紀錄，計算變更與照片引用差額。
4. 只寫入此次變動、必要的新照片、操作結果與新 revision。
5. transaction complete 後才回報成功；任一步失敗整筆 abort。

交易內不執行 fetch、hash、Canvas、動畫或任意外部 async callback，避免 transaction 自動關閉。一次複習不讀寫 `photos`；正常操作不使用 clear() 重建 stores。

## 7. 多分頁與照片生命週期

- 正確性由 IndexedDB transaction 與 revision 檢查保障；單分頁 Promise queue 只用來整理本頁操作。
- 提交後 repository 廣播新 revision；其他分頁經 subscribe 收到通知，再呼叫 load。
- 頁面重新取得焦點時也重新讀取 revision，以補足遺失通知或不支援 BroadcastChannel 的情況。
- 通知失敗不把已提交的操作改報失敗。同字新增／刪除以成功提交順序為準，不同單字的操作都要保留。
- 相同照片依內容 hash 共用；已有照片不重新 put Blob，只調整引用。
- 刪字、替換照片或跨日時，僅更新相關引用；最後一個引用移除時，在同一交易刪除 Blob 與 metadata。
- 原圖與裁切指向同張照片時，引用增減使用相同計數方式。
- URL helper 以簡單 acquire/release 管理共享 object URL；最後一個畫面使用者釋放後才 revoke。
- 詳情開啟期間刪除收藏，不立即撤銷詳情仍持有的 URL；關閉／卸載再釋放。

## 8. 畫面接合與錯誤處理

沿用現有 hooks 與 React state，不新增 Provider／LibraryStore／另一套狀態管理系統。

- App 啟動時組裝 repository 和 usecases，經現有 hooks 傳入使用。
- Hooks 載入 metadata、訂閱變更，維護 pending／loading／error；成功提交後才更新畫面或前進字卡。
- 用 request generation 防止卸載、重新初始化或較舊讀取完成後覆蓋新畫面狀態。
- 清理訂閱、DB handle 和 object URL；保留 dialog 內的儲存錯誤提示。
- 錯誤代碼使用 Unavailable、QuotaExceeded、Conflict、NotFound、InvalidData、Unexpected；UI 負責顯示文字。
- InvalidData 不觸發清空或重建；不新增資料修復功能。
- 診斷資訊不包含 API key、照片 bytes 或整份使用者資料。

## 9. Gemini：功能邏輯與串接邏輯分開

目前 `src/utils/gemini.ts` 混合 prompt、schema、模型候選、SDK 呼叫、回應解析與錯誤文案；`useRecognition.ts` 另混合壓縮、請求逾時、裁切、任務回呼、動畫與畫面切換。此輪沿用三個部分解耦，不增加新架構層。

### 責任分配

| 邏輯 | 放置位置 |
| --- | --- |
| 英文學習需求、繁中內容、單字數量上限、結果處理順序 | usecases 的辨識需求設定，供串接實作轉譯 |
| 通用辨識資料型別、單字正規化、座標與欄位規則 | Domain |
| 壓縮 → 呼叫辨識介面 → 驗證結果 → 準備裁切 | `usecases/recognition.ts`，媒體工作使用既有圖片 helper／注入函式 |
| Gemini prompt、SDK schema、模型名稱、請求封裝、SDK client | `repository/gemini/` |
| Gemini 原始 JSON 解碼、欄位映射、供應商錯誤轉換 | `repository/gemini/response.ts` 與實作內的錯誤處理 |
| 任務匹配、完成任務及其資料寫入 | 既有 Domain 任務規則與任務 usecases；Gemini 實作不寫 DB |
| 印照片動畫、最短展示時間、音效、取消按鈕、中文錯誤文案 | 現有 hook／元件 |

### 辨識介面

```ts
interface RecognitionRepository {
  analyze(
    request: RecognitionRequest,
    options: { signal: AbortSignal },
  ): Promise<RecognitionResult>;
}
```

- `RecognitionRequest` 只包含準備好的圖片 bytes、MIME 與產品需求設定，例如語言及物件數量；不包含 Gemini 的 model、contents、Type schema 或 SDK 類別。
- `RecognitionResult` 是 Domain 的通用結果：`recognized`（場景與單字）或 `unrecognizable`（照片內容無法辨識及原因）。照片無法辨識不是網路例外。
- API key 在組裝 Gemini 實作時提供取值函式，沿用現有設定來源，於每次請求前取得目前值；usecases 與 Domain 不讀 localStorage，也不接收 SDK client。缺 key 回傳可辨識的 MissingCredential 錯誤，由畫面導向設定。
- Gemini 回應先由串接實作解碼／映射，再交由 Domain 驗證通用資料。SDK 原始回應與錯誤不流入元件。
- Domain 不從供應商的中文訊息推論 HTTP 錯誤；HTTP／SDK 錯誤使用結構化 status／code 轉換。

### 取消、重試與副作用

- 辨識 use case 負責整個壓縮、API 與裁切流程的共同逾時上限，初始沿用 25 秒；hook 傳入使用者取消訊號。所有內部操作使用共同的取消／deadline 訊號。
- 串接實作區分 MissingCredential、Unauthorized、InvalidInput、RateLimited、Unavailable、InvalidResponse 與 Cancelled；use case 區分使用者取消與 deadline 逾時，UI 對應中文提示。
- 模型候選與 fallback 策略集中在 Gemini 實作設定。不在 usecase 或 hook 重複迴圈；模型不存在／不支援才嘗試下一個候選，且受同一 deadline 限制。認證、無效輸入與額度限制直接回報。
- 可恢復的網路／服務暫時失敗最多額外重試一次，使用取消感知的短暫等待；若 SDK 自帶重試，顯式設定總嘗試預算，避免 SDK 與應用迴圈相乘。取消或逾時後停止後續模型／請求。
- 資料庫 revision 衝突只重試資料提交，不重新呼叫 Gemini。一次辨識沿用固定 analysisId，避免重複完成任務。
- 辨識結果完成後，再呼叫任務 usecase；任務保存失敗仍保留已成功辨識的場景，顯示儲存錯誤，不能改報成 Gemini 辨識失敗。
- 使用者取消或新照片取代舊照片時，過期結果不得更新畫面，也不得啟動後續任務寫入；已完成的 DB commit 不因稍後取消而假裝撤銷。
- 範例走 `prepareSampleScene`，與真實辨識共用結果驗證、裁切及任務處理，不經 Gemini。動畫等待只影響展示，不阻塞 usecase 的功能結果。

### 測試

- 注入 fake RecognitionRepository，在不載入 SDK、不連網的情況測試成功、無法辨識、缺 key、逾時、取消與錯誤資料。
- 用固定 Gemini 回應 fixture 測試 request schema／payload、JSON 解碼、欄位映射及錯誤轉換；串接測試在 SDK／HTTP 邊界攔截，不要求真實 API key。
- 驗證重試／模型 fallback 的上限、共同 deadline、取消後停止請求，以及供應商 client 不會自行寫入資料庫。
- 驗證儲存衝突不重送 AI 請求；儲存失敗不丟棄辨識場景；使用範例不讀 API key、不發送 Gemini 請求。
- 保留目前第二張照片失敗後重試正確圖片、舊請求晚回覆、reduced-motion、取消與失敗重試的瀏覽器案例。

## 10. 實作順序

| 階段 | 交付 | 驗收 |
| --- | --- | --- |
| 1：Domain + 介面 | 抽出純規則、通用辨識結果、LibraryRepository 與 RecognitionRepository 介面；測試替身放 tests/helpers | Node 能測業務規則；usecases 不依賴 IndexedDB／Gemini 實作 |
| 2：儲存 Usecases | 初始化、收藏、移除、複習、任務及共用衝突重試 | 明確操作語意、去重、衝突重算、固定時間／ID 的測試通過 |
| 3：儲存 Repository | 新 IndexedDB、增量交易、照片引用、revision、跨頁通知 | 真實瀏覽器驗證原子性、多分頁與照片讀寫範圍 |
| 4：辨識解耦 | recognition usecases、Gemini request／response／錯誤及 fallback、fake service | 功能測試不連網，串接 contract 測試通過；AI 與 DB 重試分開 |
| 5：畫面接合與整理 | 現有 hooks 改接 usecases；移除 snapshot repository／UpdateLibrary／readLegacy 及舊 Gemini 直呼入口 | 回歸通過；設定更新生效；範例不依賴 Gemini；舊資料不被存取或清除 |

每階段維持可建置；先驗證 usecases 與 repository，再切換畫面，不同時對兩種資料庫寫入。現有 staged changes 保留，不混合提交。

## 11. 必要測試與完成條件

- **邊界**：Domain 沒有外層依賴；usecases 不 import React、IndexedDB 或 Gemini 實作；repository 不 import hooks；`@google/genai` 只出現在 Gemini 實作。
- **Repository contract**：memory 與 IndexedDB 對新增、重複新增、移除、空集合、revision、去重及 NotFound 的結果一致。
- **多分頁**：同時新增不同單字都保留；同字去重；兩次 review 都計入；刪除後 stale review 不重建單字。
- **任務**：同一 analysisId 不重複完成任務；當日最後任務同時完成不重複增加 streak；跨日不寫回舊任務。
- **原子性**：同步例外、request error、tx.abort、quota failure 都不留下部分資料或錯誤引用。
- **照片成本**：review 的 Blob 讀寫為零；metadata 載入不讀照片 getAll；新增一張照片不重寫既有圖片。
- **照片引用與 URL**：共用圖、最後引用回收、同圖兼原圖／裁切、開啟詳情時刪字及卸載釋放都通過。
- **初始化與錯誤**：兩頁首次啟動只初始化一次；空收藏不重種；失敗可重試；不觸碰舊收藏／任務資料來源。
- **Gemini 功能／串接**：fake service 的功能測試與 Gemini fixture contract 測試分開；取消、deadline、fallback、錯誤分類及設定 key 更新通過。
- **副作用**：DB 衝突不重送 Gemini，過期辨識不新增任務寫入，任務儲存失敗不改報為辨識失敗。
- **UI**：本頁更新、跨頁通知、回到前景補查、快速連點、對話框提示及 reduced-motion 回歸通過。

沿用 `npm run check` 與 `npm run test:e2e`，增加 repository contract、Gemini contract、usecase、儲存整合與依賴檢查。至少以 Chromium 測試完整儲存流程，並以 WebKit 驗證核心交易案例。模擬請求通過不代表真實 Gemini 模型可用。

用 1,000 個單字、100 張共用測試圖記錄載入與操作時間、照片 I/O 次數；先以「只操作受影響紀錄」作為驗收標準，不宣稱尚未量測的毫秒數。初次允許讀取全部文字 metadata，列表分頁另列後續。

上一輪 `2026-10-27-refactor.md` 保留為歷史紀錄；本文件取代上一版四層設計與 migration 規劃。此輪完成後的核心結構只有 Domain、Repository、Usecases。


## 12. 實作與驗證紀錄（2026-10-27）

已完成 Domain／Repository／Usecases 三部分，既有 hooks 接回 usecases；由 `src/createServices.ts` 組裝服務，未新增 Provider 或全域狀態框架。舊 snapshot repository、UpdateLibrary、readLegacy 及 `utils/gemini.ts` 直呼入口已移除。Gemini 實作位於 `src/repository/gemini/`，SDK 維持延遲載入。

實作採明確型別的 AppError 表達失敗；commit 結果區分 committed／alreadyApplied／conflict。照片查詢回傳 PhotoContent，畫面用 acquire/release 管理 URL。Domain 與 usecases 的依賴限制有自動化檢查。

驗證：

- `npm run check` 通過：strict TypeScript、15 項 Node 測試與正式建置。
- 八組 Chromium 瀏覽器測試通過：設定、相機、UI smoke、字卡動態、照片轉場、資料可靠性、儲存 contract、多分頁，以及 Gemini request/response contract（後兩項分別由 storage-flow、gemini-contract 驗證）。
- WebKit 使用獨立暫存 profile 執行儲存 contract、交易失敗、照片引用／URL 及兩分頁競態測試。此版本 WebKit 的暫時 context 無法儲存 Blob，因此測試明確使用獨立磁碟 profile，結束後刪除測試 profile。
- 儲存測試覆蓋同步容量例外、明確 abort 與非同步 request error；均確認不留下部分 metadata 或孤立照片。
- 使用 mock Gemini／模擬相機，未宣稱驗證真實模型可用性、實體相機或語音服務。

本機 Chromium 單次 benchmark（100 張 100×100 PNG，共 3,464,717 bytes；1,000 個單字共用）：

| 操作 | 實測 |
| --- | --- |
| 首次建立資料 | 46 ms |
| metadata 載入 | 5.1 ms |
| 複習 | 9.8 ms |
| 收藏既有圖片的新單字 | 10.4 ms |
| 移除該單字 | 9.1 ms |
| 上述 metadata 載入／複習／收藏／移除的照片 Blob 讀寫 | 0 / 0 |

數字僅供本機基準，不作跨裝置延遲保證。資料庫與設定儲存鍵統一使用 words-in-life 命名空間；不讀取、遷移或清除舊名稱的資料與設定。
