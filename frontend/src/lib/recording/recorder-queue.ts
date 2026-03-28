import type { VoxFlameRecorderQueueItem } from '@/lib/recording/recording-contract'

const DB_NAME = 'voxflame-recorder'
const STORE_NAME = 'queue'
const DB_VERSION = 1

function isIndexedDbAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined'
}

function openQueueDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      reject(new Error('indexeddb_unavailable'))
      return
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(request.error ?? new Error('indexeddb_open_failed'))
    }

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'recordingId' })
        store.createIndex('createdAt', 'createdAt', { unique: false })
        store.createIndex('syncStatus', 'syncStatus', { unique: false })
      }
    }

    request.onsuccess = () => {
      resolve(request.result)
    }
  })
}

function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openQueueDb().then((db) => new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode)
    const store = transaction.objectStore(STORE_NAME)
    const request = operation(store)

    request.onerror = () => {
      reject(request.error ?? new Error('indexeddb_request_failed'))
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    transaction.oncomplete = () => {
      db.close()
    }

    transaction.onerror = () => {
      reject(transaction.error ?? new Error('indexeddb_transaction_failed'))
    }
  }))
}

export async function enqueueRecorderQueueItem(item: VoxFlameRecorderQueueItem): Promise<void> {
  await withStore('readwrite', (store) => store.put(item))
}

export async function getRecorderQueueItem(recordingId: string): Promise<VoxFlameRecorderQueueItem | null> {
  const item = await withStore<VoxFlameRecorderQueueItem | undefined>('readonly', (store) => store.get(recordingId))
  return item ?? null
}

export async function listRecorderQueueItems(): Promise<VoxFlameRecorderQueueItem[]> {
  const items = await withStore('readonly', (store) => store.getAll())
  return [...items].sort((left, right) => (
    new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  ))
}

export async function updateRecorderQueueItem(
  recordingId: string,
  updater: (current: VoxFlameRecorderQueueItem | null) => VoxFlameRecorderQueueItem | null,
): Promise<VoxFlameRecorderQueueItem | null> {
  const current = await getRecorderQueueItem(recordingId)
  const next = updater(current)

  if (!next) {
    if (current) {
      await removeRecorderQueueItem(recordingId)
    }
    return null
  }

  await enqueueRecorderQueueItem(next)
  return next
}

export async function removeRecorderQueueItem(recordingId: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(recordingId))
}

export async function countRecorderQueueItems(): Promise<number> {
  return withStore('readonly', (store) => store.count())
}
