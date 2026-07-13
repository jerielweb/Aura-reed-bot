export default function fomatNumber(valor) {
  if (valor === null || valor === undefined) return "0";
  const raw = String(valor).trim();
  if (!raw) return "0";

  if (/^[\d,.]+[kKmMbBtT]$/.test(raw)) return raw.toUpperCase();

  const normalized = raw.replace(/,/g, "");
  const numero = Number(normalized);
  if (!Number.isFinite(numero)) return raw;

  if (numero >= 1e12) {
    return `${(numero / 1e12).toFixed(1)}T`;
  }
  if (numero >= 1e9) {
    return `${(numero / 1e9).toFixed(1)}B`;
  }
  if (numero >= 1e6) {
    return `${(numero / 1e6).toFixed(1)}M`;
  }
  if (numero >= 1e3) {
    return `${(numero / 1e3).toFixed(1)}K`;
  }
  return numero.toString();
}
