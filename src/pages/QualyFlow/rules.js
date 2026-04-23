// src/pages/QualyFlow/rules.js
export const COLORS = {
  dentro: '#00B050',  // Verde
  atencao: '#FFC000', // Amarelo
  fora: '#FF0000',   // Vermelho
  neutro: '#64748B'   // Slate-500 (Cinza técnico)
};

export const QUALY_RULES = {
  // --- PREPARO ---
  "Haste": { meta: (v) => v >= 23 ? COLORS.dentro : COLORS.fora, unidade: "cm" },
  "Cana": { meta: (v) => v >= 18 ? COLORS.dentro : COLORS.fora, unidade: "cm" },
  "Fita": { meta: (v) => v >= 18 ? COLORS.dentro : COLORS.fora, unidade: "cm" },
  "Paralelismo": {
    meta: (v) => {
      if (v >= 90) return COLORS.dentro;
      if (v >= 70) return COLORS.atencao;
      return COLORS.fora;
    },
    unidade: "%"
  },
  // --- PLANTIO ---
  "GemasViáveis": {
    meta: (v) => {
      if (v > 80) return COLORS.dentro;
      if (v >= 70) return COLORS.atencao;
      return COLORS.fora;
    },
    unidade: "%"
  },
  "Falha": {
    meta: (v) => {
      if (v === 0) return COLORS.dentro;
      if (v <= 1) return COLORS.atencao;
      return COLORS.fora;
    },
    unidade: "%"
  },
  "GemasPorMetro": {
    meta: (v) => {
      if (v >= 14 && v <= 28) return COLORS.dentro;
      if ((v >= 10 && v < 14) || (v > 28 && v <= 32)) return COLORS.atencao;
      return COLORS.fora;
    },
    unidade: "un"
  },
  "Cobertura": {
    meta: (v) => (v >= 5 && v <= 8) ? COLORS.dentro : COLORS.fora,
    unidade: "cm"
  },
  // --- SEMENTE ---
  "Semente": {
    idade: (v) => {
      if (v === 8 || (v >= 7 && v <= 9)) return COLORS.dentro;
      if ((v >= 6 && v < 7) || (v > 9 && v <= 10)) return COLORS.atencao;
      return COLORS.fora;
    },
    tamanho: (v) => {
      if (v >= 35 && v <= 40) return COLORS.dentro;
      if (v >= 30 && v <= 45) return COLORS.atencao;
      return COLORS.fora;
    }
  },
  // --- CUC ---
  "CUC": {
    meta: (v) => {
      if (v >= 90) return COLORS.dentro;
      if (v >= 80) return COLORS.atencao;
      return COLORS.fora;
    },
    // Regra da Vazão: Verde entre 0.9 e 1.1
    vazaoMeta: (v) => (v >= 0.9 && v <= 1.1) ? COLORS.dentro : COLORS.neutro,
    // Regra do Entupimento: Vermelho acima de 10%
    entupimentoMeta: (v) => v > 10 ? COLORS.fora : COLORS.neutro
  },
  // --- ADUBAÇÃO ---
  "Adubacao": {
    meta: (v) => {
      const absV = Math.abs(v);
      // Regra de Ouro: Saiu dos 8% (para mais ou menos) é Vermelho. [cite: 2026-02-11]
      return absV <= 8 ? COLORS.dentro : COLORS.fora;
    },
    unidade: "%"
  },
  // --- APLICAÇÃO DE COMPOSTO ---
  "Composto": {
    ton: (v) => {
      if (v >= 22 && v <= 28) return COLORS.dentro; // 22 a 28 é verde
      if (v < 22) return COLORS.fora;               // Menor que 22 vermelho
      return COLORS.atencao;                        // Acima de 28 é amarelo [cite: 2026-02-11]
    },
    variacao: (v) => {
      if (v >= -12 && v <= 12) return COLORS.dentro; // -12 a 12% é verde
      if (v < -12) return COLORS.fora;               // Abaixo é vermelho
      return COLORS.atencao;                         // Acima é amarelo [cite: 2026-02-11]
    }
  },
  // --- AVALIAÇÃO DRONE ---
  "Drone": {
    meta: (v) => {
      const absV = Math.abs(v);
      if (absV <= 5) return COLORS.dentro;   // Até 5% é perfeito
      if (absV <= 10) return COLORS.atencao; // Entre 5% e 10% atenção
      return COLORS.fora;                    // Acima de 10% fora
    }
  },
  // --- CASA DE BOMBA (EB) ---
  "CasaBomba": {
    percentual: (v) => {
      if (v >= 90) return COLORS.dentro;   // Verde (Top)
      if (v >= 80) return COLORS.atencao;   // Amarelo/Laranja Leve
      return COLORS.fora;                  // Vermelho (< 70)
    },
    status: (s) => (s === "Conforme" ? COLORS.dentro : COLORS.fora)
  },
  // --- CHECKLIST GOTEJO ---
  "ChecklistGotejo": {
    pressao: (v) => (v >= 7 && v <= 22 ? COLORS.dentro : COLORS.fora),
    // Cores específicas do gráfico solicitado
    colors: {
      minOk: "#60A5FA",    // Azul Claro (Blue-400)
      maxOk: "#1D4ED8",    // Azul Escuro (Blue-700)
      erro: "#EF4444",     // Vermelho (Red-500)
      meta: "#94A3B8"      // Cinza Neutro (Slate-400)
    }
  },
  // --- PLANTIO MANUAL ---
  "PlantioManual_Viaveis": {
    meta: (v) => {
      if (v >= 90) return COLORS.dentro;    // Verde
      if (v >= 80) return COLORS.atencao;   // Amarelo
      return COLORS.fora;                   // Vermelho
    },
    unidade: "%"
  },
  "PlantioManual_Falha": {
    meta: (v) => {
      if (v === 0) return COLORS.dentro;    // Verde (Zero absoluto)
      if (v <= 1) return COLORS.atencao;    // Amarelo (Até 1%)
      return COLORS.fora;                   // Vermelho (Acima de 1%)
    },
    unidade: "%"
  },
  "PlantioManual_GemasMetro": {
    meta: (v) => {
      if (v >= 15 && v <= 18) return COLORS.dentro; // Verde
      if ((v >= 12 && v <= 14) || (v >= 19 && v <= 21)) return COLORS.atencao; // Amarelo
      return COLORS.fora; // Vermelho
    },
    unidade: "un"
  },
  "PlantioManual_Cobertura": {
    meta: (v) => (v >= 5 && v <= 8) ? COLORS.dentro : COLORS.fora,
    unidade: "cm"
  },
};