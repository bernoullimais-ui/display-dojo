import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import YouTube from 'react-youtube';

import { MediaItem, TimerPreset, Playlist, DojoSettings, ScheduleItem, MasterClass, MasterClassMarker } from './types';
import OnboardingModal from './components/OnboardingModal';
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
  const [dojoSettings, setDojoSettings] = useState<DojoSettings>({ name: 'DOJO TV', logo_url: '/logo.png' });
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isScoreboardActive, setIsScoreboardActive] = useState(false);
  const [scoreboardConfig, setScoreboardConfig] = useState({
    blueName: 'AZUL',
    whiteName: 'BRANCO',
    category: '',
    sport: 'judo' as 'judo' | 'jiujitsu' | 'karate'
  });

  const tier = (dojoSettings?.subscription_tier || 'FREE').trim().toUpperCase();
  const isStarter = ['STARTER', 'PRO', 'PREMIUM', 'BUSINESS'].includes(tier);
  const isPro = ['PRO', 'PREMIUM', 'BUSINESS'].includes(tier);
  const isBusiness = ['BUSINESS'].includes(tier);
  const lastProcessedCommandTimestampRef = useRef<string | null>(null);

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
  const youtubePlayerRef = useRef<any>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isLiveBroadcasting, setIsLiveBroadcasting] = useState(false);
  const liveStreamRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  
  const [activeMasterClass, setActiveMasterClass] = useState<MasterClass | null>(null);
  const [isMasterClassStarted, setIsMasterClassStarted] = useState(false);
  const [lastMarkerIndex, setLastMarkerIndex] = useState(-1);
  const [isMasterClassWaitingRelease, setIsMasterClassWaitingRelease] = useState(false);

  const isMasterClassStartedRef = useRef(isMasterClassStarted);
  useEffect(() => {
    isMasterClassStartedRef.current = isMasterClassStarted;
  }, [isMasterClassStarted]);

  const youtubePlayerOpts = useMemo(() => ({
    width: '100%',
    height: '100%',
    playerVars: {
      autoplay: 1, // We must hardcode autoplay to allow API triggers later
      mute: 1, 
      controls: 0,
      disablekb: 1,
      fs: 0,
      modestbranding: 1,
      rel: 0,
      enablejsapi: 1,
      iv_load_policy: 3,
      playsinline: 1,
      origin: typeof window !== 'undefined' ? window.location.origin : undefined
    }
  }), []);

  const executeYoutubeCommand = useCallback((func: string, args: any[] = []) => {
    try {
        if (youtubePlayerRef.current) {
            // Case 1: It's the native React-Youtube API object wrapper (MasterClass)
            if (typeof youtubePlayerRef.current?.getIframe === 'function') {
                try {
                    const iframe = youtubePlayerRef.current.getIframe();
                    // Ensure the internal iframe actually has a source fully loaded before invoking API methods to prevent library crash
                    if (iframe && typeof iframe.getAttribute === 'function' && iframe.getAttribute('src')) {
                       try {
                           youtubePlayerRef.current[func](...args);
                       } catch(innerE) {}
                       return;
                    }
                } catch (e) {} // Ignore inner getIframe crashes
            }
            if (typeof youtubePlayerRef.current[func] === 'function') {
                 // Try direct method call anyway, but shield it from `.src` crashes internally if it attempts DOM access
                try {
                    // Quick readiness check: if getPlayerState throws, the player is not ready
                    if (typeof youtubePlayerRef.current.getPlayerState === 'function') {
                        youtubePlayerRef.current.getPlayerState();
                    }
                    youtubePlayerRef.current[func](...args);
                    return;
                } catch (innerErr) {
                    // Silently fail if internal player API is not ready
                }
            }
            // Case 2: It's a raw DOM IFrame element (Free Media)
            if (youtubePlayerRef.current.tagName === 'IFRAME') {
                youtubePlayerRef.current.contentWindow?.postMessage(
                    JSON.stringify({ event: 'command', func: func, args: args }), '*'
                );
                return;
            }
        }
        
        // Case 3: Complete fallback logic if refs aren't mounted but elements exist
        const iframe = document.querySelector('iframe[src*="youtube.com"]') as HTMLIFrameElement;
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: func, args: args }), '*');
        }
    } catch (e) {
      console.error(`Error sending youtube command ${func}:`, e);
    }
  }, []);

  useEffect(() => {
    const handleInteraction = () => {
      setHasInteracted(true);
      if (viewMode === 'TV') {
        setIsMuted(false);
      }
    };
    window.addEventListener('click', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);
    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== 'TV' || !activeMasterClass || isMasterClassWaitingRelease || isTimerActive) return;

    const interval = setInterval(() => {
      if (!youtubePlayerRef.current) return;
      
      try {
        if (typeof youtubePlayerRef.current.getCurrentTime !== 'function') return;
        const currentTime = youtubePlayerRef.current.getCurrentTime();
        
        // Grace period for the very first marker to ensure video starts
        if (lastMarkerIndex === -1 && currentTime < 0.5) return;

        const nextMarkerIndex = lastMarkerIndex + 1;
        const nextMarker = activeMasterClass.markers?.[nextMarkerIndex];

        if (nextMarker && currentTime >= nextMarker.timestamp) {
          setLastMarkerIndex(nextMarkerIndex);
          
          if (nextMarker.action === 'START_TIMER') {
            executeYoutubeCommand('pauseVideo');
            setIsTimerActive(true);
            setRemoteCommand({ 
              type: 'LOAD_PRESET', 
              payload: {
                ...nextMarker.timer_config,
                name: activeMasterClass.title,
                workLabel: activeMasterClass.title
              },
              timestamp: new Date().toISOString() 
            });
          } else if (nextMarker.action === 'WAIT_RELEASE') {
            executeYoutubeCommand('pauseVideo');
            setIsMasterClassWaitingRelease(true);
          }
        }
      } catch (e) {
        // Player might not be ready yet
      }
    }, 500);

    return () => clearInterval(interval);
  }, [viewMode, activeMasterClass, lastMarkerIndex, isMasterClassWaitingRelease, isTimerActive]);

  useEffect(() => {
    // When timer finishes during a MasterClass, resume video
    if (activeMasterClass && !isTimerActive && !isMasterClassWaitingRelease && lastMarkerIndex >= 0) {
      const currentMarker = activeMasterClass.markers?.[lastMarkerIndex];
      if (currentMarker?.action === 'START_TIMER') {
        executeYoutubeCommand('playVideo');
      }
    }
  }, [isTimerActive, activeMasterClass, lastMarkerIndex, isMasterClassWaitingRelease, executeYoutubeCommand]);

  // Sync MasterClass state to Supabase for Remote awarenes
  useEffect(() => {
    if (viewMode !== 'TV' || !pairingCode || !supabase) return;
    
    const syncState = async () => {
      await supabase
        .from('sessions')
        .update({ 
          masterclass_state: activeMasterClass ? {
            id: activeMasterClass.id,
            is_started: isMasterClassStarted,
            waiting_release: isMasterClassWaitingRelease,
            marker_index: lastMarkerIndex
          } : null
        })
        .eq('id', pairingCode);
    };
    
    syncState();
  }, [activeMasterClass, isMasterClassStarted, isMasterClassWaitingRelease, lastMarkerIndex, viewMode, pairingCode]);

  useEffect(() => {
    let videoElement: HTMLVideoElement | null = null;

    const enableWakeLock = () => {
      if (!videoElement) {
        videoElement = document.createElement('video');
        videoElement.setAttribute('loop', '');
        videoElement.setAttribute('muted', '');
        videoElement.setAttribute('playsinline', '');
        // 1x1 transparent MP4 (known good base64 from nosleep.js)
        videoElement.src = 'data:video/mp4;base64,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';
        videoElement.play().then(() => {
          console.log('Video wake lock enabled');
        }).catch((err) => {
          console.error('Video wake lock error:', err);
        });
      }
    };

    document.addEventListener('click', enableWakeLock);
    document.addEventListener('touchstart', enableWakeLock);

    return () => {
      document.removeEventListener('click', enableWakeLock);
      document.removeEventListener('touchstart', enableWakeLock);
      if (videoElement) {
        videoElement.pause();
        videoElement.src = '';
        videoElement = null;
      }
    };
  }, [viewMode]);

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

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [viewMode, pairingCode]);

  useEffect(() => {
    if (session && viewMode === 'REMOTE' && !pairingCode && !teacherId) {
      setTeacherId(session.user.id);
    }
  }, [session, viewMode, pairingCode, teacherId]);

  const [tvName, setTvName] = useState<string>('');

  // Fetch schedules, settings, and media
  useEffect(() => {
    if (!teacherId || !supabase) return;
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
        city: settingsData?.city || '',
        state: settingsData?.state || '',
        martial_arts: settingsData?.martial_arts || [],
        onboarding_completed: settingsData?.onboarding_completed || false,
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

      if (viewMode === 'TV') {
        const { data: mediaData } = await supabase.from('media').select('*').in('teacher_id', [teacherId, '00000000-0000-0000-0000-000000000000']);
        if (mediaData) {
          const mappedMedia = mediaData.map(m => {
            const url = m.url || '';
            const name = m.name || '';
            if (m.type === 'video' && (
              url.toLowerCase().includes('.mp3') || 
              url.toLowerCase().includes('.wav') || 
              url.toLowerCase().includes('.m4a') ||
              name.toLowerCase().endsWith('.mp3') ||
              name.toLowerCase().endsWith('.wav') ||
              name.toLowerCase().endsWith('.m4a')
            )) {
              return { ...m, type: 'audio' as const };
            }
            return m;
          });
          setMediaList(mappedMedia);
        }
        
        if (pairingCode) {
          const { data: sessionData } = await supabase.from('sessions').select('tv_name').eq('id', pairingCode).single();
          if (sessionData?.tv_name) setTvName(sessionData.tv_name);
        }
      }

      setIsLoadingSettings(false);
    };
    fetchData();

    // Real-time subscriptions to keep data in sync
    const settingsChannel = supabase.channel('tv_settings_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dojo_settings', filter: `teacher_id=eq.${teacherId}` }, (payload) => {
        const data = payload.new as any;
        if (data) {
          setDojoSettings(prev => ({ ...prev, ...data }));
        }
      })
      .subscribe();

    const mediaChannel = supabase.channel('tv_media_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'media', filter: `teacher_id=eq.${teacherId}` }, async () => {
        if (viewMode !== 'TV') return;
        const { data: mediaData } = await supabase.from('media').select('*').in('teacher_id', [teacherId, '00000000-0000-0000-0000-000000000000']);
        if (mediaData) {
          const mappedMedia = mediaData.map(m => {
            const url = m.url || '';
            const name = m.name || '';
            if (m.type === 'video' && (
              url.toLowerCase().includes('.mp3') || 
              url.toLowerCase().includes('.wav') || 
              url.toLowerCase().includes('.m4a') ||
              name.toLowerCase().endsWith('.mp3') ||
              name.toLowerCase().endsWith('.wav') ||
              name.toLowerCase().endsWith('.m4a')
            )) {
              return { ...m, type: 'audio' as const };
            }
            return m;
          });
          setMediaList(mappedMedia);
        }
      })
      .subscribe();

    const schedulesChannel = supabase.channel('tv_schedules_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules', filter: `teacher_id=eq.${teacherId}` }, async () => {
        const { data: scheduleData } = await supabase.from('schedules').select('*').eq('teacher_id', teacherId);
        if (scheduleData) setSchedules(scheduleData);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(settingsChannel);
      supabase.removeChannel(mediaChannel);
      supabase.removeChannel(schedulesChannel);
    };
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

  // Handle MasterClass playback flow (Play/Pause/Unmute)
  useEffect(() => {
    if (activeMasterClass) {
      const managePlayback = () => {
        try {
          if (!youtubePlayerRef.current) return;
            
          const isStarted = isMasterClassStarted && !isMasterClassWaitingRelease && !isTimerActive;
          
          let state = -2; // -2: unknown/error, -1: unstarted, 0: ended, 1: playing, 2: paused, 3: buffering, 5: cued
          let isPlayerReady = false;
          if (typeof youtubePlayerRef.current.getPlayerState === 'function') {
             try { 
               state = youtubePlayerRef.current.getPlayerState(); 
               isPlayerReady = true;
             } catch(e) {
               isPlayerReady = false;
             }
          }
          
          if (!isPlayerReady) return; // Wait for next tick if player is internally broken or loading
          
          if (isStarted) {
            if (state !== 1 && state !== 3 && Date.now() - (youtubePlayerRef.current._lastPlayAttempt || 0) > 2000) {
              youtubePlayerRef.current._lastPlayAttempt = Date.now();
              executeYoutubeCommand('playVideo');
            }
          } else {
            if (state !== 2 && state !== 5 && state !== -1 && Date.now() - (youtubePlayerRef.current._lastPauseAttempt || 0) > 2000) {
              youtubePlayerRef.current._lastPauseAttempt = Date.now();
              executeYoutubeCommand('pauseVideo');
            }
          }
        } catch (e) {
          // Silent catch to prevent console flood
        }
      };
      
      const intervalId = setInterval(managePlayback, 500); 
      return () => clearInterval(intervalId);
    }
  }, [activeMasterClass, isMasterClassStarted, isMasterClassWaitingRelease, isTimerActive, executeYoutubeCommand]);

  // Sync YouTube player volume and mute state
  useEffect(() => {
     try {
       const func = isMuted ? 'mute' : 'unMute';
       executeYoutubeCommand(func);
     } catch(e) {}
  }, [isMuted, executeYoutubeCommand]);

  useEffect(() => {
     try {
       executeYoutubeCommand('setVolume', [volume]);
     } catch(e) {}
  }, [volume, executeYoutubeCommand]);

  // Listen for remote commands
  useEffect(() => {
    if (!teacherId || !pairingCode || !supabase) return;

    const handleCommandUpdate = (payload: any) => {
      try {
        if (!payload.new) return;
        
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
        if (!cmd) return; // Extra safety
        
        const cmdTimestamp = cmd.timestamp;

        // Skip if we already processed this command to avoid loops during state sync
        if (cmdTimestamp && cmdTimestamp === lastProcessedCommandTimestampRef.current) {
          return;
        }
        
        lastProcessedCommandTimestampRef.current = cmdTimestamp;
        setRemoteCommand(cmd);
        
        if (cmd.type === 'START' || cmd.type === 'PAUSE' || cmd.type === 'RESET' || cmd.type === 'CONFIG_UPDATE') {
          setIsTimerActive(true);
          setIsScoreboardActive(false);
          setActiveMedia(null);
          setActiveManualPlaylist(null);
        }
        if (cmd.type === 'HIDE_TIMER') {
          setIsTimerActive(false);
        }
        if (cmd.type === 'SHOW_MEDIA') {
          setActiveMedia(cmd.payload);
          setActiveManualPlaylist(null);
          setActiveMasterClass(null);
          setIsScoreboardActive(false);
          setIsTimerActive(false);
        }
        if (cmd.type === 'SHOW_PLAYLIST') {
          setActiveManualPlaylist(cmd.payload);
          setActiveMedia(null);
          setActiveMasterClass(null);
          setIsScoreboardActive(false);
          setIsTimerActive(false);
        }
        if (cmd.type === 'TOGGLE_FULLSCREEN') {
          setIsFullscreenMedia(prev => !prev);
        }
        if (cmd.type === 'STOP_MEDIA') {
          setActiveMedia(null);
          setActiveManualPlaylist(null);
          setActiveMasterClass(null);
          setIsMasterClassStarted(false);
        }
        if (cmd.type === 'SHOW_SCOREBOARD') {
          setIsScoreboardActive(true);
          setIsTimerActive(false);
          setActiveMedia(null);
          setActiveManualPlaylist(null);
        }
        if (cmd.type === 'HIDE_SCOREBOARD') setIsScoreboardActive(false);
        if (cmd.type === 'SETTINGS_UPDATE') setDojoSettings(cmd.payload);
        if (cmd.type === 'TOGGLE_MUTE') setIsMuted(cmd.payload);
        if (cmd.type === 'SET_VOLUME') setVolume(cmd.payload);

        if (cmd.type === 'SHOW_MASTERCLASS') {
          setActiveMasterClass(cmd.payload);
          setLastMarkerIndex(-1);
          setIsMasterClassStarted(false);
          setIsMasterClassWaitingRelease(false);
          setIsTimerActive(false);
          setIsScoreboardActive(false);
          setActiveMedia(null);
          setActiveManualPlaylist(null);
          
          // No immediate playVideo here, let onReady/onStateChange handle it via isMasterClassStarted
        }

        if (cmd.type === 'PLAY_MASTERCLASS') {
          setIsMasterClassStarted(true);
          if (youtubePlayerRef.current) youtubePlayerRef.current._lastPlayAttempt = Date.now();
          executeYoutubeCommand('playVideo');
        }

        if (cmd.type === 'SENSEI_RELEASE') {
          setIsMasterClassWaitingRelease(false);
          setIsMasterClassStarted(true);
          if (youtubePlayerRef.current) youtubePlayerRef.current._lastPlayAttempt = Date.now();
          executeYoutubeCommand('playVideo');
        }
        
        if (cmd.type === 'YOUTUBE_PLAY') {
          if (youtubePlayerRef.current) youtubePlayerRef.current._lastPlayAttempt = Date.now();
          executeYoutubeCommand('playVideo');
        }
        if (cmd.type === 'YOUTUBE_PAUSE') {
          if (youtubePlayerRef.current) youtubePlayerRef.current._lastPauseAttempt = Date.now();
          executeYoutubeCommand('pauseVideo');
        }
        if (cmd.type === 'YOUTUBE_SEEK') {
          try {
            let currentTime = 0;
            if (youtubePlayerRef.current && typeof youtubePlayerRef.current.getCurrentTime === 'function') {
                currentTime = youtubePlayerRef.current.getCurrentTime();
            }
            executeYoutubeCommand('seekTo', [currentTime + cmd.payload, true]);
          } catch (e) {
            console.error('Error seeking youtube:', e);
          }
        }
        if (cmd.type === 'YOUTUBE_SPEED') executeYoutubeCommand('setPlaybackRate', [cmd.payload]);

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
        if (cmd.type === 'SCOREBOARD_SET_SPORT') {
          setScoreboardConfig(prev => ({ ...prev, sport: cmd.payload }));
        }
        if (cmd.type === 'TICKER_UPDATE') {
          setTickerConfig(cmd.payload);
        }
        if (cmd.type === 'SPONSORS_UPDATE') {
          setSponsorsConfig(cmd.payload);
        }
      } 
    } catch (err) {
      console.error('Error handling remote command:', err);
    }
  };

    const channel = supabase
      .channel(`remote-control-${pairingCode}-${Math.random()}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${pairingCode}` }, handleCommandUpdate)
      .subscribe();

    // WebRTC Signaling Channel
    const rtcChannel = supabase.channel(`webrtc-${pairingCode}`);
    
    rtcChannel.on('broadcast', { event: 'signal' }, async (payload) => {
      try {
        const data = payload.payload;
        if (!data) return;
        
        if (data.type === 'offer' && data.target === 'tv') {
          setIsLiveBroadcasting(true);
          setIsTimerActive(false);
          setIsScoreboardActive(false);
          setActiveMedia(null);
          setActiveManualPlaylist(null);

          const pc = new RTCPeerConnection({
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ]
          });
          peerConnectionRef.current = pc;

          pc.onicecandidate = (e) => {
            if (e.candidate) {
              rtcChannel.send({
                type: 'broadcast',
                event: 'signal',
                payload: { type: 'candidate', candidate: e.candidate, target: 'remote' }
              });
            }
          };

          pc.ontrack = (e) => {
            if (liveStreamRef.current) {
              liveStreamRef.current.srcObject = e.streams[0];
            }
          };

          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          rtcChannel.send({
            type: 'broadcast',
            event: 'signal',
            payload: { type: 'answer', sdp: answer, target: 'remote' }
          });

        } else if (data.type === 'candidate' && data.target === 'tv') {
          const pc = peerConnectionRef.current;
          if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          }
        } else if (data.type === 'stop' && data.target === 'tv') {
          setIsLiveBroadcasting(false);
          if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
          }
        }
      } catch (err) {
        console.error('WebRTC error in App:', err);
      }
    }).subscribe();

    return () => { 
      supabase.removeChannel(channel); 
      supabase.removeChannel(rtcChannel);
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
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
    if (isTimerActive || isScoreboardActive || activeMedia || activeManualPlaylist) return []; // Priority: Manual Media/Playlist/Timer/Scoreboard > Schedule

    const currentDay = currentClock.getDay();
    const h = currentClock.getHours();
    const m = currentClock.getMinutes();
    const hStr = h < 10 ? '0' + h : h.toString();
    const mStr = m < 10 ? '0' + m : m.toString();
    const currentTimeStr = `${hStr}:${mStr}`;

    return schedules.filter(s => {
      const start = s.start_time.substring(0, 5);
      const end = s.end_time.substring(0, 5);
      const spansMidnight = start > end;

      if (spansMidnight) {
        // Active on the start day from start_time to 23:59
        if (s.day_of_week === currentDay && currentTimeStr >= start) return true;
        // Active on the next day from 00:00 to end_time
        const nextDay = (s.day_of_week + 1) % 7;
        if (nextDay === currentDay && currentTimeStr <= end) return true;
        return false;
      } else {
        return s.day_of_week === currentDay && 
               currentTimeStr >= start && 
               currentTimeStr <= end;
      }
    });
  }, [schedules, isTimerActive, activeMedia, activeManualPlaylist, currentClock]);

  const timerSponsors = useMemo(() => {
    if (!sponsorsConfig.timer_playlist_id) return [];
    const playlist = dojoSettings.playlists?.find(p => p.id === sponsorsConfig.timer_playlist_id);
    if (!playlist) return [];
    
    const mediaFromIds = playlist.media_ids
      .map(id => mediaList.find(m => m.id === id))
      .filter((m): m is MediaItem => m !== undefined);
      
    const mediaFromFolders = playlist.folders 
      ? mediaList.filter(m => playlist.folders!.some(f => m.name.startsWith(f + '/')))
      : [];
      
    const combinedMedia = [...mediaFromIds, ...mediaFromFolders];
    const uniqueMedia = Array.from(new Map(combinedMedia.map(m => [m.id, m])).values());
    
    return uniqueMedia.map(m => ({ url: m.url, type: m.type }));
  }, [sponsorsConfig.timer_playlist_id, dojoSettings.playlists, mediaList]);

  const scoreboardSponsors = useMemo(() => {
    if (!sponsorsConfig.scoreboard_playlist_id) return [];
    const playlist = dojoSettings.playlists?.find(p => p.id === sponsorsConfig.scoreboard_playlist_id);
    if (!playlist) return [];
    
    const mediaFromIds = playlist.media_ids
      .map(id => mediaList.find(m => m.id === id))
      .filter((m): m is MediaItem => m !== undefined);
      
    const mediaFromFolders = playlist.folders 
      ? mediaList.filter(m => playlist.folders!.some(f => m.name.startsWith(f + '/')))
      : [];
      
    const combinedMedia = [...mediaFromIds, ...mediaFromFolders];
    const uniqueMedia = Array.from(new Map(combinedMedia.map(m => [m.id, m])).values());
    
    return uniqueMedia.map(m => ({ url: m.url, type: m.type }));
  }, [sponsorsConfig.scoreboard_playlist_id, dojoSettings.playlists, mediaList]);

  const activePlaylistMedia = useMemo(() => {
    let targetPlaylist: Playlist | null = null;

    if (activeManualPlaylist) {
      targetPlaylist = activeManualPlaylist;
    } else {
      let playlistIdToPlay: string | undefined;

      if (activeSchedules.length > 0) {
        // Get the first active schedule
        playlistIdToPlay = activeSchedules[0].playlist_id;
      } else if (pairingCode && dojoSettings.tv_playlists?.[pairingCode]) {
        // Fallback to TV's default playlist
        playlistIdToPlay = dojoSettings.tv_playlists[pairingCode];
      }

      if (playlistIdToPlay) {
        targetPlaylist = dojoSettings.playlists?.find(p => p.id === playlistIdToPlay) || null;
      }
    }

    if (!targetPlaylist) return [];

    const mediaFromIds = targetPlaylist.media_ids
      .map(id => mediaList.find(m => m.id === id))
      .filter((m): m is MediaItem => m !== undefined);

    const mediaFromFolders = targetPlaylist.folders 
      ? mediaList.filter(m => targetPlaylist!.folders!.some(f => m.name.startsWith(f + '/')))
      : [];

    // Combine and remove duplicates
    const combinedMedia = [...mediaFromIds, ...mediaFromFolders];
    const uniqueMedia = Array.from(new Map(combinedMedia.map(m => [m.id, m])).values());
    
    return uniqueMedia;
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

  const getYouTubeVideoId = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const renderMedia = (media: MediaItem, isScheduled: boolean) => {
    const isMasterClass = activeMasterClass && media.id === 'mc';
    const shouldLoop = (!isScheduled || activePlaylistMedia.length <= 1) && !isMasterClass;
    const youtubeId = getYouTubeVideoId(media.url);
    
    if (youtubeId) {
      if (isMasterClass) {
        return (
          <YouTube
            key={`mc-${youtubeId}`}
            videoId={youtubeId}
            className="w-full h-full pointer-events-none"
            iframeClassName="w-full h-full border-0 pointer-events-none"
            opts={youtubePlayerOpts}
            onReady={(event) => {
              try {
                youtubePlayerRef.current = event.target;
                // If it autoplays but we aren't started, pause it immediately. 
                // Autoplay flag must be 1 so the iframe gets a true loaded state for APIs.
                if (!isMasterClassStartedRef.current) {
                    event.target.pauseVideo();
                } else {
                    event.target.playVideo();
                }
              } catch (e) {
                console.error('Error in youtube onReady:', e);
              }
            }}
            onPlay={(event) => {
               if (!isMasterClassStartedRef.current) {
                  event.target.pauseVideo();
               }
            }}
            onStateChange={(event) => {
              if (event.data === 0) {
                setActiveMasterClass(null);
                setIsMasterClassStarted(false);
                setIsMasterClassWaitingRelease(false);
              }
            }}
          />
        );
      } else {
        const isMutedParam = isMuted ? 1 : 0;
        // Note: We use raw iframe because react-youtube's synthetic wrappers and onReady 
        // delays often fail Chromium's strict autoplay restrictions. A raw iframe with 
        // autoplay=1&mute=1 works flawlessly on mount for regular media.
        const src = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&playsinline=1&enablejsapi=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}${shouldLoop ? `&loop=1&playlist=${youtubeId}` : ''}`;
        
        return (
          <iframe
            key={`${youtubeId}-${src}`}
            src={src}
            className="w-full h-full border-0 pointer-events-none"
            allow="autoplay; encrypted-media"
            title="YouTube Video"
            ref={(el) => {
              // We gently store the iframe so remote controls can still send postMessages to it
              // if needed, without causing an initial crash loop.
              if (el && !youtubePlayerRef.current) {
                youtubePlayerRef.current = el; // Storing iframe directly
              }
            }}
          />
        );
      }
    }
    if (media.type === 'video') {
      return (
        <video 
          key={media.url}
          src={media.url} 
          autoPlay 
          playsInline
          loop={shouldLoop} 
          muted={isMuted} 
          ref={(el) => { if (el) el.volume = volume / 100; }}
          onEnded={() => {
            if (!shouldLoop) setScheduleIndex(prev => prev + 1);
          }}
          className="w-full h-full object-contain" 
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

  if (viewMode === 'REMOTE' && session && !dojoSettings.onboarding_completed && !isLoadingSettings) {
    return <OnboardingModal teacherId={teacherId} onComplete={(settings) => setDojoSettings(prev => ({ ...prev, ...settings }))} />;
  }

  if (viewMode === 'REMOTE') {
    return <RemoteControl initialPairingCode={pairingCode || 'ALL'} teacherId={teacherId} onSendCommand={sendRemoteCommand} onClose={() => {
      // Clear URL parameter when closing remote
      window.history.replaceState({}, document.title, window.location.pathname);
      setViewMode('TV');
    }} />;
  }

  return (
    <div className="h-screen w-screen bg-black text-white flex flex-col items-center justify-center overflow-hidden relative">
      {!hasInteracted && viewMode === 'TV' && (
        <div className="absolute inset-0 z-[200] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center cursor-pointer" onClick={() => {
          setHasInteracted(true);
          setIsMuted(false);
        }}>
          <Volume2 size={64} className="text-white mb-4 animate-pulse" />
          <h2 className="text-3xl font-bold text-white mb-2">Clique para habilitar o áudio</h2>
          <p className="text-zinc-400">O navegador exige uma interação para reproduzir sons.</p>
        </div>
      )}
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
                    <div className="flex items-center gap-[2vw] pointer-events-auto w-1/3">
                      <DigitalClock />
                    </div>
                    <div className="flex items-center justify-center w-1/3 pointer-events-none">
                      <span className="text-zinc-400 font-bold uppercase tracking-widest text-[2vmin] text-center drop-shadow-lg">
                        DOJO TV ({dojoSettings.name})
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-[2vw] pointer-events-auto w-1/3">
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
                  {isLiveBroadcasting ? (
                    <div className="absolute inset-0 z-50 bg-black flex items-center justify-center">
                      <video 
                        ref={liveStreamRef} 
                        autoPlay 
                        playsInline 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-8 right-8 bg-red-600 text-white text-2xl font-black px-6 py-2 rounded-full animate-pulse flex items-center gap-3 shadow-2xl shadow-red-600/50">
                        <div className="w-4 h-4 bg-white rounded-full"></div> AO VIVO
                      </div>
                    </div>
                  ) : activeMasterClass ? (
                    <div className="w-full h-full flex items-center justify-center relative">
                      {/* Video Player - Always mounted to prevent restart on re-render */}
                      <div className={`w-full h-full rounded-[3rem] overflow-hidden border border-zinc-800 shadow-2xl relative transition-all duration-500`}>
                        {renderMedia({ id: 'mc', type: 'youtube', url: activeMasterClass.video_url, name: activeMasterClass.title }, false)}
                        <div className="absolute top-8 left-8 flex items-center gap-4 bg-black/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10">
                          <Crown className="text-blue-500" size={24} />
                          <div>
                              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">MasterClass em andamento</p>
                              <p className="text-lg font-black uppercase tracking-tight">{activeMasterClass.title}</p>
                          </div>
                        </div>
                      </div>

                      {/* Ready to Start Overlay (Capa) */}
                      {!isMasterClassStarted && !isTimerActive && (
                        <div className="absolute inset-0 z-50 bg-black rounded-[3rem] flex items-center justify-center overflow-hidden border border-zinc-800 shadow-2xl">
                          <img 
                            src={activeMasterClass.instructor_image_url || `https://picsum.photos/seed/${activeMasterClass.id}/1280/720`} 
                            className="absolute inset-0 w-full h-full object-cover opacity-40 blur-xl scale-110"
                            alt="Background"
                            referrerPolicy="no-referrer"
                          />
                          <div className="relative z-10 w-full max-w-6xl mx-auto px-12 flex flex-col md:flex-row items-center gap-12">
                            <motion.div 
                              initial={{ x: -50, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                              className="relative"
                            >
                              <div className="absolute inset-0 bg-blue-600 rounded-[3rem] blur-3xl opacity-20 animate-pulse"></div>
                              <img 
                                src={activeMasterClass.instructor_image_url || `https://picsum.photos/seed/${activeMasterClass.id}/400/400`} 
                                className="w-[40vmin] h-[40vmin] rounded-[3rem] object-cover border-8 border-zinc-900 shadow-2xl relative z-20"
                                alt={activeMasterClass.instructor_name}
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute -bottom-6 -right-6 bg-blue-600 px-8 py-3 rounded-2xl text-[1.5vmin] font-black uppercase tracking-[0.3em] shadow-2xl z-30 border-4 border-black">
                                Sensei Conectado
                              </div>
                            </motion.div>

                            <motion.div 
                              initial={{ x: 50, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                              className="flex-1 text-center md:text-left space-y-6"
                            >
                                <div className="flex items-center gap-3 justify-center md:justify-start">
                                  <span className="bg-blue-600 text-[1.2vmin] font-black uppercase tracking-widest px-4 py-1 rounded-full">CONTEÚDO EXCLUSIVO</span>
                                  <span className="text-zinc-500 font-bold uppercase tracking-widest text-[1.2vmin]">MasterClass</span>
                                  {activeMasterClass.duration && (
                                    <div className="flex items-center gap-2 text-zinc-400 font-bold tracking-widest text-[1.2vmin] ml-4 bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800">
                                      <TimerIcon size={14} className="text-blue-500" />
                                      <span>DURAÇÃO: {activeMasterClass.duration}</span>
                                    </div>
                                  )}
                                </div>
                                <h1 className="text-[8vmin] font-black tracking-tighter leading-none text-white drop-shadow-2xl">
                                  {activeMasterClass.title}
                                </h1>
                                <p className="text-[3vmin] text-zinc-400 font-medium max-w-2xl leading-relaxed">
                                  {activeMasterClass.description || `${activeMasterClass.instructor_name} ensina as técnicas mais refinadas do judô moderno neste treinamento exclusivo.`}
                                </p>
                                <div className="pt-8 flex flex-col gap-4">
                                  <div className="flex items-center gap-4 text-zinc-500 justify-center md:justify-start">
                                    <div className="w-12 h-1 bg-blue-600 rounded-full"></div>
                                    <span className="uppercase text-[1.5vmin] font-black tracking-[0.2em]">Aguardando Início do Treinamento</span>
                                  </div>
                                </div>
                            </motion.div>
                          </div>
                        </div>
                      )}

                      {/* Timer Overlay */}
                      {isTimerActive && (
                        <div className="absolute inset-0 z-50 bg-black rounded-[3rem]">
                          <TabataTimer 
                            externalCommand={remoteCommand} 
                            isMuted={isMuted} 
                            volume={volume} 
                            initialConfig={
                              activeMasterClass && lastMarkerIndex >= 0 && activeMasterClass.markers?.[lastMarkerIndex]?.action === 'START_TIMER'
                                ? { 
                                    ...activeMasterClass.markers[lastMarkerIndex].timer_config, 
                                    name: activeMasterClass.title,
                                    workLabel: activeMasterClass.title
                                  }
                                : dojoSettings.timer_config
                            }
                            isFreePlan={!isStarter || sponsorsConfig.timer_active}
                            globalSponsors={isStarter && sponsorsConfig.timer_active ? timerSponsors : (dojoSettings.timer_config?.free_sponsors || [])}
                            globalSponsorInterval={isStarter && sponsorsConfig.timer_active ? sponsorsConfig.interval : (dojoSettings.timer_config?.free_sponsor_interval || 15)}
                            onComplete={() => {
                              setIsTimerActive(false);
                              if (youtubePlayerRef.current) {
                                youtubePlayerRef.current.playVideo();
                              }
                            }}
                          />
                        </div>
                      )}

                      {/* Release Waiting Overlay */}
                      {isMasterClassWaitingRelease && !isTimerActive && (
                        <div className="absolute inset-0 z-50 bg-zinc-950 rounded-[3rem] flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in zoom-in duration-500 overflow-hidden">
                          <div className="relative">
                            <div className="absolute inset-0 bg-blue-500 rounded-full blur-3xl opacity-20 animate-pulse"></div>
                            <img 
                              src={activeMasterClass.instructor_image_url} 
                              className="w-[30vmin] h-[30vmin] rounded-full object-cover border-8 border-zinc-900 shadow-2xl relative z-10"
                              alt={activeMasterClass.instructor_name}
                            />
                            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-blue-600 px-6 py-2 rounded-full text-[1.5vmin] font-black uppercase tracking-[0.3em] shadow-xl z-20">
                              Mestre Online
                            </div>
                          </div>
                          <div className="space-y-4 px-12">
                            <h2 className="text-[5vmin] font-black tracking-tighter leading-tight max-w-4xl">
                              {activeMasterClass.markers?.[lastMarkerIndex]?.message || `"${activeMasterClass.instructor_name.split(' ')[0]}, garanta que todos estão com o kumi kata realizado corretamente!"`}
                            </h2>
                            <p className="text-[2vmin] text-zinc-500 font-bold uppercase tracking-[0.5em]">
                              Aguardando liberação do Sensei no celular...
                            </p>
                          </div>
                          <div className="pt-8">
                             <Loader2 className="w-[4vmin] h-[4vmin] text-blue-500 animate-spin opacity-50" />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : isScoreboardActive ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <Scoreboard 
                        externalCommand={remoteCommand} 
                        blueName={scoreboardConfig.blueName}
                        whiteName={scoreboardConfig.whiteName}
                        category={scoreboardConfig.category}
                        sport={scoreboardConfig.sport}
                        isFreePlan={!isStarter || sponsorsConfig.scoreboard_active}
                        globalSponsors={isStarter && sponsorsConfig.scoreboard_active ? scoreboardSponsors : (dojoSettings.scoreboard_config?.free_sponsors || [])}
                        globalSponsorInterval={isStarter && sponsorsConfig.scoreboard_active ? sponsorsConfig.interval : (dojoSettings.scoreboard_config?.free_sponsor_interval || 15)}
                        isMuted={isMuted}
                        volume={volume}
                      />
                    </div>
                  ) : isTimerActive ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <TabataTimer 
                        externalCommand={remoteCommand} 
                        isMuted={isMuted} 
                        volume={volume} 
                        initialConfig={dojoSettings.timer_config}
                        isFreePlan={!isStarter || sponsorsConfig.timer_active}
                        globalSponsors={isStarter && sponsorsConfig.timer_active ? timerSponsors : (dojoSettings.timer_config?.free_sponsors || [])}
                        globalSponsorInterval={isStarter && sponsorsConfig.timer_active ? sponsorsConfig.interval : (dojoSettings.timer_config?.free_sponsor_interval || 15)}
                      />
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
