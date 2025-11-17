'use strict';

import {
	areJidsSameUser,
	generateWAMessageFromContent,
	getContentType,
	isJidGroup,
	isJidStatusBroadcast,
	isPnUser,
	isLidUser,
	jidDecode,
	jidNormalizedUser,
	downloadMediaMessage,
	generateMessageIDV2,
} from 'baileys';

import { escapeRegExp, parseMention, parseMessage } from './utils.js';

/**
 *
 * @param {import('../../index').WASocketExtra} hisoka
 * @param {Map<string, import('baileys').WAMessage>} cacheMsg
 * @param {import('../../index').Contacts} contacts
 * @param {import('../../index').Groups} groups
 * @param {import('../db/json.js').default} settings
 */
export function injectClient(hisoka, cacheMsg, contacts, groups, settings) {
	/**
	 * Loaded commands list
	 */
	hisoka.loadedCommands = [];

	/**
	 * Cache for messages
	 */
	hisoka.cacheMsg = cacheMsg;

	/**
	 * Cache for contacts
	 */
	hisoka.contacts = contacts;

	/**
	 * Cache for groups
	 */
	hisoka.groups = groups;

	/**
	 * Cache for settings
	 */
	hisoka.settings = settings;

	/**
	 *
	 * Download media message
	 */
	hisoka.downloadMediaMessage = async message => {
		const type = getContentType(message.message);
		if (!type || !message.message[type]?.mimetype) {
			throw new Error('No media found in message');
		}

		const media = await downloadMediaMessage(
			message,
			'buffer',
			{},
			{
				logger: hisoka.logger,
				reuploadRequest: hisoka.updateMediaMessage,
			}
		);

		return media;
	};

	/**
	 * Get the name of a contact
	 */
	hisoka.getName = (jid, nameContact = false) => {
		jid = jidNormalizedUser(jid);

		if (!jid) return 'Unknown';

		if (isJidGroup(jid)) {
			const group = groups.read(jid) || {};
			return group.subject;
		}

		if (areJidsSameUser(jid, hisoka.user.id)) {
			return hisoka.user.name;
		}

		const contact = contacts.find(c => areJidsSameUser(c.phoneNumber || c.id, jid));
		if (!contact) return jidDecode(jid).user;
		const originalName = contact.verifiedName || contact.notify;
		return (nameContact ? contact.name || originalName : originalName || contact.name) || jidDecode(jid).user;
	};

	/**
	 * Get ephemeral setting for a message
	 */
	hisoka.getEphemeral = async jid => {
		const contact = isJidGroup(jid) ? groups.read(jid) : contacts.read(jid);
		if (contact && typeof contact.ephemeralDuration === 'number') {
			const data = {};
			const ephemeralExpiration = contact?.ephemeralDuration;
			const ephemeralSettingTimestamp = contact?.ephemeralSettingTimestamp;

			if (typeof ephemeralExpiration === 'number') {
				if (typeof ephemeralSettingTimestamp === 'number') {
					data.ephemeralSettingTimestamp = ephemeralSettingTimestamp;
				}

				data.ephemeralDuration = ephemeralExpiration;
			}

			return data;
		}

		const disappearing = await hisoka.fetchDisappearingDuration(jid).catch(() => null);
		if (disappearing.length && disappearing[0].disappearing_mode) {
			const data = {
				ephemeralDuration: disappearing[0].disappearing_mode.duration,
				ephemeralSettingTimestamp: +new Date(disappearing[0].disappearing_mode.setAt) / 1000,
			};

			hisoka.contacts.write(jid, { ...contact, ...data });

			return data;
		}

		return { ephemeralDuration: 0 };
	};

	/**
	 * Modify message
	 */
	hisoka.messageModify = async (jid, message, options = {}) => {
		const copyMessage = { ...message };

		let mtype = getContentType(message.message);
		let content = message.message[mtype];

		if (typeof options.text === 'string' || typeof options.text === 'number') {
			if (mtype == 'extendedTextMessage') copyMessage.message[mtype].text = options.text ?? content.text;
			else if (mtype == 'productMessage') copyMessage.message[mtype].body = options.text ?? content.body;
			else if (mtype == 'listMessage') copyMessage.message[mtype].title = options.text ?? content.title;
			else if (mtype == 'locationMessage') copyMessage.message[mtype].name = options.text ?? content.name;
			else if (mtype == 'conversation') {
				mtype = 'extendedTextMessage';
				copyMessage.message[mtype] = { text: options.text };
				delete copyMessage.message.conversation;
			} else copyMessage.message[mtype].caption = options.text ?? content?.caption;
		}

		if (options.mentions || options.contextInfo) {
			if (options?.mentions) {
				let mentionedJid = [];
				let groupMentions = [];

				if (typeof options.mentions === 'string') {
					if (isJidGroup(options.mentions)) options.mentions = [options.mentions];
					else options.mentions = [options.mentions];
				}

				if (typeof options.mentions === 'boolean' && options.mentions) {
					options.mentions = parseMention(options.text || options.caption);
				}

				if (Array.isArray(options.mentions)) {
					options.mentions = options.mentions.map(v => {
						if (typeof v === 'object') {
							const groupJid = v.id || v.groupJid;
							if (isJidGroup(groupJid)) {
								const groupSubject = v.name || v.groupSubject || hisoka.getName(groupJid);
								groupMentions.push({ groupJid, groupSubject });
							} else {
								mentionedJid.push(groupJid);
							}
						}

						if (typeof v === 'string' || typeof v === 'number') {
							if (isJidGroup(v)) {
								groupMentions.push({ groupJid: v, groupSubject: hisoka.getName(v) });
							}

							if (isPnUser(v)) mentionedJid.push(v);
						}
					});
				}

				delete options.mentions;

				copyMessage.message[mtype].contextInfo = {
					...(copyMessage.message[mtype]?.contextInfo || {}),
					mentionedJid,
					groupMentions,
				};
			}

			if (typeof options?.contextInfo === 'object') {
				copyMessage.message[mtype].contextInfo = {
					...(copyMessage.message[mtype]?.contextInfo || {}),
					...options.contextInfo,
				};
			}
		}

		const ephemeral = await hisoka.getEphemeral(jid);
		if (typeof ephemeral.ephemeralDuration === 'number') {
			const data = {};
			const ephemeralExpiration = options.ephemeralExpiration || ephemeral.ephemeralDuration;
			const ephemeralSettingTimestamp = options.ephemeralSettingTimestamp || ephemeral.ephemeralSettingTimestamp;

			if (typeof ephemeralExpiration === 'number') {
				if (typeof ephemeralSettingTimestamp === 'number') {
					data.ephemeralSettingTimestamp = ephemeralSettingTimestamp;
				}

				data.expiration = ephemeralExpiration;
			}

			copyMessage.message[mtype].contextInfo = {
				...(copyMessage.message[mtype]?.contextInfo || {}),
				...data,
			};
		}

		const messageContent = generateWAMessageFromContent(jid, copyMessage.message, options);
		const participant = options?.userJid || copyMessage.key.participant || copyMessage.participant || jid;

		messageContent.messageTimestamp = messageContent.messageTimestamp || Math.floor(Date.now() / 1000);
		messageContent.participant = participant;
		messageContent.isBot = false;

		messageContent.key = messageContent.key;
		messageContent.key.id = generateMessageIDV2(hisoka.user.id);
		messageContent.key.remoteJid = jid || copyMessage.key.remoteJid;
		if (isJidGroup(jid) || isJidStatusBroadcast(jid)) {
			messageContent.key.participant = participant;
		}
		messageContent.key.fromMe = areJidsSameUser(participant, hisoka.user.id);

		return messageContent;
	};

	/**
	 * Resolve Lid to PN
	 */
	hisoka.resolveLidToPN = async key => {
		// From Me
		if (key.fromMe) {
			return jidNormalizedUser(hisoka.user.id);
		}

		// On Private Chat
		if (isLidUser(key.remoteJid)) {
			return jidNormalizedUser(
				key.remoteJidAlt || (await hisoka.signalRepository.lidMapping.getPNForLID(key.remoteJid)) || key.remoteJid
			);
		}

		// On Group Chat
		if (isJidGroup(key.remoteJid)) {
			const jid = jidNormalizedUser(
				key.participantAlt ||
					(await hisoka.signalRepository.lidMapping.getPNForLID(key.participant)) ||
					key.participant
			);

			// If sender is lid, find actual jid from group databse
			if (isLidUser(jid)) {
				let group = await groups.read(key.remoteJid);
				if (!group) {
					group = await hisoka.groupMetadata(key.remoteJid).catch(() => null);
				}

				// Send back jid if group not found
				if (!group || !group.participants.length) return jid;

				// Update group data
				await groups.write(key.remoteJid, group);

				// Find participant by lid or id
				const participant = group.participants.find(p => areJidsSameUser(p.lid, jid) || areJidsSameUser(p.id, jid));

				// Return jid if participant not found
				if (!participant) return jid;

				return jidNormalizedUser(participant.phoneNumber || participant.id);
			}

			return jid;
		}

		if (isLidUser(key.participant)) {
			return jidNormalizedUser(
				key.participantAlt ||
					(await hisoka.signalRepository.lidMapping.getPNForLID(key.participant)) ||
					key.remoteJid
			);
		}

		return jidNormalizedUser(isJidStatusBroadcast(key.remoteJid) ? key.participant : key.remoteJid);
	};

	/**
	 * Modify Relay Message
	 */
	const relayMessage = hisoka.relayMessage;
	hisoka.relayMessage = async (jid, message, options = {}) => {
		return relayMessage.call(hisoka, jid, message, { ...options, messageId: generateMessageIDV2(hisoka.user.id) });
	};

	return hisoka;
}

/**
 *
 * @param {import('../../index').WASocketExtra} hisoka
 * @param {import('../../index').WAMessageExtra} WAMessage
 */
export async function injectMessage(hisoka, WAMessage) {
	const copyMessage = { ...WAMessage };

	if (!WAMessage.message) return copyMessage;

	// Inject Start Message Properties
	await injectStartMessage(hisoka, copyMessage);

	const from = isLidUser(copyMessage.key.remoteJid) ? copyMessage.key.remoteJidAlt : copyMessage.key.remoteJid;
	const getText = (content = {}, message = {}) =>
		content.text ||
		content.conversation ||
		content.caption ||
		content.selectedButtonId ||
		content.singleSelectReply?.selectedRowId ||
		content.selectedId ||
		content.contentText ||
		content.selectedDisplayText ||
		content.title ||
		content.name ||
		message.conversation ||
		'';

	copyMessage.message = parseMessage(WAMessage.message);
	copyMessage.type = getContentType(copyMessage.message) || getContentType(WAMessage.message) || 'conversation';

	// hide content property
	Object.defineProperty(copyMessage, 'content', {
		value: copyMessage.message[copyMessage.type] || WAMessage.message[getContentType(WAMessage.message)] || {},
		enumerable: false,
		writable: false,
	});

	// hide text property
	Object.defineProperty(copyMessage, 'text', {
		value: getText(copyMessage.content, WAMessage.message).trim(),
		enumerable: false,
		writable: false,
	});

	// hide raw property
	Object.defineProperty(copyMessage, 'raw', {
		value: WAMessage.message,
		enumerable: false,
		writable: false,
	});

	copyMessage.isMedia = !!copyMessage.content.mimetype || !!copyMessage.content.thumbnailDirectPath;

	// Inject End Message Properties
	await injectEndMessage(hisoka, copyMessage);

	const quotedID = copyMessage.content?.contextInfo?.stanzaId;
	if (quotedID) {
		copyMessage.isQuoted = true;

		const cacheMsg = hisoka.cacheMsg.get(quotedID);
		if (cacheMsg) {
			copyMessage.quoted = await injectMessage(hisoka, cacheMsg);
		} else {
			copyMessage.quoted = {};

			const participant = jidNormalizedUser(copyMessage.content.contextInfo.participant);
			copyMessage.quoted.key = {
				remoteJid: from,
				fromMe: areJidsSameUser(participant, hisoka.user.id),
				id: quotedID,
			};

			if (isJidGroup(from) && participant) copyMessage.quoted.key.participant = participant;

			// Inject Other Properties
			await injectStartMessage(hisoka, copyMessage.quoted);

			copyMessage.quoted.message =
				parseMessage(copyMessage.content.contextInfo.quotedMessage) ||
				copyMessage.content.contextInfo.quotedMessage ||
				{};
			copyMessage.quoted.type = getContentType(copyMessage.quoted.message) || 'conversation';

			// hide content property
			Object.defineProperty(copyMessage.quoted, 'content', {
				value: copyMessage.quoted.message[copyMessage.quoted.type] || {},
				enumerable: false,
				writable: false,
			});

			// hide text property
			Object.defineProperty(copyMessage.quoted, 'text', {
				value: getText(copyMessage.quoted.content, copyMessage.quoted.message).trim(),
				enumerable: false,
				writable: false,
			});

			// hide raw property
			Object.defineProperty(copyMessage.quoted, 'raw', {
				value: copyMessage.content.contextInfo.quotedMessage || {},
				enumerable: false,
				writable: false,
			});

			copyMessage.quoted.isMedia =
				!!copyMessage.quoted.content.mimetype || !!copyMessage.quoted.content.thumbnailDirectPath;

			// Inject End Message Properties
			await injectEndMessage(hisoka, copyMessage.quoted);
		}
	} else {
		copyMessage.isQuoted = false;
		copyMessage.quoted = null;
	}

	return copyMessage;
}

/**
 *
 * @param {import('../../index').WASocketExtra} hisoka
 * @param {import('../../index').WAMessageExtra} WAMessage
 */
async function injectStartMessage(hisoka, WAMessage) {
	if (WAMessage.key) {
		const from = isLidUser(WAMessage.key.remoteJid) ? WAMessage.key.remoteJidAlt : WAMessage.key.remoteJid;
		const sender = await hisoka.resolveLidToPN(WAMessage.key);
		const isGroup = isJidGroup(from);

		if (isGroup) {
			const group = hisoka.groups.read(from);
			const admins = group?.participants?.filter(v => v.admin) || [];

			Object.defineProperties(WAMessage, {
				isGroupAdmin: {
					value: admins.some(v => areJidsSameUser(v.phoneNumber || v.id, sender)),
					enumerable: false,
					writable: false,
				},
				isGroupBotAdmin: {
					value: admins.some(v => areJidsSameUser(v.phoneNumber || v.id, hisoka.user.id)),
					enumerable: false,
					writable: false,
				},
				isGroupSuperAdmin: {
					value: admins.some(v => v.admin === 'superadmin' && areJidsSameUser(v.phoneNumber || v.id, sender)),
					enumerable: false,
					writable: false,
				},
			});
		}

		Object.defineProperties(WAMessage, {
			from: { value: from, enumerable: false, writable: false },
			sender: { value: sender, enumerable: false, writable: false },
			isPrivate: { value: isPnUser(from) || isLidUser(from), enumerable: false, writable: false },
			isGroup: { value: isGroup, enumerable: false, writable: false },
			status: { value: isJidStatusBroadcast(from), enumerable: false, writable: false },
			isBot: {
				value: WAMessage.key.fromMe && WAMessage.key.id.startsWith('3EB0'),
				enumerable: false,
				writable: false,
			},
			pushName: {
				value: WAMessage.pushName || hisoka.getName(sender),
				enumerable: false,
				writable: false,
			},
		});

		WAMessage.key.fromMe = areJidsSameUser(sender, hisoka.user.id) || WAMessage.key.fromMe;

		// hide isOwner property
		Object.defineProperty(WAMessage, 'isOwner', {
			value:
				process.env.BOT_NUMBER_OWNER.split(',')
					.filter(Boolean)
					.map(x => parseInt(x.trim()))
					.includes(parseInt(sender)) || WAMessage.key.fromMe,
			enumerable: false,
			writable: false,
		});
	}

	return WAMessage;
}

/**
 *
 * @param {import('../../index').WASocketExtra} hisoka
 * @param {import('../../index').WAMessageExtra} WAMessage
 */
async function injectEndMessage(hisoka, WAMessage) {
	const groupMentions = WAMessage.content?.contextInfo?.groupMentions?.map(v => v.groupJid) || [];
	const contactMentions = WAMessage.content?.contextInfo?.mentionedJid || [];
	const statusMentions = WAMessage.statusMentions || WAMessage.statusMentionSources || [];
	const mentions = await Promise.all(
		Array.from(new Set([...groupMentions, ...contactMentions, ...statusMentions])).map(mention => {
			if (isLidUser(mention)) {
				return hisoka.resolveLidToPN({ remoteJid: WAMessage.from, participant: mention }).catch(() => null);
			} else {
				return mention;
			}
		})
	);

	WAMessage.mentions = mentions.map(jidNormalizedUser).filter(Boolean);

	// Implement prefix, command, query properties
	const regPrefix = new RegExp(`^${process.env.BOT_PREFIX || '!'}`);
	const prefix = regPrefix.test(WAMessage.text) ? WAMessage.text.match(regPrefix)[0] : '';
	const afterPrefix = WAMessage.text.replace(regPrefix, '').trim().split(/ +/)[0];
	const allowNoPrefix = process.env.BOT_ALLOWED_NO_PREFIX === 'true' && !prefix;
	const isCommand =
		allowNoPrefix || hisoka.loadedCommands.some(cmd => new RegExp(`^${escapeRegExp(afterPrefix)}`, 'i').test(cmd));
	const query = isCommand
		? WAMessage.text.replace(regPrefix, '').replace(afterPrefix, '').trim()
		: WAMessage.text.trim();

	Object.defineProperties(WAMessage, {
		prefix: { value: prefix, enumerable: false, writable: false },
		command: { value: isCommand ? afterPrefix.toLowerCase() : '', enumerable: false, writable: false },
		query: { value: query, enumerable: false, writable: false },
	});

	WAMessage.downloadMedia = async () => await hisoka.downloadMediaMessage(WAMessage);

	WAMessage.reply = async (text, options = {}) => {
		const toJid = options.toJid || WAMessage.from;
		const ephemeral = await hisoka.getEphemeral(toJid);
		return hisoka.sendMessage(
			toJid,
			typeof text === 'object'
				? {
						...text,
						...options,
				  }
				: { text, ...options },
			{
				quoted: WAMessage,
				ephemeralExpiration: WAMessage.content?.contextInfo?.expiration || ephemeral.expiration,
				...options,
			}
		);
	};

	WAMessage.throw = async (text, params = {}) => {
		text = text
			.replace(/{name}/g, params.name || WAMessage.pushName)
			.replace(/{prefix}/g, params.prefix || WAMessage.prefix)
			.replace(/{command}/g, params.command || WAMessage.command)
			.replace(/{query}/g, params.query || WAMessage.query)
			.replace(/{text}/g, params.text || WAMessage.text)
			.replace(/{sender}/g, params.sender || jidDecode(WAMessage.sender).user)
			.replace(/{botname}/g, params.botname || hisoka.user.name)
			.replace(/{botnumber}/g, params.botnumber || jidDecode(hisoka.user.id).user)
			.replace(/{groupname}/g, params.groupname || (WAMessage.isGroup ? hisoka.getName(WAMessage.from) : ''))
			.replace(/{date}/g, params.date || new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Jakarta' }))
			.replace(/{time}/g, params.time || new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Jakarta' }))
			.replace(/{datetime}/g, params.datetime || new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));

		return WAMessage.reply(text, { mentions: [params.sender || WAMessage.sender, hisoka.user.id] });
	};

	return WAMessage;
}
