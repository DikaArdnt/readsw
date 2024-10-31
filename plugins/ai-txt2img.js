import { generateImage, generateWithPlayground } from "../lib/skrep.js";

const command = {
    command: ['dallediff', 'sdxl', 'pixartdiff', 'realdiff'],
    category: ['ai'],
};

const models = {
    dallediff: "DallE-XL",
    sdxl: "SD-XL",
    pixartdiff: "PixArt-Sigma"
};

command.script = async (m, { hisoka, store }) => {
    if (!m.text) {
        return m.reply(`masukkan parameter nya.\nContoh: ${m.prefix + m.command} 1 girl`);
    }
    await m.reply("tunggu sebentar....");
    const resolutions = ["Square", "Wide", "Portrait"];
    const randomResol = resolutions[Math.floor(Math.random() * resolutions.length)];

    console.log("Command yang diterima:", m.command);

    const modelKey = m.command; 
    const model = models[modelKey];

    if (!model && modelKey !== 'realdiff') {
        return m.reply(`Model tidak ditemukan untuk command: ${modelKey}`);
    }

    try {
        let res;
        if (modelKey === 'realdiff') {
            res = await generateWithPlayground(m.text, randomResol);
        } else {
            res = await generateImage(m.text, randomResol, model);
        }

        const uniqueId = m.quoted ? m.quoted.id : m.id;
        const caption = `${m.text}\nKetik 1 sambil reply pesan ini untuk generate ulang\nID: ${uniqueId}`;

        await hisoka.sendMessage(m.from, { image: { url: res.images[0].url }, caption }, { quoted: m });

        store.messages[uniqueId] = { command: m.prefix + m.command, text: m.text };

        if (m.quoted && m.quoted.id === uniqueId && m.text === '1') {
            await hisoka.sendMessage(m.from, { image: { url: res.images[0].url }, caption }, { quoted: m });
        }

    } catch (error) {
        console.error("Error generating image:", error); 
        await m.reply(`Terjadi kesalahan saat menghasilkan gambar: ${error.message || error}`);
    }
};

export default command;