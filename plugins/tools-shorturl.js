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

const urlRegex = /https?:\/\/[^\s]+/;

const command = {
    command: ['shorturl'],
    category: ['tools']
};

command.script = async (m, { hisoka }) => {
    const text = m.quoted ? m.quoted.msg : m.text;
    if (!text) {
        return m.reply(`Silakan masukkan URL yang ingin dipendekkan.\nContoh: ${m.prefix + m.command} https://`);
    }
    const urlMatch = text.match(urlRegex);
    if (!urlMatch) {
        return m.reply(`Teks itu tidak mengandung URL.\nContoh: ${m.prefix + m.command} https://`);
    }
    const url = urlMatch[0];
    const shortUrl = await tnyim(url);
    
    if (shortUrl) {
        m.reply(`URL pendek kamu: ${shortUrl}`);
    } else {
        m.reply('Terjadi kesalahan saat memperpendek URL. Silakan coba lagi.');
    }
};

export default command;