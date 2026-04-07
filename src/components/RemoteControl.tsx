import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import TVPairing from './TVPairing';
import RemotePairing from './RemotePairing';
import { Auth } from './Auth';
import TabataTimer from './TabataTimer';
import Scoreboard from './Scoreboard';
import DigitalClock from './DigitalClock';
import AdminPanel from './AdminPanel';
import SponsorReports from './SponsorReports';
import { LogOut, Smartphone as SmartphoneIcon, Monitor, Timer as TimerIcon, Zap, Coffee, RotateCcw, Image as ImageIcon, Video, Upload, Trash2, PlayCircle, Loader2, Calendar, Clock, Plus, Youtube, Volume2, VolumeX, Volume1, XCircle, Check, Maximize, Edit, Settings, Lock, Crown, Star, Tv, PlusCircle, QrCode } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Html5QrcodeScanner } from 'html5-qrcode';

import { MediaItem, TimerPreset, Playlist, DojoSettings, ScheduleItem } from '../types';
import MediaHub from './MediaHub';
import ScoreboardControl from './ScoreboardControl';
import TimerControl from './TimerControl';
import PlanControl from './PlanControl';

export interface RemoteControlProps {
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

export default function RemoteControl({ initialPairingCode, teacherId, onSendCommand, onClose }: RemoteControlProps) {
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
  const [sponsorsConfig, setSponsorsConfig] = useState({
    timer_active: false,
    scoreboard_active: false,
    timer_playlist_id: '',
    scoreboard_playlist_id: '',
    interval: 15
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
  const [dojoForm, setDojoForm] = useState({ name: '', city: '', state: '' });
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
  const tier = (dojoSettings.subscription_tier || 'FREE').trim().toUpperCase();
  const isStarter = ['STARTER', 'PRO', 'PREMIUM', 'BUSINESS'].includes(tier);
  const isPro = ['PRO', 'PREMIUM', 'BUSINESS'].includes(tier);
  const isBusiness = ['BUSINESS'].includes(tier);
  const [newSchedule, setNewSchedule] = useState({
    playlist_id: '',
    days_of_week: [new Date().getDay()],
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
        .in('teacher_id', [teacherId, '00000000-0000-0000-0000-000000000000'])
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
        .eq('teacher_id', '00000000-0000-0000-0000-000000000000')
        .maybeSingle();

      if (mediaData) {
        setMediaList(mediaData);
      }
      if (scheduleData) setSchedules(scheduleData);
      
      const mergedSettings = {
        ...globalSettingsData,
        ...settingsData,
        name: settingsData?.name || globalSettingsData?.name || 'Meu Dojo',
        logo_url: settingsData?.logo_url || globalSettingsData?.logo_url || '',
        scoreboard_config: {
          ...(globalSettingsData?.scoreboard_config || {}),
          ...(settingsData?.scoreboard_config || {})
        },
        timer_config: {
          ...(globalSettingsData?.timer_config || {}),
          ...(settingsData?.timer_config || {})
        }
      };

      if (mergedSettings) {
        setDojoSettings(mergedSettings);
        setDojoForm({
          name: mergedSettings.name || '',
          city: mergedSettings.city || mergedSettings.timer_config?.city || '',
          state: mergedSettings.state || mergedSettings.timer_config?.state || ''
        });
        if (mergedSettings.timer_config) {
          setLocalConfig(prev => ({ ...prev, ...mergedSettings.timer_config }));
        }
        if (mergedSettings.scoreboard_config) {
          setScoreboardConfig(prev => ({ ...prev, ...mergedSettings.scoreboard_config }));
        }
        if (mergedSettings.ticker_config) {
          setTickerConfig(prev => ({ ...prev, ...mergedSettings.ticker_config }));
        }
        if (mergedSettings.sponsors_config) {
          setSponsorsConfig(prev => ({ ...prev, ...mergedSettings.sponsors_config }));
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

  const updateSponsorsConfig = async (field: keyof typeof sponsorsConfig, value: any) => {
    const newConfig = { ...sponsorsConfig, [field]: value };
    setSponsorsConfig(newConfig);
    handleCommand('SPONSORS_UPDATE', newConfig);
    
    if (supabase && teacherId) {
      await supabase.from('dojo_settings').update({ sponsors_config: newConfig }).eq('teacher_id', teacherId);
    }
  };

  const updatePlaylists = async (newPlaylists: Playlist[]) => {
    const newSettings = { ...dojoSettings, playlists: newPlaylists };
    setDojoSettings(newSettings);
    if (supabase && teacherId) {
      await supabase.from('dojo_settings').update({ playlists: newPlaylists }).eq('teacher_id', teacherId);
    }
  };

  const updateTvPlaylist = async (tvId: string, playlistId: string) => {
    const newTvPlaylists = { ...(dojoSettings.tv_playlists || {}), [tvId]: playlistId };
    const newSettings = { ...dojoSettings, tv_playlists: newTvPlaylists };
    setDojoSettings(newSettings);
    if (supabase && teacherId) {
      await supabase.from('dojo_settings').update({ tv_playlists: newTvPlaylists }).eq('teacher_id', teacherId);
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
    
    if (!error) {
      setDojoSettings(prev => ({ ...prev, name: dojoForm.name, city: dojoForm.city, state: dojoForm.state }));
      handleCommand('SETTINGS_UPDATE', { ...dojoSettings, name: dojoForm.name, city: dojoForm.city, state: dojoForm.state });
      alert('Configurações do Dojo salvas com sucesso!');
    } else {
      alert('Erro ao salvar configurações.');
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
      .select('*');

    if (data) {
      setSchedules([...schedules, ...data]);
      setShowAddSchedule(false);
      setNewSchedule(prev => ({ ...prev, playlist_id: '', days_of_week: [new Date().getDay()] }));
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
      <div className="w-full p-4 flex flex-col items-center border-b border-zinc-900 gap-4">
        <div className="flex items-center justify-center gap-2 w-full">
          <SmartphoneIcon size={20} className="text-blue-500" />
          <span className="font-bold tracking-tighter text-center">DOJO REMOTE ({dojoSettings.name})</span>
        </div>
        <div className="flex items-center justify-center gap-3 flex-wrap w-full">
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
                    className="flex flex-col gap-3 bg-black p-4 rounded-2xl border border-zinc-800"
                  >
                    <div className="flex items-center justify-between">
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
                    </div>
                    {isBusiness && (
                      <div className="pt-3 border-t border-zinc-800">
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2">Playlist Padrão da TV</label>
                        <select
                          value={dojoSettings.tv_playlists?.[session.id] || ''}
                          onChange={(e) => updateTvPlaylist(session.id, e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                        >
                          <option value="">Nenhuma (Exibir Logo)</option>
                          {(dojoSettings.playlists || []).map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
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
          <TimerControl 
            localConfig={localConfig}
            handleConfigChange={handleConfigChange}
            handleCommand={handleCommand}
            isPro={isPro}
            isStarter={isStarter}
            activePresets={activePresets}
            showPresetManager={showPresetManager}
            setShowPresetManager={setShowPresetManager}
            editingPreset={editingPreset}
            setEditingPreset={setEditingPreset}
            handleSavePreset={savePreset}
            handleDeletePreset={deletePreset}
            handleFileUpload={handleFileUpload}
            isUploading={isUploading}
            prepAudioRef={prepAudioRef}
            workAudioRef={workAudioRef}
            restAudioRef={restAudioRef}
            updateConfig={updateConfig}
            updateColor={updateColor}
            updateLabel={updateLabel}
            removeAudio={removeAudio}
            toggleTTS={toggleTTS}
          />
        )}

        {activeTab === 'SCOREBOARD' && (
          <ScoreboardControl 
            isPro={isPro}
            scoreboardConfig={scoreboardConfig}
            updateScoreboardConfig={updateScoreboardConfig}
            handleCommand={handleCommand}
          />
        )}

        {activeTab === 'MEDIA_HUB' && (
          <MediaHub 
            teacherId={teacherId}
            isStarter={isStarter}
            isPro={isPro}
            isBusiness={isBusiness}
            dojoSettings={dojoSettings}
            setDojoSettings={setDojoSettings}
            handleCommand={handleCommand}
            activeSubTab={activeSubTab}
            setActiveSubTab={setActiveSubTab}
          />
        )}

        {activeTab === 'PLAN' && (
          <PlanControl 
            planSubTab={planSubTab}
            setPlanSubTab={setPlanSubTab}
            isStarter={isStarter}
            isPro={isPro}
            isBusiness={isBusiness}
            dojoSettings={dojoSettings}
            tvSessions={tvSessions}
            newTvCode={newTvCode}
            setNewTvCode={setNewTvCode}
            handleAddTv={handleAddTv}
            isAddingTv={isAddingTv}
            addTvError={addTvError}
            
            teacherId={teacherId}
          />
        )}
      </div>
    </div>
  );
}