import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';

interface ScoreboardProps {
  externalCommand: { type: string; payload?: any } | null;
}

export default function Scoreboard({ externalCommand }: ScoreboardProps) {
  const [matchTime, setMatchTime] = useState(240); // 4 minutes default
  const [osaekomiTime, setOsaekomiTime] = useState(0);
  const [osaekomiActive, setOsaekomiActive] = useState<'blue' | 'white' | null>(null);
  const [isMatchRunning, setIsMatchRunning] = useState(false);
  
  const [blueScore, setBlueScore] = useState({ wazaari: 0, ippon: 0, yuko: 0, shido: 0 });
  const [whiteScore, setWhiteScore] = useState({ wazaari: 0, ippon: 0, yuko: 0, shido: 0 });

  const matchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const osaekomiTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!externalCommand) return;

    const { type, payload } = externalCommand;

    switch (type) {
      case 'SCOREBOARD_START_MATCH':
        setIsMatchRunning(true);
        break;
      case 'SCOREBOARD_PAUSE_MATCH':
        setIsMatchRunning(false);
        if (osaekomiActive) {
          setOsaekomiActive(null);
        }
        break;
      case 'SCOREBOARD_RESET_MATCH':
        setIsMatchRunning(false);
        setMatchTime(240);
        setOsaekomiTime(0);
        setOsaekomiActive(null);
        setBlueScore({ wazaari: 0, ippon: 0, yuko: 0, shido: 0 });
        setWhiteScore({ wazaari: 0, ippon: 0, yuko: 0, shido: 0 });
        break;
      case 'SCOREBOARD_SET_MATCH_TIME':
        setMatchTime(payload);
        break;
      case 'SCOREBOARD_UPDATE_SCORE':
        if (payload.player === 'blue') {
          setBlueScore(prev => ({ ...prev, [payload.type]: Math.max(0, prev[payload.type as keyof typeof prev] + payload.value) }));
        } else {
          setWhiteScore(prev => ({ ...prev, [payload.type]: Math.max(0, prev[payload.type as keyof typeof prev] + payload.value) }));
        }
        break;
      case 'SCOREBOARD_START_OSAEKOMI':
        setOsaekomiActive(payload);
        setIsMatchRunning(true); // Osaekomi implies match is running
        break;
      case 'SCOREBOARD_STOP_OSAEKOMI':
        setOsaekomiActive(null);
        break;
      case 'SCOREBOARD_RESET_OSAEKOMI':
        setOsaekomiTime(0);
        setOsaekomiActive(null);
        break;
    }
  }, [externalCommand]);

  // Match Timer
  useEffect(() => {
    if (isMatchRunning && matchTime > 0) {
      matchTimerRef.current = setInterval(() => {
        setMatchTime(prev => prev - 1);
      }, 1000);
    } else if (matchTime === 0) {
      setIsMatchRunning(false);
      if (osaekomiActive) setOsaekomiActive(null);
    }

    return () => {
      if (matchTimerRef.current) clearInterval(matchTimerRef.current);
    };
  }, [isMatchRunning, matchTime, osaekomiActive]);

  // Osaekomi Timer
  useEffect(() => {
    if (osaekomiActive) {
      osaekomiTimerRef.current = setInterval(() => {
        setOsaekomiTime(prev => {
          const newTime = prev + 1;
          // Auto-score logic could go here, but better handled by referee/remote
          return newTime;
        });
      }, 1000);
    }

    return () => {
      if (osaekomiTimerRef.current) clearInterval(osaekomiTimerRef.current);
    };
  }, [osaekomiActive]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const ScoreNumber = ({ value }: { value: number }) => (
    <motion.span
      key={value}
      initial={{ scale: 1.5, filter: 'brightness(2)' }}
      animate={{ scale: 1, filter: 'brightness(1)' }}
      transition={{ type: 'spring', stiffness: 300, damping: 15 }}
      className="text-[9rem] font-black leading-none inline-block"
    >
      {value}
    </motion.span>
  );

  const renderScore = (score: { wazaari: number, ippon: number, yuko: number, shido: number }, isBlue: boolean) => (
    <div className={`flex-1 flex flex-col items-center justify-center p-8 ${isBlue ? 'bg-blue-600 text-white' : 'bg-white text-black'}`}>
      <div className="text-6xl font-black uppercase tracking-widest mb-12 opacity-80">
        {isBlue ? 'AZUL' : 'BRANCO'}
      </div>
      
      <div className="flex gap-12 mb-16">
        <div className="flex flex-col items-center">
          <span className="text-xl font-bold uppercase tracking-wider mb-4 opacity-50">Ippon</span>
          <ScoreNumber value={score.ippon} />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xl font-bold uppercase tracking-wider mb-4 opacity-50">Waza-ari</span>
          <ScoreNumber value={score.wazaari} />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xl font-bold uppercase tracking-wider mb-4 opacity-50">Yuko</span>
          <ScoreNumber value={score.yuko} />
        </div>
      </div>

      <div className="flex gap-4">
        {[1, 2, 3].map(i => (
          <div 
            key={i} 
            className={`w-16 h-16 rounded-full border-4 ${isBlue ? 'border-white' : 'border-black'} flex items-center justify-center
              ${score.shido >= i ? (isBlue ? 'bg-yellow-400 border-yellow-400' : 'bg-yellow-400 border-yellow-400') : 'opacity-20'}`}
          >
            {score.shido >= i && <span className="text-black font-bold text-xl">S</span>}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col bg-zinc-900 rounded-[3rem] overflow-hidden border border-zinc-800 shadow-2xl relative">
      {/* Top Bar: Match Timer */}
      <div className="absolute top-0 left-0 right-0 h-40 bg-black/80 backdrop-blur-md z-10 flex items-center justify-center border-b border-white/10">
        <div className={`text-[8rem] font-black font-mono tracking-tight ${matchTime === 0 ? 'text-red-500' : 'text-white'}`}>
          {formatTime(matchTime)}
        </div>
      </div>

      {/* Main Score Area */}
      <div className="flex-1 flex pt-40">
        {renderScore(blueScore, true)}
        {renderScore(whiteScore, false)}
      </div>

      {/* Osaekomi Overlay */}
      {osaekomiActive && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`absolute bottom-12 left-1/2 -translate-x-1/2 px-16 py-8 rounded-full shadow-2xl flex items-center gap-8 border-4
            ${osaekomiActive === 'blue' ? 'bg-blue-600 border-white text-white' : 'bg-white border-black text-black'}`}
        >
          <span className="text-4xl font-black uppercase tracking-widest">Osaekomi</span>
          <span className="text-7xl font-mono font-black">{osaekomiTime}</span>
        </motion.div>
      )}
    </div>
  );
}
