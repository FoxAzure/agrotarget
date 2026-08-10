// ================================= DOCUMENTATION ------------------------------------------
// Script: PerdaMecDetailDiarioColhedora
// Purpose: Modal avançado para exibir detalhes de perdas de uma colhedora específica, 
// com filtro de turnos inteligente, gráfico integrado e separação de pontos por campo (sanfona).
// ==========================================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { getStatusColor } from '../../../components/QualyFlow/rulesPerdaMec';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

// ================================= HELPERS ------------------------------------------------

const formatValue = (value, decimals = 2) => {
  if (value === null || value === undefined || value === '') return '-';
  const number = Number(value);
  return Number.isNaN(number) ? '-' : number.toFixed(decimals).replace('.', ',');
};

const formatShortDate = (isoDate) => {
  if (!isoDate) return '-';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
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

const getShiftStyle = (turnoStr) => {
  const t = String(turnoStr || '').toLowerCase();
  if (t.includes('1º') || t.includes('1')) {
    return {
      card: 'bg-yellow-50 border-yellow-200',
      text: 'text-yellow-800',
      tag: 'bg-yellow-100 text-yellow-700 border-yellow-200'
    };
  }
  if (t.includes('2º') || t.includes('2')) {
    return {
      card: 'bg-blue-50 border-blue-200',
      text: 'text-blue-800',
      tag: 'bg-blue-100 text-blue-700 border-blue-200'
    };
  }
  return {
    card: 'bg-white border-slate-200',
    text: 'text-[var(--q-dark)]',
    tag: 'bg-slate-100 text-slate-500 border-slate-200'
  };
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
          <span className="text-[10px] font-bold text-slate-400">Máquina (Turno)</span>
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

const KpiCard = ({ title, valDia, valAno, meta }) => {
  if (valDia === null && valAno === null) {
    return (
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex flex-col justify-center items-center shadow-sm h-full">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">{title}</span>
        <span className="text-xs font-bold text-slate-400 mt-2">Não Avaliado</span>
      </div>
    );
  }
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center justify-between shadow-sm gap-2 h-full">
      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">{title}</span>
      <div className="flex flex-col items-center leading-none">
        <span className="text-[10px] font-bold text-slate-400 mb-0.5">Dia</span>
        <span className="text-xl font-black" style={{ color: getStatusColor(valDia, meta) }}>
          {valDia !== null ? `${formatValue(valDia)}%` : '-'}
        </span>
      </div>
      <div className="flex items-center gap-1 w-full justify-center">
        <div className="w-4"><CompareTriangle daily={valDia} yearly={valAno} /></div>
      </div>
      <div className="flex flex-col items-center leading-none">
        <span className="text-[14px] font-black" style={{ color: getStatusColor(valAno, meta) }}>
          {valAno !== null ? `${formatValue(valAno)}%` : '-'}
        </span>
        <span className="text-[9px] font-bold text-slate-400 mt-0.5">Safra</span>
      </div>
    </div>
  );
};

// ================================= EXECUTOR PRINCIPAL -------------------------------------

const PerdaMecDetailDiarioColhedora = ({ colhedora, initialShift, rawData, yearData, metas, selectedDate, onClose }) => {
  
  const [localShift, setLocalShift] = useState(initialShift || 'Todos');
  const [selectedPonto, setSelectedPonto] = useState(null);
  const [collapsedCampos, setCollapsedCampos] = useState({});
  const [toastMessage, setToastMessage] = useState(null);

  // Mapeia quais turnos essa colhedora realmente trabalhou neste dia
  const turnosDisponiveis = useMemo(() => {
    if (!colhedora || !rawData) return [];
    const dataColhedora = rawData.filter(r => parseColhedora(r.colhedora).shortName === colhedora.shortName);
    return Array.from(new Set(dataColhedora.map(r => r.turno)));
  }, [colhedora, rawData]);

  useEffect(() => {
    // Se o initialShift não existir pra essa máquina, joga pro 'Todos'
    if (initialShift !== 'Todos' && turnosDisponiveis.length > 0 && !turnosDisponiveis.includes(initialShift)) {
      setLocalShift('Todos');
    } else {
      setLocalShift(initialShift);
    }
  }, [initialShift, turnosDisponiveis]);

  const processamento = useMemo(() => {
    if (!colhedora || !rawData) return null;

    const dataColhedora = rawData.filter(r => parseColhedora(r.colhedora).shortName === colhedora.shortName);
    const dataFiltrada = localShift === 'Todos' ? dataColhedora : dataColhedora.filter(r => r.turno === localShift);
    
    if (dataFiltrada.length === 0) return { qtdPontos: 0 };

    let sPerd=0, sTch=0, sMtSimp=0, sAvSimp=0, sMtDup=0, sAvDup=0, sTocoArr=0, sTocoFix=0;
    const pontosPorCampo = {};

    dataFiltrada.forEach(r => {
      sPerd += Number(r.total_perda) || 0;
      sTch += Number(r.tch_estimado) || 0;
      sTocoArr += Number(r.tocos_arrancados) || 0;
      sTocoFix += Number(r.tocos_fixos) || 0;
      
      const esp = String(r.espacamento || '').toLowerCase();
      if (esp === 'simples') { sMtSimp += Number(r.mt_pisoteio) || 0; sAvSimp += Number(r.av_pisoteio) || 0; }
      else if (esp === 'duplo') { sMtDup += Number(r.mt_pisoteio) || 0; sAvDup += Number(r.av_pisoteio) || 0; }

      const per = (Number(r.total_perda) + Number(r.tch_estimado)) > 0 
        ? (Number(r.total_perda) / (Number(r.total_perda) + Number(r.tch_estimado))) * 100 : null;
      const pis = Number(r.av_pisoteio) > 0 
        ? (Number(r.mt_pisoteio) / Number(r.av_pisoteio)) * 100 : null;
      const arr = Number(r.tocos_fixos) > 0 
        ? (Number(r.tocos_arrancados) / Number(r.tocos_fixos)) * 100 : null;

      const metaPisot = String(r.espacamento).toLowerCase() === 'simples' ? metas.pisoteio_simples : metas.pisoteio_duplo;
      const campoNome = String(r.campo).trim();

      if (!pontosPorCampo[campoNome]) pontosPorCampo[campoNome] = [];
      pontosPorCampo[campoNome].push({ ...r, calcPerda: per, calcPisot: pis, calcArranquio: arr, metaPisot });
    });

    const kpisDia = {
      perda: sPerd + sTch > 0 ? (sPerd / (sPerd + sTch)) * 100 : null,
      pSimples: sAvSimp > 0 ? (sMtSimp / sAvSimp) * 100 : null,
      pDuplo: sAvDup > 0 ? (sMtDup / sAvDup) * 100 : null,
      arranquio: sTocoFix > 0 ? (sTocoArr / sTocoFix) * 100 : null
    };

    const kpisAno = {
      perda: yearData ? Number(yearData.perda_perc) : null,
      pSimples: yearData ? Number(yearData.pisoteio_simples_perc) : null,
      pDuplo: yearData ? Number(yearData.pisoteio_duplo_perc) : null,
      arranquio: yearData ? Number(yearData.arranquio_perc) : null,
    };

    const categoriasBase = [
      { key: 'cat_canaponta', label: 'Cana Ponta' }, { key: 'cat_toco', label: 'Toco' },
      { key: 'cat_pedacofixo', label: 'Pedaço Fixo' }, { key: 'cat_canainteira', label: 'Cana Inteira' },
      { key: 'cat_toleterepicado', label: 'Tolete Repicado' }, { key: 'cat_estilhaco', label: 'Estilhaço' },
      { key: 'cat_lascas', label: 'Lascas' }, { key: 'cat_pedacosolto', label: 'Pedaço Solto' }
    ];

    const chartData = categoriasBase.map(cat => {
      const somaDia = dataFiltrada.reduce((acc, r) => acc + (Number(r[cat.key]) || 0), 0);
      const mediaDia = dataFiltrada.length > 0 ? somaDia / dataFiltrada.length : 0;
      const mediaAno = yearData ? Number(yearData[cat.key]) || 0 : 0;
      return { name: cat.label, dia: mediaDia, ano: mediaAno };
    }).sort((a, b) => b.dia - a.dia);

    const minCat = Math.min(...chartData.map(d => d.dia));
    const maxCat = Math.max(...chartData.map(d => d.dia));

    return { qtdPontos: dataFiltrada.length, kpisDia, kpisAno, chartData, minCat, maxCat, pontosPorCampo };

  }, [colhedora, rawData, yearData, metas, localShift]);

  if (!colhedora || !processamento) return null;

  const toggleCampo = (campo) => {
    setCollapsedCampos(prev => ({ ...prev, [campo]: !prev[campo] }));
  };

  const handleShiftClick = (t) => {
    if (t !== 'Todos' && !turnosDisponiveis.includes(t)) {
      setToastMessage('Não realizado');
      setTimeout(() => setToastMessage(null), 2000);
      return;
    }
    setLocalShift(t);
  };

  const renderKpiCards = () => {
    const { kpisDia, kpisAno } = processamento;
    const hasSimples = kpisDia.pSimples !== null;
    const hasDuplo = kpisDia.pDuplo !== null;

    return (
      <div className={`grid gap-3 mb-6 ${hasSimples && hasDuplo ? 'grid-cols-4' : 'grid-cols-3'}`}>
        <KpiCard title="Perda" valDia={kpisDia.perda} valAno={kpisAno.perda} meta={metas.perda} />
        {!hasSimples && !hasDuplo && <KpiCard title="Pisoteio" valDia={null} valAno={null} meta={null} />}
        {hasSimples && <KpiCard title="P. Simples" valDia={kpisDia.pSimples} valAno={kpisAno.pSimples} meta={metas.pisoteio_simples} />}
        {hasDuplo && <KpiCard title="P. Duplo" valDia={kpisDia.pDuplo} valAno={kpisAno.pDuplo} meta={metas.pisoteio_duplo} />}
        <KpiCard title="Arranquio" valDia={kpisDia.arranquio} valAno={kpisAno.arranquio} meta={metas.arranquio} />
      </div>
    );
  };

  // Sub-modal: Cálculos de Gradiente para Categorias do Ponto
  let catList = [];
  if (selectedPonto) {
    catList = [
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
  const minCatPonto = catList.length > 0 ? Math.min(...catList.map(c => c.val)) : 0;
  const maxCatPonto = catList.length > 0 ? Math.max(...catList.map(c => c.val)) : 0;
  const pShiftStyle = selectedPonto ? getShiftStyle(selectedPonto.turno) : {};

  // ================================= VISUALIZAÇÃO PRINCIPAL ===============================

  return (
    <div 
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200" 
      onClick={onClose}
    >
      <div 
        className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]" 
        onClick={e => e.stopPropagation()}
      >
        
        {/* ======================= TELA 1: DASHBOARD DA COLHEDORA ======================= */}
        {!selectedPonto ? (
          // O flex-1 min-h-0 é o SEGREDO para garantir o scroll interno perfeitamente!
          <div className="flex flex-col flex-1 min-h-0 animate-in slide-in-from-left-4 duration-300">
            
            <div className="p-4 border-b border-slate-200 bg-white shrink-0">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Análise de Colhedora</span>
                <button 
                  onClick={onClose} 
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-500 font-bold transition-colors"
                >✕</button>
              </div>
              
              <div className="flex justify-between items-center mb-4">
                <div className="flex flex-col pr-4">
                  <h3 className="text-xl md:text-2xl font-black text-[var(--q-dark)] uppercase leading-none tracking-tight flex items-center gap-2">
                    {colhedora.shortName} <span className="text-slate-300 text-base md:text-lg font-bold">{formatShortDate(selectedDate)}</span>
                  </h3>
                  <span className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase mt-1 line-clamp-1">{colhedora.fullName}</span>
                </div>
                
                <div className="bg-[var(--q-green-soft)] text-[var(--q-green-dark)] px-4 py-2 rounded-xl flex flex-col items-center justify-center shadow-inner self-stretch shrink-0">
                  <span className="text-xl font-black leading-none">{processamento.qtdPontos}</span>
                  <span className="text-[9px] font-bold uppercase tracking-widest mt-0.5">Pnts</span>
                </div>
              </div>

              {/* TOGGLE DE TURNOS COM VALIDAÇÃO */}
              <div className="relative flex w-full bg-slate-100 p-1 rounded-xl shadow-inner border border-slate-200/60">
                
                {/* Toast Animado ("Não realizado") */}
                {toastMessage && (
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[var(--q-danger)] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg shadow-lg pointer-events-none animate-in fade-in zoom-in slide-in-from-bottom-2 duration-200">
                    {toastMessage}
                  </div>
                )}

                {['Todos', '1º Turno', '2º Turno'].map(t => {
                  const isAvailable = t === 'Todos' || turnosDisponiveis.includes(t);
                  
                  let btnClass = "";
                  if (localShift === t) {
                    btnClass = "bg-[var(--q-green)] text-white shadow-md";
                  } else if (isAvailable) {
                    btnClass = "text-slate-500 hover:bg-white hover:text-slate-800";
                  } else {
                    btnClass = "text-slate-300 bg-slate-50 cursor-not-allowed";
                  }

                  return (
                    <button
                      key={t}
                      onClick={() => handleShiftClick(t)}
                      className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wide rounded-lg transition-all ${btnClass}`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-4 md:p-5 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-5">
              
              {processamento.qtdPontos === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 bg-white border border-dashed border-slate-200 rounded-xl">
                  <span className="text-3xl opacity-40 mb-3 grayscale">🚜</span>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Nenhum dado neste turno</h3>
                </div>
              ) : (
                <>
                  {renderKpiCards()}

                  {/* GRÁFICO DA MÁQUINA */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-4">Categorias (Média/Ponto)</h4>
                    <div className="overflow-x-auto custom-scrollbar pb-2">
                      <div className="min-w-[500px] h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={processamento.chartData} margin={{ top: 20, right: 10, left: 0, bottom: 35 }}>
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={<CustomXAxisTick />} interval={0} />
                            <YAxis type="number" hide domain={[0, dataMax => dataMax * 1.2]} />
                            <Tooltip content={<CustomChartTooltip />} cursor={{fill: 'rgba(241, 245, 249, 0.4)'}} />
                            <Bar dataKey="dia" barSize={32} radius={[6, 6, 0, 0]}>
                              {processamento.chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={getGradientColor(entry.dia, processamento.minCat, processamento.maxCat)} />
                              ))}
                              <LabelList dataKey="dia" position="top" formatter={(val) => formatValue(val, 3)} style={{ fontSize: '9px', fontWeight: '900', fill: '#475569' }} />
                            </Bar>
                            <Line type="monotone" dataKey="ano" stroke="#94a3b8" strokeWidth={2} dot={{ r: 3, fill: '#94a3b8', stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* PONTOS AVALIADOS (SANFONA POR CAMPO) */}
                  <div className="flex flex-col gap-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Pontos Realizados (Por Campo)</h4>
                    
                    {Object.keys(processamento.pontosPorCampo).sort().map(campoStr => {
                      const pontosDoCampo = processamento.pontosPorCampo[campoStr];
                      const isCollapsed = collapsedCampos[campoStr]; 

                      return (
                        <div key={campoStr} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
                          
                          <div 
                            onClick={() => toggleCampo(campoStr)} 
                            className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-[11px] font-black text-[var(--q-dark)] uppercase tracking-widest">{campoStr}</span>
                              <span className="bg-[var(--q-green-soft)] text-[var(--q-green-dark)] text-[9px] font-black px-2 py-0.5 rounded-md">{pontosDoCampo.length} pts</span>
                            </div>
                            <span className="text-slate-400 font-black text-xs px-2">{isCollapsed ? '▼' : '▲'}</span>
                          </div>

                          {!isCollapsed && (
                            <div className="flex flex-col">
                              <div className="grid grid-cols-[30px_1fr_45px_45px_45px] md:grid-cols-[40px_1fr_60px_55px_55px] gap-2 px-3 py-2 bg-white border-b-2 border-slate-100 cursor-default">
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 self-center">Lote</span>
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 self-center text-center pl-2">Turno</span>
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center self-center">Perda</span>
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center self-center">Pisot.</span>
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-right self-center">Arran.</span>
                              </div>

                              <div className="flex flex-col p-1">
                                {pontosDoCampo.map((p, idx) => {
                                  const shiftListStyle = getShiftStyle(p.turno);
                                  return (
                                    <div 
                                      key={idx} 
                                      onClick={() => setSelectedPonto(p)}
                                      className="grid grid-cols-[30px_1fr_45px_45px_45px] md:grid-cols-[40px_1fr_60px_55px_55px] gap-2 px-2 py-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-50 last:border-0 group"
                                    >
                                      <span className="text-[11px] font-black text-slate-600 self-center group-hover:text-[var(--q-orange)]">{p.lote || '-'}</span>
                                      
                                      <div className="flex justify-center items-center pl-2">
                                        <span className={`text-[9px] md:text-[10px] font-black uppercase text-center rounded px-1.5 py-0.5 border ${shiftListStyle.tag}`}>
                                          {String(p.turno).replace('Turno', 'T')}
                                        </span>
                                      </div>
                                      
                                      <span className="text-[11px] font-black text-center self-center" style={{ color: getStatusColor(p.calcPerda, metas.perda) }}>{formatValue(p.calcPerda)}%</span>
                                      <span className="text-[11px] font-black text-center self-center" style={{ color: getStatusColor(p.calcPisot, p.metaPisot) }}>{p.calcPisot !== null ? `${formatValue(p.calcPisot)}%` : '-'}</span>
                                      <span className="text-[11px] font-black text-right self-center" style={{ color: getStatusColor(p.calcArranquio, metas.arranquio) }}>{p.calcArranquio !== null ? `${formatValue(p.calcArranquio)}%` : '-'}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          
          /* ======================= TELA 2: SUB-MODAL DETALHE DO PONTO ======================= */
          <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-300">
            
            <div className="p-3 md:p-4 border-b border-slate-200 bg-white shrink-0 flex items-center justify-between shadow-sm z-10">
              <button 
                onClick={() => setSelectedPonto(null)} 
                className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 hover:text-[var(--q-dark)] hover:bg-slate-50 shadow-sm transition-colors px-3 py-1.5 rounded-lg"
              >
                <span className="text-[10px] font-black uppercase tracking-widest">Voltar</span>
              </button>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Ponto da Máquina</span>
            </div>

            <div className="p-4 md:p-5 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-4">
              
              <div className="grid grid-cols-2 gap-4">
                
                <div className={`flex flex-col items-center justify-center rounded-xl p-4 shadow-sm border ${pShiftStyle.card}`}>
                  <span className={`text-[10px] font-bold uppercase tracking-widest opacity-60 ${pShiftStyle.text}`}>Lote</span>
                  <span className={`text-4xl md:text-5xl font-black leading-none my-1 ${pShiftStyle.text}`}>{selectedPonto.lote || '-'}</span>
                  <div className="flex flex-col items-center gap-0.5 mt-2">
                    <span className={`text-[10px] md:text-[11px] font-black uppercase text-center ${pShiftStyle.text}`}>{String(selectedPonto.campo).trim()}</span>
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
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Dia</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-center my-1.5">
                    <CompareTriangle daily={selectedPonto.calcPerda} yearly={processamento.kpisAno.perda} />
                  </div>
                  
                  <div className="flex justify-between items-end border-t border-slate-100 pt-2">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-black text-slate-600">{formatValue(selectedPonto.total_perda)}</span>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Kg Totais</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[11px] font-black text-slate-400">
                        {formatValue(processamento.kpisAno.perda)}%
                      </span>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Safra</span>
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
                  {catList.map((c, i) => (
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

export default PerdaMecDetailDiarioColhedora;