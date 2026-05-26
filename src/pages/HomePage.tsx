import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../contexts/SyncContext';
import MoodBar from '../components/MoodBar';
import DailyPhotoStrip from '../components/DailyPhotoStrip';
import FeatureGrid from '../components/FeatureGrid';
import confetti from 'canvas-confetti';

export default function HomePage() {
  const { user, partner } = useAuth();
  const { state, lastSync, exportSyncCode, importSyncCode } = useSync();
  const [showHearts, setShowHearts] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importCode, setImportCode] = useState('');
  const [importError, setImportError] = useState('');
  const [copied, setCopied] = useState(false);
  const importInputRef = useRef<HTMLTextAreaElement>(null);

  const myMood = state.moods.find(m => m.userId === user?.id)?.mood || user?.mood || '😊';
  const partnerMood = state.moods.find(m => m.userId === partner?.id)?.mood || partner?.mood || '😊';
  const myCoins = state.coins.find(c => c.userId === user?.id)?.coins ?? user?.coins ?? 50;
  const partnerCoins = state.coins.find(c => c.userId === partner?.id)?.coins ?? partner?.coins ?? 50;

  useEffect(() => {
    const timer = setTimeout(() => {
      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FFB3B3', '#FFC3A0', '#A0C4FF', '#A8E6CE'],
      });
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleMoodSelect = () => {
    setShowHearts(true);
    setTimeout(() => setShowHearts(false), 2000);
  };

  const handleExport = () => {
    const code = exportSyncCode();
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback: select and let user copy manually
      prompt('请复制这段同步码发送给对方：', code);
    });
  };

  const handleImport = () => {
    const code = importCode.trim();
    if (!code) return;
    const ok = importSyncCode(code);
    if (ok) {
      setImportCode('');
      setImportError('');
      setShowImport(false);
    } else {
      setImportError('同步码格式错误，请检查后重试');
    }
  };

  const handleOpenImport = () => {
    setShowImport(true);
    setImportCode('');
    setImportError('');
    setTimeout(() => importInputRef.current?.focus(), 100);
  };

  if (!user || !partner) return null;

  return (
    <div className="page-enter px-5 pt-8 pb-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-title text-3xl text-text-primary">恋爱补给站</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-text-secondary text-sm">
              {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-soft">
          <span className="text-lg">🪙</span>
          <span className="font-semibold text-sunset">{myCoins}</span>
        </div>
      </div>

      {/* Sync Bar */}
      <div className="rounded-card p-3 space-y-2 bg-white/90 border border-apricot/30 shadow-soft">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${lastSync ? 'bg-mint' : 'bg-text-secondary/30'}`} />
          <span className="text-xs text-text-secondary flex-1">
            {lastSync || '通过同步码交换数据'}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex-1 py-2 rounded-btn bg-mint/10 text-mint text-xs font-semibold
                     hover:bg-mint/20 active:scale-95 transition-all"
          >
            {copied ? '已复制 ✓' : '📤 导出同步码'}
          </button>
          <button
            onClick={handleOpenImport}
            className="flex-1 py-2 rounded-btn bg-blush/10 text-blush text-xs font-semibold
                     hover:bg-blush/20 active:scale-95 transition-all"
          >
            📥 导入同步码
          </button>
        </div>
      </div>

      {/* Import Modal */}
      {showImport && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
          onClick={() => setShowImport(false)}
        >
          <div
            className="bg-white rounded-t-card sm:rounded-card p-6 shadow-soft-lg w-full max-w-sm animate-[fadeSlideIn_0.3s_ease-out]"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-semibold text-lg text-text-primary mb-1">导入同步码</h3>
            <p className="text-text-secondary text-xs mb-4">粘贴对方发来的同步码</p>
            <textarea
              ref={importInputRef}
              value={importCode}
              onChange={e => setImportCode(e.target.value)}
              placeholder="粘贴同步码到这里..."
              className="w-full px-4 py-3 rounded-btn bg-apricot/50 text-text-primary text-sm
                       focus:outline-none focus:ring-2 focus:ring-blush/50 resize-none"
              rows={4}
            />
            {importError && (
              <p className="text-red-400 text-xs mt-2">{importError}</p>
            )}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowImport(false)}
                className="flex-1 py-2.5 rounded-btn bg-apricot/50 text-text-secondary text-sm font-semibold
                         hover:bg-apricot transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleImport}
                disabled={!importCode.trim()}
                className="flex-1 py-2.5 rounded-btn text-white text-sm font-semibold
                         bg-[radial-gradient(circle_at_30%_30%,#FFB3B3,#FFC3A0)]
                         disabled:opacity-50 hover:shadow-soft-lg active:scale-[0.98] transition-all"
              >
                合并数据
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mood Bar */}
      <MoodBar currentMood={myMood} onMoodSelect={handleMoodSelect} />

      {/* Partner Status Card */}
      <div className="bg-white rounded-card p-5 shadow-soft">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-apricot flex items-center justify-center text-3xl
                          ring-4 ring-blush/20">
              {partner.avatar}
            </div>
            <div className="absolute -bottom-1 -right-1 text-xl">{partnerMood}</div>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-text-primary">{partner.nickname}</h3>
            <p className="text-text-secondary text-sm mt-0.5">
              {partnerMood === '🥺' ? '正在想你 💕' :
               partnerMood === '😤' ? '心情不太好...' :
               partnerMood === '😴' ? '今天有点累' :
               partnerMood === '🥰' ? '求安慰~' :
               '心情不错 😊'}
            </p>
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-xs">🪙</span>
              <span className="text-xs text-text-secondary">{partnerCoins} 金币</span>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Photo Strip */}
      <DailyPhotoStrip />

      {/* Feature Grid */}
      <FeatureGrid />

      {/* Heart rain effect */}
      {showHearts && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute text-3xl animate-[heartFall_2s_ease-in_forwards]"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${1.5 + Math.random() * 2}s`,
              }}
            >
              {['💕', '💖', '💗', '💝', '💘'][Math.floor(Math.random() * 5)]}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
