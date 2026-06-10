#!/bin/bash

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ROOT="$(cd "$(dirname "$0")" && pwd)"
export PATH="$PATH:$HOME/Library/Python/3.9/bin:$HOME/Library/Python/3.10/bin:$HOME/Library/Python/3.11/bin:$HOME/.local/bin"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║      CodeLearn — Запуск платформы    ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
echo ""

# ── Проверка зависимостей ──────────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
  echo -e "${RED}✗ Python3 не найден. Установите с https://python.org${NC}"; exit 1
fi
echo -e "${GREEN}✓ Python3: $(python3 --version)${NC}"

if ! command -v node &>/dev/null; then
  echo -e "${RED}✗ Node.js не найден. Установите с https://nodejs.org${NC}"; exit 1
fi
echo -e "${GREEN}✓ Node.js: $(node --version)${NC}"

# ── Освобождаем порты ──────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}▶ Освобождаю порты 8000 и 3000...${NC}"
for PORT in 8000 3000; do
  PIDS=$(lsof -ti:$PORT 2>/dev/null)
  if [ -n "$PIDS" ]; then
    echo "$PIDS" | xargs kill -9 2>/dev/null
    echo -e "${GREEN}  ✓ Порт $PORT освобождён${NC}"
  fi
done

# ── Зависимости ────────────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}▶ Устанавливаю зависимости бэкенда...${NC}"
cd "$ROOT/backend"
pip3 install -q -r requirements.txt
echo -e "${GREEN}✓ Бэкенд-зависимости установлены${NC}"

echo ""
echo -e "${YELLOW}▶ Устанавливаю зависимости фронтенда...${NC}"
cd "$ROOT/frontend"
npm install --silent
echo -e "${GREEN}✓ Фронтенд-зависимости установлены${NC}"

# ── Запуск серверов ────────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}▶ Запускаю серверы...${NC}"
echo ""

# Бэкенд
cd "$ROOT/backend"
python3 app.py > "$ROOT/backend.log" 2>&1 &
BACKEND_PID=$!

# Ждём пока бэкенд ответит (до 20 сек)
echo -e "${YELLOW}  Жду запуска бэкенда...${NC}"
for i in $(seq 1 20); do
  if curl -s http://localhost:8000/api/auth/me >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}✗ Бэкенд упал. Лог:${NC}"
    cat "$ROOT/backend.log"
    exit 1
  fi
done
echo -e "${GREEN}✓ Бэкенд запущен (PID $BACKEND_PID) — http://localhost:8000${NC}"

# Фронтенд
cd "$ROOT/frontend"
npm run dev > "$ROOT/frontend.log" 2>&1 &
FRONTEND_PID=$!

# Ждём пока фронтенд поднимется (до 20 сек)
for i in $(seq 1 20); do
  if curl -s http://localhost:3000 >/dev/null 2>&1; then
    break
  fi
done
echo -e "${GREEN}✓ Фронтенд запущен (PID $FRONTEND_PID) — http://localhost:3000${NC}"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Платформа запущена.                                 ║${NC}"
echo -e "${CYAN}║                                                      ║${NC}"
echo -e "${CYAN}║  Открой в браузере: http://localhost:3000            ║${NC}"
echo -e "${CYAN}║                                                      ║${NC}"
echo -e "${CYAN}║  Демо-аккаунты:                                      ║${NC}"
echo -e "${CYAN}║  teacher / teacher123  (преподаватель)               ║${NC}"
echo -e "${CYAN}║  student / student123  (студент)                     ║${NC}"
echo -e "${CYAN}║                                                      ║${NC}"
echo -e "${CYAN}║  Ctrl+C — остановить                                 ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

open http://localhost:3000

trap "echo ''; echo -e '${YELLOW}Останавливаю серверы...${NC}'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo -e '${GREEN}Готово.${NC}'; exit 0" INT TERM
wait
