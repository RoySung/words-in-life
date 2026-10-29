export type PhotoRef = { kind: 'stored'; photoId: string } | { kind: 'asset'; path: string };
export const photoKey = (ref?: PhotoRef): string | undefined => ref?.kind === 'stored' ? ref.photoId : undefined;
export function photoRefs(value: { photo?: PhotoRef; crop?: PhotoRef }): string[] {
  return [photoKey(value.photo), photoKey(value.crop)].filter((id): id is string => !!id);
}
