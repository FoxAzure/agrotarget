// ================================= DOCUMENTATION ------------------------------------------
// Script: CucDetailComparativo
// Purpose: Comparação avançada de DUAS avaliações de CUC com layout slim e responsivo.
// Relationships: vw_q_cucgeral, tb_q_agrotarget
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

const CUC_OCORRENCIAS = ['CUC - Gotejo', 'CUC - Gotejo 9E'];
const EMISSORES_VALIDOS = [
  '1º Emissor', '2º Emissor', '3º Emissor', '4º Emissor',
  '5º Emissor', '6º Emissor', '7º Emissor', '8º Emissor',
  '9º Emissor', '10º Emissor', '11º Emissor', '12º Emissor'
];

// ================================= HELPERS ===============================================

const EMPTY_ENGINE = {
  fieldResults: [], lotes: [],
  insights: { topMelhorias: [], topPioras: [] },
  error: false, errorMessage: ''
};

const formatValue = (value, decimals = 2) => {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  return Number.isNaN(num) ? '-' : num.toFixed(decimals).replace('.', ',');
};

const parseDate = (dateStr) => {
  if (!dateStr) return 0;
  if (dateStr instanceof Date) return dateStr.getTime();
  const value = String(dateStr).trim();
  if (!value) return 0;
  if (value.includes('-')) {
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  }
  const parts = value.split('/');
  if (parts.length !== 3) return 0;
  const [d, m, y] = parts;
  const time = new Date(`${y}-${m}-${d}`).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const sortEvaluations = (a, b) => {
  const dateDiff = parseDate(b.dt_final) - parseDate(a.dt_final);
  if (dateDiff !== 0) return dateDiff;
  const yearDiff = Number(b.ano || 0) - Number(a.ano || 0);
  if (yearDiff !== 0) return yearDiff;
  return Number(b.avaliacao || 0) - Number(a.avaliacao || 0);
};

const getCucColor = (value) => {
  const v = Number(value);
  if (Number.isNaN(v)) return 'var(--q-gray)';
  if (v >= 90) return '#22c55e';
  if (v >= 80) return '#f59e0b';
  return '#ef4444';
};

const getVazaoColor = (value) => {
  const v = Number(value);
  if (Number.isNaN(v)) return 'var(--q-gray)';
  if (v > 1.2) return '#0ea5e9';
  if (v > 1.1 && v <= 1.2) return '#f59e0b';
  if (v >= 0.9 && v <= 1.1) return '#22c55e';
  if (v >= 0.8 && v < 0.9) return '#f97316';
  return '#ef4444';
};

const getEntupColor = (value) => {
  const v = Number(value);
  if (Number.isNaN(v)) return 'var(--q-gray)';
  if (v <= 5) return '#22c55e';
  if (v <= 10) return '#f59e0b';
  return '#ef4444';
};

const calcularCuc = (valores) => {
  if (!Array.isArray(valores) || valores.length === 0) return 0;
  const media = valores.reduce((acc, val) => acc + Number(val || 0), 0) / valores.length;
  if (!media) return 0;
  const somaDesvios = valores.reduce((acc, val) => acc + Math.abs(Number(val || 0) - media), 0);
  return 100 * (1 - somaDesvios / (valores.length * media));
};

const sameEval = (a, b) => {
  if (!a || !b) return false;
  return (
    String(a.codigo_campo ?? a.campo ?? '') === String(b.codigo_campo ?? b.campo ?? '') &&
    Number(a.ano) === Number(b.ano) &&
    Number(a.avaliacao) === Number(b.avaliacao)
  );
};

const evaluationKey = (ev) => `${ev?.codigo_campo ?? ev?.campo ?? 'campo'}|${ev?.ano ?? ''}|${ev?.avaliacao ?? ''}`;

const uniqueEvaluations = (rows) => {
  const map = new Map();
  (rows || []).forEach((row) => {
    const key = evaluationKey(row);
    if (!map.has(key)) map.set(key, row);
  });
  return Array.from(map.values());
};

// ================================= UI COMPONENTS =========================================

const CompareTriangle = ({ daily, yearly, reverse = false }) => {
  if (daily === null || yearly === null || daily === undefined || yearly === undefined) return null;
  const diff = Number(daily) - Number(yearly);
  
  if (Math.abs(diff) < 0.01) return <span className="text-[12px] text-slate-300 font-black text-center">-</span>;
  
  const isUp = diff > 0;
  // Lógica: Se reverse for true (Entupimento), ir pra cima (isUp) é Ruim (!isGood). 
  // Para CUC e Vazão, ir pra cima é Bom.
  const isGood = reverse ? !isUp : isUp; 
  
  const colorClass = isGood ? 'text-green-500' : 'text-red-500';
  const animClass = isUp ? 'qf-anim-triangle-up' : 'qf-anim-triangle-down';
  
  return <span className={`${colorClass} ${animClass} font-black text-center mx-1`}>{isUp ? '▲' : '▼'}</span>;
};

const BigDiffDisplay = ({ oldV, newV, reverse = false }) => {
  if (oldV == null || newV == null) return <span className="text-[26px] font-black text-slate-300">-</span>;
  const diff = Number(newV) - Number(oldV);
  
  if (Math.abs(diff) < 0.01) return <span className="text-[26px] font-black text-slate-400">0,0%</span>;

  const isUp = diff > 0;
  const isGood = reverse ? !isUp : isUp;
  const colorClass = isGood ? 'text-green-500' : 'text-red-500';

  return (
    <div className="flex items-center justify-center gap-1">
      <CompareTriangle daily={newV} yearly={oldV} reverse={reverse} />
      <span className={`text-[26px] font-black tracking-tighter ${colorClass}`}>
        {isUp ? '+' : ''}{formatValue(diff, 1)}%
      </span>
    </div>
  );
};

const LoadingSpinner = () => (
  <div className="flex flex-col items-center justify-center p-10 opacity-80">
    <div className="w-8 h-8 border-4 border-[var(--q-green)]/20 border-t-[var(--q-green)] rounded-full animate-spin mb-3"></div>
    <span className="text-[10px] font-black text-[var(--q-green)] uppercase tracking-widest animate-pulse">Processando milhares de dados...</span>
  </div>
);

// ================================= EXECUTOR (MAIN) =======================================

const CucDetailComparativo = () => {
  const [availableData, setAvailableData] = useState([]);
  const [loadingBase, setLoadingBase] = useState(true);
  const [loading, setLoading] = useState(false);

  const [engineData, setEngineData] = useState(EMPTY_ENGINE);
  const [comparison, setComparison] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState('field');

  const [fieldSearch, setFieldSearch] = useState('');
  const [selectedField, setSelectedField] = useState(null);
  const [fieldEvaluations, setFieldEvaluations] = useState([]);

  const [pendingOld, setPendingOld] = useState(null);
  const [pendingCurrent, setPendingCurrent] = useState(null);

  const [lotesTab, setLotesTab] = useState('CUC');

  // ==================== FETCH BASE ====================
  useEffect(() => {
    let mounted = true;
    const fetchBaseData = async () => {
      setLoadingBase(true);
      try {
        const { data, error } = await supabase
          .from('vw_q_cucgeral')
          .select('ano, campo, codigo_campo, avaliacao, dt_inicial, dt_final, cuc, vazao, "entup%"');
        if (error) throw error;
        if (mounted) setAvailableData(uniqueEvaluations(data || []));
      } catch (err) {
        console.error('Erro CUC:', err);
      } finally {
        if (mounted) setLoadingBase(false);
      }
    };
    fetchBaseData();
    return () => { mounted = false; };
  }, []);

  const fields = useMemo(() => {
    const map = new Map();
    availableData.forEach((item) => {
      const key = String(item.codigo_campo || item.campo || '').trim();
      if (!key) return;
      if (!map.has(key)) map.set(key, { codigo_campo: item.codigo_campo, campo: item.campo || item.codigo_campo, evaluations: [] });
      map.get(key).evaluations.push(item);
    });
    return Array.from(map.values())
      .map((f) => ({ ...f, evaluations: [...f.evaluations].sort(sortEvaluations) }))
      .sort((a, b) => String(a.campo).localeCompare(String(b.campo), 'pt-BR'));
  }, [availableData]);

  const filteredFields = useMemo(() => {
    const term = fieldSearch.trim().toLowerCase();
    if (!term) return fields.slice(0, 50);
    return fields.filter(f => String(f.campo).toLowerCase().includes(term) || String(f.codigo_campo || '').toLowerCase().includes(term)).slice(0, 50);
  }, [fields, fieldSearch]);

  // ==================== MODAL ACTIONS ====================
  const openSelector = () => {
    setFieldSearch(''); setSelectedField(null); setFieldEvaluations([]);
    setPendingOld(null); setPendingCurrent(null); 
    setModalStep('field'); setIsModalOpen(true);
  };

  const chooseField = (field) => {
    const evals = [...(field?.evaluations || [])].sort(sortEvaluations);
    setSelectedField(field); setFieldEvaluations(evals);
    if (evals.length >= 2) {
      setPendingCurrent(evals[0]); setPendingOld(evals[1]);
    } else {
      setPendingCurrent(evals[0] || null); setPendingOld(null);
    }
    setModalStep('confirm');
  };

  const confirmComparison = () => {
    if (!pendingCurrent || !pendingOld) return;
    setEngineData(EMPTY_ENGINE); setLoading(true);
    setComparison({ old: pendingOld, current: pendingCurrent });
    setIsModalOpen(false);
  };

  const clearComparison = () => {
    setComparison(null);
    setEngineData(EMPTY_ENGINE);
  };

  // ==================== ENGINE ====================
  useEffect(() => {
    let mounted = true;
    const fetchComparisonData = async () => {
      if (!comparison?.old || !comparison?.current) {
        if (mounted) { setEngineData(EMPTY_ENGINE); setLoading(false); }
        return;
      }
      setLoading(true); setEngineData(EMPTY_ENGINE);

      try {
        const evals = [comparison.old, comparison.current];
        const promises = evals.map((ev) =>
          supabase.from('tb_q_agrotarget')
            .select('lote, indicador, valor')
            .eq('ano', Number(ev.ano))
            .eq('campo', String(ev.campo).trim())
            .eq('extra1', String(ev.avaliacao).trim())
            .in('ocorrencia', CUC_OCORRENCIAS)
        );

        const responses = await Promise.all(promises);
        if (!mounted) return;

        const lotMap = new Map();
        const fieldResults = [];

        responses.forEach((response, idx) => {
          if (response.error) throw response.error;
          const rawData = response.data || [];
          const emitters = [];
          let entupidos = 0;
          const tempLotes = new Map();

          rawData.forEach((row) => {
            const loteStr = row.lote ? String(row.lote).trim() : '0';
            let valMl = parseFloat(String(row.valor ?? '0').replace(',', '.'));
            if (Number.isNaN(valMl)) valMl = 0;

            if (!tempLotes.has(loteStr)) tempLotes.set(loteStr, { emissoresMl: [], entupidos: 0 });

            if (EMISSORES_VALIDOS.includes(row.indicador)) {
              emitters.push(valMl);
              tempLotes.get(loteStr).emissoresMl.push(valMl);
            } else if (row.indicador === 'Emissores Entupidos') {
              entupidos += valMl;
              tempLotes.get(loteStr).entupidos += valMl;
            }
          });

          const fieldCuc = calcularCuc(emitters);
          const fieldVazao = emitters.length ? (emitters.reduce((a, b) => a + b, 0) / emitters.length) * 0.02 : 0;
          const fieldEntup = emitters.length ? (entupidos / emitters.length) * 100 : 0;
          fieldResults[idx] = { cuc: fieldCuc, vazao: fieldVazao, entup: fieldEntup };

          tempLotes.forEach((data, lStr) => {
            if (!lotMap.has(lStr)) lotMap.set(lStr, { loteStr: lStr, evals: {} });
            lotMap.get(lStr).evals[idx] = {
              cuc: calcularCuc(data.emissoresMl),
              vazao: data.emissoresMl.length ? (data.emissoresMl.reduce((a, b) => a + b, 0) / data.emissoresMl.length) * 0.02 : 0,
              entup: data.emissoresMl.length ? (data.entupidos / data.emissoresMl.length) * 100 : 0
            };
          });
        });

        const lotes = Array.from(lotMap.values()).map((l) => ({
          ...l,
          loteNum: parseInt(l.loteStr, 10) || 999999,
          loteFormatado: Number.isNaN(parseInt(l.loteStr, 10)) ? l.loteStr : String(parseInt(l.loteStr, 10)).padStart(2, '0')
        })).sort((a, b) => a.loteNum - b.loteNum);

        const commonLotes = lotes.filter((l) => l.evals[0] && l.evals[1]);

        const insightsLotes = commonLotes.map(l => ({
          ...l,
          diffCuc: l.evals[1].cuc - l.evals[0].cuc,
          diffEntup: l.evals[1].entup - l.evals[0].entup
        }));

        const topMelhorias = [...insightsLotes].filter(l => l.diffCuc > 0 || l.diffEntup < 0).sort((a, b) => b.diffCuc - a.diffCuc).slice(0, 3);
        const topPioras = [...insightsLotes].filter(l => l.diffCuc < 0 || l.diffEntup > 0).sort((a, b) => a.diffCuc - b.diffCuc).slice(0, 3);

        if (mounted) setEngineData({ fieldResults, lotes, insights: { topMelhorias, topPioras }, error: false, errorMessage: '' });
      } catch (err) {
        console.error('Erro no motor:', err);
        if (mounted) setEngineData({ ...EMPTY_ENGINE, error: true, errorMessage: 'Falha ao processar dados.' });
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchComparisonData();
    return () => { mounted = false; };
  }, [comparison]);

  // ==================== RENDERS ====================
  const { fieldResults, lotes, insights: { topMelhorias, topPioras } } = engineData;
  const oldResult = fieldResults[0] || null;
  const currentResult = fieldResults[1] || null;

  return (
    <div className="flex flex-col gap-5 animate-in slide-in-from-right-4 duration-300 pb-10">
      
      {/* HEADER COMPACTO E BONITO */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        {comparison ? (
          <div className="flex flex-col text-center md:text-left">
            <span className="text-[14px] font-black uppercase text-slate-800 tracking-wider mb-1">{comparison.current.campo}</span>
            <div className="flex items-center justify-center md:justify-start gap-3">
              <span className="text-xs font-bold text-slate-500">{comparison.old.avaliacao}º Av / {comparison.old.ano}</span>
              <span className="text-xs font-black text-slate-300">VS</span>
              <span className="text-xs font-bold text-[var(--q-green)]">{comparison.current.avaliacao}º Av / {comparison.current.ano}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            <h2 className="text-lg font-black text-slate-800 m-0">Comparativo <span className="text-[var(--q-green)]">• CUC</span></h2>
            <span className="text-xs font-bold text-slate-400">Selecione um campo para analisar a evolução.</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button 
            onClick={openSelector} 
            className="h-[38px] px-5 bg-[var(--q-green)] hover:bg-green-600 text-white rounded-lg text-[11px] font-black uppercase tracking-widest transition-all shadow-md hover:shadow-lg"
          >
            {comparison ? 'Alterar' : 'Selecionar Campo'}
          </button>
          
          {comparison && (
            <button 
              onClick={clearComparison}
              title="Limpar Comparação"
              className="h-[38px] w-[38px] flex items-center justify-center bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 hover:border-red-300 rounded-lg text-sm font-black transition-colors shadow-sm"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {!comparison ? (
        <div className="flex flex-col items-center justify-center bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center opacity-80 min-h-[300px]">
           <span className="text-4xl mb-3">📊</span>
           <span className="text-[13px] font-black text-slate-600 uppercase tracking-widest">Nenhum comparativo ativo</span>
           <span className="text-xs font-bold text-slate-400 mt-2 max-w-sm">Use o botão acima para escolher um campo e comparar o desempenho entre as avaliações.</span>
        </div>
      ) : loading ? (
        <LoadingSpinner />
      ) : engineData.error ? (
        <div className="bg-red-50 text-red-600 border border-red-200 p-5 rounded-xl font-bold text-center text-sm shadow-sm">
          Ops, ocorreu um erro ao processar os dados.
        </div>
      ) : (
        <div className="flex flex-col gap-5">

          {/* 1. CARDS PRINCIPAIS (LADO A LADO) */}
          <div className="grid grid-cols-3 gap-3">
            {/* CUC */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-between shadow-sm hover:shadow-md transition-shadow h-full">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">CUC</span>
              <BigDiffDisplay oldV={oldResult?.cuc} newV={currentResult?.cuc} />
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-100 w-full justify-center">
                 <span className="text-[12px] font-bold text-slate-400">{formatValue(oldResult?.cuc, 1)}%</span>
                 <span className="text-[12px] text-slate-300">→</span>
                 <span className="text-[12px] font-black" style={{color: getCucColor(currentResult?.cuc)}}>{formatValue(currentResult?.cuc, 1)}%</span>
              </div>
            </div>

            {/* VAZÃO */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-between shadow-sm hover:shadow-md transition-shadow h-full">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Vazão (L/h)</span>

              <div className="flex flex-col w-full gap-2 flex-1 justify-center mt-1">
                <div className="flex justify-between items-center px-2">
                  <span className="text-[11px] font-bold text-slate-400">{comparison.old.avaliacao}º Av/{String(comparison.old.ano).slice(-2)}</span>
                  <span className="text-[16px] font-black text-slate-400">{formatValue(oldResult?.vazao, 2)}</span>
                </div>
                <div className="flex justify-between items-end px-2 pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-[var(--q-green)] pb-1">{comparison.current.avaliacao}º Av/{String(comparison.current.ano).slice(-2)}</span>
                  <div className="flex items-center gap-1">
                    <CompareTriangle daily={currentResult?.vazao} yearly={oldResult?.vazao} />
                    <span className="text-[16px] font-black leading-none" style={{color: getVazaoColor(currentResult?.vazao)}}>
                      {formatValue(currentResult?.vazao, 2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ENTUPIDOS */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-between shadow-sm hover:shadow-md transition-shadow h-full">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Entup.</span>
              <BigDiffDisplay oldV={oldResult?.entup} newV={currentResult?.entup} reverse={true} />
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-100 w-full justify-center">
                 <span className="text-[12px] font-bold text-slate-400">{formatValue(oldResult?.entup, 1)}%</span>
                 <span className="text-[12px] text-slate-300">→</span>
                 <span className="text-[12px] font-black" style={{color: getEntupColor(currentResult?.entup)}}>{formatValue(currentResult?.entup, 1)}%</span>
              </div>
            </div>
          </div>

          {/* 2. INSIGHTS TONE PASTEL */}
          {(topMelhorias.length > 0 || topPioras.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* MELHORES */}
              <div className="bg-[#f0fdf4] border border-green-200 rounded-xl p-4 shadow-sm flex flex-col">
                <span className="text-[10px] font-black text-green-700 uppercase tracking-widest mb-3 text-center">Melhores Evoluções (Lotes)</span>
                <div className="grid grid-cols-[40px_1fr_1fr_1fr] gap-2 border-b border-green-200/50 pb-2 mb-2">
                   <span className="text-[9px] font-black text-green-600/70 uppercase">Lote</span>
                   <span className="text-[9px] font-black text-green-600/70 uppercase text-center">CUC</span>
                   <span className="text-[9px] font-black text-green-600/70 uppercase text-center">L/h</span>
                   <span className="text-[9px] font-black text-green-600/70 uppercase text-right">Entup.</span>
                </div>
                {topMelhorias.map(l => (
                  <div key={l.loteNum} className="grid grid-cols-[40px_1fr_1fr_1fr] gap-2 items-center py-1.5 border-b border-green-200/30 last:border-0">
                    <span className="text-[11px] font-black text-green-800">{l.loteFormatado}</span>
                    <div className="flex justify-center"><CompareTriangle daily={l.evals[1].cuc} yearly={l.evals[0].cuc} /><span className="text-[11px] font-black text-green-700 ml-1">{formatValue(l.evals[1].cuc, 1)}%</span></div>
                    <div className="flex justify-center"><span className="text-[11px] font-black text-green-700">{formatValue(l.evals[1].vazao, 2)}</span></div>
                    <div className="flex justify-end"><CompareTriangle daily={l.evals[1].entup} yearly={l.evals[0].entup} reverse={true} /><span className="text-[11px] font-black text-green-700 ml-1">{formatValue(l.evals[1].entup, 1)}%</span></div>
                  </div>
                ))}
              </div>

              {/* PIORES */}
              <div className="bg-[#fef2f2] border border-red-200 rounded-xl p-4 shadow-sm flex flex-col">
                <span className="text-[10px] font-black text-red-700 uppercase tracking-widest mb-3 text-center">Pontos de Atenção (Quedas)</span>
                <div className="grid grid-cols-[40px_1fr_1fr_1fr] gap-2 border-b border-red-200/50 pb-2 mb-2">
                   <span className="text-[9px] font-black text-red-600/70 uppercase">Lote</span>
                   <span className="text-[9px] font-black text-red-600/70 uppercase text-center">CUC</span>
                   <span className="text-[9px] font-black text-red-600/70 uppercase text-center">L/h</span>
                   <span className="text-[9px] font-black text-red-600/70 uppercase text-right">Entup.</span>
                </div>
                {topPioras.map(l => (
                  <div key={l.loteNum} className="grid grid-cols-[40px_1fr_1fr_1fr] gap-2 items-center py-1.5 border-b border-red-200/30 last:border-0">
                    <span className="text-[11px] font-black text-red-800">{l.loteFormatado}</span>
                    <div className="flex justify-center"><CompareTriangle daily={l.evals[1].cuc} yearly={l.evals[0].cuc} /><span className="text-[11px] font-black text-red-700 ml-1">{formatValue(l.evals[1].cuc, 1)}%</span></div>
                    <div className="flex justify-center"><span className="text-[11px] font-black text-red-700">{formatValue(l.evals[1].vazao, 2)}</span></div>
                    <div className="flex justify-end"><CompareTriangle daily={l.evals[1].entup} yearly={l.evals[0].entup} reverse={true} /><span className="text-[11px] font-black text-red-700 ml-1">{formatValue(l.evals[1].entup, 1)}%</span></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. LOTES (LISTA SLIM COM CORES) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-3 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-3">
              <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest text-center md:text-left">Evolução por Lote</span>
              
              <div className="flex w-full md:w-auto bg-slate-100 p-1 rounded-lg">
                {['CUC', 'Vazão', 'Entupimento'].map(tab => (
                  <button 
                    key={tab}
                    onClick={() => setLotesTab(tab)}
                    className={`flex-1 md:flex-none px-4 py-2 rounded-md text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all ${lotesTab === tab ? 'bg-[var(--q-green)] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="grid grid-cols-[60px_1fr_1fr_50px] gap-2 items-center px-4 py-2.5 bg-slate-50 border-b border-slate-100">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-left">Lote</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Anterior</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Atual</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Dif.</span>
            </div>

            <div className="flex flex-col max-h-[400px] overflow-y-auto custom-scrollbar">
              {lotes.map(l => {
                const o = l.evals[0];
                const n = l.evals[1];
                let oldVal, newVal, renderDiff, colorNew;
                
                if (lotesTab === 'CUC') {
                  oldVal = o?.cuc ? formatValue(o.cuc, 1) + '%' : '-';
                  newVal = n?.cuc ? formatValue(n.cuc, 1) + '%' : '-';
                  renderDiff = <CompareTriangle daily={n?.cuc} yearly={o?.cuc} />;
                  colorNew = getCucColor(n?.cuc);
                } else if (lotesTab === 'Vazão') {
                  oldVal = o?.vazao ? formatValue(o.vazao, 2) : '-';
                  newVal = n?.vazao ? formatValue(n.vazao, 2) : '-';
                  renderDiff = <CompareTriangle daily={n?.vazao} yearly={o?.vazao} />;
                  colorNew = getVazaoColor(n?.vazao);
                } else {
                  oldVal = o?.entup ? formatValue(o.entup, 1) + '%' : '-';
                  newVal = n?.entup ? formatValue(n.entup, 1) + '%' : '-';
                  renderDiff = <CompareTriangle daily={n?.entup} yearly={o?.entup} reverse={true} />;
                  colorNew = getEntupColor(n?.entup);
                }

                return (
                  <div key={l.loteNum} className="grid grid-cols-[60px_1fr_1fr_50px] gap-2 items-center px-4 py-3 border-b border-slate-50 hover:bg-slate-50/50 transition-colors last:border-0">
                    <span className="text-[11px] font-black text-slate-700">{l.loteFormatado}</span>
                    <span className="text-[12px] font-bold text-slate-400 text-center">{oldVal}</span>
                    <span className="text-[12px] font-black text-center" style={{ color: colorNew }}>{newVal}</span>
                    <div className="flex justify-center">{renderDiff}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 4. HISTÓRICO GERAL DAQUELE CAMPO */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-3 border-b border-slate-100">
              <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest pl-2">Histórico: {selectedField?.campo}</span>
            </div>
            
            <div className="grid grid-cols-[50px_1fr_50px_50px_50px] md:grid-cols-[60px_1fr_70px_70px_70px] gap-2 items-center px-4 py-2.5 bg-slate-50 border-b border-slate-100">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-left">Av / Ano</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-left hidden md:block">Período</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-left md:hidden">-</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">CUC</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">L/h</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Ent.</span>
            </div>

            <div className="flex flex-col max-h-[300px] overflow-y-auto custom-scrollbar">
              {selectedField?.evaluations?.map(ev => (
                 <div key={evaluationKey(ev)} className="grid grid-cols-[50px_1fr_50px_50px_50px] md:grid-cols-[60px_1fr_70px_70px_70px] gap-2 items-center px-4 py-3 border-b border-slate-50 hover:bg-slate-50/50 transition-colors last:border-0">
                    <div className="flex flex-col text-left">
                       <span className="text-[10px] font-black text-slate-700">{ev.avaliacao}º</span>
                       <span className="text-[8px] font-bold text-slate-400">{ev.ano}</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 hidden md:block truncate">
                       {ev.dt_inicial.split('-').reverse().join('/')} a {ev.dt_final.split('-').reverse().join('/')}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 md:hidden">-</span>
                    
                    <span className="text-[11px] md:text-[12px] font-black text-center" style={{color: getCucColor(ev.cuc)}}>{formatValue(ev.cuc, 1)}%</span>
                    <span className="text-[11px] md:text-[12px] font-black text-center" style={{color: getVazaoColor(ev.vazao)}}>{formatValue(ev.vazao, 2)}</span>
                    <span className="text-[11px] md:text-[12px] font-black text-right" style={{color: getEntupColor(ev['entup%'])}}>{formatValue(ev['entup%'], 1)}%</span>
                 </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ================= MODAL DE SELEÇÃO CENTRALIZADO E FIXO ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[999] p-4 animate-in fade-in duration-200">
          
          <div className="bg-white w-full max-w-lg h-[550px] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="m-0 text-[13px] font-black text-slate-800 uppercase tracking-widest">
                {modalStep === 'field' ? 'Buscar Campo' : 'Selecionar Avaliações'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-lg font-bold transition-colors">
                ✕
              </button>
            </div>
            
            {/* Modal Body */}
            {modalStep === 'field' && (
              <div className="flex flex-col h-full overflow-hidden">
                {/* Search Header Fixa */}
                <div className="px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
                  <div className="flex flex-col w-full">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Nome ou Código</label>
                    <input 
                      autoFocus 
                      type="text"
                      value={fieldSearch} 
                      onChange={e => setFieldSearch(e.target.value)} 
                      placeholder="Procurar campo..." 
                      className="w-full h-[42px] bg-slate-50 border border-slate-200 rounded-lg px-4 text-xs font-bold text-[var(--q-dark)] outline-none focus:border-[var(--q-green)] focus:bg-white transition-all shadow-inner"
                    />
                  </div>
                </div>

                {/* Lista com scroll independente */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-2">
                  {filteredFields.map(f => (
                    <button 
                      key={f.codigo_campo || f.campo} 
                      onClick={() => chooseField(f)} 
                      className="flex justify-between items-center p-3 border border-slate-100 rounded-xl hover:border-[var(--q-green)] hover:bg-[#f0fdf4] transition-all group text-left"
                    >
                      <div className="flex flex-col">
                        <strong className="text-[12px] font-black text-slate-700 group-hover:text-[var(--q-green)] uppercase tracking-wider">{f.campo}</strong>
                      </div>
                      <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest group-hover:bg-green-100 group-hover:text-green-700">
                        {f.evaluations.length} Av.
                      </span>
                    </button>
                  ))}
                  {filteredFields.length === 0 && (
                    <span className="text-center text-xs font-bold text-slate-400 mt-5">Nenhum campo encontrado.</span>
                  )}
                </div>
              </div>
            )}

            {modalStep === 'confirm' && (
              <div className="p-5 flex-1 overflow-y-auto custom-scrollbar flex flex-col h-full">
                <button className="self-start text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest mb-4 transition-colors" onClick={() => setModalStep('field')}>
                  ← Voltar para Busca
                </button>
                
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center mb-5 shrink-0">
                  <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Campo Selecionado</span>
                  <strong className="text-lg font-black text-slate-800 uppercase tracking-wider">{selectedField?.campo}</strong>
                </div>

                {fieldEvaluations.length === 1 ? (
                   <div className="bg-red-50 text-red-600 border border-red-200 p-4 rounded-xl text-center text-xs font-bold shadow-sm shrink-0">
                     Este campo possui apenas 1 avaliação.<br/>É necessário no mínimo 2 avaliações para gerar um comparativo.
                   </div>
                ) : (
                  <div className="flex flex-col gap-4 flex-1">
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Referência (Atual)</span>
                      <div className="bg-[var(--q-green)] text-white px-4 py-3 rounded-xl shadow-sm text-sm font-black text-center flex items-center justify-center gap-2">
                         <span>{pendingCurrent?.avaliacao}º Av</span>
                         <span className="text-green-200">/</span>
                         <span>{pendingCurrent?.ano}</span>
                      </div>
                    </div>

                    <div className="flex justify-center my-1">
                       <span className="text-xl text-slate-300 font-black">VS</span>
                    </div>

                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Comparar com (Anterior)</span>
                      <div className="flex flex-wrap gap-2">
                        {fieldEvaluations.filter(e => !sameEval(e, pendingCurrent)).map(e => {
                          const isActive = sameEval(e, pendingOld);
                          return (
                            <button 
                              key={evaluationKey(e)} 
                              onClick={() => setPendingOld(e)} 
                              className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${isActive ? 'bg-slate-700 text-white shadow-md scale-105' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                            >
                              {e.avaliacao}º Av / {e.ano}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Modal Footer */}
            {modalStep === 'confirm' && fieldEvaluations.length > 1 && (
              <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0">
                <button 
                  onClick={confirmComparison}
                  className="w-full h-[45px] bg-[var(--q-green)] hover:bg-green-600 text-white rounded-xl text-[12px] font-black uppercase tracking-widest transition-all shadow-md hover:shadow-lg"
                >
                  Confirmar e Processar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CucDetailComparativo;