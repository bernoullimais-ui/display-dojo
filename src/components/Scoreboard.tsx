import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ScoreboardProps {
  externalCommand: { type: string; payload?: any } | null;
  blueName?: string;
  whiteName?: string;
  category?: string;
  sport?: 'judo' | 'jiujitsu' | 'karate';
  isFreePlan?: boolean;
  globalSponsors?: {
    url?: string;
    type?: 'image' | 'video';
  }[];
  globalSponsorInterval?: number;
  isMuted?: boolean;
  volume?: number;
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
  sport = 'judo',
  isFreePlan,
  globalSponsors = [],
  globalSponsorInterval = 15,
  isMuted = true,
  volume = 50
}: ScoreboardProps) {
  const displayBlueName = blueName || (sport === 'karate' ? 'VERMELHO' : 'AZUL');
  const displayWhiteName = whiteName || (sport === 'karate' ? 'AZUL' : 'BRANCO');
  const [matchTime, setMatchTime] = useState(240); // 4 minutes default
  const [osaekomiTime, setOsaekomiTime] = useState(0);
  const [osaekomiActive, setOsaekomiActive] = useState<'blue' | 'white' | null>(null);
  const [isMatchRunning, setIsMatchRunning] = useState(false);
  
  const [blueScore, setBlueScore] = useState({ wazaari: 0, ippon: 0, yuko: 0, shido: 0, points: 0, advantages: 0, penalties: 0, senshu: false });
  const [whiteScore, setWhiteScore] = useState({ wazaari: 0, ippon: 0, yuko: 0, shido: 0, points: 0, advantages: 0, penalties: 0, senshu: false });

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
        setBlueScore({ wazaari: 0, ippon: 0, yuko: 0, shido: 0, points: 0, advantages: 0, penalties: 0, senshu: false });
        setWhiteScore({ wazaari: 0, ippon: 0, yuko: 0, shido: 0, points: 0, advantages: 0, penalties: 0, senshu: false });
        setWinner(null);
        setIsGoldenScore(false);
        setGoldenScoreTime(0);
        break;
      case 'SCOREBOARD_SET_MATCH_TIME':
        setMatchTime(payload);
        break;
      case 'SCOREBOARD_UPDATE_SCORE':
        if (payload.player === 'blue') {
          setBlueScore(prev => ({ ...prev, [payload.type]: Math.max(0, (prev[payload.type as keyof typeof prev] as number) + payload.value) }));
        } else {
          setWhiteScore(prev => ({ ...prev, [payload.type]: Math.max(0, (prev[payload.type as keyof typeof prev] as number) + payload.value) }));
        }
        break;
      case 'SCOREBOARD_TOGGLE_SENSHU':
        if (payload === 'blue') {
          setBlueScore(prev => ({ ...prev, senshu: !prev.senshu }));
          setWhiteScore(prev => ({ ...prev, senshu: false }));
        } else {
          setWhiteScore(prev => ({ ...prev, senshu: !prev.senshu }));
          setBlueScore(prev => ({ ...prev, senshu: false }));
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

  const audioContextRef = useRef<AudioContext | null>(null);

  const playBuzzer = () => {
    if (isMuted) return;
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          audioContextRef.current = new AudioCtx();
        } else {
          return;
        }
      }
      
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 1.5);
      
      gain.gain.setValueAtTime(volume / 100, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 1.5);
    } catch (e) {
      console.error('Audio play failed:', e);
    }
  };

  // Match Timer
  useEffect(() => {
    if (isMatchRunning) {
      if (!isGoldenScore && matchTime > 0) {
        matchTimerRef.current = setInterval(() => {
          setMatchTime(prev => {
            if (prev <= 1) {
              setIsMatchRunning(false);
              playBuzzer();
              return 0;
            }
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
  }, [isMatchRunning, matchTime, isGoldenScore, isMuted, volume]);

  // Re-evaluate winner on score change or time end
  useEffect(() => {
    let newWinner: 'blue' | 'white' | null = null;

    if (sport === 'judo') {
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
    } else if (sport === 'jiujitsu') {
      if (whiteScore.penalties >= 4) {
        newWinner = 'blue';
      } else if (blueScore.penalties >= 4) {
        newWinner = 'white';
      } else if (matchTime === 0) {
        if (blueScore.points > whiteScore.points) newWinner = 'blue';
        else if (whiteScore.points > blueScore.points) newWinner = 'white';
        else if (blueScore.advantages > whiteScore.advantages) newWinner = 'blue';
        else if (whiteScore.advantages > blueScore.advantages) newWinner = 'white';
        else if (blueScore.penalties < whiteScore.penalties) newWinner = 'blue';
        else if (whiteScore.penalties < blueScore.penalties) newWinner = 'white';
      }
    } else if (sport === 'karate') {
      if (blueScore.ippon + blueScore.wazaari + blueScore.yuko - whiteScore.ippon - whiteScore.wazaari - whiteScore.yuko >= 8) {
        newWinner = 'blue';
      } else if (whiteScore.ippon + whiteScore.wazaari + whiteScore.yuko - blueScore.ippon - blueScore.wazaari - blueScore.yuko >= 8) {
        newWinner = 'white';
      } else if (matchTime === 0) {
        const blueTotal = blueScore.ippon + blueScore.wazaari + blueScore.yuko;
        const whiteTotal = whiteScore.ippon + whiteScore.wazaari + whiteScore.yuko;
        if (blueTotal > whiteTotal) newWinner = 'blue';
        else if (whiteTotal > blueTotal) newWinner = 'white';
        else if (blueScore.senshu) newWinner = 'blue';
        else if (whiteScore.senshu) newWinner = 'white';
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
    if (matchTime === 0 && !isGoldenScore && !newWinner && !osaekomiActive && sport === 'judo') {
      setIsGoldenScore(true);
      setIsMatchRunning(false);
      setOsaekomiActive(null);
    }
  }, [blueScore, whiteScore, matchTime, isGoldenScore, winner, osaekomiActive, sport]);

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

  const renderScore = (score: { wazaari: number, ippon: number, yuko: number, shido: number, points: number, advantages: number, penalties: number, senshu: boolean }, isBlue: boolean) => {
    const isKarateRed = sport === 'karate' && isBlue;
    const isKarateBlue = sport === 'karate' && !isBlue;
    const bgColor = isKarateRed ? 'bg-red-600 text-white' : (isKarateBlue ? 'bg-blue-600 text-white' : (isBlue ? 'bg-blue-600 text-white' : 'bg-white text-black'));
    const borderColor = isKarateRed || isKarateBlue || isBlue ? 'border-white' : 'border-black';
    const activeColor = isKarateRed || isKarateBlue || isBlue ? 'bg-yellow-400 border-yellow-400' : 'bg-yellow-400 border-yellow-400';

    return (
      <div className={`flex-1 flex flex-col items-center justify-center p-8 ${bgColor}`}>
        <div className="text-[6vmin] font-black uppercase tracking-widest mb-12 opacity-80 text-center">
          {isBlue ? displayBlueName : displayWhiteName}
        </div>
        
        {sport === 'judo' && (
          <>
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
                  className={`w-16 h-16 rounded-full border-4 ${borderColor} flex items-center justify-center
                    ${score.shido >= i ? activeColor : 'opacity-20'}`}
                >
                  {score.shido >= i && <span className="text-black font-bold text-xl">S</span>}
                </div>
              ))}
            </div>
          </>
        )}

        {sport === 'jiujitsu' && (
          <>
            <div className="flex gap-12 mb-16">
              <div className="flex flex-col items-center">
                <span className="text-[3vmin] font-bold uppercase tracking-wider mb-4 opacity-50">Pontos</span>
                <ScoreNumber value={score.points} />
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[3vmin] font-bold uppercase tracking-wider mb-4 opacity-50">Vantagens</span>
                <ScoreNumber value={score.advantages} />
              </div>
            </div>

            <div className="flex gap-4">
              {[1, 2, 3, 4].map(i => (
                <div 
                  key={i} 
                  className={`w-16 h-16 rounded-full border-4 ${borderColor} flex items-center justify-center
                    ${score.penalties >= i ? activeColor : 'opacity-20'}`}
                >
                  {score.penalties >= i && <span className="text-black font-bold text-xl">P</span>}
                </div>
              ))}
            </div>
          </>
        )}

        {sport === 'karate' && (
          <>
            <div className="flex gap-12 mb-16">
              <div className="flex flex-col items-center">
                <span className="text-[3vmin] font-bold uppercase tracking-wider mb-4 opacity-50">Pontos</span>
                <ScoreNumber value={score.ippon + score.wazaari + score.yuko} />
              </div>
            </div>

            <div className="flex gap-8 items-center">
              {score.senshu && (
                <div className={`px-6 py-2 rounded-full border-4 ${borderColor} ${activeColor} text-black font-black text-2xl uppercase tracking-widest`}>
                  Senshu
                </div>
              )}
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <div 
                    key={i} 
                    className={`w-12 h-12 rounded-full border-4 ${borderColor} flex items-center justify-center
                      ${score.penalties >= i ? activeColor : 'opacity-20'}`}
                  >
                    {score.penalties >= i && <span className="text-black font-bold text-xl">F</span>}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

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
          <div className={`flex-1 transition-colors duration-1000 ${winner === 'blue' ? (sport === 'karate' ? 'bg-red-500/30' : 'bg-blue-500/30') : 'bg-black/50'}`} />
          <div className={`flex-1 transition-colors duration-1000 ${winner === 'white' ? (sport === 'karate' ? 'bg-blue-500/30' : 'bg-white/30') : 'bg-black/50'}`} />
          
          <motion.div 
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', bounce: 0.5 }}
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-[4vw] py-[2vh] rounded-3xl shadow-2xl border-4
              ${winner === 'blue' ? (sport === 'karate' ? 'bg-red-600/95 border-white text-white' : 'bg-blue-600/95 border-white text-white') : (sport === 'karate' ? 'bg-blue-600/95 border-white text-white' : 'bg-white/95 border-black text-black')}`}
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
