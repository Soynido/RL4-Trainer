import fs from "fs";
import path from "path";

const LEDGER_DIR = ".reasoning_rl4/ledger";
const OUTPUT_DIR = ".reasoning_rl4/diagnostics";

// S'assure que le dossier de sortie existe
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

interface Stats {
  patterns: number;
  correlations: number;
  forecasts: number;
  adrs: number;
}

async function generateSummary() {
  const files = fs
    .readdirSync(LEDGER_DIR)
    .filter(f => f.endsWith(".jsonl") || f.endsWith(".json"))
    .map(f => path.join(LEDGER_DIR, f));

  if (files.length === 0) {
    console.error("❌ Aucun fichier ledger trouvé dans", LEDGER_DIR);
    process.exit(1);
  }

  console.log(`🔍 Lecture de ${files.length} fichiers de ledger...`);

  const globalStats: Stats = { patterns: 0, correlations: 0, forecasts: 0, adrs: 0 };
  let totalRepos = 0;

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, "utf8").trim().split("\n");
      totalRepos++;

      for (const line of content) {
        const obj = JSON.parse(line);
        if (!obj.phase || !obj.stats) continue;

        const stats = obj.stats as Stats;
        globalStats.patterns += stats.patterns || 0;
        globalStats.correlations += stats.correlations || 0;
        globalStats.forecasts += stats.forecasts || 0;
        globalStats.adrs += stats.adrs || 0;
      }
    } catch (e) {
      console.warn(`⚠️ Erreur lecture ${file}:`, (e as Error).message);
    }
  }

  const summary = {
    totalRepos,
    stats: globalStats,
    timestamp: new Date().toISOString(),
  };

  const outFile = path.join(
    OUTPUT_DIR,
    `training-summary-${Date.now()}.json`
  );

  fs.writeFileSync(outFile, JSON.stringify(summary, null, 2));
  console.log("\n✅ Résumé généré :", outFile);
  console.log(
    `   → Repos : ${summary.totalRepos}, Patterns : ${summary.stats.patterns}, Correlations : ${summary.stats.correlations}, Forecasts : ${summary.stats.forecasts}, ADRs : ${summary.stats.adrs}`
  );
}

generateSummary().catch(err => {
  console.error("❌ Erreur lors de la génération :", err);
  process.exit(1);
});

