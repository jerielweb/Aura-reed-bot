const axios = require('axios');

module.exports = {
  name: ['tts', 'tiktoksearch', 'ttsearch'],
  description: 'Buscar videos de TikTok',
  category: 'search',
  async execute(client, message, args, prefix) {
    if (args.length === 0) {
      return client.sendText(message.from, `⚠️ Uso: ${prefix}tt <búsqueda>\nEjemplo: ${prefix}tt Bomboclat`);
    }

    const query = args.join(' ');

    await client.sendStateTyping(message.from);

    try {
      const result = await Promise.race([
        searchAlyacore(query),
        searchDelirius(query)
      ]);

      if (!result) {
        return client.sendText(
          message.from,
          `❌ No encontré resultados para: *${query}*`
        );
      }

      const messageText = formatTikTokMessage(result);
      await client.sendText(message.from, messageText);

      if (result.image) {
        try {
          await client.sendImage(message.from, result.image, 'TikTok Result');
        } catch (error) {
          console.log('Could not send image:', error.message);
        }
      }
    } catch (error) {
      console.error('TikTok search error:', error);
      client.sendText(
        message.from,
        `❌ Error en la búsqueda. Intenta más tarde.`
      );
    }
  }
};

async function searchAlyacore(query) {
  try {
    const response = await axios.get(global.tiktokApis.alyacore.url, {
      params: {
        query: query,
        key: global.tiktokApis.alyacore.apikey
      },
      timeout: 5000
    });

    if (!response.data.data || response.data.data.length === 0) {
      return null;
    }

    const video = response.data.data[0];
    return {
      title: video.title || 'No title',
      author: video.author?.nickname || 'Unknown creator',
      duration: video.duration || '0:00',
      views: video.stats?.views || 0,
      likes: video.stats?.likes || 0,
      downloads: video.stats?.downloads || 0,
      url: video.dl || '',
      image: video.cover || null,
      source: '🎵 Alyacore'
    };
  } catch (error) {
    console.log('Alyacore search error:', error.message);
    return null;
  }
}

async function searchDelirius(query) {
  try {
    const response = await axios.get(global.tiktokApis.delirius.url, {
      params: { q: query },
      timeout: 5000
    });

    if (!response.data.meta || response.data.meta.length === 0) {
      return null;
    }

    const video = response.data.meta[0];
    return {
      title: video.title || 'No title',
      author: video.author?.nickname || 'Unknown creator',
      duration: video.duration || '0:00',
      views: video.play || 0,
      likes: video.like || 0,
      downloads: video.download || 0,
      url: video.hd || video.url || '',
      image: video.thumbnail || null,
      source: '🎵 Delirius'
    };
  } catch (error) {
    console.log('Delirius search error:', error.message);
    return null;
  }
}

function formatTikTokMessage(video) {
  const header = '╔═══════════════════════════════╗\n║ 🎬 *TikTok Search Result* 🎬 ║\n╚═══════════════════════════════╝';
  
  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const body = `
📺 *${video.title}*

👤 *Creador:* @${video.author}
⏱️ *Duración:* ${video.duration}
❤️ *Likes:* ${formatNumber(video.likes)}
👀 *Vistas:* ${formatNumber(video.views)}
💾 *Descargas:* ${formatNumber(video.downloads)}

${video.source}

${video.url ? `🔗 Ver: ${video.url}` : ''}`;

  return header + body;
}