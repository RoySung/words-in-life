# AI 個人化每日任務

## 行為

開啟「今日尋寶」時，依本機日期、月份、時區與現存單字摘要，由 Gemini 生成三項可拍照尋找的生活物件任務。有收藏時為一項複習、兩項新字；空收藏時為三項新字。複習候選優先考量尚未複習、記住比例偏低及久未複習。日期與月份提供時節參考；時區不能當成所在地、天氣或節日參與的證據。

生成包含英文、繁中、IPA、名詞詞性、圖示、尋找提示、同一物件的別名、複習／新探索分類與選題理由。畫面沿用現有任務清單，提供生成中與備援狀態，顯示分類與理由。生成中停用目標選取，範例體驗仍可使用。

## 邊界與檔案

- `domain/missionGeneration.ts`：建立有大小上限的摘要、驗證回應結構、三項目標與別名不重疊、一項複習／兩項新字規則。
- `repository/MissionGenerationRepository.ts`：獨立的文字任務生成能力契約。
- `repository/gemini/missionRequest.ts`：實際 system prompt、JSON schema 與資料訊息；單字資料不得作為指令。
- `repository/gemini/missionRepository.ts`：Gemini 回應解碼與基本驗證。
- `repository/gemini/client.ts`：辨識與任務共用 SDK 呼叫、HTTP 錯誤轉換、404 模型 fallback 與最多一次暫時性錯誤重試。
- `usecases/missionGeneration.ts`：讀取圖庫、搶占當日生成權、25 秒期限、驗證與保存，避免 AI 呼叫落入 DB 衝突重試。
- `features/missions/useDailyMissions.ts`：任務畫面開啟時呼叫生成流程；每 15 秒與回到前景檢查日期及過期生成權。

`createServices.ts` 注入所有實作。沒有 key 時不載入 SDK。任務文字請求沒有照片，最多提供 500 個已知單字名稱與 30 個候選的英文、中文、複習次數、記住次數、比例與最後複習時間。候選排序與大小上限由 Domain 決定，新增字是否已知會再依完整本機單字簿驗證。設定頁說明資料用途。

## 保存與競態

沿用 IndexedDB v1 的 `learning/current`，加入可選的 `generation` 欄位，無新 store，既有紀錄不需升級或清除。

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
