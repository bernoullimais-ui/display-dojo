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
}

const DEFAULT_CONFIG: TabataConfig = {
  prepTime: 10,
  workTime: 20,
  restTime: 10,
  cycles: 8,
};

export default function TabataTimer({ externalCommand, isMuted = true, volume = 50, initialConfig }: TabataTimerProps) {
  const [config, setConfig] = useState<TabataConfig>(initialConfig || DEFAULT_CONFIG);
  const [phase, setPhase] = useState<Phase>('PREP');
  const [currentCycle, setCurrentCycle] = useState(1);
  const [timeLeft, setTimeLeft] = useState((initialConfig || DEFAULT_CONFIG).prepTime);
  const [isActive, setIsActive] = useState(false);
  const [ttsAudios, setTtsAudios] = useState<Record<string, string>>({});
  const [ttsFailed, setTtsFailed] = useState<Record<string, boolean>>({});

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
      setConfig(initialConfig);
      if (!isActive && phase === 'PREP') {
        setTimeLeft(initialConfig.prepTime);
      }
    }
  }, [initialConfig, isActive, phase]);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const playSound = useCallback((frequency: number, duration: number, type: OscillatorType = 'sine') => {
    if (isMuted) return;
    
    // Check if we should play custom audio or TTS instead of beep
    // This function is called for countdowns too, but we only want to replace the phase start beep
    // So we'll handle phase start audio separately in the timer effect
    
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
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

  return (
    <div className="flex flex-col items-center justify-center w-full h-full space-y-12">
      {/* Phase Indicator */}
      <div className="text-center space-y-4">
        <motion.div
          key={phase}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{ color: getPhaseColor() }}
          className="flex items-center justify-center gap-4 text-4xl font-black tracking-widest"
        >
          {getPhaseIcon()}
          <span>{getPhaseLabel()}</span>
        </motion.div>
        
        <div className="text-zinc-500 text-2xl font-medium">
          CICLO {currentCycle} / {config.cycles}
        </div>

        {/* Quick Info */}
        <div className="flex justify-center gap-8 text-zinc-500 text-lg font-medium pt-4">
          <div className="flex items-center gap-2">
            <div className="text-zinc-600 text-sm">PREP</div>
            <div>{config.prepTime}s</div>
          </div>
          <div className="text-zinc-700">•</div>
          <div className="flex items-center gap-2">
            <div className="text-zinc-600 text-sm">WORK</div>
            <div>{config.workTime}s</div>
          </div>
          <div className="text-zinc-700">•</div>
          <div className="flex items-center gap-2">
            <div className="text-zinc-600 text-sm">REST</div>
            <div>{config.restTime}s</div>
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
            className="text-[24rem] font-mono font-black leading-none tabular-nums"
          >
            {timeLeft}
          </motion.div>
        </AnimatePresence>
        
        {/* Progress Ring (Visual only for now) */}
        <div className="absolute inset-0 -m-20 border-[20px] border-zinc-900 rounded-full opacity-20" />
      </div>

      {/* Controls (For testing on TV, usually controlled via Smartphone) */}
      <div className="flex items-center gap-12 pt-8">
        <button
          onClick={resetTimer}
          className="p-6 rounded-full bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
        >
          <RotateCcw size={48} />
        </button>
        
        <button
          onClick={toggleTimer}
          className={`p-10 rounded-full transition-all transform hover:scale-110 active:scale-95 shadow-2xl ${
            isActive 
              ? 'bg-zinc-800 text-white' 
              : 'bg-blue-600 text-white hover:bg-blue-500'
          }`}
        >
          {isActive ? <Pause size={80} fill="currentColor" /> : <Play size={80} fill="currentColor" className="ml-2" />}
        </button>

        <div className="w-[96px]" /> {/* Spacer to balance reset button */}
      </div>
    </div>
  );
}
