#!/bin/bash

# Monitoring simple de la progression

echo "🚀 RL4-TRAINER - PROGRESSION BATCH 1000"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Vérifier le dernier summary
LATEST_SUMMARY=$(ls -t .reasoning_rl4/diagnostics/training-summary-*.json 2>/dev/null | head -1)

if [ -n "$LATEST_SUMMARY" ]; then
    TOTAL=$(cat "$LATEST_SUMMARY" | jq -r '.totalRepos')
    SUCCESS=$(cat "$LATEST_SUMMARY" | jq -r '.successful')
    FAILED=$(cat "$LATEST_SUMMARY" | jq -r '.failed')
    DURATION_MS=$(cat "$LATEST_SUMMARY" | jq -r '.totalDuration_ms')
    
    # Calculer le pourcentage
    PROGRESS=$((SUCCESS * 100 / TOTAL))
    
    # Barre de progression
    FILLED=$((PROGRESS / 2))
    EMPTY=$((50 - FILLED))
    printf "📊 PROGRESSION: ["
    printf "█%.0s" $(seq 1 $FILLED 2>/dev/null)
    printf "░%.0s" $(seq 1 $EMPTY 2>/dev/null)
    printf "] $PROGRESS%%\n\n"
    
    echo "  Repos traités: $SUCCESS / $TOTAL"
    echo "  Succès: $SUCCESS ✓"
    echo "  Échecs: $FAILED"
    echo ""
    
    # Vitesse moyenne
    if [ $SUCCESS -gt 0 ] && [ "$DURATION_MS" != "null" ] && [ $DURATION_MS -gt 0 ]; then
        AVG_MS=$((DURATION_MS / SUCCESS))
        AVG_SEC=$(echo "scale=2; $AVG_MS / 1000" | bc)
        echo "  Vitesse moyenne: ${AVG_SEC}s/repo"
        
        # ETA
        REMAINING=$((TOTAL - SUCCESS))
        if [ $REMAINING -gt 0 ]; then
            ETA_SEC=$(echo "scale=0; $REMAINING * $AVG_SEC" | bc)
            ETA_MIN=$((ETA_SEC / 60))
            echo "  Temps restant estimé: ~${ETA_MIN} minutes"
        fi
    fi
    
    echo ""
    
    # Stockage
    LEDGER_SIZE=$(du -sh .reasoning_rl4/ 2>/dev/null | cut -f1)
    echo "💾 Stockage: $LEDGER_SIZE"
    echo ""
    
    # Métriques cognitives
    TOTAL_PATTERNS=$(cat "$LATEST_SUMMARY" | jq '[.results[].stats.patterns] | add' 2>/dev/null)
    TOTAL_FORECASTS=$(cat "$LATEST_SUMMARY" | jq '[.results[].stats.forecasts] | add' 2>/dev/null)
    TOTAL_ADRS=$(cat "$LATEST_SUMMARY" | jq '[.results[].stats.adrs] | add' 2>/dev/null)
    
    if [ "$TOTAL_PATTERNS" != "null" ]; then
        echo "🧠 QUALITÉ COGNITIVE"
        echo "  Patterns: $TOTAL_PATTERNS"
        echo "  Forecasts: $TOTAL_FORECASTS"
        echo "  ADRs: $TOTAL_ADRS"
    fi
    
else
    echo "⏳ En attente du démarrage..."
    echo ""
    echo "  Process actif: $(ps aux | grep trainBatch | grep -v grep | wc -l)"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"

