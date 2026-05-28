import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isDeviceVerified } from '../components/VerificationGuard';

const VALID_CODE = '226701';
const VERIFY_KEY = 'love-supply-verified';

export default function VerifyPage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  if (isDeviceVerified()) {
    navigate('/login', { replace: true });
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim() !== VALID_CODE) {
      setError('验证码错误，请重试');
      return;
    }
    setError('');
    const now = Date.now();
    const token = { verifiedAt: now, expiresAt: now + 30 * 24 * 60 * 60 * 1000 };
    localStorage.setItem(VERIFY_KEY, JSON.stringify(token));
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6">
      <div className="absolute top-10 left-10 text-4xl animate-[float_3s_ease-in-out_infinite]">🔒</div>
      <div className="absolute top-20 right-12 text-3xl animate-[float_4s_ease-in-out_infinite_0.5s]">💫</div>
      <div className="absolute bottom-20 left-16 text-3xl animate-[float_3.5s_ease-in-out_infinite_1s]">🌟</div>
      <div className="absolute bottom-32 right-10 text-4xl animate-[float_4.5s_ease-in-out_infinite_1.5s]">💕</div>

      <div className="text-6xl mb-6 animate-[float_3s_ease-in-out_infinite]">🛡️</div>
      <h1 className="font-title text-4xl text-text-primary mb-3">恋爱补给站</h1>
      <p className="text-text-secondary mb-10 text-center">请验证设备安全码</p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
        <div>
          <label className="block text-sm font-semibold text-text-primary mb-2 ml-1">
            安全验证码
          </label>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="请输入安全码"
            className="w-full px-5 py-4 rounded-2xl bg-white border-2 border-blush/30 text-text-primary text-lg
                     focus:outline-none focus:border-blush focus:ring-4 focus:ring-blush/20
                     placeholder:text-text-secondary/50 transition-all duration-300"
            autoFocus
          />
          {error && <p className="text-red-400 text-sm mt-2 ml-1">{error}</p>}
        </div>
        <button
          type="submit"
          className="w-full py-4 rounded-2xl font-semibold text-white text-lg
                   btn-gradient transition-all duration-300"
        >
          验证进入 🔐
        </button>
      </form>
    </div>
  );
}
