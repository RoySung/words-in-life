/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FailureReasonCode, RecognitionFailureInfo } from '../types';

export interface FailureScenarioDemo {
  id: string;
  name: string;
  category: string;
  badge: string;
  description: string;
  imageUrl: string;
  failureInfo: RecognitionFailureInfo;
}

// Low-light / pitch dark room demo image (SVG base64)
const DARK_PHOTO_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450" viewBox="0 0 600 450"><rect width="600" height="450" fill="%23121110"/><circle cx="300" cy="225" r="180" fill="%231a1816"/><path d="M220 320 L240 280 L360 280 L380 320 Z" fill="%2322201d"/><rect x="270" y="220" width="60" height="60" rx="6" fill="%23262320"/><text x="300" y="400" text-anchor="middle" fill="%234a4540" font-size="14" font-family="sans-serif">【光線不足】暗室環境弱光拍照</text></svg>`;

// Extremely blurry motion shake photo (SVG base64)
const BLURRY_PHOTO_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450" viewBox="0 0 600 450"><defs><filter id="blur"><feGaussianBlur stdDeviation="14"/></filter><linearGradient id="grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%25" stop-color="%23d6c7b2"/><stop offset="50%25" stop-color="%239a8c78"/><stop offset="100%25" stop-color="%23c2b09a"/></linearGradient></defs><rect width="600" height="450" fill="url(%23grad)" filter="url(%23blur)"/><ellipse cx="280" cy="210" rx="140" ry="90" fill="%237a6b57" opacity="0.6" filter="url(%23blur)" transform="rotate(-15 280 210)"/><ellipse cx="340" cy="230" rx="110" ry="80" fill="%23baaa95" opacity="0.7" filter="url(%23blur)" transform="rotate(20 340 230)"/><text x="300" y="410" text-anchor="middle" fill="%23ffffff" font-size="14" font-weight="bold" font-family="sans-serif">【鏡頭晃動】快門手震模糊範例</text></svg>`;

// Blank wall / pure texture with no identifiable objects (SVG base64)
const BLANK_WALL_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450" viewBox="0 0 600 450"><rect width="600" height="450" fill="%23eae7e1"/><line x1="0" y1="280" x2="600" y2="280" stroke="%23ded9cf" stroke-width="3"/><rect x="0" y="280" width="600" height="170" fill="%23e2ded6"/><text x="300" y="200" text-anchor="middle" fill="%239e968a" font-size="16" font-family="sans-serif">純色白牆與木紋地板</text><text x="300" y="235" text-anchor="middle" fill="%23b8b1a5" font-size="13" font-family="sans-serif">(未拍攝到任何明確的學習物品)</text></svg>`;

export const FAILURE_SCENARIO_DEMOS: FailureScenarioDemo[] = [
  {
    id: 'demo_dark',
    name: '光線過暗 / 曝光不足',
    category: '環境光線問題',
    badge: '🌑 光線不足',
    description: '在夜間或沒有開燈的室內拍攝，主體輪廓被陰影遮蔽無法辨識。',
    imageUrl: DARK_PHOTO_SVG,
    failureInfo: {
      reasonCode: 'BLURRY_OR_DARK',
      title: '照片光線過於昏暗，難以辨識物品',
      description: 'AI 仔細觀察後發現畫面曝光嚴重不足，物品邊緣細節皆落在暗部陰影中。',
      photoUrl: DARK_PHOTO_SVG,
      suggestions: [
        '💡 請打開室內頂燈或檯燈，為拍攝區域提供充足照明',
        '☀️ 盡量靠近窗邊自然光，避免強烈的背光陰影',
        '🔦 若在戶外夜間，可開啟手機相機的手電筒輔助補光',
      ],
    },
  },
  {
    id: 'demo_blurry',
    name: '手震晃動 / 焦點模糊',
    category: '相機操作問題',
    badge: '🌫️ 鏡頭模糊',
    description: '按下快門瞬間手機晃動，或是距離太近導致鏡頭無法對焦。',
    imageUrl: BLURRY_PHOTO_SVG,
    failureInfo: {
      reasonCode: 'BLURRY_OR_DARK',
      title: '畫面晃動模糊，未能鎖定物體焦點',
      description: '照片出現明顯運動模糊或脫焦現象，AI 無法精準勾勒出物品的輪廓特徵。',
      photoUrl: BLURRY_PHOTO_SVG,
      suggestions: [
        '📸 拍攝時雙手持機保持穩定，按下快門後停頓半秒再移動',
        '🎯 輕觸螢幕中央的主體物品進行主動對焦',
        '📏 與物品保持 30 至 60 公分的最佳拍攝距離，避免貼太近模糊',
      ],
    },
  },
  {
    id: 'demo_empty',
    name: '純色背景 / 無具體主體',
    category: '拍攝內容問題',
    badge: '🧱 未發現物品',
    description: '只拍到了大面積的白牆、地板或天花板，沒有任何生活物品。',
    imageUrl: BLANK_WALL_SVG,
    failureInfo: {
      reasonCode: 'NO_ITEMS_FOUND',
      title: '未在照片中發現明確的生活物品',
      description: '畫面中僅有純色背景或建材紋理，缺少可以用來學習實用英文單字的日常主體。',
      photoUrl: BLANK_WALL_SVG,
      suggestions: [
        '☕ 將相機對準具體的日常物品（如杯子、電腦、鞋子、背包等）',
        '📐 讓想要學習的物品佔據畫面 1/3 以上，比例更清晰',
        '🪴 也可嘗試拍攝豐富的生活角落（如咖啡店、書桌、超市貨架）',
      ],
    },
  },
];
