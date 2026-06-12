import React, { useState, useEffect, useRef } from 'react';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import Matter from 'matter-js';

function App() {
  // --- 画面遷移ステート ---
  const [currentPage, setCurrentPage] = useState('playground'); // 'playground' or 'experiment'

  // --- ローディング設定ステート ---
  const [timeMode, setTimeMode] = useState('short'); 
  const [uiMode, setUiMode] = useState('simple');   
  
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showDone, setShowDone] = useState(false);

  const sceneRef = useRef(null);
  const engineRef = useRef(null);
  const ballCountRef = useRef(0);
  const wallsRef = useRef([]);

  // --- Shift + Space の隠しコマンド（画面切り替え） ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.shiftKey && e.code === 'Space') {
        e.preventDefault();
        setCurrentPage((prev) => (prev === 'playground' ? 'experiment' : 'playground'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- ローディング起動関数 ---
  const startLoading = (time, ui) => {
    setTimeMode(time);
    setUiMode(ui);
    setIsLoading(true);
    setProgress(0);
    setShowDone(false);
    ballCountRef.current = 0;
  };

  // --- 進捗ロジックとフェードアウト ---
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
          setTimeout(() => {
            setIsLoading(false);
            setShowDone(true);
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

  // --- Matter.js セットアップ ---
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

  // --- ボール生成ロジック ---
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
    <div className="relative min-h-screen bg-slate-50 overflow-hidden font-sans text-slate-800">
      
      {/* 物理演算用背景キャンバス */}
      <div ref={sceneRef} className={`absolute inset-0 z-40 pointer-events-auto ${isLoading && uiMode === 'interactive' ? 'block' : 'hidden'}`} />

      {/* 右上の開発者用モード表示（確認用） */}
      <div className="absolute top-4 right-4 z-50 text-xs text-slate-400 pointer-events-none font-mono">
        MODE: {currentPage.toUpperCase()} <br/>(Shift + Space to toggle)
      </div>

      {/* ==========================================
          画面A：プレイグラウンド（開発・検証用）
         ========================================== */}
      {currentPage === 'playground' && !isLoading && !showDone && (
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen pointer-events-auto px-4">
          <h1 className="text-2xl font-bold text-slate-400 mb-8">Playground (開発環境)</h1>
          <div className="flex flex-col gap-4 items-center">
            <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-200">
              <button onClick={() => setTimeMode('short')} className={`px-6 py-1.5 rounded-lg text-sm font-bold transition ${timeMode === 'short' ? 'bg-blue-50 text-blue-600' : 'text-slate-400'}`}>
                短時間 (5s)
              </button>
              <button onClick={() => setTimeMode('long')} className={`px-6 py-1.5 rounded-lg text-sm font-bold transition ${timeMode === 'long' ? 'bg-blue-50 text-blue-600' : 'text-slate-400'}`}>
                長時間 (30s)
              </button>
            </div>
            <div className="flex bg-white rounded-full p-1 shadow-md border border-slate-200">
              <button onClick={() => setUiMode('simple')} className={`px-8 py-2 rounded-full font-bold transition ${uiMode === 'simple' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>
                簡易的
              </button>
              <button onClick={() => setUiMode('interactive')} className={`px-8 py-2 rounded-full font-bold transition ${uiMode === 'interactive' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>
                インタラクティブ
              </button>
            </div>
          </div>

          <div className="mt-8 text-center flex flex-col items-center gap-6">
            <div className="px-4 py-2 bg-slate-200/50 rounded-lg text-slate-500 text-sm font-medium">
              条件: {timeMode === 'short' ? '5秒' : '30秒'} × {uiMode === 'simple' ? '簡易的' : 'インタラクティブ'}
            </div>
            <button 
              onClick={() => startLoading(timeMode, uiMode)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xl font-bold py-5 px-16 rounded-2xl shadow-xl active:scale-95 transition-transform"
            >
              ローディング開始
            </button>
          </div>
        </div>
      )}

      {/* ==========================================
          画面B：架空のWebサイト（被験者実験用）
         ========================================== */}
      {currentPage === 'experiment' && !isLoading && !showDone && (
        <div className="relative z-10 min-h-screen flex flex-col pointer-events-auto bg-slate-100">
          {/* ヘッダー */}
          <header className="bg-white shadow-sm px-8 py-4 flex justify-between items-center border-b border-slate-200">
            <div className="text-xl font-black text-blue-700 tracking-tight">System Dashboard</div>
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-slate-200 rounded-full"></div>
              <span className="text-sm font-bold text-slate-600">Admin User</span>
            </div>
          </header>

          {/* コンテンツエリア */}
          <main className="flex-grow p-8 max-w-6xl mx-auto w-full">
            <h2 className="text-2xl font-bold mb-6 text-slate-800">タスク管理</h2>
            <p className="text-slate-500 mb-8">以下のタスクを実行して、システムのステータスを更新してください。</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* タスク1: 短い × 簡易的 */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center text-xl mb-4 font-bold">1</div>
                <h3 className="text-lg font-bold mb-2">軽量データの同期</h3>
                <p className="text-sm text-slate-500 mb-6">最新のテキストデータをサーバーから取得し、ローカル環境と同期します。</p>
                <button 
                  onClick={() => startLoading('short', 'simple')}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  実行する
                </button>
              </div>

              {/* タスク2: 短い × インタラクティブ */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center text-xl mb-4 font-bold">2</div>
                <h3 className="text-lg font-bold mb-2">簡易レポートの出力</h3>
                <p className="text-sm text-slate-500 mb-6">直近1週間のアクセスログを集計し、PDF形式の簡易レポートを生成します。</p>
                <button 
                  onClick={() => startLoading('short', 'interactive')}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  実行する
                </button>
              </div>

              {/* タスク3: 長い × 簡易的 */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center text-xl mb-4 font-bold">3</div>
                <h3 className="text-lg font-bold mb-2">システム全体のフルバックアップ</h3>
                <p className="text-sm text-slate-500 mb-6">データベースおよび全メディアファイルをアーカイブし、安全なストレージへ転送します。</p>
                <button 
                  onClick={() => startLoading('long', 'simple')}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  実行する
                </button>
              </div>

              {/* タスク4: 長い × インタラクティブ */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition">
                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center text-xl mb-4 font-bold">4</div>
                <h3 className="text-lg font-bold mb-2">大規模データセットの解析</h3>
                <p className="text-sm text-slate-500 mb-6">過去10年分のトランザクションデータを元に、需要予測モデルの再学習を行います。</p>
                <button 
                  onClick={() => startLoading('long', 'interactive')}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  実行する
                </button>
              </div>

            </div>
          </main>
        </div>
      )}

      {/* ==========================================
          共通ローディング画面（オーバーレイ）
         ========================================== */}
      {(isLoading || showDone) && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none bg-slate-900/10 backdrop-blur-[2px]">
          
          {isLoading && (
            <div className="w-full max-w-xl bg-white/90 backdrop-blur-md p-10 rounded-3xl shadow-2xl border border-white text-center pointer-events-auto">
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

              {/* プログレスバー */}
              <div className="w-full bg-slate-200 h-6 rounded-full overflow-hidden shadow-inner">
                <div 
                  className="bg-blue-500 h-full transition-all duration-100 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-4 text-slate-500 font-mono font-bold text-lg">{Math.floor(progress)}%</p>
            </div>
          )}

          {/* 完了表示 */}
          <div className={`absolute transition-opacity duration-1000 ${showDone && !isLoading ? 'opacity-100' : 'opacity-0'}`}>
            <span className="text-5xl font-black text-green-500 bg-white px-10 py-4 rounded-3xl shadow-lg border-2 border-green-100">
              完了
            </span>
          </div>

        </div>
      )}

    </div>
  );
}

export default App;