// ================================= DOCUMENTATION ------------------------------------------
// Script: PerdaMecDetailRank
// Purpose: Pódio e Ranking de Colhedoras por turno e safra (Foco em Perdas).
// Relationships: vw_q_perdamec_colhedora, vw_q_perdamec_ano, rulesPerdaMec
// ==========================================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import YearSelectorQualyFlow from '../../../components/QualyFlow/YearSelectorQualyFlow';
import { getMetasParaData, getStatusColor } from '../../../components/QualyFlow/rulesPerdaMec';
import PerdaMecDetailRankEquip from './PerdaMecDetailRankEquip';

import imgOuro from '../../../gallery/logo/medalha-de-ouro.png';
import imgPrata from '../../../gallery/logo/medalha-de-prata.png';
import imgBronze from '../../../gallery/logo/medalha-de-bronze.png';

// ================================= CONFIGURAÇÕES ------------------------------------------
const START_LIST_AT_INDEX = 3; // 0 = Inicia no 1º; 3 = Inicia no 4º lugar

// ================================= HELPERS ------------------------------------------------

const formatValue = (value, decimals = 2) => {
  if (value === null || value === undefined || value === '') return '-';
  const number = Number(value);
  return Number.isNaN(number) ? '-' : number.toFixed(decimals).replace('.', ',');
};

const parseColhedora = (fullName) => {
  if (!fullName) return { shortName: 'DESC' };
  return { shortName: fullName.split(' - ')[0].trim() };
};

const CompareTriangle = ({ valDia, valAno }) => {
  if (valDia === null || valAno === null) return <span className="w-4 text-[10px] text-slate-300 font-bold text-center">-</span>;
  const diff = valDia - valAno;
  if (Math.abs(diff) < 0.01) return <span className="w-4 text-[10px] text-slate-300 font-bold text-center">-</span>;
  if (diff < 0) return <span className="w-4 font-black text-center text-[var(--q-green)] text-[10px]">▼</span>;
  return <span className="w-4 font-black text-center text-[var(--q-danger)] text-[10px]">▲</span>;
};

// ================================= EXECUTOR PRINCIPAL -------------------------------------

const PerdaMecDetailRank = () => {
  
  const [activeYear, setActiveYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [rawDataColh, setRawDataColh] = useState([]);
  const [globalAnoData, setGlobalAnoData] = useState(null);
  
  const [viewMode, setViewMode] = useState('1º Turno'); 
  const [selectedMachineToView, setSelectedMachineToView] = useState(null);
  const [highlightedColhedora, setHighlightedColhedora] = useState(null);
  const [mobileKpi, setMobileKpi] = useState('perda'); // Controle do KPI na lista compacta (celular)

  const metas = useMemo(() => getMetasParaData(`${activeYear}-12-31`) || {}, [activeYear]);

  // 1. Busca Anos Disponíveis
  useEffect(() => {
    let mounted = true;
    const fetchYears = async () => {
      try {
        const { data } = await supabase.from('vw_q_perdamec_ano').select('ano');
        if (mounted && data) {
          const uniqueYears = [...new Set(data.map(r => r.ano))].sort((a,b) => b - a);
          setAvailableYears(uniqueYears);
          if (uniqueYears.length > 0 && !uniqueYears.includes(activeYear)) setActiveYear(uniqueYears[0]);
        }
      } catch (err) { console.error(err); }
    };
    fetchYears();
    return () => { mounted = false; };
  }, [activeYear]);

  // 2. Busca Dados
  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      if (!activeYear) return;
      setLoading(true);
      
      try {
        const [resColh, resAno] = await Promise.all([
          supabase.from('vw_q_perdamec_colhedora').select('*').eq('ano', activeYear),
          supabase.from('vw_q_perdamec_ano').select('*').eq('ano', activeYear).single()
        ]);
        
        if (mounted) {
          setRawDataColh(resColh.data || []);
          setGlobalAnoData(resAno.data || null);
        }
      } catch (err) { 
        console.error(err); 
      } finally { 
        if (mounted) setLoading(false); 
      }
    };
    loadData();
    return () => { mounted = false; };
  }, [activeYear]);

  // 3. Processamento
  const processamento = useMemo(() => {
    
    // KPIs Globais baseados na vw_q_perdamec_ano
    const kpisGlobais = {
      perda: globalAnoData ? Number(globalAnoData.perda_perc) : null,
      pSimples: globalAnoData ? Number(globalAnoData.pisoteio_simples_perc) : null,
      pDuplo: globalAnoData ? Number(globalAnoData.pisoteio_duplo_perc) : null,
      arranquio: globalAnoData ? Number(globalAnoData.arranquio_perc) : null,
    };

    if (!rawDataColh || rawDataColh.length === 0) {
      return { rankT1: [], rankT2: [], kpisGlobais };
    }
    
    const buildRank = (turno) => {
      return rawDataColh
        .filter(r => r.turno === turno)
        .map(r => {
          const per = Number(r.perda_perc);
          // Cálculo raiz dos pisoteios
          const avS = Number(r.av_pisoteio_simples) || 0;
          const mtS = Number(r.mt_pisoteio_simples) || 0;
          const calcPisotSimp = avS > 0 ? (mtS / avS) * 100 : null;

          const avD = Number(r.av_pisoteio_duplo) || 0;
          const mtD = Number(r.mt_pisoteio_duplo) || 0;
          const calcPisotDup = avD > 0 ? (mtD / avD) * 100 : null;

          return {
            ...r,
            calcPerda: per,
            calcTch: Number(r.tch_estimado),
            calcPisotSimp,
            calcPisotDup,
            calcArr: Number(r.arranquio_perc),
            mediaKg: Number(r.total_perda),
            pontos: Number(r.qnt_pontos || 0)
          };
        })
        .sort((a, b) => a.calcPerda - b.calcPerda);
    };

    return { rankT1: buildRank('1º Turno'), rankT2: buildRank('2º Turno'), kpisGlobais };
  }, [rawDataColh, globalAnoData]);

  // ================================= RENDERIZADORES COMPONENTIZADOS =========================

  const renderTopKpiRow = (label, val, meta) => (
    <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-center items-center shadow-sm">
      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">{label}</span>
      <span className="text-xl font-black mt-1" style={{ color: getStatusColor(val, meta) }}>
        {val !== null && !isNaN(val) ? `${formatValue(val)}%` : '-'}
      </span>
    </div>
  );

  const SubKpiRow = ({ label, val, refGlobal, meta }) => (
    <div className="flex justify-between items-center border-b border-white/40 pb-1.5 last:border-0 last:pb-0">
      <span className="text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
      <div className="flex items-center gap-3">
        <CompareTriangle valDia={val} valAno={refGlobal} />
        <span className="text-[12px] md:text-[13px] font-black" style={{ color: getStatusColor(val, meta) }}>
          {val !== null ? `${formatValue(val)}%` : '-'}
        </span>
      </div>
    </div>
  );

  const renderPodiumCard = (rankData, place) => {
    if (!rankData) return null;
    const { shortName } = parseColhedora(rankData.colhedora);

    let podClass = ""; let medalImg = null; let textColor = ""; let scaleClass = "";
    
    if (place === 1) {
      podClass = "qf-podium-1"; medalImg = imgOuro; textColor = "text-yellow-600";
    } else if (place === 2) {
      podClass = "qf-podium-2"; medalImg = imgPrata; textColor = "text-slate-500"; scaleClass = "md:scale-95 origin-bottom";
    } else if (place === 3) {
      podClass = "qf-podium-3"; medalImg = imgBronze; textColor = "text-orange-600"; scaleClass = "md:scale-95 origin-bottom";
    }

    return (
      <div 
        onClick={() => setSelectedMachineToView(rankData)}
        className={`${podClass} rounded-2xl p-4 md:p-5 flex flex-col justify-between shadow-lg cursor-pointer hover:shadow-xl transition-all ${scaleClass} h-full`}
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-col">
            <span className={`text-4xl md:text-5xl font-black ${textColor} leading-none mb-1 drop-shadow-sm`}>#{place}</span>
            <span className="text-xl md:text-2xl font-black text-[var(--q-dark)] uppercase leading-none tracking-tight">{shortName}</span>
          </div>
          {medalImg && <img src={medalImg} alt={`${place}º Lugar`} className="w-12 h-12 md:w-14 md:h-14 object-contain drop-shadow-md" />}
        </div>

        <div className="flex gap-2 mb-4 bg-white/50 backdrop-blur-sm p-2 rounded-xl border border-white/60">
          <div className="flex-1 flex flex-col items-center border-r border-slate-200/50">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Média TCH</span>
            <span className="text-sm font-black text-slate-700">{formatValue(rankData.calcTch, 1)}</span>
          </div>
          <div className="flex-1 flex flex-col items-center border-r border-slate-200/50">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Média Kg</span>
            <span className="text-sm font-black text-slate-700">{formatValue(rankData.mediaKg)}</span>
          </div>
          <div className="flex-1 flex flex-col items-center">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pontos</span>
            <span className="text-sm font-black text-[var(--q-dark)]">{rankData.pontos}</span>
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-md rounded-xl p-3 flex flex-col gap-2 shadow-inner border border-white/60">
          <SubKpiRow label="Perda" val={rankData.calcPerda} refGlobal={processamento.kpisGlobais.perda} meta={metas.perda} />
          <SubKpiRow label="P. Simples" val={rankData.calcPisotSimp} refGlobal={processamento.kpisGlobais.pSimples} meta={metas.pisoteio_simples} />
          <SubKpiRow label="P. Duplo" val={rankData.calcPisotDup} refGlobal={processamento.kpisGlobais.pDuplo} meta={metas.pisoteio_duplo} />
          <SubKpiRow label="Arranquio" val={rankData.calcArr} refGlobal={processamento.kpisGlobais.arranquio} meta={metas.arranquio} />
        </div>
      </div>
    );
  };

  const renderCompactList = (rankArray) => {
    if (!rankArray) return null;
    const listToRender = rankArray.slice(START_LIST_AT_INDEX);
    if (listToRender.length === 0) return null;

    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col mt-4">
        
        {/* Toggle de KPIs só aparece no Celular */}
        <div className="md:hidden flex w-full bg-slate-100 p-1 border-b border-slate-200">
          {['perda', 'simp', 'dup', 'arr'].map(kpiKey => {
            const labels = { perda: 'Perda', simp: 'Simples', dup: 'Duplo', arr: 'Arranquio' };
            return (
              <button
                key={kpiKey}
                onClick={() => setMobileKpi(kpiKey)}
                className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                  mobileKpi === kpiKey ? 'bg-[var(--q-green)] text-white shadow-sm' : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                {labels[kpiKey]}
              </button>
            );
          })}
        </div>

        {/* Cabeçalho da Lista */}
        <div className="grid grid-cols-[25px_1fr_40px_45px_45px_50px] md:grid-cols-[25px_1fr_40px_45px_45px_45px_45px_45px_45px] gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100 cursor-default items-center">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">#</span>
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Colhedora</span>
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center">Pts</span>
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center">TCH</span>
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center">Md.Kg</span>
          
          {/* Coluna Dinâmica no Mobile */}
          <span className="md:hidden text-[8px] font-black uppercase tracking-widest text-[var(--q-dark)] text-right">Valor</span>
          
          {/* Colunas Fixas no Desktop */}
          <span className="hidden md:block text-[8px] font-black uppercase tracking-widest text-[var(--q-dark)] text-center">Perda</span>
          <span className="hidden md:block text-[8px] font-black uppercase tracking-widest text-slate-400 text-center">Simples</span>
          <span className="hidden md:block text-[8px] font-black uppercase tracking-widest text-slate-400 text-center">Duplo</span>
          <span className="hidden md:block text-[8px] font-black uppercase tracking-widest text-slate-400 text-right">Arran.</span>
        </div>

        <div className="flex flex-col overflow-y-auto custom-scrollbar p-1">
          {listToRender.map((r, idx) => {
            const actualPos = START_LIST_AT_INDEX + idx + 1;
            
            // Resolve o valor dinâmico para o mobile
            let mVal = '-'; let mColor = ''; let mTriangle = null;
            if (mobileKpi === 'perda') { mVal = formatValue(r.calcPerda); mColor = getStatusColor(r.calcPerda, metas?.perda); mTriangle = <CompareTriangle valDia={r.calcPerda} valAno={processamento.kpisGlobais.perda} />; }
            if (mobileKpi === 'simp') { mVal = r.calcPisotSimp !== null ? formatValue(r.calcPisotSimp) : '-'; mColor = getStatusColor(r.calcPisotSimp, metas?.pisoteio_simples); mTriangle = <CompareTriangle valDia={r.calcPisotSimp} valAno={processamento.kpisGlobais.pSimples} />; }
            if (mobileKpi === 'dup') { mVal = r.calcPisotDup !== null ? formatValue(r.calcPisotDup) : '-'; mColor = getStatusColor(r.calcPisotDup, metas?.pisoteio_duplo); mTriangle = <CompareTriangle valDia={r.calcPisotDup} valAno={processamento.kpisGlobais.pDuplo} />; }
            if (mobileKpi === 'arr') { mVal = formatValue(r.calcArr); mColor = getStatusColor(r.calcArr, metas?.arranquio); mTriangle = <CompareTriangle valDia={r.calcArr} valAno={processamento.kpisGlobais.arranquio} />; }

            return (
              <div 
                key={r.colhedora} 
                onClick={() => setSelectedMachineToView(r)}
                className="grid grid-cols-[25px_1fr_40px_45px_45px_50px] md:grid-cols-[25px_1fr_40px_45px_45px_45px_45px_45px_45px] gap-2 px-2 py-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-50 last:border-0 items-center group"
              >
                <span className="text-[11px] font-black text-slate-400 text-center">{actualPos}º</span>
                <span className="text-[12px] font-black text-slate-700 truncate group-hover:text-[var(--q-green)]">{parseColhedora(r.colhedora).shortName}</span>
                <span className="text-[10px] font-black text-[var(--q-dark)] text-center bg-slate-100 rounded px-1">{r.pontos}</span>
                <span className="text-[10px] font-bold text-slate-500 text-center">{formatValue(r.calcTch, 0)}</span>
                <span className="text-[10px] font-bold text-slate-500 text-center">{formatValue(r.mediaKg, 1)}</span>
                
                {/* Mobile Dynamic Cell */}
                <div className="md:hidden flex items-center justify-end gap-1">
                  {mTriangle}
                  <span className="text-[11px] font-black text-right" style={{ color: mColor }}>{mVal !== '-' ? `${mVal}%` : '-'}</span>
                </div>
                
                {/* Desktop Cells */}
                <div className="hidden md:flex items-center justify-center gap-1">
                  <CompareTriangle valDia={r.calcPerda} valAno={processamento.kpisGlobais.perda} />
                  <span className="text-[11px] font-black text-center" style={{ color: getStatusColor(r.calcPerda, metas?.perda) }}>{formatValue(r.calcPerda)}%</span>
                </div>
                
                <span className="hidden md:block text-[10px] font-black text-center text-slate-400">{r.calcPisotSimp !== null ? `${formatValue(r.calcPisotSimp)}%` : '-'}</span>
                <span className="hidden md:block text-[10px] font-black text-center text-slate-400">{r.calcPisotDup !== null ? `${formatValue(r.calcPisotDup)}%` : '-'}</span>
                <span className="hidden md:block text-[11px] font-black text-right" style={{ color: getStatusColor(r.calcArr, metas?.arranquio) }}>{formatValue(r.calcArr)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderOtherShiftMiniCards = (rankArray, shiftName) => {
    if (!rankArray) return null;
    const top3 = rankArray.slice(0, 3);
    if (top3.length === 0) return null;

    const isT1 = shiftName.includes('1º');
    const colorClasses = isT1 
      ? 'bg-yellow-50 border-yellow-300 text-yellow-800' 
      : 'bg-blue-50 border-blue-300 text-blue-800';

    return (
      <div className="mt-12 pt-8 border-t-2 border-slate-200 border-dashed relative">
        
        <div className="flex justify-between items-end mb-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resumo Outro Turno</span>
            <h2 className="text-xl font-black text-[var(--q-dark)] uppercase tracking-tighter">Top 3 - <span className={isT1 ? 'text-yellow-500' : 'text-blue-500'}>{shiftName}</span></h2>
          </div>
          <button 
            onClick={() => { setViewMode(shiftName); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="text-[10px] font-black uppercase tracking-widest text-[var(--q-green)] hover:text-[var(--q-green-dark)] bg-[var(--q-green-soft)] px-3 py-1.5 rounded-lg transition-colors"
          >
            Ver Todos
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {top3.map((r, idx) => {
            const { shortName } = parseColhedora(r.colhedora);
            const medals = [imgOuro, imgPrata, imgBronze];
            return (
              <div 
                key={idx} 
                onClick={() => setSelectedMachineToView(r)}
                className={`flex justify-between items-center p-4 rounded-xl border-2 cursor-pointer shadow-sm hover:shadow-md transition-all ${colorClasses}`}
              >
                <div className="flex items-center gap-3">
                  <img src={medals[idx]} alt="Medalha" className="w-8 h-8 object-contain drop-shadow" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black opacity-70 uppercase tracking-widest mb-0.5">{idx + 1}º Lugar</span>
                    <span className="text-base font-black uppercase leading-none">{shortName}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[14px] font-black" style={{ color: getStatusColor(r.calcPerda, metas?.perda) }}>{formatValue(r.calcPerda)}%</span>
                  <span className="text-[9px] font-black opacity-60 uppercase tracking-widest">Perda</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderComparativo = () => {
    const allMachines = [...new Set(rawDataColh.map(r => r.colhedora))].sort();

    const mapT1 = new Map((processamento?.rankT1 || []).map((r, i) => [r.colhedora, { ...r, pos: i + 1 }]));
    const mapT2 = new Map((processamento?.rankT2 || []).map((r, i) => [r.colhedora, { ...r, pos: i + 1 }]));

    const buildCompareList = (turnoMap) => {
      const inShift = Array.from(turnoMap.values()).sort((a, b) => a.pos - b.pos);
      const notInShift = allMachines
        .filter(m => !turnoMap.has(m))
        .map(m => ({ colhedora: m, pos: null, calcPerda: null }));
      return [...inShift, ...notInShift];
    };

    const renderList = (listData, title, bgHeader) => (
      <div className="flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex-1">
        <div className={`py-4 border-b border-slate-200 shadow-sm z-10 ${bgHeader}`}>
          <span className="text-[14px] font-black text-white uppercase tracking-widest block text-center">{title}</span>
        </div>
        
        <div className="flex flex-col overflow-y-auto custom-scrollbar p-2 pb-4">
          {listData.map((r) => {
            const isMissing = r.pos === null;
            const isHighlighted = highlightedColhedora === r.colhedora;
            
            return (
              <div 
                key={r.colhedora} 
                onClick={() => setHighlightedColhedora(isHighlighted ? null : r.colhedora)}
                className={`flex flex-col p-3 rounded-xl cursor-pointer transition-all border-b border-slate-100 last:border-0 mb-1
                  ${isMissing ? 'opacity-40 grayscale' : ''}
                  ${isHighlighted ? 'qf-compare-highlight' : 'hover:bg-slate-50'}
                `}
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-end gap-2">
                    <span className="text-xl font-black opacity-80 leading-none">{r.pos ? `${r.pos}º` : '-'}</span>
                    <span className="text-[11px] font-black uppercase tracking-widest leading-none pb-0.5">{parseColhedora(r.colhedora).shortName}</span>
                  </div>
                  
                  {isHighlighted && r.pos && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setSelectedMachineToView(r); }}
                      className="bg-white/20 hover:bg-white text-white hover:text-[var(--q-dark)] px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest transition-colors shadow-sm"
                    >
                      {`{ ... }`}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-70">Perda:</span>
                  <span className="text-[13px] font-black" style={{ color: !isMissing && !isHighlighted ? getStatusColor(r.calcPerda, metas?.perda) : undefined }}>
                    {r.calcPerda !== null ? `${formatValue(r.calcPerda)}%` : '-'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );

    return (
      <div className="flex gap-3 w-full animate-in fade-in duration-300 items-stretch min-h-[600px]">
        {renderList(buildCompareList(mapT1), '1º Turno', 'bg-yellow-500')}
        {renderList(buildCompareList(mapT2), '2º Turno', 'bg-blue-500')}
      </div>
    );
  };

  // ================================= VIEW DA PÁGINA =======================================

  const activeRankData = viewMode === '1º Turno' ? processamento?.rankT1 : processamento?.rankT2;
  const otherShiftName = viewMode === '1º Turno' ? '2º Turno' : '1º Turno';
  const otherShiftData = viewMode === '1º Turno' ? processamento?.rankT2 : processamento?.rankT1;

  return (
    <div className="flex flex-col gap-6 w-full animate-in slide-in-from-bottom-4 duration-500 pb-10">
      
      {/* HEADER APENAS SELETOR */}
      <div className="flex flex-col items-center">
        <YearSelectorQualyFlow
          value={activeYear}
          onChange={setActiveYear}
          availableYears={availableYears}
          isLoading={loading}
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 mt-4">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Carregando Safra...</span>
        </div>
      ) : rawDataColh.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white border border-dashed border-slate-200 rounded-xl mt-4 shadow-sm">
          <span className="text-4xl opacity-40 mb-4 grayscale">🏆</span>
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Nenhum dado nesta safra</h3>
        </div>
      ) : (
        <div className="flex flex-col gap-5 mt-2">
          
          {/* CARDS GLOBAIS DA SAFRA (SÓ VW ANO) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {renderTopKpiRow("Média Perdas", processamento?.kpisGlobais?.perda, metas?.perda)}
            {renderTopKpiRow("P. Simples", processamento?.kpisGlobais?.pSimples, metas?.pisoteio_simples)} 
            {renderTopKpiRow("P. Duplo", processamento?.kpisGlobais?.pDuplo, metas?.pisoteio_duplo)}
            {renderTopKpiRow("Arranquio", processamento?.kpisGlobais?.arranquio, metas?.arranquio)}
          </div>

          {/* SELETOR DE MODO (TURNOS / COMPARATIVO) */}
          <div className="flex w-full bg-slate-200/50 p-1 rounded-xl shadow-inner mt-4 border border-slate-200/60">
            {['1º Turno', '2º Turno', 'Comparativo'].map(t => (
              <button
                key={t}
                onClick={() => { setViewMode(t); setHighlightedColhedora(null); }}
                className={`flex-1 py-3 text-[10px] md:text-[11px] font-black uppercase tracking-widest rounded-lg transition-all ${
                  viewMode === t 
                    ? 'bg-[var(--q-green)] text-white shadow-md' 
                    : 'text-slate-500 hover:bg-white hover:text-slate-800'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* RENDERIZAÇÃO CONDICIONAL */}
          {viewMode === 'Comparativo' ? (
            renderComparativo()
          ) : (
            <div className="flex flex-col animate-in fade-in duration-300">
              
              {activeRankData && activeRankData.length > 0 ? (
                <>
                  <div className="mb-4">{renderPodiumCard(activeRankData[0], 1)}</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeRankData.length > 1 && renderPodiumCard(activeRankData[1], 2)}
                    {activeRankData.length > 2 && renderPodiumCard(activeRankData[2], 3)}
                  </div>
                  {renderCompactList(activeRankData)}
                  {renderOtherShiftMiniCards(otherShiftData, otherShiftName)}
                </>
              ) : (
                <div className="py-10 text-center text-xs font-bold text-slate-400 uppercase tracking-widest border border-dashed border-slate-200 rounded-xl mt-4">
                  Sem dados para este turno
                </div>
              )}

            </div>
          )}
        </div>
      )}

      {/* MODAL HISTÓRICO DA COLHEDORA */}
      <PerdaMecDetailRankEquip 
        colhedora={selectedMachineToView ? parseColhedora(selectedMachineToView.colhedora) : null}
        ano={activeYear}
        onClose={() => setSelectedMachineToView(null)}
      />

    </div>
  );
};

export default PerdaMecDetailRank;