import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// Componentes Reutilizáveis
import QualyHeader from '../../components/QualyFlow/CucHeader';
import Sidebar from '../../components/QualyFlow/Sidebar';
import DateSelector from '../../components/QualyFlow/DateSelector';

// Dados
import qualyflowMockData from '../../data/mockData.json';

// ===========================================================================
// COMPONENTE DE BARRA ANIMADA
// ===========================================================================
const AnimatedProgressBar = ({ value, color }) => {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setWidth(value), 150);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-0.5 shadow-inner">
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

const CucDetails = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [selectedLoteData, setSelectedLoteData] = useState(null);
  const [chartTab, setChartTab] = useState('cuc');
  
  const navigate = useNavigate();
  const location = useLocation(); 
  const passedDate = location.state?.selectedDate; 

  // ===========================================================================
  // 1. GESTÃO DE DATAS
  // ===========================================================================
  const availableDates = useMemo(() => {
    const cucData = qualyflowMockData.filter(i => i.OCORRENCIA?.includes("CUC - Gotejo"));
    const dates = [...new Set(cucData.map(item => item.DATA_HORA.substring(0, 10)))];
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
  // RESET INTELIGENTE AO MUDAR DE DATA
  // ===========================================================================
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    setActiveIdx(0);
    setSelectedLoteData(null);
  }, [selectedDate]);

  // ===========================================================================
  // 2. PROCESSAMENTO DATA-READY (CALIBRAÇÃO FINA CORRIGIDA)
  // ===========================================================================
  const camposCuc = useMemo(() => {
    if (!selectedDate) return [];
    
    const evalNoDia = qualyflowMockData.filter(i => i.DATA_HORA.startsWith(selectedDate) && i.OCORRENCIA?.includes("CUC - Gotejo"));
    const activePairs = [...new Set(evalNoDia.map(i => `${i.CODIGO_CAMPO}|${i.EXTRA1}`))];
    const selectedYear = selectedDate.substring(6, 10);

    return activePairs.map(pair => {
      const [codigo, visita] = pair.split('|');
      
      const dfHistorico = qualyflowMockData.filter(i => 
        i.CODIGO_CAMPO === parseInt(codigo) && 
        i.EXTRA1 === parseInt(visita) &&
        i.DATA_HORA.includes(selectedYear) &&
        i.OCORRENCIA?.includes("CUC - Gotejo")
      );

      const emissoresLabels = Array.from({length: 12}, (_, i) => `${i+1}º Emissor`);

      // -------------------------------------------------------------
      // CÁLCULO GERAL DO CAMPO (Idêntico ao QualyFlowHome)
      // -------------------------------------------------------------
      const valuesCampo = dfHistorico.filter(i => emissoresLabels.includes(i.INDICADOR)).map(i => Number(i.VALOR) || 0);
      const nC = valuesCampo.length;
      const meanC = nC > 0 ? valuesCampo.reduce((a, b) => a + b, 0) / nC : 0;
      
      let cucGeral = 0;
      if (meanC > 0) {
        const s_absC = valuesCampo.reduce((acc, x) => acc + Math.abs(x - meanC), 0);
        cucGeral = (1 - (s_absC / (nC * meanC))) * 100;
      }
      
      const entupGeralAbs = dfHistorico.filter(i => i.INDICADOR === "Emissores Entupidos").reduce((a, b) => a + (Number(b.VALOR) || 0), 0);
      const entupGeralPerc = nC > 0 ? (entupGeralAbs / nC) * 100 : 0;
      const vazaoGeral = meanC * 0.02;

      // -------------------------------------------------------------
      // CÁLCULO POR LOTE (Com Correção do .reduce)
      // -------------------------------------------------------------
      const listaLotes = [...new Set(dfHistorico.map(i => i.LOTE).filter(Boolean))];
      const lotes = listaLotes.map(loteNome => {
        const dfLote = dfHistorico.filter(i => i.LOTE === loteNome);
        const valuesLote = dfLote.filter(i => emissoresLabels.includes(i.INDICADOR)).map(i => ({
          label: i.INDICADOR,
          valor: Number(i.VALOR) || 0
        }));

        const numericValues = valuesLote.map(v => v.valor);
        const nL = numericValues.length;
        const meanL = nL > 0 ? numericValues.reduce((a, b) => a + b, 0) / nL : 0;
        
        let cucLote = 0;
        if (meanL > 0) {
          const s_absL = numericValues.reduce((acc, x) => acc + Math.abs(x - meanL), 0);
          cucLote = (1 - (s_absL / (nL * meanL))) * 100;
        }
        
        // CORREÇÃO: Usando reduce para somar todos os entupidos daquele lote específico!
        const entupAbsoluto = dfLote.filter(i => i.INDICADOR === "Emissores Entupidos").reduce((a, b) => a + (Number(b.VALOR) || 0), 0);
        const entupPerc = nL > 0 ? (entupAbsoluto / nL) * 100 : 0;

        return {
          nome: loteNome,
          cuc: cucLote,
          vazao: meanL * 0.02,
          entupPerc: entupPerc,
          emissores: valuesLote
        };
      });

      lotes.sort((a, b) => a.nome.toString().localeCompare(b.nome.toString(), undefined, { numeric: true }));

      return {
        nome: dfHistorico[0]?.CAMPO || "CAMPO",
        extra1: visita,
        cucGeral: cucGeral, 
        vazaoGeral: vazaoGeral,
        entupGeralPerc: entupGeralPerc,
        lotes
      };
    });
  }, [selectedDate]);

  const activeCampo = camposCuc[activeIdx];

  // ===========================================================================
  // HELPERS VISUAIS E REGRAS DE CORES
  // ===========================================================================
  const getCucColor = (cuc) => {
    if (cuc >= 90) return 'text-green-600'; 
    if (cuc >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getVazaoColor = (v) => {
    if (v >= 0.9 && v <= 1.1) return 'text-green-600';
    return 'text-red-600';
  };

  const getEntupColor = (v) => {
    if (v > 10) return 'text-red-600';
    return 'text-slate-500';
  };

  const getLoteCardStyle = (cuc) => {
    if (cuc >= 90) return 'border-green-400 bg-green-100/60 hover:bg-green-200/60';
    if (cuc >= 80) return 'border-yellow-400 bg-yellow-100/60 hover:bg-yellow-200/60';
    return 'border-red-400 bg-red-100/60 hover:bg-red-200/60';
  };

  const getEmitterColor = (v) => {
    if (v >= 45 && v <= 55) return 'bg-green-500 text-white';
    if (v > 55 && v <= 60) return 'bg-yellow-400 text-slate-800';
    if (v > 60) return 'bg-blue-500 text-white';
    if (v >= 40 && v < 45) return 'bg-orange-500 text-white';
    return 'bg-red-500 text-white';
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      <QualyHeader onMenuOpen={() => setSidebarOpen(true)} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={(p) => console.log(p)} />

      <main className="p-4 flex flex-col items-center">

        {/* Seletor de Data - Ajustado para 400px */}
        <div className="w-full max-w-[400px] mb-6 mt-2">
          <DateSelector 
            date={selectedDate} 
            onPrev={() => setDateIndex(di => di + 1)} 
            onNext={() => setDateIndex(di => di - 1)} 
            disablePrev={dateIndex === availableDates.length - 1} 
            disableNext={dateIndex === 0}
            availableDates={availableDates}
            onSelectDate={(novaData) => {
              const idx = availableDates.indexOf(novaData);
              if (idx !== -1) setDateIndex(idx);
            }}
          />
        </div>

        {camposCuc.length > 0 && (
          /* Container Principal Ajustado para 400px */
          <div className="w-full max-w-[400px] flex flex-col gap-6">
            
            {/* Lista de Campos - Formato Tabela */}
            <div className="flex flex-col gap-3">
              {camposCuc.map((campo, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIdx(i)}
                  className={`w-full flex justify-between items-center p-4 rounded-xl border transition-all ${
                    activeIdx === i ? 'border-agro-green border-2 bg-green-50/80 shadow-md' : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Av.</span>
                      <span className={`text-sm font-black ${activeIdx === i ? 'text-agro-green' : 'text-slate-600'}`}>{campo.extra1}ª</span>
                    </div>
                    <div className="flex flex-col items-start w-28"> 
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Campo</span>
                      <span className={`text-sm font-black uppercase truncate w-full text-left ${activeIdx === i ? 'text-agro-green' : 'text-slate-600'}`}>{campo.nome}</span>
                    </div>
                  </div>

                  <div className="flex gap-4 text-right">
                    <div className="flex flex-col items-center">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">CUC%</span>
                      <span className={`text-sm font-black ${getCucColor(campo.cucGeral)}`}>{campo.cucGeral.toFixed(1)}%</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Vazão</span>
                      <span className={`text-sm font-black ${getVazaoColor(campo.vazaoGeral)}`}>{campo.vazaoGeral.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Entup.</span>
                      <span className={`text-sm font-black ${getEntupColor(campo.entupGeralPerc)}`}>{campo.entupGeralPerc.toFixed(1)}%</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Area de Lotes e Gráficos do Campo Ativo */}
            {activeCampo && (
              <div key={`detalhes-${activeIdx}`} className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                
                {/* 1. Boxes dos Lotes */}
                <div className="grid grid-cols-3 gap-3">
                  {activeCampo.lotes.map((lote, i) => (
                    <button
                      key={`lote-${i}`}
                      onClick={() => setSelectedLoteData({ campo: activeCampo.nome, extra1: activeCampo.extra1, ...lote })}
                      className={`flex flex-col items-center p-2.5 rounded-xl border transition-all text-center relative overflow-hidden shadow-sm ${getLoteCardStyle(lote.cuc)}`}
                    >
                      <span className="text-[9px] font-black text-slate-600 uppercase mb-1">Lote: {lote.nome}</span>
                      <span className={`text-xl font-black tracking-tighter mb-2 ${getCucColor(lote.cuc)}`}>{lote.cuc.toFixed(1)}%</span>
                      
                      <div className="w-full flex justify-between px-1 text-[9px] font-black border-t border-slate-300/40 pt-2 uppercase">
                        <span className={getVazaoColor(lote.vazao)}>{lote.vazao.toFixed(2)}L</span>
                        <span className={getEntupColor(lote.entupPerc)}>E. {lote.entupPerc.toFixed(1)}%</span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* 2. Gráfico Dinâmico por Lote com Abas */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-5">
                  
                  {/* Seletor de Abas */}
                  <div className="flex bg-slate-100 p-1.5 rounded-lg">
                    <button onClick={() => setChartTab('cuc')} className={`flex-1 text-[10px] font-black uppercase py-2 rounded-md transition-all ${chartTab === 'cuc' ? 'bg-white shadow-sm text-agro-green' : 'text-slate-400 hover:text-slate-500'}`}>CUC</button>
                    <button onClick={() => setChartTab('vazao')} className={`flex-1 text-[10px] font-black uppercase py-2 rounded-md transition-all ${chartTab === 'vazao' ? 'bg-white shadow-sm text-agro-green' : 'text-slate-400 hover:text-slate-500'}`}>Vazão</button>
                    <button onClick={() => setChartTab('entup')} className={`flex-1 text-[10px] font-black uppercase py-2 rounded-md transition-all ${chartTab === 'entup' ? 'bg-white shadow-sm text-agro-green' : 'text-slate-400 hover:text-slate-500'}`}>Entupidos</button>
                  </div>
                  
                  <div className="flex flex-col gap-3">
                    {(() => {
                      const maxVazao = Math.max(...activeCampo.lotes.map(l => l.vazao), 0.1);

                      return activeCampo.lotes.map((lote, idx) => {
                        let barValue, barWidth, barColor, barText;

                        if (chartTab === 'cuc') {
                          barValue = lote.cuc;
                          barWidth = lote.cuc; 
                          barText = `${lote.cuc.toFixed(1)}%`;
                          barColor = lote.cuc >= 90 ? '#22c55e' : lote.cuc >= 80 ? '#eab308' : '#ef4444'; 
                        } else if (chartTab === 'vazao') {
                          barValue = lote.vazao;
                          barWidth = (lote.vazao / maxVazao) * 100; 
                          barText = `${lote.vazao.toFixed(2)} L/h`;
                          barColor = (lote.vazao >= 0.9 && lote.vazao <= 1.1) ? '#22c55e' : '#ef4444'; 
                        } else {
                          barValue = lote.entupPerc;
                          barWidth = lote.entupPerc; 
                          barText = `${lote.entupPerc.toFixed(1)}%`;
                          barColor = lote.entupPerc > 10 ? '#ef4444' : '#94a3b8'; 
                        }

                        return (
                          <div key={`bar-${idx}`} className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-end">
                              <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider">
                                Lote {lote.nome}
                              </span>
                              <span className="text-[11px] font-black tracking-tighter" style={{ color: barColor }}>
                                {barText}
                              </span>
                            </div>
                            <AnimatedProgressBar value={barWidth} color={barColor} />
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL DOS EMISSORES BLINDADO CONTRA OVERFLOW */}
      {selectedLoteData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-[380px] rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Header ajustado com truncate e flex-shrink-0 no botão */}
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex justify-between items-center gap-3">
              <h3 className="text-sm font-black text-slate-700 uppercase truncate">
                {selectedLoteData.extra1}ª - {selectedLoteData.campo} - Lote: {selectedLoteData.nome}
              </h3>
              <button 
                onClick={() => setSelectedLoteData(null)} 
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-red-100 hover:text-red-500 transition-all font-black text-xs"
              >
                X
              </button>
            </div>
            
            {/* Espaçamento interno reduzido para acomodar a grid com segurança */}
            <div className="p-5">
              <div className="grid grid-cols-6 gap-1.5 mb-5">
                {selectedLoteData.emissores.map((em, i) => (
                  <div key={i} className={`w-full h-11 flex items-center justify-center rounded-lg text-xs font-black shadow-sm ${getEmitterColor(em.valor)}`}>
                    {em.valor}
                  </div>
                ))}
              </div>
              
              <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-sm">
                 <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase">CUC %</span>
                    <span className={`text-3xl font-black tracking-tighter leading-none mt-1 ${getCucColor(selectedLoteData.cuc)}`}>{selectedLoteData.cuc.toFixed(1)}%</span>
                 </div>
                 <div className="flex flex-col items-end text-right gap-1.5">
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] font-black text-slate-400 uppercase">Vazão</span>
                      <span className={`text-sm font-black leading-none ${getVazaoColor(selectedLoteData.vazao)}`}>{selectedLoteData.vazao.toFixed(2)} L/h</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] font-black text-slate-400 uppercase">Entupidos</span>
                      <span className={`text-sm font-black leading-none ${getEntupColor(selectedLoteData.entupPerc)}`}>{selectedLoteData.entupPerc.toFixed(1)}%</span>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CucDetails;