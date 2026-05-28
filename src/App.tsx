import { Routes, Route } from 'react-router-dom';
import AuthGuard from './components/AuthGuard';
import VerificationGuard from './components/VerificationGuard';
import LoginPage from './pages/LoginPage';
import VerifyPage from './pages/VerifyPage';
import HomePage from './pages/HomePage';
import MapPage from './pages/MapPage';
import ProfilePage from './pages/ProfilePage';
import GachaPage from './pages/GachaPage';
import LittleThingsPage from './pages/LittleThingsPage';
import MoviePage from './pages/MoviePage';
import AboutPage from './pages/AboutPage';
import AnniversaryPage from './pages/AnniversaryPage';
import MainLayout from './components/MainLayout';

export default function App() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="/login" element={<VerificationGuard><LoginPage /></VerificationGuard>} />
        <Route path="/" element={<AuthGuard><MainLayout /></AuthGuard>}>
          <Route index element={<HomePage />} />
          <Route path="home" element={<HomePage />} />
          <Route path="anniversary" element={<AnniversaryPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        <Route path="/gacha" element={<AuthGuard><GachaPage /></AuthGuard>} />
        <Route path="/little-things" element={<AuthGuard><LittleThingsPage /></AuthGuard>} />
        <Route path="/movie" element={<AuthGuard><MoviePage /></AuthGuard>} />
        <Route path="/about" element={<AuthGuard><AboutPage /></AuthGuard>} />
      </Routes>
    </div>
  );
}
