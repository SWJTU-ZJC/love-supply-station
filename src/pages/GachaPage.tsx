import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../contexts/SyncContext';
import confetti from 'canvas-confetti';

interface GachaItem {
  name: string;
  icon: string;
  rarity: 'normal' | 'rare' | 'super';
}

const gachaPool: GachaItem[] = [
  { name: '拥抱一个', icon: '🤗', rarity: 'normal' },
  { name: '睡前故事', icon: '📖', rarity: 'normal' },
  { name: '早餐送到床', icon: '🥐', rarity: 'normal' },
  { name: '无条件认错券', icon: '🙇', rarity: 'normal' },
  { name: '一日仆人券', icon: '👑', rarity: 'rare' },
  { name: '愿望实现券', icon: '🌟', rarity: 'rare' },
  { name: '豪华约会日', icon: '💝', rarity: 'super' },
  { name: '旅行任意门', icon: '✈️', rarity: 'super' },
];

const rarityConfig = {
  normal: { color: '#A8E6CE', label: '普通', weight: 60 },
  rare: { color: '#A0C4FF', label: '稀有', weight: 30 },
  super: { color: '#FFB3B3', label: '超级', weight: 10 },
};

function pickGacha(): GachaItem {
  const total = Object.values(rarityConfig).reduce((sum, c) => sum + c.weight, 0);
  let rand = Math.random() * total;
  for (const [rarity, config] of Object.entries(rarityConfig)) {
    rand -= config.weight;
    if (rand <= 0) {
      const pool = gachaPool.filter(i => i.rarity === rarity);
      return pool[Math.floor(Math.random() * pool.length)];
    }
  }
  return gachaPool[0];
}

export default function GachaPage() {
  const navigate = useNavigate();
  const { user, partner } = useAuth();
  const { state, updateCoins, addGachaItem, useGachaItem } = useSync();
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<GachaItem | null>(null);
  const [scratched, setScratched] = useState(false);
  const [tab, setTab] = useState<'gacha' | 'backpack'>('gacha');
  const scratchCanvasRef = useRef<HTMLCanvasElement>(null);

  const cost = 10;
  const myCoins = state.coins.find(c => c.userId === user?.id)?.coins ?? user?.coins ?? 50;
  const myGachaItems = (state.gachaItems || []).filter(i => i.userId === user?.id);
  const unusedItems = myGachaItems.filter(i => !i.used);
  const usedItems = myGachaItems.filter(i => i.used);

  const handleSpin = () => {
    if (spinning || myCoins < cost) return;
    setSpinning(true);
    updateCoins(myCoins - cost);

    setTimeout(() => {
      const item = pickGacha();
      setResult(item);
      setSpinning(false);
      setScratched(false);
    }, 1500);
  };

  // Initialize scratch canvas when result changes
  useEffect(() => {
    if (!result) return;
    // Wait for next frame so canvas is rendered
    requestAnimationFrame(() => {
      const canvas = scratchCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Fill gray overlay
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#D4D4D4';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#9E9E9E';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('刮开有惊喜', canvas.width / 2, canvas.height / 2 + 6);

      let isDrawing = false;

      const scratch = (x: number, y: number) => {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(x, y, 22, 0, Math.PI * 2);
        ctx.fill();
      };

      const checkProgress = () => {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        let transparent = 0;
        for (let i = 3; i < pixels.length; i += 4) {
          if (pixels[i] === 0) transparent++;
        }
        if (transparent / (pixels.length / 4) > 0.5) {
          setScratched(true);
          canvas.style.pointerEvents = 'none';
          confetti({ particleCount: 60, spread: 80, origin: { y: 0.6 }, colors: ['#FFB3B3', '#FFC3A0', '#A0C4FF'] });
        }
      };

      const getPos = (e: MouseEvent | Touch) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
      };

      const onMouseDown = (e: MouseEvent) => { isDrawing = true; const p = getPos(e); scratch(p.x, p.y); };
      const onMouseMove = (e: MouseEvent) => { if (!isDrawing) return; const p = getPos(e); scratch(p.x, p.y); checkProgress(); };
      const onMouseUp = () => { isDrawing = false; checkProgress(); };
      const onTouchStart = (e: TouchEvent) => { e.preventDefault(); isDrawing = true; const p = getPos(e.touches[0]); scratch(p.x, p.y); };
      const onTouchMove = (e: TouchEvent) => { e.preventDefault(); if (e.touches.length === 0) return; const p = getPos(e.touches[0]); scratch(p.x, p.y); };
      const onTouchEnd = (e: TouchEvent) => { e.preventDefault(); checkProgress(); };

      canvas.addEventListener('mousedown', onMouseDown);
      canvas.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      canvas.addEventListener('touchstart', onTouchStart, { passive: false });
      canvas.addEventListener('touchmove', onTouchMove, { passive: false });
      canvas.addEventListener('touchend', onTouchEnd, { passive: false });

      return () => {
        canvas.removeEventListener('mousedown', onMouseDown);
        canvas.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        canvas.removeEventListener('touchstart', onTouchStart);
        canvas.removeEventListener('touchmove', onTouchMove);
        canvas.removeEventListener('touchend', onTouchEnd);
      };
    });
    return () => {};
  }, [result]);

  const handleClaim = () => {
    if (!result) return;
    addGachaItem({ name: result.name, icon: result.icon, rarity: result.rarity });
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.5 }, colors: ['#FFC3A0', '#FFB3B3', '#A8E6CE'] });
    setResult(null);
    setScratched(false);
  };

  const handleUse = (id: string) => {
    if (!confirm('确定要使用这张券吗？使用后将从背包中移除。')) return;
    useGachaItem(id);
  };

  const closeResult = () => {
    setResult(null);
    setScratched(false);
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center px-4 py-8">
      <button onClick={() => navigate(-1)}
        className="absolute top-6 left-6 w-10 h-10 rounded-full bg-white shadow-soft flex items-center justify-center text-lg hover:scale-110 transition-transform">←</button>

      <h1 className="font-title text-3xl text-text-primary mb-2">🎪 恋爱扭蛋机</h1>

      <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-soft mb-4">
        <span className="text-lg">🪙</span>
        <span className="font-semibold text-sunset">{myCoins}</span>
        <span className="text-text-secondary text-sm">金币</span>
      </div>

      {/* Tab switcher */}
      <div className="flex bg-white rounded-full p-1 shadow-soft mb-6">
        <button
          onClick={() => setTab('gacha')}
          className={`px-5 py-1.5 rounded-full text-sm font-semibold transition-all ${
            tab === 'gacha' ? 'bg-blush text-white' : 'text-text-secondary'
          }`}
        >扭蛋机</button>
        <button
          onClick={() => setTab('backpack')}
          className={`px-5 py-1.5 rounded-full text-sm font-semibold transition-all relative ${
            tab === 'backpack' ? 'bg-blush text-white' : 'text-text-secondary'
          }`}
        >
          我的背包
          {unusedItems.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-sunset text-white text-xs flex items-center justify-center">
              {unusedItems.length}
            </span>
          )}
        </button>
      </div>

      {tab === 'gacha' ? (
        <>
          {/* Gacha machine */}
          <div className="relative mb-6">
            <div className="w-64 h-72 bg-white rounded-card shadow-soft-lg flex flex-col items-center justify-center
                          border-4 border-blush/20 relative overflow-hidden">
              <div className="absolute top-0 w-full h-32 bg-gradient-to-b from-blush/10 to-transparent rounded-t-card" />
              <div className="relative z-10 mb-4">
                {spinning ? (
                  <div className="text-6xl animate-[shake_0.1s_ease-in-out_infinite]">🥚</div>
                ) : (
                  <div className="text-6xl animate-[float_3s_ease-in-out_infinite]">🥚</div>
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-1 px-4 z-10 mb-3">
                {['🔴', '🔵', '🟡', '🟢', '🟣', '🟠', '🔴', '🔵'].map((c, i) => (
                  <span key={i} className="text-sm opacity-60">{c}</span>
                ))}
              </div>
              <div className="z-10 bg-apricot rounded-btn px-4 py-1.5 border-2 border-sunset/30 text-sm text-text-secondary">
                🪙 {cost} 金币/次
              </div>
            </div>

            <button
              onClick={handleSpin}
              disabled={spinning || myCoins < cost}
              className={`absolute -right-3 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full shadow-soft-lg
                         flex items-center justify-center text-xl font-bold transition-all duration-500 z-20
                         ${spinning ? 'bg-blush text-white animate-[spin_0.5s_linear_infinite]'
                           : myCoins < cost ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                             : 'bg-gradient-to-br from-sunset to-blush text-white hover:scale-110 active:scale-95'}`}
            >
              {spinning ? '🌀' : '🔘'}
            </button>
          </div>

          {myCoins < cost && <p className="text-text-secondary text-sm">金币不足~ 去完成一些任务赚金币吧！</p>}

          {/* Scratch card modal */}
          {result && (
            <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                 onClick={closeResult}>
              <div className="bg-white rounded-card p-6 shadow-soft-lg max-w-xs w-full text-center animate-[gachaDrop_0.5s_ease-out]"
                   onClick={e => e.stopPropagation()}>
                <h3 className="font-title text-xl text-text-primary mb-4">刮开看看！</h3>

                <div className="relative w-48 h-28 mx-auto mb-4">
                  {/* Prize (underneath) */}
                  <div className={`absolute inset-0 rounded-xl border-2 flex flex-col items-center justify-center
                                ${result.rarity === 'super' ? 'bg-blush/20 border-blush' :
                                  result.rarity === 'rare' ? 'bg-calm/20 border-calm' : 'bg-mint/20 border-mint'}`}>
                    <span className="text-4xl">{result.icon}</span>
                    <span className="font-bold text-lg text-text-primary mt-1">{result.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full mt-1"
                          style={{ backgroundColor: rarityConfig[result.rarity].color + '40', color: '#4A3F3F' }}>
                      {rarityConfig[result.rarity].label}
                    </span>
                  </div>

                  {/* Scratch canvas (on top) */}
                  {!scratched && (
                    <canvas
                      ref={scratchCanvasRef}
                      width={192} height={112}
                      className="absolute inset-0 rounded-xl cursor-pointer touch-none"
                    />
                  )}
                </div>

                {scratched ? (
                  <button onClick={handleClaim}
                    className="w-full py-3 rounded-btn text-white font-semibold
                             bg-[radial-gradient(circle_at_30%_30%,#FFB3B3,#FFC3A0)] hover:shadow-soft-lg transition-all">
                    收下啦！💝
                  </button>
                ) : (
                  <p className="text-text-secondary text-xs">用手指擦一擦灰色区域~</p>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        /* Backpack tab */
        <div className="w-full max-w-sm space-y-4">
          {unusedItems.length === 0 && usedItems.length === 0 ? (
            <div className="text-center py-12 text-text-secondary">
              <span className="text-5xl block mb-3">🎒</span>
              <p className="font-semibold">背包空空</p>
              <p className="text-sm mt-1">去扭个蛋吧~</p>
            </div>
          ) : (
            <>
              {/* Unused items */}
              {unusedItems.length > 0 && (
                <div>
                  <h3 className="font-semibold text-text-primary text-sm mb-2 flex items-center gap-2">
                    <span>🎁</span> 未使用 ({unusedItems.length})
                  </h3>
                  <div className="space-y-2">
                    {[...unusedItems].sort((a, b) => b.obtainedAt - a.obtainedAt).map(item => (
                      <div key={item.id}
                        className="bg-white rounded-card p-3 shadow-soft flex items-center gap-3">
                        <span className="text-3xl">{item.icon}</span>
                        <div className="flex-1">
                          <p className="font-semibold text-text-primary text-sm">{item.name}</p>
                          <span className="text-xs px-1.5 py-0.5 rounded-full"
                                style={{ backgroundColor: rarityConfig[item.rarity].color + '40', color: '#4A3F3F' }}>
                            {rarityConfig[item.rarity].label}
                          </span>
                        </div>
                        <button
                          onClick={() => handleUse(item.id)}
                          className="px-3 py-1.5 rounded-btn bg-blush/10 text-blush text-xs font-semibold
                                   hover:bg-blush/20 active:scale-95 transition-all"
                        >
                          使用
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Used history */}
              {usedItems.length > 0 && (
                <div>
                  <h3 className="font-semibold text-text-secondary text-sm mb-2 flex items-center gap-2">
                    <span>📋</span> 已使用 ({usedItems.length})
                  </h3>
                  <div className="space-y-2 opacity-60">
                    {[...usedItems].sort((a, b) => b.obtainedAt - a.obtainedAt).slice(0, 10).map(item => (
                      <div key={item.id}
                        className="bg-gray-50 rounded-card p-3 flex items-center gap-3 line-through">
                        <span className="text-2xl">{item.icon}</span>
                        <div className="flex-1">
                          <p className="text-text-secondary text-sm">{item.name}</p>
                        </div>
                        <span className="text-xs text-text-secondary">已使用</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Partner's items */}
          {partner && (state.gachaItems || []).filter(i => i.userId === partner.id && !i.used).length > 0 && (
            <div>
              <h3 className="font-semibold text-text-primary text-sm mb-2 flex items-center gap-2">
                <span>💝</span> {partner.nickname}的奖品
              </h3>
              <div className="space-y-2">
                {(state.gachaItems || []).filter(i => i.userId === partner.id && !i.used).map(item => (
                  <div key={item.id}
                    className="bg-white rounded-card p-3 shadow-soft flex items-center gap-3 opacity-70">
                    <span className="text-3xl">{item.icon}</span>
                    <div className="flex-1">
                      <p className="font-semibold text-text-primary text-sm">{item.name}</p>
                      <span className="text-xs px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: rarityConfig[item.rarity].color + '40', color: '#4A3F3F' }}>
                        {rarityConfig[item.rarity].label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
