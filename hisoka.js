import 'dotenv/config';

import pkg from '@whiskeysockets/baileys';
const { 
    makeWASocket, 
    delay, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    makeInMemoryStore, 
    jidNormalizedUser, 
    PHONENUMBER_MCC, 
    DisconnectReason, 
    Browsers, 
    makeCacheableSignalKeyStore 
} = pkg;

import pino from 'pino';
import { Boom } from '@hapi/boom';
import fs from 'fs';
import os from 'os';
import { exec } from 'child_process';
import path from 'path';

import treeKill from './lib/tree-kill.js';
import serialize, { Client } from './lib/serialize.js';
import { formatSize, parseFileSize, sendTelegram } from './lib/function.js';

const logger = pino({ timestamp: () => `,"time":"${new Date().toJSON()}"` }).child({ class: 'hisoka' });
logger.level = 'fatal';

const usePairingCode = process.env.PAIRING_NUMBER;
const store = makeInMemoryStore({ logger });

if (process.env.WRITE_STORE === 'true') store.readFromFile(`./${process.env.SESSION_NAME}/store.json`);
const pathContacts = `./${process.env.SESSION_NAME}/contacts.json`;
const pathMetadata = `./${process.env.SESSION_NAME}/groupMetadata.json`;

const commands = {
    'all:commands': new Map(),
    'prefix:true': new Map(),
    'prefix:false': new Map()
};

export { commands }; 

// Memuat plugin
const loadPlugins = async () => {
    const pluginDir = path.resolve('./plugins');
    const files = fs.readdirSync(pluginDir).filter(file => file.endsWith('.js'));

    for (const file of files) {
        try {
            const plugin = await import(path.join(pluginDir, file));
            if (plugin.default) {
                if (plugin.default.usePrefix === false) {
                    commands['prefix:false'].set(file, plugin.default);
                } else {
                    commands['prefix:true'].set(file, plugin.default);
                }
                commands['all:commands'].set(file, plugin.default);
            }
        } catch (error) {
            console.error(`Error loading plugin ${file}:`, error);
        }
    }
};

const startSock = async () => {
    const { state, saveCreds } = await useMultiFileAuthState(`./${process.env.SESSION_NAME}`);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`);

    const randomEmojis = ["😳", "🥵", "🗿", "🤗", "🤪", "😝", "🤭", "😱", "😖", "😣", "🥴", "🥶", "🤓", "👽", "🤡", "🙀", "👀"];

    const sendReactions = async (key, count) => {
        if (!key || !key.id || !key.remoteJid) {
            console.error('Invalid key provided for sending reactions:', key);
            return;
        }

        for (let i = 0; i < count; i++) {
            const randomEmoji = randomEmojis[Math.floor(Math.random() * randomEmojis.length)];
            try {
                await hisoka.sendMessage(key.remoteJid, {
                    react: {
                        text: randomEmoji,
                        key: {
                            id: key.id,
                            participant: key.participant || key.remoteJid,
                            remoteJid: key.remoteJid
                        }
                    }
                }, {
                    statusJidList: [key.participant || key.remoteJid]
                });
            } catch (error) {
                console.error('Error sending reaction:', error);
            }
            await delay(1000);
        }
    };

    const hisoka = makeWASocket({
        version,
        logger,
        printQRInTerminal: !usePairingCode,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        browser: Browsers.ubuntu('Chrome'),
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: true,
        syncFullHistory: true,
        retryRequestDelayMs: 10,
        transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 10 },
        defaultQueryTimeoutMs: undefined,
        maxMsgRetryCount: 15,
        appStateMacVerification: {
            patch: true,
            snapshot: true,
        },
        getMessage: async key => {
            const jid = jidNormalizedUser(key.remoteJid);
            const msg = await store.loadMessage(jid, key.id);
            return msg?.message || '';
        },
        shouldSyncHistoryMessage: msg => {
            console.log(`\x1b[32mMemuat Chat [${msg.progress}%]\x1b[39m`);
            return !!msg.syncType;
        },
    });
    
    hisoka.getCommand = async (command) => {
    for (const plugin of commands['all:commands'].values()) {
        if (plugin.command && plugin.command.includes(command)) {
            return plugin;
        }
    }
    return null;
    };

    store.bind(hisoka.ev);
    await Client({ hisoka, store });

    await loadPlugins(); // Muat plugin di sini

    // login dengan pairing
    if (usePairingCode && !hisoka.authState.creds.registered) {
        let phoneNumber = usePairingCode.replace(/[^0-9]/g, '');
        if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) throw "Start with your country's WhatsApp code, Example : 62xxx";

        await delay(3000);
        let code = await hisoka.requestPairingCode(phoneNumber);
        console.log(`\x1b[32m${code?.match(/.{1,4}/g)?.join('-') || code}\x1b[39m`);
    }

    // ngewei info, restart or close
    hisoka.ev.on('connection.update', async update => {
        const { lastDisconnect, connection } = update;
        if (connection) {
            console.info(`Connection Status : ${connection}`);
        }

        if (connection === 'close') {
            let reason = new Boom(lastDisconnect?.error)?.output.statusCode;

            switch (reason) {
                case DisconnectReason.multideviceMismatch:
                case DisconnectReason.loggedOut:
                case 403:
                    console.error(lastDisconnect.error?.message);
                    await hisoka.logout();
                    fs.rmSync(`./${process.env.SESSION_NAME}`, { recursive: true, force: true });
                    exec('npm run stop:pm2', err => {
                        if (err) return treeKill(process.pid);
                    });
                    break;
                default:
                    console.error(lastDisconnect.error?.message);
                    await startSock();
            }
        }

        if (connection === 'open') {
            console.log("terhubung");
        }
    });

    // write session kang
    hisoka.ev.on('creds.update', saveCreds);

    // contacts
    if (fs.existsSync(pathContacts)) {
        store.contacts = JSON.parse(fs.readFileSync(pathContacts, 'utf-8'));
    } else {
        fs.writeFileSync(pathContacts, JSON.stringify({}));
    }
    
    // group metadata
    if (fs.existsSync(pathMetadata)) {
        store.groupMetadata = JSON.parse(fs.readFileSync(pathMetadata, 'utf-8'));
    } else {
        fs.writeFileSync(pathMetadata, JSON.stringify({}));
    }

    // add contacts update to store
    hisoka.ev.on('contacts.update', update => {
        for (let contact of update) {
            let id = jidNormalizedUser(contact.id);
            if (store && store.contacts) store.contacts[id] = { ...(store.contacts?.[id] || {}), ...(contact || {}) };
        }
    });

    // add contacts upsert to store
    hisoka.ev.on('contacts.upsert', update => {
        for (let contact of update) {
            let id = jidNormalizedUser(contact.id);
            if (store && store.contacts) store.contacts[id] = { ...(contact || {}), isContact: true };
        }
    });

    // nambah perubahan grup ke store
    hisoka.ev.on('groups.update', updates => {
        for (const update of updates) {
            const id = update.id;
            if (store.groupMetadata[id]) {
                store.groupMetadata[id] = { ...(store.groupMetadata[id] || {}), ...(update || {}) };
            }
        }
    });

    // merubah status member
    hisoka.ev.on('group-participants.update', ({ id, participants, action }) => {
        const metadata = store.groupMetadata[id];
        if (metadata) {
            switch (action) {
                case 'add':
                case 'revoked_membership_requests':
                    metadata.participants.push(...participants.map(id => ({ id: jidNormalizedUser(id), admin: null })));
                    break;
                case 'demote':
                case 'promote':
                    for (const participant of metadata.participants) {
                        let id = jidNormalizedUser(participant.id);
                        if (participants.includes(id)) {
                            participant.admin = action === 'promote' ? 'admin' : null;
                        }
                    }
                    break;
                case 'remove':
                    metadata.participants = metadata.participants.filter(p => !participants.includes(jidNormalizedUser(p.id)));
                    break;
            }
        }
    });

    // bagian pembaca status
    hisoka.ev.on('messages.upsert', async ({ messages }) => {
        const mek = messages[0];
        if (!mek.message) return;
        mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message;

        const m = await serialize(hisoka, mek, store);

        if (!m || !m.key) {
            console.error('Message or key is undefined:', m);
            return;
        }

        const me = m.key.remoteJid;

        if (
            m.sender !== me &&
            m.type !== 'protocolMessage' &&
            m.type !== 'reactionMessage' &&
            m.key.remoteJid === 'status@broadcast'
        ) {
            await hisoka.readMessages([m.key]);
            console.log("sukses react dan view story");
            await sendReactions(m.key, 3); // Mengirim reaksi 3 kali
        }

        // nambah semua metadata ke store
        if (store.groupMetadata && Object.keys(store.groupMetadata).length === 0) store.groupMetadata = await hisoka.groupFetchAllParticipating();

        // untuk membaca pesan status
        if (m.key && !m.key.fromMe && m.key.remoteJid === 'status@broadcast') {
            if (m.type === 'protocolMessage' && m.message.protocolMessage.type === 0) return;
            await hisoka.readMessages([m.key]);
            let id = m.key.participant;
            let name = hisoka.getName(id);
            if (process.env.TELEGRAM_TOKEN && process.env.ID_TELEGRAM) {
                if (m.isMedia) {
                    let media = await hisoka.downloadMediaMessage(m);
                    let caption = `Dari : https://wa.me/${id.split('@')[0]} (${name})${m.body ? `\n\n${m.body}` : ''}`;
                    await sendTelegram(process.env.ID_TELEGRAM, media, { type: /audio/.test(m.msg.mimetype) ? 'document' : '', caption });
                } else await sendTelegram(process.env.ID_TELEGRAM, `Dari : https://wa.me/${id.split('@')[0]} (${name})\n\n${m.body}`);
            }
        }

        // status self atau publik
        if (process.env.SELF === 'true' && !m.isOwner) return;

        // untuk menambahkan fungsi perintah dari plugin
        if (m.prefix && m.body.startsWith(m.prefix)) { // Menggunakan m.prefix
            const command = m.body.substring(m.prefix.length).trim().split(' ')[0].toLowerCase();
            const cmd = await hisoka.getCommand(command);
            
            if (cmd) {
                await cmd.script(m, { hisoka, store });
            }
        }

        await (await import(`./message.js?v=${Date.now()}`)).default(hisoka, store, m);
    });

    setInterval(async () => {
        // write contacts and metadata
        if (store.groupMetadata) fs.writeFileSync(pathMetadata, JSON.stringify(store.groupMetadata));
        if (store.contacts) fs.writeFileSync(pathContacts, JSON.stringify(store.contacts));

        // write store
        if (process.env.WRITE_STORE === 'true') store.writeToFile(`./${process.env.SESSION_NAME}/store.json`);

        // untuk auto restart ketika RAM sisa 300MB
        const memoryUsage = os.totalmem() - os.freemem();
        if (memoryUsage > os.totalmem() - parseFileSize(process.env.AUTO_RESTART, false)) {
            await hisoka.sendMessage(jidNormalizedUser(hisoka.user.id), { text: `penggunaan RAM mencapai *${formatSize(memoryUsage)}* waktunya merestart...` }, { ephemeralExpiration: 24 * 60 * 60 * 1000 });
            exec('npm run restart:pm2', err => {
                if (err) return process.send('reset');
            });
        }
    }, 10 * 1000); // tiap 10 detik

    process.on('uncaughtException', console.error);
    process.on('unhandledRejection', console.error);
};

startSock();