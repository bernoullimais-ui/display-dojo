import React from 'react';
import { motion } from 'motion/react';
import { Crown, Star, Tv, PlusCircle, Trash2, Loader2, Lock, Check } from 'lucide-react';
import { DojoSettings } from '../types';
import SponsorReports from './SponsorReports';

interface PlanControlProps {
  planSubTab: 'INFO' | 'REPORTS';
  setPlanSubTab: (tab: 'INFO' | 'REPORTS') => void;
  isStarter: boolean;
  isPro: boolean;
  isBusiness: boolean;
  dojoSettings: DojoSettings;
  tvSessions: any[];
  newTvCode: string;
  setNewTvCode: (code: string) => void;
  handleAddTv: (e: React.FormEvent) => void;
  isAddingTv: boolean;
  addTvError: string;
  
  teacherId: string;
}

export default function PlanControl({
  planSubTab,
  setPlanSubTab,
  isStarter,
  isPro,
  isBusiness,
  dojoSettings,
  tvSessions,
  newTvCode,
  setNewTvCode,
  handleAddTv,
  isAddingTv,
  addTvError,
  
  teacherId
}: PlanControlProps) {
  return (
    <div className="space-y-6">
            <div className="w-full flex overflow-x-auto bg-zinc-900/50 p-1 rounded-xl mb-4 hide-scrollbar">
              <button onClick={() => setPlanSubTab('INFO')} className={`flex-shrink-0 px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${planSubTab === 'INFO' ? 'bg-zinc-800 text-white rounded-lg' : 'text-zinc-500'}`}>Meu Plano</button>
              <button onClick={() => setPlanSubTab('REPORTS')} className={`flex-shrink-0 px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${planSubTab === 'REPORTS' ? 'bg-zinc-800 text-white rounded-lg' : 'text-zinc-500'}`}>Relatórios</button>
            </div>

            {planSubTab === 'INFO' && (
              <>
                <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 p-8 rounded-3xl text-center space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Star size={120} />
                  </div>
                  <div className="relative z-10">
                    <div className="w-20 h-20 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/30">
                      <Crown className={isPro ? "text-yellow-500" : "text-zinc-500"} size={40} />
                    </div>
                    <h2 className="text-2xl font-black text-white mb-2">
                      Plano Atual: <span className={isPro ? "text-yellow-500" : "text-zinc-400"}>{dojoSettings.subscription_tier || 'FREE'}</span>
                    </h2>
                    <p className="text-zinc-400 text-sm max-w-xs mx-auto mb-8">
                      {isBusiness 
                        ? 'Você tem acesso a todos os recursos do Dojo Digital, incluindo Mídias Ilimitadas e Vídeos longos.'
                        : isPro
                        ? 'Você está no Plano PRÓ. Faça upgrade para o BUSINESS para ter Mídias Ilimitadas.'
                        : isStarter
                        ? 'Você está no Plano STARTER. Faça upgrade para o PRÓ para liberar Playlists, Agenda e Letreiro.'
                        : 'Faça upgrade para liberar Presets, Cores, Logomarca e Hub de Mídias.'}
                    </p>
                    
                    {!isBusiness && (
                      <div className="space-y-4">
                        <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-2xl text-left">
                          <p className="text-xs text-yellow-500 font-medium">
                            ⚠️ <span className="font-bold">Atenção:</span> Na página de pagamento, certifique-se de usar este mesmo email para que seu acesso seja liberado automaticamente.
                          </p>
                        </div>
                        <a 
                          href="https://www.judotech.com.br/display-planos" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-block bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-xl shadow-blue-900/20 w-full"
                        >
                          Fazer Upgrade Agora
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-4">
                  <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">Recursos do seu plano</h3>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-3 text-sm">
                      <Check size={16} className="text-green-500" />
                      <span>Cronômetro e Placar</span>
                    </li>
                    <li className={`flex items-center gap-3 text-sm ${isStarter ? 'text-white' : 'text-zinc-600'}`}>
                      {isStarter ? <Check size={16} className="text-green-500" /> : <Lock size={16} />}
                      <span>Presets, Cores e Logomarca Customizada</span>
                    </li>
                    <li className={`flex items-center gap-3 text-sm ${isStarter ? 'text-white' : 'text-zinc-600'}`}>
                      {isStarter ? <Check size={16} className="text-green-500" /> : <Lock size={16} />}
                      <span>Hub de Mídias {isBusiness ? '(Ilimitado)' : isPro ? '(Até 6 Imagens e 2 Vídeos)' : '(Até 3 Imagens)'}</span>
                    </li>
                    <li className={`flex items-center gap-3 text-sm ${isPro ? 'text-white' : 'text-zinc-600'}`}>
                      {isPro ? <Check size={16} className="text-green-500" /> : <Lock size={16} />}
                      <span>Áudios Personalizados, Playlists, Agenda e Letreiro</span>
                    </li>
                  </ul>
                </div>
              </>
            )}

            {planSubTab === 'REPORTS' && (
              <div className="relative">
                {!isBusiness && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-950/90 rounded-3xl p-6 text-center border border-zinc-800">
                    <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mb-4">
                      <Lock size={32} className="text-blue-500" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Recurso BUSINESS</h3>
                    <p className="text-zinc-400 text-sm mb-6 max-w-xs">
                      Os relatórios de patrocínios estão disponíveis apenas no plano BUSINESS.
                    </p>
                    <a 
                      href="https://www.judotech.com.br/display-planos" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
                    >
                      Fazer Upgrade
                    </a>
                  </div>
                )}
                <div className={!isBusiness ? 'opacity-30 pointer-events-none' : ''}>
                  <SponsorReports teacherId={teacherId} />
                </div>
              </div>
            )}
          </div>
  );
}
