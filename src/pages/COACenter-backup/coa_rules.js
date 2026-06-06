// ================================= DOCUMENTATION ------------------------------------------
// Script: coa_rules.js
// Purpose: Cérebro do front-end. Réplica 1:1 das regras do coa_rules.py (Backend Agrovale)
// + Engine de processamento para os Cards da Home, garantindo a mesma volumetria.
// ==========================================================================================

export const COA_CONSTANTS = {
  TEMP_IDEAL_CARREGADEIRA: 108.0,
  GRUPOS_INDISPONIBILIDADE: ["MANUTENÇÃO", "CLIMA", "SEM TURNO DE TRABALHO", "FABRICA PARADA"],
  SETORES_FORA_AGRICOLA: ["EMPACOTAMENTO", "INDÚSTRIA"],
  ORDEM_GRUPOS_RELATORIO: [
    'AUXILIAR', 'CLIMA', 'FABRICA PARADA', 'IMPRODUTIVO', 'INDETERMINADO', 
    'MANUTENÇÃO', 'PRODUTIVO', 'SEM APONTAMENTO', 'SEM TURNO DE TRABALHO'
  ]
};

// Metas operacionais em decimal (exatamente como no Python)
export const METAS = {
  EF_OP_VERDE: 0.65,
  EF_OP_AMARELO: 0.50,
  SEM_APONT_VERDE: 0.02,
  MOTOR_OC_VERDE: 0.05
};

export const COA_COLORS = {
  dentro: '#10B981',  // Emerald-500
  atencao: '#F59E0B', // Amber-500
  fora: '#EF4444',    // Red-500
  neutro: '#475569',  // Slate-600
  destaque: '#F97316' // Orange-500
};

// Regras visuais baseadas em porcentagem de 0 a 100
export const COA_RULES = {
  eficienciaOp: (val) => (val / 100) >= METAS.EF_OP_VERDE ? COA_COLORS.dentro : ((val / 100) >= METAS.EF_OP_AMARELO ? COA_COLORS.atencao : COA_COLORS.fora),
  semApontamento: (val) => (val / 100) <= METAS.SEM_APONT_VERDE ? COA_COLORS.dentro : COA_COLORS.fora,
  indeterminado: (val) => (val / 100) <= 0.10 ? COA_COLORS.dentro : COA_COLORS.fora,
  motorOcioso: (val) => (val / 100) <= METAS.MOTOR_OC_VERDE ? COA_COLORS.dentro : COA_COLORS.fora,
};

// Helper de tempo BLINDADO contra os formatos malucos de exportação
export const parseTimeToHours = (t) => {
  if (typeof t === 'number') return t * 24; // Se vier fracionado puro (ex: 0.5 = 12h)
  if (!t || typeof t !== 'string') return 0;
  
  let val = t.trim();
  let hours = 0;
  
  // Captura o caso em que o Excel envia 24h como uma data-base de 1900
  // Cobre tanto "01/01/1900" quanto "1900-01-01"
  if (val.includes("1900")) {
    hours += 24;
    // Se tiver espaço, tenta pegar só o que vem depois (a hora). Se não, zera para não bugar a leitura de HH:MM:SS
    val = val.includes(" ") ? val.split(" ")[1] : "00:00:00";
  } else if (val.includes(" ")) {
    // Se veio alguma outra data aleatória atrelada (ex: "24/04/2026 08:30:00"), ignoramos a data
    val = val.split(" ")[1] || "00:00:00";
  }

  // Agora sim, garantimos que só tem HH:MM:SS para jogar no parseInt
  if (val && val.includes(":")) {
    const p = val.split(":");
    // Usamos base 10 explícita para evitar que "08" ou "09" sejam lidos como octal em JS antigo
    hours += (parseInt(p[0], 10) || 0) + 
             (parseInt(p[1], 10) || 0) / 60 + 
             (parseInt(p[2], 10) || 0) / 3600;
  }
  
  return hours;
};

// ================================= EXECUTOR DA HOME ----------------------------------------
// Função que consome os dados filtrados por data e constrói a estrutura EXATA para os Cards
export const buildHomeCardsData = (filteredData) => {
  const groups = {};

  filteredData.forEach(item => {
    // Saneamento padrão
    const area = (item.AREA_MAP || "NÃO MAPEADO").trim().toUpperCase();
    
    if (!groups[area]) {
      groups[area] = {
        areaName: area,
        equips: new Set(),
        totalHoras: 0,
        produtivoHoras: 0,
        descontosHoras: 0, 
        motorHoras: 0,
        ociosoHoras: 0,
        semApontHoras: 0,
        indeterminadoHoras: 0,
        ofensoresMap: {},
        isSpecialCCT: false // Flag para renderizar o Card Especial
      };
    }

    const g = groups[area];
    const grupoNome = (item.DESC_GRUPO_OPERACAO || "").toUpperCase().trim();
    const estado = (item.ESTADO || "").toUpperCase().trim();
    const descEquip = (item.DESC_EQUIP || "").toUpperCase().trim();
    const descOp = (item.DESC_OPERACAO || "").toUpperCase().trim();

    // Verificação da REGRA DE NEGÓCIO DA CCT:
    if (area === 'CCT' && descEquip.includes('COLHEDORA') && descOp === 'CORTE MECANIZADO') {
      g.isSpecialCCT = true;
    }

    // Cálculos de horas devidamente tratados com o helper blindado
    const hrsOp = parseTimeToHours(item.HRS_OPERACIONAIS);
    const hrsMotor = parseTimeToHours(item.HRS_MOTOR_LIGADO);
    
    // Regra Ocioso (idêntica ao backend): Motor ligado (F) em operação não PRODUTIVA
    const isOcioso = estado === 'F' && grupoNome !== 'PRODUTIVO';
    const ociosoValue = isOcioso ? hrsMotor : 0;
    
    g.equips.add(item.COD_EQUIP);
    g.totalHoras += hrsOp;
    g.motorHoras += hrsMotor;
    g.ociosoHoras += ociosoValue;

    if (grupoNome === 'PRODUTIVO') g.produtivoHoras += hrsOp;
    if (COA_CONSTANTS.GRUPOS_INDISPONIBILIDADE.includes(grupoNome)) g.descontosHoras += hrsOp;
    if (grupoNome === 'SEM APONTAMENTO') g.semApontHoras += hrsOp;
    if (grupoNome === 'INDETERMINADO') g.indeterminadoHoras += hrsOp;

    if (['IMPRODUTIVO', 'AUXILIAR'].includes(grupoNome) && hrsOp > 0) {
      g.ofensoresMap[descOp] = (g.ofensoresMap[descOp] || 0) + hrsOp;
    }
  });

  return Object.values(groups).map(g => {
    const dispHoras = Math.max(0, g.totalHoras - g.descontosHoras);
    const efOp = dispHoras > 0 ? (g.produtivoHoras / dispHoras) * 100 : 0;
    const efReal = g.totalHoras > 0 ? (g.produtivoHoras / g.totalHoras) * 100 : 0;

    return {
      areaName: g.areaName,
      isSpecialCCT: g.isSpecialCCT,
      totalHorasRender: g.totalHoras, // Usado para ordenar o array final
      stats: {
        qtdEquipamentos: g.equips.size,
        totalHoras: g.totalHoras,
        horasDisponiveis: dispHoras,
        horasProdutivas: g.produtivoHoras,       
        horasSemApontamento: g.semApontHoras,   
        horasMotor: g.motorHoras,
        horasOcioso: g.ociosoHoras,
        percSemApontamento: g.totalHoras > 0 ? (g.semApontHoras / g.totalHoras) * 100 : 0,
        percIndeterminado: g.totalHoras > 0 ? (g.indeterminadoHoras / g.totalHoras) * 100 : 0,
        percMotorOcioso: g.totalHoras > 0 ? (g.ociosoHoras / g.totalHoras) * 100 : 0,
        eficienciaOperacional: efOp,
        eficienciaReal: efReal,
        ofensores: Object.entries(g.ofensoresMap)
          .map(([nome, hrs]) => ({ nome, horas: hrs }))
          .sort((a, b) => b.horas - a.horas)
          .slice(0, 3)
      }
    };
  }).sort((a, b) => b.totalHorasRender - a.totalHorasRender);
};



// ================================= HELPERS E EXECUTORES PARA MODAIS ------------------------

// Helper para converter horas decimais (ex: 1.5) para formato HH:MM (ex: "01:30")
export const formatDecimalToHHMM = (decimalHours) => {
  if (!decimalHours || isNaN(decimalHours) || decimalHours <= 0) return "00:00";
  const h = Math.floor(decimalHours);
  const m = Math.floor((decimalHours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// Função para construir os dados de um Equipamento Específico para o Modal
// Função para construir os dados de um Equipamento Específico para o Modal
export const buildEquipModalData = (rawData, codEquip) => {
  const equipRows = rawData.filter(r => 
    r.COD_EQUIP === codEquip || r.COD_EQUIP?.toString() === codEquip.toString()
  );
  
  if (!equipRows.length) return null;

  const id = codEquip;
  // Limpando o nome exatamente como você gosta
  let desc = equipRows[0].DESC_EQUIP || 'SEM DESCRIÇÃO';
  desc = desc.replace(/\d{5,}$/, '').trim(); 

  let totalH = 0, prodH = 0, descontosH = 0, motorH = 0, ociosoH = 0, sApontH = 0, indetH = 0;
  const gruposOp = {};

  equipRows.forEach(item => {
    const grupoNome = (item.DESC_GRUPO_OPERACAO || "INDETERMINADO").toUpperCase().trim();
    const estado = (item.ESTADO || "").toUpperCase().trim();
    // AQUI ESTÁ: Variável correta é opNome
    const opNome = (item.DESC_OPERACAO || "SEM OPERAÇÃO").toUpperCase().trim();

    const hrsOp = parseTimeToHours(item.HRS_OPERACIONAIS);
    const hrsMotor = parseTimeToHours(item.HRS_MOTOR_LIGADO);
    
    // Regra do Motor Ocioso mantendo consistência com o resto do sistema
    const isOcioso = estado === 'F' && grupoNome !== 'PRODUTIVO';
    const ociosoValue = isOcioso ? hrsMotor : 0;

    totalH += hrsOp;
    motorH += hrsMotor;
    ociosoH += ociosoValue;

    if (grupoNome === 'PRODUTIVO') prodH += hrsOp;
    if (COA_CONSTANTS.GRUPOS_INDISPONIBILIDADE.includes(grupoNome)) descontosH += hrsOp;
    if (grupoNome === 'SEM APONTAMENTO') sApontH += hrsOp;
    if (grupoNome === 'INDETERMINADO') indetH += hrsOp;

    // Constrói a árvore de Grupos -> Operações
    if (!gruposOp[grupoNome]) {
      gruposOp[grupoNome] = { totalH: 0, operacoes: {} };
    }
    gruposOp[grupoNome].totalH += hrsOp;
    
    // CORRIGIDO AQUI: usei opNome (com O) em vez de opName
    gruposOp[grupoNome].operacoes[opNome] = (gruposOp[grupoNome].operacoes[opNome] || 0) + hrsOp;
  });

  const dispH = Math.max(0, totalH - descontosH);
  
  return {
    id,
    desc,
    kpis: {
      totalH,
      dispH,
      prodH,
      motorH,
      ociosoH,
      efOp: dispH > 0 ? (prodH / dispH) * 100 : 0,
      efReal: totalH > 0 ? (prodH / totalH) * 100 : 0,
      percSApont: totalH > 0 ? (sApontH / totalH) * 100 : 0,
      percIndet: totalH > 0 ? (indetH / totalH) * 100 : 0,
      percMotorOcioso: totalH > 0 ? (ociosoH / totalH) * 100 : 0
    },
    gruposOp
  };
};



// ================================= COMBOIO ENGINE -----------------------------------------

export const buildComboioDashboardData = (rawData, selectedDate) => {
  const COMBOIOS_IDS = ["60043", "60051", "60052"];
  const dayData = rawData.filter(d => d.DATA.startsWith(selectedDate));
  
  const comboioStats = COMBOIOS_IDS.map(id => {
    return buildEquipModalData(dayData, id);
  }).filter(Boolean);

  if (comboioStats.length === 0) return null;

  // Consolidação da Frota Comboio
  const totais = comboioStats.reduce((acc, curr) => ({
    totalH: acc.totalH + curr.kpis.totalH,
    prodH: acc.prodH + curr.kpis.prodH,
    dispH: acc.dispH + curr.kpis.dispH,
    sApontH: acc.sApontH + (curr.kpis.percSApont * curr.kpis.totalH / 100),
    indetH: acc.indetH + (curr.kpis.percIndet * curr.kpis.totalH / 100),
    ociosoH: acc.ociosoH + curr.kpis.ociosoH
  }), { totalH: 0, prodH: 0, dispH: 0, sApontH: 0, indetH: 0, ociosoH: 0 });

  return {
    equips: comboioStats,
    rawData: dayData, // Para o Modal usar
    statsGeral: {
      efOp: totais.dispH > 0 ? (totais.prodH / totais.dispH) * 100 : 0,
      efReal: totais.totalH > 0 ? (totais.prodH / totais.totalH) * 100 : 0,
      percSApont: totais.totalH > 0 ? (totais.sApontH / totais.totalH) * 100 : 0,
      percIndet: totais.totalH > 0 ? (totais.indetH / totais.totalH) * 100 : 0,
      percMotorOcioso: totais.totalH > 0 ? (totais.ociosoH / totais.totalH) * 100 : 0,
      totalH: totais.totalH,
      prodH: totais.prodH,
      dispH: totais.dispH,
      ociosoH: totais.ociosoH
    }
  };
};