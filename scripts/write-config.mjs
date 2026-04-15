import fs from 'node:fs';
import path from 'node:path';

const config = {
    apiBase: process.env.apiBase || '/api/v1',
    mobilesentrixUrl: process.env.mobilesentrixUrl || '',
    mobilesentrixConsumerKey: process.env.mobilesentrixConsumerKey || '',
    mobilesentrixConsumerSecret: process.env.mobilesentrixConsumerSecret || '',
    mobilesentrixConsumerName: process.env.mobilesentrixConsumerName || '',
};

const outPath = path.resolve('public/config.json');

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(config, null, 2));
console.log(`Wrote ${outPath}`);