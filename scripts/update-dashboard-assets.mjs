import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const html = fs.readFileSync(path.join(rootDir, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(rootDir, 'public', 'style.css'), 'utf8');
const js = fs.readFileSync(path.join(rootDir, 'public', 'app.js'), 'utf8');

const htmlB64 = Buffer.from(html, 'utf8').toString('base64');
const cssB64 = Buffer.from(css, 'utf8').toString('base64');
const jsB64 = Buffer.from(js, 'utf8').toString('base64');

const output = `export const DASHBOARD_HTML = Buffer.from('${htmlB64}', 'base64').toString('utf-8');
export const DASHBOARD_CSS = Buffer.from('${cssB64}', 'base64').toString('utf-8');
export const DASHBOARD_JS = Buffer.from('${jsB64}', 'base64').toString('utf-8');
`;

fs.writeFileSync(path.join(rootDir, 'src', 'dashboardAssets.ts'), output, 'utf8');
console.log('Successfully regenerated src/dashboardAssets.ts');
