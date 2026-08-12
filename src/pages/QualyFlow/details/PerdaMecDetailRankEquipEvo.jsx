// ================================= DOCUMENTATION ------------------------------------------
// Script: PerdaMecDetailRankEquipEvo
// Purpose: Modal avançado para exibir o histórico de evolução, tendência e acúmulo da colhedora.
// Relationships: vw_q_perdamecgeral
// ==========================================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { getMetasParaData, getStatusColor } from '../../../components/QualyFlow/rulesPerdaMec';
import { ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';

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
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${parts[2]}/${months[parseInt(parts[1], 10) - 1]}`;
};

const formatTime = (dateTimeStr) => {
  if (!dateTimeStr || !dateTimeStr.includes(' ')) return '';
  return dateTimeStr.split(' ')[1].substring(0, 5);
};

const renderTrend = (trendVal, type) => {
  if (trendVal === 0) return <span className="text-[10px] text-slate-300 font-black">-</span>;
  
  if (type === 'kg') {
    // Kg: Aumentar é ruim (Vermelho), Diminuir é bom (Verde)
    return trendVal > 0 
      ? <span className="text-[10px] text-[var(--q-danger)] font-black leading-none drop-shadow-sm">▲</span>
      : <span className="text-[10px] text-[var(--q-green)] font-black leading-none drop-shadow-sm">▼</span>;
  } else {
    // TCH: Aumentar é bom (Verde), Diminuir é ruim (Vermelho)
    return trendVal > 0 
      ? <span className="text-[10px] text-[var(--q-green)] font-black leading-none drop-shadow-sm">▲</span>
      : <span className="text-[10px] text-[var(--q-danger)] font-black leading-none drop-shadow-sm">▼</span>;
  }
};

const CustomEvoTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="flex flex-col gap-2 min-w-[160px] bg-white/95 backdrop-blur shadow-lg border border-slate-200 rounded-xl p-3 z-50">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <div className="flex flex-col">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{data.campo}</span>
             <span className="text-[11px] font-black text-[var(--q-dark)]">{data.dataLabel} às {data.horaLabel}</span>
          </div>
          <span className="bg-slate-100 text-slate-500 text-[9px] font-black px-1.5 py-0.5 rounded">#{data.pontoIdx}</span>
        </div>
        
        <div className="flex flex-col gap-1">
           <div className="flex justify-between items-center">
             <span className="text-[10px] font-bold text-slate-500">TCH Acumulado</span>
             <span className="text-[11px] font-black text-blue-600">{formatValue(data.tchAcum)}</span>
           </div>
           <div className="flex justify-between items-center">
             <span className="text-[10px] font-bold text-slate-500">Média Kg Acum.</span>
             <span className="text-[11px] font-black text-orange-600">{formatValue(data.kgAcum)}</span>
           </div>
           <div className="flex justify-between items-center pt-1 mt-1 border-t border-slate-100">
             <span className="text-[10px] font-black uppercase text-[var(--q-dark)]">Perda %</span>
             <span className="text-[12px] font-black" style={{ color: getStatusColor(data.perdaPerc, data.metaPerda) }}>
               {formatValue(data.perdaPerc)}%
             </span>
           </div>
        </div>
      </div>
    );
  }
  return null;
};

// ================================= EXECUTOR PRINCIPAL -------------------------------------

const PerdaMecDetailRankEquipEvo = ({ colhedora, turno, ano, onClose }) => {
  
  const [loading, setLoading] = useState(false);
  const [rawData, setRawData] = useState([]);
  
  // Variável/Estado de controle dos eixos do gráfico (Dual = TCH de um lado, Kg do outro)
  const [useDualAxis, setUseDualAxis] = useState(true);

  const metas = useMemo(() => getMetasParaData(`${ano}-12-31`), [ano]);

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      if (!colhedora || !ano) return;
      setLoading(true);

      try {
        const { data } = await supabase
          .from('vw_q_perdamecgeral')
          .select('data_hora, data_apontamento, campo, lote, total_perda, tch_estimado')
          .eq('ano', ano)
          .eq('turno', turno)
          .like('colhedora', `${colhedora.shortName}%`)
          .order('data_hora', { ascending: true }); // Crucial: CRESCE NO TEMPO PARA O ACÚMULO DAR CERTO

        if (mounted) setRawData(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadData();
    return () => { mounted = false; };
  }, [colhedora, ano, turno]);

  const processamento = useMemo(() => {
    if (!rawData.length) return { lista: [], ultimo: null };

    let sumTch = 0;
    let sumKg = 0;
    const lista = [];

    for (let i = 0; i < rawData.length; i++) {
      const r = rawData[i];
      const tch = Number(r.tch_estimado) || 0;
      const kg = Number(r.total_perda) || 0;

      sumTch += tch;
      sumKg += kg;
      const count = i + 1;

      const tchAcum = sumTch / count;
      const kgAcum = sumKg / count;
      const perdaPerc = (sumKg + sumTch) > 0 ? (sumKg / (sumKg + sumTch)) * 100 : 0;

      let trendTch = 0;
      let trendKg = 0;

      if (i > 0) {
        const prev = lista[i - 1];
        if (tchAcum > prev.tchAcum + 0.05) trendTch = 1;
        else if (tchAcum < prev.tchAcum - 0.05) trendTch = -1;

        if (kgAcum > prev.kgAcum + 0.01) trendKg = 1;
        else if (kgAcum < prev.kgAcum - 0.01) trendKg = -1;
      }

      lista.push({
        pontoIdx: count,
        data_hora: r.data_hora,
        dataLabel: formatDateAndMonth(r.data_apontamento),
        horaLabel: formatTime(r.data_hora),
        campo: String(r.campo).trim(),
        lote: r.lote || '-',
        tch,
        kg,
        tchAcum,
        kgAcum,
        perdaPerc,
        trendTch,
        trendKg,
        metaPerda: metas.perda
      });
    }

    return { 
      lista, 
      listaReversa: [...lista].reverse(), 
      ultimo: lista[lista.length - 1] 
    };
  }, [rawData, metas]);

  if (!colhedora) return null;

  const renderTopResume = () => {
    const u = processamento.ultimo;
    if (!u) return null;

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center shadow-sm">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Pontos Aval.</span>
          <span className="text-xl font-black text-[var(--q-dark)] mt-1">{u.pontoIdx}</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center shadow-sm relative overflow-hidden">
          <div className="absolute top-0 w-full h-1 bg-blue-500"></div>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center mt-1">TCH Médio</span>
          <span className="text-xl font-black text-blue-600 mt-1">{formatValue(u.tchAcum)}</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center shadow-sm relative overflow-hidden">
          <div className="absolute top-0 w-full h-1 bg-orange-500"></div>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center mt-1">Kg Médio</span>
          <span className="text-xl font-black text-orange-600 mt-1">{formatValue(u.kgAcum)}</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center shadow-sm relative overflow-hidden">
          <div className="absolute top-0 w-full h-1 bg-[var(--q-green)]" style={{ backgroundColor: getStatusColor(u.perdaPerc, u.metaPerda) }}></div>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center mt-1">Perda Acum.</span>
          <span className="text-xl font-black mt-1" style={{ color: getStatusColor(u.perdaPerc, u.metaPerda) }}>{formatValue(u.perdaPerc)}%</span>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200" onClick={onClose}>
      <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh]" onClick={e => e.stopPropagation()}>
        
        {/* NOVO HEADER: Padronizado com o botão Voltar em destaque */}
        <div className="p-3 md:p-4 border-b border-slate-200 bg-white shrink-0 flex items-center justify-between shadow-sm z-10">
          <button 
            onClick={onClose} 
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 hover:text-[var(--q-dark)] hover:bg-slate-50 shadow-sm transition-colors px-3 py-1.5 rounded-lg"
          >
            <span className="text-[10px] font-black uppercase tracking-widest">Voltar</span>
          </button>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Evolução e Tendência</span>
        </div>

        {/* CORPO SCROLLÁVEL */}
        <div className="p-4 md:p-5 overflow-y-auto custom-scrollbar flex-1 flex flex-col">
          
          {/* Identificação da Colhedora dentro do corpo scrollável (como na Tela 2) */}
          <div className="flex flex-col mb-5">
            <h3 className="text-xl md:text-2xl font-black text-[var(--q-dark)] uppercase leading-none tracking-tight flex items-center gap-2 truncate">
              {colhedora.shortName} <span className="text-slate-300 text-base md:text-lg">| {turno}</span>
            </h3>
            <span className="text-[10px] md:text-[11px] font-bold text-slate-500 uppercase mt-1 line-clamp-1">Safra {ano}</span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Desenhando Tendências...</span>
            </div>
          ) : !processamento.lista.length ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white border border-dashed border-slate-200 rounded-xl shadow-sm">
              <span className="text-4xl opacity-40 mb-4 grayscale">📉</span>
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Nenhum ponto registrado para analisar</h3>
            </div>
          ) : (
            <div className="flex flex-col animate-in fade-in duration-300">
              
              {/* KPIS GERAIS DO ACUMULADO */}
              {renderTopResume()}

              {/* GRÁFICO DE TENDÊNCIA */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-5">
                <div className="flex justify-between items-end border-b border-slate-100 pb-2 mb-4">
                  <div className="flex flex-col">
                    <h4 className="text-[10px] font-black text-[var(--q-dark)] uppercase tracking-widest">Gráfico de Tendência</h4>
                    <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">Visão Acumulada da Safra</span>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    {/* Legenda */}
                    <div className="flex gap-4">
                      <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"></span><span className="text-[9px] font-black text-slate-500 uppercase">TCH</span></div>
                      <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-500"></span><span className="text-[9px] font-black text-slate-500 uppercase">Média Kg</span></div>
                    </div>
                    {/* Toggle de Eixos Interativo */}
                    <button 
                      onClick={() => setUseDualAxis(!useDualAxis)}
                      className="text-[8px] font-black uppercase tracking-widest px-2 py-1 border border-slate-200 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                      title="Alternar entre um eixo comum ou escalas separadas"
                    >
                      {useDualAxis ? '⇆ Eixos Separados' : '⇈ Eixo Único'}
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar pb-2">
                  <div className="min-w-[600px] h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={processamento.lista} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <XAxis dataKey="dataLabel" tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 900 }} tickLine={false} axisLine={false} minTickGap={30} />
                        
                        {/* Eixo Esquerdo (TCH - ou Geral se for eixo único) */}
                        <YAxis 
                          yAxisId="left" 
                          orientation="left" 
                          stroke={useDualAxis ? "#3b82f6" : "#94a3b8"} 
                          tick={{ fill: useDualAxis ? '#3b82f6' : '#94a3b8', fontSize: 9, fontWeight: 900 }} 
                          axisLine={false} 
                          tickLine={false} 
                          domain={[0, 'auto']} 
                        />
                        
                        {/* Eixo Direito (Kg) - Exibido apenas se for Dual Axis */}
                        {useDualAxis && (
                          <YAxis 
                            yAxisId="right" 
                            orientation="right" 
                            stroke="#f97316" 
                            tick={{ fill: '#f97316', fontSize: 9, fontWeight: 900 }} 
                            axisLine={false} 
                            tickLine={false} 
                            domain={[0, 'auto']} 
                          />
                        )}
                        
                        <Tooltip content={<CustomEvoTooltip />} cursor={{ stroke: 'rgba(203, 213, 225, 0.5)', strokeWidth: 2, strokeDasharray: '3 3' }} />
                        
                        <Line yAxisId="left" type="monotone" dataKey="tchAcum" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} />
                        <Line yAxisId={useDualAxis ? "right" : "left"} type="monotone" dataKey="kgAcum" stroke="#f97316" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#f97316', stroke: '#fff', strokeWidth: 2 }} />
                        
                        {/* Marcação Forte no Último Ponto para Foco */}
                        {processamento.ultimo && (
                          <>
                            <ReferenceDot yAxisId="left" x={processamento.ultimo.dataLabel} y={processamento.ultimo.tchAcum} r={5} fill="#3b82f6" stroke="#fff" strokeWidth={2} />
                            <ReferenceDot yAxisId={useDualAxis ? "right" : "left"} x={processamento.ultimo.dataLabel} y={processamento.ultimo.kgAcum} r={5} fill="#f97316" stroke="#fff" strokeWidth={2} />
                          </>
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* TABELA DE PONTOS COM SCROLL HORIZONTAL INTERNO */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
                <div className="p-3 border-b border-slate-100 bg-slate-50">
                  <h4 className="text-[10px] font-black text-[var(--q-dark)] uppercase tracking-widest">Histórico de Lançamentos</h4>
                </div>
                
                <div className="w-full overflow-x-auto custom-scrollbar">
                  <div className="min-w-[650px] flex flex-col">
                    
                    <div className="grid grid-cols-[30px_55px_1fr_45px_60px_45px_65px_55px] gap-2 px-3 py-2 bg-slate-100 border-b-2 border-slate-200 cursor-default">
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 self-center text-center">#</span>
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 self-center text-center">Data</span>
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 self-center">Campo</span>
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center self-center">TCH</span>
                      <span className="text-[8px] font-black uppercase tracking-widest text-blue-600 text-center self-center leading-tight">TCH<br/>Acum.</span>
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center self-center leading-tight">Média<br/>Kg</span>
                      <span className="text-[8px] font-black uppercase tracking-widest text-orange-600 text-center self-center leading-tight">Kg<br/>Acum.</span>
                      <span className="text-[8px] font-black uppercase tracking-widest text-[var(--q-dark)] text-right self-center pr-1 leading-tight">Perda<br/>Acum.</span>
                    </div>

                    <div className="flex flex-col bg-white">
                      {processamento.listaReversa.map((r, idx) => (
                        <div key={idx} className="grid grid-cols-[30px_55px_1fr_45px_60px_45px_65px_55px] gap-2 px-3 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 items-center">
                          <span className="text-[9px] font-black text-slate-300 text-center">
                            {r.pontoIdx}
                          </span>
                          
                          <div className="flex flex-col items-center leading-none justify-center">
                            <span className="text-[10px] font-black text-[var(--q-dark)]">{r.dataLabel}</span>
                            <span className="text-[8px] font-bold text-slate-400">{r.horaLabel}</span>
                          </div>
                          
                          <span className="text-[10px] font-black text-slate-600 truncate uppercase" title={`${r.campo} (Lote: ${r.lote})`}>
                            {r.campo}
                          </span>
                          
                          <span className="text-[10px] font-bold text-slate-500 text-center">
                            {formatValue(r.tch, 0)}
                          </span>
                          
                          <div className="flex items-center justify-center gap-1 bg-blue-50/50 rounded py-0.5">
                            <span className="text-[11px] font-black text-blue-700">{formatValue(r.tchAcum, 1)}</span>
                            {renderTrend(r.trendTch, 'tch')}
                          </div>
                          
                          <span className="text-[10px] font-bold text-slate-500 text-center">
                            {formatValue(r.kg, 1)}
                          </span>
                          
                          <div className="flex items-center justify-center gap-1 bg-orange-50/50 rounded py-0.5">
                            <span className="text-[11px] font-black text-orange-700">{formatValue(r.kgAcum, 1)}</span>
                            {renderTrend(r.trendKg, 'kg')}
                          </div>
                          
                          <span className="text-[11px] font-black text-right pr-1" style={{ color: getStatusColor(r.perdaPerc, metas.perda) }}>
                            {formatValue(r.perdaPerc)}%
                          </span>
                        </div>
                      ))}
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

export default PerdaMecDetailRankEquipEvo;