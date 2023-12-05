const Keys = [
   {
      name: "google",
      value: "AIzaSyCft0hsqywQBaygkpiulaDifhbWiE4lRgg"
   },
   {
      name: "memegen",
      value: "g5a2p8r1b7"
   },
   {
      name: "xfarr",
      host: "https://api.xfarr.com",
      value: "halahhisoka"
   },
   {
      name: "skizo",
      host: "https://skizo.tech",
      value: "ximixomoxixi"
   },
   {
      name: "ardnt",
      host: "https://file.ardnt.id"
   },
   {
      name: "tele",
      host: "https://api.telegram.org",
      value: "1580714970:AAEieqpUQNAzTLqCmmewofMScImh_0XP3WM"
   }
]

const Key = (name) => Keys.find(v => v.name === name)

export default {
   // isi dengan nomor yang ingin anda jadikan bot, kode pairing muncul di log
   PAIRING_NUMBER: "",

   // nomor owner untuk penggunaan command khusus owner
   OWNER: ["6288292024190", "62858156631709"],

   // untuk size auto restart, RAM sisa 350MB auto restart
   AUTO_RESTART: "350 MB",

   // `true` untuk pribadi dan `false` untuk publik
   SELF: true,

   // session name
   SESSION_NAME: "session",

   // Exif Sticker
   Exif: {
      packName: "Sticker Dibuat Oleh : ",
      packPublish: "Dika Ardianta"
   },

   PREFIX: /^\p{Extended_Pictographic}|^[°•π÷×¶∆£¢€¥®™+✓=|/~!?@#%^&.©^]/,

   // API Key
   Keys,
   Key,
   API: (name, path = '/', query = {}, apikeyqueryname, apikeyvalue = '') => (Key(name) ? Key(name).host : name) + path + (query || apikeyqueryname ? '?' + new URLSearchParams(Object.entries({ ...query, ...(apikeyqueryname ? { [apikeyqueryname]: Key(name)?.value ? Key(name).value : apikeyvalue } : {}) })) : '')
}