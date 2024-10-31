const command = {
    command: ['totag'],
    category: ['group']
};

command.script = async (m, { hisoka }) => {

    if (!m.isGroup) {
        return m.reply('Perintah ini hanya dapat digunakan di dalam grup.');
    }

    if (!m.quoted) {
        return m.reply('Silakan reply teksnya.');
    }

    try {
        await hisoka.sendMessage(m.from, {
            forward: m.quoted.msg,
            mentions: m.metadata.participants
                .map(u => u.id)
                .filter(v => v !== hisoka.user.jid)
        });
    } catch (error) {
        console.error(error);
        await m.reply("error");
    }
};

export default command;