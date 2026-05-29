import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import PixelSprite from '../components/PixelSprite';
import type { Identity } from '../types';

export default function LoginPage() {
  const [code, setCode] = useState('226701');
  const [step, setStep] = useState<'code' | 'identity'>('code');
  const [error, setError] = useState('');
  const { login, isLoggedIn } = useAuth();
  const { uiMode } = useTheme();
  const isPixel = uiMode === 'pixel';
  const navigate = useNavigate();

  if (isLoggedIn) {
    navigate('/home', { replace: true });
    return null;
  }

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 4) {
      setError('请输入至少4位的情侣码~');
      return;
    }
    setError('');
    setStep('identity');
  };

  const handleIdentity = (identity: Identity) => {
    login(code.trim(), identity);
    navigate('/home', { replace: true });
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6">
      {/* Decorative elements */}
      <div className="absolute top-10 left-10 text-4xl animate-[float_3s_ease-in-out_infinite]">✨</div>
      <div className="absolute top-20 right-12 text-3xl animate-[float_4s_ease-in-out_infinite_0.5s]">💫</div>
      <div className="absolute bottom-20 left-16 text-3xl animate-[float_3.5s_ease-in-out_infinite_1s]">🌟</div>
      <div className="absolute bottom-32 right-10 text-4xl animate-[float_4.5s_ease-in-out_infinite_1.5s]">💕</div>

      {step === 'code' ? (
        <>
          <div className="text-6xl mb-6 animate-[float_3s_ease-in-out_infinite]">💝</div>
          <h1 className="font-title text-4xl text-text-primary mb-3">恋爱补给站</h1>
          <p className="text-text-secondary mb-10 text-center">属于两个人的秘密基地</p>

          <form onSubmit={handleCodeSubmit} className="w-full max-w-sm space-y-5">
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-2 ml-1">
                请输入你们的情侣码
              </label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="例如：226701"
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
                       btn-gradient
                       transition-all duration-300"
            >
              进入补给站 💕
            </button>
          </form>
        </>
      ) : (
        <>
          <div className="text-6xl mb-4 animate-[float_3s_ease-in-out_infinite]">👋</div>
          <h2 className="font-title text-3xl text-text-primary mb-3">你是...</h2>
          <p className="text-text-secondary mb-10">选择你的身份，进入专属视角</p>

          <div className="space-y-4 w-full max-w-sm">
            <button
              onClick={() => handleIdentity('me')}
              className="w-full p-6 rounded-2xl bg-white border-2 border-blush/20
                       hover:border-blush hover:shadow-soft-lg hover:-translate-y-1
                       active:scale-[0.98] transition-all duration-300 group"
            >
              <div className="mb-2 flex justify-center">
                {isPixel ? (
                  <PixelSprite name="clefairy" size={56} />
                ) : (
                  <span className="text-5xl">🐰</span>
                )}
              </div>
              <div className="font-semibold text-lg text-text-primary">小可爱</div>
              <div className="text-text-secondary text-sm">（她 / 女朋友）</div>
            </button>

            <button
              onClick={() => handleIdentity('partner')}
              className="w-full p-6 rounded-2xl bg-white border-2 border-calm/20
                       hover:border-calm hover:shadow-soft-lg hover:-translate-y-1
                       active:scale-[0.98] transition-all duration-300 group"
            >
              <div className="mb-2 flex justify-center">
                {isPixel ? (
                  <PixelSprite name="snorlax" size={56} />
                ) : (
                  <span className="text-5xl">🐻</span>
                )}
              </div>
              <div className="font-semibold text-lg text-text-primary">大笨蛋</div>
              <div className="text-text-secondary text-sm">（他 / 男朋友）</div>
            </button>

            <button
              onClick={() => setStep('code')}
              className="w-full py-3 text-text-secondary hover:text-text-primary transition-colors text-sm"
            >
              ← 返回修改情侣码
            </button>
          </div>
        </>
      )}
    </div>
  );
}
