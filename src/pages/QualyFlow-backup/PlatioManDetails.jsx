import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Componentes Reutilizáveis
import HeaderPlantioMan from '../../components/QualyFlow/HeaderPlantioMan'; 
import Sidebar from '../../components/QualyFlow/Sidebar';
import DateSelector from '../../components/QualyFlow/DateSelector';

// Dados e Regras
import qualyflowMockData from '../../data/mockData.json';
import { COLORS } from './rules';

// ===========================================================================
// CONFIGURAÇÕES E REGRAS DA TELA (MANUAL)
// ===========================================================================
const METAS = {
  gemas: (v) => {
    if (v >= 15 && v <= 18) return COLORS.dentro || '#22c55e'; // Verde
    if ((v >= 12 && v <= 14) || (v >= 19 && v <= 21)) return COLORS.atencao || '#eab308'; // Amarelo
    return COLORS.fora || '#ef4444'; // Vermelho
  },
  viaveisPerc: (v) => {
    if (v >= 90) return COLORS.dentro || '#22c55e';
    if (v >= 80) return COLORS.atencao || '#eab308';
    return COLORS.fora || '#ef4444';
  },
  falhaPerc: (v) => {
    if (v === 0) return COLORS.dentro || '#22c55e';
    if (v <= 1) return COLORS.atencao || '#eab308';
    return COLORS.fora || '#ef4444';
  },
  coberturaGrid: (v) => (v >= 5 && v <= 8) ? (COLORS.dentro || '#22c55e') : (COLORS.fora || '#ef4444'),
  coberturaPerc: (v) => {
    if (v >= 90) return COLORS.dentro || '#22c55e';
    if (v >= 80) return COLORS.atencao || '#eab308';
    return COLORS.fora || '#ef4444';
  }
};

const formatVal = (v) => (v !== null && !isNaN(v)) ? Number(v).toFixed(1) : '0.0';

// Formatação do Lote: "1" vira "01", "25" vira "25"
const formatLote = (val) => {
  if (!val || val === "-") return "-";
  const num = Number(val);
  if (!isNaN(num)) return String(num).padStart(2, '0');
  return val;
};

// Degradê de Verde Pastel Elegante (Para evidenciar volumes maiores nas gemas totais)
const getPastelGreen = (val, min, max) => {
  if (min === max || val === null) return 'rgba(34, 197, 94, 0.2)'; 
  const intensity = (val - min) / (max - min);
  const opacity = 0.15 + (intensity * 0.7); 
  return `rgba(34, 197, 94, ${opacity})`;
};

const GaugeChart = ({ value, label, color }) => {
  const safeVal = Math.min(Math.max(Number(value) || 0, 0), 100);
  const strokeVal = (safeVal / 100) * 125.6;
  return (
    <div className="relative flex flex-col items-center justify-center w-36 h-20">
      <svg className="w-full h-full absolute top-1" viewBox="0 0 100 50">
        <path d="M 10 45 A 40 40 0 0 1 90 45" fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />
        <path d="M 10 45 A 40 40 0 0 1 90 45" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${strokeVal} 126`} className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="flex flex-col items-center justify-center mt-8">
        <span className="text-2xl font-black tracking-tighter leading-none" style={{ color }}>{safeVal.toFixed(1)}%</span>
        {label && <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1 text-center leading-tight">{label}</span>}
      </div>
    </div>
  );
};

// Helper para ordenar por Data/Hora real
const sortByDate = (a, b) => {
  const parse = s => {
    if(!s) return 0;
    const [d, t] = s.split(' ');
    if(!d || !t) return 0;
    const [DD, MM, YYYY] = d.split('/');
    return new Date(`${YYYY}-${MM}-${DD}T${t}`).getTime();
  };
  return parse(a.DATA_HORA) - parse(b.DATA_HORA);
};

// ===========================================================================
// MAIN COMPONENT
// ===========================================================================
const PlatioManDetails = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const passedDate = location.state?.selectedDate;

  const [campoIdx, setCampoIdx] = useState(0);
  const [selVars, setSelVars] = useState([]);
  const [selPts, setSelPts] = useState([]);
  
  const [expGemas, setExpGemas] = useState({});
  const [expCob, setExpCob] = useState({});
  const [activeTabGemas, setActiveTabGemas] = useState({});

  // ===========================================================================
  // 1. GESTÃO DE DATAS E OCORRÊNCIAS (Focadas no Manual)
  // ===========================================================================
  const OCORRENCIAS = [
    "Avaliação de Gemas -  Manual", 
    "Avaliação de Falha - Manual",
    "Avaliação de Coberta - Manual"
  ];

  const availableDates = useMemo(() => {
    const data = qualyflowMockData.filter(i => OCORRENCIAS.includes(i.OCORRENCIA));
    const dates = [...new Set(data.map(item => item.DATA_HORA?.substring(0, 10)).filter(Boolean))];
    return dates.sort((a, b) => b.split('/').reverse().join('-').localeCompare(a.split('/').reverse().join('-')));
  }, []);

  const [dateIndex, setDateIndex] = useState(() => {
    if (passedDate && availableDates.includes(passedDate)) return availableDates.indexOf(passedDate);
    return 0;
  });

  const selectedDate = availableDates[dateIndex] || "";

  useEffect(() => {
    setCampoIdx(0); setSelVars([]); setSelPts([]);
    setExpGemas({}); setExpCob({}); setActiveTabGemas({});
  }, [selectedDate]);

  // ===========================================================================
  // 2. MOTOR DE CÁLCULO GERAL E DOS CAMPOS
  // ===========================================================================
  const dayData = useMemo(() => {
    if (!selectedDate) return [];
    return qualyflowMockData.filter(i => i.DATA_HORA?.startsWith(selectedDate) && OCORRENCIAS.includes(i.OCORRENCIA));
  }, [selectedDate]);

  const camposData = useMemo(() => {
    const nomesCampos = [...new Set(dayData.map(i => i.CAMPO).filter(Boolean))].sort();
    return nomesCampos.map(nome => {
      const df = dayData.filter(i => i.CAMPO === nome);
      
      const vMetroRaw = df.filter(i => (i.INDICADOR || "").toLowerCase() === "gemas viaveis por metro" || (i.INDICADOR || "").toLowerCase() === "gemas viáveis por metro").map(i => Number(i.VALOR)||0);
      const tMetroRaw = df.filter(i => (i.INDICADOR || "").toLowerCase() === "gemas por metro").map(i => Number(i.VALOR)||0);
      
      const ptsGemas = Math.ceil(vMetroRaw.length / 12);
      
      const sumGemasV = vMetroRaw.reduce((a,b) => a + b, 0);
      const sumGemasT = tMetroRaw.reduce((a,b) => a + b, 0);
      const perViaveis = sumGemasT > 0 ? (sumGemasV / sumGemasT) * 100 : 0;
      const gemasMetro = vMetroRaw.length ? sumGemasV / vMetroRaw.length : 0;

      const fRaw = df.filter(i => i.OCORRENCIA === "Avaliação de Falha - Manual" && (i.INDICADOR || "").toLowerCase() === "total de falhas").map(i => Number(i.VALOR)||0);
      const ptsFalha = fRaw.length;
      const sumFalhas = fRaw.reduce((a,b) => a + b, 0);
      const perFalha = ptsFalha > 0 ? (sumFalhas / (ptsFalha * 60)) * 100 : 0;

      return { nome, pontos: ptsGemas || ptsFalha, perViaveis, gemasMetro, perFalha };
    });
  }, [dayData]);

  const selectedCampo = camposData[campoIdx]?.nome || "";

  // ===========================================================================
  // 3. EXTRATOR DETALHADO (AGRUPADO POR LOTE, FATIADO POR 12)
  // ===========================================================================
  const dataEngine = useMemo(() => {
    if (!selectedCampo) return null;
    const df = dayData.filter(i => i.CAMPO === selectedCampo);
    const lotes = [...new Set(df.map(i => i.LOTE))].sort();

    let globalGemaN = 1;
    let linhasGemas = [];
    let allVariedades = new Set();
    
    lotes.forEach(lote => {
      const dfLote = df.filter(i => i.LOTE === lote);
      
      const rawVMetro = dfLote.filter(i => i.OCORRENCIA === "Avaliação de Gemas -  Manual" && ((i.INDICADOR || "").toLowerCase() === "gemas viaveis por metro" || (i.INDICADOR || "").toLowerCase() === "gemas viáveis por metro")).sort(sortByDate);
      const rawTMetro = dfLote.filter(i => i.OCORRENCIA === "Avaliação de Gemas -  Manual" && (i.INDICADOR || "").toLowerCase() === "gemas por metro").sort(sortByDate);
      
      const rawFalhas = dfLote.filter(i => i.OCORRENCIA === "Avaliação de Falha - Manual" && (i.INDICADOR || "").toLowerCase() === "total de falhas").sort(sortByDate);
      const rawFalhasRPM = dfLote.filter(i => i.OCORRENCIA === "Avaliação de Falha - Manual" && i.INDICADOR === "RPM").sort(sortByDate);

      const numPts = Math.max(Math.ceil(rawVMetro.length / 12), rawFalhas.length);
      
      for(let i=0; i<numPts; i++) {
          const cVMetro = rawVMetro.slice(i*12, i*12+12);
          const cTMetro = rawTMetro.slice(i*12, i*12+12);
          
          const sumV = cVMetro.reduce((a,b) => a + (Number(b.VALOR)||0), 0);
          const sumT = cTMetro.reduce((a,b) => a + (Number(b.VALOR)||0), 0);
          const vPerc = sumT > 0 ? (sumV / sumT) * 100 : 0;
          
          const amPadrao = cVMetro.map(x=>Number(x.VALOR)||0).filter(x => x >= 15 && x <= 18).length;
          const padPerc = cVMetro.length > 0 ? (amPadrao / cVMetro.length) * 100 : 0;
          
          const refRow = cVMetro[0] || dfLote[0] || {};
          const varName = refRow.VARIEDADE || "N/A";
          allVariedades.add(varName);

          const pontoRPM = rawFalhasRPM[i] ? rawFalhasRPM[i].VALOR : (refRow.EXTRA1 || "-");

          linhasGemas.push({
              n: globalGemaN++,
              turno: refRow.TURNO || "-",
              rpm: pontoRPM, 
              lote: lote || "-",
              variedade: varName,
              vPerc,
              padPerc,
              falhaM: rawFalhas[i] ? (Number(rawFalhas[i].VALOR)||0) : 0,
              gridViaveis: cVMetro.map(x => Number(x.VALOR)||0),
              gridTotais: cTMetro.map(x => Number(x.VALOR)||0)
          });
      }
    });

    allVariedades = [...allVariedades].sort();

    const activeLinhasGemas = linhasGemas.filter(p => {
      if (selVars.length > 0 && !selVars.includes(p.variedade)) return false;
      if (selPts.length > 0 && !selPts.includes(p.n)) return false;
      return true;
    });

    const sumGemasV = activeLinhasGemas.reduce((a, p) => a + p.gridViaveis.reduce((x,y)=>x+y,0), 0);
    const sumGemasT = activeLinhasGemas.reduce((a, p) => a + p.gridTotais.reduce((x,y)=>x+y,0), 0);
    const danificadas = sumGemasT - sumGemasV;
    const viaveisGeralPerc = sumGemasT > 0 ? (sumGemasV / sumGemasT) * 100 : 0;

    const falhaPts = activeLinhasGemas.length;
    const falhaSoma = activeLinhasGemas.reduce((a, p) => a + p.falhaM, 0);
    const falhaPercGeral = falhaPts > 0 ? (falhaSoma / (falhaPts * 60)) * 100 : 0;

    // Histograma Gemas por Metro (Manual Ranges)
    const allGemasMetro = activeLinhasGemas.flatMap(p => p.gridViaveis);
    const hist = { '<12': 0, '12-14': 0, '15-18': 0, '19-21': 0, '>21': 0 };
    allGemasMetro.forEach(v => {
      if (v < 12) hist['<12']++;
      else if (v <= 14) hist['12-14']++;
      else if (v <= 18) hist['15-18']++;
      else if (v <= 21) hist['19-21']++;
      else hist['>21']++;
    });
    const padraoPerc = allGemasMetro.length > 0 ? (hist['15-18'] / allGemasMetro.length) * 100 : 0;

    const extrairModulo = (ocorrencia, indicador, metaGridFn) => {
      const mod = [];
      let localN = 1;
      
      lotes.forEach(lote => {
        const dfLote = df.filter(i => i.LOTE === lote);
        const raw = dfLote.filter(i => i.OCORRENCIA === ocorrencia && (i.INDICADOR || "").toLowerCase() === indicador.toLowerCase()).sort(sortByDate);
        const numPts = Math.ceil(raw.length / 12);
        
        for(let i=0; i<numPts; i++) {
            const chunk = raw.slice(i*12, i*12+12);
            const amostras = chunk.map(x => Number(x.VALOR)||0);
            const noPadrao = amostras.filter(x => metaGridFn(x) === (COLORS.dentro || '#22c55e')).length;
            const perc = amostras.length > 0 ? (noPadrao / amostras.length) * 100 : 0;
            mod.push({ n: localN++, lote: lote || "-", perc, amostras });
        }
      });
      return mod.filter(p => selPts.length === 0 || selPts.includes(p.n));
    };

    const modCobertura = extrairModulo("Avaliação de Coberta - Manual", "Média Coberta", METAS.coberturaGrid);

    return {
      allPontosNs: Array.from({length: globalGemaN - 1}, (_, i) => i+1),
      allVariedades,
      resumo: { sumGemasT, sumGemasV, danificadas, viaveisGeralPerc, padraoPerc },
      falhaInfo: { pts: falhaPts, soma: falhaSoma, perc: falhaPercGeral },
      hist: [
        { label: '<12', val: hist['<12'], color: COLORS.fora || '#ef4444' },
        { label: '12-14', val: hist['12-14'], color: COLORS.atencao || '#eab308' },
        { label: '15-18', val: hist['15-18'], color: COLORS.dentro || '#22c55e' },
        { label: '19-21', val: hist['19-21'], color: COLORS.atencao || '#eab308' },
        { label: '>21', val: hist['>21'], color: COLORS.fora || '#ef4444' }
      ],
      linhasGemas: activeLinhasGemas, 
      modCobertura
    };
  }, [selectedCampo, dayData, selVars, selPts]);

  // Controles UI
  const toggleVar = (v) => setSelVars(prev => prev.includes(v) ? prev.filter(i => i !== v) : [...prev, v]);
  const togglePt = (p) => setSelPts(prev => prev.includes(p) ? prev.filter(i => i !== p) : [...prev, p]);
  const toggleExp = (stateSetter, id) => stateSetter(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24 text-slate-900">
      <HeaderPlantioMan onMenuOpen={() => setSidebarOpen(true)} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={(p) => console.log(p)} />

      <main className="p-4 flex flex-col items-center">
        
        {/* SELETOR DE DATA */}
        <div className="w-full max-w-[400px] mb-4 mt-2">
          <DateSelector 
            date={selectedDate} 
            onPrev={() => setDateIndex(di => Math.min(di + 1, availableDates.length - 1))} 
            onNext={() => setDateIndex(di => Math.max(di - 1, 0))} 
            disablePrev={dateIndex === availableDates.length - 1} 
            disableNext={dateIndex === 0} 
          />
        </div>

        {camposData.length === 0 ? (
          <div className="w-full max-w-[400px] text-center p-8 bg-white rounded-xl border border-slate-200 border-dashed text-slate-400 font-bold text-xs uppercase tracking-widest mt-4">
            Sem avaliações nesta data
          </div>
        ) : (
          <div className="w-full max-w-[400px] flex flex-col gap-6 animate-in fade-in duration-500">
            
            {/* SELETOR DE CAMPOS */}
            <div className="flex flex-col gap-2.5">
              {camposData.map((c, idx) => {
                const isActive = campoIdx === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => setCampoIdx(idx)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all active:scale-[0.98] ${
                      isActive ? 'border-agro-green border-2 bg-green-50/80 shadow-md' : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
                    }`}
                  >
                    <div className="flex flex-col items-start w-28">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Campo</span>
                      <span className={`text-[13px] font-black uppercase truncate w-full text-left ${isActive ? 'text-agro-green' : 'text-slate-700'}`}>{c.nome}</span>
                    </div>
                    <div className="flex flex-col items-center flex-1 border-l border-slate-200/50">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Pontos</span>
                      <span className="text-[13px] font-black text-slate-600">{c.pontos}</span>
                    </div>
                    <div className="flex flex-col items-center flex-1 border-l border-slate-200/50">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Viáveis</span>
                      <span className="text-[13px] font-black" style={{ color: METAS.viaveisPerc(c.perViaveis) }}>{formatVal(c.perViaveis)}%</span>
                    </div>
                    <div className="flex flex-col items-end w-[60px] border-l border-slate-200/50 pl-2">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Gemas/m</span>
                      <span className="text-[13px] font-black" style={{ color: METAS.gemas(c.gemasMetro) }}>{formatVal(c.gemasMetro)}</span>
                    </div>
                    <div className="flex flex-col items-end w-[55px] border-l border-slate-200/50 pl-2 pr-1">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Falha</span>
                      <span className="text-[13px] font-black" style={{ color: METAS.falhaPerc(c.perFalha) }}>{formatVal(c.perFalha)}%</span>
                    </div>
                  </button>
                )
              })}
            </div>

            {dataEngine && (
              <div className="flex flex-col gap-5 pt-2">
                
                {/* FILTROS CRUZADOS */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Variedades Avaliadas</span>
                    <div className="flex flex-wrap gap-2">
                      {dataEngine.allVariedades.map(v => (
                        <button 
                          key={v} onClick={() => toggleVar(v)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
                            selVars.includes(v) ? 'bg-agro-green/10 border-agro-green text-agro-green shadow-sm' 
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-agro-green/50' 
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pontos de Avaliação</span>
                    <div className="flex flex-wrap gap-2">
                      {dataEngine.allPontosNs.map(n => (
                        <button 
                          key={n} onClick={() => togglePt(n)}
                          className={`w-10 h-8 flex items-center justify-center rounded-lg text-[11px] font-black transition-all border ${
                            selPts.includes(n) ? 'bg-agro-green text-white shadow-md border-agro-green' 
                            : 'bg-white border-slate-200 text-slate-600 hover:border-agro-green/50' 
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* CAIXA DE RESUMO */}
                <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1.5">
                  {[
                    { label: 'Total de Gemas', val: `${dataEngine.resumo.sumGemasT} un` },
                    { label: 'Gemas Viáveis', val: `${dataEngine.resumo.sumGemasV} un` },
                    { label: 'Gemas Danificadas', val: `${dataEngine.resumo.danificadas} un`, color: COLORS.fora || '#ef4444' },
                    { label: 'Metros Avaliados', val: `${dataEngine.falhaInfo.pts * 60} m` },
                    { label: 'Metros Falhados', val: `${dataEngine.falhaInfo.soma} m`, color: dataEngine.falhaInfo.soma > 0 ? (COLORS.fora || '#ef4444') : (COLORS.dentro || '#22c55e') }
                  ].map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center border-b border-slate-50 border-dashed pb-1.5 last:border-0 last:pb-0">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.label}</span>
                      <span className="text-[12px] font-black text-slate-700" style={{ color: item.color }}>{item.val}</span>
                    </div>
                  ))}
                </div>

                {/* GAUGES */}
                <div className="flex justify-center gap-6 py-2">
                   <GaugeChart value={dataEngine.resumo.viaveisGeralPerc} label="Gemas Viáveis" color={METAS.viaveisPerc(dataEngine.resumo.viaveisGeralPerc)} />
                   <GaugeChart value={dataEngine.resumo.padraoPerc} label="Padrão Gemas/m" color={METAS.viaveisPerc(dataEngine.resumo.padraoPerc)} />
                </div>

                {/* HISTOGRAMA */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4 mt-2">
                   <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 text-center">Gemas Viáveis por Metro</h3>
                   <div className="flex items-end justify-between h-[120px] pt-4 px-2">
                     {dataEngine.hist.map((bar, idx) => {
                       const maxVal = Math.max(...dataEngine.hist.map(h => h.val), 1);
                       const heightPerc = (bar.val / maxVal) * 100;
                       return (
                         <div key={idx} className="flex flex-col items-center justify-end h-full gap-2 group w-full">
                           <span className="text-[10px] font-black text-slate-600 leading-none">{bar.val}</span>
                           <div className="w-8 bg-slate-100 rounded-t-sm relative border-x border-t border-slate-200/50 flex items-end justify-center overflow-hidden" style={{ height: '100%' }}>
                             <div className="w-full transition-all duration-700" style={{ height: `${heightPerc}%`, backgroundColor: bar.color }} />
                           </div>
                           <span className="text-[9px] font-bold text-slate-400">{bar.label}</span>
                         </div>
                       );
                     })}
                   </div>
                </div>

                {/* FALHA NO PLANTIO */}
                {dataEngine.linhasGemas.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col mt-2">
                     <div className="bg-slate-50/50 p-4 flex flex-col items-center justify-center border-b border-slate-100">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Falha no Plantio</span>
                        <span className="text-3xl font-black tracking-tighter" style={{ color: METAS.falhaPerc(dataEngine.falhaInfo.perc) }}>
                           {formatVal(dataEngine.falhaInfo.perc)}%
                        </span>
                     </div>
                     <table className="w-full border-collapse">
                        <thead className="bg-white border-b border-slate-100">
                           <tr className="flex items-center px-4 py-2.5">
                              <th className="text-[9px] font-black text-slate-400 uppercase text-left w-1/2">Ponto</th>
                              <div className="flex justify-end gap-6 w-1/2">
                                <th className="text-[9px] font-black text-slate-400 uppercase text-right w-12">Av (m)</th>
                                <th className="text-[9px] font-black text-slate-400 uppercase text-right w-16">Falha (m)</th>
                              </div>
                           </tr>
                        </thead>
                        <tbody>
                           {dataEngine.linhasGemas.map((f, i) => (
                              <tr key={i} className="flex items-center px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                                 <td className="text-[11px] font-black text-slate-700 text-left w-1/2">{f.n}º</td>
                                 <div className="flex justify-end gap-6 w-1/2">
                                    <td className="text-[12px] font-black text-slate-600 text-right w-12">60</td>
                                    <td className="text-[12px] font-black text-right w-16" style={{ color: f.falhaM > 0 ? (COLORS.fora || '#ef4444') : (COLORS.dentro || '#22c55e') }}>{f.falhaM}</td>
                                 </div>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
                )}

                {/* 1. PONTOS DETALHADOS (GEMAS) */}
                {dataEngine.linhasGemas.length > 0 && (
                  <div className="flex flex-col gap-3 mt-4">
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-2 border-b border-slate-200 pb-1.5">Pontos Detalhados</h3>
                    <div className="flex flex-col gap-2">
                      {dataEngine.linhasGemas.map(p => {
                        const isExp = expGemas[p.n];
                        const activeTab = activeTabGemas[p.n] || 'Viáveis';
                        
                        let gridData = p.gridViaveis;
                        let maxVal = 18; let minVal = 10;
                        if(activeTab === 'Totais') { gridData = p.gridTotais; maxVal = Math.max(...p.gridTotais); minVal = Math.min(...p.gridTotais); }

                        const gridBlocks = Array.from({ length: 12 }, (_, i) => gridData[i] !== undefined ? gridData[i] : null);

                        return (
                          <div key={p.n} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                            <button onClick={() => toggleExp(setExpGemas, p.n)} className="p-3 flex justify-between items-center hover:bg-slate-50/50">
                              <div className="flex justify-between items-center w-[90%] pr-4">
                                
                                {/* Lado Esquerdo: Ponto e Lote */}
                                <div className="flex items-center gap-3">
                                  <div className="w-6 h-6 rounded bg-slate-100 flex justify-center items-center text-[10px] font-black text-slate-600">{p.n}º</div>
                                  <div className="flex flex-col text-left">
                                    <span className="text-[7px] font-black text-slate-400 uppercase">Lote</span>
                                    <span className="text-[10px] font-bold text-slate-700">{formatLote(p.lote)}</span>
                                  </div>
                                </div>

                                {/* Lado Direito: Indicadores Colados */}
                                <div className="flex items-center gap-5 justify-end">
                                  <div className="flex flex-col items-center">
                                    <span className="text-[7px] font-black text-slate-400 uppercase">Viáveis</span>
                                    <span className="text-[11px] font-black" style={{color: METAS.viaveisPerc(p.vPerc)}}>{p.vPerc.toFixed(0)}%</span>
                                  </div>
                                  <div className="flex flex-col items-center">
                                    <span className="text-[7px] font-black text-slate-400 uppercase">Padrão</span>
                                    <span className="text-[11px] font-black text-slate-700">{p.padPerc.toFixed(0)}%</span>
                                  </div>
                                  <div className="flex flex-col items-end w-8">
                                    <span className="text-[7px] font-black text-slate-400 uppercase">Falha</span>
                                    <span className="text-[11px] font-black" style={{color: p.falhaM > 0 ? (COLORS.fora || '#ef4444') : (COLORS.dentro || '#22c55e')}}>{p.falhaM}m</span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Seta */}
                              <div className="flex items-center justify-end w-[10%]">
                                <span className={`text-slate-300 text-[10px] transition-transform ${isExp ? 'rotate-180' : ''}`}>▼</span>
                              </div>
                            </button>

                            <div className={`grid transition-all duration-300 bg-slate-50 border-t border-slate-100 ${isExp ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                              <div className="overflow-hidden">
                                <div className="p-3 flex flex-col gap-3">
                                   <div className="flex bg-slate-200/50 p-1 rounded-lg">
                                      {['Viáveis', 'Totais'].map(tab => (
                                        <button 
                                          key={tab} 
                                          onClick={() => setActiveTabGemas(prev => ({...prev, [p.n]: tab}))}
                                          className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded-md transition-all ${activeTab === tab ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                          {tab}
                                        </button>
                                      ))}
                                   </div>
                                   <div className="grid grid-cols-6 gap-1.5">
                                     {gridBlocks.map((val, i) => {
                                        let bgColor = '#f1f5f9';
                                        let fontColor = '#cbd5e1';
                                        if (val !== null) {
                                          if (activeTab === 'Viáveis') {
                                            bgColor = METAS.gemas(val);
                                            fontColor = '#ffffff';
                                          } else {
                                            bgColor = getPastelGreen(val, minVal, maxVal);
                                            fontColor = '#166534'; 
                                          }
                                        }
                                        return (
                                          <div key={i} className="h-8 flex items-center justify-center rounded text-[11px] font-black shadow-sm" style={{ backgroundColor: bgColor, color: fontColor, border: val === null ? '1px dashed #cbd5e1' : 'none' }}>
                                            {val !== null ? val : '-'}
                                          </div>
                                        )
                                     })}
                                   </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* 2. COBERTURA DO PLANTIO */}
                {dataEngine.modCobertura.length > 0 && (
                  <div className="flex flex-col gap-3 mt-4 mb-8">
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-2 border-b border-slate-200 pb-1.5">Cobertura do Plantio (5 a 8cm)</h3>
                    <div className="flex flex-col gap-2">
                      {dataEngine.modCobertura.map(p => {
                        const isExp = expCob[p.n];
                        const blocks = Array.from({ length: 12 }, (_, i) => p.amostras[i] !== undefined ? p.amostras[i] : null);
                        return (
                          <div key={p.n} className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
                            <button onClick={() => toggleExp(setExpCob, p.n)} className="p-3 flex justify-between items-center hover:bg-slate-50/50">
                               <div className="flex gap-4 items-center text-left">
                                 <div className="w-6 h-6 rounded bg-slate-100 flex justify-center items-center text-[10px] font-black text-slate-600">{p.n}º</div>
                                 <div className="flex flex-col">
                                   <span className="text-[7px] font-black text-slate-400 uppercase">Lote</span>
                                   <span className="text-[10px] font-bold text-slate-700">{formatLote(p.lote)}</span>
                                 </div>
                               </div>
                               <div className="flex gap-3 items-center">
                                 <span className="text-[12px] font-black" style={{color: METAS.coberturaPerc(p.perc)}}>{p.perc.toFixed(0)}%</span>
                                 <span className={`text-slate-300 text-[10px] transition-transform ${isExp ? 'rotate-180' : ''}`}>▼</span>
                               </div>
                            </button>
                            <div className={`grid transition-all duration-300 bg-slate-50 ${isExp ? 'grid-rows-[1fr] opacity-100 border-t border-slate-100' : 'grid-rows-[0fr] opacity-0'}`}>
                              <div className="overflow-hidden">
                                <div className="p-3">
                                  <div className="grid grid-cols-6 gap-1.5">
                                    {blocks.map((val, i) => (
                                      <div key={i} className="h-7 flex items-center justify-center rounded text-[10px] font-black shadow-sm" style={{ backgroundColor: val !== null ? METAS.coberturaGrid(val) : '#f1f5f9', color: val !== null ? '#fff' : '#cbd5e1' }}>
                                        {val !== null ? Number(val).toFixed(1) : ''}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default PlatioManDetails;