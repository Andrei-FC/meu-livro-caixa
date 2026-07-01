/**
 * Logos de BANDEIRA — biblioteca fixa e curada (§4.9), extraídos 1:1 do Figma
 * (categoria `icon/Bandeira/…`). Separada de `bancos.tsx` de propósito: banco
 * e bandeira são eixos ortogonais (um cartão tem os dois). Manter bibliotecas
 * separadas deixa adicionar qualquer bandeira no futuro sem retrabalho nem
 * bagunça na lista de bancos.
 *
 * Glifos MONOcromáticos (fill → currentColor, herda a cor do contexto). A CHAVE
 * é o que `cartoes.bandeira` guarda (§4.9 — guarda a referência, não o desenho).
 */

type LogoProps = {
  /** Lado do quadrado em px. Default = tamanho nativo no Figma (28). */
  tamanho?: number;
};

export function LogoMaster({ tamanho = 28 }: LogoProps) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 28 28" fill="none" aria-hidden>
      <path d="M15.0288 20.9683C19.3275 17.2994 19.3292 10.6977 15.0252 7.02695C18.4126 5.13624 22.6513 5.9252 25.1203 8.85792C27.607 11.8117 27.63 16.0975 25.168 19.0794C22.706 22.0613 18.4744 22.8836 15.027 20.9701L15.0288 20.9683ZM2.83024 8.91766C0.370046 11.8978 0.393002 16.1818 2.88145 19.1374C5.34871 22.0666 9.58561 22.8573 12.9712 20.9666C8.67253 17.3011 8.66723 10.6959 12.9748 7.02519C9.52379 5.10812 5.27277 5.95858 2.83024 8.91766ZM17.0669 13.9713C17.0598 11.5446 15.9454 9.23395 14.0009 7.71048C12.037 9.24449 10.9226 11.578 10.9314 14.024C10.9402 16.47 12.0546 18.7578 13.9991 20.2795C15.956 18.7455 17.0722 16.4173 17.0651 13.9713H17.0669Z" fill="currentColor" />
    </svg>
  );
}

export function LogoVisa({ tamanho = 28 }: LogoProps) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 28 28" fill="none" aria-hidden>
      <path d="M22.0971 16.6981L21.6683 17.8733H19.4603L22.5429 10.8383C22.6069 10.6911 22.6757 10.5726 22.7687 10.4462C22.9354 10.2541 23.1661 10.1196 23.4427 10.1184L25.2993 10.115L27 17.871L25.0517 17.8733L24.7908 16.6981H22.0959H22.0971ZM24.467 15.1227L23.8099 12.2135L22.7083 15.1239H24.467V15.1227ZM8.66411 10.1161L6.46936 15.3895L5.55981 10.8555C5.47285 10.422 5.09719 10.1449 4.63698 10.115H1.04469L1 10.3611C1.703 10.499 2.36492 10.6888 3.00028 10.9786C3.27085 11.1016 3.45203 11.3074 3.52813 11.5868L5.24576 17.8744L7.46105 17.8721L10.8734 10.1173H8.66532L8.66411 10.1161ZM19.5654 15.4309C19.5871 14.8594 19.3721 14.3408 18.9312 13.9487C18.6885 13.7325 18.4251 13.552 18.1304 13.3979L17.2124 12.9184C17.0397 12.8287 16.8851 12.7172 16.7558 12.5815C16.5855 12.4021 16.5867 12.1549 16.7486 11.972C16.8682 11.8375 17.0288 11.7536 17.2052 11.6926C17.4528 11.619 17.7004 11.5972 17.9661 11.6041C18.5242 11.6213 19.0544 11.7467 19.5823 11.9698L19.9555 10.3358C19.4663 10.1575 18.9578 10.054 18.4348 10.0149L18.2476 10L17.6026 10.0057C16.054 10.0874 14.5043 10.8912 14.4391 12.4929C14.4185 12.992 14.5961 13.4451 14.9633 13.8015C15.2025 14.0338 15.4706 14.2235 15.7726 14.3834L16.7244 14.8882C16.9056 14.9847 17.0662 15.0997 17.2052 15.2423C17.39 15.432 17.4177 15.6954 17.2692 15.9127C17.0373 16.2519 16.5456 16.3681 16.1168 16.3842C15.3631 16.3922 14.6335 16.2197 13.9523 15.8782L13.5706 17.572C14.3968 17.8744 15.2556 18.0158 16.1313 17.9986C16.9986 17.9664 17.8393 17.7813 18.5399 17.2937C19.1777 16.8499 19.5376 16.1795 19.5666 15.4297L19.5654 15.4309ZM13.8641 10.1161H11.7636L10.029 17.8733H12.1368L13.8641 10.1161Z" fill="currentColor" />
    </svg>
  );
}

/** Chaves válidas de bandeira — o que `cartoes.bandeira` guarda (§4.9). */
export type ChaveBandeira = 'master' | 'visa';

/** Mapa chave → componente. Ordem = ordem de exibição no seletor. */
export const BANDEIRAS: Record<ChaveBandeira, (p: LogoProps) => JSX.Element> = {
  master: LogoMaster,
  visa: LogoVisa,
};

/**
 * Resolve uma chave de bandeira num logo. Chave ausente/desconhecida → null
 * (o chamador decide o fallback).
 */
export function LogoBandeira({ chave, tamanho = 28 }: { chave?: string | null; tamanho?: number }) {
  if (!chave) return null;
  const Comp = BANDEIRAS[chave as ChaveBandeira];
  return Comp ? <Comp tamanho={tamanho} /> : null;
}
