import { useEffect, useState } from 'react';
import type { DetectedItem } from '../types';
import type { PhotoUrls } from '../hooks/usePhotoUrl';
import { Polaroid } from '../design-system/components';
import { parseBoundingBox } from '../domain/validation';
import { createWordPhoto } from '../utils/wordShareSource';

/** Keep the saved thumbnail visible while rebuilding the same crop from the original. */
export function WordDetailPhoto({ item, photoUrls, sceneSource, sharing }: {
  item: DetectedItem; photoUrls?: PhotoUrls; sceneSource?: string; sharing: boolean;
}) {
  const [prepared, setPrepared] = useState<{
    item: DetectedItem; urls?: PhotoUrls; sceneSource?: string; source: string;
  }>();
  useEffect(() => {
    // Legacy records without bounds keep their existing crop; never guess a new framing.
    // Defer an upgrade during sharing so its animation keeps the same origin image node.
    if (sharing || !parseBoundingBox(item.boundingBox)) return;
    const controller = new AbortController();
    void createWordPhoto(item, photoUrls, sceneSource, controller.signal, 1200)
      .then(source => {
        if (!controller.signal.aborted) setPrepared({ item, urls: photoUrls, sceneSource, source });
      })
      .catch(() => { /* The existing photo fallback remains available. */ });
    return () => controller.abort();
  }, [item, photoUrls, sceneSource, sharing]);
  const source = prepared?.item === item && prepared.urls === photoUrls && prepared.sceneSource === sceneSource
    ? prepared.source : undefined;
  const thumbnailPhoto = item.crop || (item.stickerUrl ? undefined : item.photo);
  return <Polaroid photo={source ? undefined : thumbnailPhoto} urls={photoUrls}
    src={source || item.stickerUrl} fallbackPhoto={source ? item.crop || item.photo : item.photo}
    fallbackSrc={source ? item.stickerUrl || sceneSource : sceneSource}
    alt={item.chinese} taped className="detail-polaroid" />;
}
