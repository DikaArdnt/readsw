import fs from 'fs';
import path from 'path';

export class JSONDB {
	/**
	 * A simple JSON database class that handles reading, writing, and caching of JSON data.
	 * @type {Object<string, any>}
	 */
	cache = {};

	/**
	 * The last time the database was loaded.
	 * @type {boolean}
	 */
	hasLoaded = false;

	/**
	 * The file path where the JSON data is stored.
	 * @type {string}
	 */
	filePath = '';

	/**
	 * @param {string} fileName
	 * @param {string|null} dir
	 */
	constructor(fileName, dir = null) {
		if (!dir) {
			throw new Error('Directory path must be specified');
		}

		this.filePath = path.join(dir, fileName + '.json');
		this.cache = {};

		if (!fs.existsSync(path.dirname(this.filePath))) {
			fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
		}
	}

	/**
	 * Load the database from the JSON file.
	 * @returns {void}
	 */
	load() {
		try {
			if (!fs.existsSync(this.filePath)) {
				this.cache = {};
				fs.writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2), 'utf-8');
				return;
			}

			const bytes = fs.readFileSync(this.filePath, 'utf-8');
			if (bytes.length > 0) {
				this.cache = JSON.parse(bytes);
			} else {
				this.cache = {};
			}
		} catch (err) {
			if (err.code === 'ENOENT') {
				this.cache = {};
			} else {
				throw err;
			}
		}

		this.hasLoaded = true;
	}

	/**
	 * Load the database if it hasn't been loaded yet
	 * @returns {void}
	 */
	loadIfNeeded() {
		if (!this.hasLoaded) {
			this.load();
		}
	}

	/**
	 * Check if a key exists in the database.
	 * @param {string} key
	 * @returns {boolean}
	 */
	exists(key) {
		if (!this.hasLoaded) {
			// Reload every 5 minutes
			this.load();
		}
		return Object.prototype.hasOwnProperty.call(this.cache, key);
	}

	/**
	 * Read a value from the database.
	 * @param {string} key
	 * @returns {any}
	 */
	read(key) {
		this.loadIfNeeded();
		if (!this.exists(key)) {
			return null;
		}

		return this.cache[key];
	}

	/**
	 * Write a value to the database.
	 * @param {string} key
	 * @param {any} value
	 */
	write(key, value) {
		this.loadIfNeeded();
		this.cache[key] = value;
		const data = JSON.stringify(this.cache, null, 2);
		fs.writeFileSync(this.filePath, data, 'utf-8');
		return value;
	}

	/**
	 * Delete a value from the database.
	 * @param {string} key
	 */
	delete(key) {
		this.loadIfNeeded();
		delete this.cache[key];
		const data = JSON.stringify(this.cache, null, 2);
		fs.writeFileSync(this.filePath, data, 'utf-8');
	}

	/**
	 * Get all keys in the database.
	 * @returns {string[]}
	 */
	keys() {
		this.loadIfNeeded();
		return Object.keys(this.cache);
	}

	/**
	 * Get all values in the database.
	 * @returns {any[]}
	 */
	values() {
		this.loadIfNeeded();
		return Object.values(this.cache);
	}

	/**
	 * Get all entries in the database.
	 * @returns {Array<[string, any]>}
	 */
	entries() {
		this.loadIfNeeded();
		return Object.entries(this.cache);
	}

	/**
	 * Find all keys that match a given predicate function.
	 * @param {(value: any) => boolean} predicate
	 * @returns {Object}
	 */
	find(predicate) {
		this.loadIfNeeded();
		return this.values().find(predicate);
	}
}

export default JSONDB;
