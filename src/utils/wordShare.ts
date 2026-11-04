import type { DetectedItem } from '../types';

function loadLogo(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Logo 載入失敗'));
    image.src = '/icons/logo.png';
  });
}

/** Render once; preview, download and native sharing all use the same PNG. */
export async function createWordShareImage(item: DetectedItem, photo: HTMLImageElement): Promise<Blob> {
  const [logo] = await Promise.all([loadLogo(), document.fonts.ready]);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('無法產生圖片');
  const theme = getComputedStyle(photo);
  const token = (name: string, fallback: string) => theme.getPropertyValue(name).trim() || fallback;
  const bodyFont = token('--vs-font-body', 'sans-serif');
  const latinFont = token('--vs-font-latin', 'sans-serif');
  const textColor = token('--vs-text', '#302820');
  const mutedColor = token('--vs-muted', '#756453');
  // Canvas fonts must be loaded explicitly even when the page has not used them yet.
  await Promise.all([document.fonts.load(`600 104px ${latinFont}`), document.fonts.load(`400 40px ${bodyFont}`)]);
  const width = 1080;
  const textWidth = 920;
  const wrap = (text: string): string[] => {
    const lines: string[] = [];
    let line = '';
    for (const character of text) {
      if (character === '\n' || (line && ctx.measureText(line + character).width > textWidth)) {
        lines.push(line.trim()); line = '';
      }
      if (character !== '\n') line += character;
    }
    if (line) lines.push(line.trim());
    return lines;
  };
  ctx.font = `36px ${bodyFont}`;
  const example = wrap(item.exampleEn);
  ctx.font = `40px ${bodyFont}`;
  const translation = wrap(`${item.chinese}  ${item.partOfSpeech}`);
  canvas.width = width;
  canvas.height = 1420 + example.length * 52 + translation.length * 56;
  ctx.fillStyle = token('--vs-paper', '#fff9ef'); ctx.fillRect(0, 0, width, canvas.height);
  const size = 968;
  const scale = Math.max(size / photo.naturalWidth, size / photo.naturalHeight);
  ctx.save(); ctx.beginPath(); ctx.rect(56, 56, size, size); ctx.clip();
  ctx.drawImage(photo, 56 + (size - photo.naturalWidth * scale) / 2, 56 + (size - photo.naturalHeight * scale) / 2, photo.naturalWidth * scale, photo.naturalHeight * scale);
  ctx.restore();
  ctx.textAlign = 'center'; ctx.fillStyle = textColor;
  let fontSize = 104;
  do { ctx.font = `600 ${fontSize}px ${latinFont}`; fontSize -= 2; } while (ctx.measureText(item.word).width > textWidth && fontSize > 24);
  ctx.fillText(item.word, width / 2, 1152, textWidth);
  ctx.font = `36px ${bodyFont}`; ctx.fillStyle = mutedColor;
  ctx.fillText(item.phonetic, width / 2, 1212, textWidth);
  ctx.font = `40px ${bodyFont}`; ctx.fillStyle = textColor;
  let y = 1284;
  for (const line of translation) { ctx.fillText(line, width / 2, y); y += 56; }
  ctx.strokeStyle = token('--vs-border', '#d8c8b1'); ctx.beginPath(); ctx.moveTo(80, y); ctx.lineTo(1000, y); ctx.stroke();
  y += 72; ctx.font = `36px ${bodyFont}`;
  for (const line of example) { ctx.fillText(line, width / 2, y); y += 52; }
  // Small brand signature: logo and English app name only.
  const brandY = canvas.height - 64;
  ctx.font = `24px ${latinFont}`; ctx.fillStyle = mutedColor;
  const brandWidth = 32 + 12 + ctx.measureText('Words in Life').width;
  const left = (width - brandWidth) / 2;
  ctx.drawImage(logo, left, brandY - 25, 32, 32);
  ctx.textAlign = 'left'; ctx.fillText('Words in Life', left + 44, brandY);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('圖片產生失敗')), 'image/png'));
}

export function downloadWordImage(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url; link.download = file.name;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
