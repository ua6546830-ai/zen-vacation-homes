import './check-node.mjs';
import { writeFile } from 'node:fs/promises';
import { listings } from '../functions/catalog.ts';

process.env.NODE_ENV = 'production';
const target = new URL('../public/catalog.json', import.meta.url);
await writeFile(target, `${JSON.stringify({ properties: listings })}\n`);
console.log(`Wrote public/catalog.json (${listings.length} demo properties)`);
