import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import confetti from 'canvas-confetti';

interface Capsule {
  id: string;
  userId: string;
  content: string;
  sealTime: string;
  openTime: string;
  isOpened: boolean;
}

export default function CapsulesPage() {
  const navigate = useNavigate();
  const { user, partner } = useAuth();
  const [tab, setTab] = useState<'seal' | 'open'>('seal');
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [content, setContent] = useState('');
  const [openDate, setOpenDate] = useState('');
  const [sealing, setSealing] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [openedContent, setOpenedContent] = useState<Capsule | null>(null);

  const handleSeal = () => {
    if (!content.trim() || !openDate || !user) return;
    setSealing(true);
    setTimeout(() => {
      const capsule: Capsule = {
        id: Date.now().toString(),
        userId: user.id,
        content: content.trim(),
        sealTime: new Date().toISOString(),
        openTime: openDate,
        isOpened: false,
      };
      setCapsules(prev => [capsule, ...prev]);
      setContent('');
      setOpenDate('');
      setSealing(false);
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#A0C4FF', '#D4A5FF'],
      });
    }, 1500);
  };

  const handleOpen = (capsule: Capsule) => {
    if (capsule.isOpened) return;
    const now = new Date();
    const openAt = new Date(capsule.openTime);
    if (now < openAt) return;

    setOpening(capsule.id);
    setTimeout(() => {
      setCapsules(prev => prev.map(c => c.id === capsule.id ? { ...c, isOpened: true } : c));
      setOpening(null);
      setOpenedContent(capsule);
      confetti({
        particleCount: 60,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#FFB3B3', '#FFC3A0', '#A0C4FF', '#A8E6CE'],
      });
    }, 2000);
  };

  const now = new Date();
  const sealedCapsules = capsules.filter(c => !c.isOpened && new Date(c.openTime) > now);
  const readyCapsules = capsules.filter(c => !c.isOpened && new Date(c.openTime) <= now);
  const openedCapsules = capsules.filter(c => c.isOpened);

  return (
    <div className="min-h-screen bg-cream px-4 py-8">
      <button
        onClick={() => navigate(-1)}
        className="w-10 h-10 rounded-full bg-white shadow-soft
                 flex items-center justify-center text-lg hover:scale-110 transition-transform mb-4"
      >
        ←
      </button>

      <h1 className="font-title text-3xl text-text-primary mb-2">💊 时光胶囊</h1>
      <p className="text-text-secondary text-sm mb-6">写一封信给未来的我们</p>

      {/* Tabs */}
      <div className="flex bg-apricot/50 rounded-btn p-1 mb-6">
        <button
          onClick={() => setTab('seal')}
          className={`flex-1 py-2.5 rounded-btn font-semibold text-sm transition-all
            ${tab === 'seal' ? 'bg-white shadow-soft text-text-primary' : 'text-text-secondary'}`}
        >
          🔒 封存胶囊
        </button>
        <button
          onClick={() => setTab('open')}
          className={`flex-1 py-2.5 rounded-btn font-semibold text-sm transition-all
            ${tab === 'open' ? 'bg-white shadow-soft text-text-primary' : 'text-text-secondary'}`}
        >
          📬 待开启 ({readyCapsules.length + sealedCapsules.length})
        </button>
      </div>

      {tab === 'seal' ? (
        <div>
          {/* Letter paper */}
          <div className="bg-[#fef9e7] rounded-card p-6 shadow-soft mb-6 relative"
               style={{
                 backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 31px, #e8e0c8 31px, #e8e0c8 32px)',
                 lineHeight: '32px',
               }}>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="亲爱的..."
              className="w-full bg-transparent text-text-primary text-base
                       focus:outline-none resize-none placeholder:text-text-secondary/40"
              style={{ lineHeight: '32px', minHeight: '160px' }}
              autoFocus
            />
          </div>

          {/* Date picker */}
          <div className="bg-white rounded-card p-4 shadow-soft mb-4">
            <label className="block text-sm font-semibold text-text-primary mb-2">
              📅 设定开启时间
            </label>
            <input
              type="datetime-local"
              value={openDate}
              onChange={e => setOpenDate(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full px-4 py-3 rounded-btn bg-apricot/50 text-text-primary
                       focus:outline-none focus:ring-2 focus:ring-blush/50"
            />
          </div>

          <button
            onClick={handleSeal}
            disabled={!content.trim() || !openDate || sealing}
            className="w-full py-4 rounded-card text-white font-semibold text-lg
                     bg-[radial-gradient(circle_at_30%_30%,#A0C4FF,#D4A5FF)]
                     disabled:opacity-50 hover:shadow-soft-lg active:scale-[0.98]
                     transition-all duration-300"
          >
            {sealing ? '🔄 封存中...' : '🔒 封存胶囊'}
          </button>

          {/* Sealing animation */}
          {sealing && (
            <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
              <div className="text-6xl animate-[sealCapsule_1.5s_ease-in_forwards]">💊</div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4 pb-20">
          {/* Ready to open */}
          {readyCapsules.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-mint mb-2 flex items-center gap-1">
                <span>✅</span> 可以开启了
              </h3>
              {readyCapsules.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleOpen(c)}
                  disabled={opening === c.id}
                  className={`w-full bg-white rounded-card p-5 shadow-soft mb-3 text-left
                           hover:shadow-soft-lg hover:-translate-y-1 transition-all
                           border-2 border-mint/30
                           ${opening === c.id ? 'animate-[shake_0.3s_ease-in-out]' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{opening === c.id ? '💥' : '💊'}</span>
                    <div>
                      <p className="font-semibold text-text-primary">
                        {c.userId === user?.id ? '我' : partner?.nickname} 的胶囊
                      </p>
                      <p className="text-xs text-text-secondary">
                        封存于 {new Date(c.sealTime).toLocaleDateString('zh-CN')}
                      </p>
                      <p className="text-xs text-mint mt-0.5">
                        可以开启啦！点击打开 →
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Sealed */}
          {sealedCapsules.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-2 flex items-center gap-1">
                <span>🔒</span> 等待时间
              </h3>
              {sealedCapsules.map(c => {
                const daysLeft = Math.ceil((new Date(c.openTime).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={c.id} className="bg-white/60 rounded-card p-5 shadow-soft mb-3 border-2 border-dashed border-blush/20">
                    <div className="flex items-center gap-3">
                      <span className="text-4xl opacity-50">🔒</span>
                      <div>
                        <p className="font-semibold text-text-primary/60">
                          {c.userId === user?.id ? '我' : partner?.nickname} 的胶囊
                        </p>
                        <p className="text-xs text-text-secondary">
                          封存于 {new Date(c.sealTime).toLocaleDateString('zh-CN')}
                        </p>
                        <p className="text-xs text-blush mt-0.5">
                          还有 {daysLeft} 天才能开启
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Opened */}
          {openedCapsules.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-2 flex items-center gap-1">
                <span>📖</span> 已开启
              </h3>
              {openedCapsules.map(c => (
                <div key={c.id} className="bg-white/50 rounded-card p-5 shadow-soft mb-3 opacity-70">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">📖</span>
                    <div>
                      <p className="font-semibold text-text-primary">
                        {c.userId === user?.id ? '我' : partner?.nickname} 的胶囊
                      </p>
                      <p className="text-xs text-text-secondary">
                        封存于 {new Date(c.sealTime).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {capsules.length === 0 && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">💊</div>
              <p className="text-text-secondary">还没有时光胶囊</p>
              <p className="text-text-secondary/60 text-sm mt-1">封存第一个吧~</p>
            </div>
          )}
        </div>
      )}

      {/* Open result modal */}
      {openedContent && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4"
             onClick={() => setOpenedContent(null)}>
          <div className="bg-[#fef9e7] rounded-card p-8 shadow-soft-lg max-w-sm w-full
                        animate-[gachaDrop_0.5s_ease-out]"
               onClick={e => e.stopPropagation()}
               style={{
                 backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 31px, #e8e0c8 31px, #e8e0c8 32px)',
                 lineHeight: '32px',
               }}>
            <div className="text-center mb-4">
              <span className="text-4xl">💌</span>
            </div>
            <p className="text-text-primary text-base leading-relaxed whitespace-pre-wrap"
               style={{ lineHeight: '32px' }}>
              {openedContent.content}
            </p>
            <p className="text-text-secondary text-xs mt-4 text-right">
              —— {new Date(openedContent.sealTime).toLocaleDateString('zh-CN')} 封存
            </p>
            <button
              onClick={() => setOpenedContent(null)}
              className="mt-6 w-full py-3 rounded-btn text-white font-semibold
                       bg-[radial-gradient(circle_at_30%_30%,#FFB3B3,#FFC3A0)]"
            >
              珍藏 💝
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
