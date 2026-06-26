// Tipos espelhando o schema do Supabase (spec §3).
// Mantenha em sincronia com schema.sql.

export type ContaTipo = 'corrente' | 'poupanca';
export type LancamentoTipo = 'entrada' | 'saida';
export type RepeticaoTipo = 'avista' | 'parcelar' | 'recorrente';

export interface Conta {
  id: string;
  nome: string;
  tipo: ContaTipo;
  tema: string | null;
  icone: string | null;
  arquivada_em: string | null; // null = ativa
  criada_em: string;
}

export interface Cartao {
  id: string;
  nome: string;
  previsao_mensal: number; // teto de previsão, não limite do banco (§4.4)
  dia_fechamento: number;
  dia_pagamento: number;
  tema: string | null;
  icone: string | null;
  criado_em: string;
}

export interface Lancamento {
  id: string;
  tipo: LancamentoTipo;
  valor: number;
  descricao: string; // é também a categoria (§4.6)
  nota: string | null;
  data: string; // YYYY-MM-DD — define o mês (princípio 2)
  conta_id: string;
  cartao_id: string | null;
  repeticao: RepeticaoTipo;
  parcelas: number | null;
  recorrencia_fim: number | null; // nº de ocorrências; null = indefinido
  assinatura: boolean; // recorte (§5.5)
  serie_id: string | null;
  criado_em: string;
}

export interface Transferencia {
  id: string;
  valor: number;
  data: string;
  de_conta_id: string;
  para_conta_id: string;
  descricao: string | null;
  repeticao: 'avista' | 'recorrente'; // nunca parcela (§3.4)
  recorrencia_fim: number | null;
  serie_id: string | null;
  criada_em: string;
}
