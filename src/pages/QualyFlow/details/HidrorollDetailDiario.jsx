// ================================= DOCUMENTATION ------------------------------------------
// Script: HidrorollDetailDiario
// Purpose: Detalhamento diário das avaliações Hidroroll.
// Relationships:
//   - vw_q_hidroroll_dia
//   - vw_q_hidroroll_ponto
//   - DateSelectorQualyFlow
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import DateSelectorQualyFlow from '../../../components/QualyFlow/DateSelectorQualyFlow';
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// ================================= CONFIGURAÇÕES ------------------------------------------

const DETAIL_LAYOUT = {
  barSize: 34,
  chartLabelSize: 10,
  chartValueSize: 10,
  donutRadius: 48,
  donutSize: 144,
  sampleScaleMin: 25,
  fontBase: 12,
  fontTitle: 12,
  fontHeader: 10,
  fontTable: 9,
  fontValue: 10,
  fontSmall: 9,
};

const COLORS = {
  good: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  water: '#1677ff',
  muted: '#94a3b8',
};

// ================================= HELPERS ------------------------------------------------

const asArray = value => Array.isArray(value) ? value : [];

const num = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const text = (value, fallback = '') => String(value ?? '').trim() || fallback;

const formatValue = (value, decimals = 1) => {
  const numeric = num(value);
  return numeric === null ? '—' : numeric.toFixed(decimals).replace('.', ',');
};

const formatPercent = (value, decimals = 1) => {
  const numeric = num(value);
  return numeric === null
    ? '—'
    : `${(numeric * 100).toFixed(decimals).replace('.', ',')}%`;
};

const infiltrationColor = value => {
  const numeric = num(value);
  if (numeric === null) return COLORS.muted;
  if (numeric >= 18) return COLORS.good;
  if (numeric >= 14) return COLORS.warning;
  return COLORS.danger;
};

const percentageColor = value => {
  const numeric = num(value);
  if (numeric === null) return COLORS.muted;
  const percentage = numeric <= 1 ? numeric * 100 : numeric;
  if (percentage >= 90) return COLORS.good;
  if (percentage >= 80) return COLORS.warning;
  return COLORS.danger;
};

const caneColor = value => {
  const numeric = num(value);
  if (numeric === null) return COLORS.muted;
  return numeric >= 5 && numeric <= 8 ? COLORS.good : COLORS.danger;
};

const mean = values => {
  const valid = values.map(value => num(value)).filter(value => value !== null);
  return valid.length
    ? valid.reduce((sum, value) => sum + value, 0) / valid.length
    : null;
};

const uniformity = values => {
  const valid = values.map(value => num(value)).filter(value => value !== null);
  if (!valid.length) return null;

  const average = mean(valid);
  if (!average) return null;

  const deviation = valid.reduce(
    (sum, value) => sum + Math.abs(value - average),
    0,
  );

  return 1 - deviation / (valid.length * average);
};

const weightedAverage = (rows, valueKey, weightKey = 'avaliado') => {
  const valid = rows
    .map(row => ({
      value: num(row[valueKey]),
      weight: num(row[weightKey], 0),
    }))
    .filter(item => item.value !== null && item.weight > 0);

  const totalWeight = valid.reduce((sum, item) => sum + item.weight, 0);
  if (!totalWeight) return null;

  return valid.reduce(
    (sum, item) => sum + item.value * item.weight,
    0,
  ) / totalWeight;
};

const normalizeInitialDate = value => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return new Date().toISOString().slice(0, 10);
};

const buildPointRows = rows => {
  const map = new Map();

  rows.forEach(row => {
    const key = `${row.codigo_campo}|${row.lote}|${row.ponto}`;

    if (!map.has(key)) {
      map.set(key, {
        key,
        codigo_campo: row.codigo_campo,
        campo: text(row.campo, row.codigo_campo),
        lote: text(row.lote, '—'),
        setor: text(row.setor, 'SEM SETOR'),
        ponto: num(row.ponto, 1),
        samples: [],
      });
    }

    map.get(key).samples.push(row);
  });

  return [...map.values()]
    .map(point => {
      const samples = point.samples
        .slice()
        .sort((a, b) => num(a.ordem_amostra, 0) - num(b.ordem_amostra, 0));

      const infiltration = samples.map(row => row.infiltracao);
      const evaluated = infiltration.map(value => num(value)).filter(value => value !== null).length;
      const standard = samples.filter(row => num(row.atingiu_padrao) === 1).length;

      return {
        ...point,
        samples,
        media_infiltracao: mean(infiltration),
        media_min: mean(samples.map(row => row.cana_min)),
        media_max: mean(samples.map(row => row.cana_max)),
        uniformidade: uniformity(infiltration),
        avaliado: evaluated,
        padrao: standard,
        perc_padrao: evaluated ? standard / evaluated : null,
      };
    })
    .sort((a, b) =>
      String(a.codigo_campo).localeCompare(
        String(b.codigo_campo),
        'pt-BR',
        { numeric: true },
      ) ||
      String(a.lote).localeCompare(String(b.lote), 'pt-BR', { numeric: true }) ||
      a.ponto - b.ponto
    );
};

// ================================= COMPONENTES VISUAIS ------------------------------------

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="qf-hidro-day-tooltip">
      <strong>{label}</strong>
      {payload.map(item => (
        <span key={item.dataKey} style={{ color: item.color }}>
          {item.name}: {formatValue(item.value, 2)} cm
        </span>
      ))}
    </div>
  );
}

function InfiltrationKpi({ dayValue, yearValue }) {
  const data = [
    { name: 'Dia', value: dayValue },
    { name: 'Ano', value: yearValue },
  ];

  return (
    <section className="qf-hidro-day-card qf-hidro-day-chart-card">
      <div className="qf-hidro-day-card-title">Profundidade Infiltração</div>

      <div className="qf-hidro-day-chart-body">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 28, right: 5, left: 5, bottom: 2 }}>
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{
                fill: '#64748b',
                fontSize: DETAIL_LAYOUT.chartLabelSize,
                fontWeight: 900,
              }}
            />
            <YAxis hide domain={[0, max => Math.max(25, max * 1.2)]} />
            <Tooltip
              cursor={{ fill: 'rgba(241,245,249,.55)' }}
              content={<ChartTooltip />}
            />
            <ReferenceLine y={14} stroke={COLORS.danger} strokeDasharray="4 4" />
            <ReferenceLine y={18} stroke={COLORS.good} strokeDasharray="4 4" />
            <Bar
              dataKey="value"
              name="Infiltração"
              barSize={DETAIL_LAYOUT.barSize}
              radius={[6, 6, 1, 1]}
            >
              {data.map(row => (
                <Cell key={row.name} fill={infiltrationColor(row.value)} />
              ))}
              <LabelList
                dataKey="value"
                position="top"
                formatter={value => formatValue(value)}
                fill="#475569"
                fontSize={DETAIL_LAYOUT.chartValueSize}
                fontWeight={900}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="qf-hidro-day-card-footer">
        <span className="is-danger">Abaixo de 14</span>
        <span className="is-warning">14 a 17,9</span>
        <span className="is-good">18 ou mais</span>
      </div>
    </section>
  );
}

function CaneKpi({ minimum, maximum, average }) {
  const data = [
    { name: 'Mín.', value: minimum },
    { name: 'Máx.', value: maximum },
    { name: 'Média', value: average },
  ];

  return (
    <section className="qf-hidro-day-card qf-hidro-day-chart-card">
      <div className="qf-hidro-day-card-title">Profundidade da Cana</div>

      <div className="qf-hidro-day-chart-body">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 28, right: 5, left: 5, bottom: 2 }}>
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{
                fill: '#64748b',
                fontSize: DETAIL_LAYOUT.chartLabelSize,
                fontWeight: 900,
              }}
            />
            <YAxis hide domain={[0, max => Math.max(12, max * 1.25)]} />
            <Tooltip
              cursor={{ fill: 'rgba(241,245,249,.55)' }}
              content={<ChartTooltip />}
            />
            <ReferenceLine y={5} stroke={COLORS.good} strokeDasharray="4 4" />
            <ReferenceLine y={8} stroke={COLORS.good} strokeDasharray="4 4" />
            <Bar
              dataKey="value"
              name="Profundidade"
              barSize={DETAIL_LAYOUT.barSize}
              radius={[6, 6, 1, 1]}
            >
              {data.map(row => (
                <Cell key={row.name} fill={caneColor(row.value)} />
              ))}
              <LabelList
                dataKey="value"
                position="top"
                formatter={value => formatValue(value)}
                fill="#475569"
                fontSize={DETAIL_LAYOUT.chartValueSize}
                fontWeight={900}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="qf-hidro-day-card-footer">
        <span className="is-good">Faixa esperada: 5 a 8 cm</span>
      </div>
    </section>
  );
}

function DonutKpi({ title, value, subtitle }) {
  const safe = Math.max(0, Math.min(1, num(value, 0)));
  const color = percentageColor(safe);
  const radius = DETAIL_LAYOUT.donutRadius;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - safe * circumference;

  return (
    <section className="qf-hidro-day-card qf-hidro-day-donut-card">
      <div className="qf-hidro-day-card-title">{title}</div>

      <div className="qf-hidro-day-donut-wrap">
        <svg
          viewBox="0 0 120 120"
          preserveAspectRatio="xMidYMid meet"
          style={{
            width: `${DETAIL_LAYOUT.donutSize}px`,
            height: `${DETAIL_LAYOUT.donutSize}px`,
          }}
          aria-hidden="true"
        >
          <circle
            cx="60"
            cy="60"
            r={radius}
            className="qf-hidro-day-donut-track"
          />
          <circle
            cx="60"
            cy="60"
            r={radius}
            className="qf-hidro-day-donut-value"
            stroke={color}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>

        <div className="qf-hidro-day-donut-center">
          <strong style={{ color }}>{formatPercent(safe)}</strong>
          <small>{subtitle}</small>
        </div>
      </div>

      <div className="qf-hidro-day-card-footer">
        <span>Meta</span>
        <b className="is-good">90%</b>
      </div>
    </section>
  );
}

function PointTable({ rows, selectedKey, onSelect }) {
  return (
    <section className="qf-hidro-day-card qf-hidro-day-table-card">
      <div className="qf-hidro-day-section-head">
        <strong>Resumo Geral por Ponto</strong>
        <span>{rows.length} ponto(s)</span>
      </div>

      <div className="qf-hidro-day-table-scroll">
        <table className="qf-hidro-day-table">
          <colgroup>
            <col className="is-field" />
            <col className="is-lot" />
            <col className="is-point" />
            <col className="is-infiltration" />
            <col className="is-minimum" />
            <col className="is-maximum" />
            <col className="is-uniformity" />
            <col className="is-evaluated" />
            <col className="is-standard" />
            <col className="is-standard-percent" />
          </colgroup>
          <thead>
            <tr>
              <th>Campo</th>
              <th>Lote</th>
              <th>Ponto</th>
              <th>Méd. Infil.</th>
              <th>Méd. Mín.</th>
              <th>Méd. Máx.</th>
              <th>Uniform.</th>
              <th>Av.</th>
              <th>Padrão</th>
              <th>Padrão %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr
                key={row.key}
                className={row.key === selectedKey ? 'is-selected' : ''}
                onClick={() => onSelect(row.key)}
              >
                <td className="qf-hidro-day-field" title={row.campo}>
                  {row.campo}
                </td>
                <td>{row.lote}</td>
                <td><b>P{row.ponto}</b></td>
                <td style={{ color: infiltrationColor(row.media_infiltracao) }}>
                  {formatValue(row.media_infiltracao)}
                </td>
                <td>{formatValue(row.media_min)}</td>
                <td>{formatValue(row.media_max)}</td>
                <td style={{ color: percentageColor(row.uniformidade) }}>
                  {formatPercent(row.uniformidade)}
                </td>
                <td>{row.avaliado}</td>
                <td>{row.padrao}</td>
                <td style={{ color: percentageColor(row.perc_padrao) }}>
                  {formatPercent(row.perc_padrao)}
                </td>
              </tr>
            ))}

            {!rows.length && (
              <tr>
                <td colSpan="10" className="qf-hidro-day-table-empty">
                  Nenhum ponto disponível para a data selecionada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SampleBar({ sample, scale }) {
  const infiltration = Math.max(0, Math.min(scale, num(sample.infiltracao, 0)));
  const caneMin = Math.max(0, Math.min(scale, num(sample.cana_min, 0)));
  const caneMax = Math.max(0, Math.min(scale, num(sample.cana_max, 0)));
  const reached = num(sample.atingiu_padrao) === 1;

  return (
    <div className="qf-hidro-day-sample">
      <strong style={{ color: infiltrationColor(sample.infiltracao) }}>
        {formatValue(sample.infiltracao, 0)}
      </strong>

      <div className="qf-hidro-day-depth-track">
        <i
          className={reached ? 'is-reached' : 'is-not-reached'}
          style={{ height: `${(infiltration / scale) * 100}%` }}
        />
        <span
          className="is-minimum"
          style={{ top: `${(caneMin / scale) * 100}%` }}
        />
        <span
          className="is-maximum"
          style={{ top: `${(caneMax / scale) * 100}%` }}
        />
      </div>

      <small>{sample.ordem_amostra}</small>
    </div>
  );
}

function PointDetail({ rows, selectedKey, onSelect }) {
  const selected = rows.find(row => row.key === selectedKey) || rows[0];

  if (!selected) {
    return (
      <section className="qf-hidro-day-card qf-hidro-day-point-card">
        <div className="qf-hidro-day-empty">Selecione um ponto.</div>
      </section>
    );
  }

  const scale = Math.ceil(
    Math.max(
      DETAIL_LAYOUT.sampleScaleMin,
      ...selected.samples.flatMap(row => [
        num(row.infiltracao, 0),
        num(row.cana_max, 0),
      ]),
    ) / 5,
  ) * 5;

  const samples = Array.from({ length: 12 }, (_, index) =>
    selected.samples.find(row => num(row.ordem_amostra) === index + 1) || {
      ordem_amostra: index + 1,
    },
  );

  return (
    <section className="qf-hidro-day-card qf-hidro-day-point-card">
      <div className="qf-hidro-day-section-head">
        <strong>Detalhe do Ponto</strong>
        <span>Lote {selected.lote} • P{selected.ponto}</span>
      </div>

      <div className="qf-hidro-day-point-tabs">
        {rows.map(row => (
          <button
            type="button"
            key={row.key}
            className={row.key === selected.key ? 'is-active' : ''}
            onClick={() => onSelect(row.key)}
          >
            <b>P{row.ponto}</b>
            <small>Lote {row.lote}</small>
          </button>
        ))}
      </div>

      <div className="qf-hidro-day-samples-grid">
        {samples.map(sample => (
          <SampleBar
            key={sample.ordem_amostra}
            sample={sample}
            scale={scale}
          />
        ))}
      </div>

      <div className="qf-hidro-day-point-legend">
        <span><i className="is-water" />Infiltração</span>
        <span><i className="is-minimum" />Cana mín.</span>
        <span><i className="is-maximum" />Cana máx.</span>
      </div>
    </section>
  );
}

// ================================= COMPONENTE PRINCIPAL -----------------------------------

const HidrorollDetailDiario = ({ initialDate }) => {
  const safeInitialDate = normalizeInitialDate(initialDate);

  const [selectedDate, setSelectedDate] = useState(safeInitialDate);
  const [activeYear, setActiveYear] = useState(Number(safeInitialDate.slice(0, 4)));
  const [availableDates, setAvailableDates] = useState([]);
  const [yearsList, setYearsList] = useState([]);

  const [allDaily, setAllDaily] = useState([]);
  const [dayPoints, setDayPoints] = useState([]);
  const [selectedPointKey, setSelectedPointKey] = useState('');
  const [selectedFieldKeys, setSelectedFieldKeys] = useState([]);

  const [loadingDates, setLoadingDates] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState('');

  // Carrega a visão diária uma única vez. Ela alimenta datas, anos e KPIs.
  useEffect(() => {
    let active = true;

    const loadDailyBase = async () => {
      setLoadingDates(true);
      setError('');

      const response = await supabase
        .from('vw_q_hidroroll_dia')
        .select('*')
        .order('data_apontamento', { ascending: false });

      if (!active) return;

      if (response.error) {
        setError(response.error.message || 'Erro ao consultar vw_q_hidroroll_dia.');
        setAllDaily([]);
        setAvailableDates([]);
        setYearsList([]);
        setLoadingDates(false);
        return;
      }

      const rows = asArray(response.data);
      const years = [...new Set(rows.map(row => num(row.ano)).filter(Boolean))]
        .sort((a, b) => b - a);

      setAllDaily(rows);
      setYearsList(years);

      const preferredYear = years.includes(activeYear)
        ? activeYear
        : (years[0] || activeYear);

      const dates = [...new Set(
        rows
          .filter(row => num(row.ano) === preferredYear)
          .map(row => text(row.data_apontamento))
          .filter(Boolean),
      )].sort((a, b) => b.localeCompare(a));

      setActiveYear(preferredYear);
      setAvailableDates(dates);

      if (dates.length && !dates.includes(selectedDate)) {
        setSelectedDate(dates[0]);
      }

      setLoadingDates(false);
    };

    loadDailyBase();
    return () => { active = false; };
  }, []);

  // Ao trocar o ano no calendário, recalcula as datas disponíveis.
  useEffect(() => {
    if (!allDaily.length || !activeYear) return;

    const dates = [...new Set(
      allDaily
        .filter(row => num(row.ano) === activeYear)
        .map(row => text(row.data_apontamento))
        .filter(Boolean),
    )].sort((a, b) => b.localeCompare(a));

    setAvailableDates(dates);

    if (dates.length && !dates.includes(selectedDate)) {
      setSelectedDate(dates[0]);
    }
  }, [activeYear, allDaily, selectedDate]);

  // Carrega somente os pontos da data escolhida.
  useEffect(() => {
    if (!selectedDate) {
      setDayPoints([]);
      setSelectedPointKey('');
      return;
    }

    let active = true;

    const loadPoints = async () => {
      setLoadingData(true);
      setError('');

      const response = await supabase
        .from('vw_q_hidroroll_ponto')
        .select('*')
        .eq('data_apontamento', selectedDate)
        .order('codigo_campo', { ascending: true })
        .order('lote', { ascending: true })
        .order('ponto', { ascending: true })
        .order('ordem_amostra', { ascending: true });

      if (!active) return;

      if (response.error) {
        setError(response.error.message || 'Erro ao consultar vw_q_hidroroll_ponto.');
        setDayPoints([]);
        setSelectedPointKey('');
      } else {
        const built = buildPointRows(asArray(response.data));
        setDayPoints(built);
        setSelectedPointKey(current =>
          built.some(row => row.key === current)
            ? current
            : (built[0]?.key || ''),
        );
      }

      setLoadingData(false);
    };

    loadPoints();
    return () => { active = false; };
  }, [selectedDate]);

  const fieldSummaries = useMemo(() => {
    const map = new Map();

    dayPoints.forEach(point => {
      const key = text(point.codigo_campo, point.campo);
      if (!map.has(key)) {
        map.set(key, {
          key,
          codigo_campo: point.codigo_campo,
          campo: point.campo,
          infiltration: [],
          evaluated: 0,
          standard: 0,
        });
      }

      const field = map.get(key);
      field.infiltration.push(
        ...point.samples.map(row => row.infiltracao),
      );
      field.evaluated += point.avaliado;
      field.standard += point.padrao;
    });

    return [...map.values()]
      .map(field => ({
        ...field,
        uniformidade: uniformity(field.infiltration),
        perc_padrao: field.evaluated
          ? field.standard / field.evaluated
          : null,
      }))
      .sort((a, b) =>
        a.campo.localeCompare(b.campo, 'pt-BR', { numeric: true }),
      );
  }, [dayPoints]);

  useEffect(() => {
    const validKeys = fieldSummaries.map(field => field.key);

    setSelectedFieldKeys(current => {
      const maintained = current.filter(key => validKeys.includes(key));
      return maintained.length ? maintained : validKeys;
    });
  }, [fieldSummaries]);

  const toggleField = key => {
    setSelectedFieldKeys(current => {
      if (current.includes(key)) {
        if (current.length === 1) return current;
        return current.filter(item => item !== key);
      }
      return [...current, key];
    });
  };

  const filteredPoints = useMemo(() => {
    if (!selectedFieldKeys.length) return dayPoints;
    return dayPoints.filter(point =>
      selectedFieldKeys.includes(text(point.codigo_campo, point.campo)),
    );
  }, [dayPoints, selectedFieldKeys]);

  useEffect(() => {
    setSelectedPointKey(current =>
      filteredPoints.some(point => point.key === current)
        ? current
        : (filteredPoints[0]?.key || ''),
    );
  }, [filteredPoints]);

  const selectedDaily = useMemo(
    () => allDaily.filter(row =>
      text(row.data_apontamento) === selectedDate &&
      (!selectedFieldKeys.length || selectedFieldKeys.includes(text(row.codigo_campo, row.campo))),
    ),
    [allDaily, selectedDate, selectedFieldKeys],
  );

  const yearDaily = useMemo(
    () => allDaily.filter(row =>
      num(row.ano) === activeYear &&
      (!selectedFieldKeys.length || selectedFieldKeys.includes(text(row.codigo_campo, row.campo))),
    ),
    [allDaily, activeYear, selectedFieldKeys],
  );

  const dayKpis = useMemo(() => {
    const totalEvaluated = selectedDaily.reduce(
      (sum, row) => sum + num(row.avaliado, 0),
      0,
    );
    const totalStandard = selectedDaily.reduce(
      (sum, row) => sum + num(row.padrao, 0),
      0,
    );

    return {
      infiltration: weightedAverage(selectedDaily, 'media_infiltracao'),
      caneMin: weightedAverage(selectedDaily, 'media_cana_min'),
      caneMax: weightedAverage(selectedDaily, 'media_cana_max'),
      caneMean: weightedAverage(selectedDaily, 'media_cana'),
      uniformity: filteredPoints.length
        ? uniformity(
          filteredPoints.flatMap(point =>
            point.samples.map(row => row.infiltracao),
          ),
        )
        : weightedAverage(selectedDaily, 'perc_uniformidade'),
      standard: totalEvaluated ? totalStandard / totalEvaluated : null,
    };
  }, [selectedDaily, filteredPoints]);

  const yearInfiltration = useMemo(
    () => weightedAverage(yearDaily, 'media_infiltracao'),
    [yearDaily],
  );



  return (
    <div
      className="qf-hidro-day-page"
      style={{
        '--hidro-day-font-base': `${DETAIL_LAYOUT.fontBase}px`,
        '--hidro-day-font-title': `${DETAIL_LAYOUT.fontTitle}px`,
        '--hidro-day-font-header': `${DETAIL_LAYOUT.fontHeader}px`,
        '--hidro-day-font-table': `${DETAIL_LAYOUT.fontTable}px`,
        '--hidro-day-font-value': `${DETAIL_LAYOUT.fontValue}px`,
        '--hidro-day-font-small': `${DETAIL_LAYOUT.fontSmall}px`,
      }}
    >
      <div className="qf-hidro-day-date-selector">
        <DateSelectorQualyFlow
          value={selectedDate}
          onChange={setSelectedDate}
          availableDates={availableDates}
          activeYear={activeYear}
          onYearChange={setActiveYear}
          yearsList={yearsList}
          isLoading={loadingDates}
        />
      </div>

      {error && (
        <div className="qf-hidro-day-error">
          <strong>Não foi possível carregar o detalhamento.</strong>
          <span>{error}</span>
        </div>
      )}

      {!loadingDates && !error && !availableDates.length && (
        <div className="qf-hidro-day-empty">
          Nenhuma avaliação Hidroroll encontrada.
        </div>
      )}

      {loadingData ? (
        <div className="qf-hidro-day-loading">
          Atualizando avaliação Hidroroll...
        </div>
      ) : selectedDate && availableDates.length ? (
        <div className="qf-hidro-day-content">
          <section className="qf-hidro-day-field-filter">
            <div className="qf-hidro-day-field-filter-head">
              <strong>Campos avaliados</strong>
              <span>{selectedFieldKeys.length} de {fieldSummaries.length} selecionado(s)</span>
            </div>

            <div className="qf-hidro-day-field-list">
              {fieldSummaries.map(field => {
                const selected = selectedFieldKeys.includes(field.key);
                return (
                  <button
                    type="button"
                    key={field.key}
                    className={`qf-hidro-day-field-button ${selected ? 'is-selected' : ''}`}
                    onClick={() => toggleField(field.key)}
                  >
                    <span className="qf-hidro-day-field-name" title={field.campo}>{field.campo}</span>
                    <span className="qf-hidro-day-field-metric">
                      <small>Uniformidade</small>
                      <b style={{ color: percentageColor(field.uniformidade) }}>{formatPercent(field.uniformidade)}</b>
                    </span>
                    <span className="qf-hidro-day-field-metric">
                      <small>Padrão</small>
                      <b style={{ color: percentageColor(field.perc_padrao) }}>{formatPercent(field.perc_padrao)}</b>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="qf-hidro-day-kpi-grid">
            <InfiltrationKpi
              dayValue={dayKpis.infiltration}
              yearValue={yearInfiltration}
            />
            <CaneKpi
              minimum={dayKpis.caneMin}
              maximum={dayKpis.caneMax}
              average={dayKpis.caneMean}
            />
            <DonutKpi
              title="Uniformidade da Infiltração"
              value={dayKpis.uniformity}
              subtitle="Resultado do dia"
            />
            <DonutKpi
              title="Infiltração Padrão"
              value={dayKpis.standard}
              subtitle="Amostras conformes"
            />
          </section>

          <section className="qf-hidro-day-detail-grid">
            <PointTable
              rows={filteredPoints}
              selectedKey={selectedPointKey}
              onSelect={setSelectedPointKey}
            />
            <PointDetail
              rows={filteredPoints}
              selectedKey={selectedPointKey}
              onSelect={setSelectedPointKey}
            />
          </section>
        </div>
      ) : null}
    </div>
  );
};

export default HidrorollDetailDiario;
