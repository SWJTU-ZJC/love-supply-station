import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import L from 'leaflet';
import confetti from 'canvas-confetti';

interface Checkin {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  imageUrl: string;
  note: string;
  createdAt: string;
}

const mockCheckins: Checkin[] = [
  { id: '1', userId: 'user_1', latitude: 31.2304, longitude: 121.4737, imageUrl: '', note: '第一次约会的地方 💕', createdAt: '2024-01-15' },
  { id: '2', userId: 'user_2', latitude: 31.2354, longitude: 121.4807, imageUrl: '', note: '一起看了烟花 🎆', createdAt: '2024-02-14' },
];

export default function MapPage() {
  const { user, partner } = useAuth();
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [checkins, setCheckins] = useState<Checkin[]>(mockCheckins);
  const [showForm, setShowForm] = useState(false);
  const [selectedCheckin, setSelectedCheckin] = useState<Checkin | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [newNote, setNewNote] = useState('');
  const [pendingPos, setPendingPos] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (viewMode !== 'map' || !mapContainerRef.current) return;
    if (mapRef.current) {
      mapRef.current.invalidateSize();
      return;
    }

    const map = L.map(mapContainerRef.current).setView([31.2304, 121.4737], 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    // Add existing checkins
    checkins.forEach(c => {
      addMarker(map, c);
    });

    // Long press / click to add
    map.on('click', (e: L.LeafletMouseEvent) => {
      setPendingPos({ lat: e.latlng.lat, lng: e.latlng.lng });
      setShowForm(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [viewMode]);

  const addMarker = (map: L.Map, checkin: Checkin) => {
    const icon = L.divIcon({
      className: 'custom-marker',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    const marker = L.marker([checkin.latitude, checkin.longitude], { icon }).addTo(map);
    marker.bindPopup(`
      <div style="font-family: system-ui; padding: 8px; max-width: 200px;">
        ${checkin.imageUrl ? `<img src="${checkin.imageUrl}" style="width:100%; border-radius:8px; margin-bottom:8px;" />` : ''}
        <p style="margin:0 0 4px; color:#4A3F3F; font-size:14px;">${checkin.note}</p>
        <p style="margin:0; color:#9E8F8F; font-size:12px;">${checkin.createdAt}</p>
      </div>
    `);
    marker.on('click', () => setSelectedCheckin(checkin));
  };

  const handleAddCheckin = () => {
    if (!pendingPos || !newNote.trim() || !user) return;
    const checkin: Checkin = {
      id: Date.now().toString(),
      userId: user.id,
      latitude: pendingPos.lat,
      longitude: pendingPos.lng,
      imageUrl: '',
      note: newNote.trim(),
      createdAt: new Date().toISOString().split('T')[0],
    };
    const updated = [...checkins, checkin];
    setCheckins(updated);
    if (mapRef.current) addMarker(mapRef.current, checkin);
    setNewNote('');
    setShowForm(false);
    setPendingPos(null);
    // Reward coins
    // updateUser({ coins: user.coins + 2 });
    confetti({
      particleCount: 30,
      spread: 50,
      origin: { y: 0.8 },
      colors: ['#FFB3B3', '#A0C4FF'],
    });
  };

  return (
    <div className="relative h-[calc(100vh-5rem)]">
      {/* Toggle button */}
      <button
        onClick={() => setViewMode(v => v === 'map' ? 'list' : 'map')}
        className="absolute top-4 right-4 z-[1000] bg-white rounded-full px-4 py-2
                 shadow-soft text-sm font-semibold text-text-primary
                 hover:shadow-soft-lg transition-all"
      >
        {viewMode === 'map' ? '📋 列表' : '🗺️ 地图'}
      </button>

      {viewMode === 'map' ? (
        <div ref={mapContainerRef} className="w-full h-full" />
      ) : (
        <div className="px-4 py-4 space-y-3 overflow-y-auto h-full">
          <h2 className="font-title text-2xl text-text-primary mb-4">📸 记忆时间线</h2>
          {[...checkins].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(c => (
            <div key={c.id} className="bg-white rounded-card p-4 shadow-soft">
              <div className="flex items-start gap-3">
                {c.imageUrl ? (
                  <img src={c.imageUrl} alt="" className="w-20 h-20 rounded-xl object-cover" />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-apricot flex items-center justify-center text-2xl">
                    📍
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary text-sm leading-relaxed">{c.note}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-text-secondary">{c.createdAt}</span>
                    <span className="text-xs text-blush">
                      {c.userId === user?.id ? '我' : partner?.nickname} 打卡
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add checkin form */}
      {showForm && pendingPos && (
        <div className="fixed inset-0 z-[2000] flex items-end justify-center pointer-events-none">
          <div className="w-full max-w-app bg-white rounded-t-card shadow-soft-lg p-5 pointer-events-auto
                        animate-[fadeSlideIn_0.3s_ease-out]">
            <h3 className="font-semibold text-text-primary mb-3">在这里打卡 📍</h3>
            <textarea
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="写下此刻的心情..."
              className="w-full px-4 py-3 rounded-btn bg-apricot/50 text-text-primary text-sm
                       focus:outline-none focus:ring-2 focus:ring-blush/50 mb-3 resize-none h-20"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowForm(false); setPendingPos(null); }}
                className="flex-1 py-3 rounded-btn bg-apricot text-text-primary font-semibold"
              >
                取消
              </button>
              <button
                onClick={handleAddCheckin}
                disabled={!newNote.trim()}
                className="flex-1 py-3 rounded-btn text-white font-semibold
                         bg-[radial-gradient(circle_at_30%_30%,#FFB3B3,#FFC3A0)]
                         disabled:opacity-50"
              >
                记录 💕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected checkin popup */}
      {selectedCheckin && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-[2000] p-4"
             onClick={() => setSelectedCheckin(null)}>
          <div className="bg-white rounded-card p-6 shadow-soft-lg max-w-sm w-full animate-[gachaDrop_0.5s_ease-out]"
               onClick={e => e.stopPropagation()}>
            {selectedCheckin.imageUrl && (
              <img src={selectedCheckin.imageUrl} alt="" className="w-full h-48 object-cover rounded-xl mb-4" />
            )}
            <p className="text-text-primary text-base mb-2">{selectedCheckin.note}</p>
            <p className="text-text-secondary text-sm">{selectedCheckin.createdAt}</p>
            <button
              onClick={() => setSelectedCheckin(null)}
              className="mt-4 w-full py-3 rounded-btn text-white font-semibold
                       bg-[radial-gradient(circle_at_30%_30%,#FFB3B3,#FFC3A0)]"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
