// ================================= DOCUMENTATION ------------------------------------------
// Script: PerdaMecDetailRankEquipCampo
// Purpose: Modal detalhado para exibir os indicadores, gráficos e pontos avaliados de um 
//          campo específico de uma colhedora, com comparativo de safra.
// Relationships: vw_q_perdamecgeral, vw_q_perdamec_ano, metas (rulesPerdaMec)
// ==========================================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { getMetasParaData, getStatusColor } from '../../../components/QualyFlow/rulesPerdaMec';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

// ================================= HELPERS ------------------------------------------------

const formatValue = (value, decimals = 2) => {
  if (value === null || value === undefined || value === '') return '-';
  const number = Number(value);
  return Number.isNaN(number) ? '-' : number.toFixed(decimals).replace('.', ',');
};

const formatDateAndMonth = (dateStr) => {
  if (!dateStr) return '-';
  const parts = dateStr.split(' ')[0].split('-');
  if (parts.length < 3) return dateStr;
  return `${parts[2]}/${parts[1]}`;
};

const formatTime = (dateTimeStr) => {
  if (!dateTimeStr || !dateTimeStr.includes(' ')) return '';
  return dateTimeStr.split(' ')[1].substring(0, 5);
};

const CompareTriangle = ({ daily, yearly }) => {
  if (daily === null || yearly === null) return null;
  const diff = daily - yearly;
  if (Math.abs(diff) < 0.01) return <span className="text-[10px] text-slate-300 font-bold text-center">-</span>;
  if (diff < 0) return <span className="qf-anim-triangle-down font-black text-center text-[var(--q-green)]">▼</span>;
  return <span className="qf-anim-triangle-up font-black text-center text-[var(--q-danger)]">▲</span>;
};

const getGradientColor = (value, min, max) => {
  if (max === min) return 'hsl(140, 95%, 35%)';
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

const PerdaMecDetailRankEquipCampo = ({ campoNome, dataApontamento, colhedora, turno, ano, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState([]);
  const [yearData, setYearData] = useState(null);

  // Usa a data de apontamento para puxar as metas vigentes
  const metas = useMemo(() => getMetasParaData(dataApontamento || `${ano}-01-01`), [dataApontamento, ano]);

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      if (!campoNome || !colhedora || !ano) return;
      setLoading(true);

      try {
        // 1. Busca os dados do ano para o comparativo de Safra
        const { data: resAno } = await supabase
          .from('vw_q_perdamec_ano')
          .select('*')
          .eq('ano', ano)
          .single();

        // 2. Busca os dados brutos filtrados
        let query = supabase
          .from('vw_q_perdamecgeral')
          .select('*')
          .eq('ano', ano)
          .eq('campo', campoNome)
          .like('colhedora', `${colhedora.shortName}%`);

        if (turno && turno !== 'Todos') query = query.eq('turno', turno);
        if (dataApontamento) query = query.eq('data_apontamento', dataApontamento);

        const { data: resCampo } = await query.order('data_hora', { ascending: false });

        if (mounted) {
          setYearData(resAno || null);
          setRawData(resCampo || []);
        }
      } catch (err) {
        console.error("Erro ao buscar dados do campo:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadData();
    return () => { mounted = false; };
  }, [campoNome, colhedora, turno, ano, dataApontamento]);

  const processamento = useMemo(() => {
    if (!rawData.length) return null;

    let sumPerda=0, sumTch=0, sumMtSimp=0, sumAvSimp=0, sumMtDup=0, sumAvDup=0, sumTocoArr=0, sumTocoFix=0, sumKg=0;
    const tiposEspacamento = new Set();
    
    rawData.forEach(r => {
      sumKg += Number(r.total_perda) || 0;
      sumPerda += Number(r.total_perda) || 0;
      sumTch += Number(r.tch_estimado) || 0;
      sumTocoArr += Number(r.tocos_arrancados) || 0;
      sumTocoFix += Number(r.tocos_fixos) || 0;
      
      const esp = String(r.espacamento || '').toLowerCase();
      if (esp) tiposEspacamento.add(esp);

      if (esp === 'simples') { sumMtSimp += Number(r.mt_pisoteio) || 0; sumAvSimp += Number(r.av_pisoteio) || 0; }
      else if (esp === 'duplo') { sumMtDup += Number(r.mt_pisoteio) || 0; sumAvDup += Number(r.av_pisoteio) || 0; }
    });

    const totalPontos = rawData.length;

    const kpisCampo = {
      mediaTch: sumTch / totalPontos,
      mediaKg: sumKg / totalPontos,
      perda: sumPerda + sumTch > 0 ? (sumPerda / (sumPerda + sumTch)) * 100 : null,
      pisoteioSimples: sumAvSimp > 0 ? (sumMtSimp / sumAvSimp) * 100 : null,
      pisoteioDuplo: sumAvDup > 0 ? (sumMtDup / sumAvDup) * 100 : null,
      arranquio: sumTocoFix > 0 ? (sumTocoArr / sumTocoFix) * 100 : null
    };

    const kpisAno = yearData ? {
      perda: Number(yearData.perda_perc),
      pisoteioSimples: Number(yearData.pisoteio_simples_perc),
      pisoteioDuplo: Number(yearData.pisoteio_duplo_perc),
      arranquio: Number(yearData.arranquio_perc)
    } : { perda: null, pisoteioSimples: null, pisoteioDuplo: null, arranquio: null };

    const categoriasBase = [
      { key: 'cat_canaponta', label: 'Cana Ponta' }, { key: 'cat_toco', label: 'Toco' },
      { key: 'cat_pedacofixo', label: 'Pedaço Fixo' }, { key: 'cat_canainteira', label: 'Cana Inteira' },
      { key: 'cat_toleterepicado', label: 'Tolete Repicado' }, { key: 'cat_estilhaco', label: 'Estilhaço' },
      { key: 'cat_lascas', label: 'Lascas' }, { key: 'cat_pedacosolto', label: 'Pedaço Solto' }
    ];

    const chartData = categoriasBase.map(cat => {
      const somaCampo = rawData.reduce((acc, r) => acc + (Number(r[cat.key]) || 0), 0);
      const mediaCampo = totalPontos > 0 ? somaCampo / totalPontos : 0;
      const mediaAno = yearData ? Number(yearData[cat.key]) || 0 : 0;
      return { name: cat.label, campo: mediaCampo, ano: mediaAno };
    }).sort((a, b) => b.campo - a.campo);

    const minCat = Math.min(...chartData.map(d => d.campo));
    const maxCat = Math.max(...chartData.map(d => d.campo));

    return { 
      kpisCampo, kpisAno, chartData, minCat, maxCat, totalPontos, 
      hasSimples: tiposEspacamento.has('simples'),
      hasDuplo: tiposEspacamento.has('duplo')
    };
  }, [rawData, yearData]);

  if (!campoNome || !colhedora) return null;

  const CustomChartTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="qf-chart-tooltip flex flex-col gap-1 min-w-[140px] bg-white/95 backdrop-blur shadow-lg border border-slate-200 rounded-xl p-3 z-50">
          <span className="text-xs font-black text-slate-700 uppercase">{payload[0].payload.name}</span>
          <div className="flex justify-between items-center mt-1 border-b border-slate-100 pb-1">
            <span className="text-[10px] font-bold text-slate-400">Campo</span>
            <span className="text-[11px] font-black text-[var(--q-dark)]">{formatValue(payload[0].value, 3)}</span>
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="text-[10px] font-bold text-slate-400">Safra</span>
            <span className="text-[11px] font-black text-slate-500">{formatValue(payload[1].value, 3)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const TopKpiRow = ({ label, valCampo, valAno, meta }) => {
    if (valCampo === null) return null;
    return (
      <div className="flex items-center justify-between py-2 border-b border-slate-100/60 last:border-0 hover:bg-slate-50/50 transition-colors px-2 rounded-lg">
        <span className="text-[11px] md:text-[12px] font-bold text-slate-600 flex-1">{label}</span>
        <div className="flex items-center gap-3 md:gap-6 flex-1 justify-end">
          <span className="text-[11px] md:text-[12px] font-black w-14 text-right" style={{ color: getStatusColor(valCampo, meta) }}>
            {formatValue(valCampo)}%
          </span>
          <div className="w-4 flex justify-center"><CompareTriangle daily={valCampo} yearly={valAno} /></div>
          <span className="text-[11px] md:text-[12px] font-black w-14 text-right" style={{ color: getStatusColor(valAno, meta) }}>
            {valAno !== null ? `${formatValue(valAno)}%` : '-'}
          </span>
        </div>
      </div>
    );
  };

  // Definição dinâmica das colunas da tabela de pontos com base no espaçamento do campo
  const gridTemplate = processamento?.hasSimples && processamento?.hasDuplo
    ? "grid-cols-[60px_1fr_45px_45px_45px_45px]" // Data, Lote, Perda, Pis Simples, Pis Duplo, Arranquio
    : "grid-cols-[60px_1fr_50px_60px_50px]";      // Data, Lote, Perda, Pisoteio(Único), Arranquio

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200" onClick={onClose}>
      <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh]" onClick={e => e.stopPropagation()}>
        
        {/* CABEÇALHO PADRONIZADO */}
        <div className="p-3 md:p-4 border-b border-slate-200 bg-white shrink-0 flex items-center justify-between shadow-sm z-10">
          <button 
            onClick={onClose} 
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 hover:text-[var(--q-dark)] hover:bg-slate-50 shadow-sm transition-colors px-3 py-1.5 rounded-lg"
          >
            <span className="text-[10px] font-black uppercase tracking-widest">Voltar</span>
          </button>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Raio-X do Campo</span>
          </div>
        </div>

        {/* CORPO SCROLLÁVEL */}
        <div className="p-4 md:p-5 overflow-y-auto custom-scrollbar flex-1 flex flex-col">
          
          {/* Identificação Superior */}
          <div className="flex flex-col mb-5">
            <h3 className="text-xl md:text-2xl font-black text-[var(--q-dark)] uppercase leading-none tracking-tight flex items-center gap-2 truncate">
              {campoNome} <span className="text-slate-300 text-base md:text-lg">| {colhedora.shortName}</span>
            </h3>
            <span className="text-[10px] md:text-[11px] font-bold text-slate-500 uppercase mt-1 line-clamp-1">
              Avaliado em {formatDateAndMonth(dataApontamento)} - {turno !== 'Todos' ? turno : 'Todos os Turnos'} - Safra {ano}
            </span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Inspecionando Lotes...</span>
            </div>
          ) : !processamento || rawData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white border border-dashed border-slate-200 rounded-xl shadow-sm">
              <span className="text-4xl opacity-40 mb-4 grayscale">📉</span>
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Nenhum ponto registrado com esses filtros</h3>
            </div>
          ) : (
            <div className="flex flex-col gap-5 animate-in fade-in duration-300">
              
              {/* RESUMO: CARDS MÉDIA TCH, KG E PONTOS */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 w-full h-1 bg-blue-500"></div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center mt-1">Média TCH</span>
                  <span className="text-xl font-black text-blue-600 mt-1">{formatValue(processamento.kpisCampo.mediaTch, 1)}</span>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 w-full h-1 bg-orange-500"></div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center mt-1">Média Kg</span>
                  <span className="text-xl font-black text-orange-600 mt-1">{formatValue(processamento.kpisCampo.mediaKg, 1)}</span>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center shadow-sm">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Pontos Aval.</span>
                  <span className="text-xl font-black text-[var(--q-dark)] mt-1">{processamento.totalPontos}</span>
                </div>
              </div>

              {/* LISTA DE INDICADORES (CAMPO VS SAFRA) */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-end border-b border-slate-200 pb-2 mb-2 px-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Indicador (Campo vs Safra)</span>
                  <div className="flex gap-4 md:gap-8 pr-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--q-dark)] text-right w-12">Campo</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--q-dark)] text-right w-12">Safra</span>
                  </div>
                </div>
                <div className="flex flex-col">
                  <TopKpiRow label="Perdas" valCampo={processamento.kpisCampo.perda} valAno={processamento.kpisAno.perda} meta={metas.perda} />
                  <TopKpiRow label="Pisoteio Simples" valCampo={processamento.kpisCampo.pisoteioSimples} valAno={processamento.kpisAno.pisoteioSimples} meta={metas.pisoteio_simples} />
                  <TopKpiRow label="Pisoteio Duplo" valCampo={processamento.kpisCampo.pisoteioDuplo} valAno={processamento.kpisAno.pisoteioDuplo} meta={metas.pisoteio_duplo} />
                  <TopKpiRow label="Arranquio" valCampo={processamento.kpisCampo.arranquio} valAno={processamento.kpisAno.arranquio} meta={metas.arranquio} />
                </div>
              </div>

              {/* GRÁFICO DE CATEGORIAS */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-end border-b border-slate-100 pb-2 mb-6">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Distribuição por Categoria (Média/Ponto)</h4>
                  <div className="flex gap-3">
                    <div className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-[var(--q-green)]"></span><span className="text-[8px] font-black text-slate-400 uppercase">Campo</span></div>
                    <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400"></span><span className="text-[8px] font-black text-slate-400 uppercase">Safra</span></div>
                  </div>
                </div>
                
                <div className="overflow-x-auto custom-scrollbar pb-2">
                  <div className="min-w-[550px] h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={processamento.chartData} margin={{ top: 20, right: 10, left: 0, bottom: 40 }}>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={<CustomXAxisTick />} interval={0} />
                        <YAxis type="number" hide domain={[0, dataMax => dataMax * 1.15]} />
                        <Tooltip content={<CustomChartTooltip />} cursor={{fill: 'rgba(241, 245, 249, 0.4)'}} />
                        
                        <Bar dataKey="campo" barSize={32} radius={[6, 6, 0, 0]}>
                          {processamento.chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getGradientColor(entry.campo, processamento.minCat, processamento.maxCat)} />
                          ))}
                          <LabelList dataKey="campo" position="top" formatter={(val) => formatValue(val, 3)} style={{ fontSize: '9px', fontWeight: '900', fill: '#475569' }} />
                        </Bar>
                        
                        <Line type="monotone" dataKey="ano" stroke="#94a3b8" strokeWidth={2} dot={{ r: 4, fill: '#94a3b8', stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* TABELA PONTO A PONTO */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
                <div className="p-3 border-b border-slate-100 bg-slate-50">
                  <h4 className="text-[10px] font-black text-[var(--q-dark)] uppercase tracking-widest">Detalhamento dos Lotes</h4>
                </div>
                
                <div className="w-full overflow-x-auto custom-scrollbar">
                  <div className="min-w-[550px] flex flex-col">
                    
                    {/* CABEÇALHO DINÂMICO */}
                    <div className={`grid ${gridTemplate} gap-2 px-3 py-2 bg-slate-100 border-b-2 border-slate-200 cursor-default`}>
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 self-center text-center">Data</span>
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 self-center">Lote</span>
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center self-center">Perda</span>
                      
                      {processamento.hasSimples && processamento.hasDuplo ? (
                        <>
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center self-center leading-tight">Pisoteio<br/>Simples</span>
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center self-center leading-tight">Pisoteio<br/>Duplo</span>
                        </>
                      ) : (
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center self-center leading-tight">
                          Pisoteio {processamento.hasSimples ? '(Simples)' : processamento.hasDuplo ? '(Duplo)' : ''}
                        </span>
                      )}
                      
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-right self-center pr-1">Arranquio</span>
                    </div>

                    {/* CORPO DA TABELA */}
                    <div className="flex flex-col bg-white max-h-[350px] overflow-y-auto custom-scrollbar">
                      {rawData.map((r, idx) => {
                        
                        const perda = (Number(r.total_perda) + Number(r.tch_estimado)) > 0 ? (Number(r.total_perda) / (Number(r.total_perda) + Number(r.tch_estimado))) * 100 : 0;
                        const arranquio = Number(r.tocos_fixos) > 0 ? (Number(r.tocos_arrancados) / Number(r.tocos_fixos)) * 100 : 0;
                        const pisoteio = Number(r.av_pisoteio) > 0 ? (Number(r.mt_pisoteio) / Number(r.av_pisoteio)) * 100 : null;
                        const isSimples = String(r.espacamento).toLowerCase() === 'simples';
                        const isDuplo = String(r.espacamento).toLowerCase() === 'duplo';

                        return (
                          <div key={idx} className={`grid ${gridTemplate} gap-2 px-3 py-2 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 items-center`}>
                            
                            <div className="flex flex-col items-center leading-none justify-center">
                              <span className="text-[10px] font-black text-[var(--q-dark)]">{formatDateAndMonth(r.data_apontamento)}</span>
                              <span className="text-[8px] font-bold text-slate-400">{formatTime(r.data_hora)}</span>
                            </div>
                            
                            <span className="text-[10px] font-black text-slate-600 truncate uppercase" title={r.lote || '-'}>
                              {r.lote || '-'}
                            </span>
                            
                            <span className="text-[11px] font-black text-center" style={{ color: getStatusColor(perda, metas.perda) }}>
                              {formatValue(perda)}%
                            </span>
                            
                            {/* Lógica condicional da coluna de Pisoteio */}
                            {processamento.hasSimples && processamento.hasDuplo ? (
                              <>
                                <span className="text-[11px] font-black text-center" style={{ color: isSimples ? getStatusColor(pisoteio, metas.pisoteio_simples) : '#cbd5e1' }}>
                                  {isSimples ? `${formatValue(pisoteio)}%` : '-'}
                                </span>
                                <span className="text-[11px] font-black text-center" style={{ color: isDuplo ? getStatusColor(pisoteio, metas.pisoteio_duplo) : '#cbd5e1' }}>
                                  {isDuplo ? `${formatValue(pisoteio)}%` : '-'}
                                </span>
                              </>
                            ) : (
                              <span className="text-[11px] font-black text-center" style={{ color: pisoteio !== null ? getStatusColor(pisoteio, isSimples ? metas.pisoteio_simples : metas.pisoteio_duplo) : '#cbd5e1' }}>
                                {pisoteio !== null ? `${formatValue(pisoteio)}%` : '-'}
                              </span>
                            )}
                            
                            <span className="text-[11px] font-black text-right pr-1" style={{ color: getStatusColor(arranquio, metas.arranquio) }}>
                              {formatValue(arranquio)}%
                            </span>
                            
                          </div>
                        );
                      })}
                    </div>

                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerdaMecDetailRankEquipCampo;