import React from 'react';
import { Link } from 'react-router-dom';
import { QUALY_RULES } from '../../pages/QualyFlow/rules';

// Helper ajustado: Direto ao ponto (ex: 2026-05-27 -> { dayMonth: "27/05", year: "2026" })
const getHeaderDates = (dateStr) => {
  if (!dateStr) return { dayMonth: '-', year: '-' };
  const [y, m, d] = dateStr.split('-');
  return { dayMonth: `${d}/${m}`, year: y };
};

const KpiRow = ({ label, valDia, valAno, ruleFunc }) => {
  const vDia = Number(valDia) || 0;
  const vAno = Number(valAno) || 0;
  
  let icon = '—';
  let iconColor = 'text-slate-300';
  
  // Como menor é melhor, a lógica do triângulo se ajusta para isso
  if (vDia < vAno) {
    icon = '▼';
    iconColor = 'text-[var(--q-success)]'; // Melhor (Verde)
  } else if (vDia > vAno) {
    icon = '▲';
    iconColor = 'text-[var(--q-danger)]'; // Pior (Vermelho)
  }

  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-center py-2 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors rounded px-1">
      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">{label}</span>
      <span className="text-[13px] font-black tracking-tighter text-right w-[45px]" style={{ color: ruleFunc(vDia) }}>
        {vDia.toFixed(2)}%
      </span>
      <span className={`text-[10px] font-black text-center w-[15px] ${iconColor}`}>
        {icon}
      </span>
      <span className="text-[13px] font-black tracking-tighter text-right w-[45px]" style={{ color: ruleFunc(vAno) }}>
        {vAno.toFixed(2)}%
      </span>
    </div>
  );
};

const PerdasMecCard = ({ id, dataList, diario, anual, selectedDate }) => {
  if (!dataList || dataList.length === 0) return null;

  const { dayMonth, year } = getHeaderDates(selectedDate);

  return (
    <section id={id} className="w-full max-w-[400px] animate-in fade-in zoom-in duration-500 mt-4 font-sans scroll-mt-24">
      <div className="qualy-card group">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[var(--q-green)] to-[var(--q-orange)] opacity-90 shadow-sm" />
        
        <div className="px-5 pt-5 pb-3 flex justify-between items-center border-b border-slate-100 bg-slate-50/30">
          <h2 className="text-title">Perda Mecanizada</h2>
          <span className="text-[10px] font-bold text-slate-500 bg-white px-2.5 py-1 rounded border border-slate-200 shadow-sm">
             {dataList.length} CAMPOS
          </span>
        </div>

        {/* PLACAR SLIM - DIA VS ANO */}
        <div className="px-5 py-4 flex flex-col bg-white border-b border-slate-100 shadow-sm">
          
          {/* CABEÇALHO DO PLACAR */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-center mb-1.5 px-1">
            <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Indicador</span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right w-[45px]">{dayMonth}</span>
            <span className="text-[10px] font-black text-slate-300 text-center w-[15px]">|</span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right w-[45px]">{year}</span>
          </div>

          {/* LINHAS DOS INDICADORES */}
          <div className="flex flex-col">
            <KpiRow label="Perda Geral" valDia={diario?.perda_media} valAno={anual?.perda} ruleFunc={QUALY_RULES.Perdas.perdaMeta} />
            <KpiRow label="Pis. Simples" valDia={diario?.pisoteio_simples} valAno={anual?.pisoteio_simples} ruleFunc={QUALY_RULES.Perdas.pisoteioSimplesMeta} />
            <KpiRow label="Pis. Duplo" valDia={diario?.pisoteio_duplo} valAno={anual?.pisoteio_duplo} ruleFunc={QUALY_RULES.Perdas.pisoteioDuploMeta} />
            <KpiRow label="Arranquio" valDia={diario?.arranquio} valAno={anual?.arranquio} ruleFunc={QUALY_RULES.Perdas.arranquioMeta} />
          </div>
        </div>

        {/* LISTA DE CAMPOS */}
        <div className="px-5 py-4 max-h-[220px] overflow-y-auto no-scrollbar bg-slate-50/30">
          <div className="grid grid-cols-4 pb-2 border-b border-slate-200 mb-1">
            <span className="text-left text-micro">Campo</span>
            <span className="text-center text-micro">Perda</span>
            <span className="text-center text-micro">Pisoteio</span>
            <span className="text-right text-micro">Arranq.</span>
          </div>
          
          {dataList.map((c, idx) => {
            const perdaNum = Number(c.perda) || 0;
            const pisoNum = Number(c.pisoteio_simples) || 0; 
            const arranNum = Number(c.arranquio) || 0;

            return (
              <div key={idx} className="grid grid-cols-4 items-center py-2 border-b border-slate-100 last:border-0 hover:bg-white transition-colors px-1 rounded">
                <span className="text-left text-[11px] font-black text-slate-700 truncate pr-1" title={c.campo}>{c.campo}</span>
                <span className="text-center text-[12px] font-black" style={{ color: QUALY_RULES.Perdas.perdaMeta(perdaNum) }}>{perdaNum.toFixed(2)}%</span>
                <span className="text-center text-[12px] font-black" style={{ color: QUALY_RULES.Perdas.pisoteioSimplesMeta(pisoNum) }}>{pisoNum.toFixed(1)}%</span>
                <span className="text-right text-[12px] font-black" style={{ color: QUALY_RULES.Perdas.arranquioMeta(arranNum) }}>{arranNum.toFixed(2)}%</span>
              </div>
            );
          })}
        </div>

        {/* BOTÃO DE AÇÃO */}
        <Link 
          to="/qualyflow/perdasmec" 
          state={{ selectedDate }} 
          className="w-full py-3.5 bg-white border-t border-slate-100 flex justify-center items-center group-hover:bg-slate-50 transition-colors"
        >
          <span className="text-[10px] font-black text-slate-400 group-hover:text-[var(--q-green)] uppercase tracking-widest transition-colors">
            Relatório Detalhado →
          </span>
        </Link>
      </div>
    </section>
  );
};

export default PerdasMecCard;