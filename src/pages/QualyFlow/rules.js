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
  },


  // ================================= PLANTIO MECANIZADO -------------------------------------
  // Adicionar dentro de QUALY_RULES.
  // A regra vigente será a mais recente cuja data seja menor ou igual à data selecionada.
  // Para cadastrar uma nova regra, adicione outro objeto ao array com uma vigência posterior.
    PlantioMec: {
    histograma: [
      {
        vigencia: '2024-01-01',
        faixas: [
          { label: '<10', min: 0, max: 9.999999, cor: 'var(--q-danger)' },
          { label: '10–13', min: 10, max: 13.999999, cor: 'var(--q-warning)' },
          { label: '14–28', min: 14, max: 28, cor: 'var(--q-success)' },
          { label: '29–32', min: 28.000001, max: 32, cor: 'var(--q-warning)' },
          { label: '>32', min: 32.000001, max: null, cor: 'var(--q-danger)' }
        ]
      }
    ]
  }
};