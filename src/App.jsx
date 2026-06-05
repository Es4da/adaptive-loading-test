import React, { useState, useEffect, useRef } from 'react';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import Matter from 'matter-js';

function App() {
  const [timeMode, setTimeMode] = useState('short'); // 'short' (5s) or 'long' (30s)
  const [uiMode, setUiMode] = useState('simple');   // 'simple' or 'interactive'
  
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showDone, setShowDone] = useState(false);

  const sceneRef = useRef(null);
  const engineRef = useRef(null);
  const ballCountRef = useRef(0);
  const wallsRef = useRef([]);

  const startLoading = () => {
    setIsLoading(true);
    setProgress(0);
    setShowDone(false);
    ballCountRef.current = 0;
  };

  // 進捗ロジックと完了後のフェードアウト
  useEffect(() => {
    if (!isLoading) return;
    
    const duration = timeMode === 'short' ? 5000 : 30000;
    const intervalTime = 100;
    const increment = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + increment;
        if (next >= 100) {
          clearInterval(timer);
          
          // 0.5秒後にローディングを終了し、完了を表示
          setTimeout(() => {
            setIsLoading(false);
            setShowDone(true);
            
            // 3秒後に完了表示を消す
            setTimeout(() => {
              setShowDone(false);
            }, 3000);
          }, 500);
          
          return 100;
        }
        return next;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isLoading, timeMode]);

  // Matter.js セットアップ
  useEffect(() => {
    if (isLoading && uiMode === 'interactive') {
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

      const createWalls = () => {
        const thickness = 100;
        const width = window.innerWidth;
        const height = window.innerHeight;
        return [
          Bodies.rectangle(width / 2, height + thickness / 2, width, thickness, { isStatic: true }),
          Bodies.rectangle(-thickness / 2, height / 2, thickness, height, { isStatic: true }),
          Bodies.rectangle(width + thickness / 2, height / 2, thickness, height, { isStatic: true })
        ];
      };

      const walls = createWalls();
      wallsRef.current = walls;
      Composite.add(engine.world, walls);

      const mouse = Mouse.create(render.canvas);
      const mouseConstraint = MouseConstraint.create(engine, {
        mouse: mouse,
        constraint: { stiffness: 0.2, render: { visible: false } }
      });

      Composite.add(engine.world, mouseConstraint);
      render.mouse = mouse;

      Render.run(render);
      const runner = Runner.create();
      Runner.run(runner, engine);

      const handleResize = () => {
        render.canvas.width = window.innerWidth;
        render.canvas.height = window.innerHeight;
        Composite.remove(engine.world, wallsRef.current);
        const newWalls = createWalls();
        wallsRef.current = newWalls;
        Composite.add(engine.world, newWalls);
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        Render.stop(render);
        Engine.clear(engine);
        render.canvas.remove();
      };
    }
  }, [isLoading, uiMode]);

  // ボール生成ロジック
  useEffect(() => {
    if (isLoading && uiMode === 'interactive' && engineRef.current) {
      const targetBallCount = Math.floor(progress / 2);
      const diff = targetBallCount - ballCountRef.current;

      if (diff > 0) {
        for (let i = 0; i < diff; i++) {
          const radius = 30 + Math.random() * 20;
          const x = Math.random() * (window.innerWidth - 60) + 30;
          const ball = Matter.Bodies.circle(x, -50, radius, {
            restitution: 0.5,
            friction: 0.1,
            render: { fillStyle: `hsl(${Math.random() * 360}, 70%, 60%)` }
          });
          Matter.Composite.add(engineRef.current.world, ball);
        }
        ballCountRef.current = targetBallCount;
      }
    }
  }, [progress, isLoading, uiMode]);

  return (
    <div className="relative min-h-screen bg-slate-50 overflow-hidden font-sans">
      
      {/* 物理演算背景 */}
      <div ref={sceneRef} className="absolute inset-0 z-0 pointer-events-auto" />

      {/* メインUI */}
      <div className="relative z-10 flex flex-col items-center min-h-screen pointer-events-none">
        
        {/* 操作パネル（ローディング中以外表示） */}
        {!isLoading && (
          <div className="mt-8 flex flex-col gap-4 items-center pointer-events-auto">
            
            {/* 待機時間の選択 */}
            <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-200">
              <button 
                onClick={() => setTimeMode('short')}
                className={`px-6 py-1.5 rounded-lg text-sm font-bold transition ${timeMode === 'short' ? 'bg-blue-50 text-blue-600' : 'text-slate-400'}`}
              >
                短時間 (5s)
              </button>
              <button 
                onClick={() => setTimeMode('long')}
                className={`px-6 py-1.5 rounded-lg text-sm font-bold transition ${timeMode === 'long' ? 'bg-blue-50 text-blue-600' : 'text-slate-400'}`}
              >
                長時間 (30s)
              </button>
            </div>

            {/* UIモードの選択 */}
            <div className="flex bg-white rounded-full p-1 shadow-md border border-slate-200">
              <button 
                onClick={() => setUiMode('simple')}
                className={`px-8 py-2 rounded-full font-bold transition ${uiMode === 'simple' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}
              >
                簡易的
              </button>
              <button 
                onClick={() => setUiMode('interactive')}
                className={`px-8 py-2 rounded-full font-bold transition ${uiMode === 'interactive' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}
              >
                インタラクティブ
              </button>
            </div>
          </div>
        )}

        {/* コンテンツエリア */}
        <div className="flex-grow flex flex-col items-center justify-center w-full px-4">
          {!isLoading ? (
            <div className="text-center flex flex-col items-center gap-6">
              <div className="px-4 py-2 bg-slate-200/50 rounded-lg text-slate-500 text-sm font-medium">
                条件: {timeMode === 'short' ? '5秒' : '30秒'} × {uiMode === 'simple' ? '簡易的' : 'インタラクティブ'}
              </div>
              <button 
                onClick={startLoading}
                className="pointer-events-auto bg-blue-600 hover:bg-blue-700 text-white text-xl font-bold py-5 px-16 rounded-2xl shadow-xl active:scale-95 transition-transform"
              >
                ローディング開始
              </button>
            </div>
          ) : (
            <div className="w-full max-w-xl bg-white/80 backdrop-blur-sm p-10 rounded-3xl shadow-2xl border border-white text-center">
              <h2 className="text-2xl font-bold mb-8 text-slate-800">
                データを読み込み中...
              </h2>

              {uiMode === 'simple' && (
                <div className="mb-8 text-left">
                  <SkeletonTheme baseColor="#e2e8f0" highlightColor="#f8fafc">
                    <Skeleton height={30} width="70%" className="mb-4" />
                    <Skeleton count={2} />
                  </SkeletonTheme>
                </div>
              )}

              {/* 共通プログレスバー */}
              <div className="w-full bg-slate-200 h-6 rounded-full overflow-hidden shadow-inner">
                <div 
                  className="bg-blue-500 h-full transition-all duration-100 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-4 text-slate-500 font-mono font-bold text-lg">{Math.floor(progress)}%</p>
            </div>
          )}
        </div>

        {/* 完了表示（3秒でフェードアウト） */}
        <div className={`mb-20 transition-opacity duration-1000 ${showDone && !isLoading ? 'opacity-100' : 'opacity-0'}`}>
          <span className="text-5xl font-black text-green-500 bg-white px-10 py-4 rounded-3xl shadow-lg border-2 border-green-100">
            完了
          </span>
        </div>
      </div>
    </div>
  );
}

export default App;