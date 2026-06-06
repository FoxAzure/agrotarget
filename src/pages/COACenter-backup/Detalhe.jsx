import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Componentes
import COADetalheHeader from '../../components/COACenter/COADetalheHeader';
import COASidebar from '../../components/COACenter/COASidebar';
import COADateSelector from '../../components/COACenter/COADateSelector';
import COAEquipModal from '../../components/COACenter/COAEquipModal';

// Utilitários de Regras e Dados (Motor V8)
import { 
  COA_RULES, 
  COA_COLORS, 
  COA_CONSTANTS,
  parseTimeToHours, 
  formatDecimalToHHMM, 
  buildEquipModalData 
} from '../../pages/COACenter/coa_rules';
import coaMockData from '../../data/mockData_coa.json'; 

// Componente Interno: Barra de Progresso Suave
const ProgressBar = ({ label, percent, color }) => {
  const safePercent = isNaN(percent) ? 0 : Math.min(percent, 100);
  return (
    <div className="flex flex-col gap-1 w-full mt-1.5">
      <div className="flex justify-between items-end leading-none">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
        <span className="text-xs font-black" style={{ color }}>{Number(safePercent).toFixed(1)}%</span>
      </div>
      <div className="w-full h-2 bg-[#0A0D14] rounded-full overflow-hidden border border-slate-700/80 shadow-inner">
        <div 
          className="h-full rounded-full transition-all duration-1000 ease-out" 
          style={{ width: `${safePercent}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}60` }} 
        />
      </div>
    </div>
  );
};

const Detalhe = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  
  const queryParams = new URLSearchParams(location.search);
  const initialArea = queryParams.get('area') || location.state?.area || "NÃO MAPEADO";
  const initialDate = queryParams.get('date') || location.state?.selectedDate || "";

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [activeTab, setActiveTab] = useState('EQUIPAMENTOS');
  
  const [selectedFrentes, setSelectedFrentes] = useState([]);
  const [searchEquip, setSearchEquip] = useState("");
  
  const [expandedEquips, setExpandedEquips] = useState({});
  const [modalEquip, setModalEquip] = useState(null);

  const availableDates = useMemo(() => {
    const dates = [...new Set(coaMockData.map(i => i.DATA ? i.DATA.substring(0, 10) : null).filter(Boolean))];
    return dates.sort((a, b) => b.split('/').reverse().join('-').localeCompare(a.split('/').reverse().join('-')));
  }, []);

  useMemo(() => {
    if (!selectedDate && availableDates.length > 0) setSelectedDate(availableDates[0]);
  }, [availableDates, selectedDate]);
  
  const dateIndex = availableDates.indexOf(selectedDate) !== -1 ? availableDates.indexOf(selectedDate) : 0;

  const masterData = useMemo(() => {
    if (!selectedDate) return null;

    const rawData = coaMockData.filter(d => d.DATA.startsWith(selectedDate) && d.AREA_MAP === initialArea);
    
    const areaSum = { total: 0, prod: 0, descontos: 0, sApont: 0, indet: 0, motor: 0, ocioso: 0, ofensores: {}, equips: new Set() };
    const frentesMap = {};
    const equipsMap = {};
    const alertasRaw = [];

    rawData.forEach(row => {
      const eqID = row.COD_EQUIP || "N/A";
      const eqDesc = row.DESC_EQUIP || ""; 
      const fName = (row.GRUPO_EQUIP || "OUTROS").toUpperCase();
      const grpOp = (row.DESC_GRUPO_OPERACAO || "OUTROS").toUpperCase();
      const opName = (row.DESC_OPERACAO || "").toUpperCase();
      const estado = row.ESTADO || "";
      
      // Chamando as regras blindadas (agora em HORAS e não segundos)
      const hrs = parseTimeToHours(row.HRS_OPERACIONAIS);
      const motorHrs = parseTimeToHours(row.HRS_MOTOR_LIGADO);
      
      const isOcioso = estado === 'F' && grpOp !== 'PRODUTIVO';
      const ociosoHrs = isOcioso ? motorHrs : 0;

      // 4800 segundos antes equivalia a ~1.33 horas (vamos usar 1.33h para a refeição crítica)
      if (opName.includes('REFEI') && hrs > 1.33) {
        alertasRaw.push({ eqID, eqDesc, frente: fName, tipo: 'REFEIÇÃO CRÍTICA', msg: `Operação de ${opName} registrou ${formatDecimalToHHMM(hrs)}h contínuas.` });
      }

      if (!frentesMap[fName]) frentesMap[fName] = { equips: new Set(), total: 0, prod: 0, descontos: 0, sApont: 0, indet: 0, ofensores: {} };
      
      if (!equipsMap[eqID]) {
        equipsMap[eqID] = { id: eqID, desc: eqDesc, frente: fName, total: 0, prod: 0, descontos: 0, sApont: 0, indet: 0, improd: 0, motor: 0, ocioso: 0, gruposOp: {} };
      } else if (!equipsMap[eqID].desc && eqDesc) {
        equipsMap[eqID].desc = eqDesc; // Trava para capturar a descrição caso a primeira linha venha vazia
      }

      const refF = frentesMap[fName];
      const refE = equipsMap[eqID];

      areaSum.equips.add(eqID); refF.equips.add(eqID);
      areaSum.total += hrs; refF.total += hrs; refE.total += hrs;
      areaSum.motor += motorHrs; refE.motor += motorHrs;
      
      areaSum.ocioso += ociosoHrs; refE.ocioso += ociosoHrs;

      if (!refE.gruposOp[grpOp]) refE.gruposOp[grpOp] = { totalH: 0, operacoes: {} };
      refE.gruposOp[grpOp].totalH += hrs;
      refE.gruposOp[grpOp].operacoes[opName] = (refE.gruposOp[grpOp].operacoes[opName] || 0) + hrs;

      const isDesc = ['MANUTEN', 'CLIMA', 'SEM TURNO', 'INDUSTRIA', 'FABRICA'].some(x => grpOp.includes(x)) || opName.includes('CHUVA');
      
      if (grpOp === 'PRODUTIVO') { areaSum.prod += hrs; refF.prod += hrs; refE.prod += hrs; }
      if (isDesc) { areaSum.descontos += hrs; refF.descontos += hrs; refE.descontos += hrs; }
      if (grpOp === 'SEM APONTAMENTO') { areaSum.sApont += hrs; refF.sApont += hrs; refE.sApont += hrs; }
      if (grpOp === 'INDETERMINADO') { areaSum.indet += hrs; refF.indet += hrs; refE.indet += hrs; }
      if (grpOp === 'IMPRODUTIVO') refE.improd += hrs; 

      if (['IMPRODUTIVO', 'AUXILIAR'].includes(grpOp) && hrs > 0) {
        areaSum.ofensores[opName] = (areaSum.ofensores[opName] || 0) + hrs;
        refF.ofensores[opName] = (refF.ofensores[opName] || 0) + hrs;
      }
    });

    const areaDisp = areaSum.total - areaSum.descontos;
    const areaStats = {
      qtdEquipamentos: areaSum.equips.size,
      totalHoras: areaSum.total,
      horasDisponiveis: areaDisp,
      horasProdutivas: areaSum.prod,
      horasSemApontamento: areaSum.sApont,
      horasMotor: areaSum.motor,
      horasOcioso: areaSum.ocioso,
      percSemApontamento: areaSum.total > 0 ? (areaSum.sApont / areaSum.total) * 100 : 0,
      percIndeterminado: areaSum.total > 0 ? (areaSum.indet / areaSum.total) * 100 : 0,
      percMotorOcioso: areaSum.total > 0 ? (areaSum.ocioso / areaSum.total) * 100 : 0,
      eficienciaOperacional: areaDisp > 0 ? (areaSum.prod / areaDisp) * 100 : 0,
      eficienciaReal: areaSum.total > 0 ? (areaSum.prod / areaSum.total) * 100 : 0,
      ofensores: Object.entries(areaSum.ofensores).map(([n, h]) => ({ nome: n, horas: h })).sort((a,b) => b.horas - a.horas).slice(0, 3)
    };

    const frentesData = Object.entries(frentesMap).map(([nome, d]) => {
      const disp = d.total - d.descontos;
      return {
        nome,
        qtdEquips: d.equips.size,
        efOp: disp > 0 ? (d.prod / disp) * 100 : 0,
        efReal: d.total > 0 ? (d.prod / d.total) * 100 : 0,
        sApont: d.total > 0 ? (d.sApont / d.total) * 100 : 0,
        indet: d.total > 0 ? (d.indet / d.total) * 100 : 0,
        ofensores: Object.entries(d.ofensores).map(([n, h]) => ({ nome: n, horas: h })).sort((a,b) => b.horas - a.horas).slice(0, 5)
      };
    }).sort((a,b) => b.efOp - a.efOp);

    const equipsData = Object.values(equipsMap).map(eq => {
      const disp = eq.total - eq.descontos;
      const sApontPerc = eq.total > 0 ? (eq.sApont / eq.total) * 100 : 0;
      const indetPerc = eq.total > 0 ? (eq.indet / eq.total) * 100 : 0;
      const improdPerc = eq.total > 0 ? (eq.improd / eq.total) * 100 : 0;
      
      const ociosoPerc = eq.total > 0 ? (eq.ocioso / eq.total) * 100 : 0; 

      if (sApontPerc > 5) alertasRaw.push({ eqID: eq.id, eqDesc: eq.desc, frente: eq.frente, tipo: 'SEM APONT. > 5%', msg: `${sApontPerc.toFixed(1)}% das horas s/ apontamento.` });
      if (improdPerc >= 40) alertasRaw.push({ eqID: eq.id, eqDesc: eq.desc, frente: eq.frente, tipo: 'IMPRODUTIVAS > 40%', msg: `${improdPerc.toFixed(1)}% horas improdutivas.` });
      if (indetPerc > 10) alertasRaw.push({ eqID: eq.id, eqDesc: eq.desc, frente: eq.frente, tipo: 'INDETERMINADO > 10%', msg: `${indetPerc.toFixed(1)}% de horas não reconhecidas.` });

      return {
        ...eq,
        kpis: {
          efOp: disp > 0 ? (eq.prod / disp) * 100 : 0,
          sApont: sApontPerc,
          ociosoPerc: ociosoPerc,    
          ociosoH: eq.ocioso,  
          totalH: eq.total,
          prodH: eq.prod,
          descontosH: eq.descontos, 
          motorH: eq.motor
        }
      };
    });

    return { 
      rawData, // Repassando os dados brutos filtrados para abastecer o Modal depois
      areaStats, 
      frentes: frentesData, 
      equips: equipsData, 
      alertas: alertasRaw.sort((a, b) => a.tipo.localeCompare(b.tipo)),
      frentesList: Object.keys(frentesMap).sort()
    };
  }, [selectedDate, initialArea]);

  const toggleFrenteFiltro = (frente) => {
    setSelectedFrentes(prev => prev.includes(frente) ? prev.filter(f => f !== frente) : [...prev, frente]);
  };

  const groupedFilteredEquips = useMemo(() => {
    if (!masterData) return [];
    
    const filtered = masterData.equips.filter(eq => {
      const matchFrente = selectedFrentes.length === 0 || selectedFrentes.includes(eq.frente);
      const safeSearch = searchEquip.toLowerCase().trim();
      const matchSearch = safeSearch === "" || 
        (eq.id && String(eq.id).toLowerCase().includes(safeSearch)) || 
        (eq.desc && String(eq.desc).toLowerCase().includes(safeSearch));
      return matchFrente && matchSearch;
    });

    const groups = {};
    filtered.forEach(eq => {
      if (!groups[eq.frente]) groups[eq.frente] = [];
      groups[eq.frente].push(eq);
    });

    return Object.keys(groups).sort().map(frenteName => ({
      frenteName,
      equips: groups[frenteName].sort((a, b) => b.kpis.prodH - a.kpis.prodH)
    }));
  }, [masterData, selectedFrentes, searchEquip]);

  const areaInfo = masterData?.areaStats || {};
  const efOpCor = COA_RULES.eficienciaOp(areaInfo.eficienciaOperacional || 0);

  return (
    <div className="min-h-screen bg-[#06090F] text-slate-300 font-sans pb-10">
      <COADetalheHeader onMenuOpen={() => setSidebarOpen(true)} />
      <COASidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={() => {}} />

      <main className="p-4 flex flex-col items-center gap-5">
        
        {/* BLOCO SUPERIOR INTEGRADO */}
        <div className="w-full max-w-[400px] bg-[#161B22] border-t-4 border-emerald-500 border-x border-b border-slate-700/80 rounded-2xl shadow-2xl mt-4 overflow-hidden">
          <div className="p-5 border-b border-slate-700/80">
            <div className="flex flex-col items-center justify-center mb-5">
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-1">
                Dashboard de Resultados
              </span>
              <h2 className="text-2xl font-black text-slate-100 uppercase tracking-tighter">
                {initialArea}
              </h2>
            </div>
            <COADateSelector 
              date={selectedDate}
              onPrev={() => setSelectedDate(availableDates[Math.min(dateIndex + 1, availableDates.length - 1)])}
              onNext={() => setSelectedDate(availableDates[Math.max(dateIndex - 1, 0)])}
              disablePrev={dateIndex === availableDates.length - 1}
              disableNext={dateIndex === 0}
            />
          </div>

          {masterData && (
            <div className="flex flex-col">
              <div className="flex p-4 gap-4">
                <div className="w-[48%] flex flex-col items-center justify-center p-3 bg-[#11151D] rounded-xl border border-slate-700/80 shadow-inner">
                  <div className="relative flex items-center justify-center w-32 h-16">
                    <svg className="w-full h-full absolute top-0" viewBox="0 0 100 50">
                      <path d="M 10 45 A 40 40 0 0 1 90 45" fill="none" stroke="#2D3748" strokeWidth="12" strokeLinecap="round" />
                      <path 
                        d="M 10 45 A 40 40 0 0 1 90 45" 
                        fill="none" 
                        stroke={efOpCor} 
                        strokeWidth="12" 
                        strokeLinecap="round"
                        strokeDasharray={`${(Math.min(areaInfo.eficienciaOperacional || 0, 100) / 100) * 126} 126`} 
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="flex flex-col items-center justify-center mt-7">
                      <span className="text-2xl font-black tracking-tighter leading-none" style={{ color: efOpCor, textShadow: `0 0 8px ${efOpCor}40` }}>
                        {Number(areaInfo.eficienciaOperacional || 0).toFixed(1)}%
                      </span>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Ef. Op.</span>
                    </div>
                  </div>
                  <div className="mt-5 text-center border-t border-slate-700/80 pt-2.5 w-full">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block leading-none mb-0.5">Ef. Real</span>
                    <span className="text-sm font-black text-slate-100">{Number(areaInfo.eficienciaReal || 0).toFixed(1)}%</span>
                  </div>
                </div>

                <div className="w-[52%] flex flex-col justify-between">
                  <div className="grid grid-cols-2 gap-y-2.5 gap-x-2">
                    <div className="flex flex-col bg-[#11151D] p-2 rounded-lg border border-slate-700/50">
                      <span className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Totais</span>
                      <span className="text-sm font-black text-slate-100 leading-none">{Number(areaInfo.totalHoras || 0).toFixed(1)}h</span>
                    </div>
                    <div className="flex flex-col bg-[#11151D] p-2 rounded-lg border border-slate-700/50">
                      <span className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Disp</span>
                      <span className="text-sm font-black text-slate-100 leading-none">{Number(areaInfo.horasDisponiveis || 0).toFixed(1)}h</span>
                    </div>
                    <div className="flex flex-col bg-[#11151D] p-2 rounded-lg border border-slate-700/50">
                      <span className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Produtivas</span>
                      <span className="text-sm font-black leading-none" style={{ color: COA_COLORS.dentro }}>{Number(areaInfo.horasProdutivas || 0).toFixed(1)}h</span>
                    </div>
                    <div className="flex flex-col bg-[#11151D] p-2 rounded-lg border border-slate-700/50">
                      <span className="text-[8px] font-black text-slate-400 uppercase mb-0.5">S/Apont</span>
                      <span className="text-sm font-black leading-none" style={{ color: COA_RULES.semApontamento(areaInfo.percSemApontamento) }}>{Number(areaInfo.horasSemApontamento || 0).toFixed(1)}h</span>
                    </div>
                    <div className="flex flex-col bg-[#11151D] p-2 rounded-lg border border-slate-700/50">
                      <span className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Motor Lig</span>
                      <span className="text-sm font-black text-slate-100 leading-none">{Number(areaInfo.horasMotor || 0).toFixed(1)}h</span>
                    </div>
                    <div className="flex flex-col bg-[#11151D] p-2 rounded-lg border border-slate-700/50">
                      <span className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Motor Oc</span>
                      <span className="text-sm font-black leading-none" style={{ color: COA_RULES.motorOcioso(areaInfo.percMotorOcioso) }}>{Number(areaInfo.horasOcioso || 0).toFixed(1)}h</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-5 pb-5 pt-1 flex flex-col gap-2.5">
                <ProgressBar label="Sem Apontamento" percent={areaInfo.percSemApontamento} color={COA_RULES.semApontamento(areaInfo.percSemApontamento)} />
                <ProgressBar label="Indeterminado" percent={areaInfo.percIndeterminado} color={COA_RULES.indeterminado(areaInfo.percIndeterminado)} />
                <ProgressBar label="Motor Ocioso" percent={areaInfo.percMotorOcioso} color={COA_RULES.motorOcioso(areaInfo.percMotorOcioso)} />
              </div>
            </div>
          )}
        </div>

        <div className="w-full max-w-[400px] flex bg-[#11151D] rounded-xl p-1.5 border border-slate-700/80 shadow-md">
          {['EQUIPAMENTOS', 'FRENTES', 'ALERTAS'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-[10px] font-black tracking-widest uppercase rounded-lg transition-all ${
                activeTab === tab 
                  ? tab === 'ALERTAS' ? 'bg-red-500/90 text-white shadow-lg' : 'bg-[#1C2128] text-emerald-400 border border-slate-600 shadow-md' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab} {tab === 'ALERTAS' && masterData?.alertas.length > 0 && `(${masterData.alertas.length})`}
            </button>
          ))}
        </div>

        {activeTab === 'EQUIPAMENTOS' && (
          <div className="w-full max-w-[400px] flex flex-col gap-4 animate-in fade-in">
            <div className="bg-[#161B22] p-4 rounded-xl border border-slate-700/80 shadow-md">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Filtro de Frente</span>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {masterData?.frentesList.map(f => (
                  <button 
                    key={f}
                    onClick={() => toggleFrenteFiltro(f)}
                    className={`py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border shadow-sm ${
                      selectedFrentes.includes(f) ? 'bg-[#1C2128] text-emerald-400 border-emerald-500/50' : 'bg-[#0A0D14] text-slate-500 border-slate-700 hover:border-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <span className="truncate block px-1">{f}</span>
                  </button>
                ))}
              </div>

              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Equipamento</span>
              <input 
                type="text" 
                placeholder="Código Equipamento..."
                value={searchEquip}
                onChange={(e) => setSearchEquip(e.target.value)}
                className="w-full bg-[#0A0D14] border border-slate-700 text-slate-200 font-bold rounded-lg px-3 py-2.5 outline-none focus:border-emerald-500 text-xs placeholder:text-slate-600"
              />
            </div>

            <div className="flex flex-col gap-5">
              {groupedFilteredEquips.map((grupo, gIdx) => (
                <div key={gIdx} className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 pl-2">
                    <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                    <h3 className="text-[11px] font-black text-slate-300 uppercase tracking-widest">{grupo.frenteName}</h3>
                    <span className="text-[9px] font-bold text-slate-500 ml-auto bg-[#161B22] px-2 py-0.5 rounded border border-slate-700/80">
                      {grupo.equips.length} Equip.
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    {grupo.equips.map((eq) => {
                      const isOpen = expandedEquips[eq.id];

                      return (
                        <div key={eq.id} className="bg-[#161B22] rounded-xl border border-slate-700/50 overflow-hidden shadow-md">
                          <div className="flex items-center justify-between p-3 bg-[#11151D]">
                            <button 
                              onClick={() => setExpandedEquips(p => ({...p, [eq.id]: !p[eq.id]}))}
                              className="flex items-center gap-2 flex-1 text-left group"
                            >
                              <div className={`w-5 h-5 flex items-center justify-center rounded bg-[#1C2128] text-slate-400 group-hover:text-emerald-400 transition-colors`}>
                                <span className={`text-[9px] transform transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                              </div>
                              <span className="text-xs font-black text-slate-200 uppercase truncate w-14">{eq.id}</span>
                            </button>

                            <div className="flex items-center gap-2">
                              <div className="flex flex-col items-end w-10">
                                <span className="text-[7.5px] font-black text-slate-500 uppercase tracking-widest">Ef. Op.</span>
                                <span className="text-[11px] font-black" style={{ color: COA_RULES.eficienciaOp(eq.kpis.efOp) }}>
                                  {Number(eq.kpis.efOp || 0).toFixed(1)}%
                                </span>
                              </div>
                              <div className="flex flex-col items-end w-12">
                                <span className="text-[7.5px] font-black text-slate-500 uppercase tracking-widest">S/Apont</span>
                                <span className="text-[11px] font-black" style={{ color: COA_RULES.semApontamento(eq.kpis.sApont) }}>
                                  {Number(eq.kpis.sApont || 0).toFixed(1)}%
                                </span>
                              </div>
                              <div className="flex flex-col items-end w-10">
                                <span className="text-[7.5px] font-black text-slate-500 uppercase tracking-widest">Ocioso</span>
                                <span className="text-[11px] font-black" style={{ color: COA_RULES.motorOcioso(eq.kpis.ociosoPerc) }}>
                                  {Number(eq.kpis.ociosoPerc || 0).toFixed(1)}%
                                </span>
                              </div>
                              
                              {/* Aqui o botão usa a nova engine do Modal! */}
                              <button 
                                onClick={() => setModalEquip(buildEquipModalData(masterData.rawData, eq.id))}
                                className="w-6 h-6 flex items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors font-serif italic font-bold ml-1"
                              >
                                i
                              </button>
                            </div>
                          </div>

                          {isOpen && (
                            <div className="bg-[#0A0D14] p-3 border-t border-slate-800/80 flex flex-col gap-1.5">
                              {Object.entries(eq.gruposOp)
                                .sort(([, a], [, b]) => b.totalH - a.totalH) // Usando horas decimais
                                .map(([grpName, grpData], idx) => {
                                  const isProd = grpName === 'PRODUTIVO';
                                  return (
                                    <div key={idx} className="flex justify-between items-center py-1.5 px-2 border-b border-slate-800/50 last:border-0 rounded hover:bg-[#161B22]/50 transition-colors">
                                      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: isProd ? COA_COLORS.dentro : COA_COLORS.neutro }}>
                                        {grpName}
                                      </span>
                                      <span className="text-[11px] font-black" style={{ color: isProd ? COA_COLORS.dentro : COA_COLORS.neutro }}>
                                        {formatDecimalToHHMM(grpData.totalH)} h
                                      </span>
                                    </div>
                                  );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              
              {groupedFilteredEquips.length === 0 && (
                <div className="text-center p-6 border border-dashed border-slate-700 rounded-xl">
                  <span className="text-xs font-bold text-slate-500 uppercase">Nenhum equipamento filtrado</span>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'FRENTES' && (
          <div className="w-full max-w-[400px] flex flex-col gap-4 animate-in fade-in">
            {masterData?.frentes.map(frente => (
              <div key={frente.nome} className="bg-[#161B22] border border-slate-700/50 rounded-xl shadow-xl overflow-hidden">
                <div className="bg-[#11151D] p-4 flex justify-between items-center border-b border-slate-700/50">
                  <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest" style={{ color: COA_COLORS.dentro }}>
                    {frente.nome}
                  </h3>
                  <span className="text-[10px] font-bold bg-[#0A0D14] px-2 py-1 rounded border border-slate-800 text-slate-400">{frente.qtdEquips} MAQ</span>
                </div>
                
                <div className="p-4 grid grid-cols-2 gap-3">
                  <div className="flex flex-col">
                    <span className="text-[8px] text-slate-400 font-bold uppercase">Ef. Operacional</span>
                    <span className="text-sm font-black" style={{ color: COA_RULES.eficienciaOp(frente.efOp) }}>{Number(frente.efOp || 0).toFixed(1)}%</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] text-slate-400 font-bold uppercase">Ef. Real</span>
                    <span className="text-sm font-black text-slate-200">{Number(frente.efReal || 0).toFixed(1)}%</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] text-slate-400 font-bold uppercase">Sem Apontamento</span>
                    <span className="text-sm font-black" style={{ color: COA_RULES.semApontamento(frente.sApont) }}>{Number(frente.sApont || 0).toFixed(1)}%</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] text-slate-400 font-bold uppercase">Indeterminado</span>
                    <span className="text-sm font-black" style={{ color: COA_RULES.indeterminado(frente.indet) }}>{Number(frente.indet || 0).toFixed(1)}%</span>
                  </div>
                </div>

                {frente.ofensores.length > 0 && (
                  <div className="bg-[#0A0D14] p-3 border-t border-slate-800">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Top Ofensores</span>
                    <span className="text-[8px] text-slate-500 block mb-2">*Apenas Improdutivo/Auxiliar</span>
                    {frente.ofensores.map((o, i) => (
                      <div key={i} className="flex justify-between text-[9px] py-0.5">
                        <span className="text-slate-400">{o.nome}</span>
                        <span className="text-slate-300 font-bold">{Number(o.horas || 0).toFixed(1)}h</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'ALERTAS' && (
          <div className="w-full max-w-[400px] flex flex-col gap-3 animate-in fade-in">
            {masterData?.alertas.length > 0 ? (
              masterData.alertas.map((alerta, idx) => (
                <div key={idx} className="bg-[#11151D] border-l-4 border-red-500 rounded-lg p-4 shadow-lg flex flex-col gap-2 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-full blur-xl -mr-4 -mt-4" />
                  
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">{alerta.tipo}</span>
                      <span className="text-sm font-black text-slate-100">{alerta.eqID}</span>
                    </div>
                    <span className="text-[8px] font-bold text-slate-400 uppercase bg-[#0A0D14] px-2 py-1 rounded border border-slate-800">{alerta.frente}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-400 leading-tight">
                    {alerta.msg}
                  </p>
                </div>
              ))
            ) : (
              <div className="text-center p-8 bg-[#11151D] rounded-2xl border border-dashed border-emerald-500/30">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-emerald-500 text-xl">✓</span>
                </div>
                <h3 className="text-sm font-black text-emerald-400 uppercase tracking-widest">Nenhum Alerta</h3>
                <p className="text-xs text-slate-400 font-medium mt-1">Operação rodando dentro dos limites de tolerância.</p>
              </div>
            )}
          </div>
        )}

      </main>

      <COAEquipModal 
        isOpen={!!modalEquip} 
        onClose={() => setModalEquip(null)} 
        equipData={modalEquip} 
      />
    </div>
  );
};

export default Detalhe;