import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DojoSettings, TimerPreset, Playlist } from '../types';

const HAJIME_URL = 'https://ais-dev-u6fyuyuunarpftzwkkwu4c-22964521808.us-west1.run.app/hajime.mp3';
const MATTE_URL = 'https://ais-dev-u6fyuyuunarpftzwkkwu4c-22964521808.us-west1.run.app/matte.mp3';
const SOREMADE_URL = 'https://ais-dev-u6fyuyuunarpftzwkkwu4c-22964521808.us-west1.run.app/soremade.mp3';
const KIOTSUKE_URL = 'https://ais-dev-u6fyuyuunarpftzwkkwu4c-22964521808.us-west1.run.app/kiotsuke.mp3';

const defaultPresets: TimerPreset[] = [
  // ROUNDS Presets
  { id: '1', name: 'Randori', mode: 'ROUNDS', config: { prepTime: 10, workTime: 300, restTime: 60, cycles: 5, prepLabel: 'PREPARAÇÃO', workLabel: 'RANDORI', restLabel: 'DESCANSO', prepAudioUrl: KIOTSUKE_URL, workAudioUrl: HAJIME_URL, restAudioUrl: MATTE_URL, finishedAudioUrl: SOREMADE_URL } },
  { id: '2', name: 'Kids', mode: 'ROUNDS', config: { prepTime: 10, workTime: 120, restTime: 30, cycles: 5, prepLabel: 'PREPARAÇÃO', workLabel: 'KIDS', restLabel: 'DESCANSO', prepAudioUrl: KIOTSUKE_URL, workAudioUrl: HAJIME_URL, restAudioUrl: MATTE_URL, finishedAudioUrl: SOREMADE_URL } },
  { id: '3', name: 'Ne Waza', mode: 'ROUNDS', config: { prepTime: 10, workTime: 180, restTime: 30, cycles: 6, prepLabel: 'PREPARAÇÃO', workLabel: 'NE WAZA', restLabel: 'DESCANSO', prepAudioUrl: KIOTSUKE_URL, workAudioUrl: HAJIME_URL, restAudioUrl: MATTE_URL, finishedAudioUrl: SOREMADE_URL } },
  { id: '4', name: 'Uchikomi', mode: 'ROUNDS', config: { prepTime: 10, workTime: 60, restTime: 10, cycles: 10, prepLabel: 'PREPARAÇÃO', workLabel: 'UCHIKOMI', restLabel: 'TROCA', prepAudioUrl: KIOTSUKE_URL, workAudioUrl: HAJIME_URL, restAudioUrl: MATTE_URL, finishedAudioUrl: SOREMADE_URL } },
  // HIT Presets
  { id: '5', name: 'Aquecimento', mode: 'HIT', config: { prepTime: 10, workTime: 30, restTime: 10, cycles: 5, prepLabel: 'PREPARAÇÃO', workLabel: 'AQUECIMENTO', restLabel: 'DESCANSO', hitCycles: [], prepAudioUrl: KIOTSUKE_URL, workAudioUrl: HAJIME_URL, restAudioUrl: MATTE_URL, finishedAudioUrl: SOREMADE_URL } },
  { id: '6', name: 'Força', mode: 'HIT', config: { prepTime: 10, workTime: 45, restTime: 15, cycles: 4, prepLabel: 'PREPARAÇÃO', workLabel: 'FORÇA', restLabel: 'DESCANSO', hitCycles: [], prepAudioUrl: KIOTSUKE_URL, workAudioUrl: HAJIME_URL, restAudioUrl: MATTE_URL, finishedAudioUrl: SOREMADE_URL } },
  { id: '7', name: 'Velocidade', mode: 'HIT', config: { prepTime: 10, workTime: 20, restTime: 10, cycles: 8, prepLabel: 'PREPARAÇÃO', workLabel: 'VELOCIDADE', restLabel: 'DESCANSO', hitCycles: [], prepAudioUrl: KIOTSUKE_URL, workAudioUrl: HAJIME_URL, restAudioUrl: MATTE_URL, finishedAudioUrl: SOREMADE_URL } },
  { id: '8', name: 'Habilidade', mode: 'HIT', config: { prepTime: 10, workTime: 60, restTime: 20, cycles: 4, prepLabel: 'PREPARAÇÃO', workLabel: 'HABILIDADE', restLabel: 'DESCANSO', hitCycles: [], prepAudioUrl: KIOTSUKE_URL, workAudioUrl: HAJIME_URL, restAudioUrl: MATTE_URL, finishedAudioUrl: SOREMADE_URL } }
];

export function useDojoSync(teacherId: string, handleCommand: (type: string, payload?: any, targetTvId?: string) => void) {
  const [dojoSettings, setDojoSettings] = useState<DojoSettings>({ name: 'DOJO TV', logo_url: 'https://picsum.photos/seed/dojotv/200/200' });
  const [localConfig, setLocalConfig] = useState({
    name: '',
    prepTime: 10, workTime: 60, restTime: 10, cycles: 10,
    prepColor: '#eab308', workColor: '#22c55e', restColor: '#ef4444',
    prepLabel: 'PREPARAÇÃO', workLabel: 'TRABALHO', restLabel: 'DESCANSO',
    prepAudioUrl: KIOTSUKE_URL, workAudioUrl: HAJIME_URL, restAudioUrl: MATTE_URL, finishedAudioUrl: SOREMADE_URL
  });
  const [scoreboardConfig, setScoreboardConfig] = useState({
    athlete1Name: 'ATLETA 1', athlete2Name: 'ATLETA 2',
    athlete1Color: '#ffffff', athlete2Color: '#2563eb',
    athlete1Score: 0, athlete2Score: 0,
    athlete1Penalties: 0, athlete2Penalties: 0
  });
  const [tickerConfig, setTickerConfig] = useState({
    message: '', isVisible: false
  });
  const [sponsorsConfig, setSponsorsConfig] = useState({
    images: [] as string[],
    interval: 10
  });

  useEffect(() => {
    if (!teacherId || !supabase) return;

    const loadSettings = async () => {
      const { data } = await supabase
        .from('dojo_settings')
        .select('*')
        .eq('teacher_id', teacherId)
        .single();
      
      if (data) {
        setDojoSettings(data);
        if (data.timer_config) setLocalConfig(data.timer_config);
        if (data.scoreboard_config) setScoreboardConfig(data.scoreboard_config);
        if (data.ticker_config) setTickerConfig(data.ticker_config);
        if (data.sponsors_config) setSponsorsConfig(data.sponsors_config);
      }
    };

    loadSettings();

    const channel = supabase.channel('dojo_settings_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dojo_settings', filter: `teacher_id=eq.${teacherId}` },
        (payload) => {
          const data = payload.new as any;
          if (data) {
            setDojoSettings(data);
            if (data.timer_config) setLocalConfig(data.timer_config);
            if (data.scoreboard_config) setScoreboardConfig(data.scoreboard_config);
            if (data.ticker_config) setTickerConfig(data.ticker_config);
            if (data.sponsors_config) setSponsorsConfig(data.sponsors_config);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teacherId]);

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
    
    // Update current config to reflect changes immediately
    const newConfig = { ...localConfig, ...preset.config, name: preset.name };
    setLocalConfig(newConfig);
    handleCommand('CONFIG_UPDATE', newConfig);
    
    await supabase.from('dojo_settings').update({ 
      presets: newPresets,
      timer_config: newConfig
    }).eq('teacher_id', teacherId);
  };

  const deletePreset = async (id: string) => {
    if (!supabase || !teacherId) return;
    
    const newPresets = activePresets.filter(p => p.id !== id);
    const newSettings = { ...dojoSettings, presets: newPresets };
    setDojoSettings(newSettings);
    
    await supabase.from('dojo_settings').update({ presets: newPresets }).eq('teacher_id', teacherId);
  };

  const updateConfig = async (field: string, value: any) => {
    const newConfig = { ...localConfig, [field]: value };
    setLocalConfig(newConfig);
    setDojoSettings(prev => ({ ...prev, timer_config: newConfig }));
    handleCommand('CONFIG_UPDATE', newConfig);
    
    if (supabase && teacherId) {
      await supabase.from('dojo_settings').update({ timer_config: newConfig }).eq('teacher_id', teacherId);
    }
  };

  const handleConfigChange = async (newSettings: Partial<typeof localConfig>) => {
    const newConfig = { ...localConfig, ...newSettings };
    setLocalConfig(newConfig);
    setDojoSettings(prev => ({ ...prev, timer_config: newConfig }));
    handleCommand('CONFIG_UPDATE', newConfig);
    
    if (supabase && teacherId) {
      await supabase.from('dojo_settings').update({ timer_config: newConfig }).eq('teacher_id', teacherId);
    }
  };

  const updateScoreboard = async (field: string, value: any) => {
    const newConfig = { ...scoreboardConfig, [field]: value };
    setScoreboardConfig(newConfig);
    setDojoSettings(prev => ({ ...prev, scoreboard_config: newConfig }));
    handleCommand('SCOREBOARD_UPDATE', newConfig);
    
    if (supabase && teacherId) {
      await supabase.from('dojo_settings').update({ scoreboard_config: newConfig }).eq('teacher_id', teacherId);
    }
  };

  const handleScoreUpdate = async (athlete: 1 | 2, type: 'score' | 'penalty', increment: boolean) => {
    const field = `athlete${athlete}${type === 'score' ? 'Score' : 'Penalties'}`;
    const currentValue = scoreboardConfig[field as keyof typeof scoreboardConfig] as number;
    const newValue = increment ? currentValue + 1 : Math.max(0, currentValue - 1);
    
    await updateScoreboard(field, newValue);
  };

  const updateScoreboardConfig = async (field: 'blueName' | 'whiteName' | 'category' | 'sport', value: string) => {
    let newConfig = { ...scoreboardConfig, [field]: value };
    
    if (field === 'sport') {
      const isOldKarate = scoreboardConfig.sport === 'karate';
      const isNewKarate = value === 'karate';
      
      if (isOldKarate && !isNewKarate) {
        if (newConfig.blueName === 'VERMELHO') newConfig.blueName = '';
        if (newConfig.whiteName === 'AZUL') newConfig.whiteName = '';
      } else if (!isOldKarate && isNewKarate) {
        if (newConfig.blueName === 'AZUL') newConfig.blueName = '';
        if (newConfig.whiteName === 'BRANCO') newConfig.whiteName = '';
      }
    }

    setScoreboardConfig(newConfig);
    setDojoSettings(prev => ({ ...prev, scoreboard_config: newConfig }));
    
    if (field === 'category') {
      handleCommand('SCOREBOARD_SET_CATEGORY', value);
    } else if (field === 'sport') {
      handleCommand('SCOREBOARD_SET_SPORT', value);
      // Also broadcast name changes if they were cleared
      handleCommand('SCOREBOARD_SET_NAMES', { 
        blue: newConfig.blueName,
        white: newConfig.whiteName
      });
    } else {
      handleCommand('SCOREBOARD_SET_NAMES', { 
        blue: newConfig.blueName,
        white: newConfig.whiteName
      });
    }
    
    if (supabase && teacherId) {
      await supabase.from('dojo_settings').update({ scoreboard_config: newConfig }).eq('teacher_id', teacherId);
    }
  };

  const updateTickerConfig = async (field: 'text' | 'active', value: string | boolean) => {
    const newConfig = { ...tickerConfig, [field]: value };
    setTickerConfig(newConfig);
    setDojoSettings(prev => ({ ...prev, ticker_config: newConfig }));
    handleCommand('TICKER_UPDATE', newConfig);
    
    if (supabase && teacherId) {
      await supabase.from('dojo_settings').update({ ticker_config: newConfig }).eq('teacher_id', teacherId);
    }
  };

  const updateSponsorsConfig = async (field: keyof typeof sponsorsConfig, value: any) => {
    const newConfig = { ...sponsorsConfig, [field]: value };
    setSponsorsConfig(newConfig);
    setDojoSettings(prev => ({ ...prev, sponsors_config: newConfig }));
    handleCommand('SPONSORS_UPDATE', newConfig);
    
    if (supabase && teacherId) {
      await supabase.from('dojo_settings').update({ sponsors_config: newConfig }).eq('teacher_id', teacherId);
    }
  };

  const updatePlaylists = async (newPlaylists: Playlist[]) => {
    const newSettings = { ...dojoSettings, playlists: newPlaylists };
    setDojoSettings(newSettings);
    handleCommand('SETTINGS_UPDATE', newSettings, 'ALL');
    if (supabase && teacherId) {
      await supabase.from('dojo_settings').update({ playlists: newPlaylists }).eq('teacher_id', teacherId);
    }
  };

  const updateTvPlaylist = async (tvId: string, playlistId: string) => {
    const newTvPlaylists = { ...(dojoSettings.tv_playlists || {}), [tvId]: playlistId };
    const newSettings = { ...dojoSettings, tv_playlists: newTvPlaylists };
    setDojoSettings(newSettings);
    handleCommand('SETTINGS_UPDATE', newSettings, tvId);
    if (supabase && teacherId) {
      await supabase.from('dojo_settings').update({ tv_playlists: newTvPlaylists }).eq('teacher_id', teacherId);
    }
  };

  return {
    dojoSettings,
    setDojoSettings,
    localConfig,
    setLocalConfig,
    scoreboardConfig,
    setScoreboardConfig,
    tickerConfig,
    setTickerConfig,
    sponsorsConfig,
    setSponsorsConfig,
    activePresets,
    savePreset,
    deletePreset,
    updateConfig,
    updateScoreboard,
    handleScoreUpdate,
    updateScoreboardConfig,
    updateTickerConfig,
    updateSponsorsConfig,
    updatePlaylists,
    updateTvPlaylist,
    handleConfigChange
  };
}
