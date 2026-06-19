import React, { useState, useEffect, useRef } from 'react';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import Matter from 'matter-js';

const shuffleArray = (array) => {
  const clone = [...array];
  for (let i = clone.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
};

function App() {
  const [currentPage, setCurrentPage] = useState('playground'); 

  // 実験管理ステート
  const [systemMode, setSystemMode] = useState('A'); 
  const [timeQueue, setTimeQueue] = useState([]);    
  const [trialIndex, setTrialIndex] = useState(0);   

  const [timeMode, setTimeMode] = useState('short'); 
  const [uiMode, setUiMode] = useState('simple');   
  
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showToast, setShowToast] = useState(false);

  const sceneRef = useRef(null);
  const engineRef = useRef(null);
  const ballCountRef = useRef(0);
  const wallsRef = useRef([]);

  // キューの初期化（4回分の時間をシャッフル）
  const initExperimentQueue = (system) => {
    const baseTimes = [5000, 5000, 30000, 30000]; 
    const shuffled = shuffleArray(baseTimes);
    setTimeQueue(shuffled);
    setTrialIndex(0);
    setSystemMode(system);
  };

  useEffect(() => {
    initExperimentQueue('A');
  }, []);

  // Shift + Space で画面切り替え
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

  const startLoading = (time, ui, isExperiment = false) => {
    let finalTime = time;
    let finalUi = ui;

    if (isExperiment) {
      if (trialIndex >= 4) {
        alert('このシステムの試行は完了しています。パネルから次のシステムに切り替えてください。');
        return;
      }
      
      const currentDuration = timeQueue[trialIndex];
      finalTime = currentDuration === 5000 ? 'short' : 'long';

      if (systemMode === 'A') {
        finalUi = 'simple'; 
      } else if (systemMode === 'B') {
        finalUi = 'interactive'; 
      } else if (systemMode === 'C') {
        finalUi = currentDuration === 5000 ? 'simple' : 'interactive'; 
      }
    }

    setTimeMode(finalTime);
    setUiMode(finalUi);
    setIsLoading(true);
    setProgress(0);
    setShowToast(false);
    ballCountRef.current = 0;
  };

  // リアルな進捗
  useEffect(() => {
    if (!isLoading) return;
    
    const duration = timeMode === 'short' ? 5000 : 30000;
    const startTime = Date.now();

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      let rawPercent = elapsed / duration; 

      if (rawPercent >= 1) {
        setProgress(100);
        clearInterval(timer);
        setIsLoading(false);
        setShowToast(true);

        if (currentPage === 'experiment') {
          setTrialIndex((prev) => prev + 1);
        }

        setTimeout(() => setShowToast(false), 3000);
      } else {
        let fakePercent;
        if (rawPercent < 0.1) fakePercent = (rawPercent / 0.1) * 40;
        else if (rawPercent < 0.4) fakePercent = 40 + ((rawPercent - 0.1) / 0.3) * 5;
        else if (rawPercent < 0.5) fakePercent = 45 + ((rawPercent - 0.4) / 0.1) * 35;
        else if (rawPercent < 0.8) fakePercent = 80 + ((rawPercent - 0.5) / 0.3) * 10;
        else if (rawPercent < 0.95) fakePercent = 90 + ((rawPercent - 0.8) / 0.15) * 9;
        else fakePercent = 99;

        setProgress(fakePercent);
      }
    }, 50);

    return () => clearInterval(timer);
  }, [isLoading, timeMode, currentPage]);

  // Matter.js セットアップ（仕分けミニゲーム仕様）
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

      // ▼ 当たり判定（衝突イベント）とフェードアウト発光処理 ▼
      Matter.Events.on(engine, 'collisionStart', (event) => {
        event.pairs.forEach((pair) => {
          const { bodyA, bodyB } = pair;

          const handleMatch = (ball, zone) => {
            if (ball.label?.startsWith('ball_') && zone.label?.startsWith('zone_')) {
              const ballColor = ball.label.replace('ball_', '');
              const zoneColor = zone.label.replace('zone_', '');
              
              if (ballColor === zoneColor) {
                // 1. ボールを削除
                Matter.Composite.remove(engine.world, ball);
                
                // 2. ゾーンの底をフェードアウトさせながら光らせる
                const hexToRgb = (hex) => {
                  const bigint = parseInt(hex.slice(1), 16);
                  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
                };
                const targetRgb = hexToRgb(zoneColor);

                // 連続で入った時にチカチカしないよう、前のタイマーがあれば消す
                if (zone.fadeInterval) clearInterval(zone.fadeInterval);

                let step = 0;
                const totalSteps = 20; // 20コマでフェード
                zone.fadeInterval = setInterval(() => {
                  step++;
                  const ratio = step / totalSteps;
                  
                  // 白(255)から元の色へ徐々に近づける計算
                  const currentR = Math.round(255 - (255 - targetRgb.r) * ratio);
                  const currentG = Math.round(255 - (255 - targetRgb.g) * ratio);
                  const currentB = Math.round(255 - (255 - targetRgb.b) * ratio);

                  if (zone.render) {
                    zone.render.fillStyle = `rgb(${currentR}, ${currentG}, ${currentB})`;
                  }

                  if (step >= totalSteps) {
                    clearInterval(zone.fadeInterval);
                    zone.fadeInterval = null;
                    if (zone.render) zone.render.fillStyle = zoneColor; // 最後は正確な色に戻す
                  }
                }, 30); // 約600ms（0.6秒）かけてスゥーっと戻る
              }
            }
          };

          handleMatch(bodyA, bodyB);
          handleMatch(bodyB, bodyA);
        });
      });

      const createWalls = () => {
        const thickness = 100;
        const w = window.innerWidth;
        const h = window.innerHeight;
        
        // 外枠
        const ground = Bodies.rectangle(w / 2, h + thickness / 2, w, thickness, { isStatic: true });
        const leftWall = Bodies.rectangle(-thickness / 2, h / 2, thickness, h, { isStatic: true });
        const rightWall = Bodies.rectangle(w + thickness / 2, h / 2, thickness, h, { isStatic: true });

        // 仕分け用の仕切り
        const divider1 = Bodies.rectangle(w / 3, h - 150, 20, 300, { 
          isStatic: true, 
          render: { fillStyle: '#cbd5e1' } 
        });
        const divider2 = Bodies.rectangle((w / 3) * 2, h - 150, 20, 300, { 
          isStatic: true, 
          render: { fillStyle: '#cbd5e1' } 
        });

        // 各ゾーンの底
        const zoneRed = Bodies.rectangle(w / 6, h - 10, w / 3, 20, { 
          isStatic: true, 
          label: 'zone_#ef4444', 
          render: { fillStyle: '#ef4444' } 
        });
        const zoneGreen = Bodies.rectangle(w / 2, h - 10, w / 3, 20, { 
          isStatic: true, 
          label: 'zone_#22c55e', 
          render: { fillStyle: '#22c55e' } 
        });
        const zoneBlue = Bodies.rectangle((w * 5) / 6, h - 10, w / 3, 20, { 
          isStatic: true, 
          label: 'zone_#3b82f6', 
          render: { fillStyle: '#3b82f6' } 
        });

        return [ground, leftWall, rightWall, divider1, divider2, zoneRed, zoneGreen, zoneBlue];
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

  // ボール生成（3色からランダム）
  useEffect(() => {
    if (isLoading && uiMode === 'interactive' && engineRef.current) {
      // ▼ 修正点: ボールの数を減らすため、3%ごとに1個出現するように変更 (最大33個) ▼
      const targetBallCount = Math.floor(progress / 3);
      const diff = targetBallCount - ballCountRef.current;

      const ballColors = ['#ef4444', '#22c55e', '#3b82f6']; // 赤, 緑, 青

      if (diff > 0) {
        for (let i = 0; i < diff; i++) {
          const radius = 45 + Math.random() * 30; 
          const x = Math.random() * (window.innerWidth - 100) + 50;
          
          const color = ballColors[Math.floor(Math.random() * ballColors.length)];

          const ball = Matter.Bodies.circle(x, -50, radius, {
            restitution: 0.6,
            friction: 0.1,
            label: `ball_${color}`, 
            render: { fillStyle: color }
          });
          Matter.Composite.add(engineRef.current.world, ball);
        }
        ballCountRef.current = targetBallCount;
      }
    }
  }, [progress, isLoading, uiMode]);

  const getCardClass = (index) => {
    if (trialIndex === index) {
      return "bg-white/95 backdrop-blur-sm border-slate-200 shadow-md"; 
    } else if (trialIndex > index) {
      return "bg-slate-200/60 border-slate-300 opacity-60 grayscale"; 
    } else {
      return "bg-slate-100/50 border-slate-200 opacity-50"; 
    }
  };

  const renderCardButton = (index) => {
    if (trialIndex === index) {
      return (
        <button onClick={() => startLoading(null, null, true)} className="w-full py-3.5 bg-slate-800 text-white font-bold rounded-xl shadow-sm hover:bg-slate-700 hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
          実行する
        </button>
      );
    } else if (trialIndex > index) {
      return (
        <button disabled className="w-full py-3.5 bg-slate-400 text-white font-bold rounded-xl cursor-not-allowed">
          完了
        </button>
      );
    } else {
      return (
        <button disabled className="w-full py-3.5 bg-slate-300 text-slate-500 font-bold rounded-xl cursor-not-allowed">
          待機中
        </button>
      );
    }
  };

  return (
    <div className="relative min-h-screen bg-blue-200 overflow-hidden font-sans text-slate-800">
      
      <style>{`
        @keyframes progress-stripes {
          0% { background-position: 1rem 0; }
          100% { background-position: 0 0; }
        }
        .animate-stripes {
          background-image: linear-gradient(45deg, rgba(255, 255, 255, 0.2) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.2) 50%, rgba(255, 255, 255, 0.2) 75%, transparent 75%, transparent);
          background-size: 1rem 1rem;
          animation: progress-stripes 1s linear infinite;
        }
      `}</style>

      {/* 完了トースト通知 */}
      <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-[100] bg-emerald-500 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 transition-all duration-500 ${showToast ? 'translate-y-0 opacity-100' : '-translate-y-16 opacity-0 pointer-events-none'}`}>
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
        <span className="font-bold text-lg tracking-wide">タスクが完了しました</span>
      </div>

      {/* 白被せレイヤー */}
      <div className={`absolute inset-0 z-30 bg-white/70 transition-opacity duration-300 ${isLoading ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} />

      {/* 物理演算背景 */}
      <div ref={sceneRef} className={`absolute inset-0 z-40 pointer-events-auto ${isLoading && uiMode === 'interactive' ? 'block' : 'hidden'}`} />

      <div className="absolute top-4 right-4 z-50 text-xs text-slate-400 pointer-events-none font-mono text-right">
        MODE: {currentPage.toUpperCase()} <br/>(Shift + Space to toggle)
      </div>

      {/* ==========================================
          画面A：プレイグラウンド
         ========================================== */}
      {currentPage === 'playground' && (
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
          <h1 className="text-2xl font-bold text-slate-400 mb-8">Playground (開発環境)</h1>
          <div className="flex flex-col gap-4 items-center">
            <div className="flex bg-white/80 backdrop-blur-sm rounded-xl p-1 shadow-sm border border-slate-200">
              <button onClick={() => setTimeMode('short')} className={`px-6 py-1.5 rounded-lg text-sm font-bold transition ${timeMode === 'short' ? 'bg-blue-50 text-blue-600' : 'text-slate-400'}`}>短時間 (5s)</button>
              <button onClick={() => setTimeMode('long')} className={`px-6 py-1.5 rounded-lg text-sm font-bold transition ${timeMode === 'long' ? 'bg-blue-50 text-blue-600' : 'text-slate-400'}`}>長時間 (30s)</button>
            </div>
            <div className="flex bg-white/80 backdrop-blur-sm rounded-full p-1 shadow-md border border-slate-200">
              <button onClick={() => setUiMode('simple')} className={`px-8 py-2 rounded-full font-bold transition ${uiMode === 'simple' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>簡易的</button>
              <button onClick={() => setUiMode('interactive')} className={`px-8 py-2 rounded-full font-bold transition ${uiMode === 'interactive' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>インタラクティブ</button>
            </div>
          </div>
          <div className="mt-8 text-center flex flex-col items-center gap-6">
            <button onClick={() => startLoading(timeMode, uiMode)} className="bg-blue-600 hover:bg-blue-700 text-white text-xl font-bold py-5 px-16 rounded-2xl shadow-xl active:scale-95 transition-transform">
              ローディング開始
            </button>
          </div>
        </div>
      )}

      {/* ==========================================
          画面B：実験用ダッシュボード
         ========================================== */}
      {currentPage === 'experiment' && (
        <div className="relative z-10 min-h-screen flex flex-col bg-blue-200">
          
          {/* コントロールパネル */}
          <div className="bg-slate-900 text-white px-8 py-3 flex justify-between items-center text-sm">
            <div className="flex items-center gap-4">
              <span className="font-bold text-amber-400">【実験者用操作パネル】</span>
              <span className="text-slate-400">現在のシステム:</span>
              <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                <button onClick={() => initExperimentQueue('A')} className={`px-4 py-1 rounded-md font-bold transition ${systemMode === 'A' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>A (常に簡易)</button>
                <button onClick={() => initExperimentQueue('B')} className={`px-4 py-1 rounded-md font-bold transition ${systemMode === 'B' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>B (常に遊べる)</button>
                <button onClick={() => initExperimentQueue('C')} className={`px-4 py-1 rounded-md font-bold transition ${systemMode === 'C' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>C (適応型)</button>
              </div>
            </div>
            <div className="font-mono bg-slate-800 px-4 py-1 rounded-md border border-slate-700">
              進捗: <span className="text-blue-400 font-bold">{trialIndex}</span> / 4 回
              {trialIndex >= 4 && <span className="text-emerald-400 ml-2 font-bold">(完了)</span>}
            </div>
          </div>

          <header className="bg-white/90 backdrop-blur-md shadow-sm px-8 py-4 flex justify-between items-center border-b border-slate-200">
            <div className="text-xl font-black text-blue-700 tracking-tight">System Dashboard</div>
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-slate-300 rounded-full"></div>
              <span className="text-sm font-bold text-slate-600">Admin User</span>
            </div>
          </header>

          <main className="flex-grow p-8 max-w-6xl mx-auto w-full">
            <h2 className="text-2xl font-bold mb-2 text-slate-800">タスク管理</h2>
            <p className="text-slate-500 mb-8 font-medium">以下のタスクを1から順番に実行してください。</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              <div className={`p-8 rounded-2xl border border-t-4 border-t-emerald-500 flex flex-col justify-between transition-all duration-300 ${getCardClass(0)}`}>
                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black ${trialIndex >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>1</div>
                    <h3 className="text-lg font-bold text-slate-800">軽量データの同期</h3>
                  </div>
                  <p className="text-sm text-slate-600 mb-8 leading-relaxed">最新のテキストデータをサーバーから取得し、ローカル環境と同期します。</p>
                </div>
                {renderCardButton(0)}
              </div>

              <div className={`p-8 rounded-2xl border border-t-4 border-t-blue-500 flex flex-col justify-between transition-all duration-300 ${getCardClass(1)}`}>
                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black ${trialIndex >= 1 ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-400'}`}>2</div>
                    <h3 className="text-lg font-bold text-slate-800">簡易レポートの出力</h3>
                  </div>
                  <p className="text-sm text-slate-600 mb-8 leading-relaxed">直近1週間のアクセスログを集計し、PDF形式の簡易レポートを生成します。</p>
                </div>
                {renderCardButton(1)}
              </div>

              <div className={`p-8 rounded-2xl border border-t-4 border-t-amber-500 flex flex-col justify-between transition-all duration-300 ${getCardClass(2)}`}>
                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black ${trialIndex >= 2 ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-400'}`}>3</div>
                    <h3 className="text-lg font-bold text-slate-800">システムフルバックアップ</h3>
                  </div>
                  <p className="text-sm text-slate-600 mb-8 leading-relaxed">データベースおよび全メディアファイルをアーカイブし、安全なストレージへ転送します。</p>
                </div>
                {renderCardButton(2)}
              </div>

              <div className={`p-8 rounded-2xl border border-t-4 border-t-purple-500 flex flex-col justify-between transition-all duration-300 ${getCardClass(3)}`}>
                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black ${trialIndex >= 3 ? 'bg-purple-100 text-purple-600' : 'bg-slate-200 text-slate-400'}`}>4</div>
                    <h3 className="text-lg font-bold text-slate-800">大規模データセットの解析</h3>
                  </div>
                  <p className="text-sm text-slate-600 mb-8 leading-relaxed">過去10年分のトランザクションデータを元に、需要予測モデルの再学習を行います。</p>
                </div>
                {renderCardButton(3)}
              </div>

            </div>
          </main>
        </div>
      )}

      {/* ==========================================
          ローディングモーダル (Z-index: 50)
         ========================================== */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none">
          <div className="w-full max-w-xl bg-white/95 p-10 rounded-[2rem] shadow-2xl border border-slate-100 text-center pointer-events-none transform scale-100 animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-bold mb-8 text-slate-800 tracking-tight">
              処理を実行しています...
            </h2>

            {uiMode === 'simple' && (
              <div className="mb-8 text-left">
                <SkeletonTheme baseColor="#e2e8f0" highlightColor="#f8fafc">
                  <Skeleton height={32} width="70%" className="mb-4 rounded-lg" />
                  <Skeleton count={2} className="rounded-md" />
                </SkeletonTheme>
              </div>
            )}

            {/* ストライプアニメーション付きプログレスバー */}
            <div className="w-full bg-slate-100 h-6 rounded-full overflow-hidden shadow-inner border border-slate-200">
              <div 
                className="bg-blue-500 h-full transition-all duration-[50ms] ease-linear animate-stripes shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                style={{ width: `${progress}%` }}
              />
            </div>
            
            <div className="flex justify-between items-center mt-3">
              <p className="text-slate-400 text-sm font-medium">Please wait</p>
              <p className="text-blue-600 font-mono font-black text-xl">{Math.floor(progress)}%</p>
            </div>

            {/* インタラクティブ時の操作ヒント */}
            {uiMode === 'interactive' && (
              <div className="mt-8 flex items-center justify-center gap-2 text-slate-500 animate-pulse bg-slate-50 py-2 px-4 rounded-full border border-slate-100 inline-flex mx-auto">
                <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
                <span className="text-sm font-bold tracking-wide">ボールをドラッグして同じ色の箱に仕分けてみよう</span>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export default App;