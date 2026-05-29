import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../contexts/SyncContext';
import L from 'leaflet';
import confetti from 'canvas-confetti';
import { useTheme, themeColors } from '../contexts/ThemeContext';
import { spriteUrl, getAvatarSprite } from '../components/PixelSprite';

function compressToDataUrl(file: File, maxW: number = 800, quality: number = 0.75): Promise<string> {
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

export default function MapPage() {
  const { user, partner } = useAuth();
  const { state, addCheckin, deleteCheckin, updateCoins } = useSync();
  const { theme, uiMode } = useTheme();
  const tc = themeColors[theme];
  const isPixel = uiMode === 'pixel';
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedCheckin, setSelectedCheckin] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [newNote, setNewNote] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [gpsPos, setGpsPos] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsErr, setGpsErr] = useState('');
  const markersRef = useRef<L.Marker[]>([]);
  const locationMarkerRef = useRef<L.Marker | null>(null);
  const [placeNames, setPlaceNames] = useState<Record<string, string>>({});
  const placeCacheRef = useRef<Record<string, string>>({});

  // Reverse geocode: get place name from coords
  const fetchPlaceName = async (lat: number, lng: number) => {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (placeCacheRef.current[key]) return;
    placeCacheRef.current[key] = '...';
    try {
      let name = '';
      try {
        const res = await fetch(`https://restapi.amap.com/v3/geocode/regeo?key=a7beac025cbc7c2c55d5517c82d03b44&location=${lng},${lat}&radius=1000&extensions=base&output=json`);
        if (res.ok) {
          const d = await res.json();
          if (d.status === '1' && d.regeocode) {
            name = d.regeocode.formatted_address || '';
          }
        }
      } catch {}
      if (name) {
        placeCacheRef.current[key] = name;
        setPlaceNames(prev => ({ ...prev, [key]: name }));
      } else {
        delete placeCacheRef.current[key];
      }
    } catch {
      delete placeCacheRef.current[key];
    }
  };

  // Look up place names for existing checkins
  useEffect(() => {
    const checkins = state.checkins || [];
    for (const c of checkins) {
      fetchPlaceName(c.latitude, c.longitude);
    }
  }, [state.checkins]);

  const checkins = state.checkins || [];
  const myCoins = state.coins.find(c => c.userId === user?.id)?.coins ?? 5;

  const getPos = useCallback(async () => {
    setGpsErr('');
    // Try browser GPS first (high accuracy)
    const tryGPS = (): Promise<{ lat: number; lng: number } | null> => new Promise(resolve => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
      );
    });
    // Amap coordinate convert (GPS → GCJ02 for better map alignment)
    const convertAmap = async (lng: number, lat: number): Promise<{ lat: number; lng: number } | null> => {
      try {
        const res = await fetch(`https://restapi.amap.com/v3/assistant/coordinate/convert?key=a7beac025cbc7c2c55d5517c82d03b44&locations=${lng},${lat}&coordsys=gps&output=json`);
        const d = await res.json();
        if (d.status === '1' && d.locations) {
          const [lng2, lat2] = d.locations.split(',').map(Number);
          return { lat: lat2, lng: lng2 };
        }
      } catch {}
      return null;
    };
    // Amap IP fallback when GPS fails
    const tryAmapIP = async (): Promise<{ lat: number; lng: number } | null> => {
      try {
        const res = await fetch(`https://restapi.amap.com/v3/ip?key=a7beac025cbc7c2c55d5517c82d03b44`);
        const d = await res.json();
        if (d.status === '1' && d.rectangle) {
          const [lng1, lat1, lng2, lat2] = d.rectangle.split(';')[0].split(',').map(Number);
          return { lat: (lat1 + lat2) / 2, lng: (lng1 + lng2) / 2 };
        }
      } catch {}
      return null;
    };

    const gpsResult = await tryGPS();
    if (gpsResult) {
      const converted = await convertAmap(gpsResult.lng, gpsResult.lat);
      if (converted) {
        setGpsPos(converted);
      } else {
        setGpsPos(gpsResult);
      }
      setGpsErr('');
      return;
    }
    // Fallback to Amap IP
    const ipResult = await tryAmapIP();
    if (ipResult) {
      setGpsPos(ipResult);
      setGpsErr('IP粗略定位');
    } else {
      setGpsErr('定位失败，请检查权限');
    }
  }, []);

  useEffect(() => {
    getPos();
  }, [getPos]);

  useEffect(() => {
    if (viewMode !== 'map' || !mapContainerRef.current) return;

    if (mapRef.current) {
      mapRef.current.invalidateSize();
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      checkins.forEach(c => addMarker(mapRef.current!, c));
      return;
    }

    const defaultCenter: [number, number] = gpsPos
      ? [gpsPos.lat, gpsPos.lng]
      : [31.2304, 121.4737];

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView(defaultCenter, 14);

    L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
      subdomains: ['1', '2', '3', '4'],
      maxZoom: 18,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.attribution({ position: 'bottomleft', prefix: '© 高德地图' }).addTo(map);

    checkins.forEach(c => addMarker(map, c));
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [viewMode, checkins, gpsPos]);

  // Current location marker (independent of checkin markers)
  useEffect(() => {
    if (viewMode !== 'map' || !mapRef.current) {
      if (locationMarkerRef.current) {
        locationMarkerRef.current.remove();
        locationMarkerRef.current = null;
      }
      return;
    }
    if (!gpsPos) {
      if (locationMarkerRef.current) {
        locationMarkerRef.current.remove();
        locationMarkerRef.current = null;
      }
      return;
    }
    if (locationMarkerRef.current) {
      locationMarkerRef.current.setLatLng([gpsPos.lat, gpsPos.lng]);
    } else {
      const icon = L.divIcon({
        html: '<div class="location-dot-marker"></div>',
        className: 'location-marker-container',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      locationMarkerRef.current = L.marker([gpsPos.lat, gpsPos.lng], { icon, zIndexOffset: 1000 })
        .addTo(mapRef.current);
    }
  }, [gpsPos, viewMode]);

  const addMarker = (map: L.Map, checkin: any) => {
    const isMine = checkin.userId === user?.id;
    const avatarEmoji = isMine ? (user?.avatar || '🐰') : (partner?.avatar || '🐻');
    const spriteName = getAvatarSprite(avatarEmoji);
    const spriteSrc = spriteUrl(spriteName);
    const emoji = isMine ? user?.avatar || '🐰' : partner?.avatar || '🐻';
    const spriteImg = `<img src='${spriteSrc}' width=40 height=40 style='image-rendering:pixelated;display:block'>`;
    const icon = L.divIcon({
      html: `<div style="
        width:44px;height:44px;border-radius:50%;
        background:${isMine ? 'var(--color-primary)' : 'var(--color-blue)'};
        display:flex;align-items:center;justify-content:center;
        font-size:22px;
        border:3px solid white;
        box-shadow:0 4px 16px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.06);
      ">${isPixel ? spriteImg : emoji}</div>`,
      className: 'checkin-marker',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
    const marker = L.marker([checkin.latitude, checkin.longitude], { icon }).addTo(map);
    marker.bindPopup(`
      <div style="font-family: system-ui; padding: 8px; max-width: 200px;">
        ${checkin.imageUrl ? `<img src="${checkin.imageUrl}" style="width:100%; border-radius:8px; margin-bottom:6px;" />` : ''}
        <p style="margin:0 0 4px; color:var(--color-text); font-size:14px;">${checkin.note}</p>
        <p style="margin:0; color:var(--color-text-soft); font-size:11px;">${checkin.createdAt} · ${isMine ? '我' : partner?.nickname}</p>
      </div>
    `);
    marker.on('click', () => setSelectedCheckin(checkin));
    markersRef.current.push(marker);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleCheckin = async () => {
    if (!gpsPos || !newNote.trim() || !user) return;
    setUploading(true);

    let imageUrl = '';
    if (photoFile) {
      try {
        imageUrl = await compressToDataUrl(photoFile);
      } catch (e) {
        console.error('[map] photo compress error:', e);
      }
    }

    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    addCheckin({
      userId: user.id,
      latitude: gpsPos.lat,
      longitude: gpsPos.lng,
      imageUrl,
      note: newNote.trim(),
      createdAt: ts,
    });

    updateCoins(myCoins + 2);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 }, colors: [tc.primary, tc.blue] });

    setNewNote('');
    setPhotoFile(null);
    setPhotoPreview('');
    setShowForm(false);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="relative h-[calc(100vh-5rem)]">
      {/* View toggle */}
      <button
        onClick={() => setViewMode(v => v === 'map' ? 'list' : 'map')}
        className="absolute top-4 right-4 z-[1000] bg-white rounded-full px-4 py-2
                   shadow-soft text-sm font-semibold text-text-primary hover:shadow-soft-lg transition-all"
      >
        {viewMode === 'map' ? '📋 列表' : '🗺️ 地图'}
      </button>

      {/* GPS status + coins */}
      <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2">
        <div className="bg-white rounded-full px-3 py-1.5 shadow-soft flex items-center gap-2 text-sm">
          <span className={`w-2 h-2 rounded-full ${gpsPos ? 'bg-mint' : 'bg-red-400 animate-pulse'}`} />
          <span className="text-text-secondary text-xs">{gpsPos ? '已定位' : gpsErr || '定位中...'}</span>
        </div>
        <div className="bg-white rounded-full px-3 py-1.5 shadow-soft text-sm">
          <span className="text-text-secondary text-xs">🪙 {myCoins}</span>
        </div>
      </div>

      {viewMode === 'map' ? (
        <>
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Check-in button */}
          <button
            onClick={() => { getPos(); setShowForm(true); }}
            disabled={!gpsPos}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[1000]
                     px-6 py-3 rounded-full shadow-soft-lg text-white font-semibold
                     btn-gradient
                     disabled:opacity-40 hover:shadow-xl active:scale-95 transition-all"
          >
            📍 在此打卡 +2🪙
          </button>
        </>
      ) : (
        <div className="px-4 py-4 space-y-3 overflow-y-auto h-full">
          <h2 className="font-title text-2xl text-text-primary mb-4">📸 我们的足迹</h2>
          {[...checkins].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(c => (
            <div key={c.id} className="bg-white rounded-card p-4 shadow-soft relative group">
              {c.userId === user?.id && (
                <button
                  onClick={() => { if (confirm('确定要删除这条打卡记录吗？')) deleteCheckin(c.id); }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/10 text-text-secondary
                           flex items-center justify-center text-xs opacity-0 group-hover:opacity-100
                           hover:bg-red-500 hover:text-white transition-all z-10"
                >
                  ✕
                </button>
              )}
              <div className="flex items-start gap-3">
                {c.imageUrl ? (
                  <img src={c.imageUrl} alt="" className="w-20 h-20 rounded-xl object-cover" />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-apricot flex items-center justify-center text-2xl">📍</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary text-sm leading-relaxed">{c.note}</p>
                  <p className="text-xs text-text-secondary mt-0.5" style={{ fontFamily: '\'PingFang SC\', \'Microsoft YaHei\', \'Noto Sans SC\', sans-serif' }}>
                    📍 {c.latitude.toFixed(4)}, {c.longitude.toFixed(4)}
                    {(() => { const key = `${c.latitude.toFixed(4)},${c.longitude.toFixed(4)}`; const place = placeNames[key]; return place && place !== '...' ? ` - ${place}` : ''; })()}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-text-secondary">{c.createdAt}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full"
                          style={{
                            backgroundColor: c.userId === user?.id
                              ? `color-mix(in srgb, var(--color-primary) 25%, transparent)`
                              : `color-mix(in srgb, var(--color-blue) 25%, transparent)`,
                            color: 'var(--color-text)',
                          }}>
                      {c.userId === user?.id ? '我' : partner?.nickname}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {checkins.length === 0 && (
            <div className="text-center py-16 text-text-secondary">
              <span className="text-5xl block mb-3">🗺️</span>
              <p className="font-semibold">还没有打卡记录</p>
              <p className="text-sm mt-1">一起去哪里玩的时候就打卡吧~</p>
            </div>
          )}
        </div>
      )}

      {/* Check-in form modal */}
      {showForm && (
        <div className="fixed inset-0 z-[2000] flex items-end justify-center"
             onClick={() => setShowForm(false)}>
          <div className="w-full max-w-app bg-white rounded-t-card shadow-soft-lg p-5
                        animate-[fadeSlideIn_0.3s_ease-out]"
               onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-text-primary mb-3">
              📍 {gpsPos ? `当前位置打卡` : '定位中...'} +2🪙
            </h3>

            {/* Photo preview */}
            {photoPreview && (
              <div className="relative mb-3 inline-block">
                <img src={photoPreview} alt="" className="w-24 h-24 rounded-xl object-cover" />
                <button
                  onClick={() => { setPhotoFile(null); setPhotoPreview(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-black/50 text-white
                           flex items-center justify-center text-xs"
                >✕</button>
              </div>
            )}

            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-btn bg-apricot/50 text-text-secondary text-sm
                         hover:bg-apricot transition-colors"
              >
                📷 {photoFile ? '更换照片' : '添加照片'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="absolute left-0 top-0 w-0 h-0 opacity-0 pointer-events-none"
              />
            </div>

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
                onClick={() => { setShowForm(false); setPhotoFile(null); setPhotoPreview(''); }}
                className="flex-1 py-3 rounded-btn bg-apricot text-text-primary font-semibold"
              >取消</button>
              <button
                onClick={handleCheckin}
                disabled={!newNote.trim() || !gpsPos || uploading}
                className="flex-1 py-3 rounded-btn text-white font-semibold
                         btn-gradient disabled:opacity-50">
                {uploading ? '上传中...' : '打卡 💕'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selectedCheckin && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-[2000] p-4"
             onClick={() => setSelectedCheckin(null)}>
          <div className="bg-white rounded-card p-6 shadow-soft-lg max-w-sm w-full animate-[gachaDrop_0.5s_ease-out]"
               onClick={e => e.stopPropagation()}>
            {selectedCheckin.imageUrl && (
              <img src={selectedCheckin.imageUrl} alt="" className="w-full h-48 object-cover rounded-xl mb-4" />
            )}
            <p className="text-text-primary text-base mb-2">{selectedCheckin.note}</p>
            <div className="flex items-center gap-2">
              <p className="text-text-secondary text-sm">{selectedCheckin.createdAt}</p>
              <span className="text-xs px-1.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: selectedCheckin.userId === user?.id
                        ? `color-mix(in srgb, var(--color-primary) 25%, transparent)`
                        : `color-mix(in srgb, var(--color-blue) 25%, transparent)`,
                      color: 'var(--color-text)',
                    }}>
                {selectedCheckin.userId === user?.id ? '我' : partner?.nickname}
              </span>
            </div>
            <button onClick={() => setSelectedCheckin(null)}
              className="mt-4 w-full py-3 rounded-btn text-white font-semibold
                       btn-gradient">
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
