import fs from 'fs';
import path from 'path';

const command = {
    command: ['cekcode'],
    category: ['owner']
};

command.script = async (m) => {

    if (!m.isOwner) {
        return m.reply('Perintah ini hanya dapat digunakan owner bot.');
    }

    const folderPath = path.join(__dirname, '../'); 

    try {
        const files = fs.readdirSync(folderPath);
        let errorMessages = [];
        let count = 0;

        for (const file of files) {
            const filePath = path.join(folderPath, file);
            count++;

            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                if (content.includes('undefined')) {
                    throw new Error(`${file} is not undefined`);
                }
            } catch (error) {
                errorMessages.push(`${count}. ${error.message}`);
            }
        }

        const response = [`Jumlah file: ${count}`];
        if (errorMessages.length > 0) {
            response.push('Error ditemukan:\n' + errorMessages.join('\n'));
        } else {
            response.push('Semua file diperiksa dan tidak ada error ditemukan.');
        }

        await m.reply(response.join('\n'));
    } catch (error) {
        await m.reply(`Terjadi kesalahan saat membaca folder: ${error.message}`);
    }
};

export default command;