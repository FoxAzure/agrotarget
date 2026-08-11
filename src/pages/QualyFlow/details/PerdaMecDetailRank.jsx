// ================================= DOCUMENTATION ------------------------------------------
// Script: PerdaMecDetailRank
// Purpose: Pódio e Ranking de Colhedoras por turno e safra (Foco em Perdas).
// Relationships: vw_q_perdamec_colhedora, vw_q_perdamec_ano, rulesPerdaMec
// ==========================================================================================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import YearSelectorQualyFlow from '../../../components/QualyFlow/YearSelectorQualyFlow';
import { getMetasParaData, getStatusColor } from '../../../components/QualyFlow/rulesPerdaMec';
import PerdaMecDetailRankEquip from './PerdaMecDetailRankEquip';

// IMPORTAÇÕES DO RECHARTS
import { ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList } from 'recharts';

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

const getMedalEmoji = (pos) => pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : `${pos}º`;

const CompareTriangle = ({ valDia, valAno }) => {
  if (valDia === null || valAno === null) return <span className="w-4 inline-block text-[10px] text-slate-300 font-bold text-center">-</span>;
  const diff = valDia - valAno;
  
  if (Math.abs(diff) < 0.01) return <span className="w-4 inline-block text-[10px] text-slate-300 font-bold text-center">-</span>;
  if (diff < 0) return <span className="w-4 inline-block qf-anim-triangle-down font-black text-center text-[10px] text-[var(--q-green)]">▼</span>;
  return <span className="w-4 inline-block qf-anim-triangle-up font-black text-center text-[10px] text-[var(--q-danger)]">▲</span>;
};

// Ícones de medalha ou posição para a Tabela Minimalista
const getMedalIcon = (pos, isSelected) => {
  if (pos === 1) return <img src={imgOuro} alt="1º" className="w-5 h-5 drop-shadow-sm mx-auto" />;
  if (pos === 2) return <img src={imgPrata} alt="2º" className="w-5 h-5 drop-shadow-sm mx-auto" />;
  if (pos === 3) return <img src={imgBronze} alt="3º" className="w-5 h-5 drop-shadow-sm mx-auto" />;
  return <span className={`text-[12px] font-black block text-center ${isSelected ? 'text-[var(--q-dark)]' : 'text-slate-400'}`}>{pos}º</span>;
};

// Eixo X do Gráfico - Ajustado para 10px 
const CustomXAxisTick = ({ x, y, payload }) => {
  const words = payload.value.split(' ');
  const line1 = words[0];
  const line2 = words.slice(1).join(' ');

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} textAnchor="middle" fill="#64748b" fontSize={10} fontWeight={900}>
        <tspan x={0} dy="14">{line1}</tspan>
        {line2 && <tspan x={0} dy="12">{line2}</tspan>}
      </text>
    </g>
  );
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
  const [mobileKpi, setMobileKpi] = useState('perda');

  const metas = useMemo(() => getMetasParaData(`${activeYear}-12-31`) || {}, [activeYear]);

  // Refs para sincronização de Scroll nos gráficos
  const chart1ScrollRef = useRef(null);
  const chart2ScrollRef = useRef(null);

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

  // 4. Efeito para Auto-Scroll dos Gráficos Comparativos
  useEffect(() => {
    if (viewMode === 'Comparativo' && highlightedColhedora) {
      const t1Idx = processamento?.rankT1.findIndex(r => r.colhedora === highlightedColhedora) ?? -1;
      const t2Idx = processamento?.rankT2.findIndex(r => r.colhedora === highlightedColhedora) ?? -1;

      const scrollToCenter = (ref, idx) => {
        if (ref.current && idx !== -1) {
          const itemWidth = 50; // barSize + margins
          const xPos = (idx * itemWidth) + (itemWidth / 2) - (ref.current.clientWidth / 2);
          ref.current.scrollTo({ left: Math.max(0, xPos), behavior: 'smooth' });
        }
      };

      scrollToCenter(chart1ScrollRef, t1Idx);
      scrollToCenter(chart2ScrollRef, t2Idx);
    }
  }, [highlightedColhedora, viewMode, processamento]);

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
      <div className="flex items-center justify-end gap-1 min-w-[70px]">
        <div className="w-4 flex justify-center">
          <CompareTriangle valDia={val} valAno={refGlobal} />
        </div>
        <span className="w-10 text-right text-[12px] md:text-[13px] font-black" style={{ color: getStatusColor(val, meta) }}>
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

        <div className="grid grid-cols-[25px_1fr_40px_45px_45px_55px] md:grid-cols-[25px_1fr_40px_45px_45px_55px_45px_45px_45px] gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100 cursor-default items-center">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">#</span>
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Colhedora</span>
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center">Pts</span>
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center">TCH</span>
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center">Md.Kg</span>
          <span className="md:hidden text-[8px] font-black uppercase tracking-widest text-[var(--q-dark)] text-right">Valor</span>
          <span className="hidden md:block text-[8px] font-black uppercase tracking-widest text-[var(--q-dark)] text-right pr-2">Perda</span>
          <span className="hidden md:block text-[8px] font-black uppercase tracking-widest text-slate-400 text-center">Simples</span>
          <span className="hidden md:block text-[8px] font-black uppercase tracking-widest text-slate-400 text-center">Duplo</span>
          <span className="hidden md:block text-[8px] font-black uppercase tracking-widest text-slate-400 text-right">Arran.</span>
        </div>

        <div className="flex flex-col overflow-y-auto custom-scrollbar p-1">
          {listToRender.map((r, idx) => {
            const actualPos = START_LIST_AT_INDEX + idx + 1;
            
            let mVal = '-'; let mColor = ''; let mTriangle = null;
            if (mobileKpi === 'perda') { mVal = formatValue(r.calcPerda); mColor = getStatusColor(r.calcPerda, metas?.perda); mTriangle = <CompareTriangle valDia={r.calcPerda} valAno={processamento.kpisGlobais.perda} />; }
            if (mobileKpi === 'simp') { mVal = r.calcPisotSimp !== null ? formatValue(r.calcPisotSimp) : '-'; mColor = getStatusColor(r.calcPisotSimp, metas?.pisoteio_simples); mTriangle = <CompareTriangle valDia={r.calcPisotSimp} valAno={processamento.kpisGlobais.pSimples} />; }
            if (mobileKpi === 'dup') { mVal = r.calcPisotDup !== null ? formatValue(r.calcPisotDup) : '-'; mColor = getStatusColor(r.calcPisotDup, metas?.pisoteio_duplo); mTriangle = <CompareTriangle valDia={r.calcPisotDup} valAno={processamento.kpisGlobais.pDuplo} />; }
            if (mobileKpi === 'arr') { mVal = formatValue(r.calcArr); mColor = getStatusColor(r.calcArr, metas?.arranquio); mTriangle = <CompareTriangle valDia={r.calcArr} valAno={processamento.kpisGlobais.arranquio} />; }

            return (
              <div 
                key={r.colhedora} 
                onClick={() => setSelectedMachineToView(r)}
                className="grid grid-cols-[25px_1fr_40px_45px_45px_55px] md:grid-cols-[25px_1fr_40px_45px_45px_55px_45px_45px_45px] gap-2 px-2 py-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-50 last:border-0 items-center group"
              >
                <span className="text-[11px] font-black text-slate-400 text-center">{actualPos}º</span>
                <span className="text-[12px] font-black text-slate-700 truncate group-hover:text-[var(--q-green)]">{parseColhedora(r.colhedora).shortName}</span>
                <span className="text-[10px] font-black text-[var(--q-dark)] text-center bg-slate-100 rounded px-1">{r.pontos}</span>
                <span className="text-[10px] font-bold text-slate-500 text-center">{formatValue(r.calcTch, 0)}</span>
                <span className="text-[10px] font-bold text-slate-500 text-center">{formatValue(r.mediaKg, 1)}</span>
                
                <div className="md:hidden flex items-center justify-end gap-1">
                  <div className="w-3 flex justify-center">{mTriangle}</div>
                  <span className="w-9 text-[11px] font-black text-right" style={{ color: mColor }}>{mVal !== '-' ? `${mVal}%` : '-'}</span>
                </div>
                
                <div className="hidden md:flex items-center justify-end gap-1">
                  <div className="w-3 flex justify-center">
                    <CompareTriangle valDia={r.calcPerda} valAno={processamento.kpisGlobais.perda} />
                  </div>
                  <span className="w-9 text-[11px] font-black text-right" style={{ color: getStatusColor(r.calcPerda, metas?.perda) }}>{formatValue(r.calcPerda)}%</span>
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
            <h2 className="text-xl font-black text-[var(--q-dark)] uppercase tracking-tighter">Top 3 - <span className="text-slate-700">{shiftName}</span></h2>
          </div>
          <button 
            onClick={() => { setViewMode(shiftName); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="text-[10px] font-black uppercase tracking-widest text-[var(--q-green-dark)] bg-[var(--q-green-soft)] border border-[var(--q-green)] px-3 py-1.5 rounded-lg transition-colors hover:shadow-sm"
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
                className={`flex justify-between items-center p-4 rounded-xl border cursor-pointer shadow-sm hover:shadow-md transition-all ${colorClasses}`}
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

  // ================================= NOVO RENDER COMPARATIVO ================================

  const renderComparativoDashboard = () => {
    const rankT1 = processamento?.rankT1 || [];
    const rankT2 = processamento?.rankT2 || [];
    
    // Preparando os dados para os gráficos
    const chartDataT1 = rankT1.map((r, i) => ({
      ...r,
      nameStr: `${getMedalEmoji(i+1)} ${parseColhedora(r.colhedora).shortName}`,
      isHighlighted: highlightedColhedora === r.colhedora,
      pos: i + 1
    }));
    
    const chartDataT2 = rankT2.map((r, i) => ({
      ...r,
      nameStr: `${getMedalEmoji(i+1)} ${parseColhedora(r.colhedora).shortName}`,
      isHighlighted: highlightedColhedora === r.colhedora,
      pos: i + 1
    }));

    // Prepara a Tabela Limpa
    const maxLen = Math.max(rankT1.length, rankT2.length);
    const nodeRows = Array.from({ length: maxLen }, (_, i) => ({
      t1: rankT1[i] ? { ...rankT1[i], pos: i + 1, shortName: parseColhedora(rankT1[i].colhedora).shortName } : null,
      t2: rankT2[i] ? { ...rankT2[i], pos: i + 1, shortName: parseColhedora(rankT2[i].colhedora).shortName } : null,
    }));

    const renderChart = (title, chartData, scrollRef, isT1) => {
      const bgClass = isT1 ? 'bg-yellow-50' : 'bg-blue-50';
      const borderClass = isT1 ? 'border-yellow-200' : 'border-blue-200';
      const headerBgClass = isT1 ? 'bg-yellow-200/50' : 'bg-blue-200/50';
      const titleColor = isT1 ? 'text-yellow-800' : 'text-blue-800';

      return (
        <div className={`flex flex-col border rounded-xl overflow-hidden shadow-sm ${bgClass} ${borderClass}`}>
          {/* HUD Header Simples */}
          <div className={`py-3 shadow-sm z-10 border-b ${borderClass} ${headerBgClass}`}>
            <span className={`text-[13px] font-black uppercase tracking-widest block text-center ${titleColor}`}>{title}</span>
          </div>
          
          {/* Gráfico Scrollável */}
          <div className="w-full overflow-x-auto custom-scrollbar" ref={scrollRef}>
            <div style={{ minWidth: Math.max(100, chartData.length * 50) + 'px', height: '220px', padding: '10px 0' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 20, right: 10, left: 10, bottom: 25 }}>
                  <XAxis 
                    dataKey="nameStr" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={<CustomXAxisTick />} 
                    interval={0} 
                  />
                  <YAxis hide domain={[0, dataMax => dataMax * 1.2]} />
                  <ReferenceLine y={metas.perda} stroke="#22c55e" strokeDasharray="3 3" opacity={0.5} />
                  
                  <Bar 
                    dataKey="calcPerda" 
                    barSize={32} 
                    radius={[4, 4, 0, 0]}
                    onClick={(data) => setHighlightedColhedora(data.colhedora)} // Apenas acende o realce no gráfico
                    className="cursor-pointer transition-all"
                  >
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.calcPerda <= metas.perda ? 'var(--q-green)' : 'var(--q-danger)'}
                        fillOpacity={highlightedColhedora ? (entry.isHighlighted ? 1 : 0.3) : 1} 
                      />
                    ))}
                    <LabelList 
                      dataKey="calcPerda" 
                      position="top" 
                      formatter={(val) => formatValue(val)} 
                      style={{ fontSize: '10px', fontWeight: '900', fill: '#475569' }} 
                    />
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="flex flex-col gap-4 w-full animate-in fade-in duration-300">
        
        {/* GRÁFICOS */}
        {renderChart('1º Turno', chartDataT1, chart1ScrollRef, true)}
        {renderChart('2º Turno', chartDataT2, chart2ScrollRef, false)}

        {/* TABELA DE COMPARAÇÃO MINIMALISTA */}
        <div className="flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm mt-2">
          
          {/* Cabeçalhos Colados */}
          <div className="grid grid-cols-[45px_1fr_1fr_45px] rounded-t-xl overflow-hidden border-b border-slate-200">
            <div className="col-span-2 bg-yellow-200 py-3 flex items-center">
               <div className="w-[45px] text-center"><span className="text-[10px] font-black text-yellow-800/60 uppercase">#</span></div>
               <div className="flex-1"><span className="text-[12px] font-black uppercase tracking-widest text-yellow-900">1º Turno</span></div>
            </div>
            <div className="col-span-2 bg-blue-200 py-3 flex items-center border-l border-slate-200">
               <div className="flex-1 text-right"><span className="text-[12px] font-black uppercase tracking-widest text-blue-900">2º Turno</span></div>
               <div className="w-[45px] text-center"><span className="text-[10px] font-black text-blue-800/60 uppercase">#</span></div>
            </div>
          </div>

          {/* Lista Fluída (Sem scroll interno) */}
          <div className="flex flex-col pb-2">
            {nodeRows.map((r, i) => {
              const isSelT1 = r.t1 && r.t1.colhedora === highlightedColhedora;
              const isSelT2 = r.t2 && r.t2.colhedora === highlightedColhedora;

              return (
                <div key={i} className="grid grid-cols-[45px_1fr_1fr_45px] items-stretch border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                  
                  {/* LADO T1 */}
                  <div className="flex justify-center items-center py-2">
                     {r.t1 ? getMedalIcon(r.t1.pos, isSelT1) : '-'}
                  </div>
                  
                  <div className="p-1.5 border-r border-slate-200">
                    {r.t1 && (
                      <div 
                        onClick={() => { setHighlightedColhedora(r.t1.colhedora); setSelectedMachineToView(r.t1); }}
                        className={`h-full flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                          isSelT1 ? 'bg-yellow-100 border border-yellow-300 shadow-sm ring-1 ring-yellow-400/50' : 'bg-transparent hover:bg-slate-100 border border-transparent'
                        }`}
                      >
                         <span className="font-black text-[12px] uppercase tracking-widest" style={{ color: getStatusColor(r.t1.calcPerda, metas?.perda) }}>{r.t1.shortName}</span>
                         <CompareTriangle valDia={r.t1.calcPerda} valAno={processamento?.kpisGlobais?.perda} />
                      </div>
                    )}
                  </div>
                  
                  {/* LADO T2 */}
                  <div className="p-1.5">
                    {r.t2 && (
                      <div 
                        onClick={() => { setHighlightedColhedora(r.t2.colhedora); setSelectedMachineToView(r.t2); }}
                        className={`h-full flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                          isSelT2 ? 'bg-blue-100 border border-blue-300 shadow-sm ring-1 ring-blue-400/50' : 'bg-transparent hover:bg-slate-100 border border-transparent'
                        }`}
                      >
                         <CompareTriangle valDia={r.t2.calcPerda} valAno={processamento?.kpisGlobais?.perda} />
                         <span className="font-black text-[12px] uppercase tracking-widest" style={{ color: getStatusColor(r.t2.calcPerda, metas?.perda) }}>{r.t2.shortName}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-center items-center py-2">
                     {r.t2 ? getMedalIcon(r.t2.pos, isSelT2) : '-'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

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
          
          {/* CARDS GLOBAIS DA SAFRA */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {renderTopKpiRow("Média Perdas", processamento?.kpisGlobais?.perda, metas?.perda)}
            {renderTopKpiRow("P. Simples", processamento?.kpisGlobais?.pSimples, metas?.pisoteio_simples)} 
            {renderTopKpiRow("P. Duplo", processamento?.kpisGlobais?.pDuplo, metas?.pisoteio_duplo)}
            {renderTopKpiRow("Arranquio", processamento?.kpisGlobais?.arranquio, metas?.arranquio)}
          </div>

          {/* SELETOR DE MODO */}
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
            renderComparativoDashboard()
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