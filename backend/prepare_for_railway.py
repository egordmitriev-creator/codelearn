#!/usr/bin/env python3
"""
Запусти этот скрипт из папки codelearn/backend/
чтобы подготовить app.py к деплою на Railway:

    python3 prepare_for_railway.py
"""
import re, os

path = os.path.join(os.path.dirname(__file__), 'app.py')

with open(path, 'r') as f:
    content = f.read()

# 1. Заменяем CORS на разрешение любых origins (Railway даёт случайный URL)
content = content.replace(
    "CORS(app, origins=\"*\")",
    "CORS(app, origins=\"*\", supports_credentials=True)"
)

# 2. Заменяем блок запуска — Railway передаёт PORT через переменную окружения
old_main = '''if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=8000)'''

new_main = '''if __name__ == '__main__':
    import os
    init_db()
    port = int(os.environ.get('PORT', 8000))
    debug = os.environ.get('FLASK_ENV') != 'production'
    app.run(host='0.0.0.0', port=port, debug=debug)'''

if old_main in content:
    content = content.replace(old_main, new_main)
    print("✓ Блок запуска обновлён")
else:
    print("⚠ Блок запуска не найден — проверь вручную:")
    print("  Замени последние строки app.py на:")
    print(new_main)

# 3. DB_PATH — на Railway файловая система эфемерна,
#    используем /tmp или переменную окружения DATABASE_URL
old_db = "DB_PATH = os.path.join(os.path.dirname(__file__), 'codelearn.db')"
new_db = "DB_PATH = os.environ.get('DB_PATH', os.path.join(os.path.dirname(__file__), 'codelearn.db'))"

if old_db in content:
    content = content.replace(old_db, new_db)
    print("✓ DB_PATH обновлён")

with open(path, 'w') as f:
    f.write(content)

print("\n✅ app.py готов к деплою на Railway!")
print("   Не забудь добавить railway.toml в папку backend/")
