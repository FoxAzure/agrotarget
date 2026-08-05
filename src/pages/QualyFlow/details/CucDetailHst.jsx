// ================================= DOCUMENTATION ------------------------------------------
// Script: CucDetailHst
// Purpose: Exibe o histórico geral de CUC em formato de lista slim com filtros e cards de resumo.
// Relationships: vw_q_cucgeral
// ==========================================================================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import CucDetailHstModal from './CucDetailHstModal';

// ================================= HELPERS ------------------------------------------------

const parseDate = (dateStr) => {
  if (!dateStr) return 0;
  if (dateStr.includes('-')) return new Date(dateStr).getTime();
  const [d, m, y] = dateStr.split('/');
  return new Date(`${y}-${m}-${d}`).getTime();
};

const formatValue = (value, decimals = 2) => {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  return Number.isNaN(num) ? '-' : num.toFixed(decimals).replace('.', ',');
};

const getCucColor = (value) => {
  const cuc = Number(value);
  if (Number.isNaN(cuc)) return 'var(--q-gray)';
  if (cuc >= 90) return '#22c55e';
  if (cuc >= 80) return '#f59e0b';
  return '#ef4444';
};

const getEntupColor = (value) => {
  const entup = Number(value);
  if (Number.isNaN(entup)) return 'var(--q-gray)';
  if (entup <= 5) return '#22c55e';
  if (entup <= 10) return '#f59e0b';
  return '#ef4444';
};

const getVazaoColor = (value) => {
  const vazao = Number(value);
  if (Number.isNaN(vazao)) return 'var(--q-gray)';
  if (vazao > 1.2) return '#0ea5e9';
  if (vazao > 1.1 && vazao <= 1.2) return '#f59e0b';
  if (vazao >= 0.9 && vazao <= 1.1) return '#22c55e';
  if (vazao >= 0.8 && vazao < 0.9) return '#f97316';
  return '#ef4444';
};

// ================================= COMPONENT ----------------------------------------------

const CucDetailHst = () => {
  const [historicoData, setHistoricoData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchCampo, setSearchCampo] = useState('');
  const [filtroAno, setFiltroAno] = useState('Todos');
  const [filtroAvaliacao, setFiltroAvaliacao] = useState('Todos');
  const [filtroDepa, setFiltroDepa] = useState('Todos');
  const [filtroSetor, setFiltroSetor] = useState('Todos');
  
  // Filtro dos Cards de Total
  const [filtroMeta, setFiltroMeta] = useState('Todos'); // 'Todos' | 'Abaixo' | 'Acima'

  const [selectedModalItem, setSelectedModalItem] = useState(null);

  const hasFilters = searchCampo !== '' || filtroAno !== 'Todos' || filtroAvaliacao !== 'Todos' || filtroDepa !== 'Todos' || filtroSetor !== 'Todos' || filtroMeta !== 'Todos';

  // =========================================================================
  // BUSCA DADOS
  // =========================================================================
  useEffect(() => {
    const fetchHistorico = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('vw_q_cucgeral').select('*');
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

  // =========================================================================
  // OPÇÕES DINÂMICAS PARA OS SELECTS
  // =========================================================================
  const anosUnicos = [...new Set(historicoData.map(d => d.ano).filter(Boolean))].sort((a, b) => b - a);
  const avaliacoesUnicas = [...new Set(historicoData.map(d => d.avaliacao).filter(Boolean))].sort();
  const depasUnicos = [...new Set(historicoData.map(d => d.depa).filter(Boolean))].sort();
  const setoresDisponiveis = [...new Set(historicoData.filter(d => filtroDepa === 'Todos' || d.depa === filtroDepa).map(d => d.setor).filter(Boolean))].sort();

  // =========================================================================
  // LÓGICA DE FILTRAGEM E CONTAGEM
  // =========================================================================
  
  // 1. Aplica todos os filtros (EXCETO a Meta <80 ou >80) para calcular os Cards
  const baseFilteredData = historicoData.filter(item => {
    const termo = searchCampo.toLowerCase().trim();
    const campoStr = String(item.campo || '').toLowerCase();
    const codigoStr = String(item.codigo_campo || '').toLowerCase();
    
    const matchCampo = termo === '' || campoStr.includes(termo) || codigoStr.includes(termo);
    const matchAno = filtroAno === 'Todos' || String(item.ano) === String(filtroAno);
    const matchAv = filtroAvaliacao === 'Todos' || String(item.avaliacao) === String(filtroAvaliacao);
    const matchDepa = filtroDepa === 'Todos' || String(item.depa) === String(filtroDepa);
    const matchSetor = filtroSetor === 'Todos' || String(item.setor) === String(filtroSetor);

    return matchCampo && matchAno && matchAv && matchDepa && matchSetor;
  });

  const countTotal = baseFilteredData.length;
  const countAbaixo = baseFilteredData.filter(i => i.cuc < 80).length;
  const countAcima = baseFilteredData.filter(i => i.cuc >= 80).length;

  // 2. Aplica o filtro de Meta (Cards) e Ordena a lista final
  const filteredAndSortedData = baseFilteredData
    .filter(item => {
      if (filtroMeta === 'Abaixo') return item.cuc < 80;
      if (filtroMeta === 'Acima') return item.cuc >= 80;
      return true; // 'Todos'
    })
    .sort((a, b) => parseDate(b.dt_final) - parseDate(a.dt_final));

  const limparFiltros = () => {
    setSearchCampo('');
    setFiltroAno('Todos');
    setFiltroAvaliacao('Todos');
    setFiltroDepa('Todos');
    setFiltroSetor('Todos');
    setFiltroMeta('Todos');
  };

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <div className="flex flex-col gap-5 animate-in slide-in-from-right-4 duration-300">
      
      {/* ================================================================
          CARDS DE RESUMO (TOTAIS)
      ================================================================= */}
      <div className="grid grid-cols-3 gap-3">
        <button 
          onClick={() => setFiltroMeta('Todos')}
          className={`bg-white border rounded-xl p-4 shadow-sm flex flex-col items-center gap-1 transition-all ${filtroMeta === 'Todos' ? 'border-slate-400 ring-2 ring-slate-100' : 'border-slate-200 hover:border-slate-300'}`}
        >
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Avaliações</span>
          <span className="text-2xl sm:text-3xl font-black tracking-tighter text-[var(--q-dark)]">{countTotal}</span>
        </button>

        <button 
          onClick={() => setFiltroMeta('Abaixo')}
          className={`bg-white border rounded-xl p-4 shadow-sm flex flex-col items-center gap-1 transition-all ${filtroMeta === 'Abaixo' ? 'border-red-400 ring-2 ring-red-50' : 'border-slate-200 hover:border-red-200'}`}
        >
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center leading-tight">Atenção<br/><span className="text-[8px]">&lt; 80%</span></span>
          <span className="text-2xl sm:text-3xl font-black tracking-tighter text-red-500">{countAbaixo}</span>
        </button>

        <button 
          onClick={() => setFiltroMeta('Acima')}
          className={`bg-white border rounded-xl p-4 shadow-sm flex flex-col items-center gap-1 transition-all ${filtroMeta === 'Acima' ? 'border-green-400 ring-2 ring-green-50' : 'border-slate-200 hover:border-green-200'}`}
        >
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center leading-tight">Meta<br/><span className="text-[8px]">≥ 80%</span></span>
          <span className="text-2xl sm:text-3xl font-black tracking-tighter text-green-500">{countAcima}</span>
        </button>
      </div>

      {/* ================================================================
          PAINEL DE FILTROS
      ================================================================= */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
        <div className="flex w-full gap-2 items-end">
          <div className="flex-1 flex flex-col transition-all duration-300">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Campo</label>
            <input 
              type="text" 
              placeholder="Procurar (Nome ou Código)"
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Ano</label>
            <select value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)} className="w-full h-[38px] bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs font-bold text-[var(--q-dark)] outline-none focus:border-[var(--q-green)] cursor-pointer shadow-inner">
              <option value="Todos">Todos</option>
              {anosUnicos.map(ano => <option key={`ano-${ano}`} value={ano}>{ano}</option>)}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Avaliação</label>
            <select value={filtroAvaliacao} onChange={(e) => setFiltroAvaliacao(e.target.value)} className="w-full h-[38px] bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs font-bold text-[var(--q-dark)] outline-none focus:border-[var(--q-green)] cursor-pointer shadow-inner">
              <option value="Todos">Todas</option>
              {avaliacoesUnicas.map(av => <option key={`av-${av}`} value={av}>{av}ª Avaliação</option>)}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">DEPA</label>
            <select value={filtroDepa} onChange={(e) => { setFiltroDepa(e.target.value); setFiltroSetor('Todos'); }} className="w-full h-[38px] bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs font-bold text-[var(--q-dark)] outline-none focus:border-[var(--q-green)] cursor-pointer shadow-inner">
              <option value="Todos">Todos</option>
              {depasUnicos.map(depa => <option key={`depa-${depa}`} value={depa}>{depa}</option>)}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Setor</label>
            <select value={filtroSetor} onChange={(e) => setFiltroSetor(e.target.value)} className="w-full h-[38px] bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs font-bold text-[var(--q-dark)] outline-none focus:border-[var(--q-green)] cursor-pointer shadow-inner">
              <option value="Todos">Todos</option>
              {setoresDisponiveis.map(setor => <option key={`setor-${setor}`} value={setor}>{setor}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ================================================================
          TABELA (LINHA SLIM PRIORIZANDO O CAMPO)
      ================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Grid pensado para mobile: Campo amassa o resto pra direita, sem quebrar linha */}
        <div className="grid grid-cols-[25px_22px_1fr_40px_40px_40px] md:grid-cols-[30px_30px_1fr_55px_55px_55px] gap-2 md:gap-3 items-center px-4 py-2.5 bg-slate-50 border-b border-slate-100">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-left">Ano</span>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-left">Av</span>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-left">Campo</span>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">CUC</span>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">L/h</span>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Ent.</span>
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
            filteredAndSortedData.map((item, index) => (
              <button 
                key={`${item.codigo_campo}-${item.avaliacao}-${item.ano}-${index}`}
                onClick={() => setSelectedModalItem(item)}
                className="grid grid-cols-[25px_22px_1fr_40px_40px_40px] md:grid-cols-[30px_30px_1fr_55px_55px_55px] gap-2 md:gap-3 items-center px-4 py-2.5 border-b border-slate-100 last:border-0 hover:bg-slate-50/80 transition-colors w-full cursor-pointer group"
              >
                <span className="text-[8px] md:text-[9px] font-bold text-slate-400 text-left">{String(item.ano).slice(-2)}</span>
                <span className="text-[8px] md:text-[9px] font-bold text-slate-400 text-left">{item.avaliacao}º</span>
                <span className="text-[10px] md:text-[11px] font-black text-slate-700 uppercase group-hover:text-[var(--q-green)] transition-colors text-left truncate" title={item.campo}>
                  {item.campo}
                </span>
                
                <span className="text-[11px] md:text-[13px] font-black tracking-tighter text-center" style={{ color: getCucColor(item.cuc) }}>{formatValue(item.cuc)}%</span>
                <span className="text-[11px] md:text-[13px] font-black tracking-tighter text-center" style={{ color: getVazaoColor(item.vazao) }}>{formatValue(item.vazao)}</span>
                <span className="text-[11px] md:text-[13px] font-black tracking-tighter text-right" style={{ color: getEntupColor(item['entup%']) }}>{formatValue(item['entup%'])}%</span>
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