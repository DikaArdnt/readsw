import config from "../config.js"

import axios from "axios"
import FormData from "form-data"
import { fileTypeFromBuffer } from "file-type"
import mimes from "mime-types"
import fs from "fs"
import Crypto from "crypto"
import path from "path"
import { fileURLToPath, pathToFileURL } from "url"

export const toBuffer = async (stream) => {
   const chunks = [];
   for await (const chunk of stream) {
       chunks.push(chunk);
   }
   stream.destroy();
   return Buffer.concat(chunks);
}

export async function fetchBuffer(url, options = {}) {
   try {
      let { data, headers } = await axios(url, {
         headers: {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "Upgrade-Insecure-Requests": "1",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0",
            ...(!!options.headers ? options.headers : {}),
         },
         responseType: "stream",
         ...options
      })

      let buffer = await toBuffer(data)
      let position = headers.get("content-disposition")?.match(/filename=(?:(?:"|')(.*?)(?:"|')|([^"'\s]+))/)
      let filename = decodeURIComponent(position?.[1] || position?.[2] || url)?.replace(/[\`"']/g, '') || null
      let mimetype = mimes.lookup(filename) || (await fileTypeFromBuffer(buffer))?.mime || "application/octet-stream"
      let ext = mimes.extension(mimetype) || (await fileTypeFromBuffer(buffer))?.ext || "bin"

      return { data: buffer, filename, mimetype, ext, size: Buffer.byteLength(buffer) }
   } catch (e) {
      throw e
   }
}

export async function getFile(inp, options = {}) {
   try {
      if (/^https?:\/\//i.test(inp)) {
         let data = await fetchBuffer(inp, options)
         return data
      } else if (fs.existsSync(inp) && fs.statSync(inp).isFile()) {
         let data = fs.readFileSync(inp)
         let mimetype = (await fileTypeFromBuffer(data)).mime
         return {
            data,
            filename: null,
            mimetype,
            ext: mimes.lookup(mimetype) || (await fileTypeFromBuffer(data)).ext,
            size: Buffer.byteLength(data)
         }
      } else if (Buffer.isBuffer(inp)) {
         let mimetype = (await fileTypeFromBuffer(inp)).mime
         return {
            data: inp,
            filename: null,
            mimetype,
            ext: mimes.lookup(mimetype) || (await fileTypeFromBuffer(inp)).ext,
            size: Buffer.byteLength(inp)
         }
      } else if (/^[a-zA-Z0-9+/]={0,2}$/i.test(inp) || /^data:.*?\/.*?;base64,/i.test(inp)) {
         let data
         if (/^data:.*?\/.*?;base64,/i.test(inp)) data = Buffer.from(inp.split`,`[1], "base64")
         else data = Buffer.from(inp, "base64")
         let mimetype = (await fileTypeFromBuffer(data)).mime
         return {
            data,
            filename: null,
            mimetype,
            ext: mimes.lookup(mimetype) || (await fileTypeFromBuffer(data)).ext,
            size: Buffer.byteLength(data)
         }
      }
   } catch (e) {
      throw e
   }
}

export async function fetchJson(url, options = {}) {
   try {
      let { data } = await axios(url, {
         headers: {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0",
            ...(!!options.headers ? options.headers : {}),
         },
         responseType: "json",
         ...options
      })

      return data
   } catch (e) {
      throw e
   }
}

export async function fetchText(url, options = {}) {
   try {
      let { data } = await axios(url, {
         headers: {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0",
            ...(!!options.headers ? options.headers : {}),
         },
         responseType: "text",
         ...options
      })

      return data
   } catch (e) {
      throw e
   }
}

export function isUrl(url) {
   let regex = new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,9}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/, "gi")
   if (!regex.test(url)) return false
   return url.match(regex)
}

export const upload = {
   pomf(media, filename = "file") {
      return new Promise(async (resolve, reject) => {
         let mime = await fileTypeFromBuffer(media)
         let form = new FormData()

         form.append("files[]", media, `${filename}-${(Math.random() * 99999).toFixed()}.${mime.ext}`)

         axios.post("https://pomf.lain.la/upload.php", form, {
            headers: {
               "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0",
               ...form.getHeaders()
            }
         }).then(({ data }) => resolve(data.files[0].url)).catch(reject)
      })
   },

   telegra(media, filename = "file") {
      return new Promise(async (resolve, reject) => {
         let mime = await fileTypeFromBuffer(media)
         let form = new FormData()

         form.append("file", media, `${filename}-${(Math.random() * 99999).toFixed()}.${mime.ext}`)

         axios.post("https://telegra.ph/upload", form, {
            headers: {
               "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0",
               ...form.getHeaders()
            }
         }).then(({ data }) => resolve("https://telegra.ph" + data[0].src)).catch(reject)
      })
   },

   async tmpfile(buffer, filename = "file") {
      try {
         let media = await fileTypeFromBuffer(buffer)
         let form = new FormData()

         form.append("file", buffer, `${filename}-${(Math.random() * 99999).toFixed()}.${media.ext}`)
         let { data } = await axios.post("https://tmpfiles.org/api/v1/upload", form, {
            headers: {
               "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0"
            }
         })

         return data?.data?.url?.replace("tmpfiles.org/", "tmpfiles.org/dl/")
      } catch (e) {
         throw e
      }
   },

   async myserver(buffer, filename = "file") {
      try {
         let media = (await fileTypeFromBuffer(buffer) || "text/plain")
         let form = new FormData()

         form.append("file", buffer, `${filename}-${(Math.random() * 99999).toFixed()}.${media?.ext || "txt"}`)
         let { data } = await axios.post("https://file.ardnt.id/upload", form)

         return data?.file
      } catch (e) {
         throw e
      }
   }
}

export async function sendTelegram(chatId, data, options = {}) {
   try {
      let token = options?.token || config.Key("tele").value

      function capitalizeFirstLetter(string) {
         return string.charAt(0).toUpperCase() + string.slice(1);
      }

      const DEFAULT_EXTENSIONS = {
         audio: 'mp3',
         photo: 'jpg',
         sticker: 'webp',
         video: 'mp4',
         animation: 'mp4',
         video_note: 'mp4',
         voice: 'ogg',
      }

      let type = options?.type
         ? options.type : typeof data === "string"
            ? "text" : /webp/.test((await fileTypeFromBuffer(data))?.mime)
               ? "sticker" : /image/.test((await fileTypeFromBuffer(data))?.mime)
                  ? "photo" : /video/.test((await fileTypeFromBuffer(data))?.mime)
                     ? "video" : /opus/.test((await fileTypeFromBuffer(data))?.mime)
                        ? "voice" : /audio/.test((await fileTypeFromBuffer(data))?.mime)
                           ? "audio" : "document"

      let url = `https://api.telegram.org/bot${token}/send${type === "text" ? "Message" : capitalizeFirstLetter(type)}`

      let form = new FormData()

      form.append("chat_id", chatId)
      if (type === "text") {
         form.append(type, data)
         if (options.parse_mode) form.append("parse_mode", options.parse_mode)
      }
      else {
         let fileType = await fileTypeFromBuffer(data)
         form.append(type, data, `file-${Date.now()}.${DEFAULT_EXTENSIONS?.[type] || fileType?.ext}`)
         if (options?.caption) {
            form.append("caption", options.caption)
            if (options.parse_mode) form.append("parse_mode", options.parse_mode)
         }
      }

      let { data: response } = await axios.post(url, form, {
         headers: {
            'Content-Type': 'multipart/form-data',
         }
      })

      return response
   } catch (e) {
      throw e
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

// source code https://github.com/patrickkettner/filesize-parser
export function parseFileSize(input, si = true) {
   const thresh = si ? 1000 : 1024

   var validAmount = function (n) {
      return !isNaN(parseFloat(n)) && isFinite(n);
   };

   var parsableUnit = function (u) {
      return u.match(/\D*/).pop() === u;
   };

   var incrementBases = {
      2: [
         [["b", "bit", "bits"], 1 / 8],
         [["B", "Byte", "Bytes", "bytes"], 1],
         [["Kb"], 128],
         [["k", "K", "kb", "KB", "KiB", "Ki", "ki"], thresh],
         [["Mb"], 131072],
         [["m", "M", "mb", "MB", "MiB", "Mi", "mi"], Math.pow(thresh, 2)],
         [["Gb"], 1.342e+8],
         [["g", "G", "gb", "GB", "GiB", "Gi", "gi"], Math.pow(thresh, 3)],
         [["Tb"], 1.374e+11],
         [["t", "T", "tb", "TB", "TiB", "Ti", "ti"], Math.pow(thresh, 4)],
         [["Pb"], 1.407e+14],
         [["p", "P", "pb", "PB", "PiB", "Pi", "pi"], Math.pow(thresh, 5)],
         [["Eb"], 1.441e+17],
         [["e", "E", "eb", "EB", "EiB", "Ei", "ei"], Math.pow(thresh, 6)]
      ],
      10: [
         [["b", "bit", "bits"], 1 / 8],
         [["B", "Byte", "Bytes", "bytes"], 1],
         [["Kb"], 125],
         [["k", "K", "kb", "KB", "KiB", "Ki", "ki"], 1000],
         [["Mb"], 125000],
         [["m", "M", "mb", "MB", "MiB", "Mi", "mi"], 1.0e+6],
         [["Gb"], 1.25e+8],
         [["g", "G", "gb", "GB", "GiB", "Gi", "gi"], 1.0e+9],
         [["Tb"], 1.25e+11],
         [["t", "T", "tb", "TB", "TiB", "Ti", "ti"], 1.0e+12],
         [["Pb"], 1.25e+14],
         [["p", "P", "pb", "PB", "PiB", "Pi", "pi"], 1.0e+15],
         [["Eb"], 1.25e+17],
         [["e", "E", "eb", "EB", "EiB", "Ei", "ei"], 1.0e+18]
      ]
   }

   var options = arguments[1] || {};
   var base = parseInt(options.base || 2);

   var parsed = input.toString().match(/^([0-9\.,]*)(?:\s*)?(.*)$/);
   var amount = parsed[1].replace(',', '.');
   var unit = parsed[2];

   var validUnit = function (sourceUnit) {
      return sourceUnit === unit;
   };

   if (!validAmount(amount) || !parsableUnit(unit)) {
      return false
   }
   if (unit === '') return Math.round(Number(amount));

   var increments = incrementBases[base];
   for (var i = 0; i < increments.length; i++) {
      var _increment = increments[i];

      if (_increment[0].some(validUnit)) {
         return Math.round(amount * _increment[1]);
      }
   }

   throw unit + ' doesn\'t appear to be a valid unit';
}

export function escapeRegExp(string) {
   return string.replace(/[.*=+:\-?^${}()|[\]\\]|\s/g, '\\$&')
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

export function toUpper(query) {
   const arr = query.split(" ")
   for (var i = 0; i < arr.length; i++) {
      arr[i] = arr[i].charAt(0).toUpperCase() + arr[i].slice(1)
   }

   return arr.join(" ")
}

export function random(list) {
   return list[Math.floor(Math.random() * list.length)];
}

export function getRandomNoRepeat(array, batasan) {
   var arrayAcak = [];

   while (arrayAcak.length < batasan && array.length > 0) {
      var randomIndex = Math.floor(Math.random() * array.length);
      var elemenAcak = array[randomIndex];
      arrayAcak.push(elemenAcak);
      array.splice(randomIndex, 1);
   }

   return Array.from(new Set(arrayAcak))
}

export function readJSON(file) {
   if (fs.existsSync(file)) {
      return new Promise((resolve, reject) => {
         let stream = fs.createReadStream(file, "utf-8")

         let data = ''
         stream.on("data", (chunk) => {
            data += chunk
         })

         stream.on("end", () => {
            let json = JSON.parse(data)
            resolve(json)
         })
      })
   } else return false
}

export function writeJSON(file, data) {
   fs.writeFileSync(file, JSON.stringify(data))
}

export function encrypt(input, length = 8) {
   input = length !== 0 ? (Crypto.randomBytes(length).toString("hex") + input) : input
   const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
   let encryptedText = '';

   for (let i = 0; i < input.length; i++) {
      const char = input[i];
      const charIndex = characters.indexOf(char);

      if (charIndex !== -1) {
         const shiftedIndex = (charIndex + 1) % characters.length;
         encryptedText += characters[shiftedIndex];
      } else {
         encryptedText += char;
      }
   }

   return length !== 0 ? encryptedText.toUpperCase() : encryptedText;
}

export function decrypt(input, length = 8) {
   input = length !== 0 ? input.slice(length * 2).toLowerCase() : input
   const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
   let decryptedText = '';

   for (let i = 0; i < input.length; i++) {
      const char = input[i];
      const charIndex = characters.indexOf(char);

      if (charIndex !== -1) {
         const shiftedIndex = (charIndex - 1 + characters.length) % characters.length;
         decryptedText += characters[shiftedIndex];
      } else {
         decryptedText += char;
      }
   }

   return decryptedText;
}

export function options(text) {
   const form = new FormData()
   const matches = text?.match(/--(\w+)\s+['"]([^'"]+)['"]/g);

   let options = {
      method: "GET",
      data: {},
      headers: {
         "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
         "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0"
      }
   };

   matches?.forEach(match => {
      const [, name, value] = match?.match(/--(\w+)\s+['"]([^'"]+)['"]/);

      if (/^(header(s)?|h)$/i.test(name)) {
         let [headerName, headerValue] = value.split(':').map(part => part.trim());
         headerValue = value.match(new RegExp(headerName + ":(.*)"))?.[1]?.trim() || headerValue
         options.headers[headerName] = headerValue;
      }
      if (/^(data|d)$/i.test(name)) {
         let [dataName, dataValue] = value.split(':').map(part => part.trim());
         dataValue = value.match(new RegExp(dataName + ":(.*)"))?.[1]?.trim() || dataValue
         options.data[dataName] = dataValue;
      }
      if (/^(form|f)$/i.test(name)) {
         let [dataName, dataValue] = value.split(':').map(part => part.trim());
         dataValue = value.match(new RegExp(dataName + ":(.*)"))?.[1]?.trim() || dataValue
         form.append(dataName, dataValue)
      }
      if (/^(method|m)$/i.test(name)) {
         options.method = value;
      }
      if (/^(cookie|c)$/i.test(name)) {
         options.headers["Cookie"] = value
      }
      if (/^(filename)$/i.test(name)) {
         options.fileName = value
      }
   });

   if (/(form|f)/gi.test(text) && /post/i.test(options.method)) options.data = form

   if (Object.keys(options.data).length === 0) delete options.data

   return options
}

export function correct(mainString, targetStrings) {
   function compareTwoStrings(first, second) {
      first = first?.replace(/\s+/g, '') || ""
      second = second?.replace(/\s+/g, '') || ""

      if (first === second) return 1 // identical or empty
      if (first.length < 2 || second.length < 2) return 0 // if either is a 0-letter or 1-letter string

      let firstBigrams = new Map()
      for (let i = 0; i < first.length - 1; i++) {
         const bigram = first.substring(i, i + 2)
         const count = firstBigrams.has(bigram)
            ? firstBigrams.get(bigram) + 1
            : 1

         firstBigrams.set(bigram, count)
      }

      let intersectionSize = 0
      for (let i = 0; i < second.length - 1; i++) {
         const bigram = second.substring(i, i + 2)
         const count = firstBigrams.has(bigram)
            ? firstBigrams.get(bigram)
            : 0

         if (count > 0) {
            firstBigrams.set(bigram, count - 1)
            intersectionSize++
         }
      }

      return (2.0 * intersectionSize) / (first.length + second.length - 2)
   }

   targetStrings = Array.isArray(targetStrings) ? targetStrings : [];

   const ratings = [];
   let bestMatchIndex = 0;

   for (let i = 0; i < targetStrings.length; i++) {
      const currentTargetString = targetStrings[i];
      const currentRating = Number(
         compareTwoStrings(
            mainString,
            currentTargetString
         )
      ).toFixed(2);
      ratings.push({
         target: currentTargetString,
         rating: currentRating,
      });
      if (currentRating > ratings[bestMatchIndex].rating) {
         bestMatchIndex = i;
      }
   }

   const bestMatch = ratings[bestMatchIndex];

   return {
      all: ratings,
      indexAll: bestMatchIndex,
      result: bestMatch?.target,
      rating: bestMatch?.rating,
   };
}

export function memegenLinkText(text) {
   // Given a text, split it into an array using the seperator
   // Then join it back into a string with the join item inbetween each element
   // This is a crude way to replacAll(thing to replace, thing to replace with)
   let filteredText = text.replace(/_/g, '__')
   filteredText = filteredText.replace(/\s/g, '_')
   filteredText = filteredText.replace(/\?/g, '~q')
   filteredText = filteredText.replace(/%/g, '~p')
   filteredText = filteredText.replace(/#/g, '~h')
   filteredText = filteredText.replace(/\//g, '~s')
   filteredText = filteredText.replace(/"/g, "''")
   filteredText = filteredText.replace(/-/g, '--')
   filteredText = filteredText.replace(/&/g, '~a')
   filteredText = filteredText.replace(/</g, '~l')
   filteredText = filteredText.replace(/>/g, '~g')
   filteredText = filteredText.replace(/\n/g, '~n')

   return filteredText;
}

export function __filename(pathURL = import.meta, rmPrefix = process.platform !== "win32") {
   const path = pathURL?.url || pathURL;
   return rmPrefix
      ? /file:\/\/\//.test(path)
         ? fileURLToPath(path)
         : path
      : /file:\/\/\//.test(path)
         ? path
         : pathToFileURL(path).href;
}

export function __dirname(pathURL) {
   const dir = __filename(pathURL, true);
   const regex = /\/$/;
   return regex.test(dir)
      ? dir
      : fs.existsSync(dir) && fs.statSync(dir).isDirectory
         ? dir.replace(regex, "")
         : path.dirname(dir);
}

export function commands() {
   let data = fs.readFileSync("message.js").toString()
   const caseNamesRegex = /case\s+("(?:\\"|[^"])*"|'(?:\\'|[^'])*')\s*:/g;

   const words = [];
   let match;
   while ((match = caseNamesRegex.exec(data))) {
      const caseName = match[1];
      words.push(caseName.replace(/["'\`]/g, ''));
   }

   return words
}