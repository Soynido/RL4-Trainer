#!/bin/bash

# 🔁 Watch Guard - Surveillance continue du workspace
# Lance le guard.sh toutes les 5 minutes

echo "🛡️  Starting RL4 Memory Watchdog..."
echo "   Checking workspace size every 5 minutes"
echo "   Max size: 9.5 GB"
echo "   Press Ctrl+C to stop"
echo ""

while true; do
  bash scripts/guard.sh
  echo ""
  echo "⏱️  Next check in 5 minutes..."
  sleep 300
done

