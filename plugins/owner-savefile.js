import fs from "fs";
import syntaxerror from "syntax-error";

const command = {
    command: ['savefile'],
    category: ['owner']
};

command.script = async (m, { hisoka }) => {
    if (!m.isOwner) {
        return m.reply('Perintah ini hanya dapat digunakan owner bot.');
    }
    
    try {
    if (!m.text) return await m.reply(`Masukkan text untuk nama path nya?\n\npenggunaan:\n${m.prefix + m.command} <teks>\n\ncontoh:\n${m.prefix + m.command} menu`);
    if (!m.quoted?.text) return await m.reply("balas pesan nya untuk isi kode path nya");
    let path = `${m.text}`;
    const fileContent = Buffer.from(m.quoted && (m.quoted?.text || m.quoted?.msg) || "", "utf-8"),
      err = syntaxerror(fileContent, path, {
        sourceType: "module",
        ecmaVersion: 2020,
        allowAwaitOutsideFunction: !0,
        allowReturnOutsideFunction: !0,
        allowImportExportEverywhere: !0
      });
    if (err) return await m.reply(`Terjadi kesalahan sintaks: ${err.message}`);
    await fs.writeFileSync(path, m.quoted && (m.quoted?.text || m.quoted?.msg) || ""),
      await m.reply(`Tersimpan di ${path}`);
  } catch (error) {
    await m.reply(`Terjadi kesalahan: ${error}`);
  }
}
    
export default command;