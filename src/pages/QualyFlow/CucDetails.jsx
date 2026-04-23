import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

// Componentes Reutilizáveis
import QualyHeader from '../../components/QualyFlow/QualyHeader';
import Sidebar from '../../components/QualyFlow/Sidebar';
import DateSelector from '../../components/QualyFlow/DateSelector';

// Dados
import qualyflowMockData from '../../data/mockData.json';

const CucDetails = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [selectedLoteData, setSelectedLoteData] = useState(null);
  const navigate = useNavigate();

  // ===========================================================================
  // 1. GESTÃO DE DATAS
  // ===========================================================================
  const availableDates = useMemo(() => {
    const cucData = qualyflowMockData.filter(i => i.OCORRENCIA?.includes("CUC - Gotejo"));
    const dates = [...new Set(cucData.map(item => item.DATA_HORA.substring(0, 10)))];
    return dates.sort((a, b) => b.split('/').reverse().join('-').localeCompare(a.split('/').reverse().join('-')));
  }, []);

  const [dateIndex, setDateIndex] = useState(0);
  const selectedDate = availableDates[dateIndex] || "";

  // ===========================================================================
  // 2. PROCESSAMENTO DATA-READY (Histórico Completo por Ano/Extra1)
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
        
        // Conversão de Entupido (Absoluto) para Percentual [cite: 2026-02-11]
        const entupAbsoluto = Number(dfLote.find(i => i.INDICADOR === "Emissores Entupidos")?.VALOR || 0);
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
        extra1: visita, // Extração da Visita/Avaliação [cite: 2026-02-11]
        cucGeral: lotes.length ? lotes.reduce((a,b) => a+b.cuc,0) / lotes.length : 0,
        vazaoGeral: lotes.length ? lotes.reduce((a,b) => a+b.vazao,0) / lotes.length : 0,
        entupGeralPerc: lotes.length ? lotes.reduce((a,b) => a+b.entupPerc,0) / lotes.length : 0,
        lotes
      };
    });
  }, [selectedDate]);

  const [activeIdx, setActiveIdx] = useState(0);
  const activeCampo = camposCuc[activeIdx];

  // ===========================================================================
  // HELPERS VISUAIS E REGRAS DE CORES [cite: 2026-02-11]
  // ===========================================================================
  const getCucColor = (cuc) => {
    if (cuc >= 90) return 'text-green-500';
    if (cuc >= 80) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getVazaoColor = (v) => {
    if (v >= 0.9 && v <= 1.1) return 'text-green-500';
    return 'text-red-500';
  };

  const getEntupColor = (v) => {
    if (v > 10) return 'text-red-500';
    return 'text-green-500';
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
        {/* Cabeçalho Padrão */}
        <div className="w-full max-w-[340px] mb-4 border-b border-slate-200 pb-3 flex justify-between items-center">
          <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter">CUC - Gotejo</h1>
          <button onClick={() => navigate('/qualyflow')} className="text-xs font-black text-slate-400 hover:text-agro-green uppercase tracking-widest transition-colors">Voltar</button>
        </div>

        {/* Seletor de Data */}
        <div className="w-full max-w-[340px] mb-6">
          <DateSelector date={selectedDate} onPrev={() => setDateIndex(di => di + 1)} onNext={() => setDateIndex(di => di - 1)} disablePrev={dateIndex === availableDates.length - 1} disableNext={dateIndex === 0} />
        </div>

        {camposCuc.length > 0 && (
          <div className="w-full max-w-[340px] flex flex-col gap-6">
            
            {/* Lista de Campos - Formato Tabela [cite: 2026-02-11] */}
            <div className="flex flex-col gap-2">
              {camposCuc.map((campo, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIdx(i)}
                  className={`w-full flex justify-between items-center p-3 rounded-xl border transition-all ${
                    activeIdx === i ? 'border-agro-green bg-green-50/40 shadow-sm' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center">
                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Av.</span>
                      <span className={`text-sm font-black ${activeIdx === i ? 'text-agro-green' : 'text-slate-600'}`}>{campo.extra1}ª</span>
                    </div>
                    <div className="flex flex-col items-start w-16">
                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Campo</span>
                      <span className={`text-sm font-black uppercase truncate w-full text-left ${activeIdx === i ? 'text-agro-green' : 'text-slate-600'}`}>{campo.nome}</span>
                    </div>
                  </div>

                  <div className="flex gap-3 text-right">
                    <div className="flex flex-col items-center">
                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">CUC%</span>
                      <span className={`text-sm font-black ${getCucColor(campo.cucGeral)}`}>{campo.cucGeral.toFixed(1)}%</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Vazão</span>
                      <span className={`text-sm font-black ${getVazaoColor(campo.vazaoGeral)}`}>{campo.vazaoGeral.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Entup.</span>
                      <span className={`text-sm font-black ${getEntupColor(campo.entupGeralPerc)}`}>{campo.entupGeralPerc.toFixed(1)}%</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Boxes dos Lotes (3 por linha exatos) [cite: 2026-02-11] */}
            {activeCampo && (
              <div key={activeIdx} className="grid grid-cols-3 gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                {activeCampo.lotes.map((lote, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedLoteData({ campo: activeCampo.nome, extra1: activeCampo.extra1, ...lote })}
                    className="flex flex-col items-center p-2 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-white hover:border-agro-green/50 transition-all text-center relative overflow-hidden"
                  >
                    <span className="text-[8px] font-black text-slate-400 uppercase mb-1">Lote: {lote.nome}</span>
                    <span className="text-[7px] font-bold text-slate-400 uppercase mb-[1px]">CUC</span>
                    <span className={`text-xl font-black tracking-tighter mb-2 ${getCucColor(lote.cuc)}`}>{lote.cuc.toFixed(1)}%</span>
                    
                    <div className="w-full flex justify-between px-1 text-[8px] font-black text-slate-500 border-t border-slate-200/60 pt-1.5 uppercase">
                      <span className={getVazaoColor(lote.vazao)}>V: {lote.vazao.toFixed(2)}</span>
                      <span className={getEntupColor(lote.entupPerc)}>E: {lote.entupPerc.toFixed(0)}%</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL DOS EMISSORES (Clean) [cite: 2026-02-11] */}
      {selectedLoteData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-sm font-black text-slate-700 uppercase">{selectedLoteData.campo} - Lote: {selectedLoteData.nome}</h3>
              <button onClick={() => setSelectedLoteData(null)} className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-red-100 hover:text-red-500 transition-all font-black text-xs">X</button>
            </div>
            
            <div className="p-5">
              <div className="grid grid-cols-6 gap-2 mb-6">
                {selectedLoteData.emissores.map((em, i) => (
                  <div key={i} className={`w-full h-10 flex items-center justify-center rounded-lg text-xs font-black shadow-sm ${getEmitterColor(em.valor)}`}>
                    {em.valor}
                  </div>
                ))}
              </div>
              
              <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                 <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-400 uppercase">Resultado CUC</span>
                    <span className={`text-3xl font-black tracking-tighter leading-none mt-1 ${getCucColor(selectedLoteData.cuc)}`}>{selectedLoteData.cuc.toFixed(1)}%</span>
                 </div>
                 <div className="flex flex-col items-end text-right gap-1">
                    <div className="flex flex-col items-end">
                      <span className="text-[8px] font-black text-slate-400 uppercase">Vazão</span>
                      <span className={`text-sm font-black leading-none ${getVazaoColor(selectedLoteData.vazao)}`}>{selectedLoteData.vazao.toFixed(2)} L/h</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[8px] font-black text-slate-400 uppercase">Entupidos</span>
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