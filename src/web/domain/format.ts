const cache = new Map<string, Intl.NumberFormat>();

function nf(min: number, max: number): Intl.NumberFormat {
  const key = `${min}:${max}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max });
    cache.set(key, f);
  }
  return f;
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/** Número com casas decimais proporcionais à grandeza: 0,25 · 3,5 · 48 · 1.250 */
export function formatNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs === 0) return '0';
  if (abs < 1) return nf(0, 2).format(n);
  if (abs < 10) return nf(0, 1).format(n);
  return nf(0, 0).format(n);
}

export function formatRps(n: number | null): string {
  return n === null ? 'sem limite' : `${formatNumber(n)} req/s`;
}

export function formatMs(ms: number | null): string {
  if (ms === null) return 'sem limite';
  if (ms >= 10_000) return `${nf(0, 1).format(ms / 1000)} s`;
  return `${formatNumber(ms)} ms`;
}

export function formatPercent(fraction: number): string {
  if (fraction > 9.99) return '> 999%';
  return `${nf(0, 0).format(fraction * 100)}%`;
}

/** Quantidade grande por extenso curto: 950 · 360 mil · 8,6 milhões · 1,2 bilhão */
export function formatCount(n: number): string {
  const units: [number, string, string][] = [
    [1e9, 'bilhão', 'bilhões'],
    [1e6, 'milhão', 'milhões'],
    [1e3, 'mil', 'mil'],
  ];
  for (const [size, one, many] of units) {
    if (n >= size) {
      const v = n / size;
      const text = v < 10 ? nf(0, 1).format(v) : nf(0, 0).format(v);
      return `${text} ${text === '1' ? one : many}`;
    }
  }
  return nf(0, 0).format(n);
}

/** Tráfego por segundo traduzido para hora e dia: "≈ 360 mil por hora · 8,6 milhões por dia". */
export function formatVolume(rps: number): string {
  if (!(rps > 0)) return 'Nenhum acesso';
  return `≈ ${formatCount(rps * 3600)} por hora · ${formatCount(rps * 86400)} por dia`;
}

export function formatMultiplier(x: number): string {
  return `${nf(0, 1).format(x)}×`;
}

export function formatBRL(n: number): string {
  return brl.format(n);
}

/** Aceita "1,5", "1.5" e "1.250,5". Retorna null se não for um número. */
export function parseDecimal(text: string): number | null {
  const t = text.trim().replace(/\s/g, '');
  if (t === '') return null;
  const normalized = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Valor para exibir num campo editável, com vírgula decimal. */
export function toInputText(n: number): string {
  return String(Math.round(n * 1e6) / 1e6).replace('.', ',');
}
