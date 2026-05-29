import { useState } from 'react';
import { useSync, type SharedAnniversary } from '../contexts/SyncContext';
import { useTheme } from '../contexts/ThemeContext';
import AnimalIcon, { type AnimalIconName } from '../components/AnimalIcon';

function getNextOccurrence(mmdd: string): Date {
  const now = new Date();
  const [month, day] = mmdd.split('-').map(Number);
  const thisYear = new Date(now.getFullYear(), month - 1, day);
  if (thisYear >= now) return thisYear;
  return new Date(now.getFullYear() + 1, month - 1, day);
}

export function getDaysUntil(mmdd: string): number {
  const next = getNextOccurrence(mmdd);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  next.setHours(0, 0, 0, 0);
  return Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getLoveDays(anniversaries: SharedAnniversary[]): number | null {
  const love = anniversaries
    .filter(a => a.type === 'anniversary' && a.year != null)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (love.length === 0) return null;
  const earliest = love[0];
  const [month, day] = earliest.date.split('-').map(Number);
  const start = new Date(earliest.year!, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

const typeLabels: Record<string, string> = {
  anniversary: '纪念日',
  birthday: '生日',
  memory: '回忆',
};

const typeEmojis: Record<string, string> = {
  anniversary: '💍',
  birthday: '🎂',
  memory: '💫',
};

const typeIcons: Record<string, AnimalIconName> = {
  anniversary: 'heart',
  birthday: 'gift',
  memory: 'star',
};

export default function AnniversaryPage() {
  const { uiMode } = useTheme();
  const isAnimal = uiMode === 'animal';
  const { state, addAnniversary, updateAnniversary, deleteAnniversary } = useSync();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formType, setFormType] = useState<'anniversary' | 'birthday' | 'memory'>('anniversary');
  const [formYear, setFormYear] = useState('');

  const anniversaries = state.anniversaries || [];
  const loveDays = getLoveDays(anniversaries);

  const sorted = [...anniversaries].sort((a, b) => getDaysUntil(a.date) - getDaysUntil(b.date));

  const openAdd = () => {
    setEditingId(null);
    setFormTitle('');
    setFormDate('');
    setFormType('anniversary');
    setFormYear(String(new Date().getFullYear()));
    setShowForm(true);
  };

  const openEdit = (item: SharedAnniversary) => {
    setEditingId(item.id);
    setFormTitle(item.title);
    setFormDate(item.date);
    setFormType(item.type);
    setFormYear(item.year != null ? String(item.year) : '');
    setShowForm(true);
  };

  const handleSubmit = () => {
    const title = formTitle.trim();
    const date = formDate.trim();
    if (!title || !date) return;
    const year = formYear ? parseInt(formYear, 10) : undefined;
    if (editingId) {
      updateAnniversary(editingId, { title, date, type: formType, year });
    } else {
      addAnniversary({ title, date, type: formType, year });
    }
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这个纪念日吗？')) {
      deleteAnniversary(id);
    }
  };

  return (
    <div className="page-enter px-5 pt-8 pb-4 space-y-6">
      <h1 className="font-title text-3xl text-text-primary text-center">💝 纪念日</h1>

      {/* Love days counter */}
      {loveDays !== null && (
        <div className="bg-gradient-to-r from-blush/20 to-sunset/20 rounded-card p-6
                      text-center shadow-soft">
          <p className="text-text-secondary text-sm">已经在一起</p>
          <p className="font-title text-5xl text-blush mt-2">{loveDays.toLocaleString()}</p>
          <p className="text-text-secondary text-sm mt-1">天</p>
        </div>
      )}

      {/* Empty state */}
      {sorted.length === 0 && (
        <div className="text-center py-16 text-text-secondary">
          <span className="text-5xl block mb-3">💕</span>
          <p className="font-semibold text-lg">还没有纪念日</p>
          <p className="text-sm mt-1">添加你们的第一个纪念日吧~</p>
        </div>
      )}

      {/* Anniversary list */}
      <div className="space-y-3">
        {sorted.map(item => {
          const daysUntil = getDaysUntil(item.date);
          const [m, d] = item.date.split('-');
          return (
            <div
              key={item.id}
              className="bg-white rounded-card p-4 shadow-soft flex items-center gap-3 group"
            >
              <span className="text-2xl">
                {isAnimal ? (
                  <AnimalIcon name={typeIcons[item.type]} size={28} />
                ) : (
                  typeEmojis[item.type]
                )}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-text-primary text-sm">{item.title}</p>
                <p className="text-text-secondary text-xs">
                  {m}月{d}日 · {typeLabels[item.type]}
                  {' · '}
                  {daysUntil === 0 ? (
                    <span className="text-blush font-semibold">今天！🎉</span>
                  ) : (
                    <span>还有 {daysUntil} 天</span>
                  )}
                </p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(item)}
                  className="w-7 h-7 rounded-full bg-apricot flex items-center justify-center text-xs hover:bg-apricot/80"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center text-xs hover:bg-red-200"
                >
                  🗑️
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating add button */}
      {!showForm && (
        <button
          onClick={openAdd}
          className="fixed bottom-24 right-6 w-14 h-14 rounded-full shadow-soft-lg
                   btn-gradient text-white text-2xl flex items-center justify-center
                   hover:scale-110 active:scale-95 transition-all z-40"
        >
          +
        </button>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <div
          className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/20 backdrop-blur-sm"
          onClick={() => setShowForm(false)}
        >
          <div
            className="w-full max-w-app bg-white rounded-t-card shadow-soft-lg p-5
                      animate-[fadeSlideIn_0.3s_ease-out]"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-semibold text-text-primary text-lg mb-4">
              {editingId ? '编辑纪念日' : '添加纪念日'}
            </h3>

            <input
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              placeholder="名称"
              className="w-full px-4 py-2.5 rounded-btn bg-apricot/50 text-text-primary text-sm
                       focus:outline-none focus:ring-2 focus:ring-blush/50 mb-3"
              maxLength={20}
              autoFocus
            />

            <input
              value={formDate}
              onChange={e => setFormDate(e.target.value)}
              placeholder="日期 MM-DD（如 04-15）"
              className="w-full px-4 py-2.5 rounded-btn bg-apricot/50 text-text-primary text-sm
                       focus:outline-none focus:ring-2 focus:ring-blush/50 mb-3"
              maxLength={5}
            />

            {/* Type selector */}
            <div className="flex gap-2 mb-3">
              {(Object.entries(typeLabels) as [typeof formType, string][]).map(([t, label]) => (
                <button
                  key={t}
                  onClick={() => setFormType(t)}
                  className={`flex-1 py-2 rounded-btn text-xs font-semibold transition-all ${
                    formType === t
                      ? 'bg-blush/20 text-text-primary ring-2 ring-blush/30'
                      : 'bg-apricot/50 text-text-secondary hover:bg-apricot'
                  }`}
                >
                  {isAnimal ? <AnimalIcon name={typeIcons[t]} size={18} /> : typeEmojis[t]} {label}
                </button>
              ))}
            </div>

            {/* Year input (only for anniversary) */}
            {formType === 'anniversary' && (
              <input
                value={formYear}
                onChange={e => setFormYear(e.target.value)}
                placeholder="开始年份（如 2025）"
                type="number"
                className="w-full px-4 py-2.5 rounded-btn bg-apricot/50 text-text-primary text-sm
                         focus:outline-none focus:ring-2 focus:ring-blush/50 mb-4"
              />
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-btn bg-apricot/50 text-text-secondary text-sm font-semibold
                         hover:bg-apricot transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formTitle.trim() || !formDate.trim()}
                className="flex-1 py-2.5 rounded-btn text-white text-sm font-semibold
                         btn-gradient transition-all disabled:opacity-50"
              >
                {editingId ? '保存' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
