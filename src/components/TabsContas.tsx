/**
 * TabsContas — sub-navegação DENTRO da aba Contas (§5.6): "Conta Corrente" e
 * "Cofre". É estado local da aba (não mexe na BottomNav). A ativa usa Body Small
 * Strong (semibold 14) + underline accent; a inativa Body Small (medium 14) muted.
 */
export type TabContas = 'corrente' | 'cofre';

const TABS: { id: TabContas; rotulo: string }[] = [
  { id: 'corrente', rotulo: 'Conta Corrente' },
  { id: 'cofre', rotulo: 'Cofre' },
];

type Props = {
  ativa: TabContas;
  onMudar: (t: TabContas) => void;
};

export function TabsContas({ ativa, onMudar }: Props) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        width: '100%',
        borderBottom: '1px solid var(--divider)',
      }}
    >
      {TABS.map(({ id, rotulo }) => {
        const ativo = id === ativa;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={ativo}
            onClick={() => onMudar(id)}
            className={ativo ? 'type-body-small-strong' : 'type-body-small'}
            style={{
              flex: '1 1 0',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              paddingTop: 4,
              border: 'none',
              background: 'transparent',
              color: ativo ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <span style={{ whiteSpace: 'nowrap' }}>{rotulo}</span>
            <span
              aria-hidden
              style={{
                height: 2.5,
                width: 40,
                borderRadius: 2,
                background: 'var(--accent-default)',
                opacity: ativo ? 1 : 0,
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
