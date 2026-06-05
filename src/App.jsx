import React, { useState, useEffect, useRef } from 'react';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import Matter from 'matter-js';

function App() {
  const [mode, setMode] = useState('simple');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showDone, setShowDone] = useState(false);

  const sceneRef = useRef(null);
  const engineRef = useRef(null);
  const ballCountRef = useRef(0);
  const wallsRef = useRef([]); // リサイズ時に壁を更新するための参照

  const startLoading = () => {
    setIsLoading(true);
    setProgress(0);
    setShowDone(false);
    ballCountRef.current = 0;
  };

  // 進捗管理
  useEffect(() => {
    if (!isLoading) return;
    const duration = mode === 'simple' ? 5000 : 30000;
    const intervalTime = 100;
    const increment = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + increment;
        if (next >= 100) {
          clearInterval(timer);
          setTimeout(() => {
            setIsLoading(false);
            setShowDone(true);
          }, 500);
          return 100;
        }
        return next;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isLoading, mode]);

  // Matter.js セットアップ（ウィンドウ全体）
  useEffect(() => {
    if (isLoading && mode === 'interactive') {
      const { Engine, Render, Runner, Bodies, Composite, Mouse, MouseConstraint } = Matter;

      const engine = Engine.create();
      engineRef.current = engine;

      const render = Render.create({
        element: sceneRef.current,
        engine: engine,
        options: {
          width: window.innerWidth,
          height: window.innerHeight,
          wireframes: false,
          background: 'transparent'
        }
      });

      // 床と壁の作成関数
      const createWalls = () => {
        const thickness = 100;
        return [
          Bodies.rectangle(window.innerWidth / 2, window.innerHeight + thickness / 2, window.innerWidth, thickness, { isStatic: true }), // 床
          Bodies.rectangle(-thickness / 2, window.innerHeight / 2, thickness, window.innerHeight, { isStatic: true }), // 左
          Bodies.rectangle(window.innerWidth + thickness / 2, window.innerHeight / 2, thickness, window.innerHeight, { isStatic: true }) // 右
        ];
      };

      const walls = createWalls();
      wallsRef.current = walls;
      Composite.add(engine.world, walls);

      // マウスインタラクション（ドラッグ操作）
      const mouse = Mouse.create(render.canvas);
      const mouseConstraint = MouseConstraint.create(engine, {
        mouse: mouse,
        constraint: {
          stiffness: 0.2,
          render: { visible: false }
        }
      });

      Composite.add(engine.world, mouseConstraint);
      render.mouse = mouse; // スクロール干渉防止

      Render.run(render);
      const runner = Runner.create();
      Runner.run(runner, engine);

      // リサイズ対応
      const handleResize = () => {
        render.canvas.width = window.innerWidth;
        render.canvas.height = window.innerHeight;
        // 壁の位置を更新
        Composite.remove(engine.world, wallsRef.current);
        wallsRef.current = createWalls();
        Composite.add(engine.world, wallsRef.current);
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        Render.stop(render);
        Engine.clear(engine);
        render.canvas.remove();
        render.textures = {};
      };
    }
  }, [isLoading, mode]);

  // 進捗2%ごとに大きなボールを生成
  useEffect(() => {
    if (isLoading && mode === 'interactive' && engineRef.current) {
      const targetBallCount = Math.floor(progress / 2);
      const diff = targetBallCount - ballCountRef.current;

      if (diff > 0) {
        for (let i = 0; i < diff; i++) {
          const radius = 25 + Math.random() * 15; // ボールを大きく（25-40）
          const x = Math.random() * (window.innerWidth - 100) + 50;
          const ball = Matter.Bodies.circle(x, -50, radius, {
            restitution: 0.6,
            friction: 0.1,
            render: {
              fillStyle: `hsl(${Math.random() * 360}, 70%, 60%)`
            }
          });
          Matter.Composite.add(engineRef.current.world, ball);
        }
        ballCountRef.current = targetBallCount;
      }
    }
  }, [progress, isLoading, mode]);

  return (
    <div className="relative min-h-screen bg-white overflow-hidden font-sans">
      
      {/* Matter.js Canvas Container (背景として配置) */}
      <div ref={sceneRef} className="absolute inset-0 z-0 pointer-events-auto" />

      {/* UI Overlay */}
      <div className="relative z-10 flex flex-col items-center min-h-screen pointer-events-none">
        
        {/* モード切替（ローディング中以外表示） */}
        {!isLoading && (
          <div className="mt-12 pointer-events-auto">
            <div className="flex bg-slate-100 rounded-full p-1 shadow-inner border border-slate-200">
              <button 
                onClick={() => setMode('simple')}
                className={`px-8 py-2 rounded-full font-medium transition ${mode === 'simple' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
              >
                簡易的
              </button>
              <button 
                onClick={() => setMode('interactive')}
                className={`px-8 py-2 rounded-full font-medium transition ${mode === 'interactive' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
              >
                インタラクティブ
              </button>
            </div>
          </div>
        )}

        <div className="flex-grow flex flex-col items-center justify-center w-full px-4">
          {!isLoading ? (
            <button 
              onClick={startLoading}
              className="pointer-events-auto bg-blue-600 hover:bg-blue-700 text-white text-xl font-bold py-5 px-16 rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95"
            >
              ローディング開始
            </button>
          ) : (
            <div className="w-full max-w-xl bg-white/90 backdrop-blur-md p-10 rounded-3xl shadow-2xl border border-white/50 text-center">
              <h2 className="text-2xl font-bold mb-8 text-slate-800">
                データを読み込み中...
              </h2>

              {mode === 'simple' && (
                <SkeletonTheme baseColor="#f1f5f9" highlightColor="#ffffff">
                  <div className="mb-8 text-left space-y-4">
                    <Skeleton height={40} width="80%" />
                    <Skeleton count={2} />
                  </div>
                </SkeletonTheme>
              )}

              {/* 共通プログレスバー */}
              <div className="w-full bg-slate-100 h-6 rounded-full overflow-hidden border border-slate-200 shadow-inner">
                <div 
                  className="bg-blue-500 h-full transition-all duration-100 ease-linear shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-4 text-slate-400 font-mono font-bold">{Math.floor(progress)}%</p>
            </div>
          )}
        </div>

        {/* 完了表示 */}
        {showDone && !isLoading && (
          <div className="mb-24">
            <span className="text-5xl font-black text-blue-600 drop-shadow-sm">
              完了
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;