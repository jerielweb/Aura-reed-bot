import fetch from 'node-fetch';
import { generateWAMessageFromContent, generateWAMessage, jidNormalizedUser } from '@whiskeysockets/baileys';
import crypto from 'crypto';
import { fytBold } from '../../models/TextStyle.js';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} - ${res.statusText}`);
  return await res.json();
}

async function sendAlbumMessage(socket, jid, array, quoted) {
  const userJid = jidNormalizedUser(socket.user?.id || socket.authState?.creds?.me?.id || '');
  const album = await generateWAMessageFromContent(jid, {
    messageContextInfo: {
      messageSecret: crypto.randomBytes(32)
    },
    albumMessage: {
      expectedImageCount: array.filter((a) => 'image' in a).length,
      expectedVideoCount: array.filter((a) => 'video' in a).length
    }
  }, { quoted, userJid });

  await socket.relayMessage(jid, album.message, {
    messageId: album.key.id
  });

  for (let item of array) {
    const img = await generateWAMessage(jid, item, {
      upload: socket.waUploadToServer,
      userJid
    });
    img.message.messageContextInfo = {
      messageSecret: crypto.randomBytes(32),
      messageAssociation: {
        associationType: 1,
        parentMessageKey: album.key
      }
    };
    await socket.relayMessage(jid, img.message, {
      messageId: img.key.id
    });
  }
  return album;
}


async function firstSuccessfulPromise(promises) {
  return new Promise((resolve, reject) => {
    let rejected = 0;
    const errors = [];
    promises.forEach(p => {
      p.then(data => resolve(data)).catch(err => {
        rejected++;
        errors.push(err);
        if (rejected === promises.length) reject(errors);
      });
    });
  });
}

export default {
  name: ['pin', 'pinterest'],
  category: 'search',
  description: 'Busca imágenes en Pinterest.',
  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    const query = args.join(' ').trim();

    if (!query) {
      return await socket.sendMessage(remoteJid, {
        text: `╭〔 ⚠️ ${fytBold('AURA REED')} 〕⬣\n┃ ❌ ${fytBold('FALTA BUSQUEDA')}\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona una consulta\n┃ > para buscar en Pinterest.\n\n╰〔 ⚡ ${fytBold('SYSTEM')} 〕⬣`
      }, { quoted: message });
    }

    await socket.sendMessage(remoteJid, { react: { text: '🔍', key: message.key } });

    const alyaUrl = `https://api.alyacore.xyz/search/pinterest?query=${encodeURIComponent(query)}&key=oboe`;
    const causasUrl = `https://rest.apicausas.xyz/api/v1/buscadores/pinterest?apikey=oboe&q=${encodeURIComponent(query)}`;
    const deliriusUrl = `https://api.delirius.store/search/pinterestv2?text=${encodeURIComponent(query)}`;

    const apiCalls = [
      fetchJson(alyaUrl).then(r => ({ source: 'Alya Core', data: r.data || r.data?.data })),
      fetchJson(causasUrl).then(r => ({ source: 'Api Causas', data: r.data })),
      fetchJson(deliriusUrl).then(r => ({ source: 'Delirius', data: r.data }))
    ];

    let result;
    try {
      result = await firstSuccessfulPromise(apiCalls);
    } catch (errs) {
      console.error('Todas las APIs fallaron:', errs);
      await socket.sendMessage(remoteJid, { react: { text: '❌', key: message.key } });
      return await socket.sendMessage(remoteJid, {
        text: `╭〔 ❌ ${fytBold('AURA REED')} 〕⬣\n┃ ⚠️ ${fytBold('ERROR DE BUSQUEDA')}\n╰━━━━━━━━━━━━⬣\n\n┃ > No se pudieron obtener resultados de ninguna API.\n\n╰〔 ⚡ ${fytBold('SYSTEM')} 〕⬣`
      }, { quoted: message });
    }

    const items = (result.data || []).slice(0, 10);
    if (!items.length) {
      await socket.sendMessage(remoteJid, { react: { text: '❌', key: message.key } });
      return await socket.sendMessage(remoteJid, {
        text: `╭〔 ❌ ${fytBold('AURA REED')} 〕⬣\n┃ ⚠️ ${fytBold('SIN RESULTADOS')}\n╰━━━━━━━━━━━━⬣\n\n┃ > No se encontraron resultados para "${query}" en Pinterest.\n\n╰〔 ⚡ ${fytBold('SYSTEM')} 〕⬣`
      }, { quoted: message });
    }

    let captionText = `╭━━〔 ${fytBold('PINTEREST SEARCH')} 〕━━⬣\n`;
    captionText += `┃ 🔍 Pin: ${query}\n`;
    captionText += `┃ ⚙️ Motor: › ${result.source || 'Desconocido'}\n`;
    captionText += `╰〔 ⚡ ${fytBold('AURA REED')} 〕⬣`;

    // Collect all image URLs
    const mediaArray = items.map(item => ({ url: item.hd || item.image || item.image_small || '' })).filter(m => m.url);
    const album = mediaArray.map((m, i) => ({ image: { url: m.url }, caption: i === 0 ? captionText : '' }));

    await sendAlbumMessage(socket, remoteJid, album, message);
    await socket.sendMessage(remoteJid, { react: { text: '✅', key: message.key } });
    return;

    
  }
};
