#!/bin/bash

# ========================================================================
# activate-phase4.sh - Phase 4 Auto-Activation
# ========================================================================
#
# Active la Phase 4 (Universal Mining) lorsque les conditions sont remplies:
# - coherence_score > 0.8
# - universals > 50
# - forecast_precision > 0.6
#
# Usage: bash scripts/activate-phase4.sh [--force]
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
UNIVERSALS_FILE=".reasoning_rl4/kernel/universals.json"
SPMF_BRIDGE="bridges/spmf_bridge.sh"

# Seuils Phase 4
MIN_COHERENCE=0.8
MIN_UNIVERSALS=50
MIN_FORECAST_PRECISION=0.6

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Phase 4 - Universal Mining Activation${NC}"
echo -e "${BLUE}========================================${NC}"
echo

# ========================================================================
# 1. Vérifier Java
# ========================================================================

echo -e "${YELLOW}[1/6] Vérification Java...${NC}"

if ! command -v java &> /dev/null; then
    echo -e "${RED}❌ Java non trouvé. Phase 4 nécessite Java 11+${NC}"
    echo -e "${YELLOW}Installation: brew install openjdk@11${NC}"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}')
echo -e "${GREEN}✓ Java $JAVA_VERSION détecté${NC}"
echo

# ========================================================================
# 2. Vérifier l'état cognitif
# ========================================================================

echo -e "${YELLOW}[2/6] Vérification état cognitif...${NC}"

if [ ! -f "$COGNITIVE_STATE" ]; then
    echo -e "${RED}❌ Fichier cognitive_state.json non trouvé${NC}"
    echo -e "${YELLOW}Lancer d'abord: npm run train${NC}"
    exit 1
fi

# Extraire métriques
COHERENCE=$(python3 -c "import json; print(json.load(open('$COGNITIVE_STATE')).get('coherence_score', 0))")
UNIVERSALS=$(python3 -c "import json; print(json.load(open('$COGNITIVE_STATE')).get('universals', 0))")
FORECAST_PRECISION=$(python3 -c "import json; print(json.load(open('$COGNITIVE_STATE')).get('forecast_precision', 0))")

echo -e "  coherence_score:      ${CYAN}$COHERENCE${NC} (min: $MIN_COHERENCE)"
echo -e "  universals:           ${CYAN}$UNIVERSALS${NC} (min: $MIN_UNIVERSALS)"
echo -e "  forecast_precision:   ${CYAN}$FORECAST_PRECISION${NC} (min: $MIN_FORECAST_PRECISION)"
echo

# ========================================================================
# 3. Vérifier conditions
# ========================================================================

echo -e "${YELLOW}[3/6] Vérification conditions Phase 4...${NC}"

FORCE=false
if [ "$1" == "--force" ]; then
    FORCE=true
    echo -e "${YELLOW}⚠ Mode forcé activé (skip conditions)${NC}"
fi

if [ "$FORCE" = false ]; then
    CONDITIONS_MET=true
    
    if (( $(echo "$COHERENCE < $MIN_COHERENCE" | bc -l) )); then
        echo -e "${RED}✗ coherence_score trop faible ($COHERENCE < $MIN_COHERENCE)${NC}"
        CONDITIONS_MET=false
    else
        echo -e "${GREEN}✓ coherence_score OK${NC}"
    fi
    
    if (( $(echo "$UNIVERSALS < $MIN_UNIVERSALS" | bc -l) )); then
        echo -e "${RED}✗ universals trop faible ($UNIVERSALS < $MIN_UNIVERSALS)${NC}"
        CONDITIONS_MET=false
    else
        echo -e "${GREEN}✓ universals OK${NC}"
    fi
    
    if (( $(echo "$FORECAST_PRECISION < $MIN_FORECAST_PRECISION" | bc -l) )); then
        echo -e "${RED}✗ forecast_precision trop faible ($FORECAST_PRECISION < $MIN_FORECAST_PRECISION)${NC}"
        CONDITIONS_MET=false
    else
        echo -e "${GREEN}✓ forecast_precision OK${NC}"
    fi
    
    if [ "$CONDITIONS_MET" = false ]; then
        echo
        echo -e "${RED}❌ Conditions non remplies pour Phase 4${NC}"
        echo -e "${YELLOW}Continuer l'entraînement: npm run train${NC}"
        echo -e "${YELLOW}Ou forcer: bash scripts/activate-phase4.sh --force${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ Toutes les conditions remplies${NC}"
echo

# ========================================================================
# 4. Préparer données pour SPMF
# ========================================================================

echo -e "${YELLOW}[4/6] Préparation données SPMF...${NC}"

# Extraire patterns consolidés
PATTERNS_FILE=".reasoning_rl4/patterns.jsonl"
DEPS_INPUT="/tmp/spmf_dependencies_$$.json"

if [ ! -f "$PATTERNS_FILE" ]; then
    echo -e "${RED}❌ Fichier patterns.jsonl non trouvé${NC}"
    exit 1
fi

# Convertir patterns.jsonl en format SPMF
python3 << EOF
import json

patterns = []
with open('$PATTERNS_FILE', 'r') as f:
    for line in f:
        if line.strip():
            p = json.load(line)
            patterns.append({
                'sequence': p.get('sequence', []),
                'frequency': p.get('frequency', 1),
                'confidence': p.get('confidence', 0)
            })

# Préparer pour SPMF
dependencies = {
    'repo': 'consolidated',
    'dependencies': patterns,
    'config': {'min_support': 0.3}
}

with open('$DEPS_INPUT', 'w') as f:
    json.dump(dependencies, f)

print(f"✓ {len(patterns)} patterns préparés")
EOF

echo -e "${GREEN}✓ Données préparées${NC}"
echo

# ========================================================================
# 5. Exécuter SPMF Bridge
# ========================================================================

echo -e "${YELLOW}[5/6] Exécution SPMF (Universal Mining)...${NC}"

if [ ! -f "$SPMF_BRIDGE" ]; then
    echo -e "${RED}❌ SPMF bridge non trouvé: $SPMF_BRIDGE${NC}"
    exit 1
fi

# Exécuter SPMF
cat "$DEPS_INPUT" | bash "$SPMF_BRIDGE" > /tmp/spmf_result_$$.json

SPMF_SUCCESS=$(python3 -c "import json; print(json.load(open('/tmp/spmf_result_$$.json')).get('success', False))")

if [ "$SPMF_SUCCESS" != "True" ]; then
    echo -e "${RED}❌ SPMF a échoué${NC}"
    cat /tmp/spmf_result_$$.json
    rm -f "$DEPS_INPUT" /tmp/spmf_result_$$.json
    exit 1
fi

# Extraire universals
python3 << EOF
import json

with open('/tmp/spmf_result_$$.json', 'r') as f:
    result = json.load(f)

universals = result.get('data', {}).get('universals', [])

# Sauvegarder dans universals.json
output = {
    'generated_at': '$(date -u +"%Y-%m-%dT%H:%M:%SZ")',
    'phase': 4,
    'total_universals': len(universals),
    'universals': universals,
    'metadata': result.get('metadata', {})
}

with open('$UNIVERSALS_FILE', 'w') as f:
    json.dump(output, f, indent=2)

print(f"✓ {len(universals)} universals extraits")
EOF

echo -e "${GREEN}✓ SPMF exécuté avec succès${NC}"
echo

# ========================================================================
# 6. Mettre à jour cognitive_state.json
# ========================================================================

echo -e "${YELLOW}[6/6] Mise à jour cognitive_state.json...${NC}"

python3 << EOF
import json
from datetime import datetime

# Charger état actuel
with open('$COGNITIVE_STATE', 'r') as f:
    state = json.load(f)

# Charger universals
with open('$UNIVERSALS_FILE', 'r') as f:
    universals_data = json.load(f)

# Mettre à jour
state['phase'] = 4
state['phase_4_activated_at'] = datetime.utcnow().isoformat() + 'Z'
state['universals'] = universals_data['total_universals']
state['universals_file'] = '$UNIVERSALS_FILE'

# Sauvegarder
with open('$COGNITIVE_STATE', 'w') as f:
    json.dump(state, f, indent=2)

print("✓ cognitive_state.json mis à jour")
EOF

echo -e "${GREEN}✓ État cognitif mis à jour${NC}"
echo

# Nettoyage
rm -f "$DEPS_INPUT" /tmp/spmf_result_$$.json

# ========================================================================
# Résumé
# ========================================================================

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Phase 4 Activée avec Succès !${NC}"
echo -e "${BLUE}========================================${NC}"
echo
echo -e "${GREEN}✓ Universal Mining terminé${NC}"
echo -e "${GREEN}✓ Fichier: $UNIVERSALS_FILE${NC}"
echo -e "${GREEN}✓ État cognitif: Phase 4${NC}"
echo
echo -e "${CYAN}Prochaines étapes :${NC}"
echo -e "  1. Vérifier universals : ${BLUE}cat $UNIVERSALS_FILE${NC}"
echo -e "  2. Continuer entraînement : ${BLUE}npm run train${NC}"
echo -e "  3. Export kernel : ${BLUE}npm run export-kernel${NC}"
echo

exit 0

