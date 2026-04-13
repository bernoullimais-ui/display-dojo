import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Timer as TimerIcon, Upload, Check, Zap, Coffee, RotateCcw, Volume2, Trash2, Lock, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { TimerPreset } from '../types';

interface TimerControlProps {
  localConfig: any;
  handleConfigChange: (newSettings: any) => void;
  handleCommand: (type: string, payload?: any) => void;
  isPro: boolean;
  isStarter: boolean;
  updateConfig: (key: string, value: any) => void;
  activePresets: TimerPreset[];
  showPresetManager: boolean;
  setShowPresetManager: (show: boolean) => void;
  editingPreset: TimerPreset | null;
  setEditingPreset: (preset: TimerPreset | null) => void;
  handleSavePreset: (preset: TimerPreset) => void;
  handleDeletePreset: (id: string) => void;
}

export default function TimerControl({
  localConfig,
  handleConfigChange,
  handleCommand,
  isPro,
  isStarter,
  updateConfig,
  activePresets,
  showPresetManager,
  setShowPresetManager,
  editingPreset,
  setEditingPreset,
  handleSavePreset,
  handleDeletePreset
}: TimerControlProps) {
  const [activeSubTab, setActiveSubTab] = useState<'HIT' | 'ROUNDS' | 'PROGRESSIVE' | 'REGRESSIVE'>('HIT');

  const handleTabChange = (tab: 'HIT' | 'ROUNDS' | 'PROGRESSIVE' | 'REGRESSIVE') => {
    setActiveSubTab(tab);
    updateConfig('mode', tab);
  };

  const currentMode = localConfig.mode || 'HIT';

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
            </div>

            <div className="flex bg-zinc-900 rounded-xl p-1 overflow-x-auto hide-scrollbar">
              <button 
                onClick={() => handleTabChange('HIT')}
                className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${currentMode === 'HIT' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                HIT
              </button>
              <button 
                onClick={() => handleTabChange('ROUNDS')}
                className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${currentMode === 'ROUNDS' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                ROUNDS
              </button>
              <button 
                onClick={() => handleTabChange('PROGRESSIVE')}
                className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${currentMode === 'PROGRESSIVE' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                PROGRESSIVO
              </button>
              <button 
                onClick={() => handleTabChange('REGRESSIVE')}
                className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${currentMode === 'REGRESSIVE' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                REGRESSIVO
              </button>
            </div>

            {(currentMode === 'HIT' || currentMode === 'ROUNDS') && (
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
                  {activePresets.filter(p => p.mode === currentMode || (!p.mode && currentMode === 'ROUNDS')).map(preset => (
                    <motion.button 
                      key={preset.id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleConfigChange({ ...preset.config, name: preset.name, hitCycles: preset.config.hitCycles || [] })}
                      className="bg-zinc-800 hover:bg-zinc-700 py-3 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-colors"
                    >
                      <span>{preset.name}</span>
                      <span className="text-[10px] text-zinc-400 font-normal">
                        {preset.mode === 'HIT' && preset.config.hitCycles && preset.config.hitCycles.length > 0
                          ? `${preset.config.hitCycles.length} ex.`
                          : `${preset.config.workTime >= 60 ? `${Math.floor(preset.config.workTime / 60)}m` : `${preset.config.workTime}s`} / ${preset.config.restTime >= 60 ? `${Math.floor(preset.config.restTime / 60)}m` : `${preset.config.restTime}s`}`
                        }
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 space-y-6">
              <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] text-center">Configurações</h3>
              <div className="space-y-4">
                {(currentMode === 'HIT' || currentMode === 'ROUNDS') && (
                  <>
                    <div className="flex items-center justify-between bg-black/40 p-4 rounded-2xl border border-zinc-800/50">
                      <div className="flex items-center gap-3">
                        <span className="text-zinc-500"><TimerIcon size={16} /></span>
                        <span className="font-medium text-sm">Preparação</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <button onClick={() => updateConfig('prepTime', Math.max(0, (localConfig.prepTime || 0) - 1))} className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold">-</button>
                        <span className="w-8 text-center font-mono font-bold">{localConfig.prepTime || 0}</span>
                        <button onClick={() => updateConfig('prepTime', (localConfig.prepTime || 0) + 1)} className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold">+</button>
                      </div>
                    </div>

                    {currentMode === 'HIT' && localConfig.hitCycles && localConfig.hitCycles.length > 0 ? (
                      <div className="bg-black/40 p-4 rounded-2xl border border-zinc-800/50 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm text-blue-400">Exercícios Variados ({localConfig.hitCycles.length})</span>
                          <button onClick={() => updateConfig('hitCycles', [])} className="text-[10px] bg-zinc-800 px-2 py-1 rounded-lg text-zinc-400 hover:text-white">Limpar</button>
                        </div>
                        <div className="space-y-2">
                          {localConfig.hitCycles.map((cycle: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-xs text-zinc-500">
                              <span>{cycle.name}</span>
                              <span>{cycle.workTime}s / {cycle.restTime}s</span>
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-zinc-500 text-center pt-2 border-t border-zinc-800/50">Edite os ciclos no Gerenciador de Presets.</p>
                      </div>
                    ) : (
                      [
                        { label: 'Trabalho', field: 'workTime', icon: <Zap size={16} className="text-red-500" /> },
                        { label: 'Descanso', field: 'restTime', icon: <Coffee size={16} className="text-green-500" /> },
                        { label: 'Ciclos', field: 'cycles', icon: <RotateCcw size={16} /> },
                      ].map((item) => {
                        const getStep = (field: string) => {
                          if (field === 'cycles') return 1;
                          if (field === 'workTime' || field === 'restTime') return 5;
                          return 1;
                        };
                        const getMin = (field: string) => {
                          if (field === 'workTime' || field === 'restTime') return 5;
                          return 1;
                        };
                        const step = getStep(item.field);
                        const min = getMin(item.field);
                        const currentValue = (localConfig as any)[item.field] || 0;

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
                      })
                    )}
                  </>
                )}

                {(currentMode === 'PROGRESSIVE' || currentMode === 'REGRESSIVE') && [
                  { label: 'Tempo Total (segundos)', field: 'targetTime', icon: currentMode === 'PROGRESSIVE' ? <ArrowUpRight size={16} className="text-blue-500" /> : <ArrowDownRight size={16} className="text-red-500" /> },
                ].map((item) => {
                  const getStep = (field: string) => {
                    if (field === 'targetTime') return 10;
                    return 1;
                  };
                  const getMin = (field: string) => {
                    if (field === 'targetTime') return 10;
                    return 1;
                  };
                  const step = getStep(item.field);
                  const min = getMin(item.field);
                  const currentValue = (localConfig as any)[item.field] || (item.field === 'targetTime' ? 600 : 0);

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
            </div>
          </div>
  );
}
