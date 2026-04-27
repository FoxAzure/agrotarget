import React, { useState, useMemo } from 'react';

// Componentes Reutilizáveis
import COAHeader from '../../components/COACenter/COAHeader';
import COASidebar from '../../components/COACenter/COASidebar';
import COADateSelector from '../../components/COACenter/COADateSelector';

// Dados
import coaMockData from '../../data/mockData_coa.json';

// Helper de Tempo: Precisão em Segundos
const timeToSeconds = (t) => {
  if (!t || typeof t !== 'string') return 0;
  const p = t.split(':');
  if (p.length === 3) return (+p[0] || 0) * 3600 + (+p[1] || 0) * 60 + (+p[2] || 0);
  if (p.length === 2) return (+p[0] || 0) * 3600 + (+p[1] || 0) * 60;
  return 0;
};

const COADataAudit = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  // 1. GESTÃO DE DATAS
  const availableDates = useMemo(() => {
    const dates = [...new Set(coaMockData.map(i => i.DATA?.substring(0, 10)).filter(Boolean))];
    return dates.sort((a, b) => b.split('/').reverse().join('-').localeCompare(a.split('/').reverse().join('-')));
  }, []);

  const [dateIndex, setDateIndex] = useState(0);
  const selectedDate = availableDates[dateIndex] || "";

  // 2. MOTOR DE AUDITORIA
  const auditData = useMemo(() => {
    if (!selectedDate) return { geral: {}, porArea: [] };

    const filtered = coaMockData.filter(i => i.DATA?.startsWith(selectedDate));
    const GRUPOS_DESCONTO = ["MANUTENÇÃO", "CLIMA", "SEM TURNO DE TRABALHO", "FABRICA PARADA"];

    const process = (data) => {
      const equips = new Set();
      let totalSecs = 0, motorSecs = 0, prodSecs = 0, descSecs = 0, ociosoSecs = 0, sApontSecs = 0, indetSecs = 0;

      data.forEach(item => {
        const grupo = (item.DESC_GRUPO_OPERACAO || "").toUpperCase().trim();
        const estado = (item.ESTADO || "").toUpperCase().trim();
        const s_op = timeToSeconds(item.HRS_OPERACIONAIS);
        const s_mt = timeToSeconds(item.HRS_MOTOR_LIGADO);

        equips.add(item.COD_EQUIP);
        totalSecs += s_op;
        motorSecs += s_mt;

        if (grupo === "PRODUTIVO") prodSecs += s_op;
        if (GRUPOS_DESCONTO.includes(grupo)) descSecs += s_op;
        if (grupo === "SEM APONTAMENTO") sApontSecs += s_op;
        if (grupo === "INDETERMINADO") indetSecs += s_op;
        
        if (estado === "F" && grupo !== "PRODUTIVO") ociosoSecs += s_mt;
      });

      const dispSecs = Math.max(0, totalSecs - descSecs);
      return {
        qtd: equips.size,
        totalH: totalSecs / 3600,
        dispH: dispSecs / 3600,
        prodH: prodSecs / 3600,
        motorH: motorSecs / 3600,
        ociosoH: ociosoSecs / 3600,
        sApontH: sApontSecs / 3600,
        indetH: indetSecs / 3600,
        efOp: dispSecs > 0 ? (prodSecs / dispSecs) * 100 : 0,
        efReal: totalSecs > 0 ? (prodSecs / totalSecs) * 100 : 0
      };
    };

    const geral = process(filtered);

    const areasMap = {};
    filtered.forEach(item => {
      const area = (item.AREA_MAP || "NÃO MAPEADO").trim().toUpperCase();
      if (!areasMap[area]) areasMap[area] = [];
      areasMap[area].push(item);
    });

    const porArea = Object.entries(areasMap).map(([name, data]) => ({
      name,
      ...process(data)
    })).sort((a, b) => b.totalH - a.totalH);

    return { geral, porArea };
  }, [selectedDate]);

  const TableRow = ({ label, data, isHeader = false }) => (
    <tr className={`border-b border-slate-100 ${isHeader ? 'bg-slate-50 font-black' : 'hover:bg-slate-50/50'}`}>
      <td className="py-2 px-3 text-[10px] uppercase text-slate-700 sticky left-0 bg-inherit z-10">{label}</td>
      <td className="py-2 px-3 text-[10px] text-center font-bold text-slate-500">{data.qtd}</td>
      <td className="py-2 px-3 text-[10px] text-center font-black">{data.totalH.toFixed(2)}</td>
      <td className="py-2 px-3 text-[10px] text-center text-emerald-600 font-bold">{data.dispH.toFixed(2)}</td>
      <td className="py-2 px-3 text-[10px] text-center font-bold">{data.prodH.toFixed(2)}</td>
      <td className="py-2 px-3 text-[10px] text-center font-bold">{data.motorH.toFixed(2)}</td>
      <td className="py-2 px-3 text-[10px] text-center text-orange-600 font-bold">{data.ociosoH.toFixed(2)}</td>
      <td className="py-2 px-3 text-[10px] text-center text-red-500 font-bold">{data.sApontH.toFixed(2)}</td>
      <td className="py-2 px-3 text-[10px] text-center text-red-500 font-bold">{data.indetH.toFixed(2)}</td>
      <td className="py-2 px-3 text-[10px] text-right font-black bg-emerald-50 text-emerald-700">{data.efOp.toFixed(1)}%</td>
      <td className="py-2 px-3 text-[10px] text-right font-black bg-slate-100 text-slate-700">{data.efReal.toFixed(1)}%</td>
    </tr>
  );

  // Componente interno para o Cabeçalho Reutilizável
  const AuditTableHeader = () => (
    <thead className="bg-slate-50 border-b border-slate-200">
      <tr>
        <th className="py-2 px-3 text-[8px] font-black text-slate-500 uppercase text-left sticky left-0 bg-slate-50">Área / Escopo</th>
        <th className="py-2 px-3 text-[8px] font-black text-slate-500 uppercase text-center">Equips</th>
        <th className="py-2 px-3 text-[8px] font-black text-slate-500 uppercase text-center">Total (H)</th>
        <th className="py-2 px-3 text-[8px] font-black text-slate-500 uppercase text-center">Disp (H)</th>
        <th className="py-2 px-3 text-[8px] font-black text-slate-500 uppercase text-center">Prod (H)</th>
        <th className="py-2 px-3 text-[8px] font-black text-slate-500 uppercase text-center">Motor (H)</th>
        <th className="py-2 px-3 text-[8px] font-black text-slate-500 uppercase text-center">Ocioso (H)</th>
        <th className="py-2 px-3 text-[8px] font-black text-slate-500 uppercase text-center">S/Apont (H)</th>
        <th className="py-2 px-3 text-[8px] font-black text-slate-500 uppercase text-center">Indet (H)</th>
        <th className="py-2 px-3 text-[8px] font-black text-slate-500 uppercase text-right bg-emerald-50/50">Ef. Op (%)</th>
        <th className="py-2 px-3 text-[8px] font-black text-slate-500 uppercase text-right bg-slate-100">Ef. Real (%)</th>
      </tr>
    </thead>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20 text-slate-900">
      <COAHeader onMenuOpen={() => setSidebarOpen(true)} />
      <COASidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="p-4 flex flex-col items-center max-w-[1200px] mx-auto">
        <div className="w-full max-w-[360px] mb-6">
          <COADateSelector 
            date={selectedDate} 
            onPrev={() => setDateIndex(i => Math.min(i + 1, availableDates.length - 1))}
            onNext={() => setDateIndex(i => Math.max(i - 1, 0))}
            disablePrev={dateIndex === availableDates.length - 1}
            disableNext={dateIndex === 0}
          />
        </div>

        <div className="w-full flex flex-col gap-8 animate-in fade-in duration-500">
          
          {/* TABELA 1: RESUMO GERAL */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-800 p-3 flex justify-between items-center">
              <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Auditoria Geral - {selectedDate}</h3>
              <span className="text-[9px] text-slate-400 font-bold italic">Unidade: Horas Decimais</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[900px]">
                <AuditTableHeader />
                <tbody>
                  <TableRow label="TOTAL AGROVALE" data={auditData.geral} isHeader />
                </tbody>
              </table>
            </div>
          </section>

          {/* TABELA 2: RESUMO POR ÁREA MAPEADA */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-100 p-3 border-b border-slate-200">
              <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Detalhamento por Área (AREA_MAP)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[900px]">
                <AuditTableHeader />
                <tbody>
                  {auditData.porArea.map((area, idx) => (
                    <TableRow key={idx} label={area.name} data={area} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
};

export default COADataAudit;