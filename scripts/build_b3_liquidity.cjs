const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: fs.createReadStream('public/data/b3_trades_recent.csv'),
  crlfDelay: Infinity
});

let isHeader = true;
const summary = {};

rl.on('line', (line) => {
  if (isHeader) {
    isHeader = false;
    return;
  }
  if (!line || !line.trim()) return;
  const parts = line.split(',');
  const date = parts[0]?.trim();
  const ticker = parts[1]?.trim();

  if (!ticker || !date) return;

  if (!summary[ticker]) {
    summary[ticker] = {
      dates: new Set(),
      last_date: date,
      trades: 0,
      vol: 0
    };
  }
  summary[ticker].dates.add(date);
  if (date > summary[ticker].last_date) {
    summary[ticker].last_date = date;
  }
  summary[ticker].trades += parseFloat(parts[7]) || 0;
  summary[ticker].vol += parseFloat(parts[9]) || 0;
});

rl.on('close', () => {
  const result = {};
  for (const ticker in summary) {
    result[ticker] = {
      dias: summary[ticker].dates.size,
      last_date: summary[ticker].last_date,
      trades: Math.round(summary[ticker].trades),
      vol: Math.round(summary[ticker].vol)
    };
  }
  fs.writeFileSync('public/data/b3_liquidity_summary.json', JSON.stringify(result));
  console.log(`Saved b3_liquidity_summary.json with ${Object.keys(result).length} tickers`);
});
