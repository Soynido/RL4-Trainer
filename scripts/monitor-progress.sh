#!/bin/bash

# Script de monitoring en temps réel du batch RL4-Trainer

TARGET_REPOS=${1:-1000}
REFRESH_INTERVAL=5

echo "🚀 Monitoring Batch RL4-Trainer - $TARGET_REPOS repos"
echo "═══════════════════════════════════════════════════════════"
echo ""

START_TIME=$(date +%s)
LAST_SUMMARY=""

while true; do
    clear
    echo "🚀 RL4-TRAINER - MONITORING TEMPS RÉEL"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    
    # Temps écoulé
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))
    MINUTES=$((ELAPSED / 60))
    SECONDS=$((ELAPSED % 60))
    
    echo "⏱️  Temps écoulé: ${MINUTES}min ${SECONDS}s"
    echo ""
    
    # Vérifier le dernier summary
    LATEST_SUMMARY=$(ls -t .reasoning_rl4/diagnostics/training-summary-*.json 2>/dev/null | head -1)
    
    if [ -n "$LATEST_SUMMARY" ] && [ "$LATEST_SUMMARY" != "$LAST_SUMMARY" ]; then
        LAST_SUMMARY=$LATEST_SUMMARY
        
        # Extraire les métriques
        TOTAL=$(cat "$LATEST_SUMMARY" | jq -r '.totalRepos')
        SUCCESS=$(cat "$LATEST_SUMMARY" | jq -r '.successful')
        FAILED=$(cat "$LATEST_SUMMARY" | jq -r '.failed')
        DURATION_MS=$(cat "$LATEST_SUMMARY" | jq -r '.totalDuration_ms')
        
        # Calculer le pourcentage
        PROGRESS=$((SUCCESS * 100 / TOTAL))
        
        # Barre de progression
        FILLED=$((PROGRESS / 2))
        EMPTY=$((50 - FILLED))
        BAR=$(printf "█%.0s" $(seq 1 $FILLED))$(printf "░%.0s" $(seq 1 $EMPTY))
        
        echo "📊 PROGRESSION"
        echo "  [$BAR] $PROGRESS%"
        echo ""
        echo "  Repos traités: $SUCCESS / $TOTAL"
        echo "  Succès: $SUCCESS ✓"
        echo "  Échecs: $FAILED"
        echo ""
        
        # Vitesse moyenne
        if [ $SUCCESS -gt 0 ] && [ $DURATION_MS -gt 0 ]; then
            AVG_MS=$((DURATION_MS / SUCCESS))
            AVG_SEC=$(echo "scale=2; $AVG_MS / 1000" | bc)
            echo "  Vitesse moyenne: ${AVG_SEC}s/repo"
            
            # ETA
            REMAINING=$((TOTAL - SUCCESS))
            ETA_SEC=$(echo "scale=0; $REMAINING * $AVG_SEC" | bc)
            ETA_MIN=$((ETA_SEC / 60))
            echo "  ETA: ~${ETA_MIN} minutes"
        fi
        
        echo ""
        echo "💾 STOCKAGE"
        LEDGER_SIZE=$(du -sh .reasoning_rl4/ 2>/dev/null | cut -f1)
        echo "  Ledger: $LEDGER_SIZE"
        echo ""
        
        # Métriques cognitives
        TOTAL_PATTERNS=$(cat "$LATEST_SUMMARY" | jq '[.results[].stats.patterns] | add' 2>/dev/null)
        TOTAL_FORECASTS=$(cat "$LATEST_SUMMARY" | jq '[.results[].stats.forecasts] | add' 2>/dev/null)
        TOTAL_ADRS=$(cat "$LATEST_SUMMARY" | jq '[.results[].stats.adrs] | add' 2>/dev/null)
        
        if [ "$TOTAL_PATTERNS" != "null" ]; then
            echo "🧠 QUALITÉ COGNITIVE"
            echo "  Patterns: $(echo $TOTAL_PATTERNS | numfmt --grouping 2>/dev/null || echo $TOTAL_PATTERNS)"
            echo "  Forecasts: $TOTAL_FORECASTS"
            echo "  ADRs: $TOTAL_ADRS"
        fi
        
        echo ""
        echo "═══════════════════════════════════════════════════════════"
        
        # Vérifier si terminé
        if [ $SUCCESS -ge $TOTAL ]; then
            echo ""
            echo "🎉 BATCH TERMINÉ !"
            echo ""
            echo "Lancement du dashboard..."
            sleep 2
            npm run dashboard
            exit 0
        fi
    else
        echo "⏳ En attente du démarrage..."
        echo ""
        echo "  Repos disponibles: $(ls datasets/corpus/ | wc -l)"
        echo "  Process actif: $(ps aux | grep trainBatch | grep -v grep | wc -l)"
    fi
    
    sleep $REFRESH_INTERVAL
done

