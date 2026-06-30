/**
 * Ícones — extraídos 1:1 do Figma (file 2h3h8G4YWPLxmbYC4tQ3TD, página
 * "01 - Components", categoria `icon / …`). Só os em uso pelos componentes;
 * a biblioteca completa do Figma é paleta de design, não entra no bundle.
 * Quando a limpeza/adição de bancos acontecer no Figma, re-extrair o que faltar.
 *
 * Fill original (#21272A) trocado por currentColor → herdam a cor do contexto
 * (text/muted na linha, theme/text no card, text/on-accent no FAB).
 */

type IconeProps = {
  /** Lado do quadrado em px. Default = tamanho nativo do ícone no Figma. */
  tamanho?: number;
};

export function IconeChevronRight({ tamanho = 20 }: IconeProps) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path fillRule="evenodd" clipRule="evenodd" d="M7.29289 14.7071C6.90237 14.3166 6.90237 13.6834 7.29289 13.2929L10.5858 10L7.29289 6.70711C6.90237 6.31658 6.90237 5.68342 7.29289 5.29289C7.68342 4.90237 8.31658 4.90237 8.70711 5.29289L12.7071 9.29289C13.0976 9.68342 13.0976 10.3166 12.7071 10.7071L8.70711 14.7071C8.31658 15.0976 7.68342 15.0976 7.29289 14.7071Z" fill="currentColor" />
    </svg>
  );
}

export function IconeChevronLeft({ tamanho = 20 }: IconeProps) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path fillRule="evenodd" clipRule="evenodd" d="M12.7071 5.29289C13.0976 5.68342 13.0976 6.31658 12.7071 6.70711L9.41421 10L12.7071 13.2929C13.0976 13.6834 13.0976 14.3166 12.7071 14.7071C12.3166 15.0976 11.6834 15.0976 11.2929 14.7071L7.29289 10.7071C6.90237 10.3166 6.90237 9.68342 7.29289 9.29289L11.2929 5.29289C11.6834 4.90237 12.3166 4.90237 12.7071 5.29289Z" fill="currentColor" />
    </svg>
  );
}

export function IconeMenu({ tamanho = 22 }: IconeProps) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path fillRule="evenodd" clipRule="evenodd" d="M3 5C3 4.44772 3.44772 4 4 4H16C16.5523 4 17 4.44772 17 5C17 5.55228 16.5523 6 16 6H4C3.44772 6 3 5.55228 3 5Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M3 10C3 9.44772 3.44772 9 4 9H16C16.5523 9 17 9.44772 17 10C17 10.5523 16.5523 11 16 11H4C3.44772 11 3 10.5523 3 10Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M3 15C3 14.4477 3.44772 14 4 14H16C16.5523 14 17 14.4477 17 15C17 15.5523 16.5523 16 16 16H4C3.44772 16 3 15.5523 3 15Z" fill="currentColor" />
    </svg>
  );
}

export function IconePencil({ tamanho = 20 }: IconeProps) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M13.5858 3.58579C14.3668 2.80474 15.6332 2.80474 16.4142 3.58579C17.1953 4.36683 17.1953 5.63316 16.4142 6.41421L15.6213 7.20711L12.7929 4.37868L13.5858 3.58579Z" fill="currentColor" />
      <path d="M11.3787 5.79289L3 14.1716V17H5.82842L14.2071 8.62132L11.3787 5.79289Z" fill="currentColor" />
    </svg>
  );
}

export function IconeAdd({ tamanho = 24 }: IconeProps) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path fillRule="evenodd" clipRule="evenodd" d="M12 4.5C12.4142 4.5 12.75 4.83579 12.75 5.25V18.75C12.75 19.1642 12.4142 19.5 12 19.5C11.5858 19.5 11.25 19.1642 11.25 18.75V5.25C11.25 4.83579 11.5858 4.5 12 4.5Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M4.5 12C4.5 11.5858 4.83579 11.25 5.25 11.25H18.75C19.1642 11.25 19.5 11.5858 19.5 12C19.5 12.4142 19.1642 12.75 18.75 12.75H5.25C4.83579 12.75 4.5 12.4142 4.5 12Z" fill="currentColor" />
    </svg>
  );
}

export function IconeEye({ tamanho = 20 }: IconeProps) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M10 12C11.1046 12 12 11.1046 12 10C12 8.89543 11.1046 8 10 8C8.89544 8 8.00001 8.89543 8.00001 10C8.00001 11.1046 8.89544 12 10 12Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M0.457764 10C1.73202 5.94291 5.52232 3 9.99997 3C14.4776 3 18.2679 5.94288 19.5422 9.99996C18.2679 14.0571 14.4776 17 9.99995 17C5.52232 17 1.73204 14.0571 0.457764 10ZM14 10C14 12.2091 12.2091 14 10 14C7.79087 14 6.00001 12.2091 6.00001 10C6.00001 7.79086 7.79087 6 10 6C12.2091 6 14 7.79086 14 10Z" fill="currentColor" />
    </svg>
  );
}

export function IconeEyeOff({ tamanho = 20 }: IconeProps) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path fillRule="evenodd" clipRule="evenodd" d="M3.70711 2.29289C3.31658 1.90237 2.68342 1.90237 2.29289 2.29289C1.90237 2.68342 1.90237 3.31658 2.29289 3.70711L16.2929 17.7071C16.6834 18.0976 17.3166 18.0976 17.7071 17.7071C18.0976 17.3166 18.0976 16.6834 17.7071 16.2929L16.2339 14.8197C17.7715 13.5924 18.939 11.9211 19.5424 9.99996C18.2681 5.94288 14.4778 3 10.0002 3C8.37665 3 6.84344 3.38692 5.48779 4.07358L3.70711 2.29289ZM7.96813 6.55391L9.48201 8.0678C9.6473 8.02358 9.82102 8 10.0003 8C11.1048 8 12.0003 8.89543 12.0003 10C12.0003 10.1792 11.9767 10.353 11.9325 10.5182L13.4463 12.0321C13.7983 11.4366 14.0003 10.7419 14.0003 10C14.0003 7.79086 12.2094 6 10.0003 6C9.25838 6 8.56367 6.20197 7.96813 6.55391Z" fill="currentColor" />
      <path d="M12.4541 16.6967L9.74965 13.9923C7.74013 13.8681 6.1322 12.2601 6.00798 10.2506L2.33492 6.57754C1.50063 7.57223 0.856368 8.73169 0.458008 10C1.73228 14.0571 5.52257 17 10.0002 17C10.8469 17 11.6689 16.8948 12.4541 16.6967Z" fill="currentColor" />
    </svg>
  );
}

export function IconeImage({ tamanho = 24 }: IconeProps) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M19.5 3H4.5C3.70462 3.00087 2.94206 3.31722 2.37964 3.87964C1.81722 4.44206 1.50087 5.20462 1.5 6V18C1.50087 18.7954 1.81722 19.5579 2.37964 20.1204C2.94206 20.6828 3.70462 20.9991 4.5 21H19.5C20.2954 20.9991 21.0579 20.6828 21.6204 20.1204C22.1828 19.5579 22.4991 18.7954 22.5 18V6C22.4991 5.20462 22.1828 4.44206 21.6204 3.87964C21.0579 3.31722 20.2954 3.00087 19.5 3ZM15.75 6C16.195 6 16.63 6.13196 17 6.37919C17.37 6.62643 17.6584 6.97783 17.8287 7.38896C17.999 7.8001 18.0436 8.2525 17.9568 8.68895C17.87 9.12541 17.6557 9.52632 17.341 9.84099C17.0263 10.1557 16.6254 10.37 16.189 10.4568C15.7525 10.5436 15.3001 10.499 14.889 10.3287C14.4778 10.1584 14.1264 9.87004 13.8792 9.50003C13.632 9.13002 13.5 8.69501 13.5 8.25C13.5006 7.65345 13.7379 7.08152 14.1597 6.65969C14.5815 6.23787 15.1535 6.00062 15.75 6ZM4.5 19.5C4.10218 19.5 3.72064 19.342 3.43934 19.0607C3.15804 18.7794 3 18.3978 3 18V14.8298L7.44562 10.8783C7.87455 10.4979 8.43238 10.2953 9.00545 10.3119C9.57853 10.3284 10.1237 10.5628 10.53 10.9673L13.5745 14.0053L8.07984 19.5H4.5ZM21 18C21 18.3978 20.842 18.7794 20.5607 19.0607C20.2794 19.342 19.8978 19.5 19.5 19.5H10.2014L15.893 13.8084C16.2959 13.4657 16.8073 13.277 17.3363 13.2756C17.8653 13.2742 18.3776 13.4603 18.7823 13.8009L21 15.6488V18Z" fill="currentColor" />
    </svg>
  );
}
