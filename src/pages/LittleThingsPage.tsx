import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../contexts/SyncContext';
import confetti from 'canvas-confetti';

export default function LittleThingsPage() {
  const navigate = useNavigate();
  const { user, partner } = useAuth();
  const { state, toggleLittleThing, addLittleThing, updateCoins } = useSync();
  const [showAdd, setShowAdd] = useState(false);
  const [newThing, setNewThing] = useState('');

  const things = state.littleThings || [];
  const doneCount = things.filter(t => t.isDone).length;
  const progress = things.length > 0 ? Math.round((doneCount / things.length) * 100) : 0;

  const myCoins = state.coins.find(c => c.userId === user?.id)?.coins ?? 50;

  const handleToggle = (id: string) => {
    const thing = things.find(t => t.id === id);
    if (!thing || thing.isDone) return;
    toggleLittleThing(id);
    updateCoins(myCoins + 5);
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#A8E6CE', '#FFB3B3', '#FFC3A0'],
    });
  };

  const handleAdd = () => {
    if (!newThing.trim() || !user) return;
    addLittleThing({
      text: newThing.trim(),
      isDone: false,
      doneTime: null,
      proposedBy: user.id,
    });
    setNewThing('');
    setShowAdd(false);
  };

  return (
    <div className="min-h-screen bg-cream px-4 py-8">
      <button
        onClick={() => navigate(-1)}
        className="w-10 h-10 rounded-full bg-white shadow-soft
                 flex items-center justify-center text-lg hover:scale-110 transition-transform mb-4"
      >
        ←
      </button>

      <h1 className="font-title text-3xl text-text-primary mb-2">📝 我们的100件小事</h1>

      <div className="bg-white rounded-card p-4 shadow-soft mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-text-primary">完成进度</span>
          <span className="text-sm text-blush font-bold">{doneCount}/{things.length}</span>
        </div>
        <div className="h-3 bg-apricot rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #FFB3B3, #FFC3A0)',
            }}
          />
        </div>
        <p className="text-xs text-text-secondary mt-2">每完成一件小事获得 🪙 5 金币</p>
      </div>

      <div className="space-y-2 mb-20">
        {things.map(thing => (
          <button
            key={thing.id}
            onClick={() => handleToggle(thing.id)}
            disabled={thing.isDone}
            className={`w-full flex items-center gap-3 p-4 rounded-sm-card text-left
                       transition-all duration-300
                       ${thing.isDone
                         ? 'bg-mint/10 opacity-70'
                         : 'bg-white shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 active:scale-[0.99]'
                       }`}
          >
            <div className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center
                          transition-all duration-300
                          ${thing.isDone
                            ? 'bg-mint border-mint text-white'
                            : 'border-blush/40 text-transparent hover:border-blush'
                          }`}
            >
              {thing.isDone ? '✓' : ''}
            </div>
            <span className={`flex-1 text-sm ${thing.isDone ? 'line-through text-text-secondary' : 'text-text-primary'}`}>
              {thing.text}
            </span>
            {thing.isDone && thing.doneTime && (
              <span className="text-xs text-text-secondary">{thing.doneTime.slice(5)}</span>
            )}
            {!thing.isDone && (
              <span className="text-xs text-text-secondary">
                {thing.proposedBy === user?.id ? '我' : partner?.nickname} 提议
              </span>
            )}
          </button>
        ))}
      </div>

      {!showAdd ? (
        <button
          onClick={() => setShowAdd(true)}
          className="fixed bottom-24 right-6 w-14 h-14 rounded-full shadow-soft-lg
                   bg-[radial-gradient(circle_at_30%_30%,#FFB3B3,#FFC3A0)]
                   text-white text-2xl flex items-center justify-center
                   hover:scale-110 active:scale-95 transition-all z-40"
        >
          +
        </button>
      ) : (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-app bg-white rounded-t-card
                      shadow-soft-lg p-5 z-40 animate-[fadeSlideIn_0.3s_ease-out]">
          <h3 className="font-semibold text-text-primary mb-3">添加一件小事</h3>
          <input
            type="text"
            value={newThing}
            onChange={e => setNewThing(e.target.value)}
            placeholder="写下你们想一起做的事..."
            className="w-full px-4 py-3 rounded-btn bg-apricot/50 text-text-primary
                     focus:outline-none focus:ring-2 focus:ring-blush/50 mb-3"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <div className="flex gap-3">
            <button onClick={() => setShowAdd(false)}
              className="flex-1 py-3 rounded-btn bg-apricot text-text-primary font-semibold">取消</button>
            <button onClick={handleAdd} disabled={!newThing.trim()}
              className="flex-1 py-3 rounded-btn text-white font-semibold
                       bg-[radial-gradient(circle_at_30%_30%,#FFB3B3,#FFC3A0)] disabled:opacity-50">
              添加 💝
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
