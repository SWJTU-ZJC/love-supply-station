import { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface Photo {
  id: string;
  date: string;
  imageUrl: string;
  userId: string;
}

export default function DailyPhotoStrip() {
  const { user, partner } = useAuth();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().split('T')[0];

  const todayPhoto = photos.find(p => p.date === today && p.userId === user?.id);
  const partnerTodayPhoto = photos.find(p => p.date === today && p.userId === partner?.id);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert to data URL for demo (in production, upload to Firebase Storage)
    const reader = new FileReader();
    reader.onload = () => {
      const newPhoto: Photo = {
        id: Date.now().toString(),
        date: today,
        imageUrl: reader.result as string,
        userId: user!.id,
      };
      setPhotos(prev => {
        const filtered = prev.filter(p => !(p.date === today && p.userId === user!.id));
        return [newPhoto, ...filtered];
      });
    };
    reader.readAsDataURL(file);
  };

  // Generate sample photos for display
  const allPhotos = [
    ...(todayPhoto ? [todayPhoto] : []),
    ...(partnerTodayPhoto ? [partnerTodayPhoto] : []),
    ...photos.filter(p => p.date !== today),
  ];

  return (
    <div>
      <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
        <span>🎬</span> 我们的电影
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
        {/* Upload card */}
        {!todayPhoto && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-shrink-0 w-36 h-48 rounded-card bg-white border-2 border-dashed
                     border-blush/40 flex flex-col items-center justify-center gap-2
                     hover:border-blush hover:bg-apricot/50 transition-all duration-300
                     snap-center group"
          >
            <span className="text-4xl group-hover:scale-110 transition-transform">📷</span>
            <span className="text-sm text-text-secondary">今日一拍</span>
            <span className="text-3xl text-blush font-light">+</span>
          </button>
        )}

        {/* Today's photos */}
        {todayPhoto && (
          <div className="flex-shrink-0 w-36 h-48 rounded-card overflow-hidden shadow-soft snap-center relative group">
            <img src={todayPhoto.imageUrl} alt="今天" className="w-full h-full object-cover" />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent p-2">
              <span className="text-white text-xs">我的 · 今天</span>
            </div>
          </div>
        )}

        {partnerTodayPhoto && (
          <div className="flex-shrink-0 w-36 h-48 rounded-card overflow-hidden shadow-soft snap-center relative group">
            <img src={partnerTodayPhoto.imageUrl} alt="Ta的今天" className="w-full h-full object-cover" />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent p-2">
              <span className="text-white text-xs">{partner?.nickname} · 今天</span>
            </div>
          </div>
        )}

        {/* Past photos */}
        {allPhotos.filter(p => p.date !== today).slice(0, 10).map(photo => (
          <div key={photo.id}
            className="flex-shrink-0 w-36 h-48 rounded-card overflow-hidden shadow-soft snap-center relative">
            <img src={photo.imageUrl} alt={photo.date} className="w-full h-full object-cover" />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent p-2">
              <span className="text-white text-xs">
                {photo.userId === user?.id ? '我' : partner?.nickname} · {photo.date.slice(5)}
              </span>
            </div>
          </div>
        ))}

        {/* Empty placeholder */}
        {allPhotos.length === 0 && !todayPhoto && (
          <div className="flex-shrink-0 w-36 h-48 rounded-card bg-apricot/50 flex items-center justify-center">
            <span className="text-text-secondary text-sm text-center px-2">还没有照片<br/>快来拍第一张吧~</span>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
      />
    </div>
  );
}
