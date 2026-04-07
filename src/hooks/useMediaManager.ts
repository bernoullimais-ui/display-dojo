import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MediaItem, ScheduleItem } from '../types';

export function useMediaManager(teacherId: string, isPro: boolean, isBusiness: boolean) {
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
    sponsorName?: string
  ) => {
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
            name: file.name,
            sponsor_name: sponsorName || null
          })
          .select()
          .single();

        if (dbError) throw dbError;
        if (mediaData) {
          setMediaList([mediaData, ...mediaList]);
        }
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Erro ao fazer upload do arquivo.');
    } finally {
      setIsUploading(false);
    }
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
    handleFileUpload,
    deleteMedia,
    addSchedule,
    deleteSchedule
  };
}
