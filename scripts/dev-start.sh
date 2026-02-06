#!/bin/bash

# Gardening Whisperer Development Startup Script
# Kills existing processes, starts server, starts zrok tunnel, and validates health

set -e  # Exit on error

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🌱 Starting Gardening Whisperer Development Environment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ================================
# 1. CLEANUP
# ================================
echo "🧹 Cleaning up existing processes..."

# Kill existing Node processes on port 3003
if lsof -ti:3003 >/dev/null 2>&1; then
    echo "  ↳ Killing process on port 3003..."
    lsof -ti:3003 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# Kill existing zrok processes
if pgrep -f "zrok share" >/dev/null 2>&1; then
    echo "  ↳ Killing zrok processes..."
    pkill -f "zrok share" 2>/dev/null || true
    sleep 1
fi

echo -e "${GREEN}✓ Cleanup complete${NC}"
echo ""

# ================================
# 2. PRE-FLIGHT CHECKS
# ================================
echo "🔍 Running pre-flight checks..."

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo -e "${RED}✗ .env.local not found${NC}"
    echo "  Please copy .env.example to .env.local and add your API keys"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠ node_modules not found, running npm install...${NC}"
    npm install
fi

# TypeScript compilation check
echo "  ↳ Checking TypeScript compilation..."
if ! npx tsc --noEmit 2>&1 | head -20; then
    echo -e "${YELLOW}⚠ TypeScript has errors (continuing anyway)${NC}"
else
    echo -e "${GREEN}✓ TypeScript compiles cleanly${NC}"
fi

echo -e "${GREEN}✓ Pre-flight checks complete${NC}"
echo ""

# ================================
# 3. START SERVER
# ================================
echo "🚀 Starting HTTPS server on port 3003..."

# Start server in background
node server.js > /tmp/gardening-whisperer-server.log 2>&1 &
SERVER_PID=$!

# Wait for server to be ready (max 30 seconds)
WAIT_TIME=0
MAX_WAIT=30
while [ $WAIT_TIME -lt $MAX_WAIT ]; do
    if grep -q "Ready on http://0.0.0.0:3003" /tmp/gardening-whisperer-server.log 2>/dev/null; then
        echo -e "${GREEN}✓ Server started successfully (PID: $SERVER_PID)${NC}"
        break
    fi
    sleep 1
    WAIT_TIME=$((WAIT_TIME + 1))
    echo -n "."
done

if [ $WAIT_TIME -eq $MAX_WAIT ]; then
    echo -e "${RED}✗ Server failed to start within ${MAX_WAIT}s${NC}"
    echo "Server logs:"
    tail -20 /tmp/gardening-whisperer-server.log
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi

echo ""
echo "  📝 Server logs: tail -f /tmp/gardening-whisperer-server.log"
echo ""

# ================================
# 4. START ZROK
# ================================
echo "🌐 Starting zrok tunnel..."

# Check if zrok is installed
if ! command -v zrok &> /dev/null; then
    echo -e "${RED}✗ zrok not found${NC}"
    echo "  Install from: https://zrok.io"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi

# Start zrok in background (HTTPS public URL pointing to HTTP localhost)
zrok share public http://localhost:3003 --headless > /tmp/gardening-whisperer-zrok.log 2>&1 &
ZROK_PID=$!

# Wait for zrok to be ready (max 10 seconds)
WAIT_TIME=0
MAX_WAIT=10
while [ $WAIT_TIME -lt $MAX_WAIT ]; do
    if grep -q "access your zrok share" /tmp/gardening-whisperer-zrok.log 2>/dev/null; then
        echo -e "${GREEN}✓ zrok started successfully (PID: $ZROK_PID)${NC}"
        break
    fi
    sleep 1
    WAIT_TIME=$((WAIT_TIME + 1))
    echo -n "."
done

if [ $WAIT_TIME -eq $MAX_WAIT ]; then
    echo -e "${RED}✗ zrok failed to start within ${MAX_WAIT}s${NC}"
    kill $SERVER_PID 2>/dev/null || true
    kill $ZROK_PID 2>/dev/null || true
    exit 1
fi

echo ""

# Get zrok public URL from log file
sleep 2  # Give zrok a moment to be ready
ZROK_URL=$(grep -o 'https://[^"]*\.share\.zrok\.io' /tmp/gardening-whisperer-zrok.log | head -1)

if [ -z "$ZROK_URL" ]; then
    echo -e "${RED}✗ Could not retrieve zrok URL${NC}"
    echo "  Check zrok logs: tail -f /tmp/gardening-whisperer-zrok.log"
    kill $SERVER_PID 2>/dev/null || true
    kill $ZROK_PID 2>/dev/null || true
    exit 1
fi

echo -e "${GREEN}✓ zrok tunnel established${NC}"
echo ""

# ================================
# 5. HEALTH CHECK
# ================================
echo "🏥 Running health checks..."

# Check local HTTP endpoint
if curl -s http://localhost:3003 >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Local HTTP endpoint responding${NC}"
else
    echo -e "${RED}✗ Local HTTP endpoint not responding${NC}"
fi

# Check zrok tunnel
if curl -s "$ZROK_URL" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ zrok tunnel responding${NC}"
else
    echo -e "${YELLOW}⚠ zrok tunnel not responding yet (give it a moment)${NC}"
fi

echo ""

# ================================
# 6. SUMMARY
# ================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Development environment ready!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌍 Public URL (for iPhone testing):"
echo -e "   ${GREEN}${ZROK_URL}${NC}"
echo ""
echo "🔒 Local HTTP URL:"
echo "   http://localhost:3003"
echo ""
echo "📝 Logs:"
echo "   Server:  tail -f /tmp/gardening-whisperer-server.log"
echo "   zrok:    tail -f /tmp/gardening-whisperer-zrok.log"
echo ""
echo "🛑 To stop all services:"
echo "   kill $SERVER_PID $ZROK_PID"
echo "   or run: npm run dev:stop"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Save PIDs for stop script
echo "$SERVER_PID $ZROK_PID" > /tmp/gardening-whisperer-pids.txt

# Keep script running and forward signals
trap "kill $SERVER_PID $ZROK_PID 2>/dev/null; exit" INT TERM

# Follow server logs
echo ""
echo "Following server logs (Ctrl+C to stop)..."
echo ""
tail -f /tmp/gardening-whisperer-server.log
