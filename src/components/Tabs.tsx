/**
 * Tabs — §5.1, Figma set 2017:216.
 * 4 abas: Lançamentos · Contas · Cartões · Relatório. A ativa tem texto
 * Body Small Strong (text/primary) + sublinhado accent/default; inativas
 * Body Small (text/muted) sem sublinhado. Relatório é aba, não tela à parte.
 */

export type AbaId = 'lancamentos' | 'contas' | 'cartoes' | 'relatorio';

const ABAS: { id: AbaId; rotulo: string }[] = [
  { id: 'lancamentos', rotulo: 'Lançamentos' },
  { id: 'contas', rotulo: 'Contas' },
  { id: 'cartoes', rotulo: 'Cartões' },
  { id: 'relatorio', rotulo: 'Relatório' },
];

type Props = {
  ativa: AbaId;
  onMudar: (aba: AbaId) => void;
};

export function Tabs({ ativa, onMudar }: Props) {
  return (
    <div role="tablist" style={{ display: 'flex', width: '100%' }}>
      {ABAS.map(({ id, rotulo }) => {
        const ativo = id === ativa;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={ativo}
            onClick={() => onMudar(id)}
            className={ativo ? 'type-body-small-strong' : 'type-body-small'}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              padding: '4px 0 0',
              flex: '1 1 0',
              border: 'none',
              background: 'transparent',
              color: ativo ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            {rotulo}
            <span
              aria-hidden
              style={{
                width: '100%',
                height: 2,
                borderRadius: 2,
                background: ativo ? 'var(--accent-default)' : 'transparent',
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
