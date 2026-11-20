import './check-node.mjs';
// Set this before importing Vite: the desktop terminal can inherit development mode.
process.env.NODE_ENV = 'production';
await import('./static-catalog.mjs');
const { build } = await import('vite');
await build({ mode: 'production' });
