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

import { MediaItem, TimerPreset, Playlist, DojoSettings, ScheduleItem } from './types';
import RemoteControl from './components/RemoteControl';

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

  const tier = (dojoSettings.subscription_tier || 'FREE').trim().toUpperCase();
  const isStarter = ['STARTER', 'PRO', 'PREMIUM', 'BUSINESS'].includes(tier);
  const isPro = ['PRO', 'PREMIUM', 'BUSINESS'].includes(tier);
  const isBusiness = ['BUSINESS'].includes(tier);

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
      const { data: globalSettingsData } = await supabase.from('dojo_settings').select('*').eq('teacher_id', '00000000-0000-0000-0000-000000000000').maybeSingle();
      
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
        if (mergedSettings.ticker_config) {
          setTickerConfig(prev => ({ ...prev, ...mergedSettings.ticker_config }));
        }
        if (mergedSettings.sponsors_config) {
          setSponsorsConfig(prev => ({ ...prev, ...mergedSettings.sponsors_config }));
        }
      }

      const { data: mediaData } = await supabase.from('media').select('*').in('teacher_id', [teacherId, '00000000-0000-0000-0000-000000000000']);
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
        if (cmd.type === 'SPONSORS_UPDATE') {
          setSponsorsConfig(cmd.payload);
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
    const h = currentClock.getHours();
    const m = currentClock.getMinutes();
    const hStr = h < 10 ? '0' + h : h.toString();
    const mStr = m < 10 ? '0' + m : m.toString();
    const currentTimeStr = `${hStr}:${mStr}`;

    return schedules.filter(s => {
      const start = s.start_time.substring(0, 5);
      const end = s.end_time.substring(0, 5);
      return s.day_of_week === currentDay && 
             currentTimeStr >= start && 
             currentTimeStr <= end;
    });
  }, [schedules, isTimerActive, activeMedia, activeManualPlaylist, currentClock]);

  const timerSponsors = useMemo(() => {
    if (!sponsorsConfig.timer_playlist_id) return [];
    const playlist = dojoSettings.playlists?.find(p => p.id === sponsorsConfig.timer_playlist_id);
    if (!playlist) return [];
    return playlist.media_ids
      .map(id => mediaList.find(m => m.id === id))
      .filter((m): m is MediaItem => m !== undefined)
      .map(m => ({ url: m.url, type: m.type }));
  }, [sponsorsConfig.timer_playlist_id, dojoSettings.playlists, mediaList]);

  const scoreboardSponsors = useMemo(() => {
    if (!sponsorsConfig.scoreboard_playlist_id) return [];
    const playlist = dojoSettings.playlists?.find(p => p.id === sponsorsConfig.scoreboard_playlist_id);
    if (!playlist) return [];
    return playlist.media_ids
      .map(id => mediaList.find(m => m.id === id))
      .filter((m): m is MediaItem => m !== undefined)
      .map(m => ({ url: m.url, type: m.type }));
  }, [sponsorsConfig.scoreboard_playlist_id, dojoSettings.playlists, mediaList]);

  const activePlaylistMedia = useMemo(() => {
    if (activeManualPlaylist) {
      return activeManualPlaylist.media_ids
        .map(id => mediaList.find(m => m.id === id))
        .filter((m): m is MediaItem => m !== undefined);
    }
    
    let playlistIdToPlay: string | undefined;

    if (activeSchedules.length > 0) {
      // Get the first active schedule
      playlistIdToPlay = activeSchedules[0].playlist_id;
    } else if (pairingCode && dojoSettings.tv_playlists?.[pairingCode]) {
      // Fallback to TV's default playlist
      playlistIdToPlay = dojoSettings.tv_playlists[pairingCode];
    }

    if (!playlistIdToPlay) return [];

    const playlist = dojoSettings.playlists?.find(p => p.id === playlistIdToPlay);
    if (!playlist) return [];
    
    // Map media_ids to actual MediaItems
    return playlist.media_ids
      .map(id => mediaList.find(m => m.id === id))
      .filter((m): m is MediaItem => m !== undefined);
  }, [activeSchedules, dojoSettings.playlists, dojoSettings.tv_playlists, mediaList, activeManualPlaylist, pairingCode]);

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
                        isFreePlan={!isStarter || sponsorsConfig.scoreboard_active}
                        globalSponsors={isStarter && sponsorsConfig.scoreboard_active ? scoreboardSponsors : (dojoSettings.scoreboard_config?.free_sponsors || [])}
                        globalSponsorInterval={isStarter && sponsorsConfig.scoreboard_active ? sponsorsConfig.interval : (dojoSettings.scoreboard_config?.free_sponsor_interval || 15)}
                      />
                    </div>
                  ) : isTimerActive ? (
                    <div className={`w-full h-full flex items-center justify-center ${activeMedia ? 'grid grid-cols-2 gap-12' : ''}`}>
                      <TabataTimer 
                        externalCommand={remoteCommand} 
                        isMuted={isMuted} 
                        volume={volume} 
                        initialConfig={dojoSettings.timer_config}
                        isFreePlan={!isStarter || sponsorsConfig.timer_active}
                        globalSponsors={isStarter && sponsorsConfig.timer_active ? timerSponsors : (dojoSettings.timer_config?.free_sponsors || [])}
                        globalSponsorInterval={isStarter && sponsorsConfig.timer_active ? sponsorsConfig.interval : (dojoSettings.timer_config?.free_sponsor_interval || 15)}
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
                            <div className="absolute top-8 left-8 bg-black/80 px-6 py-3 rounded-2xl border border-white/10">
                              <p className="text-lg font-black uppercase tracking-widest flex items-center gap-3">
                                {activeMedia || activeManualPlaylist ? <PlayCircle className="text-blue-500" /> : activeSchedules.length > 0 ? <Calendar className="text-amber-500" /> : <Tv className="text-purple-500" />}
                                {activeMedia ? 'AO VIVO' : activeManualPlaylist ? 'PLAYLIST' : activeSchedules.length > 0 ? 'PROGRAMADO' : 'PLAYLIST DA TV'}
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

                <div className={`fixed bottom-0 left-0 w-full p-8 flex justify-center opacity-10 pointer-events-none ${((isScoreboardActive && (!isStarter || sponsorsConfig.scoreboard_active)) || (isTimerActive && (!isStarter || sponsorsConfig.timer_active))) ? 'px-[15vw]' : ''}`}>
                  <span className="text-9xl font-black tracking-tighter select-none uppercase text-center truncate">{dojoSettings.name}</span>
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
