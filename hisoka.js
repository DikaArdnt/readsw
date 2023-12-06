process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
import config from "./config.js"

import { formatSize, parseFileSize } from "./lib/function.js"

import { Client } from "whatsapp-web.js"
import os from "os"
import { exec } from "child_process"
import path from "path"
import qrcode from "qrcode-terminal"

const startClient = async () => {
   const hisoka = new Client({
      sessionName: config.SESSION_NAME,
      playwright: {
         headless: true,
         args: [
            '--aggressive-tab-discard',
            '--disable-accelerated-2d-canvas',
            '--disable-application-cache',
            '--disable-cache',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-offline-load-stale-cache',
            '--disable-setuid-sandbox',
            '--disable-web-security',
            '--disk-cache-size=0',
            '--ignore-certificate-errors',
            '--no-first-run',
            '--no-sandbox',
            '--no-zygote',
            '--max-old-space-size=8192'
            //'--enable-features=WebContentsForceDark:inversion_method/cielab_based/image_behavior/selective/text_lightness_threshold/150/background_lightness_threshold/205'
         ],
         bypassCSP: true,
         acceptDownloads: true,
         downloadsPath: path.join(process.cwd(), 'temp')
      },
      qrMaxRetries: 2,
      userAgent: os.platform() === 'win32' ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36' : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safa',
      deviceName: 'hisoka',
      poweredBy: 'Dika Ardnt.'
   })

   await hisoka.initialize()

   hisoka.on('qr', (code) => {
      qrcode.generate(code, { small: true })
   })

   hisoka.on('authenticated', () => {
      console.log('authenticated')
   })

   hisoka.on('change_state', (state) => {
      console.log(state)
   })

   hisoka.on('disconnected', (reason) => {
      if (reason) startClient()
   })

   hisoka.on('ready', async () => {
      await hisoka.sendMessage(hisoka.info.wid._serialized, `${hisoka.info.pushname} Connected`)
      await hisoka.playPage.evaluate(() => {
         window.WPP.conn.setLimit('maxMediaSize', 73400320)
         window.WPP.conn.setLimit('maxFileSize', 1073741824)
         window.WPP.conn.setLimit('maxShare', 250)
         window.WPP.conn.setLimit('statusVideoMaxDuration', 480)
         window.WPP.conn.setLimit('unlimitedPin', true)
      })
   })

   hisoka.on('message_create', async (message) => {
      await (await import(`./message.js?v=${Date.now()}`)).default(hisoka, message)
   })

   setInterval(async () => {
      // untuk auto restart ketika RAM sisa 300MB
      const memoryUsage = (os.totalmem() - os.freemem())

      if (memoryUsage > (os.totalmem() - parseFileSize(config.AUTO_RESTART, false))) {
         await hisoka.sendMessage(hisoka.info.wid._serialized, `penggunaan RAM mencapai *${formatSize(memoryUsage)}* waktunya merestart...`)
         exec("npm run restart:pm2", (err) => {
            if (err) return process.send('reset')
         })
      }
   }, 10 * 1000) // tiap 10 detik

   process.on("uncaughtException", console.error)
   process.on("unhandledRejection", console.error)
}

startClient()