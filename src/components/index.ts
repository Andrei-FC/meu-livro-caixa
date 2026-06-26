// Biblioteca de componentes — traduzida do Figma (file 2h3h8G4YWPLxmbYC4tQ3TD).
// Telas importam daqui: import { Botao, CardDeResumo, FAB } from '../components';

// Primitivos
export { Botao } from './Botao';
export { Input } from './Input';
export { Valor } from './Valor';
export type { ValorTipo } from './Valor';
export { Tag } from './Tag';
export type { TagCor } from './Tag';

// Compostos
export { BarraDePrevisao } from './BarraDePrevisao';
export type { FaseBarra } from './BarraDePrevisao';
export { LinhaDeLancamento } from './LinhaDeLancamento';
export { LinhaDeFatura } from './LinhaDeFatura';
export type { FaseFatura } from './LinhaDeFatura';
export { CabecalhoDeDia } from './CabecalhoDeDia';
export { SaldoDoDia } from './SaldoDoDia';
export { CardDeResumo } from './CardDeResumo';
export { CardDeEntidade } from './CardDeEntidade';
export { FAB } from './FAB';
export { Tabs } from './Tabs';
export type { AbaId } from './Tabs';
export { ModalDeAlerta } from './ModalDeAlerta';
export type { TipoAlerta } from './ModalDeAlerta';

// Ícones (re-export de conveniência; também acessíveis em '../icons')
export * from '../icons';
