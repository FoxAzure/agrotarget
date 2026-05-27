import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

// Componentes Reutilizáveis
import HeaderCheckList from '../../components/QualyFlow/HeaderCheckList'; 
import Sidebar from '../../components/QualyFlow/Sidebar';
import DateSelector from '../../components/QualyFlow/DateSelector';

// Dados e Regras
import qualyflowMockData from '../../data/mockData.json';
import { QUALY_RULES, COLORS } from '../../pages/QualyFlow/rules';

// ===========================================================================
// REGRAS ESPECÍFICAS DESTA TELA
// ===========================================================================
const RULES = {
  rachados: (v) => v <= 10 ? COLORS.dentro : COLORS.fora,
  amassados: (v) => v <= 6 ? COLORS.dentro : COLORS.fora,
  palmitos: (v) => v <= 2 ? COLORS.dentro : COLORS.fora,
  brocados: (v) => v <= 2.5 ? COLORS.dentro : COLORS.fora,
  
  tamanhoRebolo: (v) => {
    if (v >= 35 && v <= 40) return '#22c55e'; // Verde
    if ((v >= 30 && v < 35) || (v > 40 && v <= 45)) return '#eab308'; // Amarelo
    return '#ef4444'; // Vermelho
  }
};

const formatVal = (v) => (v !== null && !isNaN(v)) ? Number(v).toFixed(1) : '0.0';

// ===========================================================================
// COMPONENTES VISUAIS INTERNOS
// ===========================================================================
const GaugeChart = ({ value, label, color }) => {
  const safeVal = Math.min(Math.max(Number(value) || 0, 0), 100);
  const strokeVal = (safeVal / 100) * 125.6;

  return (
    <div className="relative flex flex-col items-center justify-center w-40 h-24">
      <svg className="w-full h-full absolute top-2" viewBox="0 0 100 50">
        <path d="M 10 45 A 40 40 0 0 1 90 45" fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />
        <path 
          d="M 10 45 A 40 40 0 0 1 90 45" 
          fill="none" 
          stroke={color} 
          strokeWidth="10" 
          strokeLinecap="round"
          strokeDasharray={`${strokeVal} 126`} 
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="flex flex-col items-center justify-center mt-10">
        <span className="text-3xl font-black tracking-tighter leading-none" style={{ color }}>{safeVal.toFixed(1)}%</span>
        {label && <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{label}</span>}
      </div>
    </div>
  );
};

const MiniBar = ({ label, percent, color }) => {
  const safeVal = Math.min(Math.max(Number(percent) || 0, 0), 100);
  return (
    <div className="flex flex-col gap-1 w-full mt-1.5">
      <div className="flex justify-between items-end leading-none">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
        <span className="text-[11px] font-black" style={{ color }}>{safeVal.toFixed(1)}%</span>
      </div>
      <div className="w-full h-1.5 bg-slate-200/60 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${safeVal}%`, backgroundColor: color }} />
      </div>
    </div>
  );
};

// ===========================================================================
// MAIN COMPONENT
// ===========================================================================
const SementeDetails = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const passedDate = location.state?.selectedDate;

  // Filtros Cruzados e Seleção
  const [campoIdx, setCampoIdx] = useState(0);
  const [selVars, setSelVars] = useState([]);
  const [selPts, setSelPts] = useState([]);
  const [expandedPts, setExpandedPts] = useState({});

  // ===========================================================================
  // 1. DATAS DISPONÍVEIS
  // ===========================================================================
  const OCORRENCIAS = ["Avaliação de Gemas - Semente", "Avaliação Geral", "Avaliação Rebolos", "Pisoteio"];
  
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

  // Reseta estado ao mudar data
  useEffect(() => {
    setCampoIdx(0);
    setSelVars([]);
    setSelPts([]);
    setExpandedPts({});
  }, [selectedDate]);

  // ===========================================================================
  // 2. MOTOR DE CÁLCULO DOS CAMPOS (Resumo Topo Slim)
  // ===========================================================================
  const dayData = useMemo(() => {
    if (!selectedDate) return [];
    return qualyflowMockData.filter(i => i.DATA_HORA?.startsWith(selectedDate) && OCORRENCIAS.includes(i.OCORRENCIA));
  }, [selectedDate]);

  const camposData = useMemo(() => {
    const nomesCampos = [...new Set(dayData.map(i => i.CAMPO).filter(Boolean))].sort();
    
    return nomesCampos.map(nome => {
      const dfCampo = dayData.filter(i => i.CAMPO === nome);

      const av = dfCampo.filter(i => i.OCORRENCIA === "Avaliação Rebolos").length;
      
      const idades = dfCampo.filter(i => i.OCORRENCIA === "Avaliação Geral" && i.INDICADOR === "Idade da Semente").map(i => Number(i.VALOR) || 0);
      const idade = idades.length ? idades.reduce((a, b) => a + b, 0) / idades.length : 0;

      const gemasV = dfCampo.filter(i => i.OCORRENCIA === "Avaliação de Gemas - Semente" && i.INDICADOR === "Gemas Viáveis").reduce((a, b) => a + (Number(b.VALOR) || 0), 0);
      const gemasT = dfCampo.filter(i => i.OCORRENCIA === "Avaliação de Gemas - Semente" && i.INDICADOR === "Total de Gemas").reduce((a, b) => a + (Number(b.VALOR) || 0), 0);
      const viaveis = gemasT > 0 ? (gemasV / gemasT) * 100 : 0;

      return { nome, av, idade, viaveis };
    });
  }, [dayData]);

  const selectedCampo = camposData[campoIdx]?.nome || "";

  // ===========================================================================
  // 3. EXTRATOR DETALHADO DO CAMPO SELECIONADO (Filtros Cruzados)
  // ===========================================================================
  const dataEngine = useMemo(() => {
    if (!selectedCampo) return null;
    const df = dayData.filter(i => i.CAMPO === selectedCampo);

    const rawPontos = [...new Set(df.map(d => d.DATA_HORA))].sort();
    
    const allPontosInfo = rawPontos.map((dh, idx) => {
      const pData = df.filter(d => d.DATA_HORA === dh);
      const variedade = pData.find(d => d.VARIEDADE)?.VARIEDADE || "N/A";
      return { id: dh, n: idx + 1, variedade, data: pData };
    });

    const allVariedades = [...new Set(allPontosInfo.map(p => p.variedade))].sort();

    const activePontos = allPontosInfo.filter(p => {
      if (selVars.length > 0 && !selVars.includes(p.variedade)) return false;
      if (selPts.length > 0 && !selPts.includes(p.n)) return false;
      return true;
    });

    const activeData = activePontos.flatMap(p => p.data);

    const getSum = (oc, ind) => activeData.filter(i => i.OCORRENCIA === oc && i.INDICADOR === ind).reduce((a, b) => a + (Number(b.VALOR) || 0), 0);
    const getAvg = (oc, ind) => {
      const vals = activeData.filter(i => i.OCORRENCIA === oc && i.INDICADOR === ind).map(i => Number(i.VALOR) || 0);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    };
    const getCount = (oc, ind) => activeData.filter(i => i.OCORRENCIA === oc && (ind ? i.INDICADOR === ind : true)).length;

    // --- CÁLCULOS DO BOX RESUMO COMPACTO ---
    const infoGeral = df[0] || {};
    const tipoIrrig = infoGeral.TIPO_IRRIG || "NÃO INFORMADO";
    const mediaIdade = getAvg("Avaliação Geral", "Idade da Semente");
    const rebolosAvCount = getCount("Avaliação Rebolos", null);
    const totalGemas = getSum("Avaliação de Gemas - Semente", "Total de Gemas");
    const viaveisGemas = getSum("Avaliação de Gemas - Semente", "Gemas Viáveis");
    const danificadasGemas = totalGemas - viaveisGemas;
    const viaveisPerc = totalGemas > 0 ? (viaveisGemas / totalGemas) * 100 : 0;

    // --- DANOS (Qualidade Plantio) ---
    const rachados = getAvg("Avaliação Geral", "% de Rebolos Rachados");
    const amassados = getAvg("Avaliação Geral", "% de Rebolos Amassados");
    const brocados = getAvg("Avaliação Geral", "% Rebolos Brocados");
    const palmitosSoma = getSum("Avaliação Geral", "Nº de Palmitos");
    const palmitosCont = getCount("Avaliação Geral", "Nº de Palmitos");
    const palmitosPerc = palmitosCont > 0 ? (palmitosSoma / (palmitosCont * 50)) * 100 : 0;

    // --- QUALIDADE REBOLOS ---
    const qtyBons = getSum("Avaliação Geral", "Rebolos Bons");
    const qtyReg = getSum("Avaliação Geral", "Rebolos Regulares");
    const qtyRuim = getSum("Avaliação Geral", "Rebolos Ruins");

    // --- PISOTEIO ---
    const pisoteioSoma = getSum("Pisoteio", "Metros Pisoteados");
    const pisoteioPontos = getCount("Pisoteio", "Metros Pisoteados");
    const metrosAvaliados = pisoteioPontos * 40;
    const pisoteioPerc = metrosAvaliados > 0 ? (pisoteioSoma / metrosAvaliados) * 100 : 0;
    
    // Regra Gotejo = 0%, Outros = 50%
    const metaPisoteio = tipoIrrig.toUpperCase().includes("GOTEJO") ? 0 : 50;

    // --- HISTOGRAMA ---
    const amostras = activeData.filter(i => i.OCORRENCIA === "Avaliação Rebolos").map(i => Number(i.VALOR) || 0);
    const hist = { '<30': 0, '30-35': 0, '35-40': 0, '40-45': 0, '>45': 0 };
    amostras.forEach(v => {
      if (v < 30) hist['<30']++;
      else if (v < 35) hist['30-35']++;
      else if (v <= 40) hist['35-40']++;
      else if (v <= 45) hist['40-45']++;
      else hist['>45']++;
    });

    return {
      allPontosInfo, allVariedades, activePontos,
      summary: { tipoIrrig, mediaIdade, rebolosAvCount, totalGemas, viaveisGemas, danificadasGemas, viaveisPerc },
      kpis: { rachados, amassados, brocados, palmitosPerc },
      pizza: [
        { name: 'Bons', value: qtyBons, color: '#22c55e' },
        { name: 'Regulares', value: qtyReg, color: '#eab308' },
        { name: 'Ruins', value: qtyRuim, color: '#ef4444' }
      ],
      pisoteio: { soma: pisoteioSoma, avaliado: metrosAvaliados, perc: pisoteioPerc, meta: metaPisoteio },
      histograma: [
        { label: '<30', val: hist['<30'], color: '#ef4444' },
        { label: '30-35', val: hist['30-35'], color: '#eab308' },
        { label: '35-40', val: hist['35-40'], color: '#22c55e' },
        { label: '40-45', val: hist['40-45'], color: '#eab308' },
        { label: '>45', val: hist['>45'], color: '#ef4444' }
      ]
    };
  }, [selectedCampo, dayData, selVars, selPts]);

  // Checagens de UI para Filtros
  const isVarAvailable = (vName) => {
    if (selPts.length === 0) return true;
    return dataEngine?.allPontosInfo.some(p => selPts.includes(p.n) && p.variedade === vName);
  };
  const isPtAvailable = (ptN) => {
    if (selVars.length === 0) return true;
    return dataEngine?.allPontosInfo.some(p => p.n === ptN && selVars.includes(p.variedade));
  };

  const toggleVar = (v) => setSelVars(prev => prev.includes(v) ? prev.filter(i => i !== v) : [...prev, v]);
  const togglePt = (p) => setSelPts(prev => prev.includes(p) ? prev.filter(i => i !== p) : [...prev, p]);
  const toggleExpand = (n) => setExpandedPts(prev => ({ ...prev, [n]: !prev[n] }));

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20 text-slate-900">
      <HeaderCheckList onMenuOpen={() => setSidebarOpen(true)} />
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
            
            {/* SELETOR DE CAMPOS (Resumo Slim One-Line) */}
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
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Idade</span>
                      <span className="text-[13px] font-black text-slate-600">{formatVal(c.idade)}<span className="text-[9px] text-slate-400 ml-0.5">m</span></span>
                    </div>

                    <div className="flex flex-col items-center flex-1 border-l border-slate-200/50">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Avaliados</span>
                      <span className="text-[13px] font-black text-slate-600">
                        {c.av} <span className="text-[8px] text-slate-400 uppercase">Reb</span>
                      </span>
                    </div>

                    <div className="flex flex-col items-end w-[72px] border-l border-slate-200/50 pl-2 pr-1">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Viáveis</span>
                      <span className="text-[13px] font-black" style={{ color: QUALY_RULES.GemasViáveis.meta(c.viaveis) }}>{formatVal(c.viaveis)}%</span>
                    </div>
                  </button>
                )
              })}
            </div>

            {dataEngine && (
              <div className="flex flex-col gap-5 pt-2">
                
                {/* PAINEL DE FILTROS CRUZADOS */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Variedades Avaliadas</span>
                    <div className="flex flex-wrap gap-2">
                      {dataEngine.allVariedades.map(v => {
                        const isAvail = isVarAvailable(v);
                        const isSel = selVars.includes(v);
                        return (
                          <button 
                            key={v} onClick={() => isAvail && toggleVar(v)} disabled={!isAvail}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
                              isSel ? 'bg-agro-green/10 border-agro-green text-agro-green shadow-sm' 
                              : isAvail ? 'bg-slate-50 border-slate-200 text-slate-500 hover:border-agro-green/50' 
                              : 'bg-slate-100 border-slate-100 text-slate-300 cursor-not-allowed opacity-50'
                            }`}
                          >
                            {v}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pontos de Avaliação</span>
                    <div className="flex flex-wrap gap-2">
                      {dataEngine.allPontosInfo.map(p => {
                        const isAvail = isPtAvailable(p.n);
                        const isSel = selPts.includes(p.n);
                        return (
                          <button 
                            key={p.n} onClick={() => isAvail && togglePt(p.n)} disabled={!isAvail}
                            className={`w-10 h-8 flex items-center justify-center rounded-lg text-[11px] font-black transition-all border ${
                              isSel ? 'bg-agro-green text-white shadow-md border-agro-green' 
                              : isAvail ? 'bg-white border-slate-200 text-slate-600 hover:border-agro-green/50' 
                              : 'bg-slate-100 border-slate-100 text-slate-300 cursor-not-allowed opacity-50'
                            }`}
                          >
                            {p.n}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* CAIXA DE RESUMO COMPACTA */}
                <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1.5">
                  {[
                    { label: 'Tipo Irrigação', val: dataEngine.summary.tipoIrrig.toUpperCase() },
                    { label: 'Média de Idade', val: `${formatVal(dataEngine.summary.mediaIdade)} m` },
                    { label: 'Rebolos Avaliados', val: `${dataEngine.summary.rebolosAvCount} un` },
                    { label: 'Gemas Viáveis', val: `${dataEngine.summary.viaveisGemas} un` },
                    { label: 'Gemas Danificadas', val: `${dataEngine.summary.danificadasGemas} un`, color: COLORS.fora }
                  ].map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center border-b border-slate-50 border-dashed pb-1.5 last:border-0 last:pb-0">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.label}</span>
                      <span className="text-[12px] font-black text-slate-700" style={{ color: item.color }}>{item.val}</span>
                    </div>
                  ))}
                </div>

                {/* GAUGE: GEMAS VIÁVEIS (SOLTO) */}
                <div className="py-2 flex flex-col items-center justify-center">
                   <GaugeChart 
                     value={dataEngine.summary.viaveisPerc} 
                     color={QUALY_RULES.GemasViáveis.meta(dataEngine.summary.viaveisPerc)} 
                   />
                </div>

                {/* DANOS À SEMENTE (SOLTO) */}
                <div className="flex flex-col gap-3 px-2">
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center border-b border-slate-200 pb-1.5 mb-1">Danos à Semente</h3>
                  <MiniBar label="Rachados" percent={dataEngine.kpis.rachados} color={RULES.rachados(dataEngine.kpis.rachados)} />
                  <MiniBar label="Amassados" percent={dataEngine.kpis.amassados} color={RULES.amassados(dataEngine.kpis.amassados)} />
                  <MiniBar label="Palmitos" percent={dataEngine.kpis.palmitosPerc} color={RULES.palmitos(dataEngine.kpis.palmitosPerc)} />
                  <MiniBar label="Brocados" percent={dataEngine.kpis.brocados} color={RULES.brocados(dataEngine.kpis.brocados)} />
                </div>

                {/* QUALIDADE DOS REBOLOS (SOLTO) */}
                <div className="flex flex-col items-center px-2 mt-4">
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center border-b border-slate-200 pb-1.5 mb-4 w-full">Qualidade dos Rebolos</h3>
                  <div className="w-full h-[180px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={dataEngine.pizza} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" stroke="none">
                          {dataEngine.pizza.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                        </Pie>
                        <Tooltip formatter={(val) => [`${val} un`, 'Quantidade']} contentStyle={{ borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-x-0 bottom-0 flex justify-center gap-4 pb-1">
                       {dataEngine.pizza.map(item => (
                         <div key={item.name} className="flex items-center gap-1.5">
                           <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                           <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{item.name}</span>
                         </div>
                       ))}
                    </div>
                  </div>
                </div>

                {/* TAMANHO DOS REBOLOS (ACORDEÃO POR PONTO) */}
                <div className="flex flex-col gap-3 mt-6">
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-2">Tamanho dos Rebolos</h3>
                  
                  <div className="flex flex-col gap-2">
                    {dataEngine.activePontos.map(p => {
                      const amostras = p.data.filter(i => i.OCORRENCIA === "Avaliação Rebolos").map(i => Number(i.VALOR) || 0);
                      if (amostras.length === 0) return null;

                      const isExpanded = expandedPts[p.n];
                      const gridAmostras = Array.from({ length: 50 }, (_, i) => amostras[i] !== undefined ? amostras[i] : null);

                      const padraoQty = amostras.filter(v => v >= 30 && v <= 45).length;
                      const padraoPerc = amostras.length > 0 ? (padraoQty / amostras.length) * 100 : 0;

                      return (
                        <div key={p.n} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                          <button 
                            onClick={() => toggleExpand(p.n)}
                            className="p-3.5 flex justify-between items-center transition-colors hover:bg-slate-50/50"
                          >
                            <div className="flex items-center gap-3">
                               <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 text-sm font-black text-slate-600">
                                 {p.n}
                               </div>
                               <div className="flex flex-col items-start">
                                 <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Variedade</span>
                                 <span className="text-[12px] font-black text-slate-700 uppercase leading-none">{p.variedade}</span>
                               </div>
                            </div>
                            <div className="flex items-center gap-3">
                               <div className="flex flex-col items-end">
                                 <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Tamanho</span>
                                 <span className="text-[14px] font-black" style={{ color: QUALY_RULES.GemasViáveis.meta(padraoPerc) }}>{padraoPerc.toFixed(0)}%</span>
                               </div>
                               <span className={`text-slate-300 text-[10px] transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                            </div>
                          </button>

                          <div className={`grid transition-all duration-300 ease-in-out bg-slate-50 border-t border-slate-100 ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                            <div className="overflow-hidden">
                              <div className="p-3">
                                 <div className="grid grid-cols-10 gap-1.5">
                                   {gridAmostras.map((val, i) => (
                                     <div 
                                       key={i} 
                                       className="h-7 flex items-center justify-center rounded text-[10px] font-black shadow-sm"
                                       style={{ 
                                         backgroundColor: val === null ? '#f1f5f9' : RULES.tamanhoRebolo(val),
                                         color: val === null ? '#cbd5e1' : '#ffffff',
                                         border: val === null ? '1px dashed #cbd5e1' : 'none'
                                       }}
                                     >
                                       {val !== null ? val : '-'}
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

                {/* HISTOGRAMA DE TAMANHO DOS REBOLOS */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4 mt-2">
                   <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1.5">Distribuição do Tamanho (cm)</h3>
                   <div className="flex items-end justify-between h-[120px] pt-4 px-2">
                     {dataEngine.histograma.map((bar, idx) => {
                       const maxVal = Math.max(...dataEngine.histograma.map(h => h.val), 1);
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

                {/* GAUGE: PISOTEIO (COM RENDEREZAÇÃO CONDICIONAL) */}
                {dataEngine.pisoteio.avaliado > 0 && (
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center mt-2">
                     <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1.5 mb-4 w-full text-left">Nível de Pisoteio</h3>
                     
                     <GaugeChart 
                       value={dataEngine.pisoteio.perc} 
                       label={`Meta: ${dataEngine.pisoteio.meta}%`} 
                       color={dataEngine.pisoteio.perc > dataEngine.pisoteio.meta ? COLORS.fora : COLORS.dentro} 
                     />

                     <div className="w-full bg-slate-50 border border-slate-100 rounded-lg p-3 mt-5 flex flex-col gap-2">
                       <div className="flex justify-between items-center border-b border-slate-200/60 border-dashed pb-1.5">
                         <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Metros Avaliados</span>
                         <span className="text-[12px] font-black text-slate-700">{dataEngine.pisoteio.avaliado} m</span>
                       </div>
                       <div className="flex justify-between items-center">
                         <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Metros Pisoteados</span>
                         <span className="text-[12px] font-black text-slate-700">{dataEngine.pisoteio.soma} m</span>
                       </div>
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

export default SementeDetails;