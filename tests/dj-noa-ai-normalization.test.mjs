import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeChatText,normalizeVisionText} from '../worker/src/noah/aiNormalization.ts';
test('AI normalization is accent-safe and keeps chat financial dollar signs only',()=>{
 assert.equal(normalizeChatText('PAGÓ $1,200.00'), 'pago $1 200 00');
 assert.equal(normalizeVisionText('PAGÓ $1,200.00'), 'pago 1 200 00');
 assert.equal(normalizeChatText('Señor Álvarez'), 'senor alvarez');
 assert.equal(normalizeVisionText('Señor Álvarez'), 'senor alvarez');
 assert.equal(normalizeVisionText(null),'');
 assert.equal(normalizeVisionText(0),'');
});
test('Noah chat and vision use one core but distinct normalization policies',()=>{
 const chat=readFileSync(new URL('../worker/src/noah/noahChat.ts',import.meta.url),'utf8');
 const image=readFileSync(new URL('../worker/src/noah/noahImage.ts',import.meta.url),'utf8');
 assert.match(chat,/normalizeChatText as normalize/);
 assert.match(image,/normalizeVisionText as normalize/);
 for(const src of [chat,image])assert.doesNotMatch(src,/function normalize\(/);
});
