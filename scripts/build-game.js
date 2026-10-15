import { cpSync, mkdirSync, rmSync } from 'node:fs';
// The output is plain HTML, CSS, and browser-native JavaScript modules.
rmSync(new URL('../dist-game', import.meta.url), { recursive:true, force:true });
mkdirSync(new URL('../dist-game', import.meta.url));
cpSync(new URL('../game/', import.meta.url), new URL('../dist-game/', import.meta.url), { recursive:true });
console.log('Static game ready in dist-game/');
