import React, { useState, useMemo, useEffect } from 'react';
import coaMockData from '../../data/mockData_coa.json';

// Componentes de Interface
import COAOciosoHeader from '../../components/COACenter/COAOciosoHeader';
import COASidebar from '../../components/COACenter/COASidebar';
import COADateSelector from '../../components/COACenter/COADateSelector';

// Motor de Regras
import { 
  COA_RULES, 
  COA_COLORS,
  METAS, 
  parseTimeToHours, 
  formatDecimalToHHMM 
} from '../../pages/COACenter/coa_rules';

// Componente Interno: Barra de Progresso Suave
const ProgressBar = ({ label, percent, color, extraText }) => (
  <div className="flex flex-col gap-1 w-full">
    <div className="flex justify-between items-end leading-none">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      <div className="flex gap-2 items-baseline">
        {extraText && <span className="text-[9px] font-bold text-slate-500">{extraText}</span>}
        <span className="text-xs font-black" style={{ color }}>{Number(percent).toFixed(1)}%</span>
      </div>
    </div>
    <div className="w-full h-2 bg-[#0A0D14] rounded-full overflow-hidden border border-slate-700/80 shadow-inner">
      <div 
        className="h-full rounded-full transition-all duration-1000 ease-out" 
        style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}60` }} 
      />
    </div>
  </div>
);

// Sub-componente Modal Retrátil (Padrão COAEquipModal)
const OciosoModal = ({ data, onClose }) => {
  const [expandedGroups, setExpandedGroups] = useState({});

  if (!data) return null;

  const toggleGroup = (grp) => setExpandedGroups(prev => ({ ...prev, [grp]: !prev[grp] }));

  const sortedGroups = Object.entries(data.detalhe).sort((a, b) => b[1].ocioso - a[1].ocioso);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#06090F]/80 backdrop-blur-md transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-lg max-h-[90vh] bg-[#161B22] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="flex justify-between items-start p-5 border-b border-slate-700/80 bg-[#11151D] shrink-0">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-none mb-1">
              Equipamento - Analítico
            </span>
            <div className="flex items-baseline gap-2">
              <h2 className="text-xl font-black text-slate-100 uppercase tracking-tight leading-none">
                {data.id}
              </h2>
              <span className="text-xs font-bold text-slate-500 uppercase">
                {data.desc || 'SEM DESCRIÇÃO'}
              </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-[#1C2128] text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors font-bold text-lg"
          >
            ×
          </button>
        </div>

        {/* CORPO ROLÁVEL */}
        <div className="overflow-y-auto p-5 flex flex-col gap-6 custom-scrollbar">
          
          {/* CARDS DE RESUMO */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#11151D] p-3 rounded-xl border border-slate-700/50 flex flex-col">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Motor Ligado</span>
              <span className="text-lg font-black text-white leading-none">{formatDecimalToHHMM(data.motor)} <span className="text-xs text-slate-500">h</span></span>
            </div>
            <div className="bg-[#11151D] p-3 rounded-xl border border-slate-700/50 flex flex-col">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Motor Ocioso</span>
              <span className="text-lg font-black text-red-400 leading-none">{formatDecimalToHHMM(data.ocioso)} <span className="text-xs text-red-500/50">h</span></span>
            </div>
          </div>

          {/* BARRA DE PROGRESSO */}
          <div className="bg-[#11151D] p-4 rounded-xl border border-slate-700/50 shadow-md">
            <ProgressBar 
              label="Percentual Ocioso" 
              percent={data.perc} 
              color={COA_RULES.motorOcioso(data.perc)} 
            />
          </div>

          {/* ACORDEÃO DE OPERAÇÕES */}
          <div className="flex flex-col gap-2">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">
              Detalhamento por Grupo (Tempo Ocioso)
            </h3>
            {sortedGroups.map(([grpName, grpData]) => {
              const isProd = grpName === 'PRODUTIVO';
              const isOpen = expandedGroups[grpName];

              return (
                <div key={grpName} className="bg-[#11151D] rounded-xl border border-slate-700/50 overflow-hidden">
                  <button 
                    onClick={() => toggleGroup(grpName)}
                    className="w-full flex justify-between items-center p-3.5 hover:bg-[#1C2128] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] text-slate-500 transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                      <span className={`text-[11px] font-black uppercase ${isProd ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {grpName}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Ocioso</span>
                      <span className="text-xs font-black text-red-400">
                        {formatDecimalToHHMM(grpData.ocioso)} h
                      </span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="bg-[#0A0D14] p-3 border-t border-slate-800/80 flex flex-col gap-1.5">
                      {Object.entries(grpData.ops)
                        .sort(([, a], [, b]) => b.ocioso - a.ocioso)
                        .map(([opName, opVal], idx) => (
                          <div key={idx} className="flex justify-between items-center py-1.5 px-2 border-b border-slate-800/50 last:border-0 rounded hover:bg-[#161B22] transition-colors">
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${isProd ? 'text-emerald-500' : 'text-slate-500'}`}>
                              {opName}
                            </span>
                            <span className="text-[11px] font-black text-red-500/80">
                              {formatDecimalToHHMM(opVal.ocioso)} h
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
};

const MotorOcioso = () => {
  // --- ESTADOS DE CONTROLE ---
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [modalData, setModalData] = useState(null);
  const [searchEquip, setSearchEquip] = useState(""); 
  
  // Estados para controlar os botões retráteis
  const [expandedAreas, setExpandedAreas] = useState({});
  const [expandedFrentes, setExpandedFrentes] = useState({});

  // 1. Datas Disponíveis
  const availableDates = useMemo(() => {
    const dates = [...new Set(coaMockData.map(i => i.DATA?.substring(0, 10)).filter(Boolean))];
    return dates.sort((a, b) => b.localeCompare(a));
  }, []);

  if (!selectedDate && availableDates.length > 0) setSelectedDate(availableDates[0]);

  // Efeito matador: Fechar todas as áreas e frentes quando a data mudar
  useEffect(() => {
    setExpandedAreas({});
    setExpandedFrentes({});
  }, [selectedDate]);

  const toggleArea = (id) => setExpandedAreas(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleFrente = (id) => setExpandedFrentes(prev => ({ ...prev, [id]: !prev[id] }));

  // Adicione novas áreas que deseja ocultar neste array
  const AREAS_IGNORADAS = ["EMPACOTAMENTO"];

  // 2. Processamento dos Dados com a Engine V8
  const report = useMemo(() => {
    if (!selectedDate) return { resumo: {}, areas: [] };

    const raw = coaMockData.filter(i => i.DATA.startsWith(selectedDate));
    const areaMap = {};
    let globalOcioso = 0;
    let globalOps = 0;

    raw.forEach(item => {
      const area = (item.AREA_MAP || "NÃO MAPEADO").trim().toUpperCase();
      
      // Regra de Exclusão de Áreas
      if (AREAS_IGNORADAS.includes(area)) return;

      const frente = (item.GRUPO_EQUIP || "SEM FRENTE").toUpperCase().trim();
      const eqID = item.COD_EQUIP || "N/A";
      const estado = (item.ESTADO || "").toUpperCase().trim();
      const grupo = (item.DESC_GRUPO_OPERACAO || "INDETERMINADO").toUpperCase().trim();
      const operacao = (item.DESC_OPERACAO || "NÃO INFORMADA").toUpperCase().trim();

      const opsHrs = parseTimeToHours(item.HRS_OPERACIONAIS);
      const motorHrs = parseTimeToHours(item.HRS_MOTOR_LIGADO);
      
      const isOcioso = estado === 'F' && grupo !== 'PRODUTIVO';
      const ociosoHrs = isOcioso ? motorHrs : 0;

      if (!areaMap[area]) areaMap[area] = { nome: area, totalOps: 0, totalMotor: 0, totalOcioso: 0, frentes: {} };
      const a = areaMap[area];

      if (!a.frentes[frente]) a.frentes[frente] = { nome: frente, totalOps: 0, totalMotor: 0, totalOcioso: 0, equips: {} };
      const f = a.frentes[frente];

      if (!f.equips[eqID]) {
        f.equips[eqID] = { 
          id: eqID, 
          desc: item.DESC_EQUIP || "", 
          totalOps: 0, 
          motor: 0, 
          ocioso: 0, 
          detalhe: {} 
        };
      }
      const eq = f.equips[eqID];

      a.totalOps += opsHrs;
      a.totalMotor += motorHrs;
      a.totalOcioso += ociosoHrs;

      f.totalOps += opsHrs;
      f.totalMotor += motorHrs;
      f.totalOcioso += ociosoHrs;

      eq.totalOps += opsHrs;
      eq.motor += motorHrs;
      eq.ocioso += ociosoHrs;

      if (!eq.detalhe[grupo]) eq.detalhe[grupo] = { total: 0, motor: 0, ocioso: 0, ops: {} };
      const g = eq.detalhe[grupo];
      g.total += opsHrs;
      g.motor += motorHrs;
      g.ocioso += ociosoHrs;

      if (!g.ops[operacao]) g.ops[operacao] = { total: 0, motor: 0, ocioso: 0 };
      g.ops[operacao].total += opsHrs;
      g.ops[operacao].motor += motorHrs;
      g.ops[operacao].ocioso += ociosoHrs;

      globalOcioso += ociosoHrs;
      globalOps += opsHrs;
    });

    const areasFinal = Object.values(areaMap).map(a => {
      a.perc = a.totalOps > 0 ? (a.totalOcioso / a.totalOps) * 100 : 0;

      const frentesProcessadas = Object.values(a.frentes).map(f => {
        f.perc = f.totalOps > 0 ? (f.totalOcioso / f.totalOps) * 100 : 0;
        
        const equipsProcessados = Object.values(f.equips)
          .map(e => ({ ...e, perc: e.totalOps > 0 ? (e.ocioso / e.totalOps) * 100 : 0 }))
          .sort((e1, e2) => e2.ocioso - e1.ocioso);

        return { ...f, equips: equipsProcessados };
      }).sort((f1, f2) => f2.totalOcioso - f1.totalOcioso);

      return { ...a, frentes: frentesProcessadas };
    }).sort((a, b) => b.totalOcioso - a.totalOcioso);

    return {
      resumo: {
        totalOcioso: formatDecimalToHHMM(globalOcioso),
        percGlobal: globalOps > 0 ? (globalOcioso / globalOps) * 100 : 0
      },
      areas: areasFinal
    };
  }, [selectedDate]);

  // 3. Filtragem de Pesquisa
  const filteredAreas = useMemo(() => {
    if (!searchEquip) return report.areas;
    const lowerSearch = searchEquip.toLowerCase().trim();

    return report.areas.map(area => {
      const filteredFrentes = area.frentes.map(frente => {
        const equipsFiltrados = frente.equips.filter(eq => 
          eq.id.toLowerCase().includes(lowerSearch) || 
          eq.desc.toLowerCase().includes(lowerSearch) ||
          frente.nome.toLowerCase().includes(lowerSearch)
        );
        return { ...frente, equips: equipsFiltrados };
      }).filter(frente => frente.equips.length > 0);

      // Se a pesquisa for pelo nome da Área, mostra a área inteira
      if (area.nome.toLowerCase().includes(lowerSearch) && filteredFrentes.length === 0) {
        return area;
      }

      return { ...area, frentes: filteredFrentes };
    }).filter(area => area.frentes.length > 0 || area.nome.toLowerCase().includes(lowerSearch));
  }, [report.areas, searchEquip]);

  return (
    <div className="min-h-screen bg-[#06090F] text-slate-300 font-sans pb-20">
      <COAOciosoHeader onMenuOpen={() => setSidebarOpen(true)} />

      <COASidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        onNavigate={() => {}} 
      />
      
      <main className="p-4 flex flex-col items-center gap-6">
        <COADateSelector 
          date={selectedDate} 
          onPrev={() => setSelectedDate(availableDates[availableDates.indexOf(selectedDate) + 1])}
          onNext={() => setSelectedDate(availableDates[availableDates.indexOf(selectedDate) - 1])}
        />

        {/* RESUMO GERAL */}
        <div className="w-full max-w-lg grid grid-cols-2 gap-3">
          <div className="bg-[#161B22] p-4 rounded-xl border border-slate-800 text-center shadow-lg">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Total Ocioso (Global)</span>
            <span className="text-xl font-black text-red-400">{report.resumo.totalOcioso}</span>
          </div>
          <div className="bg-[#161B22] p-4 rounded-xl border border-slate-800 text-center shadow-lg">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">% Ocioso (Global)</span>
            <span className="text-xl font-black text-emerald-400">{report.resumo.percGlobal?.toFixed(1)}%</span>
          </div>
        </div>

        {/* BARRA DE PESQUISA */}
        <div className="w-full max-w-lg bg-[#161B22] p-3 rounded-xl border border-slate-700/80 shadow-md">
          <input 
            type="text" 
            placeholder="Pesquisar área, frente, equipamento..."
            value={searchEquip}
            onChange={(e) => setSearchEquip(e.target.value)}
            className="w-full bg-[#0A0D14] border border-slate-700 text-slate-200 font-bold rounded-lg px-3 py-2 outline-none focus:border-red-500 text-xs placeholder:text-slate-600"
          />
        </div>

        {/* LISTAGEM POR ÁREA -> FRENTE -> EQUIPAMENTOS */}
        <div className="w-full max-w-lg flex flex-col gap-6">
          {filteredAreas.map(area => {
            const isAreaOpen = expandedAreas[area.nome];

            return (
              <div key={area.nome} className={`bg-[#11151D] border rounded-xl overflow-hidden shadow-xl transition-colors duration-300 ${isAreaOpen ? 'border-slate-700' : 'border-slate-800'}`}>
                
                {/* CABEÇALHO DA ÁREA (Agora é um botão retrátil) */}
                <button 
                  onClick={() => toggleArea(area.nome)}
                  className="w-full bg-[#161B22] p-4 border-b border-slate-800 flex justify-between items-center hover:bg-slate-800/40 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-[12px] transition-transform duration-300 ${isAreaOpen ? 'rotate-90 text-emerald-400' : 'text-slate-500 group-hover:text-slate-400'}`}>▶</span>
                    <div className="w-1.5 h-4 bg-red-500 rounded-full" />
                    <h3 className="text-[13px] font-black text-slate-100 uppercase tracking-widest">{area.nome}</h3>
                  </div>
                  <div className="flex gap-4 text-right">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-slate-500 uppercase">Tempo Ocioso</span>
                      <span className="text-xs font-black text-red-400">{formatDecimalToHHMM(area.totalOcioso)}</span>
                    </div>
                    <div className="flex flex-col w-12">
                      <span className="text-[8px] font-black text-slate-500 uppercase">% Ocioso</span>
                      <span className="text-xs font-black" style={{ color: COA_RULES.motorOcioso(area.perc) }}>
                        {area.perc.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </button>

                {/* CONTEÚDO DA ÁREA (FRENTES E EQUIPAMENTOS) */}
                {isAreaOpen && (
                  <div className="p-3 flex flex-col gap-3">
                    {area.frentes.map(frente => {
                      const frenteId = `${area.nome}-${frente.nome}`;
                      const isOpen = expandedFrentes[frenteId];

                      return (
                        <div key={frente.nome} className={`border rounded-xl overflow-hidden transition-all duration-300 ${isOpen ? 'border-slate-700/80 shadow-lg shadow-black/50 bg-[#0A0D14]' : 'border-slate-800/80 bg-[#0A0D14] shadow-sm'}`}>
                          
                          {/* HEADER DA FRENTE (Botão) */}
                          <button 
                            onClick={() => toggleFrente(frenteId)}
                            className={`w-full flex justify-between items-center p-3.5 transition-colors ${isOpen ? 'bg-slate-800/50 border-b border-slate-700/60' : 'bg-[#0A0D14] hover:bg-[#161B22]'}`}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`text-[10px] transition-transform duration-300 ${isOpen ? 'rotate-90 text-emerald-400' : 'text-slate-500'}`}>▶</span>
                              <h4 className={`text-[11px] font-black uppercase tracking-widest ${isOpen ? 'text-white' : 'text-slate-200'}`}>{frente.nome}</h4>
                            </div>
                            <div className="flex gap-4 text-right">
                              <div className="flex flex-col">
                                <span className="text-[8px] font-black text-slate-500 uppercase">Motor Ocioso</span>
                                <span className="text-xs font-black text-red-400">{formatDecimalToHHMM(frente.totalOcioso)}</span>
                              </div>
                              <div className="flex flex-col w-12">
                                <span className="text-[8px] font-black text-slate-500 uppercase">% Ocioso</span>
                                <span className="text-xs font-black" style={{ color: COA_RULES.motorOcioso(frente.perc) }}>
                                  {frente.perc.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </button>

                          {/* CORPO DA FRENTE (Equipamentos) */}
                          {isOpen && (
                            <div className="p-3.5 bg-slate-400/25 flex flex-col gap-2.5 shadow-inner">
                              {frente.equips.map(eq => {
                                const isAcimaDaMeta = eq.perc > (METAS.MOTOR_OC_VERDE * 100);
                                
                                return (
                                  <button 
                                    key={eq.id}
                                    onClick={() => setModalData(eq)}
                                    className="bg-[#0A0D14] border border-slate-700/60 p-3 rounded-lg flex justify-between items-center hover:bg-[#161B22] hover:border-red-500/30 transition-all group shadow-sm"
                                  >
                                    <div className="flex flex-col items-start text-left">
                                      <span className="text-[11px] font-black text-slate-200">{eq.id}</span>
                                      <span className="text-[9px] font-bold text-slate-500 uppercase truncate w-24 md:w-32">{eq.desc}</span>
                                    </div>
                                    
                                    <div className="flex items-center gap-4">
                                      <div className="flex flex-col items-end">
                                        <span className="text-[8px] font-black text-slate-600 uppercase">Motor Lig.</span>
                                        <span className="text-[10px] font-black text-slate-300">{formatDecimalToHHMM(eq.motor)}</span>
                                      </div>
                                      <div className="flex flex-col items-end w-12">
                                        <span className="text-[8px] font-black text-slate-600 uppercase">Ocioso</span>
                                        <span className="text-[11px] font-black text-red-400">{formatDecimalToHHMM(eq.ocioso)}</span>
                                      </div>
                                      <div className="flex flex-col items-end w-10">
                                        <span className="text-[8px] font-black text-slate-600 uppercase">%</span>
                                        <span className={`text-[11px] font-black ${isAcimaDaMeta ? 'text-red-400' : 'text-emerald-500'}`}>
                                          {eq.perc.toFixed(1)}%
                                        </span>
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {filteredAreas.length === 0 && (
            <div className="text-center p-8 border border-dashed border-slate-700 rounded-xl">
              <span className="text-xs font-bold text-slate-500 uppercase">Nenhum dado encontrado</span>
            </div>
          )}
        </div>
      </main>

      {/* MODAL DE DETALHAMENTO */}
      {modalData && <OciosoModal data={modalData} onClose={() => setModalData(null)} />}
      
    </div>
  );
};

export default MotorOcioso;