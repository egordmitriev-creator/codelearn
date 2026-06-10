from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
import sqlite3, os, subprocess, tempfile, json, hashlib, base64, secrets, shutil
from datetime import datetime, timedelta

app = Flask(__name__)
app.config['JWT_SECRET_KEY'] = 'codelearn-secret-key-2024'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
CORS(app, origins="*", supports_credentials=True)
jwt = JWTManager(app)

DB_PATH = os.environ.get('DB_PATH', os.path.join(os.path.dirname(__file__), 'codelearn.db'))
DOCKER_AVAILABLE = shutil.which('docker') is not None

def hash_password(password):
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 260000)
    return f"pbkdf2:{salt}:{base64.b64encode(key).decode()}"

def verify_password(stored, provided):
    try:
        _, salt, key_b64 = stored.split(':')
        key = hashlib.pbkdf2_hmac('sha256', provided.encode(), salt.encode(), 260000)
        return base64.b64encode(key).decode() == key_b64
    except Exception:
        return False

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# ── CODE RUNNER ───────────────────────────────────────────────────────────────

def run_code_docker(code: str, stdin_data: str, timeout: int = 10):
    """Run code in an isolated Docker container (production-safe)."""
    with tempfile.TemporaryDirectory() as tmpdir:
        code_file = os.path.join(tmpdir, 'solution.py')
        with open(code_file, 'w') as f:
            f.write(code)
        try:
            result = subprocess.run([
                'docker', 'run', '--rm',
                '-i',                          # stdin forwarding (required for input())
                '--network', 'none',           # no network access
                '--memory', '128m',            # max 128 MB RAM
                '--memory-swap', '128m',       # no swap
                '--cpus', '0.5',               # max 50% CPU
                '--pids-limit', '64',          # max 64 processes
                '-v', f'{tmpdir}:/code:ro',    # mount code read-only
                '-w', '/code',
                'python:3.11-slim',
                'python3', '-u', 'solution.py'
            ], input=stdin_data, capture_output=True, text=True, timeout=timeout)
            return {
                'stdout': result.stdout.strip(),
                'stderr': result.stderr.strip()[:500],
                'returncode': result.returncode,
                'runner': 'docker'
            }
        except subprocess.TimeoutExpired:
            return {'stdout': '', 'stderr': f'Превышено время выполнения ({timeout} сек)', 'returncode': -1, 'runner': 'docker'}
        except Exception as e:
            return {'stdout': '', 'stderr': str(e), 'returncode': -1, 'runner': 'docker'}

def run_code_subprocess(code: str, stdin_data: str, timeout: int = 5):
    """Fallback: run code via subprocess (dev mode, no isolation)."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(code)
        fname = f.name
    try:
        result = subprocess.run(
            ['python3', fname],
            input=stdin_data, capture_output=True, text=True, timeout=timeout
        )
        return {
            'stdout': result.stdout.strip(),
            'stderr': result.stderr.strip()[:500],
            'returncode': result.returncode,
            'runner': 'subprocess'
        }
    except subprocess.TimeoutExpired:
        return {'stdout': '', 'stderr': 'Превышено время выполнения (5 сек)', 'returncode': -1, 'runner': 'subprocess'}
    except Exception as e:
        return {'stdout': '', 'stderr': str(e), 'returncode': -1, 'runner': 'subprocess'}
    finally:
        try: os.unlink(fname)
        except: pass

def run_code_safe(code: str, stdin_data: str):
    if DOCKER_AVAILABLE:
        return run_code_docker(code, stdin_data)
    return run_code_subprocess(code, stdin_data)

# ── DB INIT ───────────────────────────────────────────────────────────────────

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'student',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            teacher_id INTEGER NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (teacher_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS enrollments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            course_id INTEGER NOT NULL,
            enrolled_at TEXT DEFAULT (datetime('now')),
            UNIQUE(student_id, course_id),
            FOREIGN KEY (student_id) REFERENCES users(id),
            FOREIGN KEY (course_id) REFERENCES courses(id)
        );
        -- Modules group blocks with optional deadline
        CREATE TABLE IF NOT EXISTS modules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            position INTEGER DEFAULT 0,
            deadline TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (course_id) REFERENCES courses(id)
        );
        -- A "block" inside a module: theory | practice | assessment
        CREATE TABLE IF NOT EXISTS module_blocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            module_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            block_type TEXT NOT NULL CHECK(block_type IN ('theory','practice','assessment')),
            position INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (module_id) REFERENCES modules(id)
        );
        -- Each block contains items: theory_content OR task
        CREATE TABLE IF NOT EXISTS block_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            block_id INTEGER NOT NULL,
            item_type TEXT NOT NULL CHECK(item_type IN ('theory','task')),
            position INTEGER DEFAULT 0,
            -- theory fields
            theory_title TEXT,
            theory_content TEXT,
            -- task fields (reused for code/quiz)
            task_title TEXT,
            task_description TEXT,
            task_type TEXT CHECK(task_type IN ('code','quiz','multi','text', NULL)),
            test_cases TEXT,
            options TEXT,
            correct_answer TEXT,
            correct_answers TEXT,
            max_attempts INTEGER DEFAULT 0,
            deadline TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (block_id) REFERENCES module_blocks(id)
        );
        -- Student submissions (one row per student per item, updated on retry)
        CREATE TABLE IF NOT EXISTS submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            item_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            result TEXT,
            score REAL,
            attempts INTEGER DEFAULT 1,
            submitted_at TEXT DEFAULT (datetime('now')),
            UNIQUE(student_id, item_id),
            FOREIGN KEY (student_id) REFERENCES users(id),
            FOREIGN KEY (item_id) REFERENCES block_items(id)
        );
    ''')
    conn.commit()

    # ── SEED DEMO DATA ────────────────────────────────────────────────────────
    try:
        c.execute("INSERT OR IGNORE INTO users (username,email,password_hash,role) VALUES (?,?,?,?)",
                  ('teacher','teacher@demo.com', hash_password('teacher123'), 'teacher'))
        c.execute("INSERT OR IGNORE INTO users (username,email,password_hash,role) VALUES (?,?,?,?)",
                  ('student','student@demo.com', hash_password('student123'), 'student'))
        conn.commit()

        teacher = c.execute("SELECT id FROM users WHERE username='teacher'").fetchone()
        student  = c.execute("SELECT id FROM users WHERE username='student'").fetchone()

        if not teacher: conn.close(); return

        # Course
        c.execute("INSERT OR IGNORE INTO courses (id,title,description,teacher_id) VALUES (1,?,?,?)",
                  ('Python: Основы программирования','Вводный курс по языку Python для начинающих', teacher['id']))
        conn.commit()

        if student:
            c.execute("INSERT OR IGNORE INTO enrollments (student_id,course_id) VALUES (?,1)", (student['id'],))
            conn.commit()

        # Module 1
        c.execute("""INSERT OR IGNORE INTO modules (id,course_id,title,description,position,deadline)
                     VALUES (1,1,?,?,1,?)""",
                  ('Модуль 1: Основы Python','Переменные, типы данных, ввод/вывод','2026-07-31'))
        conn.commit()

        # Block 1 — theory
        c.execute("""INSERT OR IGNORE INTO module_blocks (id,module_id,title,block_type,position)
                     VALUES (1,1,?,?,1)""", ('Теория: Переменные и операции','theory'))
        conn.commit()

        theory_md = '''## Что такое Python?

Python — высокоуровневый язык программирования с чистым синтаксисом.

## Переменные

```python
x = 10        # int
y = 3.14      # float
name = "Py"   # str
flag = True   # bool
```

## Ввод и вывод

```python
print("Привет!")        # вывод
n = int(input())        # ввод числа
```

## Арифметика

| Операция | Символ | Пример |
|---|---|---|
| Сложение | `+` | `2+3=5` |
| Умножение | `*` | `4*3=12` |
| Степень | `**` | `2**8=256` |
| Деление | `/` | `7/2=3.5` |
| Целое деление | `//` | `7//2=3` |
| Остаток | `%` | `7%2=1` |
'''
        c.execute("""INSERT OR IGNORE INTO block_items (id,block_id,item_type,position,theory_title,theory_content)
                     VALUES (1,1,'theory',1,?,?)""", ('Введение в Python', theory_md))
        conn.commit()

        # Block 2 — practice
        c.execute("""INSERT OR IGNORE INTO module_blocks (id,module_id,title,block_type,position)
                     VALUES (2,1,?,?,2)""", ('Практика: Первые программы','practice'))
        conn.commit()

        tc1 = json.dumps([{"input":"5","expected":"25","hidden":False},
                          {"input":"7","expected":"49","hidden":True}])
        c.execute("""INSERT OR IGNORE INTO block_items
                     (id,block_id,item_type,position,task_title,task_description,task_type,test_cases,max_attempts)
                     VALUES (2,2,'task',1,?,?,?,?,0)""",
                  ('Квадрат числа',
                   'Считайте целое число n и выведите его квадрат.\n\n**Пример:**\n- Ввод: `5`\n- Вывод: `25`',
                   'code', tc1))
        conn.commit()

        # Block 3 — assessment
        c.execute("""INSERT OR IGNORE INTO module_blocks (id,module_id,title,block_type,position)
                     VALUES (3,1,?,?,3)""", ('Оценочный тест','assessment'))
        conn.commit()

        opts = json.dumps(['Список','Кортеж','Словарь','Множество'])
        c.execute("""INSERT OR IGNORE INTO block_items
                     (id,block_id,item_type,position,task_title,task_description,task_type,options,correct_answer,max_attempts)
                     VALUES (3,3,'task',1,?,?,?,?,?,3)""",
                  ('Типы данных',
                   'Какой тип данных хранит пары ключ-значение и является неизменяемым по ключу?',
                   'quiz', opts, 'Словарь'))
        conn.commit()

        # Module 2
        c.execute("""INSERT OR IGNORE INTO modules (id,course_id,title,description,position,deadline)
                     VALUES (2,1,?,?,2,?)""",
                  ('Модуль 2: Условия и циклы','Ветвления, циклы for и while','2026-07-31'))
        conn.commit()

        c.execute("""INSERT OR IGNORE INTO module_blocks (id,module_id,title,block_type,position)
                     VALUES (4,2,?,?,1)""", ('Теория: Условия и циклы','theory'))
        conn.commit()

        theory_md2 = '''## Условный оператор if

```python
x = int(input())
if x > 0:
    print("Положительное")
elif x < 0:
    print("Отрицательное")
else:
    print("Ноль")
```

## Цикл while

```python
i = 1
while i <= 5:
    print(i)
    i += 1
```

## Цикл for

```python
for i in range(5):   # 0..4
    print(i)

nums = [1, 2, 3]
for n in nums:
    print(n)
```

## Функции

```python
def square(n):
    return n * n

print(square(4))  # 16
```

> 💡 Используйте `break` для выхода из цикла и `continue` для пропуска итерации.
'''
        c.execute("""INSERT OR IGNORE INTO block_items (id,block_id,item_type,position,theory_title,theory_content)
                     VALUES (4,4,'theory',1,?,?)""", ('Управляющие конструкции', theory_md2))
        conn.commit()

        c.execute("""INSERT OR IGNORE INTO module_blocks (id,module_id,title,block_type,position)
                     VALUES (5,2,?,?,2)""", ('Практика: Сумма и циклы','practice'))
        conn.commit()

        tc2 = json.dumps([{"input":"3\n1 2 3","expected":"6","hidden":False},
                          {"input":"5\n10 20 30 40 50","expected":"150","hidden":True}])
        c.execute("""INSERT OR IGNORE INTO block_items
                     (id,block_id,item_type,position,task_title,task_description,task_type,test_cases,max_attempts)
                     VALUES (5,5,'task',1,?,?,?,?,0)""",
                  ('Сумма N чисел',
                   'Считайте N, затем N чисел и выведите их сумму.\n\n**Пример:**\n- Ввод: `3\\n1 2 3`\n- Вывод: `6`',
                   'code', tc2))
        conn.commit()

        print("✓ БД инициализирована")
    except Exception as e:
        print(f"Seed error: {e}")
        import traceback; traceback.print_exc()
    conn.close()

# ── AUTH ──────────────────────────────────────────────────────────────────────

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json
    conn = get_db()
    try:
        conn.execute("INSERT INTO users (username,email,password_hash,role) VALUES (?,?,?,?)",
                     (data['username'], data['email'], hash_password(data['password']), data.get('role','student')))
        conn.commit()
        return jsonify({'message': 'Создан'}), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Пользователь уже существует'}), 400
    finally: conn.close()

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE username=?", (data['username'],)).fetchone()
    conn.close()
    if not user or not verify_password(user['password_hash'], data['password']):
        return jsonify({'error': 'Неверные учётные данные'}), 401
    token = create_access_token(identity=str(user['id']))
    return jsonify({'token': token, 'user': dict(user)})

@app.route('/api/auth/me')
@jwt_required()
def me():
    uid = int(get_jwt_identity())
    conn = get_db()
    u = conn.execute("SELECT id,username,email,role FROM users WHERE id=?", (uid,)).fetchone()
    conn.close()
    return jsonify(dict(u))

# ── COURSES ───────────────────────────────────────────────────────────────────

@app.route('/api/courses', methods=['GET'])
@jwt_required()
def get_courses():
    uid = int(get_jwt_identity())
    conn = get_db()
    u = conn.execute("SELECT role FROM users WHERE id=?", (uid,)).fetchone()
    if u['role'] == 'teacher':
        rows = conn.execute("""
            SELECT c.*, u.username as teacher_name,
                   COUNT(DISTINCT e.student_id) as student_count
            FROM courses c JOIN users u ON c.teacher_id=u.id
            LEFT JOIN enrollments e ON c.id=e.course_id
            WHERE c.teacher_id=? GROUP BY c.id""", (uid,)).fetchall()
    else:
        rows = conn.execute("""
            SELECT c.*, u.username as teacher_name,
                   COUNT(DISTINCT e2.student_id) as student_count,
                   CASE WHEN e.id IS NOT NULL THEN 1 ELSE 0 END as enrolled
            FROM courses c JOIN users u ON c.teacher_id=u.id
            LEFT JOIN enrollments e ON c.id=e.course_id AND e.student_id=?
            LEFT JOIN enrollments e2 ON c.id=e2.course_id
            GROUP BY c.id""", (uid,)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/courses', methods=['POST'])
@jwt_required()
def create_course():
    uid = int(get_jwt_identity())
    data = request.json
    conn = get_db()
    c = conn.execute("INSERT INTO courses (title,description,teacher_id) VALUES (?,?,?)",
                     (data['title'], data.get('description',''), uid))
    conn.commit(); conn.close()
    return jsonify({'id': c.lastrowid}), 201

@app.route('/api/courses/<int:cid>', methods=['GET'])
@jwt_required()
def get_course(cid):
    conn = get_db()
    c = conn.execute("SELECT c.*,u.username as teacher_name FROM courses c JOIN users u ON c.teacher_id=u.id WHERE c.id=?", (cid,)).fetchone()
    conn.close()
    if not c: return jsonify({'error': 'Не найдено'}), 404
    return jsonify(dict(c))

@app.route('/api/courses/<int:cid>/enroll', methods=['POST'])
@jwt_required()
def enroll(cid):
    uid = int(get_jwt_identity())
    conn = get_db()
    try:
        conn.execute("INSERT INTO enrollments (student_id,course_id) VALUES (?,?)", (uid, cid))
        conn.commit()
    except sqlite3.IntegrityError: pass
    conn.close()
    return jsonify({'message': 'Записан'})

# ── MODULES ───────────────────────────────────────────────────────────────────

@app.route('/api/courses/<int:cid>/modules', methods=['GET'])
@jwt_required()
def get_modules(cid):
    uid = int(get_jwt_identity())
    conn = get_db()
    mods = conn.execute("SELECT * FROM modules WHERE course_id=? ORDER BY position,id", (cid,)).fetchall()
    result = []
    for m in mods:
        md = dict(m)
        blocks = conn.execute("SELECT * FROM module_blocks WHERE module_id=? ORDER BY position,id", (m['id'],)).fetchall()
        blocks_list = []
        for b in blocks:
            bd = dict(b)
            items = conn.execute("SELECT * FROM block_items WHERE block_id=? ORDER BY position,id", (b['id'],)).fetchall()
            items_list = []
            for it in items:
                itd = dict(it)
                if itd.get('test_cases'): itd['test_cases'] = json.loads(itd['test_cases'])
                if itd.get('options'): itd['options'] = json.loads(itd['options'])
                if itd.get('correct_answers'): itd['correct_answers'] = json.loads(itd['correct_answers'])
                sub = conn.execute("SELECT status,score,attempts FROM submissions WHERE item_id=? AND student_id=?",
                                   (it['id'], uid)).fetchone()
                itd['my_submission'] = dict(sub) if sub else None
                items_list.append(itd)
            bd['items'] = items_list
            blocks_list.append(bd)
        md['blocks'] = blocks_list
        result.append(md)
    conn.close()
    return jsonify(result)

@app.route('/api/courses/<int:cid>/modules', methods=['POST'])
@jwt_required()
def create_module(cid):
    data = request.json
    conn = get_db()
    max_pos = conn.execute("SELECT COALESCE(MAX(position),0) FROM modules WHERE course_id=?", (cid,)).fetchone()[0]
    c = conn.execute("INSERT INTO modules (course_id,title,description,position,deadline) VALUES (?,?,?,?,?)",
                     (cid, data['title'], data.get('description',''), max_pos+1, data.get('deadline')))
    conn.commit(); conn.close()
    return jsonify({'id': c.lastrowid}), 201

@app.route('/api/modules/<int:mid>', methods=['PUT'])
@jwt_required()
def update_module(mid):
    data = request.json
    conn = get_db()
    conn.execute("UPDATE modules SET title=?,description=?,deadline=? WHERE id=?",
                 (data['title'], data.get('description',''), data.get('deadline'), mid))
    conn.commit(); conn.close()
    return jsonify({'message': 'OK'})

@app.route('/api/modules/<int:mid>', methods=['DELETE'])
@jwt_required()
def delete_module(mid):
    conn = get_db()
    conn.execute("DELETE FROM modules WHERE id=?", (mid,))
    conn.commit(); conn.close()
    return jsonify({'message': 'OK'})

# ── MODULE BLOCKS ─────────────────────────────────────────────────────────────

@app.route('/api/modules/<int:mid>/blocks', methods=['POST'])
@jwt_required()
def create_block(mid):
    data = request.json
    conn = get_db()
    max_pos = conn.execute("SELECT COALESCE(MAX(position),0) FROM module_blocks WHERE module_id=?", (mid,)).fetchone()[0]
    c = conn.execute("INSERT INTO module_blocks (module_id,title,block_type,position) VALUES (?,?,?,?)",
                     (mid, data['title'], data['block_type'], max_pos+1))
    conn.commit(); conn.close()
    return jsonify({'id': c.lastrowid}), 201

@app.route('/api/blocks/<int:bid>', methods=['PUT'])
@jwt_required()
def update_block(bid):
    data = request.json
    conn = get_db()
    conn.execute("UPDATE module_blocks SET title=?,block_type=? WHERE id=?",
                 (data['title'], data['block_type'], bid))
    conn.commit(); conn.close()
    return jsonify({'message': 'OK'})

@app.route('/api/blocks/<int:bid>', methods=['DELETE'])
@jwt_required()
def delete_block(bid):
    conn = get_db()
    conn.execute("DELETE FROM module_blocks WHERE id=?", (bid,))
    conn.commit(); conn.close()
    return jsonify({'message': 'OK'})

# ── BLOCK ITEMS ───────────────────────────────────────────────────────────────

@app.route('/api/blocks/<int:bid>/items', methods=['POST'])
@jwt_required()
def create_item(bid):
    data = request.json
    conn = get_db()
    max_pos = conn.execute("SELECT COALESCE(MAX(position),0) FROM block_items WHERE block_id=?", (bid,)).fetchone()[0]
    item_type = data['item_type']
    if item_type == 'theory':
        c = conn.execute("""INSERT INTO block_items (block_id,item_type,position,theory_title,theory_content)
                            VALUES (?,?,?,?,?)""",
                         (bid, 'theory', max_pos+1, data.get('theory_title',''), data.get('theory_content','')))
    else:
        tc = json.dumps(data.get('test_cases',[])) if data.get('test_cases') else None
        opts = json.dumps(data.get('options',[])) if data.get('options') else None
        ca = json.dumps(data.get('correct_answers',[])) if data.get('correct_answers') else None
        c = conn.execute("""INSERT INTO block_items
                            (block_id,item_type,position,task_title,task_description,task_type,
                             test_cases,options,correct_answer,correct_answers,max_attempts,deadline)
                            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                         (bid, 'task', max_pos+1, data.get('task_title',''),
                          data.get('task_description',''), data.get('task_type','code'),
                          tc, opts, data.get('correct_answer'), ca,
                          int(data.get('max_attempts',0)), data.get('deadline')))
    conn.commit(); conn.close()
    return jsonify({'id': c.lastrowid}), 201

@app.route('/api/items/<int:iid>', methods=['PUT'])
@jwt_required()
def update_item(iid):
    data = request.json
    conn = get_db()
    item_type = data['item_type']
    if item_type == 'theory':
        conn.execute("UPDATE block_items SET theory_title=?,theory_content=? WHERE id=?",
                     (data.get('theory_title',''), data.get('theory_content',''), iid))
    else:
        tc = json.dumps(data.get('test_cases',[])) if data.get('test_cases') else None
        opts = json.dumps(data.get('options',[])) if data.get('options') else None
        ca = json.dumps(data.get('correct_answers',[])) if data.get('correct_answers') else None
        conn.execute("""UPDATE block_items SET task_title=?,task_description=?,task_type=?,
                        test_cases=?,options=?,correct_answer=?,correct_answers=?,max_attempts=?,deadline=? WHERE id=?""",
                     (data.get('task_title',''), data.get('task_description',''), data.get('task_type','code'),
                      tc, opts, data.get('correct_answer'), ca, int(data.get('max_attempts',0)),
                      data.get('deadline'), iid))
    conn.commit(); conn.close()
    return jsonify({'message': 'OK'})

@app.route('/api/items/<int:iid>', methods=['DELETE'])
@jwt_required()
def delete_item(iid):
    conn = get_db()
    conn.execute("DELETE FROM block_items WHERE id=?", (iid,))
    conn.commit(); conn.close()
    return jsonify({'message': 'OK'})

@app.route('/api/items/<int:iid>/run', methods=['POST'])
@jwt_required()
def run_item(iid):
    data = request.json
    code = data.get('code','')
    conn = get_db()
    item = conn.execute("SELECT * FROM block_items WHERE id=?", (iid,)).fetchone()
    conn.close()
    if not item: return jsonify({'error': 'Не найдено'}), 404
    test_cases = json.loads(item['test_cases'] or '[]')
    results, passed = [], 0
    for tc in test_cases:
        if tc.get('hidden'): continue
        r = run_code_safe(code, tc.get('input',''))
        ok = r['stdout'] == tc['expected'].strip()
        if ok: passed += 1
        results.append({'input': tc['input'], 'expected': tc['expected'],
                        'got': r['stdout'], 'passed': ok,
                        'error': r['stderr'] if r['stderr'] else None})
    visible = len(results)
    runner = results[0]['got'] if results else 'subprocess'
    return jsonify({'results': results, 'passed': passed, 'total': visible,
                    'all_passed': passed == visible and visible > 0,
                    'runner': 'docker' if DOCKER_AVAILABLE else 'subprocess'})

@app.route('/api/items/<int:iid>/submit', methods=['POST'])
@jwt_required()
def submit_item(iid):
    uid = int(get_jwt_identity())
    data = request.json
    conn = get_db()
    item = conn.execute("SELECT * FROM block_items WHERE id=?", (iid,)).fetchone()
    if not item: conn.close(); return jsonify({'error': 'Не найдено'}), 404

    existing = conn.execute("SELECT * FROM submissions WHERE item_id=? AND student_id=?", (iid, uid)).fetchone()
    used = existing['attempts'] if existing else 0
    mx = item['max_attempts'] or 0

    if mx > 0 and used >= mx:
        conn.close()
        return jsonify({'error': f'Лимит попыток исчерпан ({mx})', 'attempts_exhausted': True}), 403

    content = data.get('content','')
    status = 'submitted'; result_data = None; score = None

    if item['task_type'] == 'quiz':
        ok = content.strip() == (item['correct_answer'] or '').strip()
        score = 100.0 if ok else 0.0; status = 'graded'
        result_data = json.dumps({'correct': ok, 'answer': content, 'expected': item['correct_answer']})

    elif item['task_type'] == 'multi':
        # content is JSON array of selected options
        try:
            selected = set(json.loads(content))
        except Exception:
            selected = set()
        correct = set(json.loads(item['correct_answers'] or '[]'))
        ok = selected == correct
        # Partial credit: (correct selected - wrong selected) / total correct
        true_pos = len(selected & correct)
        false_pos = len(selected - correct)
        if len(correct) > 0:
            partial = max(0.0, (true_pos - false_pos) / len(correct))
        else:
            partial = 1.0 if not selected else 0.0
        score = round(partial * 100, 1); status = 'graded'
        result_data = json.dumps({
            'correct': ok, 'selected': list(selected),
            'correct_answers': list(correct),
            'partial': partial
        })

    elif item['task_type'] == 'text':
        # correct_answers is list of acceptable strings (case-insensitive, stripped)
        accepted = [a.strip().lower() for a in json.loads(item['correct_answers'] or '[]')]
        ok = content.strip().lower() in accepted
        score = 100.0 if ok else 0.0; status = 'graded'
        result_data = json.dumps({
            'correct': ok, 'answer': content,
            'accepted': json.loads(item['correct_answers'] or '[]')
        })

    elif item['task_type'] == 'code':
        test_cases = json.loads(item['test_cases'] or '[]')
        results, passed = [], 0
        for tc in test_cases:
            r = run_code_safe(content, tc.get('input',''))
            ok = r['stdout'] == tc['expected'].strip()
            if ok: passed += 1
            results.append({'input': tc['input'] if not tc.get('hidden') else '***',
                            'expected': tc['expected'] if not tc.get('hidden') else '***',
                            'got': r['stdout'], 'passed': ok, 'hidden': tc.get('hidden',False),
                            'error': r['stderr'] if r['stderr'] else None})
        total = len(test_cases)
        score = round((passed/total)*100,1) if total else 0; status = 'graded'
        result_data = json.dumps({'results': results, 'passed': passed, 'total': total})

    new_attempts = used + 1
    if existing:
        conn.execute("UPDATE submissions SET content=?,status=?,result=?,score=?,attempts=?,submitted_at=datetime('now') WHERE id=?",
                     (content, status, result_data, score, new_attempts, existing['id']))
    else:
        conn.execute("INSERT INTO submissions (student_id,item_id,content,status,result,score,attempts) VALUES (?,?,?,?,?,?,1)",
                     (uid, iid, content, status, result_data, score))
    conn.commit(); conn.close()

    resp = {'message': 'Принято', 'status': status, 'attempts': new_attempts, 'max_attempts': mx}
    if score is not None: resp['score'] = score
    if result_data: resp['result'] = json.loads(result_data)
    return jsonify(resp)

# ── ANALYTICS ─────────────────────────────────────────────────────────────────

@app.route('/api/courses/<int:cid>/analytics', methods=['GET'])
@jwt_required()
def course_analytics(cid):
    conn = get_db()
    # All enrolled students
    students = conn.execute("""
        SELECT u.id, u.username, u.email FROM enrollments e
        JOIN users u ON e.student_id=u.id WHERE e.course_id=?
    """, (cid,)).fetchall()

    # All task items in this course
    all_items = conn.execute("""
        SELECT bi.id, bi.task_title, bi.task_type, mb.title as block_title,
               mb.block_type, m.title as module_title, m.id as module_id
        FROM block_items bi
        JOIN module_blocks mb ON bi.block_id=mb.id
        JOIN modules m ON mb.module_id=m.id
        WHERE m.course_id=? AND bi.item_type='task'
        ORDER BY m.position, mb.position, bi.position
    """, (cid,)).fetchall()

    result = []
    for s in students:
        subs = conn.execute("""
            SELECT s.item_id, s.score, s.attempts, s.status, s.submitted_at
            FROM submissions s
            JOIN block_items bi ON s.item_id=bi.id
            JOIN module_blocks mb ON bi.block_id=mb.id
            JOIN modules m ON mb.module_id=m.id
            WHERE s.student_id=? AND m.course_id=?
        """, (s['id'], cid)).fetchall()
        sub_map = {sub['item_id']: dict(sub) for sub in subs}

        total_tasks = len(all_items)
        done = sum(1 for it in all_items if it['id'] in sub_map)
        scores = [sub_map[it['id']]['score'] for it in all_items if it['id'] in sub_map and sub_map[it['id']]['score'] is not None]
        avg_score = round(sum(scores)/len(scores), 1) if scores else None

        result.append({
            'id': s['id'], 'username': s['username'], 'email': s['email'],
            'total_tasks': total_tasks, 'done': done,
            'avg_score': avg_score, 'submissions': sub_map
        })

    modules_summary = []
    modules = conn.execute("SELECT * FROM modules WHERE course_id=? ORDER BY position", (cid,)).fetchall()
    for m in modules:
        items = conn.execute("""
            SELECT bi.id FROM block_items bi
            JOIN module_blocks mb ON bi.block_id=mb.id
            WHERE mb.module_id=? AND bi.item_type='task'
        """, (m['id'],)).fetchall()
        item_ids = [i['id'] for i in items]
        if item_ids:
            placeholders = ','.join('?' * len(item_ids))
            avg = conn.execute(f"SELECT AVG(score) FROM submissions WHERE item_id IN ({placeholders})", item_ids).fetchone()[0]
        else:
            avg = None
        modules_summary.append({'id': m['id'], 'title': m['title'], 'avg_score': round(avg,1) if avg else None, 'total_items': len(item_ids)})

    conn.close()
    return jsonify({'students': result, 'modules': modules_summary, 'all_items': [dict(i) for i in all_items]})

@app.route('/api/info', methods=['GET'])
def info():
    return jsonify({'docker': DOCKER_AVAILABLE, 'runner': 'docker' if DOCKER_AVAILABLE else 'subprocess'})

if __name__ == '__main__':
    import os
    init_db()
    port = int(os.environ.get('PORT', 8000))
    debug = os.environ.get('FLASK_ENV') != 'production'
    app.run(host='0.0.0.0', port=port, debug=debug)
