const DB_NAME = "watermark-remover";
const DB_VERSION = 1;
const STORE_NAME = "files";

interface StoredFile {
  id: string;
  data: ArrayBuffer;
  filename: string;
  timestamp: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

export async function storeFile(file: File): Promise<string> {
  const db = await openDB();
  const id = "current-pdf";
  const arrayBuffer = await file.arrayBuffer();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const data: StoredFile = {
      id,
      data: arrayBuffer,
      filename: file.name,
      timestamp: Date.now(),
    };

    const request = store.put(data);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(id);

    transaction.oncomplete = () => db.close();
  });
}

export async function getFile(): Promise<{ data: ArrayBuffer; filename: string } | null> {
  const db = await openDB();
  const id = "current-pdf";

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const result = request.result as StoredFile | undefined;
      if (result) {
        resolve({ data: result.data, filename: result.filename });
      } else {
        resolve(null);
      }
    };

    transaction.oncomplete = () => db.close();
  });
}

export async function clearFile(): Promise<void> {
  const db = await openDB();
  const id = "current-pdf";

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();

    transaction.oncomplete = () => db.close();
  });
}
