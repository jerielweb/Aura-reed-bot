import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
    id: { type: String, default: 'main_config' },
    prefix: { type: String, default: '!' }        
});

export default mongoose.model('Settings', settingsSchema);



import fs from 'fs';

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
}
