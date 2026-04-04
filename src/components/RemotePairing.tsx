import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

interface RemotePairingProps {
  pairingCode: string;
  onPaired: (teacherId: string) => void;
}

export default function RemotePairing({ pairingCode, onPaired }: RemotePairingProps) {
  const [status, setStatus] = useState<'connecting' | 'success' | 'error'>('connecting');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const connectToTV = async () => {
      if (!supabase) {
        setStatus('error');
        setErrorMsg('Supabase não configurado.');
        return;
      }

      try {
        // 1. Check if session exists and is pending
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

        if (session.status === 'paired') {
          // Already paired, maybe we are reconnecting?
          // Let's just use the existing teacher_id if it exists, or generate a new one
          const teacherId = session.teacher_id || crypto.randomUUID();
          if (!session.teacher_id) {
            await supabase.from('sessions').update({ teacher_id: teacherId }).eq('id', pairingCode);
          }
          setStatus('success');
          setTimeout(() => onPaired(teacherId), 1000);
          return;
        }

        // 2. Pair! Generate a teacher ID and update the session
        const teacherId = crypto.randomUUID();
        const { error: updateError } = await supabase
          .from('sessions')
          .update({ status: 'paired', teacher_id: teacherId })
          .eq('id', pairingCode);

        if (updateError) {
          setStatus('error');
          setErrorMsg('Erro ao conectar com a TV.');
          return;
        }

        setStatus('success');
        setTimeout(() => onPaired(teacherId), 1000);

      } catch (err) {
        setStatus('error');
        setErrorMsg('Erro inesperado ao conectar.');
      }
    };

    connectToTV();
  }, [pairingCode, onPaired]);

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
