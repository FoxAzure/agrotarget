// ================================= DOCUMENTATION ------------------------------------------
// Script: DashMotorOcioso
// Purpose: Dashboard demonstrativo para análise de Motor Ocioso.
// Note: Dados fictícios usados somente para testar navegação e playlist.
// ==========================================================================================

import React from 'react';

const KPI_ITEMS = [
  { label: 'Motor Ocioso', value: '8,8%', width: '44%', status: 'is-warning' },
  { label: 'Horas Ociosas', value: '214 h', width: '68%', status: 'is-warning' },
  { label: 'Equipamentos', value: '126', width: '84%' },
  { label: 'Acima da Meta', value: '18', width: '36%', status: 'is-danger' },
  { label: 'Melhor Grupo', value: '3,2%', width: '32%' },
  { label: 'Meta', value: '≤ 5%', width: '50%' },
];

const OFFENDERS = [
  { name: 'TR-0421', hours: '16,8 h', width: '100%' },
  { name: 'CB-0187', hours: '13,4 h', width: '80%' },
  { name: 'TR-0398', hours: '10,9 h', width: '65%' },
  { name: 'CT-0254', hours: '8,6 h', width: '51%' },
  { name: 'TR-0415', hours: '6,2 h', width: '37%' },
];

const CHART_BARS = ['38%', '49%', '43%', '66%', '54%', '77%', '61%', '88%', '72%', '58%'];

const DashMotorOcioso = () => {
  return (
    <div className="coa-boletim">
      <section className="coa-boletim__intro">
        <div>
          <h2>Análise de Motor Ocioso</h2>
          <p>
            Visão demonstrativa das horas ociosas, equipamentos acima da meta e principais ofensores.
          </p>
        </div>

        <div className="coa-boletim__date-placeholder">
          Período operacional
        </div>
      </section>

      <section className="coa-boletim__kpis" aria-label="Indicadores de motor ocioso">
        {KPI_ITEMS.map((item) => (
          <article
            key={item.label}
            className={`coa-boletim-kpi ${item.status || ''}`}
          >
            <span className="coa-boletim-kpi__label">{item.label}</span>
            <strong className="coa-boletim-kpi__value">{item.value}</strong>
            <div className="coa-boletim-kpi__bar" aria-hidden="true">
              <span style={{ width: item.width }} />
            </div>
          </article>
        ))}
      </section>

      <section className="coa-boletim__grid">
        <article className="coa-boletim-panel">
          <header className="coa-boletim-panel__header">
            <h3>Motor ocioso por grupo de equipamento</h3>
            <span className="coa-badge coa-badge--warning">Horas</span>
          </header>

          <div className="coa-boletim-panel__body">
            <div
              className="coa-boletim-chart-placeholder"
              aria-label="Gráfico demonstrativo de motor ocioso por grupo"
            >
              {CHART_BARS.map((height, index) => (
                <span key={`${height}-${index}`} style={{ height }} />
              ))}
            </div>
          </div>
        </article>

        <article className="coa-boletim-panel">
          <header className="coa-boletim-panel__header">
            <h3>Equipamentos ofensores</h3>
            <span className="coa-badge coa-badge--danger">Top 5</span>
          </header>

          <div className="coa-boletim-panel__body">
            <div className="coa-boletim-offenders">
              {OFFENDERS.map((item, index) => (
                <div key={item.name} className="coa-boletim-offender">
                  <span className="coa-boletim-offender__rank">{index + 1}</span>

                  <div className="coa-boletim-offender__info">
                    <div className="coa-boletim-offender__top">
                      <span>{item.name}</span>
                    </div>
                    <div className="coa-boletim-offender__track" aria-hidden="true">
                      <span style={{ width: item.width }} />
                    </div>
                  </div>

                  <span className="coa-boletim-offender__hours">{item.hours}</span>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>
    </div>
  );
};

export default DashMotorOcioso;
