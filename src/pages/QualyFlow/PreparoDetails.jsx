import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// Componentes Reutilizáveis
import HeaderPreparo from '../../components/QualyFlow/HeaderPreparo';
import Sidebar from '../../components/QualyFlow/Sidebar';
import DateSelector from '../../components/QualyFlow/DateSelector';

// Dados
import qualyflowMockData from '../../data/mockData.json';

// ===========================================================================
// COMPONENTE DE BARRA ANIMADA
// ===========================================================================
const AnimatedProgressBar = ({ value, color, max = 100 }) => {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const safeValue = Math.min(Math.max((value / max) * 100, 0), 100);
    const timer = setTimeout(() => setWidth(safeValue || 0), 150);
    return () => clearTimeout(timer);
  }, [value, max]);

  return (
    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1 shadow-inner">
      <div
        className="h-full rounded-full transition-all duration-[1000ms] ease-out"
        style={{
          width: `${width}%`,
          backgroundColor: color,
          boxShadow: width > 0 ? `0 0 8px ${color}80` : 'none'
        }}
      />
    </div>
  );
};

const PreparoDetails = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [modalData, setModalData] = useState(null); 
  const navigate = useNavigate();
  const location = useLocation(); 
  const passedDate = location.state?.selectedDate; 

  const PREPARO_OCCS = ["Profundidade do Adubo", "Profundidade da Cana", "Paralelismo", "Fita de Gotejo"];
  const IND_FITA_PAR = "Parelelismo Fita Gotejadora"; 
  const IND_FITA_PROF = "Profundidade Fita Gotejadora";

  // ===========================================================================
  // 1. GESTÃO DE DATAS
  // ===========================================================================
  const availableDates = useMemo(() => {
    const data = qualyflowMockData.filter(i => PREPARO_OCCS.includes(i.OCORRENCIA));
    const dates = [...new Set(data.map(item => item.DATA_HORA.substring(0, 10)))];
    return dates.sort((a, b) => b.split('/').reverse().join('-').localeCompare(a.split('/').reverse().join('-')));
  }, []);

  const [dateIndex, setDateIndex] = useState(() => {
    if (passedDate && availableDates.includes(passedDate)) {
      return availableDates.indexOf(passedDate);
    }
    return 0; 
  });

  const selectedDate = availableDates[dateIndex] || "";

  // ===========================================================================
  // 2. FILTROS DE CAMPO/LOTE
  // ===========================================================================
  const rawDayData = useMemo(() => {
    if (!selectedDate) return [];
    return qualyflowMockData.filter(i => i.DATA_HORA.startsWith(selectedDate) && PREPARO_OCCS.includes(i.OCORRENCIA));
  }, [selectedDate]);

  const availableFilters = useMemo(() => {
    const pairs = [...new Set(rawDayData.filter(i => i.CAMPO && i.LOTE).map(i => `${i.CAMPO}|${i.LOTE}`))];
    return pairs.sort();
  }, [rawDayData]);

  const [activeFilters, setActiveFilters] = useState([]);

  useEffect(() => {
    setActiveFilters(availableFilters);
    setModalData(null); 
  }, [availableFilters, selectedDate]);

  const toggleFilter = (filterKey) => {
    setActiveFilters(prev => prev.includes(filterKey) ? prev.filter(f => f !== filterKey) : [...prev, filterKey]);
  };

  const selectAll = () => setActiveFilters(availableFilters);
  const clearAll = () => setActiveFilters([]);

  // ===========================================================================
  // 3. MOTOR DE CÁLCULO 
  // ===========================================================================
  const stats = useMemo(() => {
    const dataToProcess = rawDayData.filter(i => activeFilters.includes(`${i.CAMPO}|${i.LOTE}`));

    const groupedByLote = {};
    dataToProcess.forEach(item => {
      const key = `${item.CAMPO}|${item.LOTE}`;
      if (!groupedByLote[key]) groupedByLote[key] = { campo: item.CAMPO, lote: item.LOTE, items: [] };
      groupedByLote[key].items.push(item);
    });

    const calculateIndicator = (ocorr, indic, minVal, maxVal = null, ignoreZero = false) => {
      let totalPadroes = 0;
      let totalAvaliados = 0;
      let sum = 0;
      const lotesData = [];

      Object.values(groupedByLote).forEach(group => {
        let items = group.items.filter(i => i.OCORRENCIA === ocorr && i.INDICADOR === indic);
        if (ignoreZero) items = items.filter(i => Number(i.VALOR) !== 0);

        const valores = items.map(i => Number(i.VALOR)).filter(v => !isNaN(v));
        if (valores.length === 0) return;

        let padroes = 0;
        valores.forEach(v => {
          sum += v;
          let isOk = false;
          if (minVal !== null && maxVal !== null) {
            isOk = v >= minVal && v <= maxVal;
          } else if (minVal !== null) {
            isOk = v >= minVal;
          }
          if (isOk) padroes++;
        });

        totalPadroes += padroes;
        totalAvaliados += valores.length;

        lotesData.push({
          campo: group.campo,
          lote: group.lote,
          valores,
          minVal,
          maxVal
        });
      });

      return {
        perc: totalAvaliados > 0 ? (totalPadroes / totalAvaliados) * 100 : null,
        avg: totalAvaliados > 0 ? sum / totalAvaliados : null,
        avaliados: totalAvaliados,
        lotes: lotesData.sort((a,b) => 
          String(a.campo).localeCompare(String(b.campo), undefined, { numeric: true }) || 
          String(a.lote).localeCompare(String(b.lote), undefined, { numeric: true })
        ),
        titleTarget: maxVal ? `Entre ${minVal} e ${maxVal}` : `Mínimo ${minVal}`
      };
    };

    const calcDiffFitaCana = () => {
      let totalDiffSum = 0;
      let totalLotesAvaliados = 0;
      const lotesData = [];

      Object.values(groupedByLote).forEach(group => {
        const fitas = group.items.filter(i => i.OCORRENCIA === "Fita de Gotejo" && i.INDICADOR === IND_FITA_PROF).map(i => Number(i.VALOR)).filter(v => !isNaN(v));
        const canas = group.items.filter(i => i.OCORRENCIA === "Profundidade da Cana" && i.INDICADOR === "Profundidade da Cana").map(i => Number(i.VALOR)).filter(v => !isNaN(v));

        const lenFita = fitas.length;
        const lenCana = canas.length;
        
        if (lenFita === 0 || lenCana === 0) return;

        const avgFitaLote = fitas.reduce((a, b) => a + b, 0) / lenFita;
        const avgCanaLote = canas.reduce((a, b) => a + b, 0) / lenCana;
        const diffLote = avgFitaLote - avgCanaLote;

        totalDiffSum += diffLote;
        totalLotesAvaliados++;

        lotesData.push({
          campo: group.campo,
          lote: group.lote,
          avgFita: avgFitaLote,
          avgCana: avgCanaLote,
          diff: diffLote,
          isDiffCard: true 
        });
      });

      const avgGeralDiff = totalLotesAvaliados > 0 ? totalDiffSum / totalLotesAvaliados : null;

      return {
        isDiffCard: true,
        avg: avgGeralDiff, 
        perc: avgGeralDiff, 
        avaliados: totalLotesAvaliados, 
        lotes: lotesData.sort((a,b) => 
          String(a.campo).localeCompare(String(b.campo), undefined, { numeric: true }) || 
          String(a.lote).localeCompare(String(b.lote), undefined, { numeric: true })
        ),
        titleTarget: "Em cm" 
      };
    };

    return {
      haste: calculateIndicator("Profundidade do Adubo", "Profundidade", 23, null),
      cana: calculateIndicator("Profundidade da Cana", "Profundidade da Cana", 18, null),
      paralelismo: calculateIndicator("Paralelismo", "Paralelismo", 1.45, 1.55),
      fitaProf: calculateIndicator("Fita de Gotejo", IND_FITA_PROF, 18, null),
      fitaPar: calculateIndicator("Fita de Gotejo", IND_FITA_PAR, 2.15, 2.25, true),
      diffFitaCana: calcDiffFitaCana() 
    };

  }, [rawDayData, activeFilters]);

  // ===========================================================================
  // HELPERS VISUAIS E MODAL
  // ===========================================================================
  const getStatusColor = (perc) => {
    if (perc === null) return '#94a3b8'; 
    if (perc >= 90) return '#22c55e'; 
    if (perc >= 80) return '#eab308'; 
    return '#ef4444'; 
  };

  const getDiffStatusColor = (diff) => {
    if (diff === null) return '#94a3b8';
    if (diff >= 0) return '#22c55e'; 
    return '#ef4444'; 
  }

  const formatPerc = (val) => val !== null ? `${val.toFixed(1)}%` : '-';
  const formatAvg = (val) => val !== null ? val.toFixed(2) : '-';

  const KpiCard = ({ title, data }) => {
    const isDiff = data.isDiffCard;
    const valueText = isDiff 
      ? (data.avg !== null ? `${data.avg > 0 ? '+' : ''}${data.avg.toFixed(1)} cm` : '-') 
      : formatPerc(data.perc);
    
    const color = isDiff ? getDiffStatusColor(data.avg) : getStatusColor(data.perc);

    return (
      <button 
        onClick={() => setModalData({ title, data })} 
        disabled={!data.avaliados}
        className={`bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between text-left transition-all duration-300 ${data.avaliados ? 'hover:border-agro-green/50 hover:shadow-md cursor-pointer active:scale-95' : 'opacity-60 cursor-not-allowed'}`}
      >
        <div className="flex justify-between items-start mb-3">
          <span className="text-[11px] font-black text-slate-500 uppercase tracking-tight leading-tight w-2/3">{title}</span>
          <span className="text-[10px] font-bold text-slate-400 text-right bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">{data.titleTarget}</span>
        </div>
        <div className="w-full">
          <div className="flex justify-between items-end w-full mb-1.5">
            <span className="text-2xl font-black tracking-tighter leading-none" style={{ color: color }}>
              {valueText}
            </span>
            {data.avaliados > 0 && (
              <span className="text-[10px] font-black text-slate-400 uppercase mb-0.5">Av: {data.avaliados}</span>
            )}
          </div>
          {!isDiff && <AnimatedProgressBar value={data.perc} color={color} />}
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20 text-slate-900">
      <HeaderPreparo onMenuOpen={() => setSidebarOpen(true)} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={(p) => console.log(p)} />

      <main className="p-4 flex flex-col items-center">
        
        {/* Seletor Ajustado para 400px */}
        <div className="w-full max-w-[400px] mb-5 mt-2">
          <DateSelector 
            date={selectedDate} 
            onPrev={() => setDateIndex(di => di + 1)} 
            onNext={() => setDateIndex(di => di - 1)} 
            disablePrev={dateIndex === availableDates.length - 1} 
            disableNext={dateIndex === 0} 
          />
        </div>

        {availableFilters.length > 0 && (
          <div className="w-full max-w-[400px] mb-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm animate-in slide-in-from-top-2">
            <div className="flex justify-between items-center mb-3 pb-2.5 border-b border-slate-100">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Lotes Avaliados</span>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-[10px] font-bold text-agro-green hover:underline uppercase tracking-wider">Todos</button>
                <span className="text-slate-300">|</span>
                <button onClick={clearAll} className="text-[10px] font-bold text-red-400 hover:underline uppercase tracking-wider">Limpar</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar pr-1">
              {availableFilters.map(filterKey => {
                const [campo, lote] = filterKey.split('|');
                const isActive = activeFilters.includes(filterKey);
                return (
                  <button
                    key={filterKey}
                    onClick={() => toggleFilter(filterKey)}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all border ${
                      isActive ? 'bg-agro-green/10 text-agro-green border-agro-green/30 shadow-sm' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {campo} - L{lote}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="w-full max-w-[400px] flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            
            {/* Grade de KPIs Ajustada para o padrão */}
            <div className="grid grid-cols-2 gap-3">
              <KpiCard title="Profund. Haste" data={stats.haste} />
              <KpiCard title="Profund. Cana" data={stats.cana} />
              <KpiCard title="Paralelismo Sulcos" data={stats.paralelismo} />
              <KpiCard title="Profund. Fita" data={stats.fitaProf} />
              <KpiCard title="Paralelismo Fita" data={stats.fitaPar} />
              <KpiCard title="Diferença Fita/Cana" data={stats.diffFitaCana} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm animate-in slide-in-from-bottom-4">
            <h3 className="text-[12px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2.5 mb-3.5">
              Médias Gerais
            </h3>
            <div className="flex flex-col gap-3">
              {[
                { label: 'Profundidade da Haste', avg: stats.haste.avg, unit: 'cm', color: stats.haste.avg !== null ? (stats.haste.avg >= 23 ? '#22c55e' : '#ef4444') : '#94a3b8' },
                { label: 'Profundidade da Cana', avg: stats.cana.avg, unit: 'cm', color: stats.cana.avg !== null ? (stats.cana.avg >= 18 ? '#22c55e' : '#ef4444') : '#94a3b8' },
                { label: 'Paralelismo de Sulcos', avg: stats.paralelismo.avg, unit: 'm', color: stats.paralelismo.avg !== null ? (stats.paralelismo.avg >= 1.45 && stats.paralelismo.avg <= 1.55 ? '#22c55e' : '#ef4444') : '#94a3b8' },
                { label: 'Profundidade da Fita', avg: stats.fitaProf.avg, unit: 'cm', color: stats.fitaProf.avg !== null ? (stats.fitaProf.avg >= 18 ? '#22c55e' : '#ef4444') : '#94a3b8' },
                { label: 'Paralelismo da Fita', avg: stats.fitaPar.avg, unit: 'm', color: stats.fitaPar.avg !== null ? (stats.fitaPar.avg >= 2.15 && stats.fitaPar.avg <= 2.25 ? '#22c55e' : '#ef4444') : '#94a3b8' },
                { label: 'Diferença Média (Fita - Cana)', avg: stats.diffFitaCana.avg, unit: 'cm', color: stats.diffFitaCana.avg !== null ? (stats.diffFitaCana.avg >= 0 ? '#22c55e' : '#ef4444') : '#94a3b8' },
              ].map((row, idx) => (
                <div key={idx} className="flex justify-between items-end border-b border-slate-50 border-dashed pb-2 last:border-0 last:pb-0">
                  <span className="text-[12px] font-bold text-slate-600 uppercase">{row.label}</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[15px] font-black" style={{ color: row.color }}>{formatAvg(row.avg)}</span>
                    <span className="text-[10px] font-bold text-slate-400 lowercase">{row.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Modal - Intacto conforme solicitado */}
      {modalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm max-h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex justify-between items-start gap-4">
              <div className="flex flex-col">
                <h3 className="text-sm font-black text-slate-800 uppercase leading-tight">{modalData.title}</h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                  {modalData.data.isDiffCard ? 'Médias e Diferença em cm' : modalData.data.titleTarget}
                </span>
              </div>
              <button onClick={() => setModalData(null)} className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-red-100 hover:text-red-500 transition-all font-black text-xs">X</button>
            </div>
            
            <div className="p-5 overflow-y-auto custom-scrollbar">
              {!modalData.data.isDiffCard && modalData.data.lotes.map((lote, lIdx) => {
                const isParalelismo = modalData.title.toLowerCase().includes('paralelismo');
                return (
                  <div key={lIdx} className="mb-6 last:mb-0">
                    <h4 className="text-[11px] font-black text-slate-600 uppercase tracking-widest mb-2 border-b border-slate-100 pb-1">{lote.campo} - Lote {lote.lote}</h4>
                    <div className="grid grid-cols-6 gap-2">
                      {lote.valores.map((v, vIdx) => {
                        let colorClass = '';
                        if (lote.minVal !== null && lote.maxVal !== null) {
                          colorClass = (v >= lote.minVal && v <= lote.maxVal) ? 'bg-green-500 text-white' : 'bg-red-500 text-white';
                        } else if (lote.minVal !== null) {
                          colorClass = v >= lote.minVal ? 'bg-green-500 text-white' : 'bg-red-500 text-white';
                        } else { colorClass = 'bg-slate-200 text-slate-700'; }

                        const displayValue = isParalelismo ? v.toFixed(2) : (Number.isInteger(v) ? v : v.toFixed(1));

                        return (
                          <div key={vIdx} className={`w-full h-8 flex items-center justify-center rounded-md text-[10px] font-black shadow-sm ${colorClass}`}>
                            {displayValue}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {modalData.data.isDiffCard && modalData.data.lotes.map((lote, lIdx) => {
                const difColor = getDiffStatusColor(lote.diff);
                const difText = lote.diff > 0 ? `+${lote.diff.toFixed(1)} cm` : `${lote.diff.toFixed(1)} cm`;
                const maxBarValue = 50; 
                return (
                  <div key={lIdx} className="mb-8 last:mb-0">
                     <h4 className="text-[11px] font-black text-slate-600 uppercase tracking-widest mb-3 border-b border-slate-100 pb-1">
                       {lote.campo} - Lote {lote.lote}
                     </h4>
                     <div className="relative flex flex-col gap-2 px-2">
                        <div className="flex flex-col gap-0.5">
                           <div className="flex justify-between items-end">
                             <span className="text-[10px] font-bold text-slate-400 uppercase">Média Fita</span>
                             <span className="text-[10px] font-black text-slate-700">{lote.avgFita.toFixed(1)} cm</span>
                           </div>
                           <AnimatedProgressBar value={lote.avgFita} color="#94a3b8" max={maxBarValue} /> 
                        </div>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
                           <div className="bg-white px-2 py-0.5 rounded-t-md border-x border-t border-slate-200 text-[8px] font-black text-slate-400 uppercase tracking-widest">DIF</div>
                           <div className="px-3 py-1.5 rounded-xl shadow-md text-xs font-black text-white border-2 border-white" style={{ backgroundColor: difColor }}>{difText}</div>
                        </div>
                        <div className="flex flex-col gap-0.5 mt-2">
                           <div className="flex justify-between items-end">
                             <span className="text-[10px] font-bold text-slate-400 uppercase">Média Cana</span>
                             <span className="text-[10px] font-black text-slate-700">{lote.avgCana.toFixed(1)} cm</span>
                           </div>
                           <AnimatedProgressBar value={lote.avgCana} color="#cbd5e1" max={maxBarValue} /> 
                        </div>
                     </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreparoDetails;