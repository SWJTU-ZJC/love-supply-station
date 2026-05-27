import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../contexts/SyncContext';
import confetti from 'canvas-confetti';

export default function ProfilePage() {
  const { user, partner, logout } = useAuth();
  const { state, connected, lastSync, updateCoins } = useSync();

  if (!user || !partner) return null;

  const myCoins = state.coins.find(c => c.userId === user.id)?.coins ?? user.coins ?? 50;
  const myMood = state.moods.find(m => m.userId === user.id)?.mood || user.mood;
  const partnerMood = state.moods.find(m => m.userId === partner.id)?.mood || partner.mood;

  const checkinCount = state.checkins?.filter(c => c.userId === user.id).length || 0;
  const photoCount = state.photos?.filter(p => p.userId === user.id).length || 0;
  const doneCount = state.littleThings?.filter(t => t.isDone).length || 0;
  const msgCount = state.messages?.filter(m => m.fromUserId === user.id).length || 0;

  const today = new Date().toISOString().split('T')[0];
  const [claimedToday, setClaimedToday] = useState(
    () => localStorage.getItem('daily-coin-claimed') === today
  );

  const handleDailyLogin = () => {
    if (claimedToday) return;
    localStorage.setItem('daily-coin-claimed', today);
    setClaimedToday(true);
    updateCoins(myCoins + 2);
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 }, colors: ['#FFC3A0', '#FFB3B3'] });
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
          <div className="text-3xl mb-1">💌</div>
          <p className="text-xl font-bold text-sunset">{msgCount}</p>
          <p className="text-text-secondary text-xs">悄悄话</p>
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
        <button className="w-full flex items-center gap-3 px-5 py-4 hover:bg-apricot/30 transition-colors border-b border-apricot/30">
          <span className="text-xl">🎨</span>
          <span className="text-text-primary text-sm">更换主题配色</span>
        </button>
        <button className="w-full flex items-center gap-3 px-5 py-4 hover:bg-apricot/30 transition-colors border-b border-apricot/30">
          <span className="text-xl">🔔</span>
          <span className="text-text-primary text-sm">通知设置</span>
        </button>
        <button className="w-full flex items-center gap-3 px-5 py-4 hover:bg-apricot/30 transition-colors border-b border-apricot/30">
          <span className="text-xl">💬</span>
          <span className="text-text-primary text-sm">关于恋爱补给站</span>
        </button>
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
