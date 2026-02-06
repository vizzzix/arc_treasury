#!/bin/bash
set -e

echo "==========================================="
echo "  Arc Treasury — VPS Setup"
echo "==========================================="

APP_DIR="/opt/arc-treasury"

# 1. Create app directory
echo "[1/6] Creating app directory..."
mkdir -p $APP_DIR

# 2. Clone or update repo
if [ -d "$APP_DIR/.git" ]; then
  echo "[2/6] Updating existing repo..."
  cd $APP_DIR
  git pull origin master
else
  echo "[2/6] Cloning repository..."
  git clone https://github.com/vizzzix/arc-treasury.git $APP_DIR
  cd $APP_DIR
fi

# 3. Install dependencies for bots
echo "[3/6] Installing bot dependencies..."
cd $APP_DIR/railway-bot
npm install --production

# Install tsx globally if not present
if ! command -v tsx &> /dev/null; then
  echo "  Installing tsx globally..."
  npm install -g tsx
fi

# Install dependencies for indexer
echo "  Installing indexer dependencies..."
cd $APP_DIR/indexer
npm install --production

# 4. Check .env
echo "[4/6] Checking .env..."
if [ ! -f "$APP_DIR/.env" ]; then
  echo ""
  echo "  ERROR: .env file not found!"
  echo "  Copy your .env to $APP_DIR/.env before continuing."
  echo "  Required vars: PRIVATE_KEY, SUPABASE_URL, SUPABASE_Key,"
  echo "  VITE_TELEGRAM_BOT_TOKEN, VITE_TELEGRAM_CHAT_ID,"
  echo "  OPENAI_API_KEY, TWITTER_*, FIXER_API_KEY"
  echo ""
  exit 1
fi
echo "  .env found"

# 5. Install systemd services
echo "[5/6] Installing systemd services..."
cp $APP_DIR/deploy/arc-bots.service /etc/systemd/system/
cp $APP_DIR/deploy/arc-points-bot.service /etc/systemd/system/
cp $APP_DIR/deploy/arc-rebalance-bot.service /etc/systemd/system/
cp $APP_DIR/deploy/arc-indexer.service /etc/systemd/system/

systemctl daemon-reload

# 6. Enable and start services
echo "[6/6] Starting services..."
systemctl enable arc-bots arc-points-bot arc-rebalance-bot arc-indexer
systemctl restart arc-bots
systemctl restart arc-points-bot
systemctl restart arc-rebalance-bot
systemctl restart arc-indexer

# Wait a moment for services to start
sleep 3

echo ""
echo "==========================================="
echo "  Status"
echo "==========================================="
systemctl status arc-bots --no-pager -l | head -10
echo "---"
systemctl status arc-points-bot --no-pager -l | head -10
echo "---"
systemctl status arc-rebalance-bot --no-pager -l | head -10
echo "---"
systemctl status arc-indexer --no-pager -l | head -10

echo ""
echo "==========================================="
echo "  Done! Useful commands:"
echo "==========================================="
echo "  journalctl -u arc-bots -f          # Telegram bot logs"
echo "  journalctl -u arc-points-bot -f    # Points bot logs"
echo "  journalctl -u arc-rebalance-bot -f # Rebalance bot logs"
echo "  journalctl -u arc-indexer -f       # Ponder indexer logs"
echo "  systemctl restart arc-bots         # Restart telegram bot"
echo "  systemctl status arc-*             # Status of all"
echo ""
echo "  After confirming everything works, disable Railway services."
