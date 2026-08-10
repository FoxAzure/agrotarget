// ================================= DOCUMENTATION ------------------------------------------
// Script: PerdaMecDetailDiarioCampo
// Purpose: Modal avançado para exibir detalhes de perdas de um campo específico e sub-navegação.
// ==========================================================================================

import React, { useState, useMemo } from 'react';
import { getStatusColor } from '../../../components/QualyFlow/rulesPerdaMec';

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
  if (!fullName) return 'DESC';
  const parts = fullName.split(' - ');
  return parts[0].trim();
};

const CompareTriangle = ({ daily, yearly }) => {
  if (daily === null || yearly === null) return null;
  const diff = daily - yearly;
  if (Math.abs(diff) < 0.01) return <span className="text-[10px] text-slate-300 font-bold text-center">-</span>;
  if (diff < 0) return <span className="qf-anim-triangle-down font-black text-center text-[var(--q-green)]">▼</span>;
  return <span className="qf-anim-triangle-up font-black text-center text-[var(--q-danger)]">▲</span>;
};

// Cores Gradientes iguais as do Gráfico
const getGradientColor = (value, min, max) => {
  if (max === min || max === 0) return 'hsl(140, 95%, 35%)';
  const ratio = (value - min) / (max - min);
  const hue = 140 - (ratio * 140);
  const lightness = 35 + (ratio * 15);
  return `hsl(${hue}, 95%, ${lightness}%)`;
};

// Definidor de cores pasteis baseado no turno
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
  // Fallback
  return {
    card: 'bg-white border-slate-200',
    text: 'text-[var(--q-dark)]',
    tag: 'bg-slate-100 text-slate-500 border-slate-200'
  };
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

const PerdaMecDetailDiarioCampo = ({ campoNome, rawData, yearData, metas, selectedDate, onClose }) => {
  
  const [selectedPonto, setSelectedPonto] = useState(null);

  const processamento = useMemo(() => {
    if (!campoNome || !rawData) return null;

    const dataCampo = rawData.filter(r => String(r.campo).trim() === campoNome);
    if (dataCampo.length === 0) return null;

    const setor = dataCampo[0].setor || 'N/A';
    const depa = dataCampo[0].depa || 'N/A';

    let sPerd=0, sTch=0, sMtSimp=0, sAvSimp=0, sMtDup=0, sAvDup=0, sTocoArr=0, sTocoFix=0;
    
    dataCampo.forEach(r => {
      sPerd += Number(r.total_perda) || 0;
      sTch += Number(r.tch_estimado) || 0;
      sTocoArr += Number(r.tocos_arrancados) || 0;
      sTocoFix += Number(r.tocos_fixos) || 0;
      
      const esp = String(r.espacamento || '').toLowerCase();
      if (esp === 'simples') { sMtSimp += Number(r.mt_pisoteio) || 0; sAvSimp += Number(r.av_pisoteio) || 0; }
      else if (esp === 'duplo') { sMtDup += Number(r.mt_pisoteio) || 0; sAvDup += Number(r.av_pisoteio) || 0; }
    });

    const perdaDia = sPerd + sTch > 0 ? (sPerd / (sPerd + sTch)) * 100 : null;
    const pSimplesDia = sAvSimp > 0 ? (sMtSimp / sAvSimp) * 100 : null;
    const pDuploDia = sAvDup > 0 ? (sMtDup / sAvDup) * 100 : null;
    const arranquioDia = sTocoFix > 0 ? (sTocoArr / sTocoFix) * 100 : null;

    const listaPontos = dataCampo.map(r => {
      const per = (Number(r.total_perda) + Number(r.tch_estimado)) > 0 
        ? (Number(r.total_perda) / (Number(r.total_perda) + Number(r.tch_estimado))) * 100 : null;
      const pis = Number(r.av_pisoteio) > 0 
        ? (Number(r.mt_pisoteio) / Number(r.av_pisoteio)) * 100 : null;
      const arr = Number(r.tocos_fixos) > 0 
        ? (Number(r.tocos_arrancados) / Number(r.tocos_fixos)) * 100 : null;

      const metaPisot = String(r.espacamento).toLowerCase() === 'simples' ? metas.pisoteio_simples : metas.pisoteio_duplo;

      return { ...r, calcPerda: per, calcPisot: pis, calcArranquio: arr, metaPisot };
    });

    return {
      setor, depa, qtdPontos: dataCampo.length,
      kpisDia: { perda: perdaDia, pSimples: pSimplesDia, pDuplo: pDuploDia, arranquio: arranquioDia },
      kpisAno: {
        perda: yearData ? Number(yearData.perda_perc) : null,
        pSimples: yearData ? Number(yearData.pisoteio_simples_perc) : null,
        pDuplo: yearData ? Number(yearData.pisoteio_duplo_perc) : null,
        arranquio: yearData ? Number(yearData.arranquio_perc) : null,
      },
      listaPontos
    };
  }, [campoNome, rawData, yearData, metas]);

  if (!campoNome || !processamento) return null;

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
    ].sort((a, b) => b.val - a.val); // Ordena maior pro menor
  }
  const minCat = catList.length > 0 ? Math.min(...catList.map(c => c.val)) : 0;
  const maxCat = catList.length > 0 ? Math.max(...catList.map(c => c.val)) : 0;
  
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
        
        {/* ======================= TELA 1: LISTA DE PONTOS DO CAMPO ======================= */}
        {!selectedPonto ? (
          <div className="flex flex-col h-full animate-in slide-in-from-left-4 duration-300">
            {/* HEADER ALINHADO */}
            <div className="p-5 border-b border-slate-200 bg-white shrink-0">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Análise do Campo</span>
                <button 
                  onClick={onClose} 
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-500 font-bold transition-colors"
                >✕</button>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <h3 className="text-xl md:text-2xl font-black text-[var(--q-dark)] uppercase leading-none tracking-tight flex items-center gap-2">
                    {campoNome} <span className="text-slate-300 text-base md:text-lg font-bold">{formatShortDate(selectedDate)}</span>
                  </h3>
                  <span className="text-[10px] md:text-[11px] font-bold text-slate-500 uppercase mt-1">
                    Setor: <strong className="text-slate-700">{processamento.setor}</strong> &nbsp;•&nbsp; Depa: <strong className="text-slate-700">{processamento.depa}</strong>
                  </span>
                </div>
                
                <div className="bg-[var(--q-green-soft)] text-[var(--q-green-dark)] px-4 py-2 rounded-xl flex flex-col items-center justify-center shadow-inner self-stretch">
                  <span className="text-xl font-black leading-none">{processamento.qtdPontos}</span>
                  <span className="text-[9px] font-bold uppercase tracking-widest mt-0.5">Pnts</span>
                </div>
              </div>
            </div>

            <div className="p-4 md:p-5 overflow-y-auto custom-scrollbar flex-1">
              
              {renderKpiCards()}

              {/* TABELA DE PONTOS COM TAG DE COR DO TURNO */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
                <div className="grid grid-cols-[30px_1fr_50px_45px_45px_45px] md:grid-cols-[40px_1fr_60px_55px_55px_55px] gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100 cursor-default">
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 self-center">Lote</span>
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 self-center">Máquina</span>
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 self-center text-center">Turno</span>
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center self-center">Perda</span>
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center self-center">Pisot.</span>
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-right self-center">Arran.</span>
                </div>

                <div className="flex flex-col max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                  {processamento.listaPontos.map((p, idx) => {
                    const shiftListStyle = getShiftStyle(p.turno);
                    
                    return (
                      <div 
                        key={idx} 
                        onClick={() => setSelectedPonto(p)}
                        className="grid grid-cols-[30px_1fr_50px_45px_45px_45px] md:grid-cols-[40px_1fr_60px_55px_55px_55px] gap-2 px-2 py-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-50 last:border-0 group"
                      >
                        <span className="text-[11px] font-black text-slate-600 self-center group-hover:text-[var(--q-orange)]">{p.lote || '-'}</span>
                        <span className="text-[10px] md:text-[11px] font-bold text-slate-500 truncate self-center group-hover:text-slate-800">{parseColhedora(p.colhedora)}</span>
                        
                        <div className="flex justify-center items-center">
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
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Ponto de Avaliação</span>
            </div>

            <div className="p-4 md:p-5 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-4">
              
              {/* TOP SPLIT: Info Máquina + Info Perda */}
              <div className="grid grid-cols-2 gap-4">
                
                {/* Lote / Máquina com cor dinâmica do turno */}
                <div className={`flex flex-col items-center justify-center rounded-xl p-4 shadow-sm border ${pShiftStyle.card}`}>
                  <span className={`text-[10px] font-bold uppercase tracking-widest opacity-60 ${pShiftStyle.text}`}>Lote</span>
                  <span className={`text-4xl md:text-5xl font-black leading-none my-1 ${pShiftStyle.text}`}>{selectedPonto.lote || '-'}</span>
                  <div className="flex flex-col items-center gap-0.5 mt-2">
                    <span className={`text-[10px] md:text-[11px] font-black uppercase text-center ${pShiftStyle.text}`}>{parseColhedora(selectedPonto.colhedora)}</span>
                    <span className={`text-[9px] font-bold uppercase opacity-80 ${pShiftStyle.text}`}>{selectedPonto.turno}</span>
                  </div>
                </div>

                {/* Resultado da Perda */}
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

              {/* Categorias (Com degradê aplicado à fonte numérico) */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-end border-b border-slate-100 pb-2 mb-3">
                  <span className="text-[10px] font-black text-[var(--q-dark)] uppercase tracking-widest">Categorias</span>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Média Kg</span>
                </div>
                
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {catList.map((c, i) => (
                    <div key={i} className="flex justify-between items-center bg-slate-50 px-2 py-1.5 rounded border border-slate-100/50">
                      <span className="text-[10px] font-bold text-slate-500">{c.label}</span>
                      {/* O Segredo do Degradê na Fonte! */}
                      <span className="text-[12px] font-black" style={{ color: getGradientColor(c.val, minCat, maxCat) }}>
                        {formatValue(c.val, 2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bloco Pisoteio & Arranquio */}
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

export default PerdaMecDetailDiarioCampo;