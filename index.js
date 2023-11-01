import "dotenv/config"

import makeWASocket, { delay, useMultiFileAuthState, fetchLatestWaWebVersion, makeInMemoryStore, jidNormalizedUser, PHONENUMBER_MCC, DisconnectReason } from "@whiskeysockets/baileys"
import pino from "pino"
import { Boom } from "@hapi/boom"
import fs from "fs"

const logger = pino({ timestamp: () => `,"time":"${new Date().toJSON()}"` }).child({ class: "hisoka" })
logger.level = "fatal"

const useStore = process.argv.includes('--store')
const usePairingCode = process.env.PAIRING_NUMBER

const store = useStore ? makeInMemoryStore({ logger }) : undefined

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

   if (useStore) store.bind(hisoka.ev)

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

   // bagian pepmbaca status ono ng kene
   hisoka.ev.on("messages.upsert", async ({ messages }) => {
      let message = messages[0]

      if (message.key && !message.key.fromMe && message.key.remoteJid === "status@broadcast") {
         await hisoka.readMessages([message.key])
         await hisoka.sendMessage(jidNormalizedUser(hisoka.user.id), { text: `Read Story @${message.key.participant.split("@")[0]}`, mentions: [message.key.participant] }, { quoted: message })
      }
   })

   process.on("uncaughtException", console.error)
   process.on("unhandledRejection", console.error)
}

// opsional
async function getMessage(key) {
   try {
      if (useStore) {
         const jid = jidNormalizedUser(key.remoteJid)
         const msg = await store.loadMessage(jid, key.id)

         return msg?.message || ""
      }

      return ""
   } catch { }
}

startSock()