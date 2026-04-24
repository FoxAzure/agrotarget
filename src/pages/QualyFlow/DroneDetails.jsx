import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// Componentes Reutilizáveis
import HeaderDrone from '../../components/QualyFlow/HeaderDrone';
import Sidebar from '../../components/QualyFlow/Sidebar';
import DateSelector from '../../components/QualyFlow/DateSelector';

// Dados
import qualyflowMockData from '../../data/mockData.json';

// ===========================================================================
// COMPONENTE: GRÁFICO DE DESVIO ANIMADO (O Radar do Drone)
// ===========================================================================
const AnimatedDeviationBar = ({ variation, absoluteValue, color, maxScale = 25 }) => {
  const [animWidth, setAnimWidth] = useState(0);

  useEffect(() => {
    // Calcula a largura proporcional limitada a 100% da metade do gráfico
    const safeWidth = Math.min((Math.abs(variation) / maxScale) * 100, 100);
    const timer = setTimeout(() => setAnimWidth(safeWidth), 150);
    return () => clearTimeout(timer);
  }, [variation, maxScale]);

  const isNegative = variation < 0;
  const isZero = variation === 0;

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex-1 flex items-center relative h-5 bg-slate-100 rounded-md overflow-hidden shadow-inner border border-slate-200/60">
        
        {/* Eixo Central (Zero) */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-300 z-10 transform -translate-x-1/2" />

        {/* Lado Esquerdo (Variação Negativa) */}
        <div className="w-1/2 h-full flex justify-end">
          {isNegative && (
            <div
              className="h-full rounded-l-md transition-all duration-[1000ms] ease-out"
              style={{ width: `${animWidth}%`, backgroundColor: color }}
            />
          )}
        </div>

        {/* Lado Direito (Variação Positiva) */}
        <div className="w-1/2 h-full flex justify-start">
          {!isNegative && !isZero && (
            <div
              className="h-full rounded-r-md transition-all duration-[1000ms] ease-out"
              style={{ width: `${animWidth}%`, backgroundColor: color }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

const DroneDetails = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const passedDate = location.state?.selectedDate;

  // ===========================================================================
  // 1. GESTÃO DE DATAS
  // ===========================================================================
  const availableDates = useMemo(() => {
    const data = qualyflowMockData.filter(i => i.OCORRENCIA === "Avaliação Drone");
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
  // 2. MOTOR DE CÁLCULO E AGRUPAMENTO POR DRONE
  // ===========================================================================
  const dronesData = useMemo(() => {
    if (!selectedDate) return [];
    
    // Pega as avaliações do dia
    const dayData = qualyflowMockData.filter(i => i.DATA_HORA.startsWith(selectedDate) && i.OCORRENCIA === "Avaliação Drone");
    
    // Identifica quais Drones voaram hoje
    const droneNames = [...new Set(dayData.map(i => i.DRONES).filter(Boolean))];

    return droneNames.map(drone => {
      const dData = dayData.filter(i => i.DRONES === drone);

      // Vazão Recomendada (Média caso tenha mais de um registro do mesmo drone no dia)
      const vazoes = dData.filter(i => i.INDICADOR === "Vazão Recomendada").map(i => Number(i.VALOR)).filter(v => !isNaN(v));
      const vazaoRec = vazoes.length ? vazoes.reduce((a, b) => a + b, 0) / vazoes.length : 0;

      // Extrai os 4 bicos/coletas
      const calcColeta = (num) => {
        const coletas = dData.filter(i => i.INDICADOR === `${num}ª Coleta`).map(i => Number(i.VALOR)).filter(v => !isNaN(v));
        const media = coletas.length ? coletas.reduce((a, b) => a + b, 0) / coletas.length : 0;
        const varPerc = (vazaoRec > 0 && media > 0) ? ((media - vazaoRec) / vazaoRec) * 100 : 0;
        
        return { num, media, varPerc };
      };

      const coletas = [calcColeta(1), calcColeta(2), calcColeta(3), calcColeta(4)];
      
      // Variação Média Geral deste Drone
      const validColetas = coletas.filter(c => c.media > 0);
      const varGeral = validColetas.length ? validColetas.reduce((a, b) => a + b.varPerc, 0) / validColetas.length : 0;

      return {
        nome: drone,
        vazaoRec,
        coletas,
        varGeral
      };
    }).sort((a, b) => String(a.nome).localeCompare(String(b.nome), undefined, { numeric: true }));

  }, [selectedDate]);

  // Cálculos do Resumo da Frota
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
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      <HeaderDrone onMenuOpen={() => setSidebarOpen(true)} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={(p) => console.log(p)} />

      <main className="p-4 flex flex-col items-center">
        
        {/* Seletor de Data */}
        <div className="w-full max-w-[340px] mb-6 mt-2">
          <DateSelector 
            date={selectedDate} 
            onPrev={() => setDateIndex(di => di + 1)} 
            onNext={() => setDateIndex(di => di - 1)} 
            disablePrev={dateIndex === availableDates.length - 1} 
            disableNext={dateIndex === 0} 
          />
        </div>

        {/* MENSAGEM QUANDO VAZIO */}
        {dronesData.length === 0 && (
          <div className="w-full max-w-[340px] text-center p-8 bg-white rounded-xl border border-slate-200 border-dashed text-slate-400 font-bold text-xs uppercase tracking-widest">
            Nenhum drone avaliado
          </div>
        )}

        <div className="w-full max-w-[340px] flex flex-col gap-6">
          
          {/* 1. CARD MESTRE: RESUMO DA FROTA */}
          {dronesData.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in slide-in-from-top-4 duration-500 relative">
              {/* Fita Premium de Destaque */}
              
              <div className="p-5 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Visão Geral</span>
                     <h3 className="text-sm font-black text-slate-700 uppercase leading-none">Resumo</h3>
                  </div>
                  <div className="flex flex-col items-end">
                     <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Avaliados</span>
                     <span className="text-2xl font-black text-slate-700 leading-none">{dronesData.length}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 mt-1">
                   <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Desvio Médio Total</span>
                      <div className="flex items-baseline gap-1">
                         <span className="text-3xl font-black tracking-tighter leading-none" style={{ color: colorGeralFrota }}>
                           {formatSign(mediaGeralFrota)}{mediaGeralFrota.toFixed(2)}
                         </span>
                         <span className="text-sm font-bold opacity-50 uppercase" style={{ color: colorGeralFrota }}>%</span>
                      </div>
                   </div>
                   {/* Gráfico do Resumo Global */}
                   <AnimatedDeviationBar variation={mediaGeralFrota} color={colorGeralFrota} />
                </div>
              </div>
            </div>
          )}

          {/* 2. CARDS INDIVIDUAIS DOS DRONES */}
          {dronesData.map((drone, idx) => {
            const geralColor = getDeviationColor(drone.varGeral);
            
            return (
              <div key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                
                {/* Cabeçalho do Card */}
                <div className="bg-slate-50 border-b border-slate-100 p-4 flex justify-between items-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: geralColor }} />
                  
                  <div className="flex flex-col pl-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Drone</span>
                    <h3 className="text-sm font-black text-slate-700 uppercase leading-none">{drone.nome}</h3>
                  </div>
                  
                  <div className="flex flex-col items-end">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Variação %</span>
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-2xl font-black tracking-tighter leading-none" style={{ color: geralColor }}>
                        {formatSign(drone.varGeral)}{drone.varGeral.toFixed(2)}
                      </span>
                      <span className="text-[10px] font-bold opacity-50" style={{ color: geralColor }}>%</span>
                    </div>
                  </div>
                </div>

                {/* Corpo do Card */}
                <div className="p-4 flex flex-col gap-5">
                  
                  {/* Vazão Recomendada Info */}
                  <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                     <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Vazão Recomendada</span>
                     <div className="flex items-baseline gap-1">
                        <span className="text-lg font-black text-slate-800 leading-none">{drone.vazaoRec.toFixed(2)}</span>
                        <span className="text-[9px] font-bold text-slate-400">L</span>
                     </div>
                  </div>

                  {/* As 4 Coletas */}
                  <div className="flex flex-col gap-4">
                    {drone.coletas.map((coleta, cIdx) => {
                      const color = getDeviationColor(coleta.varPerc);
                      
                      return (
                        <div key={cIdx} className="flex flex-col gap-1.5">
                          
                          {/* Topo da linha: Rótulo e Valores */}
                          <div className="flex justify-between items-end">
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                              {coleta.num}ª Coleta
                            </span>
                            <div className="flex items-center gap-3">
                              {/* Valor Absoluto Coletado */}
                              <span className="text-[10px] font-bold text-slate-500">
                                {coleta.media.toFixed(2)} L
                              </span>
                              {/* Percentual */}
                              <span className="text-[11px] font-black w-10 text-right" style={{ color: color }}>
                                {formatSign(coleta.varPerc)}{coleta.varPerc.toFixed(2)}%
                              </span>
                            </div>
                          </div>

                          {/* Gráfico de Desvio */}
                          <AnimatedDeviationBar variation={coleta.varPerc} color={color} />
                          
                        </div>
                      );
                    })}
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default DroneDetails;