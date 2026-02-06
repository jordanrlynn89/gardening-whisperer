#!/bin/bash

# Stop Gardening Whisperer Development Environment

echo "🛑 Stopping Gardening Whisperer development environment..."

# Kill processes by saved PIDs
if [ -f /tmp/gardening-whisperer-pids.txt ]; then
    PIDS=$(cat /tmp/gardening-whisperer-pids.txt)
    for PID in $PIDS; do
        if kill -0 $PID 2>/dev/null; then
            echo "  ↳ Stopping process $PID..."
            kill $PID 2>/dev/null || true
        fi
    done
    rm /tmp/gardening-whisperer-pids.txt
fi

# Fallback: kill by port and process name
if lsof -ti:3003 >/dev/null 2>&1; then
    echo "  ↳ Killing process on port 3003..."
    lsof -ti:3003 | xargs kill -9 2>/dev/null || true
fi

if pgrep -f "zrok share" >/dev/null 2>&1; then
    echo "  ↳ Killing zrok processes..."
    pkill -f "zrok share" 2>/dev/null || true
fi

sleep 1

echo "✅ Stopped successfully"
