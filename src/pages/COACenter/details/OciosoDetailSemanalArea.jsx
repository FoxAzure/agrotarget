// ================================= DOCUMENTATION ------------------------------------------
// Script: OciosoDetailSemanalArea
// Purpose: Modal detalhado da Área selecionada na visão Semanal.
// Relationships: Invocado pelo OciosoDetailSemanal. Consome vw_c_semana_data e vw_c_semana_equip.
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

// IMPORTANDO NOSSO NOVO MODAL DE EQUIPAMENTO
import OciosoDetailSemanalEquip from './OcisioDetailSemanalEquip';

// ================= HELPERS & CONSTANTS =================

const WEEK_DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatHours = (value) => `${Number(value || 0).toFixed(1)}h`;
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;
const formatInt = (value) => `${Math.round(Number(value || 0))}`;

const getOciosoColor = (value, target = 5) => {
  const safe = Number(value || 0);
  return safe <= target ? 'var(--coa-success)' : 'var(--coa-danger)';
};

const getOciosoTint = (value, alpha = 0.10) => {
  const safe = Number(value || 0);
  return safe <= 5 ? `rgba(61,220,151,${alpha})` : `rgba(239,68,68,${alpha})`;
};

const getDayOfWeek = (brDate) => {
  if (!brDate || typeof brDate !== 'string') return 0;
  const [d, m, y] = brDate.split('/');
  const date = new Date(y, m - 1, d);
  const jsDay = date.getDay(); 
  return (jsDay + 6) % 7; 
};

// ================= COMPONENTES DA HIERARQUIA =================

const ExpandBlock = ({ expanded, children }) => (
  <div className={`grid transition-all duration-300 ease-out ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
    <div className="overflow-hidden">{children}</div>
  </div>
);

const AreaRowModern = ({ area, expanded, children }) => {
  const color = getOciosoColor(area.perc_ocioso);
  return (
    <div className="bg-[rgba(255,255,255,0.02)] overflow-hidden rounded-[18px]">
      <div className="w-full text-left px-4 py-3 transition-all" style={{ background: getOciosoTint(area.perc_ocioso, 0.13) }}>
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
          <div className="min-w-0 flex flex-col">
            <span className="text-[14px] font-black text-[var(--coa-text)] truncate">{area.desc_area}</span>
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">{formatInt(area.qnt_equip)} equipamentos</span>
          </div>
          <span className="text-[11px] font-bold text-[var(--coa-text-soft)] whitespace-nowrap">{formatHours(area.hrs_ocioso)}</span>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[13px] font-black whitespace-nowrap" style={{ color }}>{formatPercent(area.perc_ocioso)}</span>
          </div>
        </div>
      </div>
      <ExpandBlock expanded={expanded}>
        <div className="pl-5 pr-2 py-2 flex flex-col gap-1.5 bg-[rgba(255,255,255,0.01)]">{children}</div>
      </ExpandBlock>
    </div>
  );
};

const FrenteRowModern = ({ frente, expanded, onToggle, children }) => {
  const color = getOciosoColor(frente.perc_ocioso);
  return (
    <div className="flex flex-col">
      <button type="button" onClick={onToggle} className="w-full text-left px-3 py-2.5 transition-all bg-transparent">
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 pb-2" style={{ borderBottom: `1px solid ${color}50` }}>
          <div className="min-w-0 flex flex-col">
            <span className="text-[12px] font-black truncate" style={{ color }}>{frente.desc_grupo}</span>
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">{formatInt(frente.qnt_equip)} equipamentos</span>
          </div>
          <span className="text-[11px] font-bold text-[var(--coa-text-soft)] whitespace-nowrap">{formatHours(frente.hrs_ocioso)}</span>
          <span className="text-[12px] font-black whitespace-nowrap" style={{ color }}>{formatPercent(frente.perc_ocioso)}</span>
          <span className="text-[11px] font-black text-[var(--coa-text-muted)]">{expanded ? '−' : '+'}</span>
        </div>
      </button>
      <ExpandBlock expanded={expanded}>
        <div className="pl-6 pr-1 pt-2 flex flex-col gap-1.5">{children}</div>
      </ExpandBlock>
    </div>
  );
};

const EquipamentoRowModern = ({ item, onOpen }) => {
  const color = getOciosoColor(item.perc_ocioso);
  return (
    <button type="button" onClick={() => onOpen(item)} className="w-full text-left px-3 py-2.5 transition-all hover:bg-[rgba(255,255,255,0.05)] rounded-lg" style={{ background: getOciosoTint(item.perc_ocioso, 0.09) }}>
      <div className="grid grid-cols-[1fr_auto] items-center gap-3">
        <div className="min-w-0 flex flex-col">
          <span className="text-[12px] font-black text-[var(--coa-text)] truncate">{item.cod_equip}</span>
          <span className="text-[10px] font-medium text-[var(--coa-text-muted)] truncate">Clique para detalhes...</span>
        </div>
        <span className="text-[12px] font-black whitespace-nowrap" style={{ color }}>{formatPercent(item.perc_ocioso)}</span>
      </div>
    </button>
  );
};

// ================= COMPONENTES VISUAIS =================

const CustomLabel = (props) => {
  const { x, y, width, value } = props;
  if (x == null || y == null || value == null) return null;
  const color = getOciosoColor(value, 5);
  return <text x={x + (width ? width / 2 : 0)} y={y} dy={-8} fill={color} fontSize={10} fontWeight="900" textAnchor="middle">{`${Number(value).toFixed(1)}%`}</text>;
};

const CustomBarTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const color = getOciosoColor(data.perc_ocioso, 5);
    return (
      <div className="coa-panel p-3 border shadow-lg flex flex-col gap-1" style={{ borderColor: 'var(--coa-border)' }}>
        <p className="coa-text-micro mb-1">{data.desc_dia}</p>
        <p className="text-sm font-black" style={{ color }}>Motor Ocioso: {Number(data.perc_ocioso || 0).toFixed(1)}%</p>
        <p className="text-[12px] font-bold text-[var(--coa-text-soft)]">Horas Ociosas: {formatHours(data.hrs_ocioso)}</p>
      </div>
    );
  }
  return null;
};

const MetricCard = ({ label, value, color = 'var(--coa-text)' }) => (
  <div className="rounded-[14px] border px-3 py-3 bg-[rgba(255,255,255,0.02)] flex flex-col justify-center" style={{ borderColor: 'var(--coa-divider)' }}>
    <span className="block text-[10px] md:text-[11px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)] mb-1">{label}</span>
    <span className="block text-[1.1rem] md:text-[1.25rem] font-black tracking-tight leading-none" style={{ color }}>{value}</span>
  </div>
);

const ProgressBarIndeterminado = ({ perc, hrs }) => {
  const safePerc = Number(perc) || 0;
  const isDanger = safePerc > 10;
  const barColor = isDanger ? 'var(--coa-danger)' : 'var(--coa-success)';
  return (
    <div className="rounded-[14px] border px-4 py-4 bg-[rgba(255,255,255,0.02)] flex flex-col gap-3 shadow-sm transition-all mt-2" style={{ borderColor: 'var(--coa-divider)' }}>
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">Indeterminado</span>
        <div className="flex items-center gap-2 text-[1rem] font-black tracking-tight">
          <span style={{ color: 'var(--coa-text)' }}>{formatHours(hrs)}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--coa-text-muted)] opacity-50"></span>
          <span className="transition-colors" style={{ color: barColor }}>{formatPercent(safePerc)}</span>
        </div>
      </div>
      <div className="w-full h-2 rounded-full overflow-hidden flex bg-[rgba(255,255,255,0.05)] shadow-inner">
        <div className="h-full transition-all duration-700 ease-out" style={{ width: `${Math.min(safePerc, 100)}%`, backgroundColor: barColor }} />
      </div>
    </div>
  );
};

// ================= EXECUTOR =================

const OciosoDetailSemanalArea = ({ areaName, selectedWeek, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [dailyData, setDailyData] = useState([]);
  const [equipData, setEquipData] = useState([]);
  
  const [expandedFrentes, setExpandedFrentes] = useState([]);
  
  // Guardará o cod_equip para abrir o Modal de Equipamento
  const [selectedEquipModal, setSelectedEquipModal] = useState(null);

  useEffect(() => {
    if (!selectedWeek || !areaName) return;
    
    let mounted = true;
    const fetchData = async () => {
      try {
        setLoading(true);
        const [resDaily, resEquip] = await Promise.all([
          supabase.from('vw_c_semana_data')
            .select('data, hrs_operacionais_seg, hrs_ocioso_seg')
            .eq('ano', selectedWeek.ano)
            .eq('semana_iso', selectedWeek.semana)
            .eq('desc_area', areaName),
          supabase.from('vw_c_semana_equip')
            .select('*')
            .eq('ano', selectedWeek.ano)
            .eq('semana_iso', selectedWeek.semana)
            .eq('desc_area', areaName)
        ]);

        if (resDaily.error) throw resDaily.error;
        if (resEquip.error) throw resEquip.error;

        if (mounted) {
          setDailyData(resDaily.data || []);
          setEquipData(resEquip.data || []);
        }
      } catch (err) {
        console.error('[COA] Erro no Modal Area:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchData();
    return () => { mounted = false; };
  }, [areaName, selectedWeek]);

  // Gráfico de Dias (SEG a DOM) para esta Área
  const chartData = useMemo(() => {
    const days = WEEK_DAYS.map(day => ({ desc_dia: day, ops: 0, oci: 0 }));
    dailyData.forEach(row => {
      const idx = getDayOfWeek(row.data);
      days[idx].ops += toNumber(row.hrs_operacionais_seg);
      days[idx].oci += toNumber(row.hrs_ocioso_seg);
    });
    return days.map(d => ({
      desc_dia: d.desc_dia,
      perc_ocioso: d.ops > 0 ? (d.oci / d.ops) * 100 : 0,
      hrs_ocioso: d.oci / 3600
    }));
  }, [dailyData]);

  // Construção da Hierarquia e Agregação
  const hierarchy = useMemo(() => {
    let hrsOperacionais = 0, hrsEfetivas = 0, hrsMotorLigado = 0, hrsOcioso = 0, hrsIndeter = 0;
    const frentesMap = new Map();
    const uniqueEquips = new Set();

    equipData.forEach(row => {
      // Totais da Área
      hrsOperacionais += toNumber(row.hrs_operacionais_seg);
      hrsEfetivas += toNumber(row.produtivo_seg);
      hrsMotorLigado += toNumber(row.hrs_motor_ligado_seg);
      hrsOcioso += toNumber(row.hrs_ocioso_seg);
      hrsIndeter += toNumber(row.indeter_seg);
      
      const codEquip = row.cod_equip || 'S/N';
      uniqueEquips.add(codEquip);
      
      // Agrupamento por Frente
      const frenteKey = row.desc_grupo || 'SEM FRENTE';
      if (!frentesMap.has(frenteKey)) {
        frentesMap.set(frenteKey, { desc_grupo: frenteKey, ops: 0, oci: 0, equipsMap: new Map() });
      }
      
      const frente = frentesMap.get(frenteKey);
      frente.ops += toNumber(row.hrs_operacionais_seg);
      frente.oci += toNumber(row.hrs_ocioso_seg);

      if (!frente.equipsMap.has(codEquip)) {
        frente.equipsMap.set(codEquip, { cod_equip: codEquip, ops: 0, oci: 0 });
      }
      const equip = frente.equipsMap.get(codEquip);
      equip.ops += toNumber(row.hrs_operacionais_seg);
      equip.oci += toNumber(row.hrs_ocioso_seg);
    });

    // Formatando arrays ordenados
    const frentes = [...frentesMap.values()].map(f => {
      const equipamentos = [...f.equipsMap.values()].map(e => ({
        cod_equip: e.cod_equip,
        perc_ocioso: e.ops > 0 ? (e.oci / e.ops) * 100 : 0
      })).sort((a, b) => b.perc_ocioso - a.perc_ocioso);

      return {
        desc_grupo: f.desc_grupo,
        qnt_equip: equipamentos.length,
        hrs_ocioso: f.oci / 3600,
        perc_ocioso: f.ops > 0 ? (f.oci / f.ops) * 100 : 0,
        equipamentos
      };
    }).sort((a, b) => b.hrs_ocioso - a.hrs_ocioso);

    return {
      summary: {
        hrs_operacionais: hrsOperacionais / 3600,
        hrs_efetivas: hrsEfetivas / 3600,
        hrs_motor_ligado: hrsMotorLigado / 3600,
        hrs_ocioso: hrsOcioso / 3600,
        perc_ocioso: hrsOperacionais > 0 ? (hrsOcioso / hrsOperacionais) * 100 : 0,
        hrs_indeter: hrsIndeter / 3600,
        perc_indeter: hrsOperacionais > 0 ? (hrsIndeter / hrsOperacionais) * 100 : 0,
        qnt_equip: uniqueEquips.size
      },
      areaNode: {
        desc_area: areaName,
        qnt_equip: uniqueEquips.size,
        hrs_ocioso: hrsOcioso / 3600,
        perc_ocioso: hrsOperacionais > 0 ? (hrsOcioso / hrsOperacionais) * 100 : 0,
        frentes
      }
    };
  }, [equipData, areaName]);

  const handleAccordionFrenteToggle = (frenteKey) => {
    setExpandedFrentes((prev) => prev.includes(frenteKey) ? prev.filter(k => k !== frenteKey) : [...prev, frenteKey]);
  };

  const handleEquipClick = (equip) => {
    setSelectedEquipModal(equip.cod_equip);
  };

  if (!selectedWeek || !areaName) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative coa-card w-full max-w-4xl h-[95vh] md:h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-[var(--coa-divider)]">
        
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-[rgba(255,255,255,0.05)] border text-[var(--coa-text-soft)] hover:text-[var(--coa-text)] hover:bg-[rgba(255,255,255,0.1)] transition-all z-20" style={{ borderColor: 'var(--coa-divider)' }}>
          ✕
        </button>

        <div className="coa-card__header pb-4 border-b border-[var(--coa-divider)] shrink-0">
          <div className="flex flex-col gap-1 pr-10">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">Detalhe Semanal por Área</span>
            <h2 className="text-[1.35rem] font-black uppercase tracking-tight text-[var(--coa-text)]">{areaName}</h2>
            <div className="flex gap-2 mt-1">
              <span className="coa-badge">Semana {selectedWeek.semana}/{selectedWeek.ano}</span>
            </div>
          </div>
        </div>

        <div className="coa-card__body flex-1 overflow-y-auto flex flex-col gap-5 p-4 md:p-6 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <div className="coa-loader-dots"><span /><span /><span /></div>
              <span className="coa-loader-text">Montando detalhe da área...</span>
            </div>
          ) : (
            <>
              {/* GRÁFICO DIÁRIO DA ÁREA */}
              <div className="coa-panel p-4 flex flex-col gap-2">
                <div className="flex flex-col">
                  <span className="text-sm font-black text-[var(--coa-text)] uppercase tracking-wide">Evolução Diária</span>
                  <span className="text-[10px] text-[var(--coa-text-muted)] font-bold">Motor Ocioso na Semana {selectedWeek.semana}</span>
                </div>
                <div className="h-[200px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 25, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--coa-border)" vertical={false} />
                      <XAxis dataKey="desc_dia" stroke="var(--coa-text-muted)" fontSize={11} tickLine={false} axisLine={false} dy={10} interval={0} />
                      <YAxis hide domain={[0, 'dataMax + 5']} />
                      <RechartsTooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }} />
                      <ReferenceLine y={5} stroke="rgba(61,220,151,0.5)" strokeDasharray="3 3" strokeWidth={2} />
                      <Bar dataKey="perc_ocioso" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} label={<CustomLabel />}>
                        {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={getOciosoColor(entry.perc_ocioso, 5)} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* CARDS */}
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                <MetricCard label="Hrs Operacionais" value={formatHours(hierarchy.summary.hrs_operacionais)} />
                <MetricCard label="Hrs Efetivas" value={formatHours(hierarchy.summary.hrs_efetivas)} />
                <MetricCard label="Motor Ligado" value={formatHours(hierarchy.summary.hrs_motor_ligado)} />
                <MetricCard label="Horas Ociosas" value={formatHours(hierarchy.summary.hrs_ocioso)} />
                <MetricCard label="Equipamentos" value={formatInt(hierarchy.summary.qnt_equip)} />
                <MetricCard label="% Ocioso" value={formatPercent(hierarchy.summary.perc_ocioso)} color={getOciosoColor(hierarchy.summary.perc_ocioso, 5)} />
              </div>

              <ProgressBarIndeterminado perc={hierarchy.summary.perc_indeter} hrs={hierarchy.summary.hrs_indeter} />

              {/* LISTA DE FRENTES / EQUIPAMENTOS */}
              <div className="flex flex-col gap-4 pt-2">
                <div className="flex flex-col gap-1">
                  <h2 className="text-[1.1rem] font-black uppercase tracking-tight leading-none text-[var(--coa-text)]">EQUIPAMENTOS</h2>
                  <span className="text-xs font-black text-[var(--coa-text-soft)]">Clique na frente para expandir</span>
                </div>

                <div className="flex flex-col gap-3">
                  <AreaRowModern area={hierarchy.areaNode} expanded={true}>
                    {hierarchy.areaNode.frentes.map(frente => {
                      const isExpanded = expandedFrentes.includes(frente.desc_grupo);
                      return (
                        <FrenteRowModern key={frente.desc_grupo} frente={frente} expanded={isExpanded} onToggle={() => handleAccordionFrenteToggle(frente.desc_grupo)}>
                          <div className="flex flex-col gap-1.5">
                            {frente.equipamentos.map(equip => (
                              <EquipamentoRowModern key={equip.cod_equip} item={equip} onOpen={() => handleEquipClick(equip)} />
                            ))}
                          </div>
                        </FrenteRowModern>
                      );
                    })}
                  </AreaRowModern>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* AQUI ENTRA O NOSSO NOVO MODAL DE EQUIPAMENTO */}
      {selectedEquipModal && (
        <OciosoDetailSemanalEquip
          equipCode={selectedEquipModal}
          selectedWeek={selectedWeek}
          onClose={() => setSelectedEquipModal(null)}
        />
      )}

    </div>
  );
};

export default OciosoDetailSemanalArea;