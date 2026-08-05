// ================================= DOCUMENTATION ------------------------------------------
// Script: CucDetailDiario
// Purpose: Resumo diário do CUC, Histograma, listagem por lote e resumo por turno.
// Relationships: vw_q_cucdatas, vw_q_cucgeral, tb_q_agrotarget
// ==========================================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import DateSelectorQualyFlow from '../../../components/QualyFlow/DateSelectorQualyFlow';

// ================================= CONFIGURAÇÕES ------------------------------------------
const ANALISE_TOP3 = true; 

const EMISSORES_VALIDOS = [
  '1º Emissor', '2º Emissor', '3º Emissor', '4º Emissor',
  '5º Emissor', '6º Emissor', '7º Emissor', '8º Emissor',
  '9º Emissor', '10º Emissor', '11º Emissor', '12º Emissor'
];

// ================================= HELPERS (MATEMÁTICA & CORES) -------------------------

const formatValue = (value, decimals = 2) => {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  return Number.isNaN(num) ? '-' : num.toFixed(decimals).replace('.', ',');
};

const getCucColor = (value) => {
  const cuc = Number(value);
  if (Number.isNaN(cuc)) return 'var(--q-gray)';
  if (cuc >= 90) return '#22c55e';
  if (cuc >= 80) return '#f59e0b';
  return '#ef4444';
};

const getVazaoColor = (value) => {
  const vazao = Number(value);
  if (Number.isNaN(vazao)) return 'var(--q-gray)';
  if (vazao > 1.2) return '#0ea5e9'; 
  if (vazao > 1.1 && vazao <= 1.2) return '#f59e0b'; 
  if (vazao >= 0.9 && vazao <= 1.1) return '#22c55e'; 
  if (vazao >= 0.8 && vazao < 0.9) return '#f97316'; 
  return '#ef4444'; 
};

const getVazaoBgClass = (vazao) => {
  const v = Number(vazao);
  if (Number.isNaN(v)) return 'bg-slate-300';
  if (v > 1.2) return 'bg-v-blue';
  if (v > 1.1 && v <= 1.2) return 'bg-v-yellow';
  if (v >= 0.9 && v <= 1.1) return 'bg-v-green';
  if (v >= 0.8 && v < 0.9) return 'bg-v-orange';
  return 'bg-v-red';
};

const getEntupColor = (value) => {
  const entup = Number(value);
  if (Number.isNaN(entup)) return 'var(--q-gray)';
  if (entup <= 5) return '#22c55e';
  if (entup <= 10) return '#f59e0b';
  return '#ef4444';
};

const calcularCuc = (valores) => {
  if (!valores || valores.length === 0) return 0;
  const media = valores.reduce((a, b) => a + b, 0) / valores.length;
  if (media === 0) return 0;
  const somaDesvios = valores.reduce((a, b) => a + Math.abs(b - media), 0);
  return 100 * (1 - (somaDesvios / (valores.length * media)));
};

// ================================= EXECUTOR PRINCIPAL -------------------------------------

const CucDetailDiario = ({ initialDate }) => {
  
  const safeInitialDate = (typeof initialDate === 'string' && initialDate.includes('{')) 
    ? new Date().toISOString().split('T')[0] 
    : initialDate;

  const [selectedDate, setSelectedDate] = useState(safeInitialDate || new Date().toISOString().split('T')[0]);
  const [activeYear, setActiveYear] = useState(new Date().getFullYear());
  const [availableDates, setAvailableDates] = useState([]);
  
  const [availableFields, setAvailableFields] = useState([]);
  const [selectedField, setSelectedField] = useState(null); 
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  
  const [summaryData, setSummaryData] = useState(null);
  const [lotesProcessados, setLotesProcessados] = useState([]);
  const [resumoTurnos, setResumoTurnos] = useState([]);
  const [histogramData, setHistogramData] = useState(null);
  const [insights, setInsights] = useState({});
  const [turnosExistentes, setTurnosExistentes] = useState([]);
  
  const [turnoFiltro, setTurnoFiltro] = useState('Todos');
  const [selectedLote, setSelectedLote] = useState(null);
  const [viewUnit, setViewUnit] = useState('L/h');

  const [loading, setLoading] = useState(false);

  const yearsList = useMemo(() => [2026, 2025, 2024], []);

  // 1. Busca Datas
  useEffect(() => {
    let mounted = true;
    const fetchDates = async () => {
      try {
        const { data } = await supabase.from('vw_q_agrotarget_datas').select('data_apontamento').eq('ano', activeYear);
        if (mounted && data) {
          const rawDates = data.map(r => r.data_apontamento?.split('/').reverse().join('-')).filter(Boolean);
          const uniqueDates = [...new Set(rawDates)];
          setAvailableDates(uniqueDates);
          if (uniqueDates.length > 0 && !uniqueDates.includes(selectedDate)) setSelectedDate(uniqueDates[0]);
        }
      } catch (err) { console.error(err); }
    };
    fetchDates();
    return () => { mounted = false; };
  }, [activeYear, selectedDate]);

  // 2. Busca Campos
  useEffect(() => {
    let mounted = true;
    const fetchFields = async () => {
      if (!selectedDate || selectedDate.includes('{')) return;
      setLoading(true);
      setAvailableFields([]);
      setSelectedField(null);
      try {
        const { data } = await supabase.from('vw_q_cucdatas').select('ano, codigo_campo, campo, av').eq('data_apontamento', selectedDate).order('codigo_campo', { ascending: true });
        if (mounted && data && data.length > 0) {
          setAvailableFields(data);
          setSelectedField(data[data.length - 1]);
        }
      } catch (err) { console.error(err); } finally { if (mounted) setLoading(false); }
    };
    fetchFields();
    return () => { mounted = false; };
  }, [selectedDate]);

  // 3. O Cérebro Analítico
  useEffect(() => {
    let mounted = true;
    const fetchAnalytics = async () => {
      if (!selectedField) return;
      setLoading(true);
      
      try {
        const reqSummary = supabase.from('vw_q_cucgeral').select('cuc, vazao, "entup%"').eq('ano', selectedField.ano).eq('codigo_campo', selectedField.codigo_campo).eq('avaliacao', selectedField.av).limit(1).single();
        const reqRaw = supabase.from('tb_q_agrotarget').select('lote, indicador, valor, turno').eq('ano', Number(selectedField.ano)).eq('campo', String(selectedField.campo).trim()).eq('extra1', String(selectedField.av).trim()).in('ocorrencia', ['CUC - Gotejo', 'CUC - Gotejo 9E']);

        const [resSummary, resRaw] = await Promise.all([reqSummary, reqRaw]);
        if (!mounted) return;
        setSummaryData(resSummary.data);

        const rawData = resRaw.data || [];
        
        const lotMap = new Map();
        const turnMap = new Map();
        
        let totalEmittersCount = 0;
        let totalEntupidos = 0;
        const hist = { red: 0, orange: 0, green: 0, yellow: 0, blue: 0, maxCount: 0 };

        // Processamento Linha a Linha
        rawData.forEach(row => {
          const loteStr = row.lote ? String(row.lote).trim() : '0';
          const turno = row.turno || '1º Turno';
          let valMl = row.valor ? parseFloat(String(row.valor).replace(',', '.')) : 0;
          if (isNaN(valMl)) valMl = 0;

          // Mapas
          if (!lotMap.has(loteStr)) lotMap.set(loteStr, { loteStr, turno, emissoresMl: [], entupidosCount: 0 });
          if (!turnMap.has(turno)) turnMap.set(turno, { turno, emissoresMl: [], entupidosCount: 0 });
          
          const lotObj = lotMap.get(loteStr);
          const turnObj = turnMap.get(turno);

          if (EMISSORES_VALIDOS.includes(row.indicador)) {
            lotObj.emissoresMl.push(valMl);
            turnObj.emissoresMl.push(valMl);
            totalEmittersCount++;
            
            const vazaoLh = valMl * 0.02;
            if (vazaoLh < 0.8) hist.red++;
            else if (vazaoLh >= 0.8 && vazaoLh < 0.9) hist.orange++;
            else if (vazaoLh >= 0.9 && vazaoLh <= 1.1) hist.green++;
            else if (vazaoLh > 1.1 && vazaoLh <= 1.2) hist.yellow++;
            else if (vazaoLh > 1.2) hist.blue++;
            
          } else if (row.indicador === 'Emissores Entupidos') {
            lotObj.entupidosCount += valMl;
            turnObj.entupidosCount += valMl;
            totalEntupidos += valMl;
          }
        });

        hist.maxCount = Math.max(hist.red, hist.orange, hist.green, hist.yellow, hist.blue) || 1;
        setHistogramData(hist);

        // Transformar Lotes
        const processedLots = Array.from(lotMap.values()).map(lot => {
          const cucLote = calcularCuc(lot.emissoresMl);
          const meanMl = lot.emissoresMl.reduce((a, b) => a + b, 0) / (lot.emissoresMl.length || 1);
          const vazaoLote = meanMl * 0.02;
          const entupPerc = lot.emissoresMl.length > 0 ? (lot.entupidosCount / lot.emissoresMl.length) * 100 : 0;
          
          const loteNum = parseInt(lot.loteStr, 10);
          const loteFormatado = isNaN(loteNum) ? lot.loteStr : String(loteNum).padStart(2, '0');

          // Histograma Individual do Lote
          const histLote = { red: 0, orange: 0, green: 0, yellow: 0, blue: 0, maxCount: 0 };
          lot.emissoresMl.forEach(ml => {
            const lh = ml * 0.02;
            if (lh < 0.8) histLote.red++;
            else if (lh >= 0.8 && lh < 0.9) histLote.orange++;
            else if (lh >= 0.9 && lh <= 1.1) histLote.green++;
            else if (lh > 1.1 && lh <= 1.2) histLote.yellow++;
            else if (lh > 1.2) histLote.blue++;
          });
          histLote.maxCount = Math.max(histLote.red, histLote.orange, histLote.green, histLote.yellow, histLote.blue) || 1;

          let analise = "Dentro do padrão";
          if (entupPerc > 10) analise = "Alto Entupimento";
          else if (entupPerc <= 10 && vazaoLote > 1.2) analise = "Risco de Saturação";
          else if (entupPerc <= 10 && vazaoLote < 0.8) analise = "Baixa Vazão";
          else if (entupPerc <= 10 && cucLote < 75) analise = "CUC Abaixo da Meta";
          else if (entupPerc <= 10 && vazaoLote >= 0.8 && vazaoLote <= 1.2 && cucLote < 85) analise = "Alta Variação";

          return { ...lot, loteNum, loteFormatado, cuc: cucLote, vazao: vazaoLote, entupPerc, analise, histLote };
        }).sort((a, b) => a.loteNum - b.loteNum);

        setLotesProcessados(processedLots);
        setTurnosExistentes([...new Set(processedLots.map(l => l.turno))].sort());

        // Transformar Turnos para a tabela inferior
        const processedTurns = Array.from(turnMap.values()).map(t => {
          const cuc = calcularCuc(t.emissoresMl);
          const vazao = (t.emissoresMl.reduce((a, b) => a + b, 0) / (t.emissoresMl.length || 1)) * 0.02;
          const entupPerc = t.emissoresMl.length > 0 ? (t.entupidosCount / t.emissoresMl.length) * 100 : 0;
          return { ...t, cuc, vazao, entupPerc };
        }).sort((a, b) => a.turno.localeCompare(b.turno));
        setResumoTurnos(processedTurns);

        // Insights Textuais
        const pIdeal = totalEmittersCount > 0 ? ((hist.green) / totalEmittersCount * 100) : 0;
        const pLow = totalEmittersCount > 0 ? ((hist.red + hist.orange) / totalEmittersCount * 100) : 0;
        const pHigh = totalEmittersCount > 0 ? ((hist.yellow + hist.blue) / totalEmittersCount * 100) : 0;
        const macroCuc = resSummary.data?.cuc || 0;

        let msgUnif = "";
        if (macroCuc >= 80) {
          msgUnif = `Resultado do CUC: ${formatValue(macroCuc)}% onde ${formatValue(pIdeal)}% dos emissores estão com vazão entre 0,8 a 1,2L/h.`;
        } else {
          if (pLow > pHigh) {
            msgUnif = `Resultado do CUC: ${formatValue(macroCuc)}% abaixo da meta com ${formatValue(pLow)}% dos emissores avaliados abaixo de 0,8L/h. Tendência a entupimento das fitas gotejadoras.`;
          } else {
            msgUnif = `Resultado do CUC: ${formatValue(macroCuc)}% abaixo da meta com ${formatValue(pHigh)}% dos emissores avaliados acima de 1,2L/h. Tendência a saturação dos lotes.`;
          }
        }
        
        const msgEntup = `Foi identificado ${totalEntupidos} emissores entupidos dos ${totalEmittersCount} emissores avaliados, totalizando ${formatValue((totalEntupidos/totalEmittersCount)*100)}% no geral do campo.`;

        let msgTop3 = null;
        let top3List = [];
        const lotesCriticos = processedLots.filter(l => l.cuc < 80 || l.entupPerc > 10);
        if (lotesCriticos.length > 0 && ANALISE_TOP3) {
          msgTop3 = `${lotesCriticos.length} dos ${processedLots.length} lotes avaliados abaixo de 80% com atenção aos lotes:`;
          top3List = lotesCriticos.sort((a, b) => a.cuc - b.cuc).slice(0, 3);
        }

        setInsights({ unif: msgUnif, entup: msgEntup, isGood: macroCuc >= 80, msgTop3, top3List });

      } catch (err) { console.error(err); } finally { if (mounted) setLoading(false); }
    };

    fetchAnalytics();
    return () => { mounted = false; };
  }, [selectedField]);

  const lotesFiltrados = turnoFiltro === 'Todos' ? lotesProcessados : lotesProcessados.filter(l => l.turno === turnoFiltro);

  // =========================================================================
  // RENDER COMPONENTES REUTILIZÁVEIS
  // =========================================================================
  const renderHistogram = (hist, isModal = false) => {
    if (!hist) return null;
    return (
      <div className={`qf-histogram ${isModal ? 'qf-histogram--sm border-b-0 pb-2' : ''}`}>
        <div className="qf-histogram-bar bg-v-red" style={{ height: `${(hist.red / hist.maxCount) * 100}%` }}>
          <span className="qf-histogram-value">{hist.red}</span>
          <span className="qf-histogram-label">&lt;0.8</span>
        </div>
        <div className="qf-histogram-bar bg-v-orange" style={{ height: `${(hist.orange / hist.maxCount) * 100}%` }}>
          <span className="qf-histogram-value">{hist.orange}</span>
          <span className="qf-histogram-label">0.8-0.9</span>
        </div>
        <div className="qf-histogram-bar bg-v-green" style={{ height: `${(hist.green / hist.maxCount) * 100}%` }}>
          <span className="qf-histogram-value">{hist.green}</span>
          <span className="qf-histogram-label">0.9-1.1</span>
        </div>
        <div className="qf-histogram-bar bg-v-yellow" style={{ height: `${(hist.yellow / hist.maxCount) * 100}%` }}>
          <span className="qf-histogram-value">{hist.yellow}</span>
          <span className="qf-histogram-label">1.1-1.2</span>
        </div>
        <div className="qf-histogram-bar bg-v-blue" style={{ height: `${(hist.blue / hist.maxCount) * 100}%` }}>
          <span className="qf-histogram-value">{hist.blue}</span>
          <span className="qf-histogram-label">&gt;1.2</span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300 w-full pb-10">
      
      {/* 1. HEADER CONTROLS */}
      <div className="flex flex-col gap-4">
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

        {availableFields.length > 0 && (
          <div className="w-full max-w-sm mx-auto">
             <button 
                onClick={() => setIsFieldModalOpen(true)}
                className="w-full h-[46px] bg-white border border-slate-200 hover:border-[var(--q-green)] rounded-xl px-5 text-sm font-black text-[var(--q-dark)] flex items-center justify-between shadow-sm transition-all"
              >
                {selectedField ? `${selectedField.av}º Av/${selectedField.ano} - ${selectedField.campo}` : 'Selecionar Campo...'}
                <span className="text-[var(--q-green)]">▼</span>
              </button>
          </div>
        )}
      </div>

      {!loading && availableFields.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white border border-dashed border-slate-200 rounded-xl">
          <span className="text-4xl opacity-40 mb-4 grayscale">🌱</span>
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Sem coletas de CUC</h3>
        </div>
      ) : (
        selectedField && (
          <div className="flex flex-col gap-6 animate-in slide-in-from-bottom-4 duration-500">
            
            {/* CARDS LADO A LADO */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col items-center gap-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">CUC</span>
                <span className="text-2xl sm:text-3xl font-black tracking-tighter" style={{ color: getCucColor(summaryData?.cuc) }}>{formatValue(summaryData?.cuc)}%</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col items-center gap-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vazão (L/h)</span>
                <span className="text-2xl sm:text-3xl font-black tracking-tighter" style={{ color: getVazaoColor(summaryData?.vazao) }}>{formatValue(summaryData?.vazao)}</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col items-center gap-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Entup.</span>
                <span className="text-2xl sm:text-3xl font-black tracking-tighter" style={{ color: getEntupColor(summaryData?.['entup%']) }}>{formatValue(summaryData?.['entup%'])}%</span>
              </div>
            </div>

            {/* SEÇÃO 1: ANÁLISES */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm qf-analysis-box">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">Insights</h4>
              <div className="flex flex-col gap-3 text-xs font-bold text-slate-600 leading-relaxed">
                <p><span className={insights.isGood ? 'text-[var(--q-green)]' : 'text-[var(--q-orange)]'}>●</span> {insights.unif}</p>
                <p><span className="text-[var(--q-dark)]">●</span> {insights.entup}</p>
                
                {insights.msgTop3 && (
                  <div className="mt-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <p className="text-[var(--q-danger)] mb-2">⚠ {insights.msgTop3}</p>
                    <ul className="flex flex-col gap-1.5 ml-2">
                      {insights.top3List.map(l => (
                        <li key={l.loteNum} className="text-[10px]">
                          <span className="bg-slate-200 px-1.5 py-0.5 rounded text-[var(--q-dark)] mr-1">Lote {l.loteFormatado}</span> 
                          CUC: <span style={{color: getCucColor(l.cuc)}}>{formatValue(l.cuc)}%</span> | 
                          L/h: <span style={{color: getVazaoColor(l.vazao)}}>{formatValue(l.vazao)}</span> - 
                          <span className="text-slate-500 italic ml-1">({l.analise})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* SEÇÃO 2: HISTOGRAMA GERAL */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm overflow-hidden">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-6">Distribuição de Vazão (L/h)</h4>
              {renderHistogram(histogramData)}
            </div>

            {/* SEÇÃO 3: LOTES AVALIADOS E RESUMO DOS TURNOS */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h4 className="text-[10px] font-black text-[var(--q-dark)] uppercase tracking-widest">Lotes Avaliados</h4>
                
                <div className="flex gap-1 bg-white border border-slate-200 p-0.5 rounded-lg shadow-inner">
                  <button onClick={() => setTurnoFiltro('Todos')} className={`px-2 py-1 text-[9px] font-black uppercase rounded-md transition-colors ${turnoFiltro === 'Todos' ? 'bg-[var(--q-green)] text-white' : 'text-slate-400 hover:bg-slate-50'}`}>Todos</button>
                  {turnosExistentes.map(t => (
                    <button key={t} onClick={() => setTurnoFiltro(t)} className={`px-2 py-1 text-[9px] font-black uppercase rounded-md transition-colors ${turnoFiltro === t ? 'bg-[var(--q-green)] text-white' : 'text-slate-400 hover:bg-slate-50'}`}>{t.replace('Turno', 'T.')}</button>
                  ))}
                </div>
              </div>

              <div className="qf-lot-item !bg-white !border-b-2 !border-slate-100 !border-l-transparent !py-2 !cursor-default opacity-60">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Lote</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 pl-2">Uniformidade</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">CUC</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">L/h</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Ent.</span>
              </div>

              <div className="flex flex-col max-h-[400px] overflow-y-auto custom-scrollbar">
                {lotesFiltrados.map(l => (
                  <div key={l.loteNum} onClick={() => setSelectedLote(l)} className="qf-lot-item group">
                    <span className="text-xs font-black text-slate-400 group-hover:text-[var(--q-dark)] transition-colors">{l.loteFormatado}</span>
                    
                    <div className="flex flex-col gap-0.5 pr-2">
                      <div className="qf-lot-bar-bg">
                        <div className="qf-lot-bar-fill" style={{ width: `${Math.min(l.cuc, 100)}%`, backgroundColor: getCucColor(l.cuc) }} />
                      </div>
                      <span className="text-[8px] font-bold text-slate-400 uppercase">{l.turno.replace('Turno', 'T')}</span>
                    </div>

                    <span className="text-[11px] font-black text-center" style={{ color: getCucColor(l.cuc) }}>{formatValue(l.cuc)}%</span>
                    <span className="text-[11px] font-black text-center" style={{ color: getVazaoColor(l.vazao) }}>{formatValue(l.vazao)}</span>
                    <span className="text-[11px] font-black text-center" style={{ color: getEntupColor(l.entupPerc) }}>{formatValue(l.entupPerc)}%</span>
                  </div>
                ))}
              </div>

              {/* LISTA COMPACTA DE RESUMO POR TURNO (Fica fixada no rodapé da seção de lotes) */}
              <div className="bg-slate-50 border-t border-slate-200 flex flex-col p-4 gap-3">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Resultado por Turno</span>
                <div className="flex flex-col md:flex-row gap-3">
                  {resumoTurnos.map((t, idx) => (
                    <div key={idx} className="flex-1 bg-white border border-slate-200 rounded-lg p-3 flex justify-between items-center shadow-sm">
                      <span className="text-[10px] font-black text-[var(--q-dark)] uppercase">{t.turno}</span>
                      <div className="flex gap-4">
                        <span className="flex flex-col items-center"><span className="text-[8px] text-slate-400 font-bold uppercase">CUC</span><span className="text-xs font-black" style={{ color: getCucColor(t.cuc) }}>{formatValue(t.cuc)}%</span></span>
                        <span className="flex flex-col items-center"><span className="text-[8px] text-slate-400 font-bold uppercase">L/h</span><span className="text-xs font-black" style={{ color: getVazaoColor(t.vazao) }}>{formatValue(t.vazao)}</span></span>
                        <span className="flex flex-col items-center"><span className="text-[8px] text-slate-400 font-bold uppercase">Entup</span><span className="text-xs font-black" style={{ color: getEntupColor(t.entupPerc) }}>{formatValue(t.entupPerc)}%</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        )
      )}

      {/* ====================================================================
          MODAL DE CAMPO 
      ==================================================================== */}
      {isFieldModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setIsFieldModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <span className="text-sm font-black text-[var(--q-dark)] uppercase tracking-widest">Selecionar Campo</span>
              <button onClick={() => setIsFieldModalOpen(false)} className="text-slate-400 hover:text-red-500 font-bold">✕</button>
            </div>
            <div className="overflow-y-auto p-2 flex flex-col gap-1 custom-scrollbar">
              {availableFields.map((f, i) => (
                <button 
                  key={i} onClick={() => { setSelectedField(f); setIsFieldModalOpen(false); }}
                  className={`px-4 py-3 text-left rounded-lg text-sm font-bold transition-colors ${selectedField?.codigo_campo === f.codigo_campo && selectedField?.av === f.av ? 'bg-[var(--q-green-soft)] text-[var(--q-green-dark)]' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {f.av}ºav/{f.ano} - {f.campo}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL DO LOTE SELECIONADO (Matriz e Histograma)
      ==================================================================== */}
      {selectedLote && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200" onClick={() => setSelectedLote(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-screen" onClick={e => e.stopPropagation()}>
            
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <div className="flex flex-col">
                <span className="text-sm font-black text-[var(--q-dark)] uppercase tracking-widest">Lote {selectedLote.loteFormatado}</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">{selectedField.campo} • {selectedLote.turno}</span>
              </div>
              <button onClick={() => setSelectedLote(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-red-100 hover:text-red-500 font-bold transition-colors">✕</button>
            </div>

            <div className="p-5 flex flex-col gap-5 overflow-y-auto custom-scrollbar">
              
              <div className="grid grid-cols-3 gap-3">
                <div className="border border-slate-100 rounded-xl p-3 flex flex-col items-center gap-1 shadow-sm">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">CUC</span>
                  <span className="text-xl font-black" style={{ color: getCucColor(selectedLote.cuc) }}>{formatValue(selectedLote.cuc)}%</span>
                </div>
                <div className="border border-slate-100 rounded-xl p-3 flex flex-col items-center gap-1 shadow-sm">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">L/h</span>
                  <span className="text-xl font-black" style={{ color: getVazaoColor(selectedLote.vazao) }}>{formatValue(selectedLote.vazao)}</span>
                </div>
                <div className="border border-slate-100 rounded-xl p-3 flex flex-col items-center gap-1 shadow-sm">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Entup.</span>
                  <span className="text-xl font-black" style={{ color: getEntupColor(selectedLote.entupPerc) }}>{formatValue(selectedLote.entupPerc)}%</span>
                </div>
              </div>

              <div className="flex items-center justify-center p-3 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pré-Análise: <strong className="text-[var(--q-dark)]">{selectedLote.analise}</strong></span>
              </div>

              {/* Histograma do Lote */}
              <div className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block text-center">Frequência de Vazão no Lote</span>
                {renderHistogram(selectedLote.histLote, true)}
              </div>

              {/* Grid de Emissores (Travado em 9 colunas) */}
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Emissores Avaliados {selectedLote.emissoresMl.length}
                  </span>
                  
                  <div className="flex bg-slate-100 p-0.5 rounded-md">
                    <button onClick={() => setViewUnit('mL')} className={`px-2 py-0.5 text-[9px] font-black uppercase rounded ${viewUnit === 'mL' ? 'bg-white text-[var(--q-dark)] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>mL</button>
                    <button onClick={() => setViewUnit('L/h')} className={`px-2 py-0.5 text-[9px] font-black uppercase rounded ${viewUnit === 'L/h' ? 'bg-white text-[var(--q-dark)] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>L/h</button>
                  </div>
                </div>
                
                <div className="qf-emitter-grid">
                  {selectedLote.emissoresMl.map((ml, idx) => {
                    const lh = ml * 0.02;
                    return (
                      <div key={idx} className={`qf-emitter-box ${getVazaoBgClass(lh)}`} title={`Emissor ${idx+1}: ${lh.toFixed(2)} L/h`}>
                        {viewUnit === 'mL' ? ml : formatValue(lh, 1)}
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
  );
};

export default CucDetailDiario;