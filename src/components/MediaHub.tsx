import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { MediaItem, Playlist, DojoSettings, ScheduleItem } from '../types';
import { Maximize, XCircle, Plus, Loader2, Upload, Crown, Lock, Trash2, PlayCircle, Image as ImageIcon, Video, Calendar, Clock, Edit, Settings, Check, Youtube, RotateCcw, VolumeX, Volume2, Volume1 } from 'lucide-react';

interface MediaHubProps {
  teacherId: string;
  isStarter: boolean;
  isPro: boolean;
  isBusiness: boolean;
  dojoSettings: DojoSettings;
  setDojoSettings: React.Dispatch<React.SetStateAction<DojoSettings>>;
  handleCommand: (type: string, payload?: any) => void;
  activeSubTab: 'LIBRARY' | 'SCHEDULE' | 'DOJO' | 'TICKER' | 'PLAYLISTS';
  setActiveSubTab: React.Dispatch<React.SetStateAction<'LIBRARY' | 'SCHEDULE' | 'DOJO' | 'TICKER' | 'PLAYLISTS'>>;
}

export default function MediaHub({
  teacherId,
  isStarter,
  isPro,
  isBusiness,
  dojoSettings,
  setDojoSettings,
  handleCommand,
  activeSubTab,
  setActiveSubTab
}: MediaHubProps) {
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [mediaSponsorInput, setMediaSponsorInput] = useState('');
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    playlist_id: '',
    days_of_week: [new Date().getDay()],
    start_time: '08:00',
    end_time: '10:00'
  });
  const [dojoForm, setDojoForm] = useState({ name: dojoSettings.name || '', city: dojoSettings.city || '', state: dojoSettings.state || '' });
  const [tickerConfig, setTickerConfig] = useState(dojoSettings.ticker_config || { text: '', active: false });
  const [sponsorsConfig, setSponsorsConfig] = useState(dojoSettings.sponsors_config || {
    timer_active: false,
    scoreboard_active: false,
    timer_playlist_id: '',
    scoreboard_playlist_id: '',
    interval: 15
  });

  
  const updateConfig = async (key: string, value: any) => {
    const newConfig = { ...(dojoSettings.timer_config || {}), [key]: value };
    const { error } = await supabase
      .from('dojo_settings')
      .upsert({
        teacher_id: teacherId,
        timer_config: newConfig,
        updated_at: new Date().toISOString()
      });
    if (!error) {
      setDojoSettings({ ...dojoSettings, timer_config: newConfig });
      handleCommand('SETTINGS_UPDATE', { ...dojoSettings, timer_config: newConfig });
    }
  };

  const updatePlaylists = async (newPlaylists: Playlist[]) => {
    const newSettings = { ...dojoSettings, playlists: newPlaylists };
    setDojoSettings(newSettings);
    if (supabase && teacherId) {
      await supabase.from('dojo_settings').update({ playlists: newPlaylists }).eq('teacher_id', teacherId);
    }
  };

  const updateTickerConfig = async (field: 'text' | 'active', value: string | boolean) => {
    const newConfig = { ...tickerConfig, [field]: value };
    setTickerConfig(newConfig);
    handleCommand('TICKER_UPDATE', newConfig);
    
    if (supabase && teacherId) {
      await supabase.from('dojo_settings').update({ ticker_config: newConfig }).eq('teacher_id', teacherId);
    }
  };

  const updateSponsorsConfig = async (field: keyof typeof sponsorsConfig, value: any) => {
    const newConfig = { ...sponsorsConfig, [field]: value };
    setSponsorsConfig(newConfig);
    handleCommand('SPONSORS_UPDATE', newConfig);
    
    if (supabase && teacherId) {
      await supabase.from('dojo_settings').update({ sponsors_config: newConfig }).eq('teacher_id', teacherId);
    }
  };

  const saveDojoConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    
    if (!dojoForm.name || !dojoForm.city || !dojoForm.state) {
      alert('Por favor, preencha o Nome do Dojo, Cidade e Estado.');
      return;
    }

    const { error } = await supabase
      .from('dojo_settings')
      .upsert({
        teacher_id: teacherId,
        name: dojoForm.name,
        city: dojoForm.city,
        state: dojoForm.state,
        updated_at: new Date().toISOString()
      });

    if (error) {
      alert('Erro ao salvar configurações.');
    } else {
      setDojoSettings(prev => ({ ...prev, name: dojoForm.name, city: dojoForm.city, state: dojoForm.state }));
      handleCommand('SETTINGS_UPDATE', { ...dojoSettings, name: dojoForm.name, city: dojoForm.city, state: dojoForm.state });
      alert('Configurações salvas com sucesso!');
    }
  };

  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(50);
  const [showVolumePopup, setShowVolumePopup] = useState(false);

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    handleCommand('TOGGLE_MUTE', newMuted);
  };

  const updateVolume = (val: number) => {
    setVolume(val);
    handleCommand('SET_VOLUME', val);
  };

  const handleAddSchedule = async () => {
    if (!supabase) return;
    if (!newSchedule.playlist_id) return alert('Selecione uma playlist!');
    if (newSchedule.days_of_week.length === 0) return alert('Selecione pelo menos um dia!');
    
    const payloads = newSchedule.days_of_week.map(day => ({
      teacher_id: teacherId,
      playlist_id: newSchedule.playlist_id,
      day_of_week: day,
      start_time: newSchedule.start_time,
      end_time: newSchedule.end_time
    }));

    const { data, error } = await supabase
      .from('schedules')
      .insert(payloads)
      .select('*, media:media_id(*)');

    if (error) {
      alert('Erro ao salvar agendamento');
    } else if (data) {
      setSchedules([...schedules, ...data]);
      setShowAddSchedule(false);
    }
  };

  
  const handleDeleteMedia = async (id: string, url: string) => {
    if (!supabase) return;
    try {
      const path = url.split('dojo-media/')[1];
      await supabase.storage.from('dojo-media').remove([path]);
      await supabase.from('media').delete().eq('id', id);
      setMediaList(mediaList.filter(m => m.id !== id));
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!supabase) return;
    await supabase.from('schedules').delete().eq('id', id);
    setSchedules(schedules.filter(s => s.id !== id));
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!supabase) return;
      
      const { data: mediaData } = await supabase
        .from('media')
        .select('*')
        .in('teacher_id', [teacherId, '00000000-0000-0000-0000-000000000000'])
        .order('created_at', { ascending: false });

      const { data: scheduleData } = await supabase
        .from('schedules')
        .select('*, media:media_id(*)')
        .eq('teacher_id', teacherId);

      if (mediaData) setMediaList(mediaData);
      if (scheduleData) setSchedules(scheduleData);
    };
    fetchData();
  }, [teacherId]);

  useEffect(() => {
    setDojoForm({ name: dojoSettings.name || '', city: dojoSettings.city || '', state: dojoSettings.state || '' });
    if (dojoSettings.ticker_config) setTickerConfig(dojoSettings.ticker_config);
    if (dojoSettings.sponsors_config) setSponsorsConfig(dojoSettings.sponsors_config);
  }, [dojoSettings]);

  const checkVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      video.onerror = () => reject('Erro ao carregar vídeo');
      video.src = URL.createObjectURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, mode: 'MEDIA' | 'LOGO' = 'MEDIA') => {
    const file = e.target.files?.[0];
    if (!file || !supabase) return;

    if (mode === 'MEDIA') {
      const type = file.type.startsWith('video') ? 'video' : 'image';
      const currentImages = mediaList.filter(m => m.type === 'image').length;
      const currentVideos = mediaList.filter(m => m.type === 'video').length;

      if (type === 'video') {
        if (!isPro) return alert('Upload de vídeos disponível a partir do plano PRÓ.');
        
        try {
          const duration = await checkVideoDuration(file);
          if (!isBusiness && duration > 15) return alert('No plano PRÓ, vídeos podem ter no máximo 15 segundos.');
          if (isBusiness && duration > 30) return alert('No plano BUSINESS, vídeos podem ter no máximo 30 segundos.');
        } catch (e) {
          return alert('Não foi possível verificar a duração do vídeo.');
        }

        if (!isBusiness && currentVideos >= 2) return alert('Limite de 2 vídeos atingido no plano PRÓ.');
      } else {
        if (!isPro && currentImages >= 3) return alert('Limite de 3 imagens atingido no plano STARTER.');
        if (isPro && !isBusiness && currentImages >= 6) return alert('Limite de 6 imagens atingido no plano PRÓ.');
      }
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${teacherId}/${mode.toLowerCase()}_${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('dojo-media')
        .upload(filePath, file);

      if (uploadError) {
        if (uploadError.message.includes('bucket not found') || uploadError.message.includes('Bucket not found')) {
          alert('ERRO: O bucket "dojo-media" não foi encontrado no seu Supabase.');
        } else {
          throw uploadError;
        }
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('dojo-media')
        .getPublicUrl(filePath);

      if (mode === 'LOGO') {
        const { error: dbError } = await supabase
          .from('dojo_settings')
          .upsert({
            teacher_id: teacherId,
            logo_url: publicUrl,
            updated_at: new Date().toISOString()
          });
        if (dbError) throw dbError;
        setDojoSettings(prev => ({ ...prev, logo_url: publicUrl }));
        handleCommand('SETTINGS_UPDATE', { ...dojoSettings, logo_url: publicUrl });
      } else {
        const type = file.type.startsWith('video') ? 'video' : 'image';
        const { data: mediaData, error: dbError } = await supabase
          .from('media')
          .insert([{
            teacher_id: teacherId,
            name: file.name,
            url: publicUrl,
            type: type,
            sponsor_name: mediaSponsorInput || null
          }])
          .select()
          .single();

        if (dbError) throw dbError;
        setMediaList([mediaData, ...mediaList]);
        setMediaSponsorInput('');
      }
    } catch (error: any) {
      console.error('Upload failed:', error);
      alert('Falha no upload: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddMediaUrl = async () => {
    if (!mediaUrlInput || !supabase) return;
    
    const isYouTube = mediaUrlInput.includes('youtube.com') || mediaUrlInput.includes('youtu.be');
    const isVideo = isYouTube || mediaUrlInput.match(/\.(mp4|webm|ogg|mov)$|vimeo\.com/i);
    const type = isVideo ? 'video' : 'image';
    
    const currentImages = mediaList.filter(m => m.type === 'image').length;
    const currentVideos = mediaList.filter(m => m.type === 'video').length;

    if (type === 'video') {
      if (!isPro) return alert('Adição de vídeos disponível a partir do plano PRÓ.');
      if (!isBusiness && currentVideos >= 2) return alert('Limite de 2 vídeos atingido no plano PRÓ.');
    } else {
      if (!isPro && currentImages >= 3) return alert('Limite de 3 imagens atingido no plano STARTER.');
      if (isPro && !isBusiness && currentImages >= 6) return alert('Limite de 6 imagens atingido no plano PRÓ.');
    }

    setIsUploading(true);
    try {
      let name = mediaUrlInput.split('/').pop()?.split('?')[0] || 'Mídia via URL';
      
      if (isYouTube) {
        name = 'Vídeo do YouTube';
      }

      const { data: mediaData, error: dbError } = await supabase
        .from('media')
        .insert([{
          teacher_id: teacherId,
          name: name,
          url: mediaUrlInput,
          type: type,
          sponsor_name: mediaSponsorInput || null
        }])
        .select()
        .single();

      if (dbError) throw dbError;
      setMediaList([mediaData, ...mediaList]);
      setMediaUrlInput('');
      setMediaSponsorInput('');
      setShowUrlInput(false);
    } catch (error: any) {
      console.error('URL add failed:', error);
      alert('Falha ao adicionar URL: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setIsUploading(false);
    }
  };



















  return (
    <div className="space-y-6">
            <div className="w-full flex overflow-x-auto bg-zinc-900/50 p-1 rounded-xl mb-4 hide-scrollbar">
              <button onClick={() => setActiveSubTab('LIBRARY')} className={`flex-shrink-0 px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${activeSubTab === 'LIBRARY' ? 'bg-zinc-800 text-white rounded-lg' : 'text-zinc-500'}`}>Biblioteca</button>
              <button onClick={() => setActiveSubTab('PLAYLISTS')} className={`flex-shrink-0 px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${activeSubTab === 'PLAYLISTS' ? 'bg-zinc-800 text-white rounded-lg' : 'text-zinc-500'}`}>Playlists</button>
              <button onClick={() => setActiveSubTab('SCHEDULE')} className={`flex-shrink-0 px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${activeSubTab === 'SCHEDULE' ? 'bg-zinc-800 text-white rounded-lg' : 'text-zinc-500'}`}>Agenda</button>
              <button onClick={() => setActiveSubTab('TICKER')} className={`flex-shrink-0 px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${activeSubTab === 'TICKER' ? 'bg-zinc-800 text-white rounded-lg' : 'text-zinc-500'}`}>Letreiro</button>
              <button onClick={() => setActiveSubTab('DOJO')} className={`flex-shrink-0 px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${activeSubTab === 'DOJO' ? 'bg-zinc-800 text-white rounded-lg' : 'text-zinc-500'}`}>Dojo</button>
            </div>

            {activeSubTab === 'LIBRARY' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">Biblioteca</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleCommand('TOGGLE_FULLSCREEN')} 
                  className="p-2 rounded-full bg-blue-500/20 text-blue-500 hover:bg-blue-500/30 transition-colors"
                  title="Tela Cheia"
                >
                  <Maximize size={20} />
                </button>
                <button 
                  onClick={() => handleCommand('STOP_MEDIA')} 
                  className="p-2 rounded-full bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors"
                  title="Interromper Mídia"
                >
                  <XCircle size={20} />
                </button>
                <button 
                  onClick={() => isStarter ? setShowUrlInput(!showUrlInput) : alert('Recurso STARTER')} 
                  className={`p-2 rounded-full transition-colors ${showUrlInput ? 'bg-blue-500/20 text-blue-500' : 'bg-zinc-800 text-zinc-400'}`}
                >
                  <Plus size={20} />
                </button>
                <button onClick={() => isStarter ? fileInputRef.current?.click() : alert('Recurso STARTER')} disabled={isUploading} className="bg-blue-600 p-2 rounded-full text-white">
                  {isUploading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
                </button>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*,video/*" />
            </div>

            {!isStarter && (
              <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 p-8 rounded-3xl text-center space-y-4 relative overflow-hidden mb-6">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Crown size={120} />
                </div>
                <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Lock className="text-blue-500" size={32} />
                </div>
                <h3 className="text-xl font-bold text-white">Recurso STARTER</h3>
                <p className="text-zinc-400 text-sm max-w-xs mx-auto">
                  O Hub de Mídias está disponível a partir do Plano STARTER. Playlists, Agenda e Letreiro Digital no Plano PRÓ.
                </p>
                <a href="https://www.judotech.com.br/display-planos" target="_blank" rel="noopener noreferrer" className="inline-block bg-blue-600 text-white px-8 py-3 rounded-xl font-bold mt-4 hover:bg-blue-700 transition-colors">
                  Fazer Upgrade
                </a>
              </div>
            )}

            {isStarter && showUrlInput && (
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Adicionar via URL</p>
                <div className="flex flex-col gap-2">
                  <input 
                    type="url" 
                    value={mediaUrlInput}
                    onChange={(e) => setMediaUrlInput(e.target.value)}
                    placeholder="https://exemplo.com/imagem.jpg"
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500"
                  />
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={mediaSponsorInput}
                      onChange={(e) => setMediaSponsorInput(e.target.value)}
                      placeholder="Nome do Patrocinador (Opcional)"
                      className="flex-1 bg-black border border-zinc-800 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500"
                    />
                    <button 
                      onClick={handleAddMediaUrl}
                      disabled={isUploading || !mediaUrlInput}
                      className="bg-blue-600 px-4 rounded-xl font-bold text-xs disabled:opacity-50"
                    >
                      OK
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isStarter && (
              <div className="grid grid-cols-2 gap-4">
                {mediaList.map((item) => {
                  const isYouTube = item.url.includes('youtube.com') || item.url.includes('youtu.be');
                  return (
                    <div key={item.id} className="group relative bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 aspect-square">
                      {item.type === 'image' ? (
                        <img src={item.url} className="w-full h-full object-cover opacity-70" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-zinc-800 opacity-70">
                          {isYouTube ? <Youtube className="text-red-600" size={40} /> : <Video className="text-zinc-600" size={40} />}
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <button onClick={() => handleCommand('SHOW_MEDIA', item)} className="bg-white/90 text-black p-4 rounded-full shadow-lg pointer-events-auto active:scale-95 transition-transform">
                          <PlayCircle size={32} />
                        </button>
                      </div>
                      {item.teacher_id !== 'GLOBAL' && (
                        <button onClick={() => handleDeleteMedia(item.id, item.url)} className="absolute top-2 right-2 bg-black/60 text-red-500 p-2 rounded-full active:scale-95 transition-transform z-10">
                          <Trash2 size={18} />
                        </button>
                      )}
                      {item.sponsor_name && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-2 text-center">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Patrocínio</p>
                          <p className="text-xs font-bold text-white truncate">{item.sponsor_name}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

            {activeSubTab === 'SCHEDULE' && (
          <div className="space-y-6">
            {!isPro ? (
              <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 p-8 rounded-3xl text-center space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Crown size={120} />
                </div>
                <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Lock className="text-blue-500" size={32} />
                </div>
                <h3 className="text-xl font-bold text-white">Recurso PRÓ</h3>
                <p className="text-zinc-400 text-sm max-w-xs mx-auto">
                  A Agenda está disponível a partir do Plano PRÓ.
                </p>
                <a href="https://www.judotech.com.br/display-planos" target="_blank" rel="noopener noreferrer" className="inline-block bg-blue-600 text-white px-8 py-3 rounded-xl font-bold mt-4 hover:bg-blue-700 transition-colors">
                  Fazer Upgrade
                </a>
              </div>
            ) : (
              <>
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Tempo de Exibição de Imagens (segundos)</label>
                <p className="text-xs text-zinc-600">Define quanto tempo cada imagem ou vídeo do YouTube ficará na tela antes de alternar.</p>
                <input 
                  type="number" 
                  min="5"
                  max="300"
                  defaultValue={(dojoSettings.timer_config || {}).imageDuration || 15}
                  onBlur={(e) => updateConfig('imageDuration', parseInt(e.target.value))}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-between items-center">
              <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">Programação Semanal</h3>
              <button 
                onClick={() => setShowAddSchedule(!showAddSchedule)} 
                className={`p-2 rounded-full transition-colors ${showAddSchedule ? 'bg-red-500/20 text-red-500' : 'bg-zinc-800 text-blue-500 hover:bg-zinc-700'}`}
              >
                {showAddSchedule ? <RotateCcw size={20} /> : <Plus size={20} />}
              </button>
            </div>

            {showAddSchedule && (
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Playlist</label>
                  <select 
                    value={newSchedule.playlist_id}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, playlist_id: e.target.value }))}
                    className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm focus:border-blue-500 outline-none"
                  >
                    <option value="">Selecione uma playlist...</option>
                    {(dojoSettings.playlists || []).map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.media_ids.length} mídias)</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Dias da Semana</label>
                  <div className="grid grid-cols-7 gap-1">
                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          const days = newSchedule.days_of_week || [];
                          if (days.includes(i)) {
                            setNewSchedule({...newSchedule, days_of_week: days.filter(d => d !== i)});
                          } else {
                            setNewSchedule({...newSchedule, days_of_week: [...days, i]});
                          }
                        }}
                        className={`py-2 rounded-lg text-xs font-bold transition-all ${(newSchedule.days_of_week || []).includes(i) ? 'bg-blue-600 text-white' : 'bg-black text-zinc-500 border border-zinc-800'}`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Início</label>
                    <input 
                      type="time" 
                      value={newSchedule.start_time}
                      onChange={(e) => setNewSchedule({...newSchedule, start_time: e.target.value})}
                      className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Fim</label>
                    <input 
                      type="time" 
                      value={newSchedule.end_time}
                      onChange={(e) => setNewSchedule({...newSchedule, end_time: e.target.value})}
                      className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <button 
                  onClick={handleAddSchedule}
                  className="w-full bg-blue-600 py-4 rounded-2xl font-bold text-sm shadow-lg active:scale-95 transition-all mt-2"
                >
                  SALVAR AGENDAMENTO
                </button>
              </div>
            )}

            <div className="space-y-4">
              {schedules.map((s) => {
                const playlist = dojoSettings.playlists?.find(p => p.id === s.playlist_id);
                return (
                <div key={s.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-zinc-800 overflow-hidden flex items-center justify-center">
                      <PlayCircle className="text-zinc-600" size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                        <Calendar size={12} /> {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][s.day_of_week]}
                        <span className="text-zinc-600 ml-1">•</span>
                        <span className="text-blue-400 truncate max-w-[120px]">{playlist?.name || 'Playlist Removida'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <Clock size={12} /> {s.start_time.substring(0, 5)} - {s.end_time.substring(0, 5)}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteSchedule(s.id)} className="text-zinc-600 hover:text-red-500 p-2">
                    <Trash2 size={18} />
                  </button>
                </div>
              )})}
              {schedules.length === 0 && (
                <div className="py-12 text-center border-2 border-dashed border-zinc-900 rounded-3xl">
                  <Calendar className="mx-auto text-zinc-800 mb-4" size={40} />
                  <p className="text-zinc-600 text-xs">Nenhum agendamento criado</p>
                </div>
              )}
            </div>
            </>
            )}
          </div>
        )}

            {activeSubTab === 'PLAYLISTS' && (
              <div className="space-y-6">
                {!isPro ? (
                  <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 p-8 rounded-3xl text-center space-y-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Crown size={120} />
                    </div>
                    <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Lock className="text-blue-500" size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-white">Recurso PRÓ</h3>
                    <p className="text-zinc-400 text-sm max-w-xs mx-auto">
                      As Playlists estão disponíveis a partir do Plano PRÓ.
                    </p>
                    <a href="https://www.judotech.com.br/display-planos" target="_blank" rel="noopener noreferrer" className="inline-block bg-blue-600 text-white px-8 py-3 rounded-xl font-bold mt-4 hover:bg-blue-700 transition-colors">
                      Fazer Upgrade
                    </a>
                  </div>
                ) : (
                  <>
                <div className="flex justify-between items-center">
                  <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">Playlists</h3>
                  <button 
                    onClick={() => setEditingPlaylist({ id: Math.random().toString(), name: 'Nova Playlist', media_ids: [] })}
                    className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2"
                  >
                    <Plus size={16} /> CRIAR
                  </button>
                </div>

                {editingPlaylist ? (
                  <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold">Editar Playlist</h3>
                      <button onClick={() => setEditingPlaylist(null)} className="text-zinc-500 hover:text-white"><XCircle size={20} /></button>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Nome da Playlist</label>
                      <input 
                        type="text" 
                        value={editingPlaylist.name}
                        onChange={(e) => setEditingPlaylist({ ...editingPlaylist, name: e.target.value })}
                        className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm focus:border-blue-500 outline-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Mídias ({editingPlaylist.media_ids.length})</label>
                      <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-2">
                        {mediaList.map(m => (
                          <div 
                            key={m.id}
                            onClick={() => {
                              setEditingPlaylist(prev => {
                                if (!prev) return prev;
                                const newIds = prev.media_ids.includes(m.id) 
                                  ? prev.media_ids.filter(id => id !== m.id)
                                  : [...prev.media_ids, m.id];
                                return { ...prev, media_ids: newIds };
                              });
                            }}
                            className={`relative aspect-video rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${editingPlaylist.media_ids.includes(m.id) ? 'border-blue-500 scale-95' : 'border-transparent hover:border-zinc-700'}`}
                          >
                            {m.type === 'image' ? <img src={m.url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-zinc-800 flex items-center justify-center"><Video size={20} className="text-zinc-500" /></div>}
                            {editingPlaylist.media_ids.includes(m.id) && (
                              <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                                <div className="bg-blue-500 text-white rounded-full p-1"><Check size={16} /></div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          const newPlaylists = (dojoSettings.playlists || []).filter(p => p.id !== editingPlaylist.id);
                          updatePlaylists(newPlaylists);
                          setEditingPlaylist(null);
                        }}
                        className="flex-1 bg-red-500/20 text-red-500 py-3 rounded-xl font-bold text-sm"
                      >
                        EXCLUIR
                      </button>
                      <button 
                        onClick={() => {
                          const exists = (dojoSettings.playlists || []).find(p => p.id === editingPlaylist.id);
                          const newPlaylists = exists 
                            ? (dojoSettings.playlists || []).map(p => p.id === editingPlaylist.id ? editingPlaylist : p)
                            : [...(dojoSettings.playlists || []), editingPlaylist];
                          updatePlaylists(newPlaylists);
                          setEditingPlaylist(null);
                        }}
                        className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-sm"
                      >
                        SALVAR
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(!dojoSettings.playlists || dojoSettings.playlists.length === 0) ? (
                      <div className="text-center py-12 bg-zinc-900/50 rounded-3xl border border-zinc-800 border-dashed">
                        <p className="text-zinc-500 text-sm">Nenhuma playlist criada.</p>
                      </div>
                    ) : (
                      dojoSettings.playlists.map(playlist => (
                        <div key={playlist.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between">
                          <div>
                            <h4 className="font-bold">{playlist.name}</h4>
                            <p className="text-xs text-zinc-500">{playlist.media_ids.length} mídias</p>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleCommand('SHOW_PLAYLIST', playlist)}
                              className="p-2 bg-white text-black rounded-full hover:bg-zinc-200"
                            >
                              <PlayCircle size={20} />
                            </button>
                            <button 
                              onClick={() => setEditingPlaylist(playlist)}
                              className="p-2 bg-zinc-800 text-zinc-400 rounded-full hover:text-white"
                            >
                              <Settings size={20} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
                </>
                )}
              </div>
            )}

            {activeSubTab === 'TICKER' && (
              <div className="space-y-6">
                {!isPro ? (
                  <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 p-8 rounded-3xl text-center space-y-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Crown size={120} />
                    </div>
                    <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Lock className="text-blue-500" size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-white">Recurso Premium</h3>
                    <p className="text-zinc-400 text-sm max-w-xs mx-auto">
                      O Letreiro Digital (Avisos) está disponível apenas no Plano PRO.
                    </p>
                    <a href="https://www.judotech.com.br/display-planos" target="_blank" rel="noopener noreferrer" className="inline-block bg-blue-600 text-white px-8 py-3 rounded-xl font-bold mt-4 hover:bg-blue-700 transition-colors">
                      Fazer Upgrade
                    </a>
                  </div>
                ) : (
                  <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">Letreiro Digital (Avisos)</h3>
                      <button 
                        onClick={() => updateTickerConfig('active', !tickerConfig.active)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${tickerConfig.active ? 'bg-blue-600' : 'bg-zinc-700'}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${tickerConfig.active ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                    <input 
                      type="text" 
                      placeholder="Digite o aviso que ficará passando no rodapé da TV..." 
                      className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm focus:border-blue-500 outline-none transition-colors"
                      value={tickerConfig.text}
                      onChange={(e) => updateTickerConfig('text', e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            {activeSubTab === 'DOJO' && (
          <div className="space-y-8">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-6">
              <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] text-center">Configuração do Dojo</h3>
              
              <form onSubmit={saveDojoConfig} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Nome do Dojo *</label>
                  <input 
                    type="text" 
                    value={dojoForm.name}
                    onChange={(e) => setDojoForm({...dojoForm, name: e.target.value})}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                    placeholder="Ex: Dojo Central"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Cidade *</label>
                    <input 
                      type="text" 
                      value={dojoForm.city}
                      onChange={(e) => setDojoForm({...dojoForm, city: e.target.value})}
                      className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                      placeholder="Ex: São Paulo"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Estado (UF) *</label>
                    <input 
                      type="text" 
                      value={dojoForm.state}
                      onChange={(e) => setDojoForm({...dojoForm, state: e.target.value})}
                      className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                      placeholder="Ex: SP"
                      maxLength={2}
                      required
                    />
                  </div>
                </div>
                
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors">
                  Salvar Configurações do Dojo
                </button>
              </form>

              <div className="space-y-2 pt-6 border-t border-zinc-800">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Tempo da Logo Inicial (segundos)</label>
                <p className="text-xs text-zinc-600">Tempo que a logo do Dojo aparece ao abrir a TV.</p>
                <input 
                  type="number" 
                  min="1"
                  max="60"
                  defaultValue={(dojoSettings.timer_config || {}).splashDuration || 4}
                  onBlur={(e) => updateConfig('splashDuration', parseInt(e.target.value))}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Logomarca</label>
                {!isStarter ? (
                  <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 p-6 rounded-3xl text-center space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Crown size={80} />
                    </div>
                    <div className="w-12 h-12 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Lock className="text-blue-500" size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-white">Recurso STARTER</h3>
                    <p className="text-zinc-400 text-xs max-w-xs mx-auto">
                      A customização da logomarca está disponível a partir do Plano STARTER.
                    </p>
                    <a href="https://www.judotech.com.br/display-planos" target="_blank" rel="noopener noreferrer" className="inline-block bg-blue-600 text-white px-6 py-2 rounded-xl font-bold mt-2 hover:bg-blue-700 transition-colors text-sm">
                      Fazer Upgrade
                    </a>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-32 h-32 rounded-3xl bg-black border-2 border-dashed border-zinc-800 flex items-center justify-center overflow-hidden">
                      {dojoSettings.logo_url ? (
                        <img src={dojoSettings.logo_url} className="w-full h-full object-contain" />
                      ) : (
                        <ImageIcon className="text-zinc-800" size={40} />
                      )}
                    </div>
                    <button 
                      onClick={() => logoInputRef.current?.click()}
                      disabled={isUploading}
                      className="bg-zinc-800 px-6 py-2 rounded-full text-xs font-bold hover:bg-zinc-700 transition-colors"
                    >
                      {isUploading ? 'Enviando...' : 'Trocar Logo'}
                    </button>
                    <input 
                      type="file" 
                      ref={logoInputRef} 
                      onChange={(e) => handleFileUpload(e, 'LOGO')} 
                      className="hidden" 
                      accept="image/*" 
                    />
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-6 border-t border-zinc-800">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Patrocinadores (Treino e Placar)</label>
                {!isStarter ? (
                  <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 p-6 rounded-3xl text-center space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Crown size={80} />
                    </div>
                    <div className="w-12 h-12 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Lock className="text-blue-500" size={24} />
                    </div>
                    <h3 className="font-bold text-white">Recurso STARTER</h3>
                    <p className="text-zinc-400 text-xs max-w-[200px] mx-auto">
                      Ative espaços de patrocinadores a partir do Plano STARTER.
                    </p>
                    <a href="https://www.judotech.com.br/display-planos" target="_blank" rel="noopener noreferrer" className="inline-block bg-blue-600 text-white px-6 py-2 rounded-xl text-xs font-bold mt-2 hover:bg-blue-700 transition-colors">
                      Fazer Upgrade
                    </a>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between bg-black p-4 rounded-xl border border-zinc-800">
                      <span className="text-sm font-bold">Ativar no Treino</span>
                      <button 
                        onClick={() => updateSponsorsConfig('timer_active', !sponsorsConfig.timer_active)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${sponsorsConfig.timer_active ? 'bg-blue-600' : 'bg-zinc-700'}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${sponsorsConfig.timer_active ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between bg-black p-4 rounded-xl border border-zinc-800">
                      <span className="text-sm font-bold">Ativar no Placar</span>
                      <button 
                        onClick={() => updateSponsorsConfig('scoreboard_active', !sponsorsConfig.scoreboard_active)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${sponsorsConfig.scoreboard_active ? 'bg-blue-600' : 'bg-zinc-700'}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${sponsorsConfig.scoreboard_active ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Playlist de Patrocinadores (Treino)</label>
                      <select
                        value={sponsorsConfig.timer_playlist_id}
                        onChange={(e) => updateSponsorsConfig('timer_playlist_id', e.target.value)}
                        className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                      >
                        <option value="">Selecione uma playlist...</option>
                        {(dojoSettings.playlists || []).map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Playlist de Patrocinadores (Placar)</label>
                      <select
                        value={sponsorsConfig.scoreboard_playlist_id}
                        onChange={(e) => updateSponsorsConfig('scoreboard_playlist_id', e.target.value)}
                        className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                      >
                        <option value="">Selecione uma playlist...</option>
                        {(dojoSettings.playlists || []).map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Tempo de Transição (segundos)</label>
                      <input 
                        type="number" 
                        min="5"
                        max="300"
                        value={sponsorsConfig.interval}
                        onChange={(e) => updateSponsorsConfig('interval', parseInt(e.target.value))}
                        className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-6">
              <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] text-center">Áudio da TV</h3>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${!isMuted ? 'bg-blue-500/20 text-blue-500' : 'bg-zinc-800 text-zinc-500'}`}>
                      {isMuted ? <VolumeX size={20} /> : volume > 50 ? <Volume2 size={20} /> : <Volume1 size={20} />}
                    </div>
                    <div>
                      <p className="text-sm font-bold">{isMuted ? 'Mudo' : 'Áudio Ativo'}</p>
                      <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">{volume}% Volume</p>
                    </div>
                  </div>
                  <button 
                    onClick={toggleMute}
                    className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${!isMuted ? 'bg-zinc-800 text-zinc-400' : 'bg-blue-600 text-white'}`}
                  >
                    {isMuted ? 'Ativar' : 'Mudar'}
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase">
                    <span>Volume</span>
                    <span>{volume}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={volume}
                    onChange={(e) => updateVolume(parseInt(e.target.value))}
                    className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              </div>
            </div>
          </div>
            )}
          </div>
  );
}
