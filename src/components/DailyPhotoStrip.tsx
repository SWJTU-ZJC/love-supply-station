import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../contexts/SyncContext';

export default function DailyPhotoStrip() {
  const { user, partner } = useAuth();
  const { state, uploadPhoto } = useSync();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  const photos = state.photos || [];
  const getUrl = (p: any) => p.url || p.imageUrl || '';
  const getCreated = (p: any) => p.createdAt || new Date(p.date || 0).getTime();
  const todayStart = new Date(today).getTime();
  const todayEnd = todayStart + 86400000;

  const todayPhotos = photos.filter(p => {
    const t = getCreated(p);
    return t >= todayStart && t < todayEnd;
  });
  const myToday = todayPhotos.find(p => p.userId === user?.id);
  const partnerToday = todayPhotos.find(p => p.userId === partner?.id);

  const pastPhotos = photos
    .filter(p => {
      const t = getCreated(p);
      return t < todayStart;
    })
    .sort((a, b) => getCreated(b) - getCreated(a))
    .slice(0, 10);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    await uploadPhoto(file, '');
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-text-primary flex items-center gap-2">
          <span>🎬</span> 我们的电影
        </h3>
        <button
          onClick={() => navigate('/movie')}
          className="text-xs text-blush hover:text-sunset transition-colors"
        >
          查看全部 →
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
        {!myToday && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex-shrink-0 w-36 h-48 rounded-card bg-white border-2 border-dashed
                     border-blush/40 flex flex-col items-center justify-center gap-2
                     hover:border-blush hover:bg-apricot/50 transition-all duration-300
                     snap-center group"
          >
            <span className="text-4xl group-hover:scale-110 transition-transform">
              {uploading ? '⏳' : '📷'}
            </span>
            <span className="text-sm text-text-secondary">今日一拍</span>
            <span className="text-3xl text-blush font-light">+</span>
          </button>
        )}

        {myToday && (
          <div className="flex-shrink-0 w-36 h-48 rounded-card overflow-hidden shadow-soft snap-center relative group">
            <img src={getUrl(myToday)} alt="今天" className="w-full h-full object-cover" />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent p-2">
              <span className="text-white text-xs">我的 · 今天</span>
            </div>
          </div>
        )}

        {partnerToday && (
          <div className="flex-shrink-0 w-36 h-48 rounded-card overflow-hidden shadow-soft snap-center relative group">
            <img src={getUrl(partnerToday)} alt="Ta的今天" className="w-full h-full object-cover" />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent p-2">
              <span className="text-white text-xs">{partner?.nickname} · 今天</span>
            </div>
          </div>
        )}

        {pastPhotos.map(photo => (
          <div key={photo.id}
            className="flex-shrink-0 w-36 h-48 rounded-card overflow-hidden shadow-soft snap-center relative">
            <img src={getUrl(photo)} alt="" className="w-full h-full object-cover" />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent p-2">
              <span className="text-white text-xs">
                {photo.userId === user?.id ? '我' : partner?.nickname} · {new Date(getCreated(photo)).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
              </span>
            </div>
          </div>
        ))}

        {!myToday && !partnerToday && pastPhotos.length === 0 && (
          <div className="flex-shrink-0 w-36 h-48 rounded-card bg-apricot/50 flex items-center justify-center">
            <span className="text-text-secondary text-sm text-center px-2">还没有照片<br/>快来拍第一张吧~</span>
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
    </div>
  );
}
