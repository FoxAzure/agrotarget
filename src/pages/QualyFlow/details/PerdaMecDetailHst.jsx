// ================================= DOCUMENTATION ------------------------------------------
// Script: PerdaMecDetailHst
// Purpose: Tela de Histórico e Evolução das Perdas Mecanizadas (Visão Anual/Mensal).
// Relationships: vw_q_perdamec_ano, vw_q_perdamec_mes, vw_q_perdamec_colhedora,
//                vw_q_perdamec_frentegeral, rulesPerdaMec
// ==========================================================================================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import YearSelectorQualyFlow from '../../../components/QualyFlow/YearSelectorQualyFlow';
import { getMetasParaData, getStatusColor } from '../../../components/QualyFlow/rulesPerdaMec';
import { ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList } from 'recharts';

import PerdaMecDetailRankEquip from './PerdaMecDetailRankEquip';
import './PerdaMecDetailHst.css';

import imgOuro from '../../../gallery/logo/medalha-de-ouro.png';
import imgPrata from '../../../gallery/logo/medalha-de-prata.png';
import imgBronze from '../../../gallery/logo/medalha-de-bronze.png';

// ================================= HELPERS ------------------------------------------------

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const formatValue = (value, decimals = 2) => {
  if (value === null || value === undefined || value === '') return '-';
  const number = Number(value);
  return Number.isNaN(number) ? '-' : number.toFixed(decimals).replace('.', ',');
};

const nullableNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const parseColhedora = (fullName) => {
  if (!fullName) return { shortName: 'DESC' };
  return { shortName: fullName.split(' - ')[0].trim() };
};

const getMedalIcon = (pos) => {
  if (pos === 1) return <img src={imgOuro} alt="1º" className="w-5 h-5 drop-shadow-sm mx-auto" />;
  if (pos === 2) return <img src={imgPrata} alt="2º" className="w-5 h-5 drop-shadow-sm mx-auto" />;
  if (pos === 3) return <img src={imgBronze} alt="3º" className="w-5 h-5 drop-shadow-sm mx-auto" />;
  return <span className="text-[11px] font-black block text-center text-slate-400">{pos}º</span>;
};

const CompareTriangle = ({ current, previous }) => {
  if (current === null || previous === null) return <span className="text-[10px] text-slate-300 font-bold">-</span>;
  const diff = current - previous;
  if (Math.abs(diff) < 0.01) return <span className="text-[10px] text-slate-300 font-bold">-</span>;
  if (diff < 0) return <span className="qf-anim-triangle-down font-black text-[var(--q-green)]">▼</span>;
  return <span className="qf-anim-triangle-up font-black text-[var(--q-danger)]">▲</span>;
};

const getGradientColor = (value, min, max) => {
  if (max === min || max === 0) return 'hsl(140, 95%, 35%)';
  const ratio = (value - min) / (max - min);
  const hue = 140 - (ratio * 140);
  const lightness = 35 + (ratio * 15);
  return `hsl(${hue}, 95%, ${lightness}%)`;
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

// ================================= EXECUTOR PRINCIPAL -------------------------------------

const PerdaMecDetailHst = () => {
  const [activeYear, setActiveYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);

  const [loading, setLoading] = useState(false);
  const [yearData, setYearData] = useState(null);
  const [prevYearData, setPrevYearData] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);
  const [colhedoraData, setColhedoraData] = useState([]);
  const [frenteData, setFrenteData] = useState([]);

  const [selectedInd, setSelectedInd] = useState('perda');
  const [shiftTab, setShiftTab] = useState('Geral');
  const [selectedMachineToView, setSelectedMachineToView] = useState(null);

  const chartScrollRef = useRef(null);
  const metas = useMemo(() => getMetasParaData(`${activeYear}-12-31`), [activeYear]);

  // 1. Busca Anos Disponíveis
  useEffect(() => {
    let mounted = true;
    const fetchYears = async () => {
      try {
        const { data, error } = await supabase.from('vw_q_perdamec_ano').select('ano');
        if (error) throw error;
        if (mounted && data) {
          const uniqueYears = [...new Set(data.map(r => Number(r.ano)))].sort((a, b) => b - a);
          setAvailableYears(uniqueYears);
          if (uniqueYears.length > 0 && !uniqueYears.includes(activeYear)) setActiveYear(uniqueYears[0]);
        }
      } catch (err) { console.error('Erro ao buscar safras:', err); }
    };
    fetchYears();
    return () => { mounted = false; };
  }, [activeYear]);

  // 2. Busca Dados da Safra
  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      if (!activeYear) return;
      setLoading(true);

      try {
        const [resAno, resAnoAnt, resMes, resColh, resFrente] = await Promise.all([
          supabase.from('vw_q_perdamec_ano').select('*').eq('ano', activeYear).single(),
          supabase.from('vw_q_perdamec_ano').select('*').eq('ano', activeYear - 1).maybeSingle(),
          supabase.from('vw_q_perdamec_mes').select('*').eq('ano', activeYear).order('mes', { ascending: true }),
          supabase.from('vw_q_perdamec_colhedora').select('*').eq('ano', activeYear),
          supabase.from('vw_q_perdamec_frentegeral').select('*').eq('ano', activeYear)
        ]);

        const requestError = resAno.error || resAnoAnt.error || resMes.error || resColh.error || resFrente.error;
        if (requestError) throw requestError;

        if (mounted) {
          setYearData(resAno.data || null);
          setPrevYearData(resAnoAnt.data || null);
          setMonthlyData(resMes.data || []);
          setColhedoraData(resColh.data || []);
          setFrenteData(resFrente.data || []);
        }
      } catch (err) {
        console.error('Erro ao carregar histórico de perdas mecanizadas:', err);
        if (mounted) {
          setYearData(null);
          setPrevYearData(null);
          setMonthlyData([]);
          setColhedoraData([]);
          setFrenteData([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadData();
    return () => { mounted = false; };
  }, [activeYear]);

  // 3. Auto-scroll do Gráfico Mensal
  useEffect(() => {
    if (chartScrollRef.current && monthlyData.length > 0) {
      const timer = setTimeout(() => {
        chartScrollRef.current?.scrollTo({ left: chartScrollRef.current.scrollWidth, behavior: 'smooth' });
      }, 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [monthlyData, selectedInd]);

  // 4. Processamento Inteligente
  const processamento = useMemo(() => {
    const kpisGlobais = {
      perda: yearData ? Number(yearData.perda_perc) : null,
      pSimples: yearData ? Number(yearData.pisoteio_simples_perc) : null,
      pDuplo: yearData ? Number(yearData.pisoteio_duplo_perc) : null,
      arranquio: yearData ? Number(yearData.arranquio_perc) : null
    };

    const kpisAnt = {
      perda: prevYearData ? Number(prevYearData.perda_perc) : null,
      pSimples: prevYearData ? Number(prevYearData.pisoteio_simples_perc) : null,
      pDuplo: prevYearData ? Number(prevYearData.pisoteio_duplo_perc) : null,
      arranquio: prevYearData ? Number(prevYearData.arranquio_perc) : null
    };

    const chartKeys = {
      perda: { key: 'perda_perc', meta: metas.perda },
      simp: { key: 'pisoteio_simples_perc', meta: metas.pisoteio_simples },
      dup: { key: 'pisoteio_duplo_perc', meta: metas.pisoteio_duplo },
      arr: { key: 'arranquio_perc', meta: metas.arranquio }
    };

    const activeChartCfg = chartKeys[selectedInd];
    const dataMesChart = monthlyData.map(m => ({
      name: MONTHS[m.mes - 1],
      valor: Number(m[activeChartCfg.key])
    }));

    let rankList = [];
    if (shiftTab === 'Geral') {
      const mapGeral = new Map();
      colhedoraData.forEach(r => {
        if (!mapGeral.has(r.colhedora)) {
          mapGeral.set(r.colhedora, { colhedora: r.colhedora, pts: 0, sPerd: 0, sTch: 0, sMtS: 0, sAvS: 0, sMtD: 0, sAvD: 0, sTArr: 0, sTFix: 0 });
        }
        const obj = mapGeral.get(r.colhedora);
        obj.pts += Number(r.qnt_pontos || 0);
        obj.sPerd += Number(r.total_perda || 0);
        obj.sTch += Number(r.tch_estimado || 0);
        obj.sMtS += Number(r.mt_pisoteio_simples || 0);
        obj.sAvS += Number(r.av_pisoteio_simples || 0);
        obj.sMtD += Number(r.mt_pisoteio_duplo || 0);
        obj.sAvD += Number(r.av_pisoteio_duplo || 0);
        obj.sTArr += Number(r.tocos_arrancados || 0);
        obj.sTFix += Number(r.tocos_fixos || 0);
      });

      rankList = Array.from(mapGeral.values()).map(c => ({
        colhedora: c.colhedora,
        calcPerda: (c.sPerd + c.sTch) > 0 ? (c.sPerd / (c.sPerd + c.sTch)) * 100 : null,
        calcPisotSimp: c.sAvS > 0 ? (c.sMtS / c.sAvS) * 100 : null,
        calcPisotDup: c.sAvD > 0 ? (c.sMtD / c.sAvD) * 100 : null,
        calcArr: c.sTFix > 0 ? (c.sTArr / c.sTFix) * 100 : null
      })).sort((a, b) => (a.calcPerda ?? Infinity) - (b.calcPerda ?? Infinity));
    } else {
      rankList = colhedoraData.filter(r => r.turno === shiftTab).map(r => ({
        colhedora: r.colhedora,
        turno: r.turno,
        calcPerda: nullableNumber(r.perda_perc),
        calcPisotSimp: Number(r.av_pisoteio_simples) > 0 ? (Number(r.mt_pisoteio_simples) / Number(r.av_pisoteio_simples)) * 100 : null,
        calcPisotDup: Number(r.av_pisoteio_duplo) > 0 ? (Number(r.mt_pisoteio_duplo) / Number(r.av_pisoteio_duplo)) * 100 : null,
        calcArr: nullableNumber(r.arranquio_perc)
      })).sort((a, b) => (a.calcPerda ?? Infinity) - (b.calcPerda ?? Infinity));
    }

    const frenteList = frenteData.map(r => ({
      frente: String(r.frente ?? '-'),
      pontos: Number(r.pontos || 0),
      perda: nullableNumber(r.perda_perc),
      pSimples: nullableNumber(r.pisoteio_simples_perc),
      pDuplo: nullableNumber(r.pisoteio_duplo_perc),
      arranquio: nullableNumber(r.arranquio_perc)
    })).sort((a, b) => (a.perda ?? Infinity) - (b.perda ?? Infinity) || a.frente.localeCompare(b.frente, 'pt-BR', { numeric: true }));

    const categoriasBase = [
      { key: 'cat_canaponta', label: 'Cana Ponta' }, { key: 'cat_toco', label: 'Toco' },
      { key: 'cat_pedacofixo', label: 'Pedaço Fixo' }, { key: 'cat_canainteira', label: 'Cana Inteira' },
      { key: 'cat_toleterepicado', label: 'Tolete Repicado' }, { key: 'cat_estilhaco', label: 'Estilhaço' },
      { key: 'cat_lascas', label: 'Lascas' }, { key: 'cat_pedacosolto', label: 'Pedaço Solto' }
    ];

    const chartCatData = categoriasBase.map(cat => ({
      name: cat.label,
      atual: yearData ? Number(yearData[cat.key] || 0) : 0,
      ant: prevYearData ? Number(prevYearData[cat.key] || 0) : 0
    })).sort((a, b) => b.atual - a.atual);

    const minCat = Math.min(...chartCatData.map(d => d.atual));
    const maxCat = Math.max(...chartCatData.map(d => d.atual));

    return { kpisGlobais, kpisAnt, chartCfg: activeChartCfg, dataMesChart, rankList, frenteList, chartCatData, minCat, maxCat };
  }, [yearData, prevYearData, monthlyData, colhedoraData, frenteData, selectedInd, shiftTab, metas]);

  // ================================= RENDERIZADORES COMPONENTIZADOS =========================

  const TopKpiRow = ({ label, valAtual, valAnt, meta }) => {
    if (valAtual === null && valAnt === null) return null;
    return (
      <div className="flex items-center justify-between py-2 border-b border-slate-100/60 last:border-0 hover:bg-slate-50/50 transition-colors px-2 rounded-lg">
        <span className="text-[11px] md:text-[12px] font-bold text-slate-600 flex-1">{label}</span>
        <div className="flex items-center gap-3 md:gap-6 flex-1 justify-end">
          <span className="text-[11px] md:text-[12px] font-black w-14 text-right" style={{ color: getStatusColor(valAtual, meta) }}>
            {valAtual !== null ? `${formatValue(valAtual)}%` : '-'}
          </span>
          <div className="w-4 flex justify-center"><CompareTriangle current={valAtual} previous={valAnt} /></div>
          <span className="text-[11px] md:text-[12px] font-black w-14 text-right text-slate-400">
            {valAnt !== null ? `${formatValue(valAnt)}%` : '-'}
          </span>
        </div>
      </div>
    );
  };

  const CustomCatTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const valAtual = payload[0].payload.atual;
      const valAnt = payload[0].payload.ant;
      const isWorse = valAtual > valAnt;
      const borderColor = isWorse ? 'border-red-400' : 'border-green-400';
      const shadowColor = isWorse ? 'shadow-red-500/20' : 'shadow-green-500/20';
      return (
        <div className={`flex flex-col min-w-[170px] bg-white/95 backdrop-blur shadow-lg border ${borderColor} ${shadowColor} rounded-xl p-3 z-50`}>
          <span className="text-[10px] font-black text-slate-700 uppercase text-center border-b border-slate-100 pb-1 mb-2">{payload[0].payload.name}</span>
          <div className="flex justify-between items-center px-1">
            <div className="flex flex-col items-center"><span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{activeYear - 1}</span><span className="text-[11px] font-black text-slate-500">{formatValue(valAnt, 3)}</span></div>
            <div className="flex items-center justify-center pt-3"><CompareTriangle current={valAtual} previous={valAnt} /></div>
            <div className="flex flex-col items-center"><span className="text-[9px] font-bold text-[var(--q-dark)] uppercase tracking-widest">{activeYear}</span><span className="text-[11px] font-black text-[var(--q-dark)]">{formatValue(valAtual, 3)}</span></div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className="flex flex-col items-center">
        <YearSelectorQualyFlow value={activeYear} onChange={setActiveYear} availableYears={availableYears} isLoading={loading} />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 mt-4"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Carregando Safra...</span></div>
      ) : !yearData ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white border border-dashed border-slate-200 rounded-xl mt-4 shadow-sm"><span className="text-4xl opacity-40 mb-4 grayscale">📂</span><h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Nenhum dado consolidado nesta safra</h3></div>
      ) : (
        <div className="flex flex-col gap-5 mt-2">
          {/* LISTA DE INDICADORES GLOBAIS */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex justify-between items-end border-b border-slate-200 pb-2 mb-2 px-2"><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Indicador</span><div className="flex gap-4 md:gap-8 pr-1"><span className="text-[9px] font-black uppercase tracking-widest text-[var(--q-dark)] text-right w-12">{activeYear}</span><span className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-12">{activeYear - 1}</span></div></div>
            <div className="flex flex-col">
              <TopKpiRow label="Perdas" valAtual={processamento.kpisGlobais.perda} valAnt={processamento.kpisAnt.perda} meta={metas.perda} />
              <TopKpiRow label="Pisoteio Simples" valAtual={processamento.kpisGlobais.pSimples} valAnt={processamento.kpisAnt.pSimples} meta={metas.pisoteio_simples} />
              <TopKpiRow label="Pisoteio Duplo" valAtual={processamento.kpisGlobais.pDuplo} valAnt={processamento.kpisAnt.pDuplo} meta={metas.pisoteio_duplo} />
              <TopKpiRow label="Arranquio" valAtual={processamento.kpisGlobais.arranquio} valAnt={processamento.kpisAnt.arranquio} meta={metas.arranquio} />
            </div>
          </div>

          {/* GRÁFICO MENSAL DINÂMICO */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
            <div className="p-3 border-b border-slate-100 bg-slate-50 flex flex-col gap-3">
              <h4 className="text-[10px] font-black text-[var(--q-dark)] uppercase tracking-widest px-1">Evolução Mensal</h4>
              <div className="flex w-full bg-slate-200/50 p-1 rounded-xl shadow-inner">
                {[{ key: 'perda', label: 'Perda' }, { key: 'simp', label: 'P. Simples' }, { key: 'dup', label: 'P. Duplo' }, { key: 'arr', label: 'Arranquio' }].map(ind => (
                  <button type="button" key={ind.key} onClick={() => setSelectedInd(ind.key)} className={`flex-1 py-2 text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${selectedInd === ind.key ? 'bg-white text-[var(--q-dark)] shadow-sm ring-1 ring-slate-200/50' : 'text-slate-400 hover:text-slate-600'}`}>{ind.label}</button>
                ))}
              </div>
            </div>
            <div className="w-full overflow-x-auto custom-scrollbar" ref={chartScrollRef}>
              <div style={{ minWidth: Math.max(400, processamento.dataMesChart.length * 60) + 'px', height: '240px', padding: '15px 5px' }}>
                <ResponsiveContainer width="100%" height="100%"><ComposedChart data={processamento.dataMesChart} margin={{ top: 20, right: 15, left: 0, bottom: 20 }}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} interval={0} /><YAxis hide domain={[0, dataMax => dataMax * 1.25]} />
                  <Tooltip cursor={{fill: 'rgba(241, 245, 249, 0.4)'}} content={({ active, payload }) => active && payload?.length ? <div className="bg-white/95 backdrop-blur shadow-lg border border-slate-200 rounded-xl p-3 z-50 flex flex-col gap-1"><span className="text-[10px] font-black text-slate-400 uppercase">{payload[0].payload.name} / {activeYear}</span><span className="text-[13px] font-black" style={{ color: getStatusColor(payload[0].value, processamento.chartCfg.meta) }}>{formatValue(payload[0].value, 2)}%</span></div> : null} />
                  <ReferenceLine y={processamento.chartCfg.meta} stroke="#22c55e" strokeDasharray="4 4" label={{ position: 'insideTopLeft', value: 'Meta', fill: '#22c55e', fontSize: 9, fontWeight: 900 }} />
                  <Bar dataKey="valor" barSize={36} radius={[6, 6, 0, 0]}>{processamento.dataMesChart.map((entry, index) => <Cell key={`cell-${index}`} fill={getStatusColor(entry.valor, processamento.chartCfg.meta)} />)}<LabelList dataKey="valor" position="top" formatter={(val) => formatValue(val)} style={{ fontSize: '10px', fontWeight: '900', fill: '#475569' }} /></Bar>
                </ComposedChart></ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* RANKING COLHEDORAS */}
          <div className="qf-hst-rank-card">
            <div className="qf-hst-rank-titlebar qf-hst-rank-titlebar--equipment">
              <h4>Desempenho de Equipamentos</h4>

              <div className="qf-hst-rank-tabs">
                {['Geral', '1º Turno', '2º Turno'].map(t => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setShiftTab(t)}
                    className={shiftTab === t ? 'is-active' : ''}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="qf-hst-rank-table qf-hst-rank-table--equipment">
              <div className="qf-hst-rank-grid qf-hst-rank-grid--equipment qf-hst-rank-head">
                <span>#</span>
                <span className="qf-hst-rank-head-name">Máquina</span>
                <span>Perda</span>
                <span>Pisot.S</span>
                <span>Pisot.D</span>
                <span>Arran.</span>
              </div>

              <div className="qf-hst-rank-body custom-scrollbar">
                {processamento.rankList.length === 0 ? (
                  <div className="qf-hst-rank-empty">Sem apontamentos</div>
                ) : (
                  processamento.rankList.map((r, idx) => (
                    <div
                      key={`${r.colhedora}-${idx}`}
                      onClick={() => {
                        if (shiftTab !== 'Geral') setSelectedMachineToView(r);
                      }}
                      className={`qf-hst-rank-grid qf-hst-rank-grid--equipment qf-hst-rank-row ${
                        shiftTab !== 'Geral' ? 'is-clickable' : ''
                      }`}
                    >
                      <div className="qf-hst-rank-position">{getMedalIcon(idx + 1)}</div>
                      <span className="qf-hst-rank-name" title={r.colhedora}>
                        {parseColhedora(r.colhedora).shortName}
                      </span>
                      <span
                        className="qf-hst-rank-value"
                        style={{ color: r.calcPerda === null ? '#94a3b8' : getStatusColor(r.calcPerda, metas.perda) }}
                      >
                        {r.calcPerda !== null ? `${formatValue(r.calcPerda)}%` : '-'}
                      </span>
                      <span
                        className="qf-hst-rank-value"
                        style={{ color: r.calcPisotSimp === null ? '#94a3b8' : getStatusColor(r.calcPisotSimp, metas.pisoteio_simples) }}
                      >
                        {r.calcPisotSimp !== null ? `${formatValue(r.calcPisotSimp)}%` : '-'}
                      </span>
                      <span
                        className="qf-hst-rank-value"
                        style={{ color: r.calcPisotDup === null ? '#94a3b8' : getStatusColor(r.calcPisotDup, metas.pisoteio_duplo) }}
                      >
                        {r.calcPisotDup !== null ? `${formatValue(r.calcPisotDup)}%` : '-'}
                      </span>
                      <span
                        className="qf-hst-rank-value qf-hst-rank-value--last"
                        style={{ color: r.calcArr === null ? '#94a3b8' : getStatusColor(r.calcArr, metas.arranquio) }}
                      >
                        {r.calcArr !== null ? `${formatValue(r.calcArr)}%` : '-'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {shiftTab === 'Geral' && (
              <div className="qf-hst-rank-footer">
                Selecione um turno para abrir a análise das colhedoras
              </div>
            )}
          </div>

          {/* NOVA TABELA: INDICADORES POR FRENTE */}
          <div className="qf-hst-rank-card">
            <div className="qf-hst-rank-titlebar">
              <h4>Indicadores por Frente</h4>
              <span>{processamento.frenteList.length} frentes</span>
            </div>

            <div className="qf-hst-rank-table">
              <div className="qf-hst-rank-grid qf-hst-rank-grid--front qf-hst-rank-head">
                <span>#</span>
                <span>Frente</span>
                <span>Pts</span>
                <span>Perda</span>
                <span>Pisot.S</span>
                <span>Pisot.D</span>
                <span>Arran.</span>
              </div>

              <div className="qf-hst-rank-body custom-scrollbar">
                {processamento.frenteList.length === 0 ? (
                  <div className="qf-hst-rank-empty">Sem apontamentos por frente</div>
                ) : (
                  processamento.frenteList.map((r, idx) => (
                    <div key={`${r.frente}-${idx}`} className="qf-hst-rank-grid qf-hst-rank-grid--front qf-hst-rank-row">
                      <div className="qf-hst-rank-position">{getMedalIcon(idx + 1)}</div>
                      <span className="qf-hst-rank-name" title={r.frente}>{r.frente}</span>
                      <span className="qf-hst-rank-points">{r.pontos}</span>
                      <span
                        className="qf-hst-rank-value"
                        style={{ color: r.perda === null ? '#94a3b8' : getStatusColor(r.perda, metas.perda) }}
                      >
                        {r.perda !== null ? `${formatValue(r.perda)}%` : '-'}
                      </span>
                      <span
                        className="qf-hst-rank-value"
                        style={{ color: r.pSimples === null ? '#94a3b8' : getStatusColor(r.pSimples, metas.pisoteio_simples) }}
                      >
                        {r.pSimples !== null ? `${formatValue(r.pSimples)}%` : '-'}
                      </span>
                      <span
                        className="qf-hst-rank-value"
                        style={{ color: r.pDuplo === null ? '#94a3b8' : getStatusColor(r.pDuplo, metas.pisoteio_duplo) }}
                      >
                        {r.pDuplo !== null ? `${formatValue(r.pDuplo)}%` : '-'}
                      </span>
                      <span
                        className="qf-hst-rank-value qf-hst-rank-value--last"
                        style={{ color: r.arranquio === null ? '#94a3b8' : getStatusColor(r.arranquio, metas.arranquio) }}
                      >
                        {r.arranquio !== null ? `${formatValue(r.arranquio)}%` : '-'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* GRÁFICO CATEGORIAS */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mt-4"><h4 className="text-[10px] font-black text-[var(--q-dark)] uppercase tracking-widest border-b border-slate-100 pb-2 mb-4">Média de Categorias na Safra</h4><div className="overflow-x-auto custom-scrollbar"><div className="min-w-[500px] h-[220px]"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={processamento.chartCatData} margin={{ top: 20, right: 10, left: 0, bottom: 20 }}><XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} tick={<CustomXAxisTick />} /><YAxis hide domain={[0, dataMax => dataMax * 1.2]} /><Tooltip content={<CustomCatTooltip />} cursor={{fill: 'rgba(241, 245, 249, 0.4)'}} /><Bar dataKey="atual" barSize={32} radius={[6, 6, 0, 0]}>{processamento.chartCatData.map((entry, index) => <Cell key={`cell-${index}`} fill={getGradientColor(entry.atual, processamento.minCat, processamento.maxCat)} />)}<LabelList dataKey="atual" position="top" formatter={(val) => formatValue(val, 3)} style={{ fontSize: '9px', fontWeight: '900', fill: '#475569' }} /></Bar></ComposedChart></ResponsiveContainer></div></div></div>
        </div>
      )}

      {selectedMachineToView && <PerdaMecDetailRankEquip colhedora={parseColhedora(selectedMachineToView.colhedora)} ano={activeYear} initialShift={selectedMachineToView.turno} onClose={() => setSelectedMachineToView(null)} />}
    </div>
  );
};

export default PerdaMecDetailHst;
