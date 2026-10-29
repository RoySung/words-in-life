import { parseItem, wordId } from '../domain/validation';
import { reviewWord } from '../domain/reviews';
import type { Word } from '../domain/vocabulary';
import { AppError, type PreparedPhoto } from '../repository/LibraryRepository';
import type { Dependencies, Execute } from './library';
export function collectionUsecases(execute: Execute, deps: Dependencies) {
  return {
    saveWord: async (input: Word, photos: PreparedPhoto[] = [], commandId = deps.createId()) => {
      const parsed = parseItem(input);
      if (!parsed) throw new AppError('InvalidData');
      const word: Word = { ...parsed, photo: input.photo, crop: input.crop, photoCropVersion: 1, sceneTitle: input.sceneTitle, savedAt: input.savedAt };
      return execute(commandId, photos, state => ({ changes: state.words.some(w => w.id === word.id) ? {} : { putWords: [word] }, result: { kind: 'saved', wordId: word.id } }));
    },
    removeWord: (id: string, commandId = deps.createId()) => execute(commandId, [], state => ({
      changes: state.words.some(w => w.id === id) ? { removeWords: [id] } : {}, result: { kind: 'removed', wordId: id },
    })),
    recordReview: (id: string, remembered: boolean, commandId = deps.createId()) => {
      const now = deps.now();
      return execute(commandId, [], state => {
        const word = state.words.find(w => w.id === id);
        if (!word) throw new AppError('NotFound');
        return { changes: { putWords: [reviewWord(word, remembered, now)] }, result: { kind: 'reviewed', wordId: id } };
      });
    },
  };
}
