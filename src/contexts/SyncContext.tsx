import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { deflate, inflate } from 'pako';

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
export interface SharedCapsule {
  id: string; userId: string; content: string; sealTime: string;
  openTime: string; isOpened: boolean;
}
export interface SharedMessage {
  id: string; fromUserId: string; toUserId: string; content: string;
  isRead: boolean; createdAt: number;
}

export interface SharedState {
  version: number;
  moods: SharedMood[];
  coins: SharedCoin[];
  checkins: SharedCheckin[];
  photos: SharedPhoto[];
  littleThings: SharedLittleThing[];
  capsules: SharedCapsule[];
  messages: SharedMessage[];
  wheelResults: { userId: string; result: string; timestamp: number; }[];
}

interface SyncContextType {
  state: SharedState;
  connected: boolean;
  syncing: boolean;
  lastSync: string;
  exportSyncCode: () => string;
  importSyncCode: (code: string) => boolean;
  updateMood: (mood: string) => void;
  updateCoins: (coins: number) => void;
  addCheckin: (c: Omit<SharedCheckin, 'id'>) => void;
  addPhoto: (p: SharedPhoto) => void;
  uploadPhoto: (file: File, caption: string) => Promise<boolean>;
  toggleLittleThing: (id: string) => void;
  addLittleThing: (t: Omit<SharedLittleThing, 'id'>) => void;
  addCapsule: (c: Omit<SharedCapsule, 'id'>) => void;
  openCapsule: (id: string) => void;
  sendMessage: (content: string) => void;
  markMessageRead: (id: string) => void;
  addWheelResult: (result: string) => void;
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

function buildPhotoOssUrl(objectKey: string, sig: string, expires: number): string {
  return `https://${OSS_ENDPOINT}/${objectKey}?OSSAccessKeyId=${encodeURIComponent(AK)}&Expires=${expires}&Signature=${encodeURIComponent(sig)}`;
}

// ========== Image compression ==========

function compressImage(file: File, maxW: number = 1920, quality: number = 0.8): Promise<Blob> {
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
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/jpeg', quality);
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
      if (parsed.littleThings?.length) return parsed;
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
    littleThings: [], capsules: [], messages: [], wheelResults: [],
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
  const mergeById = <T extends { id: string }>(a: T[], b: T[]) => {
    const map = new Map<string, T>();
    a.forEach(x => map.set(x.id, x));
    b.forEach(x => map.set(x.id, x));
    return Array.from(map.values());
  };

  const mergeByUserIdLatest = <T extends { userId: string }>(a: T[], b: T[], getTime: (x: T) => number) => {
    const map = new Map<string, T>();
    [...a, ...b].forEach(x => {
      const existing = map.get(x.userId);
      if (!existing || getTime(x) > getTime(existing)) map.set(x.userId, x);
    });
    return Array.from(map.values());
  };

  const mergeCoins = (localCoins: SharedCoin[], remoteCoins: SharedCoin[]) => {
    const map = new Map<string, number>();
    localCoins.forEach(c => map.set(c.userId, c.coins));
    remoteCoins.forEach(c => map.set(c.userId, Math.max(c.coins, map.get(c.userId) || 0)));
    return Array.from(map.entries()).map(([userId, coins]) => ({ userId, coins }));
  };

  const mergeWheel = (a: SharedState['wheelResults'], b: SharedState['wheelResults']) => {
    const set = new Set<string>();
    const result: SharedState['wheelResults'] = [];
    [...b, ...a].forEach(x => {
      const key = `${x.userId}-${x.timestamp}`;
      if (!set.has(key)) { set.add(key); result.push(x); }
    });
    return result;
  };

  return {
    version: Math.max(local.version, remote.version),
    moods: mergeByUserIdLatest(local.moods, remote.moods, x => x.updatedAt),
    coins: mergeCoins(local.coins, remote.coins),
    checkins: mergeById(local.checkins, remote.checkins),
    photos: mergeById(local.photos, remote.photos),
    littleThings: mergeById(local.littleThings, remote.littleThings),
    capsules: mergeById(local.capsules, remote.capsules),
    messages: mergeById(local.messages, remote.messages),
    wheelResults: mergeWheel(local.wheelResults, remote.wheelResults),
  };
}

// ========== Sync state strip ==========

function slimForSync(state: SharedState): SharedState {
  return {
    ...state,
    checkins: state.checkins.map(c => ({ ...c, imageUrl: '' })),
  };
}

// ========== Sync code helpers (fallback) ==========

function encodeState(state: SharedState): string {
  const slim = slimForSync(state);
  const json = JSON.stringify(slim);
  const bytes = new TextEncoder().encode(json);
  const compressed = deflate(bytes, { level: 9 });
  let bin = '';
  for (let i = 0; i < compressed.length; i++) bin += String.fromCharCode(compressed[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeState(code: string): SharedState | null {
  try {
    let b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const decompressed = inflate(bytes);
    const json = new TextDecoder().decode(decompressed);
    const parsed = JSON.parse(json);
    if (typeof parsed.version === 'number' && Array.isArray(parsed.moods)) {
      return parsed as SharedState;
    }
    return null;
  } catch {
    return null;
  }
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

      const etag = res.headers.get('ETag') || '';
      console.log(`[sync:${uid}] GET ok v${remote.version} moods:${remote.moods?.length || 0}`);
      return { state: remote as SharedState, etag };
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

  // ========== Sync code (fallback) ==========

  const exportSyncCode = useCallback((): string => {
    const code = encodeState(state);
    const now = new Date();
    setLastSync(`导出 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    return code;
  }, [state]);

  const importSyncCode = useCallback((code: string): boolean => {
    const remote = decodeState(code.trim());
    if (!remote) return false;
    setState(prev => {
      const merged = mergeStates(prev, remote);
      merged.version = Math.max(prev.version, remote.version) + 1;
      saveLocal(merged);
      return merged;
    });
    const now = new Date();
    setLastSync(`导入 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    return true;
  }, []);

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

  const uploadPhoto = useCallback(async (file: File, caption: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const blob = await compressImage(file);
      const ts = Date.now();
      const rand = Math.random().toString(36).slice(2, 6);
      const objectKey = `photos/${user.id}/${ts}_${rand}.jpg`;
      const bucket = OSS_ENDPOINT.split('.')[0];
      const resource = `/${bucket}/${objectKey}`;

      const expires = Math.floor(Date.now() / 1000) + 300;
      const sig = await ossSign('PUT', 'image/jpeg', expires, resource);
      const url = buildPhotoOssUrl(objectKey, sig, expires);

      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: blob,
      });
      if (!res.ok) {
        console.error(`[sync:${user.id}] Photo upload HTTP ${res.status}`);
        return false;
      }

      const viewExpires = Math.floor(Date.now() / 1000) + 31536000;
      const viewSig = await ossSign('GET', '', viewExpires, resource);
      const photoUrl = buildPhotoOssUrl(objectKey, viewSig, viewExpires);
      const photo: SharedPhoto = {
        id: ts.toString() + rand,
        userId: user.id,
        url: photoUrl,
        createdAt: ts,
        caption,
      };
      addPhoto(photo);
      console.log(`[sync:${user.id}] Photo uploaded: ${photoUrl}`);
      return true;
    } catch (e) {
      console.error(`[sync:${user.id}] Photo upload error:`, e);
      return false;
    }
  }, [user, addPhoto]);

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

  const addCapsule = useCallback((c: Omit<SharedCapsule, 'id'>) => {
    const capsule: SharedCapsule = { ...c, id: Date.now().toString() };
    updateLocal(prev => ({ ...prev, capsules: [...prev.capsules, capsule] }));
  }, [updateLocal]);

  const openCapsule = useCallback((id: string) => {
    updateLocal(prev => ({
      ...prev,
      capsules: prev.capsules.map(c => c.id === id ? { ...c, isOpened: true } : c),
    }));
  }, [updateLocal]);

  const sendMessage = useCallback((content: string) => {
    if (!user) return;
    const msg: SharedMessage = {
      id: Date.now().toString(),
      fromUserId: user.id,
      toUserId: user.partnerId,
      content,
      isRead: false,
      createdAt: Date.now(),
    };
    updateLocal(prev => ({ ...prev, messages: [...prev.messages, msg] }));
  }, [user, updateLocal]);

  const markMessageRead = useCallback((id: string) => {
    updateLocal(prev => ({
      ...prev,
      messages: prev.messages.map(m => m.id === id ? { ...m, isRead: true } : m),
    }));
  }, [updateLocal]);

  const addWheelResult = useCallback((result: string) => {
    if (!user) return;
    updateLocal(prev => ({
      ...prev,
      wheelResults: [...prev.wheelResults, { userId: user.id, result, timestamp: Date.now() }],
    }));
  }, [user, updateLocal]);

  return (
    <SyncContext.Provider value={{
      state, connected, syncing, lastSync,
      exportSyncCode, importSyncCode,
      updateMood, updateCoins, addCheckin, addPhoto, uploadPhoto,
      toggleLittleThing, addLittleThing, addCapsule, openCapsule,
      sendMessage, markMessageRead, addWheelResult,
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
