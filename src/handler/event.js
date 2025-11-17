'use strict';

import { jidNormalizedUser, toNumber, jidDecode, proto, isPnUser } from 'baileys';

import { telegram } from '../helper/index.js';
import { isNumber } from '../helper/text.js';

/**
 * @param {import('../../index').WAMessageExtra} m
 * @param {import('../../index').WASocketExtra} hisoka
 */
export default async function (m, hisoka) {
	try {
		// Log the message details
		if (process.env.BOT_LOG_MESSAGE === 'true' && m.type !== 'protocolMessage' && !m.isBot) {
			console.log(`\x1b[32m${'—'.repeat(50)}\x1b[39m`);
			console.log(
				`\x1b[36mReceived message from ${
					m.isGroup ? `"${m.pushName}" in "${hisoka.getName(m.from)}"` : m.pushName
				} (${m.type})\x1b[39m`
			);
			const maxLogLength = 200;
			const displayText = m.text.length > maxLogLength ? m.text.slice(0, maxLogLength) + '...' : m.text;
			console.log(`\x1b[36mText: ${displayText}\x1b[39m`);
		}

		// Hanlde Expiration Contextinfo
		if (m.content && m.content.contextInfo && isNumber(m.content.contextInfo.expiration) && isPnUser(m.from)) {
			const expiration = m.content.contextInfo.expiration;
			const ephemeralSettingTimestamp = toNumber(m.content.contextInfo.ephemeralSettingTimestamp);
			const contact = hisoka.contacts.read(m.from) || {};
			hisoka.contacts.write(m.from, { ...contact, ephemeralSettingTimestamp, ephemeralDuration: expiration });
		}

		// Handle protocol messages
		if (m.message.protocolMessage) {
			const protocolMessage = m.message.protocolMessage;
			const key = protocolMessage.key;
			const type = protocolMessage.type;

			switch (type) {
				case proto.Message.ProtocolMessage.Type.EPHEMERAL_SETTING:
				case proto.Message.ProtocolMessage.Type.EPHEMERAL_SYNC_RESPONSE:
					{
						const id = await hisoka.resolveLidToPN(key);
						const contact = hisoka.contacts.read(id) || {};
						hisoka.contacts.write(id, {
							...contact,
							ephemeralSettingTimestamp: toNumber(
								protocolMessage.ephemeralSettingTimestamp || m.message.messageTimestamp
							),
							ephemeralDuration: protocolMessage.ephemeralExpiration,
						});
					}
					break;
			}
		}

		// Handle read receipts and send read status to Telegram
		if (!m.isOwner && m.status && m.content.type !== 0) {
			const privacySettings = hisoka.settings.read('privacy') || {};
			const readType = privacySettings.readreceipts === 'all' ? 'read' : 'read-self';
			await hisoka.sendReceipts([m.key], readType);

			// Send reaction status
			const reactStatus = process.env.BOT_REACT_STATUS?.split(',')?.map(item => item.trim()) || [];
			if (reactStatus.length) {
				await hisoka.sendMessage(
					'status@broadcast',
					{
						react: { key: m.key, text: reactStatus[Math.floor(Math.random() * reactStatus.length)] },
					},
					{
						statusJidList: [jidNormalizedUser(hisoka.user.id), jidNormalizedUser(m.sender)],
					}
				);
			}

			// Send read status to Telegram
			if (process.env.TELEGRAM_CHAT_ID && process.env.TELEGRAM_TOKEN) {
				const from = jidNormalizedUser(m.participant || m.sender);
				const name = hisoka.getName(from, true);
				const text = `<b>From :</b> <a href="https://wa.me/${jidDecode(from).user}">@${name}</a>
<b>Date :</b> ${new Date(toNumber(m.messageTimestamp) * 1000).toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })}
${m.text ? `<b>Caption :</b>\n\n${m.text}` : ''}`.trim();

				if (m.isMedia) {
					const media = await m.downloadMedia();

					await telegram.send(process.env.TELEGRAM_CHAT_ID, media, {
						caption: text,
						type: m.type.replace('Message', ''),
						parse_mode: 'HTML',
					});
				} else {
					await telegram.send(process.env.TELEGRAM_CHAT_ID, text, { type: 'text', parse_mode: 'HTML' });
				}
			}
		}
	} catch (e) {
		console.error(`\x1b[31mError in event handler:\x1b[39m\n`, e);
	}
}
