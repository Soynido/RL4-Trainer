#!/bin/bash

# Dashboard de progression Phase 2 en temps réel
# Usage: bash .reasoning_rl4/scripts/progress-dashboard.sh

STATE_FILE=".reasoning_rl4/kernel/cognitive_state.json"
REFRESH_INTERVAL=5  # secondes

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Fonction pour afficher une barre de progression
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

# Boucle principale
while true; do
    clear
    
    echo -e "${BOLD}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}║                                                                ║${NC}"
    echo -e "${BOLD}║       📊  RL4-TRAINER - DASHBOARD PHASE 2  📊                  ║${NC}"
    echo -e "${BOLD}║                                                                ║${NC}"
    echo -e "${BOLD}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    if [ ! -f "$STATE_FILE" ]; then
        echo -e "${RED}❌ Fichier cognitive_state.json introuvable${NC}"
        echo ""
        echo "Le training n'a pas encore commencé ou le fichier est manquant."
        sleep $REFRESH_INTERVAL
        continue
    fi
    
    # Extraire les métriques
    coherence=$(jq -r '.coherence_score // 0' "$STATE_FILE")
    repos=$(jq -r '.metrics.total_repos // 0' "$STATE_FILE")
    patterns=$(jq -r '.metrics.total_patterns // 0' "$STATE_FILE")
    universals=$(jq -r '.universals // 0' "$STATE_FILE")
    correlation=$(jq -r '.avg_correlation_strength // 0' "$STATE_FILE")
    phase=$(jq -r '.phase // "Phase 1"' "$STATE_FILE")
    
    # Cibles Phase 2
    COHERENCE_TARGET=0.5
    PATTERNS_TARGET=2000
    UNIVERSALS_TARGET=10
    CORRELATION_TARGET=0.6
    REPOS_TARGET=500
    
    # Calculer progression
    coherence_pct=$(awk "BEGIN {printf \"%.1f\", ($coherence/$COHERENCE_TARGET)*100}")
    patterns_pct=$(awk "BEGIN {printf \"%.1f\", ($patterns/$PATTERNS_TARGET)*100}")
    universals_pct=$(awk "BEGIN {printf \"%.1f\", ($universals/$UNIVERSALS_TARGET)*100}")
    correlation_pct=$(awk "BEGIN {printf \"%.1f\", ($correlation/$CORRELATION_TARGET)*100}")
    repos_pct=$(awk "BEGIN {printf \"%.1f\", ($repos/$REPOS_TARGET)*100}")
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${BOLD}🎯  PROGRESSION GLOBALE${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    echo -e "${BLUE}Phase actuelle :${NC} $phase"
    echo -e "${BLUE}Repos traités :${NC}  $repos / $REPOS_TARGET"
    echo -n "   "
    progress_bar $repos $REPOS_TARGET
    echo ""
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${BOLD}📊  MÉTRIQUES COGNITIVES${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Coherence
    if (( $(echo "$coherence >= $COHERENCE_TARGET" | bc -l) )); then
        status="${GREEN}✅${NC}"
    elif (( $(echo "$coherence_pct >= 40" | bc -l) )); then
        status="${YELLOW}🟡${NC}"
    else
        status="${RED}🔴${NC}"
    fi
    echo -e "$status ${BOLD}Coherence Score :${NC} $coherence / $COHERENCE_TARGET"
    echo -n "   "
    progress_bar $(echo "$coherence * 1000" | bc | cut -d. -f1) $(echo "$COHERENCE_TARGET * 1000" | bc | cut -d. -f1)
    echo ""
    
    # Patterns
    if (( patterns >= PATTERNS_TARGET )); then
        status="${GREEN}✅${NC}"
    elif (( $(echo "$patterns_pct >= 40" | bc -l) )); then
        status="${YELLOW}🟡${NC}"
    else
        status="${RED}🔴${NC}"
    fi
    echo -e "$status ${BOLD}Patterns :${NC} $(printf "%'d" $patterns) / $(printf "%'d" $PATTERNS_TARGET)"
    echo -n "   "
    progress_bar $patterns $PATTERNS_TARGET
    echo ""
    
    # Universals
    if (( universals >= UNIVERSALS_TARGET )); then
        status="${GREEN}✅${NC}"
    elif (( $(echo "$universals_pct >= 40" | bc -l) )); then
        status="${YELLOW}🟡${NC}"
    else
        status="${RED}🔴${NC}"
    fi
    echo -e "$status ${BOLD}Universals :${NC} $universals / $UNIVERSALS_TARGET"
    echo -n "   "
    progress_bar $universals $UNIVERSALS_TARGET
    echo ""
    
    # Correlation
    if (( $(echo "$correlation >= $CORRELATION_TARGET" | bc -l) )); then
        status="${GREEN}✅${NC}"
    elif (( $(echo "$correlation_pct >= 40" | bc -l) )); then
        status="${YELLOW}🟡${NC}"
    else
        status="${RED}🔴${NC}"
    fi
    echo -e "$status ${BOLD}Correlation :${NC} $correlation / $CORRELATION_TARGET"
    echo -n "   "
    progress_bar $(echo "$correlation * 1000" | bc | cut -d. -f1) $(echo "$CORRELATION_TARGET * 1000" | bc | cut -d. -f1)
    echo ""
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${BOLD}🏆  ÉTAT PHASE 2${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Vérifier si Phase 2 est atteinte
    phase2_coherence=0
    phase2_universals=0
    
    if (( $(echo "$coherence >= $COHERENCE_TARGET" | bc -l) )); then
        phase2_coherence=1
        echo -e "${GREEN}✅ Coherence atteinte${NC}"
    else
        remaining=$(awk "BEGIN {printf \"%.4f\", $COHERENCE_TARGET - $coherence}")
        echo -e "${YELLOW}⏳ Coherence : +$remaining nécessaire${NC}"
    fi
    
    if (( universals >= UNIVERSALS_TARGET )); then
        phase2_universals=1
        echo -e "${GREEN}✅ Universals atteints${NC}"
    else
        remaining=$((UNIVERSALS_TARGET - universals))
        echo -e "${YELLOW}⏳ Universals : +$remaining nécessaires${NC}"
    fi
    
    echo ""
    
    if [ $phase2_coherence -eq 1 ] && [ $phase2_universals -eq 1 ]; then
        echo -e "${GREEN}${BOLD}✨✨✨  PHASE 2 ATTEINTE ! ✨✨✨${NC}"
        echo ""
        echo -e "${GREEN}Toutes les conditions sont remplies !${NC}"
        echo -e "${GREEN}Prêt pour Phase 3${NC}"
    else
        echo -e "${BLUE}Training en cours...${NC}"
        
        # Estimation temps restant (basé sur moyenne 3.43s/repo)
        remaining_repos=$((REPOS_TARGET - repos))
        if [ $remaining_repos -gt 0 ]; then
            estimated_seconds=$((remaining_repos * 3))
            estimated_minutes=$((estimated_seconds / 60))
            echo ""
            echo -e "${BLUE}⏱️  Estimation : ~$estimated_minutes minutes restantes${NC}"
        fi
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo -e "${BOLD}Actualisation automatique toutes les ${REFRESH_INTERVAL}s...${NC}"
    echo -e "Appuyez sur ${BOLD}Ctrl+C${NC} pour quitter"
    
    sleep $REFRESH_INTERVAL
done

