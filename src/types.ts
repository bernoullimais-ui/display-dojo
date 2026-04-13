export interface MediaItem {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'video' | 'audio';
  sponsor_name?: string;
  teacher_id?: string;
}

export interface HitCycle {
  name: string;
  workTime: number;
  restTime: number;
}

export interface TimerPreset {
  id: string;
  name: string;
  mode?: 'HIT' | 'ROUNDS';
  config: {
    prepTime: number;
    workTime: number;
    restTime: number;
    cycles: number;
    prepLabel?: string;
    workLabel?: string;
    restLabel?: string;
    hitCycles?: HitCycle[];
    prepAudioUrl?: string;
    workAudioUrl?: string;
    restAudioUrl?: string;
    finishedAudioUrl?: string;
  };
}

export interface Playlist {
  id: string;
  name: string;
  media_ids: string[];
  folders?: string[];
}

export interface DojoSettings {
  name: string;
  logo_url: string | null;
  city?: string;
  state?: string;
  timer_config?: any;
  presets?: TimerPreset[];
  scoreboard_config?: any;
  ticker_config?: {
    text: string;
    active: boolean;
  };
  playlists?: Playlist[];
  tv_playlists?: Record<string, string>;
  sponsors_config?: {
    timer_active: boolean;
    scoreboard_active: boolean;
    timer_playlist_id: string;
    scoreboard_playlist_id: string;
    interval: number;
  };
  subscription_tier?: 'FREE' | 'STARTER' | 'PRO' | 'PREMIUM' | 'BUSINESS';
  media_folders?: string[];
}

export interface ScheduleItem {
  id: string;
  media_id?: string;
  playlist_id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  media?: MediaItem;
}
