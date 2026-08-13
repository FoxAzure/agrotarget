// ================================= DOCUMENTATION ------------------------------------------
// Script: OciosoDetailSemanal
// Purpose: Visão detalhada do Ocioso Semanal usando vw_c_semana_area e vw_c_semana_data.
// Relationships: vw_c_semana_area (base/histórico), vw_c_semana_data (gráfico Seg-Dom), WeekSelectorCOA.
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import WeekSelectorCOA from '../../../components/COACenter/WeekSelectorCOA';
import OciosoDetailSemanalArea from './OciosoDetailSemanalArea';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, LineChart, Line
} from 'recharts';

// ================= HELPERS & CONSTANTS =================

const DEFAULT_CATEGORIES = ['AGRÍCOLA', 'APOIO'];
const CATEGORY_ORDER = ['AGRÍCOLA', 'APOIO', 'INDÚSTRIAL', 'OFICINA'];
const WEEK_DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatHours = (value) => `${Number(value || 0).toFixed(1)}h`;
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

const getOciosoColor = (value, target = 5) => {
  const safe = Number(value || 0);
  return safe <= target ? 'var(--coa-success)' : 'var(--coa-danger)';
};

// Transforma DD/MM/YYYY em Dia da Semana (0=Seg, 6=Dom)
const getDayOfWeek = (brDate) => {
  if (!brDate || typeof brDate !== 'string') return 0;
  const [d, m, y] = brDate.split('/');
  const date = new Date(y, m - 1, d);
  const jsDay = date.getDay(); 
  return (jsDay + 6) % 7; 
};

// ================= COMPONENTES MENORES =================

const MetricCard = ({ label, value, color = 'var(--coa-text)' }) => (
  <div className="rounded-[14px] border px-3 py-3 bg-[rgba(255,255,255,0.02)] flex flex-col justify-center transition-all" style={{ borderColor: 'var(--coa-divider)' }}>
    <span className="block text-[10px] md:text-[11px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)] mb-1">
      {label}
    </span>
    <span className="block text-[1.1rem] md:text-[1.25rem] font-black tracking-tight leading-none" style={{ color }}>
      {value}
    </span>
  </div>
);

const ProgressBarIndeterminado = ({ perc, hrs }) => {
  const safePerc = Number(perc) || 0;
  const isDanger = safePerc > 10;
  const barColor = isDanger ? 'var(--coa-danger)' : 'var(--coa-success)';

  return (
    <div className="rounded-[14px] border px-4 py-4 bg-[rgba(255,255,255,0.02)] flex flex-col gap-3 shadow-sm transition-all mt-2" style={{ borderColor: 'var(--coa-divider)' }}>
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">
          Indeterminado
        </span>
        <div className="flex items-center gap-2 text-[1rem] font-black tracking-tight">
          <span style={{ color: 'var(--coa-text)' }}>{formatHours(hrs)}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--coa-text-muted)] opacity-50"></span>
          <span className="transition-colors" style={{ color: barColor }}>
            {formatPercent(safePerc)}
          </span>
        </div>
      </div>
      
      <div className="w-full h-2 rounded-full overflow-hidden flex bg-[rgba(255,255,255,0.05)] shadow-inner">
        <div className="h-full transition-all duration-700 ease-out" style={{ width: `${Math.min(safePerc, 100)}%`, backgroundColor: barColor }} />
      </div>
    </div>
  );
};

const CategoryFilter = ({ categoryOptions = [], selectedCategories = [], onToggle, isOpen, onToggleOpen }) => (
  <div className="coa-panel p-3 md:p-4 flex flex-col gap-3">
    <button type="button" onClick={onToggleOpen} className="w-full flex items-center justify-between gap-3 text-left">
      <div className="flex flex-col gap-1">
        <span className="coa-text-micro">Filtro</span>
        <span className="text-sm font-black text-[var(--coa-text)]">Categorias</span>
      </div>
      <span className="coa-badge">
        {isOpen ? 'Ocultar' : `${selectedCategories.length} ativas`}
      </span>
    </button>

    {isOpen && (
      <div className="flex flex-col gap-2">
        {categoryOptions.map((category) => {
          const checked = selectedCategories.includes(category);
          return (
            <label key={category} className="inline-flex items-center gap-2 px-3 py-2 rounded-[14px] border text-sm font-bold cursor-pointer"
              style={{
                borderColor: checked ? 'rgba(61,220,151,0.28)' : 'var(--coa-border)',
                background: checked ? 'rgba(61,220,151,0.10)' : 'rgba(255,255,255,0.02)',
                color: checked ? 'var(--coa-text)' : 'var(--coa-text-soft)',
              }}>
              <input type="checkbox" className="hidden" checked={checked} onChange={() => onToggle(category)} />
              <span>{category}</span>
            </label>
          );
        })}
      </div>
    )}
  </div>
);

// TOOLTIPS E RÓTULOS CUSTOMIZADOS PARA OS GRÁFICOS
const CustomLabel = (props) => {
  const { x, y, width, value } = props;
  if (x == null || y == null || value == null) return null;
  const color = getOciosoColor(value, 5);
  return (
    <text x={x + (width ? width / 2 : 0)} y={y} dy={-8} fill={color} fontSize={10} fontWeight="900" textAnchor="middle">
      {`${Number(value).toFixed(1)}%`}
    </text>
  );
};

const CustomLineLabel = (props) => {
  const { x, y, value } = props;
  if (x == null || y == null || value == null) return null;
  const color = getOciosoColor(value, 5);
  return (
    <text x={x} y={y} dy={-12} fill={color} fontSize={10} fontWeight="900" textAnchor="middle">
      {`${Number(value).toFixed(1)}%`}
    </text>
  );
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

const CustomLineTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const color = getOciosoColor(data.perc_ocioso, 5);
    return (
      <div className="coa-panel p-3 border shadow-lg flex flex-col gap-1" style={{ borderColor: 'var(--coa-border)' }}>
        <p className="coa-text-micro mb-1">{data.label}</p>
        <p className="text-sm font-black" style={{ color }}>Motor Ocioso: {Number(data.perc_ocioso || 0).toFixed(1)}%</p>
      </div>
    );
  }
  return null;
};

// ================= EXECUTOR =================

const OciosoDetailSemanal = () => {
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [rawAreaHistory, setRawAreaHistory] = useState([]); 
  const [rawDailyData, setRawDailyData] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [selectedCategories, setSelectedCategories] = useState(DEFAULT_CATEGORIES);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState([]);
  
  const [modalArea, setModalArea] = useState(null);

  useEffect(() => {
    let mounted = true;
    const fetchMassiveData = async () => {
      try {
        setLoading(true);
        const { data, error: fetchError } = await supabase
          .from('vw_c_semana_area')
          .select('*')
          .order('ano', { ascending: false })
          .order('semana_iso', { ascending: false })
          .limit(2000); 

        if (fetchError) throw fetchError;
        
        // Remove EMPACOTAMENTO
        const filteredData = (data || []).filter(r => r.desc_area !== 'EMPACOTAMENTO' && r.categoria !== 'EMPACOTAMENTO');
        if (mounted) setRawAreaHistory(filteredData);
      } catch (err) {
        if (mounted) setError('Falha ao buscar histórico de áreas semanais.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchMassiveData();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchDailyData = async () => {
      if (!selectedWeek) return;
      try {
        const { data, error: fetchError } = await supabase
          .from('vw_c_semana_data')
          .select('data, hrs_operacionais_seg, hrs_ocioso_seg, categoria, desc_area')
          .eq('ano', selectedWeek.ano)
          .eq('semana_iso', selectedWeek.semana);

        if (fetchError) throw fetchError;

        // Remove EMPACOTAMENTO
        const filteredData = (data || []).filter(r => r.desc_area !== 'EMPACOTAMENTO' && r.categoria !== 'EMPACOTAMENTO');
        if (mounted) setRawDailyData(filteredData);
      } catch (err) {
        console.error('[COA] Erro ao carregar vw_c_semana_data diário:', err);
      }
    };
    fetchDailyData();
    return () => { mounted = false; };
  }, [selectedWeek]);

  const currentWeekData = useMemo(() => {
    if (!selectedWeek || !rawAreaHistory.length) return [];
    return rawAreaHistory.filter(row => 
      row.ano === selectedWeek.ano && 
      row.semana_iso === selectedWeek.semana &&
      selectedCategories.includes(row.categoria)
    );
  }, [rawAreaHistory, selectedWeek, selectedCategories]);

  const categoryOptions = useMemo(() => {
    const values = [...new Set(rawAreaHistory.map((row) => row.categoria).filter(Boolean))];
    return values.sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b, 'pt-BR');
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [rawAreaHistory]);

  const areaTableRows = useMemo(() => {
    const areaMap = new Map();
    currentWeekData.forEach(row => {
      const area = row.desc_area || 'SEM ÁREA';
      if (!areaMap.has(area)) areaMap.set(area, { desc_area: area, ops: 0, oci: 0 });
      const acc = areaMap.get(area);
      acc.ops += toNumber(row.hrs_operacionais_seg);
      acc.oci += toNumber(row.hrs_ocioso_seg);
    });

    return [...areaMap.values()].map(a => ({
      desc_area: a.desc_area,
      hrs_ocioso: a.oci / 3600,
      perc_ocioso: a.ops > 0 ? (a.oci / a.ops) * 100 : 0
    })).sort((a, b) => b.hrs_ocioso - a.hrs_ocioso);
  }, [currentWeekData]);

  const filteredCurrentWeek = useMemo(() => {
    if (!selectedAreas.length) return currentWeekData;
    return currentWeekData.filter(row => selectedAreas.includes(row.desc_area));
  }, [currentWeekData, selectedAreas]);

  const summary = useMemo(() => {
    let hrsOperacionais = 0;
    let hrsEfetivas = 0;
    let hrsMotorLigado = 0;
    let hrsOcioso = 0;
    let hrsIndeter = 0;
    let registrosCount = filteredCurrentWeek.length; 

    filteredCurrentWeek.forEach(row => {
      hrsOperacionais += toNumber(row.hrs_operacionais_seg);
      hrsEfetivas += toNumber(row.produtivo_seg); 
      hrsMotorLigado += toNumber(row.hrs_motor_ligado_seg);
      hrsOcioso += toNumber(row.hrs_ocioso_seg);
      hrsIndeter += toNumber(row.indeter_seg);
    });

    return {
      hrs_operacionais: hrsOperacionais / 3600,
      hrs_efetivas: hrsEfetivas / 3600,
      hrs_motor_ligado: hrsMotorLigado / 3600,
      hrs_ocioso: hrsOcioso / 3600,
      hrs_indeter: hrsIndeter / 3600,
      perc_ocioso: hrsOperacionais > 0 ? (hrsOcioso / hrsOperacionais) * 100 : 0,
      perc_indeter: hrsOperacionais > 0 ? (hrsIndeter / hrsOperacionais) * 100 : 0,
      registros: registrosCount
    };
  }, [filteredCurrentWeek]);

  const dailyChartData = useMemo(() => {
    const filteredDaily = rawDailyData.filter(row => 
      selectedCategories.includes(row.categoria) &&
      (selectedAreas.length === 0 || selectedAreas.includes(row.desc_area))
    );
    const days = WEEK_DAYS.map(day => ({ desc_dia: day, ops: 0, oci: 0 }));
    filteredDaily.forEach(row => {
      const idx = getDayOfWeek(row.data);
      days[idx].ops += toNumber(row.hrs_operacionais_seg);
      days[idx].oci += toNumber(row.hrs_ocioso_seg);
    });
    return days.map(d => ({
      desc_dia: d.desc_dia,
      perc_ocioso: d.ops > 0 ? (d.oci / d.ops) * 100 : 0,
      hrs_ocioso: d.oci / 3600
    }));
  }, [rawDailyData, selectedCategories, selectedAreas]);

  const historyChartData = useMemo(() => {
    if (!selectedWeek || !rawAreaHistory.length) return [];
    const uniqueWeeks = [];
    const weekSet = new Set();
    
    for (const row of rawAreaHistory) {
      const key = `${row.ano}-${row.semana_iso}`;
      if (row.ano < selectedWeek.ano || (row.ano === selectedWeek.ano && row.semana_iso <= selectedWeek.semana)) {
        if (!weekSet.has(key)) {
          weekSet.add(key);
          uniqueWeeks.push({ ano: row.ano, semana_iso: row.semana_iso, label: `Sem ${String(row.semana_iso).padStart(2, '0')}/${String(row.ano).slice(-2)}` });
        }
      }
      if (uniqueWeeks.length === 10) break;
    }

    const history = uniqueWeeks.map(wk => {
      let ops = 0, oci = 0;
      const rowsForWk = rawAreaHistory.filter(r => 
        r.ano === wk.ano && 
        r.semana_iso === wk.semana_iso && 
        selectedCategories.includes(r.categoria) &&
        (selectedAreas.length === 0 || selectedAreas.includes(r.desc_area))
      );
      rowsForWk.forEach(r => {
        ops += toNumber(r.hrs_operacionais_seg);
        oci += toNumber(r.hrs_ocioso_seg);
      });
      return {
        label: wk.label,
        perc_ocioso: ops > 0 ? (oci / ops) * 100 : 0
      };
    });
    return history.reverse();
  }, [rawAreaHistory, selectedWeek, selectedCategories, selectedAreas]);

  const handleCategoryToggle = (category) => {
    setSelectedAreas([]);
    setSelectedCategories((prev) => prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category]);
  };

  const handleAreaToggle = (areaName) => {
    setSelectedAreas((prev) => prev.includes(areaName) ? prev.filter((item) => item !== areaName) : [...prev, areaName]);
  };

  return (
    <div className="flex flex-col gap-4 animate-in slide-in-from-left-4 duration-300 relative">
      <div className="flex justify-end">
        <div className="w-full max-w-sm md:max-w-md">
          <WeekSelectorCOA value={selectedWeek} onChange={setSelectedWeek} />
        </div>
      </div>

      {loading ? (
        <div className="coa-panel py-20 flex flex-col items-center justify-center gap-3">
          <div className="coa-loader-dots"><span /><span /><span /></div>
          <span className="coa-loader-text">Analisando dados semanais...</span>
        </div>
      ) : error ? (
        <div className="coa-panel p-6 text-center text-sm font-bold text-[var(--coa-danger)]">{error}</div>
      ) : (
        <>
          <CategoryFilter categoryOptions={categoryOptions} selectedCategories={selectedCategories} onToggle={handleCategoryToggle} isOpen={isCategoryOpen} onToggleOpen={() => setIsCategoryOpen((prev) => !prev)} />

          <div className="coa-panel p-0 overflow-hidden">
            <div className="grid grid-cols-[1fr_0.8fr_0.8fr_60px] md:grid-cols-[1.5fr_1fr_1fr_80px] gap-2 px-3 md:px-5 py-2 border-b items-center bg-[rgba(255,255,255,0.01)]" style={{ borderColor: 'var(--coa-divider)' }}>
              <span className="text-[10px] md:text-xs font-black text-[var(--coa-text-muted)] uppercase tracking-wider text-left">Área</span>
              <span className="text-[10px] md:text-xs font-black text-[var(--coa-text-muted)] uppercase tracking-wider text-right pr-1">Ocioso</span>
              <span className="text-[10px] md:text-xs font-black text-[var(--coa-text-muted)] uppercase tracking-wider text-right pr-2">% Ocioso</span>
              <span className="text-[10px] md:text-xs font-black text-[var(--coa-text-muted)] uppercase tracking-wider text-center w-full">Ação</span>
            </div>

            <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
              {areaTableRows.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm font-bold text-[var(--coa-text-muted)]">Nenhuma área encontrada.</div>
              ) : (
                areaTableRows.map((row) => {
                  const active = selectedAreas.includes(row.desc_area);
                  return (
                    // Padding reduzido aqui (py-1.5 md:py-2) para não ficar espaçosa demais
                    <div key={row.desc_area} className="grid grid-cols-[1fr_0.8fr_0.8fr_60px] md:grid-cols-[1.5fr_1fr_1fr_80px] items-center gap-2 px-3 md:px-5 py-1.5 md:py-2 border-b transition-colors group"
                      style={{ borderColor: 'var(--coa-divider)', background: active ? 'rgba(61,220,151,0.08)' : 'transparent' }}>
                      
                      <button type="button" onClick={() => handleAreaToggle(row.desc_area)} className="w-full text-left truncate pr-2">
                        <span className="text-xs md:text-sm font-black text-[var(--coa-text)] group-hover:text-[var(--coa-accent)] transition-colors">{row.desc_area}</span>
                      </button>
                      <span className="text-xs md:text-sm font-black text-right pr-1 text-[var(--coa-text-soft)]">{formatHours(row.hrs_ocioso)}</span>
                      <span className="text-xs md:text-sm font-black text-right pr-2" style={{ color: getOciosoColor(row.perc_ocioso, 5) }}>{formatPercent(row.perc_ocioso)}</span>
                      
                      <div className="flex justify-center w-full">
                        <button type="button" onClick={() => setModalArea(row.desc_area)} className="coa-btn coa-btn--ghost text-[9px] uppercase tracking-wider !px-1.5 !py-1 w-full text-center">
                          Detalhe
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <MetricCard label="Hrs Operacionais" value={formatHours(summary.hrs_operacionais)} />
            <MetricCard label="Hrs Efetivas" value={formatHours(summary.hrs_efetivas)} />
            <MetricCard label="Motor Ligado" value={formatHours(summary.hrs_motor_ligado)} />
            <MetricCard label="Horas Ociosas" value={formatHours(summary.hrs_ocioso)} />
            <MetricCard label="Registros (Grupos)" value={summary.registros > 0 ? summary.registros : '--'} />
            <MetricCard label="% Motor Ocioso" value={formatPercent(summary.perc_ocioso)} color={getOciosoColor(summary.perc_ocioso, 5)} />
          </div>

          <ProgressBarIndeterminado perc={summary.perc_indeter} hrs={summary.hrs_indeter} />

          <div className="coa-panel p-4 flex flex-col gap-2 mt-2">
            <div className="flex flex-col">
              <span className="text-sm font-black text-[var(--coa-text)] uppercase tracking-wide">Motor Ocioso Diário</span>
              <span className="text-[10px] text-[var(--coa-text-muted)] font-bold">Evolução (SEG - DOM) na {selectedWeek?.label} (Meta 5%)</span>
            </div>
            <div className="h-[280px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyChartData} margin={{ top: 25, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--coa-border)" vertical={false} />
                  <XAxis dataKey="desc_dia" stroke="var(--coa-text-muted)" fontSize={11} tickLine={false} axisLine={false} dy={10} interval={0} padding={{ left: 20, right: 20 }} />
                  <YAxis hide domain={[0, 'dataMax + 5']} />
                  <RechartsTooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }} />
                  <ReferenceLine y={5} stroke="rgba(61,220,151,0.5)" strokeDasharray="3 3" strokeWidth={2} />
                  <Bar dataKey="perc_ocioso" radius={[4, 4, 0, 0]} maxBarSize={50} isAnimationActive={false} label={<CustomLabel />}>
                    {dailyChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={getOciosoColor(entry.perc_ocioso, 5)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="coa-panel p-4 flex flex-col gap-2 mt-2">
            <div className="flex flex-col">
              <span className="text-sm font-black text-[var(--coa-text)] uppercase tracking-wide">Evolução Semanal - Motor Ocioso</span>
              <span className="text-[10px] text-[var(--coa-text-muted)] font-bold">Últimas 10 semanas a partir de {selectedWeek?.label}</span>
            </div>
            <div className="h-[280px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyChartData} margin={{ top: 25, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--coa-border)" vertical={false} />
                  <XAxis dataKey="label" stroke="var(--coa-text-muted)" fontSize={11} tickLine={false} axisLine={false} dy={10} padding={{ left: 20, right: 20 }} />
                  <YAxis hide domain={[0, 'dataMax + 5']} />
                  <RechartsTooltip content={<CustomLineTooltip />} cursor={{ stroke: 'var(--coa-border)', strokeWidth: 1, strokeDasharray: '5 5' }} />
                  <ReferenceLine y={5} stroke="rgba(61,220,151,0.5)" strokeDasharray="3 3" strokeWidth={2} />
                  <Line type="monotone" dataKey="perc_ocioso" stroke="var(--coa-text-soft)" strokeWidth={2} isAnimationActive={false} label={<CustomLineLabel />}
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      if (cx == null || cy == null) return null;
                      return <circle cx={cx} cy={cy} r={5} fill={getOciosoColor(payload.perc_ocioso, 5)} stroke="var(--coa-bg-soft)" strokeWidth={2} />;
                    }}
                    activeDot={{ r: 7, stroke: 'var(--coa-text)', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {modalArea && (
        <OciosoDetailSemanalArea areaName={modalArea} selectedWeek={selectedWeek} onClose={() => setModalArea(null)} />
      )}
    </div>
  );
};

export default OciosoDetailSemanal;