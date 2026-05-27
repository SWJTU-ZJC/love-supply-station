import { useLocation, useNavigate } from 'react-router-dom';

const tabs = [
  { path: '/home', label: '首页', icon: '🏠', activeIcon: '💒' },
  { path: '/map', label: '打卡', icon: '📍', activeIcon: '🗺️' },
  { path: '/profile', label: '我的', icon: '💝', activeIcon: '❤️' },
];

export default function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();

  const currentPath = '/' + location.pathname.split('/')[1];

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-app
                 backdrop-blur-xl bg-cream/70 border-t border-blush/20
                 flex justify-around items-center py-2 px-2 z-50"
    >
      {tabs.map(tab => {
        const isActive = currentPath === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-2xl
                       transition-all duration-300 min-w-[64px]
                       ${isActive
                         ? 'bg-blush/20 text-text-primary scale-105'
                         : 'text-text-secondary hover:text-text-primary'
                       }`}
          >
            <span className="text-2xl leading-none">
              {isActive ? tab.activeIcon : tab.icon}
            </span>
            <span className={`text-xs font-semibold ${isActive ? 'opacity-100' : 'opacity-60'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
