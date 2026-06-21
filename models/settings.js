import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
    id: { type: String, default: 'main_config' },
    prefix: { type: String, default: '!' }
});

export default mongoose.model('Settings', settingsSchema);



import fs from 'fs';
import gemini from '../commands/AI/gemini';

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));

global.chanellink = 'https://whatsapp.com/channel/0029VbCfr0zBvvsofUsffZ2q'
global.version = packageJson.version

//Apis
global.Apis = {
    apiCausa: {
        apikey: 'oboe',
        url: 'https://rest.apicausas.xyz/'
    },
    apiAiya: {
        apikey: 'oboe',
        url: 'https://api.alyacore.xyz/'
    },
    appiFaa: {
        apikey: null,
        url: 'https://api-faa.my.id/'
    },
    deliriusApi: {
        apikey: null,
        url: 'https://api.delirius.store/'
    },
};
//AI
global.geminiApi = 'AQ.Ab8RN6I_GpnoPONT4EheYajqmBsXONQumiOu9J2JroC_-UBjDQ'

// YouTube Search APIs
global.youtubeApis = {
    alyacore: {
        url: 'https://api.alyacore.xyz/search/yt',
        apikey: 'oboe'
    },
    delirius: {
        url: 'https://api.delirius.store/search/ytsearch'
    }
};

// TikTok Search APIs
global.tiktokApis = {
    alyacore: {
        url: 'https://api.alyacore.xyz/search/tiktok',
        apikey: 'oboe'
    },
    delirius: {
        url: 'https://api.delirius.store/search/tiktoksearch'
    }
};


global.apiShazam = {
    url: 'https://api.audd.io/',
    apikey: '07887abb3c387183d5f3be932f3445d5'
}