# Development Scripts

## Quick Start

```bash
# Start full dev environment (server + ngrok)
npm run dev:full

# Stop all services
npm run dev:stop

# Or use scripts directly
./scripts/dev-start.sh
./scripts/dev-stop.sh
```

## What `dev-start.sh` Does

1. **Cleanup** - Kills existing processes on port 3003 and any running ngrok instances
2. **Pre-flight checks** - Verifies `.env.local`, SSL certs, and TypeScript compilation
3. **Start HTTPS server** - Runs `node server.js` on port 3003
4. **Start ngrok tunnel** - Creates HTTPS public URL for iPhone testing
5. **Health checks** - Validates both local and ngrok endpoints
6. **Display info** - Shows public URL, local URL, and log file locations

## Output

The script will display:
- ✅ Public ngrok URL (for testing on iPhone)
- 🔒 Local HTTPS URL (for desktop browser)
- 📊 ngrok Web UI (http://localhost:4040)
- 📝 Log file locations
- 🛑 Process IDs for manual stopping

## Logs

Server and ngrok logs are written to:
- Server: `/tmp/gardening-whisperer-server.log`
- ngrok: `/tmp/gardening-whisperer-ngrok.log`

View logs in real-time:
```bash
tail -f /tmp/gardening-whisperer-server.log
tail -f /tmp/gardening-whisperer-ngrok.log
```

## Requirements

- Node.js installed
- ngrok installed (`brew install ngrok` on macOS)
- `.env.local` with API keys (copy from `.env.example`)
- SSL certificates in `.cert/` directory

## Troubleshooting

**Server fails to start:**
- Check that port 3003 is not in use: `lsof -ti:3003`
- Verify SSL certs exist: `ls -la .cert/`
- Check server logs: `cat /tmp/gardening-whisperer-server.log`

**ngrok fails to start:**
- Verify ngrok is installed: `which ngrok`
- Check ngrok logs: `cat /tmp/gardening-whisperer-ngrok.log`
- Visit ngrok dashboard: http://localhost:4040

**TypeScript errors:**
- The script continues even with TS errors (warnings only)
- Fix errors with: `npx tsc --noEmit` and review output

## Manual Cleanup

If scripts don't stop cleanly:
```bash
# Kill by port
lsof -ti:3003 | xargs kill -9

# Kill ngrok
pkill -f ngrok

# Clean up temp files
rm /tmp/gardening-whisperer-*.log
rm /tmp/gardening-whisperer-pids.txt
```
