import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ScoreboardProps {
  externalCommand: { type: string; payload?: any } | null;
  blueName?: string;
  whiteName?: string;
  category?: string;
  isFreePlan?: boolean;
  globalSponsors?: {
    url?: string;
    type?: 'image' | 'video';
  }[];
  globalSponsorInterval?: number;
}

const ScoreNumber = ({ value }: { value: number }) => (
  <motion.span
    key={value}
    initial={{ scale: 1.5, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ type: 'spring', stiffness: 300, damping: 15 }}
    className="text-[15vmin] font-black leading-none inline-block"
  >
    {value}
  </motion.span>
);

export default function Scoreboard({ 
  externalCommand,
  blueName,
  whiteName,
  category = '',
  isFreePlan,
  globalSponsors = [],
  globalSponsorInterval = 15
}: ScoreboardProps) {
  const displayBlueName = blueName || 'AZUL';
  const displayWhiteName = whiteName || 'BRANCO';
  const [matchTime, setMatchTime] = useState(240); // 4 minutes default
  const [osaekomiTime, setOsaekomiTime] = useState(0);
  const [osaekomiActive, setOsaekomiActive] = useState<'blue' | 'white' | null>(null);
  const [isMatchRunning, setIsMatchRunning] = useState(false);
  
  const [blueScore, setBlueScore] = useState({ wazaari: 0, ippon: 0, yuko: 0, shido: 0 });
  const [whiteScore, setWhiteScore] = useState({ wazaari: 0, ippon: 0, yuko: 0, shido: 0 });

  const [winner, setWinner] = useState<'blue' | 'white' | null>(null);
  const [sponsorIndex, setSponsorIndex] = useState(0);

  useEffect(() => {
    if (!isFreePlan || globalSponsors.length <= 1) return;
    
    const safeInterval = Math.max(1, globalSponsorInterval || 15);
    const interval = setInterval(() => {
      setSponsorIndex(prev => (prev + 1) % globalSponsors.length);
    }, safeInterval * 1000);
    
    return () => clearInterval(interval);
  }, [isFreePlan, globalSponsors.length, globalSponsorInterval]);

  const currentSponsor = globalSponsors.length > 0 ? globalSponsors[sponsorIndex % globalSponsors.length] : undefined;
  const [isGoldenScore, setIsGoldenScore] = useState(false);
  const [goldenScoreTime, setGoldenScoreTime] = useState(0);

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
        setWinner(null);
        setIsGoldenScore(false);
        setGoldenScoreTime(0);
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
        setOsaekomiTime(0);
        setOsaekomiActive(payload);
        setIsMatchRunning(true); // Osaekomi implies match is running
        break;
      case 'SCOREBOARD_STOP_OSAEKOMI':
        setOsaekomiActive(null);
        setOsaekomiTime(0);
        break;
      case 'SCOREBOARD_RESET_OSAEKOMI':
        setOsaekomiTime(0);
        setOsaekomiActive(null);
        break;
    }
  }, [externalCommand]);

  // Match Timer
  useEffect(() => {
    if (isMatchRunning) {
      if (!isGoldenScore && matchTime > 0) {
        matchTimerRef.current = setInterval(() => {
          setMatchTime(prev => {
            if (prev <= 1) return 0;
            return prev - 1;
          });
        }, 1000);
      } else if (isGoldenScore) {
        matchTimerRef.current = setInterval(() => {
          setGoldenScoreTime(prev => prev + 1);
        }, 1000);
      }
    }

    return () => {
      if (matchTimerRef.current) clearInterval(matchTimerRef.current);
    };
  }, [isMatchRunning, matchTime, isGoldenScore]);

  // Re-evaluate winner on score change or time end
  useEffect(() => {
    let newWinner: 'blue' | 'white' | null = null;

    // 1. Immediate win conditions (Ippon, 2 Waza-ari, 3 Shidos)
    if (blueScore.ippon >= 1 || blueScore.wazaari >= 2 || whiteScore.shido >= 3) {
      newWinner = 'blue';
    } else if (whiteScore.ippon >= 1 || whiteScore.wazaari >= 2 || blueScore.shido >= 3) {
      newWinner = 'white';
    } 
    // 2. Golden Score sudden death
    else if (isGoldenScore) {
      if (blueScore.wazaari > whiteScore.wazaari || blueScore.yuko > whiteScore.yuko) {
        newWinner = 'blue';
      } else if (whiteScore.wazaari > blueScore.wazaari || whiteScore.yuko > blueScore.yuko) {
        newWinner = 'white';
      }
    } 
    // 3. Time ended in regular time
    else if (matchTime === 0 && !osaekomiActive) {
      if (blueScore.wazaari > whiteScore.wazaari) {
        newWinner = 'blue';
      } else if (whiteScore.wazaari > blueScore.wazaari) {
        newWinner = 'white';
      } else if (blueScore.yuko > whiteScore.yuko) {
        newWinner = 'blue';
      } else if (whiteScore.yuko > blueScore.yuko) {
        newWinner = 'white';
      }
    }

    if (newWinner !== winner) {
      setWinner(newWinner);
      if (newWinner) {
        setIsMatchRunning(false);
        setOsaekomiActive(null);
      }
    } else if (!newWinner && winner) {
      setWinner(null);
    }

    // Handle entering Golden Score
    if (matchTime === 0 && !isGoldenScore && !newWinner && !osaekomiActive) {
      setIsGoldenScore(true);
      setIsMatchRunning(false);
      setOsaekomiActive(null);
    }
  }, [blueScore, whiteScore, matchTime, isGoldenScore, winner, osaekomiActive]);

  // Osaekomi Timer
  useEffect(() => {
    if (osaekomiActive && !winner) {
      osaekomiTimerRef.current = setInterval(() => {
        setOsaekomiTime(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (osaekomiTimerRef.current) clearInterval(osaekomiTimerRef.current);
    };
  }, [osaekomiActive, winner]);

  // Osaekomi Auto-Scoring
  useEffect(() => {
    if (!osaekomiActive) return;

    const activePlayer = osaekomiActive;
    const updateScore = (player: 'blue' | 'white', updates: (s: any) => any) => {
      if (player === 'blue') {
        setBlueScore(s => ({ ...s, ...updates(s) }));
      } else {
        setWhiteScore(s => ({ ...s, ...updates(s) }));
      }
    };

    if (osaekomiTime === 5) {
      updateScore(activePlayer, s => ({ yuko: s.yuko + 1 }));
    } else if (osaekomiTime === 10) {
      updateScore(activePlayer, s => ({ wazaari: s.wazaari + 1, yuko: Math.max(0, s.yuko - 1) }));
    } else if (osaekomiTime === 20) {
      updateScore(activePlayer, s => ({ ippon: s.ippon + 1, wazaari: Math.max(0, s.wazaari - 1) }));
      setOsaekomiActive(null);
      setOsaekomiTime(0);
    }
  }, [osaekomiTime, osaekomiActive]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    const sStr = s < 10 ? '0' + s : s.toString();
    return `${m}:${sStr}`;
  };

  const renderScore = (score: { wazaari: number, ippon: number, yuko: number, shido: number }, isBlue: boolean) => (
    <div className={`flex-1 flex flex-col items-center justify-center p-8 ${isBlue ? 'bg-blue-600 text-white' : 'bg-white text-black'}`}>
      <div className="text-[6vmin] font-black uppercase tracking-widest mb-12 opacity-80 text-center">
        {isBlue ? displayBlueName : displayWhiteName}
      </div>
      
      <div className="flex gap-12 mb-16">
        <div className="flex flex-col items-center">
          <span className="text-[3vmin] font-bold uppercase tracking-wider mb-4 opacity-50">Ippon</span>
          <ScoreNumber value={score.ippon} />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[3vmin] font-bold uppercase tracking-wider mb-4 opacity-50">Waza-ari</span>
          <ScoreNumber value={score.wazaari} />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[3vmin] font-bold uppercase tracking-wider mb-4 opacity-50">Yuko</span>
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
      <div className="absolute top-0 left-0 right-0 h-[20vh] bg-black/90 z-10 flex flex-col items-center justify-center border-b border-white/10">
        {category && (
          <div className="absolute top-4 text-zinc-400 font-bold tracking-widest uppercase text-[2vmin]">
            {category}
          </div>
        )}
        <div className={`text-[12vmin] font-black font-mono tracking-tight leading-none mt-4 ${matchTime === 0 && !isGoldenScore ? 'text-red-500' : isGoldenScore ? 'text-amber-400' : 'text-white'}`}>
          {isGoldenScore ? formatTime(goldenScoreTime) : formatTime(matchTime)}
        </div>
        {isGoldenScore && (
          <div className="absolute bottom-4 text-amber-400 font-bold tracking-widest uppercase text-[2vmin]">
            Golden Score
          </div>
        )}
      </div>

      {/* Main Score Area */}
      <div className={`flex-1 flex pt-[20vh] ${isFreePlan && currentSponsor?.url ? 'pb-[15vh]' : ''}`}>
        {renderScore(blueScore, true)}
        {renderScore(whiteScore, false)}
      </div>

      {/* Free Plan Sponsor Footer */}
      {isFreePlan && currentSponsor?.url && (
        <div className="absolute bottom-0 left-0 right-0 h-[15vh] bg-black border-t border-zinc-800 flex items-center justify-center overflow-hidden z-20">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSponsor.url}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="w-full h-full"
            >
              {currentSponsor.type === 'video' ? (
                <video src={currentSponsor.url} autoPlay loop muted playsInline className="w-full h-full object-contain" />
              ) : (
                <img src={currentSponsor.url} className="w-full h-full object-contain" />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* Osaekomi Overlay */}
      {osaekomiActive && !winner && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`absolute ${isFreePlan && currentSponsor?.url ? 'bottom-[20vh]' : 'bottom-[5vh]'} left-1/2 -translate-x-1/2 px-[4vw] py-[2vh] rounded-full shadow-2xl flex items-center gap-[2vw] border-4 z-30
            ${osaekomiActive === 'blue' ? 'bg-blue-600 border-white text-white' : 'bg-white border-black text-black'}`}
        >
          <span className="text-[4vmin] font-black uppercase tracking-widest">Osaekomi</span>
          <span className="text-[8vmin] font-mono font-black">{osaekomiTime}</span>
        </motion.div>
      )}

      {/* Winner Overlay */}
      {winner && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 z-40 pointer-events-none flex"
        >
          <div className={`flex-1 transition-colors duration-1000 ${winner === 'blue' ? 'bg-blue-500/30' : 'bg-black/50'}`} />
          <div className={`flex-1 transition-colors duration-1000 ${winner === 'white' ? 'bg-white/30' : 'bg-black/50'}`} />
          
          <motion.div 
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', bounce: 0.5 }}
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-[4vw] py-[2vh] rounded-3xl shadow-2xl border-4
              ${winner === 'blue' ? 'bg-blue-600/95 border-white text-white' : 'bg-white/95 border-black text-black'}`}
          >
            <div className="text-[6vmin] font-black uppercase tracking-widest text-center">
              Vencedor
            </div>
            <div className="text-[3vmin] font-bold uppercase tracking-widest text-center mt-2 opacity-80">
              {winner === 'blue' ? displayBlueName : displayWhiteName}
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
