import fetch from 'node-fetch';
import { generateWAMessageFromContent, generateWAMessage, jidNormalizedUser } from '@whiskeysockets/baileys';
import crypto from 'crypto';

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
        text: `╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐅𝐀𝐋𝐓𝐀 𝐁𝐔́𝐒𝐐𝐔𝐄𝐃𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona una consulta\n┃ > para buscar en Pinterest.\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`
      }, { quoted: message });
    }

    await socket.sendMessage(remoteJid, { react: { text: '🔍', key: message.key } });

    const stellarUrl = `https://api.stellarwa.xyz/search/pinterest?query=${encodeURIComponent(query)}&key=api-7dSKm`;
    const causasUrl = `https://rest.apicausas.xyz/api/v1/buscadores/pinterest?apikey=oboe&q=${encodeURIComponent(query)}`;
    const deliriusUrl = `https://api.delirius.store/search/pinterestv2?text=${encodeURIComponent(query)}`;

    const apiCalls = [
      fetchJson(stellarUrl).then(r => ({ source: 'StellarWA', data: r.data || r.data?.data })),
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
        text: `╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ⚠️ 𝐄𝐑𝐑𝐎𝐑 𝐃𝐄 𝐁𝐔́𝐒𝐐𝐔𝐄𝐃𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > No se pudieron obtener resultados de ninguna API.\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`
      }, { quoted: message });
    }

    const items = (result.data || []).slice(0, 10);
    if (!items.length) {
      await socket.sendMessage(remoteJid, { react: { text: '❌', key: message.key } });
      return await socket.sendMessage(remoteJid, {
        text: `╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ⚠️ 𝐒𝐈𝐍 𝐑𝐄𝐒𝐔𝐋𝐓𝐀𝐃𝐎𝐒\n╰━━━━━━━━━━━━⬣\n\n┃ > No se encontraron resultados para "${query}" en Pinterest.\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`
      }, { quoted: message });
    }

    let captionText = `╭━━〔 𝐏𝐈𝐍𝐓𝐄𝐑𝐄𝐒𝐓 𝐒𝐄𝐀𝐑𝐂𝐇 〕━━⬣\n`;
    captionText += `┃ 🔍 𝐁úsqueda: ${query}\n`;
    captionText += `┃ ⚙️ 𝐌otor › ${result.source || 'Desconocido'}\n`;
    captionText += `╰━━━━━━━━━━━━━━━━⬣\n\n`;

    items.forEach((item, i) => {
      const title = item.title || item.name || 'Sin título';
      const author = item.username || item.author_username || 'Desconocido';
      const likes = item.likes ?? item.likes?.toString() ?? '0';
      
      let link = '#';
      const pinId = item.id || item.pinId || item.pin_id;
      if (pinId && !String(pinId).startsWith('http')) {
        link = `https://www.pinterest.com/pin/${pinId}`;
      } else {
        link = item.link || item.url || item.pin_url || item.hd || item.image || '#';
      }

      captionText += `┃ ${i + 1}. ${title}\n`;
      captionText += `┃ ├ 👤 Autor › ${author}\n`;
      captionText += `┃ ├ ❤️ Likes › ${likes}\n`;
      captionText += `┃ └ 🔗 Enlace › ${link}\n\n`;
    });

    captionText += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

    // Collect all image URLs
    const mediaArray = items.map(item => ({ url: item.hd || item.image || item.image_small || '' })).filter(m => m.url);
    const album = mediaArray.map((m, i) => ({ image: { url: m.url }, caption: i === 0 ? captionText : '' }));

    await sendAlbumMessage(socket, remoteJid, album, message);
    await socket.sendMessage(remoteJid, { react: { text: '✅', key: message.key } });
    return;

    
  }
};
