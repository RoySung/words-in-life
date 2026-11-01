import type { AnalysisResult, DetectedItem, SavedWord } from '../../types';
import type { LibraryStore } from '../../hooks/useLibrary';
import { wordKey, parseItem } from '../../domain/validation';
import { preparePhoto } from '../../repository/photos';
import { generateSticker } from '../../utils/stickerGenerator';
import { playSfx } from '../../utils/audio';

export function useCollection(words: SavedWord[], store: LibraryStore, analysis: AnalysisResult | null) {
  const toggleSave = async (item: DetectedItem) => {
    if (words.some(w => wordKey(w.word) === wordKey(item.word))) {
      await store.run(() => store.services.library.removeWord(item.id)); return;
    }
    const result = await store.run(async () => {
      const source = item.originalImageUrl || analysis?.imageUrl;
      const original = item.photo ? { ref: item.photo, photos: [] } : await preparePhoto(source);
      const cropped = item.crop ? { ref: item.crop, photos: [] } : await preparePhoto(item.stickerUrl || (source ? await generateSticker(source, item.boundingBox) : undefined));
      return store.services.library.saveWord({ ...parseItem(item)!, savedAt: Date.now(), sceneTitle: analysis?.sceneTitle,
        photo: original.ref, crop: cropped.ref }, [...original.photos, ...cropped.photos]);
    });
    if (result) playSfx('success');
  };
  return { toggleSave,
    removeWord: async (id: string) => { await store.run(() => store.services.library.removeWord(id)); },
    recordReview: async (id: string, remembered: boolean) => !!await store.run(() => store.services.library.recordReview(id, remembered)),
  };
}
