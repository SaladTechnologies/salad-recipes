#!/bin/bash
set -e

# Required environment variables
if [[ -z "$POOL_URL" ]]; then
  echo "ERROR: Missing POOL_URL environment variable"
  echo "Format: stratum+tcp://pool.example.com:port or stratum+ssl://pool.example.com:port"
  exit 1
fi

if [[ -z "$WALLET" ]]; then
  echo "ERROR: Missing WALLET environment variable"
  echo "Please provide your wallet address"
  exit 1
fi

# Algorithm selection (default: AUTOLYKOS2 for Ergo)
ALGO="${ALGO:-AUTOLYKOS2}"

# Worker name (default: salad machine ID or generic name)
WORKER_NAME="${WORKER_NAME:-$SALAD_MACHINE_ID}"
WORKER_NAME="${WORKER_NAME:-lolminer-$(head -c 4 /dev/urandom | xxd -p)}"

# API port for monitoring
API_PORT="${API_PORT:-4068}"

# Additional miner arguments
EXTRA_ARGS="${EXTRA_ARGS:-}"

echo "============================================"
echo "lolMiner Multi-Algorithm GPU Miner"
echo "============================================"
echo "Algorithm: $ALGO"
echo "Pool: $POOL_URL"
echo "Wallet: $WALLET"
echo "Worker: $WORKER_NAME"
echo "API Port: $API_PORT"
echo "============================================"
echo ""

# Map common algorithm names to lolMiner format
case "${ALGO^^}" in
  AUTOLYKOS2|ERGO|ERG)
    ALGO="AUTOLYKOS2"
    ;;
  ETCHASH|ETC)
    ALGO="ETCHASH"
    ;;
  ETHASH)
    ALGO="ETHASH"
    ;;
  KAWPOW|RVN|RAVENCOIN)
    ALGO="KAWPOW"
    ;;
  KASPA|KAS|KHEAVYHASH)
    ALGO="KARLSENHASH"
    ;;
  FLUX|ZELCASH)
    ALGO="EQUI125_4"
    ;;
  BEAM)
    ALGO="BEAM-III"
    ;;
  FIROPOW|FIRO)
    ALGO="FIROPOW"
    ;;
  *)
    # Use as-is for other algorithms
    ;;
esac

echo "Starting lolMiner with algorithm: $ALGO"
echo ""

# Build and execute miner command
cd /miner
exec ./lolMiner \
  --algo "$ALGO" \
  --pool "$POOL_URL" \
  --user "${WALLET}.${WORKER_NAME}" \
  --apiport "$API_PORT" \
  $EXTRA_ARGS
