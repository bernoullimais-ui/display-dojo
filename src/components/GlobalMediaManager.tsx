import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Plus, Upload, Trash2, Video, Youtube, PlayCircle, Image as ImageIcon } from 'lucide-react';

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
  const [isUploading, setIsUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [mediaSponsorInput, setMediaSponsorInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

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
      .eq('teacher_id', 'GLOBAL');
      
    if (mediaData) setMediaList(mediaData);

    // Fetch global settings
    const { data: settingsData } = await supabase
      .from('dojo_settings')
      .select('*')
      .eq('teacher_id', 'GLOBAL')
      .single();

    if (settingsData) {
      setDojoName(settingsData.name || '');
      setDojoLogo(settingsData.logo_url || '');
    }

    setLoading(false);
  };

  const saveGlobalSettings = async () => {
    if (!supabase) return;
    await supabase
      .from('dojo_settings')
      .upsert({
        teacher_id: 'GLOBAL',
        name: dojoName,
        logo_url: dojoLogo,
        updated_at: new Date().toISOString()
      });
    alert('Configurações globais salvas com sucesso!');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isLogo: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file || !supabase) return;

    setIsUploading(true);
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

      if (isLogo) {
        setDojoLogo(publicUrl);
        await supabase
          .from('dojo_settings')
          .upsert({
            teacher_id: 'GLOBAL',
            logo_url: publicUrl,
            updated_at: new Date().toISOString()
          });
      } else {
        const type = file.type.startsWith('video') ? 'video' : 'image';
        const { data: mediaData, error: dbError } = await supabase
          .from('media')
          .insert([{
            teacher_id: 'GLOBAL',
            name: file.name,
            url: publicUrl,
            type: type,
            sponsor_name: mediaSponsorInput || null
          }])
          .select()
          .single();

        if (dbError) throw dbError;
        if (mediaData) setMediaList([...mediaList, mediaData]);
        setMediaSponsorInput('');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Erro ao fazer upload.');
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleAddMediaUrl = async () => {
    if (!mediaUrlInput || !supabase) return;
    
    const isYouTube = mediaUrlInput.includes('youtube.com') || mediaUrlInput.includes('youtu.be');
    const isVideo = isYouTube || mediaUrlInput.match(/\.(mp4|webm|ogg|mov)$|vimeo\.com/i);
    const type = isVideo ? 'video' : 'image';
    
    let name = 'Mídia Web';
    if (isYouTube) name = 'YouTube Video';

    try {
      const { data: mediaData, error: dbError } = await supabase
        .from('media')
        .insert([{
          teacher_id: 'GLOBAL',
          name: name,
          url: mediaUrlInput,
          type: type,
          sponsor_name: mediaSponsorInput || null
        }])
        .select()
        .single();

      if (dbError) throw dbError;
      if (mediaData) setMediaList([...mediaList, mediaData]);
      
      setMediaUrlInput('');
      setMediaSponsorInput('');
      setShowUrlInput(false);
    } catch (error) {
      console.error('Failed to add URL:', error);
      alert('Erro ao adicionar URL.');
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
      setMediaList(mediaList.filter(m => m.id !== id));
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
                  onChange={(e) => handleFileUpload(e, true)} 
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
            <input type="file" ref={fileInputRef} onChange={(e) => handleFileUpload(e, false)} className="hidden" accept="image/*,video/*" />
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

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {mediaList.map((item) => {
            const isYouTube = item.url.includes('youtube.com') || item.url.includes('youtu.be');
            return (
              <div key={item.id} className="group relative bg-black rounded-2xl overflow-hidden border border-zinc-800 aspect-square">
                {item.type === 'image' ? (
                  <img src={item.url} className="w-full h-full object-cover opacity-70 group-hover:opacity-50 transition-opacity" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-900 opacity-70 group-hover:opacity-50 transition-opacity">
                    {isYouTube ? <Youtube className="text-red-600" size={40} /> : <Video className="text-zinc-600" size={40} />}
                  </div>
                )}
                <button 
                  onClick={() => deleteMedia(item.id, item.url)} 
                  className="absolute top-2 right-2 bg-black/80 text-red-500 p-2 rounded-full backdrop-blur-sm active:scale-95 transition-transform z-10 opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={16} />
                </button>
                {item.sponsor_name && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-2 text-center">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Patrocínio</p>
                    <p className="text-xs font-bold text-white truncate">{item.sponsor_name}</p>
                  </div>
                )}
              </div>
            );
          })}
          {mediaList.length === 0 && (
            <div className="col-span-full py-12 text-center text-zinc-500">
              <ImageIcon className="mx-auto mb-4 opacity-20" size={48} />
              <p>Nenhuma mídia global cadastrada.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
