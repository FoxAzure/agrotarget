// src/pages/QualyFlow/rules.js
export const COLORS = {
  dentro: '#00B050',  // Verde
  atencao: '#FFC000', // Amarelo
  fora: '#FF0000',   // Vermelho
  neutro: '#CBD5E1'   // Cinza para dados inexistentes
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
  }, // Vírgula restaurada aqui!
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
  }
};