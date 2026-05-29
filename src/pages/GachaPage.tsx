import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../contexts/SyncContext';
import confetti from 'canvas-confetti';
import { useTheme, themeColors } from '../contexts/ThemeContext';
import AnimalIcon from '../components/AnimalIcon';
import PixelSprite from '../components/PixelSprite';

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

const rarityWeights = { normal: 60, rare: 30, super: 10 };

type ThemeColorSet = { primary: string; accent: string; blue: string; green: string };

function getRarityConfig(tc: ThemeColorSet) {
  return {
    normal: { color: tc.green, label: '普通', weight: rarityWeights.normal },
    rare: { color: tc.blue, label: '稀有', weight: rarityWeights.rare },
    super: { color: tc.primary, label: '超级', weight: rarityWeights.super },
  };
}

function pickGacha(): GachaItem {
  const total = Object.values(rarityWeights).reduce((sum, w) => sum + w, 0);
  let rand = Math.random() * total;
  for (const [rarity, weight] of Object.entries(rarityWeights)) {
    rand -= weight;
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
  const { theme, uiMode } = useTheme();
  const tc = themeColors[theme];
  const rarityConfig = getRarityConfig(tc);
  const isAnimal = uiMode === 'animal';
  const isPixel = uiMode === 'pixel';
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<GachaItem | null>(null);
  const [scratched, setScratched] = useState(false);
  const [dropColor, setDropColor] = useState(tc.primary);
  const [tab, setTab] = useState<'gacha' | 'backpack'>('gacha');
  const scratchCanvasRef = useRef<HTMLCanvasElement>(null);

  const cost = 10;
  const myCoins = state.coins.find(c => c.userId === user?.id)?.coins ?? user?.coins ?? 5;
  const myGachaItems = (state.gachaItems || []).filter(i => i.userId === user?.id);
  const unusedItems = myGachaItems.filter(i => !i.used);
  const usedItems = myGachaItems.filter(i => i.used);

  const handleSpin = () => {
    if (spinning || myCoins < cost) return;
    const colors = isPixel
      ? ['#E02020', '#4888F0', '#F8D030', '#78C850', '#F89890', '#b77dee']
      : isAnimal
      ? ['#f8a6b2','#82d5bb','#f7cd67','#b77dee','#889df0','#e59266']
      : [tc.primary, tc.accent, tc.blue, tc.green];
    setDropColor(colors[Math.floor(Math.random() * colors.length)]);
    setSpinning(true);
    updateCoins(myCoins - cost);

    setTimeout(() => {
      const item = pickGacha();
      setResult(item);
      setSpinning(false);
      setScratched(false);
    }, 1500);
  };

  useEffect(() => {
    if (!result) return;
    requestAnimationFrame(() => {
      const canvas = scratchCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = isAnimal ? '#d5c4a8' : '#D4D4D4';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = isAnimal ? '#9f927d' : '#9E9E9E';
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
          confetti({ particleCount: 60, spread: 80, origin: { y: 0.6 }, colors: [isAnimal ? '#19c8b9' : tc.primary, tc.accent, tc.blue] });
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
  }, [result, isAnimal, tc]);

  const handleClaim = () => {
    if (!result) return;
    addGachaItem({ name: result.name, icon: result.icon, rarity: result.rarity });
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.5 }, colors: [tc.accent, tc.primary, tc.green] });
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
    <div className={`min-h-screen flex flex-col items-center px-4 py-8 ${isAnimal ? 'bg-[#f8f8f0]' : 'bg-cream'}`}>
      <button onClick={() => navigate(-1)}
        className="absolute top-6 left-6 w-10 h-10 rounded-full bg-white shadow-soft flex items-center justify-center text-lg hover:scale-110 transition-transform">
        ←
      </button>

      <h1 className="font-title text-3xl text-text-primary mb-2 flex items-center gap-2">
        {isAnimal ? <AnimalIcon name="shopping" size={32} /> : <span>🎪</span>}
        恋爱扭蛋机
      </h1>

      {/* Coins display */}
      <div className={`flex items-center gap-2 rounded-full px-4 py-2 shadow-soft mb-4 ${isAnimal ? 'bg-[#f7f3df] border-2 border-[#e8dcc8]' : 'bg-white'}`}>
        {isAnimal ? <AnimalIcon name="miles" size={22} /> : <span className="text-lg">🪙</span>}
        <span className={`font-semibold ${isAnimal ? 'text-[#725d42]' : 'text-sunset'}`}>{myCoins}</span>
        <span className="text-text-secondary text-sm">金币</span>
      </div>

      {/* Tab switcher */}
      <div className={`flex rounded-full p-1 shadow-soft mb-6 ${isAnimal ? 'bg-[#f7f3df] border-2 border-[#e8dcc8]' : 'bg-white'}`}>
        <button
          onClick={() => setTab('gacha')}
          className={`px-5 py-1.5 rounded-full text-sm font-semibold transition-all ${
            tab === 'gacha'
              ? isAnimal ? 'bg-[#19c8b9] text-white shadow-[0_2px_0_0_#14b5a7]' : 'bg-blush text-white'
              : 'text-text-secondary'
          }`}
        >扭蛋机</button>
        <button
          onClick={() => setTab('backpack')}
          className={`px-5 py-1.5 rounded-full text-sm font-semibold transition-all relative ${
            tab === 'backpack'
              ? isAnimal ? 'bg-[#19c8b9] text-white shadow-[0_2px_0_0_#14b5a7]' : 'bg-blush text-white'
              : 'text-text-secondary'
          }`}
        >
          我的背包
          {unusedItems.length > 0 && (
            <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-xs flex items-center justify-center ${isAnimal ? 'bg-[#e0894a]' : 'bg-sunset'}`}>
              {unusedItems.length}
            </span>
          )}
        </button>
      </div>

      {tab === 'gacha' ? (
        <>
          {/* Gacha machine */}
          <div className="relative mb-6">
            <div className={`w-64 h-72 rounded-card shadow-soft-lg flex flex-col items-center justify-center
                          relative overflow-hidden ${
                            isAnimal
                              ? 'bg-[#82d5bb] border-2 border-white/40'
                              : 'bg-white border-4 border-blush/20'
                          }`}>
              <div className={`absolute top-0 w-full h-32 rounded-t-card ${isAnimal ? 'bg-white/20' : 'bg-gradient-to-b from-blush/10 to-transparent'}`} />
              <div className="relative z-10 mb-4">
                {/* CSS Gacha Machine — renders for ALL modes */}
                <div className="relative flex flex-col items-center">
                  {/* Glass dome */}
                  <div className={`relative w-36 h-28 overflow-hidden rounded-t-full border-[3px] ${isAnimal ? 'border-white/50 bg-white/15' : 'border-blush/30 bg-blush/5'}`}
                       style={{ borderBottom: 'none' }}>
                    {/* Capsules inside dome */}
                    {isPixel ? (
                      /* Poké Balls bouncing in dome */
                      (['pokeball','greatball','ultraball','pokeball','greatball','pokeball','ultraball','greatball','pokeball','ultraball'] as const).map((ball, i) => {
                        const x = [8,30,55,75,95,110,20,50,80,100];
                        const y = [10,5,15,3,12,6,40,38,42,35];
                        const s = 14;
                        return (
                          <div
                            key={i}
                            className={`absolute ${spinning ? 'animate-[shake_0.08s_ease-in-out_infinite]' : 'animate-[float_3s_ease-in-out_infinite]'}`}
                            style={{
                              left: x[i],
                              top: y[i],
                              animationDelay: `${i * 0.15}s, ${i * 0.15}s`,
                            }}
                          >
                            <PixelSprite name={ball} size={s * 2} />
                          </div>
                        );
                      })
                    ) : (
                      (isAnimal
                        ? ['#f8a6b2','#82d5bb','#f7cd67','#b77dee','#889df0','#e59266','#f8a6b2','#f7cd67','#b77dee','#82d5bb']
                        : [tc.primary, tc.accent, tc.blue, tc.green, tc.primary, tc.accent, tc.blue, tc.green, tc.primary, tc.accent]
                      ).map((color, i) => {
                        const x = [8,30,55,75,95,110,20,50,80,100];
                        const y = [10,5,15,3,12,6,40,38,42,35];
                        const s = [12,14,11,13,10,14,12,13,11,12];
                        return (
                          <div
                            key={i}
                            className={`absolute rounded-full border-2 ${isAnimal ? 'border-white/60' : 'border-white/70'} ${spinning ? 'animate-[shake_0.08s_ease-in-out_infinite]' : 'animate-[float_3s_ease-in-out_infinite]'}`}
                            style={{
                              background: `radial-gradient(circle at 40% 35%, ${color}cc, ${color})`,
                              width: s[i] * 2,
                              height: s[i] * 2,
                              left: x[i],
                              top: y[i],
                              animationDelay: `${i * 0.15}s, ${i * 0.15}s`,
                              boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                            }}
                          />
                        );
                      })
                    )}
                    {/* Glass reflection */}
                    <div className="absolute top-2 left-3 w-10 h-6 rounded-full bg-white/25 rotate-[-15deg]" />
                  </div>
                  {/* Machine base */}
                  <div className={`w-36 h-4 rounded-b-lg border-x-2 border-b-2 ${isAnimal ? 'bg-white/25 border-white/40' : 'bg-blush/10 border-blush/20'}`} />
                  {/* Prize chute */}
                  <div className={`w-8 h-5 rounded-b-lg border-2 mt-[-1px] ${isAnimal ? 'bg-[#5a3a1e]/20 border-white/30' : 'bg-blush/10 border-blush/20'}`} />
                  {/* Chute with random-color dropping capsule */}
                  <div className={`w-5 h-3 rounded-b-md mt-[-1px] ${isAnimal ? 'bg-[#3d2810]/30' : 'bg-blush/10'}`}>
                    {spinning && (
                      isPixel ? (
                        <div className="mx-auto mt-1 animate-[gachaDrop_0.8s_ease-in_infinite]">
                          <PixelSprite name="pokeball" size={14} />
                        </div>
                      ) : (
                        <div className="w-3 h-3 rounded-full mx-auto mt-1 animate-[gachaDrop_0.8s_ease-in_infinite]"
                             style={{ background: `radial-gradient(circle at 40% 35%, ${dropColor}cc, ${dropColor})` }} />
                      )
                    )}
                  </div>
                </div>
              </div>
              {/* Decorative dots */}
              <div className="flex flex-wrap justify-center gap-1 px-4 z-10 mb-3">
                {(isAnimal
                  ? ['#f8a6b2','#82d5bb','#f7cd67','#b77dee','#889df0','#e59266','#f8a6b2','#82d5bb']
                  : [tc.primary, tc.accent, tc.blue, tc.green, tc.primary, tc.accent, tc.blue, tc.green]
                ).map((c, i) => (
                  <div key={i} className="w-3 h-3 rounded-full opacity-60" style={{ background: c }} />
                ))}
              </div>
              <div className={`z-10 rounded-btn px-4 py-1.5 text-sm ${
                isAnimal
                  ? 'bg-white/60 border-2 border-white/50 text-[#725d42]'
                  : 'bg-apricot border-2 border-sunset/30 text-text-secondary'
              }`}>
                {isAnimal ? <AnimalIcon name="miles" size={16} /> : <span>🪙</span>} {cost} 金币/次
              </div>
            </div>

            {/* Spin crank */}
            <button
              onClick={handleSpin}
              disabled={spinning || myCoins < cost}
              className={`absolute -right-3 top-1/2 -translate-y-1/2 shadow-soft-lg
                         flex items-center justify-center transition-all duration-500 z-20 ${
                           isAnimal
                             ? 'w-12 h-12 rounded-full bg-[#f7f3df] border-2 border-[#d5c4a8]'
                             : 'w-14 h-14 rounded-full'
                         } ${
                           spinning
                             ? isAnimal
                               ? 'animate-[spin_0.4s_linear_infinite]'
                               : 'bg-blush text-white animate-[spin_0.5s_linear_infinite]'
                             : myCoins < cost
                               ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                               : isAnimal
                                 ? 'text-[#794f27] hover:scale-110 active:scale-95'
                                 : 'bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-primary)] text-white hover:scale-110 active:scale-95'
                         }`}
            >
              {spinning ? (isAnimal ? (
                <div className="flex items-center justify-center gap-1">
                  <div className="w-1 h-3 rounded-full bg-[#794f27]" />
                  <div className="w-1 h-3 rounded-full bg-[#794f27]" />
                </div>
              ) : '🌀') : isAnimal ? (
                <div className="flex flex-col items-center gap-0.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#794f27]" />
                  <div className="w-1 h-4 rounded-full bg-[#794f27]" />
                </div>
              ) : '🔘'}
            </button>
          </div>

          {myCoins < cost && (
            <p className={`text-sm ${isAnimal ? 'text-[#9f927d]' : 'text-text-secondary'}`}>金币不足~ 去完成一些任务赚金币吧！</p>
          )}

          {/* Scratch card modal */}
          {result && (
            <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                 onClick={closeResult}>
              <div className={`rounded-card p-6 shadow-soft-lg max-w-xs w-full text-center animate-[gachaDrop_0.5s_ease-out] ${
                isAnimal ? 'bg-[#f7f3df] border-3 border-[#d5c4a8]' : 'bg-white'
              }`}
                   onClick={e => e.stopPropagation()}>
                <h3 className="font-title text-xl text-text-primary mb-4">
                  {isAnimal ? <AnimalIcon name="gift" size={24} /> : ''} 刮开看看！
                </h3>

                <div className="relative w-48 h-28 mx-auto mb-4">
                  <div className={`absolute inset-0 rounded-xl border-2 flex flex-col items-center justify-center ${
                    result.rarity === 'super'
                      ? isAnimal ? 'bg-[#f8a6b2]/20 border-[#f8a6b2]' : 'bg-blush/20 border-blush'
                      : result.rarity === 'rare'
                        ? isAnimal ? 'bg-[#889df0]/20 border-[#889df0]' : 'bg-calm/20 border-calm'
                        : isAnimal ? 'bg-[#82d5bb]/20 border-[#82d5bb]' : 'bg-mint/20 border-mint'
                  }`}>
                    <span className="text-4xl">{result.icon}</span>
                    <span className="font-bold text-lg text-text-primary mt-1">{result.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full mt-1"
                          style={{ backgroundColor: rarityConfig[result.rarity].color + '40', color: 'var(--color-text)' }}>
                      {rarityConfig[result.rarity].label}
                    </span>
                  </div>

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
                    className={`w-full py-3 rounded-btn text-white font-semibold transition-all ${
                      isAnimal ? 'bg-[#19c8b9] border-b-2 border-[#14b5a7]' : 'btn-gradient'
                    }`}>
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
              {isAnimal ? <AnimalIcon name="shopping" size={56} className="mx-auto mb-3" /> : <span className="text-5xl block mb-3">🎒</span>}
              <p className="font-semibold">背包空空</p>
              <p className="text-sm mt-1">去扭个蛋吧~</p>
            </div>
          ) : (
            <>
              {unusedItems.length > 0 && (
                <div>
                  <h3 className="font-semibold text-text-primary text-sm mb-2 flex items-center gap-2">
                    {isAnimal ? <AnimalIcon name="gift" size={20} /> : <span>🎁</span>}
                    未使用 ({unusedItems.length})
                  </h3>
                  <div className="space-y-2">
                    {[...unusedItems].sort((a, b) => b.obtainedAt - a.obtainedAt).map(item => (
                      <div key={item.id}
                        className={`rounded-card p-3 flex items-center gap-3 ${
                          isAnimal ? 'bg-[#f7f3df] border-2 border-[#e8dcc8]' : 'bg-white shadow-soft'
                        }`}>
                        <span className="text-3xl">{item.icon}</span>
                        <div className="flex-1">
                          <p className={`font-semibold text-sm ${isAnimal ? 'text-[#725d42]' : 'text-text-primary'}`}>{item.name}</p>
                          <span className="text-xs px-1.5 py-0.5 rounded-full"
                                style={{ backgroundColor: rarityConfig[item.rarity].color + '40', color: 'var(--color-text)' }}>
                            {rarityConfig[item.rarity].label}
                          </span>
                        </div>
                        <button
                          onClick={() => handleUse(item.id)}
                          className={`px-3 py-1.5 rounded-btn text-xs font-semibold active:scale-95 transition-all ${
                            isAnimal
                              ? 'bg-[#19c8b9]/15 text-[#19c8b9] border border-[#19c8b9]/30 hover:bg-[#19c8b9]/25'
                              : 'bg-blush/10 text-blush hover:bg-blush/20'
                          }`}
                        >
                          使用
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {usedItems.length > 0 && (
                <div>
                  <h3 className="text-text-secondary text-sm mb-2 flex items-center gap-2">
                    {isAnimal ? <AnimalIcon name="critterpedia" size={20} /> : <span>📋</span>}
                    已使用 ({usedItems.length})
                  </h3>
                  <div className="space-y-2 opacity-60">
                    {[...usedItems].sort((a, b) => b.obtainedAt - a.obtainedAt).slice(0, 10).map(item => (
                      <div key={item.id}
                        className={`rounded-card p-3 flex items-center gap-3 line-through ${isAnimal ? 'bg-[#f0e8d8]' : 'bg-gray-50'}`}>
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

          {partner && (state.gachaItems || []).filter(i => i.userId === partner.id && !i.used).length > 0 && (
            <div>
              <h3 className="font-semibold text-text-primary text-sm mb-2 flex items-center gap-2">
                {isAnimal ? <AnimalIcon name="heart" size={20} /> : <span>💝</span>}
                {partner.nickname}的奖品
              </h3>
              <div className="space-y-2">
                {(state.gachaItems || []).filter(i => i.userId === partner.id && !i.used).map(item => (
                  <div key={item.id}
                    className={`rounded-card p-3 flex items-center gap-3 opacity-70 ${isAnimal ? 'bg-[#f7f3df] border-2 border-[#e8dcc8]' : 'bg-white shadow-soft'}`}>
                    <span className="text-3xl">{item.icon}</span>
                    <div className="flex-1">
                      <p className={`font-semibold text-sm ${isAnimal ? 'text-[#725d42]' : 'text-text-primary'}`}>{item.name}</p>
                      <span className="text-xs px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: rarityConfig[item.rarity].color + '40', color: 'var(--color-text)' }}>
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
