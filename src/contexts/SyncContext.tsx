import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useAuth } from './AuthContext';

// ========== Shared State Types ==========

export interface SharedMood { userId: string; mood: string; updatedAt: number; }
export interface SharedCoin { userId: string; coins: number; }
export interface SharedCheckin {
  id: string; userId: string; latitude: number; longitude: number;
  imageUrl: string; note: string; createdAt: string;
}
export interface SharedPhoto { id: string; userId: string; url: string; createdAt: number; caption: string; }
export interface SharedLittleThing {
  id: string; text: string; isDone: boolean; doneTime: string | null; proposedBy: string;
}
export interface SharedGachaItem {
  id: string;
  userId: string;
  name: string;
  icon: string;
  rarity: 'normal' | 'rare' | 'super';
  obtainedAt: number;
  used: boolean;
}
export interface SharedAnniversary {
  id: string;
  title: string;
  date: string;
  type: 'anniversary' | 'birthday' | 'memory';
  year?: number;
  createdAt: number;
}

export interface SharedState {
  version: number;
  moods: SharedMood[];
  coins: SharedCoin[];
  checkins: SharedCheckin[];
  photos: SharedPhoto[];
  littleThings: SharedLittleThing[];
  gachaItems: SharedGachaItem[];
  anniversaries: SharedAnniversary[];
  deletedPhotoIds: string[];
  deletedCheckinIds: string[];
}

interface SyncContextType {
  state: SharedState;
  connected: boolean;
  syncing: boolean;
  lastSync: string;
  updateMood: (mood: string) => void;
  updateCoins: (coins: number) => void;
  addCheckin: (c: Omit<SharedCheckin, 'id'>) => void;
  deleteCheckin: (id: string) => void;
  addPhoto: (p: SharedPhoto) => void;
  deletePhoto: (id: string) => void;
  uploadPhoto: (file: File, caption: string) => Promise<boolean>;
  toggleLittleThing: (id: string) => void;
  addLittleThing: (t: Omit<SharedLittleThing, 'id'>) => void;
  addGachaItem: (item: Omit<SharedGachaItem, 'id' | 'userId' | 'obtainedAt' | 'used'>) => void;
  useGachaItem: (id: string) => void;
  addAnniversary: (a: Omit<SharedAnniversary, 'id' | 'createdAt'>) => void;
  updateAnniversary: (id: string, updates: Partial<Pick<SharedAnniversary, 'title' | 'date' | 'type' | 'year'>>) => void;
  deleteAnniversary: (id: string) => void;
}

const SyncContext = createContext<SyncContextType | null>(null);

// ========== Alibaba Cloud OSS config ==========

const OSS_ENDPOINT = 'love-web226.oss-cn-beijing.aliyuncs.com';
const OSS_KEY = 'sync.json';
const POLL_MS = 5000;
const PUSH_DEBOUNCE_MS = 1500;

// Credential obfuscation
const _ak = [76,84,65,73,53,116,56,103,97,86,106,103,114,49,80,78,65,118,113,75,70,117,78,111];
const _sk = [78,99,97,110,52,101,48,117,120,83,67,77,106,49,50,121,101,120,107,74,69,117,89,107,110,75,82,49,102,118];
const AK = String.fromCharCode.apply(null, _ak);
const SK = String.fromCharCode.apply(null, _sk);

// ========== OSS HMAC-SHA1 signature ==========

async function ossSign(verb: string, contentType: string, expires: number, resource: string): Promise<string> {
  const stringToSign = `${verb}\n\n${contentType}\n${expires}\n${resource}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(SK);
  const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'HMAC' }, key, encoder.encode(stringToSign));
  const bytes = new Uint8Array(sig);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function buildOssUrl(sig: string, expires: number): string {
  return `https://${OSS_ENDPOINT}/${OSS_KEY}?OSSAccessKeyId=${encodeURIComponent(AK)}&Expires=${expires}&Signature=${encodeURIComponent(sig)}`;
}

// ========== Image compression (to base64 data URL) ==========

function compressToDataUrl(file: File, maxW: number = 1920, quality: number = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxW) { height = Math.round(height * maxW / width); width = maxW; }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas unavailable')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = URL.createObjectURL(file);
  });
}

interface CachedUrl { url: string; expiresAt: number; }

// ========== IndexedDB photo storage ==========

const DB_NAME = 'love-supply-db';
const DB_VERSION = 1;
const PHOTO_STORE = 'photos';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(PHOTO_STORE)) {
        req.result.createObjectStore(PHOTO_STORE, { keyPath: 'id' });
      }
      if (!req.result.objectStoreNames.contains(CHECKIN_IMG_STORE)) {
        req.result.createObjectStore(CHECKIN_IMG_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadPhotosFromDB(): Promise<SharedPhoto[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(PHOTO_STORE, 'readonly');
      const store = tx.objectStore(PHOTO_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return [];
  }
}

async function savePhotosToDB(photos: SharedPhoto[]): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(PHOTO_STORE, 'readwrite');
      const store = tx.objectStore(PHOTO_STORE);
      store.clear();
      for (const p of photos) store.put(p);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
    });
  } catch {}
}

// ========== IndexedDB: check-in images ==========

const CHECKIN_IMG_STORE = 'checkinImages';

async function loadCheckinImagesFromDB(): Promise<Record<string, string>> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      if (!db.objectStoreNames.contains(CHECKIN_IMG_STORE)) { db.close(); resolve({}); return; }
      const tx = db.transaction(CHECKIN_IMG_STORE, 'readonly');
      const store = tx.objectStore(CHECKIN_IMG_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const items: { id: string; url: string }[] = req.result || [];
        const map: Record<string, string> = {};
        for (const item of items) map[item.id] = item.url;
        resolve(map);
      };
      req.onerror = () => resolve({});
    });
  } catch { return {}; }
}

async function saveCheckinImageToDB(id: string, url: string): Promise<void> {
  if (!url) return;
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      if (!db.objectStoreNames.contains(CHECKIN_IMG_STORE)) { db.close(); resolve(); return; }
      const tx = db.transaction(CHECKIN_IMG_STORE, 'readwrite');
      const store = tx.objectStore(CHECKIN_IMG_STORE);
      store.put({ id, url });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
    });
  } catch {}
}

// ========== localStorage helpers (state without photos) ==========

const STORAGE_KEY = 'love-supply-data';
const MIGRATED_KEY = 'love-supply-idb-migrated';

function stateWithoutPhotos(state: SharedState): Omit<SharedState, 'photos'> & { photos: never[] } {
  const slimCheckins = state.checkins.map((c: any) => ({ ...c, imageUrl: '' }));
  return { ...state, photos: [], checkins: slimCheckins };
}

function loadLocal(): SharedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...getEmptyState(), ...parsed, littleThings: parsed.littleThings?.length ? parsed.littleThings : getDefaultLittleThings() };
    }
  } catch {}
  return { ...getEmptyState(), littleThings: getDefaultLittleThings() };
}

function saveLocal(state: SharedState) {
  const noPhotos = stateWithoutPhotos(state);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(noPhotos));
  } catch {
    console.warn('[sync] localStorage full, stripping checkin images...');
    const slimCheckins = noPhotos.checkins.map((c: any) => ({ ...c, imageUrl: '' }));
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...noPhotos, checkins: slimCheckins })); } catch {
      console.warn('[sync] still full, trimming oldest checkins...');
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...noPhotos, checkins: slimCheckins.slice(-20) })); } catch {}
    }
  }
}

function getEmptyState(): SharedState {
  return {
    version: 1,
    moods: [], coins: [], checkins: [], photos: [],
    littleThings: [], gachaItems: [], anniversaries: [],
    deletedPhotoIds: [], deletedCheckinIds: [],
  };
}

function getDefaultLittleThings(): SharedLittleThing[] {
  return [
    { id: '1', text: '一起看一场日出', isDone: false, doneTime: null, proposedBy: 'user_1' },
    { id: '2', text: '牵手走过陌生的街道', isDone: false, doneTime: null, proposedBy: 'user_2' },
    { id: '3', text: '一起做饭', isDone: false, doneTime: null, proposedBy: 'user_1' },
    { id: '4', text: '给对方写一封情书', isDone: false, doneTime: null, proposedBy: 'user_1' },
    { id: '5', text: '一起看一场电影', isDone: false, doneTime: null, proposedBy: 'user_2' },
    { id: '6', text: '在雨中漫步', isDone: false, doneTime: null, proposedBy: 'user_2' },
    { id: '7', text: '给对方准备惊喜早餐', isDone: false, doneTime: null, proposedBy: 'user_1' },
    { id: '8', text: '一起去游乐园', isDone: false, doneTime: null, proposedBy: 'user_2' },
    { id: '9', text: '拍一组情侣写真', isDone: false, doneTime: null, proposedBy: 'user_1' },
    { id: '10', text: '一起数星星', isDone: false, doneTime: null, proposedBy: 'user_2' },
  ];
}

// ========== Merge logic ==========

function mergeStates(local: SharedState, remote: SharedState): SharedState {
  const safe = (arr: any[]) => arr || [];
  const mergeById = <T extends { id: string }>(a: T[], b: T[]) => {
    const map = new Map<string, T>();
    safe(a).forEach(x => map.set(x.id, x));
    safe(b).forEach(x => map.set(x.id, x));
    return Array.from(map.values());
  };
  const mergeByUserIdLatest = <T extends { userId: string }>(a: T[], b: T[], getTime: (x: T) => number) => {
    const map = new Map<string, T>();
    [...safe(a), ...safe(b)].forEach(x => {
      const existing = map.get(x.userId);
      if (!existing || getTime(x) > getTime(existing)) map.set(x.userId, x);
    });
    return Array.from(map.values());
  };
  const mergeCoins = (localCoins: SharedCoin[], remoteCoins: SharedCoin[]) => {
    const map = new Map<string, number>();
    safe(localCoins).forEach(c => map.set(c.userId, c.coins));
    safe(remoteCoins).forEach(c => map.set(c.userId, c.coins));
    return Array.from(map.entries()).map(([userId, coins]) => ({ userId, coins }));
  };

  const deletedPhotos = new Set([...safe(local.deletedPhotoIds), ...safe(remote.deletedPhotoIds)]);
  const deletedCheckins = new Set([...safe(local.deletedCheckinIds), ...safe(remote.deletedCheckinIds)]);

  return {
    version: Math.max(local.version, remote.version),
    moods: mergeByUserIdLatest(local.moods, remote.moods, x => x.updatedAt),
    coins: mergeCoins(local.coins, remote.coins),
    checkins: mergeById(local.checkins, remote.checkins).filter(c => !deletedCheckins.has(c.id)),
    photos: mergeById(local.photos, remote.photos).filter(p => !deletedPhotos.has(p.id)),
    littleThings: mergeById(local.littleThings, remote.littleThings),
    gachaItems: mergeById(local.gachaItems, remote.gachaItems),
    anniversaries: mergeById(local.anniversaries, remote.anniversaries),
    deletedPhotoIds: [...deletedPhotos],
    deletedCheckinIds: [...deletedCheckins],
  };
}

// ========== Sync state strip ==========

function slimForSync(state: SharedState): SharedState {
  const maxCheckins = 50;
  const sortedCheckins = [...state.checkins].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const trimmedCheckins = sortedCheckins.slice(0, maxCheckins);
  return {
    ...state,
    checkins: trimmedCheckins.map((c: any) => ({ ...c, imageUrl: '' })),
  };
}

// ========== Provider ==========

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<SharedState>(loadLocal);
  const [connected, setConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState('');

  const etagRef = useRef<string | null>(null);
  const getUrlRef = useRef<CachedUrl | null>(null);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pollTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const dirtyRef = useRef(false);
  const pushingRef = useRef(false);
  const initDoneRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  // ========== IndexedDB: migrate + load photos on mount ==========

  useEffect(() => {
    let mounted = true;
    (async () => {
      let photos = await loadPhotosFromDB();
      if (photos.length === 0) {
        // First run: migrate photos from localStorage to IndexedDB
        const local = loadLocal();
        if (local.photos.length > 0) {
          console.log(`[sync] migrating ${local.photos.length} photos from localStorage to IndexedDB`);
          photos = local.photos;
          await savePhotosToDB(photos);
          localStorage.setItem(MIGRATED_KEY, '1');
          // Clear photos from localStorage now that they're in IndexedDB
          saveLocal({ ...local, photos: [] });
        }
      }
      if (!mounted) return;
      if (photos.length > 0) {
        setState(prev => {
          const merged = { ...prev, photos: [...photos, ...prev.photos.filter(p => !photos.some(mp => mp.id === p.id))] };
          return merged;
        });
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Load check-in images from IndexedDB on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      const images = await loadCheckinImagesFromDB();
      if (!mounted) return;
      const ids = Object.keys(images);
      if (ids.length > 0) {
        setState(prev => ({
          ...prev,
          checkins: prev.checkins.map(c => {
            if (images[c.id] && !c.imageUrl) {
              return { ...c, imageUrl: images[c.id] };
            }
            return c;
          }),
        }));
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Save photos to IndexedDB whenever they change
  useEffect(() => {
    savePhotosToDB(state.photos);
  }, [state.photos]);

  const uid = user?.id || '?';

  // ========== OSS: get signed URL for GET ==========

  async function getGetUrl(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (getUrlRef.current && getUrlRef.current.expiresAt > now + 60) {
      return getUrlRef.current.url;
    }
    const expires = now + 3600;
    const sig = await ossSign('GET', '', expires, `/${OSS_ENDPOINT.split('.')[0]}/${OSS_KEY}`);
    const url = buildOssUrl(sig, expires);
    getUrlRef.current = { url, expiresAt: expires };
    return url;
  }

  // ========== OSS: fetch remote ==========

  type FetchResult = { state: SharedState; etag: string } | 'unchanged' | 'empty' | 'error';

  const fetchRemote = useCallback(async (): Promise<FetchResult> => {
    try {
      const baseUrl = await getGetUrl();
      const headers: Record<string, string> = {};
      if (etagRef.current) headers['If-None-Match'] = etagRef.current;

      const res = await fetch(baseUrl, { headers });
      if (res.status === 304) return 'unchanged';
      if (res.status === 404) return 'empty';
      if (!res.ok) {
        console.error(`[sync:${uid}] OSS GET HTTP ${res.status}`);
        return 'error';
      }

      const text = await res.text();
      if (!text) return 'empty';
      const remote = JSON.parse(text);
      if (typeof remote.version !== 'number' || !Array.isArray(remote.moods)) {
        console.error(`[sync:${uid}] OSS GET: invalid data`);
        return 'error';
      }

      const safe = { ...getEmptyState(), ...remote } as SharedState;
      const etag = res.headers.get('ETag') || '';
      console.log(`[sync:${uid}] GET ok v${safe.version} moods:${safe.moods?.length || 0}`);
      return { state: safe, etag };
    } catch (e) {
      console.error(`[sync:${uid}] OSS GET error:`, e);
      return 'error';
    }
  }, [uid]);

  // ========== OSS: push local ==========

  const pushRemote = useCallback(async (localState: SharedState, etag: string): Promise<string | null> => {
    try {
      const expires = Math.floor(Date.now() / 1000) + 300;
      const sig = await ossSign('PUT', 'application/json', expires, `/${OSS_ENDPOINT.split('.')[0]}/${OSS_KEY}`);
      const url = buildOssUrl(sig, expires);

      const slim = slimForSync(localState);
      const body = JSON.stringify(slim);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (etag) headers['If-Match'] = etag;

      console.log(`[sync:${uid}] PUT v${localState.version} moods:${localState.moods?.length || 0} etag:${etag || '(new)'}`);
      const res = await fetch(url, { method: 'PUT', headers, body });
      if (res.status === 412) {
        console.warn(`[sync:${uid}] PUT 412 conflict`);
        return null;
      }
      if (!res.ok) {
        console.error(`[sync:${uid}] OSS PUT HTTP ${res.status}`);
        return null;
      }

      const newEtag = res.headers.get('ETag') || '';
      console.log(`[sync:${uid}] PUT ok newEtag:${newEtag}`);
      return newEtag;
    } catch (e) {
      console.error(`[sync:${uid}] OSS PUT error:`, e);
      return null;
    }
  }, [uid]);

  // ========== Polling loop ==========

  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      const result = await fetchRemote();
      if (!mounted) return;

      if (result === 'unchanged') {
        setConnected(true);
        return;
      }

      if (result === 'empty') {
        setConnected(true);
        if (!initDoneRef.current) {
          initDoneRef.current = true;
          console.log(`[sync:${uid}] File empty, creating...`);
          const current = stateRef.current;
          const clean = { ...current, gachaItems: [] };
          const newEtag = await pushRemote(clean, '');
          if (newEtag) {
            etagRef.current = newEtag;
            setState(prev => { const s = { ...prev, gachaItems: [] }; saveLocal(s); return s; });
            const now = new Date();
            setLastSync(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
          }
        }
        return;
      }

      if (result === 'error') {
        setConnected(false);
        return;
      }

      setConnected(true);
      const { state: remote, etag } = result;

      if (etag === etagRef.current) return;

      if (!initDoneRef.current) {
        initDoneRef.current = true;
        const current = stateRef.current;
        const merged = mergeStates(current, remote);
        merged.version = Math.max(current.version, remote.version) + 1;
        console.log(`[sync:${uid}] INIT merge+push local v${current.version} + remote v${remote.version}`);
        const newEtag = await pushRemote(merged, etag);
        if (newEtag) {
          etagRef.current = newEtag;
          setState(merged);
          saveLocal(merged);
          const now = new Date();
          setLastSync(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
          return;
        }
      }

      etagRef.current = etag;

      setState(prev => {
        const merged = mergeStates(prev, remote);
        merged.version = Math.max(prev.version, remote.version) + 1;
        saveLocal(merged);
        console.log(`[sync:${uid}] MERGED local v${prev.version} + remote v${remote.version} → v${merged.version}`);
        return merged;
      });

      const now = new Date();
      setLastSync(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    };

    poll();
    pollTimerRef.current = setInterval(poll, POLL_MS);
    return () => {
      mounted = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [fetchRemote, pushRemote, uid]);

  // ========== Push on local changes (debounced) ==========

  const schedulePush = useCallback(() => {
    dirtyRef.current = true;
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(async () => {
      if (!dirtyRef.current || pushingRef.current) return;
      dirtyRef.current = false;
      pushingRef.current = true;
      setSyncing(true);

      const current = stateRef.current;
      const etag = etagRef.current || '';

      let newEtag = await pushRemote(current, etag);

      if (!newEtag && etag) {
        const result = await fetchRemote();
        if (result && typeof result === 'object') {
          etagRef.current = result.etag;
          const merged = mergeStates(current, result.state);
          merged.version = Math.max(current.version, result.state.version) + 1;
          newEtag = await pushRemote(merged, result.etag);
          if (newEtag) {
            setState(merged);
            saveLocal(merged);
            console.log(`[sync:${uid}] Conflict resolved, retry ok`);
          }
        }
      }

      if (newEtag) {
        etagRef.current = newEtag;
        const now = new Date();
        setLastSync(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
      }

      pushingRef.current = false;
      setSyncing(false);
    }, PUSH_DEBOUNCE_MS);
  }, [fetchRemote, pushRemote, uid]);

  useEffect(() => {
    return () => { if (pushTimerRef.current) clearTimeout(pushTimerRef.current); };
  }, []);

  // ========== Local mutations ==========

  const updateLocal = useCallback((updater: (prev: SharedState) => SharedState) => {
    setState(prev => {
      const next = updater(prev);
      next.version = prev.version + 1;
      saveLocal(next);
      console.log(`[sync:${uid}] local change → v${next.version}`);
      return next;
    });
    schedulePush();
  }, [schedulePush, uid]);

  // ========== Mutation methods ==========

  const updateMood = useCallback((mood: string) => {
    if (!user) return;
    updateLocal(prev => ({
      ...prev,
      moods: [...prev.moods.filter(m => m.userId !== user.id), { userId: user.id, mood, updatedAt: Date.now() }],
    }));
  }, [user, updateLocal]);

  const updateCoins = useCallback((coins: number) => {
    if (!user) return;
    updateLocal(prev => ({
      ...prev,
      coins: [...prev.coins.filter(c => c.userId !== user.id), { userId: user.id, coins }],
    }));
  }, [user, updateLocal]);

  const addCheckin = useCallback((c: Omit<SharedCheckin, 'id'>) => {
    const checkin: SharedCheckin = { ...c, id: Date.now().toString() + Math.random().toString(36).slice(2, 6) };
    if (checkin.imageUrl) {
      saveCheckinImageToDB(checkin.id, checkin.imageUrl);
    }
    updateLocal(prev => ({ ...prev, checkins: [...prev.checkins, checkin] }));
  }, [updateLocal]);

  const deleteCheckin = useCallback((id: string) => {
    updateLocal(prev => ({
      ...prev,
      checkins: prev.checkins.filter(c => c.id !== id),
      deletedCheckinIds: [...prev.deletedCheckinIds, id],
    }));
  }, [updateLocal]);

  const addPhoto = useCallback((p: SharedPhoto) => {
    updateLocal(prev => ({ ...prev, photos: [...prev.photos, p] }));
  }, [updateLocal]);

  const deletePhoto = useCallback((id: string) => {
    updateLocal(prev => ({
      ...prev,
      photos: prev.photos.filter(p => p.id !== id),
      deletedPhotoIds: [...prev.deletedPhotoIds, id],
    }));
  }, [updateLocal]);

  const uploadPhoto = useCallback(async (file: File, caption: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const dataUrl = await compressToDataUrl(file);
      const ts = Date.now();
      const rand = Math.random().toString(36).slice(2, 6);
      const photo: SharedPhoto = {
        id: ts.toString() + rand,
        userId: user.id,
        url: dataUrl,
        createdAt: ts,
        caption,
      };
      updateLocal(prev => {
        const currentCoins = prev.coins.find(c => c.userId === user.id)?.coins ?? 0;
        return {
          ...prev,
          photos: [...prev.photos, photo],
          coins: [...prev.coins.filter(c => c.userId !== user.id), { userId: user.id, coins: currentCoins + 1 }],
        };
      });
      console.log(`[sync:${user.id}] Photo saved: ${photo.id} (${(dataUrl.length / 1024).toFixed(0)}KB) +1 coin`);
      return true;
    } catch (e) {
      console.error(`[sync:${user.id}] Photo error:`, e);
      return false;
    }
  }, [user, updateLocal]);

  const toggleLittleThing = useCallback((id: string) => {
    updateLocal(prev => ({
      ...prev,
      littleThings: prev.littleThings.map(t =>
        t.id === id && !t.isDone ? { ...t, isDone: true, doneTime: new Date().toISOString().split('T')[0] } : t
      ),
    }));
  }, [updateLocal]);

  const addLittleThing = useCallback((t: Omit<SharedLittleThing, 'id'>) => {
    const thing: SharedLittleThing = { ...t, id: Date.now().toString() + Math.random().toString(36).slice(2, 6) };
    updateLocal(prev => ({ ...prev, littleThings: [...prev.littleThings, thing] }));
  }, [updateLocal]);

  const addGachaItem = useCallback((item: Omit<SharedGachaItem, 'id' | 'userId' | 'obtainedAt' | 'used'>) => {
    if (!user) return;
    const gachaItem: SharedGachaItem = {
      ...item,
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      userId: user.id,
      obtainedAt: Date.now(),
      used: false,
    };
    updateLocal(prev => ({ ...prev, gachaItems: [...prev.gachaItems, gachaItem] }));
  }, [user, updateLocal]);

  const useGachaItem = useCallback((id: string) => {
    updateLocal(prev => ({
      ...prev,
      gachaItems: prev.gachaItems.map(item =>
        item.id === id ? { ...item, used: true } : item
      ),
    }));
  }, [updateLocal]);

  const addAnniversary = useCallback((a: Omit<SharedAnniversary, 'id' | 'createdAt'>) => {
    const item: SharedAnniversary = {
      ...a,
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      createdAt: Date.now(),
    };
    updateLocal(prev => ({ ...prev, anniversaries: [...prev.anniversaries, item] }));
  }, [updateLocal]);

  const updateAnniversary = useCallback((id: string, updates: Partial<Pick<SharedAnniversary, 'title' | 'date' | 'type' | 'year'>>) => {
    updateLocal(prev => ({
      ...prev,
      anniversaries: prev.anniversaries.map(a =>
        a.id === id ? { ...a, ...updates } : a
      ),
    }));
  }, [updateLocal]);

  const deleteAnniversary = useCallback((id: string) => {
    updateLocal(prev => ({
      ...prev,
      anniversaries: prev.anniversaries.filter(a => a.id !== id),
    }));
  }, [updateLocal]);

  return (
    <SyncContext.Provider value={{
      state, connected, syncing, lastSync,
      updateMood, updateCoins, addCheckin, deleteCheckin, addPhoto, deletePhoto, uploadPhoto,
      toggleLittleThing, addLittleThing,
      addGachaItem, useGachaItem,
      addAnniversary, updateAnniversary, deleteAnniversary,
    }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within SyncProvider');
  return ctx;
}
