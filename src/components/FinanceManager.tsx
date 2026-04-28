import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CreditCard, DollarSign, User, Calendar, ExternalLink, Search, Filter, Loader2, ArrowUpRight, ArrowDownLeft, CheckCircle2, XCircle, Clock, Settings, Save, LayoutGrid, List } from 'lucide-react';
import { PaymentLog, Subscription, MasterClassPurchase } from '../types';

export default function FinanceManager() {
  const [activeSubTab, setActiveSubTab] = useState<'TRANSACTIONS' | 'PLANS'>('TRANSACTIONS');
  const [logs, setLogs] = useState<PaymentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'subscription' | 'masterclass'>('ALL');
  const [stats, setStats] = useState({
    totalAmount: 0,
    monthlyAmount: 0,
    activeSubscriptions: 0,
    masterClassSales: 0
  });

  // Plans Management State
  const [planPrices, setPlanPrices] = useState<Record<string, number>>({
    STARTER: 9900,
    PRO: 19900,
    BUSINESS: 49900
  });
  const [savingPlan, setSavingPlan] = useState(false);

  useEffect(() => {
    fetchPayments();
    fetchPlanPrices();
  }, []);

  const fetchPayments = async () => {
    setLoading(true);
    if (!supabase) return;

    const { data, error } = await supabase
      .from('payments_log')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching payments:', error);
    } else {
      setLogs(data || []);
      
      // Calculate stats
      const total = (data || []).reduce((acc, curr) => curr.status === 'paid' ? acc + curr.amount : acc, 0);
      const subCount = (data || []).filter(l => l.type === 'subscription' && l.status === 'paid').length;
      const mcCount = (data || []).filter(l => l.type === 'masterclass' && l.status === 'paid').length;
      
      setStats({
        totalAmount: total / 100,
        monthlyAmount: total / 100, // Just a placeholder for now
        activeSubscriptions: subCount,
        masterClassSales: mcCount
      });
    }
    setLoading(false);
  };

  const fetchPlanPrices = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'plan_prices')
      .single();
    
    if (data) {
      setPlanPrices(data.value);
    }
  };

  const savePlanPrices = async () => {
    setSavingPlan(true);
    if (!supabase) return;
    
    const { error } = await supabase
      .from('platform_settings')
      .upsert({ 
        key: 'plan_prices', 
        value: planPrices,
        updated_at: new Date().toISOString()
      });
    
    if (error) {
      alert('Erro ao salvar preços: ' + error.message);
    } else {
      alert('Preços salvos com sucesso!');
    }
    setSavingPlan(false);
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.pagarme_id?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          log.teacher_id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'ALL' || log.type === filterType;
    return matchesSearch && matchesType;
  });

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid': return <CheckCircle2 className="text-green-500" size={16} />;
      case 'pending': return <Clock className="text-yellow-500" size={16} />;
      case 'failed': return <XCircle className="text-red-500" size={16} />;
      default: return <Clock className="text-zinc-500" size={16} />;
    }
  };

  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{status: 'success' | 'error', message: string} | null>(null);

  const testPagarMeConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const response = await fetch('/api/payments/test');
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        setTestResult({ status: 'success', message: data.message });
      } else {
        setTestResult({ status: 'error', message: data.message || 'Erro desconhecido na conexão.' });
      }
    } catch (error) {
      setTestResult({ status: 'error', message: 'Erro ao tentar conectar com a API do servidor.' });
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs Navigation */}
      <div className="flex gap-4 border-b border-zinc-800">
        <button 
          onClick={() => setActiveSubTab('TRANSACTIONS')}
          className={`px-4 py-2 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 ${
            activeSubTab === 'TRANSACTIONS' ? 'border-red-500 text-white' : 'border-transparent text-zinc-500 hover:text-white'
          }`}
        >
          <List size={16} />
          Transações
        </button>
        <button 
          onClick={() => setActiveSubTab('PLANS')}
          className={`px-4 py-2 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 ${
            activeSubTab === 'PLANS' ? 'border-red-500 text-white' : 'border-transparent text-zinc-500 hover:text-white'
          }`}
        >
          <Settings size={16} />
          Gestão de Planos
        </button>
      </div>

      {activeSubTab === 'TRANSACTIONS' ? (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
              <div className="flex items-center gap-3 mb-2 text-zinc-500">
                <DollarSign size={20} />
                <span className="text-xs font-bold uppercase tracking-wider">Volume Total</span>
              </div>
              <div className="text-3xl font-black text-white">
                R$ {stats.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="mt-2 flex items-center gap-1 text-green-500 text-xs font-bold">
                <ArrowUpRight size={14} />
                <span>+12% este mês</span>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
              <div className="flex items-center gap-3 mb-2 text-zinc-500">
                <CreditCard size={20} />
                <span className="text-xs font-bold uppercase tracking-wider">Assinaturas Ativas</span>
              </div>
              <div className="text-3xl font-black text-white">{stats.activeSubscriptions}</div>
              <p className="text-zinc-500 text-xs mt-2 font-medium">Recorrência mensal</p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
              <div className="flex items-center gap-3 mb-2 text-zinc-500">
                <Calendar size={20} />
                <span className="text-xs font-bold uppercase tracking-wider">MasterClasses Vendidas</span>
              </div>
              <div className="text-3xl font-black text-white">{stats.masterClassSales}</div>
              <p className="text-zinc-500 text-xs mt-2 font-medium">Vendas avulsas</p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
              <div className="flex items-center gap-3 mb-2 text-zinc-500">
                <User size={20} />
                <span className="text-xs font-bold uppercase tracking-wider">Ticket Médio</span>
              </div>
              <div className="text-3xl font-black text-white">
                R$ {(stats.totalAmount / (stats.activeSubscriptions + stats.masterClassSales || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-zinc-500 text-xs mt-2 font-medium">Por transação paga</p>
            </div>
          </div>

          {/* Filters & Transaction List */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-xl font-black flex items-center gap-2">
                <CreditCard className="text-red-500" />
                Registro de Pagamentos
              </h2>
              
              <div className="flex items-center gap-3">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <input 
                    type="text" 
                    placeholder="ID, Professor..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:border-red-500 outline-none"
                  />
                </div>
                
                <select 
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="bg-black border border-zinc-800 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-red-500"
                >
                  <option value="ALL">Todos os Tipos</option>
                  <option value="subscription">Assinaturas</option>
                  <option value="masterclass">MasterClasses</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="p-12 flex justify-center">
                <Loader2 className="animate-spin text-red-500" size={40} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-black/50 text-zinc-400 text-[10px] uppercase tracking-widest">
                    <tr>
                      <th className="p-4 font-bold">Data</th>
                      <th className="p-4 font-bold">Professor / Dojo</th>
                      <th className="p-4 font-bold">Tipo</th>
                      <th className="p-4 font-bold">Pagar.me ID</th>
                      <th className="p-4 font-bold">Valor</th>
                      <th className="p-4 font-bold">Status</th>
                      <th className="p-4 font-bold text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {filteredLogs.map(log => (
                      <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors text-sm">
                        <td className="p-4 text-zinc-400">
                          {new Date(log.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-white text-xs truncate max-w-[150px]">
                              {log.teacher_id}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">ID: {log.teacher_id.slice(0, 8)}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            log.type === 'subscription' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                          }`}>
                            {log.type === 'subscription' ? 'Assinatura' : 'MasterClass'}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-xs text-zinc-400">
                          {log.pagarme_id || '---'}
                        </td>
                        <td className="p-4 font-black text-white">
                          R$ {(log.amount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(log.status)}
                            <span className="capitalize">{log.status}</span>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <button className="p-2 text-zinc-500 hover:text-white transition-colors">
                            <ExternalLink size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredLogs.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-zinc-500">
                          Nenhuma transação encontrada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-white">Gestão de Planos</h2>
              <p className="text-zinc-500 text-sm">Configure os valores mensais de cada nível de assinatura.</p>
            </div>
            <button 
              onClick={savePlanPrices}
              disabled={savingPlan}
              className="bg-red-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {savingPlan ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Salvar Alterações
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.keys(planPrices).map(planKey => (
              <div key={planKey} className="bg-black border border-zinc-800 p-6 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">{planKey}</h3>
                  <div className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                    planKey === 'BUSINESS' ? 'bg-red-500/20 text-red-500' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {planKey === 'BUSINESS' ? 'Premium' : 'Standard'}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Valor Mensal (Cents)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">R$</span>
                    <input 
                      type="number" 
                      value={planPrices[planKey]}
                      onChange={(e) => setPlanPrices({...planPrices, [planKey]: parseInt(e.target.value)})}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-white font-black focus:border-red-500 outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-zinc-500 italic">
                    Valor formatado: R$ {(planPrices[planKey] / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="pt-4 space-y-2">
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Principais Recursos:</p>
                  <ul className="text-xs text-zinc-500 space-y-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={12} className="text-green-500" />
                      Painel Completo
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={12} className="text-green-500" />
                      Media Hub
                    </li>
                    {planKey !== 'STARTER' && (
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={12} className="text-green-500" />
                        MasterClasses
                      </li>
                    )}
                    {planKey === 'BUSINESS' && (
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={12} className="text-green-500" />
                        Relatórios Customizados
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-xl">
            <p className="text-xs text-red-500 font-bold mb-1">Nota importante:</p>
            <p className="text-[10px] text-red-500/70">
              Alterar os preços aqui afetará apenas novas assinaturas e futuras cobranças. As variações de MasterClass devem ser editadas diretamente no módulo de MasterClasses.
            </p>
          </div>
        </div>
      )}

      {/* Integration Settings (Admin Master Only info) */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500">Configuração Pagar.me</h3>
          <button 
            onClick={testPagarMeConnection}
            disabled={testingConnection}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white rounded-xl transition-all disabled:opacity-50"
          >
            {testingConnection ? <Loader2 size={14} className="animate-spin" /> : <Settings size={14} />}
            Testar Conexão
          </button>
        </div>

        {testResult && (
          <div className={`mb-6 p-4 rounded-xl text-xs font-bold border ${
            testResult.status === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'
          }`}>
            {testResult.status === 'success' ? <CheckCircle2 size={16} className="inline mr-2" /> : <XCircle size={16} className="inline mr-2" />}
            {testResult.message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">Chave da API (Produção)</label>
            <div className="bg-black border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
              <span className="font-mono text-xs text-zinc-500 italic">ak_live_************************</span>
              <span className="text-[10px] font-bold text-green-500 px-2 py-0.5 bg-green-500/10 rounded">Ativa</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1">URL do Webhook (Configurar no Pagar.me)</label>
            <div className="bg-black border border-zinc-800 rounded-xl p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-zinc-400 underline truncate">https://{window.location.hostname}/api/webhook/pagarme</span>
                <span className="text-[10px] font-bold text-blue-500 px-2 py-0.5 bg-blue-500/10 rounded">Endpoint Ativo</span>
              </div>
              <p className="text-[10px] text-zinc-500 italic">
                Configure esta URL no Dashboard do Pagar.me para receber notificações automáticas de pagamento.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
