import { useNavigate } from 'react-router-dom';

const features = [
  {
    title: '命运转盘',
    icon: '🎡',
    desc: '随机惊喜',
    path: '/wheel',
    gradient: 'from-blush/30 to-sunset/30',
    emoji: '🎰',
  },
  {
    title: '恋爱扭蛋机',
    icon: '🎪',
    desc: '消耗金币抽奖',
    path: '/gacha',
    gradient: 'from-sunset/30 to-yellow-200/30',
    emoji: '🥚',
  },
  {
    title: '打卡地图',
    icon: '🗺️',
    desc: '记录我们的足迹',
    path: '/map',
    gradient: 'from-calm/30 to-purple-200/30',
    emoji: '📍',
  },
  {
    title: '悄悄话树洞',
    icon: '🌳',
    desc: '阅后即焚的心里话',
    path: '/treehole',
    gradient: 'from-purple-200/30 to-calm/30',
    emoji: '💌',
  },
  {
    title: '100件小事',
    icon: '📝',
    desc: '一起完成的浪漫清单',
    path: '/little-things',
    gradient: 'from-mint/40 to-blush/20',
    emoji: '✅',
  },
  {
    title: '时光胶囊',
    icon: '💊',
    desc: '写给未来的我们',
    path: '/capsules',
    gradient: 'from-blush/20 to-calm/20',
    emoji: '⏳',
  },
];

export default function FeatureGrid() {
  const navigate = useNavigate();

  return (
    <div>
      <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
        <span>🎮</span> 恋爱补给
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {features.map((feature, i) => (
          <button
            key={feature.path}
            onClick={() => navigate(feature.path)}
            className={`relative p-4 rounded-card bg-white shadow-soft text-left
                       hover:shadow-soft-lg hover:-translate-y-1 active:scale-[0.98]
                       transition-all duration-300 overflow-hidden group
                       animate-[fadeSlideIn_0.4s_ease-out]`}
            style={{ animationDelay: `${i * 0.05}s`, animationFillMode: 'both' }}
          >
            {/* Gradient blob */}
            <div className={`absolute -top-2 -right-2 w-16 h-16 rounded-full bg-gradient-to-br ${feature.gradient}
                          opacity-60 group-hover:scale-150 transition-transform duration-500`} />
            <div className="relative z-10">
              <span className="text-3xl block mb-2">{feature.emoji}</span>
              <h4 className="font-semibold text-text-primary text-sm">{feature.title}</h4>
              <p className="text-text-secondary text-xs mt-0.5">{feature.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
