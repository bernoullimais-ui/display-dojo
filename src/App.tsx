import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  const youtubePlayerRef = useRef<any>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isLiveBroadcasting, setIsLiveBroadcasting] = useState(false);
  const liveStreamRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

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
    if (viewMode !== 'TV') return;

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
      if (mediaData) {
        const mappedMedia = mediaData.map(m => {
          if (m.type === 'video' && (
            m.url.toLowerCase().includes('.mp3') || 
            m.url.toLowerCase().includes('.wav') || 
            m.url.toLowerCase().includes('.m4a') ||
            m.name.toLowerCase().endsWith('.mp3') ||
            m.name.toLowerCase().endsWith('.wav') ||
            m.name.toLowerCase().endsWith('.m4a')
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

      setIsLoadingSettings(false);
    };
    fetchData();

    // Real-time subscriptions for TV to keep data in sync
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
        const { data: mediaData } = await supabase.from('media').select('*').in('teacher_id', [teacherId, '00000000-0000-0000-0000-000000000000']);
        if (mediaData) {
          const mappedMedia = mediaData.map(m => {
            if (m.type === 'video' && (
              m.url.toLowerCase().includes('.mp3') || 
              m.url.toLowerCase().includes('.wav') || 
              m.url.toLowerCase().includes('.m4a') ||
              m.name.toLowerCase().endsWith('.mp3') ||
              m.name.toLowerCase().endsWith('.wav') ||
              m.name.toLowerCase().endsWith('.m4a')
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
          setIsScoreboardActive(false);
          setIsTimerActive(false);
        }
        if (cmd.type === 'SHOW_PLAYLIST') {
          setActiveManualPlaylist(cmd.payload);
          setActiveMedia(null);
          setIsScoreboardActive(false);
          setIsTimerActive(false);
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
          setActiveManualPlaylist(null);
        }
        if (cmd.type === 'HIDE_SCOREBOARD') setIsScoreboardActive(false);
        if (cmd.type === 'SETTINGS_UPDATE') setDojoSettings(cmd.payload);
        if (cmd.type === 'TOGGLE_MUTE') setIsMuted(cmd.payload);
        if (cmd.type === 'SET_VOLUME') setVolume(cmd.payload);
        
        const sendYoutubeCommand = (func: string, args: any[] = []) => {
          try {
            if (youtubePlayerRef.current && typeof youtubePlayerRef.current[func] === 'function') {
              youtubePlayerRef.current[func](...args);
            } else {
              const iframe = document.querySelector('iframe[src*="youtube.com"]') as HTMLIFrameElement;
              if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: func, args: args }), '*');
              }
            }
          } catch (e) {
            console.error('Error sending youtube command:', e);
          }
        };

        if (cmd.type === 'YOUTUBE_PLAY') sendYoutubeCommand('playVideo');
        if (cmd.type === 'YOUTUBE_PAUSE') sendYoutubeCommand('pauseVideo');
        if (cmd.type === 'YOUTUBE_SEEK') {
          try {
            const currentTime = youtubePlayerRef.current?.getCurrentTime ? youtubePlayerRef.current.getCurrentTime() : 0;
            sendYoutubeCommand('seekTo', [currentTime + cmd.payload, true]);
          } catch (e) {
            console.error('Error seeking youtube:', e);
          }
        }
        if (cmd.type === 'YOUTUBE_SPEED') sendYoutubeCommand('setPlaybackRate', [cmd.payload]);

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
    };

    const channel = supabase
      .channel(`remote-control-${pairingCode}-${Math.random()}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${pairingCode}` }, handleCommandUpdate)
      .subscribe();

    // WebRTC Signaling Channel
    const rtcChannel = supabase.channel(`webrtc-${pairingCode}`);
    
    rtcChannel.on('broadcast', { event: 'signal' }, async (payload) => {
      const data = payload.payload;
      
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
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const renderMedia = (media: MediaItem, isScheduled: boolean) => {
    const shouldLoop = !isScheduled || activePlaylistMedia.length <= 1;
    const youtubeId = getYouTubeVideoId(media.url);
    
    if (youtubeId) {
      return (
        <YouTube
          videoId={youtubeId}
          className="w-full h-full"
          iframeClassName="w-full h-full border-0"
          opts={{
            width: '100%',
            height: '100%',
            playerVars: {
              autoplay: 1,
              mute: isMuted ? 1 : 0,
              loop: shouldLoop ? 1 : 0,
              playlist: shouldLoop ? youtubeId : undefined,
              controls: 0,
              modestbranding: 1,
              rel: 0,
              enablejsapi: 1,
              origin: window.location.origin
            }
          }}
          onReady={(event) => {
            try {
              youtubePlayerRef.current = event.target;
              if (isMuted) event.target.mute();
              else event.target.unMute();
              event.target.setVolume(volume);
              
              // Force play as soon as player is ready
              setTimeout(() => {
                try {
                  if (youtubePlayerRef.current && typeof youtubePlayerRef.current.playVideo === 'function') {
                    const iframe = youtubePlayerRef.current.getIframe();
                    if (iframe) {
                      youtubePlayerRef.current.playVideo();
                    }
                  }
                } catch (e) {
                  // Ignore error if player was unmounted before timeout
                }
              }, 100);
            } catch (e) {
              console.error('Error in youtube onReady:', e);
            }
          }}
          onError={(event) => {
            console.error('YouTube Player Error:', event.data);
          }}
        />
      );
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
