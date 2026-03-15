/**
 * Vibe Cache — IndexedDB-powered offline storage for AI-generated content.
 * Caches summaries, study guides, core principles, and chat messages
 * so students can access them without internet.
 */

const DB_NAME = 'alphify-vibe-cache';
const DB_VERSION = 1;

interface VibeEntry {
  id: string;
  type: 'summary' | 'core_principles' | 'study_guide' | 'chat_message';
  conversationId?: string;
  fileId?: string;
  content: string;
  title: string;
  createdAt: string;
  synced: boolean;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('vibes')) {
        const store = db.createObjectStore('vibes', { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('conversationId', 'conversationId', { unique: false });
        store.createIndex('fileId', 'fileId', { unique: false });
        store.createIndex('synced', 'synced', { unique: false });
      }
      if (!db.objectStoreNames.contains('chatMessages')) {
        const msgStore = db.createObjectStore('chatMessages', { keyPath: 'id' });
        msgStore.createIndex('conversationId', 'conversationId', { unique: false });
      }
    };
  });
}

export async function cacheVibe(entry: VibeEntry): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction('vibes', 'readwrite');
    tx.objectStore('vibes').put(entry);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('Failed to cache vibe:', e);
  }
}

export async function getCachedVibes(type?: string): Promise<VibeEntry[]> {
  try {
    const db = await openDB();
    const tx = db.transaction('vibes', 'readonly');
    const store = tx.objectStore('vibes');

    return new Promise((resolve, reject) => {
      const request = type
        ? store.index('type').getAll(type)
        : store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

export async function getCachedVibesByFile(fileId: string): Promise<VibeEntry[]> {
  try {
    const db = await openDB();
    const tx = db.transaction('vibes', 'readonly');
    return new Promise((resolve, reject) => {
      const request = tx.objectStore('vibes').index('fileId').getAll(fileId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

export async function cacheChatMessages(conversationId: string, messages: any[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction('chatMessages', 'readwrite');
    const store = tx.objectStore('chatMessages');
    for (const msg of messages) {
      store.put({ ...msg, conversationId });
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('Failed to cache chat messages:', e);
  }
}

export async function getCachedChatMessages(conversationId: string): Promise<any[]> {
  try {
    const db = await openDB();
    const tx = db.transaction('chatMessages', 'readonly');
    return new Promise((resolve, reject) => {
      const request = tx.objectStore('chatMessages').index('conversationId').getAll(conversationId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

export async function clearAllCache(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(['vibes', 'chatMessages'], 'readwrite');
    tx.objectStore('vibes').clear();
    tx.objectStore('chatMessages').clear();
  } catch {
    // silent
  }
}

/** Check if user is online */
export function isOnline(): boolean {
  return navigator.onLine;
}

/** Listen for online/offline events */
export function onConnectivityChange(callback: (online: boolean) => void): () => void {
  const onOnline = () => callback(true);
  const onOffline = () => callback(false);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}
