import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MediaItem, ScheduleItem } from '../types';

const SYSTEM_TEACHER_ID = '00000000-0000-0000-0000-000000000000';

const GLOBAL_SOUNDS: MediaItem[] = [
  {
    id: 'global-sound-1',
    name: 'Áudios/Beep Curto.mp3',
    url: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
    type: 'audio',
    teacher_id: SYSTEM_TEACHER_ID
  },
  {
    id: 'global-sound-2',
    name: 'Áudios/Sino.mp3',
    url: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
    type: 'audio',
    teacher_id: SYSTEM_TEACHER_ID
  },
  {
    id: 'global-sound-3',
    name: 'Áudios/Apito.mp3',
    url: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3',
    type: 'audio',
    teacher_id: SYSTEM_TEACHER_ID
  },
  {
    id: 'global-sound-4',
    name: 'Áudios/Gongo.mp3',
    url: 'https://assets.mixkit.co/active_storage/sfx/1084/1084-preview.mp3',
    type: 'audio',
    teacher_id: SYSTEM_TEACHER_ID
  },
  {
    id: 'global-sound-5',
    name: 'Áudios/Beep Longo.mp3',
    url: 'https://assets.mixkit.co/active_storage/sfx/2569/2569-preview.mp3',
    type: 'audio',
    teacher_id: SYSTEM_TEACHER_ID
  },
  {
    id: 'global-sound-6',
    name: 'Áudios/Buzina.mp3',
    url: 'https://assets.mixkit.co/active_storage/sfx/2803/2803-preview.mp3',
    type: 'audio',
    teacher_id: SYSTEM_TEACHER_ID
  },
  {
    id: 'global-sound-hajime',
    name: 'Áudios/Hajime.mp3',
    url: 'https://ais-dev-u6fyuyuunarpftzwkkwu4c-22964521808.us-west1.run.app/hajime.mp3',
    type: 'audio',
    teacher_id: SYSTEM_TEACHER_ID
  },
  {
    id: 'global-sound-matte',
    name: 'Áudios/Matte.mp3',
    url: 'https://ais-dev-u6fyuyuunarpftzwkkwu4c-22964521808.us-west1.run.app/matte.mp3',
    type: 'audio',
    teacher_id: SYSTEM_TEACHER_ID
  },
  {
    id: 'global-sound-soremade',
    name: 'Áudios/Soremade.mp3',
    url: 'https://ais-dev-u6fyuyuunarpftzwkkwu4c-22964521808.us-west1.run.app/soremade.mp3',
    type: 'audio',
    teacher_id: SYSTEM_TEACHER_ID
  },
  {
    id: 'global-sound-kiotsuke',
    name: 'Áudios/Kiotsuke.mp3',
    url: 'https://ais-dev-u6fyuyuunarpftzwkkwu4c-22964521808.us-west1.run.app/kiotsuke.mp3',
    type: 'audio',
    teacher_id: SYSTEM_TEACHER_ID
  }
];

export function useMediaManager(teacherId: string, isStarter: boolean, isPro: boolean, isBusiness: boolean) {
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!teacherId || !supabase) return;

    const fetchMediaAndSchedules = async () => {
      const { data: mediaData } = await supabase
        .from('media')
        .select('*')
        .in('teacher_id', [teacherId, SYSTEM_TEACHER_ID])
        .order('created_at', { ascending: false });

      const { data: scheduleData } = await supabase
        .from('schedules')
        .select('*, media:media_id(*)')
        .eq('teacher_id', teacherId);

      // Combine database media with global system sounds
      const combinedMedia = (mediaData || []).map(m => {
        // Workaround for DB constraint: if it's stored as video but is an audio file, fix it locally
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
      
      // Add global sounds if they don't already exist in the list (by URL to avoid duplicates if they were added to DB)
      GLOBAL_SOUNDS.forEach(sound => {
        if (!combinedMedia.some(m => m.url === sound.url)) {
          combinedMedia.push(sound);
        }
      });

      setMediaList(combinedMedia);
      if (scheduleData) setSchedules(scheduleData);
    };

    fetchMediaAndSchedules();
  }, [teacherId]);

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

  const generateThumbnail = (file: File): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      
      video.onloadedmetadata = () => {
        video.currentTime = Math.min(1, video.duration / 2);
      };
      
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          window.URL.revokeObjectURL(video.src);
          resolve(blob);
        }, 'image/jpeg', 0.7);
      };
      
      video.onerror = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(null);
      };
      
      video.src = URL.createObjectURL(file);
    });
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    mode: 'MEDIA' | 'LOGO' = 'MEDIA',
    onLogoUpload?: (url: string) => void,
    sponsorName?: string,
    folderName?: string | null
  ) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0 || !supabase || !teacherId) return;

    setIsUploading(true);
    
    let currentImages = mediaList.filter(m => m.type === 'image' && m.teacher_id === teacherId).length;
    let currentVideos = mediaList.filter(m => m.type === 'video' && m.teacher_id === teacherId).length;
    const newMediaItems: MediaItem[] = [];

    for (const file of files) {
      if (mode === 'MEDIA') {
        let type: 'image' | 'video' | 'audio' = 'image';
        if (file.type.startsWith('video')) type = 'video';
        else if (file.type.startsWith('audio') || file.name.toLowerCase().endsWith('.mp3') || file.name.toLowerCase().endsWith('.wav') || file.name.toLowerCase().endsWith('.m4a')) type = 'audio';
        else if (file.type.startsWith('image')) type = 'image';
        
        if (type !== 'audio' && !isStarter) {
          alert(`Upload de imagens e vídeos disponível a partir do plano STARTER. Arquivo ${file.name} ignorado.`);
          continue;
        }

        if (type === 'video') {
          if (!isPro) {
            alert(`Upload de vídeos disponível a partir do plano PRÓ. Arquivo ${file.name} ignorado.`);
            continue;
          }
          
          try {
            const duration = await checkVideoDuration(file);
            if (!isBusiness && duration > 15) {
              alert(`No plano PRÓ, vídeos podem ter no máximo 15 segundos. Arquivo ${file.name} ignorado.`);
              continue;
            }
            if (isBusiness && duration > 30) {
              alert(`No plano BUSINESS, vídeos podem ter no máximo 30 segundos. Arquivo ${file.name} ignorado.`);
              continue;
            }
          } catch (e) {
            alert(`Não foi possível verificar a duração do vídeo ${file.name}.`);
            continue;
          }

          if (!isBusiness && currentVideos >= 4) {
            alert(`Limite de 4 vídeos atingido no plano PRÓ. Arquivo ${file.name} ignorado.`);
            continue;
          }
          currentVideos++;
        } else if (type === 'image') {
          if (!isPro && currentImages >= 3) {
            alert(`Limite de 3 imagens atingido no plano STARTER. Arquivo ${file.name} ignorado.`);
            continue;
          }
          if (isPro && !isBusiness && currentImages >= 20) {
            alert(`Limite de 20 imagens atingido no plano PRÓ. Arquivo ${file.name} ignorado.`);
            continue;
          }
          currentImages++;
        }
        // Audio has no specific count limits for now
      }

      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${teacherId}/${mode.toLowerCase()}_${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('dojo-media')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Storage Upload Error:', uploadError);
          if (uploadError.message.includes('bucket not found') || uploadError.message.includes('Bucket not found')) {
            alert('ERRO: O bucket "dojo-media" não foi encontrado no seu Supabase.');
            break;
          } else if (uploadError.message.includes('Payload too large') || (uploadError as any).status === 413) {
            alert(`O arquivo ${file.name} é muito grande para o plano gratuito.`);
            continue;
          } else {
            throw uploadError;
          }
        }

        const { data: { publicUrl } } = supabase.storage
          .from('dojo-media')
          .getPublicUrl(filePath);

        const type: 'image' | 'video' | 'audio' = file.type.startsWith('video') ? 'video' : (file.type.startsWith('audio') || file.name.toLowerCase().endsWith('.mp3') || file.name.toLowerCase().endsWith('.wav') || file.name.toLowerCase().endsWith('.m4a')) ? 'audio' : 'image';
        
        // Only generate thumbnail for real videos, not audio files mapped to video
        if (type === 'video' && file.type.startsWith('video')) {
          const thumbBlob = await generateThumbnail(file);
          if (thumbBlob) {
            const thumbPath = `${filePath}_thumb.jpg`;
            await supabase.storage.from('dojo-media').upload(thumbPath, thumbBlob);
          }
        }

        if (mode === 'LOGO') {
          if (onLogoUpload) onLogoUpload(publicUrl);
        } else {
          // Sanitize filename for database to avoid issues with special characters or length
          const cleanFileName = file.name
            .replace(/[/\\]/g, '_') // Remove path separators
            .substring(0, 100); // Truncate to avoid potential DB column limits
            
          const { data: mediaData, error: dbError } = await supabase
            .from('media')
            .insert({
              teacher_id: teacherId,
              url: publicUrl,
              // CRITICAL WORKAROUND: The DB constraint 'media_type_check' likely only allows 'image' and 'video'.
              // We map 'audio' to 'video' for the DB, but restore it to 'audio' in fetchMediaAndSchedules.
              type: type === 'audio' ? 'video' : type,
              name: folderName ? `${folderName}/${cleanFileName}` : cleanFileName,
              sponsor_name: sponsorName || null
            })
            .select()
            .single();

          if (dbError) {
            console.error('Database Insert Error:', dbError);
            throw dbError;
          }
          if (mediaData) {
            newMediaItems.push(mediaData);
          }
        }
      } catch (error: any) {
        console.error(`Upload failed for ${file.name}:`, error);
        const errorMessage = error.message || (typeof error === 'string' ? error : 'Erro desconhecido');
        alert(`FALHA NO UPLOAD: ${file.name}\n\nDetalhes: ${errorMessage}\n\nPor favor, tente novamente ou verifique se o arquivo é válido.`);
      }
    }

    if (newMediaItems.length > 0) {
      setMediaList(prev => [...newMediaItems, ...prev]);
    }
    setIsUploading(false);
    
    // Reset input value to allow uploading the same file(s) again
    e.target.value = '';
  };

  const deleteMedia = async (id: string, url: string) => {
    if (!supabase) return;
    try {
      const path = url.split('dojo-media/')[1];
      await supabase.storage.from('dojo-media').remove([path]);
      
      if (url.match(/\.(mp4|webm|ogg|mov)$/i)) {
        await supabase.storage.from('dojo-media').remove([`${path}_thumb.jpg`]);
      }
      
      await supabase.from('media').delete().eq('id', id);
      setMediaList(mediaList.filter(m => m.id !== id));
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const addSchedule = async (newSchedule: any) => {
    if (!supabase) return;
    
    let payload = newSchedule;
    if (!Array.isArray(newSchedule)) {
      payload = { ...newSchedule, teacher_id: teacherId };
    }
    
    const { data, error } = await supabase
      .from('schedules')
      .insert(payload)
      .select('*, media:media_id(*)');

    if (error) {
      console.error('Error adding schedule:', error);
      return;
    }

    if (data) {
      setSchedules([...schedules, ...data]);
    }
  };

  const deleteSchedule = async (id: string) => {
    if (!supabase) return;
    await supabase.from('schedules').delete().eq('id', id);
    setSchedules(schedules.filter(s => s.id !== id));
  };

  return {
    mediaList,
    setMediaList,
    schedules,
    setSchedules,
    isUploading,
    setIsUploading,
    handleFileUpload,
    deleteMedia,
    addSchedule,
    deleteSchedule
  };
}
