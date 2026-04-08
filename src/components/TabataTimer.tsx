import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, RotateCcw, Timer as TimerIcon, Zap, Coffee, Trophy } from 'lucide-react';
import { GoogleGenAI, Modality } from "@google/genai";

type Phase = 'PREP' | 'WORK' | 'REST' | 'FINISHED';

interface TabataConfig {
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
  useTTS?: boolean;
  prepAudioUrl?: string;
  workAudioUrl?: string;
  restAudioUrl?: string;
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
      prepTime: Math.max(1, merged.prepTime),
      workTime: Math.max(1, merged.workTime),
      restTime: Math.max(1, merged.restTime),
      cycles: Math.max(1, merged.cycles)
    };
  });
  const [phase, setPhase] = useState<Phase>('PREP');
  const [currentCycle, setCurrentCycle] = useState(1);
  const [timeLeft, setTimeLeft] = useState(config.prepTime);
  const [isActive, setIsActive] = useState(false);
  const [ttsAudios, setTtsAudios] = useState<Record<string, string>>({});
  const [ttsFailed, setTtsFailed] = useState<Record<string, boolean>>({});
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

  // Helper to add WAV header to raw PCM data
  const createWavUrl = useCallback((pcmData: Uint8Array, sampleRate: number) => {
    const header = new ArrayBuffer(44);
    const view = new DataView(header);

    // RIFF identifier
    view.setUint32(0, 0x52494646, false); // "RIFF"
    // file length
    view.setUint32(4, 36 + pcmData.length, true);
    // RIFF type
    view.setUint32(8, 0x57415645, false); // "WAVE"
    // format chunk identifier
    view.setUint32(12, 0x666d7420, false); // "fmt "
    // format chunk length
    view.setUint16(16, 16, true);
    // sample format (PCM = 1)
    view.setUint16(20, 1, true);
    // channel count (Mono = 1)
    view.setUint16(22, 1, true);
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate (sample rate * block align)
    view.setUint32(28, sampleRate * 2, true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, 2, true);
    // bits per sample
    view.setUint16(34, 16, true);
    // data chunk identifier
    view.setUint32(36, 0x64617461, false); // "data"
    // data chunk length
    view.setUint32(40, pcmData.length, true);

    const blob = new Blob([header, pcmData], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  }, []);

  // Generate TTS audio for labels with retry logic
  const generateTTS = useCallback(async (text: string, retryCount = 0) => {
    if (!text || ttsAudios[text] || ttsFailed[text]) return;

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Diga com voz firme de treinador: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const part = response.candidates?.[0]?.content?.parts?.[0];
      const base64Audio = part?.inlineData?.data;
      const mimeType = part?.inlineData?.mimeType;

      if (base64Audio) {
        const binary = atob(base64Audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        
        let url = '';
        if (mimeType && mimeType !== 'audio/pcm' && mimeType !== 'audio/l16') {
          const blob = new Blob([bytes], { type: mimeType });
          url = URL.createObjectURL(blob);
        } else {
          url = createWavUrl(bytes, 24000);
        }
        
        setTtsAudios(prev => ({ ...prev, [text]: url }));
      }
    } catch (error: any) {
      console.error(`Error generating TTS for "${text}":`, error);
      
      // Handle quota error (429)
      if (error?.message?.includes('429') || error?.status === 'RESOURCE_EXHAUSTED') {
        if (retryCount < 2) {
          // Wait 2 seconds before retrying
          setTimeout(() => generateTTS(text, retryCount + 1), 2000);
        } else {
          setTtsFailed(prev => ({ ...prev, [text]: true }));
        }
      } else {
        setTtsFailed(prev => ({ ...prev, [text]: true }));
      }
    }
  }, [ttsAudios, ttsFailed, createWavUrl]);

  useEffect(() => {
    if (config.useTTS) {
      if (config.prepLabel) generateTTS(config.prepLabel);
      if (config.workLabel) generateTTS(config.workLabel);
      if (config.restLabel) generateTTS(config.restLabel);
      generateTTS('TREINO CONCLUÍDO');
    }
  }, [config.useTTS, config.prepLabel, config.workLabel, config.restLabel, generateTTS]);

  // Update config when initialConfig changes
  useEffect(() => {
    if (initialConfig) {
      const newConfig = { 
        ...DEFAULT_CONFIG, 
        ...initialConfig,
        prepTime: Math.max(1, initialConfig.prepTime || DEFAULT_CONFIG.prepTime),
        workTime: Math.max(1, initialConfig.workTime || DEFAULT_CONFIG.workTime),
        restTime: Math.max(1, initialConfig.restTime || DEFAULT_CONFIG.restTime),
        cycles: Math.max(1, initialConfig.cycles || DEFAULT_CONFIG.cycles)
      };
      setConfig(newConfig);
      if (!isActive && phase === 'PREP') {
        setTimeLeft(newConfig.prepTime);
      }
    }
  }, [initialConfig, isActive, phase]);
  
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
    
    // Check if we should play custom audio or TTS instead of beep
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
        setIsActive(true);
        break;
      case 'PAUSE':
        setIsActive(false);
        break;
      case 'RESET':
        setIsActive(false);
        setPhase('PREP');
        setCurrentCycle(1);
        setTimeLeft(config.prepTime);
        break;
      case 'CONFIG_UPDATE':
        if (externalCommand.payload) {
          const newConfig = externalCommand.payload as TabataConfig;
          setConfig(newConfig);
          // If the timer is not active and in PREP phase, update the time left immediately
          if (!isActive && phase === 'PREP') {
            setTimeLeft(newConfig.prepTime);
          }
        }
        break;
    }
  }, [externalCommand, config, isActive, phase]);

  const nextPhase = useCallback(() => {
    if (phase === 'PREP') {
      setPhase('WORK');
      setTimeLeft(config.workTime);
    } else if (phase === 'WORK') {
      setPhase('REST');
      setTimeLeft(config.restTime);
    } else if (phase === 'REST') {
      if (currentCycle < config.cycles) {
        setCurrentCycle(prev => prev + 1);
        setPhase('WORK');
        setTimeLeft(config.workTime);
      } else {
        setPhase('FINISHED');
        setIsActive(false);
      }
    }
  }, [phase, currentCycle, config]);

  const playPhaseAudio = useCallback((targetPhase: Phase) => {
    if (isMuted) return;

    let audioUrl = '';
    let label = '';

    if (targetPhase === 'PREP') {
      audioUrl = config.prepAudioUrl || '';
      label = config.prepLabel || 'PREPARAÇÃO';
    } else if (targetPhase === 'WORK') {
      audioUrl = config.workAudioUrl || '';
      label = config.workLabel || 'TRABALHO';
    } else if (targetPhase === 'REST') {
      audioUrl = config.restAudioUrl || '';
      label = config.restLabel || 'DESCANSO';
    } else if (targetPhase === 'FINISHED') {
      label = 'TREINO CONCLUÍDO';
    }

    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.volume = volume / 100;
      audio.play().catch(e => console.error('Error playing custom audio:', e));
    } else if (config.useTTS && ttsAudios[label]) {
      const audio = new Audio(ttsAudios[label]);
      audio.volume = volume / 100;
      audio.play().catch(e => console.error('Error playing TTS audio:', e));
    } else {
      // Fallback to beep
      if (targetPhase === 'FINISHED') {
        playSound(880, 1.5, 'square');
      } else {
        playSound(880, 0.5);
      }
    }
  }, [isMuted, volume, config, ttsAudios, playSound]);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      // Play countdown bips
      if (timeLeft <= 3) {
        playSound(440, 0.1);
      }
      
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      // Determine next phase to play correct audio
      let nextP: Phase = 'FINISHED';
      if (phase === 'PREP') nextP = 'WORK';
      else if (phase === 'WORK') nextP = 'REST';
      else if (phase === 'REST') {
        if (currentCycle < config.cycles) nextP = 'WORK';
        else nextP = 'FINISHED';
      }
      
      playPhaseAudio(nextP);
      nextPhase();
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timeLeft, nextPhase, phase, currentCycle, config.cycles, playPhaseAudio, playSound]);

  const toggleTimer = () => setIsActive(!isActive);
  
  const resetTimer = () => {
    setIsActive(false);
    setPhase('PREP');
    setCurrentCycle(1);
    setTimeLeft(config.prepTime);
  };

  const getPhaseColor = () => {
    switch (phase) {
      case 'PREP': return config.prepColor || '#f59e0b'; // amber-500
      case 'WORK': return config.workColor || '#ef4444'; // red-500
      case 'REST': return config.restColor || '#22c55e'; // green-500
      case 'FINISHED': return '#3b82f6'; // blue-500
      default: return '#ffffff';
    }
  };

  const getPhaseLabel = () => {
    switch (phase) {
      case 'PREP': return config.prepLabel || 'PREPARAÇÃO';
      case 'WORK': return config.workLabel || 'TRABALHO';
      case 'REST': return config.restLabel || 'DESCANSO';
      case 'FINISHED': return 'TREINO CONCLUÍDO';
      default: return '';
    }
  };

  const getPhaseIcon = () => {
    switch (phase) {
      case 'PREP': return <TimerIcon size={48} />;
      case 'WORK': return <Zap size={48} />;
      case 'REST': return <Coffee size={48} />;
      case 'FINISHED': return <Trophy size={48} />;
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

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
          
          <div className="text-zinc-500 text-[4vmin] font-medium">
            CICLO {currentCycle} / {config.cycles}
          </div>

          {/* Quick Info */}
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
