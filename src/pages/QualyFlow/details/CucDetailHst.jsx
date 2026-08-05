// ================================= DOCUMENTATION ------------------------------------------
// Script: CucDetailHst
// Purpose: Exibe o histórico geral de CUC em formato de lista slim e permite filtragem.
// Relationships:
//   - vw_q_cucgeral
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

// -------------------------------------------------------------------------
// Cores equivalentes às classes do CardCUC para o estilo inline
// -------------------------------------------------------------------------
const getCucColor = (value) => {
  const cuc = Number(value);
  if (Number.isNaN(cuc)) return 'var(--coa-text-muted)';
  if (cuc >= 90) return '#22c55e';
  if (cuc >= 80) return '#f59e0b';
  return '#ef4444';
};

const getEntupColor = (value) => {
  const entup = Number(value);
  if (Number.isNaN(entup)) return 'var(--coa-text-muted)';
  if (entup <= 5) return '#22c55e';
  if (entup <= 10) return '#f59e0b';
  return '#ef4444';
};

const getVazaoColor = (value) => {
  const vazao = Number(value);
  if (Number.isNaN(vazao)) return 'var(--coa-text-muted)';
  if (vazao >= 0.9 && vazao <= 1.1) return '#22c55e';
  if (vazao >= 0.8 && vazao < 0.9) return '#f97316';
  if (vazao < 0.8) return '#ef4444';
  if (vazao > 1.1 && vazao <= 1.2) return '#f59e0b';
  return '#0ea5e9';
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

  const [selectedModalItem, setSelectedModalItem] = useState(null);

  const hasFilters = searchCampo !== '' || 
                     filtroAno !== 'Todos' || 
                     filtroAvaliacao !== 'Todos' || 
                     filtroDepa !== 'Todos' || 
                     filtroSetor !== 'Todos';

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
  
  const setoresDisponiveis = [...new Set(
    historicoData
      .filter(d => filtroDepa === 'Todos' || d.depa === filtroDepa)
      .map(d => d.setor)
      .filter(Boolean)
  )].sort();

  // =========================================================================
  // APLICAÇÃO DOS FILTROS (EM TEMPO REAL)
  // =========================================================================
  const filteredAndSortedData = historicoData
    .filter(item => {
      const termo = searchCampo.toLowerCase().trim();
      const campoStr = String(item.campo || '').toLowerCase();
      const codigoStr = String(item.codigo_campo || '').toLowerCase();
      
      // O campo de busca continua pesquisando pelo código, mesmo que ele não apareça na lista!
      const matchCampo = termo === '' || campoStr.includes(termo) || codigoStr.includes(termo);
      const matchAno = filtroAno === 'Todos' || String(item.ano) === String(filtroAno);
      const matchAv = filtroAvaliacao === 'Todos' || String(item.avaliacao) === String(filtroAvaliacao);
      const matchDepa = filtroDepa === 'Todos' || String(item.depa) === String(filtroDepa);
      const matchSetor = filtroSetor === 'Todos' || String(item.setor) === String(filtroSetor);

      return matchCampo && matchAno && matchAv && matchDepa && matchSetor;
    })
    .sort((a, b) => parseDate(b.dt_final) - parseDate(a.dt_final));

  const limparFiltros = () => {
    setSearchCampo('');
    setFiltroAno('Todos');
    setFiltroAvaliacao('Todos');
    setFiltroDepa('Todos');
    setFiltroSetor('Todos');
  };

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <div className="flex flex-col gap-4 animate-in slide-in-from-right-4 duration-300">
      
      {/* ================================================================
          PAINEL DE FILTROS
      ================================================================= */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
        <div className="flex w-full gap-2 items-end">
          <div className="flex-1 flex flex-col transition-all duration-300">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">
              Campo
            </label>
            <input 
              type="text" 
              placeholder="Procurar"
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
            <select 
              value={filtroAno}
              onChange={(e) => setFiltroAno(e.target.value)}
              className="w-full h-[38px] bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs font-bold text-[var(--q-dark)] outline-none focus:border-[var(--q-green)] cursor-pointer shadow-inner"
            >
              <option value="Todos">Todos</option>
              {anosUnicos.map(ano => <option key={`ano-${ano}`} value={ano}>{ano}</option>)}
            </select>
          </div>
          
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Avaliação</label>
            <select 
              value={filtroAvaliacao}
              onChange={(e) => setFiltroAvaliacao(e.target.value)}
              className="w-full h-[38px] bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs font-bold text-[var(--q-dark)] outline-none focus:border-[var(--q-green)] cursor-pointer shadow-inner"
            >
              <option value="Todos">Todas</option>
              {avaliacoesUnicas.map(av => <option key={`av-${av}`} value={av}>{av}ª Avaliação</option>)}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">DEPA</label>
            <select 
              value={filtroDepa}
              onChange={(e) => {
                setFiltroDepa(e.target.value);
                setFiltroSetor('Todos'); 
              }}
              className="w-full h-[38px] bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs font-bold text-[var(--q-dark)] outline-none focus:border-[var(--q-green)] cursor-pointer shadow-inner"
            >
              <option value="Todos">Todos</option>
              {depasUnicos.map(depa => <option key={`depa-${depa}`} value={depa}>{depa}</option>)}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Setor</label>
            <select 
              value={filtroSetor}
              onChange={(e) => setFiltroSetor(e.target.value)}
              className="w-full h-[38px] bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs font-bold text-[var(--q-dark)] outline-none focus:border-[var(--q-green)] cursor-pointer shadow-inner"
            >
              <option value="Todos">Todos</option>
              {setoresDisponiveis.map(setor => <option key={`setor-${setor}`} value={setor}>{setor}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ================================================================
          TABELA (LINHA SLIM COM MAIS RESPIRO)
      ================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* 
          Ajuste do Grid:
          - 28px para o Ano
          - 24px para a Avaliação
          - 1fr (todo o espaço restante) para o Campo
          - 55px (fixos e à direita) para os 3 indicadores 
          - gap-3 para dar uma leve distância entre as colunas
        */}
        <div className="grid grid-cols-[28px_24px_1fr_55px_55px_55px] gap-3 items-center px-4 py-2.5 bg-slate-50 border-b border-slate-100">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-left">Ano</span>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-left">Avº</span>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-left">Campo</span>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">CUC</span>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">L/h</span>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Entup.</span>
        </div>

        {/* Corpo da Lista */}
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
                className="grid grid-cols-[28px_24px_1fr_55px_55px_55px] gap-3 items-center px-4 py-2 border-b border-slate-100 last:border-0 hover:bg-slate-50/80 transition-colors w-full cursor-pointer group"
              >
                {/* 1. Ano */}
                <span className="text-[9px] font-bold text-slate-400 text-left">
                  {item.ano}
                </span>

                {/* 2. Avº */}
                <span className="text-[9px] font-bold text-slate-400 text-left">
                  {item.avaliacao}º
                </span>

                {/* 3. Campo (Sem código visualmente, mas ocupando o espaço livre) */}
                <span 
                  className="text-[11px] font-black text-slate-700 uppercase group-hover:text-[var(--q-green)] transition-colors text-left truncate" 
                  title={item.campo}
                >
                  {item.campo}
                </span>
                
                {/* 4. CUC */}
                <span className="text-[13px] font-black tracking-tighter text-center" style={{ color: getCucColor(item.cuc) }}>
                  {formatValue(item.cuc)}%
                </span>
                
                {/* 5. Vazão (L/h) */}
                <span className="text-[13px] font-black tracking-tighter text-center" style={{ color: getVazaoColor(item.vazao) }}>
                  {formatValue(item.vazao)}
                </span>
                
                {/* 6. Entupidos */}
                <span className="text-[13px] font-black tracking-tighter text-right" style={{ color: getEntupColor(item['entup%']) }}>
                  {formatValue(item['entup%'])}%
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