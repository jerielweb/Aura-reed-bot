import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
    id: { type: String, default: 'main_config' },
    prefix: { type: String, default: '!' }        
});

export default mongoose.model('Settings', settingsSchema); 