import chalk from "chalk";

export function cmdLog({ numeroReal, rango, commandName, isGroup, text, jidRemitente, pushName, groupMetadata, m, message, prefix }) {
    const fecha = new Date().toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' });
    const senderNumber = jidRemitente ? jidRemitente.split('@')[0] : numeroReal;

    // 1. Detectar tipo de contenido multimedia o visualización única
    const msgObj = m?.message || message?.message || m || message;
    let tipoMedio = '';

    if (msgObj) {
        // Verificar visualización única para imágenes, videos, audios y notas de video
        const isViewOnce = msgObj.viewOnceMessage?.message?.imageMessage ||
                           msgObj.viewOnceMessageV2?.message?.imageMessage ||
                           msgObj.viewOnceMessage?.message?.videoMessage ||
                           msgObj.viewOnceMessageV2?.message?.videoMessage ||
                           msgObj.viewOnceMessage?.message?.audioMessage ||
                           msgObj.viewOnceMessageV2?.message?.audioMessage;

        const actualMsg = msgObj.viewOnceMessage?.message || msgObj.viewOnceMessageV2?.message || msgObj;

        if (actualMsg.imageMessage) {
            tipoMedio = isViewOnce ? 'IMAGEN ①' : 'IMAGEN 🖼️';
        } else if (actualMsg.videoMessage) {
            if (actualMsg.videoMessage.viewOnce) {
                // Validación para nota de video circular de visualización única
                tipoMedio = 'NOTA DE VIDEO ①';
            } else if (actualMsg.videoMessage.gifPlayback) {
                tipoMedio = 'GIF 🎞️';
            } else {
                tipoMedio = isViewOnce ? 'VIDEO ①' : 'VIDEO 🎥';
            }
        } else if (actualMsg.ptvMessage) {
            // Nota de video circular normal (PTV)
            tipoMedio = 'NOTA DE VIDEO 📹';
        } else if (actualMsg.stickerMessage) {
            tipoMedio = 'STICKER 🎭';
        } else if (actualMsg.audioMessage) {
            if (isViewOnce) {
                tipoMedio = 'AUDIO ①';
            } else {
                tipoMedio = actualMsg.audioMessage.ptt ? 'AUDIO (Nota de Voz) 🎙️' : 'AUDIO (Archivo) 🎵';
            }
        }
    }

    // Determinar si es comando o mensaje de texto normal
    const tipoAccion = commandName ? chalk.cyan.bold(' COMANDO ') : chalk.green.bold(' MENSAJE ');
    
    // Si es multimedia y no es comando, muestra el tipo de medio
    let contenido = '';
    if (commandName) {
        contenido = chalk.yellow.bold(`${prefix}${commandName}`);
    } else if (tipoMedio) {
        const caption = msgObj?.viewOnceMessage?.message?.imageMessage?.caption || 
                        msgObj?.viewOnceMessageV2?.message?.imageMessage?.caption ||
                        msgObj?.viewOnceMessage?.message?.videoMessage?.caption || 
                        msgObj?.viewOnceMessageV2?.message?.videoMessage?.caption ||
                        msgObj?.imageMessage?.caption || msgObj?.videoMessage?.caption || '';
        
        contenido = chalk.magenta.bold(`MEDIO: ${tipoMedio} `) + (caption ? chalk.white(` "${caption.substring(0, 25)}..."`) : '');
    } else {
        contenido = chalk.white(`"${text?.substring(0, 40)}${text?.length > 45 ? '...' : ''}"`);
    }

    const chatTipo = isGroup ? chalk.green('Grupo') : chalk.magenta('Privado');
    const rolRango = rango ? rango.toUpperCase() : 'USUARIO 👤';
    const nombreUsuario = pushName || 'Usuario Desconocido';

    // Líneas base del diseño original
    let lineasDinamicas = `${chalk.blue.bold('│')} ${chalk.gray('👤 ')} ${chalk.bold('Usuario:')}   ${chalk.white(nombreUsuario)}\n`;
    lineasDinamicas += `${chalk.blue.bold('│')} ${chalk.gray('🎖️ ')} ${chalk.bold('Rango:')}     ${chalk.magenta(rolRango)}\n`;

    if (isGroup) {
        const nombreGrupo = groupMetadata?.subject || 'Grupo Desconocido';
        lineasDinamicas += `${chalk.blue.bold('│')} ${chalk.gray('🏠 ')} ${chalk.bold('Grupo:')}     ${chalk.white(nombreGrupo)}\n`;
    }

    lineasDinamicas += `${chalk.blue.bold('│')} ${chalk.gray('🕒 ')} ${chalk.bold('Fecha:')}     ${chalk.white(fecha)}\n`;
    lineasDinamicas += `${chalk.blue.bold('│')} ${chalk.gray('📱 ')} ${chalk.bold('Número:')}    ${chalk.white(senderNumber)}\n`;
    lineasDinamicas += `${chalk.blue.bold('│')} ${chalk.gray('💬 ')} ${chalk.bold('Chat:')}      ${chatTipo}\n`;

    // Impresión en consola manteniendo la caja limpia intacta
    console.log(
        chalk.blue.bold(`╭──────────────────────────────────────────────────────────⬣\n`) +
        lineasDinamicas +
        `${chalk.blue.bold('├──────────────────────────────────────────────────────────⬣\n')}` +
        `${chalk.blue.bold('│')}${tipoAccion} ➤  ${contenido}\n` +
        chalk.blue.bold(`╰──────────────────────────────────────────────────────────⬣`)
    );
}