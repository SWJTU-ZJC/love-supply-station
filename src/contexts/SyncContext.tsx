import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
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

const STORAGE_KEY = 'love-supply-data';

// ========== localStorage helpers ==========

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

// ========== Compress / Decompress ==========

function encodeState(state: SharedState): string {
  // Strip large binary data from checkins (imageUrl stays local)
  const slim: SharedState = {
    ...state,
    checkins: state.checkins.map(c => ({ ...c, imageUrl: '' })),
    photos: [], // photos stay local
  };
  const json = JSON.stringify(slim);
  const bytes = new TextEncoder().encode(json);
  const compressed = deflate(bytes, { level: 9 });
  // Convert to base64url
  let bin = '';
  for (let i = 0; i < compressed.length; i++) bin += String.fromCharCode(compressed[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeState(code: string): SharedState | null {
  try {
    // Normalize base64url to standard base64
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
  const [lastSync, setLastSync] = useState('');

  const updateLocal = useCallback((updater: (prev: SharedState) => SharedState) => {
    setState(prev => {
      const next = updater(prev);
      next.version = prev.version + 1;
      saveLocal(next);
      return next;
    });
  }, []);

  // ========== Export / Import ==========

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

  // ========== Local-only mutations ==========

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
      state, lastSync, exportSyncCode, importSyncCode,
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
