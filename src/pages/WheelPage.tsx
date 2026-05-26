import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSync } from '../contexts/SyncContext';
import confetti from 'canvas-confetti';

interface WheelItem {
  text: string;
  icon: string;
  color: string;
}

const defaultItems: WheelItem[] = [
  { text: '按摩券', icon: '💆', color: '#FFB3B3' },
  { text: '做饭券', icon: '🍳', color: '#FFC3A0' },
  { text: '电影券', icon: '🎬', color: '#A0C4FF' },
  { text: '抱抱券', icon: '🤗', color: '#A8E6CE' },
  { text: '亲亲券', icon: '💋', color: '#FFD4A0' },
  { text: '唱歌券', icon: '🎤', color: '#D4A5FF' },
  { text: '洗碗券', icon: '🧼', color: '#FFE0B2' },
  { text: '原谅券', icon: '🙏', color: '#B2DFDB' },
];

const PI = Math.PI;
const TAU = PI * 2;

export default function WheelPage() {
  const navigate = useNavigate();
  const { addWheelResult } = useSync();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [items] = useState<WheelItem[]>(defaultItems);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<WheelItem | null>(null);
  const [showResult, setShowResult] = useState(false);
  const rotationRef = useRef(0);
  const animFrameRef = useRef<number>(0);

  const drawWheel = useCallback((rotation: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(cx, cy) - 10;
    const sliceAngle = TAU / items.length;

    ctx.clearRect(0, 0, w, h);

    items.forEach((item, i) => {
      const startAngle = rotation + i * sliceAngle;
      const endAngle = startAngle + sliceAngle;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = item.color;
      ctx.fill();
      ctx.strokeStyle = '#FFFBF5';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#4A3F3F';
      ctx.font = 'bold 14px Nunito, sans-serif';
      ctx.fillText(item.icon, r * 0.6, 4);
      ctx.font = '11px Nunito, sans-serif';
      ctx.fillText(item.text, r * 0.6, 20);
      ctx.restore();
    });

    ctx.beginPath();
    ctx.arc(cx, cy, 35, 0, TAU);
    ctx.fillStyle = '#FFFBF5';
    ctx.fill();
    ctx.strokeStyle = '#FFB3B3';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, cy - r - 5);
    ctx.lineTo(cx - 12, cy - r - 20);
    ctx.lineTo(cx + 12, cy - r - 20);
    ctx.closePath();
    ctx.fillStyle = '#FFB3B3';
    ctx.fill();
  }, [items]);

  useEffect(() => {
    drawWheel(rotationRef.current);
  }, [drawWheel]);

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    setShowResult(false);
    setResult(null);

    const totalRotation = rotationRef.current + (5 + Math.random() * 5) * TAU;
    const startRotation = rotationRef.current;
    const duration = 4000 + Math.random() * 1000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const rotation = startRotation + (totalRotation - startRotation) * eased;
      rotationRef.current = rotation % TAU;
      drawWheel(rotationRef.current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setSpinning(false);
        const sliceAngle = TAU / items.length;
        const normalizedRotation = ((rotationRef.current % TAU) + TAU) % TAU;
        const pointerAngle = -PI / 2;
        const adjusted = ((pointerAngle - normalizedRotation) % TAU + TAU) % TAU;
        const index = Math.floor(adjusted / sliceAngle);
        const winner = items[index];
        setResult(winner);
        setShowResult(true);
        addWheelResult(winner.text);
        confetti({
          particleCount: 80,
          spread: 100,
          origin: { y: 0.5 },
          colors: ['#FFB3B3', '#FFC3A0', '#A0C4FF', '#A8E6CE'],
        });
      }
    };
    animFrameRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-4 py-8">
      <button onClick={() => navigate(-1)}
        className="absolute top-6 left-6 w-10 h-10 rounded-full bg-white shadow-soft flex items-center justify-center text-lg hover:scale-110 transition-transform">←</button>

      <h1 className="font-title text-3xl text-text-primary mb-2">🎡 命运转盘</h1>
      <p className="text-text-secondary text-sm mb-6">看看今天能抽到什么惊喜？</p>

      <div className="relative">
        <canvas ref={canvasRef} width={340} height={340} className="max-w-full" />
        <button
          onClick={spin}
          disabled={spinning}
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                     w-16 h-16 rounded-full bg-white shadow-soft-lg
                     flex items-center justify-center text-lg font-semibold text-text-primary
                     hover:scale-110 active:scale-95 transition-all duration-300 z-10
                     ${spinning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {spinning ? '🌀' : 'GO'}
        </button>
      </div>

      {showResult && result && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4"
             onClick={() => setShowResult(false)}>
          <div className="bg-white rounded-card p-8 shadow-soft-lg max-w-sm w-full text-center animate-[gachaDrop_0.5s_ease-out]"
               onClick={e => e.stopPropagation()}>
            <div className="text-6xl mb-4">{result.icon}</div>
            <h2 className="font-title text-2xl text-text-primary mb-2">恭喜获得</h2>
            <p className="text-3xl font-bold text-blush mb-6">{result.text}</p>
            <div className="flex gap-3">
              <button onClick={() => setShowResult(false)}
                className="flex-1 py-3 rounded-btn bg-apricot text-text-primary font-semibold hover:bg-apricot/80 transition-colors">先存着</button>
              <button onClick={() => { setShowResult(false); confetti({ particleCount: 100, spread: 120, origin: { y: 0.5 } }); }}
                className="flex-1 py-3 rounded-btn text-white font-semibold bg-[radial-gradient(circle_at_30%_30%,#FFB3B3,#FFC3A0)] hover:shadow-soft-lg transition-all">
                立即使用 ✨
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
