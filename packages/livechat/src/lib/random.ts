import * as crypto from 'crypto-js';

const UNMISTAKABLE_CHARS = '23456789ABCDEFGHJKLMNPQRSTWXYZabcdefghijkmnopqrstuvwxyz';

const fraction = () => {
	const array = new Uint32Array(1);
	window.crypto.getRandomValues(array);
	return array[0] * 2.3283064365386963e-10;
};

export const chooseElement = (arrayOrString: string | string[]) => {
	const index = Math.floor(fraction() * arrayOrString.length);

	if (typeof arrayOrString === 'string') {
		return arrayOrString.slice(index, index + 1);
	}

	return arrayOrString[index];
};

export const createRandomString = (charsCount: number, alphabet: string | string[]) =>
	Array.from({ length: charsCount }, () => chooseElement(alphabet)).join('');

export const createRandomId = (charsCount = 17) => createRandomString(charsCount, UNMISTAKABLE_CHARS);

export const createToken = () => crypto.lib.WordArray.random(32).toString(crypto.enc.Hex);
