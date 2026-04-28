import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Shield, Loader2, X, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PagarMeCheckoutProps {
  type: 'subscription' | 'masterclass';
  resourceId: string;
  amount: number;
  title: string;
  teacherId: string;
  onSuccess: () => void;
  onClose: () => void;
}

export default function PagarMeCheckout({ 
  type, 
  resourceId, 
  amount, 
  title, 
  teacherId,
  onSuccess,
  onClose 
}: PagarMeCheckoutProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [errorDetails, setErrorDetails] = useState<any>(null);

  // Card info (In a real app, use Pagar.me JS SDK to tokenize)
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  // Customer & Address info
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  const formatCPF = (val: string) => {
    return val.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').replace(/(-\d{2})\d+?$/, '$1');
  };

  const formatPhone = (val: string) => {
    return val.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').replace(/(-\d{4})\d+?$/, '$1');
  };

  const formatZip = (val: string) => {
    return val.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').replace(/(-\d{3})\d+?$/, '$1');
  };

  const formatCardNumber = (val: string) => {
    return val.replace(/\D/g, '').replace(/(\d{4})(\d)/g, '$1 $2').trim().substring(0, 19);
  };

  const formatExpiry = (val: string) => {
    return val.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1/$2').substring(0, 5);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus('processing');
    setErrorDetails(null);

    try {
      // 1. Call our local Express API which talks to Pagar.me
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          resourceId,
          teacherId,
          paymentMethod: 'credit_card',
          amount,
          customer: {
            name: cardName,
            email: (await supabase?.auth.getUser())?.data.user?.email || 'cliente@dojodigital.com',
            document: cpf.replace(/\D/g, ''),
            phone: phone.replace(/\D/g, ''),
          },
          address: {
            zipCode: zipCode.replace(/\D/g, ''),
            street,
            number,
            neighborhood,
            city,
            state
          },
          card: {
            name: cardName,
            number: cardNumber.replace(/\s/g, ''),
            expiry,
            cvv
          }
        })
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMessage(result.error || 'Erro ao processar pagamento');
        setErrorDetails(result.details);
        throw new Error(result.error);
      }

      // 2. Update Supabase (This should also happen in the webhook, but we do it here for instant feedback)
      if (supabase) {
        if (type === 'masterclass') {
          await supabase.from('masterclass_purchases').insert({
            teacher_id: teacherId,
            masterclass_id: resourceId,
            status: 'paid',
            amount: amount,
            pagarme_order_id: result.id
          });
        } else if (type === 'subscription') {
          await supabase.from('subscriptions').insert({
            teacher_id: teacherId,
            plan_id: resourceId,
            status: 'active',
            pagarme_subscription_id: result.id
          });
          
          // Also update dojo_settings tier
          await supabase.from('dojo_settings').update({
            subscription_tier: resourceId
          }).eq('teacher_id', teacherId);
        }

        // Log the payment
        await supabase.from('payments_log').insert({
          teacher_id: teacherId,
          type,
          resource_id: resourceId,
          pagarme_id: result.id,
          amount,
          status: 'paid',
          raw_response: result
        });
      }

      setStatus('success');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);

    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="text-green-500" size={48} />
        </div>
        <h2 className="text-2xl font-black text-white">Pagamento Aprovado!</h2>
        <p className="text-zinc-400">Seu acesso foi liberado com sucesso.</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 overflow-y-auto max-h-[80vh]">
      <div className="flex items-center justify-between underline-offset-4 sticky top-0 bg-zinc-900 pb-4 z-10">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Finalizar Pagamento</h2>
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">{title}</p>
        </div>
        <div className="text-right">
          <p className="text-zinc-500 text-[10px] font-black uppercase">Total a pagar</p>
          <p className="text-2xl font-black text-white">R$ {(amount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      <form onSubmit={handlePayment} className="space-y-6">
        {/* Dados Pessoais */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] border-b border-zinc-800 pb-2">Dados do Cliente</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Documento (CPF)</label>
              <input 
                type="text" 
                required
                value={cpf}
                onChange={e => setCpf(formatCPF(e.target.value))}
                placeholder="000.000.000-00"
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-red-500 outline-none font-bold text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Telefone / WhatsApp</label>
              <input 
                type="text" 
                required
                value={phone}
                onChange={e => setPhone(formatPhone(e.target.value))}
                placeholder="(00) 00000-0000"
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-red-500 outline-none font-bold text-sm"
              />
            </div>
          </div>
        </div>

        {/* Endereço de Cobrança */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] border-b border-zinc-800 pb-2">Endereço de Cobrança</h3>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="col-span-2 space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">CEP</label>
              <input 
                type="text" 
                required
                value={zipCode}
                onChange={e => setZipCode(formatZip(e.target.value))}
                placeholder="00000-000"
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-red-500 outline-none font-bold text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Rua / Logradouro</label>
              <input 
                type="text" 
                required
                value={street}
                onChange={e => setStreet(e.target.value)}
                placeholder="Rua..."
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-red-500 outline-none font-bold text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Número</label>
              <input 
                type="text" 
                required
                value={number}
                onChange={e => setNumber(e.target.value)}
                placeholder="123"
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-red-500 outline-none font-bold text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Bairro</label>
              <input 
                type="text" 
                required
                value={neighborhood}
                onChange={e => setNeighborhood(e.target.value)}
                placeholder="Bairro"
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-red-500 outline-none font-bold text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Cidade</label>
                <input 
                  type="text" 
                  required
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  placeholder="Cidade"
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-red-500 outline-none font-bold text-sm text-[10px]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">UF</label>
                <input 
                  type="text" 
                  required
                  value={state}
                  onChange={e => setState(e.target.value)}
                  placeholder="SP"
                  maxLength={2}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-red-500 outline-none font-bold text-sm uppercase"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Dados do Cartão */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] border-b border-zinc-800 pb-2">Dados do Cartão</h3>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Nome Impresso no Cartão</label>
            <input 
              type="text" 
              required
              value={cardName}
              onChange={e => setCardName(e.target.value)}
              placeholder="COMO ESTÁ NO CARTÃO"
              className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-red-500 outline-none uppercase font-bold text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Número do Cartão</label>
            <div className="relative">
              <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={20} />
              <input 
                type="text" 
                required
                value={cardNumber}
                onChange={e => setCardNumber(formatCardNumber(e.target.value))}
                placeholder="0000 0000 0000 0000"
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 pl-12 text-white focus:border-red-500 outline-none font-mono text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Vencimento</label>
              <input 
                type="text" 
                required
                value={expiry}
                onChange={e => setExpiry(formatExpiry(e.target.value))}
                placeholder="MM/AA"
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-red-500 outline-none text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">CVV</label>
              <input 
                type="password" 
                required
                maxLength={4}
                value={cvv}
                onChange={e => setCvv(e.target.value)}
                placeholder="***"
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-red-500 outline-none text-sm"
              />
            </div>
          </div>
        </div>

        {status === 'error' && (
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-500 text-xs font-bold space-y-2">
            <p>Erro: {errorMessage}</p>
            {errorDetails && Array.isArray(errorDetails) && (
              <ul className="list-disc pl-4 space-y-1 text-[10px] opacity-80">
                {errorDetails.map((detail: any, idx: number) => (
                  <li key={idx}>
                    {detail.message || (typeof detail === 'string' ? detail : JSON.stringify(detail))}
                  </li>
                ))}
              </ul>
            )}
            {errorDetails && !Array.isArray(errorDetails) && (
               <p className="text-[10px] opacity-80">{JSON.stringify(errorDetails)}</p>
            )}
          </div>
        )}

        <div className="pt-4 space-y-4">
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-red-900/20 hover:bg-red-700 transition-all flex items-center justify-center gap-3"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <CreditCard size={20} />}
            PAGAR AGORA
          </button>
          
          <div className="flex items-center justify-center gap-2 text-zinc-600 text-[10px] font-bold uppercase tracking-widest">
            <Shield size={12} />
            Pagamento Processado via Pagar.me
          </div>
        </div>
      </form>
    </div>
  );
}
