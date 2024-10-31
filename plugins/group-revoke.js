const command = {
    command: ['revoke'],
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
    try {
        await hisoka.groupRevokeInvite(m.from);
        await m.reply("sukses");
    } catch (error) {
        console.error(error);
        await m.reply("Terjadi kesalahan saat mencabut undangan grup.");
    }
};

export default command;