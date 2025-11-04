#!/bin/bash

# ========================================================================
# watch-phase-transition.sh
# ========================================================================
#
# Surveille l'évolution de coherence_score et déclenche automatiquement
# les transitions entre phases (Phase 1 → 2 → 3 → 4).
#
# Usage: bash scripts/watch-phase-transition.sh
# ========================================================================

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Fichiers
COGNITIVE_STATE=".reasoning_rl4/kernel/cognitive_state.json"
TRANSITIONS_LOG=".reasoning_rl4/logs/phase_transitions.log"

# Seuils de transition
PHASE_2_COHERENCE=0.5
PHASE_2_UNIVERSALS=10
PHASE_3_COHERENCE=0.8
PHASE_3_FORECAST=0.6
PHASE_4_COHERENCE=0.9
PHASE_4_UNIVERSALS=100

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}RL4 Phase Transition Monitor${NC}"
echo -e "${BLUE}========================================${NC}"
echo

# ========================================================================
# Charger l'état cognitif actuel
# ========================================================================

if [ ! -f "$COGNITIVE_STATE" ]; then
    echo -e "${RED}❌ cognitive_state.json non trouvé${NC}"
    echo -e "${YELLOW}Lancer d'abord: npm run train${NC}"
    exit 1
fi

# Extraire métriques
COHERENCE=$(python3 -c "import json; print(json.load(open('$COGNITIVE_STATE')).get('coherence_score', 0))")
FORECAST_PRECISION=$(python3 -c "import json; print(json.load(open('$COGNITIVE_STATE')).get('forecast_precision', 0))")
UNIVERSALS=$(python3 -c "import json; print(json.load(open('$COGNITIVE_STATE')).get('universals', 0))")
TOTAL_REPOS=$(python3 -c "import json; print(json.load(open('$COGNITIVE_STATE')).get('metrics', {}).get('total_repos', 0))")

# Déterminer phase actuelle
CURRENT_PHASE=1
if (( $(echo "$COHERENCE >= $PHASE_4_COHERENCE" | bc -l) )) && (( $(echo "$UNIVERSALS >= $PHASE_4_UNIVERSALS" | bc -l) )); then
    CURRENT_PHASE=4
elif (( $(echo "$COHERENCE >= $PHASE_3_COHERENCE" | bc -l) )) && (( $(echo "$FORECAST_PRECISION >= $PHASE_3_FORECAST" | bc -l) )); then
    CURRENT_PHASE=3
elif (( $(echo "$COHERENCE >= $PHASE_2_COHERENCE" | bc -l) )) && (( $(echo "$UNIVERSALS >= $PHASE_2_UNIVERSALS" | bc -l) )); then
    CURRENT_PHASE=2
fi

echo -e "${CYAN}État Cognitif Actuel${NC}"
echo -e "─────────────────────────────────────"
echo -e "Phase actuelle :         ${CYAN}Phase $CURRENT_PHASE${NC}"
echo -e "coherence_score :        ${CYAN}$COHERENCE${NC}"
echo -e "forecast_precision :     ${CYAN}$FORECAST_PRECISION${NC}"
echo -e "universals :             ${CYAN}$UNIVERSALS${NC}"
echo -e "total_repos :            ${CYAN}$TOTAL_REPOS${NC}"
echo

# ========================================================================
# Règles d'alerte Phase 2
# ========================================================================

echo -e "${YELLOW}Vérification Règles Phase 2...${NC}"

PHASE_2_READY=false

if (( $(echo "$COHERENCE >= $PHASE_2_COHERENCE" | bc -l) )) && (( $(echo "$UNIVERSALS >= $PHASE_2_UNIVERSALS" | bc -l) )); then
    echo -e "${GREEN}✓ Phase 2 ATTEINTE !${NC}"
    echo -e "  coherence_score :  ${GREEN}$COHERENCE >= $PHASE_2_COHERENCE${NC}"
    echo -e "  universals :       ${GREEN}$UNIVERSALS >= $PHASE_2_UNIVERSALS${NC}"
    PHASE_2_READY=true
    
    # Logger la transition
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "[$TIMESTAMP] Phase 2 READY - coherence: $COHERENCE, universals: $UNIVERSALS" >> "$TRANSITIONS_LOG"
else
    echo -e "${YELLOW}⏳ Phase 2 pas encore atteinte${NC}"
    
    if (( $(echo "$COHERENCE < $PHASE_2_COHERENCE" | bc -l) )); then
        COHERENCE_NEEDED=$(echo "$PHASE_2_COHERENCE - $COHERENCE" | bc -l)
        echo -e "  coherence_score :  ${YELLOW}$COHERENCE (besoin +$(printf "%.2f" $COHERENCE_NEEDED))${NC}"
    else
        echo -e "  coherence_score :  ${GREEN}$COHERENCE >= $PHASE_2_COHERENCE ✓${NC}"
    fi
    
    if (( $(echo "$UNIVERSALS < $PHASE_2_UNIVERSALS" | bc -l) )); then
        UNIVERSALS_NEEDED=$(echo "$PHASE_2_UNIVERSALS - $UNIVERSALS" | bc -l | cut -d. -f1)
        echo -e "  universals :       ${YELLOW}$UNIVERSALS (besoin +$UNIVERSALS_NEEDED)${NC}"
    else
        echo -e "  universals :       ${GREEN}$UNIVERSALS >= $PHASE_2_UNIVERSALS ✓${NC}"
    fi
    
    # Estimer repos nécessaires
    REPOS_NEEDED=$(echo "($PHASE_2_COHERENCE - $COHERENCE) * 200 / 0.3" | bc -l | cut -d. -f1)
    echo -e "  ${CYAN}Estimation : +$REPOS_NEEDED repos nécessaires${NC}"
fi

echo

# ========================================================================
# Règles d'alerte Phase 3
# ========================================================================

echo -e "${YELLOW}Vérification Règles Phase 3...${NC}"

PHASE_3_READY=false

if (( $(echo "$COHERENCE >= $PHASE_3_COHERENCE" | bc -l) )) && (( $(echo "$FORECAST_PRECISION >= $PHASE_3_FORECAST" | bc -l) )); then
    echo -e "${GREEN}✓ Phase 3 ATTEINTE !${NC}"
    echo -e "  coherence_score :     ${GREEN}$COHERENCE >= $PHASE_3_COHERENCE${NC}"
    echo -e "  forecast_precision :  ${GREEN}$FORECAST_PRECISION >= $PHASE_3_FORECAST${NC}"
    PHASE_3_READY=true
    
    # Logger la transition
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "[$TIMESTAMP] Phase 3 READY - coherence: $COHERENCE, forecast: $FORECAST_PRECISION" >> "$TRANSITIONS_LOG"
else
    echo -e "${YELLOW}⏳ Phase 3 pas encore atteinte${NC}"
    echo -e "  coherence_score :     ${YELLOW}$COHERENCE / $PHASE_3_COHERENCE${NC}"
    echo -e "  forecast_precision :  ${YELLOW}$FORECAST_PRECISION / $PHASE_3_FORECAST${NC}"
fi

echo

# ========================================================================
# Règles d'alerte Phase 4
# ========================================================================

echo -e "${YELLOW}Vérification Règles Phase 4...${NC}"

PHASE_4_READY=false

if (( $(echo "$COHERENCE >= $PHASE_4_COHERENCE" | bc -l) )) && (( $(echo "$UNIVERSALS >= $PHASE_4_UNIVERSALS" | bc -l) )); then
    echo -e "${GREEN}✓ Phase 4 ATTEINTE !${NC}"
    echo -e "  coherence_score :  ${GREEN}$COHERENCE >= $PHASE_4_COHERENCE${NC}"
    echo -e "  universals :       ${GREEN}$UNIVERSALS >= $PHASE_4_UNIVERSALS${NC}"
    PHASE_4_READY=true
    
    # Logger la transition
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "[$TIMESTAMP] Phase 4 READY - coherence: $COHERENCE, universals: $UNIVERSALS" >> "$TRANSITIONS_LOG"
    
    echo
    echo -e "${CYAN}🚀 Activer Phase 4 :${NC}"
    echo -e "   $ npm run activate-phase4"
else
    echo -e "${YELLOW}⏳ Phase 4 pas encore atteinte${NC}"
    echo -e "  coherence_score :  ${YELLOW}$COHERENCE / $PHASE_4_COHERENCE${NC}"
    echo -e "  universals :       ${YELLOW}$UNIVERSALS / $PHASE_4_UNIVERSALS${NC}"
fi

echo

# ========================================================================
# Recommandations automatiques
# ========================================================================

echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}Recommandations${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"

if [ "$PHASE_4_READY" = true ]; then
    echo -e "${GREEN}✨ Activer Phase 4 (Universal Mining)${NC}"
    echo -e "   $ npm run activate-phase4"
elif [ "$PHASE_3_READY" = true ]; then
    echo -e "${GREEN}✨ Continuer entraînement vers Phase 4${NC}"
    echo -e "   $ npm run train -- --max-repos 1000"
elif [ "$PHASE_2_READY" = true ]; then
    echo -e "${GREEN}✨ Continuer entraînement vers Phase 3${NC}"
    echo -e "   $ npm run train -- --max-repos 500"
else
    echo -e "${YELLOW}⏳ Continuer entraînement vers Phase 2${NC}"
    echo -e "   $ npm run train -- --max-repos 100"
    echo -e "   ${CYAN}(Estim: +$REPOS_NEEDED repos nécessaires)${NC}"
fi

echo

# ========================================================================
# Surveillance continue (optionnel)
# ========================================================================

if [ "$1" == "--watch" ]; then
    echo -e "${CYAN}Mode surveillance activé (Ctrl+C pour quitter)${NC}"
    echo
    
    while true; do
        sleep 60  # Vérifier toutes les 60 secondes
        
        # Recharger métriques
        COHERENCE_NEW=$(python3 -c "import json; print(json.load(open('$COGNITIVE_STATE')).get('coherence_score', 0))")
        
        # Comparer
        if (( $(echo "$COHERENCE_NEW > $COHERENCE" | bc -l) )); then
            TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
            echo -e "[$TIMESTAMP] ${GREEN}↗ Coherence: $COHERENCE → $COHERENCE_NEW${NC}"
            COHERENCE=$COHERENCE_NEW
        fi
    done
fi

exit 0

