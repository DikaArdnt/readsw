'use strict';

import { isJidGroup } from 'baileys';
import { exec } from 'child_process';
import util from 'util';

import { msToTime } from '../helper/utils.js';

/**
 * @param {import('baileys').BaileysEventMap['messages.upsert'] & { message: import('baileys').WAMessage }} message
 * @param {import('../../index').WASocketExtra} hisoka
 */
export default async function ({ message, type: messagesType }, hisoka) {
	try {
		const { injectMessage } = await import('../helper/inject.js?v=' + Date.now());

		/**
		 * @type {import('../../index').WAMessageExtra}
		 */
		const m = await injectMessage(hisoka, message);

		// Check if the message is empty or malformed
		if (!m || !m.message) {
			console.warn('\x1b[33mReceived an empty message. Skipping...\x1b[39m\n', m);
			return;
		}

		/** Listen Event */
		const { default: listenEvent } = await import('./event.js?v=' + Date.now());
		await listenEvent(m, hisoka);
		/** End Listen Event */

		const quoted = m.isMedia ? m : m.isQuoted ? m.quoted : m;

		const text = m.text;
		const query = m.query || quoted.query;

		if (!m.message) return;
		if (!m.key) return;
		if (m.isBot) return; // Skip if the message is from a bot

		/* Command Handling */
		if (messagesType === 'append') return; // Skip command handling for appended messages
		if (m.age > 60 * 10) return; // Skip messages older than 10 minutes

		// Allow command only for me
		if (!m.isOwner) return;

		switch (m.command) {
			case 'hidetag':
			case 'ht':
			case 'everyone':
			case 'all':
				{
					if (m.isGroup) return;

					const group = hisoka.groups.read(m.from);
					const participants = group.participants.map(v => v.phoneNumber || v.id);

					const msg = await hisoka.messageModify(m.from, /text|conversation/i.test(m.type) && query ? m : quoted, {
						quoted: undefined,
						text: `@${m.from}\n\n${query}`.trim(),
						mentions: participants.map(v => ({ id: v })).concat({ id: m.from, name: 'everyone' }),
					});

					await hisoka.relayMessage(m.from, msg.message);
				}
				break;

			case 'q':
			case 'quoted':
				{
					// check if the message is a reply
					if (!m.isQuoted) {
						await m.reply('No quoted message found.');
						return;
					}

					// check if quoted message have quoted to
					const message = hisoka.cacheMsg.get(m.quoted.key.id);
					if (!message) {
						await m.reply('Quoted message not found.');
						return;
					}

					const IMessage = await injectMessage(hisoka, message);
					if (!IMessage.isQuoted) {
						await m.reply('Quoted message not found.');
						return;
					}

					await m.reply({ forward: IMessage.quoted });
				}
				break;

			case 'p':
			case 'ping':
				{
					const msg = await m.reply('Pong!');
					const latency = Math.abs(Date.now() - m.messageTimestamp * 1000);
					const uptime = process.uptime();
					await m.reply({
						edit: msg.key,
						text: `Pong! Latency: ${latency}ms\nUptime: ${msToTime(uptime * 1000)}`,
					});
				}
				break;

			case '>':
			case 'eval':
				{
					let result;
					try {
						const code = query || text;
						result = /await/i.test(code) ? await eval('(async() => { ' + code + ' })()') : await eval(code);
					} catch (error) {
						result = error;
					}

					await m.reply(util.format(result));
				}
				break;

			case '$':
			case 'exec':
			case 'bash':
				{
					try {
						exec(query, (error, stdout, stderr) => {
							if (error) {
								return m.throw(util.format(error));
							}
							if (stderr) {
								return m.throw(stderr);
							}
							if (stdout) {
								return m.reply(stdout);
							}
							// If no output, send a message indicating success
							return m.throw('Command executed successfully, but no output.');
						});
					} catch (error) {
						await m.reply(util.format(error));
						return;
					}
				}
				break;

			case 'groups':
			case 'group':
			case 'listgroups':
			case 'listgroup':
				{
					const groups = Object.values(await hisoka.groupFetchAllParticipating());
					groups.map(g => hisoka.groups.write(g.id, g));

					let text = `*Total ${groups.length} groups*\n`;
					text += `\n*Total Participants in all groups:* ${Array.from(groups).reduce(
						(a, b) => a + b.participants.length,
						0
					)}\n\n`;
					groups
						.filter(group => isJidGroup(group.id))
						.forEach((group, i) => {
							text += `${i + 1}. *${group.subject}* - ${group.participants.length} participants\n`;
						});

					await m.reply(text.trim());
				}
				break;

			case 'contacts':
			case 'contact':
			case 'listcontacts':
			case 'listcontact':
				{
					const contacts = Array.from(hisoka.contacts.values()).filter(c => c.id);
					let text = '*Total:*\n\n';
					text += `- All Contacts: ${contacts.length}\n`;
					text += `- Saved Contacts: ${contacts.filter(v => v.isContact).length}\n`;
					text += `- Not Saved Contacts: ${contacts.filter(v => !v.isContact).length}\n`;
					await m.reply(text.trim());
				}
				break;

			default:
			// Handle other commands or messages
		}
	} catch (error) {
		console.error(`\x1b[31mError in message handler:\x1b[39m\n`, error);
	}
}
