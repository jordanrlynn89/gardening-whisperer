#!/bin/bash

# Gardening Whisperer Development Startup Script
# Kills existing processes, starts server, starts ngrok tunnel, and validates health

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

# Kill existing ngrok processes
if pgrep -f ngrok >/dev/null 2>&1; then
    echo "  ↳ Killing ngrok processes..."
    pkill -f ngrok 2>/dev/null || true
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

# Check if SSL certs exist
if [ ! -f ".cert/key.pem" ] || [ ! -f ".cert/cert.pem" ]; then
    echo -e "${RED}✗ SSL certificates not found in .cert/${NC}"
    echo "  The custom server requires SSL certificates for HTTPS"
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
    if grep -q "Ready on https://0.0.0.0:3003" /tmp/gardening-whisperer-server.log 2>/dev/null; then
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
# 4. START NGROK
# ================================
echo "🌐 Starting ngrok tunnel..."

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo -e "${RED}✗ ngrok not found${NC}"
    echo "  Install with: brew install ngrok (on macOS)"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi

# Start ngrok in background (HTTPS public URL pointing to HTTPS localhost)
ngrok http https://localhost:3003 --log stdout > /tmp/gardening-whisperer-ngrok.log 2>&1 &
NGROK_PID=$!

# Wait for ngrok to be ready (max 10 seconds)
WAIT_TIME=0
MAX_WAIT=10
while [ $WAIT_TIME -lt $MAX_WAIT ]; do
    if grep -q "started tunnel" /tmp/gardening-whisperer-ngrok.log 2>/dev/null; then
        echo -e "${GREEN}✓ ngrok started successfully (PID: $NGROK_PID)${NC}"
        break
    fi
    sleep 1
    WAIT_TIME=$((WAIT_TIME + 1))
    echo -n "."
done

if [ $WAIT_TIME -eq $MAX_WAIT ]; then
    echo -e "${RED}✗ ngrok failed to start within ${MAX_WAIT}s${NC}"
    kill $SERVER_PID 2>/dev/null || true
    kill $NGROK_PID 2>/dev/null || true
    exit 1
fi

echo ""

# Get ngrok public URL
sleep 2  # Give ngrok API a moment to be ready
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o 'https://[^"]*\.ngrok-free\.dev' | head -1)

if [ -z "$NGROK_URL" ]; then
    echo -e "${RED}✗ Could not retrieve ngrok URL${NC}"
    echo "  Check ngrok logs: tail -f /tmp/gardening-whisperer-ngrok.log"
    kill $SERVER_PID 2>/dev/null || true
    kill $NGROK_PID 2>/dev/null || true
    exit 1
fi

echo -e "${GREEN}✓ ngrok tunnel established${NC}"
echo ""

# ================================
# 5. HEALTH CHECK
# ================================
echo "🏥 Running health checks..."

# Check local HTTPS endpoint
if curl -sk https://localhost:3003 >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Local HTTPS endpoint responding${NC}"
else
    echo -e "${RED}✗ Local HTTPS endpoint not responding${NC}"
fi

# Check ngrok tunnel
if curl -s "$NGROK_URL" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ ngrok tunnel responding${NC}"
else
    echo -e "${YELLOW}⚠ ngrok tunnel not responding (might need to click 'Visit Site' on first request)${NC}"
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
echo -e "   ${GREEN}${NGROK_URL}${NC}"
echo ""
echo "🔒 Local HTTPS URL:"
echo "   https://localhost:3003"
echo ""
echo "📊 ngrok Web UI:"
echo "   http://localhost:4040"
echo ""
echo "📝 Logs:"
echo "   Server:  tail -f /tmp/gardening-whisperer-server.log"
echo "   ngrok:   tail -f /tmp/gardening-whisperer-ngrok.log"
echo ""
echo "🛑 To stop all services:"
echo "   kill $SERVER_PID $NGROK_PID"
echo "   or run: ./scripts/dev-stop.sh"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Save PIDs for stop script
echo "$SERVER_PID $NGROK_PID" > /tmp/gardening-whisperer-pids.txt

# Keep script running and forward signals
trap "kill $SERVER_PID $NGROK_PID 2>/dev/null; exit" INT TERM

# Follow server logs
echo ""
echo "Following server logs (Ctrl+C to stop)..."
echo ""
tail -f /tmp/gardening-whisperer-server.log
