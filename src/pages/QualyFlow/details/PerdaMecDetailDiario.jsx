// ================================= DOCUMENTATION ------------------------------------------
// Script: PerdaMecDetailDiario
// Purpose: Tela de Detalhamento Diário das Perdas Mecanizadas. 
// Relationships: vw_q_perdamecgeral, vw_q_perdamec_ano, metas (rulesPerdaMec)
// ==========================================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import DateSelectorQualyFlow from '../../../components/QualyFlow/DateSelectorQualyFlow';
import { getMetasParaData, getStatusColor } from '../../../components/QualyFlow/rulesPerdaMec';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

import PerdaMecDetailDiarioCampo from './PerdaMecDetailDiarioCampo';
import PerdaMecDetailDiarioColhedora from './PerdaMecDetailDiarioColhedora';

// ================================= HELPERS ------------------------------------------------

const formatValue = (value, decimals = 2) => {
  if (value === null || value === undefined || value === '') return '-';
  const number = Number(value);
  return Number.isNaN(number) ? '-' : number.toFixed(decimals).replace('.', ',');
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

const parseColhedora = (fullName) => {
  if (!fullName) return { shortName: 'DESC', fullName: 'Desconhecida' };
  const parts = fullName.split(' - ');
  return { shortName: parts[0].trim(), fullName: fullName.trim() };
};

const sortColhedoras = (a, b) => {
  const numA = parseInt(a.shortName, 10);
  const numB = parseInt(b.shortName, 10);
  if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
  if (isNaN(numA) && !isNaN(numB)) return 1; 
  if (!isNaN(numA) && isNaN(numB)) return -1;
  return a.shortName.localeCompare(b.shortName);
};

// Componente Customizado para Quebrar os Nomes das Categorias em 2 Linhas Retas
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

const PerdaMecDetailDiario = ({ initialDate }) => {
  
  const safeInitialDate = (typeof initialDate === 'string' && initialDate.includes('{')) 
    ? new Date().toISOString().split('T')[0] 
    : initialDate;

  const [selectedDate, setSelectedDate] = useState(safeInitialDate || new Date().toISOString().split('T')[0]);
  const [activeYear, setActiveYear] = useState(new Date().getFullYear());
  const [availableDates, setAvailableDates] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [rawData, setRawData] = useState([]);
  const [yearData, setYearData] = useState(null);
  
  const [turnoFiltro, setTurnoFiltro] = useState('Todos');
  const [selectedCampoStr, setSelectedCampoStr] = useState(null); // Agora guardamos só o NOME do campo
  const [selectedColhedora, setSelectedColhedora] = useState(null);

  const metas = useMemo(() => getMetasParaData(selectedDate), [selectedDate]);
  const yearsList = useMemo(() => [2026, 2025, 2024], []);

  useEffect(() => {
    let mounted = true;
    const fetchDates = async () => {
      try {
        const { data } = await supabase.from('vw_q_perdamecgeral').select('data_apontamento').eq('ano', activeYear);
        if (mounted && data) {
          const uniqueDates = [...new Set(data.map(r => r.data_apontamento))].sort((a,b) => b.localeCompare(a));
          setAvailableDates(uniqueDates);
          if (uniqueDates.length > 0 && !uniqueDates.includes(selectedDate)) setSelectedDate(uniqueDates[0]);
        }
      } catch (err) { console.error(err); }
    };
    fetchDates();
    return () => { mounted = false; };
  }, [activeYear, selectedDate]);

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      if (!selectedDate || selectedDate.includes('{')) return;
      setLoading(true);
      
      try {
        const currentYear = parseInt(selectedDate.split('-')[0], 10);
        const [resDia, resAno] = await Promise.all([
          supabase.from('vw_q_perdamecgeral').select('*').eq('data_apontamento', selectedDate),
          supabase.from('vw_q_perdamec_ano').select('*').eq('ano', currentYear).single()
        ]);

        if (mounted) {
          setRawData(resDia.data || []);
          setYearData(resAno.data || null);
        }
      } catch (err) { 
        console.error(err); 
      } finally { 
        if (mounted) setLoading(false); 
      }
    };
    loadData();
    return () => { mounted = false; };
  }, [selectedDate]);
  
  const processamento = useMemo(() => {
    if (!rawData.length) return null;

    let sumPerda=0, sumTch=0, sumMtSimp=0, sumAvSimp=0, sumMtDup=0, sumAvDup=0, sumTocoArr=0, sumTocoFix=0;
    
    rawData.forEach(r => {
      sumPerda += Number(r.total_perda) || 0;
      sumTch += Number(r.tch_estimado) || 0;
      sumTocoArr += Number(r.tocos_arrancados) || 0;
      sumTocoFix += Number(r.tocos_fixos) || 0;
      
      const esp = String(r.espacamento || '').toLowerCase();
      if (esp === 'simples') { sumMtSimp += Number(r.mt_pisoteio) || 0; sumAvSimp += Number(r.av_pisoteio) || 0; }
      else if (esp === 'duplo') { sumMtDup += Number(r.mt_pisoteio) || 0; sumAvDup += Number(r.av_pisoteio) || 0; }
    });

    const kpisDia = {
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
      const somaDia = rawData.reduce((acc, r) => acc + (Number(r[cat.key]) || 0), 0);
      const mediaDia = rawData.length > 0 ? somaDia / rawData.length : 0;
      const mediaAno = yearData ? Number(yearData[cat.key]) || 0 : 0;
      return { name: cat.label, dia: mediaDia, ano: mediaAno };
    }).sort((a, b) => b.dia - a.dia);

    const minCat = Math.min(...chartData.map(d => d.dia));
    const maxCat = Math.max(...chartData.map(d => d.dia));

    const mapCampos = new Map();
    rawData.forEach(r => {
      const campo = String(r.campo || 'Desconhecido').trim();
      if (!mapCampos.has(campo)) {
        mapCampos.set(campo, { campo, linhas: 0, sPerd:0, sTch:0, sMt:0, sAv:0, sTArr:0, sTFix:0, esp: new Set() });
      }
      const c = mapCampos.get(campo);
      c.linhas += 1;
      c.sPerd += Number(r.total_perda) || 0;
      c.sTch += Number(r.tch_estimado) || 0;
      c.sMt += Number(r.mt_pisoteio) || 0;
      c.sAv += Number(r.av_pisoteio) || 0;
      c.sTArr += Number(r.tocos_arrancados) || 0;
      c.sTFix += Number(r.tocos_fixos) || 0;
      if (r.espacamento) c.esp.add(String(r.espacamento).trim().toLowerCase());
    });

    const listaCampos = Array.from(mapCampos.values()).map(c => {
      const isMixed = c.esp.size > 1;
      let pMeta = null;
      if (!isMixed) {
        if (c.esp.has('simples')) pMeta = metas.pisoteio_simples;
        else if (c.esp.has('duplo')) pMeta = metas.pisoteio_duplo;
      }
      return {
        campo: c.campo,
        pontos: c.linhas,
        perda: c.sPerd + c.sTch > 0 ? (c.sPerd / (c.sPerd + c.sTch)) * 100 : null,
        pisoteio: c.sAv > 0 ? (c.sMt / c.sAv) * 100 : null,
        arranquio: c.sTFix > 0 ? (c.sTArr / c.sTFix) * 100 : null,
        isMixed, pMeta
      };
    }).sort((a, b) => a.campo.localeCompare(b.campo));

    return { kpisDia, kpisAno, chartData, minCat, maxCat, listaCampos };

  }, [rawData, yearData, metas]);

  const listaColhedoras = useMemo(() => {
    if (!rawData.length) return [];
    
    const dataFiltrada = turnoFiltro === 'Todos' ? rawData : rawData.filter(r => r.turno === turnoFiltro);
    
    const mapCol = new Map();
    dataFiltrada.forEach(r => {
      const { shortName, fullName } = parseColhedora(r.colhedora);
      if (!mapCol.has(shortName)) {
        mapCol.set(shortName, { shortName, fullName, sPerd:0, sTch:0, sMt:0, sAv:0, sTArr:0, sTFix:0, esp: new Set() });
      }
      const c = mapCol.get(shortName);
      c.sPerd += Number(r.total_perda) || 0;
      c.sTch += Number(r.tch_estimado) || 0;
      c.sMt += Number(r.mt_pisoteio) || 0;
      c.sAv += Number(r.av_pisoteio) || 0;
      c.sTArr += Number(r.tocos_arrancados) || 0;
      c.sTFix += Number(r.tocos_fixos) || 0;
      if (r.espacamento) c.esp.add(String(r.espacamento).trim().toLowerCase());
    });

    return Array.from(mapCol.values()).map(c => {
      const isMixed = c.esp.size > 1;
      let pMeta = null;
      if (!isMixed) {
        if (c.esp.has('simples')) pMeta = metas.pisoteio_simples;
        else if (c.esp.has('duplo')) pMeta = metas.pisoteio_duplo;
      }
      return {
        ...c,
        perda: c.sPerd + c.sTch > 0 ? (c.sPerd / (c.sPerd + c.sTch)) * 100 : null,
        pisoteio: c.sAv > 0 ? (c.sMt / c.sAv) * 100 : null,
        arranquio: c.sTFix > 0 ? (c.sTArr / c.sTFix) * 100 : null,
        isMixed, pMeta
      };
    }).sort(sortColhedoras);
  }, [rawData, turnoFiltro, metas]);


  const CustomChartTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="qf-chart-tooltip flex flex-col gap-1 min-w-[140px] bg-white/95 backdrop-blur shadow-lg border border-slate-200 rounded-xl p-3 z-50">
          <span className="text-xs font-black text-slate-700 uppercase">{payload[0].payload.name}</span>
          <div className="flex justify-between items-center mt-1 border-b border-slate-100 pb-1">
            <span className="text-[10px] font-bold text-slate-400">Dia</span>
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

  const TopKpiRow = ({ label, valDia, valAno, meta }) => {
    if (valDia === null) return null;
    return (
      <div className="flex items-center justify-between py-2 border-b border-slate-100/60 last:border-0 hover:bg-slate-50/50 transition-colors px-2 rounded-lg">
        <span className="text-[11px] md:text-[12px] font-bold text-slate-600 flex-1">{label}</span>
        <div className="flex items-center gap-3 md:gap-6 flex-1 justify-end">
          <span className="text-[11px] md:text-[12px] font-black w-14 text-right" style={{ color: getStatusColor(valDia, meta) }}>
            {formatValue(valDia)}%
          </span>
          <div className="w-4 flex justify-center"><CompareTriangle daily={valDia} yearly={valAno} /></div>
          <span className="text-[11px] md:text-[12px] font-black w-14 text-right" style={{ color: getStatusColor(valAno, meta) }}>
            {valAno !== null ? `${formatValue(valAno)}%` : '-'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-in slide-in-from-bottom-4 duration-500">
      
      <div className="w-full flex justify-center mb-[-10px] z-50">
        <DateSelectorQualyFlow
          value={selectedDate}
          onChange={setSelectedDate}
          availableDates={availableDates}
          activeYear={activeYear}
          onYearChange={setActiveYear}
          yearsList={yearsList}
        />
      </div>

      {!loading && (!processamento || rawData.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white border border-dashed border-slate-200 rounded-xl mt-4 shadow-sm">
          <span className="text-4xl opacity-40 mb-4 grayscale">🍂</span>
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Sem coletas de Perdas nesta data</h3>
        </div>
      ) : (
        processamento && (
          <div className="flex flex-col gap-5 mt-2">
            
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-end border-b border-slate-200 pb-2 mb-2 px-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Indicador</span>
                <div className="flex gap-4 md:gap-8 pr-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-[var(--q-dark)] text-right w-12">Dia</span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-[var(--q-dark)] text-right w-12">Ano</span>
                </div>
              </div>
              <div className="flex flex-col">
                <TopKpiRow label="Perdas" valDia={processamento.kpisDia.perda} valAno={processamento.kpisAno.perda} meta={metas.perda} />
                <TopKpiRow label="Pisoteio Simples" valDia={processamento.kpisDia.pisoteioSimples} valAno={processamento.kpisAno.pisoteioSimples} meta={metas.pisoteio_simples} />
                <TopKpiRow label="Pisoteio Duplo" valDia={processamento.kpisDia.pisoteioDuplo} valAno={processamento.kpisAno.pisoteioDuplo} meta={metas.pisoteio_duplo} />
                <TopKpiRow label="Arranquio" valDia={processamento.kpisDia.arranquio} valAno={processamento.kpisAno.arranquio} meta={metas.arranquio} />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-6">Categorias (Média/Ponto)</h4>
              
              <div className="overflow-x-auto custom-scrollbar pb-2">
                <div className="min-w-[550px] h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={processamento.chartData} margin={{ top: 25, right: 10, left: 0, bottom: 45 }}>
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={<CustomXAxisTick />} 
                        interval={0} 
                      />
                      <YAxis type="number" hide domain={[0, dataMax => dataMax * 1.15]} />
                      <Tooltip content={<CustomChartTooltip />} cursor={{fill: 'rgba(241, 245, 249, 0.4)'}} />
                      
                      <Bar dataKey="dia" barSize={36} radius={[6, 6, 0, 0]}>
                        {processamento.chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getGradientColor(entry.dia, processamento.minCat, processamento.maxCat)} />
                        ))}
                        <LabelList 
                          dataKey="dia" 
                          position="top" 
                          formatter={(val) => formatValue(val, 3)} 
                          style={{ fontSize: '9px', fontWeight: '900', fill: '#475569' }} 
                        />
                      </Bar>
                      
                      <Line 
                        type="monotone" 
                        dataKey="ano" 
                        stroke="#94a3b8" 
                        strokeWidth={2} 
                        dot={{ r: 4, fill: '#94a3b8', stroke: '#fff', strokeWidth: 2 }} 
                        isAnimationActive={false} 
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <h4 className="text-[10px] font-black text-[var(--q-dark)] uppercase tracking-widest">Campos Avaliados</h4>
              </div>
              
              <div className="grid grid-cols-[1fr_50px_50px_50px_50px] gap-2 px-3 py-2 bg-white border-b-2 border-slate-100 cursor-default">
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 self-center">Campo</span>
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center leading-tight">Pontos</span>
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center self-center">Perda</span>
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center self-center">Pisot.</span>
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-right self-center">Arran.</span>
              </div>

              <div className="flex flex-col max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                {processamento.listaCampos.map((c, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => setSelectedCampoStr(c.campo)} // Passa só o nome para o modal
                    className="grid grid-cols-[1fr_50px_50px_50px_50px] gap-2 px-2 py-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors group"
                  >
                    <span className="text-[11px] font-black text-slate-600 uppercase truncate self-center group-hover:text-[var(--q-orange)] transition-colors">{c.campo}</span>
                    <span className="text-[11px] font-black text-slate-500 text-center bg-slate-100 rounded-md py-0.5">{c.pontos}</span>
                    <span className="text-[11px] font-black text-center self-center" style={{ color: getStatusColor(c.perda, metas.perda) }}>{formatValue(c.perda)}%</span>
                    <span className="text-[11px] font-black text-center self-center" style={{ color: c.isMixed ? 'var(--q-dark)' : getStatusColor(c.pisoteio, c.pMeta) }}>{c.pisoteio !== null ? `${formatValue(c.pisoteio)}%` : '-'}</span>
                    <span className="text-[11px] font-black text-right self-center" style={{ color: getStatusColor(c.arranquio, metas.arranquio) }}>{formatValue(c.arranquio)}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
              
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col gap-3">
                <h4 className="text-[10px] font-black text-[var(--q-dark)] uppercase tracking-widest">Desempenho de Colhedoras</h4>
                
                <div className="flex w-full bg-slate-200/50 p-1 rounded-xl shadow-inner">
                  {['Todos', '1º Turno', '2º Turno'].map(t => (
                    <button
                      key={t}
                      onClick={() => setTurnoFiltro(t)}
                      className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wide rounded-lg transition-all ${
                        turnoFiltro === t 
                          ? 'bg-[var(--q-green)] text-white shadow-md' 
                          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-[1fr_50px_50px_50px] gap-2 px-3 py-2 bg-white border-b-2 border-slate-100 cursor-default">
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 self-center pl-1">Máquina</span>
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center self-center">Perda</span>
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center self-center">Pisot.</span>
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-right self-center">Arran.</span>
              </div>

              <div className="flex flex-col max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                {listaColhedoras.length === 0 ? (
                  <div className="py-6 text-center text-[10px] font-bold text-slate-400 uppercase">Nenhum dado neste turno</div>
                ) : (
                  listaColhedoras.map((col, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => setSelectedColhedora(col)}
                      className="grid grid-cols-[1fr_50px_50px_50px] gap-2 px-2 py-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors group"
                    >
                      <div className="flex flex-col justify-center overflow-hidden pr-2 pl-1">
                        <span className="text-[12px] font-black text-slate-700 truncate group-hover:text-[var(--q-green)] transition-colors">{col.shortName}</span>
                      </div>
                      
                      <span className="text-[11px] font-black text-center self-center" style={{ color: getStatusColor(col.perda, metas.perda) }}>{formatValue(col.perda)}%</span>
                      <span className="text-[11px] font-black text-center self-center" style={{ color: col.isMixed ? 'var(--q-dark)' : getStatusColor(col.pisoteio, col.pMeta) }}>{col.pisoteio !== null ? `${formatValue(col.pisoteio)}%` : '-'}</span>
                      <span className="text-[11px] font-black text-right self-center" style={{ color: getStatusColor(col.arranquio, metas.arranquio) }}>{formatValue(col.arranquio)}%</span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )
      )}

      {/* MODAL DO CAMPO - Passamos os dados crus e ele se encarrega da inteligência local */}
      <PerdaMecDetailDiarioCampo 
        campoNome={selectedCampoStr} 
        rawData={rawData} 
        yearData={yearData} 
        metas={metas} 
        selectedDate={selectedDate}
        onClose={() => setSelectedCampoStr(null)} 
      />
      
      <PerdaMecDetailDiarioColhedora 
        colhedora={selectedColhedora} 
        initialShift={turnoFiltro} 
        rawData={rawData} 
        yearData={yearData} 
        metas={metas} 
        selectedDate={selectedDate}
        onClose={() => setSelectedColhedora(null)} 
      />

    </div>
  );
};

export default PerdaMecDetailDiario;