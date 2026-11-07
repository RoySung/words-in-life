import { SHARE_ROTATION, wordShareFrames } from './wordShareLayout';

const fullCardClip = 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Map the card's photo to its source while moving the whole print together. */
function sourceTransform(preview: HTMLImageElement, origin: HTMLImageElement) {
  const bounds = preview.getBoundingClientRect();
  const { photo } = wordShareFrames(preview);
  const source = origin.getBoundingClientRect();
  // BoundingClientRect includes the parent's tilt; scaling by that width
  // would enlarge the returning photo a second time.
  const scale = (parseFloat(getComputedStyle(origin).width) || origin.offsetWidth) / photo.width;
  const x = source.left + source.width / 2 - (bounds.left + bounds.width / 2 + (photo.left + photo.width / 2 - bounds.left - bounds.width / 2) * scale);
  const y = source.top + source.height / 2 - (bounds.top + bounds.height / 2 + (photo.top + photo.height / 2 - bounds.top - bounds.height / 2) * scale);
  return { x, y, scale };
}
const transform = (x: number, y: number, scale: number, rotation = 0) => `translate(${x}px, ${y}px) scale(${scale}) rotate(${rotation}deg)`;

/** Photo-height edge shared by unfolding and retracting the tilted print. */
function photoHeightClip(preview: HTMLImageElement) {
  const bounds = preview.getBoundingClientRect();
  const { photo } = wordShareFrames(preview);
  const angle = SHARE_ROTATION * Math.PI / 180;
  const bottomX = photo.left + photo.width / 2 - Math.sin(angle) * photo.height / 2;
  const bottomY = photo.top + photo.height / 2 + Math.cos(angle) * photo.height / 2;
  const edge = (x: number) => (bottomY + Math.tan(angle) * (x - bottomX) - bounds.top) / bounds.height * 100;
  return `polygon(0% 0%, 100% 0%, 100% ${edge(bounds.right)}%, 0% ${edge(bounds.left)}%)`;
}

function flightCard(dialog: HTMLDialogElement, preview: HTMLImageElement) {
  const card = preview.cloneNode() as HTMLImageElement;
  card.removeAttribute('style'); card.removeAttribute('class'); card.removeAttribute('id');
  card.className = 'word-share-flight-photo'; card.alt = ''; card.setAttribute('aria-hidden', 'true');
  const bounds = preview.getBoundingClientRect();
  Object.assign(card.style, { left: `${bounds.left}px`, top: `${bounds.top}px`, width: `${bounds.width}px`, height: `${bounds.height}px` });
  dialog.append(card);
  return card;
}
/** Keep the original blank frame beneath the retracting caption. */
function returnPaper(dialog: HTMLDialogElement, preview: HTMLImageElement, source: HTMLElement, scale: number) {
  const bounds = preview.getBoundingClientRect();
  const { photo } = wordShareFrames(preview);
  const style = getComputedStyle(source);
  const padding = (value: string) => (parseFloat(value) || 0) / scale;
  const left = -photo.width / 2 - padding(style.paddingLeft);
  const right = photo.width / 2 + padding(style.paddingRight);
  const top = -photo.height / 2 - padding(style.paddingTop);
  const bottom = photo.height / 2 + padding(style.paddingBottom);
  const angle = SHARE_ROTATION * Math.PI / 180;
  const points = [[left, top], [right, top], [right, bottom], [left, bottom]].map(([x, y]) => {
    const px = photo.left + photo.width / 2 + x * Math.cos(angle) - y * Math.sin(angle);
    const py = photo.top + photo.height / 2 + x * Math.sin(angle) + y * Math.cos(angle);
    return `${(px - bounds.left) / bounds.width * 100}% ${(py - bounds.top) / bounds.height * 100}%`;
  });
  const paper = document.createElement('div');
  paper.className = 'word-share-flight-paper'; paper.setAttribute('aria-hidden', 'true');
  Object.assign(paper.style, {
    left: `${bounds.left}px`, top: `${bounds.top}px`, width: `${bounds.width}px`, height: `${bounds.height}px`,
    backgroundColor: style.backgroundColor, clipPath: `polygon(${points.join(', ')})`,
  });
  dialog.append(paper);
  return paper;
}

function hideSource(origin: HTMLImageElement) {
  const paper = origin.closest<HTMLElement>('.detail-polaroid');
  const visibility = origin.style.visibility;
  const paperVisibility = paper?.style.visibility ?? '';
  origin.style.visibility = 'hidden';
  if (paper) paper.style.visibility = 'hidden';
  return () => { origin.style.visibility = visibility; if (paper) paper.style.visibility = paperVisibility; };
}

export function openWordShare(dialog: HTMLDialogElement, preview: HTMLImageElement, origin?: HTMLImageElement | null) {
  const animations: Animation[] = [];
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let card: HTMLImageElement | undefined;
  let restoreSource: (() => void) | undefined;
  let disposed = false;
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    window.removeEventListener('resize', cleanup);
    motionPreference.removeEventListener('change', cleanup);
    animations.forEach(animation => animation.cancel());
    card?.remove(); restoreSource?.();
    dialog.classList.remove('is-preparing', 'is-morphing');
    preview.style.visibility = '';
  };
  if (reducedMotion() || !origin?.complete || !origin.naturalWidth) { cleanup(); return cleanup; }
  const from = origin.getBoundingClientRect();
  if (!from.width || !from.height || from.bottom < 0 || from.top > window.innerHeight) { cleanup(); return cleanup; }
  const start = sourceTransform(preview, origin);
  card = flightCard(dialog, preview);
  restoreSource = hideSource(origin);
  preview.style.visibility = 'hidden';
  dialog.classList.remove('is-preparing'); dialog.classList.add('is-morphing');
  const animate = (element: Element, frames: Keyframe[], duration: number, delay = 0) => {
    const animation = element.animate(frames, { duration, delay, easing: 'linear', fill: 'both' });
    animations.push(animation); return animation;
  };
  // Sample one continuous curve instead of restarting an ease at each stop.
  // Translation, depth and tilt share the same clock, including a gentle,
  // zero-velocity scale reversal and a zero-velocity arrival.
  const frames: Keyframe[] = Array.from({ length: 61 }, (_, index) => {
    const t = index / 60;
    const arrival = 1 - (1 - t) ** 3;
    const lift = Math.sin(Math.PI * t) ** 2;
    return {
      offset: t,
      transform: transform(
        start.x * (1 - arrival),
        start.y * (1 - arrival) - 10 * lift,
        start.scale + (1 - start.scale) * arrival + .08 * lift,
        .6 * lift,
      ),
    };
  });
  // Keep the terminal transform exact for the handoff to the static preview.
  frames[frames.length - 1] = { offset: 1, transform: transform(0, 0, 1) };
  const travel = animate(card, frames, 580);
  const photoClip = photoHeightClip(preview);
  // Lift the short print first, then unfold the caption as it moves onto the desk.
  animate(card, [
    { clipPath: photoClip, offset: 0 },
    { clipPath: photoClip, offset: .1, easing: 'cubic-bezier(.4,0,.2,1)' },
    { clipPath: fullCardClip, offset: .9 },
    { clipPath: fullCardClip, offset: 1 },
  ], 580);
  for (const element of dialog.querySelectorAll('header, footer')) {
    animate(element, [{ opacity: 0 }, { opacity: 1 }], 190, 390);
  }
  window.addEventListener('resize', cleanup, { once: true });
  motionPreference.addEventListener('change', cleanup, { once: true });
  void travel.finished.then(cleanup).catch(() => {});
  return cleanup;
}

export async function closeWordShare(dialog: HTMLDialogElement, origin?: HTMLImageElement | null, stopOpening?: () => void) {
  if (!dialog.open) return;
  // Read the visible frame before disposing the opening animation. Restarting
  // from the settled preview would jump when the user closes during the lift.
  const openingCard = dialog.querySelector<HTMLImageElement>('.word-share-flight-photo');
  const startTransform = openingCard ? getComputedStyle(openingCard).transform : transform(0, 0, 1);
  const startClip = openingCard ? getComputedStyle(openingCard).clipPath : fullCardClip;
  const deskOpacity = getComputedStyle(dialog, '::before').opacity;
  stopOpening?.();
  if (reducedMotion()) { dialog.close(); return; }
  const preview = dialog.querySelector<HTMLImageElement>('.word-share-preview');
  const bounds = origin?.getBoundingClientRect();
  if (!preview || !origin?.complete || !origin.naturalWidth || !bounds?.width || bounds.bottom < 0 || bounds.top > window.innerHeight) {
    const fade = dialog.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
    try { await fade.finished; } catch { /* Unmount may cancel the animation. */ }
    finally { dialog.close(); fade.cancel(); }
    return;
  }
  const end = sourceTransform(preview, origin);
  const card = flightCard(dialog, preview);
  const sourcePaper = origin.closest<HTMLElement>('.detail-polaroid') ?? origin;
  const paper = returnPaper(dialog, preview, sourcePaper, end.scale);
  const previousVisibility = preview.style.visibility;
  preview.style.visibility = 'hidden';
  dialog.style.setProperty('--word-share-return-opacity', deskOpacity);
  dialog.classList.add('is-returning');
  const animations: Animation[] = [];
  const duration = 400;
  const animate = (element: Element, frames: Keyframe[], time: number, easing = 'linear') => {
    const animation = element.animate(frames, { duration: time, easing, fill: 'both' });
    animations.push(animation); return animation;
  };
  for (const element of dialog.querySelectorAll('header, footer, .word-share-error')) {
    animate(element, [{ opacity: 1 }, { opacity: 0 }], 100);
  }
  // Retract the caption while retaining the original blank bottom border.
  // Its height must already match the detail print before the final crossfade.
  animate(card, [
    { clipPath: startClip },
    { clipPath: photoHeightClip(preview) },
  ], duration * .82, 'cubic-bezier(.4,0,.2,1)');
  animate(paper, [{ opacity: openingCard ? 0 : 1 }, { opacity: 1, offset: .4 }, { opacity: 1, offset: .82 }, { opacity: 0 }], duration);
  animate(sourcePaper, [{ opacity: 0 }, { opacity: 0, offset: .82 }, { opacity: 1 }], duration);
  animate(card, [{ opacity: 1 }, { opacity: 1, offset: .82 }, { opacity: 0 }], duration);
  const returnFrames = [
    { transform: startTransform },
    { transform: transform(end.x, end.y, end.scale) },
  ];
  animate(paper, returnFrames, duration, 'cubic-bezier(.4,0,.2,1)');
  const travel = animate(card, returnFrames, duration, 'cubic-bezier(.4,0,.2,1)');
  const finish = () => animations.forEach(animation => animation.finish());
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  window.addEventListener('resize', finish, { once: true });
  motionPreference.addEventListener('change', finish, { once: true });
  try { await travel.finished; } catch { /* Unmount may cancel the animation. */ }
  finally {
    // Close the top layer before restoring the source or cancelling fill effects.
    dialog.close(); card.remove(); paper.remove();
    preview.style.visibility = previousVisibility;
    dialog.style.removeProperty('--word-share-return-opacity');
    animations.forEach(animation => animation.cancel());
    window.removeEventListener('resize', finish);
    motionPreference.removeEventListener('change', finish);
    dialog.classList.remove('is-returning');
  }
}
