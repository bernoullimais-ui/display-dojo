import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, AlertCircle, CheckCircle2, Tv } from 'lucide-react';
import { motion } from 'motion/react';

interface RemotePairingProps {
  pairingCode: string;
  onPaired: (teacherId: string) => void;
  session?: any;
}

export default function RemotePairing({ pairingCode, onPaired, session: authSession }: RemotePairingProps) {
  const [status, setStatus] = useState<'connecting' | 'naming' | 'success' | 'error'>('connecting');
  const [errorMsg, setErrorMsg] = useState('');
  const [tvName, setTvName] = useState('');
  const [isBusiness, setIsBusiness] = useState(false);

  useEffect(() => {
    const connectToTV = async () => {
      if (!supabase) {
        setStatus('error');
        setErrorMsg('Supabase não configurado.');
        return;
      }

      try {
        const { data: session, error: fetchError } = await supabase
          .from('sessions')
          .select('*')
          .eq('id', pairingCode)
          .single();

        if (fetchError || !session) {
          setStatus('error');
          setErrorMsg('Código inválido ou expirado. Verifique a tela da TV.');
          return;
        }

        const teacherId = authSession?.user?.id;

        if (!teacherId) {
           setStatus('error');
           setErrorMsg('Usuário não autenticado.');
           return;
        }

        // Check tier
        const { data: settings } = await supabase
          .from('dojo_settings')
          .select('subscription_tier')
          .eq('teacher_id', teacherId)
          .single();
          
        const isBiz = settings?.subscription_tier === 'BUSINESS';
        setIsBusiness(isBiz);

        if (!isBiz) {
          // Unpair any existing sessions for this teacher if not Business
          await supabase.from('sessions').update({ status: 'pending', teacher_id: null }).eq('teacher_id', teacherId);
        }

        if (session.status === 'paired' && session.teacher_id === teacherId) {
           setStatus('success');
           setTimeout(() => onPaired(teacherId), 1000);
           return;
        }

        if (isBiz) {
          const { count } = await supabase
            .from('sessions')
            .select('*', { count: 'exact', head: true })
            .eq('teacher_id', teacherId)
            .eq('status', 'paired');
            
          if (count !== null && count >= 3) {
            setStatus('error');
            setErrorMsg('Limite de 3 TVs simultâneas atingido no plano BUSINESS. Desconecte uma TV para adicionar outra.');
            return;
          }
        }

        // Try to insert into dojo_settings table first, in case there is a foreign key constraint
        const { error: settingsError } = await supabase.from('dojo_settings').insert([{ teacher_id: teacherId, name: 'DOJO TV', logo_url: '/logo.png' }]);
        if (settingsError) {
          console.warn('Could not insert dojo_settings (might not exist or not needed):', settingsError);
        }
        
        // If Business, ask for name before finalizing
        if (isBiz) {
          setStatus('naming');
        } else {
          // Finalize pairing directly
          const { error: updateError } = await supabase
            .from('sessions')
            .update({ status: 'paired', teacher_id: teacherId, tv_name: 'TV Principal' })
            .eq('id', pairingCode);

          if (updateError) {
            console.error('Update error:', updateError);
            setStatus('error');
            setErrorMsg(`Erro ao conectar com a TV: ${updateError.message}`);
            return;
          }

          setStatus('success');
          setTimeout(() => onPaired(teacherId), 1000);
        }

      } catch (err) {
        setStatus('error');
        setErrorMsg('Erro inesperado ao conectar.');
      }
    };

    if (status === 'connecting') {
      connectToTV();
    }
  }, [pairingCode, onPaired, status]);

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tvName.trim() || !supabase) return;
    
    const teacherId = authSession?.user?.id;
    if (!teacherId) return;

    setStatus('connecting'); // Show loading briefly
    
    const { error: updateError } = await supabase
      .from('sessions')
      .update({ status: 'paired', teacher_id: teacherId, tv_name: tvName.trim() })
      .eq('id', pairingCode);

    if (updateError) {
      console.error('Update error:', updateError);
      setStatus('error');
      setErrorMsg(`Erro ao conectar com a TV: ${updateError.message}`);
      return;
    }

    setStatus('success');
    setTimeout(() => onPaired(teacherId), 1000);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-8 text-white font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-10 rounded-3xl text-center space-y-6 shadow-2xl"
      >
        {status === 'connecting' && (
          <>
            <div className="bg-blue-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
              <Loader2 className="text-blue-500 animate-spin" size={40} />
            </div>
            <h2 className="text-2xl font-bold">Conectando à TV...</h2>
            <p className="text-zinc-400">Código: <span className="font-mono text-white">{pairingCode}</span></p>
          </>
        )}

        {status === 'naming' && (
          <form onSubmit={handleNameSubmit} className="space-y-6">
            <div className="bg-blue-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
              <Tv className="text-blue-500" size={40} />
            </div>
            <h2 className="text-2xl font-bold">Identifique esta TV</h2>
            <p className="text-zinc-400 text-sm">
              Como você está no plano BUSINESS, pode conectar várias TVs. Dê um nome para esta tela (ex: Tatame 1, Recepção).
            </p>
            <input 
              type="text" 
              value={tvName}
              onChange={(e) => setTvName(e.target.value)}
              placeholder="Ex: Tatame 1"
              className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-center text-lg focus:border-blue-500 outline-none"
              autoFocus
              required
            />
            <button 
              type="submit"
              disabled={!tvName.trim()}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              Conectar TV
            </button>
          </form>
        )}

        {status === 'success' && (
          <>
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="bg-green-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto"
            >
              <CheckCircle2 className="text-green-500" size={40} />
            </motion.div>
            <h2 className="text-2xl font-bold">Conectado com Sucesso!</h2>
            <p className="text-zinc-400">Abrindo controle remoto...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="bg-red-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="text-red-500" size={40} />
            </div>
            <h2 className="text-2xl font-bold">Falha na Conexão</h2>
            <p className="text-zinc-400">{errorMsg}</p>
            <button 
              onClick={() => window.location.href = '/'}
              className="mt-4 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-bold transition-colors"
            >
              Voltar para o Início
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
