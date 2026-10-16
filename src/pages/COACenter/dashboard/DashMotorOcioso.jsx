// ================================= DOCUMENTATION ------------------------------------------
// Script: DashMotorOcioso V3
// Purpose: Dashboard gerencial semanal de motor ocioso dos equipamentos do COA Center.
// Visual: alinhado à identidade do Boletim Diário.
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../lib/supabaseClient';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import './DashMotorOcioso.css';

const META = 5;
const PAGE_SIZE = 700;
const RETRIES = 2;
const CACHE_TTL = 12 * 60 * 60 * 1000;
const DEFAULT_CATEGORIES = ['AGRÍCOLA', 'APOIO'];
const MEMORY = new Map();

const DAYS = [
  { day: 1, key: 'seg', label: 'SEG' },
  { day: 2, key: 'ter', label: 'TER' },
  { day: 3, key: 'qua', label: 'QUA' },
  { day: 4, key: 'qui', label: 'QUI' },
  { day: 5, key: 'sex', label: 'SEX' },
  { day: 6, key: 'sab', label: 'SÁB' },
  { day: 0, key: 'dom', label: 'DOM' },
];

const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const pct = (n, d) => (d > 0 ? (n / d) * 100 : null);
const fmtPct = (value, decimals = 1) =>
  value == null || !Number.isFinite(value)
    ? '—'
    : `${value.toFixed(decimals).replace('.', ',')}%`;
const fmtH = (seconds) => {
  const totalMinutes = Math.max(0, Math.round(num(seconds) / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};
const fmtDate = (value) => {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
};
const tone = (value) => {
  if (value == null) return 'neutral';
  if (value <= META) return 'good';
  return 'bad';
};
const toneColor = (value) => {
  if (value == null) return '#94a3b8';
  if (value <= META) return '#3ddc97';
  return '#fb7185';
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const totals = (rows, totalKey = 'hrs_operacionais_seg') =>
  rows.reduce(
    (acc, row) => ({
      operational: acc.operational + num(row[totalKey]),
      engine: acc.engine + num(row.hrs_motor_ligado_seg),
      idle: acc.idle + num(row.hrs_ocioso_seg ?? row.ocioso_seg),
    }),
    { operational: 0, engine: 0, idle: 0 },
  );

const keyFor = (name, period, area = 'ALL') =>
  `mo_v3|${name}|${period?.ano}|${period?.semana_iso}|${area}`;

const readCache = (key) => {
  if (MEMORY.has(key)) return MEMORY.get(key);
  try {
    const item = JSON.parse(localStorage.getItem(key) || 'null');
    if (item && Date.now() - item.at < CACHE_TTL) {
      MEMORY.set(key, item.data);
      return item.data;
    }
  } catch (_) {
    // Cache local é opcional.
  }
  return null;
};

const saveCache = (key, data) => {
  MEMORY.set(key, data);
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
  } catch (_) {
    // Quota local não deve bloquear o dashboard.
  }
};

async function fetchPages(factory, { key = '', pageSize = PAGE_SIZE } = {}) {
  if (key) {
    const cached = readCache(key);
    if (cached) return cached;
  }

  const result = [];
  for (let from = 0; ; from += pageSize) {
    let page = [];
    let failure = null;

    for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
      const { data, error } = await factory().range(from, from + pageSize - 1);
      if (!error) {
        page = Array.isArray(data) ? data : [];
        failure = null;
        break;
      }
      failure = error;
      if (attempt < RETRIES) await sleep(900 * (attempt + 1));
    }

    if (failure) throw failure;
    result.push(...page);
    if (page.length < pageSize) break;
  }

  if (key) saveCache(key, result);
  return result;
}

function StatCard({ label, value, detail, className = '' }) {
  return (
    <article className={`mo-kpi-card ${className}`}>
      <div className="mo-kpi-card__top">
        <span>{label}</span>
        <i />
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function EmptyState({ children = 'Nenhum dado disponível.' }) {
  return <div className="mo-empty">{children}</div>;
}

function ChartTip({ active, payload, title }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="mo-tip">
      <strong>{title}</strong>
      <span>{row.label}</span>
      <b className={`is-${tone(row.value)}`}>{fmtPct(row.value, 2)}</b>
      <small>{fmtH(row.idle)} ociosas</small>
    </div>
  );
}

function IdleChart({ title, eyebrow, data, emptyText }) {
  return (
    <article className="mo-panel mo-chart-panel">
      <header>
        <div>
          <span className="mo-overline">{eyebrow}</span>
          <h3>{title}</h3>
        </div>
        <span>Meta ≤ {META}%</span>
      </header>
      <div className="mo-chart-body">
        {data?.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 22, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgba(148,163,184,.08)" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 8, fontWeight: 900 }}
              />
              <YAxis hide domain={[0, (max) => Math.max(8, num(max) * 1.3)]} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,.025)' }}
                content={<ChartTip title={title} />}
              />
              <ReferenceLine
                y={META}
                stroke="#3ddc97"
                strokeDasharray="4 5"
                strokeWidth={1.5}
              />
              <Bar dataKey="value" radius={[6, 6, 2, 2]} maxBarSize={42}>
                {data.map((row) => (
                  <Cell
                    key={row.key}
                    fill={toneColor(row.value)}
                    opacity={row.value == null ? 0 : 0.9}
                  />
                ))}
                <LabelList
                  dataKey="value"
                  position="top"
                  formatter={(value) => (value == null ? '' : fmtPct(Number(value)))}
                  fill="#d8e1eb"
                  fontSize={8}
                  fontWeight={900}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState>{emptyText}</EmptyState>
        )}
      </div>
    </article>
  );
}

function DetailModal({ area, offenders, details, onClose }) {
  if (!area || typeof document === 'undefined') return null;

  const off = offenders
    .filter((row) => row.desc_area === area)
    .sort((a, b) => num(b.ocioso_seg) - num(a.ocioso_seg));

  const det = details
    .filter((row) => row.desc_area === area && num(row.ocioso_seg) > 0)
    .sort((a, b) => num(b.ocioso_seg) - num(a.ocioso_seg))
    .slice(0, 30);

  const max = Math.max(1, ...off.map((row) => num(row.ocioso_seg)));

  return createPortal(
    <div className="mo-backdrop" onMouseDown={onClose}>
      <div className="mo-modal" onMouseDown={(event) => event.stopPropagation()}>
        <header className="mo-modal__header">
          <div>
            <span className="mo-overline">Detalhamento</span>
            <h2>{area}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>

        <main className="mo-modal__grid">
          <article className="mo-panel mo-modal__panel">
            <header>
              <div>
                <span className="mo-overline">Ranking</span>
                <h3>Ofensores de motor ocioso</h3>
              </div>
              <span>{off.length} itens</span>
            </header>
            <div className="mo-offenders coa-no-scrollbar">
              {off.length ? (
                off.map((row, index) => (
                  <div className="mo-offender" key={`${row.ofensor}-${index}`}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <strong>{row.ofensor}</strong>
                      <small>{row.grupo_operacao || 'Sem grupo'}</small>
                      <div>
                        <i style={{ width: `${(num(row.ocioso_seg) / max) * 100}%` }} />
                      </div>
                    </div>
                    <b>{fmtH(row.ocioso_seg)}</b>
                  </div>
                ))
              ) : (
                <EmptyState>Nenhum ofensor encontrado para a área.</EmptyState>
              )}
            </div>
          </article>

          <article className="mo-panel mo-modal__panel">
            <header>
              <div>
                <span className="mo-overline">Detalhamento</span>
                <h3>Ocorrências com motor ocioso</h3>
              </div>
              <span>Top {det.length}</span>
            </header>
            <div className="mo-detail coa-no-scrollbar">
              <div className="mo-detail__head">
                <span>Equipamento / operador</span>
                <b>Operação</b>
                <b>Ocioso</b>
                <b>%</b>
              </div>
              {det.length ? (
                det.map((row, index) => (
                  <div className="mo-detail__row" key={`${row.cod_equip}-${row.cod_op}-${index}`}>
                    <span>
                      <strong>{row.cod_equip}</strong>
                      <small>{row.cod_op}</small>
                    </span>
                    <b title={row.desc_operacao}>{row.desc_operacao || 'NÃO INFORMADA'}</b>
                    <b>{fmtH(row.ocioso_seg)}</b>
                    <b className={`is-${tone(num(row.percentual_ocioso_operacao))}`}>
                      {fmtPct(num(row.percentual_ocioso_operacao))}
                    </b>
                  </div>
                ))
              ) : (
                <EmptyState>Nenhuma ocorrência com ociosidade para este filtro.</EmptyState>
              )}
            </div>
          </article>
        </main>
      </div>
    </div>,
    document.body,
  );
}

export default function DashMotorOcioso() {
  const [periods, setPeriods] = useState([]);
  const [periodKey, setPeriodKey] = useState('');
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [selectedArea, setSelectedArea] = useState('');

  const [daily, setDaily] = useState([]);
  const [weekly, setWeekly] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [annual, setAnnual] = useState([]);
  const [details, setDetails] = useState([]);
  const [offenders, setOffenders] = useState([]);
  const [modalArea, setModalArea] = useState('');

  const [loading, setLoading] = useState(true);
  const [background, setBackground] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  const period = useMemo(
    () => periods.find((row) => `${row.ano}|${row.semana_iso}` === periodKey),
    [periods, periodKey],
  );

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const rows = await fetchPages(
          () =>
            supabase
              .from('vw_c_boletimsemanal_periodo')
              .select('ano,semana_iso,data_inicio,data_final,total_dias,status')
              .order('ano', { ascending: false })
              .order('semana_iso', { ascending: false }),
          { key: 'mo_v3|periods', pageSize: 500 },
        );

        if (!alive) return;
        setPeriods(rows);
        setPeriodKey(rows[0] ? `${rows[0].ano}|${rows[0].semana_iso}` : '');
        if (!rows.length) setLoading(false);
      } catch (loadError) {
        if (!alive) return;
        setError(loadError.message || 'Erro ao carregar períodos.');
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!period) return undefined;
    let alive = true;

    (async () => {
      setLoading(true);
      setError('');
      setSelectedArea('');
      setModalArea('');
      setDetails([]);
      setOffenders([]);

      try {
        const [dayRows, weekRows, equipmentRows, annualRows] = await Promise.all([
          fetchPages(
            () =>
              supabase
                .from('vw_c_boletimdiario_dia_area')
                .select(
                  'data,desc_area,categoria,hrs_operacionais_seg,hrs_motor_ligado_seg,hrs_ocioso_seg',
                )
                .gte('data', period.data_inicio)
                .lte('data', period.data_final),
            { key: keyFor('daily', period) },
          ),
          fetchPages(
            () =>
              supabase
                .from('vw_c_boletimsemanal_geral')
                .select(
                  'ano,semana_iso,desc_area,desc_grupo,categoria,hrs_operacionais_seg,hrs_motor_ligado_seg,hrs_ocioso_seg',
                )
                .eq('ano', period.ano)
                .eq('semana_iso', period.semana_iso),
            { key: keyFor('weekly', period) },
          ),
          fetchPages(
            () =>
              supabase
                .from('vw_c_boletimsemanal_equipamento')
                .select(
                  'desc_area,desc_grupo,categoria,cod_equip,desc_equip,hrs_operacionais_seg,hrs_motor_ligado_seg,hrs_ocioso_seg',
                )
                .eq('ano', period.ano)
                .eq('semana_iso', period.semana_iso),
            { key: keyFor('equipment', period) },
          ),
          fetchPages(
            () =>
              supabase
                .from('vw_c_boletimsemanal_geral')
                .select(
                  'ano,semana_iso,desc_area,desc_grupo,categoria,hrs_operacionais_seg,hrs_motor_ligado_seg,hrs_ocioso_seg',
                )
                .eq('ano', period.ano),
            { key: `mo_v3|annual|${period.ano}` },
          ),
        ]);

        if (!alive) return;

        setDaily(dayRows);
        setWeekly(weekRows);
        setEquipment(equipmentRows);
        setAnnual(annualRows);
        setLoading(false);

        const areaList = [...new Set(weekRows.map((row) => row.desc_area).filter(Boolean))].sort();
        setBackground(true);
        const all = [];

        for (let index = 0; index < areaList.length && alive; index += 1) {
          const area = areaList[index];
          setProgress(`${index + 1}/${areaList.length} • ${area}`);

          try {
            const rows = await fetchPages(
              () =>
                supabase
                  .from('vw_c_boletimsemanal_operador_detalhado')
                  .select(
                    'desc_area,desc_grupo,categoria,cod_equip,desc_equip,cod_op,desc_grupo_op,desc_operacao,total_seg,hrs_motor_ligado_seg,ocioso_seg,percentual_ocioso_operacao',
                  )
                  .eq('ano', period.ano)
                  .eq('semana_iso', period.semana_iso)
                  .eq('desc_area', area),
              { key: keyFor('detail', period, area), pageSize: 500 },
            );

            all.push(...rows);
            if (alive) setDetails([...all]);
          } catch (areaError) {
            console.warn(`[Motor Ocioso] ${area}:`, areaError.message);
          }

          await sleep(120);
        }
      } catch (loadError) {
        if (alive) setError(loadError.message || 'Erro ao carregar dados.');
      } finally {
        if (alive) {
          setLoading(false);
          setBackground(false);
          setProgress('');
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [period]);

  useEffect(() => {
    if (!period || !modalArea) return undefined;
    let alive = true;

    (async () => {
      try {
        const rows = await fetchPages(
          () =>
            supabase
              .from('vw_c_boletimsemanal_ofensores')
              .select('desc_area,desc_grupo,categoria,grupo_operacao,ofensor,total_seg,ocioso_seg')
              .eq('ano', period.ano)
              .eq('semana_iso', period.semana_iso)
              .eq('desc_area', modalArea),
          { key: keyFor('offenders', period, modalArea), pageSize: 500 },
        );

        if (alive) {
          setOffenders((old) => [
            ...old.filter((row) => row.desc_area !== modalArea),
            ...rows,
          ]);
        }
      } catch (loadError) {
        console.warn('[Motor Ocioso] Ofensores:', loadError.message);
      }
    })();

    return () => {
      alive = false;
    };
  }, [period, modalArea]);

  const availableCategories = useMemo(
    () => [...new Set(weekly.map((row) => row.categoria).filter(Boolean))].sort(),
    [weekly],
  );

  useEffect(() => {
    if (!availableCategories.length) return;
    setCategories((old) => {
      const valid = old.filter((item) => availableCategories.includes(item));
      return valid.length ? valid : availableCategories;
    });
  }, [availableCategories]);

  const matches = (row) =>
    categories.includes(row.categoria) && (!selectedArea || row.desc_area === selectedArea);

  const areas = useMemo(
    () =>
      [...new Set(weekly.filter((row) => categories.includes(row.categoria)).map((row) => row.desc_area).filter(Boolean))]
        .sort((a, b) => String(a).localeCompare(String(b), 'pt-BR')),
    [weekly, categories],
  );

  const areaRows = useMemo(
    () =>
      areas.map((area) => {
        const dayRows = daily.filter(
          (row) => row.desc_area === area && categories.includes(row.categoria),
        );
        const weekRows = weekly.filter(
          (row) => row.desc_area === area && categories.includes(row.categoria),
        );
        const totalsRow = totals(weekRows);

        return {
          area,
          ...Object.fromEntries(
            DAYS.map((item) => {
              const rows = dayRows.filter(
                (row) => new Date(`${row.data}T12:00:00`).getDay() === item.day,
              );
              const dayTotals = totals(rows);
              return [item.key, rows.length ? pct(dayTotals.idle, dayTotals.operational) : null];
            }),
          ),
          ...totalsRow,
          value: pct(totalsRow.idle, totalsRow.operational),
        };
      }),
    [areas, daily, weekly, categories],
  );

  const operations = useMemo(() => {
    const map = new Map();
    details.filter(matches).forEach((row) => {
      const name = row.desc_operacao || 'NÃO INFORMADA';
      if (!map.has(name)) map.set(name, { name, operational: 0, engine: 0, idle: 0 });
      const item = map.get(name);
      item.operational += num(row.total_seg);
      item.engine += num(row.hrs_motor_ligado_seg);
      item.idle += num(row.ocioso_seg);
    });

    const totalOperational = [...map.values()].reduce(
      (sum, row) => sum + row.operational,
      0,
    );

    return [...map.values()]
      .map((row) => ({
        ...row,
        share: pct(row.operational, totalOperational),
        value: pct(row.idle, row.operational),
      }))
      .sort((a, b) => b.operational - a.operational);
  }, [details, categories, selectedArea]);

  const top = useMemo(
    () =>
      equipment
        .filter(matches)
        .map((row) => ({
          ...row,
          value: pct(num(row.hrs_ocioso_seg), num(row.hrs_operacionais_seg)),
        }))
        .filter((row) => row.value != null)
        .sort(
          (a, b) =>
            b.value - a.value || num(b.hrs_ocioso_seg) - num(a.hrs_ocioso_seg),
        )
        .slice(0, 20),
    [equipment, categories, selectedArea],
  );

  const weekChart = useMemo(
    () =>
      DAYS.map((item) => {
        const rows = daily.filter(
          (row) => matches(row) && new Date(`${row.data}T12:00:00`).getDay() === item.day,
        );
        const total = totals(rows);
        return {
          key: item.key,
          label: item.label,
          value: rows.length ? pct(total.idle, total.operational) : null,
          ...total,
        };
      }),
    [daily, categories, selectedArea],
  );

  const generalChart = useMemo(() => {
    const week = totals(weekly.filter(matches));
    const year = totals(annual.filter(matches));

    return [
      {
        key: 'week',
        label: `SEM ${period?.semana_iso || ''}`,
        value: pct(week.idle, week.operational),
        ...week,
      },
      {
        key: 'year',
        label: String(period?.ano || ''),
        value: pct(year.idle, year.operational),
        ...year,
      },
    ];
  }, [weekly, annual, categories, selectedArea, period]);

  const current = totals(weekly.filter(matches));
  const currentPct = pct(current.idle, current.operational);
  const currentTone = tone(currentPct);
  const selectedOffenders = offenders.filter((row) => categories.includes(row.categoria));
  const selectedDetails = details.filter((row) => categories.includes(row.categoria));

  const toggleCategory = (category) =>
    setCategories((old) =>
      old.includes(category)
        ? old.length === 1
          ? old
          : old.filter((item) => item !== category)
        : [...old, category],
    );

  return (
    <div className="dash-motor-ocioso">
      <aside className="mo-filter-rail">
        <section>
          <span className="mo-overline">Indicador operacional</span>
          <h2>Motor Ocioso</h2>
          <p>Meta operacional ≤ {META}%</p>
        </section>

        <section>
          <span className="mo-overline">Período</span>
          <label className="mo-field">
            <span>Semana operacional</span>
            <select
              value={periodKey}
              onChange={(event) => setPeriodKey(event.target.value)}
            >
              {periods.map((row) => (
                <option
                  key={`${row.ano}-${row.semana_iso}`}
                  value={`${row.ano}|${row.semana_iso}`}
                >
                  Semana {row.semana_iso} • {row.ano}
                </option>
              ))}
            </select>
            <small>
              {period
                ? `${fmtDate(period.data_inicio)} a ${fmtDate(period.data_final)} • ${period.status || '—'}`
                : '—'}
            </small>
          </label>
        </section>

        <section>
          <span className="mo-overline">Categorias</span>
          <div className="mo-category-list">
            {availableCategories.map((category) => (
              <button
                key={category}
                type="button"
                className={categories.includes(category) ? 'is-active' : ''}
                onClick={() => toggleCategory(category)}
              >
                <span />
                {category}
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="mo-filter-summary__head">
            <span className="mo-overline">Área ativa</span>
            <b>{areas.length}</b>
          </div>
          <button
            type="button"
            className={`mo-area-trigger ${selectedArea ? 'is-active' : ''}`}
            onClick={() => setSelectedArea('')}
          >
            <span>
              <strong>{selectedArea || 'Todas as áreas'}</strong>
              <small>
                {selectedArea ? 'Clique para limpar o filtro' : 'Selecione uma área na tabela'}
              </small>
            </span>
            <i>{selectedArea ? '×' : '✓'}</i>
          </button>
        </section>

        <section className="mo-rail-status">
          <span className="mo-overline">Status</span>
          <div className={`mo-status-chip is-${currentTone}`}>
            <i />
            <strong>{currentPct == null ? 'Sem resultado' : currentPct <= META ? 'Dentro da meta' : 'Acima da meta'}</strong>
          </div>
          <small>{background ? progress : 'Dados locais prontos'}</small>
        </section>
      </aside>

      <main className="mo-main">
        <section className="mo-context-bar">
          <div className="mo-context-title">
            <span className="mo-overline">COA Center • desempenho operacional</span>
            <div>
              <h1>Motor Ocioso</h1>
              <span className="mo-context-period">
                {period ? `Semana ${period.semana_iso} • ${period.ano}` : '—'}
              </span>
            </div>
          </div>
          <div className="mo-context-result">
            <span>Resultado selecionado</span>
            <strong className={`is-${currentTone}`}>{fmtPct(currentPct, 2)}</strong>
          </div>
        </section>

        {loading ? (
          <div className="mo-state">
            <div className="coa-loader-dots"><span /><span /><span /></div>
            <p>Carregando Motor Ocioso…</p>
          </div>
        ) : error ? (
          <div className="mo-state is-error">
            <strong>Erro ao carregar</strong>
            <p>{error}</p>
          </div>
        ) : (
          <>
            <section className="mo-kpi-grid">
              <StatCard
                label="Resultado"
                value={fmtPct(currentPct, 2)}
                detail={`Meta ≤ ${META}%`}
                className={`is-${currentTone}`}
              />
              <StatCard
                label="Motor ligado"
                value={fmtH(current.engine)}
                detail="Horas no período"
                className="is-neutral"
              />
              <StatCard
                label="Tempo ocioso"
                value={fmtH(current.idle)}
                detail="Horas no período"
                className={`is-${currentTone}`}
              />
              <StatCard
                label="Áreas"
                value={String(areas.length)}
                detail={selectedArea || 'Todas as áreas'}
                className="is-neutral"
              />
            </section>

            <section className="mo-workspace-grid">
              <article className="mo-panel mo-areas">
                <header>
                  <div>
                    <span className="mo-overline">Navegação operacional</span>
                    <h3>Detalhe por Área</h3>
                  </div>
                  <span>{areas.length} áreas</span>
                </header>
                <div className="mo-panel__scroll coa-no-scrollbar">
                  {areaRows.length ? (
                    <table>
                      <thead>
                        <tr>
                          <th>Área</th>
                          {DAYS.map((item) => <th key={item.key}>{item.label}</th>)}
                          <th>Motor ligado</th>
                          <th>Ocioso</th>
                          <th>%</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {areaRows.map((row) => (
                          <tr
                            key={row.area}
                            className={
                              selectedArea === row.area
                                ? 'is-selected'
                                : selectedArea
                                  ? 'is-dim'
                                  : ''
                            }
                            onClick={() =>
                              setSelectedArea(selectedArea === row.area ? '' : row.area)
                            }
                          >
                            <td><strong>{row.area}</strong></td>
                            {DAYS.map((item) => (
                              <td key={item.key} className={`is-${tone(row[item.key])}`}>
                                {fmtPct(row[item.key])}
                              </td>
                            ))}
                            <td>{fmtH(row.engine)}</td>
                            <td>{fmtH(row.idle)}</td>
                            <td>
                              <b className={`mo-value-pill is-${tone(row.value)}`}>
                                {fmtPct(row.value, 2)}
                              </b>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="mo-table-action"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setModalArea(row.area);
                                }}
                              >
                                Ver
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <EmptyState>Nenhuma área encontrada para os filtros atuais.</EmptyState>
                  )}
                </div>
              </article>

              <article className="mo-panel mo-ops">
                <header>
                  <div>
                    <span className="mo-overline">Impacto no período</span>
                    <h3>Horas por Operação</h3>
                  </div>
                  <span>{operations.length} operações</span>
                </header>
                <div className="mo-panel__scroll coa-no-scrollbar">
                  {operations.length ? (
                    <table>
                      <thead>
                        <tr>
                          <th>Operação</th>
                          <th>Total</th>
                          <th>%</th>
                          <th>Ocioso</th>
                          <th>%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {operations.map((row) => (
                          <tr key={row.name}>
                            <td title={row.name}>
                              <span className="mo-operation-name">
                                <strong>{row.name}</strong>
                                <i style={{ width: `${Math.min(100, row.share || 0)}%` }} />
                              </span>
                            </td>
                            <td>{fmtH(row.operational)}</td>
                            <td>{fmtPct(row.share)}</td>
                            <td>{fmtH(row.idle)}</td>
                            <td className={`is-${tone(row.value)}`}>{fmtPct(row.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <EmptyState>
                      {background ? 'Carregando detalhes das operações…' : 'Nenhuma operação encontrada.'}
                    </EmptyState>
                  )}
                </div>
              </article>

              <article className="mo-panel mo-equips">
                <header>
                  <div>
                    <span className="mo-overline">Top 20</span>
                    <h3>Equipamento Motor Ocioso</h3>
                  </div>
                  <span>{top.length} itens</span>
                </header>
                <div className="mo-panel__scroll coa-no-scrollbar">
                  {top.length ? (
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Código</th>
                          <th>Área</th>
                          <th>Ocioso</th>
                          <th>%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {top.map((row, index) => (
                          <tr key={`${row.cod_equip}-${row.desc_area}`}>
                            <td>{String(index + 1).padStart(2, '0')}</td>
                            <td>
                              <strong className="mo-equipment-code">{row.cod_equip}</strong>
                              <small>{row.desc_equip}</small>
                            </td>
                            <td>{row.desc_area}</td>
                            <td>{fmtH(row.hrs_ocioso_seg)}</td>
                            <td>
                              <b className={`mo-value-pill is-${tone(row.value)}`}>
                                {fmtPct(row.value, 2)}
                              </b>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <EmptyState>Nenhum equipamento encontrado.</EmptyState>
                  )}
                </div>
              </article>

              <IdleChart
                eyebrow="Evolução semanal"
                title="Motor Ocioso • Semana"
                data={weekChart}
                emptyText="Sem dados diários no período."
              />
              <IdleChart
                eyebrow="Comparativo"
                title="Motor Ocioso • Geral"
                data={generalChart}
                emptyText="Sem dados para comparação."
              />
            </section>
          </>
        )}
      </main>

      <DetailModal
        area={modalArea}
        offenders={selectedOffenders}
        details={selectedDetails}
        onClose={() => setModalArea('')}
      />
    </div>
  );
}
