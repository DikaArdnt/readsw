import { delay, jidNormalizedUser } from '@whiskeysockets/baileys';
import util from 'util';
import { exec } from 'child_process';

import { commands } from './hisoka.js';
import * as Func from './lib/function.js';
import Color from './lib/color.js';
import serialize, { getContentType } from './lib/serialize.js';

/**
 * 
 * @param {import('@whiskeysockets/baileys').WASocket} hisoka 
 * @param {any} store 
 * @param {import('@whiskeysockets/baileys').WAMessage} m 
 */
export default async function message(hisoka, store, m) {
	try {
		let quoted = m.isQuoted ? m.quoted : m;
		let downloadM = async filename => await hisoka.downloadMediaMessage(quoted, filename);
		let isCommand = (m.prefix && m.body.startsWith(m.prefix)) || false;

		// mengabaikan pesan dari bot
		if (m.isBot) return;

		// memunculkan ke log
		if (m.message && !m.isBot) {
			console.log(Color.cyan('Dari'), Color.cyan(hisoka.getName(m.from)), Color.blueBright(m.from));
			console.log(Color.yellowBright('Chat'), Color.yellowBright(m.isGroup ? `Grup (${m.sender} : ${hisoka.getName(m.sender)})` : 'Pribadi'));
			console.log(Color.greenBright('Pesan :'), Color.greenBright(m.body || m.type));
		}

		// command
		switch (isCommand ? m.command.toLowerCase() : false) {
			case 'menu':
    {
        let menu = {
            main: ['menu', 'info', 'delete', 'quoted', 'listsw', 'getsw', 'sc'],
            tool: ['rvo', 'exif', 'tourl', 'sticker'],
            owner: ['upsw', 'restart', 'eval', 'exec'],
            group: ['link'],
        };

        // membaca plugin
        const pluginMenu = {};
        for (const [file, plugin] of commands['all:commands'].entries()) {
            const command = plugin.command || [];
            const category = plugin.category || ['others']; 
            category.forEach(cat => {
                if (!pluginMenu[cat]) pluginMenu[cat] = [];
                pluginMenu[cat].push(...command);
            });
        }

        let text = `Halo Dek @${m.sender.split`@`[0]}, Ini Menu, *Kabehe :* ${Object.values(menu)
            .map(a => a.length)
            .reduce((total, num) => total + num, 0)}\n\n`;

        Object.entries(menu).forEach(([type, command]) => {
            text += `┌──⭓ *${Func.toUpper(type)} Menu*\n`;
            text += `│⎚ ${command.map(a => `${m.prefix + a}`).join('\n│⎚ ')}\n`;
            text += '└───────⭓\n\n';
        });

        // menu plugin
        Object.entries(pluginMenu).forEach(([cat, commands]) => {
            text += `┌──⭓ *${Func.toUpper(cat)} Plugin Menu*\n`;
            text += `│⎚ ${commands.map(a => `${m.prefix + a}`).join('\n│⎚ ')}\n`;
            text += '└───────⭓\n\n';
        });

        await m.reply(text, { mentions: [m.sender] });
    }
    break;

			case 'info':
				{
					let os = (await import('os')).default;
					let v8 = (await import('v8')).default;
					let { performance } = (await import('perf_hooks')).default;
					let eold = performance.now();

					const used = process.memoryUsage();
					const cpus = os.cpus().map(cpu => {
						cpu.total = Object.keys(cpu.times).reduce((last, type) => last + cpu.times[type], 0);
						return cpu;
					});
					const cpu = cpus.reduce(
						(last, cpu, _, { length }) => {
							last.total += cpu.total;
							last.speed += cpu.speed / length;
							last.times.user += cpu.times.user;
							last.times.nice += cpu.times.nice;
							last.times.sys += cpu.times.sys;
							last.times.idle += cpu.times.idle;
							last.times.irq += cpu.times.irq;
							return last;
						},
						{
							speed: 0,
							total: 0,
							times: {
								user: 0,
								nice: 0,
								sys: 0,
								idle: 0,
								irq: 0,
							},
						}
					);
					let heapStat = v8.getHeapStatistics();
					let neow = performance.now();

					let teks = `
*Ping :* *_${Number(neow - eold).toFixed(2)} milisecond(s)_*

💻 *_Info Server_*
*- Hostname :* ${os.hostname() || hisoka.user?.name}
*- Platform :* ${os.platform()}
*- OS :* ${os.version()} / ${os.release()}
*- Arch :* ${os.arch()}
*- RAM :* ${Func.formatSize(os.totalmem() - os.freemem(), false)} / ${Func.formatSize(os.totalmem(), false)}

*_Runtime OS_*
${Func.runtime(os.uptime())}

*_Runtime Bot_*
${Func.runtime(process.uptime())}

*_NodeJS Memory Usage_*
${Object.keys(used)
	.map((key, _, arr) => `*- ${key.padEnd(Math.max(...arr.map(v => v.length)), ' ')} :* ${Func.formatSize(used[key])}`)
	.join('\n')}
*- Heap Executable :* ${Func.formatSize(heapStat?.total_heap_size_executable)}
*- Physical Size :* ${Func.formatSize(heapStat?.total_physical_size)}
*- Available Size :* ${Func.formatSize(heapStat?.total_available_size)}
*- Heap Limit :* ${Func.formatSize(heapStat?.heap_size_limit)}
*- Malloced Memory :* ${Func.formatSize(heapStat?.malloced_memory)}
*- Peak Malloced Memory :* ${Func.formatSize(heapStat?.peak_malloced_memory)}
*- Does Zap Garbage :* ${Func.formatSize(heapStat?.does_zap_garbage)}
*- Native Contexts :* ${Func.formatSize(heapStat?.number_of_native_contexts)}
*- Detached Contexts :* ${Func.formatSize(heapStat?.number_of_detached_contexts)}
*- Total Global Handles :* ${Func.formatSize(heapStat?.total_global_handles_size)}
*- Used Global Handles :* ${Func.formatSize(heapStat?.used_global_handles_size)}
${
	cpus[0]
		? `

*_Total CPU Usage_*
${cpus[0].model.trim()} (${cpu.speed} MHZ)\n${Object.keys(cpu.times)
				.map(type => `*- ${(type + '*').padEnd(6)}: ${((100 * cpu.times[type]) / cpu.total).toFixed(2)}%`)
				.join('\n')}

*_CPU Core(s) Usage (${cpus.length} Core CPU)_*
${cpus
	.map(
		(cpu, i) =>
			`${i + 1}. ${cpu.model.trim()} (${cpu.speed} MHZ)\n${Object.keys(cpu.times)
				.map(type => `*- ${(type + '*').padEnd(6)}: ${((100 * cpu.times[type]) / cpu.total).toFixed(2)}%`)
				.join('\n')}`
	)
	.join('\n\n')}`
		: ''
}
`.trim();
					await m.reply(teks);
				}
				break;

			case 'quoted':
			case 'q':
				if (!m.isQuoted) throw 'Reply Pesan';
				try {
					var message = await serialize(hisoka, await store.loadMessage(m.from, m.quoted.id), store);
					if (!message.isQuoted) throw 'Pesan quoted gaada';
					await m.reply({ forward: message.quoted, force: true });
				} catch (e) {
					throw 'Pesan gaada';
				}
				break;

			case 'rvo':
				if (!quoted.msg.viewOnce) throw 'Reply Pesan Sekali Lihat';
				quoted.msg.viewOnce = false;
				await m.reply({ forward: quoted, force: true });
				break;

			case 'getsw':
			case 'sw':
				{
					if (!store.messages['status@broadcast'].array.length === 0) throw 'Gaada 1 status pun';
					let contacts = Object.values(store.contacts);
					let [who, value] = m.text.split(/[,|\-+&]/);
					value = value?.replace(/\D+/g, '');

					let sender;
					if (m.mentions.length !== 0) sender = m.mentions[0];
					else if (m.text) sender = contacts.find(v => [v.name, v.verifiedName, v.notify].some(name => name && name.toLowerCase().includes(who.toLowerCase())))?.id;

					let stories = store.messages['status@broadcast'].array;
					let story = stories.filter(v => (v.key && v.key.participant === sender) || v.participant === sender).filter(v => v.message && v.message.protocolMessage?.type !== 0);
					if (story.length === 0) throw 'Gaada sw nya';
					if (value) {
						if (story.length < value) throw 'Jumlahnya ga sampe segitu';
						await m.reply({ forward: story[value - 1], force: true });
					} else {
						for (let msg of story) {
							await delay(1500);
							await m.reply({ forward: msg, force: true });
						}
					}
				}
				break;

			case 'listsw':
				{
					if (!store.messages['status@broadcast'].array.length === 0) throw 'Gaada 1 status pun';
					let stories = store.messages['status@broadcast'].array;
					let story = stories.filter(v => v.message && v.message.protocolMessage?.type !== 0);
					if (story.length === 0) throw 'Status gaada';
					const result = {};
					story.forEach(obj => {
						let participant = obj.key.participant || obj.participant;
						participant = jidNormalizedUser(participant === 'status_me' ? hisoka.user.id : participant);
						if (!result[participant]) {
							result[participant] = [];
						}
						result[participant].push(obj);
					});
					let type = mType => (getContentType(mType) === 'extendedTextMessage' ? 'text' : getContentType(mType).replace('Message', ''));
					let text = '';
					for (let id of Object.keys(result)) {
						if (!id) return;
						text += `*- ${hisoka.getName(id)}*\n`;
						text += `${result[id].map((v, i) => `${i + 1}. ${type(v.message)}`).join('\n')}\n\n`;
					}
					await m.reply(text.trim(), { mentions: Object.keys(result) });
				}
				break;

			case 'upsw':
				if (m.isOwner) {
					let statusJidList = [
						jidNormalizedUser(hisoka.user.id),
						...Object.values(store.contacts)
							.filter(v => v.isContact)
							.map(v => v.id),
					];
					let colors = ['#7ACAA7', '#6E257E', '#5796FF', '#7E90A4', '#736769', '#57C9FF', '#25C3DC', '#FF7B6C', '#55C265', '#FF898B', '#8C6991', '#C69FCC', '#B8B226', '#EFB32F', '#AD8774', '#792139', '#C1A03F', '#8FA842', '#A52C71', '#8394CA', '#243640'];
					let fonts = [0, 1, 2, 6, 7, 8, 9, 10];
					if (!quoted.isMedia) {
						let text = m.text || m.quoted?.body || '';
						if (!text) throw 'Mana text?';
						await hisoka.sendMessage(
							'status@broadcast',
							{ text },
							{
								backgroundColor: colors[Math.floor(Math.random() * colors.length)],
								textArgb: 0xffffffff,
								font: fonts[Math.floor(Math.random() * colors.length)],
								statusJidList,
							}
						);
						await m.reply(`Up status ke : ${statusJidList.length} Kontak`);
					} else if (/audio/.test(quoted.msg.mimetype)) {
						await hisoka.sendMessage(
							'status@broadcast',
							{
								audio: await downloadM(),
								mimetype: 'audio/mp4',
								ptt: true,
								waveform: [100, 0, 100, 0, 100, 0, 100],
							},
							{ backgroundColor: colors[Math.floor(Math.random() * colors.length)], statusJidList }
						);
						await m.reply(`Up status ke : ${statusJidList.length} Kontak`);
					} else {
						let type = /image/.test(quoted.msg.mimetype) ? 'image' : /video/.test(quoted.msg.mimetype) ? 'video' : false;
						if (!type) throw 'Type tidak didukung';
						await hisoka.sendMessage(
							'status@broadcast',
							{
								[type]: await downloadM(),
								caption: m.text || m.quoted?.body || '',
							},
							{ statusJidList }
						);
						await m.reply(`Up status ke : ${statusJidList.length} Kontak`);
					}
				}
				break;

			case 'sticker':
			case 's':
				if (/image|video|webp/.test(quoted.msg.mimetype)) {
					let media = await downloadM();
					if (quoted.msg?.seconds > 10) throw 'Video diatas durasi 10 detik gabisa';
					let exif;
					if (m.text) {
						let [packname, author] = m.text.split(/[,|\-+&]/);
						exif = { packName: packname ? packname : '', packPublish: author ? author : '' };
					} else {
						exif = { packName: process.env.packName, packPublish: process.env.packPublish };
					}

					let sticker = await (await import('./lib/sticker.js')).writeExif({ mimetype: quoted.msg.mimetype, data: media }, exif);
					await m.reply({ sticker });
				} else if (m.mentions.length !== 0) {
					for (let id of m.mentions) {
						await delay(1500);
						let url = await hisoka.profilePictureUrl(id, 'image');
						let media = await Func.fetchBuffer(url);
						let sticker = await (await import('./lib/sticker.js')).writeExif(media, { packName: process.env.packName, packPublish: process.env.packPublish });
						await m.reply({ sticker });
					}
				} else if (/(https?:\/\/.*\.(?:png|jpg|jpeg|webp|mov|mp4|webm|gif))/i.test(m.text)) {
					for (let url of Func.isUrl(m.text)) {
						await delay(1500);
						let media = await Func.fetchBuffer(url);
						let sticker = await (await import('./lib/sticker.js')).writeExif(media, { packName: process.env.packName, packPublish: process.env.packPublish });
						await m.reply({ sticker });
					}
				} else {
					let media = await Func.fetchBuffer('https://www.hlapi.cn/api/mcj');
					let sticker = await (await import('./lib/sticker.js')).writeExif(media, { packName: process.env.packName, packPublish: process.env.packPublish });
					await m.reply({ sticker });
				}
				break;

			case 'exif':
				{
					let webp = (await import('node-webpmux')).default;
					let img = new webp.Image();
					await img.load(await downloadM());
					await m.reply(util.format(JSON.parse(img.exif.slice(22).toString())));
				}
				break;

			case 'tourl':
				{
					if (!quoted.isMedia) throw 'Reply pesan media';
					if (Number(quoted.msg?.fileLength) > 350000000) throw 'Kegeden mas';
					let media = await downloadM();
					let url = /image|video/i.test(quoted.msg.mimetype) && !/webp/i.test(quoted.msg.mimetype) ? await Func.upload.telegra(media) : await Func.upload.pomf(media);
					await m.reply(url);
				}
				break;

			case 'link':
				if (!m.isGroup && !m.isBotAdmin) throw 'Gabisa, kalo ga karena bot bukan admin ya karena bukan grup';
				await m.reply('https://chat.whatsapp.com/' + (m.metadata?.inviteCode || (await hisoka.groupInviteCode(m.from))));
				break;

			case 'delete':
			case 'del':
				if (quoted.fromMe) {
					await hisoka.sendMessage(m.from, { delete: quoted.key });
				} else {
					if (!m.isBotAdmin) throw 'Bot bukan admin';
					if (!m.isAdmin) throw 'Lhu bukan admin paok 😂';
					await hisoka.sendMessage(m.from, { delete: quoted.key });
				}
				break;

			case 'restart':
				if (!m.isOwner) return;
				exec('npm run restart:pm2', err => {
					if (err) return process.send('reset');
				});
				break;

			case 'sc':
				await m.reply('Ori : https://github.com/DikaArdnt/readsw \nRemake : https://github.com/kazedepid/readsw');
				break;

			default:
				// eval
				if (['>', 'eval', '=>'].some(a => m.command.toLowerCase().startsWith(a)) && m.isOwner) {
					let evalCmd = '';
					try {
						evalCmd = /await/i.test(m.text) ? eval('(async() => { ' + m.text + ' })()') : eval(m.text);
					} catch (e) {
						evalCmd = e;
					}
					new Promise((resolve, reject) => {
						try {
							resolve(evalCmd);
						} catch (err) {
							reject(err);
						}
					})
						?.then(res => m.reply(util.format(res)))
						?.catch(err => m.reply(util.format(err)));
				}

				// exec
				if (['$', 'exec'].some(a => m.command.toLowerCase().startsWith(a)) && m.isOwner) {
					try {
						exec(m.text, async (err, stdout) => {
							if (err) return m.reply(util.format(err));
							if (stdout) return m.reply(util.format(stdout));
						});
					} catch (e) {
						await m.reply(util.format(e));
					}
				}
		}
	} catch (err) {
		await m.reply(util.format(err));
	}
}
