import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../contexts/SyncContext';
import MoodBar from '../components/MoodBar';
import DailyPhotoStrip from '../components/DailyPhotoStrip';
import FeatureGrid from '../components/FeatureGrid';
import confetti from 'canvas-confetti';

export default function HomePage() {
  const { user, partner } = useAuth();
  const { state } = useSync();
  const [showHearts, setShowHearts] = useState(false);

  const myMood = state.moods.find(m => m.userId === user?.id)?.mood || user?.mood || '😊';
  const partnerMood = state.moods.find(m => m.userId === partner?.id)?.mood || partner?.mood || '😊';
  const myCoins = state.coins.find(c => c.userId === user?.id)?.coins ?? user?.coins ?? 5;
  const partnerCoins = state.coins.find(c => c.userId === partner?.id)?.coins ?? partner?.coins ?? 5;

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

  if (!user || !partner) return null;

  return (
    <div className="page-enter px-5 pt-8 pb-4 space-y-6">
      {/* Header */}
      <div className="text-center mb-2">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-2xl animate-[float_3s_ease-in-out_infinite]">🐰</span>
          <h1 className="font-title text-4xl bg-gradient-to-r from-blush via-sunset to-calm bg-clip-text text-transparent">
            张佳琛 & 周佳慧
          </h1>
          <span className="text-2xl animate-[float_3s_ease-in-out_infinite_0.5s]">🐻</span>
        </div>
        <p className="text-text-secondary text-xs">
          {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })}
        </p>
      </div>

      {/* Coin bar */}
      <div className="flex items-center justify-center gap-2 bg-white rounded-full px-4 py-2 shadow-soft mx-auto w-fit">
        <span className="text-lg">🪙</span>
        <span className="font-semibold text-sunset">{myCoins}</span>
      </div>

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
