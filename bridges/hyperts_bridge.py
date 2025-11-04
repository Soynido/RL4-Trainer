#!/usr/bin/env python3
"""
HyperTS Bridge - Forecast Layer

Bridge Python pour intégrer HyperTS (Time Series Forecasting) dans ForecastEngineV3.

Ce bridge ajoute une **couche probabiliste ML** aux forecasts natifs du RL4
en appliquant des modèles éprouvés de time-series forecasting.

Input (stdin JSON):
{
  "repo": "repo-name",
  "forecasts": [
    {"predicted": "test", "confidence": 0.6, "horizon": 3}
  ],
  "timeline": {
    "events": [...]
  },
  "config": {
    "forecast_horizon": 5,
    "min_confidence": 0.4
  }
}

Output (stdout JSON):
{
  "success": true,
  "data": {
    "enriched_forecasts": [
      {
        "predicted": "test",
        "confidence": 0.72,
        "horizon": 3,
        "ml_probability": 0.68,
        "vraisemblance": 0.85
      }
    ]
  },
  "metadata": {
    "duration_ms": 1876,
    "forecasts_enriched": 5,
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
    format='[%(asctime)s] [%(levelname)s] [HYPERTS] %(message)s',
    handlers=[
        logging.FileHandler('.reasoning_rl4/logs/bridges/hyperts.log'),
        logging.StreamHandler(sys.stderr)
    ]
)
logger = logging.getLogger(__name__)


class HyperTSBridge:
    """Bridge pour HyperTS - Time Series Forecasting"""
    
    VERSION = "1.0.0"
    
    def __init__(self):
        self.start_time = None
        self.forecasts_enriched = 0
        
    def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Enrichir les forecasts avec des probabilités ML
        
        Args:
            input_data: Données d'entrée (repo, forecasts, timeline, config)
            
        Returns:
            Forecasts enrichis avec probabilités ML
        """
        self.start_time = time.time()
        
        repo = input_data.get('repo', 'unknown')
        forecasts = input_data.get('forecasts', [])
        timeline = input_data.get('timeline', {})
        config = input_data.get('config', {})
        
        forecast_horizon = config.get('forecast_horizon', 5)
        min_confidence = config.get('min_confidence', 0.4)
        
        logger.info(f"Processing repo: {repo}, forecasts: {len(forecasts)}")
        
        try:
            # Enrichir les forecasts avec ML
            enriched = self._enrich_forecasts(forecasts, timeline, forecast_horizon, min_confidence)
            self.forecasts_enriched = len(enriched)
            
            duration_ms = int((time.time() - self.start_time) * 1000)
            
            # Mettre à jour bridges_versions.json
            self._update_versions(repo, duration_ms)
            
            logger.info(f"Enriched {self.forecasts_enriched} forecasts in {duration_ms}ms")
            
            return {
                "success": True,
                "data": {
                    "enriched_forecasts": enriched
                },
                "metadata": {
                    "duration_ms": duration_ms,
                    "forecasts_enriched": self.forecasts_enriched,
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
    
    def _enrich_forecasts(
        self,
        forecasts: List[Dict],
        timeline: Dict,
        horizon: int,
        min_confidence: float
    ) -> List[Dict]:
        """
        Enrichir les forecasts avec probabilités ML
        
        Note: Version simplifiée pour MVP. L'intégration complète de HyperTS
        utilisera ses modèles de forecasting.
        
        Args:
            forecasts: Forecasts natifs du ForecastEngineV3
            timeline: Timeline complète
            horizon: Horizon de prédiction
            min_confidence: Confidence minimum
            
        Returns:
            Forecasts enrichis avec ml_probability et vraisemblance
        """
        enriched = []
        events = timeline.get('events', [])
        
        # Calculer fréquences historiques des patterns
        pattern_frequencies = self._calculate_pattern_frequencies(events)
        
        for forecast in forecasts:
            predicted = forecast.get('predicted')
            native_confidence = forecast.get('confidence', 0)
            forecast_horizon = forecast.get('horizon', horizon)
            
            # Calculer probabilité ML basée sur fréquence historique
            historical_freq = pattern_frequencies.get(predicted, 0)
            
            # Ajuster par horizon (plus loin = moins certain)
            horizon_decay = max(0.3, 1.0 - (forecast_horizon * 0.1))
            ml_probability = historical_freq * horizon_decay
            
            # Vraisemblance = moyenne des deux confidences
            vraisemblance = (native_confidence + ml_probability) / 2
            
            if vraisemblance >= min_confidence:
                enriched_forecast = {
                    **forecast,
                    "ml_probability": round(ml_probability, 3),
                    "vraisemblance": round(vraisemblance, 3),
                    "historical_frequency": round(historical_freq, 3)
                }
                enriched.append(enriched_forecast)
        
        # Trier par vraisemblance décroissante
        enriched.sort(key=lambda x: x['vraisemblance'], reverse=True)
        
        return enriched
    
    def _calculate_pattern_frequencies(self, events: List[Dict]) -> Dict[str, float]:
        """
        Calculer les fréquences historiques des patterns
        
        Args:
            events: Liste des events de la timeline
            
        Returns:
            Dict pattern → fréquence (0-1)
        """
        pattern_counts = {}
        total_patterns = 0
        
        for event in events:
            for pattern in event.get('patterns', []):
                pattern_counts[pattern] = pattern_counts.get(pattern, 0) + 1
                total_patterns += 1
        
        if total_patterns == 0:
            return {}
        
        # Normaliser en fréquences
        frequencies = {
            pattern: count / total_patterns
            for pattern, count in pattern_counts.items()
        }
        
        return frequencies
    
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
            
            if 'hyperts' in versions.get('bridges', {}):
                hyperts_data = versions['bridges']['hyperts']
                
                # Calculer durée moyenne
                if hyperts_data.get('avg_duration_ms'):
                    old_avg = hyperts_data['avg_duration_ms']
                    hyperts_data['avg_duration_ms'] = int((old_avg + duration_ms) / 2)
                else:
                    hyperts_data['avg_duration_ms'] = duration_ms
                
                # Hash du résultat
                result_hash = hashlib.sha256(
                    str(self.forecasts_enriched).encode()
                ).hexdigest()[:8]
                hyperts_data['result_hash'] = result_hash
                hyperts_data['last_used'] = datetime.utcnow().isoformat() + 'Z'
                hyperts_data['status'] = 'active'
                
                versions['meta']['last_updated'] = datetime.utcnow().isoformat() + 'Z'
                
                with open(versions_file, 'w') as f:
                    json.dump(versions, f, indent=2)
                
                logger.debug("Updated bridges_versions.json for HyperTS")
                
        except Exception as e:
            logger.warning(f"Failed to update bridges_versions.json: {e}")


def main():
    """Point d'entrée principal"""
    try:
        # Lire input JSON depuis stdin
        input_data = json.load(sys.stdin)
        
        # Créer le bridge et traiter
        bridge = HyperTSBridge()
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

