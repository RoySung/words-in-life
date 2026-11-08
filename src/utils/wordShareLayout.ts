/** Shared export geometry keeps the photo flight aligned with the rendered PNG. */
export const SHARE_CARD_SCALE = .76;
export const SHARE_DESK_MARGIN = 140;
export const SHARE_ROTATION = -3;
export const SHARE_PHOTO_SIZE = 968;

export function wordShareFrames(preview: HTMLImageElement) {
  const bounds = preview.getBoundingClientRect();
  const scale = bounds.width / 1080;
  const cardHeight = preview.naturalHeight - SHARE_DESK_MARGIN * 2;
  const angle = SHARE_ROTATION * Math.PI / 180;
  const rect = (x: number, y: number, width: number, height: number) => {
    const centerX = bounds.left + bounds.width / 2 + (x * Math.cos(angle) - y * Math.sin(angle)) * scale;
    const centerY = bounds.top + bounds.height / 2 + (x * Math.sin(angle) + y * Math.cos(angle)) * scale;
    return { left: centerX - width * scale / 2, top: centerY - height * scale / 2, width: width * scale, height: height * scale };
  };
  return {
    paper: rect(0, 0, 1080 * SHARE_CARD_SCALE, cardHeight),
    photo: rect(0, -cardHeight / 2 + 540 * SHARE_CARD_SCALE, SHARE_PHOTO_SIZE * SHARE_CARD_SCALE, SHARE_PHOTO_SIZE * SHARE_CARD_SCALE),
  };
}
