import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, Timer as TimerIcon, Zap, Coffee, Trophy } from 'lucide-react';

type Phase = 'PREP' | 'WORK' | 'REST' | 'RUNNING' | 'FINISHED';

interface TabataConfig {
  name?: string;
  mode?: 'HIT' | 'ROUNDS' | 'PROGRESSIVE' | 'REGRESSIVE';
  targetTime?: number;
  prepTime: number;
  workTime: number;
  restTime: number;
  cycles: number;
  prepLabel?: string;
  workLabel?: string;
  restLabel?: string;
  prepColor?: string;
  workColor?: string;
  restColor?: string;
  prepAudioUrl?: string;
  workAudioUrl?: string;
  restAudioUrl?: string;
  finishedAudioUrl?: string;
}

interface TabataTimerProps {
  externalCommand?: { type: string; payload?: any } | null;
  isMuted?: boolean;
  volume?: number;
  initialConfig?: TabataConfig;
  isFreePlan?: boolean;
  globalSponsors?: {
    url?: string;
    type?: 'image' | 'video';
  }[];
  globalSponsorInterval?: number;
}

const DEFAULT_CONFIG: TabataConfig = {
  prepTime: 10,
  workTime: 20,
  restTime: 10,
  cycles: 8,
};

export default function TabataTimer({ externalCommand, isMuted = true, volume = 50, initialConfig, isFreePlan, globalSponsors = [], globalSponsorInterval = 15 }: TabataTimerProps) {
  const [config, setConfig] = useState<TabataConfig>(() => {
    const merged = { ...DEFAULT_CONFIG, ...(initialConfig || {}) };
    return {
      ...merged,
      prepTime: Math.max(0, merged.prepTime),
      workTime: Math.max(1, merged.workTime),
      restTime: Math.max(1, merged.restTime),
      cycles: Math.max(1, merged.cycles)
    };
  });
  const [phase, setPhase] = useState<Phase>(() => {
    const mode = initialConfig?.mode || 'HIT';
    if (mode === 'PROGRESSIVE' || mode === 'REGRESSIVE') return 'RUNNING';
    return 'PREP';
  });
  const [currentCycle, setCurrentCycle] = useState(1);
  const [timeLeft, setTimeLeft] = useState(() => {
    const mode = initialConfig?.mode || 'HIT';
    if (mode === 'PROGRESSIVE') return 0;
    if (mode === 'REGRESSIVE') return initialConfig?.targetTime || 600;
    return Math.max(0, initialConfig?.prepTime ?? DEFAULT_CONFIG.prepTime);
  });
  const [isActive, setIsActive] = useState(false);
  const [sponsorIndex, setSponsorIndex] = useState(0);

  useEffect(() => {
    if (initialConfig) {
      setConfig(prev => {
        const merged = { ...DEFAULT_CONFIG, ...initialConfig };
        return {
          ...merged,
          prepTime: Math.max(0, merged.prepTime),
          workTime: Math.max(1, merged.workTime),
          restTime: Math.max(1, merged.restTime),
          cycles: Math.max(1, merged.cycles)
        };
      });
      
      if (!isActive) {
        if (initialConfig.mode === 'PROGRESSIVE') {
          setPhase('RUNNING');
          setTimeLeft(0);
        } else if (initialConfig.mode === 'REGRESSIVE') {
          setPhase('RUNNING');
          setTimeLeft(initialConfig.targetTime || 600);
        } else if (phase === 'PREP' || phase === 'RUNNING') {
          setPhase('PREP');
          setTimeLeft(Math.max(0, initialConfig.prepTime ?? DEFAULT_CONFIG.prepTime));
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConfig]);

  useEffect(() => {
    if (!isFreePlan || globalSponsors.length <= 1) return;
    
    const safeInterval = Math.max(1, globalSponsorInterval || 15);
    const interval = setInterval(() => {
      setSponsorIndex(prev => (prev + 1) % globalSponsors.length);
    }, safeInterval * 1000);
    
    return () => clearInterval(interval);
  }, [isFreePlan, globalSponsors.length, globalSponsorInterval]);

  const currentSponsor = globalSponsors.length > 0 ? globalSponsors[sponsorIndex % globalSponsors.length] : undefined;

  // Removed redundant useEffect for initialConfig
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize Audio Context on first interaction to comply with browser policies
  useEffect(() => {
    const initAudio = () => {
      try {
        if (!audioContextRef.current) {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            audioContextRef.current = new AudioCtx();
          }
        }
      } catch (e) {
        console.warn('AudioContext not supported or failed to initialize', e);
      }
    };
    window.addEventListener('click', initAudio, { once: true });
    window.addEventListener('touchstart', initAudio, { once: true });
    return () => {
      window.removeEventListener('click', initAudio);
      window.removeEventListener('touchstart', initAudio);
    };
  }, []);

  const playSound = useCallback((frequency: number, duration: number, type: OscillatorType = 'sine') => {
    if (isMuted) return;
    
    // Check if we should play custom audio instead of beep
    // This function is called for countdowns too, but we only want to replace the phase start beep
    // So we'll handle phase start audio separately in the timer effect
    
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
      
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      
      gain.gain.setValueAtTime(volume / 100, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.error('Audio error:', e);
    }
  }, [isMuted, volume]);

  // Handle external commands from remote control
  useEffect(() => {
    if (!externalCommand) return;

    switch (externalCommand.type) {
      case 'START':
        if (!isActive && phase === 'PREP' && timeLeft === config.prepTime && config.prepTime > 0) {
          playPhaseAudio('PREP');
        }
        setIsActive(true);
        break;
      case 'PAUSE':
        setIsActive(false);
        break;
      case 'RESET':
        setIsActive(false);
        setCurrentCycle(1);
        if (config.mode === 'PROGRESSIVE') {
          setPhase('RUNNING');
          setTimeLeft(0);
        } else if (config.mode === 'REGRESSIVE') {
          setPhase('RUNNING');
          setTimeLeft(config.targetTime || 600);
        } else {
          setPhase('PREP');
          setTimeLeft(Math.max(0, config.prepTime));
        }
        break;
      case 'CONFIG_UPDATE':
        if (externalCommand.payload) {
          const newConfig = externalCommand.payload as TabataConfig;
          setConfig(newConfig);
          if (!isActive) {
            if (newConfig.mode === 'PROGRESSIVE') {
              setPhase('RUNNING');
              setTimeLeft(0);
            } else if (newConfig.mode === 'REGRESSIVE') {
              setPhase('RUNNING');
              setTimeLeft(newConfig.targetTime || 600);
            } else if (phase === 'PREP' || phase === 'RUNNING') {
              setPhase('PREP');
              setTimeLeft(Math.max(0, newConfig.prepTime));
            }
          }
        }
        break;
    }
  }, [externalCommand, config, isActive, phase]);

  const nextPhase = useCallback(() => {
    const mode = config.mode || 'HIT';
    const hitCycles = config.hitCycles || [];
    const useHitCycles = mode === 'HIT' && hitCycles.length > 0;
    
    if (mode === 'PROGRESSIVE' || mode === 'REGRESSIVE') {
      if (phase === 'PREP') {
        setPhase('RUNNING');
        setTimeLeft(mode === 'PROGRESSIVE' ? 0 : (config.targetTime || 600));
      } else if (phase === 'RUNNING') {
        setPhase('FINISHED');
        setIsActive(false);
      }
    } else {
      if (phase === 'PREP') {
        setPhase('WORK');
        setTimeLeft(useHitCycles ? (hitCycles[0]?.workTime || config.workTime) : config.workTime);
      } else if (phase === 'WORK') {
        setPhase('REST');
        setTimeLeft(useHitCycles ? (hitCycles[currentCycle - 1]?.restTime || config.restTime) : config.restTime);
      } else if (phase === 'REST') {
        const totalCycles = useHitCycles ? hitCycles.length : config.cycles;
        if (currentCycle < totalCycles) {
          const nextCycleIndex = currentCycle; // 0-indexed for array would be currentCycle
          setCurrentCycle(prev => prev + 1);
          setPhase('WORK');
          setTimeLeft(useHitCycles ? (hitCycles[nextCycleIndex]?.workTime || config.workTime) : config.workTime);
        } else {
          setPhase('FINISHED');
          setIsActive(false);
        }
      }
    }
  }, [phase, currentCycle, config]);

  const playPhaseAudio = useCallback((targetPhase: Phase) => {
    if (isMuted) return;

    let audioUrl = '';
    let label = '';
    const mode = config.mode || 'HIT';
    const hitCycles = config.hitCycles || [];
    const useHitCycles = mode === 'HIT' && hitCycles.length > 0;

    const c = config as any;
    if (targetPhase === 'PREP') {
      audioUrl = config.prepAudioUrl || c.prepAudio || '';
      label = config.prepLabel || 'PREPARAÇÃO';
    } else if (targetPhase === 'WORK') {
      audioUrl = config.workAudioUrl || c.workAudio || '';
      let cycleIndex = currentCycle - 1;
      if (phase === 'PREP') cycleIndex = 0;
      else if (phase === 'REST') cycleIndex = currentCycle;
      
      label = useHitCycles ? (hitCycles[cycleIndex]?.name || config.workLabel || 'TRABALHO') : (config.workLabel || 'TRABALHO');
    } else if (targetPhase === 'REST') {
      audioUrl = config.restAudioUrl || c.restAudio || '';
      label = config.restLabel || 'DESCANSO';
    } else if (targetPhase === 'RUNNING') {
      label = mode === 'PROGRESSIVE' ? 'PROGRESSIVO' : 'REGRESSIVO';
    } else if (targetPhase === 'FINISHED') {
      audioUrl = config.finishedAudioUrl || c.finishedAudio || '';
      label = 'TREINO CONCLUÍDO';
    }

    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.volume = volume / 100;
      audio.play().catch(e => console.error('Error playing custom audio:', e));
    } else {
      // Fallback to beep
      if (targetPhase === 'FINISHED') {
        playSound(880, 1.5, 'square');
      } else {
        playSound(880, 0.5);
      }
    }
  }, [isMuted, volume, config, playSound, currentCycle, phase]);

  useEffect(() => {
    const mode = config.mode || 'HIT';
    const hitCycles = config.hitCycles || [];
    const useHitCycles = mode === 'HIT' && hitCycles.length > 0;
    const totalCycles = useHitCycles ? hitCycles.length : config.cycles;

    if (isActive) {
      if (phase === 'PREP' || mode === 'REGRESSIVE' || mode === 'HIT' || mode === 'ROUNDS') {
        if (timeLeft > 0) {
          if (timeLeft <= 3) {
            playSound(440, 0.1);
          }
          timerRef.current = setInterval(() => {
            setTimeLeft(prev => prev - 1);
          }, 1000);
        } else if (timeLeft === 0) {
          let nextP: Phase = 'FINISHED';
          if (mode === 'PROGRESSIVE' || mode === 'REGRESSIVE') {
            if (phase === 'PREP') nextP = 'RUNNING';
            else nextP = 'FINISHED';
          } else {
            if (phase === 'PREP') nextP = 'WORK';
            else if (phase === 'WORK') nextP = 'REST';
            else if (phase === 'REST') {
              if (currentCycle < totalCycles) nextP = 'WORK';
              else nextP = 'FINISHED';
            }
          }
          playPhaseAudio(nextP);
          nextPhase();
        }
      } else if (mode === 'PROGRESSIVE' && phase === 'RUNNING') {
        const target = config.targetTime || 600;
        if (timeLeft < target) {
          timerRef.current = setInterval(() => {
            setTimeLeft(prev => prev + 1);
          }, 1000);
        } else if (timeLeft >= target) {
          playPhaseAudio('FINISHED');
          nextPhase();
        }
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timeLeft, nextPhase, phase, currentCycle, config, playPhaseAudio, playSound]);

  const toggleTimer = () => setIsActive(!isActive);
  
  const resetTimer = () => {
    setIsActive(false);
    setCurrentCycle(1);
    if (config.mode === 'PROGRESSIVE') {
      setPhase('RUNNING');
      setTimeLeft(0);
    } else if (config.mode === 'REGRESSIVE') {
      setPhase('RUNNING');
      setTimeLeft(config.targetTime || 600);
    } else {
      setPhase('PREP');
      setTimeLeft(Math.max(0, config.prepTime));
    }
  };

  const getPhaseColor = () => {
    switch (phase) {
      case 'PREP': return config.prepColor || '#f59e0b'; // amber-500
      case 'WORK': return config.workColor || '#ef4444'; // red-500
      case 'REST': return config.restColor || '#22c55e'; // green-500
      case 'RUNNING': return config.workColor || '#ef4444'; // red-500
      case 'FINISHED': return '#3b82f6'; // blue-500
      default: return '#ffffff';
    }
  };

  const getPhaseLabel = () => {
    const mode = config.mode || 'HIT';
    const hitCycles = config.hitCycles || [];
    const useHitCycles = mode === 'HIT' && hitCycles.length > 0;

    switch (phase) {
      case 'PREP': return config.prepLabel || 'PREPARAÇÃO';
      case 'WORK': return useHitCycles ? (hitCycles[currentCycle - 1]?.name || config.workLabel || 'TRABALHO') : (config.workLabel || 'TRABALHO');
      case 'REST': return config.restLabel || 'DESCANSO';
      case 'RUNNING': return mode === 'PROGRESSIVE' ? 'PROGRESSIVO' : 'REGRESSIVO';
      case 'FINISHED': return 'TREINO CONCLUÍDO';
      default: return '';
    }
  };

  const getPhaseIcon = () => {
    switch (phase) {
      case 'PREP': return <TimerIcon size={48} />;
      case 'WORK': return <Zap size={48} />;
      case 'REST': return <Coffee size={48} />;
      case 'RUNNING': return <TimerIcon size={48} />;
      case 'FINISHED': return <Trophy size={48} />;
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const mode = config.mode || 'HIT';
  const hitCycles = config.hitCycles || [];
  const useHitCycles = mode === 'HIT' && hitCycles.length > 0;
  const totalCycles = useHitCycles ? hitCycles.length : config.cycles;

  return (
    <div className="w-full h-full flex relative">
      {/* Left Sponsor */}
      {isFreePlan && currentSponsor?.url && (
        <div className="w-[15vw] h-full bg-black border-r border-zinc-800 flex items-center justify-center overflow-hidden z-20 shrink-0">
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

      {/* Main Timer Area */}
      <div className="flex-1 flex flex-col items-center justify-center h-full space-y-[8vh] z-10">
        {/* Phase Indicator */}
        <div className="text-center space-y-[2vh]">
          <motion.div
            key={phase}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{ color: getPhaseColor() }}
            className="flex items-center justify-center gap-[2vw] text-[6vmin] font-black tracking-widest"
          >
            {getPhaseIcon()}
            <span>{getPhaseLabel()}</span>
          </motion.div>

          {config.name && config.mode !== 'PROGRESSIVE' && config.mode !== 'REGRESSIVE' && (
            <div className="text-zinc-500 text-[4vmin] font-medium uppercase tracking-widest">
              ({config.name})
            </div>
          )}
          
          {(!config.mode || config.mode === 'HIT' || config.mode === 'ROUNDS') && (
            <div className="text-zinc-500 text-[4vmin] font-medium">
              CICLO {currentCycle} / {totalCycles}
            </div>
          )}

          {/* Quick Info */}
          {(!config.mode || config.mode === 'HIT' || config.mode === 'ROUNDS') && (
            <div className="flex justify-center gap-[4vw] text-zinc-500 text-[2.5vmin] font-medium pt-[3vh]">
              <div className="flex items-center gap-2">
                <div className="text-zinc-600">PREP</div>
                <div>{formatTime(config.prepTime)}</div>
              </div>
              <div className="text-zinc-700">•</div>
              <div className="flex items-center gap-2">
                <div className="text-zinc-600">WORK</div>
                <div>{formatTime(config.workTime)}</div>
              </div>
              <div className="text-zinc-700">•</div>
              <div className="flex items-center gap-2">
                <div className="text-zinc-600">REST</div>
                <div>{formatTime(config.restTime)}</div>
              </div>
            </div>
          )}
        </div>

        {/* Main Timer Display */}
        <div className="relative flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={timeLeft}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ color: getPhaseColor() }}
              className="text-[35vmin] font-mono font-black leading-none tabular-nums px-[4vw] py-[2vh]"
            >
              {formatTime(timeLeft)}
            </motion.div>
          </AnimatePresence>
          
          {/* Progress Ring (Visual only for now) */}
          <div className="absolute inset-0 border-[10px] border-zinc-900 rounded-[10rem] opacity-20 pointer-events-none" />
        </div>
      </div>

      {/* Right Sponsor */}
      {isFreePlan && currentSponsor?.url && (
        <div className="w-[15vw] h-full bg-black border-l border-zinc-800 flex items-center justify-center overflow-hidden z-20 shrink-0">
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
    </div>
  );
}
