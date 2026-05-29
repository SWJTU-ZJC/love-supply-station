import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import AnimalIcon, { type AnimalIconName } from './AnimalIcon';
import PixelSprite from './PixelSprite';

const features = [
  {
    title: '恋爱扭蛋机',
    icon: '🎪',
    desc: '消耗金币抽奖',
    path: '/gacha',
    emoji: '🥚',
    animalIcon: 'shopping' as AnimalIconName,
    pixelSprite: 'mrmime' as const,
    cardColor: '#f8a6b2',
  },
  {
    title: '打卡地图',
    icon: '🗺️',
    desc: '记录我们的足迹',
    path: '/map',
    emoji: '📍',
    animalIcon: 'map' as AnimalIconName,
    pixelSprite: 'farfetchd' as const,
    cardColor: '#82d5bb',
  },
  {
    title: '100件小事',
    icon: '📝',
    desc: '一起完成的浪漫清单',
    path: '/little-things',
    emoji: '✅',
    animalIcon: 'critterpedia' as AnimalIconName,
    pixelSprite: 'mew' as const,
    cardColor: '#f7cd67',
  },
];

export default function FeatureGrid() {
  const navigate = useNavigate();
  const { uiMode } = useTheme();
  const isAnimal = uiMode === 'animal';
  const isPixel = uiMode === 'pixel';

  return (
    <div>
      <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
        {isPixel ? <PixelSprite name="lapras" size={40} /> : isAnimal ? <AnimalIcon name="variant" size={24} /> : <span>🎮</span>}
        恋爱补给
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {features.map((feature, i) => (
          <button
            key={feature.path}
            onClick={() => navigate(feature.path)}
            className={`relative p-4 rounded-card text-left
                       hover:-translate-y-1 active:scale-[0.98]
                       transition-all duration-300 overflow-hidden group
                       animate-[fadeSlideIn_0.4s_ease-out]`}
            style={{
              animationDelay: `${i * 0.05}s`,
              animationFillMode: 'both',
              ...(isAnimal ? { background: feature.cardColor, border: '2px solid rgba(255,255,255,0.4)', boxShadow: '0 4px 0 0 rgba(0,0,0,0.08)' } : {}),
            }}
          >
            <div className="relative z-10">
              {isPixel ? (
                <PixelSprite name={feature.pixelSprite} size={72} className="mb-2" />
              ) : isAnimal ? (
                <AnimalIcon name={feature.animalIcon} size={36} className="mb-2" />
              ) : (
                <span className="text-3xl block mb-2">{feature.emoji}</span>
              )}
              <h4 className={`font-semibold text-sm ${isAnimal ? 'text-white' : 'text-text-primary'}`}>
                {feature.title}
              </h4>
              <p className={`text-xs mt-0.5 ${isAnimal ? 'text-white/75' : 'text-text-secondary'}`}>
                {feature.desc}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
