import React from 'react';
import { motion } from 'motion/react';
import { Lock, Timer as TimerIcon } from 'lucide-react';

interface ScoreboardControlProps {
  isPro: boolean;
  scoreboardConfig: {
    blueName: string;
    whiteName: string;
    category: string;
    sport: 'judo' | 'jiujitsu' | 'karate';
  };
  updateScoreboardConfig: (field: 'blueName' | 'whiteName' | 'category' | 'sport', value: string) => void;
  handleCommand: (type: string, payload?: any) => void;
}

export default function ScoreboardControl({
  isPro,
  scoreboardConfig,
  updateScoreboardConfig,
  handleCommand
}: ScoreboardControlProps) {
  const sport = scoreboardConfig.sport || 'judo';

  return (
    <div className="space-y-6">
            <div className="flex bg-zinc-900 rounded-2xl p-1 border border-zinc-800">
              <button 
                onClick={() => updateScoreboardConfig('sport', 'judo')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors ${sport === 'judo' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                JUDÔ
              </button>
              <button 
                onClick={() => updateScoreboardConfig('sport', 'jiujitsu')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors ${sport === 'jiujitsu' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                JIU-JITSU
              </button>
              <button 
                onClick={() => updateScoreboardConfig('sport', 'karate')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors ${sport === 'karate' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                KARATÊ
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleCommand('SHOW_SCOREBOARD')} className="bg-blue-600 py-4 rounded-2xl font-bold">MOSTRAR PLACAR</motion.button>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleCommand('HIDE_SCOREBOARD')} className="bg-zinc-800 py-4 rounded-2xl font-bold text-zinc-400">OCULTAR PLACAR</motion.button>
            </div>

            <div className={`bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-6 relative ${!isPro ? 'opacity-50 pointer-events-none' : ''}`}>
              {!isPro && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <div className="bg-zinc-900/90 p-3 rounded-2xl flex items-center gap-2 border border-zinc-800">
                    <Lock size={16} className="text-blue-500" />
                    <span className="text-xs font-bold">Recurso PRÓ</span>
                  </div>
                </div>
              )}
              <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] text-center">Configuração da Luta</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-500 font-bold uppercase mb-1 block">Categoria / Peso</label>
                  <input 
                    type="text" 
                    placeholder="Ex: -73kg Sênior" 
                    className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm focus:border-blue-500 outline-none transition-colors"
                    value={scoreboardConfig.category}
                    onChange={(e) => updateScoreboardConfig('category', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`text-xs font-bold uppercase mb-1 block ${sport === 'karate' ? 'text-red-500' : 'text-blue-400'}`}>
                      {sport === 'karate' ? 'Atleta Vermelho' : 'Atleta Azul'}
                    </label>
                    <input 
                      type="text" 
                      placeholder="Nome (Equipe)" 
                      className={`w-full border rounded-xl p-3 text-sm outline-none transition-colors ${sport === 'karate' ? 'bg-red-950/30 border-red-900/50 focus:border-red-500' : 'bg-blue-950/30 border-blue-900/50 focus:border-blue-500'}`}
                      value={scoreboardConfig.blueName}
                      onChange={(e) => updateScoreboardConfig('blueName', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={`text-xs font-bold uppercase mb-1 block ${sport === 'karate' ? 'text-blue-400' : 'text-zinc-300'}`}>
                      {sport === 'karate' ? 'Atleta Azul' : 'Atleta Branco'}
                    </label>
                    <input 
                      type="text" 
                      placeholder="Nome (Equipe)" 
                      className={`w-full border rounded-xl p-3 text-sm outline-none transition-colors ${sport === 'karate' ? 'bg-blue-950/30 border-blue-900/50 focus:border-blue-500' : 'bg-zinc-800/30 border-zinc-700/50 focus:border-zinc-400'}`}
                      value={scoreboardConfig.whiteName}
                      onChange={(e) => updateScoreboardConfig('whiteName', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-6">
              <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] text-center">Controle de Luta</h3>
              
              <div className="flex items-center gap-4 bg-black/40 p-4 rounded-2xl border border-zinc-800/50">
                <span className="text-zinc-500"><TimerIcon size={16} /></span>
                <span className="font-medium text-sm flex-1">Tempo (min)</span>
                <div className="flex items-center gap-2">
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleCommand('SCOREBOARD_SET_MATCH_TIME', 60)} className="w-10 h-8 rounded-lg bg-zinc-800 flex items-center justify-center font-bold text-xs">1m</motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleCommand('SCOREBOARD_SET_MATCH_TIME', 120)} className="w-10 h-8 rounded-lg bg-zinc-800 flex items-center justify-center font-bold text-xs">2m</motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleCommand('SCOREBOARD_SET_MATCH_TIME', 180)} className="w-10 h-8 rounded-lg bg-zinc-800 flex items-center justify-center font-bold text-xs">3m</motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleCommand('SCOREBOARD_SET_MATCH_TIME', 240)} className="w-10 h-8 rounded-lg bg-zinc-800 flex items-center justify-center font-bold text-xs">4m</motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleCommand('SCOREBOARD_SET_MATCH_TIME', 300)} className="w-10 h-8 rounded-lg bg-zinc-800 flex items-center justify-center font-bold text-xs">5m</motion.button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_START_MATCH')} className="bg-green-600 py-3 rounded-xl font-bold text-xs">HAJIME</motion.button>
                <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_PAUSE_MATCH')} className="bg-yellow-600 py-3 rounded-xl font-bold text-xs">MATTE</motion.button>
                <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_RESET_MATCH')} className="bg-red-600 py-3 rounded-xl font-bold text-xs">RESET</motion.button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Player 1 (Blue/Red) */}
              <div className={`${sport === 'karate' ? 'bg-red-900/30 border-red-500/30' : 'bg-blue-900/30 border-blue-500/30'} border p-4 rounded-3xl space-y-4`}>
                <h4 className={`text-center font-black uppercase tracking-widest ${sport === 'karate' ? 'text-red-400' : 'text-blue-400'}`}>
                  {sport === 'karate' ? 'Vermelho' : 'Azul'}
                </h4>
                
                {sport === 'judo' && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'ippon', value: 1 })} className="flex-1 bg-blue-600 py-3 rounded-xl font-bold text-sm">+ IPPON</motion.button>
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'ippon', value: -1 })} className="w-12 bg-blue-600/30 py-3 rounded-xl font-bold text-sm">-1</motion.button>
                    </div>
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'wazaari', value: 1 })} className="flex-1 bg-blue-600/50 py-3 rounded-xl font-bold text-sm">+ WAZA-ARI</motion.button>
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'wazaari', value: -1 })} className="w-12 bg-blue-600/20 py-3 rounded-xl font-bold text-sm">-1</motion.button>
                    </div>
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'yuko', value: 1 })} className="flex-1 bg-blue-600/30 py-3 rounded-xl font-bold text-sm">+ YUKO</motion.button>
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'yuko', value: -1 })} className="w-12 bg-blue-600/10 py-3 rounded-xl font-bold text-sm">-1</motion.button>
                    </div>
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'shido', value: 1 })} className="flex-1 bg-yellow-500/20 text-yellow-500 py-3 rounded-xl font-bold text-sm">+ SHIDO</motion.button>
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'shido', value: -1 })} className="w-12 bg-yellow-500/10 text-yellow-500 py-3 rounded-xl font-bold text-sm">-1</motion.button>
                    </div>
                    <div className="pt-4 border-t border-blue-500/20">
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(0.8)' }} onClick={() => handleCommand('SCOREBOARD_START_OSAEKOMI', 'blue')} className="w-full bg-white text-blue-900 py-3 rounded-xl font-black text-sm">OSAEKOMI</motion.button>
                    </div>
                  </div>
                )}

                {sport === 'jiujitsu' && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'points', value: 4 })} className="flex-1 bg-blue-600 py-3 rounded-xl font-bold text-sm">+4 PONTOS</motion.button>
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'points', value: 3 })} className="flex-1 bg-blue-600 py-3 rounded-xl font-bold text-sm">+3</motion.button>
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'points', value: 2 })} className="flex-1 bg-blue-600 py-3 rounded-xl font-bold text-sm">+2</motion.button>
                    </div>
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'points', value: -1 })} className="w-full bg-blue-600/30 py-2 rounded-xl font-bold text-xs">-1 PONTO</motion.button>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'advantages', value: 1 })} className="flex-1 bg-green-600/50 py-3 rounded-xl font-bold text-sm">+ VANTAGEM</motion.button>
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'advantages', value: -1 })} className="w-12 bg-green-600/20 py-3 rounded-xl font-bold text-sm">-1</motion.button>
                    </div>
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'penalties', value: 1 })} className="flex-1 bg-yellow-500/20 text-yellow-500 py-3 rounded-xl font-bold text-sm">+ PUNIÇÃO</motion.button>
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'penalties', value: -1 })} className="w-12 bg-yellow-500/10 text-yellow-500 py-3 rounded-xl font-bold text-sm">-1</motion.button>
                    </div>
                  </div>
                )}

                {sport === 'karate' && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'ippon', value: 3 })} className="flex-1 bg-red-600 py-3 rounded-xl font-bold text-sm">+ IPPON (3)</motion.button>
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'ippon', value: -3 })} className="w-12 bg-red-600/30 py-3 rounded-xl font-bold text-sm">-3</motion.button>
                    </div>
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'wazaari', value: 2 })} className="flex-1 bg-red-600/70 py-3 rounded-xl font-bold text-sm">+ WAZA-ARI (2)</motion.button>
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'wazaari', value: -2 })} className="w-12 bg-red-600/20 py-3 rounded-xl font-bold text-sm">-2</motion.button>
                    </div>
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'yuko', value: 1 })} className="flex-1 bg-red-600/50 py-3 rounded-xl font-bold text-sm">+ YUKO (1)</motion.button>
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'yuko', value: -1 })} className="w-12 bg-red-600/10 py-3 rounded-xl font-bold text-sm">-1</motion.button>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_TOGGLE_SENSHU', 'blue')} className="flex-1 bg-yellow-500/30 text-yellow-500 py-3 rounded-xl font-bold text-sm">SENSHU</motion.button>
                    </div>
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'penalties', value: 1 })} className="flex-1 bg-zinc-800 text-white py-3 rounded-xl font-bold text-sm">+ FALTA</motion.button>
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'penalties', value: -1 })} className="w-12 bg-zinc-800/50 text-white py-3 rounded-xl font-bold text-sm">-1</motion.button>
                    </div>
                  </div>
                )}
              </div>

              {/* Player 2 (White/Blue) */}
              <div className={`${sport === 'karate' ? 'bg-blue-900/30 border-blue-500/30' : 'bg-zinc-100 border-white/30'} border p-4 rounded-3xl space-y-4`}>
                <h4 className={`text-center font-black uppercase tracking-widest ${sport === 'karate' ? 'text-blue-400' : 'text-zinc-800'}`}>
                  {sport === 'karate' ? 'Azul' : 'Branco'}
                </h4>
                
                {sport === 'judo' && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'ippon', value: 1 })} className="flex-1 bg-zinc-300 text-black py-3 rounded-xl font-bold text-sm">+ IPPON</motion.button>
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'ippon', value: -1 })} className="w-12 bg-zinc-300/50 text-black py-3 rounded-xl font-bold text-sm">-1</motion.button>
                    </div>
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'wazaari', value: 1 })} className="flex-1 bg-zinc-200 text-black py-3 rounded-xl font-bold text-sm">+ WAZA-ARI</motion.button>
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'wazaari', value: -1 })} className="w-12 bg-zinc-200/50 text-black py-3 rounded-xl font-bold text-sm">-1</motion.button>
                    </div>
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'yuko', value: 1 })} className="flex-1 bg-zinc-300/50 text-black py-3 rounded-xl font-bold text-sm">+ YUKO</motion.button>
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'yuko', value: -1 })} className="w-12 bg-zinc-300/30 text-black py-3 rounded-xl font-bold text-sm">-1</motion.button>
                    </div>
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'shido', value: 1 })} className="flex-1 bg-yellow-400/30 text-yellow-700 py-3 rounded-xl font-bold text-sm">+ SHIDO</motion.button>
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'shido', value: -1 })} className="w-12 bg-yellow-400/10 text-yellow-700 py-3 rounded-xl font-bold text-sm">-1</motion.button>
                    </div>
                    <div className="pt-4 border-t border-zinc-300">
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.5)' }} onClick={() => handleCommand('SCOREBOARD_START_OSAEKOMI', 'white')} className="w-full bg-black text-white py-3 rounded-xl font-black text-sm">OSAEKOMI</motion.button>
                    </div>
                  </div>
                )}

                {sport === 'jiujitsu' && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'points', value: 4 })} className="flex-1 bg-zinc-300 text-black py-3 rounded-xl font-bold text-sm">+4 PONTOS</motion.button>
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'points', value: 3 })} className="flex-1 bg-zinc-300 text-black py-3 rounded-xl font-bold text-sm">+3</motion.button>
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'points', value: 2 })} className="flex-1 bg-zinc-300 text-black py-3 rounded-xl font-bold text-sm">+2</motion.button>
                    </div>
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'points', value: -1 })} className="w-full bg-zinc-300/50 text-black py-2 rounded-xl font-bold text-xs">-1 PONTO</motion.button>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'advantages', value: 1 })} className="flex-1 bg-green-600/50 text-green-900 py-3 rounded-xl font-bold text-sm">+ VANTAGEM</motion.button>
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'advantages', value: -1 })} className="w-12 bg-green-600/20 text-green-900 py-3 rounded-xl font-bold text-sm">-1</motion.button>
                    </div>
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'penalties', value: 1 })} className="flex-1 bg-yellow-400/30 text-yellow-700 py-3 rounded-xl font-bold text-sm">+ PUNIÇÃO</motion.button>
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'penalties', value: -1 })} className="w-12 bg-yellow-400/10 text-yellow-700 py-3 rounded-xl font-bold text-sm">-1</motion.button>
                    </div>
                  </div>
                )}

                {sport === 'karate' && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'ippon', value: 3 })} className="flex-1 bg-blue-600 py-3 rounded-xl font-bold text-sm">+ IPPON (3)</motion.button>
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'ippon', value: -3 })} className="w-12 bg-blue-600/30 py-3 rounded-xl font-bold text-sm">-3</motion.button>
                    </div>
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'wazaari', value: 2 })} className="flex-1 bg-blue-600/70 py-3 rounded-xl font-bold text-sm">+ WAZA-ARI (2)</motion.button>
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'wazaari', value: -2 })} className="w-12 bg-blue-600/20 py-3 rounded-xl font-bold text-sm">-2</motion.button>
                    </div>
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'yuko', value: 1 })} className="flex-1 bg-blue-600/50 py-3 rounded-xl font-bold text-sm">+ YUKO (1)</motion.button>
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'yuko', value: -1 })} className="w-12 bg-blue-600/10 py-3 rounded-xl font-bold text-sm">-1</motion.button>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_TOGGLE_SENSHU', 'white')} className="flex-1 bg-yellow-500/30 text-yellow-500 py-3 rounded-xl font-bold text-sm">SENSHU</motion.button>
                    </div>
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'penalties', value: 1 })} className="flex-1 bg-zinc-800 text-white py-3 rounded-xl font-bold text-sm">+ FALTA</motion.button>
                      <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'penalties', value: -1 })} className="w-12 bg-zinc-800/50 text-white py-3 rounded-xl font-bold text-sm">-1</motion.button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {sport === 'judo' && (
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-3xl">
                <motion.button whileTap={{ scale: 0.95, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_STOP_OSAEKOMI')} className="w-full bg-red-500/20 text-red-500 py-4 rounded-xl font-bold">TOKETA (Parar Osaekomi)</motion.button>
              </div>
            )}
          </div>
  );
}
