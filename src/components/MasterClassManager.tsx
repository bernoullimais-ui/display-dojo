import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MasterClass, MasterClassMarker } from '../types';
import { Plus, Trash2, Video, Save, Loader2, Music, Timer, Lock, Play } from 'lucide-react';

export default function MasterClassManager() {
  const [masterClasses, setMasterClasses] = useState<MasterClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mcForm, setMcForm] = useState<Partial<MasterClass>>({
    title: '',
    description: '',
    instructor_name: '',
    instructor_image_url: '',
    video_url: '',
    preview_url: '',
    duration: '',
    price: 0
  });
  const [markers, setMarkers] = useState<Partial<MasterClassMarker>[]>([]);

  useEffect(() => {
    fetchMasterClasses();
  }, []);

  const fetchMasterClasses = async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('masterclasses')
      .select('*, markers:masterclass_markers(*)');
    if (data) setMasterClasses(data);
    setLoading(false);
  };

  const handleEdit = (mc: MasterClass) => {
    setEditingId(mc.id);
    setMcForm(mc);
    setMarkers(mc.markers || []);
  };

  const handleSave = async () => {
    if (!supabase) return;
    setLoading(true);

    try {
      let mcId = editingId;
      const mcData = {
        title: mcForm.title,
        description: mcForm.description,
        instructor_name: mcForm.instructor_name,
        instructor_image_url: mcForm.instructor_image_url,
        video_url: mcForm.video_url,
        preview_url: mcForm.preview_url,
        duration: mcForm.duration,
        price: mcForm.price
      };

      if (editingId && editingId !== 'new') {
        const { error } = await supabase.from('masterclasses').update(mcData).eq('id', editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('masterclasses').insert(mcData).select().single();
        if (error) throw error;
        mcId = data?.id;
      }

      if (mcId) {
        // Delete all old markers
        const { error: delError } = await supabase.from('masterclass_markers').delete().eq('masterclass_id', mcId);
        if (delError) throw delError;

        // Insert new markers
        if (markers.length > 0) {
          const { error: insError } = await supabase.from('masterclass_markers').insert(
            markers.map((m, i) => ({
              masterclass_id: mcId,
              timestamp: m.timestamp,
              action: m.action,
              timer_config: m.timer_config,
              message: m.message,
              order_index: i
            }))
          );
          if (insError) throw insError;
        }
      }

      setEditingId(null);
      setMcForm({ title: '', description: '', instructor_name: '', instructor_image_url: '', video_url: '', preview_url: '', duration: '', price: 0 });
      setMarkers([]);
      fetchMasterClasses();
    } catch (error: any) {
      console.error('Error saving masterclass:', error);
      alert('Erro ao salvar MasterClass: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const addMarker = () => {
    setMarkers([...markers, { timestamp: 0, action: 'START_TIMER', timer_config: { prepTime: 10, workTime: 60, restTime: 10, cycles: 5, workLabel: 'TREINO HÍBRIDO' } }]);
  };

  const removeMarker = (index: number) => {
    const newMarkers = [...markers];
    newMarkers.splice(index, 1);
    setMarkers(newMarkers);
  };

  if (loading && masterClasses.length === 0) {
    return <div className="p-12 text-center text-zinc-500"><Loader2 className="animate-spin mx-auto mb-4" /> Carregando...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-white">GESTÃO DE MASTERCLASS</h2>
        {!editingId && (
          <button 
            onClick={() => {
              setEditingId('new');
              setMcForm({ title: '', description: '', instructor_name: '', instructor_image_url: '', video_url: '', price: 0 });
              setMarkers([]);
            }}
            className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} /> Nova MasterClass
          </button>
        )}
      </div>

      {editingId ? (
        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl space-y-8 h-[70vh] overflow-y-auto no-scrollbar">
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-2">Título da Aula</label>
              <input 
                type="text" 
                value={mcForm.title}
                onChange={(e) => setMcForm({ ...mcForm, title: e.target.value })}
                className="w-full bg-black border border-zinc-800 rounded-xl p-4 focus:border-blue-500 outline-none transition-colors"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-2">Descrição</label>
              <textarea 
                value={mcForm.description}
                onChange={(e) => setMcForm({ ...mcForm, description: e.target.value })}
                className="w-full bg-black border border-zinc-800 rounded-xl p-4 h-32 focus:border-blue-500 outline-none transition-colors resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-2">Nome do Instrutor</label>
              <input 
                type="text" 
                value={mcForm.instructor_name}
                onChange={(e) => setMcForm({ ...mcForm, instructor_name: e.target.value })}
                className="w-full bg-black border border-zinc-800 rounded-xl p-4 focus:border-blue-500 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-2">URL da Imagem do Instrutor</label>
              <input 
                type="text" 
                value={mcForm.instructor_image_url}
                onChange={(e) => setMcForm({ ...mcForm, instructor_image_url: e.target.value })}
                className="w-full bg-black border border-zinc-800 rounded-xl p-4 focus:border-blue-500 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-2">URL do Vídeo (YouTube)</label>
              <input 
                type="text" 
                value={mcForm.video_url}
                onChange={(e) => setMcForm({ ...mcForm, video_url: e.target.value })}
                className="w-full bg-black border border-zinc-800 rounded-xl p-4 focus:border-blue-500 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-2">Preço (R$)</label>
              <input 
                type="number" 
                value={mcForm.price}
                onChange={(e) => setMcForm({ ...mcForm, price: Number(e.target.value) })}
                className="w-full bg-black border border-zinc-800 rounded-xl p-4 focus:border-blue-500 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-2">Duração (Ex: 45 min)</label>
              <input 
                type="text" 
                value={mcForm.duration}
                onChange={(e) => setMcForm({ ...mcForm, duration: e.target.value })}
                className="w-full bg-black border border-zinc-800 rounded-xl p-4 focus:border-blue-500 outline-none transition-colors"
                placeholder="Ex: 1h 20min"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-2">URL do Clip de Degustação (YouTube Preview)</label>
              <input 
                type="text" 
                value={mcForm.preview_url}
                onChange={(e) => setMcForm({ ...mcForm, preview_url: e.target.value })}
                className="w-full bg-black border border-zinc-800 rounded-xl p-4 focus:border-blue-500 outline-none transition-colors"
                placeholder="Pode ser um clipe curto para convencer o Sensei a adquirir"
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-white">MARCADORES DE INTERATIVIDADE</h3>
              <button 
                onClick={addMarker}
                className="text-xs bg-zinc-800 px-4 py-2 rounded-lg font-bold hover:bg-zinc-700 transition-colors"
              >
                + Adicionar Marcador
              </button>
            </div>

            <div className="space-y-4">
              {markers.map((marker, index) => (
                <div key={index} className="bg-black/50 border border-zinc-800 p-6 rounded-2xl space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 bg-blue-600/20 text-blue-500 rounded-full flex items-center justify-center font-black text-sm">
                        {index + 1}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Tempo (segundos):</label>
                        <input 
                          type="number" 
                          value={marker.timestamp}
                          onChange={(e) => {
                            const newMarkers = [...markers];
                            newMarkers[index].timestamp = Number(e.target.value);
                            setMarkers(newMarkers);
                          }}
                          className="w-24 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1 text-sm outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Ação:</label>
                        <select 
                          value={marker.action}
                          onChange={(e) => {
                            const newMarkers = [...markers];
                            newMarkers[index].action = e.target.value as any;
                            setMarkers(newMarkers);
                          }}
                          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1 text-sm outline-none focus:border-blue-500"
                        >
                          <option value="START_TIMER">Acionar Cronômetro</option>
                          <option value="WAIT_RELEASE">Esperar Liberação Sensei</option>
                        </select>
                      </div>
                    </div>
                    <button onClick={() => removeMarker(index)} className="text-red-500 hover:text-red-400 p-2">
                      <Trash2 size={20} />
                    </button>
                  </div>

                  <div className="pt-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Mensagem do Mestre (ex: "Sensei, confira o kumi kata")</label>
                    <input 
                      type="text" 
                      value={marker.message || ''} 
                      onChange={(e) => {
                        const newMarkers = [...markers];
                        newMarkers[index].message = e.target.value;
                        setMarkers(newMarkers);
                      }} 
                      placeholder="Deixe uma instrução para o Sensei local..."
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" 
                    />
                  </div>

                  {marker.action === 'START_TIMER' && (
                    <div className="space-y-4 pt-4 border-t border-zinc-800/50">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Modo do Cronômetro</label>
                        <select 
                          value={marker.timer_config?.mode || 'HIT'} 
                          onChange={(e) => {
                            const newMarkers = [...markers];
                            newMarkers[index].timer_config = { 
                              ...newMarkers[index].timer_config, 
                              mode: e.target.value as any,
                              // Reset specific fields when mode changes to avoid confusion
                              prepTime: newMarkers[index].timer_config?.prepTime || 10,
                              workTime: newMarkers[index].timer_config?.workTime || 60,
                              restTime: newMarkers[index].timer_config?.restTime || 10,
                              cycles: newMarkers[index].timer_config?.cycles || 5,
                              targetTime: newMarkers[index].timer_config?.targetTime || 300
                            };
                            setMarkers(newMarkers);
                          }}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                        >
                          <option value="HIT">HIIT / Tabata</option>
                          <option value="ROUNDS">Sets / Rounds</option>
                          <option value="PROGRESSIVE">Progressivo (Cronômetro)</option>
                          <option value="REGRESSIVE">Regressivo (Contagem Regressiva)</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-4 gap-4">
                        {(marker.timer_config?.mode === 'HIT' || marker.timer_config?.mode === 'ROUNDS' || !marker.timer_config?.mode) && (
                          <>
                            <div>
                              <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Prep (s)</label>
                              <input type="number" value={marker.timer_config?.prepTime || 10} onChange={(e) => {
                                const newMarkers = [...markers];
                                newMarkers[index].timer_config = { ...newMarkers[index].timer_config, prepTime: Number(e.target.value) };
                                setMarkers(newMarkers);
                              }} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm" />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Trab (s)</label>
                              <input type="number" value={marker.timer_config?.workTime || 60} onChange={(e) => {
                                const newMarkers = [...markers];
                                newMarkers[index].timer_config = { ...newMarkers[index].timer_config, workTime: Number(e.target.value) };
                                setMarkers(newMarkers);
                              }} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm" />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Desc (s)</label>
                              <input type="number" value={marker.timer_config?.restTime || 10} onChange={(e) => {
                                const newMarkers = [...markers];
                                newMarkers[index].timer_config = { ...newMarkers[index].timer_config, restTime: Number(e.target.value) };
                                setMarkers(newMarkers);
                              }} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm" />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Ciclos</label>
                              <input type="number" value={marker.timer_config?.cycles || 5} onChange={(e) => {
                                const newMarkers = [...markers];
                                newMarkers[index].timer_config = { ...newMarkers[index].timer_config, cycles: Number(e.target.value) };
                                setMarkers(newMarkers);
                              }} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm" />
                            </div>
                          </>
                        )}

                        {(marker.timer_config?.mode === 'PROGRESSIVE' || marker.timer_config?.mode === 'REGRESSIVE') && (
                          <>
                            <div className="col-span-2">
                              <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Tempo Alvo (segundos)</label>
                              <input type="number" value={marker.timer_config?.targetTime || 300} onChange={(e) => {
                                const newMarkers = [...markers];
                                newMarkers[index].timer_config = { ...newMarkers[index].timer_config, targetTime: Number(e.target.value) };
                                setMarkers(newMarkers);
                              }} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm" />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Prep (s)</label>
                              <input type="number" value={marker.timer_config?.prepTime || 10} onChange={(e) => {
                                const newMarkers = [...markers];
                                newMarkers[index].timer_config = { ...newMarkers[index].timer_config, prepTime: Number(e.target.value) };
                                setMarkers(newMarkers);
                              }} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm" />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {markers.length === 0 && (
                <div className="text-center py-8 border border-dashed border-zinc-800 rounded-2xl text-zinc-600 text-sm">
                  Nenhum marcador de interatividade adicionado. O vídeo será reproduzido linearmente.
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-4 pt-8">
            <button 
              onClick={() => { setEditingId(null); setMarkers([]); }}
              className="flex-1 bg-zinc-800 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-zinc-700 transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave}
              className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-900/20 transition-all flex items-center justify-center gap-3"
            >
              <Save size={24} /> Salvar MasterClass
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {masterClasses.map(mc => (
            <div key={mc.id} className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden flex flex-col">
              <div className="aspect-video relative">
                <img 
                  src={mc.instructor_image_url || `https://picsum.photos/seed/${mc.id}/400/225`} 
                  className="w-full h-full object-cover"
                  alt={mc.title}
                />
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
                  <Timer size={14} className="text-blue-400" />
                  <span className="text-[10px] font-black text-white">{mc.markers?.length || 0} Marcadores</span>
                </div>
              </div>
              <div className="p-6 flex-1 space-y-4">
                <div>
                  <h4 className="text-xl font-black text-white leading-tight">{mc.title}</h4>
                  <p className="text-zinc-500 text-sm font-medium">{mc.instructor_name}</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => handleEdit(mc)} className="flex-1 bg-zinc-800 text-white py-3 rounded-xl font-bold text-sm hover:bg-zinc-700 transition-colors">Editar</button>
                  <button 
                    onClick={async () => {
                      if (confirm('Deseja excluir esta MasterClass?')) {
                        await supabase.from('masterclasses').delete().eq('id', mc.id);
                        fetchMasterClasses();
                      }
                    }}
                    className="p-3 bg-red-600/10 text-red-500 rounded-xl hover:bg-red-600/20 transition-colors"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {masterClasses.length === 0 && (
            <div className="col-span-2 text-center py-24 bg-zinc-950 rounded-[3rem] border border-zinc-900">
              <Video size={64} className="mx-auto text-zinc-800 mb-4" />
              <p className="text-zinc-500 font-bold">Nenhuma MasterClass cadastrada.</p>
              <p className="text-zinc-600 text-xs mt-2 text-center max-w-xs mx-auto">Comece adicionando novos conteúdos especiais para os dojos.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
