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
  moods: [], coins: [], checkins: [], photos: [],
  littleThings: [], capsules: [], messages: [], wheelResults: [],
};

interface SyncContextType {
  state: SharedState;
  connected: boolean;
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
    if (raw) return JSON.parse(raw);
  } catch {}
  return { ...emptyState, littleThings: getDefaultLittleThings() };
}

function saveLocal(state: SharedState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user, coupleCode } = useAuth();
  const [state, setState] = useState<SharedState>(loadLocal);
  const [connected, setConnected] = useState(false);
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<any | null>(null);
  const peerIdRef = useRef<string>('');

  // Save to localStorage whenever state changes
  useEffect(() => {
    saveLocal(state);
  }, [state]);

  // Broadcast state to peer
  const broadcast = useCallback((newState: SharedState) => {
    if (connRef.current?.open) {
      connRef.current.send({ type: 'SYNC', state: newState });
    }
  }, []);

  const updateState = useCallback((updater: (prev: SharedState) => SharedState) => {
    setState(prev => {
      const next = updater(prev);
      saveLocal(next);
      setTimeout(() => broadcast(next), 0);
      return next;
    });
  }, [broadcast]);

  // ========== PeerJS Connection ==========
  useEffect(() => {
    if (!user || !coupleCode) return;

    const myPeerId = `love-${coupleCode}-${user.id}`;
    const partnerPeerId = `love-${coupleCode}-${user.partnerId}`;
    peerIdRef.current = myPeerId;

    const peer = new Peer(myPeerId, {
      host: '0.peerjs.com',
      port: 443,
      secure: true,
      debug: 1,
    });

    peerRef.current = peer;

    peer.on('open', () => {
      console.log('📡 P2P ready:', myPeerId);
      // Try to connect to partner
      const conn = peer.connect(partnerPeerId, { reliable: true });
      setupConnection(conn);
    });

    peer.on('connection', (conn) => {
      console.log('📞 Incoming connection from partner');
      setupConnection(conn);
    });

    peer.on('error', (err) => {
      console.log('⚠️ Peer error:', err.message);
      // Retry connection after delay
      setTimeout(() => {
        if (peerRef.current && !peerRef.current.destroyed) {
          const conn = peer.connect(partnerPeerId, { reliable: true });
          setupConnection(conn);
        }
      }, 5000);
    });

    function setupConnection(conn: any) {
      conn.on('open', () => {
        console.log('💚 Connected to partner!');
        connRef.current = conn;
        setConnected(true);
        // Send full state on connect
        setState(prev => {
          conn.send({ type: 'SYNC', state: prev });
          return prev;
        });
      });

      conn.on('data', (data: any) => {
        if (data?.type === 'SYNC' && data.state) {
          console.log('📥 Received state from partner');
          setState(prev => mergeStates(prev, data.state));
        }
        if (data?.type === 'MESSAGE') {
          console.log('💌 New message from partner');
          setState(prev => {
            const msg = data.message as SharedMessage;
            const exists = prev.messages.find(m => m.id === msg.id);
            if (exists) return prev;
            return { ...prev, messages: [...prev.messages, msg] };
          });
        }
      });

      conn.on('close', () => {
        console.log('🔌 Partner disconnected');
        setConnected(false);
        connRef.current = null;
        // Retry
        setTimeout(() => {
          if (peerRef.current && !peerRef.current.destroyed) {
            const newConn = peer.connect(partnerPeerId, { reliable: true });
            setupConnection(newConn);
          }
        }, 3000);
      });

      conn.on('error', () => {
        setConnected(false);
      });
    }

    return () => {
      if (connRef.current) connRef.current.close();
      if (peerRef.current) peerRef.current.destroy();
    };
  }, [user?.id, coupleCode]);

  // ========== Actions ==========

  const updateMood = useCallback((mood: string) => {
    if (!user) return;
    updateState(prev => ({
      ...prev,
      moods: [
        ...prev.moods.filter(m => m.userId !== user.id),
        { userId: user.id, mood, updatedAt: Date.now() },
      ],
    }));
  }, [user, updateState]);

  const updateCoins = useCallback((coins: number) => {
    if (!user) return;
    updateState(prev => ({
      ...prev,
      coins: [
        ...prev.coins.filter(c => c.userId !== user.id),
        { userId: user.id, coins },
      ],
    }));
  }, [user, updateState]);

  const addCheckin = useCallback((c: Omit<SharedCheckin, 'id'>) => {
    const checkin: SharedCheckin = { ...c, id: Date.now().toString() + Math.random().toString(36).slice(2, 6) };
    updateState(prev => ({ ...prev, checkins: [...prev.checkins, checkin] }));
  }, [updateState]);

  const addPhoto = useCallback((p: SharedPhoto) => {
    updateState(prev => ({
      ...prev,
      photos: [...prev.photos.filter(x => !(x.date === p.date && x.userId === p.userId)), p],
    }));
  }, [updateState]);

  const toggleLittleThing = useCallback((id: string) => {
    updateState(prev => ({
      ...prev,
      littleThings: prev.littleThings.map(t =>
        t.id === id && !t.isDone
          ? { ...t, isDone: true, doneTime: new Date().toISOString().split('T')[0] }
          : t
      ),
    }));
  }, [updateState]);

  const addLittleThing = useCallback((t: Omit<SharedLittleThing, 'id'>) => {
    const thing: SharedLittleThing = { ...t, id: Date.now().toString() + Math.random().toString(36).slice(2, 6) };
    updateState(prev => ({ ...prev, littleThings: [...prev.littleThings, thing] }));
  }, [updateState]);

  const addCapsule = useCallback((c: Omit<SharedCapsule, 'id'>) => {
    const capsule: SharedCapsule = { ...c, id: Date.now().toString() };
    updateState(prev => ({ ...prev, capsules: [...prev.capsules, capsule] }));
  }, [updateState]);

  const openCapsule = useCallback((id: string) => {
    updateState(prev => ({
      ...prev,
      capsules: prev.capsules.map(c => c.id === id ? { ...c, isOpened: true } : c),
    }));
  }, [updateState]);

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
    updateState(prev => ({ ...prev, messages: [...prev.messages, msg] }));
    // Also send directly via data channel for immediate delivery
    if (connRef.current?.open) {
      connRef.current.send({ type: 'MESSAGE', message: msg });
    }
  }, [user, updateState]);

  const markMessageRead = useCallback((id: string) => {
    updateState(prev => ({
      ...prev,
      messages: prev.messages.map(m => m.id === id ? { ...m, isRead: true } : m),
    }));
  }, [updateState]);

  const addWheelResult = useCallback((result: string) => {
    if (!user) return;
    updateState(prev => ({
      ...prev,
      wheelResults: [...prev.wheelResults, { userId: user.id, result, timestamp: Date.now() }],
    }));
  }, [user, updateState]);

  return (
    <SyncContext.Provider value={{
      state, connected,
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

// Merge partner's state with local state (partner's data wins for their own items)
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
