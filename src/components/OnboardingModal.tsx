import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2, Trophy, MapPin, Target } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DojoSettings } from '../types';

interface OnboardingModalProps {
  teacherId: string;
  onComplete: (settings: DojoSettings) => void;
}

export default function OnboardingModal({ teacherId, onComplete }: OnboardingModalProps) {
  const [data, setData] = useState({
    name: '',
    city: '',
    state: '',
    martial_arts: [] as string[]
  });
  const [loading, setLoading] = useState(false);

  const martialArtsOptions = ['Judô', 'Jiu-Jitsu', 'Karatê'];

  const toggleMartialArt = (art: string) => {
    setData(prev => ({
      ...prev,
      martial_arts: prev.martial_arts.includes(art)
        ? prev.martial_arts.filter(a => a !== art)
        : [...prev.martial_arts, art]
    }));
  };

  const isFormValid = data.name && data.city && data.state && data.martial_arts.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !supabase) return;

    setLoading(true);
    try {
      const finalSettings: Partial<DojoSettings> = {
        name: data.name,
        city: data.city,
        state: data.state,
        martial_arts: data.martial_arts,
        onboarding_completed: true,
        logo_url: '/logo.png',
        subscription_tier: 'FREE'
      };

      const { error } = await supabase
        .from('dojo_settings')
        .upsert({
          teacher_id: teacherId,
          ...finalSettings
        });

      if (error) throw error;
      onComplete(finalSettings as DojoSettings);
    } catch (err) {
      console.error('Error saving onboarding:', err);
      alert('Erro ao salvar as configurações. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] w-full max-w-lg shadow-2xl"
      >
        <div className="flex flex-col items-center gap-4 mb-8 text-center">
          <div className="bg-red-600 p-4 rounded-3xl shadow-lg shadow-red-600/20">
            <Trophy className="text-white" size={40} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Seja Bem-vindo!</h1>
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs mt-1">Configure o perfil do seu Dojo</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Nome do Dojo</label>
            <div className="relative">
              <input 
                type="text" 
                required
                value={data.name}
                onChange={e => setData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Dojo Central"
                className="w-full bg-black border border-zinc-800 rounded-2xl px-5 py-4 text-white focus:border-red-600 outline-none transition-all placeholder:text-zinc-700 font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Cidade</label>
              <div className="relative">
                <input 
                  type="text" 
                  required
                  value={data.city}
                  onChange={e => setData(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="Cidade"
                  className="w-full bg-black border border-zinc-800 rounded-2xl px-5 py-4 text-white focus:border-red-600 outline-none transition-all placeholder:text-zinc-700 font-bold"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Estado</label>
              <div className="relative">
                <input 
                  type="text" 
                  required
                  value={data.state}
                  onChange={e => setData(prev => ({ ...prev, state: e.target.value }))}
                  placeholder="Ex: SP"
                  className="w-full bg-black border border-zinc-800 rounded-2xl px-5 py-4 text-white focus:border-red-600 outline-none transition-all placeholder:text-zinc-700 font-bold"
                  maxLength={2}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Modalidades Praticadas</label>
            <div className="flex flex-wrap gap-2">
              {martialArtsOptions.map(art => (
                <button
                  key={art}
                  type="button"
                  onClick={() => toggleMartialArt(art)}
                  className={`px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                    data.martial_arts.includes(art)
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {art}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-6">
            <button
              type="submit"
              disabled={loading || !isFormValid}
              className="w-full bg-white text-black font-black py-5 rounded-[1.5rem] hover:bg-zinc-200 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-2xl disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : (
                <>
                  <Check size={16} />
                  Concluir Configuração
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
