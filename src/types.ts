export interface MediaItem {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'video' | 'audio' | 'youtube';
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
  martial_arts?: string[];
  onboarding_completed?: boolean;
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

export interface MasterClassMarker {
  id: string;
  masterclass_id: string;
  timestamp: number;
  action: 'START_TIMER' | 'WAIT_RELEASE';
  timer_config?: any;
  message?: string;
  order_index: number;
}

export interface MasterClass {
  id: string;
  title: string;
  description: string;
  instructor_name: string;
  instructor_image_url: string;
  video_url: string;
  preview_url?: string;
  duration?: string;
  price: number;
  markers?: MasterClassMarker[];
}

export interface Subscription {
  id: string;
  teacher_id: string;
  plan_id: 'FREE' | 'STARTER' | 'PRO' | 'BUSINESS';
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'inactive';
  pagarme_subscription_id?: string;
  current_period_start?: string;
  current_period_end?: string;
  created_at: string;
}

export interface MasterClassPurchase {
  id: string;
  teacher_id: string;
  masterclass_id: string;
  status: 'paid' | 'pending' | 'failed';
  amount: number;
  created_at: string;
}

export interface PaymentLog {
  id: string;
  teacher_id: string;
  type: 'subscription' | 'masterclass';
  resource_id: string;
  pagarme_id: string;
  amount: number;
  status: string;
  created_at: string;
  raw_response?: any;
}
