#!/usr/bin/env python3
"""
Merlion Bridge - Reflective Layer

Bridge Python pour intégrer Merlion (Time Series & Causality) dans CorrelationEngineV2.

Ce bridge agit comme un **tuteur cognitif** qui raffine la détection de causalité
en appliquant des méthodes ML éprouvées de time-series analysis et anomaly detection.

Input (stdin JSON):
{
  "repo": "repo-name",
  "correlations": [
    {"cause": "feature", "effect": "test", "strength": 0.6, "lag": 2}
  ],
  "timeline": {
    "events": [{"t": 0, "patterns": ["feature"]}, ...]
  },
  "config": {
    "causal_threshold": 0.5,
    "anomaly_detection": true
  }
}

Output (stdout JSON):
{
  "success": true,
  "data": {
    "refined_correlations": [
      {
        "cause": "feature",
        "effect": "test",
        "strength": 0.72,
        "lag": 2,
        "causal_score": 0.85,
        "anomalies": []
      }
    ],
    "detected_anomalies": [
      {"pattern": "bugfix", "t": 15, "severity": 0.8}
    ]
  },
  "metadata": {
    "duration_ms": 2345,
    "correlations_refined": 8,
    "anomalies_found": 2,
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
    format='[%(asctime)s] [%(levelname)s] [MERLION] %(message)s',
    handlers=[
        logging.FileHandler('.reasoning_rl4/logs/bridges/merlion.log'),
        logging.StreamHandler(sys.stderr)
    ]
)
logger = logging.getLogger(__name__)


class MerlionBridge:
    """Bridge pour Merlion - Time Series Analysis & Causality"""
    
    VERSION = "1.0.0"
    
    def __init__(self):
        self.start_time = None
        self.correlations_refined = 0
        self.anomalies_found = 0
        
    def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Raffiner les corrélations causales et détecter les anomalies
        
        Args:
            input_data: Données d'entrée (repo, correlations, timeline, config)
            
        Returns:
            Corrélations raffinées + anomalies détectées
        """
        self.start_time = time.time()
        
        repo = input_data.get('repo', 'unknown')
        correlations = input_data.get('correlations', [])
        timeline = input_data.get('timeline', {})
        config = input_data.get('config', {})
        
        causal_threshold = config.get('causal_threshold', 0.5)
        anomaly_detection = config.get('anomaly_detection', True)
        
        logger.info(f"Processing repo: {repo}, correlations: {len(correlations)}")
        
        try:
            # Raffiner les corrélations causales
            refined = self._refine_causality(correlations, timeline, causal_threshold)
            self.correlations_refined = len(refined)
            
            # Détecter les anomalies temporelles
            anomalies = []
            if anomaly_detection:
                anomalies = self._detect_anomalies(timeline)
                self.anomalies_found = len(anomalies)
            
            duration_ms = int((time.time() - self.start_time) * 1000)
            
            # Mettre à jour bridges_versions.json
            self._update_versions(repo, duration_ms)
            
            logger.info(
                f"Refined {self.correlations_refined} correlations, "
                f"found {self.anomalies_found} anomalies in {duration_ms}ms"
            )
            
            return {
                "success": True,
                "data": {
                    "refined_correlations": refined,
                    "detected_anomalies": anomalies
                },
                "metadata": {
                    "duration_ms": duration_ms,
                    "correlations_refined": self.correlations_refined,
                    "anomalies_found": self.anomalies_found,
                    "repo": repo
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
    
    def _refine_causality(
        self,
        correlations: List[Dict],
        timeline: Dict,
        threshold: float
    ) -> List[Dict]:
        """
        Raffiner les corrélations causales avec analyse temporelle
        
        Note: Version simplifiée pour MVP. L'intégration complète de Merlion
        nécessitera l'utilisation de ses modèles de causalité.
        
        Args:
            correlations: Corrélations brutes du CorrelationEngineV2
            timeline: Timeline complète
            threshold: Seuil minimum de causalité
            
        Returns:
            Corrélations raffinées avec causal_score
        """
        refined = []
        events = timeline.get('events', [])
        
        if not events:
            return correlations
        
        for corr in correlations:
            # Calculer causal_score basé sur :
            # 1. La régularité du lag
            # 2. La fréquence de co-occurrence
            # 3. L'absence d'inversions temporelles
            
            cause = corr.get('cause')
            effect = corr.get('effect')
            strength = corr.get('strength', 0)
            lag = corr.get('lag', 0)
            
            # Analyser la régularité temporelle
            regularity_score = self._calculate_regularity(cause, effect, events, lag)
            
            # Score de causalité = moyenne pondérée
            causal_score = (
                strength * 0.6 +
                regularity_score * 0.4
            )
            
            if causal_score >= threshold:
                refined_corr = {
                    **corr,
                    "causal_score": round(causal_score, 3),
                    "regularity": round(regularity_score, 3),
                    "anomalies": []  # Sera rempli si nécessaire
                }
                refined.append(refined_corr)
        
        # Trier par causal_score décroissant
        refined.sort(key=lambda x: x['causal_score'], reverse=True)
        
        return refined
    
    def _calculate_regularity(
        self,
        cause: str,
        effect: str,
        events: List[Dict],
        expected_lag: int
    ) -> float:
        """
        Calculer la régularité temporelle d'une corrélation causale
        
        Args:
            cause: Pattern cause
            effect: Pattern effet
            events: Liste des events de la timeline
            expected_lag: Lag attendu (en commits)
            
        Returns:
            Score de régularité (0-1)
        """
        observed_lags = []
        
        # Vérifier que expected_lag est valide
        if expected_lag is None or expected_lag < 0:
            expected_lag = 1
        
        # Chercher toutes les occurrences de cause → effect
        for i, event in enumerate(events):
            patterns = event.get('patterns', [])
            
            if cause in patterns:
                # Chercher effect dans les N prochains events
                search_window = min(expected_lag + 3, len(events) - i - 1)
                
                for j in range(1, max(1, search_window + 1)):
                    if i + j < len(events):
                        future_patterns = events[i + j].get('patterns', [])
                        if effect in future_patterns:
                            observed_lags.append(j)
                            break
        
        if not observed_lags:
            return 0.0
        
        # Calculer variance des lags
        avg_lag = sum(observed_lags) / len(observed_lags)
        variance = sum((lag - avg_lag) ** 2 for lag in observed_lags) / len(observed_lags)
        std_dev = variance ** 0.5
        
        # Score = inverse de la variance normalisée
        regularity = max(0.0, 1.0 - (std_dev / (expected_lag + 1)))
        
        return regularity
    
    def _detect_anomalies(self, timeline: Dict) -> List[Dict]:
        """
        Détecter les anomalies temporelles dans la timeline
        
        Note: Version simplifiée pour MVP. L'intégration complète de Merlion
        utilisera ses modèles d'anomaly detection.
        
        Args:
            timeline: Timeline complète
            
        Returns:
            Liste d'anomalies détectées
        """
        anomalies = []
        events = timeline.get('events', [])
        
        if len(events) < 5:
            return anomalies
        
        # Détecter patterns inhabituels (fréquence basse)
        pattern_counts = {}
        for event in events:
            for pattern in event.get('patterns', []):
                pattern_counts[pattern] = pattern_counts.get(pattern, 0) + 1
        
        total_patterns = sum(pattern_counts.values())
        
        # Identifier patterns rares (< 5% fréquence)
        for event in events:
            t = event.get('t', 0)
            for pattern in event.get('patterns', []):
                frequency = pattern_counts[pattern] / total_patterns
                
                if frequency < 0.05:  # Pattern rare
                    severity = 1.0 - frequency  # Plus rare = plus sévère
                    
                    anomalies.append({
                        "pattern": pattern,
                        "t": t,
                        "commit": event.get('commit', 'unknown'),
                        "severity": round(severity, 3),
                        "type": "rare_pattern"
                    })
        
        # Limiter à 10 anomalies les plus sévères
        anomalies.sort(key=lambda x: x['severity'], reverse=True)
        return anomalies[:10]
    
    def _update_versions(self, repo: str, duration_ms: int):
        """
        Mettre à jour bridges_versions.json avec les métriques
        
        Args:
            repo: Nom du repo traité
            duration_ms: Durée d'exécution
        """
        try:
            versions_file = '.reasoning_rl4/meta/bridges_versions.json'
            
            with open(versions_file, 'r') as f:
                versions = json.load(f)
            
            if 'merlion' in versions.get('bridges', {}):
                merlion_data = versions['bridges']['merlion']
                
                # Calculer durée moyenne
                if merlion_data.get('avg_duration_ms'):
                    old_avg = merlion_data['avg_duration_ms']
                    merlion_data['avg_duration_ms'] = int((old_avg + duration_ms) / 2)
                else:
                    merlion_data['avg_duration_ms'] = duration_ms
                
                # Hash du résultat
                result_hash = hashlib.sha256(
                    f"{self.correlations_refined}:{self.anomalies_found}".encode()
                ).hexdigest()[:8]
                merlion_data['result_hash'] = result_hash
                merlion_data['last_used'] = datetime.utcnow().isoformat() + 'Z'
                merlion_data['status'] = 'active'
                
                versions['meta']['last_updated'] = datetime.utcnow().isoformat() + 'Z'
                
                with open(versions_file, 'w') as f:
                    json.dump(versions, f, indent=2)
                
                logger.debug("Updated bridges_versions.json for Merlion")
                
        except Exception as e:
            logger.warning(f"Failed to update bridges_versions.json: {e}")


def main():
    """Point d'entrée principal"""
    try:
        # Lire input JSON depuis stdin
        input_data = json.load(sys.stdin)
        
        # Créer le bridge et traiter
        bridge = MerlionBridge()
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

