#!/bin/bash

# ========================================================================
# bootstrap-ml-modules.sh
# ========================================================================
# 
# Automatise le clonage et l'installation des 5 dépôts ML externes
# pour l'intégration dans le pipeline cognitif RL4-Trainer.
#
# Usage: bash scripts/bootstrap-ml-modules.sh
# ========================================================================

set -e  # Exit on error

# Couleurs pour output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Dossiers
ML_MODULES_DIR="ml-modules"
BRIDGES_DIR="bridges"
LOGS_DIR=".reasoning_rl4/logs/bridges"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}RL4-Trainer - Bootstrap ML Modules${NC}"
echo -e "${BLUE}========================================${NC}"
echo

# ========================================================================
# 1. Vérification Python
# ========================================================================

echo -e "${YELLOW}[1/6] Vérification Python...${NC}"

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 non trouvé. Veuillez installer Python 3.9+${NC}"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | awk '{print $2}')
PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)

if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 9 ]); then
    echo -e "${RED}❌ Python 3.9+ requis. Version détectée : $PYTHON_VERSION${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Python $PYTHON_VERSION détecté${NC}"
echo

# ========================================================================
# 2. Vérification Java (optionnel pour SPMF)
# ========================================================================

echo -e "${YELLOW}[2/6] Vérification Java (optionnel)...${NC}"

if command -v java &> /dev/null; then
    JAVA_VERSION=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}')
    echo -e "${GREEN}✓ Java $JAVA_VERSION détecté (requis pour SPMF)${NC}"
    HAS_JAVA=true
else
    echo -e "${YELLOW}⚠ Java non détecté. SPMF bridge sera désactivé.${NC}"
    HAS_JAVA=false
fi
echo

# ========================================================================
# 3. Création des dossiers
# ========================================================================

echo -e "${YELLOW}[3/6] Création des dossiers...${NC}"

mkdir -p "$ML_MODULES_DIR"
mkdir -p "$LOGS_DIR"

echo -e "${GREEN}✓ Dossiers créés${NC}"
echo

# ========================================================================
# 4. Clonage des dépôts ML
# ========================================================================

echo -e "${YELLOW}[4/6] Clonage des dépôts ML...${NC}"

declare -A REPOS=(
    ["PAMI"]="https://github.com/UdayLab/PAMI"
    ["Merlion"]="https://github.com/salesforce/Merlion"
    ["HyperTS"]="https://github.com/DataCanvasIO/HyperTS"
    ["FP-Growth"]="https://github.com/MK-ek11/Frequent-Pattern-Mining-FP-Tree"
    ["SPMF"]="https://github.com/philippe-fournier-viger/spmf"
)

for name in "${!REPOS[@]}"; do
    url="${REPOS[$name]}"
    target="$ML_MODULES_DIR/$(basename $url)"
    
    if [ -d "$target" ]; then
        echo -e "${BLUE}   → $name déjà cloné${NC}"
    else
        echo -e "${BLUE}   → Clonage de $name...${NC}"
        git clone --depth 1 "$url" "$target" > /dev/null 2>&1
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}     ✓ $name cloné${NC}"
        else
            echo -e "${RED}     ✗ Échec du clonage de $name${NC}"
        fi
    fi
done

echo

# ========================================================================
# 5. Installation des requirements Python
# ========================================================================

echo -e "${YELLOW}[5/6] Installation des requirements Python...${NC}"

if [ -f "$BRIDGES_DIR/requirements.txt" ]; then
    echo -e "${BLUE}   → Installation des dépendances...${NC}"
    
    # Créer un environnement virtuel si nécessaire
    if [ ! -d "$BRIDGES_DIR/venv" ]; then
        python3 -m venv "$BRIDGES_DIR/venv"
        echo -e "${GREEN}     ✓ Environnement virtuel créé${NC}"
    fi
    
    # Activer l'environnement et installer
    source "$BRIDGES_DIR/venv/bin/activate"
    pip install --quiet --upgrade pip
    pip install --quiet -r "$BRIDGES_DIR/requirements.txt"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Requirements installés${NC}"
    else
        echo -e "${RED}✗ Échec de l'installation des requirements${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ $BRIDGES_DIR/requirements.txt non trouvé${NC}"
    exit 1
fi

echo

# ========================================================================
# 6. Mise à jour du fichier bridges_versions.json
# ========================================================================

echo -e "${YELLOW}[6/6] Mise à jour bridges_versions.json...${NC}"

VERSIONS_FILE=".reasoning_rl4/meta/bridges_versions.json"

if [ -f "$VERSIONS_FILE" ]; then
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    # Mettre à jour les commit SHA pour chaque repo cloné
    for name in "${!REPOS[@]}"; do
        target="$ML_MODULES_DIR/$(basename ${REPOS[$name]})"
        
        if [ -d "$target/.git" ]; then
            commit_sha=$(cd "$target" && git rev-parse HEAD)
            bridge_name=$(echo "$name" | tr '[:upper:]' '[:lower:]' | tr '-' '_')
            
            # Mettre à jour le JSON avec jq si disponible
            if command -v jq &> /dev/null; then
                tmp=$(mktemp)
                jq ".bridges.$bridge_name.repo_commit = \"$commit_sha\" | .bridges.$bridge_name.status = \"installed\" | .meta.last_updated = \"$TIMESTAMP\"" "$VERSIONS_FILE" > "$tmp"
                mv "$tmp" "$VERSIONS_FILE"
            fi
        fi
    done
    
    echo -e "${GREEN}✓ bridges_versions.json mis à jour${NC}"
else
    echo -e "${YELLOW}⚠ $VERSIONS_FILE non trouvé${NC}"
fi

echo

# ========================================================================
# Résumé
# ========================================================================

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Installation terminée !${NC}"
echo -e "${BLUE}========================================${NC}"
echo
echo -e "${GREEN}✓ Modules ML installés dans $ML_MODULES_DIR/${NC}"
echo -e "${GREEN}✓ Environnement Python créé dans $BRIDGES_DIR/venv/${NC}"

if [ "$HAS_JAVA" = true ]; then
    echo -e "${GREEN}✓ Java détecté - SPMF bridge activé${NC}"
else
    echo -e "${YELLOW}⚠ Java non détecté - SPMF bridge désactivé${NC}"
fi

echo
echo -e "${YELLOW}Prochaines étapes :${NC}"
echo -e "  1. Activer l'environnement Python : ${BLUE}source bridges/venv/bin/activate${NC}"
echo -e "  2. Tester les bridges : ${BLUE}npm run test:bridges${NC}"
echo -e "  3. Lancer l'entraînement avec ML : ${BLUE}npm run train${NC}"
echo

exit 0

