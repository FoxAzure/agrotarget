import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { getMetasParaData, getStatusColor } from '../../../components/QualyFlow/rulesPerdaMec';
import {
  BarChart,
  Bar,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import imgOuro from '../../../gallery/logo/medalha-de-ouro.png';
import imgPrata from '../../../gallery/logo/medalha-de-prata.png';
import imgBronze from '../../../gallery/logo/medalha-de-bronze.png';
import './DashRankingMec.css';

const TURNOS = ['1º Turno', '2º Turno'];
const MEDALHAS = [imgOuro, imgPrata, imgBronze];

// Ajustes visuais concentrados aqui para facilitar a personalização da tela.
const RANKING_LAYOUT = {
  tableWidth: 505,
  gap: 12,
  chartMinWidth: 560,
  chartItemWidth: 70,
  barSize: 30,
  tableRowHeight: 38,
  chartMachineFontSize: 10,
  chartPositionFontSize: 10,
  chartValueFontSize: 10,
  titleFontSize: 11,
  tableHeaderFontSize: 8,
  tableValueFontSize: 9,
  medalSize: 26,
  tablePositionFontSize: 9,
};

const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const nullableNum = (value) =>
  value === null || value === undefined || value === '' || !Number.isFinite(Number(value))
    ? null
    : Number(value);
const fmt = (value, decimals = 2) =>
  value === null || value === undefined || !Number.isFinite(Number(value))
    ? '-'
    : Number(value).toFixed(decimals).replace('.', ',');
const shortName = (value) => (value ? String(value).split(' - ')[0].trim() : 'DESC');
const normalizeShift = (value) =>
  /^1/.test(String(value ?? '').trim())
    ? '1º Turno'
    : /^2/.test(String(value ?? '').trim())
      ? '2º Turno'
      : String(value ?? '').trim();
const percent = (numerator, denominator) =>
  denominator > 0 ? (numerator / denominator) * 100 : null;

function Position({ position }) {
  if (position <= 3) {
    return (
      <img
        className="ranking-medal"
        src={MEDALHAS[position - 1]}
        alt={`${position}º lugar`}
        loading="lazy"
      />
    );
  }

  return <span className="ranking-position">{position}º</span>;
}

function StatusValue({ value, meta }) {
  return (
    <span
      className="ranking-status-value"
      style={{ color: value == null ? 'var(--rank-muted)' : getStatusColor(value, meta) }}
    >
      {value == null ? '-' : `${fmt(value)}%`}
    </span>
  );
}

function ChartXAxisTick({ x = 0, y = 0, payload, data }) {
  const row = data?.[payload?.index] || {};
  const machineName = row.name || payload?.value || '';

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        className="ranking-chart-machine-label"
        x="0"
        y="0"
        textAnchor="middle"
      >
        <tspan x="0" dy="12">{machineName}</tspan>
      </text>
      <text
        className="ranking-chart-position-label"
        x="0"
        y="0"
        textAnchor="middle"
      >
        <tspan x="0" dy="26">{row.position ? `${row.position}º LUGAR` : ''}</tspan>
      </text>
    </g>
  );
}

function ChartTooltip({ active, payload, shift, meta }) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="ranking-tooltip">
      <div className="ranking-tooltip-kicker">{shift}</div>
      <strong className="ranking-tooltip-machine">{row.fullName}</strong>
      <div className="ranking-tooltip-line">
        <span>Perda total</span>
        <b style={{ color: getStatusColor(row.perda, meta) }}>
          {row.perda == null ? '-' : `${fmt(row.perda)}%`}
        </b>
      </div>
      <div className="ranking-tooltip-line">
        <span>Pontos avaliados</span>
        <b>{row.pontos}</b>
      </div>
      {row.position ? (
        <div className="ranking-tooltip-line">
          <span>Posição no turno</span>
          <b>{`${row.position}º`}</b>
        </div>
      ) : null}
    </div>
  );
}

function ShiftChart({ shift, data, meta, selectedMachine, onSelect }) {
  const width = Math.max(
    RANKING_LAYOUT.chartMinWidth,
    data.length * RANKING_LAYOUT.chartItemWidth,
  );
  const metaValue = nullableNum(meta);

  return (
    <section
      className={`ranking-chart-panel ${shift === '1º Turno' ? 'is-first' : 'is-second'}`}
      aria-label={`Ranking de perdas mecanizadas do ${shift}`}
    >
      <div className="ranking-chart-head">
        <div className="ranking-chart-title-wrap">
          <span className="ranking-shift-mark" aria-hidden="true">
            {shift === '1º Turno' ? '01' : '02'}
          </span>
          <div>
            <strong>{shift}</strong>
            <span>{shift === '1º Turno' ? 'Primeira equipe' : 'Segunda equipe'}</span>
          </div>
        </div>
        <span className="ranking-chart-count">
          <b>{data.length}</b> {data.length === 1 ? 'colhedora' : 'colhedoras'}
        </span>
      </div>

      <div className="ranking-chart-legend">

        {metaValue != null ? <span className="ranking-meta-label">Meta: {fmt(metaValue)}%</span> : null}
      </div>

      <div className="ranking-chart-scroll">
        <div className="ranking-chart-canvas" style={{ width }}>
          {!data.length ? (
            <div className="ranking-chart-empty">
              <span className="ranking-empty-icon" aria-hidden="true">—</span>
              <strong>Sem dados neste turno</strong>
              <small>Não há avaliações para a safra selecionada.</small>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 28, right: 12, left: 7, bottom: 38 }}
                barCategoryGap="24%"
              >
                <XAxis
                  dataKey="name"
                  interval={0}
                  axisLine={false}
                  tickLine={false}
                  tick={<ChartXAxisTick data={data} />}
                  height={44}
                />
                <YAxis
                  hide
                  domain={[0, (max) => Math.max(num(max) * 1.2, num(metaValue) * 1.25, 1)]}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(148,163,184,.08)' }}
                  content={<ChartTooltip shift={shift} meta={meta} />}
                />
                {metaValue != null ? (
                  <ReferenceLine
                    y={metaValue}
                    stroke="#34d399"
                    strokeDasharray="5 4"
                    strokeWidth={1.5}
                  />
                ) : null}
                <Bar
                  dataKey="perda"
                  barSize={RANKING_LAYOUT.barSize}
                  radius={[6, 6, 2, 2]}
                  isAnimationActive={false}
                  onClick={(item) => onSelect(item?.machine || item?.payload?.machine)}
                >
                  {data.map((row) => {
                    const selected = selectedMachine === row.machine;
                    const dimmed = Boolean(selectedMachine && !selected);

                    return (
                      <Cell
                        key={`${shift}-${row.machine}`}
                        fill={row.perda == null ? '#64748b' : getStatusColor(row.perda, meta)}
                        fillOpacity={dimmed ? 0.25 : 1}
                        stroke={selected ? '#f8fafc' : 'transparent'}
                        strokeWidth={selected ? 2 : 0}
                        cursor="pointer"
                      />
                    );
                  })}
                  <LabelList
                    dataKey="perda"
                    position="top"
                    formatter={(value) => (value == null ? '-' : `${fmt(value)}%`)}
                    fill="#e2e8f0"
                    fontSize={RANKING_LAYOUT.chartValueFontSize}
                    fontWeight={800}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </section>
  );
}

function SummaryCard({ icon, label, value, detail, tone = 'green' }) {
  return (
    <article className={`ranking-summary-card tone-${tone}`}>
      <span className="ranking-summary-icon" aria-hidden="true">{icon}</span>
      <div className="ranking-summary-copy">
        <span className="ranking-summary-label">{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function EmptyState({ title, detail, isError = false }) {
  return (
    <div className={`ranking-state ${isError ? 'is-error' : ''}`} role={isError ? 'alert' : 'status'}>
      <span className="ranking-state-icon" aria-hidden="true">{isError ? '!' : '↗'}</span>
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

export default function DashRankingMec() {
  const [activeYear, setActiveYear] = useState(new Date().getFullYear());
  const [years, setYears] = useState([]);
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMachine, setSelectedMachine] = useState('');
  const [tableFilter, setTableFilter] = useState('geral');

  const metas = useMemo(
    () => getMetasParaData(`${activeYear}-12-31`) || {},
    [activeYear],
  );

  useEffect(() => {
    let active = true;

    const loadYears = async () => {
      const { data, error: queryError } = await supabase
        .from('vw_q_perdamec_ano')
        .select('ano')
        .order('ano', { ascending: false });

      if (!active) return;

      if (queryError) {
        setError(queryError.message || 'Não foi possível carregar as safras disponíveis.');
        setLoading(false);
        return;
      }

      const list = [...new Set((data || []).map((row) => num(row.ano)).filter(Boolean))]
        .sort((a, b) => b - a);

      setYears(list);
      if (list.length) {
        setActiveYear((current) => (list.includes(current) ? current : list[0]));
      } else {
        setRawData([]);
        setLoading(false);
      }
    };

    loadYears();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!activeYear || !years.length) return undefined;

    let active = true;
    setLoading(true);
    setError('');
    setSelectedMachine('');

    const loadRanking = async () => {
      const { data, error: queryError } = await supabase
        .from('vw_q_perdamec_colhedora')
        .select('*')
        .eq('ano', activeYear);

      if (!active) return;

      if (queryError) {
        setError(queryError.message || 'Não foi possível carregar o ranking.');
        setRawData([]);
      } else {
        setRawData(data || []);
      }

      setLoading(false);
    };

    loadRanking();
    return () => {
      active = false;
    };
  }, [activeYear, years.length]);

  const processed = useMemo(() => {
    const rows = rawData.map((row) => {
      const avS = num(row.av_pisoteio_simples);
      const mtS = num(row.mt_pisoteio_simples);
      const avD = num(row.av_pisoteio_duplo);
      const mtD = num(row.mt_pisoteio_duplo);

      return {
        ...row,
        machine: row.colhedora || 'DESC',
        name: shortName(row.colhedora),
        fullName: row.colhedora || 'DESC',
        shift: normalizeShift(row.turno),
        perda: nullableNum(row.perda_perc),
        pSimples: percent(mtS, avS),
        pDuplo: percent(mtD, avD),
        arranquio: nullableNum(row.arranquio_perc),
        totalPerda: num(row.total_perda),
        tch: num(row.tch_estimado),
        avS,
        mtS,
        avD,
        mtD,
        arrancados: num(row.tocos_arrancados),
        fixos: num(row.tocos_fixos),
        pontos: num(row.qnt_pontos),
      };
    });

    const chartData = Object.fromEntries(
      TURNOS.map((turno) => [
        turno,
        rows
          .filter((row) => row.shift === turno)
          .sort((a, b) => (a.perda ?? Infinity) - (b.perda ?? Infinity))
          .map((row, index) => ({ ...row, position: index + 1 })),
      ]),
    );

    const tableSource = tableFilter === 'geral'
      ? rows
      : rows.filter((row) => row.shift === tableFilter);
    const grouped = new Map();

    tableSource.forEach((row) => {
      if (!grouped.has(row.machine)) {
        grouped.set(row.machine, {
          machine: row.machine,
          name: row.name,
          totalPerda: 0,
          tch: 0,
          mtS: 0,
          avS: 0,
          mtD: 0,
          avD: 0,
          arrancados: 0,
          fixos: 0,
          pontos: 0,
          perdas: [],
          arr: [],
        });
      }

      const item = grouped.get(row.machine);
      item.totalPerda += row.totalPerda;
      item.tch += row.tch;
      item.mtS += row.mtS;
      item.avS += row.avS;
      item.mtD += row.mtD;
      item.avD += row.avD;
      item.arrancados += row.arrancados;
      item.fixos += row.fixos;
      item.pontos += row.pontos;
      if (row.perda != null) item.perdas.push(row.perda);
      if (row.arranquio != null) item.arr.push(row.arranquio);
    });

    const average = (values) =>
      values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

    const tableRows = [...grouped.values()]
      .map((item) => ({
        ...item,
        perda: item.totalPerda + item.tch > 0
          ? (item.totalPerda / (item.totalPerda + item.tch)) * 100
          : average(item.perdas),
        pSimples: percent(item.mtS, item.avS),
        pDuplo: percent(item.mtD, item.avD),
        arranquio: item.fixos > 0
          ? percent(item.arrancados, item.fixos)
          : average(item.arr),
      }))
      .sort((a, b) => (a.perda ?? Infinity) - (b.perda ?? Infinity))
      .map((item, index) => ({ ...item, position: index + 1 }));

    return { chartData, tableRows, allRows: rows };
  }, [rawData, tableFilter]);

  const summary = useMemo(() => {
    const machineNames = new Set(processed.allRows.map((row) => row.machine));
    const validRows = processed.allRows
      .filter((row) => row.perda != null)
      .sort((a, b) => a.perda - b.perda);
    const totalPoints = processed.allRows.reduce((sum, row) => sum + row.pontos, 0);

    return {
      machines: machineNames.size,
      points: totalPoints,
      best: validRows[0] || null,
    };
  }, [processed.allRows]);

  const selectMachine = (machine) => {
    if (machine) {
      setSelectedMachine((current) => (current === machine ? '' : machine));
    }
  };

  const handleRowKeyDown = (event, machine) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectMachine(machine);
    }
  };

  return (
    <div
      className="dash-ranking-mec"
      style={{
        '--ranking-kpi-width': `${RANKING_LAYOUT.tableWidth}px`,
        '--ranking-layout-gap': `${RANKING_LAYOUT.gap}px`,
        '--ranking-table-row-height': `${RANKING_LAYOUT.tableRowHeight}px`,
        '--ranking-chart-machine-font-size': `${RANKING_LAYOUT.chartMachineFontSize}px`,
        '--ranking-chart-position-font-size': `${RANKING_LAYOUT.chartPositionFontSize}px`,
        '--ranking-title-font-size': `${RANKING_LAYOUT.titleFontSize}px`,
        '--ranking-table-header-font-size': `${RANKING_LAYOUT.tableHeaderFontSize}px`,
        '--ranking-table-value-font-size': `${RANKING_LAYOUT.tableValueFontSize}px`,
        '--ranking-medal-size': `${RANKING_LAYOUT.medalSize}px`,
        '--ranking-table-position-font-size': `${RANKING_LAYOUT.tablePositionFontSize}px`,
      }}
    >
      <header className="ranking-header">
        <div className="ranking-title-block">
          
          <div className="ranking-heading-copy">
            <h1>Visão geral das colhedoras</h1>
            <p>Desempenho por turno e visão consolidada da safra.</p>
          </div>
        </div>

        <div className="ranking-year-control">
          <label htmlFor="ranking-year-select">Safra</label>
          <select
            id="ranking-year-select"
            value={activeYear}
            onChange={(event) => setActiveYear(Number(event.target.value))}
            disabled={!years.length || loading}
          >
            {years.length
              ? years.map((year) => <option key={year} value={year}>{year}</option>)
              : <option value={activeYear}>{activeYear}</option>}
          </select>
        </div>
      </header>

      

      {loading ? (
        <EmptyState title="Carregando ranking…" detail={`Consultando as avaliações da safra ${activeYear}.`} />
      ) : error ? (
        <EmptyState title="Não foi possível carregar os dados" detail={error} isError />
      ) : !rawData.length ? (
        <EmptyState title="Nenhuma avaliação encontrada" detail={`Não há dados de perdas mecanizadas para a safra ${activeYear}.`} />
      ) : (
        <main className="ranking-layout">
          <div className="ranking-charts-column">
            {TURNOS.map((turno) => (
              <ShiftChart
                key={turno}
                shift={turno}
                data={processed.chartData[turno]}
                meta={metas.perda}
                selectedMachine={selectedMachine}
                onSelect={selectMachine}
              />
            ))}
          </div>

          <aside className="ranking-table-panel">
            <div className="ranking-table-head">
              <div className="ranking-table-heading-row">
                <div>
                  <span className="ranking-section-kicker">VISÃO CONSOLIDADA</span>
                  <strong>KPIs por colhedora</strong>
                  <span>Selecione uma máquina para destacá-la nos gráficos.</span>
                </div>
                {selectedMachine ? (
                  <button
                    className="ranking-clear-selection"
                    type="button"
                    onClick={() => setSelectedMachine('')}
                    title="Limpar seleção de colhedora"
                  >
                    Limpar <b>×</b>
                  </button>
                ) : null}
              </div>

              <div className="ranking-filter-tags" aria-label="Filtrar tabela por turno">
                {['geral', ...TURNOS].map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    className={tableFilter === filter ? 'is-active' : ''}
                    aria-pressed={tableFilter === filter}
                    onClick={() => setTableFilter(filter)}
                  >
                    {filter === 'geral' ? 'Geral' : filter}
                  </button>
                ))}
              </div>
            </div>

            <div className="ranking-table-scroll">
              <table className="ranking-table">
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Colhedora</th>
                    <th scope="col">Pontos</th>
                    <th scope="col">Perda</th>
                    <th scope="col">P. simples</th>
                    <th scope="col">P. duplo</th>
                    <th scope="col">Arranquio</th>
                  </tr>
                </thead>
                <tbody>
                  {processed.tableRows.map((row) => {
                    const selected = selectedMachine === row.machine;
                    const dimmed = Boolean(selectedMachine && !selected);

                    return (
                      <tr
                        key={row.machine}
                        className={`${selected ? 'is-selected' : ''} ${dimmed ? 'is-dimmed' : ''}`.trim()}
                        onClick={() => selectMachine(row.machine)}
                        onKeyDown={(event) => handleRowKeyDown(event, row.machine)}
                        tabIndex={0}
                        aria-selected={selected}
                        title={`Selecionar ${row.machine}`}
                      >
                        <td className="ranking-position-cell"><Position position={row.position} /></td>
                        <td className="ranking-machine-cell">{row.name}</td>
                        <td>{row.pontos.toLocaleString('pt-BR')}</td>
                        <td><StatusValue value={row.perda} meta={metas.perda} /></td>
                        <td><StatusValue value={row.pSimples} meta={metas.pisoteio_simples} /></td>
                        <td><StatusValue value={row.pDuplo} meta={metas.pisoteio_duplo} /></td>
                        <td><StatusValue value={row.arranquio} meta={metas.arranquio} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!processed.tableRows.length ? (
                <div className="ranking-table-empty">Nenhuma colhedora neste filtro.</div>
              ) : null}
            </div>

            <footer className="ranking-table-footer">
              <span><i /> Menor perda no topo</span>
              <span>{processed.tableRows.length} {processed.tableRows.length === 1 ? 'colhedora' : 'colhedoras'}</span>
            </footer>
          </aside>
        </main>
      )}
    </div>
  );

}
