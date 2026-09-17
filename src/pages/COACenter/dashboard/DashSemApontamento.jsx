// ================================= DOCUMENTATION ------------------------------------------
// Script: DashSemApontamento
// Purpose: Dashboard demonstrativo para análise de equipamentos Sem Apontamento.
// Note: Dados fictícios usados somente para testar navegação e playlist.
// ==========================================================================================

import React from 'react';

const KPI_ITEMS = [
  { label: 'Sem Apontamento', value: '1,8%', width: '18%', status: 'is-warning' },
  { label: 'Horas sem Registro', value: '43,6 h', width: '44%', status: 'is-warning' },
  { label: 'Equipamentos', value: '12', width: '24%', status: 'is-danger' },
  { label: 'Ocorrências', value: '31', width: '62%', status: 'is-warning' },
  { label: 'Maior Intervalo', value: '4,2 h', width: '42%', status: 'is-danger' },
  { label: 'Meta', value: '≤ 1%', width: '10%' },
];

const OFFENDERS = [
  { name: 'TR-0312', hours: '7,8 h', width: '100%' },
  { name: 'CB-0204', hours: '6,1 h', width: '78%' },
  { name: 'CT-0118', hours: '4,9 h', width: '63%' },
  { name: 'TR-0407', hours: '3,6 h', width: '46%' },
  { name: 'CM-0089', hours: '2,8 h', width: '36%' },
];

const CHART_BARS = ['24%', '42%', '31%', '57%', '36%', '69%', '45%', '81%', '52%', '33%'];

const DashSemApontamento = () => {
  return (
    <div className="coa-boletim">
      <section className="coa-boletim__intro">
        <div>
          <h2>Análise de Equipamentos sem Apontamento</h2>
          <p>
            Visão demonstrativa das lacunas de registro, ocorrências e equipamentos que exigem acompanhamento.
          </p>
        </div>

        <div className="coa-boletim__date-placeholder">
          Período operacional
        </div>
      </section>

      <section className="coa-boletim__kpis" aria-label="Indicadores sem apontamento">
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
            <h3>Horas sem apontamento por faixa operacional</h3>
            <span className="coa-badge coa-badge--warning">Ocorrências</span>
          </header>

          <div className="coa-boletim-panel__body">
            <div
              className="coa-boletim-chart-placeholder"
              aria-label="Gráfico demonstrativo de horas sem apontamento"
            >
              {CHART_BARS.map((height, index) => (
                <span key={`${height}-${index}`} style={{ height }} />
              ))}
            </div>
          </div>
        </article>

        <article className="coa-boletim-panel">
          <header className="coa-boletim-panel__header">
            <h3>Equipamentos sem apontamento</h3>
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

export default DashSemApontamento;
