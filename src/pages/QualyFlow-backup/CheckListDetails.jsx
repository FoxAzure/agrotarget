import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Componentes Reutilizáveis
import HeaderCheckList from '../../components/QualyFlow/HeaderCheckList';
import Sidebar from '../../components/QualyFlow/Sidebar';
import DateSelector from '../../components/QualyFlow/DateSelector';

// Dados
import qualyflowMockData from '../../data/mockData.json';

// ===========================================================================
// REGRAS DE NEGÓCIO E CORES
// ===========================================================================
const COLORS = {
  ok: '#22c55e',      // Verde Agro
  warning: '#eab308', // Amarelo
  danger: '#ef4444',  // Vermelho
  neutral: '#94a3b8'  // Cinza
};

const rules = {
  pressao: (v) => (v >= 7 && v <= 22) ? COLORS.ok : COLORS.danger,
  conforme: (v) => v === 100 ? COLORS.ok : (v === 0 ? COLORS.danger : COLORS.neutral),
  zeroGood: (v) => v === 0 ? COLORS.ok : (v > 0 ? COLORS.danger : COLORS.neutral),
  dif: (v) => v <= 7 ? COLORS.ok : COLORS.danger,
  
  estrutDanif: (v) => v === 0 ? { text: 'Ok', color: COLORS.ok } : { text: 'Sim', color: COLORS.danger },
  ventosa: (v) => v === 100 ? { text: 'Ok', color: COLORS.ok } : { text: 'Sim', color: COLORS.danger },
  jampeado: (v) => v === 0 ? { text: 'Ok', color: COLORS.ok } : { text: 'Sim', color: COLORS.danger },
  pilotoDesreg: (v) => v === 0 ? { text: 'Ok', color: COLORS.ok } : { text: 'Sim', color: COLORS.danger },
  pilotoDanif: (v) => v === 0 ? { text: 'Ok', color: COLORS.ok } : { text: 'Sim', color: COLORS.danger },
  galit: (v) => v === 100 ? { text: 'Ok', color: COLORS.ok } : { text: 'Sim', color: COLORS.danger },
};

const formatVal = (v) => v !== null && v !== undefined ? Number(v).toFixed(1) : '-';
const formatInt = (v) => v !== null && v !== undefined ? Number(v).toFixed(0) : '-';

// ===========================================================================
// COMPONENTE: BARRA ANIMADA (Para Visão Detalhada)
// ===========================================================================
const AnimatedProgressBar = ({ value, color, max = 35 }) => {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const safeValue = Math.min(Math.max((value / max) * 100, 0), 100);
    const timer = setTimeout(() => setWidth(safeValue || 0), 150);
    return () => clearTimeout(timer);
  }, [value, max]);

  return (
    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5 shadow-inner">
      <div
        className="h-full rounded-full transition-all duration-[1000ms] ease-out"
        style={{ width: `${width}%`, backgroundColor: color }}
      />
    </div>
  );
};

const CheckListDetails = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [campoIdx, setCampoIdx] = useState(0);
  const [activeTab, setActiveTab] = useState('paineis');
  const [loteView, setLoteView] = useState('resumo'); // 'resumo' ou 'detalhado'
  const [modalLote, setModalLote] = useState(null);
  
  const location = useLocation();
  const passedDate = location.state?.selectedDate;

  // ===========================================================================
  // 1. GESTÃO DE DATAS E CAMPOS
  // ===========================================================================
  const OCORRENCIAS = ["Pressão dos Lotes", "Caixa de Válvula", "Pressão dos Filtros", "Painéis", "Sistema de Filtragem", "Regulagem das Pressões"];
  
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
    setCampoIdx(0);
  }, [selectedDate]);

  // ===========================================================================
  // 2. MOTOR DE CÁLCULO GERAL E DETALHADO
  // ===========================================================================
  const dayData = useMemo(() => {
    if (!selectedDate) return [];
    return qualyflowMockData.filter(i => i.DATA_HORA?.startsWith(selectedDate) && OCORRENCIAS.includes(i.OCORRENCIA));
  }, [selectedDate]);

  const camposData = useMemo(() => {
    const nomesCampos = [...new Set(dayData.map(i => i.CAMPO).filter(Boolean))].sort();
    
    return nomesCampos.map(nome => {
      const dfCampo = dayData.filter(i => i.CAMPO === nome);
      const lotesNomes = [...new Set(dfCampo.filter(i => i.LOTE).map(i => i.LOTE))];
      
      let sumMin = 0, countMin = 0;
      let sumMax = 0, countMax = 0;

      lotesNomes.forEach(lote => {
        const dfLote = dfCampo.filter(i => i.LOTE === lote);
        const minReg = dfLote.find(i => i.OCORRENCIA === "Regulagem das Pressões" && i.INDICADOR === "Minima Regulada")?.VALOR;
        const minNor = dfLote.find(i => i.OCORRENCIA === "Pressão dos Lotes" && i.INDICADOR === "Minima")?.VALOR;
        const valMin = minReg !== undefined ? Number(minReg) : (minNor !== undefined ? Number(minNor) : null);
        if (valMin !== null && !isNaN(valMin)) { sumMin += valMin; countMin++; }

        const maxReg = dfLote.find(i => i.OCORRENCIA === "Regulagem das Pressões" && i.INDICADOR === "Máxima Regulada")?.VALOR;
        const maxNor = dfLote.find(i => i.OCORRENCIA === "Pressão dos Lotes" && i.INDICADOR === "Máxima")?.VALOR;
        const valMax = maxReg !== undefined ? Number(maxReg) : (maxNor !== undefined ? Number(maxNor) : null);
        if (valMax !== null && !isNaN(valMax)) { sumMax += valMax; countMax++; }
      });

      return {
        nome,
        lotesAv: lotesNomes.length,
        avgMin: countMin > 0 ? sumMin / countMin : null,
        avgMax: countMax > 0 ? sumMax / countMax : null
      };
    });
  }, [dayData]);

  const selectedCampo = camposData[campoIdx]?.nome || "";

  const extractData = useMemo(() => {
    if (!selectedCampo) return null;
    const df = dayData.filter(i => i.CAMPO === selectedCampo);

    const getVal = (ocorr, indic, turno = null, lote = null) => {
      const item = df.find(i => i.OCORRENCIA === ocorr && i.INDICADOR === indic && (!turno || i.TURNO === turno) && (!lote || String(i.LOTE) === String(lote)));
      return item && !isNaN(Number(item.VALOR)) ? Number(item.VALOR) : null;
    };

    // --- PAINÉIS ---
    const getPaineis = (turno) => ({
      amp: getVal("Painéis", "Amperagem", turno),
      volt: getVal("Painéis", "Voltagem", turno),
      funcRetro: getVal("Painéis", "Funcionamento Painéis da Retrolavagem", turno),
      funcAuto: getVal("Painéis", "Sistema Automação Retrolavagem", turno),
      vaz: getVal("Painéis", "Vazamentos no painel", turno),
      percRetro: (() => {
        const semRetro = getVal("Painéis", "Retrolavagem sem funcionar", turno);
        const totFiltros = getVal("Painéis", "Total de Filtros", turno);
        return (totFiltros > 0 && semRetro !== null) ? (1 - (semRetro / totFiltros)) * 100 : 100;
      })(),
      percAuto: (() => {
        const semAuto = getVal("Painéis", "Automação Sem funcionar", turno);
        const totLotes = getVal("Painéis", "Total de Lotes", turno);
        return (totLotes > 0 && semAuto !== null) ? (1 - (semAuto / totLotes)) * 100 : 100;
      })()
    });

    // --- FILTRAGEM ---
    const getFilt = (indic) => getVal("Sistema de Filtragem", indic, "1º Turno") ?? getVal("Sistema de Filtragem", indic, "2º Turno");
    const filtragem = {
      manBarrilete: getFilt("Manômetro do Barrilete"),
      manSaida: getFilt("Monômetro de Saída"),
      nivelAreia: getFilt("Nível de Areia dos Filtros"),
      vazBarrilete: getFilt("Vaz. Barrilete"),
      vazFiltAreia: getFilt("Vaz. Filtro de Areia"),
      vazFiltLinha: getFilt("Vaz. Filtro de linha"),
      vazMicrotubo: getFilt("Vaz. Microtubo e Conexões"),
    };

    // --- CAIXAS DE VÁLVULA E LOTES ---
    const dfLotes = df.filter(i => i.LOTE);
    const lotesNames = [...new Set(dfLotes.map(i => i.LOTE))].sort((a, b) => a.toString().localeCompare(b.toString(), undefined, { numeric: true }));

    const lotes = lotesNames.map(l => ({
      l,
      estDanif: getVal("Caixa de Válvula", "Estrutura da Caixa de Válvula Danificada", null, l),
      ventosa: getVal("Caixa de Válvula", "Ventosa", null, l),
      jampeado: getVal("Caixa de Válvula", "Lotes Jampeados", null, l),
      vazTub: getVal("Caixa de Válvula", "Vaz. Tubulação e Conexões", null, l),
      min: getVal("Pressão dos Lotes", "Minima", null, l),
      max: getVal("Pressão dos Lotes", "Máxima", null, l),
      minReg: getVal("Regulagem das Pressões", "Minima Regulada", null, l),
      maxReg: getVal("Regulagem das Pressões", "Máxima Regulada", null, l),
      pilDesreg: getVal("Pressão dos Lotes", "Piloto Desregulado", null, l),
      pilDanif: getVal("Pressão dos Lotes", "Piloto Danificado?", null, l),
      galit: getVal("Pressão dos Lotes", "Galit", null, l),
    }));

    // --- PRESSÕES DOS FILTROS ---
    const getPressoes = (turno) => {
      const paf = getVal("Pressão dos Filtros", "PAF", turno);
      const pdf = getVal("Pressão dos Filtros", "PDF", turno);
      const pav = getVal("Pressão dos Filtros", "PAV", turno);
      const pdv = getVal("Pressão dos Filtros", "PDV", turno);
      return { 
        paf, pdf, difFiltro: (pdf !== null && paf !== null) ? pdf - paf : null,
        pav, pdv, difValvula: (pdv !== null && pav !== null) ? pdv - pav : null 
      };
    };

    return {
      paineis: { t1: getPaineis("1º Turno"), t2: getPaineis("2º Turno") },
      filtragem,
      pressoes: { t1: getPressoes("1º Turno"), t2: getPressoes("2º Turno") },
      lotes,
      lotesCaixa: lotes.filter(l => l.estDanif !== null) 
    };
  }, [dayData, selectedCampo]);

  // ===========================================================================
  // COMPONENTES AUXILIARES DE RENDERIZAÇÃO
  // ===========================================================================
  const PressaoCompacta = ({ label1, val1, label2, val2, labelDif, valDif }) => (
    <div className="flex flex-col bg-slate-50 p-3 rounded-lg border border-slate-100 mt-2">
       <div className="flex justify-between items-center">
          <span className="text-[11px] font-bold text-slate-500">{label1}</span>
          <span className="text-[12px] font-black text-slate-700">{formatVal(val1)}</span>
       </div>
       <div className="w-full border-b-2 border-dashed border-slate-200 my-1.5" />
       <div className="flex justify-between items-center">
          <span className="text-[11px] font-bold text-slate-500">{label2}</span>
          <span className="text-[12px] font-black text-slate-700">{formatVal(val2)}</span>
       </div>
       <div className="w-full border-b-2 border-dashed border-slate-200 my-1.5" />
       <div className="flex justify-between items-center">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{labelDif}</span>
          <span className="text-[12px] font-black" style={{ color: valDif !== null ? rules.dif(valDif) : COLORS.neutral }}>{formatVal(valDif)} mca</span>
       </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20 text-slate-900">
      <HeaderCheckList onMenuOpen={() => setSidebarOpen(true)} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={(p) => console.log(p)} />

      <main className="p-4 flex flex-col items-center">
        
        <div className="w-full max-w-[400px] mb-5 mt-2">
          <DateSelector 
            date={selectedDate} 
            onPrev={() => setDateIndex(di => Math.min(di + 1, availableDates.length - 1))} 
            onNext={() => setDateIndex(di => Math.max(di - 1, 0))} 
            disablePrev={dateIndex === availableDates.length - 1} 
            disableNext={dateIndex === 0} 

            availableDates={availableDates}
            onSelectDate={(novaData) => {
              const idx = availableDates.indexOf(novaData);
              if (idx !== -1) setDateIndex(idx);
            }}
            
          />
        </div>

        {camposData.length === 0 ? (
          <div className="w-full max-w-[400px] text-center p-8 bg-white rounded-xl border border-slate-200 border-dashed text-slate-400 font-bold text-xs uppercase tracking-widest mt-4">
            Sem avaliações nesta data
          </div>
        ) : (
          <div className="w-full max-w-[400px] flex flex-col gap-6 animate-in fade-in duration-500">
            
            {/* SELETOR DE CAMPOS TIPO LISTA FULL-WIDTH */}
            <div className="flex flex-col gap-2">
              {camposData.map((c, idx) => {
                const isActive = campoIdx === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => setCampoIdx(idx)}
                    className={`w-full flex justify-between items-center p-3.5 rounded-xl border transition-all active:scale-[0.98] ${
                      isActive ? 'border-agro-green border-2 bg-green-50/80 shadow-md' : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-start w-24">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Campo</span>
                        <span className={`text-sm font-black uppercase truncate w-full text-left ${isActive ? 'text-agro-green' : 'text-slate-600'}`}>{c.nome}</span>
                      </div>
                      <div className="flex flex-col items-center px-2 border-l border-slate-200/50">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Lotes</span>
                        <span className={`text-[12px] font-black ${isActive ? 'text-agro-green' : 'text-slate-600'}`}>{c.lotesAv} <span className="text-[9px] uppercase tracking-wider text-slate-400"></span></span>
                      </div>
                    </div>

                    <div className="flex gap-4 text-right pl-3 border-l border-slate-200/50">
                      <div className="flex flex-col items-center">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Média Min</span>
                        <span className="text-[13px] font-black" style={{ color: c.avgMin !== null ? rules.pressao(c.avgMin) : COLORS.neutral }}>{formatVal(c.avgMin)}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Média Máx</span>
                        <span className="text-[13px] font-black" style={{ color: c.avgMax !== null ? rules.pressao(c.avgMax) : COLORS.neutral }}>{formatVal(c.avgMax)}</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {extractData && (
              <>
                {/* BOX CENTRAL: PAINÉIS / FILTRAGEM / CAIXAS */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                  {/* Abas */}
                  <div className="flex bg-slate-100 p-1.5 border-b border-slate-200">
                    {[
                      { id: 'paineis', label: 'Painéis' },
                      { id: 'filtragem', label: 'Filtragem' },
                      { id: 'caixas', label: 'Cxs Válvulas' }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 text-[9px] font-black uppercase py-2 rounded-md transition-all ${
                          activeTab === tab.id ? 'bg-white shadow-sm text-agro-green' : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="p-0 bg-white">
                    
                    {/* ABA: PAINÉIS (Tabela Colunar Compacta) */}
                    {activeTab === 'paineis' && (
                      <div className="animate-in fade-in slide-in-from-right-2 duration-300">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                              <th className="py-2 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[50%]">Indicador</th>
                              <th className="py-2 px-2 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest w-[25%]">1º Turno</th>
                              <th className="py-2 px-2 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest w-[25%] border-l border-slate-100">2º Turno</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              { label: 'Amperagem', k: 'amp', fmt: formatVal },
                              { label: 'Voltagem', k: 'volt', fmt: formatVal },
                              { label: 'Func. Retrolav.', k: 'funcRetro', st: rules.conforme, txt: (v) => v===100?'Conforme':(v===0?'Não Conf':'-') },
                              { label: 'Sist. Auto. Retro', k: 'funcAuto', st: rules.conforme, txt: (v) => v===100?'Conforme':(v===0?'Não Conf':'-') },
                              { label: 'Func. Retrolav. (%)', k: 'percRetro', st: rules.conforme, txt: (v) => `${formatInt(v)}%` },
                              { label: 'Func. Auto. (%)', k: 'percAuto', st: rules.conforme, txt: (v) => `${formatInt(v)}%` },
                              { label: 'Vazamentos', k: 'vaz', st: rules.zeroGood, txt: formatInt },
                            ].map((row, idx) => (
                              <tr key={idx} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                <td className="py-1.5 px-3 text-[11px] font-bold text-slate-600">{row.label}</td>
                                <td className="py-1.5 px-2 text-center text-[10px] font-black uppercase" style={{ color: row.st ? row.st(extractData.paineis.t1[row.k]) : '#334155' }}>
                                  {row.fmt ? row.fmt(extractData.paineis.t1[row.k]) : row.txt(extractData.paineis.t1[row.k])}
                                </td>
                                <td className="py-1.5 px-2 text-center text-[10px] font-black uppercase border-l border-slate-50" style={{ color: row.st ? row.st(extractData.paineis.t2[row.k]) : '#334155' }}>
                                  {row.fmt ? row.fmt(extractData.paineis.t2[row.k]) : row.txt(extractData.paineis.t2[row.k])}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* ABA: FILTRAGEM */}
                    {activeTab === 'filtragem' && (
                      <div className="p-4 flex flex-col gap-4 animate-in fade-in slide-in-from-right-2 duration-300">
                        <div className="flex flex-col gap-2">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1.5">Inspeção Visual</h4>
                          <div className="flex justify-between items-center border-b border-slate-50 border-dashed pb-1.5">
                            <span className="text-[11px] font-bold text-slate-600">Manômetro do Barrilete</span>
                            <span className="text-[10px] font-black uppercase" style={{ color: rules.conforme(extractData.filtragem.manBarrilete) }}>
                              {extractData.filtragem.manBarrilete === 100 ? 'Conforme' : (extractData.filtragem.manBarrilete === 0 ? 'Não Conforme' : '-')}
                            </span>
                          </div>
                          <div className="flex justify-between items-center border-b border-slate-50 border-dashed pb-1.5">
                            <span className="text-[11px] font-bold text-slate-600">Monômetro de Saída</span>
                            <span className="text-[10px] font-black uppercase" style={{ color: rules.conforme(extractData.filtragem.manSaida) }}>
                              {extractData.filtragem.manSaida === 100 ? 'Conforme' : (extractData.filtragem.manSaida === 0 ? 'Não Conforme' : '-')}
                            </span>
                          </div>
                          <div className="flex justify-between items-center border-b border-slate-50 border-dashed pb-1.5">
                            <span className="text-[11px] font-bold text-slate-600">Nível de Areia dos Filtros</span>
                            <span className="text-[10px] font-black uppercase" style={{ color: rules.conforme(extractData.filtragem.nivelAreia) }}>
                              {extractData.filtragem.nivelAreia === 100 ? 'Conforme' : (extractData.filtragem.nivelAreia === 0 ? 'Não Conforme' : '-')}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 mt-1">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1.5">Vazamentos</h4>
                          {[
                            { label: 'Barrilete', val: extractData.filtragem.vazBarrilete },
                            { label: 'Filtro de Areia', val: extractData.filtragem.vazFiltAreia },
                            { label: 'Filtro de Linha', val: extractData.filtragem.vazFiltLinha },
                            { label: 'Microtubo e Conexões', val: extractData.filtragem.vazMicrotubo },
                          ].map((vaz, idx) => (
                            <div key={idx} className="flex justify-between items-center border-b border-slate-50 border-dashed pb-1.5 last:border-0">
                              <span className="text-[11px] font-bold text-slate-600">{vaz.label}</span>
                              <span className="text-[12px] font-black" style={{ color: rules.zeroGood(vaz.val) }}>{formatInt(vaz.val)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ABA: CAIXAS DE VÁLVULAS */}
                    {activeTab === 'caixas' && (
                      <div className="animate-in fade-in slide-in-from-right-2 duration-300">
                        {extractData.lotesCaixa.length === 0 ? (
                          <div className="text-center text-[10px] font-bold text-slate-400 py-6 uppercase tracking-widest">Nenhum lote com caixa avaliada</div>
                        ) : (
                          <div className="overflow-x-auto custom-scrollbar pb-2 relative">
                            <div className="flex w-max min-w-full">
                              
                              <div className="flex flex-col sticky left-0 bg-white shadow-[3px_0_6px_-2px_rgba(0,0,0,0.1)] z-10 w-[140px] border-r border-slate-200">
                                <div className="h-8 flex items-end pb-1.5 border-b border-slate-200 pl-3">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Lote</span>
                                </div>
                                <div className="h-8 flex items-center border-b border-slate-50 border-dashed pl-3"><span className="text-[10px] font-bold text-slate-600">Estrutura Danificada</span></div>
                                <div className="h-8 flex items-center border-b border-slate-50 border-dashed pl-3"><span className="text-[10px] font-bold text-slate-600">Ventosa Defeito</span></div>
                                <div className="h-8 flex items-center border-b border-slate-50 border-dashed pl-3"><span className="text-[10px] font-bold text-slate-600">Jampeados</span></div>
                                <div className="h-8 flex items-center pl-3"><span className="text-[10px] font-bold text-slate-600">Vaz. Tubulação</span></div>
                              </div>

                              {extractData.lotesCaixa.map((lote, lIdx) => {
                                const stEst = rules.estrutDanif(lote.estDanif);
                                const stVen = rules.ventosa(lote.ventosa);
                                const stJam = rules.jampeado(lote.jampeado);
                                
                                return (
                                  <div key={lIdx} className="flex flex-col w-[55px] text-center border-r border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                                    <div className="h-8 flex items-end justify-center pb-1 border-b border-slate-200">
                                      <span className="text-[11px] font-black text-slate-700">{lote.l}</span>
                                    </div>
                                    <div className="h-8 flex items-center justify-center border-b border-slate-50 border-dashed">
                                      <span className="text-[10px] font-black uppercase" style={{ color: lote.estDanif !== null ? stEst.color : COLORS.neutral }}>{lote.estDanif !== null ? stEst.text : '-'}</span>
                                    </div>
                                    <div className="h-8 flex items-center justify-center border-b border-slate-50 border-dashed">
                                      <span className="text-[10px] font-black uppercase" style={{ color: lote.ventosa !== null ? stVen.color : COLORS.neutral }}>{lote.ventosa !== null ? stVen.text : '-'}</span>
                                    </div>
                                    <div className="h-8 flex items-center justify-center border-b border-slate-50 border-dashed">
                                      <span className="text-[10px] font-black uppercase" style={{ color: lote.jampeado !== null ? stJam.color : COLORS.neutral }}>{lote.jampeado !== null ? stJam.text : '-'}</span>
                                    </div>
                                    <div className="h-8 flex items-center justify-center">
                                      <span className="text-[12px] font-black" style={{ color: rules.zeroGood(lote.vazTub) }}>{formatInt(lote.vazTub)}</span>
                                    </div>
                                  </div>
                                );
                              })}

                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* PRESSÕES DOS FILTROS E VÁLVULAS (Listas Compactas) */}
                <div className="grid grid-cols-2 gap-3 mt-1">
                  {['t1', 't2'].map((t, idx) => {
                    const press = extractData.pressoes[t];
                    return (
                      <div key={t} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center border-b border-slate-100 pb-2 mb-2">{idx === 0 ? '1º Turno' : '2º Turno'}</h4>
                        
                        <PressaoCompacta label1="PAF" val1={press.paf} label2="PDF" val2={press.pdf} labelDif="Perca" valDif={press.difFiltro} />
                        <PressaoCompacta label1="PAV" val1={press.pav} label2="PDV" val2={press.pdv} labelDif="Perca" valDif={press.difValvula} />
                      </div>
                    );
                  })}
                </div>

                {/* LOTES - TOGGLE RESUMO / DETALHADO */}
                <div className="flex flex-col gap-3 mt-4">
                  
                  <div className="flex justify-between items-end border-b border-slate-200 pb-2">
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-2">Monitoramento por Lote</h3>
                    <div className="flex bg-slate-200/60 p-1 rounded-lg w-[160px]">
                      <button onClick={() => setLoteView('resumo')} className={`flex-1 text-[9px] font-black uppercase py-1.5 rounded-md transition-all ${loteView === 'resumo' ? 'bg-white shadow-sm text-agro-green' : 'text-slate-400 hover:text-slate-500'}`}>Resumo</button>
                      <button onClick={() => setLoteView('detalhado')} className={`flex-1 text-[9px] font-black uppercase py-1.5 rounded-md transition-all ${loteView === 'detalhado' ? 'bg-white shadow-sm text-agro-green' : 'text-slate-400 hover:text-slate-500'}`}>Detalhado</button>
                    </div>
                  </div>
                  
                  {/* VISÃO RESUMO: BARRAS HORIZONTAIS COMPACTAS */}
                  {loteView === 'resumo' && (
                    <div className="flex flex-col gap-1.5 animate-in fade-in duration-300">
                      {extractData.lotes.map((lote, lIdx) => {
                        // Verifica se há problemas no Piloto/Galit
                        const hasAlert = (lote.pilDesreg !== null && lote.pilDesreg > 0) || 
                                         (lote.pilDanif !== null && lote.pilDanif > 0) || 
                                         (lote.galit !== null && lote.galit === 0);
                        
                        const valMin = lote.minReg ?? lote.min ?? 0;
                        const valMax = lote.maxReg ?? lote.max ?? 0;
                        
                        // Oculta caso não tenha avaliações de pressão no lote
                        if (valMin === 0 && valMax === 0) return null;

                        // Regras de Limites
                        const isMinErro = valMin < 7 || valMin > 22;
                        const isMaxErro = valMax < 7 || valMax > 22;

                        // Cores da Mínima (Água clara ou Vermelho claro)
                        const bgMin = isMinErro ? 'bg-red-400' : 'bg-sky-400';
                        // Cores da Máxima (Água profunda ou Vermelho escuro)
                        const bgMax = isMaxErro ? 'bg-red-600' : 'bg-blue-600';

                        // Cálculo das larguras na barra (Escala base de 35 mca)
                        const percMin = Math.min((valMin / 35) * 100, 100);
                        // A largura da máxima é a diferença entre a max e a min
                        const percDiff = Math.max(((valMax - valMin) / 35) * 100, 1.5); 

                        return (
                          <button 
                            key={lIdx} 
                            onClick={() => setModalLote(lote)}
                            className="flex items-center gap-3 w-full bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm hover:border-agro-green/50 transition-all active:scale-[0.98] group"
                          >
                            {/* IDENTIFICAÇÃO DO LOTE */}
                            <div className="w-8 text-left">
                              <span className="text-[11px] font-black text-slate-600 group-hover:text-agro-green transition-colors uppercase tracking-widest">
                                L{lote.l}
                              </span>
                            </div>

                            {/* BARRA EMPILHADA */}
                            <div className="flex-1 flex items-center gap-2.5">
                              <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                                <div className={`h-full transition-all duration-1000 ${bgMin}`} style={{ width: `${percMin}%` }} />
                                <div className={`h-full transition-all duration-1000 ${bgMax}`} style={{ width: `${percDiff}%` }} />
                              </div>
                              
                              {/* VALORES NUMÉRICOS DISCRETOS */}
                              <div className="flex items-center justify-end min-w-[38px]">
                                <span className={`text-[10px] font-black ${isMinErro ? 'text-red-500' : 'text-sky-500'}`}>{valMin.toFixed(1)}</span>
                                <span className="text-[8px] text-slate-300 mx-0.5">/</span>
                                <span className={`text-[10px] font-black ${isMaxErro ? 'text-red-600' : 'text-blue-600'}`}>{valMax.toFixed(1)}</span>
                              </div>
                            </div>

                            {/* BOLINHA DE ALERTA (PILOTO/GALIT) */}
                            <div className="w-3 flex justify-end">
                              {hasAlert ? (
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm animate-pulse" />
                              ) : (
                                <div className="w-2 h-2 rounded-full bg-slate-100 border border-slate-200" />
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* VISÃO DETALHADA: CARDS COM ANIMATED PROGRESS BAR */}
                  {loteView === 'detalhado' && (
                    <div className="grid grid-cols-1 gap-3 animate-in fade-in duration-300">
                      {extractData.lotes.map((lote, lIdx) => {
                        const hasAlert = (lote.pilDesreg !== null && lote.pilDesreg > 0) || (lote.pilDanif !== null && lote.pilDanif > 0) || (lote.galit !== null && lote.galit === 0);

                        return (
                          <button 
                            key={lIdx} 
                            onClick={() => setModalLote(lote)}
                            className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col hover:border-agro-green/50 hover:shadow-md transition-all active:scale-[0.98] text-left relative"
                          >
                            {hasAlert && <div className="absolute top-3.5 right-3.5 w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm animate-pulse" />}

                            <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-3">
                               <span className="text-[12px] font-black text-slate-700 uppercase tracking-widest">Lote {lote.l}</span>
                            </div>

                            <div className="flex justify-between items-start">
                              <div className="flex flex-col flex-1 border-r border-slate-100 pr-4">
                                 <span className="text-[9px] font-bold text-slate-400 uppercase mb-1">Mínima</span>
                                 <div className="flex items-center gap-2 mb-1.5">
                                    <span className="text-[16px] font-black" style={{ color: lote.min !== null ? rules.pressao(lote.min) : COLORS.neutral }}>{formatVal(lote.min)}</span>
                                    {lote.minReg !== null && (
                                       <>
                                         <span className="text-slate-300 text-[10px]">➔</span>
                                         <span className="text-[16px] font-black bg-agro-green/10 text-agro-green px-1.5 rounded">{formatVal(lote.minReg)}</span>
                                       </>
                                    )}
                                 </div>
                                 <AnimatedProgressBar value={lote.minReg ?? lote.min ?? 0} color={rules.pressao(lote.minReg ?? lote.min)} max={35} />
                              </div>
                              
                              <div className="flex flex-col flex-1 pl-4">
                                 <span className="text-[9px] font-bold text-slate-400 uppercase mb-1">Máxima</span>
                                 <div className="flex items-center gap-2 mb-1.5">
                                    <span className="text-[16px] font-black" style={{ color: lote.max !== null ? rules.pressao(lote.max) : COLORS.neutral }}>{formatVal(lote.max)}</span>
                                    {lote.maxReg !== null && (
                                       <>
                                         <span className="text-slate-300 text-[10px]">➔</span>
                                         <span className="text-[16px] font-black bg-agro-green/10 text-agro-green px-1.5 rounded">{formatVal(lote.maxReg)}</span>
                                       </>
                                    )}
                                 </div>
                                 <AnimatedProgressBar value={lote.maxReg ?? lote.max ?? 0} color={rules.pressao(lote.maxReg ?? lote.max)} max={35} />
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}

                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* MODAL DE DETALHES DO LOTE (Piloto/Galit) */}
      {modalLote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-[300px] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex justify-between items-center">
              <div className="flex flex-col">
                <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-tight">Válvula Reguladora</h3>
                <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Campo {selectedCampo} - Lote {modalLote.l}</span>
              </div>
              <button onClick={() => setModalLote(null)} className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-red-100 hover:text-red-500 transition-all font-black text-xs">X</button>
            </div>
            
            <div className="p-5 flex flex-col gap-3">
               {[
                 { label: 'Piloto Desregulado', val: modalLote.pilDesreg, st: rules.pilotoDesreg(modalLote.pilDesreg) },
                 { label: 'Piloto Danificado', val: modalLote.pilDanif, st: rules.pilotoDanif(modalLote.pilDanif) },
                 { label: 'Galit (Filtro)', val: modalLote.galit, st: rules.galit(modalLote.galit) },
               ].map((item, idx) => (
                 <div key={idx} className="flex justify-between items-center border-b border-slate-50 border-dashed pb-2.5 last:border-0 last:pb-0">
                   <span className="text-[11px] font-bold text-slate-600 uppercase pr-4">{item.label}</span>
                   <div className="px-3 py-1 rounded border shadow-sm" style={{ backgroundColor: item.val !== null ? `${item.st.color}15` : '#f1f5f9', borderColor: item.val !== null ? `${item.st.color}30` : '#e2e8f0' }}>
                      <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: item.val !== null ? item.st.color : COLORS.neutral }}>
                        {item.val !== null ? item.st.text : 'N/A'}
                      </span>
                   </div>
                 </div>
               ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckListDetails;