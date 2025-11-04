#!/bin/bash

# ========================================================================
# monitor-phase2.sh - Monitoring Temps Réel Phase 2
# ========================================================================
#
# Surveille la progression de l'entraînement Phase 2 en temps réel.
#
# Usage: bash scripts/monitor-phase2.sh
# ========================================================================

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Fichiers
COGNITIVE_STATE=".reasoning_rl4/kernel/cognitive_state.json"
PATTERNS_FILE=".reasoning_rl4/patterns.jsonl"
CORRELATIONS_FILE=".reasoning_rl4/correlations.jsonl"
LOG_FILE=".reasoning_rl4/logs/phase2-training.log"

clear

echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}  Phase 2 Training - Monitoring Live${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo

while true; do
    # Metrics
    if [ -f "$COGNITIVE_STATE" ]; then
        COHERENCE=$(python3 -c "import json; print(json.load(open('$COGNITIVE_STATE')).get('coherence_score', 0))" 2>/dev/null || echo "0")
        REPOS=$(python3 -c "import json; print(json.load(open('$COGNITIVE_STATE')).get('metrics', {}).get('total_repos', 0))" 2>/dev/null || echo "0")
        PATTERNS=$(python3 -c "import json; print(json.load(open('$COGNITIVE_STATE')).get('metrics', {}).get('total_patterns', 0))" 2>/dev/null || echo "0")
        UNIVERSALS=$(python3 -c "import json; print(json.load(open('$COGNITIVE_STATE')).get('universals', 0))" 2>/dev/null || echo "0")
        CORR_STRENGTH=$(python3 -c "import json; print(json.load(open('$COGNITIVE_STATE')).get('avg_correlation_strength', 0))" 2>/dev/null || echo "0")
    else
        COHERENCE="0"
        REPOS="0"
        PATTERNS="0"
        UNIVERSALS="0"
        CORR_STRENGTH="0"
    fi
    
    # Progress bar pour coherence
    COHERENCE_PCT=$(echo "$COHERENCE * 100" | bc -l 2>/dev/null | cut -d. -f1)
    COHERENCE_TARGET=50  # Phase 2 target = 0.5
    
    # Affichage
    echo -e "${CYAN}┌─────────────────────────────────────┐${NC}"
    echo -e "${CYAN}│  Métriques Cognitives Live          │${NC}"
    echo -e "${CYAN}├─────────────────────────────────────┤${NC}"
    echo -e "${CYAN}│${NC} Repos traités : ${GREEN}$REPOS${NC} / 100"
    echo -e "${CYAN}│${NC} Coherence :     ${GREEN}$COHERENCE${NC} (cible: 0.5)"
    echo -e "${CYAN}│${NC} Patterns :      ${GREEN}$PATTERNS${NC} (cible: 2000)"
    echo -e "${CYAN}│${NC} Universals :    ${GREEN}$UNIVERSALS${NC} (cible: 10)"
    echo -e "${CYAN}│${NC} Corr Strength : ${GREEN}$CORR_STRENGTH${NC} (cible: 0.6)"
    echo -e "${CYAN}└─────────────────────────────────────┘${NC}"
    echo
    
    # Status Phase
    if (( $(echo "$COHERENCE >= 0.5" | bc -l 2>/dev/null || echo "0") )) && (( $(echo "$UNIVERSALS >= 10" | bc -l 2>/dev/null || echo "0") )); then
        echo -e "${GREEN}✨ PHASE 2 ATTEINTE ! ✨${NC}"
        echo
        echo -e "Exécuter: ${CYAN}npm run check-phase2${NC}"
        break
    else
        # Calcul progrès vers Phase 2
        COHERENCE_PROGRESS=$(echo "($COHERENCE / 0.5) * 100" | bc -l 2>/dev/null | cut -d. -f1)
        echo -e "Progrès vers Phase 2 : ${YELLOW}$COHERENCE_PROGRESS%${NC}"
    fi
    
    # Dernières lignes du log
    if [ -f "$LOG_FILE" ]; then
        echo
        echo -e "${CYAN}Derniers events :${NC}"
        tail -3 "$LOG_FILE" 2>/dev/null | grep -E "(✓|patterns|correlations)" | sed 's/\x1b\[[0-9;]*m//g' || echo "Training en cours..."
    fi
    
    echo
    echo -e "${YELLOW}[Refresh toutes les 10s - Ctrl+C pour quitter]${NC}"
    
    sleep 10
    clear
    
    echo -e "${BLUE}════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Phase 2 Training - Monitoring Live${NC}"
    echo -e "${BLUE}════════════════════════════════════════${NC}"
    echo
done

