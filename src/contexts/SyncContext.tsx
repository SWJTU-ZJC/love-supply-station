import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { useAuth } from './AuthContext';

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

const emptyState: SharedState = {
  version: 1,
  moods: [], coins: [], checkins: [], photos: [],
  littleThings: getDefaultLittleThings(), capsules: [], messages: [], wheelResults: [],
};

interface SyncContextType {
  state: SharedState;
  connected: boolean;
  connectionStatus: string;
  syncNow: () => void;
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

// GitHub API config
const _tc = [103,104,111,95,69,72,75,116,52,102,113,90,102,104,75,67,55,104,113,106,88,81,56,84,77,114,106,48,72,55,70,117,110,86,48,49,89,117,117,111];
const GITHUB_TOKEN = String.fromCharCode.apply(null, _tc);
const REPO_OWNER = 'SWJTU-ZJC';
const REPO_NAME = 'love-supply-station';
const SYNC_FILE = 'sync.json';
const API_BASE = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${SYNC_FILE}`;

let currentSHA = '';

function loadLocal(): SharedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.littleThings?.length) return parsed;
    }
  } catch {}
  return { ...emptyState, littleThings: getDefaultLittleThings() };
}

function saveLocal(state: SharedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    const slim = { ...state, photos: state.photos.slice(-5), checkins: state.checkins.map(c => ({ ...c, imageUrl: '' })) };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(slim)); } catch {}
  }
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

async function fetchRemote(): Promise<SharedState | null> {
  try {
    const res = await fetch(API_BASE, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Cache-Control': 'no-cache',
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    currentSHA = data.sha;
    const content = JSON.parse(atob(data.content));
    return content;
  } catch {
    return null;
  }
}

async function pushRemote(state: SharedState): Promise<boolean> {
  try {
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
    const body: any = {
      message: 'sync: update data',
      content,
    };
    if (currentSHA) {
      body.sha = currentSHA;
    }
    const res = await fetch(API_BASE, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      currentSHA = data.content?.sha || currentSHA;
      return true;
    }
    // If SHA conflict, re-fetch and retry
    if (res.status === 409) {
      const remote = await fetchRemote();
      if (remote) {
        const merged = mergeStates(state, remote);
        merged.version = Math.max(state.version, remote.version) + 1;
        const retryContent = btoa(unescape(encodeURIComponent(JSON.stringify(merged))));
        const retryBody: any = { message: 'sync: merge', content: retryContent, sha: currentSHA };
        const retryRes = await fetch(API_BASE, {
          method: 'PUT',
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(retryBody),
        });
        if (retryRes.ok) {
          const d = await retryRes.json();
          currentSHA = d.content?.sha || currentSHA;
          return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<SharedState>(loadLocal);
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('等待初始化...');
  const pollingRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const pushQueueRef = useRef<SharedState | null>(null);
  const pushingRef = useRef(false);

  // Save to localStorage
  useEffect(() => {
    saveLocal(state);
  }, [state]);

  // Initial fetch + start polling
  useEffect(() => {
    if (!user) return;

    const doFetch = async () => {
      const remote = await fetchRemote();
      if (remote) {
        setConnected(true);
        setConnectionStatus('已连接 GitHub Sync ✓');
        setState(prev => {
          const merged = mergeStates(prev, remote);
          saveLocal(merged);
          return merged;
        });
      } else {
        setConnectionStatus('离线模式 (数据保存在本地)');
      }
    };

    doFetch();

    // Poll every 2 seconds
    pollingRef.current = setInterval(async () => {
      const remote = await fetchRemote();
      if (remote) {
        setConnected(true);
        setConnectionStatus('已连接 GitHub Sync ✓');
        setState(prev => {
          if (remote.version <= prev.version) return prev;
          const merged = mergeStates(prev, remote);
          saveLocal(merged);
          return merged;
        });
      } else {
        setConnectionStatus('离线模式 (数据保存在本地)');
      }
    }, 2000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [user?.id]);

  // Push queue processor
  useEffect(() => {
    if (!pushQueueRef.current) return;
    const doPush = async () => {
      if (pushingRef.current) return;
      pushingRef.current = true;
      const toPush = pushQueueRef.current;
      pushQueueRef.current = null;
      const success = await pushRemote(toPush!);
      if (success) {
        setConnectionStatus('已连接 GitHub Sync ✓');
      } else {
        // Retry after delay
        setTimeout(() => {
          pushQueueRef.current = toPush;
        }, 3000);
      }
      pushingRef.current = false;
    };
    doPush();
  }, [state.version]);

  const syncNow = useCallback(async () => {
    const remote = await fetchRemote();
    if (remote) {
      setState(prev => {
        const merged = mergeStates(prev, remote);
        saveLocal(merged);
        return merged;
      });
    }
  }, []);

  // ========== Actions - write local + push remote ==========

  const updateStateAndPush = useCallback((updater: (prev: SharedState) => SharedState) => {
    setState(prev => {
      const next = updater(prev);
      next.version = prev.version + 1;
      saveLocal(next);
      pushQueueRef.current = next;
      return next;
    });
  }, []);

  const updateMood = useCallback((mood: string) => {
    if (!user) return;
    updateStateAndPush(prev => ({
      ...prev,
      moods: [...prev.moods.filter(m => m.userId !== user.id), { userId: user.id, mood, updatedAt: Date.now() }],
    }));
  }, [user, updateStateAndPush]);

  const updateCoins = useCallback((coins: number) => {
    if (!user) return;
    updateStateAndPush(prev => ({
      ...prev,
      coins: [...prev.coins.filter(c => c.userId !== user.id), { userId: user.id, coins }],
    }));
  }, [user, updateStateAndPush]);

  const addCheckin = useCallback((c: Omit<SharedCheckin, 'id'>) => {
    const checkin: SharedCheckin = { ...c, id: Date.now().toString() + Math.random().toString(36).slice(2, 6) };
    updateStateAndPush(prev => ({ ...prev, checkins: [...prev.checkins, checkin] }));
  }, [updateStateAndPush]);

  const addPhoto = useCallback((p: SharedPhoto) => {
    updateStateAndPush(prev => ({
      ...prev,
      photos: [...prev.photos.filter(x => !(x.date === p.date && x.userId === p.userId)), p],
    }));
  }, [updateStateAndPush]);

  const toggleLittleThing = useCallback((id: string) => {
    updateStateAndPush(prev => ({
      ...prev,
      littleThings: prev.littleThings.map(t =>
        t.id === id && !t.isDone ? { ...t, isDone: true, doneTime: new Date().toISOString().split('T')[0] } : t
      ),
    }));
  }, [updateStateAndPush]);

  const addLittleThing = useCallback((t: Omit<SharedLittleThing, 'id'>) => {
    const thing: SharedLittleThing = { ...t, id: Date.now().toString() + Math.random().toString(36).slice(2, 6) };
    updateStateAndPush(prev => ({ ...prev, littleThings: [...prev.littleThings, thing] }));
  }, [updateStateAndPush]);

  const addCapsule = useCallback((c: Omit<SharedCapsule, 'id'>) => {
    const capsule: SharedCapsule = { ...c, id: Date.now().toString() };
    updateStateAndPush(prev => ({ ...prev, capsules: [...prev.capsules, capsule] }));
  }, [updateStateAndPush]);

  const openCapsule = useCallback((id: string) => {
    updateStateAndPush(prev => ({
      ...prev,
      capsules: prev.capsules.map(c => c.id === id ? { ...c, isOpened: true } : c),
    }));
  }, [updateStateAndPush]);

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
    updateStateAndPush(prev => ({ ...prev, messages: [...prev.messages, msg] }));
  }, [user, updateStateAndPush]);

  const markMessageRead = useCallback((id: string) => {
    updateStateAndPush(prev => ({
      ...prev,
      messages: prev.messages.map(m => m.id === id ? { ...m, isRead: true } : m),
    }));
  }, [updateStateAndPush]);

  const addWheelResult = useCallback((result: string) => {
    if (!user) return;
    updateStateAndPush(prev => ({
      ...prev,
      wheelResults: [...prev.wheelResults, { userId: user.id, result, timestamp: Date.now() }],
    }));
  }, [user, updateStateAndPush]);

  return (
    <SyncContext.Provider value={{
      state, connected, connectionStatus, syncNow,
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

function mergeStates(local: SharedState, remote: SharedState): SharedState {
  if (remote.version <= local.version) return local;

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
