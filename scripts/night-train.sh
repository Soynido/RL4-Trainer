#!/bin/bash

# ===========================================================
# 🧠 RL4 NIGHT TRAINER — Autonomous Overnight Run
# ===========================================================
# Objectif : entraîner le RL4-TRAINER sans intervention humaine,
# avec contrôle mémoire, compaction automatique et relance.
# ===========================================================

WORKSPACE=$(pwd)
MAX_SIZE_GB=9.5
LOG_FILE="$WORKSPACE/logs/night-train.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# Créer dossier logs
mkdir -p logs

echo "🚀 [START] RL4 Night Run — $DATE" | tee -a "$LOG_FILE"

# --- Boucle principale d'entraînement ---
while true; do
  # 1. Vérifie la taille du workspace
  SIZE=$(du -sh "$WORKSPACE" 2>/dev/null | cut -f1 | sed 's/G.*//')
  
  if [ ! -z "$SIZE" ]; then
    if (( $(echo "$SIZE > $MAX_SIZE_GB" | bc -l 2>/dev/null || echo 0) )); then
      echo "⚠️  [$(date '+%H:%M:%S')] Workspace ${SIZE}G > ${MAX_SIZE_GB}G — compactage..." | tee -a "$LOG_FILE"
      npm run compact >> "$LOG_FILE" 2>&1
      npm run auto-dump >> "$LOG_FILE" 2>&1
    fi
  fi

  # 2. Lance un batch d'entraînement
  echo "🧩 [$(date '+%H:%M:%S')] Starting training batch..." | tee -a "$LOG_FILE"
  npm run train >> "$LOG_FILE" 2>&1

  # 3. Consolidation cognitive
  echo "🧠 [$(date '+%H:%M:%S')] Consolidating kernel..." | tee -a "$LOG_FILE"
  npm run consolidate >> "$LOG_FILE" 2>&1

  # 4. Vérifie cohérence
  if [ -f ".reasoning_rl4/kernel/cognitive_state.json" ]; then
    COH=$(jq '.coherence_score' .reasoning_rl4/kernel/cognitive_state.json 2>/dev/null || echo "0")
    FORE=$(jq '.forecast_precision' .reasoning_rl4/kernel/cognitive_state.json 2>/dev/null || echo "0")
    UNIV=$(jq '.universals' .reasoning_rl4/kernel/cognitive_state.json 2>/dev/null || echo "0")
    
    echo "📊 [$(date '+%H:%M:%S')] Kernel: coherence=$COH | forecast=$FORE | universals=$UNIV" | tee -a "$LOG_FILE"
    
    # Vérifier si objectifs atteints
    if (( $(echo "$COH > 0.9" | bc -l 2>/dev/null || echo 0) )) && \
       (( $(echo "$FORE > 0.75" | bc -l 2>/dev/null || echo 0) )) && \
       (( $(echo "$UNIV > 100" | bc -l 2>/dev/null || echo 0) )); then
      
      echo "✅ [SUCCESS] Objectifs atteints. Export du kernel..." | tee -a "$LOG_FILE"
      npm run export-kernel >> "$LOG_FILE" 2>&1
      echo "🏁 RL4 training terminé avec succès." | tee -a "$LOG_FILE"
      exit 0
    fi
  else
    echo "⚠️  [$(date '+%H:%M:%S')] cognitive_state.json non trouvé" | tee -a "$LOG_FILE"
  fi

  # 5. Pause avant relance
  echo "⏳ [$(date '+%H:%M:%S')] Pause 10min avant relance..." | tee -a "$LOG_FILE"
  sleep 600
done

