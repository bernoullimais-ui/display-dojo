import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, BarChart3, Users, Tv, Clock, Filter, MapPin } from 'lucide-react';

export default function AdminReports() {
  const [loading, setLoading] = useState(true);
  const [dojos, setDojos] = useState<any[]>([]);
  const [mediaLogs, setMediaLogs] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [error, setError] = useState('');
  
  const [filterState, setFilterState] = useState('');
  const [filterCity, setFilterCity] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    if (!supabase) return;

    try {
      // Fetch dojos
      const { data: dojosData, error: dojosError } = await supabase
        .from('dojo_settings')
        .select('*')
        .neq('teacher_id', '00000000-0000-0000-0000-000000000000');
      
      if (dojosError) throw dojosError;

      // Fetch media logs
      const { data: logsData, error: logsError } = await supabase
        .from('media_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(2000);
      
      if (logsError && !logsError.message.includes('does not exist')) {
        console.error('Error fetching media logs:', logsError);
      }

      // Fetch sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('*');
        
      if (sessionsError) throw sessionsError;

      setDojos(dojosData || []);
      setMediaLogs(logsData || []);
      setSessions(sessionsData || []);
    } catch (err: any) {
      console.error('Error fetching reports:', err);
      setError(err.message || 'Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  };

  // Extract unique states and cities for filters
  const states = useMemo(() => {
    const s = new Set(dojos.map(d => d.state).filter(Boolean));
    return Array.from(s).sort();
  }, [dojos]);

  const cities = useMemo(() => {
    let filtered = dojos;
    if (filterState) {
      filtered = filtered.filter(d => d.state === filterState);
    }
    const c = new Set(filtered.map(d => d.city).filter(Boolean));
    return Array.from(c).sort();
  }, [dojos, filterState]);

  // Apply filters
  const filteredDojos = useMemo(() => {
    return dojos.filter(d => {
      if (filterState && d.state !== filterState) return false;
      if (filterCity && d.city !== filterCity) return false;
      return true;
    });
  }, [dojos, filterState, filterCity]);

  const filteredTeacherIds = useMemo(() => new Set(filteredDojos.map(d => d.teacher_id)), [filteredDojos]);

  // Stats calculations
  const usersByPlan = useMemo(() => {
    const counts: Record<string, number> = { FREE: 0, STARTER: 0, PRO: 0, BUSINESS: 0 };
    filteredDojos.forEach(d => {
      const tier = (d.subscription_tier || 'FREE').toUpperCase();
      counts[tier] = (counts[tier] || 0) + 1;
    });
    return counts;
  }, [filteredDojos]);

  const activeSessions = useMemo(() => {
    // Consider active if updated in the last 5 minutes
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    return sessions.filter(s => 
      filteredTeacherIds.has(s.teacher_id) && 
      s.updated_at > fiveMinsAgo &&
      s.status === 'active'
    );
  }, [sessions, filteredTeacherIds]);

  const mediaExhibitions = useMemo(() => {
    const filteredLogs = mediaLogs.filter(l => filteredTeacherIds.has(l.teacher_id));
    const counts: Record<string, number> = {};
    filteredLogs.forEach(l => {
      const name = l.sponsor_name || 'Desconhecido';
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [mediaLogs, filteredTeacherIds]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-6 rounded-xl">
        <p className="font-bold">Erro ao carregar relatórios:</p>
        <p className="text-sm mt-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Filters */}
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-4">
        <div className="flex items-center gap-2 text-zinc-400 font-bold mb-4">
          <Filter size={20} />
          <h2>Filtros</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-zinc-500 uppercase font-bold mb-2">Estado</label>
            <select 
              value={filterState} 
              onChange={(e) => { setFilterState(e.target.value); setFilterCity(''); }}
              className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-blue-500"
            >
              <option value="">Todos os Estados</option>
              {states.map(s => <option key={s as string} value={s as string}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 uppercase font-bold mb-2">Cidade</label>
            <select 
              value={filterCity} 
              onChange={(e) => setFilterCity(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-blue-500"
              disabled={!filterState}
            >
              <option value="">Todas as Cidades</option>
              {cities.map(c => <option key={c as string} value={c as string}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-500/20 p-2 rounded-lg">
              <Users className="text-blue-500" size={20} />
            </div>
            <h3 className="text-zinc-400 font-bold">Total de Dojos</h3>
          </div>
          <p className="text-4xl font-black">{filteredDojos.length}</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-green-500/20 p-2 rounded-lg">
              <Tv className="text-green-500" size={20} />
            </div>
            <h3 className="text-zinc-400 font-bold">TVs Conectadas (Agora)</h3>
          </div>
          <p className="text-4xl font-black">{activeSessions.length}</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-purple-500/20 p-2 rounded-lg">
              <BarChart3 className="text-purple-500" size={20} />
            </div>
            <h3 className="text-zinc-400 font-bold">Exibições de Mídia</h3>
          </div>
          <p className="text-4xl font-black">{mediaLogs.filter(l => filteredTeacherIds.has(l.teacher_id)).length}</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-yellow-500/20 p-2 rounded-lg">
              <Clock className="text-yellow-500" size={20} />
            </div>
            <h3 className="text-zinc-400 font-bold">Sessões Totais</h3>
          </div>
          <p className="text-4xl font-black">{sessions.filter(s => filteredTeacherIds.has(s.teacher_id)).length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Users by Plan */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
          <h3 className="text-xl font-black mb-6 flex items-center gap-2">
            <Users size={24} className="text-zinc-400" />
            Usuários por Plano
          </h3>
          <div className="space-y-4">
            {Object.entries(usersByPlan).map(([plan, count]) => {
              const percentage = filteredDojos.length > 0 ? Math.round(((count as number) / filteredDojos.length) * 100) : 0;
              return (
                <div key={plan} className="space-y-2">
                  <div className="flex justify-between text-sm font-bold">
                    <span className={
                      plan === 'BUSINESS' ? 'text-purple-400' :
                      plan === 'PRO' ? 'text-yellow-400' :
                      plan === 'STARTER' ? 'text-blue-400' :
                      'text-zinc-400'
                    }>{plan}</span>
                    <span>{count} ({percentage}%)</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        plan === 'BUSINESS' ? 'bg-purple-500' :
                        plan === 'PRO' ? 'bg-yellow-500' :
                        plan === 'STARTER' ? 'bg-blue-500' :
                        'bg-zinc-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Media Exhibitions */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
          <h3 className="text-xl font-black mb-6 flex items-center gap-2">
            <BarChart3 size={24} className="text-zinc-400" />
            Top Mídias Exibidas
          </h3>
          {mediaExhibitions.length > 0 ? (
            <div className="space-y-4">
              {mediaExhibitions.map(([name, count], index) => (
                <div key={name} className="flex items-center justify-between p-3 bg-black/50 rounded-xl border border-zinc-800/50">
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500 font-bold w-4">{index + 1}.</span>
                    <span className="font-bold truncate max-w-[200px]">{name}</span>
                  </div>
                  <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-xs font-bold">
                    {count} exibições
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-zinc-500 py-8">
              Nenhuma exibição registrada para os filtros atuais.
            </div>
          )}
        </div>
      </div>
      
      {/* Active Sessions List */}
      {activeSessions.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
          <h3 className="text-xl font-black mb-6 flex items-center gap-2">
            <Tv size={24} className="text-zinc-400" />
            TVs Conectadas Agora
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-zinc-950/50 text-zinc-400 text-xs uppercase tracking-widest">
                <tr>
                  <th className="p-4 font-bold">Dojo</th>
                  <th className="p-4 font-bold">TV Name</th>
                  <th className="p-4 font-bold">Última Atividade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {activeSessions.map(session => {
                  const dojo = filteredDojos.find(d => d.teacher_id === session.teacher_id);
                  return (
                    <tr key={session.id} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="p-4 font-bold">{dojo?.name || 'Desconhecido'}</td>
                      <td className="p-4 text-zinc-400">{session.tv_name || session.id.substring(0, 8)}</td>
                      <td className="p-4 text-zinc-500 text-sm">
                        {new Date(session.updated_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dojos List with Location */}
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
        <h3 className="text-xl font-black mb-6 flex items-center gap-2">
          <MapPin size={24} className="text-zinc-400" />
          Dojos Filtrados
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-950/50 text-zinc-400 text-xs uppercase tracking-widest">
              <tr>
                <th className="p-4 font-bold">Dojo Name</th>
                <th className="p-4 font-bold">Localização</th>
                <th className="p-4 font-bold">Plano</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filteredDojos.map(dojo => (
                <tr key={dojo.teacher_id} className="hover:bg-zinc-800/20 transition-colors">
                  <td className="p-4 font-bold">{dojo.name || 'Sem Nome'}</td>
                  <td className="p-4 text-zinc-400">
                    {dojo.city && dojo.state ? `${dojo.city}, ${dojo.state}` : 'Não informada'}
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wider ${
                      dojo.subscription_tier === 'BUSINESS' ? 'bg-purple-500/20 text-purple-400' :
                      dojo.subscription_tier === 'PRO' ? 'bg-yellow-500/20 text-yellow-400' :
                      dojo.subscription_tier === 'STARTER' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-zinc-800 text-zinc-400'
                    }`}>
                      {dojo.subscription_tier || 'FREE'}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredDojos.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-zinc-500">
                    Nenhum dojo encontrado com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
