import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DojoSettings, TimerPreset, Playlist } from '../types';

const defaultPresets: TimerPreset[] = [
  { id: '1', name: 'Randori', config: { prepTime: 10, workTime: 300, restTime: 60, cycles: 5, prepLabel: 'PREPARAÇÃO', workLabel: 'RANDORI', restLabel: 'DESCANSO' } },
  { id: '2', name: 'Uchikomi', config: { prepTime: 10, workTime: 60, restTime: 10, cycles: 10, prepLabel: 'PREPARAÇÃO', workLabel: 'UCHIKOMI', restLabel: 'TROCA' } },
  { id: '3', name: 'Tabata', config: { prepTime: 10, workTime: 20, restTime: 10, cycles: 8, prepLabel: 'PREPARAÇÃO', workLabel: 'TRABALHO', restLabel: 'DESCANSO' } },
  { id: '4', name: 'Newaza', config: { prepTime: 10, workTime: 120, restTime: 30, cycles: 6, prepLabel: 'PREPARAÇÃO', workLabel: 'NEWAZA', restLabel: 'DESCANSO' } }
];

export function useDojoSync(teacherId: string, handleCommand: (type: string, payload?: any) => void) {
  const [dojoSettings, setDojoSettings] = useState<DojoSettings>({ name: 'JUDO DOJO', logo_url: null });
  const [localConfig, setLocalConfig] = useState({
    prepTime: 10, workTime: 60, restTime: 10, cycles: 10,
    prepColor: '#eab308', workColor: '#22c55e', restColor: '#ef4444',
    prepLabel: 'PREPARAÇÃO', workLabel: 'TRABALHO', restLabel: 'DESCANSO',
    prepAudio: null as string | null, workAudio: null as string | null, restAudio: null as string | null,
    ttsEnabled: false
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
    
    await supabase.from('dojo_settings').update({ presets: newPresets }).eq('teacher_id', teacherId);
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
    handleCommand('CONFIG_UPDATE', newConfig);
    
    if (supabase && teacherId) {
      await supabase.from('dojo_settings').update({ timer_config: newConfig }).eq('teacher_id', teacherId);
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

  const updateColor = async (field: string, value: string) => {
    updateConfig(field, value);
  };

  const updateLabel = async (field: string, value: string) => {
    updateConfig(field, value);
  };

  const updateScoreboard = async (field: string, value: any) => {
    const newConfig = { ...scoreboardConfig, [field]: value };
    setScoreboardConfig(newConfig);
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

  const removeAudio = async (field: string) => {
    updateConfig(field, '');
  };

  const toggleTTS = async (val: boolean) => {
    updateConfig('useTTS', val);
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
    updateColor,
    updateLabel,
    updateScoreboard,
    handleScoreUpdate,
    removeAudio,
    toggleTTS,
    updateScoreboardConfig,
    updateTickerConfig,
    updateSponsorsConfig,
    updatePlaylists,
    updateTvPlaylist,
    handleConfigChange
  };
}
