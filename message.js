import config from './config.js'
import * as func from './lib/function.js'

import util from 'util'
import * as wajs from 'whatsapp-web.js'
import { exec } from 'child_process'
import { performance } from 'perf_hooks'

export default async function (hisoka, m) {
   try {
      let isOwner = config.OWNER.some(v => new RegExp(v.replace('/[^0-9]/g', '') + '@c.us').test(m.author || m.from))

      if (!m._data.isNewMsg) return
      if (!isOwner && config.SELF) return

      let prefix = (new RegExp(config.PREFIX, 'u')).test(m.body) ? m.body.match(new RegExp(config.PREFIX, 'u'))[0] : ''
      let command = m.body && m.body.trim().replace(prefix, '').trim().split(/ +/).shift()
      let isCommand = prefix && m.body.startsWith(prefix) && func.commands().includes(command.toLowerCase()) || false
      let isBot = m._data.id && /BAE5|W4SO|IDK1/.test(m._data.id.id)

      let args = m.body.trim().split(/ +/).filter(a => a) || []
      if (isCommand) args = m.body.trim().replace(new RegExp("^" + func.escapeRegExp(prefix), 'i'), '').replace(command, '').split(/ +/).filter(a => a) || []
      let text = args.join(' ')

      // memunculkan ke log
      if (m._data.isNewMsg && !isBot) {
         console.log(Color.black(Color.bgWhite("FROM")), Color.black(Color.bgGreen(m._data.notifyName)), Color.black(Color.yellow(m.to)) + "\n" + Color.black(Color.bgWhite("IN")), Color.black(Color.bgGreen(m.isGroup ? "Group" : "Private")) + "\n" + Color.black(Color.bgWhite("MESSAGE")), Color.black(Color.bgGreen(m.body || m.type)))
      }

      switch (isCommand ? command.toLowerCase() : false) {
         case "info": {
            let os = (await import("os")).default
            let v8 = (await import("v8")).default
            let performanceOld = performance.now()

            const used = process.memoryUsage()
            const cpus = os.cpus().map(cpu => {
               cpu.total = Object.keys(cpu.times).reduce((last, type) => last + cpu.times[type], 0)
               return cpu
            })
            const cpu = cpus.reduce((last, cpu, _, { length }) => {
               last.total += cpu.total
               last.speed += cpu.speed / length
               last.times.user += cpu.times.user
               last.times.nice += cpu.times.nice
               last.times.sys += cpu.times.sys
               last.times.idle += cpu.times.idle
               last.times.irq += cpu.times.irq
               return last
            }, {
               speed: 0,
               total: 0,
               times: {
                  user: 0,
                  nice: 0,
                  sys: 0,
                  idle: 0,
                  irq: 0
               }
            })
            let heapStat = v8.getHeapStatistics()
            let neow = performance.now()

            let teks = `
*Ping :* *_${Number(Number(neow - performanceOld).toFixed(2) / 1000).toFixed(2)} second(s)_*

💻 *_Info Server_*
*- Hostname :* ${(os.hostname() || hisoka.user?.name)}
*- Platform :* ${os.platform()}
*- OS :* ${os.version()} / ${os.release()}
*- Arch :* ${os.arch()}
*- RAM :* ${func.formatSize(os.totalmem() - os.freemem(), false)} / ${func.formatSize(os.totalmem(), false)}

*_Runtime OS_*
${func.runtime(os.uptime())}

*_Runtime Bot_*
${func.runtime(process.uptime())}

*_NodeJS Memory Usage_*
${Object.keys(used).map((key, _, arr) => `*- ${key.padEnd(Math.max(...arr.map(v => v.length)), ' ')} :* ${func.formatSize(used[key])}`).join('\n')}
*- Heap Executable :* ${func.formatSize(heapStat?.total_heap_size_executable)}
*- Physical Size :* ${func.formatSize(heapStat?.total_physical_size)}
*- Available Size :* ${func.formatSize(heapStat?.total_available_size)}
*- Heap Limit :* ${func.formatSize(heapStat?.heap_size_limit)}
*- Malloced Memory :* ${func.formatSize(heapStat?.malloced_memory)}
*- Peak Malloced Memory :* ${func.formatSize(heapStat?.peak_malloced_memory)}
*- Does Zap Garbage :* ${func.formatSize(heapStat?.does_zap_garbage)}
*- Native Contexts :* ${func.formatSize(heapStat?.number_of_native_contexts)}
*- Detached Contexts :* ${func.formatSize(heapStat?.number_of_detached_contexts)}
*- Total Global Handles :* ${func.formatSize(heapStat?.total_global_handles_size)}
*- Used Global Handles :* ${func.formatSize(heapStat?.used_global_handles_size)}
${cpus[0] ? `

*_Total CPU Usage_*
${cpus[0].model.trim()} (${cpu.speed} MHZ)\n${Object.keys(cpu.times).map(type => `*- ${(type + '*').padEnd(6)}: ${(100 * cpu.times[type] / cpu.total).toFixed(2)}%`).join('\n')}

*_CPU Core(s) Usage (${cpus.length} Core CPU)_*
${cpus.map((cpu, i) => `${i + 1}. ${cpu.model.trim()} (${cpu.speed} MHZ)\n${Object.keys(cpu.times).map(type => `*- ${(type + '*').padEnd(6)}: ${(100 * cpu.times[type] / cpu.total).toFixed(2)}%`).join('\n')}`).join('\n\n')}` : ''}
`.trim()
            await m.reply(teks)
         }
            break


         default:
            text = text.trim().replace(new RegExp("^" + func.escapeRegExp(prefix), 'i'), '').replace(command, '').trim()
            // eval
            if ([">", "eval", "=>"].some(a => command.toLowerCase().startsWith(a)) && isOwner) {
               new Promise(async (resolve, reject) => {
                  try {
                     let evalCmd = /await/i.test(text) ? eval("(async() => { " + text + " })()") : eval(text)
                     resolve(evalCmd)
                  } catch (err) {
                     reject(err)
                  }
               })
                  ?.then(async (res) => {
                     res = util.format(res)
                     for (let { value } of config.Keys) {
                        if (!value) continue
                        res = res.replace(new RegExp(value, 'g'), "#HIDDEN#")
                     }
                     await m.reply(res)
                  })
                  ?.catch(async (err) => {
                     err = util.format(err)
                     for (let { value } of config.Keys) {
                        if (!value) continue
                        err = err.replace(new RegExp(value, 'g'), "#HIDDEN#")
                     }
                     await m.reply(err)
                  })
            }

            // exec
            if (["$", "exec"].some(a => command.toLowerCase().startsWith(a)) && isOwner) {
               try {
                  exec(text, async (err, stdout) => {
                     if (err) return m.reply(util.format(err))
                     if (stdout) return m.reply(util.format(stdout))
                  })
               } catch (e) {
                  await m.reply(util.format(e))
               }
            }
      }
   } catch (err) {
      console.error(err)
   }
}