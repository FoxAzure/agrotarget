// ================================= DOCUMENTATION ------------------------------------------
// Script: PerdaMecDetailCampo
// Purpose: Tela de Análise de Perdas por Campo com barra de busca, modal de pontos recentes e seletor de turno.
// Relationships: vw_q_perdamec_campo, vw_q_perdamecgeral, vw_q_perdamec_ano, rulesPerdaMec
// ==========================================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import YearSelectorQualyFlow from '../../../components/QualyFlow/YearSelectorQualyFlow';
import { getMetasParaData, getStatusColor } from '../../../components/QualyFlow/rulesPerdaMec';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

// ================================= HELPERS ------------------------------------------------

const formatValue = (value, decimals = 2) => {
  if (value === null || value === undefined || value === '') return '-';
  const number = Number(value);
  return Number.isNaN(number) ? '-' : number.toFixed(decimals).replace('.', ',');
};

const formatShortDate = (isoDate) => {
  if (!isoDate) return '-';
  const [y, m, d] = isoDate.split(' ')[0].split('-');
  return `${d}/${m}/${y}`;
};

const formatDayMonth = (isoDate) => {
  if (!isoDate) return '-';
  const [y, m, d] = isoDate.split(' ')[0].split('-');
  return `${d}/${m}`;
};

const parseColhedora = (fullName) => {
  if (!fullName) return { shortName: 'DESC' };
  return { shortName: fullName.split(' - ')[0].trim() };
};

const getShiftStyle = (turnoStr) => {
  const t = String(turnoStr || '').toLowerCase();
  if (t.includes('1º') || t.includes('1')) {
    return { card: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-800', tag: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
  }
  if (t.includes('2º') || t.includes('2')) {
    return { card: 'bg-blue-50 border-blue-200', text: 'text-blue-800', tag: 'bg-blue-100 text-blue-700 border-blue-200' };
  }
  return { card: 'bg-white border-slate-200', text: 'text-[var(--q-dark)]', tag: 'bg-slate-100 text-slate-500 border-slate-200' };
};

const CompareTriangle = ({ current, previous }) => {
  if (current === null || previous === null || current === undefined || previous === undefined) return <span className="text-[10px] text-slate-300 font-bold">-</span>;
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

const safeNum = (val) => (val !== null && val !== undefined && val !== '') ? Number(val) : null;

const CustomXAxisTick = ({ x, y, payload }) => {
  const words = payload.value.split(' ');
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} textAnchor="middle" fill="#64748b" fontSize={9} fontWeight={900}>
        <tspan x={0} dy="12">{words[0]}</tspan>
        {words.slice(1).length > 0 && <tspan x={0} dy="11">{words.slice(1).join(' ')}</tspan>}
      </text>
    </g>
  );
};

// ================================= COMPONENTES INTERNOS -----------------------------------

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
        <span className="text-[10px] font-black text-slate-700 uppercase text-center border-b border-slate-100 pb-1 mb-2">
          {payload[0].payload.name}
        </span>
        <div className="flex justify-between items-center px-1">
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Safra</span>
            <span className="text-[11px] font-black text-slate-500">{formatValue(valAnt, 3)}</span>
          </div>
          <div className="flex items-center justify-center pt-3">
            <CompareTriangle current={valAtual} previous={valAnt} />
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-bold text-[var(--q-dark)] uppercase tracking-widest">Campo</span>
            <span className="text-[11px] font-black text-[var(--q-dark)]">{formatValue(valAtual, 3)}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// ================================= MODAL DE DETALHES DO CAMPO =============================

const ModalDetalheCampo = ({ campoInfo, activeYear, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState([]);
  const [yearData, setYearData] = useState(null);
  const [selectedPonto, setSelectedPonto] = useState(null);
  
  // Controle de filtro das colhedoras
  const [localShift, setLocalShift] = useState('Todos');
  const turnos = ['Todos', '1º Turno', '2º Turno'];

  const metas = useMemo(() => getMetasParaData(`${activeYear}-12-31`), [activeYear]);

  // Busca Dados Gerais
  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const [resPontos, resAno] = await Promise.all([
          supabase.from('vw_q_perdamecgeral')
            .select('*')
            .eq('ano', activeYear)
            .eq('codigo_campo', String(campoInfo.codigo_campo).trim()),
          supabase.from('vw_q_perdamec_ano')
            .select('*')
            .eq('ano', activeYear)
            .maybeSingle()
        ]);
        if (mounted) {
          setRawData(resPontos.data || []);
          setYearData(resAno.data || null);
        }
      } catch (err) { 
        console.error("Erro na busca:", err); 
      } finally { 
        if (mounted) setLoading(false); 
      }
    };
    loadData();
    return () => { mounted = false; };
  }, [campoInfo, activeYear]);

  // Processamento Base (Pontos e Gráfico Categoria)
  const processamento = useMemo(() => {
    if (!rawData) return null;

    const listaPontosFormatada = [];

    rawData.forEach(r => {
      const per = (Number(r.total_perda) + Number(r.tch_estimado)) > 0 ? (Number(r.total_perda) / (Number(r.total_perda) + Number(r.tch_estimado))) * 100 : null;
      const pis = Number(r.av_pisoteio) > 0 ? (Number(r.mt_pisoteio) / Number(r.av_pisoteio)) * 100 : null;
      const arr = Number(r.tocos_fixos) > 0 ? (Number(r.tocos_arrancados) / Number(r.tocos_fixos)) * 100 : null;
      const metaPisot = String(r.espacamento).toLowerCase() === 'simples' ? metas.pisoteio_simples : metas.pisoteio_duplo;
      
      listaPontosFormatada.push({ ...r, calcPerda: per, calcPisot: pis, calcArranquio: arr, metaPisot });
    });

    // Ordena do mais recente para o mais antigo
    listaPontosFormatada.sort((a, b) => new Date(b.data_hora) - new Date(a.data_hora));

    const categoriasBase = [
      { key: 'cat_canaponta', label: 'Cana Ponta' }, { key: 'cat_toco', label: 'Toco' },
      { key: 'cat_pedacofixo', label: 'Pedaço Fixo' }, { key: 'cat_canainteira', label: 'Cana Inteira' },
      { key: 'cat_toleterepicado', label: 'Tolete Repicado' }, { key: 'cat_estilhaco', label: 'Estilhaço' },
      { key: 'cat_lascas', label: 'Lascas' }, { key: 'cat_pedacosolto', label: 'Pedaço Solto' }
    ];

    const yData = yearData || {};
    const chartCatData = categoriasBase.map(cat => ({
      name: cat.label,
      atual: Number(campoInfo[cat.key]) || 0,
      ant: Number(yData[cat.key]) || 0
    })).sort((a, b) => b.atual - a.atual);

    const minCat = chartCatData.length > 0 ? Math.min(...chartCatData.map(d => d.atual)) : 0;
    const maxCat = chartCatData.length > 0 ? Math.max(...chartCatData.map(d => d.atual)) : 0;

    return { listaPontos: listaPontosFormatada, chartCatData, minCat, maxCat };
  }, [rawData, yearData, campoInfo, metas]);

  // Processamento Dinâmico das Colhedoras baseado no Filtro de Turno
  const colhedorasFiltradas = useMemo(() => {
    if (!processamento) return [];
    
    const pontosFiltrados = localShift === 'Todos' 
      ? processamento.listaPontos 
      : processamento.listaPontos.filter(p => p.turno === localShift);
      
    const mapColhedoras = new Map();

    pontosFiltrados.forEach(p => {
      const cName = parseColhedora(p.colhedora).shortName;
      if (!mapColhedoras.has(cName)) {
        mapColhedoras.set(cName, { nome: cName, sPerd:0, sTch:0, sMt:0, sAv:0, sTArr:0, sTFix:0, lastEsp: p.espacamento });
      }
      const c = mapColhedoras.get(cName);
      c.sPerd += Number(p.total_perda) || 0;
      c.sTch += Number(p.tch_estimado) || 0;
      c.sMt += Number(p.mt_pisoteio) || 0;
      c.sAv += Number(p.av_pisoteio) || 0;
      c.sTArr += Number(p.tocos_arrancados) || 0;
      c.sTFix += Number(p.tocos_fixos) || 0;
      c.lastEsp = p.espacamento; // Pega o último espaçamento operado
    });

    return Array.from(mapColhedoras.values()).map(c => {
      const isSimples = String(c.lastEsp).toLowerCase() === 'simples';
      return {
        nome: c.nome,
        perda: (c.sPerd + c.sTch) > 0 ? (c.sPerd / (c.sPerd + c.sTch)) * 100 : null,
        pisot: c.sAv > 0 ? (c.sMt / c.sAv) * 100 : null,
        arranquio: c.sTFix > 0 ? (c.sTArr / c.sTFix) * 100 : null,
        metaPisot: isSimples ? metas.pisoteio_simples : metas.pisoteio_duplo
      };
    }).sort((a,b) => (b.perda || 0) - (a.perda || 0)); // Ordena colhedoras com mais perda no topo
  }, [processamento, localShift, metas]);

  // Variaveis do Sub-modal do Ponto
  let catListPonto = [];
  if (selectedPonto) {
    catListPonto = [
      { label: 'Cana Ponta', val: Number(selectedPonto.cat_canaponta) || 0 },
      { label: 'Tolete Rep.', val: Number(selectedPonto.cat_toleterepicado) || 0 },
      { label: 'Toco', val: Number(selectedPonto.cat_toco) || 0 },
      { label: 'Estilhaço', val: Number(selectedPonto.cat_estilhaco) || 0 },
      { label: 'Pedaço Fixo', val: Number(selectedPonto.cat_pedacofixo) || 0 },
      { label: 'Lascas', val: Number(selectedPonto.cat_lascas) || 0 },
      { label: 'Cana Inteira', val: Number(selectedPonto.cat_canainteira) || 0 },
      { label: 'Pedaço Solto', val: Number(selectedPonto.cat_pedacosolto) || 0 }
    ].sort((a, b) => b.val - a.val);
  }
  const minCatPonto = catListPonto.length > 0 ? Math.min(...catListPonto.map(c => c.val)) : 0;
  const maxCatPonto = catListPonto.length > 0 ? Math.max(...catListPonto.map(c => c.val)) : 0;
  const pShiftStyle = selectedPonto ? getShiftStyle(selectedPonto.turno) : {};

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200" onClick={onClose}>
      <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        
        {/* ======================= TELA 1: DETALHE DO CAMPO ======================= */}
        {!selectedPonto ? (
          <div className="flex flex-col flex-1 min-h-0 animate-in slide-in-from-left-4 duration-300">
            
            {/* Header Redesenhado */}
            <div className="p-4 md:p-5 border-b border-slate-200 bg-white shrink-0">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resultado Detalhado</span>
                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-500 font-bold transition-colors">✕</button>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <h3 className="text-xl md:text-3xl font-black text-[var(--q-dark)] uppercase leading-none tracking-tight flex items-center gap-2">
                    {campoInfo.campo}
                  </h3>
                  <span className="text-[10px] md:text-[11px] font-bold text-slate-500 uppercase mt-1.5">
                    <strong className="text-slate-700">{campoInfo.setor}</strong> &nbsp;•&nbsp; <strong className="text-slate-700">{campoInfo.depa}</strong>
                  </span>
                </div>
                
                {/* Bloco de Datas Alinhado à Direita */}
                <div className="flex flex-col items-end bg-slate-50 p-2.5 rounded-lg border border-slate-100 min-w-[130px] shadow-sm">
                  <div className="flex justify-between w-full items-center gap-4">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Data Início:</span>
                    <strong className="text-[10px] font-black text-slate-700">{formatShortDate(campoInfo.dt_inicio)}</strong>
                  </div>
                  <div className="flex justify-between w-full items-center gap-4 mt-1 pt-1 border-t border-slate-200/60">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Data Final:</span>
                    <strong className="text-[10px] font-black text-slate-700">{formatShortDate(campoInfo.dt_final)}</strong>
                  </div>
                </div>
              </div>
            </div>

            {loading || !processamento ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Buscando Detalhes...</span>
              </div>
            ) : (
              <div className="p-4 md:p-5 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-5">
                
                {/* Indicadores do Campo */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <div className="flex justify-between items-end border-b border-slate-200 pb-2 mb-2 px-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Indicador</span>
                    <div className="flex gap-4 md:gap-8 pr-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-[var(--q-dark)] text-right w-12">Campo</span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-12">Safra</span>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <TopKpiRow label="Perdas" valAtual={safeNum(campoInfo.perda_perc)} valAnt={safeNum(yearData?.perda_perc)} meta={metas.perda} />
                    <TopKpiRow label="Pisoteio Simples" valAtual={safeNum(campoInfo.pisoteio_simples_perc)} valAnt={safeNum(yearData?.pisoteio_simples_perc)} meta={metas.pisoteio_simples} />
                    <TopKpiRow label="Pisoteio Duplo" valAtual={safeNum(campoInfo.pisoteio_duplo_perc)} valAnt={safeNum(yearData?.pisoteio_duplo_perc)} meta={metas.pisoteio_duplo} />
                    <TopKpiRow label="Arranquio" valAtual={safeNum(campoInfo.arranquio_perc)} valAnt={safeNum(yearData?.arranquio_perc)} meta={metas.arranquio} />
                  </div>
                </div>

                {/* Gráfico Categorias */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <h4 className="text-[10px] font-black text-[var(--q-dark)] uppercase tracking-widest border-b border-slate-100 pb-2 mb-4">Média de Categorias (Campo vs Safra)</h4>
                  <div className="overflow-x-auto custom-scrollbar pb-2">
                    <div style={{ width: '100%', height: 220, minWidth: 500 }}>
                      <ResponsiveContainer width="100%" height={220}>
                        <ComposedChart data={processamento.chartCatData} margin={{ top: 20, right: 10, left: 0, bottom: 20 }}>
                          <XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} tick={<CustomXAxisTick />} />
                          <YAxis hide domain={[0, dataMax => dataMax * 1.2]} />
                          <Tooltip content={<CustomCatTooltip />} cursor={{fill: 'rgba(241, 245, 249, 0.4)'}} />
                          
                          <Bar dataKey="atual" barSize={32} radius={[6, 6, 0, 0]}>
                            {processamento.chartCatData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={getGradientColor(entry.atual, processamento.minCat, processamento.maxCat)} />
                            ))}
                            <LabelList dataKey="atual" position="top" formatter={(val) => formatValue(val, 3)} style={{ fontSize: '9px', fontWeight: '900', fill: '#475569' }} />
                          </Bar>
                          {processamento.chartCatData.some(d => d.ant > 0) && (
                            <Line dataKey="ant" type="monotone" stroke="#94a3b8" strokeWidth={2} dot={{ r: 3, fill: '#94a3b8', stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false} />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* ========================================================= */}
                {/* LISTA PONTO A PONTO */}
                {/* ========================================================= */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
                  <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-[var(--q-dark)] uppercase tracking-widest px-1">Histórico de Avaliações ({processamento.listaPontos.length})</h4>
                  </div>
                  
                  {/* Cabeçalho da Tabela */}
                  <div className="grid grid-cols-[35px_30px_50px_1fr_1fr_1fr] md:grid-cols-[45px_35px_60px_1fr_1fr_1fr] gap-2 px-3 py-2 bg-slate-50 border-b-2 border-slate-100 cursor-default">
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 self-center">Data</span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 self-center">Lote</span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 self-center text-center">Turno</span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center self-center">Perda</span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center self-center">Pisot.</span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-right self-center">Arran.</span>
                  </div>
                  
                  {/* Scroll de Pontos */}
                  <div className="flex flex-col max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                    {processamento.listaPontos.length === 0 ? (
                      <div className="py-8 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nenhum ponto registrado</div>
                    ) : (
                      processamento.listaPontos.map((p, idx) => {
                        const shiftStyle = getShiftStyle(p.turno);
                        return (
                          <div key={idx} onClick={() => setSelectedPonto(p)} className="grid grid-cols-[35px_30px_50px_1fr_1fr_1fr] md:grid-cols-[45px_35px_60px_1fr_1fr_1fr] gap-2 px-2 py-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-50 last:border-0 group">
                            
                            <span className="text-[9px] md:text-[10px] font-black text-slate-400 self-center">{formatDayMonth(p.data_apontamento)}</span>
                            <span className="text-[11px] font-black text-slate-600 self-center group-hover:text-[var(--q-orange)]">{p.lote || '-'}</span>
                            
                            <div className="flex justify-center items-center">
                              <span className={`text-[8px] md:text-[9px] font-black uppercase text-center rounded px-1 py-0.5 border ${shiftStyle.tag}`}>
                                {String(p.turno).replace('Turno', 'T')}
                              </span>
                            </div>

                            <span className="text-[11px] font-black text-center self-center" style={{ color: getStatusColor(p.calcPerda, metas.perda) }}>{formatValue(p.calcPerda)}%</span>
                            <span className="text-[11px] font-black text-center self-center" style={{ color: getStatusColor(p.calcPisot, p.metaPisot) }}>{p.calcPisot !== null ? `${formatValue(p.calcPisot)}%` : '-'}</span>
                            <span className="text-[11px] font-black text-right self-center" style={{ color: getStatusColor(p.calcArranquio, metas.arranquio) }}>{p.calcArranquio !== null ? `${formatValue(p.calcArranquio)}%` : '-'}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {processamento.listaPontos.length > 0 && (
                    <div className="bg-slate-100 py-1.5 px-3 border-t border-slate-200">
                      <span className="text-[10px] font-bold text-slate-400 block text-center">Clique em um ponto para abrir os detalhes</span>
                    </div>
                  )}
                </div>

                {/* ========================================================= */}
                {/* RESUMO DAS COLHEDORAS COM FILTRO */}
                {/* ========================================================= */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
                  
                  {/* Header e Toggle de Turnos */}
                  <div className="p-3 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <h4 className="text-[10px] font-black text-[var(--q-dark)] uppercase tracking-widest px-1">Resumo das Colhedoras</h4>
                    
                    <div className="flex bg-slate-200/60 p-1 rounded-lg">
                      {turnos.map(t => (
                        <button
                          key={t}
                          onClick={() => setLocalShift(t)}
                          className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-md transition-all ${localShift === t ? 'bg-[var(--q-dark)] text-white shadow' : 'text-slate-500 hover:bg-slate-300'}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tabela de Colhedoras */}
                  <div className="grid grid-cols-[1fr_50px_50px_50px] md:grid-cols-[1fr_65px_65px_65px] gap-2 px-3 py-2 bg-slate-50 border-b-2 border-slate-100 cursor-default">
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 self-center">Máquina</span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center self-center">Perda</span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center self-center">Pisot.</span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-right self-center">Arran.</span>
                  </div>
                  
                  <div className="flex flex-col p-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {colhedorasFiltradas.length === 0 ? (
                      <div className="py-8 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nenhuma colhedora neste turno</div>
                    ) : (
                      colhedorasFiltradas.map((c, idx) => (
                        <div key={idx} className="grid grid-cols-[1fr_50px_50px_50px] md:grid-cols-[1fr_65px_65px_65px] gap-2 px-2 py-3 rounded-lg border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                          <span className="text-[11px] font-black text-slate-700 self-center truncate">{c.nome}</span>
                          <span className="text-[11px] font-black text-center self-center" style={{ color: getStatusColor(c.perda, metas.perda) }}>{formatValue(c.perda)}%</span>
                          <span className="text-[11px] font-black text-center self-center" style={{ color: getStatusColor(c.pisot, c.metaPisot) }}>{c.pisot !== null ? `${formatValue(c.pisot)}%` : '-'}</span>
                          <span className="text-[11px] font-black text-right self-center" style={{ color: getStatusColor(c.arranquio, metas.arranquio) }}>{c.arranquio !== null ? `${formatValue(c.arranquio)}%` : '-'}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
        ) : (
          
          /* ======================= TELA 2: SUB-MODAL DETALHE DO PONTO ======================= */
          <div className="flex flex-col flex-1 min-h-0 animate-in slide-in-from-right-4 duration-300">
            <div className="p-3 md:p-4 border-b border-slate-200 bg-white shrink-0 flex items-center justify-between shadow-sm z-10">
              <button onClick={() => setSelectedPonto(null)} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 hover:text-[var(--q-dark)] hover:bg-slate-50 shadow-sm transition-colors px-3 py-1.5 rounded-lg">
                <span className="text-[10px] font-black uppercase tracking-widest">Voltar</span>
              </button>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Detalhe do Ponto</span>
            </div>

            <div className="p-4 md:p-5 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className={`flex flex-col items-center justify-center rounded-xl p-4 shadow-sm border ${pShiftStyle.card}`}>
                  <span className={`text-[10px] font-bold uppercase tracking-widest opacity-60 ${pShiftStyle.text}`}>Lote</span>
                  <span className={`text-4xl md:text-5xl font-black leading-none my-1 ${pShiftStyle.text}`}>{selectedPonto.lote || '-'}</span>
                  <div className="flex flex-col items-center gap-0.5 mt-2">
                    <span className={`text-[10px] md:text-[11px] font-black uppercase text-center ${pShiftStyle.text}`}>{parseColhedora(selectedPonto.colhedora).shortName}</span>
                    <span className={`text-[9px] font-bold uppercase opacity-80 ${pShiftStyle.text}`}>{selectedPonto.turno}</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-black text-[var(--q-dark)] uppercase tracking-widest">Perda</span>
                    <div className="flex flex-col items-end">
                      <span className="text-[14px] font-black" style={{ color: getStatusColor(selectedPonto.calcPerda, metas.perda) }}>
                        {formatValue(selectedPonto.calcPerda)}%
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Ponto</span>
                    </div>
                  </div>
                  <div className="flex justify-center my-1.5">
                    <CompareTriangle daily={selectedPonto.calcPerda} yearly={safeNum(campoInfo.perda_perc)} />
                  </div>
                  <div className="flex justify-between items-end border-t border-slate-100 pt-2">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-black text-slate-600">{formatValue(selectedPonto.total_perda)}</span>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Kg Totais</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[11px] font-black text-slate-400">{formatValue(campoInfo.perda_perc)}%</span>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Média Campo</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-end border-b border-slate-100 pb-2 mb-3">
                  <span className="text-[10px] font-black text-[var(--q-dark)] uppercase tracking-widest">Categorias</span>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Média Kg</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {catListPonto.map((c, i) => (
                    <div key={i} className="flex justify-between items-center bg-slate-50 px-2 py-1.5 rounded border border-slate-100/50">
                      <span className="text-[10px] font-bold text-slate-500">{c.label}</span>
                      <span className="text-[12px] font-black" style={{ color: getGradientColor(c.val, minCatPonto, maxCatPonto) }}>
                        {formatValue(c.val, 2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col">
                  <div className="flex justify-between items-end border-b border-slate-100 pb-2 mb-3">
                    <span className="text-[10px] font-black text-[var(--q-dark)] uppercase tracking-widest">Pisoteio</span>
                    <span className="text-[11px] font-black" style={{ color: getStatusColor(selectedPonto.calcPisot, selectedPonto.metaPisot) }}>
                      {selectedPonto.calcPisot !== null ? `${formatValue(selectedPonto.calcPisot)}%` : '-'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center"><span className="text-[9px] font-bold text-slate-400 uppercase">Mts Aval.</span><span className="text-[11px] font-black text-slate-600">{formatValue(selectedPonto.av_pisoteio)}</span></div>
                    <div className="flex justify-between items-center"><span className="text-[9px] font-bold text-slate-400 uppercase">Mts Pisot.</span><span className="text-[11px] font-black text-slate-600">{formatValue(selectedPonto.mt_pisoteio)}</span></div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col">
                  <div className="flex justify-between items-end border-b border-slate-100 pb-2 mb-3">
                    <span className="text-[10px] font-black text-[var(--q-dark)] uppercase tracking-widest">Arranquio</span>
                    <span className="text-[11px] font-black" style={{ color: getStatusColor(selectedPonto.calcArranquio, metas.arranquio) }}>
                      {selectedPonto.calcArranquio !== null ? `${formatValue(selectedPonto.calcArranquio)}%` : '-'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center"><span className="text-[9px] font-bold text-slate-400 uppercase">Fixo</span><span className="text-[11px] font-black text-slate-600">{selectedPonto.tocos_fixos || 0}</span></div>
                    <div className="flex justify-between items-center"><span className="text-[9px] font-bold text-slate-400 uppercase">Arranc.</span><span className="text-[11px] font-black text-slate-600">{selectedPonto.tocos_arrancados || 0}</span></div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};

// ================================= EXECUTOR PRINCIPAL (TELA DE CAMPOS) ====================

const PerdaMecDetailCampo = () => {
  const [activeYear, setActiveYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);
  const [loading, setLoading] = useState(false);
  const [camposData, setCamposData] = useState([]);
  const [selectedCampo, setSelectedCampo] = useState(null);
  const [busca, setBusca] = useState(''); // Estado para o SearchBar

  const metas = useMemo(() => getMetasParaData(`${activeYear}-12-31`), [activeYear]);

  // 1. Busca Anos Disponíveis
  useEffect(() => {
    let mounted = true;
    const fetchYears = async () => {
      try {
        const { data } = await supabase.from('vw_q_perdamec_ano').select('ano');
        if (mounted && data) {
          const uniqueYears = [...new Set(data.map(r => r.ano))].sort((a, b) => b - a);
          setAvailableYears(uniqueYears);
          if (uniqueYears.length > 0 && !uniqueYears.includes(activeYear)) setActiveYear(uniqueYears[0]);
        }
      } catch (err) { console.error(err); }
    };
    fetchYears();
    return () => { mounted = false; };
  }, [activeYear]);

  // 2. Busca Campos da Safra (Ordenado pelos Últimos Avaliados)
  useEffect(() => {
    let mounted = true;
    const fetchCampos = async () => {
      if (!activeYear) return;
      setLoading(true);
      try {
        const { data } = await supabase.from('vw_q_perdamec_campo').select('*').eq('ano', activeYear).order('dt_final', { ascending: false });
        if (mounted) setCamposData(data || []);
      } catch (err) { console.error(err); } 
      finally { if (mounted) setLoading(false); }
    };
    fetchCampos();
    return () => { mounted = false; };
  }, [activeYear]);

  // Aplica o Filtro de Busca
  const camposFiltrados = useMemo(() => {
    if (!busca) return camposData;
    return camposData.filter(c => c.campo.toLowerCase().includes(busca.toLowerCase()));
  }, [camposData, busca]);

  return (
    <div className="flex flex-col gap-6 w-full animate-in slide-in-from-bottom-4 duration-500 pb-10">
      
      <div className="flex flex-col items-center">
        <YearSelectorQualyFlow value={activeYear} onChange={setActiveYear} availableYears={availableYears} isLoading={loading} />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 mt-4">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Carregando Campos...</span>
        </div>
      ) : camposData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white border border-dashed border-slate-200 rounded-xl mt-4 shadow-sm">
          <span className="text-4xl opacity-40 mb-4 grayscale">🌾</span>
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Nenhum campo avaliado nesta safra</h3>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col mt-2">
          
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-black text-[var(--q-dark)] uppercase tracking-widest">Campos Avaliados</h4>
              <span className="bg-slate-200 text-slate-500 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">{camposFiltrados.length} Campos</span>
            </div>
            
            {/* Barra de Busca Slim */}
            <div className="relative flex items-center w-full">
              <span className="absolute left-3 text-slate-400 pointer-events-none text-xs">🔍</span>
              <input 
                type="text" 
                placeholder="Pesquisar campo..." 
                className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-[11px] font-bold text-slate-600 outline-none placeholder:text-slate-300 focus:border-[var(--q-green)] focus:ring-1 focus:ring-[var(--q-green)] transition-all"
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-[1fr_45px_45px_45px] md:grid-cols-[1fr_60px_60px_60px] gap-2 px-3 py-2 bg-slate-50 border-b-2 border-slate-100 cursor-default">
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 self-center">Campo</span>
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center self-center">Perda</span>
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center self-center">Pisot.</span>
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-right self-center">Arran.</span>
          </div>
          
          <div className="flex flex-col p-1 overflow-y-auto custom-scrollbar max-h-[600px]">
            {camposFiltrados.length === 0 ? (
              <div className="py-8 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nenhum campo encontrado</div>
            ) : (
              camposFiltrados.map((c, idx) => {
                // Cálculo dinâmico do pisoteio principal (o maior percentual para exibição ou uma média simples se tiver ambos)
                // Na listagem principal, como os dados já vem separados por duplo/simples, vamos tentar mostrar o que foi avaliado
                let pisotValor = null;
                let metaPisotList = metas.pisoteio_duplo;
                if (c.pisoteio_simples_perc !== null && c.pisoteio_duplo_perc !== null) {
                  pisotValor = c.pisoteio_duplo_perc; // Se houver ambos, assume o duplo como default para resumo ou calcula média.
                } else if (c.pisoteio_simples_perc !== null) {
                  pisotValor = c.pisoteio_simples_perc;
                  metaPisotList = metas.pisoteio_simples;
                } else if (c.pisoteio_duplo_perc !== null) {
                  pisotValor = c.pisoteio_duplo_perc;
                }

                return (
                  <div 
                    key={idx} 
                    onClick={() => setSelectedCampo(c)}
                    className="grid grid-cols-[1fr_45px_45px_45px] md:grid-cols-[1fr_60px_60px_60px] gap-2 px-2 py-3 rounded-lg border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer group"
                  >
                    {/* Aqui tiramos o Setor de baixo! */}
                    <div className="flex flex-col justify-center overflow-hidden">
                      <span className="text-[11px] md:text-[12px] font-black text-slate-700 truncate group-hover:text-[var(--q-green)] transition-colors">{c.campo}</span>
                    </div>
                    
                    <span className="text-[11px] font-black text-center self-center" style={{ color: getStatusColor(c.perda_perc, metas.perda) }}>{c.perda_perc !== null ? `${formatValue(c.perda_perc)}%` : '-'}</span>
                    <span className="text-[11px] font-black text-center self-center" style={{ color: getStatusColor(pisotValor, metaPisotList) }}>{pisotValor !== null ? `${formatValue(pisotValor)}%` : '-'}</span>
                    <span className="text-[11px] font-black text-right self-center" style={{ color: getStatusColor(c.arranquio_perc, metas.arranquio) }}>{c.arranquio_perc !== null ? `${formatValue(c.arranquio_perc)}%` : '-'}</span>
                  </div>
                );
              })
            )}
          </div>

          <div className="bg-slate-100 py-1.5 px-3 border-t border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 block text-center">Clique em um campo para abrir a análise detalhada</span>
          </div>

        </div>
      )}

      {selectedCampo && (
        <ModalDetalheCampo 
          campoInfo={selectedCampo} 
          activeYear={activeYear} 
          onClose={() => setSelectedCampo(null)} 
        />
      )}
    </div>
  );
};

export default PerdaMecDetailCampo;