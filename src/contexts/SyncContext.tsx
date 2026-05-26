import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import Peer from 'peerjs';
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
  reconnect: () => void;
  getShareUrl: () => string;
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
  } catch (e) {
    console.warn('localStorage full, purging old photos...');
    // Remove large photo data if storage is full
    const slim = { ...state, photos: state.photos.slice(-5), checkins: state.checkins.map(c => ({ ...c, imageUrl: '' })) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
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

// PeerJS signaling servers - try multiple
const SIGNAL_HOSTS = [
  { host: '0.peerjs.com', port: 443, secure: true },
  { host: 'peerjs-server.herokuapp.com', port: 443, secure: true },
];

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user, coupleCode } = useAuth();
  const [state, setState] = useState<SharedState>(() => {
    const local = loadLocal();
    // Check URL for shared data
    const hash = window.location.hash;
    if (hash.includes('sync=')) {
      try {
        const encoded = hash.split('sync=')[1]?.split('&')[0];
        if (encoded) {
          const remote = JSON.parse(decodeURIComponent(atob(encoded)));
          const merged = mergeStates(local, remote);
          window.location.hash = '';
          return merged;
        }
      } catch {}
    }
    return local;
  });
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('正在连接...');
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<any>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const signalIndexRef = useRef(0);

  // Save to localStorage
  useEffect(() => {
    saveLocal(state);
  }, [state]);

  // Check URL hash periodically for incoming sync
  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash;
      if (hash.includes('sync=')) {
        try {
          const encoded = hash.split('sync=')[1]?.split('&')[0];
          if (encoded) {
            const remote = JSON.parse(decodeURIComponent(atob(encoded)));
            setState(prev => {
              const merged = mergeStates(prev, remote);
              saveLocal(merged);
              return merged;
            });
            window.location.hash = '';
            setConnectionStatus('已通过链接同步 ✓');
          }
        } catch {}
      }
    };
    const interval = setInterval(checkHash, 2000);
    window.addEventListener('hashchange', checkHash);
    return () => {
      clearInterval(interval);
      window.removeEventListener('hashchange', checkHash);
    };
  }, []);

  // Generate share URL
  const getShareUrl = useCallback(() => {
    const slimState = {
      ...state,
      photos: state.photos.map(p => ({ ...p, imageUrl: p.imageUrl?.length > 500 ? '[photo]' : p.imageUrl })),
      checkins: state.checkins.map(c => ({ ...c, imageUrl: c.imageUrl?.length > 500 ? '[photo]' : c.imageUrl })),
    };
    const encoded = btoa(encodeURIComponent(JSON.stringify(slimState)));
    const base = window.location.href.split('#')[0];
    return `${base}#/home?sync=${encoded}`;
  }, [state]);

  // P2P connection
  const connectPeer = useCallback((signalHost: typeof SIGNAL_HOSTS[0]) => {
    if (!user || !coupleCode || !peerRef.current) return;

    const partnerPeerId = `love-${coupleCode}-${user.partnerId}`;

    setConnectionStatus(`连接中 (${signalHost.host})...`);

    const conn = peerRef.current.connect(partnerPeerId, { reliable: true });

    let connected = false;
    const timeout = setTimeout(() => {
      if (!connected) {
        conn.close();
        setConnectionStatus('连接超时，重试中...');
      }
    }, 10000);

    conn.on('open', () => {
      connected = true;
      clearTimeout(timeout);
      console.log('💚 P2P connected!');
      connRef.current = conn;
      setConnected(true);
      setConnectionStatus('已连接 ✓');
      // Send full state
      setState(prev => {
        try { conn.send({ type: 'SYNC', state: prev }); } catch {}
        return prev;
      });
    });

    conn.on('data', (data: any) => {
      if (data?.type === 'SYNC' && data.state) {
        console.log('📥 Received sync data');
        setState(prev => mergeStates(prev, data.state));
      }
      if (data?.type === 'MESSAGE') {
        setState(prev => {
          const msg = data.message as SharedMessage;
          if (prev.messages.find(m => m.id === msg.id)) return prev;
          return { ...prev, messages: [...prev.messages, msg] };
        });
      }
    });

    conn.on('close', () => {
      if (connRef.current === conn) {
        connRef.current = null;
        setConnected(false);
        setConnectionStatus('连接断开，重连中...');
        scheduleRetry();
      }
    });

    conn.on('error', () => {
      if (connRef.current === conn) {
        connRef.current = null;
        setConnected(false);
        scheduleRetry();
      }
    });
  }, [user, coupleCode]);

  const scheduleRetry = useCallback(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(() => {
      signalIndexRef.current = (signalIndexRef.current + 1) % SIGNAL_HOSTS.length;
      if (peerRef.current && !peerRef.current.destroyed) {
        connectPeer(SIGNAL_HOSTS[signalIndexRef.current]);
      }
    }, 5000);
  }, [connectPeer]);

  const reconnect = useCallback(() => {
    if (peerRef.current) peerRef.current.destroy();
    setConnected(false);
    setConnectionStatus('重新连接...');
    signalIndexRef.current = 0;
    initPeer(SIGNAL_HOSTS[0]);
  }, []);

  const initPeer = useCallback((signalHost: typeof SIGNAL_HOSTS[0]) => {
    if (!user || !coupleCode) return;

    const myPeerId = `love-${coupleCode}-${user.id}`;

    try {
      const peer = new Peer(myPeerId, signalHost);
      peerRef.current = peer;

      peer.on('open', () => {
        console.log('📡 Peer ready:', myPeerId);
        connectPeer(signalHost);
      });

      peer.on('connection', (conn) => {
        console.log('📞 Incoming connection');
        connRef.current = conn;
        setConnected(true);
        setConnectionStatus('已连接 ✓');

        conn.on('open', () => {
          setState(prev => {
            try { conn.send({ type: 'SYNC', state: prev }); } catch {}
            return prev;
          });
        });

        conn.on('data', (data: any) => {
          if (data?.type === 'SYNC' && data.state) {
            setState(prev => mergeStates(prev, data.state));
          }
          if (data?.type === 'MESSAGE') {
            setState(prev => {
              const msg = data.message as SharedMessage;
              if (prev.messages.find(m => m.id === msg.id)) return prev;
              return { ...prev, messages: [...prev.messages, msg] };
            });
          }
        });

        conn.on('close', () => {
          setConnected(false);
          setConnectionStatus('连接断开');
          scheduleRetry();
        });
      });

      peer.on('error', (err) => {
        console.log('⚠️ Peer error:', err.message);
        if (err.type === 'unavailable-id') {
          // ID conflict - wait and retry
          setTimeout(() => {
            if (peerRef.current && !peerRef.current.destroyed) {
              connectPeer(SIGNAL_HOSTS[signalIndexRef.current]);
            }
          }, 3000);
        } else {
          scheduleRetry();
        }
      });

      peer.on('disconnected', () => {
        setConnected(false);
        setConnectionStatus('已断开');
        if (peerRef.current && !peerRef.current.destroyed) {
          peerRef.current.reconnect();
        }
      });
    } catch (e) {
      console.error('Failed to create peer:', e);
      scheduleRetry();
    }
  }, [user, coupleCode, connectPeer, scheduleRetry]);

  // Initialize P2P on mount
  useEffect(() => {
    if (!user || !coupleCode) return;
    signalIndexRef.current = 0;
    initPeer(SIGNAL_HOSTS[0]);

    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (connRef.current) try { connRef.current.close(); } catch {}
      if (peerRef.current) try { peerRef.current.destroy(); } catch {}
    };
  }, [user?.id]);

  // ========== Actions ==========

  const updateMood = useCallback((mood: string) => {
    if (!user) return;
    updateState(prev => ({
      ...prev,
      version: prev.version + 1,
      moods: [...prev.moods.filter(m => m.userId !== user.id), { userId: user.id, mood, updatedAt: Date.now() }],
    }));
  }, [user]);

  const updateCoins = useCallback((coins: number) => {
    if (!user) return;
    updateState(prev => ({
      ...prev,
      version: prev.version + 1,
      coins: [...prev.coins.filter(c => c.userId !== user.id), { userId: user.id, coins }],
    }));
  }, [user]);

  const addCheckin = useCallback((c: Omit<SharedCheckin, 'id'>) => {
    const checkin: SharedCheckin = { ...c, id: Date.now().toString() + Math.random().toString(36).slice(2, 6) };
    updateState(prev => ({ ...prev, version: prev.version + 1, checkins: [...prev.checkins, checkin] }));
  }, []);

  const addPhoto = useCallback((p: SharedPhoto) => {
    updateState(prev => ({
      ...prev,
      version: prev.version + 1,
      photos: [...prev.photos.filter(x => !(x.date === p.date && x.userId === p.userId)), p],
    }));
  }, []);

  const toggleLittleThing = useCallback((id: string) => {
    updateState(prev => ({
      ...prev,
      version: prev.version + 1,
      littleThings: prev.littleThings.map(t =>
        t.id === id && !t.isDone ? { ...t, isDone: true, doneTime: new Date().toISOString().split('T')[0] } : t
      ),
    }));
  }, []);

  const addLittleThing = useCallback((t: Omit<SharedLittleThing, 'id'>) => {
    const thing: SharedLittleThing = { ...t, id: Date.now().toString() + Math.random().toString(36).slice(2, 6) };
    updateState(prev => ({ ...prev, version: prev.version + 1, littleThings: [...prev.littleThings, thing] }));
  }, []);

  const addCapsule = useCallback((c: Omit<SharedCapsule, 'id'>) => {
    const capsule: SharedCapsule = { ...c, id: Date.now().toString() };
    updateState(prev => ({ ...prev, version: prev.version + 1, capsules: [...prev.capsules, capsule] }));
  }, []);

  const openCapsule = useCallback((id: string) => {
    updateState(prev => ({
      ...prev,
      version: prev.version + 1,
      capsules: prev.capsules.map(c => c.id === id ? { ...c, isOpened: true } : c),
    }));
  }, []);

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
    updateState(prev => ({ ...prev, version: prev.version + 1, messages: [...prev.messages, msg] }));
    if (connRef.current?.open) {
      try { connRef.current.send({ type: 'MESSAGE', message: msg }); } catch {}
    }
  }, [user]);

  const markMessageRead = useCallback((id: string) => {
    updateState(prev => ({
      ...prev,
      version: prev.version + 1,
      messages: prev.messages.map(m => m.id === id ? { ...m, isRead: true } : m),
    }));
  }, []);

  const addWheelResult = useCallback((result: string) => {
    if (!user) return;
    updateState(prev => ({
      ...prev,
      version: prev.version + 1,
      wheelResults: [...prev.wheelResults, { userId: user.id, result, timestamp: Date.now() }],
    }));
  }, [user]);

  // Broadcast state to peer on changes
  const broadcast = useCallback((s: SharedState) => {
    if (connRef.current?.open) {
      try { connRef.current.send({ type: 'SYNC', state: s }); } catch {}
    }
  }, []);

  const updateState = useCallback((updater: (prev: SharedState) => SharedState) => {
    setState(prev => {
      const next = updater(prev);
      saveLocal(next);
      setTimeout(() => broadcast(next), 50);
      return next;
    });
  }, [broadcast]);

  return (
    <SyncContext.Provider value={{
      state, connected, connectionStatus, reconnect, getShareUrl,
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
  // Keep the one with higher version or merge
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
