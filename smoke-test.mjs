import fs from 'node:fs';
for (const file of ['index.html','styles.css','app.js','api.js','config.js']) {
  if (!fs.existsSync(new URL(`./${file}`, import.meta.url))) throw new Error(`Missing ${file}`);
}
const html=fs.readFileSync(new URL('./index.html', import.meta.url),'utf8');
for (const ref of ['./styles.css','./config.js','./app.js']) if(!html.includes(ref)) throw new Error(`index.html missing ${ref}`);
const app=fs.readFileSync(new URL('./app.js', import.meta.url),'utf8');
for (const feature of ['startSearch','selectJourney','submitCheckout','lookupBooking','cancelBooking']) if(!app.includes(feature)) throw new Error(`Missing feature ${feature}`);
console.log('Frontend smoke test: PASS');
