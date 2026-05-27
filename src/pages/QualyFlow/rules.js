// src/pages/QualyFlow/rules.js

export const COLORS = {
  dentro: '#17A54C', // Verde QualyFlow
  fora: '#C0392B',   // Vermelho Alerta
  alerta: '#D4AC0D'  // Amarelo Atenção
};

export const QUALY_RULES = {
  CUC: {
    // Regra CUC %: >= 90 Verde | >= 80 Amarelo | < 80 Vermelho
    meta: (val) => {
      if (val >= 90) return '#17A54C'; 
      if (val >= 80) return '#D4AC0D'; 
      return '#C0392B'; 
    },
    // Regra de Vazão (L/h)
    vazaoMeta: (val) => {
      if (val > 1.2) return '#21618C'; // Azul (Excesso)
      if (val > 1.1) return '#D4AC0D'; // Amarelo
      if (val >= 0.9) return '#17A54C'; // Verde (Ideal)
      if (val >= 0.8) return '#D35400'; // Laranja
      return '#C0392B'; // Vermelho (Crítico)
    },
    // Regra de Entupimento %
    entupimentoMeta: (val) => {
      if (val > 10) return '#C0392B'; // Acima de 10% é vermelho
      return '#17A54C'; // Abaixo ou igual a 10% é verde
    }
  }
  
  // Futuramente, você adiciona aqui as regras das outras atividades
  // Perdas: { meta: (val) => ... }
};