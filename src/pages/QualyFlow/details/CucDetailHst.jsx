import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { QUALY_RULES } from '../rules';
import CucDetailHstModal from './CucDetailHstModal';

const parseDateBR = (dateStr) => {
  if (!dateStr) return 0;
  const [d, m, y] = dateStr.split('/');
  return new Date(`${y}-${m}-${d}`).getTime();
};

const CucDetailHst = () => {
  const [historicoData, setHistoricoData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchCampo, setSearchCampo] = useState('');
  
  // INICIA EM 'Todos' COMO SOLICITADO
  const [filtroAno, setFiltroAno] = useState('Todos');
  const [filtroAvaliacao, setFiltroAvaliacao] = useState('Todos');

  const [selectedModalItem, setSelectedModalItem] = useState(null);

  // Lógica do botão Limpar recalibrada
  const hasFilters = searchCampo !== '' || filtroAno !== 'Todos' || filtroAvaliacao !== 'Todos';

  useEffect(() => {
    const fetchHistorico = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('vw_cuc_geral').select('*');
        if (error) throw error;
        setHistoricoData(data || []);
      } catch (err) {
        console.error("Erro ao buscar histórico do CUC:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistorico();
  }, []);

  const filteredAndSortedData = historicoData
    .filter(item => {
      const matchCampo = (item.campo || '').toLowerCase().includes(searchCampo.toLowerCase());
      const matchAno = filtroAno === 'Todos' || String(item.ano) === filtroAno;
      const matchAv = filtroAvaliacao === 'Todos' || String(item.avaliacao) === filtroAvaliacao;
      return matchCampo && matchAno && matchAv;
    })
    .sort((a, b) => parseDateBR(b.data_final) - parseDateBR(a.data_final));

  const limparFiltros = () => {
    setSearchCampo('');
    setFiltroAno('Todos');
    setFiltroAvaliacao('Todos');
  };

  return (
    <div className="flex flex-col gap-4 animate-in slide-in-from-right-4 duration-300">
      
      {/* PAINEL DE FILTROS COMPACTO */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
        <div className="flex w-full gap-2 items-end">
          <div className="flex-1 flex flex-col transition-all duration-300">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Procurar Campo</label>
            <input 
              type="text" 
              placeholder=""
              value={searchCampo}
              onChange={(e) => setSearchCampo(e.target.value)}
              className="w-full h-[38px] bg-slate-50 border border-slate-200 rounded-lg px-4 text-xs font-bold text-[var(--q-dark)] outline-none focus:border-[var(--q-green)] focus:bg-white transition-all shadow-inner"
            />
          </div>

          {hasFilters && (
            <button 
              onClick={limparFiltros}
              className="h-[38px] px-4 flex items-center justify-center gap-1.5 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 hover:border-red-300 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors shadow-sm whitespace-nowrap animate-in zoom-in duration-200"
            >
              ✕ Limpar
            </button>
          )}
        </div>

        <div className="flex w-full gap-3">
          <div className="flex-1 flex flex-col">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Ano</label>
            <select 
              value={filtroAno}
              onChange={(e) => setFiltroAno(e.target.value)}
              className="w-full h-[38px] bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs font-bold text-[var(--q-dark)] outline-none focus:border-[var(--q-green)] cursor-pointer shadow-inner"
            >
              <option value="Todos">Todos</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </select>
          </div>
          
          <div className="flex-1 flex flex-col">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Avaliação</label>
            <select 
              value={filtroAvaliacao}
              onChange={(e) => setFiltroAvaliacao(e.target.value)}
              className="w-full h-[38px] bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs font-bold text-[var(--q-dark)] outline-none focus:border-[var(--q-green)] cursor-pointer shadow-inner"
            >
              <option value="Todos">Todas</option>
              <option value="1">1ª Avaliação</option>
              <option value="2">2ª Avaliação</option>
              <option value="3">3ª Avaliação</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABELA DO HISTÓRICO */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-5 py-3 bg-slate-50 border-b border-slate-100">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-left">Campo / Avaliação</span>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center w-[50px]">CUC</span>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center w-[50px]">Vazão</span>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-right w-[50px]">Entup.</span>
        </div>

        <div className="flex flex-col max-h-[500px] overflow-y-auto custom-scrollbar relative min-h-[150px]">
          {loading ? (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10">
               <div className="w-6 h-6 border-2 border-[var(--q-green)]/20 border-t-[var(--q-green)] rounded-full animate-spin mb-2"></div>
               <span className="text-[10px] font-bold text-[var(--q-green)] uppercase tracking-widest animate-pulse">Processando...</span>
             </div>
          ) : filteredAndSortedData.length === 0 ? (
            <div className="p-10 text-center flex flex-col items-center opacity-60">
              <span className="text-3xl mb-2">🔍</span>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Nenhum campo encontrado</span>
            </div>
          ) : (
            filteredAndSortedData.map((item) => (
              <button 
                key={item.id}
                onClick={() => setSelectedModalItem(item)}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-5 py-3 border-b border-slate-200 last:border-0 hover:bg-slate-50/80 transition-colors w-full cursor-pointer group"
              >
                <div className="flex flex-col items-start text-left">
                  <span className="text-[12px] font-black text-slate-700 uppercase group-hover:text-[var(--q-green)] transition-colors">{item.campo}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase">{item.ano} • {item.avaliacao}ª Avaliação</span>
                </div>
                
                <span className="text-[14px] font-black tracking-tighter text-center w-[50px]" style={{ color: QUALY_RULES.CUC.meta(item.cuc_perc) }}>
                  {Number(item.cuc_perc).toFixed(1)}%
                </span>
                <span className="text-[14px] font-black tracking-tighter text-center w-[50px]" style={{ color: QUALY_RULES.CUC.vazaoMeta(item.vazao) }}>
                  {Number(item.vazao).toFixed(2)}
                </span>
                <span className="text-[14px] font-black tracking-tighter text-right w-[50px]" style={{ color: QUALY_RULES.CUC.entupimentoMeta(item.entupidos_perc) }}>
                  {Number(item.entupidos_perc).toFixed(1)}%
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {selectedModalItem && (
        <CucDetailHstModal 
          item={selectedModalItem} 
          onClose={() => setSelectedModalItem(null)} 
        />
      )}

    </div>
  );
};

export default CucDetailHst;