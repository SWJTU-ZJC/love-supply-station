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

  const photos = state.photos || [];
  const getUrl = (p: any) => p.url || p.imageUrl || '';
  const getCreated = (p: any) => p.createdAt || new Date(p.date || 0).getTime();

  const sortedPhotos = [...photos].sort((a, b) => getCreated(b) - getCreated(a)).slice(0, 20);

  const cards = sortedPhotos.map(photo => ({
    photo,
    label: `${photo.userId === user?.id ? '我' : partner?.nickname || 'TA'} · ${new Date(getCreated(photo)).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}`,
  }));

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
    const ok = await uploadPhoto(file, '');
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!ok) alert('上传失败，请检查网络后重试');
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
        {/* Always-visible upload card */}
        <div className="flex-shrink-0 w-[calc(100%-2rem)] max-w-72 snap-center">
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
            <span className="text-sm text-text-secondary">上传照片</span>
            <span className="text-3xl text-blush font-light">+</span>
          </button>
        </div>

        {/* Photo cards */}
        {cards.map((card, i) => (
          <div key={card.photo.id || i} className="flex-shrink-0 w-[calc(100%-2rem)] max-w-72 snap-center">
            <div className="w-full h-48 rounded-card overflow-hidden shadow-soft relative group">
              <img src={getUrl(card.photo)} alt="" className="w-full h-full object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent p-2">
                <span className="text-white text-xs">{card.label}</span>
              </div>
            </div>
          </div>
        ))}

        {cards.length === 0 && (
          <div className="flex-shrink-0 w-[calc(100%-2rem)] max-w-72 h-48 rounded-card bg-apricot/50 flex items-center justify-center snap-center">
            <span className="text-text-secondary text-sm text-center px-2">还没有照片<br/>点击左侧上传第一张吧~</span>
          </div>
        )}
      </div>

      {/* Dot indicators (skip upload card, start from photo cards) */}
      {cards.length > 0 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {Array.from({ length: cards.length + 1 }).map((_, i) => (
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

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="absolute left-0 top-0 w-0 h-0 opacity-0 pointer-events-none" />
    </div>
  );
}
