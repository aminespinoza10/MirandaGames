#!/usr/bin/env bash
# Publishes games/<game> to the home nginx server at http://<host>/<game>/.
#
#   ./scripts/deploy.sh happy-game
#
# Settings (environment variables override deploy.env, which overrides the defaults below):
#   DEPLOY_HOST      server address               (default 192.168.68.77)
#   DEPLOY_USER      SSH user                     (default aminespinoza)
#   DEPLOY_KEY       SSH private key              (default ~/.ssh/id_home_ubuntu; skipped if missing)
#   DEPLOY_WEBROOT   nginx root on the server     (default /var/www/html)
#   DEPLOY_URL       public base URL              (default http://$DEPLOY_HOST)
#
# Never uses sudo and never asks for a password: SSH runs in batch mode with key auth.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GAMES_DIR="$REPO_ROOT/games"

say() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

list_games() {
  echo "Available games:" >&2
  for dir in "$GAMES_DIR"/*/; do
    [[ -f "$dir/index.html" ]] && echo "  $(basename "$dir")" >&2
  done
}

# --- settings ---------------------------------------------------------------

# deploy.env is read as KEY=value lines (not executed). Variables already set in the environment win.
if [[ -f "$REPO_ROOT/deploy.env" ]]; then
  while IFS= read -r line; do
    [[ $line =~ ^[[:space:]]*(DEPLOY_[A-Z_]+)[[:space:]]*=[[:space:]]*(.*)$ ]] || continue
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    value="${value%"${value##*[![:space:]]}"}"
    value="${value#\"}"; value="${value%\"}"
    value="${value#\'}"; value="${value%\'}"
    [[ -n "${!key+x}" ]] || export "$key=$value"
  done < "$REPO_ROOT/deploy.env"
fi

DEPLOY_HOST="${DEPLOY_HOST:-192.168.68.77}"
DEPLOY_USER="${DEPLOY_USER:-aminespinoza}"
DEPLOY_KEY="${DEPLOY_KEY:-$HOME/.ssh/id_home_ubuntu}"
DEPLOY_KEY="${DEPLOY_KEY/#\~/$HOME}"
DEPLOY_WEBROOT="${DEPLOY_WEBROOT:-/var/www/html}"
DEPLOY_URL="${DEPLOY_URL:-http://$DEPLOY_HOST}"
DEPLOY_URL="${DEPLOY_URL%/}"

# --- validate inputs before touching the network ----------------------------

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <game>" >&2
  list_games
  exit 2
fi
GAME="$1"

if [[ ! $GAME =~ ^[a-z0-9-]+$ ]]; then
  echo "error: game name must be lowercase letters, digits and dashes: '$GAME'" >&2
  list_games
  exit 2
fi
GAME_DIR="$GAMES_DIR/$GAME"
if [[ ! -f "$GAME_DIR/index.html" ]]; then
  echo "error: no game named '$GAME' (expected $GAME_DIR/index.html)" >&2
  list_games
  exit 2
fi

# The upload uses --delete, so the target must be exactly <webroot>/<game> and nothing broader.
DEPLOY_WEBROOT="${DEPLOY_WEBROOT%/}"
if [[ ! $DEPLOY_WEBROOT =~ ^(/[A-Za-z0-9._-]+)+$ ]] || [[ $DEPLOY_WEBROOT =~ (^|/)\.\.?(/|$) ]]; then
  fail "unsafe DEPLOY_WEBROOT '$DEPLOY_WEBROOT': must be an absolute path like /var/www/html, without '.' or '..' parts"
fi
TARGET="$DEPLOY_WEBROOT/$GAME"

for tool in ssh rsync curl npm; do
  command -v "$tool" >/dev/null || fail "'$tool' is required but not installed"
done

SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=8)
[[ -f "$DEPLOY_KEY" ]] && SSH_OPTS+=(-i "$DEPLOY_KEY")
REMOTE="$DEPLOY_USER@$DEPLOY_HOST"

# --- 1. tests -----------------------------------------------------------------

say "Testing $GAME"
if [[ -f "$GAME_DIR/package.json" ]]; then
  (cd "$GAME_DIR" && npm test --silent) || fail "tests failed; nothing was deployed"
else
  echo "   (no package.json, no tests to run)"
fi

# --- 2. server folder ready? ----------------------------------------------------

say "Checking $REMOTE:$TARGET"
set +e
ssh "${SSH_OPTS[@]}" "$REMOTE" "test -d '$TARGET' && test -w '$TARGET'"
status=$?
set -e
if [[ $status -eq 255 ]]; then
  fail "could not SSH to $REMOTE. Check the server is on and that key login works: ssh ${SSH_OPTS[*]} $REMOTE"
elif [[ $status -ne 0 ]]; then
  key_flag=""
  [[ -f "$DEPLOY_KEY" ]] && key_flag="-i $DEPLOY_KEY "
  cat >&2 <<EOF
error: $TARGET doesn't exist on the server or $DEPLOY_USER can't write to it.
One-time setup: run this on the server (it asks for your sudo password):

    ssh -t $key_flag$REMOTE "sudo mkdir -p $TARGET && sudo chown $DEPLOY_USER: $TARGET"

Then run this deploy again.
EOF
  exit 1
fi

# --- 3. stage ---------------------------------------------------------------------

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

sha="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo nogit)"
if [[ -n "$(git -C "$REPO_ROOT" status --porcelain -- "games/$GAME" 2>/dev/null)" ]]; then
  sha="$sha-dirty"
fi
BUILD="$sha-$(date -u +%Y%m%dT%H%M%SZ)"

rsync -a \
  --exclude='.*' \
  --exclude='test/' \
  --exclude='tools/' \
  --exclude='node_modules/' \
  --exclude='package.json' \
  --exclude='package-lock.json' \
  --exclude='README.md' \
  --exclude='*.test.js' \
  "$GAME_DIR/" "$STAGE/"
printf '{ "build": "%s" }\n' "$BUILD" > "$STAGE/build.json"

# --- 4. upload --------------------------------------------------------------------

say "Uploading build $BUILD"
# --checksum without preserved mtimes: changed files get a fresh Last-Modified, so browsers revalidate sooner.
rsync -rlz --checksum --delete --chmod=D755,F644 \
  -e "ssh ${SSH_OPTS[*]}" \
  "$STAGE/" "$REMOTE:$TARGET/"

# --- 5. verify --------------------------------------------------------------------

GAME_URL="$DEPLOY_URL/$GAME/"
say "Verifying $GAME_URL"

check() { # url expected-content-type-substring
  local result code type
  result="$(curl -sS -o /dev/null -w '%{http_code} %{content_type}' -H 'Cache-Control: no-cache' "$1")" || fail "could not reach $1"
  code="${result%% *}"
  type="${result#* }"
  [[ $code == 200 ]] || fail "$1 returned HTTP $code"
  [[ $type == *"$2"* ]] || fail "$1 returned '$type', expected $2"
  echo "   ok  $code  $type  $1"
}
check "$GAME_URL" "text/html"
check "${GAME_URL}assets/manifest.json" "application/json"

served="$(curl -sS -H 'Cache-Control: no-cache' "${GAME_URL}build.json")"
[[ $served == *"$BUILD"* ]] || fail "server is not serving the new build.json (got: $served)"
echo "   ok  build.json is $BUILD"

say "Deployed: $GAME_URL"
