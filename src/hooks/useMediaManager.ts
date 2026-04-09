import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MediaItem, ScheduleItem } from '../types';

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
        .in('teacher_id', [teacherId, '00000000-0000-0000-0000-000000000000'])
        .order('created_at', { ascending: false });

      const { data: scheduleData } = await supabase
        .from('schedules')
        .select('*, media:media_id(*)')
        .eq('teacher_id', teacherId);

      if (mediaData) setMediaList(mediaData);
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

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    mode: 'MEDIA' | 'LOGO' | 'PREP' | 'WORK' | 'REST' = 'MEDIA',
    onLogoUpload?: (url: string) => void,
    onAudioUpload?: (mode: string, url: string) => void,
    sponsorName?: string,
    folderName?: string | null
  ) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0 || !supabase) return;

    setIsUploading(true);
    
    let currentImages = mediaList.filter(m => m.type === 'image' && m.teacher_id === teacherId).length;
    let currentVideos = mediaList.filter(m => m.type === 'video' && m.teacher_id === teacherId).length;
    const newMediaItems: MediaItem[] = [];

    for (const file of files) {
      if (mode === 'MEDIA') {
        if (!isStarter) {
          alert(`Upload de mídias disponível a partir do plano STARTER. Arquivo ${file.name} ignorado.`);
          continue;
        }
        const type = file.type.startsWith('video') ? 'video' : 'image';

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

          if (!isBusiness && currentVideos >= 2) {
            alert(`Limite de 2 vídeos atingido no plano PRÓ. Arquivo ${file.name} ignorado.`);
            continue;
          }
          currentVideos++;
        } else {
          if (!isPro && currentImages >= 3) {
            alert(`Limite de 3 imagens atingido no plano STARTER. Arquivo ${file.name} ignorado.`);
            continue;
          }
          if (isPro && !isBusiness && currentImages >= 6) {
            alert(`Limite de 6 imagens atingido no plano PRÓ. Arquivo ${file.name} ignorado.`);
            continue;
          }
          currentImages++;
        }
      }

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
            break;
          } else {
            throw uploadError;
          }
        }

        const { data: { publicUrl } } = supabase.storage
          .from('dojo-media')
          .getPublicUrl(filePath);

        if (mode === 'LOGO') {
          if (onLogoUpload) onLogoUpload(publicUrl);
        } else if (['PREP', 'WORK', 'REST'].includes(mode)) {
          if (onAudioUpload) onAudioUpload(mode, publicUrl);
        } else {
          const type = file.type.startsWith('video') ? 'video' : 'image';
          const { data: mediaData, error: dbError } = await supabase
            .from('media')
            .insert({
              teacher_id: teacherId,
              url: publicUrl,
              type,
              name: folderName ? `${folderName}/${file.name}` : file.name,
              sponsor_name: sponsorName || null
            })
            .select()
            .single();

          if (dbError) throw dbError;
          if (mediaData) {
            newMediaItems.push(mediaData);
          }
        }
      } catch (error) {
        console.error(`Upload failed for ${file.name}:`, error);
        alert(`Erro ao fazer upload do arquivo ${file.name}.`);
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
