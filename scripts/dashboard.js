#!/usr/bin/env node

/**
 * 📊 RL4 Trainer — Training Dashboard
 * Agrège les métriques des runs successifs depuis .reasoning_rl4/diagnostics/
 * et affiche les tendances patterns / correlations / forecasts / ADRs / temps moyen.
 */

import fs from "fs";
import path from "path";
import chalk from "chalk";

const DIAG_DIR = ".reasoning_rl4/diagnostics";

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function pct(delta, base) {
  if (!base || base === 0) return "–";
  const val = ((delta / base) * 100).toFixed(1);
  return (val >= 0 ? "+" : "") + val + "%";
}

function trend(delta) {
  if (delta > 0) return "📈";
  if (delta < 0) return "📉";
  return "⚖️";
}

function summarize(run) {
  // Calculer les totaux depuis les résultats de repos
  let patterns = 0;
  let correlations = 0;
  let forecasts = 0;
  let adrs = 0;
  let totalDuration = 0;
  let successCount = 0;

  if (run.results && Array.isArray(run.results)) {
    for (const result of run.results) {
      if (result.success && result.stats) {
        patterns += result.stats.patterns || 0;
        correlations += result.stats.correlations || 0;
        forecasts += result.stats.forecasts || 0;
        adrs += result.stats.adrs || 0;
        totalDuration += result.stats.duration_ms || 0;
        successCount++;
      }
    }
  }

  const avgCycle = successCount > 0 ? Math.round(totalDuration / successCount) : 0;

  return {
    time: run.endTime || run.startTime || "unknown",
    patterns,
    correlations,
    forecasts,
    adrs,
    avgCycle,
    repos: run.successful || run.totalRepos || 0,
    duration: run.totalDuration_ms || 0,
  };
}

function formatRow(name, cur, prev) {
  const delta = cur - prev;
  const t = trend(delta);
  return `${name.padEnd(15)} ${String(cur).padStart(8)}  ${chalk.gray(pct(delta, prev).padStart(8))}  ${t}`;
}

function main() {
  if (!fs.existsSync(DIAG_DIR)) {
    console.error(chalk.red("❌ No diagnostics directory found."));
    process.exit(1);
  }

  const files = fs
    .readdirSync(DIAG_DIR)
    .filter(f => f.startsWith("training-summary-") && f.endsWith(".json"))
    .map(f => path.join(DIAG_DIR, f))
    .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);

  if (files.length < 1) {
    console.log(chalk.yellow("⚠️  No training-summary files found."));
    return;
  }

  const runs = files.map(readJSON).filter(Boolean).map(summarize);
  const latest = runs[runs.length - 1];
  const previous = runs[runs.length - 2] || latest;

  console.log(chalk.bold("\n📊 RL4 Training Dashboard"));
  console.log(chalk.gray("=".repeat(60)));
  console.log(`${chalk.cyan("Runs total:")} ${runs.length}`);
  console.log(`${chalk.cyan("Last run:")} ${latest.time}`);
  console.log(`${chalk.cyan("Repositories:")} ${latest.repos}`);
  console.log(chalk.gray("-".repeat(60)));
  console.log(formatRow("Patterns", latest.patterns, previous.patterns));
  console.log(formatRow("Correlations", latest.correlations, previous.correlations));
  console.log(formatRow("Forecasts", latest.forecasts, previous.forecasts));
  console.log(formatRow("ADRs", latest.adrs, previous.adrs));
  console.log(formatRow("AvgCycleTime", latest.avgCycle, previous.avgCycle));
  console.log(chalk.gray("-".repeat(60)));

  const efficiency = latest.repos > 0 ? (latest.patterns / latest.repos).toFixed(1) : "0.0";
  console.log(`${chalk.green("🧠 Cognitive density:")} ${efficiency} patterns/repo`);
  
  const correlationRatio = latest.patterns > 0 ? (latest.correlations / latest.patterns).toFixed(2) : "0.00";
  console.log(`${chalk.green("🔗 Correlation rate:")} ${correlationRatio} correlations/pattern`);
  
  console.log(chalk.gray("=".repeat(60)));

  // Optional export
  const OUT = path.join(".reasoning_rl4/metrics/dashboard-latest.json");
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ latest, previous, runs }, null, 2));
  console.log(`\n💾 Saved summary to ${chalk.cyan(OUT)}\n`);
}

main();

