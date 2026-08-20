import chalk from "chalk";

export function cmdLog({
  numeroReal,
  rango,
  commandName,
  isGroup,
  text,
  jidRemitente,
  pushName,
  groupMetadata,
  sock,
}) {
  // Si no hay commandName, ignoramos el mensaje por completo para mejorar el rendimiento y evitar impresiones innecesarias
  if (!commandName) return;

  const fecha = new Date().toLocaleString("es-CR", {
    timeZone: "America/Costa_Rica",
  });
  const senderNumber = jidRemitente ? jidRemitente.split("@")[0] : numeroReal;

  const tipoAccion = chalk.cyan.bold(" COMANDO ");
  const contenido = chalk.yellow.bold(`${prefix || "#"}${commandName}`);

  const chatTipo = isGroup ? chalk.green("Grupo") : chalk.magenta("Privado");
  const rolRango = rango ? rango.toUpperCase() : "USUARIO 👤";
  const nombreUsuario = pushName || "Usuario Desconocido";

  const botType = sock?.isSubBot ? `Sub-Bot (+${sock.subBotId})` : "Principal";
  let lineasDinamicas = `${chalk.blue.bold("│")} ${chalk.white("🤖 ")} ${chalk.bold("Bot:")}       ${chalk.cyan(botType)}\n`;
  lineasDinamicas += `${chalk.blue.bold("│")} ${chalk.white("👤 ")} ${chalk.bold("Usuario:")}   ${chalk.white(nombreUsuario)}\n`;
  lineasDinamicas += `${chalk.blue.bold("│")} ${chalk.white("🎖️ ")} ${chalk.bold("Rango:")}     ${chalk.magenta(rolRango)}\n`;

  if (isGroup) {
    const nombreGrupo = groupMetadata?.subject || "Grupo Desconocido";
    lineasDinamicas += `${chalk.blue.bold("│")} ${chalk.white("🏠 ")} ${chalk.bold("Grupo:")}     ${chalk.white(nombreGrupo)}\n`;
  }

  lineasDinamicas += `${chalk.blue.bold("│")} ${chalk.white("🕒 ")} ${chalk.bold("Fecha:")}     ${chalk.white(fecha)}\n`;
  lineasDinamicas += `${chalk.blue.bold("│")} ${chalk.white("📱 ")} ${chalk.bold("Número:")}    +${chalk.white(senderNumber)}\n`;
  lineasDINR = `${chalk.blue.bold("│")} ${chalk.white("💬 ")} ${chalk.bold("Chat:")}      ${chatTipo}\n`;

  console.log(
    chalk.blue.bold(`╭──────────────────────────────────────────────────⬣\n`) +
      lineasDinamicas +
      `${chalk.blue.bold("├──────────────────────────────────────────────────⬣\n")}` +
      `${chalk.blue.bold("│")}${tipoAccion} ➤  ${contenido}\n` +
      chalk.blue.bold(`╰──────────────────────────────────────────────────⬣`),
  );
}
