import { useState } from 'react';
import { useSync } from '../contexts/SyncContext';
import { useTheme } from '../contexts/ThemeContext';
import PixelSprite from './PixelSprite';
import type { Mood } from '../types';

const moods: { emoji: Mood; label: string; sprite: keyof typeof import('./PixelSprite').SPRITES }[] = [
  { emoji: '😊', label: '开心', sprite: 'psyduck' },
  { emoji: '🥺', label: '想你', sprite: 'cubone' },
  { emoji: '😤', label: '生气', sprite: 'primeape' },
  { emoji: '😴', label: '疲惫', sprite: 'slowpoke' },
  { emoji: '🥰', label: '求安慰', sprite: 'vulpix' },
];

export default function MoodBar({ currentMood, onMoodSelect }: { currentMood: string; onMoodSelect: () => void }) {
  const { updateMood } = useSync();
  const { uiMode } = useTheme();
  const isPixel = uiMode === 'pixel';
  const [selected, setSelected] = useState<string>(currentMood);
  const [animating, setAnimating] = useState<string | null>(null);

  const handleMood = (mood: Mood) => {
    if (mood === selected) return;
    setAnimating(mood);
    setTimeout(() => {
      setSelected(mood);
      setAnimating(null);
      updateMood(mood);
      onMoodSelect();
      if (mood === '🥺' && Notification.permission === 'default') {
        Notification.requestPermission();
      }
      if (mood === '🥺' && Notification.permission === 'granted') {
        new Notification('恋爱补给站', { body: 'Ta 想你啦～💕', icon: '💕' });
      }
    }, 300);
  };

  return (
    <div className="bg-white rounded-card p-4 shadow-soft">
      <p className="text-xs text-text-secondary mb-3 ml-1">今天心情怎么样？</p>
      <div className="flex justify-between items-center gap-1 overflow-x-auto pb-1">
        {moods.map(({ emoji, label, sprite }) => (
          <button
            key={emoji}
            onClick={() => handleMood(emoji)}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl min-w-[56px]
                       transition-all duration-300
                       ${selected === emoji
                         ? 'bg-blush/20 scale-110 shadow-soft'
                         : 'hover:bg-apricot hover:scale-105'
                       }
                       ${animating === emoji ? 'animate-[shake_0.3s_ease-in-out]' : ''}
            `}
          >
            <span className={`transition-transform duration-300 ${isPixel ? '' : 'text-2xl'}
              ${selected === emoji ? 'scale-125' : ''}`}>
              {isPixel ? <PixelSprite name={sprite} size={96} /> : emoji}
            </span>
            <span className={`text-xs transition-colors duration-300
              ${selected === emoji ? 'text-text-primary font-semibold' : 'text-text-secondary'}`}>
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
