// ================================= DOCUMENTATION ------------------------------------------
// Script: CucDetailAvaliacoes
// Purpose: Visão hierárquica (Ano > Mês > Campo) com design moderno, identado e mobile-first.
// Relationships: vw_q_cucgeral
// ==========================================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabaseClient';

// ================================= HELPERS ------------------------------------------------

const MESES = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const formatInt = (value) => {
  const num = Number(value || 0);
  return num.toLocaleString('pt-BR');
};

// ================================= EXECUTOR -----------------------------------------------

const CucDetailAvaliacoes = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados para controlar o acordeão
  const [expandedYears, setExpandedYears] = useState(new Set());
  const [expandedMonths, setExpandedMonths] = useState(new Set());

  // 1. Busca os dados brutos da view
  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: res, error } = await supabase
          .from('vw_q_cucgeral')
          .select('ano, mes, campo, codigo_campo, avaliacao, total_lotes, emissores');
        
        if (error) throw error;
        if (mounted) setData(res || []);
      } catch (err) {
        console.error("Erro ao buscar dados para Avaliações:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchData();
    return () => { mounted = false; };
  }, []);

  // 2. Transforma a lista reta na Árvore Hierárquica
  const treeData = useMemo(() => {
    if (data.length === 0) return [];

    const tree = data.reduce((acc, row) => {
      const ano = row.ano || 'Sem Ano';
      const mesNum = row.mes || 0;
      
      if (!acc[ano]) {
        acc[ano] = { ano, totalCampos: 0, totalLotes: 0, totalEmissores: 0, meses: {} };
      }
      
      if (!acc[ano].meses[mesNum]) {
        acc[ano].meses[mesNum] = { mesNum, mesNome: MESES[mesNum] || 'Desconhecido', totalCampos: 0, avaliacoes: [] };
      }

      acc[ano].meses[mesNum].avaliacoes.push(row);
      acc[ano].meses[mesNum].totalCampos += 1;
      
      acc[ano].totalCampos += 1;
      acc[ano].totalLotes += Number(row.total_lotes) || 0;
      acc[ano].totalEmissores += Number(row.emissores) || 0;

      return acc;
    }, {});

    return Object.values(tree)
      .sort((a, b) => b.ano - a.ano)
      .map(anoObj => ({
        ...anoObj,
        meses: Object.values(anoObj.meses)
          .sort((a, b) => b.mesNum - a.mesNum)
          .map(mesObj => ({
            ...mesObj,
            avaliacoes: mesObj.avaliacoes.sort((a, b) => (a.campo || '').localeCompare(b.campo || ''))
          }))
      }));
  }, [data]);

  // 3. Controles do Acordeão
  const toggleYear = (ano) => {
    const next = new Set(expandedYears);
    if (next.has(ano)) next.delete(ano);
    else next.add(ano);
    setExpandedYears(next);
  };

  const toggleMonth = (anoMesKey) => {
    const next = new Set(expandedMonths);
    if (next.has(anoMesKey)) next.delete(anoMesKey);
    else next.add(anoMesKey);
    setExpandedMonths(next);
  };

  const toggleAll = () => {
    if (expandedYears.size > 0) {
      setExpandedYears(new Set());
      setExpandedMonths(new Set());
    } else {
      const allYears = new Set(treeData.map(y => y.ano));
      const allMonths = new Set();
      treeData.forEach(y => y.meses.forEach(m => allMonths.add(`${y.ano}-${m.mesNum}`)));
      setExpandedYears(allYears);
      setExpandedMonths(allMonths);
    }
  };

  // ================================= RENDER ===============================================

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 opacity-60">
        <div className="w-8 h-8 border-4 border-[var(--q-green)]/20 border-t-[var(--q-green)] rounded-full animate-spin mb-4" />
        <span className="text-[10px] font-bold text-[var(--q-green)] uppercase tracking-widest animate-pulse">
          Montando Estrutura...
        </span>
      </div>
    );
  }

  if (treeData.length === 0) {
    return (
      <div className="bg-white border border-slate-200 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-slate-400 mt-4">
        <span className="text-3xl mb-2">📁</span>
        <span className="text-xs font-bold uppercase tracking-widest">Nenhuma avaliação encontrada</span>
      </div>
    );
  }

  const isAllClosed = expandedYears.size === 0;

  return (
    <div className="flex flex-col gap-4 animate-in slide-in-from-right-4 duration-300">
      
      {/* Barra Superior */}
      <div className="flex justify-between items-end mb-2 px-1">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Volume Operacional</span>
          <span className="text-xs font-bold text-slate-500">Histórico de lotes e emissores</span>
        </div>
        
        <button 
          onClick={toggleAll}
          className="text-[9px] md:text-[10px] font-black text-[var(--q-green)] uppercase tracking-widest hover:text-[var(--q-green-dark)] transition-colors bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200"
        >
          {isAllClosed ? 'Expandir Tudo ▽' : 'Recolher Tudo △'}
        </button>
      </div>

      {/* Container Principal */}
      <div className="flex flex-col gap-3">
        {treeData.map((anoNode) => {
          const isYearOpen = expandedYears.has(anoNode.ano);
          
          return (
            <div key={`ano-${anoNode.ano}`} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-all">
              
              {/* === NÍVEL 1: ANO (CARD PRINCIPAL) === */}
              <div 
                onClick={() => toggleYear(anoNode.ano)} 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <span className={`qf-tree-icon text-[var(--q-green)] font-bold text-[14px] ${isYearOpen ? 'is-open' : ''}`}>▶</span>
                  <span className="text-base sm:text-lg font-black text-[var(--q-dark)]">{anoNode.ano}</span>
                </div>
                
                {/* AQUI ESTÁ A MÁGICA: `hidden` removido, e classes adaptativas (`text-[11px] sm:text-[13px]`) para não quebrar */}
                <div className="flex gap-2 sm:gap-4 md:gap-6 text-right shrink-0">
                  <div className="flex flex-col items-end justify-center">
                    <span className="text-[11px] sm:text-[13px] font-black text-[var(--q-dark)]">{formatInt(anoNode.totalCampos)}</span>
                    <span className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-widest">Campos</span>
                  </div>
                  <div className="flex flex-col items-end justify-center">
                    <span className="text-[11px] sm:text-[13px] font-black text-[var(--q-dark)]">{formatInt(anoNode.totalLotes)}</span>
                    <span className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-widest">Lotes</span>
                  </div>
                  <div className="flex flex-col items-end justify-center">
                    <span className="text-[11px] sm:text-[13px] font-black text-[var(--q-green)]">{formatInt(anoNode.totalEmissores)}</span>
                    <span className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-widest">Emissores</span>
                  </div>
                </div>
              </div>

              {/* CONTEÚDO DO ANO (MESES IDENTADOS) */}
              <div className={`qf-accordion-content ${isYearOpen ? 'is-open' : ''} bg-slate-50/50`}>
                <div className="qf-accordion-inner flex flex-col pb-2">
                  {anoNode.meses.map((mesNode) => {
                    const mesKey = `${anoNode.ano}-${mesNode.mesNum}`;
                    const isMonthOpen = expandedMonths.has(mesKey);

                    return (
                      <div key={mesKey} className="flex flex-col">
                        
                        {/* === NÍVEL 2: MÊS (IDENTAÇÃO CINZA) === */}
                        <div 
                          onClick={() => toggleMonth(mesKey)} 
                          className="flex items-center justify-between ml-3 mt-2 pl-3 py-2 border-l-2 border-slate-300 cursor-pointer hover:bg-slate-100/50 rounded-r-lg transition-colors group"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`qf-tree-icon text-slate-400 font-bold text-[10px] ${isMonthOpen ? 'is-open' : ''}`}>▶</span>
                            <span className="text-xs font-black text-slate-600 uppercase tracking-widest group-hover:text-[var(--q-dark)]">{mesNode.mesNome}</span>
                          </div>
                          <span className="text-[9px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200 mr-2 shadow-sm">
                            {mesNode.totalCampos} campos
                          </span>
                        </div>

                        {/* CONTEÚDO DO MÊS (CAMPOS IDENTADOS) */}
                        <div className={`qf-accordion-content ${isMonthOpen ? 'is-open' : ''}`}>
                          <div className="qf-accordion-inner flex flex-col pb-1">
                            {mesNode.avaliacoes.map((avNode, idx) => (
                              
                              /* === NÍVEL 3: CAMPOS (IDENTAÇÃO VERDE) === */
                              <div 
                                key={`av-${mesKey}-${idx}`} 
                                className="flex justify-between items-center ml-7 mt-1.5 pl-3 pr-4 py-2.5 border-l-[3px] border-[var(--q-green)] bg-white rounded-r-xl shadow-sm hover:translate-x-1 transition-transform"
                              >
                                <div className="flex flex-col truncate pr-2">
                                  <span className="text-[11px] font-black text-[var(--q-dark)] uppercase truncate">
                                    {avNode.campo || avNode.codigo_campo}
                                  </span>
                                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                    {avNode.avaliacao}ª Avaliação
                                  </span>
                                </div>

                                <div className="flex gap-3 sm:gap-4 shrink-0">
                                  <div className="flex flex-col items-end">
                                    <span className="text-[11px] font-black text-[var(--q-orange)]">
                                      {formatInt(avNode.total_lotes)}
                                    </span>
                                    <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">Lotes</span>
                                  </div>

                                  <div className="flex flex-col items-end min-w-[50px]">
                                    <span className="text-[11px] font-black text-[var(--q-green)]">
                                      {formatInt(avNode.emissores)}
                                    </span>
                                    <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">Emissores</span>
                                  </div>
                                </div>
                              </div>

                            ))}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CucDetailAvaliacoes;