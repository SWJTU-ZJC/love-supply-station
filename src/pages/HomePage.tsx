import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../contexts/SyncContext';
import { getDaysUntil } from './AnniversaryPage';
import MoodBar from '../components/MoodBar';
import DailyPhotoStrip from '../components/DailyPhotoStrip';
import FeatureGrid from '../components/FeatureGrid';
import confetti from 'canvas-confetti';
import { useTheme, themeColors } from '../contexts/ThemeContext';
import PixelSprite from '../components/PixelSprite';

export default function HomePage() {
  const { user, partner } = useAuth();
  const { state } = useSync();
  const { theme, uiMode } = useTheme();
  const isPixel = uiMode === 'pixel';
  const tc = themeColors[theme];
  const [showHearts, setShowHearts] = useState(false);
  const navigate = useNavigate();

  const upcomingAnniversary = useMemo(() => {
    const list = state.anniversaries || [];
    let closest: { title: string; daysLeft: number } | null = null;
    for (const a of list) {
      const days = getDaysUntil(a.date);
      if (days >= 0 && days <= 7) {
        if (!closest || days < closest.daysLeft) {
          closest = { title: a.title, daysLeft: days };
        }
      }
    }
    return closest;
  }, [state.anniversaries]);

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
        colors: [tc.primary, tc.accent, tc.blue, tc.green],
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
      <div className="text-center">
        <div className="flex items-center justify-center gap-1.5">
          <span className="animate-[float_3s_ease-in-out_infinite]">
            {isPixel ? <PixelSprite name="snorlax" size={40} /> : <span className="text-2xl">🐻</span>}
          </span>
          <h1 className="font-title text-4xl bg-gradient-to-r from-blush via-sunset to-blush bg-clip-text text-transparent">
            张佳琛 & 周佳慧
          </h1>
          <span className="animate-[float_3s_ease-in-out_infinite_0.5s]">
            {isPixel ? <PixelSprite name="clefairy" size={40} /> : <span className="text-2xl">🐰</span>}
          </span>
        </div>
        <p className="text-text-secondary text-xs mt-0.5">💕 恋爱补给站 💕</p>
      </div>

      {/* Upcoming anniversary banner */}
      {upcomingAnniversary && (
        <div
          className="bg-gradient-to-r from-blush/20 to-sunset/20 rounded-card px-4 py-3
                    flex items-center gap-3 shadow-soft cursor-pointer
                    animate-[fadeSlideIn_0.3s_ease-out]"
          onClick={() => navigate('/anniversary')}
        >
          <span className="text-2xl">
            {upcomingAnniversary.daysLeft === 0 ? '🎉' : '📅'}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary">{upcomingAnniversary.title}</p>
            <p className="text-xs text-text-secondary">
              {upcomingAnniversary.daysLeft === 0
                ? '就是今天！'
                : `还有 ${upcomingAnniversary.daysLeft} 天`
              }
            </p>
          </div>
          <span className="text-text-secondary text-lg">→</span>
        </div>
      )}

      <div className="flex items-center justify-between mt-1">
        <p className="text-text-secondary text-xs">
          {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })}
        </p>
        <div className="flex items-center gap-1.5 bg-white rounded-full px-3 py-1.5 shadow-soft">
          {isPixel ? <PixelSprite name="meowth" size={30} /> : <span className="text-sm">🪙</span>}
          <span className="font-semibold text-sunset text-sm">{myCoins}</span>
        </div>
      </div>

      {/* Mood Bar */}
      <MoodBar currentMood={myMood} onMoodSelect={handleMoodSelect} />

      {/* Partner Status Card */}
      <div className="bg-white rounded-card p-5 shadow-soft">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-apricot flex items-center justify-center
                          ring-4 ring-blush/20">
              {isPixel ? <PixelSprite name="snorlax" size={40} /> : <span className="text-3xl">{partner.avatar}</span>}
            </div>
            <div className="absolute -bottom-1 -right-1">{isPixel ? <PixelSprite name="clefairy" size={24} /> : <span className="text-xl">{partnerMood}</span>}</div>
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
