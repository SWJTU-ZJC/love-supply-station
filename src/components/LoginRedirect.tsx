import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginRedirect() {
  const { isLoggedIn } = useAuth();
  if (isLoggedIn) return <Navigate to="/home" replace />;
  return <Navigate to="/login" replace />;
}
