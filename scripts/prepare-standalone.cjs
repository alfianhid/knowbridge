// Reproduce Docker's runtime asset layout for local standalone browser checks.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
fs.cpSync(path.join(root, '.next/static'), path.join(root, '.next/standalone/.next/static'), { recursive: true });
fs.cpSync(path.join(root, 'public'), path.join(root, '.next/standalone/public'), { recursive: true });
