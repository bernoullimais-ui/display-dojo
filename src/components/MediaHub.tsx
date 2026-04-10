import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { MediaItem, Playlist, DojoSettings, ScheduleItem } from '../types';
import { Maximize, XCircle, Plus, Loader2, Upload, Crown, Lock, Trash2, PlayCircle, Image as ImageIcon, Video, Calendar, Clock, Edit, Settings, Check, Youtube, RotateCcw, VolumeX, Volume2, Volume1, FolderInput, CheckSquare, Folder, FolderUp } from 'lucide-react';

interface MediaHubProps {
  teacherId: string;
  isStarter: boolean;
  isPro: boolean;
  isBusiness: boolean;
  dojoSettings: DojoSettings;
  setDojoSettings: React.Dispatch<React.SetStateAction<DojoSettings>>;
  handleCommand: (type: string, payload?: any) => void;
  activeSubTab: 'LIBRARY' | 'SCHEDULE' | 'DOJO' | 'TICKER' | 'PLAYLISTS';
  setActiveSubTab: React.Dispatch<React.SetStateAction<'LIBRARY' | 'SCHEDULE' | 'DOJO' | 'TICKER' | 'PLAYLISTS'>>;
  mediaList: MediaItem[];
  setMediaList: React.Dispatch<React.SetStateAction<MediaItem[]>>;
  schedules: ScheduleItem[];
  isUploading: boolean;
  setIsUploading: React.Dispatch<React.SetStateAction<boolean>>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, mode?: 'MEDIA' | 'LOGO' | 'PREP' | 'WORK' | 'REST', onLogoUpload?: (url: string) => void, onAudioUpload?: (mode: string, url: string) => void, sponsorName?: string, folderName?: string | null) => Promise<void>;
  deleteMedia: (id: string, url: string) => Promise<void>;
  addSchedule: (schedule: any) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  tickerConfig: any;
  sponsorsConfig: any;
  updateTickerConfig: (field: 'text' | 'active', value: string | boolean) => Promise<void>;
  updateSponsorsConfig: (field: string, value: any) => Promise<void>;
  updatePlaylists: (playlists: Playlist[]) => Promise<void>;
  handleConfigChange: (newSettings: any) => Promise<void>;
}

export default function MediaHub({
  teacherId,
  isStarter,
  isPro,
  isBusiness,
  dojoSettings,
  setDojoSettings,
  handleCommand,
  activeSubTab,
  setActiveSubTab,
  mediaList,
  setMediaList,
  schedules,
  isUploading,
  setIsUploading,
  handleFileUpload,
  deleteMedia,
  addSchedule,
  deleteSchedule,
  tickerConfig,
  sponsorsConfig,
  updateTickerConfig,
  updateSponsorsConfig,
  updatePlaylists,
  handleConfigChange
}: MediaHubProps) {
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [mediaSponsorInput, setMediaSponsorInput] = useState('');
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    playlist_id: '',
    days_of_week: [new Date().getDay()],
    start_time: '08:00',
    end_time: '10:00'
  });
  const [dojoForm, setDojoForm] = useState({ name: dojoSettings.name || '', city: dojoSettings.city || '', state: dojoSettings.state || '' });
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const allFolders = Array.from(new Set([
    ...(dojoSettings.media_folders || []),
    ...mediaList
      .filter(m => isPro ? true : m.teacher_id !== '00000000-0000-0000-0000-000000000000')
      .map(m => {
        const parts = m.name.split('/');
        if (parts.length > 1) {
          return parts.slice(0, -1).join('/');
        }
        return null;
      })
      .filter(Boolean)
  ])) as string[];

  const rootFolders = Array.from(new Set(allFolders.map(f => f.split('/')[0])));

  const currentSubFolders = currentFolder 
    ? Array.from(new Set(allFolders
        .filter(f => f.startsWith(currentFolder + '/') && f !== currentFolder)
        .map(f => {
          const rest = f.substring(currentFolder.length + 1);
          return rest.split('/')[0];
        })
      ))
    : [];

  const currentFolderMedia = mediaList.filter(m => {
    if (!isPro && m.teacher_id === '00000000-0000-0000-0000-000000000000' && m.name.includes('/')) {
      return false;
    }
    if (!currentFolder) return !m.name.includes('/');
    if (!m.name.startsWith(currentFolder + '/')) return false;
    const rest = m.name.substring(currentFolder.length + 1);
    return !rest.includes('/');
  }).sort((a, b) => {
    const nameA = (a.name.includes('/') ? a.name.split('/').pop() : a.name) || '';
    const nameB = (b.name.includes('/') ? b.name.split('/').pop() : b.name) || '';
    return nameA.localeCompare(nameB);
  });

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !supabase) return;
    const folderName = newFolderName.trim();
    const fullPath = currentFolder ? `${currentFolder}/${folderName}` : folderName;
    
    if (allFolders.includes(fullPath)) {
      alert('Pasta já existe!');
      return;
    }
    
    const newFolders = [...(dojoSettings.media_folders || []), fullPath];
    const { error } = await supabase
      .from('dojo_settings')
      .update({ media_folders: newFolders })
      .eq('teacher_id', teacherId);
      
    if (error) {
      console.error('Error creating folder:', error);
      alert('Erro ao criar pasta: ' + error.message);
    } else {
      setDojoSettings(prev => ({ ...prev, media_folders: newFolders }));
      setNewFolderName('');
      setShowAddFolder(false);
    }
  };

  const handleDeleteFolder = async (folderPath: string) => {
    if (!supabase) return;
    const folderMedia = mediaList.filter(m => m.name.startsWith(folderPath + '/'));
    const subFolders = allFolders.filter(f => f.startsWith(folderPath + '/') && f !== folderPath);
    
    if (folderMedia.length > 0 || subFolders.length > 0) {
      alert('A pasta não está vazia. Exclua as mídias e sub-pastas primeiro.');
      return;
    }
    
    const newFolders = (dojoSettings.media_folders || []).filter(f => f !== folderPath);
    const { error } = await supabase
      .from('dojo_settings')
      .update({ media_folders: newFolders })
      .eq('teacher_id', teacherId);
      
    if (error) {
      alert('Erro ao excluir pasta.');
    } else {
      setDojoSettings(prev => ({ ...prev, media_folders: newFolders }));
      if (currentFolder === folderPath) setCurrentFolder(null);
    }
  };

  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [movingMedia, setMovingMedia] = useState<MediaItem | null>(null);
  const [moveDestination, setMoveDestination] = useState<string>('');

  const handleRenameFolder = async (oldPath: string) => {
    if (!editFolderName.trim() || !supabase) return;
    const newName = editFolderName.trim();
    
    const parentPath = oldPath.includes('/') ? oldPath.substring(0, oldPath.lastIndexOf('/')) : null;
    const newPath = parentPath ? `${parentPath}/${newName}` : newName;

    if (newPath === oldPath) {
      setEditingFolder(null);
      return;
    }
    if (allFolders.includes(newPath)) {
      alert('Pasta já existe!');
      return;
    }

    const newFolders = (dojoSettings.media_folders || []).map(f => {
      if (f === oldPath) return newPath;
      if (f.startsWith(oldPath + '/')) return f.replace(`${oldPath}/`, `${newPath}/`);
      return f;
    });
    if (!newFolders.includes(newPath)) {
      newFolders.push(newPath);
    }
    
    const mediaToUpdate = mediaList.filter(m => m.name.startsWith(oldPath + '/'));
    
    try {
      await supabase.from('dojo_settings').update({ media_folders: newFolders }).eq('teacher_id', teacherId);
      
      const updatedMediaList = [...mediaList];
      
      for (const media of mediaToUpdate) {
        const newMediaName = media.name.replace(`${oldPath}/`, `${newPath}/`);
        await supabase.from('media').update({ name: newMediaName }).eq('id', media.id);
        
        const index = updatedMediaList.findIndex(m => m.id === media.id);
        if (index !== -1) {
          updatedMediaList[index] = { ...updatedMediaList[index], name: newMediaName };
        }
      }
      
      setDojoSettings(prev => ({ ...prev, media_folders: newFolders }));
      setMediaList(updatedMediaList);
      if (currentFolder === oldPath) setCurrentFolder(newPath);
      else if (currentFolder?.startsWith(oldPath + '/')) {
        setCurrentFolder(currentFolder.replace(`${oldPath}/`, `${newPath}/`));
      }
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

  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [showBatchMoveModal, setShowBatchMoveModal] = useState(false);
  const [batchMoveDestination, setBatchMoveDestination] = useState<string>('');

  const toggleMediaSelection = (id: string) => {
    setSelectedMediaIds(prev => prev.includes(id) ? prev.filter(mediaId => mediaId !== id) : [...prev, id]);
  };

  const handleBatchDelete = async () => {
    if (!supabase || selectedMediaIds.length === 0) return;
    if (!confirm(`Tem certeza que deseja excluir ${selectedMediaIds.length} mídias?`)) return;
    
    try {
      const mediaToDelete = mediaList.filter(m => selectedMediaIds.includes(m.id));
      for (const media of mediaToDelete) {
        if (media.url.includes('dojo-media/')) {
          const path = media.url.split('dojo-media/')[1];
          await supabase.storage.from('dojo-media').remove([path]);
          if (media.url.match(/\.(mp4|webm|ogg|mov)$/i)) {
            await supabase.storage.from('dojo-media').remove([`${path}_thumb.jpg`]);
          }
        }
      }
      
      await supabase.from('media').delete().in('id', selectedMediaIds);
      setMediaList(prev => prev.filter(m => !selectedMediaIds.includes(m.id)));
      setSelectedMediaIds([]);
      setIsBatchMode(false);
    } catch (error) {
      console.error('Batch delete failed:', error);
      alert('Erro ao excluir mídias.');
    }
  };

  const handleBatchMove = async () => {
    if (!supabase || selectedMediaIds.length === 0) return;
    
    try {
      const mediaToMove = mediaList.filter(m => selectedMediaIds.includes(m.id));
      const updatedMediaList = [...mediaList];
      
      for (const media of mediaToMove) {
        const baseName = media.name.includes('/') ? media.name.split('/').pop() : media.name;
        const newName = batchMoveDestination ? `${batchMoveDestination}/${baseName}` : baseName;
        
        await supabase.from('media').update({ name: newName }).eq('id', media.id);
        
        const index = updatedMediaList.findIndex(m => m.id === media.id);
        if (index !== -1) {
          updatedMediaList[index] = { ...updatedMediaList[index], name: newName! };
        }
      }
      
      setMediaList(updatedMediaList);
      setSelectedMediaIds([]);
      setShowBatchMoveModal(false);
      setIsBatchMode(false);
    } catch (error) {
      console.error('Batch move failed:', error);
      alert('Erro ao mover mídias.');
    }
  };

  const saveDojoConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    
    if (!dojoForm.name || !dojoForm.city || !dojoForm.state) {
      alert('Por favor, preencha o Nome do Dojo, Cidade e Estado.');
      return;
    }

    const { error } = await supabase
      .from('dojo_settings')
      .upsert({
        teacher_id: teacherId,
        name: dojoForm.name,
        city: dojoForm.city,
        state: dojoForm.state,
        updated_at: new Date().toISOString()
      });

    if (error) {
      alert('Erro ao salvar configurações.');
    } else {
      setDojoSettings(prev => ({ ...prev, name: dojoForm.name, city: dojoForm.city, state: dojoForm.state }));
      handleCommand('SETTINGS_UPDATE', { ...dojoSettings, name: dojoForm.name, city: dojoForm.city, state: dojoForm.state });
      alert('Configurações salvas com sucesso!');
    }
  };

  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(50);
  const [showVolumePopup, setShowVolumePopup] = useState(false);

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    handleCommand('TOGGLE_MUTE', newMuted);
  };

  const updateVolume = (val: number) => {
    setVolume(val);
    handleCommand('SET_VOLUME', val);
  };

  const handleAddSchedule = async () => {
    if (!newSchedule.playlist_id) return alert('Selecione uma playlist!');
    if (newSchedule.days_of_week.length === 0) return alert('Selecione pelo menos um dia!');
    
    const payloads = newSchedule.days_of_week.map(day => ({
      teacher_id: teacherId,
      playlist_id: newSchedule.playlist_id,
      day_of_week: day,
      start_time: newSchedule.start_time,
      end_time: newSchedule.end_time
    }));

    await addSchedule(payloads);
    setShowAddSchedule(false);
  };

  
  

  

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);






  const handleAddMediaUrl = async () => {
    if (!mediaUrlInput || !supabase) return;
    
    setIsUploading(true);
    const isYouTube = mediaUrlInput.includes('youtube.com') || mediaUrlInput.includes('youtu.be');
    const isVideo = isYouTube || mediaUrlInput.match(/\.(mp4|webm|ogg|mov)$|vimeo\.com/i);
    const type = isVideo ? 'video' : 'image';
    
    const currentImages = mediaList.filter(m => m.type === 'image' && m.teacher_id === teacherId).length;
    const currentVideos = mediaList.filter(m => m.type === 'video' && m.teacher_id === teacherId).length;

    if (type === 'video') {
      if (!isPro) {
        setIsUploading(false);
        return alert('Adição de vídeos disponível a partir do plano PRÓ.');
      }
      if (!isBusiness && currentVideos >= 2) {
        setIsUploading(false);
        return alert('Limite de 2 vídeos atingido no plano PRÓ.');
      }
    } else {
      if (!isPro && currentImages >= 3) {
        setIsUploading(false);
        return alert('Limite de 3 imagens atingido no plano STARTER.');
      }
      if (isPro && !isBusiness && currentImages >= 6) {
        setIsUploading(false);
        return alert('Limite de 6 imagens atingido no plano PRÓ.');
      }
    }

    try {
      let name = mediaUrlInput.split('/').pop()?.split('?')[0] || 'Mídia via URL';
      
      if (isYouTube) {
        try {
          const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(mediaUrlInput)}`);
          const data = await response.json();
          if (data.title) {
            name = data.title;
          } else {
            name = 'Vídeo do YouTube';
          }
        } catch (e) {
          name = 'Vídeo do YouTube';
        }
      }
      
      if (currentFolder) {
        name = `${currentFolder}/${name}`;
      }

      const { data: mediaData, error: dbError } = await supabase
        .from('media')
        .insert([{
          teacher_id: teacherId,
          name: name,
          url: mediaUrlInput,
          type: type,
          sponsor_name: mediaSponsorInput || null
        }])
        .select()
        .single();

      if (dbError) throw dbError;
      setMediaList([mediaData, ...mediaList]);
      setMediaUrlInput('');
      setMediaSponsorInput('');
      setShowUrlInput(false);
    } catch (error: any) {
      console.error('URL add failed:', error);
      alert('Falha ao adicionar URL: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setIsUploading(false);
    }
  };



















  return (
    <div className="space-y-6">
            <div className="w-full grid grid-cols-5 bg-zinc-900/50 p-1 rounded-xl mb-4">
              <button onClick={() => setActiveSubTab('LIBRARY')} className={`py-2 px-1 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest transition-all truncate ${activeSubTab === 'LIBRARY' ? 'bg-zinc-800 text-white rounded-lg' : 'text-zinc-500'}`}>Biblio</button>
              <button onClick={() => setActiveSubTab('PLAYLISTS')} className={`py-2 px-1 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest transition-all truncate ${activeSubTab === 'PLAYLISTS' ? 'bg-zinc-800 text-white rounded-lg' : 'text-zinc-500'}`}>Listas</button>
              <button onClick={() => setActiveSubTab('SCHEDULE')} className={`py-2 px-1 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest transition-all truncate ${activeSubTab === 'SCHEDULE' ? 'bg-zinc-800 text-white rounded-lg' : 'text-zinc-500'}`}>Agenda</button>
              <button onClick={() => setActiveSubTab('TICKER')} className={`py-2 px-1 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest transition-all truncate ${activeSubTab === 'TICKER' ? 'bg-zinc-800 text-white rounded-lg' : 'text-zinc-500'}`}>Letreiro</button>
              <button onClick={() => setActiveSubTab('DOJO')} className={`py-2 px-1 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest transition-all truncate ${activeSubTab === 'DOJO' ? 'bg-zinc-800 text-white rounded-lg' : 'text-zinc-500'}`}>Dojo</button>
            </div>

            {activeSubTab === 'LIBRARY' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">Biblioteca</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleCommand('TOGGLE_FULLSCREEN')} 
                  className="p-2 rounded-full bg-blue-500/20 text-blue-500 hover:bg-blue-500/30 transition-colors"
                  title="Tela Cheia"
                >
                  <Maximize size={20} />
                </button>
                <button 
                  onClick={() => handleCommand('STOP_MEDIA')} 
                  className="p-2 rounded-full bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors"
                  title="Interromper Mídia"
                >
                  <XCircle size={20} />
                </button>
                <button 
                  onClick={() => isStarter ? setShowUrlInput(!showUrlInput) : alert('Recurso STARTER')} 
                  className={`p-2 rounded-full transition-colors ${showUrlInput ? 'bg-blue-500/20 text-blue-500' : 'bg-zinc-800 text-zinc-400'}`}
                >
                  <Plus size={20} />
                </button>
                <button onClick={() => isStarter ? fileInputRef.current?.click() : alert('Recurso STARTER')} disabled={isUploading} className="bg-blue-600 p-2 rounded-full text-white">
                  {isUploading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
                </button>
              </div>
              <input type="file" ref={fileInputRef} onChange={(e) => handleFileUpload(e, 'MEDIA', undefined, undefined, undefined, currentFolder)} className="hidden" accept="image/*,video/*" multiple />
            </div>

            {!isStarter && (
              <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 p-8 rounded-3xl text-center space-y-4 relative overflow-hidden mb-6">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Crown size={120} />
                </div>
                <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Lock className="text-blue-500" size={32} />
                </div>
                <h3 className="text-xl font-bold text-white">Recurso STARTER</h3>
                <p className="text-zinc-400 text-sm max-w-xs mx-auto">
                  O Hub de Mídias está disponível a partir do Plano STARTER. Playlists, Agenda e Letreiro Digital no Plano PRÓ.
                </p>
                <a href="https://www.judotech.com.br/display-planos" target="_blank" rel="noopener noreferrer" className="inline-block bg-blue-600 text-white px-8 py-3 rounded-xl font-bold mt-4 hover:bg-blue-700 transition-colors">
                  Fazer Upgrade
                </a>
              </div>
            )}

            {isStarter && showUrlInput && (
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Adicionar via URL</p>
                <div className="flex flex-col gap-2">
                  <input 
                    type="url" 
                    value={mediaUrlInput}
                    onChange={(e) => setMediaUrlInput(e.target.value)}
                    placeholder="https://exemplo.com/imagem.jpg"
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500"
                  />
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={mediaSponsorInput}
                      onChange={(e) => setMediaSponsorInput(e.target.value)}
                      placeholder="Nome do Patrocinador (Opcional)"
                      className="flex-1 bg-black border border-zinc-800 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500"
                    />
                    <button 
                      onClick={handleAddMediaUrl}
                      disabled={isUploading || !mediaUrlInput}
                      className="bg-blue-600 px-4 rounded-xl font-bold text-xs disabled:opacity-50"
                    >
                      OK
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isStarter && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-2">
                  <button 
                    onClick={() => setCurrentFolder(null)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${!currentFolder ? 'bg-blue-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}
                  >
                    Tudo
                  </button>
                  {rootFolders.map(folder => (
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
                            className={`px-4 py-2 rounded-l-xl text-xs font-bold whitespace-nowrap transition-colors ${currentFolder === folder || currentFolder?.startsWith(folder + '/') ? 'bg-blue-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}
                          >
                            {folder}
                          </button>
                          <button 
                            onClick={() => { setEditingFolder(folder); setEditFolderName(folder); }}
                            className={`px-2 py-2 text-xs transition-colors ${currentFolder === folder || currentFolder?.startsWith(folder + '/') ? 'bg-blue-700 text-white hover:bg-blue-800' : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800 hover:text-white'}`}
                          >
                            <Edit size={14} />
                          </button>
                          <button 
                            onClick={() => handleDeleteFolder(folder)}
                            className={`px-2 py-2 rounded-r-xl text-xs transition-colors ${currentFolder === folder || currentFolder?.startsWith(folder + '/') ? 'bg-blue-700 text-white hover:bg-blue-800' : 'bg-zinc-900 text-zinc-500 hover:bg-red-500/20 hover:text-red-500'}`}
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
                  <button 
                    onClick={() => setIsBatchMode(!isBatchMode)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1 ${isBatchMode ? 'bg-blue-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}
                  >
                    <CheckSquare size={14} /> Selecionar
                  </button>
                </div>

                {isBatchMode && (
                  <div className="flex items-center justify-between bg-blue-600/20 border border-blue-500/50 p-3 rounded-xl mb-4">
                    <span className="text-sm font-bold text-blue-400">{selectedMediaIds.length} mídias selecionadas</span>
                    <div className="flex gap-2">
                      <button onClick={() => setShowBatchMoveModal(true)} disabled={selectedMediaIds.length === 0} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50">Mover</button>
                      <button onClick={handleBatchDelete} disabled={selectedMediaIds.length === 0} className="bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50">Excluir</button>
                      <button onClick={() => { setIsBatchMode(false); setSelectedMediaIds([]); }} className="bg-zinc-800 text-white px-4 py-2 rounded-lg text-xs font-bold">Cancelar</button>
                    </div>
                  </div>
                )}

                {showBatchMoveModal && (
                  <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6">
                    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl w-full max-w-md space-y-6">
                      <h3 className="text-xl font-bold text-white">Mover {selectedMediaIds.length} mídias</h3>
                      <p className="text-xs font-bold text-zinc-400 mb-2">Mover para:</p>
                      <select 
                        value={batchMoveDestination}
                        onChange={(e) => setBatchMoveDestination(e.target.value)}
                        className="w-full bg-black border border-zinc-800 text-white text-sm p-3 rounded-xl outline-none focus:border-blue-500"
                      >
                        <option value="">Raiz (Sem pasta)</option>
                        {allFolders.map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                      <div className="flex gap-2 w-full pt-4">
                        <button onClick={handleBatchMove} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold">Mover</button>
                        <button onClick={() => setShowBatchMoveModal(false)} className="flex-1 bg-zinc-800 text-white py-3 rounded-xl font-bold">Cancelar</button>
                      </div>
                    </div>
                  </div>
                )}

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

                <div className="grid grid-cols-2 gap-4">
                  {currentFolder && (
                    <div 
                      className="group relative bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 aspect-square cursor-pointer flex flex-col items-center justify-center hover:bg-zinc-800 transition-colors"
                      onClick={() => {
                        const parts = currentFolder.split('/');
                        parts.pop();
                        setCurrentFolder(parts.length > 0 ? parts.join('/') : null);
                      }}
                    >
                      <FolderUp size={40} className="text-zinc-500 mb-2" />
                      <span className="text-xs font-bold text-zinc-400">Voltar</span>
                    </div>
                  )}

                  {currentSubFolders.map(subFolder => {
                    const fullPath = currentFolder ? `${currentFolder}/${subFolder}` : subFolder;
                    return (
                      <div 
                        key={subFolder}
                        className="group relative bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 aspect-square cursor-pointer flex flex-col items-center justify-center hover:bg-zinc-800 transition-colors"
                        onDoubleClick={() => {
                          if (editingFolder !== fullPath) {
                            setCurrentFolder(fullPath);
                          }
                        }}
                      >
                        {editingFolder === fullPath ? (
                          <div className="flex flex-col items-center p-4 w-full gap-2">
                            <input 
                              type="text" 
                              value={editFolderName}
                              onChange={(e) => setEditFolderName(e.target.value)}
                              className="w-full bg-black border border-zinc-800 rounded-lg px-2 py-1 text-xs outline-none focus:border-blue-500 text-center"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex gap-2 w-full">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleRenameFolder(fullPath); }}
                                className="flex-1 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
                              >
                                <Check size={14} className="mx-auto" />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setEditingFolder(null); }}
                                className="flex-1 py-1 bg-zinc-800 text-zinc-400 text-xs rounded-lg hover:bg-zinc-700"
                              >
                                <XCircle size={14} className="mx-auto" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <Folder size={40} className="text-blue-500 mb-2" />
                            <span className="text-xs font-bold text-zinc-300">{subFolder}</span>
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  setEditingFolder(fullPath); 
                                  setEditFolderName(subFolder); 
                                }} 
                                className="p-1.5 bg-blue-600 rounded-lg text-white"
                              >
                                <Edit size={14} />
                              </button>
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  handleDeleteFolder(fullPath); 
                                }} 
                                className="p-1.5 bg-red-600 rounded-lg text-white"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}

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
                      <div 
                        key={item.id} 
                        className={`group relative bg-zinc-900 rounded-2xl overflow-hidden border aspect-square ${isBatchMode ? 'cursor-pointer' : ''} ${selectedMediaIds.includes(item.id) ? 'border-blue-500 border-2' : 'border-zinc-800'}`}
                        onClick={() => { if (isBatchMode) toggleMediaSelection(item.id); }}
                      >
                        {item.type === 'image' ? (
                          <img src={item.url} className="w-full h-full object-cover opacity-70" />
                        ) : isYouTube ? (
                          <div className="w-full h-full relative bg-zinc-900 opacity-70">
                            {youtubeVideoId ? (
                              <img src={`https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`} className="w-full h-full object-cover" />
                            ) : null}
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Youtube className="text-red-600 drop-shadow-lg" size={40} />
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-full relative bg-zinc-900 opacity-70">
                            <img 
                              src={`${item.url}_thumb.jpg`} 
                              className="w-full h-full object-cover" 
                              onError={(e) => { 
                                e.currentTarget.style.display = 'none'; 
                                e.currentTarget.nextElementSibling?.classList.remove('hidden'); 
                              }} 
                            />
                            <div className="absolute inset-0 flex items-center justify-center hidden">
                              <Video className="text-zinc-600" size={40} />
                            </div>
                          </div>
                        )}
                        
                        {isBatchMode && (
                          <div className="absolute inset-0 bg-black/50 z-20 flex items-center justify-center">
                            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${selectedMediaIds.includes(item.id) ? 'bg-blue-500 border-blue-500' : 'border-white/50'}`}>
                              {selectedMediaIds.includes(item.id) && <Check size={16} className="text-white" />}
                            </div>
                          </div>
                        )}

                        {!isBatchMode && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <button onClick={() => handleCommand('SHOW_MEDIA', item)} className="bg-white/90 text-black p-4 rounded-full shadow-lg pointer-events-auto active:scale-95 transition-transform">
                              <PlayCircle size={32} />
                            </button>
                          </div>
                        )}
                        {!isBatchMode && item.teacher_id !== 'GLOBAL' && (
                          <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
                            <button onClick={() => { setMovingMedia(item); setMoveDestination(currentFolder || ''); }} className="bg-black/60 text-blue-400 p-2 rounded-full active:scale-95 transition-transform">
                              <FolderInput size={18} />
                            </button>
                            <button onClick={() => deleteMedia(item.id, item.url)} className="bg-black/60 text-red-500 p-2 rounded-full active:scale-95 transition-transform">
                              <Trash2 size={18} />
                            </button>
                          </div>
                        )}
                        {!isBatchMode && movingMedia?.id === item.id && (
                          <div className="absolute inset-0 bg-black/90 z-20 p-4 flex flex-col justify-center items-center">
                            <p className="text-xs font-bold text-white mb-2">Mover para:</p>
                            <select 
                              value={moveDestination}
                              onChange={(e) => setMoveDestination(e.target.value)}
                              className="w-full bg-zinc-800 text-white text-xs p-2 rounded-lg mb-2"
                            >
                              <option value="">Raiz (Sem pasta)</option>
                              {allFolders.map(f => (
                                <option key={f} value={f}>{f}</option>
                              ))}
                            </select>
                            <div className="flex gap-2 w-full">
                              <button onClick={handleMoveMedia} className="flex-1 bg-blue-600 text-white text-xs py-2 rounded-lg font-bold">Mover</button>
                              <button onClick={() => setMovingMedia(null)} className="flex-1 bg-zinc-700 text-white text-xs py-2 rounded-lg font-bold">Cancelar</button>
                            </div>
                          </div>
                        )}
                        <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded-lg max-w-[70%]">
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
                </div>
              </div>
            )}
          </div>
        )}

            {activeSubTab === 'SCHEDULE' && (
          <div className="space-y-6">
            {!isPro ? (
              <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 p-8 rounded-3xl text-center space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Crown size={120} />
                </div>
                <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Lock className="text-blue-500" size={32} />
                </div>
                <h3 className="text-xl font-bold text-white">Recurso PRÓ</h3>
                <p className="text-zinc-400 text-sm max-w-xs mx-auto">
                  A Agenda está disponível a partir do Plano PRÓ.
                </p>
                <a href="https://www.judotech.com.br/display-planos" target="_blank" rel="noopener noreferrer" className="inline-block bg-blue-600 text-white px-8 py-3 rounded-xl font-bold mt-4 hover:bg-blue-700 transition-colors">
                  Fazer Upgrade
                </a>
              </div>
            ) : (
              <>
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Tempo de Exibição de Imagens (segundos)</label>
                <p className="text-xs text-zinc-600">Define quanto tempo cada imagem ou vídeo do YouTube ficará na tela antes de alternar.</p>
                <input 
                  type="number" 
                  min="5"
                  max="300"
                  defaultValue={(dojoSettings.timer_config || {}).imageDuration || 15}
                  onBlur={(e) => handleConfigChange({ imageDuration: parseInt(e.target.value) })}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-between items-center">
              <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">Programação Semanal</h3>
              <button 
                onClick={() => setShowAddSchedule(!showAddSchedule)} 
                className={`p-2 rounded-full transition-colors ${showAddSchedule ? 'bg-red-500/20 text-red-500' : 'bg-zinc-800 text-blue-500 hover:bg-zinc-700'}`}
              >
                {showAddSchedule ? <RotateCcw size={20} /> : <Plus size={20} />}
              </button>
            </div>

            {showAddSchedule && (
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Playlist</label>
                  <select 
                    value={newSchedule.playlist_id}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, playlist_id: e.target.value }))}
                    className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm focus:border-blue-500 outline-none"
                  >
                    <option value="">Selecione uma playlist...</option>
                    {(dojoSettings.playlists || []).map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.media_ids.length} mídias)</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Dias da Semana</label>
                  <div className="grid grid-cols-7 gap-1">
                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          const days = newSchedule.days_of_week || [];
                          if (days.includes(i)) {
                            setNewSchedule({...newSchedule, days_of_week: days.filter(d => d !== i)});
                          } else {
                            setNewSchedule({...newSchedule, days_of_week: [...days, i]});
                          }
                        }}
                        className={`py-2 rounded-lg text-xs font-bold transition-all ${(newSchedule.days_of_week || []).includes(i) ? 'bg-blue-600 text-white' : 'bg-black text-zinc-500 border border-zinc-800'}`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Início</label>
                    <input 
                      type="time" 
                      value={newSchedule.start_time}
                      onChange={(e) => setNewSchedule({...newSchedule, start_time: e.target.value})}
                      className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Fim</label>
                    <input 
                      type="time" 
                      value={newSchedule.end_time}
                      onChange={(e) => setNewSchedule({...newSchedule, end_time: e.target.value})}
                      className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <button 
                  onClick={handleAddSchedule}
                  className="w-full bg-blue-600 py-4 rounded-2xl font-bold text-sm shadow-lg active:scale-95 transition-all mt-2"
                >
                  SALVAR AGENDAMENTO
                </button>
              </div>
            )}

            <div className="space-y-4">
              {schedules.map((s) => {
                const playlist = dojoSettings.playlists?.find(p => p.id === s.playlist_id);
                return (
                <div key={s.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-zinc-800 overflow-hidden flex items-center justify-center">
                      <PlayCircle className="text-zinc-600" size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                        <Calendar size={12} /> {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][s.day_of_week]}
                        <span className="text-zinc-600 ml-1">•</span>
                        <span className="text-blue-400 truncate max-w-[120px]">{playlist?.name || 'Playlist Removida'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <Clock size={12} /> {s.start_time.substring(0, 5)} - {s.end_time.substring(0, 5)}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => deleteSchedule(s.id)} className="text-zinc-600 hover:text-red-500 p-2">
                    <Trash2 size={18} />
                  </button>
                </div>
              )})}
              {schedules.length === 0 && (
                <div className="py-12 text-center border-2 border-dashed border-zinc-900 rounded-3xl">
                  <Calendar className="mx-auto text-zinc-800 mb-4" size={40} />
                  <p className="text-zinc-600 text-xs">Nenhum agendamento criado</p>
                </div>
              )}
            </div>
            </>
            )}
          </div>
        )}

            {activeSubTab === 'PLAYLISTS' && (
              <div className="space-y-6">
                {!isPro ? (
                  <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 p-8 rounded-3xl text-center space-y-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Crown size={120} />
                    </div>
                    <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Lock className="text-blue-500" size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-white">Recurso PRÓ</h3>
                    <p className="text-zinc-400 text-sm max-w-xs mx-auto">
                      As Playlists estão disponíveis a partir do Plano PRÓ.
                    </p>
                    <a href="https://www.judotech.com.br/display-planos" target="_blank" rel="noopener noreferrer" className="inline-block bg-blue-600 text-white px-8 py-3 rounded-xl font-bold mt-4 hover:bg-blue-700 transition-colors">
                      Fazer Upgrade
                    </a>
                  </div>
                ) : (
                  <>
                <div className="flex justify-between items-center">
                  <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">Playlists</h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleCommand('STOP_MEDIA')} 
                      className="p-2 rounded-full bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors"
                      title="Interromper Playlist"
                    >
                      <XCircle size={20} />
                    </button>
                    <button 
                      onClick={() => setEditingPlaylist({ id: Math.random().toString(), name: 'Nova Playlist', media_ids: [] })}
                      className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2"
                    >
                      <Plus size={16} /> CRIAR
                    </button>
                  </div>
                </div>

                {editingPlaylist ? (
                  <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold">Editar Playlist</h3>
                      <button onClick={() => setEditingPlaylist(null)} className="text-zinc-500 hover:text-white"><XCircle size={20} /></button>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Nome da Playlist</label>
                      <input 
                        type="text" 
                        value={editingPlaylist.name}
                        onChange={(e) => setEditingPlaylist({ ...editingPlaylist, name: e.target.value })}
                        className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm focus:border-blue-500 outline-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Mídias ({editingPlaylist.media_ids.length})</label>
                      <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-2">
                        {mediaList.filter(m => isPro ? true : !(m.teacher_id === '00000000-0000-0000-0000-000000000000' && m.name.includes('/'))).map(m => (
                          <div 
                            key={m.id}
                            onClick={() => {
                              setEditingPlaylist(prev => {
                                if (!prev) return prev;
                                const newIds = prev.media_ids.includes(m.id) 
                                  ? prev.media_ids.filter(id => id !== m.id)
                                  : [...prev.media_ids, m.id];
                                return { ...prev, media_ids: newIds };
                              });
                            }}
                            className={`relative aspect-video rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${editingPlaylist.media_ids.includes(m.id) ? 'border-blue-500 scale-95' : 'border-transparent hover:border-zinc-700'}`}
                          >
                            {m.type === 'image' ? (
                              <img src={m.url} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full relative bg-zinc-800">
                                <img 
                                  src={`${m.url}_thumb.jpg`} 
                                  className="w-full h-full object-cover" 
                                  onError={(e) => { 
                                    e.currentTarget.style.display = 'none'; 
                                    e.currentTarget.nextElementSibling?.classList.remove('hidden'); 
                                  }} 
                                />
                                <div className="absolute inset-0 flex items-center justify-center hidden">
                                  <Video size={20} className="text-zinc-500" />
                                </div>
                              </div>
                            )}
                            {editingPlaylist.media_ids.includes(m.id) && (
                              <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                                <div className="bg-blue-500 text-white rounded-full p-1"><Check size={16} /></div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          const newPlaylists = (dojoSettings.playlists || []).filter(p => p.id !== editingPlaylist.id);
                          updatePlaylists(newPlaylists);
                          setEditingPlaylist(null);
                        }}
                        className="flex-1 bg-red-500/20 text-red-500 py-3 rounded-xl font-bold text-sm"
                      >
                        EXCLUIR
                      </button>
                      <button 
                        onClick={() => {
                          const exists = (dojoSettings.playlists || []).find(p => p.id === editingPlaylist.id);
                          const newPlaylists = exists 
                            ? (dojoSettings.playlists || []).map(p => p.id === editingPlaylist.id ? editingPlaylist : p)
                            : [...(dojoSettings.playlists || []), editingPlaylist];
                          updatePlaylists(newPlaylists);
                          setEditingPlaylist(null);
                        }}
                        className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-sm"
                      >
                        SALVAR
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(!dojoSettings.playlists || dojoSettings.playlists.length === 0) ? (
                      <div className="text-center py-12 bg-zinc-900/50 rounded-3xl border border-zinc-800 border-dashed">
                        <p className="text-zinc-500 text-sm">Nenhuma playlist criada.</p>
                      </div>
                    ) : (
                      dojoSettings.playlists.map(playlist => (
                        <div key={playlist.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between">
                          <div>
                            <h4 className="font-bold">{playlist.name}</h4>
                            <p className="text-xs text-zinc-500">{playlist.media_ids.length} mídias</p>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleCommand('SHOW_PLAYLIST', playlist)}
                              className="p-2 bg-white text-black rounded-full hover:bg-zinc-200"
                            >
                              <PlayCircle size={20} />
                            </button>
                            <button 
                              onClick={() => setEditingPlaylist(playlist)}
                              className="p-2 bg-zinc-800 text-zinc-400 rounded-full hover:text-white"
                            >
                              <Settings size={20} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
                </>
                )}
              </div>
            )}

            {activeSubTab === 'TICKER' && (
              <div className="space-y-6">
                {!isPro ? (
                  <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 p-8 rounded-3xl text-center space-y-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Crown size={120} />
                    </div>
                    <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Lock className="text-blue-500" size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-white">Recurso Premium</h3>
                    <p className="text-zinc-400 text-sm max-w-xs mx-auto">
                      O Letreiro Digital (Avisos) está disponível apenas no Plano PRO.
                    </p>
                    <a href="https://www.judotech.com.br/display-planos" target="_blank" rel="noopener noreferrer" className="inline-block bg-blue-600 text-white px-8 py-3 rounded-xl font-bold mt-4 hover:bg-blue-700 transition-colors">
                      Fazer Upgrade
                    </a>
                  </div>
                ) : (
                  <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">Letreiro Digital (Avisos)</h3>
                      <button 
                        onClick={() => updateTickerConfig('active', !tickerConfig.active)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${tickerConfig.active ? 'bg-blue-600' : 'bg-zinc-700'}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${tickerConfig.active ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                    <input 
                      type="text" 
                      placeholder="Digite o aviso que ficará passando no rodapé da TV..." 
                      className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm focus:border-blue-500 outline-none transition-colors"
                      value={tickerConfig.text}
                      onChange={(e) => updateTickerConfig('text', e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            {activeSubTab === 'DOJO' && (
          <div className="space-y-8">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-6">
              <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] text-center">Configuração do Dojo</h3>
              
              <form onSubmit={saveDojoConfig} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Nome do Dojo *</label>
                  <input 
                    type="text" 
                    value={dojoForm.name}
                    onChange={(e) => setDojoForm({...dojoForm, name: e.target.value})}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                    placeholder="Ex: Dojo Central"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Cidade *</label>
                    <input 
                      type="text" 
                      value={dojoForm.city}
                      onChange={(e) => setDojoForm({...dojoForm, city: e.target.value})}
                      className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                      placeholder="Ex: São Paulo"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Estado (UF) *</label>
                    <input 
                      type="text" 
                      value={dojoForm.state}
                      onChange={(e) => setDojoForm({...dojoForm, state: e.target.value})}
                      className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                      placeholder="Ex: SP"
                      maxLength={2}
                      required
                    />
                  </div>
                </div>
                
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors">
                  Salvar Configurações do Dojo
                </button>
              </form>

              <div className="space-y-2 pt-6 border-t border-zinc-800">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Tempo da Logo Inicial (segundos)</label>
                <p className="text-xs text-zinc-600">Tempo que a logo do Dojo aparece ao abrir a TV.</p>
                <input 
                  type="number" 
                  min="1"
                  max="60"
                  defaultValue={(dojoSettings.timer_config || {}).splashDuration || 4}
                  onBlur={(e) => handleConfigChange({ splashDuration: parseInt(e.target.value) })}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Logomarca</label>
                {!isStarter ? (
                  <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 p-6 rounded-3xl text-center space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Crown size={80} />
                    </div>
                    <div className="w-12 h-12 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Lock className="text-blue-500" size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-white">Recurso STARTER</h3>
                    <p className="text-zinc-400 text-xs max-w-xs mx-auto">
                      A customização da logomarca está disponível a partir do Plano STARTER.
                    </p>
                    <a href="https://www.judotech.com.br/display-planos" target="_blank" rel="noopener noreferrer" className="inline-block bg-blue-600 text-white px-6 py-2 rounded-xl font-bold mt-2 hover:bg-blue-700 transition-colors text-sm">
                      Fazer Upgrade
                    </a>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-32 h-32 rounded-3xl bg-black border-2 border-dashed border-zinc-800 flex items-center justify-center overflow-hidden">
                      {dojoSettings.logo_url ? (
                        <img src={dojoSettings.logo_url} className="w-full h-full object-contain" />
                      ) : (
                        <ImageIcon className="text-zinc-800" size={40} />
                      )}
                    </div>
                    <button 
                      onClick={() => logoInputRef.current?.click()}
                      disabled={isUploading}
                      className="bg-zinc-800 px-6 py-2 rounded-full text-xs font-bold hover:bg-zinc-700 transition-colors"
                    >
                      {isUploading ? 'Enviando...' : 'Trocar Logo'}
                    </button>
                    <input 
                      type="file" 
                      ref={logoInputRef} 
                      onChange={(e) => handleFileUpload(e, 'LOGO')} 
                      className="hidden" 
                      accept="image/*" 
                    />
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-6 border-t border-zinc-800">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Patrocinadores (Treino e Placar)</label>
                {!isStarter ? (
                  <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 p-6 rounded-3xl text-center space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Crown size={80} />
                    </div>
                    <div className="w-12 h-12 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Lock className="text-blue-500" size={24} />
                    </div>
                    <h3 className="font-bold text-white">Recurso STARTER</h3>
                    <p className="text-zinc-400 text-xs max-w-[200px] mx-auto">
                      Ative espaços de patrocinadores a partir do Plano STARTER.
                    </p>
                    <a href="https://www.judotech.com.br/display-planos" target="_blank" rel="noopener noreferrer" className="inline-block bg-blue-600 text-white px-6 py-2 rounded-xl text-xs font-bold mt-2 hover:bg-blue-700 transition-colors">
                      Fazer Upgrade
                    </a>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between bg-black p-4 rounded-xl border border-zinc-800">
                      <span className="text-sm font-bold">Ativar no Treino</span>
                      <button 
                        onClick={() => updateSponsorsConfig('timer_active', !sponsorsConfig.timer_active)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${sponsorsConfig.timer_active ? 'bg-blue-600' : 'bg-zinc-700'}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${sponsorsConfig.timer_active ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between bg-black p-4 rounded-xl border border-zinc-800">
                      <span className="text-sm font-bold">Ativar no Placar</span>
                      <button 
                        onClick={() => updateSponsorsConfig('scoreboard_active', !sponsorsConfig.scoreboard_active)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${sponsorsConfig.scoreboard_active ? 'bg-blue-600' : 'bg-zinc-700'}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${sponsorsConfig.scoreboard_active ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Playlist de Patrocinadores (Treino)</label>
                      <select
                        value={sponsorsConfig.timer_playlist_id}
                        onChange={(e) => updateSponsorsConfig('timer_playlist_id', e.target.value)}
                        className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                      >
                        <option value="">Selecione uma playlist...</option>
                        {(dojoSettings.playlists || []).map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Playlist de Patrocinadores (Placar)</label>
                      <select
                        value={sponsorsConfig.scoreboard_playlist_id}
                        onChange={(e) => updateSponsorsConfig('scoreboard_playlist_id', e.target.value)}
                        className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                      >
                        <option value="">Selecione uma playlist...</option>
                        {(dojoSettings.playlists || []).map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Tempo de Transição (segundos)</label>
                      <input 
                        type="number" 
                        min="5"
                        max="300"
                        value={sponsorsConfig.interval}
                        onChange={(e) => updateSponsorsConfig('interval', parseInt(e.target.value))}
                        className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-6">
              <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] text-center">Áudio da TV</h3>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${!isMuted ? 'bg-blue-500/20 text-blue-500' : 'bg-zinc-800 text-zinc-500'}`}>
                      {isMuted ? <VolumeX size={20} /> : volume > 50 ? <Volume2 size={20} /> : <Volume1 size={20} />}
                    </div>
                    <div>
                      <p className="text-sm font-bold">{isMuted ? 'Mudo' : 'Áudio Ativo'}</p>
                      <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">{volume}% Volume</p>
                    </div>
                  </div>
                  <button 
                    onClick={toggleMute}
                    className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${!isMuted ? 'bg-zinc-800 text-zinc-400' : 'bg-blue-600 text-white'}`}
                  >
                    {isMuted ? 'Ativar' : 'Mudar'}
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase">
                    <span>Volume</span>
                    <span>{volume}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={volume}
                    onChange={(e) => updateVolume(parseInt(e.target.value))}
                    className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              </div>
            </div>
          </div>
            )}
          </div>
  );
}
