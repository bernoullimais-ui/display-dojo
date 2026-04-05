import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Search, Edit2, Check, X, Loader2, Lock, Mail } from 'lucide-react';

export default function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inputEmail, setInputEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTier, setEditTier] = useState<string>('');
  const [error, setError] = useState('');

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email) {
      setAdminEmail(session.user.email);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchUsers();
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple hardcoded credentials for master admin access
    if (inputEmail.toLowerCase().trim() === 'judobrunomaia@gmail.com' && password === 'dojomaster2026') {
      setIsAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('E-mail ou senha incorretos.');
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    if (!supabase) return;
    
    // Fetch all dojo_settings
    const { data, error } = await supabase
      .from('dojo_settings')
      .select('*');
      
    if (error) {
      setError(`Erro do Supabase: ${error.message || JSON.stringify(error)}`);
      console.error('Supabase error details:', error);
    } else {
      setUsers(data || []);
      setError('');
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 font-sans">
        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl w-full max-w-md shadow-2xl">
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="bg-red-500/20 p-4 rounded-full">
              <Shield className="text-red-500" size={40} />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tighter">Acesso Restrito</h1>
            <p className="text-zinc-400 text-center text-sm">Digite a senha master para acessar o painel de administração.</p>
          </div>

          {!adminEmail ? (
            <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 p-4 rounded-xl mb-6 text-sm text-center">
              Você não está logado no Supabase. Por favor, acesse a página inicial, faça login com sua conta de administrador e depois retorne para esta página.
            </div>
          ) : (
            <div className="bg-blue-500/10 border border-blue-500/20 text-blue-500 p-4 rounded-xl mb-6 text-sm text-center">
              Logado como: <strong>{adminEmail}</strong>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="text-zinc-500" size={20} />
              </div>
              <input
                type="email"
                value={inputEmail}
                onChange={(e) => setInputEmail(e.target.value)}
                placeholder="E-mail do Administrador"
                className="w-full bg-black border border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-white focus:border-red-500 outline-none transition-colors"
                autoFocus
              />
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="text-zinc-500" size={20} />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha Master"
                className="w-full bg-black border border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-white focus:border-red-500 outline-none transition-colors"
              />
            </div>
            
            {loginError && (
              <p className="text-red-500 text-sm text-center">{loginError}</p>
            )}

            <button
              type="submit"
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Entrar
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <div className="flex items-center gap-4">
            <div className="bg-red-500/20 p-4 rounded-2xl">
              <Shield className="text-red-500" size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tighter">Painel Master Admin</h1>
              <p className="text-zinc-400">Gerenciamento de Assinaturas e Dojos</p>
            </div>
          </div>
          <div className="text-right">
            {adminEmail ? (
              <div className="text-sm">
                <span className="text-zinc-500">Supabase: </span>
                <span className={adminEmail.toLowerCase() === 'judobrunomaia@gmail.com' ? 'text-green-500 font-bold' : 'text-yellow-500 font-bold'}>
                  {adminEmail}
                </span>
              </div>
            ) : (
              <div className="text-sm text-red-500 font-bold">
                Não logado no Supabase
              </div>
            )}
          </div>
        </div>

        {(!adminEmail || adminEmail.toLowerCase() !== 'judobrunomaia@gmail.com') && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 p-4 rounded-xl text-sm">
            <strong>Atenção:</strong> Você acessou a tela do painel, mas <strong>não está logado no Supabase com o e-mail de administrador</strong>. 
            Para que o banco de dados libere os dados, você precisa abrir o app normalmente (sem o ?admin=true), fazer login com o Google usando a conta <strong>judobrunomaia@gmail.com</strong>, e depois voltar para cá.
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-6 rounded-xl space-y-4">
            <p className="font-bold text-lg">Ocorreu um erro ao buscar os dados:</p>
            <pre className="bg-black/50 p-4 rounded-lg text-sm font-mono text-red-400 overflow-x-auto whitespace-pre-wrap">
              {error}
            </pre>
            
            {error.includes('RLS') && (
              <>
                <p className="text-sm text-red-400 mt-4">Se for um erro de permissão, acesse o painel do Supabase &gt; SQL Editor e rode o seguinte comando:</p>
                <pre className="bg-black/50 p-4 rounded-lg text-xs font-mono text-zinc-300 overflow-x-auto">
{`CREATE POLICY "Admin Master Full Access" ON dojo_settings
FOR ALL
TO authenticated
USING (auth.jwt() ->> 'email' = 'judobrunomaia@gmail.com')
WITH CHECK (auth.jwt() ->> 'email' = 'judobrunomaia@gmail.com');`}
                </pre>
              </>
            )}
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
