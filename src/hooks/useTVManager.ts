import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useTVManager(teacherId: string, isBusiness: boolean) {
  const [tvSessions, setTvSessions] = useState<any[]>([]);
  const [activeTvId, setActiveTvId] = useState<string>('');
  const [showTvManager, setShowTvManager] = useState(false);
  const [showAddTv, setShowAddTv] = useState(false);
  const [newTvCode, setNewTvCode] = useState('');
  const [addTvError, setAddTvError] = useState('');
  const [isAddingTv, setIsAddingTv] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [disconnectedId, setDisconnectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!teacherId || !supabase) return;

    const loadSessions = async () => {
      const { data } = await supabase
        .from('sessions')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('status', 'paired');
      
      if (data) {
        setTvSessions(data);
        if (data.length > 0 && !activeTvId) {
          setActiveTvId(data[0].id);
        }
      }
    };

    loadSessions();

    const channel = supabase.channel('sessions_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions', filter: `teacher_id=eq.${teacherId}` },
        () => {
          loadSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teacherId, activeTvId]);

  const handleAddTv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTvCode.trim() || !supabase) return;
    
    setIsAddingTv(true);
    setAddTvError('');
    
    try {
      const code = newTvCode.trim().toUpperCase();
      const { data: session, error: fetchError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', code)
        .single();

      if (fetchError || !session) {
        setAddTvError('Código inválido ou expirado.');
        setIsAddingTv(false);
        return;
      }

      if (!isBusiness) {
        await supabase.from('sessions').update({ status: 'pending', teacher_id: null }).eq('teacher_id', teacherId);
      } else {
        const { count } = await supabase
          .from('sessions')
          .select('*', { count: 'exact', head: true })
          .eq('teacher_id', teacherId)
          .eq('status', 'paired');
          
        if (count !== null && count >= 3) {
          setAddTvError('Limite de 3 TVs simultâneas atingido no plano BUSINESS.');
          setIsAddingTv(false);
          return;
        }
      }

      const tvCount = tvSessions.length;
      const { error: updateError } = await supabase
        .from('sessions')
        .update({ 
          status: 'paired', 
          teacher_id: teacherId, 
          tv_name: isBusiness ? `TV ${tvCount + 1}` : 'TV Principal' 
        })
        .eq('id', code);

      if (updateError) {
        setAddTvError('Erro ao parear TV.');
      } else {
        setNewTvCode('');
        setShowAddTv(false);
        setActiveTvId(code);
      }
    } catch (err) {
      setAddTvError('Erro ao conectar.');
    } finally {
      setIsAddingTv(false);
    }
  };

  const handleDisconnectTv = async (sessionId: string) => {
    if (!supabase || disconnectingId === sessionId || disconnectedId === sessionId) return;
    setDisconnectingId(sessionId);
    
    setDisconnectingId(null);
    setDisconnectedId(sessionId);
    
    setTimeout(async () => {
      await supabase.from('sessions').update({ status: 'pending', teacher_id: null }).eq('id', sessionId);
      setDisconnectedId(null);
    }, 1000);
  };

  const handleUpdateTvPlaylist = async (sessionId: string, playlistId: string) => {
    if (!supabase) return;
    await supabase.from('sessions').update({ active_playlist_id: playlistId || null }).eq('id', sessionId);
  };

  return {
    tvSessions,
    setTvSessions,
    activeTvId,
    setActiveTvId,
    showTvManager,
    setShowTvManager,
    showAddTv,
    setShowAddTv,
    newTvCode,
    setNewTvCode,
    addTvError,
    isAddingTv,
    isScanning,
    setIsScanning,
    disconnectingId,
    setDisconnectingId,
    disconnectedId,
    setDisconnectedId,
    handleAddTv,
    handleDisconnectTv,
    handleUpdateTvPlaylist
  };
}
