import chalk from "chalk";

export function cmdLog({ numeroReal, rango, commandName, isGroup, text }) {
    const fecha = new Date().toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' });

    // Si no hay commandName, es un mensaje de texto normal
    const tipoAccion = commandName ? chalk.cyan.bold('Comando: ') : chalk.green.bold('Mensaje: ');
    const contenido = commandName ? chalk.white(commandName) : chalk.white(text?.substring(0, 15) + (text?.length > 15 ? '...' : ''));

    console.log(chalk.blue.bold(`┌─────────────────────────\n${chalk.blue.bold('├ ')}${chalk.cyan('Fecha: ')}${chalk.white(fecha)}\n${chalk.blue.bold('├ ')}${chalk.magenta('Remitente: ')}${chalk.white(numeroReal)}\n${chalk.blue.bold('├ ')}${chalk.yellow('Rango: ')}${chalk.white(rango || 'USUARIO 👤')}\n${chalk.blue.bold('├ ')}${tipoAccion}${contenido}\n${chalk.blue.bold('├ ')}${chalk.white('Chat: ')}${chalk.white(isGroup ? 'Grupo' : 'Privado')}\n${chalk.blue.bold('└─────────────────────────')}`));
}