import * as kuromoji from 'kuromoji';

let tokenizerCache: any = null;
let tokenizerReady: Promise<any> | null = null;

export async function getTokenizer() {
  if (tokenizerCache) return tokenizerCache;
  if (!tokenizerReady) {
    tokenizerReady = new Promise((resolve) => {
      const builder = kuromoji.builder({ dicPath: 'node_modules/kuromoji/dict/' });
      builder.build((err: any, tokenizer: any) => {
        if (err) {
          console.error('kuromoji build error:', err);
          resolve(null);
          return;
        }
        tokenizerCache = tokenizer;
        resolve(tokenizer);
      });
    });
  }
  await tokenizerReady;
  return tokenizerCache;
}

export function toHiragana(tokenizer: any, text: string): string {
  if (!tokenizer || !text) return '';
  try {
    const tokens = tokenizer.tokenize(text);
    return tokens
      .map((t: any) => t.reading ? t.reading.replace(/\p{Script=Katakana}/gu, (c: any) => String.fromCharCode(c.charCodeAt(0) - 0x60)) : t.surface_form)
      .join('');
  } catch {
    return '';
  }
}

