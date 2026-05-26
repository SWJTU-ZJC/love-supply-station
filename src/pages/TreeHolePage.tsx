import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface Message {
  id: string;
  fromUserId: string;
  content: string;
  createdAt: number;
}

export default function TreeHolePage() {
  const { user, partner } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [showCompose, setShowCompose] = useState(false);
  const [content, setContent] = useState('');
  const [revealing, setRevealing] = useState<string | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [burning, setBurning] = useState<string | null>(null);

  const unreadMessages = messages.filter(m => !revealedIds.has(m.id));
  const hasUnread = unreadMessages.length > 0;

  const handleSend = () => {
    if (!content.trim() || !user) return;
    const msg: Message = {
      id: Date.now().toString(),
      fromUserId: user.id,
      content: content.trim(),
      createdAt: Date.now(),
    };
    setMessages(prev => [msg, ...prev]);
    setContent('');
    setShowCompose(false);
  };

  const handleReveal = (msg: Message) => {
    setRevealing(msg.id);
    setTimeout(() => {
      setBurning(msg.id);
      setTimeout(() => {
        setRevealedIds(prev => new Set(prev).add(msg.id));
        setRevealing(null);
        setBurning(null);
      }, 2000);
    }, 3000);
  };

  // Generate stars
  const stars = Array.from({ length: 50 }, () => ({
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    delay: `${Math.random() * 5}s`,
    size: 1 + Math.random() * 2,
  }));

  return (
    <div className="min-h-screen bg-[#1a1a2e] relative overflow-hidden">
      {/* Starry background */}
      <div className="absolute inset-0">
        {stars.map((star, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              animation: `twinkle ${2 + Math.random() * 3}s ease-in-out ${star.delay} infinite`,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 px-5 pt-8 pb-20">
        <h1 className="font-title text-3xl text-white mb-2">🌳 悄悄话树洞</h1>
        <p className="text-white/60 text-sm mb-6">每一句话，只能看一次</p>

        {/* Unread indicator */}
        {hasUnread && (
          <div className="bg-blush/20 border border-blush/40 rounded-card p-4 mb-6 animate-[float_3s_ease-in-out_infinite]">
            <p className="text-blush text-center font-semibold">
              💌 有 {unreadMessages.length} 条新悄悄话
            </p>
          </div>
        )}

        {/* Messages */}
        <div className="space-y-4">
          {messages.map(msg => {
            const isRevealed = revealedIds.has(msg.id);
            const isRevealing = revealing === msg.id;
            const isBurning = burning === msg.id;

            if (isRevealed && !isBurning) return null;

            return (
              <div key={msg.id} className="relative">
                {!isRevealed ? (
                  <button
                    onClick={() => handleReveal(msg)}
                    className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-card p-5
                             text-left hover:bg-white/20 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">💌</span>
                      <div>
                        <p className="text-white/80 text-sm">
                          来自 {msg.fromUserId === user?.id ? '我' : partner?.nickname}
                        </p>
                        <p className="text-white/40 text-xs mt-1">
                          {new Date(msg.createdAt).toLocaleString('zh-CN')}
                        </p>
                      </div>
                    </div>
                    <p className="text-white/50 text-xs mt-3">点击打开 →</p>
                  </button>
                ) : isRevealing && !isBurning ? (
                  <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-card p-5">
                    <p className="text-white text-base leading-relaxed">{msg.content}</p>
                    <p className="text-white/40 text-xs mt-2">
                      —— {msg.fromUserId === user?.id ? '我' : partner?.nickname}
                    </p>
                  </div>
                ) : isBurning ? (
                  <div className="bg-white/10 backdrop-blur-sm border border-orange-500/30 rounded-card p-5 animate-[burn_2s_ease-in_forwards]">
                    <p className="text-orange-300 text-base leading-relaxed">{msg.content}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-lg">🔥</span>
                      <span className="text-orange-400/60 text-xs">正在消失...</span>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          {messages.length === 0 && !hasUnread && (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">🌳</div>
              <p className="text-white/50">树洞里还没有悄悄话</p>
              <p className="text-white/30 text-sm mt-1">写下第一句心里话吧~</p>
            </div>
          )}
        </div>
      </div>

      {/* Compose FAB */}
      <button
        onClick={() => setShowCompose(true)}
        className="fixed bottom-24 right-6 w-14 h-14 rounded-full shadow-soft-lg z-40
                 bg-[radial-gradient(circle_at_30%_30%,#A0C4FF,#D4A5FF)]
                 text-white text-2xl flex items-center justify-center
                 hover:scale-110 active:scale-95 transition-all"
      >
        ✏️
      </button>

      {/* Compose modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
             onClick={() => setShowCompose(false)}>
          <div
            className="bg-[#1e1e3a] border border-white/20 rounded-card p-6 shadow-soft-lg
                       max-w-sm w-full animate-[gachaDrop_0.5s_ease-out]"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-title text-xl text-white mb-4">写一句悄悄话 ✨</h3>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="说点什么..."
              className="w-full px-4 py-3 rounded-btn bg-white/10 text-white text-sm
                       focus:outline-none focus:ring-2 focus:ring-calm/50 mb-4
                       placeholder:text-white/30 resize-none h-32"
              autoFocus
              maxLength={200}
            />
            <p className="text-white/30 text-xs mb-4">发送后，对方只能看一次就会消失</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCompose(false)}
                className="flex-1 py-3 rounded-btn bg-white/10 text-white font-semibold"
              >
                取消
              </button>
              <button
                onClick={handleSend}
                disabled={!content.trim()}
                className="flex-1 py-3 rounded-btn text-white font-semibold
                         bg-[radial-gradient(circle_at_30%_30%,#A0C4FF,#D4A5FF)]
                         disabled:opacity-50"
              >
                发送 💌
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
