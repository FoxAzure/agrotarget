// ================================= DOCUMENTATION ------------------------------------------
// Script: coa_rules_full.js
// Purpose: Núcleo COMPLETO de cálculos 1:1 com o backend Python (coa_rules.py)
// ==========================================================================================

export const COA_CONSTANTS = {
  GRUPOS_INDISPONIBILIDADE: ["MANUTENÇÃO", "CLIMA", "SEM TURNO DE TRABALHO", "FABRICA PARADA"],
  ORDEM_GRUPOS_RELATORIO: [
    'AUXILIAR', 'CLIMA', 'FABRICA PARADA', 'IMPRODUTIVO', 'INDETERMINADO',
    'MANUTENÇÃO', 'PRODUTIVO', 'SEM APONTAMENTO', 'SEM TURNO DE TRABALHO'
  ]
};

// ================= SANITIZE =================
export function sanitizeData(data) {
  return data.map(row => ({
    ...row,
    DESC_GRUPO_OPERACAO: (row.DESC_GRUPO_OPERACAO || "").trim().toUpperCase(),
    ESTADO: (row.ESTADO || "").trim().toUpperCase(),
    DESC_OPERACAO: (row.DESC_OPERACAO || "").trim().toUpperCase(),
    COD_EQUIP: (row.COD_EQUIP || "").toString().trim().toUpperCase()
  }));
}

// ================= KPIS BÁSICOS =================
export function calcKpisBasicos(data) {
  if (!data?.length) {
    return { total_h: 0, disp_h: 0, prod_h: 0, ef_op: 0, ef_real: 0 };
  }

  let total_h = 0;
  let prod_h = 0;
  let indisp_h = 0;

  data.forEach(r => {
    const hrs = Number(r.HRS_DECIMAL) || 0;
    const grupo = r.DESC_GRUPO_OPERACAO;

    total_h += hrs;

    if (grupo === 'PRODUTIVO') prod_h += hrs;
    if (COA_CONSTANTS.GRUPOS_INDISPONIBILIDADE.includes(grupo)) {
      indisp_h += hrs;
    }
  });

  const disp_h = Math.max(0, total_h - indisp_h);

  return {
    total_h,
    disp_h,
    prod_h,
    ef_op: disp_h > 0 ? prod_h / disp_h : 0,
    ef_real: total_h > 0 ? prod_h / total_h : 0
  };
}

// ================= KPIS DETALHADOS =================
export function calcKpisDetalhados(data) {
  if (!data?.length) {
    return {
      totais: 0, disp: 0, produtivo: 0, ef_op: 0, ef_real: 0,
      sem_apont: 0, indet: 0, perc_sem_apont: 0, perc_indet: 0,
      auxiliar: 0, improdutivo: 0, manutencao: 0, clima: 0,
      sem_turno: 0, fabrica_parada: 0,
      perc_grupos: Object.fromEntries(COA_CONSTANTS.ORDEM_GRUPOS_RELATORIO.map(g => [g, 0]))
    };
  }

  const sumGrupo = (g) => data
    .filter(r => r.DESC_GRUPO_OPERACAO === g)
    .reduce((acc, r) => acc + (Number(r.HRS_DECIMAL) || 0), 0);

  const res = {
    totais: data.reduce((a, r) => a + (Number(r.HRS_DECIMAL) || 0), 0),
    produtivo: sumGrupo('PRODUTIVO'),
    improdutivo: sumGrupo('IMPRODUTIVO'),
    auxiliar: sumGrupo('AUXILIAR'),
    manutencao: sumGrupo('MANUTENÇÃO'),
    clima: sumGrupo('CLIMA'),
    sem_turno: sumGrupo('SEM TURNO DE TRABALHO'),
    sem_apont: sumGrupo('SEM APONTAMENTO'),
    indet: sumGrupo('INDETERMINADO'),
    fabrica_parada: sumGrupo('FABRICA PARADA')
  };

  const indisp = res.manutencao + res.clima + res.sem_turno + res.fabrica_parada;

  res.disp = Math.max(0, res.totais - indisp);
  res.ef_op = res.disp > 0 ? res.produtivo / res.disp : 0;
  res.ef_real = res.totais > 0 ? res.produtivo / res.totais : 0;

  res.perc_sem_apont = res.totais > 0 ? res.sem_apont / res.totais : 0;
  res.perc_indet = res.totais > 0 ? res.indet / res.totais : 0;

  res.perc_grupos = Object.fromEntries(
    COA_CONSTANTS.ORDEM_GRUPOS_RELATORIO.map(g => [
      g,
      res.totais > 0 ? sumGrupo(g) / res.totais : 0
    ])
  );

  return res;
}

// ================= MOTOR OCIOSO =================
export function calcMotorOcioso(data) {
  if (!data?.length) return 0;

  return data.reduce((acc, r) => {
    const estado = r.ESTADO;
    const grupo = r.DESC_GRUPO_OPERACAO;
    const hrs = Number(r.HRS_MOTOR_DECIMAL) || 0;

    if (estado === 'F' && grupo !== 'PRODUTIVO') {
      return acc + hrs;
    }
    return acc;
  }, 0);
}

// ================= PROCESSAMENTO MOTOR =================
export function processarDadosOcioso(data) {
  if (!data?.length) return [];

  return data.map(r => {
    const hrsMotor = Number(r.HRS_MOTOR_DECIMAL) || 0;

    return {
      ...r,
      EFETIVO: (r.ESTADO === 'E' && r.DESC_GRUPO_OPERACAO === 'PRODUTIVO') ? hrsMotor : 0,
      OCIOSO: (r.ESTADO === 'F' && r.DESC_GRUPO_OPERACAO !== 'PRODUTIVO') ? hrsMotor : 0
    };
  });
}

// ================= RESUMO OCIOSO =================
export function sumarizarOcioso(data) {
  if (!data?.length) return { totais: 0, motor: 0, efetivo: 0, ocioso: 0, perc_ocioso: 0 };

  const totais = data.reduce((a, r) => a + (Number(r.HRS_DECIMAL) || 0), 0);
  const motor = data.reduce((a, r) => a + (Number(r.HRS_MOTOR_DECIMAL) || 0), 0);
  const efetivo = data.reduce((a, r) => a + (r.EFETIVO || 0), 0);
  const ocioso = data.reduce((a, r) => a + (r.OCIOSO || 0), 0);

  return {
    totais,
    motor,
    efetivo,
    ocioso,
    perc_ocioso: totais > 0 ? ocioso / totais : 0
  };
}
