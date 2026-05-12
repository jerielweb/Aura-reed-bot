import chalk from "chalk";

export function cmdLog({ numeroReal, rango, commandName, isGroup }) {
    console.log(chalk.blue.bold(`┌─────────────────────────\n${chalk.blue.bold('├ ')}${chalk.magenta('Remitente: ')}${chalk.white(numeroReal)}\n${chalk.blue.bold('├ ')}${chalk.yellow('Rango:')} ${chalk.white(rango)}\n${chalk.blue.bold('├ ')}${chalk.cyan.bold('Comando: ')}${chalk.white(commandName)}\n${chalk.blue.bold('├ ')}${chalk.white('Chat:')} ${chalk.white(isGroup ? 'Grupo' : 'Privado')}\n${chalk.blue.bold('└─────────────────────────')}`));
}
