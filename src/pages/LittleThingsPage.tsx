import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import confetti from 'canvas-confetti';

interface Thing {
  id: string;
  text: string;
  isDone: boolean;
  doneTime: string | null;
  proposedBy: string;
}

const defaultThings: Thing[] = [
  { id: '1', text: '一起看一场日出', isDone: false, doneTime: null, proposedBy: 'me' },
  { id: '2', text: '牵手走过陌生的街道', isDone: false, doneTime: null, proposedBy: 'partner' },
  { id: '3', text: '一起做饭', isDone: true, doneTime: '2024-03-15', proposedBy: 'me' },
  { id: '4', text: '给对方写一封情书', isDone: false, doneTime: null, proposedBy: 'me' },
  { id: '5', text: '一起看一场电影', isDone: true, doneTime: '2024-02-20', proposedBy: 'partner' },
  { id: '6', text: '在雨中漫步', isDone: false, doneTime: null, proposedBy: 'partner' },
  { id: '7', text: '给对方准备惊喜早餐', isDone: false, doneTime: null, proposedBy: 'me' },
  { id: '8', text: '一起去游乐园', isDone: false, doneTime: null, proposedBy: 'partner' },
  { id: '9', text: '拍一组情侣写真', isDone: false, doneTime: null, proposedBy: 'me' },
  { id: '10', text: '一起数星星', isDone: false, doneTime: null, proposedBy: 'partner' },
  { id: '11', text: '录一首合唱的歌', isDone: false, doneTime: null, proposedBy: 'me' },
  { id: '12', text: '给彼此取一个专属昵称', isDone: true, doneTime: '2024-01-01', proposedBy: 'partner' },
];

export default function LittleThingsPage() {
  const navigate = useNavigate();
  const { user, partner, updateUser } = useAuth();
  const [things, setThings] = useState<Thing[]>(defaultThings);
  const [showAdd, setShowAdd] = useState(false);
  const [newThing, setNewThing] = useState('');

  const doneCount = things.filter(t => t.isDone).length;
  const progress = Math.round((doneCount / things.length) * 100);

  const handleToggle = (thing: Thing) => {
    if (thing.isDone) return;
    setThings(prev => prev.map(t =>
      t.id === thing.id ? { ...t, isDone: true, doneTime: new Date().toISOString().split('T')[0] } : t
    ));
    // Reward coins
    if (user) updateUser({ coins: user.coins + 5 });
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#A8E6CE', '#FFB3B3', '#FFC3A0'],
    });
  };

  const handleAdd = () => {
    if (!newThing.trim()) return;
    const thing: Thing = {
      id: Date.now().toString(),
      text: newThing.trim(),
      isDone: false,
      doneTime: null,
      proposedBy: 'me',
    };
    setThings(prev => [...prev, thing]);
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

      {/* Progress */}
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

      {/* List */}
      <div className="space-y-2 mb-20">
        {things.map(thing => (
          <button
            key={thing.id}
            onClick={() => handleToggle(thing)}
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
                {thing.proposedBy === 'me' ? '我' : partner?.nickname} 提议
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Add button */}
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
            <button
              onClick={() => setShowAdd(false)}
              className="flex-1 py-3 rounded-btn bg-apricot text-text-primary font-semibold"
            >
              取消
            </button>
            <button
              onClick={handleAdd}
              disabled={!newThing.trim()}
              className="flex-1 py-3 rounded-btn text-white font-semibold
                       bg-[radial-gradient(circle_at_30%_30%,#FFB3B3,#FFC3A0)]
                       disabled:opacity-50"
            >
              添加 💝
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
