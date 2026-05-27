import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Componentes Reutilizáveis
import HeaderPerdas from '../../components/QualyFlow/HeaderPerdas';
import Sidebar from '../../components/QualyFlow/Sidebar';
import DateSelector from '../../components/QualyFlow/DateSelector';

// Dados e Regras
import qualyflowMockData from '../../data/mockData.json';
import { COLORS } from '../../pages/QualyFlow/rules';

// ===========================================================================
// CONFIGURAÇÕES E REGRAS DA TELA
// ===========================================================================
const LOCAL_RULES = {
  Perda: (v) => v <= 4.5 ? COLORS.dentro : COLORS.fora,
  Arranquio: (v) => v <= 2.5 ? COLORS.dentro : COLORS.fora,
  PisoteioSimples: (v) => v <= 50.0 ? COLORS.dentro : COLORS.fora,
  PisoteioDuplo: (v) => v <= 2.0 ? COLORS.dentro : COLORS.fora,
};

const CATEGORIAS_PERDA = [
  "Estilhaço", "Lascas", "Pedaço Fixo", "Pedaço Solto",
  "Cana Inteira", "Cana Ponta", "Toco > 7cm", "Tolete Repicado"
];

// Helpers de cálculo e normalização
const safeDiv = (num, den) => (den && den !== 0 ? (num / den) : 0);
const formatVal = (v, decimals = 1) => (v !== null && !isNaN(v)) ? Number(v).toFixed(decimals) : (0).toFixed(decimals);
const normColhedora = (c) => c ? c.split('-')[0].trim() : '-';
const normTurno = (t) => t ? t.charAt(0) : '-';

// Degradê Térmico: Verde -> Amarelo -> Vermelho
const getGradientColor = (value, max) => {
  if (max === 0) return '#22c55e';
  const ratio = Math.min(Math.max(value / max, 0), 1);
  const hue = ((1 - ratio) * 120).toString(10);
  return `hsl(${hue}, 80%, 45%)`;
};

// Componente da Barrinha de Categoria (Kg com 3 casas)
const CategoryBar = ({ label, value, maxVal }) => {
  const safeVal = Number(value) || 0;
  const percWidth = maxVal > 0 ? (safeVal / maxVal) * 100 : 0;
  const bgColor = getGradientColor(safeVal, maxVal);

  return (
    <div className="flex flex-col gap-1 w-full mb-2 group">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate pr-2">{label}</span>
        <span className="text-[11px] font-black text-slate-700">{formatVal(safeVal, 3)}</span>
      </div>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
        <div 
          className="h-full rounded-full transition-all duration-700 ease-out" 
          style={{ width: `${Math.max(percWidth, 2)}%`, backgroundColor: bgColor }} 
        />
      </div>
    </div>
  );
};

// ===========================================================================
// MAIN COMPONENT
// ===========================================================================
const PerdasDetails = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const passedDate = location.state?.selectedDate;

  // Estados de Filtros
  const [selectedCampos, setSelectedCampos] = useState([]);
  const [selectedColhedoras, setSelectedColhedoras] = useState([]);
  const [selectedTurno, setSelectedTurno] = useState(null);

  const [expCampos, setExpCampos] = useState({});
  const [selectedPonto, setSelectedPonto] = useState(null);

  // ===========================================================================
  // 1. GESTÃO DE DATAS
  // ===========================================================================
  const OCORRENCIAS = ["Avaliação de Perda Mecanizada", "Arranquio Mecanizado", "Pisoteio Mecanizado"];

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
    setSelectedCampos([]);
    setSelectedColhedoras([]);
    setSelectedTurno(null);
    setExpCampos({});
    setSelectedPonto(null);
  }, [selectedDate]);

  // ===========================================================================
  // 2. MOTOR DE CÁLCULO GERAL
  // ===========================================================================
  const dayData = useMemo(() => {
    if (!selectedDate) return [];
    return qualyflowMockData.filter(i => i.DATA_HORA?.startsWith(selectedDate) && OCORRENCIAS.includes(i.OCORRENCIA));
  }, [selectedDate]);

  const dataEngine = useMemo(() => {
    if (dayData.length === 0) return null;

    const calcInd = (arrData, ind, type = 'mean') => {
      const arr = arrData.filter(i => i.INDICADOR === ind).map(i => Number(i.VALOR) || 0);
      if (arr.length === 0) return 0;
      return type === 'mean' ? arr.reduce((a, b) => a + b, 0) / arr.length : arr.reduce((a, b) => a + b, 0);
    };

    const dfAposCampo = selectedCampos.length > 0 ? dayData.filter(i => selectedCampos.includes(i.CAMPO)) : dayData;

    const nomesCampos = [...new Set(dayData.map(i => i.CAMPO).filter(Boolean))].sort();
    const listaCampos = nomesCampos.map(nome => {
      const dfCampo = dayData.filter(i => i.CAMPO === nome);
      const irrig = (dfCampo[0]?.TIPO_IRRIG || "").toUpperCase();
      const metaPisoteio = irrig.includes("GOTEJO") ? 2.0 : 50.0;
      const cKg = calcInd(dfCampo, "Total Perda", 'mean');
      const cTch = calcInd(dfCampo, "TCH", 'mean');
      const pis = calcInd(dfCampo, "Pisoteio", 'sum');
      const esp = calcInd(dfCampo, "Espaçamento", 'sum');
      const arrArr = calcInd(dfCampo, "Total de tocos arrancados", 'sum');
      const arrFix = calcInd(dfCampo, "Total de tocos fixos", 'sum');
      return { 
        nome, perda: safeDiv(cKg, cTch + cKg) * 100, pisoteio: safeDiv(pis, esp) * 100, 
        arranquio: safeDiv(arrArr, arrFix) * 100, metaPisoteio 
      };
    });

    const nomesColhedorasDia = [...new Set(dayData.map(i => normColhedora(i.COLHEDORA)))].sort((a,b) => a.localeCompare(b));
    const listaColhedoras = nomesColhedorasDia.map(colhNome => {
      const isActive = dfAposCampo.some(i => normColhedora(i.COLHEDORA) === colhNome);
      const dfColh = dfAposCampo.filter(i => normColhedora(i.COLHEDORA) === colhNome);
      
      let perda = 0, pisoteio = 0, arranquio = 0, temDesvio = false;
      if (dfColh.length > 0) {
        const cKg = calcInd(dfColh, "Total Perda", 'mean');
        const cTch = calcInd(dfColh, "TCH", 'mean');
        perda = safeDiv(cKg, cTch + cKg) * 100;
        pisoteio = safeDiv(calcInd(dfColh, "Pisoteio", 'sum'), calcInd(dfColh, "Espaçamento", 'sum')) * 100;
        arranquio = safeDiv(calcInd(dfColh, "Total de tocos arrancados", 'sum'), calcInd(dfColh, "Total de tocos fixos", 'sum')) * 100;
        temDesvio = perda > 4.5 || pisoteio > 50.0 || arranquio > 2.5;
      }
      return { nome: colhNome, isActive, temDesvio };
    });

    const dfFinal = dfAposCampo.filter(i => {
      const passColh = selectedColhedoras.length === 0 || selectedColhedoras.includes(normColhedora(i.COLHEDORA));
      const passTurno = !selectedTurno || normTurno(i.TURNO) === selectedTurno;
      return passColh && passTurno;
    });

    const kpiKg = calcInd(dfFinal, "Total Perda", 'mean');
    const kpiTch = calcInd(dfFinal, "TCH", 'mean');
    const dfSimples = dfFinal.filter(i => (i.ESPACAMENTO || "").toUpperCase() === "SIMPLES");
    const dfDuplo = dfFinal.filter(i => (i.ESPACAMENTO || "").toUpperCase() === "DUPLO");
    const tocosFixosGeral = calcInd(dfFinal, "Total de tocos fixos", 'sum');
    const tocosArrGeral = calcInd(dfFinal, "Total de tocos arrancados", 'sum');

    const categorias = CATEGORIAS_PERDA.map(cat => ({
      label: cat,
      val: calcInd(dfFinal, cat, 'mean')
    })).sort((a, b) => a.val - b.val);

    const camposUnicos = [...new Set(dfFinal.map(i => i.CAMPO).filter(Boolean))].sort();
    const pontosPorCampoObj = camposUnicos.map(cName => {
      const dfC = dfFinal.filter(i => i.CAMPO === cName);
      const irrigC = (dfC[0]?.TIPO_IRRIG || "").toUpperCase();
      const metaPisC = irrigC.includes("GOTEJO") ? 2.0 : 50.0;

      const ptsMap = {};
      dfC.forEach(row => {
        const cNorm = normColhedora(row.COLHEDORA);
        const tNorm = normTurno(row.TURNO);
        const key = `${cNorm}|${row.LOTE}|${tNorm}|${row.DATA_HORA}`;
        if (!ptsMap[key]) ptsMap[key] = { colh: cNorm, lote: row.LOTE||'-', turnoFull: row.TURNO, turnoNorm: tNorm, dh: row.DATA_HORA, variedade: row.VARIEDADE||'N/A', data: [] };
        ptsMap[key].data.push(row);
      });

      const pontosObj = Object.values(ptsMap).map(ptInfo => {
        const dfPonto = ptInfo.data;
        const ptKg = calcInd(dfPonto, "Total Perda", 'mean');
        const ptTch = calcInd(dfPonto, "TCH", 'mean');
        const ptPisM = calcInd(dfPonto, "Pisoteio", 'sum');
        const ptEspM = calcInd(dfPonto, "Espaçamento", 'sum');
        const ptFix = calcInd(dfPonto, "Total de tocos fixos", 'sum');
        const ptArr = calcInd(dfPonto, "Total de tocos arrancados", 'sum');
        const ptCats = CATEGORIAS_PERDA.map(cat => ({ label: cat, val: calcInd(dfPonto, cat, 'mean') })).sort((a,b) => a.val - b.val);

        return {
          colh: ptInfo.colh, lote: ptInfo.lote, turno: ptInfo.turnoFull, turnoNorm: ptInfo.turnoNorm, data: ptInfo.dh, variedade: ptInfo.variedade,
          perda: safeDiv(ptKg, ptTch + ptKg) * 100, pisoteio: safeDiv(ptPisM, ptEspM) * 100, arranquio: safeDiv(ptArr, ptFix) * 100, metaPis: metaPisC,
          tch: ptTch, kg: ptKg, pisM: ptPisM, espM: ptEspM, tocosFixos: ptFix, tocosArr: ptArr, tocosPos: ptFix - ptArr,
          categorias: ptCats, maxCat: Math.max(...ptCats.map(c=>c.val), 0.1)
        };
      });

      pontosObj.sort((a, b) => {
        if (a.colh !== b.colh) return a.colh.localeCompare(b.colh);
        return a.turnoNorm.localeCompare(b.turnoNorm);
      });

      const cKg = calcInd(dfC, "Total Perda", 'mean');
      const cTch = calcInd(dfC, "TCH", 'mean');
      return {
        nome: cName, perda: safeDiv(cKg, cTch + cKg) * 100,
        pisoteio: safeDiv(calcInd(dfC, "Pisoteio", 'sum'), calcInd(dfC, "Espaçamento", 'sum')) * 100,
        arranquio: safeDiv(calcInd(dfC, "Total de tocos arrancados", 'sum'), calcInd(dfC, "Total de tocos fixos", 'sum')) * 100,
        metaPisoteio: metaPisC, pontos: pontosObj
      };
    });

    return {
      listaCampos, listaColhedoras,
      geral: {
        perda: safeDiv(kpiKg, kpiTch + kpiKg) * 100,
        pisSimples: safeDiv(calcInd(dfSimples, "Pisoteio", 'sum'), calcInd(dfSimples, "Espaçamento", 'sum')) * 100,
        pisDuplo: safeDiv(calcInd(dfDuplo, "Pisoteio", 'sum'), calcInd(dfDuplo, "Espaçamento", 'sum')) * 100,
        arranquio: safeDiv(tocosArrGeral, tocosFixosGeral) * 100,
        tch: kpiTch, kg: kpiKg, pisAvaliado: calcInd(dfFinal, "Espaçamento", 'sum'), pisRegistrado: calcInd(dfFinal, "Pisoteio", 'sum'),
        tocosAntes: tocosFixosGeral, tocosApos: tocosFixosGeral - tocosArrGeral, tocosArr: tocosArrGeral
      },
      categorias, maxCategoriaVal: Math.max(...categorias.map(c => c.val), 0.1),
      pontosPorCampo: pontosPorCampoObj
    };
  }, [dayData, selectedCampos, selectedColhedoras, selectedTurno]);

  // Controles UI
  const toggleCampo = (nome) => setSelectedCampos(prev => prev.includes(nome) ? prev.filter(c => c !== nome) : [...prev, nome]);
  const toggleColh = (nome) => setSelectedColhedoras(prev => prev.includes(nome) ? prev.filter(c => c !== nome) : [...prev, nome]);
  const handleTurno = (t) => setSelectedTurno(prev => prev === t ? null : t);
  const toggleExp = (nome) => setExpCampos(prev => ({ ...prev, [nome]: !prev[nome] }));

  // Textos de Contexto
  const tituloCampos = selectedCampos.length === 0 ? "Todos os Campos" : (selectedCampos.length === 1 ? selectedCampos[0] : `${selectedCampos.length} Campos Selecionados`);
  let txtColh = selectedColhedoras.length === 0 ? "Todas as colhedoras" : `${selectedColhedoras.length} Colhedora(s)`;
  let txtTurno = selectedTurno ? `${selectedTurno}º Turno` : "todos os turnos";
  const subtituloFiltros = `${txtColh}, ${txtTurno}`;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24 text-slate-900 relative">
      <HeaderPerdas onMenuOpen={() => setSidebarOpen(true)} />
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

            availableDates={availableDates}
            onSelectDate={(novaData) => {
              const idx = availableDates.indexOf(novaData);
              if (idx !== -1) setDateIndex(idx);
            }}
          />
        </div>

        {!dataEngine ? (
          <div className="w-full max-w-[400px] text-center p-8 bg-white rounded-xl border border-slate-200 border-dashed text-slate-400 font-bold text-xs uppercase tracking-widest mt-4">
            Sem avaliações de colheita nesta data
          </div>
        ) : (
          <div className="w-full max-w-[400px] flex flex-col gap-6 animate-in fade-in duration-500">
            
            {/* 1. SELETOR DE CAMPOS (BOTÕES INTOCADOS) */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Filtro de Campos</span>
              <div className="flex flex-col gap-2.5">
                {dataEngine.listaCampos.map((c, idx) => {
                  const isActive = selectedCampos.includes(c.nome);
                  const pisoColor = c.metaPisoteio ? (c.pisoteio <= c.metaPisoteio ? COLORS.dentro : COLORS.fora) : LOCAL_RULES.PisoteioSimples(c.pisoteio);
                  return (
                    <button key={idx} onClick={() => toggleCampo(c.nome)} className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all active:scale-[0.98] ${isActive ? 'border-agro-green border-2 bg-green-50/80 shadow-md' : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'}`}>
                      <div className="flex flex-col items-start w-28">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Campo</span>
                        <span className={`text-[13px] font-black uppercase truncate w-full text-left ${isActive ? 'text-agro-green' : 'text-slate-700'}`}>{c.nome}</span>
                      </div>
                      <div className="flex flex-col items-center flex-1 border-l border-slate-200/50">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Perdas</span>
                        <span className="text-[13px] font-black" style={{ color: LOCAL_RULES.Perda(c.perda) }}>{formatVal(c.perda, 2)}%</span>
                      </div>
                      <div className="flex flex-col items-center flex-1 border-l border-slate-200/50">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Pisoteio</span>
                        <span className="text-[13px] font-black" style={{ color: pisoColor }}>{formatVal(c.pisoteio)}%</span>
                      </div>
                      <div className="flex flex-col items-end flex-1 border-l border-slate-200/50 pl-2">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Arranquio</span>
                        <span className="text-[13px] font-black" style={{ color: LOCAL_RULES.Arranquio(c.arranquio) }}>{formatVal(c.arranquio, 2)}%</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 2. FILTRO DE COLHEDORAS (3 COLUNAS, CORES PASTÉIS) E TURNOS */}
            <div className="flex flex-col gap-3 p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filtros Operacionais</span>
              
              <div className="grid grid-cols-3 gap-2">
                {dataEngine.listaColhedoras.map((c, idx) => {
                  const isSelected = selectedColhedoras.includes(c.nome);
                  let styleBase = "bg-slate-100 text-slate-400 opacity-50 cursor-not-allowed border-transparent"; 
                  if (c.isActive) {
                     if (isSelected) {
                       styleBase = "bg-agro-green text-white border-agro-green shadow-md"; 
                     } else {
                       styleBase = c.temDesvio ? "bg-red-50 text-red-700 border-red-200 hover:border-red-400" : "bg-green-50 text-green-700 border-green-200 hover:border-green-400";
                     }
                  }
                  
                  return (
                    <button 
                      key={idx} 
                      disabled={!c.isActive}
                      onClick={() => toggleColh(c.nome)}
                      className={`py-2 px-1 text-[11px] font-black uppercase rounded-lg border transition-all active:scale-[0.95] ${styleBase}`}
                    >
                      {c.nome}
                    </button>
                  )
                })}
              </div>

              {/* Botões de Turno */}
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                 <button onClick={() => handleTurno('1')} className={`flex-1 py-2 text-[11px] font-black uppercase rounded-lg border transition-all ${selectedTurno === '1' ? 'bg-yellow-100 border-yellow-400 text-yellow-800 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>☀️ 1º Turno</button>
                 <button onClick={() => handleTurno('2')} className={`flex-1 py-2 text-[11px] font-black uppercase rounded-lg border transition-all ${selectedTurno === '2' ? 'bg-blue-100 border-blue-400 text-blue-800 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>🌙 2º Turno</button>
              </div>
            </div>

            {/* TÍTULO DINÂMICO DE CONTEXTO (AGORA STICKY) */}
            <div className="sticky top-[60px] sm:top-[70px] z-30 bg-slate-50/90 backdrop-blur-md py-3 border-b border-slate-300/50 flex flex-col items-start justify-center gap-0.5 shadow-sm -mx-4 px-4 w-[calc(100%+2rem)]">
              <h2 className="text-[14px] font-black text-slate-700 uppercase tracking-widest">{tituloCampos}</h2>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{subtituloFiltros}</span>
            </div>

            {/* KPIs GERAIS (Títulos e Valores Alinhados em Tamanho) */}
            <div className="flex flex-col w-full mt-1">
              <div className="flex justify-between items-center py-2.5 border-b border-slate-200/60">
                <span className="text-[14px] font-black text-slate-500 uppercase tracking-widest">Perdas</span>
                <span className="text-[14px] font-black tracking-tight" style={{ color: LOCAL_RULES.Perda(dataEngine.geral.perda) }}>{formatVal(dataEngine.geral.perda, 2)}%</span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-slate-200/60">
                <span className="text-[14px] font-black text-slate-500 uppercase tracking-widest">Pisoteio Simples</span>
                <span className="text-[14px] font-black tracking-tight" style={{ color: LOCAL_RULES.PisoteioSimples(dataEngine.geral.pisSimples) }}>{formatVal(dataEngine.geral.pisSimples)}%</span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-slate-200/60">
                <span className="text-[14px] font-black text-slate-500 uppercase tracking-widest">Pisoteio Duplo</span>
                <span className="text-[14px] font-black tracking-tight" style={{ color: LOCAL_RULES.PisoteioDuplo(dataEngine.geral.pisDuplo) }}>{formatVal(dataEngine.geral.pisDuplo)}%</span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-slate-200/60">
                <span className="text-[14px] font-black text-slate-500 uppercase tracking-widest">Arranquio de Rizomas</span>
                <span className="text-[14px] font-black tracking-tight" style={{ color: LOCAL_RULES.Arranquio(dataEngine.geral.arranquio) }}>{formatVal(dataEngine.geral.arranquio, 2)}%</span>
              </div>
            </div>

            {/* CATEGORIAS EM KG */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col mt-2">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3 mb-4 text-center">
                 Categorias de Perdas (Kg)
               </h3>
               <div className="flex flex-col">
                  {dataEngine.categorias.map((cat, idx) => (
                    <CategoryBar key={idx} label={cat.label} value={cat.val} maxVal={dataEngine.maxCategoriaVal} />
                  ))}
               </div>
            </div>

            {/* INFORMAÇÕES GERAIS (Com borda no último item) */}
            <div className="flex flex-col w-full mt-2">
              {[
                { label: 'TCH Médio', val: `${formatVal(dataEngine.geral.tch)} t/ha` },
                { label: 'Média de Perdas', val: `${formatVal(dataEngine.geral.kg, 3)} Kg` },
                { label: 'Pisoteio Avaliado', val: `${formatVal(dataEngine.geral.pisAvaliado)} m` },
                { label: 'Pisoteio Registrado', val: `${formatVal(dataEngine.geral.pisRegistrado)} m`, color: dataEngine.geral.pisRegistrado > 0 ? COLORS.fora : COLORS.dentro },
                { label: 'Tocos Antes da Colheita', val: `${formatVal(dataEngine.geral.tocosAntes, 0)} un` },
                { label: 'Tocos Após Colheita', val: `${formatVal(dataEngine.geral.tocosApos, 0)} un` },
                { label: 'Total Arrancado', val: `${formatVal(dataEngine.geral.tocosArr, 0)} un`, color: dataEngine.geral.tocosArr > 0 ? COLORS.fora : COLORS.dentro }
              ].map((item, idx) => (
                <div key={idx} className="flex justify-between items-center border-b border-slate-200/60 pb-2 mb-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.label}</span>
                  <span className="text-[13px] font-black text-slate-700" style={{ color: item.color }}>{item.val}</span>
                </div>
              ))}
            </div>

            {/* DETALHAMENTO: ACORDEÃO ORDENADO */}
            <div className="flex flex-col gap-3 mt-4 mb-8">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-2 border-b border-slate-200 pb-1.5">
                Avaliações por Colhedora
              </h3>
              
              <div className="flex flex-col gap-2">
                {dataEngine.pontosPorCampo.map((cObj) => {
                  const isExp = expCampos[cObj.nome];
                  const cPisoColor = cObj.metaPisoteio ? (cObj.pisoteio <= cObj.metaPisoteio ? COLORS.dentro : COLORS.fora) : LOCAL_RULES.PisoteioSimples(cObj.pisoteio);

                  return (
                    <div key={cObj.nome} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                      <button onClick={() => toggleExp(cObj.nome)} className="p-3.5 flex justify-between items-center hover:bg-slate-50/50 bg-slate-50/30">
                        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 w-[90%] text-left">
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Campo</span>
                            <span className="text-[12px] font-black text-slate-700 uppercase truncate">{cObj.nome}</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Perda</span>
                            <span className="text-[12px] font-black" style={{ color: LOCAL_RULES.Perda(cObj.perda) }}>{formatVal(cObj.perda, 2)}%</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Pisoteio</span>
                            <span className="text-[12px] font-black" style={{ color: cPisoColor }}>{formatVal(cObj.pisoteio)}%</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Arranq.</span>
                            <span className="text-[12px] font-black" style={{ color: LOCAL_RULES.Arranquio(cObj.arranquio) }}>{formatVal(cObj.arranquio, 2)}%</span>
                          </div>
                        </div>
                        <span className={`text-slate-400 text-[12px] transition-transform duration-300 ${isExp ? 'rotate-180' : ''}`}>▼</span>
                      </button>

                      <div className={`grid transition-all duration-300 bg-slate-100/50 ${isExp ? 'grid-rows-[1fr] opacity-100 border-t border-slate-200' : 'grid-rows-[0fr] opacity-0'}`}>
                        <div className="overflow-hidden">
                          <div className="p-2 flex flex-col gap-1.5">
                            {cObj.pontos.map((pt, pIdx) => {
                              const isDia = pt.turnoNorm === '1';
                              const isNoite = pt.turnoNorm === '2';
                              
                              let bgStyle = 'bg-white border-slate-200';
                              let icon = '';
                              if (isDia) { bgStyle = 'bg-yellow-50/80 border-yellow-200 hover:border-yellow-300 text-yellow-900'; icon = '☀️'; }
                              else if (isNoite) { bgStyle = 'bg-blue-50/80 border-blue-200 hover:border-blue-300 text-blue-900'; icon = '🌙'; }

                              const ptPisoColor = pt.metaPis ? (pt.pisoteio <= pt.metaPis ? COLORS.dentro : COLORS.fora) : LOCAL_RULES.PisoteioSimples(pt.pisoteio);

                              return (
                                <button 
                                  key={pIdx} 
                                  onClick={() => setSelectedPonto({ campo: cObj.nome, ...pt })}
                                  className={`p-2 rounded-lg border shadow-sm flex flex-col gap-1 transition-all active:scale-[0.98] ${bgStyle}`}
                                >
                                  <div className="flex justify-between items-center w-full pb-1 border-b border-black/5">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[14px] leading-none">{icon}</span>
                                      <span className="text-[11px] font-black uppercase tracking-widest opacity-80">{pt.colh} - {pt.turnoNorm}º Turno</span>
                                    </div>
                                    <div className="flex gap-3">
                                      <div className="flex gap-1 items-center">
                                        <span className="text-[8px] font-black uppercase opacity-60">Lote</span>
                                        <span className="text-[11px] font-black">{pt.lote}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex justify-between items-center w-full px-1 pt-0.5">
                                    <div className="flex flex-col items-center">
                                      <span className="text-[8px] font-black uppercase tracking-widest opacity-60">Perda</span>
                                      <span className="text-[13px] font-black" style={{ color: LOCAL_RULES.Perda(pt.perda) }}>{formatVal(pt.perda, 2)}%</span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                      <span className="text-[8px] font-black uppercase tracking-widest opacity-60">Pisoteio</span>
                                      <span className="text-[13px] font-black" style={{ color: ptPisoColor }}>{formatVal(pt.pisoteio)}%</span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                      <span className="text-[8px] font-black uppercase tracking-widest opacity-60">Arranquio</span>
                                      <span className="text-[13px] font-black" style={{ color: LOCAL_RULES.Arranquio(pt.arranquio) }}>{formatVal(pt.arranquio, 2)}%</span>
                                    </div>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}
      </main>

      {/* MODAL DO PONTO DETALHADO */}
      {selectedPonto && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-[400px] sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">
            
            {/* Modal Header: Cinza claro padrão com fonte escura */}
            <div className="bg-slate-100 text-slate-800 p-5 flex flex-col gap-1 relative border-b border-slate-200">
              <button 
                onClick={() => setSelectedPonto(null)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 transition-all font-bold text-lg"
              >
                ✕
              </button>
              <div className="flex justify-between items-end pr-10">
                 <div className="flex flex-col">
                   <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Campo / Lote</span>
                   <span className="text-[16px] font-black text-agro-green uppercase">{selectedPonto.campo} <span className="text-slate-500 ml-1">L{selectedPonto.lote}</span></span>
                 </div>
                 <div className="text-right flex flex-col">
                   <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Data Avaliação</span>
                   <span className="text-[11px] font-black text-slate-700">{selectedPonto.data.split(' ')[0]}</span>
                 </div>
              </div>
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-200">
                 <div className="flex flex-col"><span className="text-[8px] text-slate-400 uppercase tracking-widest">Colhedora</span><span className="text-[11px] font-black text-slate-700">{selectedPonto.colh}</span></div>
                 <div className="w-px h-6 bg-slate-300" />
                 <div className="flex flex-col"><span className="text-[8px] text-slate-400 uppercase tracking-widest">Turno</span><span className="text-[11px] font-black text-center text-slate-700">{selectedPonto.turnoNorm}º</span></div>
                 <div className="w-px h-6 bg-slate-300" />
                 <div className="flex flex-col"><span className="text-[8px] text-slate-400 uppercase tracking-widest">Variedade</span><span className="text-[11px] font-black text-slate-700">{selectedPonto.variedade}</span></div>
              </div>
            </div>

            <div className="overflow-y-auto p-5 flex flex-col gap-6">
              <div className="flex justify-between items-center bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-sm">
                 <div className="flex flex-col items-center flex-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Perda</span>
                    <span className="text-[16px] font-black leading-none" style={{ color: LOCAL_RULES.Perda(selectedPonto.perda) }}>{formatVal(selectedPonto.perda, 2)}%</span>
                 </div>
                 <div className="w-px h-8 bg-slate-200" />
                 <div className="flex flex-col items-center flex-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Pisoteio</span>
                    <span className="text-[16px] font-black leading-none" style={{ color: selectedPonto.metaPis ? (selectedPonto.pisoteio <= selectedPonto.metaPis ? COLORS.dentro : COLORS.fora) : LOCAL_RULES.PisoteioSimples(selectedPonto.pisoteio) }}>{formatVal(selectedPonto.pisoteio)}%</span>
                 </div>
                 <div className="w-px h-8 bg-slate-200" />
                 <div className="flex flex-col items-center flex-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Arranquio</span>
                    <span className="text-[16px] font-black leading-none" style={{ color: LOCAL_RULES.Arranquio(selectedPonto.arranquio) }}>{formatVal(selectedPonto.arranquio, 2)}%</span>
                 </div>
              </div>

              <div className="flex flex-col">
                 <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3 text-center">
                   Categorias de Perdas (Kg)
                 </h3>
                 <div className="flex flex-col">
                    {selectedPonto.categorias.map((cat, idx) => (
                      <CategoryBar key={idx} label={cat.label} value={cat.val} maxVal={selectedPonto.maxCat} />
                    ))}
                 </div>
              </div>

              {/* Tabela de Informações com bordas mantidas */}
              <div className="bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 flex flex-col gap-2">
                {[
                  { label: 'TCH Estimado', val: `${formatVal(selectedPonto.tch)} t/ha` },
                  { label: 'Total de Perda', val: `${formatVal(selectedPonto.kg, 3)} Kg` },
                  { label: 'Pisoteio Avaliado', val: `${formatVal(selectedPonto.espM)} m` },
                  { label: 'Pisoteio Registrado', val: `${formatVal(selectedPonto.pisM)} m`, color: selectedPonto.pisM > 0 ? COLORS.fora : COLORS.dentro },
                  { label: 'Tocos Antes', val: `${formatVal(selectedPonto.tocosFixos, 0)} un` },
                  { label: 'Tocos Após', val: `${formatVal(selectedPonto.tocosPos, 0)} un` },
                  { label: 'Total Arrancado', val: `${formatVal(selectedPonto.tocosArr, 0)} un`, color: selectedPonto.tocosArr > 0 ? COLORS.fora : COLORS.dentro }
                ].map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center border-b border-slate-200 border-dashed pb-1.5">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{item.label}</span>
                    <span className="text-[12px] font-black text-slate-700" style={{ color: item.color }}>{item.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PerdasDetails;