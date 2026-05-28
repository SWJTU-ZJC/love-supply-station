import { Navigate } from 'react-router-dom';

const VERIFY_KEY = 'love-supply-verified';

export function isDeviceVerified(): boolean {
  try {
    const raw = localStorage.getItem(VERIFY_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    return typeof data.expiresAt === 'number' && data.expiresAt > Date.now();
  } catch {
    return false;
  }
}

export default function VerificationGuard({ children }: { children: React.ReactNode }) {
  if (!isDeviceVerified()) return <Navigate to="/verify" replace />;
  return <>{children}</>;
}
