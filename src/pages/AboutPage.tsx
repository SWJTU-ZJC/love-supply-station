import { useNavigate } from 'react-router-dom';

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center px-6 py-12">
      <button
        onClick={() => navigate(-1)}
        className="absolute top-6 left-6 w-10 h-10 rounded-full bg-white shadow-soft
                   flex items-center justify-center text-lg hover:scale-110 transition-transform"
      >
        ←
      </button>

      <h1 className="font-title text-3xl text-text-primary mb-8">💕 关于我们</h1>

      <div className="bg-white rounded-card shadow-soft p-6 max-w-md w-full space-y-4 text-text-primary leading-relaxed">
        <p className="text-sm indent-4">
          恋爱补给站，是张佳琛为周佳慧写的一封不会结尾的情书。
        </p>

        <p className="text-sm indent-4">
          在这里，每一次心情的切换都是无声的牵挂，每一次打卡都是我们一起走过的路，每一件小事都是想要和你一起完成的约定。
        </p>

        <p className="text-sm indent-4">
          扭蛋机里藏着的不是奖品，是我想要你每天都开心的愿望。照片墙上的每一张都是时间偷不走的证据。
        </p>

        <p className="text-sm indent-4">
          这个小小的站点，不需要很多人知道。它只需要两双眼睛——一双是张佳琛的，一双是周佳慧的。它不是工具，不是任务清单，是我们两个人的补给站。
        </p>

        <p className="text-sm indent-4">
          累了就在这里换一个心情，想念了就翻翻一起拍过的照片，无聊了就去扭个蛋。这里永远是我们在互联网上的一个小角落，温暖、安静、只属于我们。
        </p>
      </div>

      <div className="mt-8 text-center">
        <p className="font-title text-xl text-blush">张佳琛 & 周佳慧</p>
        <p className="text-text-secondary text-sm mt-1">永远在路上 💕</p>
      </div>

      <p className="mt-16 text-text-secondary/40 text-xs">
        恋爱补给站 v1.0 · Made with 💕
      </p>
    </div>
  );
}
