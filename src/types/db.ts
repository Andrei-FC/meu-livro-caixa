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
  conta_id: string; // conta-corrente que paga a fatura (§4.4/§4.5) — NOT NULL
  previsao_mensal: number | null; // teto de previsão (§4.4); null = sem previsão (só acumula realizado)
  dia_fechamento: number;
  dia_pagamento: number;
  tema: string | null;
  banco: string | null; // chave da biblioteca de bancos (§4.9)
  bandeira: string | null; // chave da biblioteca de bandeiras (§4.9)
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

export interface ExcecaoSerie {
  id: string;
  serie_id: string;
  mes_alvo: string; // YYYY-MM — o mês da ocorrência (a série tem 1 por mês; imune a mudança de dia-âncora)
  excluida: boolean; // true = "só esta" excluída; o motor pula a ocorrência
  valor: number | null; // override; null = herda da regra
  descricao: string | null; // override; null = herda
  nota: string | null; // override; null = herda
  criada_em: string;
}

export interface Pagamento {
  id: string;
  cartao_id: string; // FK → cartoes
  // Índice de mês absoluto (ano*12 + mês 0-11) do ciclo que FECHA — identifica
  // univocamente a fatura, imune a fuso e coerente com o motor (§4.8).
  ciclo_abs: number;
  data_paga: string; // YYYY-MM-DD — data efetiva do pagamento (§4.4, override do dia_pagamento)
  criado_em: string;
}
