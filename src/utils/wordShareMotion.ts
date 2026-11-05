const ease = 'cubic-bezier(.22,.7,.2,1)';
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const frame = (rect: { left: number; top: number; width: number; height: number }) => ({
  left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`,
});

/** Fixed layers live inside the top-layer dialog, above its delayed background. */
export function openWordShare(dialog: HTMLDialogElement, preview: HTMLImageElement, origin?: HTMLImageElement | null) {
  const animations: Animation[] = [];
  const layers: HTMLElement[] = [];
  const previousVisibility = origin?.style.visibility ?? '';
  let disposed = false;
  const cleanup = () => {
    disposed = true;
    animations.forEach(animation => animation.cancel());
    layers.forEach(layer => layer.remove());
    if (origin) origin.style.visibility = previousVisibility;
    dialog.classList.remove('is-preparing', 'is-morphing');
    preview.style.visibility = '';
  };
  if (reducedMotion() || !origin?.complete || !origin.naturalWidth) { cleanup(); return cleanup; }
  const from = origin.getBoundingClientRect();
  if (!from.width || !from.height || from.bottom < 0 || from.top > window.innerHeight) { cleanup(); return cleanup; }
  const to = preview.getBoundingClientRect();
  const scale = to.width / 1080;
  const photoTo = { left: to.left + 56 * scale, top: to.top + 56 * scale, width: 968 * scale, height: 968 * scale };
  const paper = document.createElement('div');
  paper.className = 'word-share-flight-paper';
  const photo = origin.cloneNode() as HTMLImageElement;
  photo.removeAttribute('id'); photo.removeAttribute('class'); photo.removeAttribute('style');
  photo.className = 'word-share-flight-photo'; photo.alt = ''; photo.setAttribute('aria-hidden', 'true');
  paper.setAttribute('aria-hidden', 'true');
  dialog.append(paper, photo); layers.push(paper, photo);
  origin.style.visibility = 'hidden'; preview.style.visibility = 'hidden';
  dialog.classList.remove('is-preparing'); dialog.classList.add('is-morphing');
  const animate = (element: Element, frames: Keyframe[], duration: number, delay = 0) => {
    const animation = element.animate(frames, { duration, delay, easing: ease, fill: 'both' });
    animations.push(animation); return animation;
  };
  const paperFrom = { left: from.left - 10, top: from.top - 10, width: from.width + 20, height: from.height + 30 };
  const photoAnimation = animate(photo, [
    { ...frame(from), transform: 'rotate(-3deg)' },
    { ...frame({ ...from, top: from.top - 8 }), transform: 'rotate(-3deg)', offset: .18 },
    { ...frame(photoTo), transform: 'rotate(0)' },
  ], 520);
  animate(paper, [
    { ...frame(paperFrom), transform: 'rotate(-3deg)' },
    { ...frame({ ...paperFrom, top: paperFrom.top - 8 }), transform: 'rotate(-3deg)', offset: .18 },
    { ...frame(to), transform: 'rotate(0)' },
  ], 520);
  for (const element of dialog.querySelectorAll('header, .word-share-hint, footer')) {
    animate(element, [{ opacity: 0 }, { opacity: 1 }], 160, 360);
  }
  void photoAnimation.finished.then(() => { if (!disposed) cleanup(); }).catch(() => {});
  return cleanup;
}

export async function closeWordShare(dialog: HTMLDialogElement, origin?: HTMLImageElement | null) {
  if (!dialog.open) return;
  if (reducedMotion()) { dialog.close(); return; }
  const preview = dialog.querySelector<HTMLImageElement>('.word-share-preview');
  if (!preview || !origin?.complete || !origin.naturalWidth) {
    const fade = dialog.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
    try { await fade.finished; } catch { /* Unmount may cancel the animation. */ }
    finally { dialog.close(); fade.cancel(); }
    return;
  }
  const from = preview.getBoundingClientRect();
  const to = origin.getBoundingClientRect();
  const scale = from.width / 1080;
  const photoFrom = { left: from.left + 56 * scale, top: from.top + 56 * scale, width: 968 * scale, height: 968 * scale };
  const paper = document.createElement('div'); paper.className = 'word-share-flight-paper';
  const photo = origin.cloneNode() as HTMLImageElement;
  photo.removeAttribute('style'); photo.removeAttribute('class'); photo.removeAttribute('id');
  photo.className = 'word-share-flight-photo'; photo.alt = ''; photo.setAttribute('aria-hidden', 'true');
  paper.setAttribute('aria-hidden', 'true'); dialog.append(paper, photo);
  const previousVisibility = origin.style.visibility;
  origin.style.visibility = 'hidden';
  dialog.classList.add('is-returning');
  const animations: Animation[] = [];
  const animate = (element: Element, frames: Keyframe[], duration: number) => {
    const animation = element.animate(frames, { duration, easing: ease, fill: 'both' });
    animations.push(animation); return animation;
  };
  for (const element of dialog.querySelectorAll('header, .word-share-hint, footer, .word-share-preview, .word-share-error')) {
    animate(element, [{ opacity: 1 }, { opacity: 0 }], 140);
  }
  animate(paper, [{ ...frame(from), transform: 'rotate(0)' }, { ...frame({ left: to.left - 10, top: to.top - 10, width: to.width + 20, height: to.height + 30 }), transform: 'rotate(-3deg)' }], 280);
  const travel = animate(photo, [{ ...frame(photoFrom), transform: 'rotate(0)' }, { ...frame(to), transform: 'rotate(-3deg)' }], 280);
  try { await travel.finished; } catch { /* Unmount may cancel the animation. */ }
  finally {
    // Leave the top layer before cancelling fill effects. React may unmount
    // later; restoring opacity while still open would flash the entire card.
    dialog.close();
    origin.style.visibility = previousVisibility;
    paper.remove(); photo.remove(); animations.forEach(animation => animation.cancel());
  }
}
