from flask import Flask, request, jsonify, session
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3, os, secrets, datetime
app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'qf-admin-fixed-secret-2026')
CORS(app, supports_credentials=True, origins=["http://127.0.0.1:5500", "http://localhost:5500"])

DB = os.path.join(os.path.dirname(__file__), 'qf_admin.db')

# ─── DB SETUP ───────────────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS admins (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name  TEXT NOT NULL,
            email      TEXT NOT NULL UNIQUE,
            password   TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS password_resets (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            admin_id   INTEGER NOT NULL,
            token      TEXT NOT NULL UNIQUE,
            expires_at DATETIME NOT NULL,
            used       INTEGER DEFAULT 0,
            FOREIGN KEY(admin_id) REFERENCES admins(id)
        );
        CREATE TABLE IF NOT EXISTS opportunities (
            id                   INTEGER PRIMARY KEY AUTOINCREMENT,
            admin_id             INTEGER NOT NULL,
            name                 TEXT NOT NULL,
            duration             TEXT NOT NULL,
            start_date           TEXT NOT NULL,
            description          TEXT NOT NULL,
            skills               TEXT NOT NULL,
            category             TEXT NOT NULL,
            future_opportunities TEXT NOT NULL,
            max_applicants       INTEGER,
            created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(admin_id) REFERENCES admins(id)
        );
        CREATE TABLE IF NOT EXISTS students (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            admin_id   INTEGER NOT NULL,
            full_name  TEXT NOT NULL,
            email      TEXT NOT NULL,
            status     TEXT DEFAULT 'active',
            school_id  TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(admin_id) REFERENCES admins(id)
        );
        CREATE TABLE IF NOT EXISTS verifiers (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            admin_id   INTEGER NOT NULL,
            full_name  TEXT NOT NULL,
            email      TEXT NOT NULL,
            subject    TEXT,
            status     TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(admin_id) REFERENCES admins(id)
        );
        """)

init_db()

# ─── HELPERS ────────────────────────────────────────────────────────────────
def current_admin_id():
    return session.get('admin_id')

def require_auth():
    if not current_admin_id():
        return jsonify({'error': 'Unauthorized'}), 401
    return None

# ─── AUTH ────────────────────────────────────────────────────────────────────

@app.route('/api/signup', methods=['POST'])
def signup():
    data      = request.get_json()
    full_name = (data.get('full_name') or '').strip()
    email     = (data.get('email') or '').strip().lower()
    password  = (data.get('password') or '')
    confirm   = (data.get('confirm_password') or '')

    if not all([full_name, email, password, confirm]):
        return jsonify({'error': 'All fields are required'}), 400
    if '@' not in email or '.' not in email.split('@')[-1]:
        return jsonify({'error': 'Invalid email format'}), 400
    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    if password != confirm:
        return jsonify({'error': 'Passwords do not match'}), 400

    with get_db() as conn:
        existing = conn.execute('SELECT id FROM admins WHERE email=?', (email,)).fetchone()
        if existing:
            return jsonify({'error': 'An account with this email already exists'}), 409
        conn.execute(
            'INSERT INTO admins (full_name, email, password) VALUES (?,?,?)',
            (full_name, email, generate_password_hash(password))
        )
    return jsonify({'message': 'Account created successfully'}), 201


@app.route('/api/login', methods=['POST'])
def login():
    data     = request.get_json()
    email    = (data.get('email') or '').strip().lower()
    password = (data.get('password') or '')
    remember = data.get('remember_me', False)

    if not email or not password:
        return jsonify({'error': 'Invalid email or password'}), 401

    with get_db() as conn:
        admin = conn.execute('SELECT * FROM admins WHERE email=?', (email,)).fetchone()

    if not admin or not check_password_hash(admin['password'], password):
        return jsonify({'error': 'Invalid email or password'}), 401

    session.permanent = bool(remember)
    if remember:
        app.permanent_session_lifetime = datetime.timedelta(days=30)

    session['admin_id']    = admin['id']
    session['admin_email'] = admin['email']
    session['admin_name']  = admin['full_name']

    return jsonify({
        'message': 'Login successful',
        'admin': {
            'id': admin['id'],
            'email': admin['email'],
            'full_name': admin['full_name']
        }
    }), 200


@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out'}), 200


@app.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    data  = request.get_json()
    email = (data.get('email') or '').strip().lower()

    with get_db() as conn:
        admin = conn.execute('SELECT id FROM admins WHERE email=?', (email,)).fetchone()
        if admin:
            token   = secrets.token_urlsafe(32)
            expires = datetime.datetime.utcnow() + datetime.timedelta(hours=1)
            conn.execute(
                'INSERT INTO password_resets (admin_id, token, expires_at) VALUES (?,?,?)',
                (admin['id'], token, expires.isoformat())
            )
            print(f"[RESET LINK] http://127.0.0.1:5500/reset?token={token}")

    # Always same message regardless — protects user privacy
    return jsonify({'message': 'If this email is registered, a reset link has been sent.'}), 200


@app.route('/api/reset-password', methods=['POST'])
def reset_password():
    data     = request.get_json()
    token    = (data.get('token') or '').strip()
    new_pass = (data.get('password') or '')

    if len(new_pass) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400

    with get_db() as conn:
        row = conn.execute(
            'SELECT * FROM password_resets WHERE token=? AND used=0', (token,)
        ).fetchone()
        if not row:
            return jsonify({'error': 'Invalid or already used reset link'}), 400
        if datetime.datetime.utcnow() > datetime.datetime.fromisoformat(row['expires_at']):
            return jsonify({'error': 'This reset link has expired. Please request a new one.'}), 400
        conn.execute(
            'UPDATE admins SET password=? WHERE id=?',
            (generate_password_hash(new_pass), row['admin_id'])
        )
        conn.execute('UPDATE password_resets SET used=1 WHERE id=?', (row['id'],))

    return jsonify({'message': 'Password reset successfully'}), 200


@app.route('/api/me', methods=['GET'])
def me():
    err = require_auth()
    if err: return err
    with get_db() as conn:
        admin = conn.execute(
            'SELECT id, email, full_name FROM admins WHERE id=?',
            (current_admin_id(),)
        ).fetchone()
    return jsonify({
        'admin': {
            'id': admin['id'],
            'email': admin['email'],
            'full_name': admin['full_name']
        }
    }), 200

# ─── OPPORTUNITIES ───────────────────────────────────────────────────────────

@app.route('/api/opportunities', methods=['GET'])
def get_opportunities():
    err = require_auth()
    if err: return err
    with get_db() as conn:
        rows = conn.execute(
            'SELECT * FROM opportunities WHERE admin_id=? ORDER BY created_at DESC',
            (current_admin_id(),)
        ).fetchall()
    return jsonify([dict(r) for r in rows]), 200


@app.route('/api/opportunities', methods=['POST'])
def create_opportunity():
    err = require_auth()
    if err: return err
    data = request.get_json()

    required = ['name', 'duration', 'start_date', 'description',
                'skills', 'category', 'future_opportunities']
    for field in required:
        if not (data.get(field) or '').strip():
            return jsonify({'error': f'{field} is required'}), 400

    with get_db() as conn:
        cursor = conn.execute(
            '''INSERT INTO opportunities
               (admin_id, name, duration, start_date, description,
                skills, category, future_opportunities, max_applicants)
               VALUES (?,?,?,?,?,?,?,?,?)''',
            (
                current_admin_id(),
                data['name'].strip(),
                data['duration'].strip(),
                data['start_date'].strip(),
                data['description'].strip(),
                data['skills'].strip(),
                data['category'].strip(),
                data['future_opportunities'].strip(),
                data.get('max_applicants') or None
            )
        )
        opp = conn.execute(
            'SELECT * FROM opportunities WHERE id=?', (cursor.lastrowid,)
        ).fetchone()
    return jsonify(dict(opp)), 201


@app.route('/api/opportunities/<int:opp_id>', methods=['GET'])
def get_opportunity(opp_id):
    err = require_auth()
    if err: return err
    with get_db() as conn:
        opp = conn.execute(
            'SELECT * FROM opportunities WHERE id=? AND admin_id=?',
            (opp_id, current_admin_id())
        ).fetchone()
    if not opp:
        return jsonify({'error': 'Opportunity not found'}), 404
    return jsonify(dict(opp)), 200


@app.route('/api/opportunities/<int:opp_id>', methods=['PUT'])
def update_opportunity(opp_id):
    err = require_auth()
    if err: return err
    data = request.get_json()

    required = ['name', 'duration', 'start_date', 'description',
                'skills', 'category', 'future_opportunities']
    for field in required:
        if not (data.get(field) or '').strip():
            return jsonify({'error': f'{field} is required'}), 400

    with get_db() as conn:
        existing = conn.execute(
            'SELECT id FROM opportunities WHERE id=? AND admin_id=?',
            (opp_id, current_admin_id())
        ).fetchone()
        if not existing:
            return jsonify({'error': 'Opportunity not found or access denied'}), 404

        conn.execute(
            '''UPDATE opportunities SET
               name=?, duration=?, start_date=?, description=?,
               skills=?, category=?, future_opportunities=?, max_applicants=?
               WHERE id=? AND admin_id=?''',
            (
                data['name'].strip(),
                data['duration'].strip(),
                data['start_date'].strip(),
                data['description'].strip(),
                data['skills'].strip(),
                data['category'].strip(),
                data['future_opportunities'].strip(),
                data.get('max_applicants') or None,
                opp_id,
                current_admin_id()
            )
        )
        opp = conn.execute(
            'SELECT * FROM opportunities WHERE id=?', (opp_id,)
        ).fetchone()
    return jsonify(dict(opp)), 200


@app.route('/api/opportunities/<int:opp_id>', methods=['DELETE'])
def delete_opportunity(opp_id):
    err = require_auth()
    if err: return err
    with get_db() as conn:
        existing = conn.execute(
            'SELECT id FROM opportunities WHERE id=? AND admin_id=?',
            (opp_id, current_admin_id())
        ).fetchone()
        if not existing:
            return jsonify({'error': 'Opportunity not found or access denied'}), 404
        conn.execute(
            'DELETE FROM opportunities WHERE id=? AND admin_id=?',
            (opp_id, current_admin_id())
        )
    return jsonify({'message': 'Opportunity deleted'}), 200


# ─── STUDENTS ────────────────────────────────────────────────────────────────

@app.route('/api/students', methods=['GET'])
def get_students():
    err = require_auth()
    if err: return err
    status = request.args.get('status', 'all')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')

    query = 'SELECT * FROM students WHERE admin_id=?'
    params = [current_admin_id()]

    if status and status != 'all':
        query += ' AND status=?'
        params.append(status)

    if date_from:
        query += ' AND DATE(created_at) >= ?'
        params.append(date_from)

    if date_to:
        query += ' AND DATE(created_at) <= ?'
        params.append(date_to)

    query += ' ORDER BY created_at DESC'

    with get_db() as conn:
        rows = conn.execute(query, params).fetchall()

    return jsonify([dict(r) for r in rows]), 200


@app.route('/api/students', methods=['POST'])
def create_student():
    err = require_auth()
    if err: return err
    data = request.get_json()

    full_name = (data.get('full_name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    school_id = (data.get('school_id') or '').strip()

    if not full_name or not email:
        return jsonify({'error': 'Full name and email are required'}), 400

    if '@' not in email:
        return jsonify({'error': 'Invalid email format'}), 400

    with get_db() as conn:
        try:
            conn.execute(
                'INSERT INTO students (admin_id, full_name, email, school_id) VALUES (?,?,?,?)',
                (current_admin_id(), full_name, email, school_id)
            )
            student = conn.execute(
                'SELECT * FROM students WHERE email=? AND admin_id=?',
                (email, current_admin_id())
            ).fetchone()
        except Exception as e:
            return jsonify({'error': 'Student with this email already exists'}), 409

    return jsonify(dict(student)), 201


@app.route('/api/students/<int:student_id>', methods=['DELETE'])
def delete_student(student_id):
    err = require_auth()
    if err: return err

    with get_db() as conn:
        student = conn.execute(
            'SELECT id FROM students WHERE id=? AND admin_id=?',
            (student_id, current_admin_id())
        ).fetchone()
        if not student:
            return jsonify({'error': 'Student not found'}), 404

        conn.execute(
            'DELETE FROM students WHERE id=? AND admin_id=?',
            (student_id, current_admin_id())
        )

    return jsonify({'message': 'Student deleted'}), 200


@app.route('/api/students/<int:student_id>/status', methods=['PUT'])
def update_student_status(student_id):
    err = require_auth()
    if err: return err
    data = request.get_json()

    status = data.get('status', 'active')
    if status not in ['active', 'inactive', 'pending', 'deactivated']:
        return jsonify({'error': 'Invalid status'}), 400

    with get_db() as conn:
        student = conn.execute(
            'SELECT id FROM students WHERE id=? AND admin_id=?',
            (student_id, current_admin_id())
        ).fetchone()
        if not student:
            return jsonify({'error': 'Student not found'}), 404

        conn.execute(
            'UPDATE students SET status=? WHERE id=?',
            (status, student_id)
        )

    return jsonify({'message': 'Student status updated'}), 200


# ─── VERIFIERS ────────────────────────────────────────────────────────────────

@app.route('/api/verifiers', methods=['GET'])
def get_verifiers():
    err = require_auth()
    if err: return err
    status = request.args.get('status', 'all')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')

    query = 'SELECT * FROM verifiers WHERE admin_id=?'
    params = [current_admin_id()]

    if status and status != 'all':
        query += ' AND status=?'
        params.append(status)

    if date_from:
        query += ' AND DATE(created_at) >= ?'
        params.append(date_from)

    if date_to:
        query += ' AND DATE(created_at) <= ?'
        params.append(date_to)

    query += ' ORDER BY created_at DESC'

    with get_db() as conn:
        rows = conn.execute(query, params).fetchall()

    return jsonify([dict(r) for r in rows]), 200


@app.route('/api/verifiers', methods=['POST'])
def create_verifier():
    err = require_auth()
    if err: return err
    data = request.get_json()

    full_name = (data.get('full_name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    subject = (data.get('subject') or '').strip()

    if not full_name or not email:
        return jsonify({'error': 'Full name and email are required'}), 400

    if '@' not in email:
        return jsonify({'error': 'Invalid email format'}), 400

    with get_db() as conn:
        try:
            conn.execute(
                'INSERT INTO verifiers (admin_id, full_name, email, subject) VALUES (?,?,?,?)',
                (current_admin_id(), full_name, email, subject)
            )
            verifier = conn.execute(
                'SELECT * FROM verifiers WHERE email=? AND admin_id=?',
                (email, current_admin_id())
            ).fetchone()
        except Exception as e:
            return jsonify({'error': 'Verifier with this email already exists'}), 409

    return jsonify(dict(verifier)), 201


@app.route('/api/verifiers/<int:verifier_id>', methods=['DELETE'])
def delete_verifier(verifier_id):
    err = require_auth()
    if err: return err

    with get_db() as conn:
        verifier = conn.execute(
            'SELECT id FROM verifiers WHERE id=? AND admin_id=?',
            (verifier_id, current_admin_id())
        ).fetchone()
        if not verifier:
            return jsonify({'error': 'Verifier not found'}), 404

        conn.execute(
            'DELETE FROM verifiers WHERE id=? AND admin_id=?',
            (verifier_id, current_admin_id())
        )

    return jsonify({'message': 'Verifier deleted'}), 200


@app.route('/api/verifiers/<int:verifier_id>/status', methods=['PUT'])
def update_verifier_status(verifier_id):
    err = require_auth()
    if err: return err
    data = request.get_json()

    status = data.get('status', 'active')
    if status not in ['active', 'inactive', 'pending', 'deactivated']:
        return jsonify({'error': 'Invalid status'}), 400

    with get_db() as conn:
        verifier = conn.execute(
            'SELECT id FROM verifiers WHERE id=? AND admin_id=?',
            (verifier_id, current_admin_id())
        ).fetchone()
        if not verifier:
            return jsonify({'error': 'Verifier not found'}), 404

        conn.execute(
            'UPDATE verifiers SET status=? WHERE id=?',
            (status, verifier_id)
        )

    return jsonify({'message': 'Verifier status updated'}), 200


@app.route('/')
def index():
    return jsonify({'status': 'API is running', 'version': '1.0'}), 200


if __name__ == '__main__':
    app.run(debug=True, port=5000)