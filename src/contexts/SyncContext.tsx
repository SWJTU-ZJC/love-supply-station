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
export interface SharedPhoto { id: string; date: string; userId: string; imageUrl: string; }
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
  toggleLittleThing: (id: string) => void;
  addLittleThing: (t: Omit<SharedLittleThing, 'id'>) => void;
  addCapsule: (c: Omit<SharedCapsule, 'id'>) => void;
  openCapsule: (id: string) => void;
  sendMessage: (content: string) => void;
  markMessageRead: (id: string) => void;
  addWheelResult: (result: string) => void;
}

const SyncContext = createContext<SyncContextType | null>(null);

// ========== Gitee API config ==========

const _t = [57,57,101,102,56,49,50,52,98,57,50,49,56,98,48,100,52,98,53,50,101,52,50,100,51,57,48,52,57,49,98,48];
const GT = String.fromCharCode.apply(null, _t);
const API = `https://gitee.com/api/v5/repos/izhang-jiachen/love-web/contents/sync.json?access_token=${GT}`;

const POLL_MS = 5000;
const PUSH_DEBOUNCE_MS = 1500;

// ========== UTF-8 safe base64 ==========

function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

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

  const mergeByUserId = <T extends { userId: string }>(a: T[], b: T[], key: string) => {
    const map = new Map<string, T>();
    a.forEach(x => map.set(`${x.userId}-${(x as any)[key] || ''}`, x));
    b.forEach(x => map.set(`${x.userId}-${(x as any)[key] || ''}`, x));
    return Array.from(map.values());
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
    moods: mergeByUserId(local.moods, remote.moods, 'updatedAt'),
    coins: mergeByUserId(local.coins, remote.coins, ''),
    checkins: mergeById(local.checkins, remote.checkins),
    photos: mergeById(local.photos, remote.photos),
    littleThings: mergeById(local.littleThings, remote.littleThings),
    capsules: mergeById(local.capsules, remote.capsules),
    messages: mergeById(local.messages, remote.messages),
    wheelResults: mergeWheel(local.wheelResults, remote.wheelResults),
  };
}

// ========== Sync code helpers (fallback) ==========

function slimForSync(state: SharedState): SharedState {
  return {
    ...state,
    checkins: state.checkins.map(c => ({ ...c, imageUrl: '' })),
    photos: [],
  };
}

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

  const remoteShaRef = useRef<string | null>(null);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pollTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const dirtyRef = useRef(false);
  const pushingRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  // ========== Gitee API: fetch remote ==========

  const fetchRemote = useCallback(async (): Promise<{ state: SharedState; sha: string } | null> => {
    try {
      const res = await fetch(API);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.content || !data.sha) return null;
      const json = fromBase64(data.content.replace(/\s/g, ''));
      const remote = JSON.parse(json);
      if (typeof remote.version === 'number' && Array.isArray(remote.moods)) {
        return { state: remote as SharedState, sha: data.sha };
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // ========== Gitee API: push local ==========

  const pushRemote = useCallback(async (localState: SharedState, sha: string): Promise<string | null> => {
    try {
      const slim = slimForSync(localState);
      const json = JSON.stringify(slim);
      const content = toBase64(json);
      const body = JSON.stringify({ content, message: 'sync', sha });
      const res = await fetch(API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.content?.sha || null;
    } catch {
      return null;
    }
  }, []);

  // ========== Polling loop ==========

  useEffect(() => {
    const poll = async () => {
      const result = await fetchRemote();
      if (!result) {
        setConnected(false);
        return;
      }

      setConnected(true);
      const { state: remote, sha } = result;

      // Skip if same SHA we already have
      if (sha === remoteShaRef.current) return;

      remoteShaRef.current = sha;

      setState(prev => {
        // Check if remote actually has different data
        if (remote.version <= prev.version) return prev;
        const merged = mergeStates(prev, remote);
        merged.version = Math.max(prev.version, remote.version) + 1;
        saveLocal(merged);
        return merged;
      });

      const now = new Date();
      setLastSync(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    };

    // Initial fetch
    poll();

    pollTimerRef.current = setInterval(poll, POLL_MS);
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
  }, [fetchRemote]);

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
      let sha = remoteShaRef.current;

      // If we don't have a remote SHA, fetch first
      if (!sha) {
        const result = await fetchRemote();
        if (result) {
          sha = result.sha;
          remoteShaRef.current = sha;
          setConnected(true);
        } else {
          pushingRef.current = false;
          setSyncing(false);
          return;
        }
      }

      // Try push with conflict retry
      let newSha = await pushRemote(current, sha);
      if (!newSha) {
        // 409 conflict — re-fetch, merge, retry
        const result = await fetchRemote();
        if (result) {
          const merged = mergeStates(current, result.state);
          merged.version = Math.max(current.version, result.state.version) + 1;
          newSha = await pushRemote(merged, result.sha);
          if (newSha) {
            setState(merged);
            saveLocal(merged);
          }
        }
      }

      if (newSha) {
        remoteShaRef.current = newSha;
        const now = new Date();
        setLastSync(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
      }

      pushingRef.current = false;
      setSyncing(false);
    }, PUSH_DEBOUNCE_MS);
  }, [fetchRemote, pushRemote]);

  // Cleanup push timer on unmount
  useEffect(() => {
    return () => { if (pushTimerRef.current) clearTimeout(pushTimerRef.current); };
  }, []);

  // ========== Local mutations ==========

  const updateLocal = useCallback((updater: (prev: SharedState) => SharedState) => {
    setState(prev => {
      const next = updater(prev);
      next.version = prev.version + 1;
      saveLocal(next);
      return next;
    });
    schedulePush();
  }, [schedulePush]);

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
    updateLocal(prev => ({
      ...prev,
      photos: [...prev.photos.filter(x => !(x.date === p.date && x.userId === p.userId)), p],
    }));
  }, [updateLocal]);

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
      updateMood, updateCoins, addCheckin, addPhoto,
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
