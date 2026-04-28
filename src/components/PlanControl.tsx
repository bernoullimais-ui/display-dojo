import React from 'react';
import { motion } from 'framer-motion';
import { Crown, Star, Tv, PlusCircle, Trash2, Loader2, Lock, Check, X } from 'lucide-react';
import { DojoSettings } from '../types';
import SponsorReports from './SponsorReports';
import { supabase } from '../lib/supabase';

import MasterClassShop from './MasterClassShop';
import PagarMeCheckout from './PagarMeCheckout';

interface PlanControlProps {
  planSubTab: 'INFO' | 'REPORTS' | 'SHOP';
  setPlanSubTab: (tab: 'INFO' | 'REPORTS' | 'SHOP') => void;
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
  handleCommand: (type: string, payload?: any) => void;
  forceShowSelection?: boolean;
  onModalClose?: () => void;
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
  
  teacherId,
  handleCommand,
  forceShowSelection,
  onModalClose
}: PlanControlProps) {
  const [checkoutPlan, setCheckoutPlan] = React.useState<{id: string, name: string, price: number} | null>(null);
  const [showPlanSelection, setShowPlanSelection] = React.useState(false);

  React.useEffect(() => {
    if (forceShowSelection) {
      setShowPlanSelection(true);
    }
  }, [forceShowSelection]);

  const handleCloseSelection = () => {
    setShowPlanSelection(false);
    if (onModalClose) onModalClose();
  };
  const [plans, setPlans] = React.useState([
    { id: 'STARTER', name: 'STARTER', price: 2900 },
    { id: 'PRO', name: 'PRÓ', price: 9900 },
    { id: 'BUSINESS', name: 'BUSINESS', price: 19700 }
  ]);

  React.useEffect(() => {
    const fetchPrices = async () => {
      if (!supabase) return;
      const { data } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'plan_prices')
        .single();
      
      if (data && data.value) {
        setPlans([
          { id: 'STARTER', name: 'STARTER', price: data.value.STARTER || 2900 },
          { id: 'PRO', name: 'PRÓ', price: data.value.PRO || 9900 },
          { id: 'BUSINESS', name: 'BUSINESS', price: data.value.BUSINESS || 19700 }
        ]);
      }
    };
    fetchPrices();
  }, []);

  return (
    <div className="space-y-6">
            <div className="w-full flex overflow-x-auto bg-zinc-900/50 p-1 rounded-xl mb-4 hide-scrollbar">
              <button onClick={() => setPlanSubTab('INFO')} className={`flex-shrink-0 px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${planSubTab === 'INFO' ? 'bg-zinc-800 text-white rounded-lg' : 'text-zinc-500'}`}>Meu Plano</button>
              <button onClick={() => setPlanSubTab('SHOP')} className={`flex-shrink-0 px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${planSubTab === 'SHOP' ? 'bg-zinc-800 text-white rounded-lg' : 'text-zinc-500'}`}>Loja</button>
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
                        <button 
                          onClick={() => setShowPlanSelection(true)}
                          className="w-full bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/20"
                        >
                          Fazer Upgrade Agora
                        </button>
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

            {planSubTab === 'SHOP' && (
              <MasterClassShop 
                teacherId={teacherId} 
                onSendCommand={handleCommand} 
                tvSessions={tvSessions}
              />
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
                    <button 
                      onClick={() => setShowPlanSelection(true)}
                      className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
                    >
                      Fazer Upgrade
                    </button>
                  </div>
                )}
                <div className={!isBusiness ? 'opacity-30 pointer-events-none' : ''}>
                  <SponsorReports teacherId={teacherId} />
                </div>
              </div>
            )}

            {showPlanSelection && (
              <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={handleCloseSelection}
                  className="absolute inset-0 bg-black/90 backdrop-blur-sm"
                />
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  className="relative w-full max-w-4xl bg-zinc-950 rounded-[2.5rem] overflow-hidden border border-zinc-800 shadow-2xl overflow-y-auto max-h-[90vh]"
                >
                  <div className="p-8 md:p-12">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h2 className="text-3xl font-black text-white uppercase tracking-tight">Escolha seu Plano</h2>
                        <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Evolua seu Dojo com o Dojo Digital</p>
                      </div>
                      <button 
                        onClick={handleCloseSelection}
                        className="p-3 bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition-colors"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {plans.map((plan) => (
                        <div 
                          key={plan.id}
                          className={`relative p-8 rounded-3xl border transition-all ${
                            (plan.id === 'STARTER' && isStarter) || (plan.id === 'PRO' && isPro) || (plan.id === 'BUSINESS' && isBusiness)
                            ? 'bg-zinc-900/50 border-zinc-800 opacity-50'
                            : plan.id === 'BUSINESS' 
                            ? 'bg-gradient-to-b from-red-600/10 to-black border-red-600/30' 
                            : 'bg-zinc-900 border-zinc-800'
                          }`}
                        >
                          {plan.id === 'BUSINESS' && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest">
                              Recomendado
                            </div>
                          )}

                          <div className="mb-6">
                            <h3 className="text-xl font-black text-white mb-2">{plan.name}</h3>
                            <div className="flex items-baseline gap-1">
                              <span className="text-zinc-500 text-sm font-bold">R$</span>
                              <span className="text-3xl font-black text-white">{(plan.price / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              <span className="text-zinc-500 text-xs font-bold uppercase">/mês</span>
                            </div>
                          </div>

                          <ul className="space-y-4 mb-8">
                            <li className="flex items-start gap-3 text-xs text-zinc-400">
                              <Check size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                              <span>{plan.id === 'STARTER' ? '3 Imagens no Media Hub' : plan.id === 'PRO' ? '6 Imagens e 2 Vídeos' : 'Mídias Ilimitadas'}</span>
                            </li>
                            <li className="flex items-start gap-3 text-xs text-zinc-400">
                              <Check size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                              <span>Customização de Cores e Logo</span>
                            </li>
                            {plan.id !== 'STARTER' && (
                              <li className="flex items-start gap-3 text-xs text-zinc-400">
                                <Check size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Playlists de Áudio e Agenda</span>
                              </li>
                            )}
                            {plan.id === 'BUSINESS' && (
                              <li className="flex items-start gap-3 text-xs text-zinc-400">
                                <Check size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Relatórios de Patrocínio</span>
                              </li>
                            )}
                          </ul>

                          <button
                            disabled={(plan.id === 'STARTER' && isStarter) || (plan.id === 'PRO' && isPro) || (plan.id === 'BUSINESS' && isBusiness)}
                            onClick={() => {
                              setCheckoutPlan(plan);
                              setShowPlanSelection(false);
                            }}
                            className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                              (plan.id === 'STARTER' && isStarter) || (plan.id === 'PRO' && isPro) || (plan.id === 'BUSINESS' && isBusiness)
                              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                              : plan.id === 'BUSINESS'
                              ? 'bg-red-600 text-white hover:bg-red-700 shadow-xl shadow-red-600/20'
                              : 'bg-white text-black hover:bg-zinc-200'
                            }`}
                          >
                            {(plan.id === 'STARTER' && isStarter) || (plan.id === 'PRO' && isPro) || (plan.id === 'BUSINESS' && isBusiness)
                              ? 'Plano Atual'
                              : 'Selecionar'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </div>
            )}

            {checkoutPlan && (
              <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setCheckoutPlan(null)}
                  className="absolute inset-0 bg-black/90 backdrop-blur-sm"
                />
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  className="relative w-full max-w-lg bg-zinc-900 rounded-[2.5rem] overflow-hidden border border-zinc-800 shadow-2xl"
                >
                  <button 
                    onClick={() => setCheckoutPlan(null)}
                    className="absolute top-6 right-6 p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition-colors z-10"
                  >
                    <X size={20} className="text-white" />
                  </button>
                  
                  <PagarMeCheckout 
                    type="subscription"
                    resourceId={checkoutPlan.id}
                    amount={checkoutPlan.price}
                    title={`ASSINATURA DOJO DIGITAL ${checkoutPlan.name}`}
                    teacherId={teacherId}
                    onSuccess={() => {
                      // Status will update via Supabase subscription update in PagarMeCheckout
                    }}
                    onClose={() => setCheckoutPlan(null)}
                  />
                </motion.div>
              </div>
            )}
          </div>
  );
}
