// One active project is kept in IndexedDB under a fixed key, so File/Blob values are stored directly.
const DB_NAME = 'projectStore';
const STORE_NAME = 'project';
const RECORD_KEY = 'current';

let dbPromise = null;

function openDb() {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = () => {
                request.result.createObjectStore(STORE_NAME);
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => {
                dbPromise = null;
                reject(request.error);
            };
        });
    }
    return dbPromise;
}

function finish(tx) {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

// Reads the current record, merges `partial` into it and writes it back in one transaction.
export async function saveProject(partial) {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get(RECORD_KEY);

    getRequest.onsuccess = () => {
        store.put({ ...(getRequest.result ?? {}), ...partial }, RECORD_KEY);
    };
    return finish(tx);
}

export async function loadProject() {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const getRequest = tx.objectStore(STORE_NAME).get(RECORD_KEY);
    await finish(tx);
    return getRequest.result ?? null;
}

export async function clearProject() {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(RECORD_KEY);
    return finish(tx);
}
