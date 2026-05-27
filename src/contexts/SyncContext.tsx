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

export interface SharedState {
  version: number;
  moods: SharedMood[];
  coins: SharedCoin[];
  checkins: SharedCheckin[];
  photos: SharedPhoto[];
  littleThings: SharedLittleThing[];
  gachaItems: SharedGachaItem[];
}

interface SyncContextType {
  state: SharedState;
  connected: boolean;
  syncing: boolean;
  lastSync: string;
  updateMood: (mood: string) => void;
  updateCoins: (coins: number) => void;
  addCheckin: (c: Omit<SharedCheckin, 'id'>) => void;
  addPhoto: (p: SharedPhoto) => void;
  deletePhoto: (id: string) => void;
  uploadPhoto: (file: File, caption: string) => Promise<boolean>;
  toggleLittleThing: (id: string) => void;
  addLittleThing: (t: Omit<SharedLittleThing, 'id'>) => void;
  addGachaItem: (item: Omit<SharedGachaItem, 'id' | 'userId' | 'obtainedAt' | 'used'>) => void;
  useGachaItem: (id: string) => void;
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

// ========== localStorage helpers ==========

const STORAGE_KEY = 'love-supply-data';

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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    const slim = { ...state, photos: state.photos.slice(-5), checkins: state.checkins.map((c: any) => ({ ...c, imageUrl: '' })) };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(slim)); } catch {}
  }
}

function getEmptyState(): SharedState {
  return {
    version: 1,
    moods: [], coins: [], checkins: [], photos: [],
    littleThings: [], gachaItems: [],
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
  const mergeRemoteWins = <T extends { id: string }>(_local: T[], remoteArr: T[]) => {
    return [...safe(remoteArr)];
  };
  const mergeById = <T extends { id: string }>(a: T[], b: T[]) => {
    const map = new Map<string, T>();
    safe(a).forEach(x => map.set(x.id, x));
    safe(b).forEach(x => map.set(x.id, x));
    return Array.from(map.values());
  };
  const mergeByUserIdLatest = <T extends { userId: string }>(a: T[], b: T[], getTime: (x: T) => number) => {
    const map = new Map<string, T>();
    safe(b).forEach(x => map.set(x.userId, x));
    safe(a).forEach(x => {
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

  return {
    version: Math.max(local.version, remote.version),
    moods: mergeByUserIdLatest(local.moods, remote.moods, x => x.updatedAt),
    coins: mergeCoins(local.coins, remote.coins),
    checkins: mergeRemoteWins(local.checkins, remote.checkins),
    photos: mergeRemoteWins(local.photos, remote.photos),
    littleThings: mergeById(local.littleThings, remote.littleThings),
    gachaItems: mergeRemoteWins(local.gachaItems, remote.gachaItems),
  };
}

// ========== Sync state strip ==========

function slimForSync(state: SharedState): SharedState {
  const maxPhotos = 25;
  const maxCheckins = 50;
  const sortedCheckins = [...state.checkins].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const trimmedCheckins = sortedCheckins.slice(0, maxCheckins);
  return {
    ...state,
    checkins: trimmedCheckins,
    photos: state.photos.length > maxPhotos
      ? [...state.photos].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, maxPhotos)
      : state.photos,
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
          const newEtag = await pushRemote(current, '');
          if (newEtag) {
            etagRef.current = newEtag;
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
    updateLocal(prev => ({ ...prev, checkins: [...prev.checkins, checkin] }));
  }, [updateLocal]);

  const addPhoto = useCallback((p: SharedPhoto) => {
    updateLocal(prev => ({ ...prev, photos: [...prev.photos, p] }));
  }, [updateLocal]);

  const deletePhoto = useCallback((id: string) => {
    updateLocal(prev => ({ ...prev, photos: prev.photos.filter(p => p.id !== id) }));
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

  return (
    <SyncContext.Provider value={{
      state, connected, syncing, lastSync,
      updateMood, updateCoins, addCheckin, addPhoto, deletePhoto, uploadPhoto,
      toggleLittleThing, addLittleThing,
      addGachaItem, useGachaItem,
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
