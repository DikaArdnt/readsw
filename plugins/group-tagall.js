const command = {
    command: ['tagall'],
    category: ['group']
};

command.script = async (m, { hisoka }) => {
    if (!m.isGroup) {
        return m.reply('Perintah ini hanya dapat digunakan di dalam grup.');
    }

    try {
        let users = m.metadata.participants
            .map(u => u.id)
            .filter(v => v !== hisoka.user.jid);

        const txt = `*Teks:*\n${m.text ? `${m.text}\n` : ""}\n` +
            '‚⛊──⛾「  Tag All 」⛾──⛊\n' +
            users.map(v => "│♪ @" + v.replace(/@.+/, "")).join`\n` +
            "\n⛊──⛾「  Tag All 」⛾──⛊";

        await m.reply(txt, null, { mentions: users });
    } catch (error) {
        console.error(error);
        await m.reply("Terjadi kesalahan.");
    }
};

export default command;