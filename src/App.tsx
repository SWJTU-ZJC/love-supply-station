import { Routes, Route } from 'react-router-dom';
import AuthGuard from './components/AuthGuard';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import MapPage from './pages/MapPage';
import TreeHolePage from './pages/TreeHolePage';
import ProfilePage from './pages/ProfilePage';
import WheelPage from './pages/WheelPage';
import GachaPage from './pages/GachaPage';
import LittleThingsPage from './pages/LittleThingsPage';
import CapsulesPage from './pages/CapsulesPage';
import MoviePage from './pages/MoviePage';
import MainLayout from './components/MainLayout';

export default function App() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<AuthGuard><MainLayout /></AuthGuard>}>
          <Route index element={<HomePage />} />
          <Route path="home" element={<HomePage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="treehole" element={<TreeHolePage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        <Route path="/wheel" element={<AuthGuard><WheelPage /></AuthGuard>} />
        <Route path="/gacha" element={<AuthGuard><GachaPage /></AuthGuard>} />
        <Route path="/little-things" element={<AuthGuard><LittleThingsPage /></AuthGuard>} />
        <Route path="/capsules" element={<AuthGuard><CapsulesPage /></AuthGuard>} />
        <Route path="/movie" element={<AuthGuard><MoviePage /></AuthGuard>} />
      </Routes>
    </div>
  );
}
