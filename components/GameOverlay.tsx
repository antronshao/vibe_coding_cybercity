import React, { useState, useEffect, useMemo } from 'react';
import { fetchRadioChatter } from '../services/geminiService';
import { RadioMessage, PlayerState, BuildingData } from '../types';

const generateId = () => Math.random().toString(36).substr(2, 9);

interface GameOverlayProps {
  playerState: PlayerState;
  buildings: BuildingData[];
}

const GameOverlay: React.FC<GameOverlayProps> = ({ playerState, buildings }) => {
  const [messages, setMessages] = useState<RadioMessage[]>([]);
  const [isOnline, setIsOnline] = useState(false);

  // Initial Radio connect
  useEffect(() => {
    const timer = setTimeout(() => {
        setIsOnline(true);
        addMessage("SYSTEM", "DreamLink Connected.");
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Periodic Radio Chatter
  useEffect(() => {
    if (!isOnline) return;

    const loop = setInterval(async () => {
      if (Math.random() > 0.4) {
        const text = await fetchRadioChatter();
        addMessage("VAPOR_NET", text);
      }
    }, 18000);

    return () => clearInterval(loop);
  }, [isOnline]);

  const addMessage = (sender: string, text: string) => {
    setMessages(prev => [
      ...prev.slice(-4),
      { id: generateId(), sender, text, timestamp: new Date().toLocaleTimeString([], { hour12: false }) }
    ]);
  };

  // --- Minimap Rendering Logic ---
  // Map scale: World 360x360 -> Minimap 150x150
  const MAP_SIZE = 160;
  const WORLD_SIZE = 400; // Half-width approx
  const scale = MAP_SIZE / (WORLD_SIZE * 2);

  const minimapBuildings = useMemo(() => {
      return buildings.map(b => ({
          left: (b.x + WORLD_SIZE) * scale - (b.width * scale) / 2,
          top: (b.z + WORLD_SIZE) * scale - (b.depth * scale) / 2,
          width: Math.max(2, b.width * scale),
          height: Math.max(2, b.depth * scale),
          color: b.color
      }));
  }, [buildings]);

  const playerX = (playerState.position[0] + WORLD_SIZE) * scale;
  const playerY = (playerState.position[2] + WORLD_SIZE) * scale;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6">
      
      {/* Top Left: Title & Status */}
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black text-[#e4c1f9] tracking-tighter drop-shadow-[0_0_8px_rgba(228,193,249,0.6)]">
          SOFT NEON
        </h1>
        <div className="flex items-center gap-2">
           <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[#a9def9] shadow-[0_0_8px_#a9def9]' : 'bg-[#ff99c8]'}`}></div>
           <span className="text-[10px] text-[#a9def9] font-mono tracking-widest">{isOnline ? 'ONLINE' : 'SYNCING...'}</span>
        </div>
      </div>

      {/* Top Right: Minimap */}
      <div className="absolute top-6 right-6 p-2 bg-[#1a1a2e]/80 border border-[#e4c1f9]/30 rounded-lg backdrop-blur-md shadow-lg">
          <div className="relative overflow-hidden bg-[#242038] rounded border border-[#a9def9]/20" style={{ width: MAP_SIZE, height: MAP_SIZE }}>
              {/* Buildings */}
              {minimapBuildings.map((b, i) => (
                  <div 
                    key={i} 
                    className="absolute opacity-60"
                    style={{ 
                        left: b.left, 
                        top: b.top, 
                        width: b.width, 
                        height: b.height, 
                        backgroundColor: b.color 
                    }}
                  />
              ))}
              
              {/* Player Arrow */}
              <div 
                 className="absolute w-0 h-0 border-l-[4px] border-r-[4px] border-b-[10px] border-l-transparent border-r-transparent border-b-white z-10 drop-shadow-md"
                 style={{ 
                     left: playerX - 4, // center it
                     top: playerY - 5,
                     transform: `rotate(${-playerState.rotation}rad)`,
                     transformOrigin: '50% 50%'
                 }}
              />
              <div className="absolute bottom-1 right-1 text-[8px] text-[#a9def9]/50 font-mono">SECTOR 7</div>
          </div>
      </div>

      {/* Bottom Right: Stats */}
      <div className="absolute bottom-10 right-10 text-right font-mono">
         <div className="flex flex-col items-end gap-1">
            <div className="text-5xl font-bold text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">
              {playerState.speed}<span className="text-2xl text-[#a9def9]/70"> KM/H</span>
            </div>
            <div className="text-xl text-[#ff99c8] font-bold tracking-widest">
               ALT: {playerState.altitude}M
            </div>
            
            {/* Speed Bar */}
            <div className="w-48 h-1.5 bg-[#242038] mt-2 rounded-full overflow-hidden">
               <div 
                 className="h-full bg-gradient-to-r from-[#a9def9] to-[#ff99c8] transition-all duration-100"
                 style={{ width: `${Math.min((playerState.speed / 400) * 100, 100)}%` }}
               ></div>
            </div>
         </div>
      </div>

      {/* Bottom Left: Radio Log */}
      <div className="absolute bottom-10 left-10 w-96 font-mono text-sm">
        <div className="bg-[#1a1a2e]/60 backdrop-blur-md border-l-2 border-[#e4c1f9] p-4 rounded-r-xl">
           <div className="text-[10px] text-[#a9def9] mb-2 border-b border-[#a9def9]/20 pb-1 flex justify-between">
              <span>FREQUENCY 88.5 FM</span>
              <span>STEREO</span>
           </div>
           <div className="flex flex-col gap-3">
             {messages.map((msg) => (
               <div key={msg.id} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="flex justify-between text-[10px] text-[#e4c1f9]/70 mb-0.5">
                     <span className={msg.sender === 'SYSTEM' ? 'text-[#fcf6bd]' : 'text-[#ff99c8]'}>[{msg.sender}]</span>
                     <span>{msg.timestamp}</span>
                  </div>
                  <p className="text-[#e2e2e2] leading-tight text-xs shadow-black drop-shadow-sm">{msg.text}</p>
               </div>
             ))}
             {messages.length === 0 && <div className="text-[#a9def9]/40 italic text-xs">Waiting for transmission...</div>}
           </div>
        </div>
      </div>
      
    </div>
  );
};

export default GameOverlay;