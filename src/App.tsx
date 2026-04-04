import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import TVPairing from './components/TVPairing';
import RemotePairing from './components/RemotePairing';
import TabataTimer from './components/TabataTimer';
import Scoreboard from './components/Scoreboard';
import { LogOut, Smartphone as SmartphoneIcon, Monitor, Timer as TimerIcon, Zap, Coffee, RotateCcw, Image as ImageIcon, Video, Upload, Trash2, PlayCircle, Loader2, Calendar, Clock, Plus, Youtube, Volume2, VolumeX, Volume1, XCircle, Check } from 'lucide-react';
import { supabase } from './lib/supabase';

interface MediaItem {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'video';
}

interface DojoSettings {
  name: string;
  logo_url: string | null;
  timer_config?: any;
}

interface ScheduleItem {
  id: string;
  media_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  media?: MediaItem;
}

interface RemoteControlProps {
  pairingCode: string;
  teacherId: string;
  onSendCommand: (type: string, payload?: any) => void;
  onClose: () => void;
}

const getYouTubeEmbedUrl = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}?autoplay=1&mute=1&loop=1&playlist=${match[2]}` : null;
};

function RemoteControl({ pairingCode, teacherId, onSendCommand, onClose }: RemoteControlProps) {
  const [activeTab, setActiveTab] = useState<'TIMER' | 'MEDIA' | 'SCHEDULE' | 'SETTINGS' | 'SCOREBOARD'>('TIMER');
  const [localConfig, setLocalConfig] = useState({
    prepTime: 10,
    workTime: 20,
    restTime: 10,
    cycles: 8,
    prepLabel: 'PREPARAÇÃO',
    workLabel: 'TRABALHO',
    restLabel: 'DESCANSO',
    prepColor: '#f59e0b',
    workColor: '#ef4444',
    restColor: '#22c55e',
    useTTS: false,
    prepAudioUrl: '',
    workAudioUrl: '',
    restAudioUrl: '',
    imageDuration: 15
  });
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [dojoSettings, setDojoSettings] = useState<DojoSettings>({ name: 'JUDO DOJO', logo_url: null });
  const [isUploading, setIsUploading] = useState(false);
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [showVolumePopup, setShowVolumePopup] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(50);
  const [newSchedule, setNewSchedule] = useState({
    media_ids: [] as string[],
    day_of_week: new Date().getDay(),
    start_time: '08:00',
    end_time: '10:00'
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const prepAudioRef = useRef<HTMLInputElement>(null);
  const workAudioRef = useRef<HTMLInputElement>(null);
  const restAudioRef = useRef<HTMLInputElement>(null);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!supabase) return;
      
      const { data: mediaData } = await supabase
        .from('media')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false });

      const { data: scheduleData } = await supabase
        .from('schedules')
        .select('*, media:media_id(*)')
        .eq('teacher_id', teacherId);

      const { data: settingsData } = await supabase
        .from('dojo_settings')
        .select('*')
        .eq('teacher_id', teacherId)
        .single();

      if (mediaData) {
        setMediaList(mediaData);
        if (mediaData.length > 0) {
          setNewSchedule(prev => ({ ...prev, media_id: mediaData[0].id }));
        }
      }
      if (scheduleData) setSchedules(scheduleData);
      if (settingsData) {
        setDojoSettings(settingsData);
        if (settingsData.timer_config) {
          setLocalConfig(prev => ({ ...prev, ...settingsData.timer_config }));
        }
      }
    };

    fetchData();
  }, [teacherId]);

  const handleCommand = (type: string, payload?: any) => {
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    onSendCommand(type, payload);
  };

  const updateConfig = async (field: string, value: number) => {
    const newConfig = { ...localConfig, [field]: value };
    setLocalConfig(newConfig);
    handleCommand('CONFIG_UPDATE', newConfig);
    
    if (supabase && teacherId) {
      await supabase.from('dojo_settings').update({ timer_config: newConfig }).eq('teacher_id', teacherId);
    }
  };

  const updateLabel = async (field: string, value: string) => {
    const newConfig = { ...localConfig, [field]: value };
    setLocalConfig(newConfig);
    handleCommand('CONFIG_UPDATE', newConfig);
    
    if (supabase && teacherId) {
      await supabase.from('dojo_settings').update({ timer_config: newConfig }).eq('teacher_id', teacherId);
    }
  };

  const updateColor = async (field: string, value: string) => {
    const newConfig = { ...localConfig, [field]: value };
    setLocalConfig(newConfig);
    handleCommand('CONFIG_UPDATE', newConfig);
    
    if (supabase && teacherId) {
      await supabase.from('dojo_settings').update({ timer_config: newConfig }).eq('teacher_id', teacherId);
    }
  };

  const handleAddMediaUrl = async () => {
    if (!mediaUrlInput || !supabase) return;
    
    setIsUploading(true);
    try {
      const isYouTube = mediaUrlInput.includes('youtube.com') || mediaUrlInput.includes('youtu.be');
      const isVideo = isYouTube || mediaUrlInput.match(/\.(mp4|webm|ogg|mov)$|vimeo\.com/i);
      const type = isVideo ? 'video' : 'image';
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
          type: type
        }])
        .select()
        .single();

      if (dbError) throw dbError;
      setMediaList([mediaData, ...mediaList]);
      setMediaUrlInput('');
      setShowUrlInput(false);
      if (newSchedule.media_ids.length === 0) {
        setNewSchedule(prev => ({ ...prev, media_ids: [mediaData.id] }));
      }
    } catch (error: any) {
      console.error('URL add failed:', error);
      alert('Falha ao adicionar URL: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, mode: 'MEDIA' | 'LOGO' | 'PREP' | 'WORK' | 'REST' = 'MEDIA') => {
    const file = e.target.files?.[0];
    if (!file || !supabase) return;

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
      } else if (['PREP', 'WORK', 'REST'].includes(mode)) {
        const field = mode === 'PREP' ? 'prepAudioUrl' : mode === 'WORK' ? 'workAudioUrl' : 'restAudioUrl';
        const newConfig = { ...localConfig, [field]: publicUrl };
        setLocalConfig(newConfig);
        
        const { error: dbError } = await supabase
          .from('dojo_settings')
          .upsert({
            teacher_id: teacherId,
            timer_config: newConfig,
            updated_at: new Date().toISOString()
          });
        if (dbError) throw dbError;
        handleCommand('SETTINGS_UPDATE', { ...dojoSettings, timer_config: newConfig });
      } else {
        const type = file.type.startsWith('video') ? 'video' : 'image';
        const { data: mediaData, error: dbError } = await supabase
          .from('media')
          .insert([{
            teacher_id: teacherId,
            name: file.name,
            url: publicUrl,
            type: type
          }])
          .select()
          .single();

        if (dbError) throw dbError;
        setMediaList([mediaData, ...mediaList]);
        if (newSchedule.media_ids.length === 0) {
          setNewSchedule(prev => ({ ...prev, media_ids: [mediaData.id] }));
        }
      }
    } catch (error: any) {
      console.error('Upload failed:', error);
      alert('Falha no upload: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setIsUploading(false);
    }
  };

  const saveDojoName = async (name: string) => {
    if (!supabase) return;
    const { error } = await supabase
      .from('dojo_settings')
      .upsert({
        teacher_id: teacherId,
        name: name,
        updated_at: new Date().toISOString()
      });
    
    if (!error) {
      setDojoSettings(prev => ({ ...prev, name }));
      handleCommand('SETTINGS_UPDATE', { ...dojoSettings, name });
    }
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    handleCommand('TOGGLE_MUTE', newMuted);
  };

  const updateVolume = (val: number) => {
    setVolume(val);
    handleCommand('SET_VOLUME', val);
  };

  const addSchedule = async () => {
    if (!supabase) return;
    if (newSchedule.media_ids.length === 0) return alert('Selecione ao menos uma mídia!');
    
    const payloads = newSchedule.media_ids.map(id => ({
      teacher_id: teacherId,
      media_id: id,
      day_of_week: newSchedule.day_of_week,
      start_time: newSchedule.start_time,
      end_time: newSchedule.end_time
    }));

    const { data, error } = await supabase
      .from('schedules')
      .insert(payloads)
      .select('*, media:media_id(*)');

    if (data) {
      setSchedules([...schedules, ...data]);
      setShowAddSchedule(false);
      setNewSchedule(prev => ({ ...prev, media_ids: [] }));
    }
    if (error) console.error(error);
  };

  const deleteSchedule = async (id: string) => {
    if (!supabase) return;
    await supabase.from('schedules').delete().eq('id', id);
    setSchedules(schedules.filter(s => s.id !== id));
  };

  const deleteMedia = async (id: string, url: string) => {
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

  const toggleTTS = async (val: boolean) => {
    const newConfig = { ...localConfig, useTTS: val };
    setLocalConfig(newConfig);
    if (!supabase) return;
    await supabase.from('dojo_settings').upsert({ teacher_id: teacherId, timer_config: newConfig, updated_at: new Date().toISOString() });
    handleCommand('SETTINGS_UPDATE', { ...dojoSettings, timer_config: newConfig });
  };

  const removeAudio = async (field: string) => {
    const newConfig = { ...localConfig, [field]: '' };
    setLocalConfig(newConfig);
    if (!supabase) return;
    await supabase.from('dojo_settings').upsert({ teacher_id: teacherId, timer_config: newConfig, updated_at: new Date().toISOString() });
    handleCommand('SETTINGS_UPDATE', { ...dojoSettings, timer_config: newConfig });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center">
      <div className="w-full p-6 flex justify-between items-center border-b border-zinc-900">
        <div className="flex items-center gap-2">
          <SmartphoneIcon size={20} className="text-blue-500" />
          <span className="font-bold tracking-tighter">DOJO REMOTE</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button 
              onClick={() => setShowVolumePopup(!showVolumePopup)}
              className={`p-2 rounded-full transition-all ${!isMuted ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-zinc-800 text-zinc-500'}`}
              title="Ajustes de Áudio"
            >
              {isMuted ? <VolumeX size={18} /> : volume > 50 ? <Volume2 size={18} /> : <Volume1 size={18} />}
            </button>

            {showVolumePopup && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowVolumePopup(false)} />
                <div className="absolute top-full right-0 mt-2 w-64 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Áudio da TV</span>
                    <button onClick={toggleMute} className={`p-1.5 rounded-lg ${isMuted ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'}`}>
                      {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                  </div>
                  <div className="space-y-2">
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
              </>
            )}
          </div>
          <button onClick={onClose} className="text-zinc-500 flex items-center gap-1 text-sm bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800">
            <Monitor size={16} /> TV
          </button>
        </div>
      </div>

      <div className="w-full grid grid-cols-5 bg-zinc-900/50 p-1">
        <button onClick={() => setActiveTab('TIMER')} className={`py-3 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'TIMER' ? 'bg-zinc-800 text-white rounded-lg' : 'text-zinc-500'}`}>Treino</button>
        <button onClick={() => setActiveTab('SCOREBOARD')} className={`py-3 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'SCOREBOARD' ? 'bg-zinc-800 text-white rounded-lg' : 'text-zinc-500'}`}>Placar</button>
        <button onClick={() => setActiveTab('MEDIA')} className={`py-3 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'MEDIA' ? 'bg-zinc-800 text-white rounded-lg' : 'text-zinc-500'}`}>Mídias</button>
        <button onClick={() => setActiveTab('SCHEDULE')} className={`py-3 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'SCHEDULE' ? 'bg-zinc-800 text-white rounded-lg' : 'text-zinc-500'}`}>Agenda</button>
        <button onClick={() => setActiveTab('SETTINGS')} className={`py-3 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'SETTINGS' ? 'bg-zinc-800 text-white rounded-lg' : 'text-zinc-500'}`}>Dojo</button>
      </div>

      <div className="flex-1 w-full max-w-md p-6 overflow-y-auto space-y-8">
        {activeTab === 'TIMER' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-4">
              <motion.button whileTap={{ scale: 0.95, filter: 'brightness(1.2)' }} onClick={() => handleCommand('START')} className="bg-blue-600 py-6 rounded-3xl text-xl font-black shadow-xl">INICIAR TREINO</motion.button>
              <div className="grid grid-cols-2 gap-4">
                <motion.button whileTap={{ scale: 0.95, filter: 'brightness(1.2)' }} onClick={() => handleCommand('PAUSE')} className="bg-zinc-800 py-4 rounded-2xl font-bold">PAUSAR</motion.button>
                <motion.button whileTap={{ scale: 0.95, filter: 'brightness(1.2)' }} onClick={() => handleCommand('RESET')} className="bg-zinc-900 py-4 rounded-2xl font-bold text-zinc-400">RESET</motion.button>
              </div>
              <motion.button 
                whileTap={{ scale: 0.95, filter: 'brightness(1.2)' }}
                onClick={() => handleCommand('STOP_MEDIA')} 
                className="w-full bg-red-500/10 border border-red-500/20 py-4 rounded-2xl font-bold text-red-500 flex items-center justify-center gap-2"
              >
                <XCircle size={18} /> PARAR MÍDIA
              </motion.button>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 space-y-6">
              <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] text-center">Configurações</h3>
              <div className="space-y-4">
                {[
                  { label: 'Preparação', field: 'prepTime', icon: <TimerIcon size={16} /> },
                  { label: 'Trabalho', field: 'workTime', icon: <Zap size={16} className="text-red-500" /> },
                  { label: 'Descanso', field: 'restTime', icon: <Coffee size={16} className="text-green-500" /> },
                  { label: 'Ciclos', field: 'cycles', icon: <RotateCcw size={16} /> },
                ].map((item) => (
                  <div key={item.field} className="flex items-center justify-between bg-black/40 p-4 rounded-2xl border border-zinc-800/50">
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-500">{item.icon}</span>
                      <span className="font-medium text-sm">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <button onClick={() => updateConfig(item.field, Math.max(1, (localConfig as any)[item.field] - (item.field === 'cycles' ? 1 : 5)))} className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold">-</button>
                      <span className="w-8 text-center font-mono font-bold">{(localConfig as any)[item.field]}</span>
                      <button onClick={() => updateConfig(item.field, (localConfig as any)[item.field] + (item.field === 'cycles' ? 1 : 5))} className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold">+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 space-y-6">
              <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] text-center">Nomes e Cores das Fases</h3>
              <div className="space-y-6">
                {[
                  { label: 'Preparação', field: 'prepLabel', colorField: 'prepColor', audioField: 'prepAudioUrl', ref: prepAudioRef, mode: 'PREP' },
                  { label: 'Trabalho', field: 'workLabel', colorField: 'workColor', audioField: 'workAudioUrl', ref: workAudioRef, mode: 'WORK' },
                  { label: 'Descanso', field: 'restLabel', colorField: 'restColor', audioField: 'restAudioUrl', ref: restAudioRef, mode: 'REST' },
                ].map((item) => (
                  <div key={item.field} className="space-y-3 p-4 bg-black/20 rounded-2xl border border-zinc-800/30">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">{item.label}</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="color" 
                          value={(localConfig as any)[item.colorField]}
                          onChange={(e) => updateColor(item.colorField, e.target.value)}
                          className="w-6 h-6 rounded-full bg-transparent border-0 cursor-pointer overflow-hidden p-0"
                        />
                        <span className="text-[10px] font-mono text-zinc-600">{(localConfig as any)[item.colorField]}</span>
                      </div>
                    </div>
                    <input 
                      type="text" 
                      value={(localConfig as any)[item.field]}
                      onChange={(e) => updateLabel(item.field, e.target.value)}
                      className="w-full bg-black/40 border border-zinc-800/50 rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-500/50"
                      placeholder={`Ex: ${item.label}`}
                    />
                    
                    <div className="flex items-center gap-2 pt-1">
                      <button 
                        onClick={() => (item.ref.current as any).click()}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-bold uppercase tracking-tighter transition-all ${
                          (localConfig as any)[item.audioField] 
                            ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                            : 'bg-zinc-800/50 text-zinc-400 border border-zinc-800/50 hover:bg-zinc-800'
                        }`}
                      >
                        <Volume2 size={12} />
                        {(localConfig as any)[item.audioField] ? 'Áudio Personalizado' : 'Subir Áudio'}
                      </button>
                      {(localConfig as any)[item.audioField] && (
                        <button 
                          onClick={() => removeAudio(item.audioField)}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      <input 
                        type="file" 
                        ref={item.ref as any} 
                        onChange={(e) => handleFileUpload(e, item.mode as any)} 
                        className="hidden" 
                        accept="audio/*" 
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-zinc-800/50">
                <div className="flex items-center justify-between p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-xl text-blue-500">
                      <Volume2 size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold">Voz do Treinador (TTS)</p>
                      <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Lê o nome das fases (Sujeito a cota da API)</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => toggleTTS(!localConfig.useTTS)}
                    className={`w-12 h-6 rounded-full transition-all relative ${localConfig.useTTS ? 'bg-blue-600' : 'bg-zinc-800'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${localConfig.useTTS ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'SCOREBOARD' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleCommand('SHOW_SCOREBOARD')} className="bg-blue-600 py-4 rounded-2xl font-bold">MOSTRAR PLACAR</motion.button>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleCommand('HIDE_SCOREBOARD')} className="bg-zinc-800 py-4 rounded-2xl font-bold text-zinc-400">OCULTAR PLACAR</motion.button>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-6">
              <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] text-center">Controle de Luta</h3>
              
              <div className="flex items-center gap-4 bg-black/40 p-4 rounded-2xl border border-zinc-800/50">
                <span className="text-zinc-500"><TimerIcon size={16} /></span>
                <span className="font-medium text-sm flex-1">Tempo (min)</span>
                <div className="flex items-center gap-2">
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleCommand('SCOREBOARD_SET_MATCH_TIME', 60)} className="w-10 h-8 rounded-lg bg-zinc-800 flex items-center justify-center font-bold text-xs">1m</motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleCommand('SCOREBOARD_SET_MATCH_TIME', 120)} className="w-10 h-8 rounded-lg bg-zinc-800 flex items-center justify-center font-bold text-xs">2m</motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleCommand('SCOREBOARD_SET_MATCH_TIME', 180)} className="w-10 h-8 rounded-lg bg-zinc-800 flex items-center justify-center font-bold text-xs">3m</motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleCommand('SCOREBOARD_SET_MATCH_TIME', 240)} className="w-10 h-8 rounded-lg bg-zinc-800 flex items-center justify-center font-bold text-xs">4m</motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleCommand('SCOREBOARD_SET_MATCH_TIME', 300)} className="w-10 h-8 rounded-lg bg-zinc-800 flex items-center justify-center font-bold text-xs">5m</motion.button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_START_MATCH')} className="bg-green-600 py-3 rounded-xl font-bold text-xs">HAJIME</motion.button>
                <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_PAUSE_MATCH')} className="bg-yellow-600 py-3 rounded-xl font-bold text-xs">MATTE</motion.button>
                <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_RESET_MATCH')} className="bg-red-600 py-3 rounded-xl font-bold text-xs">RESET</motion.button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Blue Player */}
              <div className="bg-blue-900/30 border border-blue-500/30 p-4 rounded-3xl space-y-4">
                <h4 className="text-center font-black text-blue-400 uppercase tracking-widest">Azul</h4>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'ippon', value: 1 })} className="flex-1 bg-blue-600 py-3 rounded-xl font-bold text-sm">+ IPPON</motion.button>
                    <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'ippon', value: -1 })} className="w-12 bg-blue-600/30 py-3 rounded-xl font-bold text-sm">-1</motion.button>
                  </div>
                  <div className="flex gap-2">
                    <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'wazaari', value: 1 })} className="flex-1 bg-blue-600/50 py-3 rounded-xl font-bold text-sm">+ WAZA-ARI</motion.button>
                    <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'wazaari', value: -1 })} className="w-12 bg-blue-600/20 py-3 rounded-xl font-bold text-sm">-1</motion.button>
                  </div>
                  <div className="flex gap-2">
                    <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'yuko', value: 1 })} className="flex-1 bg-blue-600/30 py-3 rounded-xl font-bold text-sm">+ YUKO</motion.button>
                    <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'yuko', value: -1 })} className="w-12 bg-blue-600/10 py-3 rounded-xl font-bold text-sm">-1</motion.button>
                  </div>
                  <div className="flex gap-2">
                    <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'shido', value: 1 })} className="flex-1 bg-yellow-500/20 text-yellow-500 py-3 rounded-xl font-bold text-sm">+ SHIDO</motion.button>
                    <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'blue', type: 'shido', value: -1 })} className="w-12 bg-yellow-500/10 text-yellow-500 py-3 rounded-xl font-bold text-sm">-1</motion.button>
                  </div>
                </div>
                <div className="pt-4 border-t border-blue-500/20">
                  <motion.button whileTap={{ scale: 0.9, filter: 'brightness(0.8)' }} onClick={() => handleCommand('SCOREBOARD_START_OSAEKOMI', 'blue')} className="w-full bg-white text-blue-900 py-3 rounded-xl font-black text-sm">OSAEKOMI</motion.button>
                </div>
              </div>

              {/* White Player */}
              <div className="bg-zinc-100 border border-white/30 p-4 rounded-3xl space-y-4">
                <h4 className="text-center font-black text-zinc-800 uppercase tracking-widest">Branco</h4>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'ippon', value: 1 })} className="flex-1 bg-zinc-300 text-black py-3 rounded-xl font-bold text-sm">+ IPPON</motion.button>
                    <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'ippon', value: -1 })} className="w-12 bg-zinc-300/50 text-black py-3 rounded-xl font-bold text-sm">-1</motion.button>
                  </div>
                  <div className="flex gap-2">
                    <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'wazaari', value: 1 })} className="flex-1 bg-zinc-200 text-black py-3 rounded-xl font-bold text-sm">+ WAZA-ARI</motion.button>
                    <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'wazaari', value: -1 })} className="w-12 bg-zinc-200/50 text-black py-3 rounded-xl font-bold text-sm">-1</motion.button>
                  </div>
                  <div className="flex gap-2">
                    <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'yuko', value: 1 })} className="flex-1 bg-zinc-300/50 text-black py-3 rounded-xl font-bold text-sm">+ YUKO</motion.button>
                    <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'yuko', value: -1 })} className="w-12 bg-zinc-300/30 text-black py-3 rounded-xl font-bold text-sm">-1</motion.button>
                  </div>
                  <div className="flex gap-2">
                    <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'shido', value: 1 })} className="flex-1 bg-yellow-400/30 text-yellow-700 py-3 rounded-xl font-bold text-sm">+ SHIDO</motion.button>
                    <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_UPDATE_SCORE', { player: 'white', type: 'shido', value: -1 })} className="w-12 bg-yellow-400/10 text-yellow-700 py-3 rounded-xl font-bold text-sm">-1</motion.button>
                  </div>
                </div>
                <div className="pt-4 border-t border-zinc-300">
                  <motion.button whileTap={{ scale: 0.9, filter: 'brightness(1.5)' }} onClick={() => handleCommand('SCOREBOARD_START_OSAEKOMI', 'white')} className="w-full bg-black text-white py-3 rounded-xl font-black text-sm">OSAEKOMI</motion.button>
                </div>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-3xl">
              <motion.button whileTap={{ scale: 0.95, filter: 'brightness(1.2)' }} onClick={() => handleCommand('SCOREBOARD_STOP_OSAEKOMI')} className="w-full bg-red-500/20 text-red-500 py-4 rounded-xl font-bold">TOKETA (Parar Osaekomi)</motion.button>
            </div>
          </div>
        )}

        {activeTab === 'MEDIA' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">Biblioteca</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleCommand('STOP_MEDIA')} 
                  className="p-2 rounded-full bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors"
                  title="Interromper Mídia"
                >
                  <XCircle size={20} />
                </button>
                <button 
                  onClick={() => setShowUrlInput(!showUrlInput)} 
                  className={`p-2 rounded-full transition-colors ${showUrlInput ? 'bg-blue-500/20 text-blue-500' : 'bg-zinc-800 text-zinc-400'}`}
                >
                  <Plus size={20} />
                </button>
                <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="bg-blue-600 p-2 rounded-full text-white">
                  {isUploading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
                </button>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*,video/*" />
            </div>

            {showUrlInput && (
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Adicionar via URL</p>
                <div className="flex gap-2">
                  <input 
                    type="url" 
                    value={mediaUrlInput}
                    onChange={(e) => setMediaUrlInput(e.target.value)}
                    placeholder="https://exemplo.com/imagem.jpg"
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
            )}

            <div className="grid grid-cols-2 gap-4">
              {mediaList.map((item) => {
                const isYouTube = item.url.includes('youtube.com') || item.url.includes('youtu.be');
                return (
                  <div key={item.id} className="group relative bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 aspect-square">
                    {item.type === 'image' ? (
                      <img src={item.url} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                        {isYouTube ? <Youtube className="text-red-600" size={40} /> : <Video className="text-zinc-600" size={40} />}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                      <button onClick={() => handleCommand('SHOW_MEDIA', item)} className="bg-white text-black p-3 rounded-full"><PlayCircle size={24} /></button>
                      <button onClick={() => deleteMedia(item.id, item.url)} className="text-red-500 p-2"><Trash2 size={20} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'SCHEDULE' && (
          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Tempo de Exibição de Imagens (segundos)</label>
                <p className="text-xs text-zinc-600">Define quanto tempo cada imagem ou vídeo do YouTube ficará na tela antes de alternar.</p>
                <input 
                  type="number" 
                  min="5"
                  max="300"
                  defaultValue={localConfig.imageDuration || 15}
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
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Mídias (Selecione uma ou mais)</label>
                  <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2 bg-black rounded-xl border border-zinc-800">
                    {mediaList.map(m => (
                      <div 
                        key={m.id}
                        onClick={() => {
                          setNewSchedule(prev => ({
                            ...prev,
                            media_ids: prev.media_ids.includes(m.id) 
                              ? prev.media_ids.filter(id => id !== m.id)
                              : [...prev.media_ids, m.id]
                          }))
                        }}
                        className={`relative aspect-video rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${newSchedule.media_ids.includes(m.id) ? 'border-blue-500 scale-95' : 'border-transparent hover:border-zinc-700'}`}
                      >
                        {m.type === 'image' ? <img src={m.url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-zinc-800 flex items-center justify-center"><Video size={20} className="text-zinc-500" /></div>}
                        {newSchedule.media_ids.includes(m.id) && (
                          <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                            <div className="bg-blue-500 text-white rounded-full p-1"><Check size={16} /></div>
                          </div>
                        )}
                      </div>
                    ))}
                    {mediaList.length === 0 && <div className="col-span-3 text-center text-xs text-zinc-500 py-4">Nenhuma mídia disponível</div>}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Dia da Semana</label>
                  <div className="grid grid-cols-7 gap-1">
                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => (
                      <button
                        key={i}
                        onClick={() => setNewSchedule({...newSchedule, day_of_week: i})}
                        className={`py-2 rounded-lg text-xs font-bold transition-all ${newSchedule.day_of_week === i ? 'bg-blue-600 text-white' : 'bg-black text-zinc-500 border border-zinc-800'}`}
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
                  onClick={addSchedule}
                  className="w-full bg-blue-600 py-4 rounded-2xl font-bold text-sm shadow-lg active:scale-95 transition-all mt-2"
                >
                  SALVAR AGENDAMENTO
                </button>
              </div>
            )}

            <div className="space-y-4">
              {schedules.map((s) => (
                <div key={s.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-zinc-800 overflow-hidden">
                      {s.media?.type === 'image' ? <img src={s.media.url} className="w-full h-full object-cover" /> : <Video className="m-auto text-zinc-600 mt-3" size={20} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                        <Calendar size={12} /> {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][s.day_of_week]}
                        <span className="text-zinc-600 ml-1">•</span>
                        <span className="text-blue-400 truncate max-w-[80px]">{s.media?.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <Clock size={12} /> {s.start_time} - {s.end_time}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => deleteSchedule(s.id)} className="text-zinc-600 hover:text-red-500 p-2">
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
              {schedules.length === 0 && (
                <div className="py-12 text-center border-2 border-dashed border-zinc-900 rounded-3xl">
                  <Calendar className="mx-auto text-zinc-800 mb-4" size={40} />
                  <p className="text-zinc-600 text-xs">Nenhum agendamento criado</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'SETTINGS' && (
          <div className="space-y-8">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-6">
              <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] text-center">Configuração do Dojo</h3>
              
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Nome do Dojo</label>
                <input 
                  type="text" 
                  defaultValue={dojoSettings.name}
                  onBlur={(e) => saveDojoName(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                  placeholder="Ex: Dojo Central"
                />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Logomarca</label>
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
    </div>
  );
}

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const codeFromUrl = urlParams.get('code');

  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(codeFromUrl);
  const [remoteCommand, setRemoteCommand] = useState<{ type: string; payload?: any } | null>(null);
  const [viewMode, setViewMode] = useState<'TV' | 'REMOTE'>(codeFromUrl ? 'REMOTE' : 'TV');
  const [showSplash, setShowSplash] = useState(true);
  const [activeMedia, setActiveMedia] = useState<MediaItem | null>(null);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [dojoSettings, setDojoSettings] = useState<DojoSettings>({ name: 'JUDO DOJO', logo_url: null });
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isScoreboardActive, setIsScoreboardActive] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(50);

  // Fetch schedules and settings for TV
  useEffect(() => {
    if (!teacherId || viewMode !== 'TV' || !supabase) return;
    const fetchData = async () => {
      const { data: scheduleData } = await supabase.from('schedules').select('*, media:media_id(*)').eq('teacher_id', teacherId);
      if (scheduleData) setSchedules(scheduleData);

      const { data: settingsData } = await supabase.from('dojo_settings').select('*').eq('teacher_id', teacherId).single();
      if (settingsData) setDojoSettings(settingsData);
      setIsLoadingSettings(false);
    };
    fetchData();
  }, [teacherId, viewMode]);

  useEffect(() => {
    if (viewMode === 'TV' && teacherId && !isLoadingSettings) {
      const timer = setTimeout(() => setShowSplash(false), 4000);
      return () => clearTimeout(timer);
    } else if (viewMode === 'REMOTE') {
      setShowSplash(true);
    }
  }, [viewMode, teacherId, isLoadingSettings]);

  // Listen for remote commands
  useEffect(() => {
    if (!teacherId || !pairingCode || !supabase) return;

    const channel = supabase
      .channel(`remote-control-${pairingCode}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${pairingCode}` }, (payload) => {
        if (payload.new.last_command) {
          const cmd = payload.new.last_command;
          setRemoteCommand(cmd);
          if (cmd.type === 'START') {
            setIsTimerActive(true);
            setIsScoreboardActive(false);
          }
          if (cmd.type === 'PAUSE') setIsTimerActive(false);
          if (cmd.type === 'RESET') {
            setIsTimerActive(false);
            setActiveMedia(null);
          }
          if (cmd.type === 'SHOW_MEDIA') {
            setActiveMedia(cmd.payload);
            setIsScoreboardActive(false);
          }
          if (cmd.type === 'STOP_MEDIA') setActiveMedia(null);
          if (cmd.type === 'SHOW_SCOREBOARD') {
            setIsScoreboardActive(true);
            setIsTimerActive(false);
            setActiveMedia(null);
          }
          if (cmd.type === 'HIDE_SCOREBOARD') setIsScoreboardActive(false);
          if (cmd.type === 'SETTINGS_UPDATE') setDojoSettings(cmd.payload);
          if (cmd.type === 'TOGGLE_MUTE') setIsMuted(cmd.payload);
          if (cmd.type === 'SET_VOLUME') setVolume(cmd.payload);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [teacherId, pairingCode]);

  const sendRemoteCommand = async (commandType: string, payload?: any) => {
    if (!pairingCode || !supabase) return;
    
    const { error } = await supabase
      .from('sessions')
      .update({ 
        last_command: { 
          type: commandType, 
          payload, 
          timestamp: new Date().toISOString() 
        } 
      })
      .eq('id', pairingCode);

    if (error) console.error('Error sending command:', error);
  };

  const [scheduleIndex, setScheduleIndex] = useState(0);
  const [currentClock, setCurrentClock] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentClock(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Logic to find current scheduled media
  const activeSchedules = useMemo(() => {
    if (isTimerActive || activeMedia) return []; // Priority: Timer > Manual Media > Schedule

    const currentDay = currentClock.getDay();
    const currentTimeStr = `${currentClock.getHours().toString().padStart(2, '0')}:${currentClock.getMinutes().toString().padStart(2, '0')}`;

    return schedules.filter(s => 
      s.day_of_week === currentDay && 
      currentTimeStr >= s.start_time && 
      currentTimeStr <= s.end_time
    );
  }, [schedules, isTimerActive, activeMedia, currentClock]);

  const currentScheduledMedia = useMemo(() => {
    if (activeSchedules.length === 0) return null;
    return activeSchedules[scheduleIndex % activeSchedules.length]?.media || null;
  }, [activeSchedules, scheduleIndex]);

  useEffect(() => {
    if (!currentScheduledMedia || activeSchedules.length <= 1) return;

    let timeout: NodeJS.Timeout;
    const isYouTube = currentScheduledMedia.url.includes('youtube.com') || currentScheduledMedia.url.includes('youtu.be');

    // For images and YouTube videos (since we can't easily detect YT end without API), use a timer
    if (currentScheduledMedia.type === 'image' || isYouTube) {
      const duration = (dojoSettings.timer_config?.imageDuration || 15) * 1000;
      timeout = setTimeout(() => {
        setScheduleIndex(prev => prev + 1);
      }, duration);
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [currentScheduledMedia, activeSchedules.length, dojoSettings.timer_config?.imageDuration]);

  const getYouTubeEmbedUrl = (url: string, muted: boolean, loop: boolean) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    const muteParam = muted ? '1' : '0';
    const loopParam = loop ? '1' : '0';
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}?autoplay=1&mute=${muteParam}&loop=${loopParam}&playlist=${match[2]}` : null;
  };

  const renderMedia = (media: MediaItem, isScheduled: boolean) => {
    const shouldLoop = !isScheduled || activeSchedules.length <= 1;
    const youtubeUrl = getYouTubeEmbedUrl(media.url, isMuted, shouldLoop);
    
    if (youtubeUrl) {
      return <iframe src={youtubeUrl} className="w-full h-full border-0" allow="autoplay; encrypted-media" allowFullScreen />;
    }
    if (media.type === 'video') {
      return (
        <video 
          key={media.url}
          src={media.url} 
          autoPlay 
          loop={shouldLoop} 
          muted={isMuted} 
          ref={(el) => { if (el) el.volume = volume / 100; }}
          onEnded={() => {
            if (!shouldLoop) setScheduleIndex(prev => prev + 1);
          }}
          className="w-full h-full object-cover" 
        />
      );
    }
    return (
      <motion.img 
        key={media.url} 
        src={media.url} 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1 }}
        className="w-full h-full object-contain" 
      />
    );
  };

  if (!teacherId) {
    if (viewMode === 'REMOTE' && pairingCode) {
      return <RemotePairing pairingCode={pairingCode} onPaired={(id) => setTeacherId(id)} />;
    }
    return <TVPairing onPaired={(id, code) => { setTeacherId(id); setPairingCode(code); }} />;
  }

  if (viewMode === 'REMOTE' && pairingCode) {
    return <RemoteControl pairingCode={pairingCode} teacherId={teacherId} onSendCommand={sendRemoteCommand} onClose={() => {
      // Clear URL parameter when closing remote
      window.history.replaceState({}, document.title, window.location.pathname);
      setViewMode('TV');
    }} />;
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-12 overflow-hidden">
      <AnimatePresence mode="wait">
        {showSplash ? (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 1 }}
            className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-24"
          >
            {dojoSettings.logo_url ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
                className="w-full max-w-3xl aspect-square flex items-center justify-center"
              >
                <img 
                  src={dojoSettings.logo_url} 
                  className="w-full h-full object-contain drop-shadow-[0_0_50px_rgba(255,255,255,0.2)]" 
                  referrerPolicy="no-referrer"
                />
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-6"
              >
                <Loader2 className="w-12 h-12 text-zinc-700 animate-spin" />
                <p className="text-zinc-700 font-mono text-xs tracking-[0.5em] uppercase">Carregando Dojo</p>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="w-full h-full flex flex-col items-center justify-center relative"
          >
            {!isLoadingSettings && (
              <>
                {/* Status Bar */}
                <div className="fixed top-0 left-0 w-full p-8 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-10">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-zinc-500 font-mono text-sm tracking-widest">CONECTADO</span>
                    </div>
                    <button onClick={() => setViewMode('REMOTE')} className="text-zinc-500 hover:text-blue-400 flex items-center gap-2 text-xs font-bold uppercase border border-zinc-800 px-3 py-1 rounded-full">
                      <SmartphoneIcon size={14} /> Modo Controle
                    </button>
                  </div>
                  <button onClick={() => { setTeacherId(null); setPairingCode(null); }} className="flex items-center gap-2 text-zinc-600 hover:text-red-500 transition-colors bg-zinc-900/50 px-4 py-2 rounded-full border border-zinc-800">
                    <LogOut size={16} />
                    <span className="text-xs font-bold uppercase tracking-tighter">Desconectar</span>
                  </button>
                </div>

                <div className="w-full max-w-7xl mx-auto flex flex-col items-center justify-center h-full relative">
                  {/* Display Logic */}
                  {isScoreboardActive ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <Scoreboard externalCommand={remoteCommand} />
                    </div>
                  ) : isTimerActive ? (
                    <div className={`w-full h-full flex items-center justify-center ${activeMedia ? 'grid grid-cols-2 gap-12' : ''}`}>
                      <TabataTimer 
                        externalCommand={remoteCommand} 
                        isMuted={isMuted} 
                        volume={volume} 
                        initialConfig={dojoSettings.timer_config}
                      />
                      {activeMedia && (
                        <div className="relative aspect-video bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl">
                          {renderMedia(activeMedia, false)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {activeMedia || currentScheduledMedia ? (
                        <div className="relative w-full max-w-5xl aspect-video bg-zinc-900 rounded-[3rem] overflow-hidden border border-zinc-800 shadow-2xl">
                          {renderMedia((activeMedia || currentScheduledMedia)!, !activeMedia)}
                          <div className="absolute top-8 left-8 bg-black/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10">
                            <p className="text-lg font-black uppercase tracking-widest flex items-center gap-3">
                              {activeMedia ? <PlayCircle className="text-blue-500" /> : <Calendar className="text-amber-500" />}
                              {activeMedia ? 'AO VIVO' : 'PROGRAMADO'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center space-y-12">
                          {dojoSettings.logo_url ? (
                            <div className="w-96 h-96 mx-auto bg-zinc-900/50 rounded-[4rem] p-12 border border-zinc-800 shadow-2xl flex items-center justify-center animate-pulse">
                              <img src={dojoSettings.logo_url} className="w-full h-full object-contain" />
                            </div>
                          ) : (
                            <TabataTimer 
                              externalCommand={remoteCommand} 
                              isMuted={isMuted} 
                              volume={volume} 
                              initialConfig={dojoSettings.timer_config}
                            />
                          )}
                          <p className="text-zinc-700 font-mono text-sm tracking-[0.5em] uppercase">
                            {dojoSettings.logo_url ? 'Modo Standby' : 'Aguardando Comando ou Agenda'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="fixed bottom-0 left-0 w-full p-8 flex justify-center opacity-10 pointer-events-none">
                  <span className="text-9xl font-black tracking-tighter select-none uppercase">{dojoSettings.name}</span>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
