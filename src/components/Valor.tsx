import { formatarBR } from '../lib/formato';

export type ValorTipo = 'entrada' | 'saida' | 'neutro';

const cor: Record<ValorTipo, string> = {
  entrada: 'var(--value-entrada)',
  saida: 'var(--value-saida)',
  neutro: 'var(--text-primary)',
};

type Props = {
  tipo: ValorTipo;
  /** Número cru; o componente formata em BR. Sinal "+" automático em entradas. */
  valor: number;
};

/** Valor — primitivo (Figma set Valor 2006:8). Estilo Numeric, cor por tipo. */
export function Valor({ tipo, valor }: Props) {
  const opts = tipo === 'entrada' ? { sinal: '+' as const } : {};
  return (
    <span className="type-numeric" style={{ color: cor[tipo] }}>
      {formatarBR(valor, opts)}
    </span>
  );
}
