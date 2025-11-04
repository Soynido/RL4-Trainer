#!/bin/bash

# Live Progress Dashboard - Suit les logs en temps réel
# Usage: bash .reasoning_rl4/scripts/live-progress.sh

LOG_FILE=".reasoning_rl4/logs/phase2-final-training.log"
STATE_FILE=".reasoning_rl4/kernel/cognitive_state.json"
REFRESH_INTERVAL=3  # secondes

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

# Métriques de base (avant ce batch)
BASE_REPOS=196
BASE_COHERENCE=0.2552
BASE_PATTERNS=4574

# Cibles
TARGET_REPOS=500
TARGET_COHERENCE=0.5
TARGET_PATTERNS=2000
TARGET_UNIVERSALS=10

# Fonction barre de progression
progress_bar() {
    local current=$1
    local target=$2
    local width=40
    
    if (( target == 0 )); then
        echo "[░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 0.0%"
        return
    fi
    
    local pct=$(awk "BEGIN {printf \"%.1f\", ($current/$target)*100}")
    local filled=$(awk "BEGIN {printf \"%.0f\", ($current/$target)*$width}")
    
    if (( filled > width )); then
        filled=$width
        pct=100.0
    fi
    
    local empty=$((width - filled))
    
    printf "["
    printf "%${filled}s" | tr ' ' '█'
    printf "%${empty}s" | tr ' ' '░'
    printf "] %.1f%%\n" "$pct"
}

# Début du monitoring
START_TIME=$(date +%s)

while true; do
    clear
    
    echo -e "${BOLD}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}║                                                                ║${NC}"
    echo -e "${BOLD}║       🔥  TRAINING EN COURS - LIVE LOGS  🔥                    ║${NC}"
    echo -e "${BOLD}║                                                                ║${NC}"
    echo -e "${BOLD}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    if [ ! -f "$LOG_FILE" ]; then
        echo -e "${RED}❌ Fichier log introuvable${NC}"
        sleep $REFRESH_INTERVAL
        continue
    fi
    
    # Compter les repos traités dans ce batch
    completed_in_batch=$(grep -c "Training complete" "$LOG_FILE" 2>/dev/null || echo "0")
    
    # Total repos
    total_repos=$((BASE_REPOS + completed_in_batch))
    
    # Progression globale
    global_pct=$(awk "BEGIN {printf \"%.1f\", ($total_repos/$TARGET_REPOS)*100}")
    
    # Temps écoulé
    current_time=$(date +%s)
    elapsed=$((current_time - START_TIME))
    elapsed_min=$((elapsed / 60))
    elapsed_sec=$((elapsed % 60))
    
    # Vitesse et estimation
    if [ $completed_in_batch -gt 0 ] && [ $elapsed -gt 0 ]; then
        avg_time_per_repo=$(awk "BEGIN {printf \"%.1f\", $elapsed / $completed_in_batch}")
        remaining_repos=$((TARGET_REPOS - total_repos))
        estimated_remaining=$(awk "BEGIN {printf \"%.0f\", $remaining_repos * $avg_time_per_repo}")
        est_min=$((estimated_remaining / 60))
        est_sec=$((estimated_remaining % 60))
    else
        avg_time_per_repo=3.0
        est_min=15
        est_sec=0
    fi
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${BOLD}📊  PROGRESSION BATCH ACTUEL${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    echo -e "${BLUE}Repos traités dans ce batch :${NC} ${GREEN}${completed_in_batch}${NC}"
    echo -e "${BLUE}Total repos (196 + batch) :${NC}   ${GREEN}${total_repos}${NC} / ${TARGET_REPOS}"
    echo ""
    echo -e "${BOLD}Progression globale :${NC}"
    echo -n "   "
    progress_bar $total_repos $TARGET_REPOS
    echo ""
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${BOLD}⏱️   TIMING${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    echo -e "${BLUE}Temps écoulé :${NC}        ${elapsed_min}m ${elapsed_sec}s"
    
    if [ $completed_in_batch -gt 0 ]; then
        echo -e "${BLUE}Vitesse moyenne :${NC}     ${avg_time_per_repo}s / repo"
        echo -e "${BLUE}Temps restant estimé :${NC} ${est_min}m ${est_sec}s"
    else
        echo -e "${YELLOW}Calcul en cours... (attente premiers repos)${NC}"
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${BOLD}📝  DERNIERS REPOS TRAITÉS${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Afficher les 5 derniers repos traités
    tail -100 "$LOG_FILE" | grep "Training complete" | tail -5 | while read -r line; do
        # Extraire le nom du repo et le temps
        repo=$(echo "$line" | sed -n 's/.*\[\([^]]*\)\] Training complete.*/\1/p')
        time=$(echo "$line" | sed -n 's/.*in \([0-9]*\)ms.*/\1/p')
        
        if [ -n "$repo" ] && [ -n "$time" ]; then
            time_sec=$(awk "BEGIN {printf \"%.2f\", $time / 1000}")
            echo -e "  ${GREEN}✓${NC} ${repo} ${BLUE}(${time_sec}s)${NC}"
        fi
    done
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${BOLD}🎯  OBJECTIFS PHASE 2${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    echo -e "  🟡 coherence_score : ${BASE_COHERENCE} → ${TARGET_COHERENCE}"
    echo -e "  ✅ patterns : ${BASE_PATTERNS} → ${TARGET_PATTERNS} (déjà atteint)"
    echo -e "  🔴 universals : 0 → ${TARGET_UNIVERSALS} (émergence attendue)"
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo -e "${BOLD}Actualisation automatique toutes les ${REFRESH_INTERVAL}s...${NC}"
    echo -e "Appuyez sur ${BOLD}Ctrl+C${NC} pour quitter"
    echo ""
    echo -e "${BLUE}💡 Les métriques finales (coherence, patterns) seront${NC}"
    echo -e "${BLUE}   calculées à la fin du batch complet.${NC}"
    
    sleep $REFRESH_INTERVAL
done

