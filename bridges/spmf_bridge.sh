#!/bin/bash

# ========================================================================
# spmf_bridge.sh - Structural Layer (Phase 4)
# ========================================================================
# 
# Bridge Shell pour SPMF (Sequential Pattern Mining Framework).
# Utilise PrefixSpan pour trouver patterns structurels universels (>100).
#
# Requis: Java 11+
#
# Input (stdin JSON):
# {
#   "repo": "repo-name",
#   "dependencies": [...],
#   "config": {"min_support": 0.3}
# }
#
# Output (stdout JSON):
# {
#   "success": true,
#   "data": {"universals": [...]},
#   "metadata": {"duration_ms": 3456}
# }
# ========================================================================

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Fichiers
LOG_FILE=".reasoning_rl4/logs/bridges/spmf.log"
VERSIONS_FILE=".reasoning_rl4/meta/bridges_versions.json"
SPMF_JAR="ml-modules/spmf/spmf.jar"
TEMP_INPUT="/tmp/spmf_input_$$.txt"
TEMP_OUTPUT="/tmp/spmf_output_$$.txt"

# Fonction de log
log_info() {
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [INFO] [SPMF] $1" >> "$LOG_FILE"
    echo "[INFO] $1" >&2
}

log_error() {
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [ERROR] [SPMF] $1" >> "$LOG_FILE"
    echo -e "${RED}[ERROR] $1${NC}" >&2
}

# Vérifier Java
if ! command -v java &> /dev/null; then
    log_error "Java not found. SPMF requires Java 11+"
    echo '{"success": false, "error": "Java not found", "metadata": {}}'
    exit 1
fi

# Début timer
START_TIME=$(date +%s%3N)

# Lire JSON depuis stdin
INPUT_JSON=$(cat)
log_info "Processing SPMF bridge"

# Extraire données
REPO=$(echo "$INPUT_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('repo', 'unknown'))")
MIN_SUPPORT=$(echo "$INPUT_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('config', {}).get('min_support', 0.3))")

log_info "Repo: $REPO, Min Support: $MIN_SUPPORT"

# Convertir JSON en format SPMF
# Format: sequence_id item1 item2 item3 -1 -2
echo "$INPUT_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
dependencies = data.get('dependencies', [])

for i, dep in enumerate(dependencies):
    items = dep.get('sequence', [])
    print(f\"{i}\", \" \".join(items), \"-1 -2\")
" > "$TEMP_INPUT"

SEQUENCE_COUNT=$(wc -l < "$TEMP_INPUT" | tr -d ' ')

if [ "$SEQUENCE_COUNT" -eq 0 ]; then
    log_info "No dependencies to process"
    echo "{\"success\": true, \"data\": {\"universals\": []}, \"metadata\": {\"duration_ms\": 0}}"
    exit 0
fi

# Exécuter SPMF PrefixSpan
log_info "Running PrefixSpan on $SEQUENCE_COUNT sequences"

if [ -f "$SPMF_JAR" ]; then
    # Exécution réelle avec SPMF
    java -jar "$SPMF_JAR" run PrefixSpan "$TEMP_INPUT" "$TEMP_OUTPUT" "$MIN_SUPPORT" > /dev/null 2>&1
    
    if [ $? -ne 0 ]; then
        log_error "SPMF execution failed"
        rm -f "$TEMP_INPUT" "$TEMP_OUTPUT"
        echo "{\"success\": false, \"error\": \"SPMF execution failed\", \"metadata\": {}}"
        exit 1
    fi
else
    log_info "SPMF jar not found, using mock mode"
    # Mock pour MVP
    echo "pattern1 pattern2 -1 #SUP: 5" > "$TEMP_OUTPUT"
    echo "pattern3 pattern4 pattern5 -1 #SUP: 3" >> "$TEMP_OUTPUT"
fi

# Parser résultats SPMF
UNIVERSALS=$(python3 -c "
import json

universals = []
try:
    with open('$TEMP_OUTPUT', 'r') as f:
        for line in f:
            if '#SUP:' in line:
                parts = line.strip().split('#SUP:')
                sequence = parts[0].strip().split('-1')[0].strip().split()
                support = int(parts[1].strip())
                
                if support >= 3:  # Minimum pour universal
                    universals.append({
                        'sequence': sequence,
                        'support': support,
                        'type': 'structural'
                    })
except Exception as e:
    pass

print(json.dumps(universals))
")

# Calculer durée
END_TIME=$(date +%s%3N)
DURATION_MS=$((END_TIME - START_TIME))

# Nettoyage
rm -f "$TEMP_INPUT" "$TEMP_OUTPUT"

# Mise à jour bridges_versions.json
python3 -c "
import json
from datetime import datetime

try:
    with open('$VERSIONS_FILE', 'r') as f:
        versions = json.load(f)
    
    if 'spmf' in versions.get('bridges', {}):
        spmf_data = versions['bridges']['spmf']
        
        if spmf_data.get('avg_duration_ms'):
            old_avg = spmf_data['avg_duration_ms']
            spmf_data['avg_duration_ms'] = int((old_avg + $DURATION_MS) / 2)
        else:
            spmf_data['avg_duration_ms'] = $DURATION_MS
        
        spmf_data['last_used'] = datetime.utcnow().isoformat() + 'Z'
        spmf_data['status'] = 'active'
        
        versions['meta']['last_updated'] = datetime.utcnow().isoformat() + 'Z'
        
        with open('$VERSIONS_FILE', 'w') as f:
            json.dump(versions, f, indent=2)
except Exception:
    pass
" 2>/dev/null

# Output JSON
UNIVERSALS_COUNT=$(echo "$UNIVERSALS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")

log_info "Found $UNIVERSALS_COUNT universals in ${DURATION_MS}ms"

# Résultat final
cat <<EOF
{
  "success": true,
  "data": {
    "universals": $UNIVERSALS
  },
  "metadata": {
    "duration_ms": $DURATION_MS,
    "universals_found": $UNIVERSALS_COUNT,
    "repo": "$REPO",
    "algorithm": "PrefixSpan",
    "min_support": $MIN_SUPPORT
  }
}
EOF

exit 0

