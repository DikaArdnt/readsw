const command = {
    command: ['setname'],
    category: ['group']
};

command.script = async (m, { hisoka }) => {
    if (!m.isGroup) {
        return m.reply('Perintah ini hanya dapat digunakan di dalam grup.');
    }
    if (!m.isBotAdmin) {
        return m.reply('Perintah ini hanya dapat digunakan jika bot berstatus admin.');
    }
    if (!m.isAdmin) {
        return m.reply('Perintah ini hanya dapat digunakan oleh admin group.');
    }
    if (!m.text) {
        return m.reply('Masukkan teks untuk nama group nya');
    }
    try {
        await hisoka.groupUpdateSubject(m.from, m.text);
        await m.reply("Sukses");
    } catch (error) {
        console.error(error);
        await m.reply("Terjadi kesalahan saat mengubah nama grup.");
    }
};

export default command;