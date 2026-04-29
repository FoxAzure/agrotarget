import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Componentes Reutilizáveis
import HeaderAdubCob from '../../components/QualyFlow/HeaderAdubCob';
import Sidebar from '../../components/QualyFlow/Sidebar';
import DateSelector from '../../components/QualyFlow/DateSelector';

// Regras e Dados
import { QUALY_RULES, COLORS } from './rules';
import qualyflowMockData from '../../data/mockData.json';

const AdubCobDetails = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  const location = useLocation();
  const passedDate = location.state?.selectedDate;

  const toggleSection = (id) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ===========================================================================
  // 1. GESTÃO DE DATAS (Ocorrências de Cobertura)
  // ===========================================================================
  const OCORRENCIAS = ["Implemento 2 linhas - Cobertura", "Implemento 3 linhas - Cobertura"];

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

  // ===========================================================================
  // 2. MOTOR DE CÁLCULO
  // ===========================================================================
  const adubData = useMemo(() => {
    if (!selectedDate) return null;

    const dayData = qualyflowMockData.filter(i => 
      i.DATA_HORA?.startsWith(selectedDate) && OCORRENCIAS.includes(i.OCORRENCIA)
    );

    const groups = {};
    dayData.forEach(item => {
      // Usa ADUBADOR_COB (ou fallback data_hora) conforme estrutura do seu DB
      const idUnico = item.ADUBADOR_COB || item.DATA_HORA;
      const key = `${idUnico}|${item.CAMPO}|${item.LOTE}|${item.OCORRENCIA}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    const implementos = Object.entries(groups).map(([key, data]) => {
      const [idUnico, campo, lote, ocorrencia] = key.split('|');
      const tipo = ocorrencia.includes("3 linhas") ? 3 : 2;
      const doseTarget = Number(data.find(i => i.INDICADOR === "Dose 50 m")?.VALOR) || 0;

      // Ordem Fixa: Esquerdo -> Meio -> Direito
      const ordemLados = tipo === 3 ? ["Esquerdo", "Meio", "Direito"] : ["Esquerdo", "Direito"];
      
      const pontos = ordemLados.map(label => {
        const item = data.find(i => i.INDICADOR === label);
        const valor = item ? Number(item.VALOR) : 0;
        const variacao = doseTarget > 0 ? ((valor - doseTarget) / doseTarget) * 100 : 0;
        return { label, valor, variacao, color: QUALY_RULES.Adubacao.meta(variacao) };
      });

      const mediaVar = pontos.reduce((a, b) => a + b.variacao, 0) / pontos.length;

      return { id: key, nome: idUnico, campo, lote, tipo, doseTarget, pontos, mediaVar };
    });

    const fieldGroups = {};
    implementos.forEach(impl => {
      const k = `${impl.campo}|${impl.lote}`;
      if (!fieldGroups[k]) fieldGroups[k] = [];
      fieldGroups[k].push(impl.mediaVar);
    });

    const visaoGeral = Object.entries(fieldGroups).map(([key, vars]) => {
      const [campo, lote] = key.split('|');
      const media = vars.reduce((a, b) => a + b, 0) / vars.length;
      return { campo, lote, media, color: QUALY_RULES.Adubacao.meta(media) };
    }).sort((a, b) => a.lote.toString().localeCompare(b.lote.toString(), undefined, { numeric: true }));

    const varGeral = implementos.length > 0 ? implementos.reduce((a, b) => a + b.mediaVar, 0) / implementos.length : 0;

    return { implementos, visaoGeral, varGeral, totalPts: implementos.length };
  }, [selectedDate]);

  const formatSign = (v) => v > 0 ? '+' : '';

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24 text-slate-900">
      <HeaderAdubCob onMenuOpen={() => setSidebarOpen(true)} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={(p) => console.log(p)} />

      <main className="p-6 flex flex-col items-center gap-8">
        <div className="w-full max-w-[400px]">
          <DateSelector 
            date={selectedDate} 
            onPrev={() => setDateIndex(di => Math.min(di + 1, availableDates.length - 1))} 
            onNext={() => setDateIndex(di => Math.max(di - 1, 0))} 
            disablePrev={dateIndex === availableDates.length - 1} 
            disableNext={dateIndex === 0} 
          />
        </div>

        {adubData ? (
          <div className="w-full max-w-[400px] flex flex-col gap-8 animate-in fade-in duration-500">
            
            {/* CARDS DE TOPO */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center text-center">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Implementos</span>
                <span className="text-2xl font-black tracking-tighter text-slate-700 leading-none">{adubData.totalPts}</span>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center text-center">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Variação Média</span>
                <span className="text-2xl font-black tracking-tighter leading-none" style={{ color: QUALY_RULES.Adubacao.meta(adubData.varGeral) }}>
                  {formatSign(adubData.varGeral)}{adubData.varGeral.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* RESUMO POR LOTE */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2.5 mb-2.5">Resumo por Lote</h3>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="py-1.5 text-[9px] font-black text-slate-400 uppercase text-left">Campo</th>
                    <th className="py-1.5 text-[9px] font-black text-slate-400 uppercase text-left">Lote</th>
                    <th className="py-1.5 text-[9px] font-black text-slate-400 uppercase text-right">Var%</th>
                  </tr>
                </thead>
                <tbody>
                  {adubData.visaoGeral.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-50 border-dashed last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 text-[11px] font-black text-slate-700 uppercase">{item.campo}</td>
                      <td className="py-2.5 text-[11px] font-bold text-slate-500 uppercase">{item.lote}</td>
                      <td className="py-2.5 text-[12px] font-black text-right" style={{ color: item.color }}>
                        {formatSign(item.media)}{item.media.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* IMPLEMENTOS AVALIADOS */}
            <div className="flex flex-col gap-4">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-2">Implementos Avaliados</h3>
              {adubData.implementos.map((impl, idx) => {
                const isExp = expandedSections[impl.id];
                return (
                  <div key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-all">
                    <button onClick={() => toggleSection(impl.id)} className={`w-full p-5 flex justify-between items-center transition-colors ${isExp ? 'bg-slate-50/80 border-b border-slate-100' : 'hover:bg-slate-50/50'}`}>
                      <div className="flex flex-col items-start text-left">
                        <h4 className="text-[14px] font-black text-slate-800 uppercase leading-none mb-2.5 truncate max-w-[180px]">{impl.nome}</h4>
                        <div className="flex gap-2.5">
                           <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-black rounded uppercase tracking-wider">{impl.campo}</span>
                           <span className="px-2.5 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded uppercase tracking-wider">{impl.tipo}L</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-5">
                        <div className="flex flex-col items-end leading-none">
                          <span className="text-xl font-black tracking-tighter" style={{ color: QUALY_RULES.Adubacao.meta(impl.mediaVar) }}>
                            {formatSign(impl.mediaVar)}{impl.mediaVar.toFixed(1)}%
                          </span>
                        </div>
                        <span className={`text-slate-300 text-[14px] transition-transform duration-300 ${isExp ? 'rotate-180' : ''}`}>▼</span>
                      </div>
                    </button>
                    <div className={`grid transition-all duration-300 ${isExp ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                      <div className="overflow-hidden">
                        <div className="p-6 bg-white border-t border-slate-50">
                           <div className="flex justify-between border-b border-slate-100 pb-3 mb-4 items-end">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dose Alvo (50m)</span>
                              <span className="text-[14px] font-black text-slate-700">{impl.doseTarget} Kg</span>
                           </div>
                           <div className="flex flex-col">
                             {impl.pontos.map((p, pIdx) => (
                               <div key={pIdx} className="flex justify-between items-center py-2.5 px-1 border-b border-slate-50 last:border-0">
                                 <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{p.label}</span>
                                 <div className="flex gap-5 items-center">
                                   <span className="text-[11px] font-black text-slate-600">{p.valor} Kg</span>
                                   <span className="text-[13px] font-black w-16 text-right" style={{ color: p.color }}>{formatSign(p.variacao)}{p.variacao.toFixed(1)}%</span>
                                 </div>
                               </div>
                             ))}
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        ) : (
          <div className="w-full max-w-[400px] text-center p-10 bg-white rounded-2xl border border-slate-200 border-dashed text-slate-400 font-bold text-xs uppercase tracking-widest mt-4">
            Aguardando dados...
          </div>
        )}
      </main>
    </div>
  );
};

export default AdubCobDetails;