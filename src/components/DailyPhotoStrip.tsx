import { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../contexts/SyncContext';

export default function DailyPhotoStrip() {
  const { user, partner } = useAuth();
  const { state, uploadPhoto } = useSync();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
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

  const cards = !myToday
    ? { type: 'add' as const }
    : { type: 'photo' as const, photo: myToday, label: '我的 · 今天' };

  const partnerCard = partnerToday
    ? { type: 'photo' as const, photo: partnerToday, label: `${partner?.nickname} · 今天` }
    : null;

  const allCards: { type: string; photo?: any; label?: string }[] = [
    cards,
    ...(partnerCard ? [partnerCard] : []),
    ...pastPhotos.map(photo => ({
      type: 'photo',
      photo,
      label: `${photo.userId === user?.id ? '我' : partner?.nickname} · ${new Date(getCreated(photo)).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}`,
    })),
  ];

  const totalCards = allCards.length;

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIndex(idx);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

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

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth
                   [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {allCards.map((card, i) => (
          <div key={i} className="flex-shrink-0 w-[calc(100%-2rem)] max-w-72 snap-center">
            {card.type === 'add' ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full h-48 rounded-card bg-white border-2 border-dashed
                         border-blush/40 flex flex-col items-center justify-center gap-2
                         hover:border-blush hover:bg-apricot/50 transition-all duration-300 group"
              >
                <span className="text-4xl group-hover:scale-110 transition-transform">
                  {uploading ? '⏳' : '📷'}
                </span>
                <span className="text-sm text-text-secondary">今日一拍</span>
                <span className="text-3xl text-blush font-light">+</span>
              </button>
            ) : (
              <div className="w-full h-48 rounded-card overflow-hidden shadow-soft relative group">
                <img src={getUrl(card.photo)} alt="" className="w-full h-full object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent p-2">
                  <span className="text-white text-xs">{card.label}</span>
                </div>
              </div>
            )}
          </div>
        ))}

        {allCards.length === 0 && (
          <div className="flex-shrink-0 w-[calc(100%-2rem)] max-w-72 h-48 rounded-card bg-apricot/50 flex items-center justify-center snap-center">
            <span className="text-text-secondary text-sm text-center px-2">还没有照片<br/>快来拍第一张吧~</span>
          </div>
        )}
      </div>

      {totalCards > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {Array.from({ length: totalCards }).map((_, i) => (
            <button
              key={i}
              onClick={() => {
                const el = scrollRef.current;
                if (el) el.scrollTo({ left: el.clientWidth * i, behavior: 'smooth' });
              }}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                i === activeIndex ? 'bg-blush w-4' : 'bg-blush/30'
              }`}
            />
          ))}
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
    </div>
  );
}
