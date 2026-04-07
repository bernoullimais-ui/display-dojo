import React, { useRef } from 'react';
import { motion } from 'motion/react';
import { Timer as TimerIcon, Upload, Check, XCircle, Zap, Coffee, RotateCcw, Volume2, Trash2 } from 'lucide-react';
import { TimerPreset } from '../types';

interface TimerControlProps {
  localConfig: any;
  handleConfigChange: (newSettings: any) => void;
  handleCommand: (type: string, payload?: any) => void;
  isPro: boolean;
  isStarter: boolean;
  updateConfig: (key: string, value: any) => void;
  updateColor: (field: string, color: string) => void;
  updateLabel: (field: string, label: string) => void;
  removeAudio: (mode: string) => void;
  toggleTTS: (val: boolean) => void;
  activePresets: TimerPreset[];
  showPresetManager: boolean;
  setShowPresetManager: (show: boolean) => void;
  editingPreset: TimerPreset | null;
  setEditingPreset: (preset: TimerPreset | null) => void;
  handleSavePreset: (preset: TimerPreset) => void;
  handleDeletePreset: (id: string) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, mode: 'PREP' | 'WORK' | 'REST') => void;
  isUploading: boolean;
  prepAudioRef: React.RefObject<HTMLInputElement>;
  workAudioRef: React.RefObject<HTMLInputElement>;
  restAudioRef: React.RefObject<HTMLInputElement>;
}

export default function TimerControl({
  localConfig,
  handleConfigChange,
  handleCommand,
  isPro,
  isStarter,
  updateConfig,
  updateColor,
  updateLabel,
  removeAudio,
  toggleTTS,
  activePresets,
  showPresetManager,
  setShowPresetManager,
  editingPreset,
  setEditingPreset,
  handleSavePreset,
  handleDeletePreset,
  handleFileUpload,
  isUploading,
  prepAudioRef,
  workAudioRef,
  restAudioRef
}: TimerControlProps) {
  return (
    <div className="space-y-8">
            <div className="grid grid-cols-1 gap-4">
              <motion.button whileTap={{ scale: 0.95, filter: 'brightness(1.2)' }} onClick={() => handleCommand('START')} className="bg-blue-600 py-6 rounded-3xl text-xl font-black shadow-xl">INICIAR TREINO</motion.button>
              <div className="grid grid-cols-2 gap-4">
                <motion.button whileTap={{ scale: 0.95, filter: 'brightness(1.2)' }} onClick={() => handleCommand('PAUSE')} className="bg-zinc-800 py-4 rounded-2xl font-bold">PAUSAR</motion.button>
                <motion.button whileTap={{ scale: 0.95, filter: 'brightness(1.2)' }} onClick={() => handleCommand('RESET')} className="bg-zinc-900 py-4 rounded-2xl font-bold text-zinc-400">RESET</motion.button>
              </div>
              <motion.button 
                whileTap={{ scale: 0.95, filter: 'brightness(1.2)' }}
                onClick={() => handleCommand('HIDE_TIMER')} 
                className="w-full bg-zinc-800 py-4 rounded-2xl font-bold text-zinc-300 flex items-center justify-center gap-2"
              >
                OMITIR TREINO
              </motion.button>
              <motion.button 
                whileTap={{ scale: 0.95, filter: 'brightness(1.2)' }}
                onClick={() => handleCommand('STOP_MEDIA')} 
                className="w-full bg-red-500/10 border border-red-500/20 py-4 rounded-2xl font-bold text-red-500 flex items-center justify-center gap-2"
              >
                <XCircle size={18} /> PARAR MÍDIA
              </motion.button>
            </div>

            <div className={`bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-6 relative ${!isStarter ? 'opacity-50 pointer-events-none' : ''}`}>
              {!isStarter && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <div className="bg-zinc-900/90 p-3 rounded-2xl flex items-center gap-2 border border-zinc-800">
                    <Lock size={16} className="text-blue-500" />
                    <span className="text-xs font-bold">Recurso STARTER</span>
                  </div>
                </div>
              )}
              <div className="flex justify-between items-center">
                <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">Presets Rápidos</h3>
                <button onClick={() => setShowPresetManager(true)} className="text-[10px] bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full font-bold uppercase tracking-wider hover:bg-zinc-700 transition-colors">Gerenciar</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {activePresets.map(preset => (
                  <motion.button 
                    key={preset.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleConfigChange(preset.config)}
                    className="bg-zinc-800 hover:bg-zinc-700 py-3 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-colors"
                  >
                    <span>{preset.name}</span>
                    <span className="text-[10px] text-zinc-400 font-normal">
                      {preset.config.workTime >= 60 ? `${Math.floor(preset.config.workTime / 60)}m` : `${preset.config.workTime}s`} / {preset.config.restTime >= 60 ? `${Math.floor(preset.config.restTime / 60)}m` : `${preset.config.restTime}s`}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 space-y-6">
              <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] text-center">Configurações</h3>
              <div className="space-y-4">
                {[
                  { label: 'Preparação', field: 'prepTime', icon: <TimerIcon size={16} /> },
                  { label: 'Trabalho', field: 'workTime', icon: <Zap size={16} className="text-red-500" /> },
                  { label: 'Descanso', field: 'restTime', icon: <Coffee size={16} className="text-green-500" /> },
                  { label: 'Ciclos', field: 'cycles', icon: <RotateCcw size={16} /> },
                ].map((item) => {
                  const getStep = (field: string) => {
                    if (field === 'prepTime' || field === 'cycles') return 1;
                    if (field === 'workTime' || field === 'restTime') return 5;
                    return 1;
                  };
                  const getMin = (field: string) => {
                    if (field === 'workTime' || field === 'restTime') return 5;
                    if (field === 'prepTime') return 0;
                    return 1;
                  };
                  const step = getStep(item.field);
                  const min = getMin(item.field);
                  const currentValue = (localConfig as any)[item.field];

                  return (
                    <div key={item.field} className="flex items-center justify-between bg-black/40 p-4 rounded-2xl border border-zinc-800/50">
                      <div className="flex items-center gap-3">
                        <span className="text-zinc-500">{item.icon}</span>
                        <span className="font-medium text-sm">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <button onClick={() => updateConfig(item.field, Math.max(min, currentValue - step))} className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold">-</button>
                        <span className="w-8 text-center font-mono font-bold">{currentValue}</span>
                        <button onClick={() => updateConfig(item.field, currentValue + step)} className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold">+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 space-y-6 relative ${!isStarter ? 'opacity-50 pointer-events-none' : ''}`}>
              {!isStarter && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <div className="bg-zinc-900/90 p-3 rounded-2xl flex items-center gap-2 border border-zinc-800">
                    <Lock size={16} className="text-blue-500" />
                    <span className="text-xs font-bold">Recurso STARTER</span>
                  </div>
                </div>
              )}
              <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] text-center">Nomes e Cores das Fases</h3>
              <div className="space-y-6">
                {[
                  { label: 'Preparação', field: 'prepLabel', colorField: 'prepColor', audioField: 'prepAudioUrl', ref: prepAudioRef, mode: 'PREP' },
                  { label: 'Trabalho', field: 'workLabel', colorField: 'workColor', audioField: 'workAudioUrl', ref: workAudioRef, mode: 'WORK' },
                  { label: 'Descanso', field: 'restLabel', colorField: 'restColor', audioField: 'restAudioUrl', ref: restAudioRef, mode: 'REST' },
                ].map((item) => (
                  <div key={item.field} className="space-y-3 p-4 bg-black/20 rounded-2xl border border-zinc-800/30">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">{item.label}</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="color" 
                          value={(localConfig as any)[item.colorField]}
                          onChange={(e) => updateColor(item.colorField, e.target.value)}
                          className="w-6 h-6 rounded-full bg-transparent border-0 cursor-pointer overflow-hidden p-0"
                        />
                        <span className="text-[10px] font-mono text-zinc-600">{(localConfig as any)[item.colorField]}</span>
                      </div>
                    </div>
                    <input 
                      type="text" 
                      value={(localConfig as any)[item.field]}
                      onChange={(e) => updateLabel(item.field, e.target.value)}
                      className="w-full bg-black/40 border border-zinc-800/50 rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-500/50"
                      placeholder={`Ex: ${item.label}`}
                    />
                    
                    <div className="flex items-center gap-2 pt-1">
                      <button 
                        onClick={() => isPro ? (item.ref.current as any).click() : alert('Upload de áudio disponível a partir do plano PRÓ.')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-bold uppercase tracking-tighter transition-all ${
                          (localConfig as any)[item.audioField] 
                            ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                            : 'bg-zinc-800/50 text-zinc-400 border border-zinc-800/50 hover:bg-zinc-800'
                        }`}
                      >
                        {!isPro ? <Lock size={12} className="text-zinc-500" /> : <Volume2 size={12} />}
                        {(localConfig as any)[item.audioField] ? 'Áudio Personalizado' : 'Subir Áudio'}
                      </button>
                      {(localConfig as any)[item.audioField] && (
                        <button 
                          onClick={() => removeAudio(item.audioField)}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      <input 
                        type="file" 
                        ref={item.ref as any} 
                        onChange={(e) => handleFileUpload(e, item.mode as any)} 
                        className="hidden" 
                        accept="audio/*" 
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-zinc-800/50">
                <div className="flex items-center justify-between p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-xl text-blue-500">
                      <Volume2 size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold">Voz do Treinador (TTS)</p>
                      <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Lê o nome das fases (Sujeito a cota da API)</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => toggleTTS(!localConfig.useTTS)}
                    className={`w-12 h-6 rounded-full transition-all relative ${localConfig.useTTS ? 'bg-blue-600' : 'bg-zinc-800'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${localConfig.useTTS ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
  );
}
