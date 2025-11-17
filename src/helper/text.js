export const isNumber = value => {
	value = Number(value);
	return !isNaN(value) && typeof value === 'number';
};

export const toLower = (text = '') => text.toLowerCase().trim();
export const toUpper = (text = '') => text.toUpperCase().trim();
export const toCapitalize = (text = '') => text.charAt(0).toUpperCase() + text.slice(1).trim();
export const toCapitalizeWords = (text = '') =>
	text
		.replace(/([a-z])([A-Z])/g, '$1 $2') // Add space before capital letters in camelCase
		.replace(/\b([A-Z]{2,})\b/g, word => word) // Keep consecutive uppercase letters unchanged
		.replace(/\b[a-z]/g, char => char.toUpperCase()) // Capitalize the first letter of each word
		.trim();
export const toCapitalizeSentence = (text = '') => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase().trim();
export const toCapitalizeParagraph = (text = '') =>
	text.replace(/(^\w{1}|\.\s+\w{1})/gi, char => char.toUpperCase()).trim();
export const separateWords = text => toCapitalize(text.replace(/([A-Z]+[a-z0-9])/g, ' $1').trim()).trim();

/**
 * Util for formatting JS date object to human readable date
 * @param date JS Date Object that will formatted
 * @returns Human readable date string
 */
export const df = date =>
	new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'long' }).format(date).replace(/\./g, ':');
