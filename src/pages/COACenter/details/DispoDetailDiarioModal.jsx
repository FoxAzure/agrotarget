import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

/* ==========================================================================
   CONFIG VISUAL
   ========================================================================== */

const COLOR_SUCCESS = 'var(--coa-success)';
const COLOR_WARNING = 'var(--coa-warning, #f59e0b)';
const COLOR_DANGER = 'var(--coa-danger)';
const COLOR_DANGER_STRONG = '#ff4d4f';
const COLOR_TEXT = 'var(--coa-text)';
const COLOR_TEXT_SOFT = 'var(--coa-text-soft)';
const COLOR_TEXT_MUTED = 'var(--coa-text-muted)';
const COLOR_DIVIDER = 'var(--coa-divider)';
const COLOR_PANEL_BG = 'rgba(255,255,255,0.02)';

const DISPO_META_VERDE = 90;
const DISPO_META_AMARELA = 80;

const DETAIL_COLUMNS = [
  'data',
  'cod_equip',
  'desc_equip',
  'desc_area',
  'desc_grupo',
  'cod_op',
  'hrs_operacionais_seg',
  'hrs_disp_seg',
  'manutencao_seg',
  'status',
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

const brToIso = (brDate) => {
  if (!brDate || typeof brDate !== 'string' || !brDate.includes('/')) return '';
  const [dd, mm, yyyy] = brDate.split('/');
  return `${yyyy}-${mm}-${dd}`;
};

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

const formatHours = (value) => `${Number(value || 0).toFixed(1)}h`;

const formatHHMM = (valueInHours) => {
  const totalMinutes = Math.max(0, Math.round(Number(valueInHours || 0) * 60));
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

const getDispoColor = (value) => {
  const safe = Number(value || 0);
  if (safe >= DISPO_META_VERDE) return COLOR_SUCCESS;
  if (safe >= DISPO_META_AMARELA) return COLOR_WARNING;
  return COLOR_DANGER;
};

const getDispoTint = (value, alpha = 0.10) => {
  const safe = Number(value || 0);
  if (safe >= DISPO_META_VERDE) return `rgba(61,220,151,${alpha})`;
  if (safe >= DISPO_META_AMARELA) return `rgba(245,158,11,${alpha})`;
  return `rgba(239,68,68,${alpha})`;
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
    labels.push({
      full: br,
      short: `${dd}/${mm}`,
      iso: `${yyyy}-${mm}-${dd}`,
    });
  }

  return { datesBr, labels };
};

const normalizeDetailRow = (row = {}) => ({
  ...row,
  cod_equip: String(row.cod_equip || '').trim(),
  cod_op: String(row.cod_op || '').trim(),
  hrs_operacionais_seg: toNumber(row.hrs_operacionais_seg),
  hrs_disp_seg: toNumber(row.hrs_disp_seg),
  manutencao_seg: toNumber(row.manutencao_seg),
});

const aggregateRows = (rows = []) => {
  const total = rows.reduce(
    (acc, row) => {
      acc.hrs_operacionais_seg += toNumber(row.hrs_operacionais_seg);
      acc.hrs_disp_seg += toNumber(row.hrs_disp_seg);
      acc.manutencao_seg += toNumber(row.manutencao_seg);
      return acc;
    },
    {
      hrs_operacionais_seg: 0,
      hrs_disp_seg: 0,
      manutencao_seg: 0,
    }
  );

  const hrsOperacionais = total.hrs_operacionais_seg / 3600;
  const hrsDisponiveis = total.hrs_disp_seg / 3600;
  const hrsManutencao = total.manutencao_seg / 3600;

  const percDisp =
    total.hrs_operacionais_seg > 0
      ? Math.max(0, 1 - total.manutencao_seg / total.hrs_operacionais_seg) * 100
      : 0;

  const percManut =
    total.hrs_operacionais_seg > 0
      ? (total.manutencao_seg / total.hrs_operacionais_seg) * 100
      : 0;

  return {
    hrs_operacionais: hrsOperacionais,
    hrs_disponiveis: hrsDisponiveis,
    hrs_manutencao: hrsManutencao,
    perc_disp: percDisp,
    perc_manutencao: percManut,
  };
};

/* ==========================================================================
   COMPONENTES AUXILIARES
   ========================================================================== */

const SummaryItem = ({ label, value, color }) => (
  <div
    className="flex flex-col justify-end border-b pb-2 min-w-[120px]"
    style={{ borderColor: COLOR_DIVIDER }}
  >
    <span className="text-[8px] font-black text-[var(--coa-text-muted)] uppercase tracking-widest mb-1">
      {label}
    </span>
    <span
      className="text-[15px] font-black tracking-tight leading-none"
      style={{ color: color || COLOR_TEXT }}
    >
      {value}
    </span>
  </div>
);

const MiniMetricCard = ({ label, value, color = COLOR_TEXT, hint }) => (
  <div
    className="rounded-[14px] border px-3 py-3 bg-[rgba(255,255,255,0.02)] flex flex-col justify-between min-h-[82px]"
    style={{ borderColor: COLOR_DIVIDER }}
  >
    <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)] mb-1">
      {label}
    </span>

    <span className="block text-[1.15rem] font-black tracking-tight leading-none" style={{ color }}>
      {value}
    </span>

    {hint && (
      <span className="block text-[10px] font-bold text-[var(--coa-text-muted)] mt-2">
        {hint}
      </span>
    )}
  </div>
);

const ProgressBar = ({ value, color }) => {
  const safeValue = Math.min(Math.max(Number(value || 0), 0), 100);

  return (
    <div
      className="w-full h-2 rounded-full overflow-hidden border"
      style={{
        background: 'rgba(255,255,255,0.03)',
        borderColor: COLOR_DIVIDER,
      }}
    >
      <div
        className="h-full rounded-full transition-all duration-[900ms] ease-out"
        style={{
          width: `${safeValue}%`,
          backgroundColor: color,
          boxShadow: safeValue > 0 ? `0 0 8px ${color}60` : 'none',
        }}
      />
    </div>
  );
};

const AnalysisListItem = ({ text, type = 'good' }) => {
  const colorMap = {
    good: '#7ae3b5',
    bad: '#ff7d7d',
    warning: '#f6d66d',
    info: COLOR_TEXT_SOFT,
  };

  return (
    <div
      className="text-sm font-bold leading-relaxed"
      style={{ color: colorMap[type] || colorMap.info }}
    >
      • {text}
    </div>
  );
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;

  return (
    <div className="coa-panel p-3 border shadow-lg" style={{ borderColor: COLOR_DIVIDER }}>
      <p className="coa-text-micro mb-2">{data.fullDate}</p>

      <p className="text-sm font-black" style={{ color: getDispoColor(data.perc_disp) }}>
        Disponibilidade: {formatPercent(data.perc_disp)}
      </p>

      <p className="text-xs font-bold text-[var(--coa-text-soft)] mt-1">
        Operacional: {formatHHMM(data.hrs_operacionais)}
      </p>

      <p className="text-xs font-bold text-[var(--coa-danger)] mt-1">
        Manutenção: {formatHHMM(data.hrs_manutencao)}
      </p>
    </div>
  );
};

const CustomDot = (props) => {
  const { cx, cy, payload } = props;
  const color = getDispoColor(payload.perc_disp);

  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={color}
      stroke="var(--coa-bg-soft)"
      strokeWidth={2}
    />
  );
};

const CustomLabel = (props) => {
  const { x, y, value } = props;
  const color = getDispoColor(value);

  return (
    <text
      x={x}
      y={y}
      dy={-12}
      fill={color}
      fontSize={11}
      fontWeight="900"
      textAnchor="middle"
    >
      {`${Number(value || 0).toFixed(1)}%`}
    </text>
  );
};

const HistoryTable = ({ rows = [] }) => (
  <div className="coa-panel p-0 overflow-hidden">
    <div
      className="grid grid-cols-[72px_1.25fr_78px_78px] md:grid-cols-[88px_1.35fr_96px_96px_78px] gap-2 px-4 py-3 border-b"
      style={{ borderColor: COLOR_DIVIDER }}
    >
      <span className="coa-text-micro">Data</span>
      <span className="coa-text-micro">Status</span>
      <span className="coa-text-micro text-right">Operac.</span>
      <span className="coa-text-micro text-right">Manut.</span>
      <span className="coa-text-micro text-right hidden md:block">Disp.</span>
    </div>

    <div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm font-bold text-[var(--coa-text-muted)]">
          Nenhum histórico encontrado para este equipamento.
        </div>
      ) : (
        rows.map((row) => (
          <div
            key={row.fullDate}
            className="grid grid-cols-[72px_1.25fr_78px_78px] md:grid-cols-[88px_1.35fr_96px_96px_78px] gap-2 px-4 py-3 border-b"
            style={{
              borderColor: COLOR_DIVIDER,
              background: row.isSelectedDate ? getDispoTint(row.perc_disp, 0.10) : 'transparent',
            }}
          >
            <span className="text-[12px] font-black text-[var(--coa-text)]">
              {row.label}
            </span>

            <span
              className="text-[12px] font-black whitespace-nowrap"
              style={{ color: getDispoColor(row.perc_disp) }}
            >
              {row.statusLabel}
            </span>

            <span className="text-[11px] font-black text-right text-[var(--coa-text-soft)] whitespace-nowrap">
              {formatHHMM(row.hrs_operacionais)}
            </span>

            <span className="text-[11px] font-black text-right text-[var(--coa-danger)] whitespace-nowrap">
              {formatHHMM(row.hrs_manutencao)}
            </span>

            <span
              className="text-[11px] font-black text-right whitespace-nowrap hidden md:block"
              style={{ color: getDispoColor(row.perc_disp) }}
            >
              {formatPercent(row.perc_disp)}
            </span>
          </div>
        ))
      )}
    </div>
  </div>
);

/* ==========================================================================
   COMPONENTE PRINCIPAL
   ========================================================================== */

const DispoDetailDiarioModal = ({ item, selectedDate, onClose }) => {
  const [historyRows, setHistoryRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartMode, setChartMode] = useState('disp');

  const { datesBr, labels } = useMemo(
    () => getLast7DaysFromIso(selectedDate),
    [selectedDate]
  );

  useEffect(() => {
    let mounted = true;

    const loadDetails = async () => {
      if (!item?.cod_equip || !selectedDate) return;

      try {
        setLoading(true);

        const codigoEquip = String(item.cod_equip || '').trim();

        const { data, error } = await supabase
          .from('tb_c_geral')
          .select(DETAIL_COLUMNS)
          .in('data', datesBr)
          .eq('cod_equip', codigoEquip)
          .eq('status', 'ATIVO');

        if (error) throw error;

        if (!mounted) return;

        setHistoryRows((data || []).map(normalizeDetailRow));
      } catch (err) {
        console.error('[COA][Disponibilidade Modal] Erro ao carregar histórico:', err);
        if (!mounted) return;
        setHistoryRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadDetails();

    return () => {
      mounted = false;
    };
  }, [item, selectedDate, datesBr]);

  const selectedBrDate = useMemo(() => isoToBr(selectedDate), [selectedDate]);

  const dailyRows = useMemo(() => {
    return historyRows.filter((row) => row.data === selectedBrDate);
  }, [historyRows, selectedBrDate]);

  const fallbackDailyAgg = useMemo(() => {
    return {
      hrs_operacionais: toNumber(item?.hrs_operacionais),
      hrs_manutencao: toNumber(item?.hrs_manutencao),
      hrs_disponiveis:
        toNumber(item?.hrs_operacionais) - toNumber(item?.hrs_manutencao),
      perc_disp: toNumber(item?.perc_disp),
      perc_manutencao:
        toNumber(item?.hrs_operacionais) > 0
          ? (toNumber(item?.hrs_manutencao) / toNumber(item?.hrs_operacionais)) * 100
          : 0,
    };
  }, [item]);

  const selectedDaySummary = useMemo(() => {
    if (dailyRows.length > 0) return aggregateRows(dailyRows);
    return fallbackDailyAgg;
  }, [dailyRows, fallbackDailyAgg]);

  const chartData = useMemo(() => {
    return labels.map((dateLabel) => {
      const dayRows = historyRows.filter((row) => row.data === dateLabel.full);
      const agg = aggregateRows(dayRows);
      const isSelectedDate = dateLabel.full === selectedBrDate;

      let statusLabel = 'Sem dados';

      if (dayRows.length > 0) {
        if (agg.perc_disp >= DISPO_META_VERDE) statusLabel = 'Ok';
        else if (agg.perc_disp >= DISPO_META_AMARELA) statusLabel = 'Atenção';
        else statusLabel = 'Abaixo';
      }

      return {
        label: dateLabel.short,
        fullDate: dateLabel.full,
        isoDate: brToIso(dateLabel.full),
        isSelectedDate,
        statusLabel,
        hrs_operacionais: agg.hrs_operacionais,
        hrs_manutencao: agg.hrs_manutencao,
        hrs_disponiveis: agg.hrs_disponiveis,
        perc_disp: agg.perc_disp,
        perc_manutencao: agg.perc_manutencao,
      };
    });
  }, [historyRows, labels, selectedBrDate]);

  const validHistoryDays = useMemo(() => {
    return chartData.filter((row) => row.hrs_operacionais > 0);
  }, [chartData]);

  const periodSummary = useMemo(() => {
    const total = aggregateRows(historyRows);

    const bestDay = [...validHistoryDays].sort((a, b) => b.perc_disp - a.perc_disp)[0] || null;
    const worstDay = [...validHistoryDays].sort((a, b) => a.perc_disp - b.perc_disp)[0] || null;

    const daysBelowMeta = validHistoryDays.filter((row) => row.perc_disp < DISPO_META_VERDE);
    const criticalDays = validHistoryDays.filter((row) => row.perc_disp < DISPO_META_AMARELA);

    const firstValid = validHistoryDays[0] || null;
    const lastValid = validHistoryDays[validHistoryDays.length - 1] || null;

    const tendencia =
      firstValid && lastValid
        ? lastValid.perc_disp - firstValid.perc_disp
        : 0;

    return {
      ...total,
      bestDay,
      worstDay,
      daysBelowMeta,
      criticalDays,
      tendencia,
      validDays: validHistoryDays.length,
    };
  }, [historyRows, validHistoryDays]);

  const manutImpact = useMemo(() => {
    const selectedManut = selectedDaySummary.hrs_manutencao;
    const selectedOper = selectedDaySummary.hrs_operacionais;

    if (selectedOper <= 0) return 0;

    return (selectedManut / selectedOper) * 100;
  }, [selectedDaySummary]);

  const analysisItems = useMemo(() => {
    const items = [];

    if (selectedDaySummary.hrs_operacionais <= 0) {
      items.push({
        type: 'warning',
        text: 'Equipamento sem horas operacionais no dia selecionado. A disponibilidade pode ficar zerada por falta de base de cálculo.',
      });
      return items;
    }

    if (selectedDaySummary.perc_disp >= DISPO_META_VERDE) {
      items.push({
        type: 'good',
        text: `Disponibilidade do dia em ${formatPercent(selectedDaySummary.perc_disp)}, dentro da meta mínima de ${DISPO_META_VERDE}%.`,
      });
    } else if (selectedDaySummary.perc_disp >= DISPO_META_AMARELA) {
      items.push({
        type: 'warning',
        text: `Disponibilidade do dia em ${formatPercent(selectedDaySummary.perc_disp)}, em faixa de atenção. Pequenas paradas podem levar o equipamento para condição crítica.`,
      });
    } else {
      items.push({
        type: 'bad',
        text: `Disponibilidade do dia em ${formatPercent(selectedDaySummary.perc_disp)}, abaixo da faixa aceitável. Priorizar investigação da manutenção.`,
      });
    }

    if (selectedDaySummary.hrs_manutencao > 0) {
      items.push({
        type: selectedDaySummary.perc_disp >= DISPO_META_VERDE ? 'info' : 'bad',
        text: `Foram registradas ${formatHHMM(selectedDaySummary.hrs_manutencao)} de manutenção no dia, representando ${formatPercent(manutImpact)} da base operacional.`,
      });
    } else {
      items.push({
        type: 'good',
        text: 'Não houve apontamento de manutenção para este equipamento no dia selecionado.',
      });
    }

    if (periodSummary.validDays >= 2) {
      if (periodSummary.tendencia > 3) {
        items.push({
          type: 'good',
          text: `Tendência positiva nos últimos dias, com melhora de ${formatPercent(periodSummary.tendencia)} entre o primeiro e o último dia com dados.`,
        });
      } else if (periodSummary.tendencia < -3) {
        items.push({
          type: 'warning',
          text: `Tendência de queda no período, com redução de ${formatPercent(Math.abs(periodSummary.tendencia))} na disponibilidade.`,
        });
      } else {
        items.push({
          type: 'info',
          text: 'Disponibilidade relativamente estável no período analisado.',
        });
      }
    }

    if (periodSummary.criticalDays.length > 0) {
      items.push({
        type: 'bad',
        text: `${periodSummary.criticalDays.length} dia(s) abaixo de ${DISPO_META_AMARELA}% nos últimos 7 dias. Verificar reincidência de manutenção.`,
      });
    } else if (periodSummary.validDays > 0) {
      items.push({
        type: 'good',
        text: `Nenhum dia abaixo de ${DISPO_META_AMARELA}% no período com dados.`,
      });
    }

    if (periodSummary.worstDay) {
      items.push({
        type: periodSummary.worstDay.perc_disp < DISPO_META_AMARELA ? 'bad' : 'info',
        text: `Pior dia do período: ${periodSummary.worstDay.fullDate}, com ${formatPercent(periodSummary.worstDay.perc_disp)} de disponibilidade e ${formatHHMM(periodSummary.worstDay.hrs_manutencao)} em manutenção.`,
      });
    }

    return items;
  }, [selectedDaySummary, manutImpact, periodSummary]);

  if (!item) return null;

  const headerArea = item?.desc_area || dailyRows[0]?.desc_area || historyRows[0]?.desc_area || 'SEM ÁREA';
  const headerFrente = item?.desc_grupo || dailyRows[0]?.desc_grupo || historyRows[0]?.desc_grupo || 'SEM FRENTE';
  const headerDate = selectedDate ? isoToBr(selectedDate) : '--/--/----';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="relative coa-card w-full max-w-6xl h-[90vh] overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-[rgba(255,255,255,0.04)] border text-[var(--coa-text-soft)] hover:text-[var(--coa-text)] transition-all z-20"
          style={{ borderColor: COLOR_DIVIDER }}
        >
          ✕
        </button>

        <div className="h-full flex flex-col min-h-0">
          <div className="coa-card__header">
            <div className="flex flex-col gap-2 pr-10">
              <span className="coa-text-micro">Disponibilidade Mecânica</span>

              <div className="flex flex-col gap-1">
                <h2 className="coa-text-title !mb-0">
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
                <span
                  className="coa-badge"
                  style={{
                    color: getDispoColor(selectedDaySummary.perc_disp),
                    borderColor: getDispoColor(selectedDaySummary.perc_disp),
                    background: getDispoTint(selectedDaySummary.perc_disp, 0.10),
                  }}
                >
                  {formatPercent(selectedDaySummary.perc_disp)}
                </span>
              </div>
            </div>
          </div>

          <div className="coa-card__body flex-1 min-h-0 overflow-y-auto flex flex-col gap-5">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center gap-3">
                <div className="coa-loader-dots" aria-label="Carregando">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="coa-loader-text">
                  Carregando análise de disponibilidade mecânica...
                </span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                  <SummaryItem
                    label="Operacional Dia"
                    value={formatHHMM(selectedDaySummary.hrs_operacionais)}
                  />

                  <SummaryItem
                    label="Manutenção Dia"
                    value={formatHHMM(selectedDaySummary.hrs_manutencao)}
                    color={COLOR_DANGER}
                  />

                  <SummaryItem
                    label="Disponível Dia"
                    value={formatHHMM(selectedDaySummary.hrs_disponiveis)}
                    color={COLOR_SUCCESS}
                  />

                  <SummaryItem
                    label="Disp. Dia"
                    value={formatPercent(selectedDaySummary.perc_disp)}
                    color={getDispoColor(selectedDaySummary.perc_disp)}
                  />

                  <SummaryItem
                    label="Manut. %"
                    value={formatPercent(selectedDaySummary.perc_manutencao)}
                    color={selectedDaySummary.perc_manutencao <= 10 ? COLOR_SUCCESS : COLOR_DANGER_STRONG}
                  />

                  <SummaryItem
                    label="Tendência 7D"
                    value={`${periodSummary.tendencia >= 0 ? '+' : ''}${periodSummary.tendencia.toFixed(1)}%`}
                    color={
                      periodSummary.tendencia >= 3
                        ? COLOR_SUCCESS
                        : periodSummary.tendencia <= -3
                          ? COLOR_DANGER_STRONG
                          : COLOR_TEXT_SOFT
                    }
                  />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.9fr] gap-4">
                  <div className="coa-panel p-4 flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="coa-text-micro">Histórico</span>
                        <span className="text-sm font-black text-[var(--coa-text)]">
                          Últimos 7 dias do equipamento
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setChartMode('disp')}
                          className="coa-badge transition-all"
                          style={{
                            color: chartMode === 'disp' ? COLOR_SUCCESS : COLOR_TEXT_SOFT,
                            borderColor: chartMode === 'disp' ? 'rgba(61,220,151,0.32)' : COLOR_DIVIDER,
                            background: chartMode === 'disp' ? 'rgba(61,220,151,0.10)' : 'rgba(255,255,255,0.02)',
                          }}
                        >
                          Disp.
                        </button>

                        <button
                          type="button"
                          onClick={() => setChartMode('manut')}
                          className="coa-badge transition-all"
                          style={{
                            color: chartMode === 'manut' ? COLOR_DANGER_STRONG : COLOR_TEXT_SOFT,
                            borderColor: chartMode === 'manut' ? 'rgba(239,68,68,0.32)' : COLOR_DIVIDER,
                            background: chartMode === 'manut' ? 'rgba(239,68,68,0.10)' : 'rgba(255,255,255,0.02)',
                          }}
                        >
                          Manut.
                        </button>
                      </div>
                    </div>

                    <div className="h-[290px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        {chartMode === 'disp' ? (
                          <LineChart
                            data={chartData}
                            margin={{ top: 28, right: 16, left: -18, bottom: 0 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="var(--coa-border)"
                              vertical={false}
                            />

                            <XAxis
                              dataKey="label"
                              stroke="var(--coa-text-muted)"
                              fontSize={12}
                              tickLine={false}
                              axisLine={false}
                              dy={10}
                            />

                            <YAxis hide domain={[0, 100]} />

                            <Tooltip
                              content={<CustomTooltip />}
                              cursor={{
                                stroke: 'var(--coa-border)',
                                strokeWidth: 1,
                                strokeDasharray: '5 5',
                              }}
                            />

                            <Line
                              type="monotone"
                              dataKey="perc_disp"
                              stroke="var(--coa-text-soft)"
                              strokeWidth={2}
                              dot={<CustomDot />}
                              activeDot={{ r: 7, stroke: 'var(--coa-text)', strokeWidth: 2 }}
                              label={<CustomLabel />}
                            />
                          </LineChart>
                        ) : (
                          <BarChart
                            data={chartData}
                            margin={{ top: 20, right: 16, left: -18, bottom: 0 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="var(--coa-border)"
                              vertical={false}
                            />

                            <XAxis
                              dataKey="label"
                              stroke="var(--coa-text-muted)"
                              fontSize={12}
                              tickLine={false}
                              axisLine={false}
                              dy={10}
                            />

                            <YAxis hide />

                            <Tooltip
                              content={<CustomTooltip />}
                              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                            />

                            <Bar
                              dataKey="hrs_manutencao"
                              fill="rgba(239,68,68,0.78)"
                              radius={[10, 10, 0, 0]}
                            />
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <MiniMetricCard
                      label="Disp. Média 7D"
                      value={formatPercent(periodSummary.perc_disp)}
                      color={getDispoColor(periodSummary.perc_disp)}
                      hint={`${periodSummary.validDays} dia(s) com dados`}
                    />

                    <MiniMetricCard
                      label="Total Manutenção 7D"
                      value={formatHHMM(periodSummary.hrs_manutencao)}
                      color={COLOR_DANGER}
                      hint="Soma do período analisado"
                    />

                    <MiniMetricCard
                      label="Pior Dia"
                      value={periodSummary.worstDay ? formatPercent(periodSummary.worstDay.perc_disp) : '0.0%'}
                      color={periodSummary.worstDay ? getDispoColor(periodSummary.worstDay.perc_disp) : COLOR_TEXT_SOFT}
                      hint={periodSummary.worstDay ? periodSummary.worstDay.fullDate : 'Sem dados'}
                    />

                    <MiniMetricCard
                      label="Dias Abaixo"
                      value={`${periodSummary.criticalDays.length}`}
                      color={periodSummary.criticalDays.length > 0 ? COLOR_DANGER_STRONG : COLOR_SUCCESS}
                      hint={`Abaixo de ${DISPO_META_AMARELA}%`}
                    />
                  </div>
                </div>

                <div className="coa-panel p-4 flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="coa-text-micro">Indicadores do dia</span>
                      <span className="text-sm font-black text-[var(--coa-text)]">
                        Leitura rápida da condição mecânica
                      </span>
                    </div>

                    <span
                      className="text-sm font-black"
                      style={{ color: getDispoColor(selectedDaySummary.perc_disp) }}
                    >
                      {formatPercent(selectedDaySummary.perc_disp)}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">
                        Disponibilidade
                      </span>

                      <span
                        className="text-[12px] font-black"
                        style={{ color: getDispoColor(selectedDaySummary.perc_disp) }}
                      >
                        Meta {DISPO_META_VERDE}%
                      </span>
                    </div>

                    <ProgressBar
                      value={selectedDaySummary.perc_disp}
                      color={getDispoColor(selectedDaySummary.perc_disp)}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">
                        Impacto da manutenção
                      </span>

                      <span
                        className="text-[12px] font-black"
                        style={{ color: manutImpact <= 10 ? COLOR_SUCCESS : COLOR_DANGER_STRONG }}
                      >
                        {formatPercent(manutImpact)}
                      </span>
                    </div>

                    <ProgressBar
                      value={manutImpact}
                      color={manutImpact <= 10 ? COLOR_SUCCESS : COLOR_DANGER_STRONG}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-4">
                  <div className="flex flex-col gap-3">
                    <span className="coa-text-micro">Histórico diário</span>
                    <HistoryTable rows={chartData} />
                  </div>

                  <div className="flex flex-col gap-3">
                    <span className="coa-text-micro">Análise do equipamento</span>

                    <div
                      className="coa-panel p-4 flex flex-col gap-2"
                      style={{
                        borderColor: COLOR_DIVIDER,
                        background: COLOR_PANEL_BG,
                      }}
                    >
                      {analysisItems.length === 0 ? (
                        <div className="text-sm font-bold text-[var(--coa-text-soft)]">
                          Equipamento sem dados suficientes para análise.
                        </div>
                      ) : (
                        analysisItems.map((analysis, idx) => (
                          <AnalysisListItem
                            key={`${analysis.type}-${idx}`}
                            text={analysis.text}
                            type={analysis.type}
                          />
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DispoDetailDiarioModal;