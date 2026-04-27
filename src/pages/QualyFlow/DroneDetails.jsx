import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// Componentes Reutilizáveis
import HeaderDrone from '../../components/QualyFlow/HeaderDrone';
import Sidebar from '../../components/QualyFlow/Sidebar';
import DateSelector from '../../components/QualyFlow/DateSelector';

// Dados
import qualyflowMockData from '../../data/mockData.json';

const DroneDetails = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  const navigate = useNavigate();
  const location = useLocation();
  const passedDate = location.state?.selectedDate;

  const toggleSection = (id) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ===========================================================================
  // 1. GESTÃO DE DATAS
  // ===========================================================================
  const availableDates = useMemo(() => {
    const data = qualyflowMockData.filter(i => i.OCORRENCIA === "Avaliação Drone");
    const dates = [...new Set(data.map(item => item.DATA_HORA.substring(0, 10)))];
    return dates.sort((a, b) => b.split('/').reverse().join('-').localeCompare(a.split('/').reverse().join('-')));
  }, []);

  const [dateIndex, setDateIndex] = useState(() => {
    if (passedDate && availableDates.includes(passedDate)) return availableDates.indexOf(passedDate);
    return 0;
  });

  const selectedDate = availableDates[dateIndex] || "";

  // ===========================================================================
  // 2. MOTOR DE CÁLCULO
  // ===========================================================================
  const dronesData = useMemo(() => {
    if (!selectedDate) return [];
    const dayData = qualyflowMockData.filter(i => i.DATA_HORA.startsWith(selectedDate) && i.OCORRENCIA === "Avaliação Drone");
    const droneNames = [...new Set(dayData.map(i => i.DRONES).filter(Boolean))];

    return droneNames.map(drone => {
      const dData = dayData.filter(i => i.DRONES === drone);
      const vazoes = dData.filter(i => i.INDICADOR === "Vazão Recomendada").map(i => Number(i.VALOR)).filter(v => !isNaN(v));
      const vazaoRec = vazoes.length ? vazoes.reduce((a, b) => a + b, 0) / vazoes.length : 0;

      const calcColeta = (num) => {
        const coletas = dData.filter(i => i.INDICADOR === `${num}ª Coleta`).map(i => Number(i.VALOR)).filter(v => !isNaN(v));
        const media = coletas.length ? coletas.reduce((a, b) => a + b, 0) / coletas.length : 0;
        const varPerc = (vazaoRec > 0 && media > 0) ? ((media - vazaoRec) / vazaoRec) * 100 : 0;
        return { num, media, varPerc };
      };

      const coletas = [calcColeta(1), calcColeta(2), calcColeta(3), calcColeta(4)];
      const validColetas = coletas.filter(c => c.media > 0);
      const varGeral = validColetas.length ? validColetas.reduce((a, b) => a + b.varPerc, 0) / validColetas.length : 0;

      return { nome: drone, vazaoRec, coletas, varGeral };
    }).sort((a, b) => String(a.nome).localeCompare(String(b.nome), undefined, { numeric: true }));
  }, [selectedDate]);

  const mediaGeralFrota = useMemo(() => {
    if (dronesData.length === 0) return 0;
    return dronesData.reduce((acc, curr) => acc + curr.varGeral, 0) / dronesData.length;
  }, [dronesData]);

  // ===========================================================================
  // HELPERS VISUAIS
  // ===========================================================================
  const getDeviationColor = (variation) => {
    const abs = Math.abs(variation);
    if (abs <= 10) return '#22c55e'; // Agro-Green
    if (abs <= 15) return '#eab308'; // Warning Yellow
    return '#ef4444'; // Danger Red
  };

  const formatSign = (val) => val > 0 ? '+' : '';
  const colorGeralFrota = getDeviationColor(mediaGeralFrota);

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20 text-slate-900">
      <HeaderDrone onMenuOpen={() => setSidebarOpen(true)} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={(p) => console.log(p)} />

      <main className="p-4 flex flex-col items-center">
        
        {/* Seletor Ajustado para 400px */}
        <div className="w-full max-w-[400px] mb-5">
          <DateSelector 
            date={selectedDate} 
            onPrev={() => setDateIndex(di => Math.min(di + 1, availableDates.length - 1))} 
            onNext={() => setDateIndex(di => Math.max(di - 1, 0))} 
            disablePrev={dateIndex === availableDates.length - 1} 
            disableNext={dateIndex === 0} 
          />
        </div>

        {/* MENSAGEM QUANDO VAZIO */}
        {dronesData.length === 0 && (
          <div className="w-full max-w-[400px] text-center p-8 bg-white rounded-xl border border-slate-200 border-dashed text-slate-400 font-bold text-xs uppercase tracking-widest mt-4">
            Nenhum drone avaliado nesta data
          </div>
        )}

        <div className="w-full max-w-[400px] flex flex-col gap-6 animate-in fade-in duration-500">
          
          {/* 1. RESUMO DA FROTA */}
          {dronesData.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col shadow-sm">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Avaliados</span>
                <span className="text-2xl font-black tracking-tighter text-slate-700">
                  {dronesData.length} <span className="text-[9px] font-bold text-slate-300 uppercase">Drones</span>
                </span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col shadow-sm">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Desvio Geral</span>
                <span className="text-2xl font-black tracking-tighter" style={{ color: colorGeralFrota }}>
                  {formatSign(mediaGeralFrota)}{mediaGeralFrota.toFixed(1)}%
                </span>
              </div>
            </div>
          )}

          {/* 2. LISTAGEM ACORDEÃO DOS DRONES */}
          {dronesData.length > 0 && (
            <div className="flex flex-col gap-3.5">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-2">Monitoramento por Unidade</h3>
              
              <div className="flex flex-col gap-2">
                {dronesData.map((drone, idx) => {
                  const isExpanded = expandedSections[drone.nome];
                  const geralColor = getDeviationColor(drone.varGeral);

                  return (
                    <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                      
                      <button 
                        onClick={() => toggleSection(drone.nome)}
                        className={`w-full p-4 flex justify-between items-center transition-colors z-10 ${
                          isExpanded ? 'bg-slate-50/80 border-b border-slate-100' : 'bg-white hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="flex flex-col items-start text-left">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Equipamento</span>
                          <h4 className="text-[13px] font-black text-slate-800 uppercase leading-none mb-1">{drone.nome}</h4>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col items-end leading-none">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Desvio</span>
                            <span className="text-lg font-black tracking-tighter" style={{ color: geralColor }}>
                              {formatSign(drone.varGeral)}{drone.varGeral.toFixed(1)}%
                            </span>
                          </div>
                          <span className={`text-slate-300 text-[12px] transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                        </div>
                      </button>

                      {/* Tabela Interna com Animação Fluida via Grid */}
                      <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                        <div className="overflow-hidden">
                          <div className="p-4 bg-white">
                            <div className="flex justify-between items-end border-b border-slate-100 pb-2 mb-3">
                               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Vazão Recomendada</span>
                               <div className="flex items-baseline gap-1">
                                  <span className="text-lg font-black text-slate-800 leading-none">{drone.vazaoRec.toFixed(2)}</span>
                                  <span className="text-[9px] font-bold text-slate-400">L/min</span>
                               </div>
                            </div>

                            <table className="w-full border-collapse">
                              <thead className="bg-slate-50 border-y border-slate-100">
                                <tr>
                                  <th className="py-2 px-4 text-[9px] font-black text-slate-400 uppercase text-left">Coleta</th>
                                  <th className="py-2 px-4 text-[9px] font-black text-slate-400 uppercase text-center">Vazão (L/min)</th>
                                  <th className="py-2 px-4 text-[9px] font-black text-slate-400 uppercase text-right">Desvio</th>
                                </tr>
                              </thead>
                              <tbody>
                                {drone.coletas.map((coleta, cIdx) => {
                                  const bicoColor = getDeviationColor(coleta.varPerc);
                                  return (
                                    <tr key={cIdx} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                      <td className="py-3 px-4 text-[11px] font-bold text-slate-500">{coleta.num}ª</td>
                                      <td className="py-3 px-4 text-[12px] font-black text-center text-slate-700">{coleta.media.toFixed(2)}</td>
                                      <td className="py-3 px-4 text-[12px] font-black text-right" style={{ color: bicoColor }}>
                                        {formatSign(coleta.varPerc)}{coleta.varPerc.toFixed(1)}%
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                      
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default DroneDetails;