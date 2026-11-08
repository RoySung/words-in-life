import type { DetectedItem } from '../types';
import { SHARE_CARD_SCALE, SHARE_DESK_MARGIN, SHARE_ROTATION, SHARE_PHOTO_SIZE } from './wordShareLayout';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('分享素材載入失敗'));
    image.src = src;
  });
}

/** Render once; preview, download and native sharing all use the same PNG. */
export async function createWordShareImage(item: DetectedItem, photo: HTMLImageElement, referencePaper?: HTMLElement | null): Promise<{ image: Blob; preview: Blob }> {
  const [logo, wood, grain] = await Promise.all([loadImage('/icons/logo.png'), loadImage('/design-system/share-wood.png'), loadImage('/design-system/paper-grain.png'), document.fonts.ready]);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('無法產生圖片');
  const theme = getComputedStyle(photo);
  const token = (name: string, fallback: string) => theme.getPropertyValue(name).trim() || fallback;
  const bodyFont = token('--vs-font-body', 'sans-serif');
  const latinFont = token('--vs-font-latin', 'sans-serif');
  const noteFont = token('--vs-font-note', bodyFont);
  const textColor = token('--vs-text', '#302820');
  const mutedColor = token('--vs-muted', '#756453');
  // Canvas fonts must be loaded explicitly even when the page has not used them yet.
  await Promise.all([document.fonts.load(`600 104px ${latinFont}`), document.fonts.load(`400 40px ${bodyFont}`), document.fonts.load(`400 36px ${noteFont}`)]);
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
  ctx.font = `36px ${noteFont}`;
  const example = wrap(item.exampleEn);
  ctx.font = `40px ${bodyFont}`;
  const translation = wrap(`${item.chinese}  ${item.partOfSpeech}`);
  canvas.width = width;
  canvas.height = 1420 + example.length * 52 + translation.length * 56;
  ctx.fillStyle = token('--vs-paper', '#fff9ef'); ctx.fillRect(0, 0, width, canvas.height);
  const paperGrain = ctx.createPattern(grain, 'repeat');
  if (paperGrain) { ctx.fillStyle = paperGrain; ctx.fillRect(0, 0, width, canvas.height); }
  const size = SHARE_PHOTO_SIZE;
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
  y += 72; ctx.font = `36px ${noteFont}`;
  for (const line of example) { ctx.fillText(line, width / 2, y); y += 52; }
  // Small brand signature: logo and English app name only.
  const brandY = canvas.height - 64;
  ctx.font = `24px ${latinFont}`; ctx.fillStyle = mutedColor;
  const brandWidth = 32 + 12 + ctx.measureText('Words in Life').width;
  const left = (width - brandWidth) / 2;
  ctx.drawImage(logo, left, brandY - 25, 32, 32);
  ctx.textAlign = 'left'; ctx.fillText('Words in Life', left + 44, brandY);
  const output = document.createElement('canvas');
  output.width = width;
  output.height = Math.ceil(canvas.height * SHARE_CARD_SCALE + SHARE_DESK_MARGIN * 2);
  const desk = output.getContext('2d');
  if (!desk) throw new Error('無法產生圖片');
  desk.save();
  desk.translate(width / 2, output.height / 2);
  desk.rotate(SHARE_ROTATION * Math.PI / 180);
  desk.scale(SHARE_CARD_SCALE, SHARE_CARD_SCALE);
  desk.shadowColor = '#49311c30'; desk.shadowBlur = 28; desk.shadowOffsetY = 14;
  desk.fillStyle = token('--vs-paper', '#fff9ef');
  desk.beginPath(); desk.roundRect(-width / 2, -canvas.height / 2, width, canvas.height, 5); desk.fill();
  desk.shadowColor = 'transparent';
  desk.save(); desk.clip(); desk.drawImage(canvas, -width / 2, -canvas.height / 2); desk.restore();
  // Use the notebook's actual pseudo-element as the tape's visual authority.
  // A hidden reference keeps exports consistent when the source photo is absent.
  const tapePaper = referencePaper ?? document.createElement('figure');
  if (!referencePaper) {
    tapePaper.className = 'vs-polaroid vs-polaroid--taped';
    Object.assign(tapePaper.style, { position: 'absolute', width: '220px', visibility: 'hidden' });
    photo.parentElement?.append(tapePaper);
  }
  const tape = getComputedStyle(tapePaper, '::before');
  const paperWidth = parseFloat(getComputedStyle(tapePaper).width);
  const tapeScale = width / paperWidth;
  const tapeWidth = parseFloat(tape.width) * tapeScale;
  const tapeHeight = parseFloat(tape.height) * tapeScale;
  const tapeLeft = parseFloat(tape.left) * tapeScale;
  const tapeTop = parseFloat(tape.top) * tapeScale;
  const tapeColor = tape.backgroundColor;
  const tapeTransform = new DOMMatrix(tape.transform);
  const tapeAngle = Math.atan2(tapeTransform.b, tapeTransform.a);
  const tapePoints = tape.clipPath.slice('polygon('.length, -1).split(',').map(point => point.trim().split(/\s+/).map(parseFloat));
  if (!referencePaper) tapePaper.remove();
  desk.translate(-width / 2 + tapeLeft + tapeWidth / 2, -canvas.height / 2 + tapeTop + tapeHeight / 2);
  desk.rotate(tapeAngle);
  desk.fillStyle = tapeColor; desk.beginPath();
  tapePoints.forEach(([x, y], index) => {
    const px = (x / 100 - .5) * tapeWidth;
    const py = (y / 100 - .5) * tapeHeight;
    if (index === 0) desk.moveTo(px, py); else desk.lineTo(px, py);
  });
  desk.closePath(); desk.fill(); desk.restore();
  const toBlob = () => new Promise<Blob>((resolve, reject) => output.toBlob(blob => blob ? resolve(blob) : reject(new Error('圖片產生失敗')), 'image/png'));
  // The screen floats the same card over a full-viewport desk. The saved image
  // keeps its opaque wood background, without including any interface controls.
  const preview = await toBlob();
  desk.globalCompositeOperation = 'destination-over';
  // Cover the export with a local wood texture; the user's photo is never regenerated.
  const woodScale = Math.max(output.width / wood.naturalWidth, output.height / wood.naturalHeight);
  desk.drawImage(wood, (width - wood.naturalWidth * woodScale) / 2, (output.height - wood.naturalHeight * woodScale) / 2, wood.naturalWidth * woodScale, wood.naturalHeight * woodScale);
  const image = await toBlob();
  return { image, preview };
}

export function downloadWordImage(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url; link.download = file.name;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
