import {
	WASocket,
	WAMessage,
	MessageGenerationOptionsFromContent,
	AnyMessageContent,
	MiscMessageGenerationOptions,
	proto,
	WAMessageContent,
	GroupMetadata,
	Contact,
	WAMessageKey,
} from 'baileys';

import JSONDB from './src/db/json.js';

type ContactData = Contact & {
	ephemeralDuration?: number;
	ephemeralSettingTimestamp?: number;
	isContact?: boolean;
	isBlocked?: boolean;
};

export class Groups {
	exists(key: string): boolean;
	read(key: string): GroupMetadata;
	write(key: string, value: GroupMetadata): GroupMetadata;
	delete(key: string): void;
	find(callback: (item: GroupMetadata) => boolean): GroupMetadata;
	keys(): string[];
	values(): GroupMetadata[];
	entries(): Array<[string, GroupMetadata]>;
}

export class Contacts {
	exists(key: string): boolean;
	read(key: string): ContactData;
	write(key: string, value: ContactData): ContactData;
	delete(key: string): void;
	find(callback: (item: ContactData) => boolean): ContactData;
	keys(): string[];
	values(): ContactData[];
	entries(): Array<[string, ContactData]>;
}

export interface WASocketExtra extends WASocket {
	cacheMsg: Map<string, WAMessage>;
	contacts: Contacts;
	groups: Groups;
	settings: JSONDB;
	loadedCommands: string[];
	downloadMediaMessage: (message: WAMessage) => Promise<Buffer>;
	getName: (jid: string, nameContact: boolean) => string;
	getEphemeral: (jid: string) => Promise<{
		ephemeralSettingTimestamp?: number;
		ephemeralDuration: number;
	}>;
	resolveLidToPN: (key: WAMessageKey) => Promise<string>;
	messageModify: (
		jid: string,
		message: WAMessage,
		options: MessageGenerationOptionsFromContent & { text?: string | number; mentions?: string[] }
	) => Promise<WAMessage & { isBot: false }>;
}

export interface WAMessageExtra extends WAMessage {
	from: string;
	sender: string;
	isPrivate: boolean;
	isGroup: boolean;
	isGroupAdmin: boolean;
	isGroupBotAdmin: boolean;
	isGroupSuperAdmin: boolean;
	isBot: boolean;
	isOwner: boolean;
	isQuoted: boolean;
	isMedia: boolean;
	type: keyof WAMessageContent;
	content: WAMessageContent[keyof WAMessageContent];
	text: string;
	prefix: string;
	command: string;
	query: string;
	mentions: string[];
	quoted: WAMessageExtra;
	raw: proto.IMessage;
	downloadMedia: () => Promise<Buffer>;
	reply: (
		text: string | AnyMessageContent,
		options?: MiscMessageGenerationOptions & AnyMessageContent & { toJid?: string }
	) => Promise<WAMessageExtra>;
	throw: (
		text: string,
		params: {
			name?: string;
			prefix?: string;
			command?: string;
			query?: string;
			text?: string;
			sender?: string;
			botname?: string;
			botnumber?: string;
			groupname?: string;
			date?: string;
			time?: string;
			datetime?: string;
		}
	) => Promise<void>;
}
