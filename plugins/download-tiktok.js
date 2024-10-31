import axios from 'axios';

const command = {
    command: ['tiktok'],
    category: ['download']
};

command.script = async (m, { hisoka }) => {
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:tiktok\.com|vt\.tiktok\.com)\/[^\s]+/;
    const anu = m.quoted ? m.quoted.msg : m.text || '';

    if (typeof anu !== 'string') {
        await m.reply('Silakan masukkan URL TikTok yang valid.');
        return;
    }

    if (!anu) {
        await m.reply('Silakan masukkan URL TikTok yang ingin diunduh.');
        return;
    }

    const match = anu.match(regex);

    if (!match) {
        await m.reply('Teks itu tidak tersedia URL TikTok.');
    } else {
        const tiktokUrl = match[0].trim();
        try {
            const response = await axios.post(
                'https://tikdown.xyz/api/download',
                { url: tiktokUrl },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
                        'Referer': 'https://tikdown.xyz/'
                    }
                }
            );

            const result = response.data;

            if (result.code !== 0) {
                await m.reply(`Error: ${result.msg}`);
            } else {
                const data = result.data;
                const videoUrl = `https://tikwm.com${data.play}`;
                const coverUrl = `https://tikwm.com${data.cover}`;
                const musicUrl = `https://tikwm.com${data.music}`;

                const caption = `
*Title:* ${data.title}
*Author:* ${data.author.nickname}
*Duration:* ${data.duration} detik
*Play Count:* ${data.play_count}
*Likes:* ${data.digg_count}
*Comments:* ${data.comment_count}
*Shares:* ${data.share_count}

*Original Sound:* ${data.music_info.title} by ${data.music_info.author}
                `.trim();

                await hisoka.sendMessage(m.from, {
                    video: { url: videoUrl },
                    caption: caption
                });
            }
        } catch (error) {
            await m.reply("Terjadi kesalahan saat mengambil data dari TikTok.");
        }
    }
};

export default command;