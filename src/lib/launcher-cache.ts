/**
 * Launcher Cache - IndexedDB storage for offline launcher predictions
 * Provides instant loading and offline support
 */

interface CachedLauncherPrediction {
  userId: string;
  prediction: any; // LauncherPrediction from API
  cachedAt: number; // timestamp
  expiresAt: number; // timestamp
}

const DB_NAME = 'fit-hub-launcher';
const DB_VERSION = 1;
const STORE_NAME = 'predictions';
const CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Open IndexedDB connection
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
        store.createIndex('expiresAt', 'expiresAt', { unique: false });
      }
    };
  });
}

/**
 * Get cached prediction for a user
 */
export async function getCachedPrediction(userId: string): Promise<any | null> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(userId);

      request.onsuccess = () => {
        const cached = request.result as CachedLauncherPrediction | undefined;

        // Check if cache exists and is not expired
        if (cached && Date.now() < cached.expiresAt) {
          console.log('[Launcher Cache] Hit - serving from cache');
          resolve(cached.prediction);
        } else {
          console.log('[Launcher Cache] Miss or expired');
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('[Launcher Cache] Read error:', request.error);
        resolve(null); // Fail gracefully
      };
    });
  } catch (error) {
    console.error('[Launcher Cache] Failed to get cached prediction:', error);
    return null;
  }
}

/**
 * Save prediction to cache
 */
export async function cachePrediction(userId: string, prediction: any): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const cached: CachedLauncherPrediction = {
      userId,
      prediction,
      cachedAt: Date.now(),
      expiresAt: Date.now() + CACHE_DURATION_MS,
    };

    return new Promise((resolve, reject) => {
      const request = store.put(cached);

      request.onsuccess = () => {
        console.log('[Launcher Cache] Saved prediction');
        resolve();
      };

      request.onerror = () => {
        console.error('[Launcher Cache] Write error:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[Launcher Cache] Failed to cache prediction:', error);
  }
}

/**
 * Clear expired cache entries
 */
export async function clearExpiredCache(): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('expiresAt');

    const now = Date.now();
    const range = IDBKeyRange.upperBound(now);

    return new Promise((resolve, reject) => {
      const request = index.openCursor(range);
      let deletedCount = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          console.log(`[Launcher Cache] Cleared ${deletedCount} expired entries`);
          resolve();
        }
      };

      request.onerror = () => {
        console.error('[Launcher Cache] Clear error:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[Launcher Cache] Failed to clear expired cache:', error);
  }
}

/**
 * Clear all cache for a user (useful for logout)
 */
export async function clearUserCache(userId: string): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.delete(userId);

      request.onsuccess = () => {
        console.log('[Launcher Cache] Cleared user cache');
        resolve();
      };

      request.onerror = () => {
        console.error('[Launcher Cache] Delete error:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[Launcher Cache] Failed to clear user cache:', error);
  }
}
