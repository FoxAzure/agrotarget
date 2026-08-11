// ================================= DOCUMENTATION ------------------------------------------
// Script: PerdaMecDetailRankEquip
// Purpose: Modal dinâmico para exibir o detalhamento da colhedora selecionada no Ranking (por Turno e Mensal).
// Relationships: vw_q_perdamecgeral, vw_q_perdamec_ano, vw_q_perdamec_colhedora, rulesPerdaMec
// ==========================================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { getMetasParaData, getStatusColor } from '../../../components/QualyFlow/rulesPerdaMec';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

import imgOuro from '../../../gallery/logo/medalha-de-ouro.png';
import imgPrata from '../../../gallery/logo/medalha-de-prata.png';
import imgBronze from '../../../gallery/logo/medalha-de-bronze.png';

// Futuros Modais que serão conectados:
import PerdaMecDetailRankEquipCampo from './PerdaMecDetailRankEquipCampo';
import PerdaMecDetailRankEquipEvo from './PerdaMecDetailRankEquipEvo';

// ================================= HELPERS ------------------------------------------------

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const formatValue = (value, decimals = 2) => {
  if (value === null || value === undefined || value === '') return '-';
  const number = Number(value);
  return Number.isNaN(number) ? '-' : number.toFixed(decimals).replace('.', ',');
};

const parseColhedora = (fullName) => {
  if (!fullName) return { shortName: 'DESC', fullName: 'Desconhecida' };
  const parts = fullName.split(' - ');
  return { shortName: parts[0].trim(), fullName: fullName.trim() };
};

const CompareTriangle = ({ daily, yearly }) => {
  if (daily === null || yearly === null) return null;
  const diff = daily - yearly;
  if (Math.abs(diff) < 0.01) return <span className="text-[10px] text-slate-300 font-bold text-center">-</span>;
  if (diff < 0) return <span className="qf-anim-triangle-down font-black text-center text-[var(--q-green)]">▼</span>;
  return <span className="qf-anim-triangle-up font-black text-center text-[var(--q-danger)]">▲</span>;
};

const getGradientColor = (value, min, max) => {
  if (max === min || max === 0) return 'hsl(140, 95%, 35%)';
  const ratio = (value - min) / (max - min);
  const hue = 140 - (ratio * 140);
  const lightness = 35 + (ratio * 15);
  return `hsl(${hue}, 95%, ${lightness}%)`;
};

const getRankPresentation = (rankPosition) => {
  const pos = Number(rankPosition);
  
  if (pos === 1) return { isPodium: true, headerClass: 'qf-podium-1', medal: imgOuro, medalAlt: '1º Lugar', rankText: '1º', rankColor: 'text-yellow-700' };
  if (pos === 2) return { isPodium: true, headerClass: 'qf-podium-2', medal: imgPrata, medalAlt: '2º Lugar', rankText: '2º', rankColor: 'text-slate-600' };
  if (pos === 3) return { isPodium: true, headerClass: 'qf-podium-3', medal: imgBronze, medalAlt: '3º Lugar', rankText: '3º', rankColor: 'text-orange-700' };
  
  return { isPodium: false, headerClass: 'bg-white', medal: null, medalAlt: '', rankText: pos > 0 ? `${pos}º` : '-', rankColor: 'text-[var(--q-dark)]' };
};

const CustomXAxisTick = ({ x, y, payload }) => {
  const words = payload.value.split(' ');
  const line1 = words[0];
  const line2 = words.slice(1).join(' ');
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} textAnchor="middle" fill="#64748b" fontSize={9} fontWeight={900}>
        <tspan x={0} dy="12">{line1}</tspan>
        {line2 && <tspan x={0} dy="11">{line2}</tspan>}
      </text>
    </g>
  );
};

const CustomChartTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="qf-chart-tooltip flex flex-col gap-1 min-w-[140px] bg-white/95 backdrop-blur shadow-lg border border-slate-200 rounded-xl p-3 z-50">
        <span className="text-xs font-black text-slate-700 uppercase">{payload[0].payload.name}</span>
        <div className="flex justify-between items-center mt-1 border-b border-slate-100 pb-1">
          <span className="text-[10px] font-bold text-slate-400">Turno</span>
          <span className="text-[11px] font-black text-[var(--q-dark)]">{formatValue(payload[0].value, 3)}</span>
        </div>
        <div className="flex justify-between items-center pt-1">
          <span className="text-[10px] font-bold text-slate-400">Ano / Safra</span>
          <span className="text-[11px] font-black text-slate-500">{formatValue(payload[1].value, 3)}</span>
        </div>
      </div>
    );
  }
  return null;
};

// ================================= COMPONENTES INTERNOS -----------------------------------

const KpiCard = ({ title, valTurno, valAno, meta, customOrderClass }) => {
  if (valTurno === null && valAno === null) return null;
  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center justify-between shadow-sm gap-2 h-full ${customOrderClass}`}>
      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">{title}</span>
      <div className="flex flex-col items-center leading-none">
        <span className="text-[10px] font-bold text-slate-400 mb-0.5">Turno</span>
        <span className="text-xl font-black" style={{ color: getStatusColor(valTurno, meta) }}>{valTurno !== null ? `${formatValue(valTurno)}%` : '-'}</span>
      </div>
      <div className="flex items-center gap-1 w-full justify-center">
        <div className="w-4"><CompareTriangle daily={valTurno} yearly={valAno} /></div>
      </div>
      <div className="flex flex-col items-center leading-none">
        <span className="text-[14px] font-black" style={{ color: getStatusColor(valAno, meta) }}>{valAno !== null ? `${formatValue(valAno)}%` : '-'}</span>
        <span className="text-[9px] font-bold text-slate-400 mt-0.5">Safra</span>
      </div>
    </div>
  );
};

// ================================= EXECUTOR PRINCIPAL -------------------------------------

const PerdaMecDetailRankEquip = ({ colhedora, ano, initialShift = '1º Turno', onClose }) => {
  
  const [localShift, setLocalShift] = useState(initialShift || '1º Turno');
  const [viewMode, setViewMode] = useState('Campos');
  const [expandedMonth, setExpandedMonth] = useState(null);

  const [loading, setLoading] = useState(false);
  const [rawData, setRawData] = useState([]);
  const [yearData, setYearData] = useState(null);
  const [allMachinesRank, setAllMachinesRank] = useState([]);

  const [selectedCampoData, setSelectedCampoData] = useState(null);
  const [showEvo, setShowEvo] = useState(false);

  const metas = useMemo(() => getMetasParaData(`${ano}-12-31`), [ano]);

  useEffect(() => {
    if (!colhedora) return;
    setLocalShift(initialShift || '1º Turno');
    setViewMode('Campos');
    setExpandedMonth(null);
    setSelectedCampoData(null);
    setShowEvo(false);
  }, [colhedora, initialShift]);

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      if (!colhedora || !ano) return;
      setLoading(true);

      try {
        const [resGeral, resAno, resRank] = await Promise.all([
          supabase.from('vw_q_perdamecgeral').select('*').eq('ano', ano).like('colhedora', `${colhedora.shortName}%`),
          supabase.from('vw_q_perdamec_ano').select('*').eq('ano', ano).single(),
          supabase.from('vw_q_perdamec_colhedora').select('colhedora, turno, perda_perc').eq('ano', ano) // Traz ranking global para autonomia
        ]);

        if (mounted) {
          setRawData(resGeral.data || []);
          setYearData(resAno.data || null);
          setAllMachinesRank(resRank.data || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadData();
    return () => { mounted = false; };
  }, [colhedora, ano]);

  // CÁLCULO AUTÔNOMO DE RANKING (Recalcula sempre que mudar o turno)
  const currentRank = useMemo(() => {
    if (!allMachinesRank.length || !colhedora) return null;
    
    const shiftData = allMachinesRank.filter(r => r.turno === localShift);
    if (!shiftData.length) return null;

    const sorted = shiftData.map(r => ({
      shortName: parseColhedora(r.colhedora).shortName,
      perda: Number(r.perda_perc)
    })).sort((a, b) => a.perda - b.perda);

    const idx = sorted.findIndex(r => r.shortName === colhedora.shortName);
    return idx !== -1 ? idx + 1 : null;
  }, [allMachinesRank, localShift, colhedora]);

  const rankInfo = useMemo(() => getRankPresentation(currentRank), [currentRank]);

  useEffect(() => { setExpandedMonth(null); }, [viewMode]);

  const processamento = useMemo(() => {
    if (!rawData.length) return null;

    const dataTurno = rawData.filter(r => r.turno === localShift);

    let sPerd = 0; let sTch = 0; let sMtSimp = 0; let sAvSimp = 0;
    let sMtDup = 0; let sAvDup = 0; let sTocoArr = 0; let sTocoFix = 0;

    const mapCampos = new Map();
    const mapMensalCampos = new Map();

    const addCampoAgg = (mapRef, chave, base) => {
      if (!mapRef.has(chave)) {
        mapRef.set(chave, { campo: base.campo, mes: base.mes, pontos: 0, cPerd: 0, cTch: 0, cMt: 0, cAv: 0, cTArr: 0, cTFix: 0, esp: new Set() });
      }
      return mapRef.get(chave);
    };

    dataTurno.forEach(r => {
      sPerd += Number(r.total_perda) || 0;
      sTch += Number(r.tch_estimado) || 0;
      sTocoArr += Number(r.tocos_arrancados) || 0;
      sTocoFix += Number(r.tocos_fixos) || 0;

      const esp = String(r.espacamento || '').toLowerCase();
      if (esp === 'simples') { sMtSimp += Number(r.mt_pisoteio) || 0; sAvSimp += Number(r.av_pisoteio) || 0; } 
      else if (esp === 'duplo') { sMtDup += Number(r.mt_pisoteio) || 0; sAvDup += Number(r.av_pisoteio) || 0; }

      const campoStr = String(r.campo || '').trim();
      const mesNum = Number(r.mes);
      const baseCampo = { campo: campoStr, mes: mesNum };

      const cGeral = addCampoAgg(mapCampos, campoStr, baseCampo);
      const cMensal = addCampoAgg(mapMensalCampos, `${mesNum}_${campoStr}`, baseCampo);

      [cGeral, cMensal].forEach(c => {
        c.pontos += 1;
        c.cPerd += Number(r.total_perda) || 0;
        c.cTch += Number(r.tch_estimado) || 0;
        c.cMt += Number(r.mt_pisoteio) || 0;
        c.cAv += Number(r.av_pisoteio) || 0;
        c.cTArr += Number(r.tocos_arrancados) || 0;
        c.cTFix += Number(r.tocos_fixos) || 0;
        if (r.espacamento) c.esp.add(String(r.espacamento).trim().toLowerCase());
      });
    });

    const kpisTurno = {
      perda: sPerd + sTch > 0 ? (sPerd / (sPerd + sTch)) * 100 : null,
      pSimples: sAvSimp > 0 ? (sMtSimp / sAvSimp) * 100 : null,
      pDuplo: sAvDup > 0 ? (sMtDup / sAvDup) * 100 : null,
      arranquio: sTocoFix > 0 ? (sTocoArr / sTocoFix) * 100 : null
    };

    const kpisAno = {
      perda: yearData ? Number(yearData.perda_perc) : null,
      pSimples: yearData ? Number(yearData.pisoteio_simples_perc) : null,
      pDuplo: yearData ? Number(yearData.pisoteio_duplo_perc) : null,
      arranquio: yearData ? Number(yearData.arranquio_perc) : null
    };

    const categoriasBase = [
      { key: 'cat_canaponta', label: 'Cana Ponta' }, { key: 'cat_toco', label: 'Toco' },
      { key: 'cat_pedacofixo', label: 'Pedaço Fixo' }, { key: 'cat_canainteira', label: 'Cana Inteira' },
      { key: 'cat_toleterepicado', label: 'Tolete Repicado' }, { key: 'cat_estilhaco', label: 'Estilhaço' },
      { key: 'cat_lascas', label: 'Lascas' }, { key: 'cat_pedacosolto', label: 'Pedaço Solto' }
    ];

    const chartData = categoriasBase.map(cat => {
      const somaTurno = dataTurno.reduce((acc, r) => acc + (Number(r[cat.key]) || 0), 0);
      return { name: cat.label, turno: dataTurno.length > 0 ? somaTurno / dataTurno.length : 0, ano: yearData ? Number(yearData[cat.key]) || 0 : 0 };
    }).sort((a, b) => b.turno - a.turno);

    const buildCampoItem = c => {
      const isMixed = c.esp.size > 1;
      let pMeta = null;
      if (!isMixed) {
        if (c.esp.has('simples')) pMeta = metas.pisoteio_simples;
        else if (c.esp.has('duplo')) pMeta = metas.pisoteio_duplo;
      }
      return {
        ...c,
        calcPerda: c.cPerd + c.cTch > 0 ? (c.cPerd / (c.cPerd + c.cTch)) * 100 : null,
        calcPisot: c.cAv > 0 ? (c.cMt / c.cAv) * 100 : null,
        calcArranquio: c.cTFix > 0 ? (c.cTArr / c.cTFix) * 100 : null,
        isMixed, pMeta
      };
    };

    const listaCamposBruta = Array.from(mapCampos.values()).map(buildCampoItem).sort((a, b) => String(a.campo).localeCompare(String(b.campo), 'pt-BR'));
    
    const agruparMensal = {};
    Array.from(mapMensalCampos.values()).map(buildCampoItem).sort((a, b) => String(a.campo).localeCompare(String(b.campo), 'pt-BR')).forEach(item => {
      const nomeMes = `${MONTHS[item.mes - 1]}/${ano}`;
      if (!agruparMensal[nomeMes]) agruparMensal[nomeMes] = { mesId: item.mes, nome: nomeMes, itens: [] };
      agruparMensal[nomeMes].itens.push(item);
    });

    return {
      qtdTotal: dataTurno.length, kpisTurno, kpisAno, chartData,
      minCat: Math.min(...chartData.map(d => d.turno)),
      maxCat: Math.max(...chartData.map(d => d.turno)),
      listaCamposBruta,
      listaMensal: Object.values(agruparMensal).sort((a, b) => b.mesId - a.mesId)
    };
  }, [rawData, localShift, yearData, metas, ano]);

  if (!colhedora) return null;

  const renderKpiCards = () => {
    if (!processamento) return null;
    const { kpisTurno, kpisAno } = processamento;
    const hasSimples = kpisTurno.pSimples !== null;
    const hasDuplo = kpisTurno.pDuplo !== null;
    const isFullGrid = hasSimples && hasDuplo;
    
    return (
      <div className={`grid gap-3 mb-5 ${isFullGrid ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3'}`}>
        <KpiCard title="Perda" valTurno={kpisTurno.perda} valAno={kpisAno.perda} meta={metas.perda} customOrderClass="order-1 md:order-1" />
        <KpiCard title="Arranquio" valTurno={kpisTurno.arranquio} valAno={kpisAno.arranquio} meta={metas.arranquio} customOrderClass="order-2 md:order-4" />
        {!hasSimples && !hasDuplo && <KpiCard title="Pisoteio" valTurno={null} valAno={null} meta={null} customOrderClass="order-3 md:order-2" />}
        {hasSimples && <KpiCard title="P. Simples" valTurno={kpisTurno.pSimples} valAno={kpisAno.pSimples} meta={metas.pisoteio_simples} customOrderClass="order-3 md:order-2" />}
        {hasDuplo && <KpiCard title="P. Duplo" valTurno={kpisTurno.pDuplo} valAno={kpisAno.pDuplo} meta={metas.pisoteio_duplo} customOrderClass="order-4 md:order-3" />}
      </div>
    );
  };

  const renderItemList = (c, idx) => (
    <div key={idx} onClick={() => setSelectedCampoData(c)} className="grid grid-cols-[1fr_45px_50px_50px_50px] md:grid-cols-[1fr_55px_60px_60px_60px] gap-2 px-2 py-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-50 last:border-0 group items-center">
      <span className="text-[11px] font-black text-slate-600 self-center truncate group-hover:text-[var(--q-orange)]">{c.campo}</span>
      <span className="text-[10px] font-black text-center self-center bg-[var(--q-green-soft)] text-[var(--q-green-dark)] px-2 py-0.5 rounded-md">{c.pontos}</span>
      <span className="text-[11px] font-black text-center self-center" style={{ color: getStatusColor(c.calcPerda, metas.perda) }}>{formatValue(c.calcPerda)}%</span>
      <span className="text-[11px] font-black text-center self-center" style={{ color: c.isMixed ? 'var(--q-dark)' : getStatusColor(c.calcPisot, c.pMeta) }}>{c.calcPisot !== null ? `${formatValue(c.calcPisot)}%` : '-'}</span>
      <span className="text-[11px] font-black text-right self-center pr-1" style={{ color: getStatusColor(c.calcArranquio, metas.arranquio) }}>{c.calcArranquio !== null ? `${formatValue(c.calcArranquio)}%` : '-'}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200" onClick={onClose}>
      <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh]" onClick={e => e.stopPropagation()}>
        
        {/* HEADER FLUIDO - Sem Pulos Visuais */}
        <div className={`p-4 md:p-5 border-b border-slate-200 shrink-0 shadow-sm z-10 transition-colors duration-300 ease-in-out ${rankInfo.headerClass}`}>
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Análise de Desempenho</span>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200/50 text-slate-500 hover:bg-red-100 hover:text-red-500 font-bold transition-colors shadow-sm">✕</button>
          </div>

          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3 md:gap-4 pr-4 min-w-0">
              
              {/* BOX DO ÍCONE - Tamanho Fixo Impede Quebras */}
              <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl border flex items-center justify-center shrink-0 transition-all duration-300 ease-in-out ${rankInfo.isPodium ? 'bg-white/60 border-white/70 shadow-inner' : 'bg-slate-50 border-slate-200 shadow-sm'}`}>
                {rankInfo.isPodium ? (
                  <img src={rankInfo.medal} alt={rankInfo.medalAlt} className="w-7 h-7 md:w-9 md:h-9 object-contain drop-shadow" />
                ) : (
                  <span className="text-lg md:text-xl font-black text-slate-400">{rankInfo.rankText}</span>
                )}
              </div>

              <div className="flex flex-col min-w-0">
                <h3 className={`text-xl md:text-2xl font-black uppercase leading-none tracking-tight flex items-center gap-2 transition-colors duration-300 ease-in-out ${rankInfo.rankColor}`}>
                  <span className="truncate">{colhedora.shortName}</span>
                  <span className="text-slate-300 text-base md:text-lg hidden sm:inline">| {ano}</span>
                </h3>
                {colhedora.fullName && (
                  <span className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase line-clamp-1 mt-1">
                    {colhedora.fullName}
                  </span>
                )}
              </div>
            </div>

            <div className="bg-[var(--q-green-soft)] text-[var(--q-green-dark)] px-4 py-2 rounded-xl flex flex-col items-center justify-center shadow-inner self-stretch shrink-0 transition-all duration-300 ease-in-out">
              <span className="text-xl font-black leading-none">{processamento?.qtdTotal || 0}</span>
              <span className="text-[9px] font-bold uppercase tracking-widest mt-0.5">Pnts</span>
            </div>
          </div>

          {/* TOGGLE DE TURNOS */}
          <div className="flex w-full bg-slate-100/80 p-1 rounded-xl shadow-inner border border-slate-200/60 transition-colors duration-300 ease-in-out">
            {['1º Turno', '2º Turno'].map(t => (
              <button
                key={t}
                onClick={() => setLocalShift(t)}
                className={`flex-1 py-2.5 text-[10px] md:text-[11px] font-black uppercase tracking-wide rounded-lg transition-all ${
                  localShift === t ? 'bg-[var(--q-green)] text-white shadow-md' : 'text-slate-500 hover:bg-white hover:text-slate-800'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* CORPO SCROLLÁVEL */}
        <div className="p-4 md:p-5 overflow-y-auto custom-scrollbar flex-1 flex flex-col">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Carregando Dados...</span>
            </div>
          ) : !processamento || processamento.qtdTotal === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white border border-dashed border-slate-200 rounded-xl shadow-sm">
              <span className="text-4xl opacity-40 mb-4 grayscale">🚜</span>
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Nenhum dado avaliado no {localShift} em {ano}</h3>
            </div>
          ) : (
            <div className="flex flex-col animate-in fade-in duration-300">
              
              {renderKpiCards()}

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-5">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-4">Categorias (Média/Ponto)</h4>
                <div className="overflow-x-auto custom-scrollbar pb-2">
                  <div className="min-w-[500px] h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={processamento.chartData} margin={{ top: 20, right: 10, left: 0, bottom: 35 }}>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={<CustomXAxisTick />} interval={0} />
                        <YAxis type="number" hide domain={[0, dataMax => dataMax * 1.2]} />
                        <Tooltip content={<CustomChartTooltip />} cursor={{fill: 'rgba(241, 245, 249, 0.4)'}} />
                        <Bar dataKey="turno" barSize={32} radius={[6, 6, 0, 0]}>
                          {processamento.chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getGradientColor(entry.turno, processamento.minCat, processamento.maxCat)} />
                          ))}
                          <LabelList dataKey="turno" position="top" formatter={val => formatValue(val, 3)} style={{ fontSize: '9px', fontWeight: '900', fill: '#475569' }} />
                        </Bar>
                        <Line type="monotone" dataKey="ano" stroke="#94a3b8" strokeWidth={2} dot={{ r: 3, fill: '#94a3b8', stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
                <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-[var(--q-dark)] uppercase tracking-widest pl-1">Campos Avaliados</h4>
                  <div className="flex bg-slate-200/60 p-0.5 rounded-lg shadow-inner">
                    {['Campos', 'Mensal'].map(v => (
                      <button
                        key={v}
                        onClick={() => setViewMode(v)}
                        className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-md transition-all ${
                          viewMode === v ? 'bg-white text-[var(--q-dark)] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-[1fr_45px_50px_50px_50px] md:grid-cols-[1fr_55px_60px_60px_60px] gap-2 px-3 py-2 bg-slate-50 border-b-2 border-slate-100 cursor-default">
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 self-center">Campo</span>
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center self-center">Pontos</span>
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center self-center">Perda</span>
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center self-center">Pisot.</span>
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-right self-center pr-1">Arran.</span>
                </div>

                <div className="flex flex-col p-1 bg-white">
                  {viewMode === 'Campos' ? (
                    processamento.listaCamposBruta.map((c, idx) => renderItemList(c, idx))
                  ) : (
                    processamento.listaMensal.map((grupoMes, i) => {
                      const isCollapsed = expandedMonth !== grupoMes.nome;
                      return (
                        <div key={i} className="flex flex-col mb-1 last:mb-0 border border-slate-100 rounded-lg overflow-hidden">
                          <div 
                            onClick={() => setExpandedMonth(isCollapsed ? grupoMes.nome : null)}
                            className={`p-3 flex justify-between items-center cursor-pointer transition-colors ${isCollapsed ? 'bg-slate-50 hover:bg-slate-100' : 'bg-slate-100 border-b border-slate-200'}`}
                          >
                            <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest">{grupoMes.nome}</span>
                            <div className="flex items-center gap-2">
                              <span className="bg-[var(--q-green-soft)] text-[var(--q-green-dark)] text-[9px] font-black px-2 py-0.5 rounded-md">
                                {grupoMes.itens.reduce((acc, item) => acc + item.pontos, 0)} pts
                              </span>
                              <span className="text-slate-400 font-black text-xs">{isCollapsed ? '▼' : '▲'}</span>
                            </div>
                          </div>
                          {!isCollapsed && (
                            <div className="flex flex-col p-1 animate-in slide-in-from-top-2 duration-200">
                              {grupoMes.itens.map((c, idx) => renderItemList(c, idx))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {!loading && (
          <div className="p-4 border-t border-[var(--q-border)] bg-[var(--q-bg-hover)] shrink-0">
            <button
              onClick={() => setShowEvo(true)}
              className="w-full py-3 bg-[var(--q-orange-soft)] text-[var(--q-orange-dark)] rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[var(--q-orange)] hover:text-white transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <span>Histórico Detalhado</span>
              <span>→</span>
            </button>
          </div>
        )}
      </div>

      {selectedCampoData && (
        <PerdaMecDetailRankEquipCampo
          campoNome={selectedCampoData.campo}
          dataApontamento={null}
          colhedora={colhedora}
          turno={localShift}
          ano={ano}
          onClose={() => setSelectedCampoData(null)}
        />
      )}

      {showEvo && (
        <PerdaMecDetailRankEquipEvo
          colhedora={colhedora}
          turno={localShift}
          ano={ano}
          onClose={() => setShowEvo(false)}
        />
      )}
    </div>
  );
};

export default PerdaMecDetailRankEquip;