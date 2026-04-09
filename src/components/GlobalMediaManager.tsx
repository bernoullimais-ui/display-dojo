import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Plus, Upload, Trash2, Video, Youtube, PlayCircle, Image as ImageIcon, X, Edit, XCircle, FolderInput, Check } from 'lucide-react';

interface MediaItem {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'video';
  sponsor_name?: string;
  teacher_id?: string;
}

export default function GlobalMediaManager() {
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dojoName, setDojoName] = useState('');
  const [dojoLogo, setDojoLogo] = useState('');
  const [scoreboardSponsors, setScoreboardSponsors] = useState<{url: string, type: 'image' | 'video'}[]>([]);
  const [scoreboardSponsorInterval, setScoreboardSponsorInterval] = useState(15);
  const [timerSponsors, setTimerSponsors] = useState<{url: string, type: 'image' | 'video'}[]>([]);
  const [timerSponsorInterval, setTimerSponsorInterval] = useState(15);
  const [isUploading, setIsUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [mediaSponsorInput, setMediaSponsorInput] = useState('');
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [mediaFolders, setMediaFolders] = useState<string[]>([]);
  const [editingMedia, setEditingMedia] = useState<{ id: string, name: string, sponsor_name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const sponsorInputRef = useRef<HTMLInputElement>(null);
  const timerSponsorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchGlobalData();
  }, []);

  const fetchGlobalData = async () => {
    if (!supabase) return;
    setLoading(true);
    
    // Fetch global media
    const { data: mediaData } = await supabase
      .from('media')
      .select('*')
      .eq('teacher_id', '00000000-0000-0000-0000-000000000000');
      
    if (mediaData) setMediaList(mediaData);

    // Fetch global settings
    const { data: settingsData } = await supabase
      .from('dojo_settings')
      .select('*')
      .eq('teacher_id', '00000000-0000-0000-0000-000000000000')
      .single();

    if (settingsData) {
      setDojoName(settingsData.name || '');
      setDojoLogo(settingsData.logo_url || '');
      setMediaFolders(settingsData.media_folders || []);
      if (settingsData.scoreboard_config) {
        setScoreboardSponsors(settingsData.scoreboard_config.free_sponsors || (settingsData.scoreboard_config.free_sponsor_url ? [{url: settingsData.scoreboard_config.free_sponsor_url, type: settingsData.scoreboard_config.free_sponsor_type || 'image'}] : []));
        setScoreboardSponsorInterval(settingsData.scoreboard_config.free_sponsor_interval || 15);
      }
      if (settingsData.timer_config) {
        setTimerSponsors(settingsData.timer_config.free_sponsors || (settingsData.timer_config.free_sponsor_url ? [{url: settingsData.timer_config.free_sponsor_url, type: settingsData.timer_config.free_sponsor_type || 'image'}] : []));
        setTimerSponsorInterval(settingsData.timer_config.free_sponsor_interval || 15);
      }
    }

    setLoading(false);
  };

  const folders = Array.from(new Set([
    ...mediaFolders,
    ...mediaList.map(m => m.name.includes('/') ? m.name.split('/')[0] : null).filter(Boolean)
  ])) as string[];

  const currentFolderMedia = mediaList.filter(m => {
    if (!currentFolder) return !m.name.includes('/');
    return m.name.startsWith(currentFolder + '/');
  }).sort((a, b) => {
    const nameA = (a.name.includes('/') ? a.name.split('/').pop() : a.name) || '';
    const nameB = (b.name.includes('/') ? b.name.split('/').pop() : b.name) || '';
    return nameA.localeCompare(nameB);
  });

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !supabase) return;
    const folderName = newFolderName.trim();
    if (folders.includes(folderName)) {
      alert('Pasta já existe!');
      return;
    }
    
    const newFolders = [...mediaFolders, folderName];
    const { error } = await supabase
      .from('dojo_settings')
      .update({ media_folders: newFolders })
      .eq('teacher_id', '00000000-0000-0000-0000-000000000000');
      
    if (error) {
      console.error('Error creating folder:', error);
      alert('Erro ao criar pasta: ' + error.message);
    } else {
      setMediaFolders(newFolders);
      setNewFolderName('');
      setShowAddFolder(false);
    }
  };

  const handleDeleteFolder = async (folderName: string) => {
    if (!supabase) return;
    const folderMedia = mediaList.filter(m => m.name.startsWith(folderName + '/'));
    if (folderMedia.length > 0) {
      alert('A pasta não está vazia. Exclua as mídias primeiro.');
      return;
    }
    
    const newFolders = mediaFolders.filter(f => f !== folderName);
    const { error } = await supabase
      .from('dojo_settings')
      .update({ media_folders: newFolders })
      .eq('teacher_id', '00000000-0000-0000-0000-000000000000');
      
    if (error) {
      alert('Erro ao excluir pasta.');
    } else {
      setMediaFolders(newFolders);
      if (currentFolder === folderName) setCurrentFolder(null);
    }
  };

  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [movingMedia, setMovingMedia] = useState<MediaItem | null>(null);
  const [moveDestination, setMoveDestination] = useState<string>('');

  const handleRenameFolder = async (oldName: string) => {
    if (!editFolderName.trim() || !supabase) return;
    const newName = editFolderName.trim();
    if (newName === oldName) {
      setEditingFolder(null);
      return;
    }
    if (folders.includes(newName)) {
      alert('Pasta já existe!');
      return;
    }

    const newFolders = mediaFolders.map(f => f === oldName ? newName : f);
    if (!newFolders.includes(newName)) {
      newFolders.push(newName);
    }
    
    const mediaToUpdate = mediaList.filter(m => m.name.startsWith(oldName + '/'));
    
    try {
      await supabase.from('dojo_settings').update({ media_folders: newFolders }).eq('teacher_id', '00000000-0000-0000-0000-000000000000');
      
      const updatedMediaList = [...mediaList];
      
      for (const media of mediaToUpdate) {
        const newMediaName = media.name.replace(`${oldName}/`, `${newName}/`);
        await supabase.from('media').update({ name: newMediaName }).eq('id', media.id);
        
        const index = updatedMediaList.findIndex(m => m.id === media.id);
        if (index !== -1) {
          updatedMediaList[index] = { ...updatedMediaList[index], name: newMediaName };
        }
      }
      
      setMediaFolders(newFolders);
      setMediaList(updatedMediaList);
      if (currentFolder === oldName) setCurrentFolder(newName);
      setEditingFolder(null);
    } catch (e) {
      console.error(e);
      alert('Erro ao renomear pasta.');
    }
  };

  const handleMoveMedia = async () => {
    if (!movingMedia || !supabase) return;
    
    const baseName = movingMedia.name.includes('/') ? movingMedia.name.split('/').pop() : movingMedia.name;
    const newName = moveDestination ? `${moveDestination}/${baseName}` : baseName;
    
    try {
      const { error } = await supabase.from('media').update({ name: newName }).eq('id', movingMedia.id);
      if (error) throw error;
      
      setMediaList(prev => prev.map(m => m.id === movingMedia.id ? { ...m, name: newName! } : m));
      setMovingMedia(null);
    } catch (e) {
      console.error(e);
      alert('Erro ao mover mídia.');
    }
  };

  const saveGlobalSettings = async () => {
    if (!supabase) return;
    
    // First fetch existing to preserve other configs
    const { data: existing } = await supabase
      .from('dojo_settings')
      .select('scoreboard_config, timer_config')
      .eq('teacher_id', '00000000-0000-0000-0000-000000000000')
      .single();

    const newScoreboardConfig = {
      ...(existing?.scoreboard_config || {}),
      free_sponsors: scoreboardSponsors,
      free_sponsor_interval: scoreboardSponsorInterval
    };

    const newTimerConfig = {
      ...(existing?.timer_config || {}),
      free_sponsors: timerSponsors,
      free_sponsor_interval: timerSponsorInterval
    };

    await supabase
      .from('dojo_settings')
      .upsert({
        teacher_id: '00000000-0000-0000-0000-000000000000',
        name: dojoName,
        logo_url: dojoLogo,
        scoreboard_config: newScoreboardConfig,
        timer_config: newTimerConfig,
        updated_at: new Date().toISOString()
      });
    alert('Configurações globais salvas com sucesso!');
  };

  const removeScoreboardSponsor = async (index: number) => {
    if (!supabase) return;
    const newSponsors = [...scoreboardSponsors];
    newSponsors.splice(index, 1);
    setScoreboardSponsors(newSponsors);
    
    const { data: existing } = await supabase.from('dojo_settings').select('scoreboard_config').eq('teacher_id', '00000000-0000-0000-0000-000000000000').single();
    const newScoreboardConfig = {
      ...(existing?.scoreboard_config || {}),
      free_sponsors: newSponsors,
      free_sponsor_interval: scoreboardSponsorInterval
    };
    
    await supabase
      .from('dojo_settings')
      .upsert({
        teacher_id: '00000000-0000-0000-0000-000000000000',
        scoreboard_config: newScoreboardConfig,
        updated_at: new Date().toISOString()
      });
  };

  const removeTimerSponsor = async (index: number) => {
    if (!supabase) return;
    const newSponsors = [...timerSponsors];
    newSponsors.splice(index, 1);
    setTimerSponsors(newSponsors);
    
    const { data: existing } = await supabase.from('dojo_settings').select('timer_config').eq('teacher_id', '00000000-0000-0000-0000-000000000000').single();
    const newTimerConfig = {
      ...(existing?.timer_config || {}),
      free_sponsors: newSponsors,
      free_sponsor_interval: timerSponsorInterval
    };
    
    await supabase
      .from('dojo_settings')
      .upsert({
        teacher_id: '00000000-0000-0000-0000-000000000000',
        timer_config: newTimerConfig,
        updated_at: new Date().toISOString()
      });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, mode: 'LOGO' | 'SPONSOR' | 'TIMER_SPONSOR' | 'MEDIA' = 'MEDIA') => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0 || !supabase) return;

    setIsUploading(true);
    const newMediaItems: MediaItem[] = [];
    const newUploadedSponsors: {url: string, type: 'image' | 'video'}[] = [];
    const newUploadedTimerSponsors: {url: string, type: 'image' | 'video'}[] = [];

    for (const file of files) {
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `global/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('dojo-media')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('dojo-media')
          .getPublicUrl(filePath);

        if (mode === 'LOGO') {
          setDojoLogo(publicUrl);
          await supabase
            .from('dojo_settings')
            .upsert({
              teacher_id: '00000000-0000-0000-0000-000000000000',
              logo_url: publicUrl,
              updated_at: new Date().toISOString()
            });
        } else if (mode === 'SPONSOR') {
          const type = file.type.startsWith('video') ? 'video' : 'image';
          newUploadedSponsors.push({ url: publicUrl, type: type as 'image' | 'video' });
        } else if (mode === 'TIMER_SPONSOR') {
          const type = file.type.startsWith('video') ? 'video' : 'image';
          newUploadedTimerSponsors.push({ url: publicUrl, type: type as 'image' | 'video' });
        } else {
          const type = file.type.startsWith('video') ? 'video' : 'image';
          const { data: mediaData, error: dbError } = await supabase
            .from('media')
            .insert([{
              teacher_id: '00000000-0000-0000-0000-000000000000',
              name: currentFolder ? `${currentFolder}/${file.name}` : file.name,
              url: publicUrl,
              type: type,
              sponsor_name: mediaSponsorInput || null
            }])
            .select()
            .single();

          if (dbError) throw dbError;
          if (mediaData) newMediaItems.push(mediaData);
        }
      } catch (error) {
        console.error(`Upload failed for ${file.name}:`, error);
        alert(`Erro ao fazer upload de ${file.name}.`);
      }
    }

    if (mode === 'SPONSOR' && newUploadedSponsors.length > 0) {
      setScoreboardSponsors(prev => {
        const updated = [...prev, ...newUploadedSponsors];
        
        // Save to DB asynchronously
        supabase.from('dojo_settings').select('scoreboard_config').eq('teacher_id', '00000000-0000-0000-0000-000000000000').single().then(({ data: existing }) => {
          const newScoreboardConfig = {
            ...(existing?.scoreboard_config || {}),
            free_sponsors: updated,
            free_sponsor_interval: scoreboardSponsorInterval
          };
          supabase.from('dojo_settings').upsert({
            teacher_id: '00000000-0000-0000-0000-000000000000',
            scoreboard_config: newScoreboardConfig,
            updated_at: new Date().toISOString()
          }).then();
        });
        
        return updated;
      });
    } else if (mode === 'TIMER_SPONSOR' && newUploadedTimerSponsors.length > 0) {
      setTimerSponsors(prev => {
        const updated = [...prev, ...newUploadedTimerSponsors];
        
        // Save to DB asynchronously
        supabase.from('dojo_settings').select('timer_config').eq('teacher_id', '00000000-0000-0000-0000-000000000000').single().then(({ data: existing }) => {
          const newTimerConfig = {
            ...(existing?.timer_config || {}),
            free_sponsors: updated,
            free_sponsor_interval: timerSponsorInterval
          };
          supabase.from('dojo_settings').upsert({
            teacher_id: '00000000-0000-0000-0000-000000000000',
            timer_config: newTimerConfig,
            updated_at: new Date().toISOString()
          }).then();
        });
        
        return updated;
      });
    } else if (mode === 'MEDIA' && newMediaItems.length > 0) {
      setMediaList(prev => [...newMediaItems, ...prev]);
      setMediaSponsorInput('');
    }

    setIsUploading(false);
    if (e.target) e.target.value = '';
  };

  const handleAddMediaUrl = async () => {
    if (!mediaUrlInput || !supabase) return;
    
    setIsUploading(true);
    const isYouTube = mediaUrlInput.includes('youtube.com') || mediaUrlInput.includes('youtu.be');
    const isVideo = isYouTube || mediaUrlInput.match(/\.(mp4|webm|ogg|mov)$|vimeo\.com/i);
    const type = isVideo ? 'video' : 'image';
    
    let name = 'Mídia Web';
    if (isYouTube) {
      try {
        const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(mediaUrlInput)}`);
        const data = await response.json();
        if (data.title) {
          name = data.title;
        } else {
          name = 'YouTube Video';
        }
      } catch (e) {
        name = 'YouTube Video';
      }
    }
    
    if (currentFolder) {
      name = `${currentFolder}/${name}`;
    }

    try {
      const { data: mediaData, error: dbError } = await supabase
        .from('media')
        .insert([{
          teacher_id: '00000000-0000-0000-0000-000000000000',
          name: name,
          url: mediaUrlInput,
          type: type,
          sponsor_name: mediaSponsorInput || null
        }])
        .select()
        .single();

      if (dbError) throw dbError;
      if (mediaData) setMediaList(prev => [...prev, mediaData]);
      
      setMediaUrlInput('');
      setMediaSponsorInput('');
      setShowUrlInput(false);
    } catch (error) {
      console.error('Failed to add URL:', error);
      alert('Erro ao adicionar URL.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdateMedia = async () => {
    if (!supabase || !editingMedia) return;
    try {
      const { error } = await supabase
        .from('media')
        .update({ 
          name: editingMedia.name,
          sponsor_name: editingMedia.sponsor_name || null
        })
        .eq('id', editingMedia.id);

      if (error) throw error;

      setMediaList(prev => prev.map(m => 
        m.id === editingMedia.id 
          ? { ...m, name: editingMedia.name, sponsor_name: editingMedia.sponsor_name || undefined } 
          : m
      ));
      setEditingMedia(null);
    } catch (error) {
      console.error('Failed to update media:', error);
      alert('Erro ao atualizar mídia.');
    }
  };

  const deleteMedia = async (id: string, url: string) => {
    if (!supabase) return;
    try {
      if (url.includes('dojo-media/')) {
        const path = url.split('dojo-media/')[1];
        await supabase.storage.from('dojo-media').remove([path]);
      }
      await supabase.from('media').delete().eq('id', id);
      setMediaList(prev => prev.filter(m => m.id !== id));
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Erro ao excluir mídia.');
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Configurações Globais (Dojo Padrão) */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6">
        <div className="flex items-center gap-4 border-b border-zinc-800 pb-4">
          <div className="bg-blue-500/20 p-3 rounded-xl">
            <ImageIcon className="text-blue-500" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Padrões do Sistema</h2>
            <p className="text-zinc-500 text-sm">Nome e Logo padrão para novos usuários</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Nome Padrão do Dojo</label>
              <input 
                type="text" 
                value={dojoName}
                onChange={(e) => setDojoName(e.target.value)}
                placeholder="Ex: JudôTech"
                className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-colors"
              />
            </div>
            <button 
              onClick={saveGlobalSettings}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-colors"
            >
              Salvar Configurações
            </button>
          </div>

          <div className="space-y-4">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Logo Padrão</label>
            <div className="flex items-center gap-6">
              <div className="w-32 h-32 bg-black border border-zinc-800 rounded-2xl flex items-center justify-center overflow-hidden">
                {dojoLogo ? (
                  <img src={dojoLogo} alt="Logo Padrão" className="w-full h-full object-contain p-2" />
                ) : (
                  <ImageIcon className="text-zinc-700" size={40} />
                )}
              </div>
              <div className="flex flex-col gap-3">
                <input 
                  type="file" 
                  ref={logoInputRef} 
                  onChange={(e) => handleFileUpload(e, 'LOGO')} 
                  className="hidden" 
                  accept="image/*" 
                />
                <button 
                  onClick={() => logoInputRef.current?.click()}
                  disabled={isUploading}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 px-6 rounded-xl transition-colors flex items-center gap-2"
                >
                  {isUploading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
                  Alterar Logo
                </button>
                {dojoLogo && (
                  <button 
                    onClick={() => {
                      setDojoLogo('');
                      saveGlobalSettings();
                    }}
                    className="text-red-500 text-sm font-bold hover:text-red-400 transition-colors text-left"
                  >
                    Remover Logo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-800 pt-8 mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Patrocínio do Placar (Versão FREE)</label>
              <p className="text-xs text-zinc-600 mb-4">Exibido no rodapé do placar. Proporção recomendada: 16:9 ou super largo (ex: 1920x200px).</p>
            </div>
            
            <div className="flex items-center gap-4 mb-4">
              <label className="text-xs font-bold text-zinc-500 uppercase">Tempo de Transição (segundos):</label>
              <input 
                type="number" 
                value={scoreboardSponsorInterval}
                onChange={(e) => setScoreboardSponsorInterval(parseInt(e.target.value) || 15)}
                onBlur={saveGlobalSettings}
                className="bg-black border border-zinc-800 rounded-lg px-3 py-1 text-sm w-20 text-white outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {scoreboardSponsors.map((sponsor, index) => (
                <div key={index} className="relative group bg-black border border-zinc-800 rounded-2xl overflow-hidden h-24">
                  {sponsor.type === 'video' ? (
                    <video src={sponsor.url} className="w-full h-full object-contain" muted loop autoPlay />
                  ) : (
                    <img src={sponsor.url} alt="Sponsor" className="w-full h-full object-contain p-2" />
                  )}
                  <button 
                    onClick={() => removeScoreboardSponsor(index)}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              
              <div className="flex items-center justify-center h-24 border-2 border-dashed border-zinc-800 rounded-2xl hover:border-zinc-600 transition-colors cursor-pointer" onClick={() => sponsorInputRef.current?.click()}>
                <div className="flex flex-col items-center gap-2 text-zinc-500">
                  {isUploading ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                  <span className="text-xs font-bold uppercase">Adicionar</span>
                </div>
              </div>
            </div>
            
            <input 
              type="file" 
              ref={sponsorInputRef} 
              onChange={(e) => handleFileUpload(e, 'SPONSOR')} 
              className="hidden" 
              accept="image/*,video/*" 
              multiple
            />
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Patrocínio do Cronômetro (Versão FREE)</label>
              <p className="text-xs text-zinc-600 mb-4">Exibido nas laterais do cronômetro. Proporção recomendada: 9:16 (Vertical, ex: 1080x1920px).</p>
            </div>
            
            <div className="flex items-center gap-4 mb-4">
              <label className="text-xs font-bold text-zinc-500 uppercase">Tempo de Transição (segundos):</label>
              <input 
                type="number" 
                value={timerSponsorInterval}
                onChange={(e) => setTimerSponsorInterval(parseInt(e.target.value) || 15)}
                onBlur={saveGlobalSettings}
                className="bg-black border border-zinc-800 rounded-lg px-3 py-1 text-sm w-20 text-white outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              {timerSponsors.map((sponsor, index) => (
                <div key={index} className="relative group bg-black border border-zinc-800 rounded-2xl overflow-hidden h-32">
                  {sponsor.type === 'video' ? (
                    <video src={sponsor.url} className="w-full h-full object-contain" muted loop autoPlay />
                  ) : (
                    <img src={sponsor.url} alt="Sponsor" className="w-full h-full object-contain p-2" />
                  )}
                  <button 
                    onClick={() => removeTimerSponsor(index)}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              
              <div className="flex items-center justify-center h-32 border-2 border-dashed border-zinc-800 rounded-2xl hover:border-zinc-600 transition-colors cursor-pointer" onClick={() => timerSponsorInputRef.current?.click()}>
                <div className="flex flex-col items-center gap-2 text-zinc-500">
                  {isUploading ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                  <span className="text-xs font-bold uppercase">Adicionar</span>
                </div>
              </div>
            </div>

            <input 
              type="file" 
              ref={timerSponsorInputRef} 
              onChange={(e) => handleFileUpload(e, 'TIMER_SPONSOR')} 
              className="hidden" 
              accept="image/*,video/*" 
              multiple
            />
          </div>
        </div>
      </div>

      {/* Biblioteca Global de Mídias */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-4">
            <div className="bg-purple-500/20 p-3 rounded-xl">
              <Video className="text-purple-500" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Biblioteca Global</h2>
              <p className="text-zinc-500 text-sm">Mídias disponíveis para todos os usuários</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowUrlInput(!showUrlInput)} 
              className={`p-3 rounded-xl transition-colors ${showUrlInput ? 'bg-blue-500/20 text-blue-500' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
            >
              <Plus size={20} />
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()} 
              disabled={isUploading} 
              className="bg-blue-600 hover:bg-blue-700 p-3 rounded-xl text-white transition-colors"
            >
              {isUploading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
            </button>
            <input type="file" ref={fileInputRef} onChange={(e) => handleFileUpload(e, 'MEDIA')} className="hidden" accept="image/*,video/*" multiple />
          </div>
        </div>

        {showUrlInput && (
          <div className="bg-black/50 p-6 rounded-2xl border border-zinc-800 space-y-4">
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">URL da Mídia (YouTube, Imagem, Vídeo)</label>
              <input 
                type="text" 
                value={mediaUrlInput}
                onChange={(e) => setMediaUrlInput(e.target.value)}
                placeholder="https://..." 
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Nome do Patrocinador (Opcional)</label>
              <input 
                type="text" 
                value={mediaSponsorInput}
                onChange={(e) => setMediaSponsorInput(e.target.value)}
                placeholder="Ex: Kimonos Shihan" 
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <button 
              onClick={handleAddMediaUrl}
              className="w-full bg-blue-600 py-3 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all"
            >
              ADICIONAR MÍDIA
            </button>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-2">
            <button 
              onClick={() => setCurrentFolder(null)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${!currentFolder ? 'bg-blue-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}
            >
              Tudo
            </button>
            {folders.map(folder => (
              <div key={folder} className="flex items-center group">
                {editingFolder === folder ? (
                  <div className="flex items-center">
                    <input 
                      type="text" 
                      value={editFolderName}
                      onChange={(e) => setEditFolderName(e.target.value)}
                      className="bg-black border border-zinc-800 rounded-l-xl px-3 py-1.5 text-xs outline-none focus:border-blue-500 w-24"
                      autoFocus
                    />
                    <button 
                      onClick={() => handleRenameFolder(folder)}
                      className="px-2 py-1.5 bg-blue-600 text-white text-xs hover:bg-blue-700"
                    >
                      <Check size={14} />
                    </button>
                    <button 
                      onClick={() => setEditingFolder(null)}
                      className="px-2 py-1.5 rounded-r-xl bg-zinc-800 text-zinc-400 text-xs hover:bg-zinc-700"
                    >
                      <XCircle size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <button 
                      onClick={() => setCurrentFolder(folder)}
                      className={`px-4 py-2 rounded-l-xl text-xs font-bold whitespace-nowrap transition-colors ${currentFolder === folder ? 'bg-blue-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}
                    >
                      {folder}
                    </button>
                    <button 
                      onClick={() => { setEditingFolder(folder); setEditFolderName(folder); }}
                      className={`px-2 py-2 text-xs transition-colors ${currentFolder === folder ? 'bg-blue-700 text-white hover:bg-blue-800' : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800 hover:text-white'}`}
                    >
                      <Edit size={14} />
                    </button>
                    <button 
                      onClick={() => handleDeleteFolder(folder)}
                      className={`px-2 py-2 rounded-r-xl text-xs transition-colors ${currentFolder === folder ? 'bg-blue-700 text-white hover:bg-blue-800' : 'bg-zinc-900 text-zinc-500 hover:bg-red-500/20 hover:text-red-500'}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            ))}
            <button 
              onClick={() => setShowAddFolder(true)}
              className="px-4 py-2 rounded-xl bg-zinc-900 text-zinc-400 hover:bg-zinc-800 text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1"
            >
              <Plus size={14} /> Nova Pasta
            </button>
          </div>

          {showAddFolder && (
            <div className="flex gap-2">
              <input 
                type="text" 
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Nome da pasta"
                className="flex-1 bg-black border border-zinc-800 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500"
              />
              <button 
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="bg-blue-600 px-4 rounded-xl font-bold text-xs disabled:opacity-50"
              >
                Criar
              </button>
              <button 
                onClick={() => { setShowAddFolder(false); setNewFolderName(''); }}
                className="bg-zinc-800 px-4 rounded-xl font-bold text-xs"
              >
                Cancelar
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {currentFolderMedia.map((item) => {
              const isYouTube = item.url.includes('youtube.com') || item.url.includes('youtu.be');
              const displayName = item.name.includes('/') ? item.name.split('/').pop() : item.name;
              
              let youtubeVideoId = null;
              if (isYouTube) {
                const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
                const match = item.url.match(regExp);
                youtubeVideoId = (match && match[2].length === 11) ? match[2] : null;
              }

              return (
                <div key={item.id} className="group relative bg-black rounded-2xl overflow-hidden border border-zinc-800 aspect-square">
                  {item.type === 'image' ? (
                    <img src={item.url} className="w-full h-full object-cover opacity-70 group-hover:opacity-50 transition-opacity" />
                  ) : isYouTube ? (
                    <div className="w-full h-full relative bg-zinc-900 opacity-70 group-hover:opacity-50 transition-opacity">
                      {youtubeVideoId ? (
                        <img src={`https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`} className="w-full h-full object-cover" />
                      ) : null}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Youtube className="text-red-600 drop-shadow-lg" size={40} />
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-900 opacity-70 group-hover:opacity-50 transition-opacity">
                      <Video className="text-zinc-600" size={40} />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex flex-col gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => setEditingMedia({ id: item.id, name: item.name, sponsor_name: item.sponsor_name || '' })} 
                      className="bg-black/80 text-blue-400 p-2 rounded-full active:scale-95 transition-transform"
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      onClick={() => { setMovingMedia(item); setMoveDestination(currentFolder || ''); }} 
                      className="bg-black/80 text-blue-400 p-2 rounded-full active:scale-95 transition-transform"
                    >
                      <FolderInput size={16} />
                    </button>
                    <button 
                      onClick={() => deleteMedia(item.id, item.url)} 
                      className="bg-black/80 text-red-500 p-2 rounded-full active:scale-95 transition-transform"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {movingMedia?.id === item.id && (
                    <div className="absolute inset-0 bg-black/90 z-20 p-4 flex flex-col justify-center items-center">
                      <p className="text-xs font-bold text-white mb-2">Mover para:</p>
                      <select 
                        value={moveDestination}
                        onChange={(e) => setMoveDestination(e.target.value)}
                        className="w-full bg-zinc-800 text-white text-xs p-2 rounded-lg mb-2"
                      >
                        <option value="">Raiz (Sem pasta)</option>
                        {folders.map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                      <div className="flex gap-2 w-full">
                        <button onClick={handleMoveMedia} className="flex-1 bg-blue-600 text-white text-xs py-2 rounded-lg font-bold">Mover</button>
                        <button onClick={() => setMovingMedia(null)} className="flex-1 bg-zinc-700 text-white text-xs py-2 rounded-lg font-bold">Cancelar</button>
                      </div>
                    </div>
                  )}
                  <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded-lg max-w-[50%]">
                    <p className="text-[10px] font-bold text-white truncate">{displayName}</p>
                  </div>
                  {item.sponsor_name && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-2 text-center">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Patrocínio</p>
                      <p className="text-xs font-bold text-white truncate">{item.sponsor_name}</p>
                    </div>
                  )}
                </div>
              );
            })}
            {currentFolderMedia.length === 0 && (
              <div className="col-span-full py-12 text-center text-zinc-500">
                <ImageIcon className="mx-auto mb-4 opacity-20" size={48} />
                <p>Nenhuma mídia encontrada.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {editingMedia && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl w-full max-w-md space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Editar Mídia</h3>
              <button onClick={() => setEditingMedia(null)} className="text-zinc-500 hover:text-white">
                <XCircle size={24} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Nome da Mídia</label>
                <input 
                  type="text" 
                  value={editingMedia.name}
                  onChange={(e) => setEditingMedia({ ...editingMedia, name: e.target.value })}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Nome do Patrocinador (Opcional)</label>
                <input 
                  type="text" 
                  value={editingMedia.sponsor_name}
                  onChange={(e) => setEditingMedia({ ...editingMedia, sponsor_name: e.target.value })}
                  placeholder="Ex: Kimonos Shihan" 
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <button 
                onClick={handleUpdateMedia}
                className="w-full bg-blue-600 py-3 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all"
              >
                SALVAR ALTERAÇÕES
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
