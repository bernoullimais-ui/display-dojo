import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MasterClass, MasterClassMarker } from '../types';
import { Play, Lock, Crown, Loader2, CheckCircle2, RotateCcw, Timer as TimerIcon, X, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import YouTube from 'react-youtube';
import PagarMeCheckout from './PagarMeCheckout';

interface MasterClassShopProps {
  teacherId: string;
  onSendCommand: (type: string, payload?: any) => void;
  tvSessions: any[];
}

export default function MasterClassShop({ teacherId, onSendCommand, tvSessions }: MasterClassShopProps) {
  const [masterClasses, setMasterClasses] = useState<MasterClass[]>([]);
  const [purchasedIds, setPurchasedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [previewMc, setPreviewMc] = useState<MasterClass | null>(null);
  const [checkoutMc, setCheckoutMc] = useState<MasterClass | null>(null);

  useEffect(() => {
    fetchMasterClasses();
  }, []);

  const fetchMasterClasses = async () => {
    if (!supabase) return;
    setLoading(true);
    
    // Fetch masterclasses and markers
    const { data: mcData, error: mcError } = await supabase
      .from('masterclasses')
      .select('*, markers:masterclass_markers(*)');

    if (mcError) {
      console.error('Error fetching masterclasses:', mcError);
    } else {
      setMasterClasses(mcData || []);
    }

    // Fetch purchases
    const { data: pData, error: pError } = await supabase
      .from('masterclass_purchases')
      .select('masterclass_id')
      .eq('teacher_id', teacherId);

    if (pError) {
      console.error('Error fetching purchases:', pError);
    } else {
      setPurchasedIds(pData?.map(p => p.masterclass_id) || []);
    }

    setLoading(false);
  };

  const handleBuy = async (mc: MasterClass) => {
    setCheckoutMc(mc);
  };

  const startMasterClass = (mc: MasterClass) => {
    onSendCommand('SHOW_MASTERCLASS', mc);
  };

  const getYouTubeVideoId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">MasterClasses Disponíveis</h3>
      </div>

      <div className="grid gap-4">
        {masterClasses.map(mc => {
          const isPurchased = purchasedIds.includes(mc.id);
          
          return (
            <div key={mc.id} className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden group">
              <div className="aspect-video relative overflow-hidden">
                <img 
                  src={mc.instructor_image_url || `https://picsum.photos/seed/${mc.id}/400/225`} 
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  alt={mc.title}
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-blue-600 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">EXCLUSIVO</span>
                  </div>
                  <h4 className="text-xl font-black text-white leading-tight">{mc.title}</h4>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-zinc-300 text-sm font-medium">{mc.instructor_name}</p>
                    {mc.duration && (
                      <div className="flex items-center gap-1.5 text-zinc-400 font-bold bg-black/40 px-3 py-1 rounded-full border border-white/5">
                        <TimerIcon size={12} className="text-blue-500" />
                        <span className="text-[10px] uppercase tracking-widest">{mc.duration}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-zinc-400 text-xs leading-relaxed">
                  {mc.description}
                </p>

                <div className="flex flex-col gap-3 pt-2">
                  {isPurchased ? (
                    <>
                      <button 
                        onClick={() => startMasterClass(mc)}
                        className="flex-1 bg-zinc-800 text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-700 transition-colors"
                      >
                        <RotateCcw size={18} /> CARREGAR NA TV
                      </button>

                      {tvSessions.some(s => s.masterclass_state?.id === mc.id && !s.masterclass_state?.is_started) && (
                        <motion.button
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => onSendCommand('PLAY_MASTERCLASS')}
                          className="flex-1 bg-green-600 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-green-700 transition-all shadow-lg shadow-green-500/20 border-2 border-white/10"
                        >
                          <Play size={18} fill="currentColor" /> INICIAR TREINAMENTO
                        </motion.button>
                      )}

                      {tvSessions.some(s => s.masterclass_state?.id === mc.id && s.masterclass_state?.waiting_release) && (
                        <motion.button
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => onSendCommand('SENSEI_RELEASE')}
                          className="flex-1 bg-blue-600 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 border-2 border-white/10"
                        >
                          <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                          LIBERAR TREINAMENTO (SENSEI)
                        </motion.button>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col gap-2">
                       {mc.preview_url && (
                        <button 
                          onClick={() => setPreviewMc(mc)}
                          className="w-full bg-zinc-800 text-zinc-300 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-700 transition-colors border border-zinc-700"
                        >
                          <Video size={18} /> VER PITCH (DEGUSTAÇÃO)
                        </button>
                       )}
                      <button 
                        onClick={() => handleBuy(mc)}
                        disabled={buyingId === mc.id}
                        className="flex-1 bg-blue-600 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-900/20"
                      >
                        {buyingId === mc.id ? (
                          <Loader2 className="animate-spin" size={18} />
                        ) : (
                          <>ADQUIRIR AGORA</>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {masterClasses.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-zinc-800 rounded-3xl">
            <Crown size={48} className="mx-auto text-zinc-800 mb-4" />
            <p className="text-zinc-500 font-bold">Nenhuma MasterClass disponível no momento.</p>
            <p className="text-zinc-600 text-xs mt-2">Fique atento para novos conteúdos exclusivos!</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {checkoutMc && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCheckoutMc(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-zinc-900 rounded-[2.5rem] overflow-hidden border border-zinc-800 shadow-2xl"
            >
              <button 
                onClick={() => setCheckoutMc(null)}
                className="absolute top-6 right-6 p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition-colors z-10"
              >
                <X size={20} />
              </button>
              
              <PagarMeCheckout 
                type="masterclass"
                resourceId={checkoutMc.id}
                amount={checkoutMc.price || 19900}
                title={checkoutMc.title}
                teacherId={teacherId}
                onSuccess={() => {
                  setPurchasedIds([...purchasedIds, checkoutMc.id]);
                }}
                onClose={() => setCheckoutMc(null)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {previewMc && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewMc(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl bg-zinc-900 rounded-[2.5rem] overflow-hidden border border-zinc-800 shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Degustação: {previewMc.title}</h3>
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">{previewMc.instructor_name}</p>
                </div>
                <button onClick={() => setPreviewMc(null)} className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition-colors">
                  <X size={24} />
                </button>
              </div>
              <div className="aspect-video bg-black">
                {getYouTubeVideoId(previewMc.preview_url || '') ? (
                  <YouTube 
                    videoId={getYouTubeVideoId(previewMc.preview_url || '')!}
                    className="w-full h-full"
                    iframeClassName="w-full h-full"
                    opts={{
                      width: '100%',
                      height: '100%',
                      playerVars: {
                        autoplay: 1,
                        modestbranding: 1,
                        rel: 0
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-500 font-bold">
                    Vídeo de demonstração não disponível.
                  </div>
                )}
              </div>
              <div className="p-8 flex items-center justify-between bg-zinc-950">
                <div className="flex items-center gap-4">
                   <img 
                    src={previewMc.instructor_image_url} 
                    className="w-12 h-12 rounded-full object-cover border-2 border-zinc-800"
                    alt={previewMc.instructor_name}
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <p className="text-white font-bold">{previewMc.instructor_name}</p>
                    <p className="text-zinc-500 text-xs tracking-widest uppercase font-black">Mestre MasterClass</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    handleBuy(previewMc);
                    setPreviewMc(null);
                  }}
                  className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-900/10 transition-all"
                >
                  Gostei! Adquirir Agora
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
