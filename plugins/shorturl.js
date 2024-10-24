// https://whatsapp.com/channel/0029VaW25g5F1YlKczMRmd1h/1224
export async function tnyim(url) {
    try {
        const response = await fetch(`https://tny.im/yourls-api.php?format=json&action=shorturl&url=${url}`);
        const result = await response.json();
        return result.shorturl;
    } catch (error) {
        console.error(error);
        return null;
    }
}


const command = {
    command: ['shorturl'],
    category: ['tools']
};

command.script = async (m, { hisoka }) => {
    if (!m.text.includes('https')) {
        return m.reply(`Silakan berikan URL yang valid.\nContoh: ${m.prefix}shorturl https://`);
    }

    const shortUrl = await tnyim(m.text);
    if (shortUrl) {
        m.reply(`URL pendek kamu: ${shortUrl}`);
    } else {
        m.reply('Terjadi kesalahan saat memperpendek URL. Silakan coba lagi.');
    }
};

export default command;