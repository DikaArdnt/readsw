import "dotenv/config"
import Color from "./lib/color.js"
import serialize, { Client } from "./lib/serialize.js"
import * as Func from "./lib/function.js"

import makeWASocket, { delay, useMultiFileAuthState, fetchLatestWaWebVersion, makeInMemoryStore, jidNormalizedUser, PHONENUMBER_MCC, DisconnectReason, getContentType } from "@whiskeysockets/baileys"
import pino from "pino"
import { Boom } from "@hapi/boom"
import fs from "fs"
import util from "util"
import { exec } from "child_process"

const logger = pino({ timestamp: () => `,"time":"${new Date().toJSON()}"` }).child({ class: "hisoka" })
logger.level = "fatal"

const usePairingCode = process.env.PAIRING_NUMBER

const store = makeInMemoryStore({ logger })
store.readFromFile("./session/store.json")

const startSock = async () => {
   const { state, saveCreds } = await useMultiFileAuthState("./session")
   const { version, isLatest } = await fetchLatestWaWebVersion()

   console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`)

   const hisoka = makeWASocket.default({
      version,
      logger,
      printQRInTerminal: !usePairingCode,
      auth: state,
      browser: ['Chrome (Linux)', '', ''],
      markOnlineOnConnect: false,
      getMessage
   })

   store.bind(hisoka.ev)
   await Client({ hisoka, store })

   // login dengan pairing
   if (usePairingCode && !hisoka.authState.creds.registered) {
      let phoneNumber = usePairingCode.replace(/[^0-9]/g, '')

      if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) throw "Start with your country's WhatsApp code, Example : 62xxx"

      await delay(3000)
      let code = await hisoka.requestPairingCode(phoneNumber)
      console.log(`\x1b[32m${code?.match(/.{1,4}/g)?.join("-") || code}\x1b[39m`)
   }

   // ngewei info, restart or close
   hisoka.ev.on("connection.update", (update) => {
      const { lastDisconnect, connection, qr } = update
      if (connection) {
         console.info(`Connection Status : ${connection}`)
      }

      if (connection === "close") {
         let reason = new Boom(lastDisconnect?.error)?.output.statusCode

         switch (reason) {
            case DisconnectReason.badSession:
               console.info(`Bad Session File, Restart Required`)
               startSock()
               break
            case DisconnectReason.connectionClosed:
               console.info("Connection Closed, Restart Required")
               startSock()
               break
            case DisconnectReason.connectionLost:
               console.info("Connection Lost from Server, Reconnecting...")
               startSock()
               break
            case DisconnectReason.connectionReplaced:
               console.info("Connection Replaced, Restart Required")
               startSock()
               break
            case DisconnectReason.restartRequired:
               console.info("Restart Required, Restarting...")
               startSock()
               break
            case DisconnectReason.loggedOut:
               console.error("Device has Logged Out, please rescan again...")
               fs.rmdirSync("./session")
               break
            case DisconnectReason.multideviceMismatch:
               console.error("Nedd Multi Device Version, please update and rescan again...")
               fs.rmdirSync("./session")
               break
            default:
               console.log("Aku ra ngerti masalah opo iki")
               process.exit(1)
         }
      }

      if (connection === "open") {
         hisoka.sendMessage(jidNormalizedUser(hisoka.user.id), { text: `${hisoka.user?.name} has Connected...` })
      }
   })

   // write session kang
   hisoka.ev.on("creds.update", saveCreds)

   // contacts from store
   hisoka.ev.on("contacts.update", (update) => {
      for (let contact of update) {
         let id = jidNormalizedUser(contact.id)
         if (store && store.contacts) store.contacts[id] = { id, ...(contact || {}), ...(store.contacts?.[id] || {}) }
      }
   })

   hisoka.ev.on("contacts.upsert", (update) => {
      for (let contact of update) {
         let id = jidNormalizedUser(contact.id)
         if (store && store.contacts) store.contacts[id] = { id, ...(contact || {}), ...(store.contacts?.[id] || {}) }
      }
   })

   // bagian pepmbaca status ono ng kene
   hisoka.ev.on("messages.upsert", async ({ messages }) => {
      let m = await serialize(hisoka, messages[0])
      try {
         // untuk membaca pesan status
         if (m.key && !m.key.fromMe && m.key.remoteJid === "status@broadcast") {
            if (m.type === "protocolMessage" && m.message.protocolMessage.type === 0) return
            await hisoka.readMessages([m.key])
            await hisoka.sendMessage(jidNormalizedUser(hisoka.user.id), { text: `Read Story @${m.key.participant.split("@")[0]}`, mentions: [m.key.participant] }, { quoted: m, ephemeralExpiration: m.expiration })
         }

         let quoted = m.isQuoted ? m.quoted : m

         // status self apa publik
         if (process.env.PUBLIC !== true && !m.isOwner) return

         // mengabaikan pesan dari bot
         if (m.isBot) return

         // memunculkan ke log
         if (m.message && !m.isBot) {
            console.log(Color.black(Color.bgWhite("FROM")), Color.black(Color.bgGreen(m.pushName)), Color.black(Color.yellow(m.sender)) + "\n" + Color.black(Color.bgWhite("IN")), Color.black(Color.bgGreen(m.isGroup ? "Group" : "Private")) + "\n" + Color.black(Color.bgWhite("MESSAGE")), Color.black(Color.bgGreen(m.body || m.type)))
         }

         // command
         switch (m.command) {
            case "quoted": case "q":
               if (!m.isQuoted) throw "Reply Pesan"
               try {
                  var message = await serialize(hisoka, (await store.loadMessage(m.from, m.quoted.id)))
                  if (!message.isQuoted) throw "Pesan quoted gaada"
                  await m.reply({ forward: message.quoted })
               } catch (e) {
                  throw "Pesan gaada"
               }
               break

            case "rvo":
               if (!quoted.msg.viewOnce) throw "Reply Pesan Sekali Lihat"
               quoted.msg.viewOnce = false
               await m.reply({ forward: quoted })
               break

            case "getsw": case "sw":
               if (!store.messages["status@broadcast"]) throw "Gaada 1 status pun"
               let contacts = Object.values(store.contacts)

               let sender
               if (m.mentions.length !== 0) sender = m.mentions[0]
               else if (m.text) sender = contacts.find(v => [v.name, v.verifiedName, v.notify, v.status].some(name => name && name.toLowerCase().includes(m.text.toLowerCase())))?.id

               let stories = store.messages["status@broadcast"].array.length !== 0 && store.messages["status@broadcast"].array
               let story = stories.filter(v => v.key && v.key.participant === sender).filter(v => v.message && !!getContentType(v.message))

               if (story.length !== 0) {
                  for (let msg of story) {
                     await delay(2500)
                     await m.reply({ forward: msg })
                  }
               }
               else throw "Gaada sw nya"
               break

            case "sticker": case "s":
               if (/image|video|webp/.test(quoted.msg.mimetype)) {
                  let media = await hisoka.downloadMediaMessage(quoted)
                  if (quoted.msg?.seconds > 10) throw "Video diatas durasi 10 detik gabisa"
                  let exif
                  if (m.text) {
                     let [packname, author] = m.text.split(/[,|\-+&]/)
                     exif = { packName: packname ? packname : "", packPublish: author ? author : "" }
                  } else {
                     exif = { packName: `Sticker Dibuat Oleh : `, packPublish: `Dika Ardianta` }
                  }

                  let sticker = await (await import("./lib/sticker.js")).writeExif({ mimetype: quoted.msg.mimetype, data: media }, exif)
                  await m.reply({ sticker })
               } else if (m.mentions.length !== 0) {
                  for (let id of m.mentions) {
                     await delay(1500)
                     let url = await hisoka.profilePictureUrl(id, "image")
                     let media = await Func.fetchBuffer(url)
                     let sticker = await (await import("./lib/sticker.js")).writeExif(media, { packName: `Sticker Dibuat Oleh : `, packPublish: `Dika Ardianta` })
                     await m.reply({ sticker })
                  }
               } else if (/(https?:\/\/.*\.(?:png|jpg|jpeg|webp|mov|mp4|webm|gif))/i.test(m.text)) {
                  for (let url of Func.isUrl(m.text)) {
                     await delay(1500)
                     let media = await Func.fetchBuffer(url)
                     let sticker = await (await import("./lib/sticker.js")).writeExif(media, { packName: `Sticker Dibuat Oleh : `, packPublish: `Dika Ardianta` })
                     await m.reply({ sticker })
                  }
               } else {
                  let media = await Func.fetchBuffer("https://www.hlapi.cn/api/mcj")
                  let sticker = await (await import("./lib/sticker.js")).writeExif(media, { packName: `Sticker Dibuat Oleh : `, packPublish: `Dika Ardianta` })
                  await m.reply({ sticker })
               }
               break
            
            case "tourl":
               if (!quoted.isMedia) throw "Reply pesan media"
               if (Number(quoted.msg?.fileLength) > 350000000) throw "Kegeden mas"
               let media = await hisoka.downloadMediaMessage(quoted)
               let url = (/image|video/i.test(quoted.msg.mimetype) && !/webp/i.test(quoted.msg.mimetype)) ? await Func.upload.telegra(media) : await Func.upload.pomf(media)
               await m.reply(url)
               break

            default:
               // eval
               if ([">", "eval", "=>"].some(a => m.body?.toLowerCase()?.startsWith(a)) && m.isOwner) {
                  let evalCmd = ""
                  try {
                     evalCmd = /await/i.test(m.text) ? eval("(async() => { " + m.text + " })()") : eval(m.text)
                  } catch (e) {
                     evalCmd = e
                  }
                  new Promise(async (resolve, reject) => {
                     try {
                        resolve(evalCmd);
                     } catch (err) {
                        reject(err)
                     }
                  })
                     ?.then((res) => m.reply(util.format(res)))
                     ?.catch((err) => m.reply(util.format(err)))
               }

               // exec
               if (["$", "exec"].some(a => m.body?.toLowerCase()?.startsWith(a)) && m.isOwner) {
                  try {
                     exec(m.text, async (err, stdout) => {
                        if (err) return m.reply(util.format(err))
                        if (stdout) return m.reply(util.format(stdout))
                     })
                  } catch (e) {
                     await m.reply(util.format(e))
                  }
               }
         }
      } catch (err) {
         await m.reply(util.format(err))
      }
   })

   setInterval(() => {
      store.writeToFile("./session/store.json")
   }, 10 * 1000) // tiap 10 detik

   process.on("uncaughtException", console.error)
   process.on("unhandledRejection", console.error)
}

// opsional
async function getMessage(key) {
   try {
      const jid = jidNormalizedUser(key.remoteJid)
      const msg = await store.loadMessage(jid, key.id)

      return msg?.message || ""

      return ""
   } catch { }
}

startSock()