/** Formatação monetária BR. Fonte única para todos os componentes. */

const nf = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

interface FormatoOpts {
  /** Prefixa "R$ ". */
  prefixo?: boolean;
  /** Força um sinal "+" em positivos (negativos já vêm com "-"). */
  sinal?: '+';
}

/** Formata um número em reais no padrão BR (1.234,56). */
export function formatarBR(valor: number, opts: FormatoOpts = {}): string {
  const abs = nf.format(Math.abs(valor));
  let sinal = '';
  if (valor < 0) sinal = '-';
  else if (opts.sinal === '+' && valor > 0) sinal = '+';
  const prefixo = opts.prefixo ? 'R$ ' : '';
  return `${sinal}${prefixo}${abs}`;
}

const MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Data ISO (YYYY-MM-DD) → "23 jun 2026". Fonte única para linhas de histórico. */
export function dataCurta(iso: string): string {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return `${dia} ${MESES_CURTO[(mes ?? 1) - 1]} ${ano}`;
}
