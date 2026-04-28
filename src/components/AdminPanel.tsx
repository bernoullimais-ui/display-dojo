import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Search, Edit2, Check, X, Loader2, Lock, Mail, BarChart3, DollarSign } from 'lucide-react';
import GlobalMediaManager from './GlobalMediaManager';
import AdminReports from './AdminReports';
import MasterClassManager from './MasterClassManager';
import FinanceManager from './FinanceManager';
import { MASTER_ADMIN_EMAIL, ADMIN_PASSWORD_INITIAL } from '../constants';

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
  const [activeTab, setActiveTab] = useState<'USERS' | 'MEDIA' | 'REPORTS' | 'MASTERCLASS' | 'PAYMENTS'>('USERS');
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChangingPass(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      alert('Erro ao alterar senha: ' + error.message);
    } else {
      alert('Senha alterada com sucesso!');
      setShowPasswordChange(false);
      setNewPassword('');
    }
    setIsChangingPass(false);
  };

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
    if (inputEmail.toLowerCase().trim() === MASTER_ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD_INITIAL) {
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
    const { data: dojoData, error: dojoError } = await supabase
      .from('dojo_settings')
      .select('*')
      .neq('teacher_id', '00000000-0000-0000-0000-000000000000');
      
    if (dojoError) {
      setError(`Erro do Supabase (dojo_settings): ${dojoError.message || JSON.stringify(dojoError)}`);
      console.error('Supabase error details:', dojoError);
      setLoading(false);
      return;
    }

    // Try to fetch emails from the public view
    const { data: emailData, error: emailError } = await supabase
      .from('user_emails_view')
      .select('*');

    if (emailError) {
      console.warn('Could not fetch emails. View might not exist:', emailError);
      // We don't block the UI, just show users without emails, but we set the error so the admin knows they need to run the SQL
      setError(`Aviso: Não foi possível carregar os e-mails. Execute o comando SQL abaixo no Supabase para criar a view de e-mails.\nDetalhes: ${emailError.message}`);
      setUsers(dojoData || []);
    } else {
      // Merge emails into dojoData
      const usersWithEmails = (dojoData || []).map(user => {
        const userEmailRecord = (emailData || []).find(e => e.id === user.teacher_id);
        return {
          ...user,
          email: userEmailRecord?.email || null
        };
      });
      setUsers(usersWithEmails);
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
            <div className="space-y-4 mb-6">
              <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 p-4 rounded-xl text-sm text-center">
                Você não está logado no Supabase. Para salvar alterações no banco de dados, você precisa autenticar sua conta.
              </div>
              <button 
                onClick={async () => {
                  if (!supabase) return;
                  await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: { redirectTo: window.location.href }
                  });
                }}
                className="w-full flex items-center justify-center gap-3 bg-white text-black font-bold py-3 rounded-xl hover:bg-zinc-200 transition-colors"
              >
                <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                Login com Google (Admin)
              </button>
            </div>
          ) : (
            <div className={`p-4 rounded-xl mb-6 text-sm text-center border ${adminEmail.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase() ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
              Logado no Supabase: <strong>{adminEmail}</strong>
              {adminEmail.toLowerCase() !== MASTER_ADMIN_EMAIL.toLowerCase() && (
                <p className="mt-2 text-[10px] uppercase font-black">Este e-mail não tem permissão master!</p>
              )}
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
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowPasswordChange(true)}
              className="p-3 bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-xl transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
              title="Alterar Senha"
            >
              <Lock size={16} />
              <span className="hidden md:inline">Segurança</span>
            </button>
            <div className="text-right">
              {adminEmail ? (
                <div className="text-sm">
                  <span className="text-zinc-500">Supabase: </span>
                  <span className={adminEmail.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase() ? 'text-green-500 font-bold' : 'text-yellow-500 font-bold'}>
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
        </div>

        {(!adminEmail || adminEmail.toLowerCase() !== MASTER_ADMIN_EMAIL.toLowerCase()) && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 p-4 rounded-xl text-sm">
            <strong>Atenção:</strong> Você acessou a tela do painel, mas <strong>não está logado no Supabase com o e-mail de administrador</strong>. 
            Para que o banco de dados libere os dados, você precisa abrir o app normalmente (sem o ?admin=true), fazer login com o Google usando a conta <strong>{MASTER_ADMIN_EMAIL}</strong>, e depois voltar para cá.
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-6 rounded-xl space-y-4">
            <p className="font-bold text-lg">Ocorreu um erro ao buscar os dados:</p>
            <pre className="bg-black/50 p-4 rounded-lg text-sm font-mono text-red-400 overflow-x-auto whitespace-pre-wrap">
              {error}
            </pre>
            
            {error.includes('RLS') || error.includes('column') || error.includes('onboarding') ? (
              <>
                <p className="text-sm text-red-400 mt-4">Para corrigir permissões ou falta de colunas, execute este comando no Supabase SQL Editor:</p>
                <div className="flex justify-between items-center mb-2">
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`ALTER TABLE public.dojo_settings ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.dojo_settings ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.dojo_settings ADD COLUMN IF NOT EXISTS martial_arts TEXT[];
ALTER TABLE public.dojo_settings ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

DROP POLICY IF EXISTS "Admin Master Full Access" ON public.dojo_settings;
CREATE POLICY "Admin Master Full Access" ON public.dojo_settings
FOR ALL TO authenticated
USING (auth.jwt() ->> 'email' = '${MASTER_ADMIN_EMAIL}')
WITH CHECK (auth.jwt() ->> 'email' = '${MASTER_ADMIN_EMAIL}');`);
                      alert('Script copiado!');
                    }}
                    className="p-2 bg-zinc-800 text-blue-500 rounded-lg text-[10px] font-black uppercase"
                  >
                    Copiar Script Completo
                  </button>
                </div>
                <pre className="bg-black/50 p-4 rounded-lg text-[10px] font-mono text-zinc-300 overflow-x-auto">
{`ALTER TABLE public.dojo_settings 
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS martial_arts TEXT[],
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

DROP POLICY IF EXISTS "Admin Master Full Access" ON dojo_settings;
CREATE POLICY "Admin Master Full Access" ON dojo_settings
FOR ALL TO authenticated
USING (auth.jwt() ->> 'email' = '${MASTER_ADMIN_EMAIL}')
WITH CHECK (auth.jwt() ->> 'email' = '${MASTER_ADMIN_EMAIL}');`}
                </pre>
              </>
            ) : null}

            {error.includes('user_emails_view') && (
              <>
                <p className="text-sm text-red-400 mt-4">Para ver os e-mails dos usuários, você precisa criar uma View no banco de dados. Acesse o painel do Supabase &gt; SQL Editor e rode o seguinte comando:</p>
                <pre className="bg-black/50 p-4 rounded-lg text-xs font-mono text-zinc-300 overflow-x-auto">
{`CREATE OR REPLACE VIEW public.user_emails_view AS
SELECT id, email FROM auth.users;

GRANT SELECT ON public.user_emails_view TO authenticated;`}
                </pre>
              </>
            )}
          </div>
        )}

        <div className="flex gap-4 border-b border-zinc-800 pb-4 overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setActiveTab('USERS')}
            className={`px-6 py-3 rounded-xl font-bold transition-colors whitespace-nowrap ${activeTab === 'USERS' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Gestão de Usuários
          </button>
          <button 
            onClick={() => setActiveTab('MEDIA')}
            className={`px-6 py-3 rounded-xl font-bold transition-colors whitespace-nowrap ${activeTab === 'MEDIA' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Gestão de Mídias Globais
          </button>
          <button 
            onClick={() => setActiveTab('MASTERCLASS')}
            className={`px-6 py-3 rounded-xl font-bold transition-colors whitespace-nowrap ${activeTab === 'MASTERCLASS' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            MasterClass
          </button>
          <button 
            onClick={() => setActiveTab('REPORTS')}
            className={`px-6 py-3 rounded-xl font-bold transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'REPORTS' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <BarChart3 size={18} />
            Relatórios
          </button>
          <button 
            onClick={() => setActiveTab('PAYMENTS')}
            className={`px-6 py-3 rounded-xl font-bold transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'PAYMENTS' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <DollarSign size={18} />
            Financeiro
          </button>
        </div>

        {activeTab === 'MASTERCLASS' && <MasterClassManager />}
        {activeTab === 'REPORTS' && <AdminReports />}
        {activeTab === 'PAYMENTS' && <FinanceManager />}

        {activeTab === 'USERS' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col items-center justify-center">
                <span className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">FREE</span>
                <span className="text-3xl font-black text-white">{users.filter(u => !u.subscription_tier || u.subscription_tier === 'FREE').length}</span>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl flex flex-col items-center justify-center">
                <span className="text-blue-500 text-xs font-bold uppercase tracking-wider mb-1">STARTER</span>
                <span className="text-3xl font-black text-blue-400">{users.filter(u => u.subscription_tier === 'STARTER').length}</span>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-2xl flex flex-col items-center justify-center">
                <span className="text-yellow-500 text-xs font-bold uppercase tracking-wider mb-1">PRO</span>
                <span className="text-3xl font-black text-yellow-400">{users.filter(u => u.subscription_tier === 'PRO').length}</span>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-2xl flex flex-col items-center justify-center">
                <span className="text-purple-500 text-xs font-bold uppercase tracking-wider mb-1">BUSINESS</span>
                <span className="text-3xl font-black text-purple-400">{users.filter(u => u.subscription_tier === 'BUSINESS').length}</span>
              </div>
            </div>

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
                        <th className="p-4 font-bold">E-mail</th>
                        <th className="p-4 font-bold">Teacher ID</th>
                        <th className="p-4 font-bold">Plano Atual</th>
                        <th className="p-4 font-bold text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {filteredUsers.map(user => (
                        <tr key={user.teacher_id} className="hover:bg-zinc-800/20 transition-colors">
                          <td className="p-4 font-bold">{user.name || 'Sem Nome'}</td>
                          <td className="p-4 text-zinc-300 text-sm">{user.email || <span className="text-zinc-600 italic">Desconhecido</span>}</td>
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
          </>
        )}

        {activeTab === 'MEDIA' && (
          <GlobalMediaManager />
        )}

        {showPasswordChange && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
              onClick={() => setShowPasswordChange(false)}
            />
            <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 shadow-2xl">
              <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Alterar Senha</h2>
              <p className="text-zinc-500 text-sm mb-6 lowercase">Sua nova senha deve ter no mínimo 6 caracteres.</p>
              
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Nova Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={20} />
                    <input 
                      type="password" 
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-4 pl-12 text-white focus:border-red-600 outline-none font-mono transition-all"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setShowPasswordChange(false)}
                    className="flex-1 bg-zinc-800 text-white font-bold py-4 rounded-2xl hover:bg-zinc-700 transition-all uppercase tracking-widest text-xs"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isChangingPass}
                    className="flex-1 bg-red-600 text-white font-bold py-4 rounded-2xl hover:bg-red-700 transition-all uppercase tracking-widest text-xs shadow-lg shadow-red-600/20 flex items-center justify-center gap-2"
                  >
                    {isChangingPass ? <Loader2 className="animate-spin" size={16} /> : 'Confirmar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
