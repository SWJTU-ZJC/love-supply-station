import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../contexts/SyncContext';

export default function MoviePage() {
  const { user, partner } = useAuth();
  const { state, uploadPhoto, deletePhoto } = useSync();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captionRef = useRef('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [caption, setCaption] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; id: string } | null>(null);
  const [error, setError] = useState('');

  const photos = state.photos || [];
  const sorted = [...photos].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  // Keep captionRef in sync
  useEffect(() => {
    captionRef.current = caption;
  }, [caption]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setError('');
    setUploading(true);
    setProgress({ current: 0, total: files.length });
    let success = 0;
    for (let i = 0; i < files.length; i++) {
      try {
        const ok = await uploadPhoto(files[i], captionRef.current.trim());
        if (ok) success++;
      } catch (err) {
        console.error('[movie] upload error:', err);
      }
      setProgress({ current: i + 1, total: files.length });
    }
    setUploading(false);
    setProgress(null);
    if (success > 0) {
      setCaption('');
      setShowUpload(false);
    }
    if (success < files.length) {
      setError(`${files.length - success} 张上传失败，${success} 张成功`);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openPicker = () => {
    fileInputRef.current?.click();
  };

  const getUrl = (p: any) => p.url || p.imageUrl || '';

  return (
    <div className="page-enter px-5 pt-8 pb-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/home')}
            className="w-10 h-10 rounded-full bg-white shadow-soft flex items-center justify-center text-lg hover:scale-110 transition-transform">
            ←
          </button>
          <div>
            <h1 className="font-title text-3xl text-text-primary">我们的电影</h1>
            <p className="text-text-secondary text-sm mt-1">
              {sorted.length} 张回忆
            </p>
          </div>
        </div>
        <button
          onClick={() => { setShowUpload(true); setCaption(''); setError(''); }}
          className="px-4 py-2 rounded-btn text-white text-sm font-semibold
                   btn-gradient transition-all"
        >
          + 上传照片
        </button>
      </div>

      {/* File input — off-screen instead of hidden for reliable click() */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="absolute left-0 top-0 w-0 h-0 opacity-0 pointer-events-none"
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
            <p className="text-text-secondary text-xs mb-4">支持多选，一次上传多张照片</p>
            <input
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="照片描述（可选，所有照片共用）..."
              className="w-full px-4 py-2.5 rounded-btn bg-apricot/50 text-text-primary text-sm
                       focus:outline-none focus:ring-2 focus:ring-blush/50 mb-4"
              maxLength={100}
              disabled={uploading}
            />
            {progress && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-text-secondary mb-1.5">
                  <span>上传中...</span>
                  <span>{progress.current} / {progress.total}</span>
                </div>
                <div className="w-full h-2 bg-apricot rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blush rounded-full transition-all duration-300"
                    style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}
            {error && (
              <p className="text-red-400 text-xs mb-3">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { if (!uploading) { setShowUpload(false); setError(''); } }}
                disabled={uploading}
                className="flex-1 py-2.5 rounded-btn bg-apricot/50 text-text-secondary text-sm font-semibold
                         hover:bg-apricot transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={openPicker}
                disabled={uploading}
                className="flex-1 py-2.5 rounded-btn text-white text-sm font-semibold
                         btn-gradient transition-all disabled:opacity-60"
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
              className="relative aspect-square rounded-xl overflow-hidden shadow-soft
                       cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform group"
            >
              <img
                src={getUrl(photo)}
                alt={photo.caption || ''}
                loading="lazy"
                className="w-full h-full object-cover"
                onClick={() => setLightbox({ url: getUrl(photo), id: photo.id })}
              />
              {photo.userId === user?.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('确定要删除这张照片吗？')) {
                      deletePhoto(photo.id);
                      setLightbox(null);
                    }
                  }}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/40 text-white
                           flex items-center justify-center text-xs opacity-0 group-hover:opacity-100
                           hover:bg-red-500 transition-all z-10"
                >
                  ✕
                </button>
              )}
              {photo.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-2"
                     onClick={() => setLightbox({ url: getUrl(photo), id: photo.id })}>
                  <p className="text-white text-xs truncate">{photo.caption}</p>
                </div>
              )}
              <div className="absolute top-1 left-1" onClick={() => setLightbox({ url: getUrl(photo), id: photo.id })}>
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
          {photos.find(p => p.id === lightbox.id)?.userId === user?.id && (
            <button
              onClick={() => {
                if (confirm('确定要删除这张照片吗？')) {
                  deletePhoto(lightbox.id);
                  setLightbox(null);
                }
              }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 px-6 py-2.5
                       bg-red-500/90 text-white text-sm font-semibold rounded-full
                       hover:bg-red-600 active:scale-95 transition-all"
            >
              删除照片
            </button>
          )}
          <img
            src={lightbox.url}
            alt=""
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-soft-lg"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
