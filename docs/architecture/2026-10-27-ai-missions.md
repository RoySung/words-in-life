# AI 個人化每日任務

## 行為

開啟「今日尋寶」時，依本機日期、月份、時區與現存單字摘要，由 Gemini 生成三項可拍照尋找的生活物件任務。三項全部為新探索，目標與別名都避開已收藏單字。備援題庫優先選未知單字，不足三項時才補入已知物件。已開始或完成的任務保持原進度。日期與月份提供時節參考；時區不能當成所在地、天氣或節日參與的證據。

生成包含英文、繁中、IPA、名詞詞性、圖示、尋找提示、同一物件的別名、新探索分類與選題理由。任務卡顯示單字、翻譯與提示；生成中以搜尋動畫顯示更新狀態，停用任務、發音與更換操作，範例體驗仍可使用。動畫尊重減少動態偏好，離開可見範圍時暫停。

每張未完成任務卡可從本機題庫更換一次，不另送 AI 請求。更換優先選未知物件，避開昨日最終與已換掉的目標、今日其他任務及今日已換掉的目標。限制與目標在同一交易保存，跨分頁和重載保留，跨日重置。替換卡片以翻面動畫呈現，動畫期間暫停該卡互動。

物件完成比對接受常見材質、顏色、大小前綴與規則複數，仍要求目標全名位於物件名稱末尾，不使用例句或相關物件名稱。昨日排除、替換與已知字檢查共用物件名稱鍵，忽略描述前綴並正規化複數，保留 glass 與 glass bottle 等不同物件的區別。

## 邊界與檔案

- `domain/missionGeneration.ts`：建立有大小上限的摘要、驗證回應結構、三項目標與別名不重疊、三項新字規則。
- `repository/MissionGenerationRepository.ts`：獨立的文字任務生成能力契約。
- `repository/gemini/missionRequest.ts`：實際 system prompt、JSON schema 與資料訊息；單字資料不得作為指令。
- `repository/gemini/missionRepository.ts`：Gemini 回應解碼與基本驗證。
- `repository/gemini/client.ts`：辨識與任務共用 SDK 呼叫、HTTP 錯誤轉換、404 模型 fallback 與最多一次暫時性錯誤重試。
- `usecases/missionGeneration.ts`：讀取圖庫、搶占當日生成權、25 秒期限、驗證與保存，避免 AI 呼叫落入 DB 衝突重試。
- `features/missions/useDailyMissions.ts`：任務畫面開啟時呼叫生成流程；每 15 秒與回到前景檢查日期及過期生成權。

`createServices.ts` 注入所有實作。沒有 key 時不載入 SDK。任務文字請求沒有照片，最多提供 500 個已知單字名稱，不傳送複習統計；相容欄位 reviewCandidates 固定為空陣列。大小上限由 Domain 決定，新增字是否已知會再依完整本機單字簿驗證。設定頁說明資料用途。

## 保存與競態

沿用 IndexedDB v1 的 `learning/current`，以可選的 `generation`、`previousMissionWords`、`replacedMissionWords` 及任務 `replaced` 欄位保存生成與更換狀態，無新 store，既有紀錄不需升級或清除。

```text
pending → generating(requestId, startedAt) → ready(ai | fallback)
                                            ↓
                                      跨日回到 pending
```

1. 初始與跨日時以既有題庫準備三個備援目標，generation 為 pending。
2. 用 revision 交易取得 generating 權限，之後才呼叫 AI。單分頁共用進行中的 Promise；其他分頁看到有效生成權便不再呼叫。
3. 有效結果以同一 requestId、日期及當前狀態為條件提交；跨日、已鎖定或不同請求的晚到結果不寫入。
4. 缺 key、服務失敗、無效結果或逾時會以備援題目固定當天任務。當天儲存新 key、修改收藏或重新整理不重抽。
5. 生成權超過 30 秒仍未結束時，下一次開啟／檢查會固定為備援，避免重載後重送請求。服務關閉會取消進行中的請求。
6. 選擇任務時先以 startMission 保存固定狀態；完成任務也會固定。舊版已完成進度保留，不由 AI 覆蓋。完成任務與 streak 沿用既有原子交易與 analysisId 去重。

本地驗證可檢查格式、數量、名稱正規化與學習角色；物件是否適合時節、別名是否語意等同及實際可取得性由 prompt 約束，無法僅靠字串驗證保證。

## 驗證範圍

`tests/unit/missionGeneration.test.ts` 覆蓋摘要邊界、候選排序、輸出驗證、空收藏、單日快取、跨服務競態、DB 衝突、逾時、關閉與過期權限恢復、跨日、已開始／完成進度，以及生成中收藏變動。`tests/ai-missions-flow.cjs` 用攔截 Gemini 的瀏覽器測試檢查實際 request、兩分頁與 IndexedDB 快取、分類／理由、範例完成、失敗備援及手機／桌面版面。

完整檢查為 `npm run check` 與 `npm run test:e2e`。模擬回應測試不代表已驗證真實模型可用性或生成品質。

2026-11 更新：單元測試補上昨日排除、替換限制與競態、規則複數及描述前綴，以及跨年確定性；瀏覽器測試驗證兩分頁更換同步與重載。`tests/mission-transition.cjs` 驗證生成中操作停用、卡片翻面、減少動態與動畫暫停。
