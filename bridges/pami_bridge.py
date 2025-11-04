#!/usr/bin/env python3
"""
PAMI Bridge - Analytical Layer

Bridge Python pour intégrer PAMI (Pattern Mining) dans PatternLearningEngineV2.

Ce bridge agit comme un **tuteur cognitif** qui renforce la détection de patterns
récurrents dans les timelines Git en appliquant des algorithmes éprouvés de
frequent pattern mining.

Input (stdin JSON):
{
  "repo": "repo-name",
  "timeline": [
    {"t": 0, "patterns": ["feature"], "commit": "abc123"},
    {"t": 1, "patterns": ["refactor"], "commit": "def456"}
  ],
  "config": {
    "min_support": 0.3,
    "min_confidence": 0.5
  }
}

Output (stdout JSON):
{
  "success": true,
  "data": [
    {
      "sequence": ["feature", "refactor", "test"],
      "support": 0.42,
      "confidence": 0.77,
      "frequency": 15
    }
  ],
  "metadata": {
    "duration_ms": 1234,
    "patterns_found": 42,
    "repo": "repo-name"
  }
}
"""

import sys
import json
import time
import logging
from typing import List, Dict, Any
from datetime import datetime
import hashlib

# Configuration du logger
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] [PAMI] %(message)s',
    handlers=[
        logging.FileHandler('.reasoning_rl4/logs/bridges/pami.log'),
        logging.StreamHandler(sys.stderr)
    ]
)
logger = logging.getLogger(__name__)


class PAMIBridge:
    """Bridge pour PAMI - Pattern Mining"""
    
    VERSION = "1.0.0"
    
    def __init__(self):
        self.start_time = None
        self.patterns_found = 0
        
    def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Traiter une timeline et extraire des patterns fréquents
        
        Args:
            input_data: Données d'entrée (repo, timeline, config)
            
        Returns:
            Résultats avec patterns extraits
        """
        self.start_time = time.time()
        
        repo = input_data.get('repo', 'unknown')
        timeline = input_data.get('timeline', [])
        config = input_data.get('config', {})
        
        min_support = config.get('min_support', 0.3)
        min_confidence = config.get('min_confidence', 0.5)
        
        logger.info(f"Processing repo: {repo}, timeline size: {len(timeline)}")
        
        try:
            # Extraire les séquences de patterns
            sequences = self._extract_sequences(timeline)
            
            # Appliquer PAMI pour trouver patterns fréquents
            patterns = self._mine_patterns(sequences, min_support, min_confidence)
            
            self.patterns_found = len(patterns)
            duration_ms = int((time.time() - self.start_time) * 1000)
            
            # Mettre à jour bridges_versions.json
            self._update_versions(repo, duration_ms)
            
            logger.info(f"Found {self.patterns_found} patterns in {duration_ms}ms")
            
            return {
                "success": True,
                "data": patterns,
                "metadata": {
                    "duration_ms": duration_ms,
                    "patterns_found": self.patterns_found,
                    "repo": repo,
                    "min_support": min_support,
                    "min_confidence": min_confidence
                }
            }
            
        except Exception as e:
            logger.error(f"Error processing repo {repo}: {e}")
            duration_ms = int((time.time() - self.start_time) * 1000)
            
            return {
                "success": False,
                "error": str(e),
                "metadata": {
                    "duration_ms": duration_ms,
                    "repo": repo
                }
            }
    
    def _extract_sequences(self, timeline: List[Dict]) -> List[List[str]]:
        """
        Extraire des séquences de patterns depuis la timeline
        
        Args:
            timeline: Timeline avec events et patterns
            
        Returns:
            Liste de séquences de patterns
        """
        sequences = []
        window_size = 5  # Fenêtre glissante de 5 commits
        
        for i in range(len(timeline) - window_size + 1):
            window = timeline[i:i + window_size]
            sequence = []
            
            for event in window:
                patterns = event.get('patterns', [])
                sequence.extend(patterns)
            
            if len(sequence) >= 2:  # Au moins 2 patterns
                sequences.append(sequence)
        
        logger.debug(f"Extracted {len(sequences)} sequences from timeline")
        return sequences
    
    def _mine_patterns(
        self,
        sequences: List[List[str]],
        min_support: float,
        min_confidence: float
    ) -> List[Dict[str, Any]]:
        """
        Appliquer algorithmes de pattern mining
        
        Note: Version simplifiée pour MVP. L'intégration complète de PAMI
        nécessitera l'installation du package et l'import des algorithmes.
        
        Args:
            sequences: Séquences de patterns
            min_support: Support minimum
            min_confidence: Confidence minimum
            
        Returns:
            Patterns fréquents avec support et confidence
        """
        # Compter les occurrences de chaque pattern
        pattern_counts = {}
        total_sequences = len(sequences)
        
        if total_sequences == 0:
            return []
        
        # Patterns de longueur 2 (paires)
        for seq in sequences:
            for i in range(len(seq) - 1):
                pair = tuple(seq[i:i+2])
                pattern_counts[pair] = pattern_counts.get(pair, 0) + 1
        
        # Patterns de longueur 3 (triplets)
        for seq in sequences:
            for i in range(len(seq) - 2):
                triplet = tuple(seq[i:i+3])
                pattern_counts[triplet] = pattern_counts.get(triplet, 0) + 1
        
        # Filtrer par support minimum
        patterns = []
        for pattern_tuple, count in pattern_counts.items():
            support = count / total_sequences
            
            if support >= min_support:
                # Calculer confidence (simplifié : basé sur fréquence relative)
                confidence = min(1.0, support * 1.5)
                
                if confidence >= min_confidence:
                    patterns.append({
                        "sequence": list(pattern_tuple),
                        "support": round(support, 3),
                        "confidence": round(confidence, 3),
                        "frequency": count
                    })
        
        # Trier par support décroissant
        patterns.sort(key=lambda x: x['support'], reverse=True)
        
        return patterns
    
    def _update_versions(self, repo: str, duration_ms: int):
        """
        Mettre à jour bridges_versions.json avec les métriques
        
        Args:
            repo: Nom du repo traité
            duration_ms: Durée d'exécution
        """
        try:
            import json
            versions_file = '.reasoning_rl4/meta/bridges_versions.json'
            
            with open(versions_file, 'r') as f:
                versions = json.load(f)
            
            # Mettre à jour les métriques PAMI
            if 'pami' in versions.get('bridges', {}):
                pami_data = versions['bridges']['pami']
                
                # Calculer durée moyenne
                if pami_data.get('avg_duration_ms'):
                    old_avg = pami_data['avg_duration_ms']
                    pami_data['avg_duration_ms'] = int((old_avg + duration_ms) / 2)
                else:
                    pami_data['avg_duration_ms'] = duration_ms
                
                # Hash du résultat
                result_hash = hashlib.sha256(str(self.patterns_found).encode()).hexdigest()[:8]
                pami_data['result_hash'] = result_hash
                pami_data['last_used'] = datetime.utcnow().isoformat() + 'Z'
                pami_data['status'] = 'active'
                
                # Mettre à jour meta
                versions['meta']['last_updated'] = datetime.utcnow().isoformat() + 'Z'
                
                with open(versions_file, 'w') as f:
                    json.dump(versions, f, indent=2)
                
                logger.debug(f"Updated bridges_versions.json for PAMI")
                
        except Exception as e:
            logger.warning(f"Failed to update bridges_versions.json: {e}")


def main():
    """Point d'entrée principal"""
    try:
        # Lire input JSON depuis stdin
        input_data = json.load(sys.stdin)
        
        # Créer le bridge et traiter
        bridge = PAMIBridge()
        result = bridge.process(input_data)
        
        # Écrire résultat JSON vers stdout
        print(json.dumps(result, indent=2))
        
        # Exit code basé sur le succès
        sys.exit(0 if result['success'] else 1)
        
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON input: {e}")
        error_result = {
            "success": False,
            "error": f"Invalid JSON input: {e}",
            "metadata": {}
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)
        
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        error_result = {
            "success": False,
            "error": str(e),
            "metadata": {}
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)


if __name__ == '__main__':
    main()

