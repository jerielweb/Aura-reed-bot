export default function fomatNumber(valor) {
    const numero = parseInt(valor, 10);

    if (isNaN(numero)) return valor;

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

