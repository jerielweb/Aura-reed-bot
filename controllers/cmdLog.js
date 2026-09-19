import chalk from "chalk";

const timeFormatter = new Intl.DateTimeFormat("es-CR", {
  timeZone: "America/Costa_Rica",
  dateStyle: "short",
  timeStyle: "medium"
});

export function cmdLog({
  numeroReal,
  rango,
  commandName,
  isGroup,
  text = "",
  jidRemitente,
  pushName,
  groupMetadata,
  prefix = "#",
  sock,
}) {
  if (!commandName) return;

  const dateStr = timeFormatter.format(new Date());
  const sender = (jidRemitente || numeroReal || "").split("@")[0].split(":")[0];
  const user = pushName || "Desconocido";
  const role = rango?.toUpperCase() || "USUARIO 👤";
  const botType = sock?.isSubBot ? `Sub-Bot (+${sock.subBotId})` : "Principal";

  const rawArgs = text.slice(prefix.length + commandName.length).trim();
  const safeArgs = rawArgs.length > 45 ? `${rawArgs.substring(0, 45)}...` : rawArgs;
  const argsDisplay = safeArgs ? chalk.gray(safeArgs) : chalk.dim("{Sin argumentos}");

  const chatInfo = isGroup
    ? `${chalk.blue.bold("│")} ${chalk.white("🏠 Grupo:  ")} ${chalk.green(groupMetadata?.subject || "Desconocido")}`
    : `${chalk.blue.bold("│")} ${chalk.white("💬 Chat:   ")} ${chalk.magenta("Privado")}`;

  console.log(
`${chalk.blue.bold("╭──────────────────────────────────────────────────⬣")}
${chalk.blue.bold("│")} ${chalk.white("🤖 Bot:    ")} ${chalk.cyan(botType)}
${chalk.blue.bold("│")} ${chalk.white("👤 Usuario:")} ${chalk.white(user)} ${chalk.gray(`(+${sender})`)}
${chalk.blue.bold("│")} ${chalk.white("🎖️ Rango:  ")} ${chalk.magenta(role)}
${chatInfo}
${chalk.blue.bold("│")} ${chalk.white("🕒 Fecha:  ")} ${chalk.white(dateStr)}
${chalk.blue.bold("├──────────────────────────────────────────────────⬣")}
${chalk.blue.bold("│")} ${chalk.cyan.bold(" COMANDO ")} ➤ ${chalk.yellow.bold(prefix + commandName)} ${argsDisplay}
${chalk.blue.bold("╰──────────────────────────────────────────────────⬣")}`
  );
}
