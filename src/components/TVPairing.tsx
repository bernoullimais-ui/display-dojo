import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { motion } from 'motion/react';
import { Tv, Smartphone, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

interface TVPairingProps {
  onPaired: (teacherId: string, pairingCode: string) => void;
}

export default function TVPairing({ onPaired }: TVPairingProps) {
  const [pairingCode, setPairingCode] = useState<string>('');
  const [status, setStatus] = useState<'generating' | 'pending' | 'paired'>('generating');

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const generateCode = async () => {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      setPairingCode(code);
      setStatus('pending');

      // 1. Create a session in Supabase
      const { error } = await supabase
        .from('sessions')
        .insert([{ id: code, status: 'pending' }]);

      if (error) {
        console.error('Error creating session:', error);
        return;
      }

      // 2. Subscribe to changes on this specific session
      const channel = supabase
        .channel(`session-${code}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'sessions',
            filter: `id=eq.${code}`,
          },
          (payload) => {
            if (payload.new.status === 'paired' && payload.new.teacher_id) {
              setStatus('paired');
              setTimeout(() => {
                onPaired(payload.new.teacher_id, code);
              }, 1500);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    generateCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-8 text-white font-sans">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-10 rounded-3xl text-center space-y-6 shadow-2xl">
          <div className="bg-amber-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="text-amber-500" size={32} />
          </div>
          <h2 className="text-2xl font-bold">Configuração Necessária</h2>
          <p className="text-zinc-400">
            Para que o **DojoDisplay** funcione, você precisa configurar as chaves do Supabase no painel de **Settings** do AI Studio.
          </p>
          <div className="text-left bg-black p-4 rounded-xl font-mono text-xs text-zinc-500 space-y-2 border border-zinc-800">
            <div>VITE_SUPABASE_URL</div>
            <div>VITE_SUPABASE_ANON_KEY</div>
          </div>
          <p className="text-sm text-zinc-500">
            Após adicionar as chaves, a aplicação irá recarregar automaticamente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-8 text-white font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full text-center space-y-12"
      >
        <div className="space-y-4">
          <div className="flex justify-center gap-8 mb-8">
            <div className="relative">
              <Tv size={80} className="text-zinc-700" />
              {status === 'paired' && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-2 -right-2 bg-green-500 rounded-full p-1"
                >
                  <CheckCircle2 size={24} />
                </motion.div>
              )}
            </div>
            <div className="flex items-center">
              <div className="h-px w-16 bg-zinc-800 border-dashed border-t" />
            </div>
            <Smartphone size={80} className={status === 'paired' ? 'text-blue-500' : 'text-zinc-700'} />
          </div>
          
          <h1 className="text-5xl font-bold tracking-tight">
            {status === 'paired' ? 'Conectado!' : 'Conectar DojoDisplay'}
          </h1>
          <p className="text-zinc-400 text-xl max-w-md mx-auto">
            {status === 'paired' 
              ? 'Prepare o tatame, o treino vai começar.' 
              : 'Abra o app no seu celular e digite o código abaixo para controlar esta TV.'}
          </p>
        </div>

        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
          <div className="relative bg-zinc-900 border border-zinc-800 px-16 py-10 rounded-2xl shadow-2xl">
            {status === 'generating' ? (
              <div className="flex items-center justify-center gap-3 text-zinc-500">
                <Loader2 className="animate-spin" />
                <span className="text-2xl font-mono">GERANDO...</span>
              </div>
            ) : (
              <span className="text-8xl font-mono font-black tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-400">
                {pairingCode}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 text-zinc-500 text-sm">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span>Aguardando sinal do smartphone...</span>
        </div>
      </motion.div>

      {/* Background decoration */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-900/10 blur-[120px] rounded-full" />
      </div>
    </div>
  );
}
