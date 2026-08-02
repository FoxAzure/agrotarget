import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

/* ==========================================================================
   CONFIG VISUAL & REGRAS
   ========================================================================== */

const INDETER_META = 10; // <= 10% Verde, > 10% Vermelho

const COLOR_SUCCESS = 'var(--coa-success)';
const COLOR_DANGER = 'var(--coa-danger)';
const COLOR_DIVIDER = 'var(--coa-divider)';

const DETAIL_COLUMNS = [
  'data',
  'cod_equip',
  'desc_equip',
  'desc_area',
  'desc_grupo',
  'hrs_indeter_seg',
  'hrs_operacionais_seg',
].join(',');

/* ==========================================================================
   HELPERS
   ========================================================================== */

const isoToBr = (isoDate) => {
  if (!isoDate || typeof isoDate !== 'string') return '';
  if (isoDate.includes('/')) return isoDate;
  if (!isoDate.includes('-')) return '';
  const [yyyy, mm, dd] = isoDate.split('-');
  return `${dd}/${mm}/${yyyy}`;
};

const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

const formatHHMM = (valueInHours) => {
  const totalMinutes = Math.max(0, Math.round(Number(valueInHours || 0) * 60));
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

const getIndeterColor = (value) => {
  return Number(value || 0) <= INDETER_META ? COLOR_SUCCESS : COLOR_DANGER;
};

const getIndeterTint = (value, alpha = 0.10) => {
  return Number(value || 0) <= INDETER_META 
    ? `rgba(61,220,151,${alpha})` 
    : `rgba(239,68,68,${alpha})`;
};

const getLast7DaysFromIso = (isoDate) => {
  const datesBr = [];
  const labels = [];
  const base = new Date(`${isoDate}T12:00:00Z`);

  for (let i = 6; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);

    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = d.getUTCFullYear();
    const br = `${dd}/${mm}/${yyyy}`;

    datesBr.push(br);
    labels.push({ full: br, short: `${dd}/${mm}` });
  }
  return { datesBr, labels };
};

const aggregateRows = (rows = []) => {
  const total = rows.reduce(
    (acc, row) => {
      acc.hrs_operacionais_seg += Number(row.hrs_operacionais_seg) || 0;
      acc.hrs_indeter_seg += Number(row.hrs_indeter_seg) || 0;
      return acc;
    },
    { hrs_operacionais_seg: 0, hrs_indeter_seg: 0 }
  );

  const hrsOperacionais = total.hrs_operacionais_seg / 3600;
  const hrsIndeter = total.hrs_indeter_seg / 3600;

  const percIndeter = total.hrs_operacionais_seg > 0
    ? (total.hrs_indeter_seg / total.hrs_operacionais_seg) * 100
    : 0;

  return {
    hrs_operacionais: hrsOperacionais,
    hrs_indeter: hrsIndeter,
    perc_indeter: percIndeter,
  };
};

/* ==========================================================================
   COMPONENTES AUXILIARES DE GRÁFICO
   ========================================================================== */

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const color = getIndeterColor(data.perc_indeter);

  return (
    <div className="coa-panel p-3 border shadow-lg" style={{ borderColor: COLOR_DIVIDER }}>
      <p className="coa-text-micro mb-2">{data.fullDate}</p>
      <p className="text-sm font-black" style={{ color }}>
        % Indeterminado: {formatPercent(data.perc_indeter)}
      </p>
      <p className="text-xs font-bold text-[var(--coa-text-soft)] mt-1">
        Operacional: {formatHHMM(data.hrs_operacionais)}
      </p>
      <p className="text-xs font-bold text-[var(--coa-text-soft)] mt-1">
        Indeterminado: {formatHHMM(data.hrs_indeter)}
      </p>
    </div>
  );
};

const CustomLabel = (props) => {
  const { x, y, width, value } = props;
  if (x === undefined || y === undefined || value === undefined) return null;

  const color = getIndeterColor(value);
  const centerX = x + width / 2;

  return (
    <text
      x={centerX}
      y={y}
      dy={-8}
      fill={color}
      fontSize={12}
      fontWeight="900"
      textAnchor="middle"
    >
      {`${Number(value || 0).toFixed(1)}%`}
    </text>
  );
};

/* ==========================================================================
   COMPONENTE PRINCIPAL
   ========================================================================== */

const IndeterDetailDiarioModal = ({ item, selectedDate, onClose }) => {
  const [historyRows, setHistoryRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const { datesBr, labels } = useMemo(
    () => getLast7DaysFromIso(selectedDate),
    [selectedDate]
  );

  const selectedBrDate = useMemo(() => isoToBr(selectedDate), [selectedDate]);

  useEffect(() => {
    let mounted = true;

    const loadDetails = async () => {
      if (!item?.cod_equip || !selectedDate) return;

      try {
        setLoading(true);
        const codigoEquip = String(item.cod_equip || '').trim();

        const { data, error } = await supabase
          .from('vw_c_indeterminado')
          .select(DETAIL_COLUMNS)
          .in('data', datesBr)
          .eq('cod_equip', codigoEquip);

        if (error) throw error;
        if (!mounted) return;

        setHistoryRows(data || []);
      } catch (err) {
        console.error('[COA] Erro ao carregar histórico Indeterminado:', err);
        if (mounted) setHistoryRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadDetails();

    return () => {
      mounted = false;
    };
  }, [item, selectedDate, datesBr]);

  const dailyRows = useMemo(() => {
    return historyRows.filter((row) => row.data === selectedBrDate);
  }, [historyRows, selectedBrDate]);

  const fallbackDailyAgg = useMemo(() => ({
    hrs_operacionais: Number(item?.hrs_operacionais) || 0,
    hrs_indeter: Number(item?.hrs_indeter) || 0,
    perc_indeter: Number(item?.perc_indeter) || 0,
  }), [item]);

  const selectedDaySummary = useMemo(() => {
    if (dailyRows.length > 0) return aggregateRows(dailyRows);
    return fallbackDailyAgg;
  }, [dailyRows, fallbackDailyAgg]);

  const chartData = useMemo(() => {
    return labels.map((dateLabel) => {
      const dayRows = historyRows.filter((row) => row.data === dateLabel.full);
      const agg = aggregateRows(dayRows);

      return {
        label: dateLabel.short,
        fullDate: dateLabel.full,
        hrs_operacionais: agg.hrs_operacionais,
        hrs_indeter: agg.hrs_indeter,
        perc_indeter: agg.perc_indeter,
      };
    });
  }, [historyRows, labels]);

  if (!item) return null;

  const headerArea = item?.desc_area || dailyRows[0]?.desc_area || historyRows[0]?.desc_area || 'SEM ÁREA';
  const headerFrente = item?.desc_grupo || dailyRows[0]?.desc_grupo || historyRows[0]?.desc_grupo || 'SEM FRENTE';
  const headerDate = selectedDate ? isoToBr(selectedDate) : '--/--/----';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative coa-card w-full max-w-4xl h-[60vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-[rgba(255,255,255,0.04)] border text-[var(--coa-text-soft)] hover:text-white hover:bg-[var(--coa-danger)] transition-all z-20"
          style={{ borderColor: COLOR_DIVIDER }}
        >
          ✕
        </button>

        <div className="h-full flex flex-col min-h-0">
          <div className="coa-card__header pb-3 border-b" style={{ borderColor: COLOR_DIVIDER }}>
            <div className="flex flex-col gap-2 pr-10">
              <span className="coa-text-micro">Tempo Indeterminado - 7 Dias</span>
              <div className="flex flex-col gap-1">
                <h2 className="coa-text-title !mb-0 text-[1.4rem]">
                  {item.cod_equip || 'SEM CÓDIGO'}
                </h2>
                <span className="text-sm font-bold text-[var(--coa-text-muted)]">
                  {item.desc_equip || dailyRows[0]?.desc_equip || historyRows[0]?.desc_equip || 'SEM DESCRIÇÃO'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="coa-badge">{headerArea}</span>
                <span className="coa-badge">{headerFrente}</span>
                <span className="coa-badge">{headerDate}</span>
                {/*
                <span
                  className="coa-badge font-black"
                  style={{
                    color: getIndeterColor(selectedDaySummary.perc_indeter),
                    borderColor: getIndeterColor(selectedDaySummary.perc_indeter),
                    background: getIndeterTint(selectedDaySummary.perc_indeter, 0.10),
                  }}
                >
                  {formatPercent(selectedDaySummary.perc_indeter)} no dia
                </span>*/}
              </div>
            </div>
          </div>

          <div className="coa-card__body flex-1 min-h-0 flex flex-col p-5">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center gap-3">
                <div className="coa-loader-dots" aria-label="Carregando">
                  <span /><span /><span />
                </div>
                <span className="coa-loader-text">Carregando histórico do equipamento...</span>
              </div>
            ) : (
              <div className="flex-1 w-full flex flex-col gap-2">
                <div className="h-full w-full min-h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 24, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--coa-border)"
                        vertical={false}
                      />
                      
                      {/* padding left e right evita que as extremidades sejam cortadas */}
                      <XAxis
                        dataKey="label"
                        stroke="var(--coa-text-muted)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                        padding={{ left: 20, right: 20 }}
                      />
                      
                      <YAxis hide domain={[0, 'dataMax + 5']} />
                      
                      <Tooltip
                        content={<CustomTooltip />}
                        cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
                      />
                      
                      <Bar
                        dataKey="perc_indeter"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={55}
                        label={<CustomLabel />}
                        isAnimationActive={false}
                      >
                        {chartData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={getIndeterColor(entry.perc_indeter)} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IndeterDetailDiarioModal;