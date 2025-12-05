import React, { useState, useCallback, Suspense, useMemo } from 'react';
import ThreeScene from './components/ThreeScene';
import GameOverlay from './components/GameOverlay';
import { PlayerState, BuildingData } from './types';

// Constants for generation
const CITY_SIZE = 60;
const BUILDING_COUNT = 300;
const NEON_PALETTE = ['#f72585', '#b5179e', '#7209b7', '#4cc9f0', '#4361ee'];
const TENDER_PALETTE = ['#ff99c8', '#fcf6bd', '#d0f4de', '#a9def9', '#e4c1f9'];

const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

export default function App() {
  const [playerState, setPlayerState] = useState<PlayerState>({ 
    speed: 0, 
    altitude: 0, 
    position: [0, 0, 0],
    rotation: 0 
  });
  const [hasStarted, setHasStarted] = useState(false);

  // Generate buildings once
  const buildings = useMemo<BuildingData[]>(() => {
    const items: BuildingData[] = [];
    for (let i = 0; i < BUILDING_COUNT; i++) {
      const x = randomRange(-CITY_SIZE * 3, CITY_SIZE * 3);
      const z = randomRange(-CITY_SIZE * 3, CITY_SIZE * 3);
      
      // Keep center clear for "highway"
      if (Math.abs(x) < 15 && Math.abs(z) < 15) continue;

      const height = randomRange(15, 70);
      const width = randomRange(3, 8);
      const depth = randomRange(3, 8);
      // Use softer colors
      const color = TENDER_PALETTE[Math.floor(Math.random() * TENDER_PALETTE.length)];
      
      items.push({ x, z, height, width, depth, color });
    }
    return items;
  }, []);

  const handleStatsUpdate = useCallback((state: PlayerState) => {
     setPlayerState(state);
  }, []);

  if (!hasStarted) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#1a1a2e] relative overflow-hidden">
         {/* Background video or effect placeholder */}
         <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] opacity-80"></div>
         
         <div className="z-10 text-center flex flex-col items-center gap-6 p-10 border border-[#e94560]/30 bg-[#16213e]/80 backdrop-blur-md rounded-2xl shadow-[0_0_50px_rgba(233,69,96,0.2)]">
            <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#e94560] to-[#0f3460] tracking-tighter drop-shadow-lg">
              SOFT NEON
            </h1>
            <p className="text-[#a9def9] max-w-md font-mono text-sm">
              Navigate the dreamscape city. Avoid buildings.
            </p>
            
            <button 
              onClick={() => setHasStarted(true)}
              className="group relative px-8 py-3 bg-[#0f3460] border border-[#e94560] text-[#e94560] font-bold font-mono tracking-widest overflow-hidden transition-all hover:bg-[#e94560] hover:text-white hover:scale-105 rounded"
            >
              <span className="relative z-10">DRIFT IN</span>
            </button>
            
            <div className="text-[10px] text-[#a9def9]/50 mt-4 uppercase tracking-widest">
               Powered by React Three Fiber & Gemini AI
            </div>
         </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-[#1a1a2e]">
      <Suspense fallback={
        <div className="absolute inset-0 flex items-center justify-center text-[#e94560] font-mono animate-pulse">
          LOADING DREAMSCAPE...
        </div>
      }>
        <ThreeScene 
          buildings={buildings} 
          onStatsUpdate={handleStatsUpdate} 
        />
      </Suspense>
      
      <GameOverlay 
        playerState={playerState}
        buildings={buildings}
      />
    </div>
  );
}