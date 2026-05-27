import React, { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

// Componentes Reutilizáveis
import HeaderDrone from '../../components/QualyFlow/HeaderDrone'; 
import Sidebar from '../../components/QualyFlow/Sidebar';
import DateSelector from '../../components/QualyFlow/DateSelector';
import { QUALY_RULES } from './rules';

// Dados
import qualyflowMockData from '../../data/mockData.json';

const CompostoDetails = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  const location = useLocation();
  const passedDate = location.state?.selectedDate;

  const toggleSection = (id) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ===========================================================================
  // 1. GESTÃO DE DATAS
  // ===========================================================================
  const availableDates = useMemo(() => {
    const data = qualyflowMockData.filter(i => 
      i.OCORRENCIA && i.OCORRENCIA.trim().toLowerCase() === "controle composto"
    );
    const dates = [...new Set(data.map(item => item.DATA_HORA?.substring(0, 10)).filter(Boolean))];
    return dates.sort((a, b) => {
      const dateA = a.includes('/') ? a.split('/').reverse().join('-') : a;
      const dateB = b.includes('/') ? b.split('/').reverse().join('-') : b;
      return dateB.localeCompare(dateA);
    });
  }, []);

  const [dateIndex, setDateIndex] = useState(() => {
    if (passedDate && availableDates.includes(passedDate)) return availableDates.indexOf(passedDate);
    return 0;
  });

  const selectedDate = availableDates[dateIndex] || "";

  // ===========================================================================
  // 2. MOTOR DE CÁLCULO
  // ===========================================================================
  const compostoData = useMemo(() => {
    if (!selectedDate) return { resumo: { ton: 0, var: 0, totalPontos: 0 }, implementos: [], visaoGeral: [] };

    const dayData = qualyflowMockData.filter(i => 
      i.DATA_HORA?.startsWith(selectedDate) && 
      i.OCORRENCIA?.trim().toLowerCase() === "controle composto" &&
      i.INDICADOR?.trim().toLowerCase() === "toneladas por ha"
    );

    // --- AGRUPAMENTO 1: POR IMPLEMENTO (Para o Acordeão) ---
    const groups = {};
    dayData.forEach(item => {
      const key = `${item.IMPLEMENTO_COMPOSTO}|${item.CAMPO}|${item.LOTE}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    const implementosAgrupados = Object.entries(groups).map(([key, data]) => {
      const [nome, campo, lote] = key.split('|');
      
      const pontos = data.map((p, pIdx) => {
        const valor = Number(p.VALOR) || 0;
        const variacao = ((valor - 25.0) / 25.0) * 100;
        return { 
          ordem: `${pIdx + 1}º`, 
          valor, 
          variacao,
          tonColor: QUALY_RULES.Composto.ton(valor),
          varColor: QUALY_RULES.Composto.variacao(variacao)
        };
      });

      const mediaTon = pontos.reduce((acc, curr) => acc + curr.valor, 0) / pontos.length;
      const mediaVar = pontos.reduce((acc, curr) => acc + curr.variacao, 0) / pontos.length;

      return {
        id: key,
        nome,
        campo,
        lote,
        mediaTon,
        mediaVar,
        pontos,
        tonColor: QUALY_RULES.Composto.ton(mediaTon),
        varColor: QUALY_RULES.Composto.variacao(mediaVar)
      };
    });

    // --- AGRUPAMENTO 2: POR CAMPO E LOTE (A mágica que você pediu) ---
    const fieldGroups = {};
    dayData.forEach(item => {
      const key = `${item.CAMPO}|${item.LOTE}`;
      if (!fieldGroups[key]) fieldGroups[key] = [];
      fieldGroups[key].push(item);
    });

    const visaoGeralCampo = Object.entries(fieldGroups).map(([key, data]) => {
      const [campo, lote] = key.split('|');
      const valores = data.map(d => Number(d.VALOR) || 0);
      const mediaTon = valores.reduce((a, b) => a + b, 0) / valores.length;
      const mediaVar = ((mediaTon - 25.0) / 25.0) * 100;

      return {
        campo,
        lote,
        mediaTon,
        mediaVar,
        tonColor: QUALY_RULES.Composto.ton(mediaTon),
        varColor: QUALY_RULES.Composto.variacao(mediaVar)
      };
    });
    
    // Organiza a tabela numericamente
    visaoGeralCampo.sort((a, b) => a.lote.toString().localeCompare(b.lote.toString(), undefined, { numeric: true }));

    // --- TOTAIS ---
    const totalTon = implementosAgrupados.length > 0 
      ? implementosAgrupados.reduce((acc, curr) => acc + curr.mediaTon, 0) / implementosAgrupados.length 
      : 0;
    const totalVar = totalTon > 0 ? ((totalTon - 25.0) / 25.0) * 100 : 0;

    return {
      resumo: { 
        ton: totalTon, 
        var: totalVar,
        totalPontos: dayData.length,
        tonColor: QUALY_RULES.Composto.ton(totalTon),
        varColor: QUALY_RULES.Composto.variacao(totalVar)
      },
      implementos: implementosAgrupados,
      visaoGeral: visaoGeralCampo
    };
  }, [selectedDate]);

  const { resumo, implementos, visaoGeral } = compostoData;

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

            availableDates={availableDates}
            onSelectDate={(novaData) => {
              const idx = availableDates.indexOf(novaData);
              if (idx !== -1) setDateIndex(idx);
            }}
          />
        </div>

        <div className="w-full max-w-[400px] flex flex-col gap-6 animate-in fade-in duration-500">
          
          {/* RESUMO TRIPLO (Fontes e Paddings Melhorados) */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col shadow-sm">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Avaliado</span>
              <span className="text-2xl font-black tracking-tighter text-slate-700">
                {resumo.totalPontos} <span className="text-[9px] font-bold text-slate-300 uppercase">Ptos</span>
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col shadow-sm">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Média Dia</span>
              <span className="text-2xl font-black tracking-tighter" style={{ color: resumo.tonColor }}>
                {resumo.ton.toFixed(1)}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col shadow-sm">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Var. Geral</span>
              <span className="text-2xl font-black tracking-tighter" style={{ color: resumo.varColor }}>
                {resumo.var > 0 ? '+' : ''}{resumo.var.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* LISTAGEM POR IMPLEMENTO */}
          <div className="flex flex-col gap-3.5">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-2">Monitoramento por Implemento</h3>
            
            {implementos.map((impl) => {
              const isExpanded = expandedSections[impl.id];
              return (
                <div key={impl.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                  <button 
                    onClick={() => toggleSection(impl.id)}
                    className={`w-full p-4 flex justify-between items-center transition-colors relative z-10 ${isExpanded ? 'bg-slate-50/80 border-b border-slate-100' : 'bg-white hover:bg-slate-50/50'}`}
                  >
                    <div className="flex flex-col items-start text-left">
                      <h4 className="text-[13px] font-black text-slate-800 uppercase leading-none mb-2">{impl.nome}</h4>
                      <div className="flex gap-2">
                         <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-black rounded uppercase tracking-wider">{impl.campo}</span>
                         <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[9px] font-black rounded uppercase tracking-wider">L {impl.lote}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end leading-none">
                            <span className="text-lg font-black tracking-tighter" style={{ color: impl.tonColor }}>{impl.mediaTon.toFixed(2)}</span>
                            <span className="text-[10px] font-black tracking-tighter mt-1" style={{ color: impl.varColor }}>
                                {impl.mediaVar > 0 ? '+' : ''}{impl.mediaVar.toFixed(1)}%
                            </span>
                        </div>
                        <span className={`text-slate-300 text-[12px] transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                    </div>
                  </button>

                  {/* Animação Fluida via Grid */}
                  <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                      <table className="w-full border-collapse bg-white">
                        <thead className="bg-slate-50 border-b border-slate-100">
                          <tr>
                            <th className="py-2 px-4 text-[9px] font-black text-slate-400 uppercase text-left">Posição</th>
                            <th className="py-2 px-4 text-[9px] font-black text-slate-400 uppercase text-center">Ton/ha</th>
                            <th className="py-2 px-4 text-[9px] font-black text-slate-400 uppercase text-right">Var%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {impl.pontos.map((p, pIdx) => (
                            <tr key={pIdx} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                              <td className="py-2.5 px-4 text-[11px] font-bold text-slate-500">{p.ordem}</td>
                              <td className="py-2.5 px-4 text-[12px] font-black text-center" style={{ color: p.tonColor }}>{p.valor.toFixed(2)}</td>
                              <td className="py-2.5 px-4 text-[12px] font-black text-right" style={{ color: p.varColor }}>
                                {p.variacao > 0 ? '+' : ''}{p.variacao.toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* VISÃO GERAL DO CAMPO CORRIGIDA */}
          {visaoGeral.length > 0 && (
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm animate-in slide-in-from-bottom-4">
              <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2.5 mb-3.5">
                Visão Geral do Campo
              </h3>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-wider text-left">Campo</th>
                    <th className="py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-wider text-left">Lote</th>
                    <th className="py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-wider text-center">Ton/ha</th>
                    <th className="py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-wider text-right">Var%</th>
                  </tr>
                </thead>
                <tbody>
                  {visaoGeral.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-50 border-dashed last:border-0 transition-colors hover:bg-slate-50/80">
                      <td className="py-3 text-[11px] font-black text-slate-700 uppercase">{item.campo}</td>
                      <td className="py-3 text-[11px] font-bold text-slate-500 uppercase">{item.lote}</td>
                      <td className="py-3 text-[12px] font-black text-center" style={{ color: item.tonColor }}>{item.mediaTon.toFixed(2)}</td>
                      <td className="py-3 text-[12px] font-black text-right" style={{ color: item.varColor }}>
                        {item.mediaVar > 0 ? '+' : ''}{item.mediaVar.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default CompostoDetails;