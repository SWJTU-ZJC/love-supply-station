import { Outlet } from 'react-router-dom';
import TabBar from './TabBar';

export default function MainLayout() {
  return (
    <div className="flex flex-col min-h-screen pb-20">
      <div className="flex-1">
        <Outlet />
      </div>
      <TabBar />
    </div>
  );
}
