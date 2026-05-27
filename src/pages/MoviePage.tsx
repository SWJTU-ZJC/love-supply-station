import { useRef, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../contexts/SyncContext';

export default function MoviePage() {
  const { user, partner } = useAuth();
  const { state, uploadPhoto } = useSync();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [error, setError] = useState('');

  const photos = state.photos || [];
  const sorted = [...photos].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const ok = await uploadPhoto(file, caption.trim());
      if (ok) {
        setCaption('');
        setShowUpload(false);
      } else {
        setError('上传失败，请检查网络后重试');
      }
    } catch {
      setError('上传出错，请重试');
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [uploadPhoto, caption]);

  const getUrl = (p: any) => p.url || p.imageUrl || '';

  return (
    <div className="page-enter px-5 pt-8 pb-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-title text-3xl text-text-primary">我们的电影</h1>
          <p className="text-text-secondary text-sm mt-1">
            {sorted.length} 张回忆
          </p>
        </div>
        <button
          onClick={() => { setShowUpload(true); setCaption(''); setError(''); }}
          className="px-4 py-2 rounded-btn text-white text-sm font-semibold
                   bg-[radial-gradient(circle_at_30%_30%,#FFB3B3,#FFC3A0)]
                   hover:shadow-soft-lg active:scale-[0.98] transition-all"
        >
          + 上传照片
        </button>
      </div>

      {/* Hidden file input — always mounted so ref is stable */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Upload modal */}
      {showUpload && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
          onClick={() => setShowUpload(false)}
        >
          <div
            className="bg-white rounded-t-card sm:rounded-card p-6 shadow-soft-lg w-full max-w-sm animate-[fadeSlideIn_0.3s_ease-out]"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-semibold text-lg text-text-primary mb-1">上传照片</h3>
            <p className="text-text-secondary text-xs mb-4">挑选一张照片，可添加一句描述</p>
            <input
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="照片描述（可选）..."
              className="w-full px-4 py-2.5 rounded-btn bg-apricot/50 text-text-primary text-sm
                       focus:outline-none focus:ring-2 focus:ring-blush/50 mb-4"
              maxLength={100}
            />
            {error && (
              <p className="text-red-400 text-xs mb-3">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setShowUpload(false)}
                className="flex-1 py-2.5 rounded-btn bg-apricot/50 text-text-secondary text-sm font-semibold
                         hover:bg-apricot transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex-1 py-2.5 rounded-btn text-white text-sm font-semibold
                         bg-[radial-gradient(circle_at_30%_30%,#FFB3B3,#FFC3A0)]
                         disabled:opacity-50 hover:shadow-soft-lg active:scale-[0.98] transition-all"
              >
                {uploading ? '上传中...' : '选择图片'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo grid */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
          <span className="text-6xl mb-4">🎬</span>
          <p className="text-lg font-semibold">还没有照片</p>
          <p className="text-sm mt-1">点击右上角上传，记录你们的点点滴滴~</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {sorted.map(photo => (
            <div
              key={photo.id}
              onClick={() => setLightbox(getUrl(photo))}
              className="relative aspect-square rounded-xl overflow-hidden shadow-soft
                       cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform"
            >
              <img
                src={getUrl(photo)}
                alt={photo.caption || ''}
                loading="lazy"
                className="w-full h-full object-cover"
                onError={(e) => {
                  const img = e.currentTarget;
                  if (!img.dataset.retried) {
                    img.dataset.retried = '1';
                    const photoUrl = getUrl(photo);
                    if (photoUrl.includes('OSSAccessKeyId')) {
                      img.src = photoUrl.replace(/Expires=\d+/, `Expires=${Math.floor(Date.now() / 1000) + 3600}`);
                    }
                  }
                }}
              />
              {photo.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-2">
                  <p className="text-white text-xs truncate">{photo.caption}</p>
                </div>
              )}
              <div className="absolute top-1 left-1">
                <span className="text-xs bg-black/30 text-white rounded-full px-2 py-0.5">
                  {photo.userId === user?.id ? '我' : partner?.nickname || 'TA'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white text-3xl z-10 w-10 h-10 flex items-center justify-center"
          >
            ✕
          </button>
          <img
            src={lightbox}
            alt=""
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-soft-lg"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
