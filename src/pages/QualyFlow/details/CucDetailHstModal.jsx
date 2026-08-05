// ================================= DOCUMENTATION ------------------------------------------
// Script: CucDetailHstModal
// Purpose: Modal duplo do histórico. Visão Geral (Análises, Lotes, Turnos) e Visão Lote.
// Relationships: tb_q_agrotarget
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

const CUC_OCORRENCIAS = ['CUC - Gotejo', 'CUC - Gotejo 9E'];
const EMISSORES_VALIDOS = [
  '1º Emissor', '2º Emissor', '3º Emissor', '4º Emissor',
  '5º Emissor', '6º Emissor', '7º Emissor', '8º Emissor',
  '9º Emissor', '10º Emissor', '11º Emissor', '12º Emissor'
];

// ================================= HELPERS (MATEMÁTICA E CORES) =========================

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

// ================================= COMPONENTES REUTILIZÁVEIS ==============================

const RenderHistogram = ({ hist, isModal = false }) => {
  if (!hist) return null;
  return (
    <div className={`qf-histogram ${isModal ? 'qf-histogram--sm border-b-0 pb-2 pt-2' : ''}`}>
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

// ================================= COMPONENTE PRINCIPAL ===================================

const CucDetailHstModal = ({ item, onClose }) => {
  const [detalhesData, setDetalhesData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Controle de Navegação Interna
  const [selectedLote, setSelectedLote] = useState(null);
  const [viewUnit, setViewUnit] = useState('L/h');

  // Busca de Dados Brutos da Avaliação Selecionada
  useEffect(() => {
    let mounted = true;
    const fetchDetalhesCampo = async () => {
      if (!item) return;
      setLoading(true);
      try {
        const anoNum = Number(item.ano);
        const campoStr = String(item.campo || '').trim();
        const avStr = String(item.avaliacao || '').trim();

        const { data, error } = await supabase
          .from('tb_q_agrotarget')
          .select('lote, indicador, valor, turno')
          .eq('ano', anoNum)
          .eq('campo', campoStr)
          .eq('extra1', avStr)
          .in('ocorrencia', CUC_OCORRENCIAS);

        if (error) throw error;
        if (mounted) setDetalhesData(data || []);
      } catch (err) {
        console.error('Erro ao buscar detalhes no Modal:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchDetalhesCampo();
    return () => { mounted = false; };
  }, [item]);

  // Processamento do Motor Igual ao Diário
  const engine = useMemo(() => {
    if (detalhesData.length === 0) return null;

    const lotMap = new Map();
    const turnMap = new Map();
    let totalEmittersCount = 0;
    let totalEntupidos = 0;
    const hist = { red: 0, orange: 0, green: 0, yellow: 0, blue: 0, maxCount: 0 };

    detalhesData.forEach(row => {
      const loteStr = row.lote ? String(row.lote).trim() : '0';
      const turno = row.turno || '1º Turno';
      let valMl = row.valor ? parseFloat(String(row.valor).replace(',', '.')) : 0;
      if (isNaN(valMl)) valMl = 0;

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

    const lotesProcessados = Array.from(lotMap.values()).map(lot => {
      const cucLote = calcularCuc(lot.emissoresMl);
      const meanMl = lot.emissoresMl.reduce((a, b) => a + b, 0) / (lot.emissoresMl.length || 1);
      const vazaoLote = meanMl * 0.02;
      const entupPerc = lot.emissoresMl.length > 0 ? (lot.entupidosCount / lot.emissoresMl.length) * 100 : 0;
      
      const loteNum = parseInt(lot.loteStr, 10);
      const loteFormatado = isNaN(loteNum) ? lot.loteStr : String(loteNum).padStart(2, '0');

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

    const resumoTurnos = Array.from(turnMap.values()).map(t => {
      const cuc = calcularCuc(t.emissoresMl);
      const vazao = (t.emissoresMl.reduce((a, b) => a + b, 0) / (t.emissoresMl.length || 1)) * 0.02;
      const entupPerc = t.emissoresMl.length > 0 ? (t.entupidosCount / t.emissoresMl.length) * 100 : 0;
      return { ...t, cuc, vazao, entupPerc };
    }).sort((a, b) => a.turno.localeCompare(b.turno));

    const pIdeal = totalEmittersCount > 0 ? ((hist.green) / totalEmittersCount * 100) : 0;
    const pLow = totalEmittersCount > 0 ? ((hist.red + hist.orange) / totalEmittersCount * 100) : 0;
    const pHigh = totalEmittersCount > 0 ? ((hist.yellow + hist.blue) / totalEmittersCount * 100) : 0;
    const macroCuc = item.cuc || 0;

    let unif = "";
    if (macroCuc >= 80) {
      unif = `Resultado do CUC: ${formatValue(macroCuc)}% onde ${formatValue(pIdeal)}% dos emissores estão com vazão entre 0,8 a 1,2L/h.`;
    } else {
      unif = pLow > pHigh 
        ? `Resultado do CUC: ${formatValue(macroCuc)}% abaixo da meta com ${formatValue(pLow)}% dos emissores abaixo de 0,8L/h. Tendência a entupimento.`
        : `Resultado do CUC: ${formatValue(macroCuc)}% abaixo da meta com ${formatValue(pHigh)}% dos emissores acima de 1,2L/h. Tendência a saturação.`;
    }
    const entup = `Foi identificado ${totalEntupidos} emissores entupidos dos ${totalEmittersCount} avaliados, totalizando ${formatValue((totalEntupidos/totalEmittersCount)*100)}% no geral.`;

    let msgTop3 = null;
    let top3List = [];
    const lotesCriticos = lotesProcessados.filter(l => l.cuc < 80 || l.entupPerc > 10);
    if (lotesCriticos.length > 0) {
      msgTop3 = `${lotesCriticos.length} dos ${lotesProcessados.length} lotes apresentaram anomalias. Atenção aos lotes:`;
      top3List = lotesCriticos.sort((a, b) => a.cuc - b.cuc).slice(0, 3);
    }

    return { lotesProcessados, resumoTurnos, hist, insights: { unif, entup, isGood: macroCuc >= 80, msgTop3, top3List } };
  }, [detalhesData, item]);

  if (!item) return null;

  const campoLabel = item.campo || item.codigo_campo || 'Campo';
  const avaliacaoLabel = `${item.avaliacao}ª Avaliação`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="relative bg-white w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 duration-300">
        
        {/* ====================================================================
            HEADER DO MODAL COM CONTROLE DE NAVEGAÇÃO
        ==================================================================== */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div className="flex flex-col">
            <span className="text-sm font-black text-[var(--q-dark)] uppercase tracking-widest">
              {selectedLote ? `Lote ${selectedLote.loteFormatado}` : 'Detalhe da Avaliação'}
            </span>
            <span className="text-[9px] font-bold text-slate-400 uppercase">
              {campoLabel} • Ano {item.ano} • {selectedLote ? selectedLote.turno : avaliacaoLabel}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {selectedLote && (
              <button onClick={() => setSelectedLote(null)} className="h-8 px-3 rounded-lg bg-white border border-slate-200 text-[9px] font-black uppercase text-slate-500 hover:bg-slate-100 transition-colors shadow-sm">
                ← Voltar
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-red-100 hover:text-red-500 font-bold transition-colors">
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-[var(--q-bg)]">
          {loading ? (
             <div className="h-full flex flex-col items-center justify-center">
               <div className="w-8 h-8 border-4 border-[var(--q-green)]/20 border-t-[var(--q-green)] rounded-full animate-spin mb-3" />
               <span className="text-[10px] font-bold text-[var(--q-green)] uppercase tracking-widest animate-pulse">Consultando Dados...</span>
             </div>
          ) : !engine ? (
            <div className="bg-white border border-slate-200 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-slate-400">
              <span className="text-3xl mb-2">💧</span>
              <span className="text-[11px] font-black uppercase tracking-widest text-[var(--q-dark)]">Nenhum dado bruto encontrado</span>
            </div>
          ) : selectedLote ? (
            
            /* ====================================================================
               VISÃO 2: DETALHE DO LOTE ESPECÍFICO
            ==================================================================== */
            <div className="flex flex-col gap-5 animate-in slide-in-from-right-4 duration-300 pb-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="border border-slate-100 bg-white rounded-xl p-3 flex flex-col items-center gap-1 shadow-sm">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">CUC</span>
                  <span className="text-xl font-black" style={{ color: getCucColor(selectedLote.cuc) }}>{formatValue(selectedLote.cuc)}%</span>
                </div>
                <div className="border border-slate-100 bg-white rounded-xl p-3 flex flex-col items-center gap-1 shadow-sm">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">L/h</span>
                  <span className="text-xl font-black" style={{ color: getVazaoColor(selectedLote.vazao) }}>{formatValue(selectedLote.vazao)}</span>
                </div>
                <div className="border border-slate-100 bg-white rounded-xl p-3 flex flex-col items-center gap-1 shadow-sm">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Entup.</span>
                  <span className="text-xl font-black" style={{ color: getEntupColor(selectedLote.entupPerc) }}>{formatValue(selectedLote.entupPerc)}%</span>
                </div>
              </div>

              <div className="flex items-center justify-center p-3 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pré-Análise: <strong className="text-[var(--q-dark)]">{selectedLote.analise}</strong></span>
              </div>

              <div className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block text-center">Frequência de Vazão no Lote</span>
                <RenderHistogram hist={selectedLote.histLote} isModal={true} />
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Emissores Avaliados {selectedLote.emissoresMl.length}</span>
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

          ) : (

            /* ====================================================================
               VISÃO 1: DETALHE GERAL DO CAMPO
            ==================================================================== */
            <div className="flex flex-col gap-5 animate-in slide-in-from-left-4 duration-300 pb-4">
              
              {/* Análises Textuais */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm qf-analysis-box">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">Insights</h4>
                <div className="flex flex-col gap-2.5 text-[11px] font-bold text-slate-600 leading-relaxed">
                  <p><span className={engine.insights.isGood ? 'text-[var(--q-green)]' : 'text-[var(--q-orange)]'}>●</span> {engine.insights.unif}</p>
                  <p><span className="text-[var(--q-dark)]">●</span> {engine.insights.entup}</p>
                  
                  {engine.insights.msgTop3 && (
                    <div className="mt-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <p className="text-[var(--q-danger)] mb-1.5">⚠ {engine.insights.msgTop3}</p>
                      <ul className="flex flex-col gap-1 ml-1">
                        {engine.insights.top3List.map(l => (
                          <li key={l.loteNum} className="text-[9px]">
                            <span className="bg-slate-200 px-1 py-0.5 rounded text-[var(--q-dark)] mr-1">Lote {l.loteFormatado}</span> 
                            <span style={{color: getCucColor(l.cuc)}}>{formatValue(l.cuc)}%</span> | 
                            <span style={{color: getVazaoColor(l.vazao)}}>{formatValue(l.vazao)}</span>
                            <span className="text-slate-500 italic ml-1">({l.analise})</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Histograma Macro */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm overflow-hidden">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-4 text-center">Distribuição Geral do Campo</h4>
                <RenderHistogram hist={engine.hist} isModal={true} />
              </div>

              {/* Lista Slim de Lotes */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
                <div className="p-3 border-b border-slate-100 bg-slate-50">
                  <h4 className="text-[10px] font-black text-[var(--q-dark)] uppercase tracking-widest text-center">Lotes Avaliados (Clique para Detalhar)</h4>
                </div>
                
                <div className="grid grid-cols-[1fr_45px_45px_45px] gap-2 px-3 py-1.5 bg-slate-50/50 border-b border-slate-100 opacity-70">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Lote</span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">CUC</span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">L/h</span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Ent.</span>
                </div>

                <div className="flex flex-col max-h-[300px] overflow-y-auto custom-scrollbar">
                  {engine.lotesProcessados.map(l => (
                    <button 
                      key={l.loteNum} 
                      onClick={() => setSelectedLote(l)} 
                      className="grid grid-cols-[1fr_45px_45px_45px] gap-2 px-3 py-2 border-b border-slate-100 hover:bg-[var(--q-green-soft)] transition-colors text-left group"
                    >
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-600 group-hover:text-[var(--q-green-dark)]">{l.loteFormatado}</span>
                        <span className="text-[8px] font-bold text-slate-400">{l.turno.replace('Turno', 'T')}</span>
                      </div>
                      <span className="text-[11px] font-black text-center self-center" style={{ color: getCucColor(l.cuc) }}>{formatValue(l.cuc)}%</span>
                      <span className="text-[11px] font-black text-center self-center" style={{ color: getVazaoColor(l.vazao) }}>{formatValue(l.vazao)}</span>
                      <span className="text-[11px] font-black text-right self-center" style={{ color: getEntupColor(l.entupPerc) }}>{formatValue(l.entupPerc)}%</span>
                    </button>
                  ))}
                </div>

                {/* Resumo de Turnos (Fixo no Rodapé dos Lotes) */}
                <div className="bg-slate-50 border-t border-slate-200 flex flex-col p-3 gap-2">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Resultado por Turno</span>
                  <div className="flex flex-col gap-2">
                    {engine.resumoTurnos.map((t, idx) => (
                      <div key={idx} className="bg-white border border-slate-200 rounded-lg px-3 py-2 flex justify-between items-center shadow-sm">
                        <span className="text-[9px] font-black text-[var(--q-dark)] uppercase">{t.turno}</span>
                        <div className="flex gap-3">
                          <span className="flex flex-col items-center"><span className="text-[7px] text-slate-400 font-bold uppercase">CUC</span><span className="text-[10px] font-black" style={{ color: getCucColor(t.cuc) }}>{formatValue(t.cuc)}%</span></span>
                          <span className="flex flex-col items-center"><span className="text-[7px] text-slate-400 font-bold uppercase">L/h</span><span className="text-[10px] font-black" style={{ color: getVazaoColor(t.vazao) }}>{formatValue(t.vazao)}</span></span>
                          <span className="flex flex-col items-center"><span className="text-[7px] text-slate-400 font-bold uppercase">Entup</span><span className="text-[10px] font-black" style={{ color: getEntupColor(t.entupPerc) }}>{formatValue(t.entupPerc)}%</span></span>
                        </div>
                      </div>
                    ))}
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

export default CucDetailHstModal;