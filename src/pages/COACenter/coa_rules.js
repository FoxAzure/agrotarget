export const COA_COLORS = {
  dentro: '#10B981', // Emerald-500 (No alvo)
  atencao: '#F59E0B', // Amber-500 (Risco)
  fora: '#EF4444',    // Red-500 (Crítico)
  neutro: '#475569',  // Slate-600 (Base)
  destaque: '#F97316' // Orange-500 (Para cards especiais como CCT)
};

export const COA_RULES = {
  // >= 65 Verde | 50 a 64 Amarelo | < 50 Vermelho
  eficienciaOp: (val) => val >= 65 ? COA_COLORS.dentro : (val >= 50 ? COA_COLORS.atencao : COA_COLORS.fora),
  
  // <= 2 Verde | > 2 Vermelho
  semApontamento: (val) => val <= 2 ? COA_COLORS.dentro : COA_COLORS.fora,
  
  // <= 10 Verde | > 10 Vermelho
  indeterminado: (val) => val <= 10 ? COA_COLORS.dentro : COA_COLORS.fora,
  
  // <= 5 Verde | > 5 Vermelho
  motorOcioso: (val) => val <= 5 ? COA_COLORS.dentro : COA_COLORS.fora,
};