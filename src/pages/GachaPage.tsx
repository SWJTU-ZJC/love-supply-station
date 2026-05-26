import { useState, useRef } from 'react';
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
  const { user } = useAuth();
  const { state, updateCoins } = useSync();
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<GachaItem | null>(null);
  const [showScratch, setShowScratch] = useState(false);
  const [scratched, setScratched] = useState(false);
  const scratchCanvasRef = useRef<HTMLCanvasElement>(null);

  const cost = 10;
  const myCoins = state.coins.find(c => c.userId === user?.id)?.coins ?? user?.coins ?? 50;

  const handleSpin = () => {
    if (spinning || myCoins < cost) return;
    setSpinning(true);
    updateCoins(myCoins - cost);

    setTimeout(() => {
      const item = pickGacha();
      setResult(item);
      setSpinning(false);
      setScratched(false);
      setShowScratch(true);
    }, 1500);
  };

  const handleScratchStart = () => {
    const canvas = scratchCanvasRef.current;
    if (!canvas || scratched) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#D4D4D4';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#9E9E9E';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('刮开有惊喜', canvas.width / 2, canvas.height / 2 + 7);

    let isDrawing = false;

    const scratch = (x: number, y: number) => {
      if (scratched) return;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, 25, 0, Math.PI * 2);
      ctx.fill();
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;
      let transparent = 0;
      for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i] === 0) transparent++;
      }
      if (transparent / (pixels.length / 4) > 0.5) {
        setScratched(true);
        confetti({ particleCount: 60, spread: 80, origin: { y: 0.6 }, colors: ['#FFB3B3', '#FFC3A0', '#A0C4FF'] });
      }
    };

    const getPos = (e: MouseEvent | Touch) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onMouseDown = (e: MouseEvent) => { isDrawing = true; const p = getPos(e); scratch(p.x, p.y); };
    const onMouseMove = (e: MouseEvent) => { if (isDrawing) { const p = getPos(e); scratch(p.x, p.y); } };
    const onMouseUp = () => { isDrawing = false; };
    const onTouchStart = (e: TouchEvent) => { e.preventDefault(); const p = getPos(e.touches[0]); scratch(p.x, p.y); };
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); const p = getPos(e.touches[0]); scratch(p.x, p.y); };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center px-4 py-8">
      <button onClick={() => navigate(-1)}
        className="absolute top-6 left-6 w-10 h-10 rounded-full bg-white shadow-soft flex items-center justify-center text-lg hover:scale-110 transition-transform">←</button>

      <h1 className="font-title text-3xl text-text-primary mb-2">🎪 恋爱扭蛋机</h1>

      <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-soft mb-6">
        <span className="text-lg">🪙</span>
        <span className="font-semibold text-sunset">{myCoins}</span>
        <span className="text-text-secondary text-sm">金币</span>
      </div>

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

      {showScratch && result && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4"
             onClick={() => setShowScratch(false)}>
          <div className="bg-white rounded-card p-6 shadow-soft-lg max-w-xs w-full text-center animate-[gachaDrop_0.5s_ease-out]"
               onClick={e => e.stopPropagation()}>
            <h3 className="font-title text-xl text-text-primary mb-4">刮开看看！</h3>
            <div className="relative w-48 h-28 mx-auto mb-4">
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
              <canvas
                ref={scratchCanvasRef}
                width={192} height={112}
                className="absolute inset-0 rounded-xl cursor-pointer"
                onMouseEnter={() => !scratched && handleScratchStart()}
                onTouchStart={() => !scratched && handleScratchStart()}
              />
            </div>
            {scratched ? (
              <button onClick={() => setShowScratch(false)}
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
    </div>
  );
}
