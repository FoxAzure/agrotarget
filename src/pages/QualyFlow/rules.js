export const COLORS = {
  dentro: 'var(--q-success)', 
  fora: 'var(--q-danger)',   
  alerta: 'var(--q-warning)'  
};

export const QUALY_RULES = {
  CUC: {
    meta: (val) => val >= 90 ? 'var(--q-success)' : val >= 80 ? 'var(--q-warning)' : 'var(--q-danger)',
    vazaoMeta: (val) => val > 1.2 ? '#21618C' : val > 1.1 ? 'var(--q-warning)' : val >= 0.9 ? 'var(--q-success)' : val >= 0.8 ? 'var(--q-orange)' : 'var(--q-danger)',
    entupimentoMeta: (val) => val > 10 ? 'var(--q-danger)' : 'var(--q-success)'
  },
  Perdas: {
    perdaMeta: (v) => v <= 4.5 ? 'var(--q-success)' : 'var(--q-danger)',
    arranquioMeta: (v) => v <= 2.5 ? 'var(--q-success)' : 'var(--q-danger)',
    pisoteioSimplesMeta: (v) => v <= 50.0 ? 'var(--q-success)' : 'var(--q-danger)',
    pisoteioDuploMeta: (v) => v <= 2.0 ? 'var(--q-success)' : 'var(--q-danger)'
  }
};