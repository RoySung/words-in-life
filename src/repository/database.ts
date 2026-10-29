export const DATABASE_NAME = 'words-in-life-storage';
export const STORES = ['words', 'learning', 'photos', 'photoMetadata', 'operations', 'meta'] as const;
export const request = <T>(req: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
});
export const completed = (tx: IDBTransaction): Promise<void> => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error || new Error('Transaction aborted')); // Wait for abort: WebKit may expose tx.error as null while request errors bubble.
});
export function openDatabase(factory: IDBFactory, name = DATABASE_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(name, 1);
    let blocked = false;
    req.onupgradeneeded = () => { for (const store of STORES) req.result.createObjectStore(store); };
    req.onsuccess = () => { if (blocked) req.result.close(); else resolve(req.result); };
    req.onerror = () => reject(req.error);
    req.onblocked = () => { blocked = true; reject(new Error('Database blocked')); };
  });
}
