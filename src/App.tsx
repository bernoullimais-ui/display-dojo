import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import TVPairing from './components/TVPairing';
import RemotePairing from './components/RemotePairing';
import { Auth } from './components/Auth';
import TabataTimer from './components/TabataTimer';
import Scoreboard from './components/Scoreboard';
import DigitalClock from './components/DigitalClock';
import AdminPanel from './components/AdminPanel';
import SponsorReports from './components/SponsorReports';
import { LogOut, Smartphone as SmartphoneIcon, Monitor, Timer as TimerIcon, Zap, Coffee, RotateCcw, Image as ImageIcon, Video, Upload, Trash2, PlayCircle, Loader2, Calendar, Clock, Plus, Youtube, Volume2, VolumeX, Volume1, XCircle, Check, Maximize, Edit, Settings, Lock, Crown, Star, Tv, PlusCircle, QrCode } from 'lucide-react';
import { supabase } from './lib/supabase';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface MediaItem {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'video';
  sponsor_name?: string;
  teacher_id?: string;
}

interface TimerPreset {
  id: string;
  name: string;
  config: {
    prepTime: number;
    workTime: number;
    restTime: number;
    cycles: number;
    prepLabel: string;
    workLabel: string;
    restLabel: string;
  };
}

interface Playlist {
  id: string;
  name: string;
  media_ids: string[];
}

interface DojoSettings {
  name: string;
  logo_url: string | null;
  timer_config?: any;
  presets?: TimerPreset[];
  scoreboard_config?: {
    blueName: string;
    whiteName: string;
    category: string;
  };
  ticker_config?: {
    text: string;
    active: boolean;
  };
  playlists?: Playlist[];
  subscription_tier?: 'FREE' | 'PRO' | 'PREMIUM';
}

interface ScheduleItem {
  id: string;
  media_id?: string;
  playlist_id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  media?: MediaItem;
}

interface RemoteControlProps {
  initialPairingCode: string;
  teacherId: string;
  onSendCommand: (targetTvId: string, type: string, payload?: any) => void;
  onClose: () => void;
}

const getYouTubeEmbedUrl = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}?autoplay=1&mute=1&loop=1&playlist=${match[2]}` : null;
};

function RemoteControl({ initialPairingCode, teacherId, onSendCommand, onClose }: RemoteControlProps) {
  const [activeTvId, setActiveTvId] = useState<string>(initialPairingCode);
  const [tvSessions, setTvSessions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'TIMER' | 'SCOREBOARD' | 'MEDIA_HUB' | 'PLAN'>('TIMER');
  const [activeSubTab, setActiveSubTab] = useState<'LIBRARY' | 'SCHEDULE' | 'DOJO' | 'TICKER' | 'PLAYLISTS'>('LIBRARY');
  const [planSubTab, setPlanSubTab] = useState<'INFO' | 'REPORTS'>('INFO');
  const [scoreboardConfig, setScoreboardConfig] = useState({
    blueName: 'AZUL',
    whiteName: 'BRANCO',
    category: ''
  });
  const [tickerConfig, setTickerConfig] = useState({
    text: '',
    active: false
  });
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
    imageDuration: 15,
    splashDuration: 4
  });
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [dojoSettings, setDojoSettings] = useState<DojoSettings>({ name: 'JUDO DOJO', logo_url: null });
  const [isUploading, setIsUploading] = useState(false);
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [showPresetManager, setShowPresetManager] = useState(false);
  const [editingPreset, setEditingPreset] = useState<TimerPreset | null>(null);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [mediaSponsorInput, setMediaSponsorInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [showVolumePopup, setShowVolumePopup] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(50);
  const tier = dojoSettings.subscription_tier || 'FREE';
  const isStarter = ['STARTER', 'PRO', 'PREMIUM', 'BUSINESS'].includes(tier);
  const isPro = ['PRO', 'PREMIUM', 'BUSINESS'].includes(tier);
  const isBusiness = ['BUSINESS'].includes(tier);
  const [newSchedule, setNewSchedule] = useState({
    playlist_id: '',
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
        .in('teacher_id', [teacherId, 'GLOBAL'])
        .order('created_at', { ascending: false });

      const { data: scheduleData } = await supabase
        .from('schedules')
        .select('*, media:media_id(*)')
        .eq('teacher_id', teacherId);

      const { data: settingsData } = await supabase
        .from('dojo_settings')
        .select('*')
        .eq('teacher_id', teacherId)
        .maybeSingle();

      const { data: globalSettingsData } = await supabase
        .from('dojo_settings')
        .select('*')
        .eq('teacher_id', 'GLOBAL')
        .maybeSingle();

      if (mediaData) {
        setMediaList(mediaData);
      }
      if (scheduleData) setSchedules(scheduleData);
      
      const mergedSettings = {
        ...globalSettingsData,
        ...settingsData,
        name: settingsData?.name || globalSettingsData?.name || 'Meu Dojo',
        logo_url: settingsData?.logo_url || globalSettingsData?.logo_url || ''
      };

      if (mergedSettings) {
        setDojoSettings(mergedSettings);
        if (mergedSettings.timer_config) {
          setLocalConfig(prev => ({ ...prev, ...mergedSettings.timer_config }));
        }
        if (mergedSettings.scoreboard_config) {
          setScoreboardConfig(prev => ({ ...prev, ...mergedSettings.scoreboard_config }));
        }
        if (mergedSettings.ticker_config) {
          setTickerConfig(prev => ({ ...prev, ...mergedSettings.ticker_config }));
        }
      }
    };

    fetchData();
  }, [teacherId]);

  const [showTvManager, setShowTvManager] = useState(false);
  const [showAddTv, setShowAddTv] = useState(false);
  const [newTvCode, setNewTvCode] = useState('');
  const [addTvError, setAddTvError] = useState('');
  const [isAddingTv, setIsAddingTv] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [disconnectedId, setDisconnectedId] = useState<string | null>(null);

  useEffect(() => {
    if (isScanning) {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );

      scanner.render(
        (decodedText) => {
          // The QR code contains the URL, e.g., https://app.com/?code=A1B2C3
          try {
            const url = new URL(decodedText);
            const code = url.searchParams.get('code');
            if (code) {
              setNewTvCode(code);
              setIsScanning(false);
              scanner.clear();
            } else {
              // Maybe it's just the code itself
              if (decodedText.length === 6) {
                setNewTvCode(decodedText);
                setIsScanning(false);
                scanner.clear();
              }
            }
          } catch (e) {
            // Not a URL, maybe just the code
            if (decodedText.length === 6) {
              setNewTvCode(decodedText);
              setIsScanning(false);
              scanner.clear();
            }
          }
        },
        (error) => {
          // Ignore scan errors (happens when no QR code is in frame)
        }
      );

      return () => {
        scanner.clear().catch(console.error);
      };
    }
  }, [isScanning]);

  useEffect(() => {
    if (!supabase) return;
    const fetchSessions = async () => {
      const { data } = await supabase
        .from('sessions')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('status', 'paired');
      if (data) setTvSessions(data);
    };
    fetchSessions();
    
    const channel = supabase.channel(`tv-sessions-remote-${teacherId}-${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `teacher_id=eq.${teacherId}` }, () => {
        fetchSessions();
      }).subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [teacherId]);

  useEffect(() => {
    if (activeTvId !== 'ALL' && tvSessions.length > 0 && !tvSessions.find(s => s.id === activeTvId)) {
      setActiveTvId('ALL');
    }
  }, [tvSessions, activeTvId]);

  const handleCommand = (type: string, payload?: any) => {
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    onSendCommand(activeTvId, type, payload);
  };

  const updateConfig = async (field: string, value: number) => {
    const newConfig = { ...localConfig, [field]: value };
    setLocalConfig(newConfig);
    handleCommand('CONFIG_UPDATE', newConfig);
    
    if (supabase && teacherId) {
      await supabase.from('dojo_settings').update({ timer_config: newConfig }).eq('teacher_id', teacherId);
    }
  };

  const updateScoreboardConfig = async (field: 'blueName' | 'whiteName' | 'category', value: string) => {
    const newConfig = { ...scoreboardConfig, [field]: value };
    setScoreboardConfig(newConfig);
    
    if (field === 'category') {
      handleCommand('SCOREBOARD_SET_CATEGORY', value);
    } else {
      handleCommand('SCOREBOARD_SET_NAMES', { 
        blue: field === 'blueName' ? value : scoreboardConfig.blueName,
        white: field === 'whiteName' ? value : scoreboardConfig.whiteName
      });
    }
    
    if (supabase && teacherId) {
      await supabase.from('dojo_settings').update({ scoreboard_config: newConfig }).eq('teacher_id', teacherId);
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

  const updatePlaylists = async (newPlaylists: Playlist[]) => {
    const newSettings = { ...dojoSettings, playlists: newPlaylists };
    setDojoSettings(newSettings);
    if (supabase && teacherId) {
      await supabase.from('dojo_settings').update({ playlists: newPlaylists }).eq('teacher_id', teacherId);
    }
  };

  const handleConfigChange = async (newSettings: Partial<typeof localConfig>) => {
    const newConfig = { ...localConfig, ...newSettings };
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

  const defaultPresets: TimerPreset[] = [
    { id: '1', name: 'Randori', config: { prepTime: 10, workTime: 300, restTime: 60, cycles: 5, prepLabel: 'PREPARAÇÃO', workLabel: 'RANDORI', restLabel: 'DESCANSO' } },
    { id: '2', name: 'Uchikomi', config: { prepTime: 10, workTime: 60, restTime: 10, cycles: 10, prepLabel: 'PREPARAÇÃO', workLabel: 'UCHIKOMI', restLabel: 'TROCA' } },
    { id: '3', name: 'Tabata', config: { prepTime: 10, workTime: 20, restTime: 10, cycles: 8, prepLabel: 'PREPARAÇÃO', workLabel: 'TRABALHO', restLabel: 'DESCANSO' } },
    { id: '4', name: 'Newaza', config: { prepTime: 10, workTime: 120, restTime: 30, cycles: 6, prepLabel: 'PREPARAÇÃO', workLabel: 'NEWAZA', restLabel: 'DESCANSO' } }
  ];

  const activePresets = dojoSettings.presets || defaultPresets;

  const savePreset = async (preset: TimerPreset) => {
    if (!supabase || !teacherId) return;
    
    let newPresets = [...activePresets];
    const existingIndex = newPresets.findIndex(p => p.id === preset.id);
    
    if (existingIndex >= 0) {
      newPresets[existingIndex] = preset;
    } else {
      newPresets.push(preset);
    }

    const newSettings = { ...dojoSettings, presets: newPresets };
    setDojoSettings(newSettings);
    
    await supabase.from('dojo_settings').update({ presets: newPresets }).eq('teacher_id', teacherId);
    setEditingPreset(null);
    setShowPresetManager(false);
  };

  const deletePreset = async (id: string) => {
    if (!supabase || !teacherId) return;
    
    const newPresets = activePresets.filter(p => p.id !== id);
    const newSettings = { ...dojoSettings, presets: newPresets };
    setDojoSettings(newSettings);
    
    await supabase.from('dojo_settings').update({ presets: newPresets }).eq('teacher_id', teacherId);
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, mode: 'MEDIA' | 'LOGO' | 'PREP' | 'WORK' | 'REST' = 'MEDIA') => {
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

      // Check tier
      const { data: settings } = await supabase
        .from('dojo_settings')
        .select('subscription_tier')
        .eq('teacher_id', teacherId)
        .single();
        
      const isBiz = settings?.subscription_tier === 'BUSINESS';

      if (!isBiz) {
        // Unpair any existing sessions for this teacher if not Business
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

      const { error: updateError } = await supabase
        .from('sessions')
        .update({ status: 'paired', teacher_id: teacherId, tv_name: isBiz ? `TV ${tvSessions.length + 1}` : 'TV Principal' })
        .eq('id', code);

      if (updateError) {
        setAddTvError(`Erro ao conectar: ${updateError.message}`);
        setIsAddingTv(false);
        return;
      }

      setNewTvCode('');
      setShowAddTv(false);
      setActiveTvId(code); // Switch to the new TV
    } catch (err) {
      setAddTvError('Erro inesperado ao conectar.');
    }
    setIsAddingTv(false);
  };

  const updateVolume = (val: number) => {
    setVolume(val);
    handleCommand('SET_VOLUME', val);
  };

  const addSchedule = async () => {
    if (!supabase) return;
    if (!newSchedule.playlist_id) return alert('Selecione uma playlist!');
    
    const payload = {
      teacher_id: teacherId,
      playlist_id: newSchedule.playlist_id,
      day_of_week: newSchedule.day_of_week,
      start_time: newSchedule.start_time,
      end_time: newSchedule.end_time
    };

    const { data, error } = await supabase
      .from('schedules')
      .insert([payload])
      .select('*');

    if (data) {
      setSchedules([...schedules, ...data]);
      setShowAddSchedule(false);
      setNewSchedule(prev => ({ ...prev, playlist_id: '' }));
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

  if (showPresetManager) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center">
        <div className="w-full p-6 flex justify-between items-center border-b border-zinc-900">
          <div className="flex items-center gap-2">
            <button onClick={() => { setShowPresetManager(false); setEditingPreset(null); }} className="text-zinc-400 hover:text-white">
              <XCircle size={24} />
            </button>
            <span className="font-bold tracking-tighter">GERENCIAR PRESETS</span>
          </div>
          <button 
            onClick={() => setEditingPreset({ id: Math.random().toString(), name: 'Novo Preset', config: { prepTime: 10, workTime: 60, restTime: 10, cycles: 5, prepLabel: 'PREPARAÇÃO', workLabel: 'TRABALHO', restLabel: 'DESCANSO' } })}
            className="text-xs bg-blue-600 px-4 py-2 rounded-full font-bold uppercase tracking-wider"
          >
            + Novo
          </button>
        </div>

        <div className="flex-1 w-full max-w-md p-6 overflow-y-auto space-y-6">
          {editingPreset ? (
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-6">
              <div>
                <label className="text-xs text-zinc-500 font-bold uppercase mb-1 block">Nome do Preset</label>
                <input 
                  type="text" 
                  value={editingPreset.name}
                  onChange={(e) => setEditingPreset({ ...editingPreset, name: e.target.value })}
                  className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm focus:border-blue-500 outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-500 font-bold uppercase mb-1 block">Prep (s)</label>
                  <input type="number" value={editingPreset.config.prepTime} onChange={(e) => setEditingPreset({ ...editingPreset, config: { ...editingPreset.config, prepTime: Number(e.target.value) } })} className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 font-bold uppercase mb-1 block">Rótulo Prep</label>
                  <input type="text" value={editingPreset.config.prepLabel} onChange={(e) => setEditingPreset({ ...editingPreset, config: { ...editingPreset.config, prepLabel: e.target.value } })} className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-red-500 font-bold uppercase mb-1 block">Trab (s)</label>
                  <input type="number" value={editingPreset.config.workTime} onChange={(e) => setEditingPreset({ ...editingPreset, config: { ...editingPreset.config, workTime: Number(e.target.value) } })} className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-red-500 font-bold uppercase mb-1 block">Rótulo Trab</label>
                  <input type="text" value={editingPreset.config.workLabel} onChange={(e) => setEditingPreset({ ...editingPreset, config: { ...editingPreset.config, workLabel: e.target.value } })} className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-green-500 font-bold uppercase mb-1 block">Desc (s)</label>
                  <input type="number" value={editingPreset.config.restTime} onChange={(e) => setEditingPreset({ ...editingPreset, config: { ...editingPreset.config, restTime: Number(e.target.value) } })} className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-green-500 font-bold uppercase mb-1 block">Rótulo Desc</label>
                  <input type="text" value={editingPreset.config.restLabel} onChange={(e) => setEditingPreset({ ...editingPreset, config: { ...editingPreset.config, restLabel: e.target.value } })} className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-blue-400 font-bold uppercase mb-1 block">Ciclos</label>
                  <input type="number" value={editingPreset.config.cycles} onChange={(e) => setEditingPreset({ ...editingPreset, config: { ...editingPreset.config, cycles: Number(e.target.value) } })} className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm" />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={() => setEditingPreset(null)} className="flex-1 bg-zinc-800 py-3 rounded-xl font-bold text-sm">Cancelar</button>
                <button onClick={() => savePreset(editingPreset)} className="flex-1 bg-blue-600 py-3 rounded-xl font-bold text-sm">Salvar</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {activePresets.map(preset => (
                <div key={preset.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-lg">{preset.name}</h4>
                    <p className="text-xs text-zinc-500 mt-1">
                      {preset.config.workTime}s / {preset.config.restTime}s • {preset.config.cycles} ciclos
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingPreset(preset)} className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 text-blue-400"><Edit size={16} /></button>
                    <button onClick={() => deletePreset(preset.id)} className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 text-red-500"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

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
          <div className="flex items-center gap-2">
            <button onClick={() => setShowTvManager(true)} className="text-zinc-500 flex items-center gap-1 text-sm bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800 hover:text-white">
              <Tv size={16} /> TVs
            </button>
            <button onClick={() => setShowAddTv(true)} className="text-zinc-500 flex items-center gap-1 text-sm bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800 hover:text-white">
              <PlusCircle size={16} /> Incluir TV
            </button>
            <button onClick={async () => {
              if (supabase) {
                await supabase.auth.signOut();
                window.location.href = '/';
              }
            }} className="text-zinc-500 flex items-center gap-1 text-sm bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800 hover:text-red-500">
              <LogOut size={16} /> Sair
            </button>
          </div>
        </div>
      </div>

      {showTvManager && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl w-full max-w-md space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Gerenciar TVs</h3>
              <button onClick={() => setShowTvManager(false)} className="text-zinc-500 hover:text-white">
                <XCircle size={24} />
              </button>
            </div>
            <div className="space-y-4">
              <AnimatePresence>
                {tvSessions.map(session => (
                  <motion.div 
                    key={session.id} 
                    initial={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0, overflow: 'hidden', marginTop: 0, marginBottom: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center justify-between bg-black p-4 rounded-2xl border border-zinc-800"
                  >
                    <div>
                      <p className="font-bold text-white">{session.tv_name || 'TV Principal'}</p>
                      <p className="text-xs text-zinc-500 font-mono">Código: {session.id}</p>
                    </div>
                    <button 
                      onClick={async () => {
                        if (!supabase || disconnectingId === session.id || disconnectedId === session.id) return;
                        setDisconnectingId(session.id);
                        
                        // Optimistic UI: Show success state immediately
                        setDisconnectingId(null);
                        setDisconnectedId(session.id);
                        
                        // Delay the actual database update so the user can see the "Desconectado" state
                        setTimeout(async () => {
                          await supabase.from('sessions').update({ status: 'pending', teacher_id: null }).eq('id', session.id);
                          setDisconnectedId(null);
                        }, 1000);
                      }}
                      disabled={disconnectingId === session.id || disconnectedId === session.id}
                      className={`px-3 py-2 rounded-xl text-xs font-bold uppercase flex items-center gap-2 transition-all ${
                        disconnectedId === session.id 
                          ? 'text-green-500 bg-green-500/10' 
                          : 'text-red-500 bg-red-500/10 hover:bg-red-500/20'
                      }`}
                    >
                      {disconnectingId === session.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : disconnectedId === session.id ? (
                        <Check size={14} />
                      ) : null}
                      {disconnectedId === session.id ? 'Desconectado' : 'Desconectar'}
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
              {tvSessions.length === 0 && (
                <p className="text-zinc-500 text-center text-sm">Nenhuma TV conectada.</p>
              )}
            </div>
            <p className="text-xs text-zinc-500 text-center">
              Ao desconectar, a TV voltará para a tela de código, liberando espaço na sua cota. O código da TV permanecerá o mesmo.
            </p>
          </div>
        </div>
      )}

      {showAddTv && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl w-full max-w-md space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Incluir Nova TV</h3>
              <button onClick={() => { setShowAddTv(false); setIsScanning(false); }} className="text-zinc-500 hover:text-white">
                <XCircle size={24} />
              </button>
            </div>
            
            {isScanning ? (
              <div className="space-y-4">
                <div id="reader" className="w-full bg-black rounded-xl overflow-hidden border border-zinc-800"></div>
                <button 
                  onClick={() => setIsScanning(false)}
                  className="w-full bg-zinc-800 text-white py-3 rounded-xl font-bold hover:bg-zinc-700 transition-colors"
                >
                  Cancelar Leitura
                </button>
              </div>
            ) : (
              <>
                <form onSubmit={handleAddTv} className="space-y-4">
                  {addTvError && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-xl text-sm">
                      {addTvError}
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-xs font-bold uppercase text-zinc-500 mb-2">Código da TV</label>
                    <input 
                      type="text" 
                      value={newTvCode}
                      onChange={(e) => setNewTvCode(e.target.value)}
                      placeholder="Ex: A1B2C3"
                      className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-center text-2xl font-mono focus:border-blue-500 outline-none uppercase"
                      autoFocus
                      required
                      maxLength={6}
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={isAddingTv || newTvCode.length < 6}
                    className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isAddingTv ? <Loader2 className="animate-spin" size={20} /> : <PlusCircle size={20} />}
                    Sintonizar TV
                  </button>
                </form>

                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-zinc-800"></div>
                  <span className="flex-shrink-0 mx-4 text-zinc-500 text-xs uppercase font-bold">ou</span>
                  <div className="flex-grow border-t border-zinc-800"></div>
                </div>

                <button 
                  onClick={() => setIsScanning(true)}
                  className="w-full bg-zinc-800 text-white py-4 rounded-xl font-bold hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2"
                >
                  <QrCode size={20} />
                  Ler QR Code
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {tvSessions.length > 1 && (
        <div className="w-full bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTvId('ALL')}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
              activeTvId === 'ALL' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            Todas as TVs (Broadcast)
          </button>
          {tvSessions.map(session => (
            <button
              key={session.id}
              onClick={() => setActiveTvId(session.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 ${
                activeTvId === session.id ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              <Tv size={14} />
              {session.tv_name || 'TV'}
            </button>
          ))}
        </div>
      )}

      <div className="w-full grid grid-cols-4 bg-zinc-900/50 p-1">
        <button onClick={() => setActiveTab('TIMER')} className={`py-3 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'TIMER' ? 'bg-zinc-800 text-white rounded-lg' : 'text-zinc-500'}`}>Treino</button>
        <button onClick={() => setActiveTab('SCOREBOARD')} className={`py-3 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'SCOREBOARD' ? 'bg-zinc-800 text-white rounded-lg' : 'text-zinc-500'}`}>Placar</button>
        <button onClick={() => setActiveTab('MEDIA_HUB')} className={`py-3 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'MEDIA_HUB' ? 'bg-zinc-800 text-white rounded-lg' : 'text-zinc-500'}`}>Mídias</button>
        <button onClick={() => setActiveTab('PLAN')} className={`py-3 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'PLAN' ? 'bg-zinc-800 text-white rounded-lg' : 'text-zinc-500'}`}>Plano</button>
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
                onClick={() => handleCommand('HIDE_TIMER')} 
                className="w-full bg-zinc-800 py-4 rounded-2xl font-bold text-zinc-300 flex items-center justify-center gap-2"
              >
                OMITIR TREINO
              </motion.button>
              <motion.button 
                whileTap={{ scale: 0.95, filter: 'brightness(1.2)' }}
                onClick={() => handleCommand('STOP_MEDIA')} 
                className="w-full bg-red-500/10 border border-red-500/20 py-4 rounded-2xl font-bold text-red-500 flex items-center justify-center gap-2"
              >
                <XCircle size={18} /> PARAR MÍDIA
              </motion.button>
            </div>

            <div className={`bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-6 relative ${!isStarter ? 'opacity-50 pointer-events-none' : ''}`}>
              {!isStarter && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <div className="bg-zinc-900/90 p-3 rounded-2xl flex items-center gap-2 border border-zinc-800">
                    <Lock size={16} className="text-blue-500" />
                    <span className="text-xs font-bold">Recurso STARTER</span>
                  </div>
                </div>
              )}
              <div className="flex justify-between items-center">
                <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">Presets Rápidos</h3>
                <button onClick={() => setShowPresetManager(true)} className="text-[10px] bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full font-bold uppercase tracking-wider hover:bg-zinc-700 transition-colors">Gerenciar</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {activePresets.map(preset => (
                  <motion.button 
                    key={preset.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleConfigChange(preset.config)}
                    className="bg-zinc-800 hover:bg-zinc-700 py-3 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-colors"
                  >
                    <span>{preset.name}</span>
                    <span className="text-[10px] text-zinc-400 font-normal">
                      {preset.config.workTime >= 60 ? `${Math.floor(preset.config.workTime / 60)}m` : `${preset.config.workTime}s`} / {preset.config.restTime >= 60 ? `${Math.floor(preset.config.restTime / 60)}m` : `${preset.config.restTime}s`}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 space-y-6">
              <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] text-center">Configurações</h3>
              <div className="space-y-4">
                {[
                  { label: 'Preparação', field: 'prepTime', icon: <TimerIcon size={16} /> },
                  { label: 'Trabalho', field: 'workTime', icon: <Zap size={16} className="text-red-500" /> },
                  { label: 'Descanso', field: 'restTime', icon: <Coffee size={16} className="text-green-500" /> },
                  { label: 'Ciclos', field: 'cycles', icon: <RotateCcw size={16} /> },
                ].map((item) => {
                  const getStep = (field: string) => {
                    if (field === 'prepTime' || field === 'cycles') return 1;
                    if (field === 'workTime' || field === 'restTime') return 5;
                    return 1;
                  };
                  const getMin = (field: string) => {
                    if (field === 'workTime' || field === 'restTime') return 5;
                    if (field === 'prepTime') return 0;
                    return 1;
                  };
                  const step = getStep(item.field);
                  const min = getMin(item.field);
                  const currentValue = (localConfig as any)[item.field];

                  return (
                    <div key={item.field} className="flex items-center justify-between bg-black/40 p-4 rounded-2xl border border-zinc-800/50">
                      <div className="flex items-center gap-3">
                        <span className="text-zinc-500">{item.icon}</span>
                        <span className="font-medium text-sm">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <button onClick={() => updateConfig(item.field, Math.max(min, currentValue - step))} className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold">-</button>
                        <span className="w-8 text-center font-mono font-bold">{currentValue}</span>
                        <button onClick={() => updateConfig(item.field, currentValue + step)} className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold">+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 space-y-6 relative ${!isStarter ? 'opacity-50 pointer-events-none' : ''}`}>
              {!isStarter && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <div className="bg-zinc-900/90 p-3 rounded-2xl flex items-center gap-2 border border-zinc-800">
                    <Lock size={16} className="text-blue-500" />
                    <span className="text-xs font-bold">Recurso STARTER</span>
                  </div>
                </div>
              )}
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
                        onClick={() => isPro ? (item.ref.current as any).click() : alert('Upload de áudio disponível a partir do plano PRÓ.')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-bold uppercase tracking-tighter transition-all ${
                          (localConfig as any)[item.audioField] 
                            ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                            : 'bg-zinc-800/50 text-zinc-400 border border-zinc-800/50 hover:bg-zinc-800'
                        }`}
                      >
                        {!isPro ? <Lock size={12} className="text-zinc-500" /> : <Volume2 size={12} />}
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

            <div className={`bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-6 relative ${!isPro ? 'opacity-50 pointer-events-none' : ''}`}>
              {!isPro && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <div className="bg-zinc-900/90 p-3 rounded-2xl flex items-center gap-2 border border-zinc-800">
                    <Lock size={16} className="text-blue-500" />
                    <span className="text-xs font-bold">Recurso PRÓ</span>
                  </div>
                </div>
              )}
              <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] text-center">Configuração da Luta</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-500 font-bold uppercase mb-1 block">Categoria / Peso</label>
                  <input 
                    type="text" 
                    placeholder="Ex: -73kg Sênior" 
                    className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm focus:border-blue-500 outline-none transition-colors"
                    value={scoreboardConfig.category}
                    onChange={(e) => updateScoreboardConfig('category', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-blue-400 font-bold uppercase mb-1 block">Atleta Azul</label>
                    <input 
                      type="text" 
                      placeholder="Nome (Equipe)" 
                      className="w-full bg-blue-950/30 border border-blue-900/50 rounded-xl p-3 text-sm focus:border-blue-500 outline-none transition-colors"
                      value={scoreboardConfig.blueName}
                      onChange={(e) => updateScoreboardConfig('blueName', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-300 font-bold uppercase mb-1 block">Atleta Branco</label>
                    <input 
                      type="text" 
                      placeholder="Nome (Equipe)" 
                      className="w-full bg-zinc-800/30 border border-zinc-700/50 rounded-xl p-3 text-sm focus:border-zinc-400 outline-none transition-colors"
                      value={scoreboardConfig.whiteName}
                      onChange={(e) => updateScoreboardConfig('whiteName', e.target.value)}
                    />
                  </div>
                </div>
              </div>
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

        {activeTab === 'MEDIA_HUB' && (
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
                        <button onClick={() => deleteMedia(item.id, item.url)} className="absolute top-2 right-2 bg-black/60 text-red-500 p-2 rounded-full backdrop-blur-sm active:scale-95 transition-transform z-10">
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
                  <button onClick={() => deleteSchedule(s.id)} className="text-zinc-600 hover:text-red-500 p-2">
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

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Tempo da Logo Inicial (segundos)</label>
                <p className="text-xs text-zinc-600">Tempo que a logo do Dojo aparece ao abrir a TV.</p>
                <input 
                  type="number" 
                  min="1"
                  max="60"
                  defaultValue={localConfig.splashDuration || 4}
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
        )}

        {activeTab === 'PLAN' && (
          <div className="space-y-6">
            <div className="w-full flex overflow-x-auto bg-zinc-900/50 p-1 rounded-xl mb-4 hide-scrollbar">
              <button onClick={() => setPlanSubTab('INFO')} className={`flex-shrink-0 px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${planSubTab === 'INFO' ? 'bg-zinc-800 text-white rounded-lg' : 'text-zinc-500'}`}>Meu Plano</button>
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
                        <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-2xl text-left">
                          <p className="text-xs text-yellow-500 font-medium">
                            ⚠️ <span className="font-bold">Atenção:</span> Na página de pagamento, certifique-se de usar este mesmo email para que seu acesso seja liberado automaticamente.
                          </p>
                        </div>
                        <a 
                          href="https://www.judotech.com.br/display-planos" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-block bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-xl shadow-blue-900/20 w-full"
                        >
                          Fazer Upgrade Agora
                        </a>
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

            {planSubTab === 'REPORTS' && (
              <div className="relative">
                {!isBusiness && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-sm rounded-3xl p-6 text-center border border-zinc-800">
                    <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mb-4">
                      <Lock size={32} className="text-blue-500" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Recurso BUSINESS</h3>
                    <p className="text-zinc-400 text-sm mb-6 max-w-xs">
                      Os relatórios de patrocínios estão disponíveis apenas no plano BUSINESS.
                    </p>
                    <a 
                      href="https://www.judotech.com.br/display-planos" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
                    >
                      Fazer Upgrade
                    </a>
                  </div>
                )}
                <div className={!isBusiness ? 'opacity-30 pointer-events-none' : ''}>
                  <SponsorReports teacherId={teacherId} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const codeFromUrl = urlParams.get('code');
  const isAdmin = urlParams.get('admin') === 'true';
  const isRemote = urlParams.get('remote') === 'true';

  const [session, setSession] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(codeFromUrl ? codeFromUrl.toUpperCase() : null);
  const [remoteCommand, setRemoteCommand] = useState<{ type: string; payload?: any } | null>(null);
  const [viewMode, setViewMode] = useState<'TV' | 'REMOTE'>((codeFromUrl || isRemote) ? 'REMOTE' : 'TV');
  const [showSplash, setShowSplash] = useState(true);
  const [activeMedia, setActiveMedia] = useState<MediaItem | null>(null);
  const [activeManualPlaylist, setActiveManualPlaylist] = useState<Playlist | null>(null);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [dojoSettings, setDojoSettings] = useState<DojoSettings>({ name: 'JUDO DOJO', logo_url: null });
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isScoreboardActive, setIsScoreboardActive] = useState(false);
  const [scoreboardConfig, setScoreboardConfig] = useState({
    blueName: 'AZUL',
    whiteName: 'BRANCO',
    category: ''
  });
  const [tickerConfig, setTickerConfig] = useState({
    text: '',
    active: false
  });
  const [isFullscreenMedia, setIsFullscreenMedia] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(50);

  useEffect(() => {
    if (!supabase) {
      setIsAuthLoading(false);
      return;
    }
    
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("Auth session error:", error.message);
        // If there's an error like "Invalid Refresh Token", we should clear the session
        supabase.auth.signOut().catch(console.error);
        setSession(null);
      } else {
        setSession(session);
      }
      setIsAuthLoading(false);
    }).catch((err) => {
      console.error("Unexpected auth error:", err);
      setIsAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setSession(null);
        if (viewMode === 'REMOTE' && !pairingCode) {
          setTeacherId(null);
        }
      } else {
        setSession(session);
        if (viewMode === 'REMOTE' && !pairingCode && session) {
          setTeacherId(session.user.id);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [viewMode, pairingCode]);

  useEffect(() => {
    if (session && viewMode === 'REMOTE' && !pairingCode && !teacherId) {
      setTeacherId(session.user.id);
    }
  }, [session, viewMode, pairingCode, teacherId]);

  const [tvName, setTvName] = useState<string>('');

  // Fetch schedules, settings, and media for TV
  useEffect(() => {
    if (!teacherId || viewMode !== 'TV' || !supabase) return;
    const fetchData = async () => {
      const { data: scheduleData } = await supabase.from('schedules').select('*').eq('teacher_id', teacherId);
      if (scheduleData) setSchedules(scheduleData);

      const { data: settingsData } = await supabase.from('dojo_settings').select('*').eq('teacher_id', teacherId).maybeSingle();
      const { data: globalSettingsData } = await supabase.from('dojo_settings').select('*').eq('teacher_id', 'GLOBAL').maybeSingle();
      
      const mergedSettings = {
        ...globalSettingsData,
        ...settingsData,
        name: settingsData?.name || globalSettingsData?.name || 'Meu Dojo',
        logo_url: settingsData?.logo_url || globalSettingsData?.logo_url || ''
      };
      if (mergedSettings) setDojoSettings(mergedSettings);

      const { data: mediaData } = await supabase.from('media').select('*').in('teacher_id', [teacherId, 'GLOBAL']);
      if (mediaData) setMediaList(mediaData);
      
      if (pairingCode) {
        const { data: sessionData } = await supabase.from('sessions').select('tv_name').eq('id', pairingCode).single();
        if (sessionData?.tv_name) setTvName(sessionData.tv_name);
      }

      setIsLoadingSettings(false);
    };
    fetchData();
  }, [teacherId, viewMode, pairingCode]);

  useEffect(() => {
    if (viewMode === 'TV' && teacherId && !isLoadingSettings) {
      const duration = (dojoSettings.timer_config?.splashDuration || 4) * 1000;
      const timer = setTimeout(() => setShowSplash(false), duration);
      return () => clearTimeout(timer);
    } else if (viewMode === 'REMOTE') {
      setShowSplash(true);
    }
  }, [viewMode, teacherId, isLoadingSettings, dojoSettings.timer_config?.splashDuration]);

  // Listen for remote commands
  useEffect(() => {
    if (!teacherId || !pairingCode || !supabase) return;

    const handleCommandUpdate = (payload: any) => {
      if (payload.new.status === 'pending' || !payload.new.teacher_id) {
        setTeacherId(null);
        setPairingCode(null);
        return;
      }
      
      if (payload.new.teacher_id && payload.new.teacher_id !== teacherId) {
        setTeacherId(payload.new.teacher_id);
      }
      
      if (payload.new.last_command) {
        const cmd = payload.new.last_command;
        setRemoteCommand(cmd);
        if (cmd.type === 'START') {
          setIsTimerActive(true);
          setIsScoreboardActive(false);
        }
        if (cmd.type === 'HIDE_TIMER') {
          setIsTimerActive(false);
        }
        if (cmd.type === 'RESET') {
          setActiveMedia(null);
        }
        if (cmd.type === 'SHOW_MEDIA') {
          setActiveMedia(cmd.payload);
          setActiveManualPlaylist(null);
          setIsScoreboardActive(false);
        }
        if (cmd.type === 'SHOW_PLAYLIST') {
          setActiveManualPlaylist(cmd.payload);
          setActiveMedia(null);
          setIsScoreboardActive(false);
        }
        if (cmd.type === 'TOGGLE_FULLSCREEN') {
          setIsFullscreenMedia(prev => !prev);
        }
        if (cmd.type === 'STOP_MEDIA') {
          setActiveMedia(null);
          setActiveManualPlaylist(null);
        }
        if (cmd.type === 'SHOW_SCOREBOARD') {
          setIsScoreboardActive(true);
          setIsTimerActive(false);
          setActiveMedia(null);
        }
        if (cmd.type === 'HIDE_SCOREBOARD') setIsScoreboardActive(false);
        if (cmd.type === 'SETTINGS_UPDATE') setDojoSettings(cmd.payload);
        if (cmd.type === 'TOGGLE_MUTE') setIsMuted(cmd.payload);
        if (cmd.type === 'SET_VOLUME') setVolume(cmd.payload);
        
        if (cmd.type === 'SCOREBOARD_SET_NAMES') {
          setScoreboardConfig(prev => ({
            ...prev,
            blueName: cmd.payload.blue !== undefined ? cmd.payload.blue : prev.blueName,
            whiteName: cmd.payload.white !== undefined ? cmd.payload.white : prev.whiteName
          }));
        }
        if (cmd.type === 'SCOREBOARD_SET_CATEGORY') {
          setScoreboardConfig(prev => ({ ...prev, category: cmd.payload }));
        }
        if (cmd.type === 'TICKER_UPDATE') {
          setTickerConfig(cmd.payload);
        }
      }
    };

    const channel = supabase
      .channel(`remote-control-${pairingCode}-${Math.random()}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${pairingCode}` }, handleCommandUpdate)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [teacherId, pairingCode]);

  const sendRemoteCommand = async (targetTvId: string, commandType: string, payload?: any) => {
    if (!supabase) return;
    
    const updateData = { 
      last_command: { 
        type: commandType, 
        payload, 
        timestamp: new Date().toISOString() 
      } 
    };

    if (targetTvId === 'ALL') {
      const { error } = await supabase
        .from('sessions')
        .update(updateData)
        .eq('teacher_id', teacherId);
      if (error) console.error('Error sending broadcast command:', error);
    } else {
      const { error } = await supabase
        .from('sessions')
        .update(updateData)
        .eq('id', targetTvId);
      if (error) console.error('Error sending command:', error);
    }
  };

  const [scheduleIndex, setScheduleIndex] = useState(0);
  const [currentClock, setCurrentClock] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentClock(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Logic to find current scheduled media
  const activeSchedules = useMemo(() => {
    if (isTimerActive || activeMedia || activeManualPlaylist) return []; // Priority: Timer > Manual Media/Playlist > Schedule

    const currentDay = currentClock.getDay();
    const currentTimeStr = `${currentClock.getHours().toString().padStart(2, '0')}:${currentClock.getMinutes().toString().padStart(2, '0')}`;

    return schedules.filter(s => {
      const start = s.start_time.substring(0, 5);
      const end = s.end_time.substring(0, 5);
      return s.day_of_week === currentDay && 
             currentTimeStr >= start && 
             currentTimeStr <= end;
    });
  }, [schedules, isTimerActive, activeMedia, activeManualPlaylist, currentClock]);

  const activePlaylistMedia = useMemo(() => {
    if (activeManualPlaylist) {
      return activeManualPlaylist.media_ids
        .map(id => mediaList.find(m => m.id === id))
        .filter((m): m is MediaItem => m !== undefined);
    }
    
    if (activeSchedules.length === 0) return [];
    // Get the first active schedule
    const activeSchedule = activeSchedules[0];
    const playlist = dojoSettings.playlists?.find(p => p.id === activeSchedule.playlist_id);
    if (!playlist) return [];
    
    // Map media_ids to actual MediaItems
    return playlist.media_ids
      .map(id => mediaList.find(m => m.id === id))
      .filter((m): m is MediaItem => m !== undefined);
  }, [activeSchedules, dojoSettings.playlists, mediaList, activeManualPlaylist]);

  const currentScheduledMedia = useMemo(() => {
    if (activePlaylistMedia.length === 0) return null;
    return activePlaylistMedia[scheduleIndex % activePlaylistMedia.length] || null;
  }, [activePlaylistMedia, scheduleIndex]);

  const currentlyDisplayedMedia = activeMedia || currentScheduledMedia;

  useEffect(() => {
    if (viewMode === 'TV' && currentlyDisplayedMedia && currentlyDisplayedMedia.sponsor_name) {
      // Log impression
      supabase.from('media_logs').insert({
        teacher_id: teacherId,
        media_id: currentlyDisplayedMedia.id,
        sponsor_name: currentlyDisplayedMedia.sponsor_name
      }).then(({ error }) => {
        if (error) console.error('Error logging media:', error);
      });
    }
  }, [currentlyDisplayedMedia?.id, viewMode, teacherId]);

  useEffect(() => {
    if (!currentScheduledMedia || activePlaylistMedia.length <= 1) return;

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
  }, [currentScheduledMedia, activePlaylistMedia.length, dojoSettings.timer_config?.imageDuration]);

  const getYouTubeEmbedUrl = (url: string, muted: boolean, loop: boolean) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    const muteParam = muted ? '1' : '0';
    const loopParam = loop ? '1' : '0';
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}?autoplay=1&mute=${muteParam}&loop=${loopParam}&playlist=${match[2]}` : null;
  };

  const renderMedia = (media: MediaItem, isScheduled: boolean) => {
    const shouldLoop = !isScheduled || activePlaylistMedia.length <= 1;
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

  if (isAdmin) {
    return <AdminPanel />;
  }

  if (isAuthLoading && viewMode === 'REMOTE') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
      </div>
    );
  }

  if (viewMode === 'REMOTE' && !session) {
    return <Auth onAuthSuccess={() => {}} />;
  }

  if (!teacherId) {
    if (viewMode === 'REMOTE' && pairingCode) {
      return <RemotePairing pairingCode={pairingCode} onPaired={(id) => setTeacherId(id)} session={session} />;
    }
    return <TVPairing onPaired={(id, code) => { setTeacherId(id); setPairingCode(code); }} />;
  }

  if (viewMode === 'REMOTE') {
    return <RemoteControl initialPairingCode={pairingCode || 'ALL'} teacherId={teacherId} onSendCommand={sendRemoteCommand} onClose={() => {
      // Clear URL parameter when closing remote
      window.history.replaceState({}, document.title, window.location.pathname);
      setViewMode('TV');
    }} />;
  }

  return (
    <div className="h-screen w-screen bg-black text-white flex flex-col items-center justify-center overflow-hidden">
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
            className="w-full h-full flex flex-col items-center justify-center relative p-4 md:p-8 lg:p-12"
          >
            {!isLoadingSettings && (
              <>
                {/* Status Bar */}
                {!isFullscreenMedia && (
                  <div className="fixed top-0 left-0 w-full p-[3vmin] flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent z-50 pointer-events-none">
                    <div className="flex items-center gap-[2vw] pointer-events-auto">
                      <DigitalClock />
                    </div>
                    <div className="flex items-center gap-[2vw] pointer-events-auto">
                      <button 
                        onClick={() => setViewMode('REMOTE')} 
                        className="flex items-center gap-[1vw] hover:bg-zinc-900/50 px-[2vw] py-[1vh] rounded-full transition-colors group border border-transparent hover:border-zinc-800"
                      >
                        <div className="w-[1.5vmin] h-[1.5vmin] rounded-full bg-green-500 animate-pulse" />
                        <span className="text-zinc-300 font-bold uppercase tracking-widest text-[1.5vmin] group-hover:text-white transition-colors">
                          {tvName || 'DOJO DISPLAY'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="w-full h-full mx-auto flex flex-col items-center justify-center relative">
                  {/* Display Logic */}
                  {isScoreboardActive ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <Scoreboard 
                        externalCommand={remoteCommand} 
                        blueName={scoreboardConfig.blueName}
                        whiteName={scoreboardConfig.whiteName}
                        category={scoreboardConfig.category}
                      />
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
                        <div className={`relative bg-zinc-900 overflow-hidden shadow-2xl ${isFullscreenMedia ? 'w-full h-full fixed inset-0 z-50 rounded-none border-0' : 'w-full h-full rounded-3xl border border-zinc-800'}`}>
                          {renderMedia(activeMedia, false)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {activeMedia || currentScheduledMedia ? (
                        <div className={`relative bg-zinc-900 overflow-hidden shadow-2xl ${isFullscreenMedia ? 'w-full h-full fixed inset-0 z-50 rounded-none border-0' : 'w-full h-full rounded-[3rem] border border-zinc-800'}`}>
                          {renderMedia((activeMedia || currentScheduledMedia)!, !activeMedia)}
                          {!isFullscreenMedia && (
                            <div className="absolute top-8 left-8 bg-black/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10">
                              <p className="text-lg font-black uppercase tracking-widest flex items-center gap-3">
                                {activeMedia || activeManualPlaylist ? <PlayCircle className="text-blue-500" /> : <Calendar className="text-amber-500" />}
                                {activeMedia ? 'AO VIVO' : activeManualPlaylist ? 'PLAYLIST' : 'PROGRAMADO'}
                              </p>
                            </div>
                          )}
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

      {/* Ticker */}
      <AnimatePresence>
        {tickerConfig.active && tickerConfig.text && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 bg-red-600 text-white font-bold text-3xl py-4 z-[150] overflow-hidden whitespace-nowrap"
          >
            <div className="inline-block animate-[ticker_20s_linear_infinite]">
              {tickerConfig.text}
              <span className="mx-24">•</span>
              {tickerConfig.text}
              <span className="mx-24">•</span>
              {tickerConfig.text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
