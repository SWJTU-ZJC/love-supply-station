import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../contexts/SyncContext';
import { useTheme, themeLabels, themeColors, uiModeLabels, type Theme, type UIMode } from '../contexts/ThemeContext';
import confetti from 'canvas-confetti';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, partner, logout } = useAuth();
  const { state, connected, lastSync, updateCoins } = useSync();
  const { theme, setTheme, uiMode, setUIMode } = useTheme();
  const tc = themeColors[theme];

  if (!user || !partner) return null;

  const myCoins = state.coins.find(c => c.userId === user.id)?.coins ?? user.coins ?? 5;
  const myMood = state.moods.find(m => m.userId === user.id)?.mood || user.mood;
  const partnerMood = state.moods.find(m => m.userId === partner.id)?.mood || partner.mood;

  const checkinCount = state.checkins?.filter(c => c.userId === user.id).length || 0;
  const photoCount = state.photos?.filter(p => p.userId === user.id).length || 0;
  const doneCount = state.littleThings?.filter(t => t.isDone).length || 0;

  const today = new Date().toISOString().split('T')[0];
  const [claimedToday, setClaimedToday] = useState(
    () => localStorage.getItem('daily-coin-claimed') === today
  );

  const handleDailyLogin = () => {
    if (claimedToday) return;
    localStorage.setItem('daily-coin-claimed', today);
    setClaimedToday(true);
    updateCoins(myCoins + 2);
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 }, colors: [tc.accent, tc.primary] });
  };

  return (
    <div className="page-enter px-5 pt-8 pb-4 space-y-6">
      <div className="text-center">
        <div className="w-24 h-24 rounded-full bg-apricot mx-auto flex items-center justify-center text-5xl
                      ring-4 ring-blush/20 shadow-soft-lg mb-4">
          {user.avatar}
        </div>
        <h2 className="font-title text-2xl text-text-primary">{user.nickname}</h2>
        <div className="flex items-center justify-center gap-1 mt-1">
          <span className="text-lg">{myMood}</span>
          <span className="text-text-secondary text-sm">当前心情</span>
        </div>
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-mint' : 'bg-text-secondary/30'}`} />
          <span className="text-xs text-text-secondary">
            {connected ? (lastSync || '已连接') : '未连接'}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-card p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-sunset/20 flex items-center justify-center text-2xl">🪙</div>
            <div>
              <p className="text-2xl font-bold text-sunset">{myCoins}</p>
              <p className="text-text-secondary text-xs">金币余额</p>
            </div>
          </div>
          <button
            onClick={handleDailyLogin}
            disabled={claimedToday}
            className={`px-4 py-2 rounded-btn text-sm font-semibold transition-colors ${
              claimedToday
                ? 'bg-gray-100 text-text-secondary cursor-not-allowed'
                : 'bg-sunset/10 text-sunset hover:bg-sunset/20'
            }`}
          >
            {claimedToday ? '今日已签到' : '每日签到 +2'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-card p-4 shadow-soft text-center">
          <div className="text-3xl mb-1">🎬</div>
          <p className="text-xl font-bold text-blush">{photoCount}</p>
          <p className="text-text-secondary text-xs">上传照片</p>
        </div>
        <div className="bg-white rounded-card p-4 shadow-soft text-center">
          <div className="text-3xl mb-1">📍</div>
          <p className="text-xl font-bold text-calm">{checkinCount}</p>
          <p className="text-text-secondary text-xs">打卡地点</p>
        </div>
        <div className="bg-white rounded-card p-4 shadow-soft text-center">
          <div className="text-3xl mb-1">✅</div>
          <p className="text-xl font-bold text-mint">{doneCount}</p>
          <p className="text-text-secondary text-xs">完成小事</p>
        </div>
      </div>

      <div className="bg-white rounded-card p-5 shadow-soft">
        <h3 className="font-semibold text-text-primary mb-3">我的 Ta</h3>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-apricot flex items-center justify-center text-3xl">
            {partner.avatar}
          </div>
          <div>
            <p className="font-semibold text-text-primary">{partner.nickname}</p>
            <p className="text-text-secondary text-sm">心情：{partnerMood}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-card shadow-soft overflow-hidden">
        <button
          onClick={() => navigate('/about')}
          className="w-full flex items-center gap-3 px-5 py-4 hover:bg-apricot/30 transition-colors border-b border-apricot/30"
        >
          <span className="text-xl">💬</span>
          <span className="text-text-primary text-sm">关于恋爱补给站</span>
        </button>

        {/* Theme Switcher */}
        <div className="px-5 py-4 border-b border-apricot/30">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xl">🎨</span>
            <span className="text-text-primary text-sm">主题配色</span>
            <span className="text-text-secondary text-xs ml-auto">{themeLabels[theme]}</span>
          </div>
          <div className="flex gap-3">
            {(Object.keys(themeLabels) as Theme[]).map(t => {
              const c = themeColors[t];
              return (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`flex flex-col items-center gap-1.5 flex-1 py-2.5 rounded-xl transition-all
                    ${theme === t ? 'bg-apricot ring-2 ring-blush/40' : 'hover:bg-apricot/30'}`}
                >
                  <div className="flex gap-0.5">
                    <div className="w-4 h-4 rounded-full" style={{ background: c.primary }} />
                    <div className="w-4 h-4 rounded-full" style={{ background: c.accent }} />
                    <div className="w-4 h-4 rounded-full" style={{ background: c.blue }} />
                    <div className="w-4 h-4 rounded-full" style={{ background: c.green }} />
                  </div>
                  <span className="text-xs text-text-secondary">{themeLabels[t]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* UI Mode Switcher */}
        <div className="px-5 py-4 border-b border-apricot/30">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xl">🎭</span>
            <span className="text-text-primary text-sm">界面风格</span>
            <span className="text-text-secondary text-xs ml-auto">{uiModeLabels[uiMode]}</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(uiModeLabels) as UIMode[]).map(m => (
              <button
                key={m}
                onClick={() => setUIMode(m)}
                className={`flex flex-col items-center gap-1 py-2 rounded-xl text-xs transition-all
                  ${uiMode === m ? 'bg-apricot ring-2 ring-blush/40' : 'hover:bg-apricot/30 text-text-secondary'}`}
              >
                <span className="text-lg">
                  {m === 'default' ? '📐' : m === 'glass' ? '🫧' : m === 'editorial' ? '📰' : m === 'playful' ? '🎈' : '🍂'}
                </span>
                <span className={uiMode === m ? 'text-text-primary font-semibold' : ''}>{uiModeLabels[m]}</span>
              </button>
            ))}
          </div>
        </div>

        <button onClick={logout}
          className="w-full flex items-center gap-3 px-5 py-4 hover:bg-red-50 transition-colors">
          <span className="text-xl">🚪</span>
          <span className="text-red-400 text-sm">退出登录</span>
        </button>
      </div>

      <p className="text-center text-text-secondary/50 text-xs pb-8">
        恋爱补给站 v1.0 · P2P Sync · Made with 💕
      </p>
    </div>
  );
}
