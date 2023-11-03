import axios from "axios"
import FormData from "form-data"
import { fileTypeFromBuffer } from "file-type"
import { toBuffer } from "@whiskeysockets/baileys"
import mimes from "mime-types"

export function fetchBuffer(url, options = {}) {
   return new Promise((resolve, reject) => {
      axios.get(url, {
         headers: {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "Upgrade-Insecure-Requests": "1",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0",
            ...(!!options.headers ? options.headers : {}),
         },
         responseType: "stream",
         ...options
      }).then(async ({ data, headers }) => {
         let buffer = await toBuffer(data)
         let position = headers.get("content-disposition")?.match(/filename=(?:(?:"|')(.*?)(?:"|')|([^"'\s]+))/)
         let filename = decodeURIComponent(position?.[1] || position?.[2]) || null
         let mimetype = mimes.lookup(filename) || (await fileTypeFromBuffer(buffer)).mime || "application/octet-stream"
         let ext = mimes.extension(mimetype) || (await fileTypeFromBuffer(buffer)).ext || "bin"

         resolve({ data: buffer, filename, mimetype, ext })
      }).catch(reject)
   })
}

export function fetchJson(url, options = {}) {
   return new Promise((resolve, reject) => {
      axios.get(url, {
         headers: {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0",
            ...(!!options.headers ? options.headers : {}),
         },
         responseType: "json",
         ...options
      }).then(({ data }) => resolve(data)).catch(reject)
   })
}

export function fetchText(url, options = {}) {
   return new Promise((resolve, reject) => {
      axios.get(url, {
         headers: {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0",
            ...(!!options.headers ? options.headers : {}),
         },
         responseType: "text",
         ...options
      }).then(({ data }) => resolve(data)).catch(reject)
   })
}

export function isUrl(url) {
   let regex = new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,9}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/, "gi")
   if (!regex.test(url)) return false
   return url.match(regex)
}

export const upload = {
   pomf(media) {
      return new Promise(async (resolve, reject) => {
         let mime = await fileTypeFromBuffer(media)
         let form = new FormData()

         form.append("files[]", media, `file-${Date.now()}.${mime.ext}`)

         axios.post("https://pomf.lain.la/upload.php", form, {
            headers: {
               "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0",
               ...form.getHeaders()
            }
         }).then(({ data }) => resolve(data.files[0].url)).catch(reject)
      })
   },

   telegra(media) {
      return new Promise(async (resolve, reject) => {
         let mime = await fileTypeFromBuffer(media)
         let form = new FormData()

         form.append("file", media, `file-${Date.now()}.${mime.ext}`)

         axios.post("https://telegra.ph/upload", form, {
            headers: {
               "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0",
               ...form.getHeaders()
            }
         }).then(({ data }) => resolve("https://telegra.ph" + data[0].src)).catch(reject)
      })
   }
}

export function formatSize(bytes, si = true, dp = 2) {
   const thresh = si ? 1000 : 1024;

   if (Math.abs(bytes) < thresh) {
      return `${bytes} B`;
   }

   const units = si
      ? ["kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
      : ["KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];
   let u = -1;
   const r = 10 ** dp;

   do {
      bytes /= thresh;
      ++u;
   } while (
      Math.round(Math.abs(bytes) * r) / r >= thresh &&
      u < units.length - 1
   );

   return `${bytes.toFixed(dp)} ${units[u]}`;
}

export function runtime(seconds) {
   seconds = Number(seconds);
   var d = Math.floor(seconds / (3600 * 24));
   var h = Math.floor((seconds % (3600 * 24)) / 3600);
   var m = Math.floor((seconds % 3600) / 60);
   var s = Math.floor(seconds % 60);
   var dDisplay = d > 0 ? d + (d == 1 ? " day, " : " days, ") : "";
   var hDisplay = h > 0 ? h + (h == 1 ? " hour, " : " hours, ") : "";
   var mDisplay = m > 0 ? m + (m == 1 ? " minute, " : " minutes, ") : "";
   var sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";
   return dDisplay + hDisplay + mDisplay + sDisplay;
}