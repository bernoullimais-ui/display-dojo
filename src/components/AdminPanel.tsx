import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Search, Edit2, Check, X, Loader2 } from 'lucide-react';

export default function AdminPanel() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTier, setEditTier] = useState<string>('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    if (!supabase) return;
    
    // Fetch all dojo_settings
    const { data, error } = await supabase
      .from('dojo_settings')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      setError('Erro ao buscar usuários. Verifique as permissões (RLS).');
      console.error(error);
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  const handleSaveTier = async (teacherId: string) => {
    if (!supabase) return;
    
    const { error } = await supabase
      .from('dojo_settings')
      .update({ subscription_tier: editTier })
      .eq('teacher_id', teacherId);
      
    if (error) {
      alert('Erro ao atualizar plano: ' + error.message);
    } else {
      setUsers(users.map(u => u.teacher_id === teacherId ? { ...u, subscription_tier: editTier } : u));
      setEditingId(null);
    }
  };

  const filteredUsers = users.filter(u => 
    (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.teacher_id || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center gap-4 border-b border-zinc-800 pb-6">
          <div className="bg-red-500/20 p-4 rounded-2xl">
            <Shield className="text-red-500" size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter">Painel Master Admin</h1>
            <p className="text-zinc-400">Gerenciamento de Assinaturas e Dojos</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl">
            {error}
          </div>
        )}

        <div className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
          <Search className="text-zinc-500" />
          <input 
            type="text"
            placeholder="Buscar por nome do Dojo ou ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none flex-1 text-white"
          />
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="animate-spin text-blue-500" size={40} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-zinc-950/50 text-zinc-400 text-xs uppercase tracking-widest">
                  <tr>
                    <th className="p-4 font-bold">Dojo Name</th>
                    <th className="p-4 font-bold">Teacher ID</th>
                    <th className="p-4 font-bold">Plano Atual</th>
                    <th className="p-4 font-bold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {filteredUsers.map(user => (
                    <tr key={user.teacher_id} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="p-4 font-bold">{user.name || 'Sem Nome'}</td>
                      <td className="p-4 text-zinc-500 font-mono text-xs">{user.teacher_id}</td>
                      <td className="p-4">
                        {editingId === user.teacher_id ? (
                          <select 
                            value={editTier}
                            onChange={(e) => setEditTier(e.target.value)}
                            className="bg-black border border-zinc-700 rounded-lg px-3 py-1 text-sm outline-none focus:border-blue-500"
                          >
                            <option value="FREE">FREE</option>
                            <option value="STARTER">STARTER</option>
                            <option value="PRO">PRO</option>
                            <option value="BUSINESS">BUSINESS</option>
                          </select>
                        ) : (
                          <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wider ${
                            user.subscription_tier === 'BUSINESS' ? 'bg-purple-500/20 text-purple-400' :
                            user.subscription_tier === 'PRO' ? 'bg-yellow-500/20 text-yellow-400' :
                            user.subscription_tier === 'STARTER' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-zinc-800 text-zinc-400'
                          }`}>
                            {user.subscription_tier || 'FREE'}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {editingId === user.teacher_id ? (
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleSaveTier(user.teacher_id)} className="p-2 bg-green-500/20 text-green-500 rounded-lg hover:bg-green-500/30">
                              <Check size={16} />
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30">
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => {
                              setEditingId(user.teacher_id);
                              setEditTier(user.subscription_tier || 'FREE');
                            }} 
                            className="p-2 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 hover:text-white"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-zinc-500">
                        Nenhum usuário encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
