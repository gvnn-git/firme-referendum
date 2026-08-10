const https = require('https');
const fs = require('fs');
const path = require('path');

const API_URL = 'https://firmereferendum.giustizia.it/referendum/api-portal/iniziativa/public';

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; firmereferendum-aggregator)',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

async function main() {
  console.log('Fetching data from API...');
  const ts = Date.now();
  const response = await fetchJSON(`${API_URL}?v=${ts}`);

  if (response.resultCode !== 0) {
    throw new Error(`API error: ${response.resultDescription}`);
  }

  const raw = response.content;
  console.log(`Got ${raw.length} proposals`);

  const proposals = raw.map(item => ({
    id: item.id,
    estremi: item.estremi,
    titolo: item.titolo,
    titoloBreve: item.titoloLeggeCostituzionale || '',
    descrizioneBreve: item.descrizioneBreve || '',
    categoria: item.idDecCatIniziativa?.nome || '',
    tipo: item.idDecTipoIniziativa?.nome || '',
    tipoId: item.idDecTipoIniziativa?.id || null,
    stato: item.idDecStatoIniziativa?.nome || '',
    statoId: item.idDecStatoIniziativa?.id || null,
    sostenitori: item.sostenitori || 0,
    quorum: item.quorum || 50000,
    dataInizioRaccolta: item.dataInizioRaccolta || null,
    dataFineRaccolta: item.dataFineRaccolta && item.dataFineRaccolta < '9999' ? item.dataFineRaccolta : null,
    dataChiusura: item.dataChiusura && item.dataChiusura < '9999' ? item.dataChiusura : null,
    dataGazzetta: item.dataGazzetta && item.dataGazzetta < '9999' ? item.dataGazzetta : null,
    sito: item.sito || '',
    linkOriginale: `https://firmereferendum.giustizia.it/referendum/open/dettaglio-open/${item.id}`,
  }));

  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const output = {
    updatedAt: new Date().toISOString(),
    total: proposals.length,
    proposals,
  };

  const outPath = path.join(dataDir, 'proposals.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Saved ${proposals.length} proposals to ${outPath}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
