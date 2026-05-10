import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
    id: { type: String, default: 'main_config' }, // ID único para la config global
    prefix: { type: String, default: '!' }        // Prefijo por defecto
});

export default mongoose.model('Settings', settingsSchema);