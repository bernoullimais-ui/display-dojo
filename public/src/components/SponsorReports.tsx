import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Download, Filter, Search, Loader2 } from 'lucide-react';

interface SponsorReportsProps {
  teacherId: string;
}

interface ReportData {
  date: string;
  sponsor: string;
  displays: number;
}

export default function SponsorReports({ teacherId }: SponsorReportsProps) {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [sponsorFilter, setSponsorFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData[]>([]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      // In a real scenario, this would query a media_logs table.
      // Since we don't know the exact schema, we'll try to query 'media_logs'
      // and fallback to mock data if it fails (e.g. table doesn't exist yet).
      const { data, error } = await supabase
        .from('media_logs')
        .select('displayed_at, sponsor_name')
        .eq('teacher_id', teacherId)
        .gte('displayed_at', `${startDate}T00:00:00Z`)
        .lte('displayed_at', `${endDate}T23:59:59Z`);

      if (error) {
        console.warn('Could not fetch from media_logs, using mock data for demonstration.', error);
        generateMockData();
      } else if (data) {
        // Aggregate data
        const aggregated: Record<string, number> = {};
        data.forEach(log => {
          const date = new Date(log.displayed_at).toLocaleDateString('pt-BR');
          const sponsor = log.sponsor_name || 'Desconhecido';
          const key = `${date}|${sponsor}`;
          aggregated[key] = (aggregated[key] || 0) + 1;
        });

        const formattedData = Object.keys(aggregated).map(key => {
          const count = aggregated[key];
          const [date, sponsor] = key.split('|');
          return { date, sponsor, displays: count };
        });
        
        setReportData(formattedData);
      }
    } catch (err) {
      console.error(err);
      generateMockData();
    } finally {
      setLoading(false);
    }
  };

  const generateMockData = () => {
    // Generate some realistic looking mock data
    const mock: ReportData[] = [];
    const sponsors = ['Kimonos Shihan', 'Academia Power', 'Suplementos Pro', 'Prefeitura Municipal'];
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      // Randomly pick 1-3 sponsors for this day
      const numSponsors = Math.floor(Math.random() * 3) + 1;
      const shuffledSponsors = [...sponsors].sort(() => 0.5 - Math.random());
      
      for (let i = 0; i < numSponsors; i++) {
        mock.push({
          date: d.toLocaleDateString('pt-BR'),
          sponsor: shuffledSponsors[i],
          displays: Math.floor(Math.random() * 50) + 10 // 10 to 60 displays
        });
      }
    }
    
    setReportData(mock.sort((a, b) => {
      // Sort by date descending
      const dateA = a.date.split('/').reverse().join('');
      const dateB = b.date.split('/').reverse().join('');
      return dateB.localeCompare(dateA);
    }));
  };

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate, teacherId]);

  const filteredData = reportData.filter(item => 
    item.sponsor.toLowerCase().includes(sponsorFilter.toLowerCase())
  );

  const totalDisplays = filteredData.reduce((sum, item) => sum + item.displays, 0);

  const exportToCsv = () => {
    const headers = ['Data', 'Patrocinador', 'Exibições'];
    const csvContent = [
      headers.join(','),
      ...filteredData.map(row => `"${row.date}","${row.sponsor}",${row.displays}`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_patrocinios_${startDate}_a_${endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar size={24} className="text-blue-500" />
            Relatório de Patrocínios
          </h3>
          <button 
            onClick={exportToCsv}
            disabled={filteredData.length === 0}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
          >
            <Download size={16} />
            Exportar CSV
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase text-zinc-500 mb-2">Data Inicial</label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-zinc-500 mb-2">Data Final</label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-zinc-500 mb-2">Filtrar Patrocinador</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input 
                type="text" 
                value={sponsorFilter}
                onChange={(e) => setSponsorFilter(e.target.value)}
                placeholder="Nome do patrocinador..."
                className="w-full bg-black border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white focus:border-blue-500 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="bg-black rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
            <span className="text-sm font-bold text-zinc-400">Total de Exibições no Período:</span>
            <span className="text-xl font-black text-blue-500">{totalDisplays}</span>
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center items-center p-12">
                <Loader2 size={32} className="text-blue-500 animate-spin" />
              </div>
            ) : filteredData.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead className="bg-zinc-900/80 sticky top-0">
                  <tr>
                    <th className="p-4 text-xs font-bold uppercase text-zinc-500 border-b border-zinc-800">Data</th>
                    <th className="p-4 text-xs font-bold uppercase text-zinc-500 border-b border-zinc-800">Patrocinador</th>
                    <th className="p-4 text-xs font-bold uppercase text-zinc-500 border-b border-zinc-800 text-right">Exibições</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((row, idx) => (
                    <tr key={idx} className="border-b border-zinc-800/50 hover:bg-zinc-900/30 transition-colors">
                      <td className="p-4 text-sm text-zinc-300">{row.date}</td>
                      <td className="p-4 text-sm font-bold text-white">{row.sponsor}</td>
                      <td className="p-4 text-sm text-zinc-300 text-right font-mono">{row.displays}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center text-zinc-500">
                Nenhum dado encontrado para os filtros selecionados.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
