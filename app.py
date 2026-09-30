"""
Sehat — ASHA Home Survey System
Backend: Flask + SQLite
"""
import os, json, uuid, base64, sqlite3, hashlib, secrets
from datetime import datetime, date
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory, g
from flask_cors import CORS

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)
DB_PATH = os.path.join(os.path.dirname(__file__), 'sehat.db')
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ─── Database ───────────────────────────────────────────────────────
def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA journal_mode=WAL")
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db

@app.teardown_appcontext
def close_db(exc):
    db = g.pop('db', None)
    if db: db.close()

def init_db():
    db = sqlite3.connect(DB_PATH)
    db.executescript("""
        CREATE TABLE IF NOT EXISTS supervisors (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS login_activity (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            user_role TEXT NOT NULL,
            user_name TEXT NOT NULL,
            login_at TEXT DEFAULT (datetime('now')),
            success INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS workers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            area TEXT,
            password_hash TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS homes (
            id TEXT PRIMARY KEY,
            worker_id TEXT NOT NULL,
            head_name TEXT NOT NULL,
            house_number TEXT NOT NULL,
            area TEXT NOT NULL,
            city TEXT NOT NULL,
            phone TEXT,
            family_members INTEGER DEFAULT 1,
            member_list TEXT DEFAULT '[]',
            lat REAL,
            lng REAL,
            created_at TEXT DEFAULT (date('now')),
            FOREIGN KEY (worker_id) REFERENCES workers(id)
        );
        CREATE TABLE IF NOT EXISTS surveys (
            id TEXT PRIMARY KEY,
            worker_id TEXT NOT NULL,
            home_id TEXT NOT NULL,
            person_name TEXT NOT NULL,
            age INTEGER,
            gender TEXT,
            disease TEXT NOT NULL,
            survey_date TEXT NOT NULL,
            symptoms TEXT,
            platelets INTEGER,
            fever_days INTEGER,
            bleeding TEXT,
            opv TEXT,
            dose_num TEXT,
            finger_mark TEXT,
            temperature REAL,
            weight REAL,
            severity TEXT DEFAULT 'mild',
            findings TEXT,
            treatment TEXT,
            followup TEXT DEFAULT 'no',
            notes TEXT,
            status TEXT DEFAULT 'completed',
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (worker_id) REFERENCES workers(id),
            FOREIGN KEY (home_id) REFERENCES homes(id)
        );
        CREATE TABLE IF NOT EXISTS photos (
            id TEXT PRIMARY KEY,
            survey_id TEXT NOT NULL,
            filename TEXT NOT NULL,
            lat REAL,
            lng REAL,
            altitude REAL,
            accuracy REAL,
            taken_at TEXT,
            uploaded_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (survey_id) REFERENCES surveys(id)
        );
    """)

    # Seed demo workers
    def hpw(pw): return hashlib.sha256(pw.encode()).hexdigest()
    workers = [
        ('ASHA-1001', 'Fatima Bibi', 'Bengaluru Urban', hpw('sehat123')),
        ('ASHA-1002', 'Zainab Begum', 'Mysuru District', hpw('admin')),
        ('ASHA-1003', 'Nadia Parveen', 'Hubballi-Dharwad', hpw('sehat456')),
    ]
    for w in workers:
        try:
            db.execute("INSERT INTO workers(id,name,area,password_hash) VALUES(?,?,?,?)", w)
        except sqlite3.IntegrityError:
            pass

    # Seed demo supervisor
    supervisors = [
        ('SUP-1001', 'Dr. Priya Sharma', hpw('super123'))
    ]
    for s in supervisors:
        try:
            db.execute("INSERT INTO supervisors(id,name,password_hash) VALUES(?,?,?)", s)
        except sqlite3.IntegrityError:
            pass

    # Seed Karnataka homes
    homes = [
        ('H-001','ASHA-1001','Rajesh Kumar','H-12','JP Nagar','Bengaluru','+91 98765 43210',6,
         '[{"name":"Rajesh Kumar","age":45,"gender":"male"},{"name":"Lakshmi Kumar","age":40,"gender":"female"},{"name":"Arjun Kumar","age":18,"gender":"male"}]',
         12.9141,77.6446,'2026-08-10'),
        ('H-002','ASHA-1001','Suresh Gowda','H-34','Whitefield','Bengaluru','+91 87654 32109',8,
         '[{"name":"Suresh Gowda","age":52,"gender":"male"},{"name":"Parvathi Gowda","age":48,"gender":"female"},{"name":"Deepa Gowda","age":22,"gender":"female"}]',
         12.9698,77.7500,'2026-08-11'),
        ('H-003','ASHA-1002','Mahesh Sharma','H-56','Saraswathipuram','Mysuru','+91 76543 21098',5,
         '[{"name":"Mahesh Sharma","age":38,"gender":"male"},{"name":"Geetha Sharma","age":35,"gender":"female"}]',
         12.3116,76.6530,'2026-08-12'),
        ('H-004','ASHA-1002','Lakshmi Devi','H-78','Gokulam','Mysuru','+91 65432 10987',4,
         '[{"name":"Lakshmi Devi","age":60,"gender":"female"},{"name":"Ravi Sharma","age":32,"gender":"male"}]',
         12.3200,76.6150,'2026-08-13'),
        ('H-005','ASHA-1001','Venkatesh Reddy','H-90','Koramangala','Bengaluru','+91 54321 09876',7,
         '[{"name":"Venkatesh Reddy","age":42,"gender":"male"},{"name":"Sunitha Reddy","age":38,"gender":"female"},{"name":"Pranav Reddy","age":12,"gender":"male"}]',
         12.9352,77.6245,'2026-08-14'),
        ('H-006','ASHA-1003','Girish Patil','H-15','Vidyanagar','Hubballi','+91 43210 98765',5,
         '[{"name":"Girish Patil","age":50,"gender":"male"},{"name":"Vijaya Patil","age":45,"gender":"female"}]',
         15.3647,75.1240,'2026-08-14'),
        ('H-007','ASHA-1003','Sunita Kulkarni','H-28','Deshpande Nagar','Hubballi','+91 32109 87654',4,
         '[{"name":"Sunita Kulkarni","age":35,"gender":"female"},{"name":"Amit Kulkarni","age":38,"gender":"male"}]',
         15.3700,75.1100,'2026-08-15'),
        ('H-008','ASHA-1001','Prakash Naik','H-45','Indiranagar','Bengaluru','+91 21098 76543',6,
         '[{"name":"Prakash Naik","age":48,"gender":"male"},{"name":"Meena Naik","age":44,"gender":"female"},{"name":"Kavya Naik","age":20,"gender":"female"}]',
         12.9716,77.6412,'2026-08-16'),
        ('H-009','ASHA-1002','Shivanna M','H-67','Siddarthanagar','Mysuru','+91 10987 65432',7,
         '[{"name":"Shivanna M","age":55,"gender":"male"},{"name":"Renuka Shivanna","age":50,"gender":"female"}]',
         12.3000,76.6700,'2026-08-17'),
        ('H-010','ASHA-1003','Basavaraj Hunnur','H-82','Nava Nagar','Hubballi','+91 09876 54321',5,
         '[{"name":"Basavaraj Hunnur","age":40,"gender":"male"},{"name":"Sunanda Hunnur","age":36,"gender":"female"},{"name":"Darshan Hunnur","age":10,"gender":"male"}]',
         15.3550,75.1350,'2026-08-18'),
    ]
    for h in homes:
        try:
            db.execute("""INSERT INTO homes(id,worker_id,head_name,house_number,area,city,phone,
                family_members,member_list,lat,lng,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""", h)
        except sqlite3.IntegrityError:
            pass

    # Seed surveys
    surveys = [
        ('SVY-001','ASHA-1001','H-001','Rajesh Kumar',45,'male','dengue','2026-08-15',
         'High fever, severe headache, joint pain',85000,5,'gums',None,None,None,102.5,78,'moderate',
         'Suspected Dengue. Platelet count low. Petechial rash on arms. Gums bleeding.',
         'Paracetamol. IV fluids. Refer to Victoria Hospital. Isolate with mosquito net.',
         'yes','Fogging requested for JP Nagar area.','completed','2026-08-15 10:00:00'),
        ('SVY-002','ASHA-1001','H-005','Pranav Reddy',12,'male','polio','2026-08-16',
         'None — routine NID campaign',None,None,None,'yes','3','yes',98.6,42,'mild',
         'Healthy child. OPV dose 3 administered. No signs of paralysis.',
         'OPV administered. Vitamin A given.',None,'Finger marked. Child card updated.','completed','2026-08-16 14:00:00'),
        ('SVY-003','ASHA-1002','H-003','Mahesh Sharma',38,'male','malaria','2026-08-18',
         'Intermittent fever, chills, sweating, fatigue',None,None,None,None,None,None,101.8,70,'moderate',
         'Rapid malaria test positive for P. vivax. Spleen palpable.',
         'Chloroquine course started. Refer for blood smear. Bed net provided.',
         'yes','Home inspected — no stagnant water. Mosquito coils distributed.','completed','2026-08-18 09:00:00'),
        ('SVY-004','ASHA-1002','H-004','Ravi Sharma',32,'male','polio','2026-08-19',
         'None — NID campaign',None,None,None,'yes','1','yes',98.4,68,'mild',
         'First dose OPV administered during NID campaign. No contraindications.',
         'OPV 1st dose. Vitamin A capsule.',None,'Campaign team marked finger. Data entered.','completed','2026-08-19 11:00:00'),
        ('SVY-005','ASHA-1001','H-002','Deepa Gowda',22,'female','dengue','2026-08-20',
         'Fever 3 days, severe headache, nausea',120000,3,'none',None,None,None,101.2,55,'mild',
         'Early dengue. Platelets borderline. No warning signs.',
         'Paracetamol only. Hydration advised. Return if platelets drop.',
         'yes','Home visit scheduled for 3 days.','completed','2026-08-20 16:00:00'),
        ('SVY-006','ASHA-1003','H-006','Girish Patil',50,'male','tb','2026-08-20',
         'Persistent cough for 3 weeks, weight loss, night sweats',None,None,None,None,None,None,99.8,65,'moderate',
         'Chronic cough, weight loss. Sputum sample collected. Suspected pulmonary TB.',
         'Referred to district TB centre for sputum test. Started on DOT.',
         'yes','TB suspect registered. Follow-up in 2 weeks.','completed','2026-08-20 10:00:00'),
        ('SVY-007','ASHA-1003','H-010','Darshan Hunnur',10,'male','measles','2026-08-21',
         'Rash on face and body, fever, red eyes',None,None,None,None,None,None,103.2,30,'moderate',
         'Maculopapular rash starting from face. Koplik spots observed. High fever.',
         'Paracetamol for fever. Vitamin A supplementation. Isolation advised.',
         'yes','Contact tracing done. Measles alert issued to nearby homes.','completed','2026-08-21 12:00:00'),
        ('SVY-008','ASHA-1001','H-008','Kavya Naik',20,'female','dengue','2026-08-22',
         'Mild fever, body ache, fatigue',180000,2,'none',None,None,None,100.2,52,'mild',
         'Mild dengue symptoms. Platelets normal. No warning signs.',
         'Paracetamol. Rest. Plenty of fluids.',
         'no','Mild case. Advised to report immediately if symptoms worsen.','completed','2026-08-22 15:00:00'),
    ]
    for s in surveys:
        try:
            db.execute("""INSERT INTO surveys(id,worker_id,home_id,person_name,age,gender,disease,
                survey_date,symptoms,platelets,fever_days,bleeding,opv,dose_num,finger_mark,
                temperature,weight,severity,findings,treatment,followup,notes,status,                created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", s)
        except sqlite3.IntegrityError:
            pass




    db.commit()
    db.close()

# ─── Auth ───────────────────────────────────────────────────────────
def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get('Authorization', '')
        if not auth.startswith('Bearer '):
            return jsonify({'error': 'Missing auth token'}), 401
        token = auth[7:]
        db = get_db()
        w = db.execute("SELECT * FROM workers WHERE id=?", (token,)).fetchone()
        if not w:
            return jsonify({'error': 'Invalid token'}), 401
        g.user = dict(w)
        g.user_role = 'worker'
        g.worker = dict(w)
        return f(*args, **kwargs)
    return decorated

def require_supervisor(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get('Authorization', '')
        if not auth.startswith('Bearer '):
            return jsonify({'error': 'Missing auth token'}), 401
        token = auth[7:]
        db = get_db()
        s = db.execute("SELECT * FROM supervisors WHERE id=?", (token,)).fetchone()
        if not s:
            return jsonify({'error': 'Supervisor access required'}), 403
        g.user = dict(s)
        g.user_role = 'supervisor'
        return f(*args, **kwargs)
    return decorated

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json or {}
    uid = data.get('workerId', '').strip().upper()
    pw = data.get('password', '')
    role = data.get('role', 'worker')
    db = get_db()
    pw_hash = hashlib.sha256(pw.encode()).hexdigest()

    if role == 'supervisor' or uid.startswith('SUP-'):
        s = db.execute("SELECT * FROM supervisors WHERE id=?", (uid,)).fetchone()
        if not s or s['password_hash'] != pw_hash:
            return jsonify({'error': 'Invalid supervisor ID or password'}), 401
        db.execute(
            "INSERT INTO login_activity(id,user_id,user_role,user_name,success) VALUES(?,?,?,?,1)",
            (str(uuid.uuid4()), s['id'], 'supervisor', s['name'])
        )
        db.commit()
        return jsonify({
            'token': s['id'],
            'role': 'supervisor',
            'worker': {'id': s['id'], 'name': s['name'], 'area': 'All Areas'}
        })

    w = db.execute("SELECT * FROM workers WHERE id=?", (uid,)).fetchone()
    if not w or w['password_hash'] != pw_hash:
        return jsonify({'error': 'Invalid worker ID or password'}), 401
    db.execute(
        "INSERT INTO login_activity(id,user_id,user_role,user_name,success) VALUES(?,?,?,?,1)",
        (str(uuid.uuid4()), w['id'], 'worker', w['name'])
    )
    db.commit()
    return jsonify({
        'token': w['id'],
        'role': 'worker',
        'worker': {'id': w['id'], 'name': w['name'], 'area': w['area']}
    })

# ─── Supervisor API ─────────────────────────────────────────────────
@app.route('/api/supervisor/overview', methods=['GET'])
@require_supervisor
def supervisor_overview():
    db = get_db()
    workers = db.execute("SELECT COUNT(*) FROM workers").fetchone()[0]
    homes = db.execute("SELECT COUNT(*) FROM homes").fetchone()[0]
    surveys = db.execute("SELECT COUNT(*) FROM surveys").fetchone()[0]
    cases = db.execute("SELECT COUNT(*) FROM surveys WHERE disease != 'polio'").fetchone()[0]
    return jsonify({
        'workers': workers,
        'homes': homes,
        'surveys': surveys,
        'diseaseCases': cases
    })

@app.route('/api/supervisor/homes', methods=['GET'])
@require_supervisor
def supervisor_homes():
    db = get_db()
    rows = db.execute("""
        SELECT h.*, w.name AS worker_name
        FROM homes h LEFT JOIN workers w ON h.worker_id=w.id
        ORDER BY h.created_at DESC, h.id
    """).fetchall()
    return jsonify([dict(r) for r in rows])

@app.route('/api/supervisor/surveys', methods=['GET'])
@require_supervisor
def supervisor_surveys():
    db = get_db()
    rows = db.execute("""
        SELECT s.*, w.name AS worker_name, h.head_name AS home_head
        FROM surveys s
        LEFT JOIN workers w ON s.worker_id=w.id
        LEFT JOIN homes h ON s.home_id=h.id
        ORDER BY s.survey_date DESC, s.created_at DESC
    """).fetchall()
    return jsonify([dict(r) for r in rows])

@app.route('/api/supervisor/workers', methods=['GET'])
@require_supervisor
def supervisor_workers():
    db = get_db()
    rows = db.execute("""
        SELECT w.id, w.name, w.area, w.created_at,
               COUNT(DISTINCT h.id) AS homes_count,
               COUNT(DISTINCT s.id) AS surveys_count
        FROM workers w
        LEFT JOIN homes h ON h.worker_id=w.id
        LEFT JOIN surveys s ON s.worker_id=w.id
        GROUP BY w.id
        ORDER BY w.name
    """).fetchall()
    return jsonify([dict(r) for r in rows])

@app.route('/api/supervisor/workers', methods=['POST'])
@require_supervisor
def supervisor_add_worker():
    data = request.get_json(silent=True) or {}
    worker_id = str(data.get('id', '')).strip().upper()
    name = str(data.get('name', '')).strip()
    area = str(data.get('area', '')).strip()
    password = str(data.get('password', ''))

    if not worker_id or not name or not area or not password:
        return jsonify({'error': 'Worker ID, name, area and password are required.'}), 400
    if not worker_id.startswith('ASHA-'):
        return jsonify({'error': 'Worker ID must start with ASHA-, for example ASHA-1004.'}), 400
    if len(password) < 4:
        return jsonify({'error': 'Password must be at least 4 characters.'}), 400

    db = get_db()
    existing = db.execute('SELECT id FROM workers WHERE id=?', (worker_id,)).fetchone()
    if existing:
        return jsonify({'error': 'An ASHA worker with this ID already exists.'}), 409

    password_hash = hashlib.sha256(password.encode()).hexdigest()
    db.execute(
        'INSERT INTO workers(id,name,area,password_hash) VALUES(?,?,?,?)',
        (worker_id, name, area, password_hash)
    )
    db.commit()
    return jsonify({
        'message': 'ASHA worker added successfully.',
        'worker': {'id': worker_id, 'name': name, 'area': area, 'homes_count': 0, 'surveys_count': 0}
    }), 201

@app.route('/api/supervisor/activity', methods=['GET'])
@require_supervisor
def supervisor_activity():
    db = get_db()
    rows = db.execute("""
        SELECT id,user_id,user_role,user_name,login_at,success
        FROM login_activity
        ORDER BY login_at DESC LIMIT 50
    """).fetchall()
    return jsonify([dict(r) for r in rows])

# ─── Homes CRUD ─────────────────────────────────────────────────────
@app.route('/api/homes', methods=['GET'])
@require_auth
def get_homes():
    db = get_db()
    rows = db.execute("SELECT * FROM homes WHERE worker_id=? ORDER BY created_at DESC", (g.worker['id'],)).fetchall()
    return jsonify([dict(r) for r in rows])

@app.route('/api/homes', methods=['POST'])
@require_auth
def create_home():
    data = request.json
    db = get_db()
    count = db.execute("SELECT COUNT(*) FROM homes").fetchone()[0]
    hid = f"H-{count+1:03d}"
    db.execute("""INSERT INTO homes(id,worker_id,head_name,house_number,area,city,phone,
        family_members,member_list,lat,lng) VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
        (hid, g.worker['id'], data['headName'], data['houseNumber'], data['area'],
         data['city'], data.get('phone',''), data.get('familyMembers',1),
         json.dumps(data.get('memberList',[])), data.get('lat'), data.get('lng')))
    db.commit()
    return jsonify({'id': hid, 'message': 'Home registered successfully'}), 201

@app.route('/api/homes/<hid>', methods=['GET'])
@require_auth
def get_home(hid):
    db = get_db()
    h = db.execute("SELECT * FROM homes WHERE id=?", (hid,)).fetchone()
    if not h: return jsonify({'error': 'Home not found'}), 404
    surveys = db.execute("SELECT * FROM surveys WHERE home_id=? ORDER BY created_at DESC", (hid,)).fetchall()
    photos = []
    for s in surveys:
        ph = db.execute("SELECT * FROM photos WHERE survey_id=?", (s['id'],)).fetchall()
        photos.extend([dict(p) for p in ph])
    return jsonify({'home': dict(h), 'surveys': [dict(s) for s in surveys], 'photos': photos})

@app.route('/api/homes/<hid>', methods=['PUT'])
@require_auth
def update_home(hid):
    data = request.json
    db = get_db()
    h = db.execute("SELECT * FROM homes WHERE id=?", (hid,)).fetchone()
    if not h: return jsonify({'error': 'Home not found'}), 404
    db.execute("""UPDATE homes SET head_name=?, house_number=?, area=?, city=?, phone=?,
        family_members=?, member_list=?, lat=?, lng=? WHERE id=?""",
        (data.get('headName', h['head_name']), data.get('houseNumber', h['house_number']),
         data.get('area', h['area']), data.get('city', h['city']),
         data.get('phone', h['phone']), data.get('familyMembers', h['family_members']),
         json.dumps(data.get('memberList', [])), data.get('lat', h['lat']),
         data.get('lng', h['lng']), hid))
    db.commit()
    return jsonify({'message': 'Home updated successfully'})

@app.route('/api/homes/<hid>', methods=['DELETE'])
@require_auth
def delete_home(hid):
    db = get_db()
    db.execute("DELETE FROM photos WHERE survey_id IN (SELECT id FROM surveys WHERE home_id=?)", (hid,))
    db.execute("DELETE FROM surveys WHERE home_id=?", (hid,))
    db.execute("DELETE FROM homes WHERE id=?", (hid,))
    db.commit()
    return jsonify({'message': 'Home deleted'})

# ─── Surveys CRUD ───────────────────────────────────────────────────
@app.route('/api/surveys', methods=['GET'])
@require_auth
def get_surveys():
    db = get_db()
    rows = db.execute("SELECT * FROM surveys WHERE worker_id=? ORDER BY created_at DESC", (g.worker['id'],)).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        photos = db.execute("SELECT * FROM photos WHERE survey_id=?", (d['id'],)).fetchall()
        d['photos'] = [dict(p) for p in photos]
        result.append(d)
    return jsonify(result)

@app.route('/api/surveys', methods=['POST'])
@require_auth
def create_survey():
    data = request.json
    db = get_db()
    count = db.execute("SELECT COUNT(*) FROM surveys").fetchone()[0]
    sid = f"SVY-{count+1:03d}"
    db.execute("""INSERT INTO surveys(id,worker_id,home_id,person_name,age,gender,disease,
        survey_date,symptoms,platelets,fever_days,bleeding,opv,dose_num,finger_mark,
        temperature,weight,severity,findings,treatment,followup,notes,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (sid, g.worker['id'], data['homeId'], data['personName'], data.get('age'),
         data.get('gender'), data['disease'], data['surveyDate'], data.get('symptoms',''),
         data.get('platelets'), data.get('feverDays'), data.get('bleeding'),
         data.get('opv'), data.get('doseNum'), data.get('fingerMark'),
         data.get('temperature'), data.get('weight'), data.get('severity','mild'),
         data.get('findings',''), data.get('treatment',''), data.get('followup','no'),
         data.get('notes',''), 'completed'))
    db.commit()
    return jsonify({'id': sid, 'message': 'Survey submitted successfully'}), 201

@app.route('/api/surveys/<sid>', methods=['DELETE'])
@require_auth
def delete_survey(sid):
    db = get_db()
    db.execute("DELETE FROM photos WHERE survey_id=?", (sid,))
    db.execute("DELETE FROM surveys WHERE id=?", (sid,))
    db.commit()
    return jsonify({'message': 'Survey deleted'})

# ─── Photo Upload ───────────────────────────────────────────────────
@app.route('/api/surveys/<sid>/photos', methods=['POST'])
@require_auth
def upload_photo(sid):
    db = get_db()
    survey = db.execute("SELECT * FROM surveys WHERE id=?", (sid,)).fetchone()
    if not survey: return jsonify({'error': 'Survey not found'}), 404

    if 'photo' in request.files:
        f = request.files['photo']
        ext = f.filename.rsplit('.', 1)[-1] if '.' in f.filename else 'jpg'
        fname = f"{sid}_{uuid.uuid4().hex[:8]}.{ext}"
        f.save(os.path.join(UPLOAD_DIR, fname))
        lat = request.form.get('lat')
        lng = request.form.get('lng')
        altitude = request.form.get('altitude')
        accuracy = request.form.get('accuracy')
        taken_at = request.form.get('takenAt')
        pid = f"PH-{uuid.uuid4().hex[:8]}"
        db.execute("""INSERT INTO photos(id,survey_id,filename,lat,lng,altitude,accuracy,taken_at)
            VALUES(?,?,?,?,?,?,?,?)""",
            (pid, sid, fname,
             float(lat) if lat else None,
             float(lng) if lng else None,
             float(altitude) if altitude else None,
             float(accuracy) if accuracy else None,
             taken_at))
        db.commit()
        return jsonify({'id': pid, 'filename': fname, 'message': 'Photo uploaded'}), 201

    # Base64 upload from frontend
    data = request.json
    if data and data.get('image'):
        img_data = data['image']
        if ',' in img_data:
            img_data = img_data.split(',', 1)[1]
        ext = 'jpg'
        if 'png' in data.get('image', ''):
            ext = 'png'
        fname = f"{sid}_{uuid.uuid4().hex[:8]}.{ext}"
        with open(os.path.join(UPLOAD_DIR, fname), 'wb') as f:
            f.write(base64.b64decode(img_data))
        pid = f"PH-{uuid.uuid4().hex[:8]}"
        db.execute("""INSERT INTO photos(id,survey_id,filename,lat,lng,altitude,accuracy,taken_at)
            VALUES(?,?,?,?,?,?,?,?)""",
            (pid, sid, fname,
             data.get('lat'), data.get('lng'), data.get('altitude'),
             data.get('accuracy'), data.get('takenAt')))
        db.commit()
        return jsonify({'id': pid, 'filename': fname, 'message': 'Photo uploaded'}), 201

    return jsonify({'error': 'No photo provided'}), 400

@app.route('/uploads/<filename>')
def serve_photo(filename):
    return send_from_directory(UPLOAD_DIR, filename)

# ─── Reports ────────────────────────────────────────────────────────
@app.route('/api/reports', methods=['GET'])
@require_auth
def get_reports():
    db = get_db()
    wid = g.worker['id']

    # Disease counts
    disease_counts = db.execute(
        "SELECT disease, COUNT(*) as cnt FROM surveys WHERE worker_id=? GROUP BY disease ORDER BY cnt DESC",
        (wid,)).fetchall()

    # Area homes
    area_counts = db.execute(
        "SELECT area, COUNT(*) as cnt FROM homes WHERE worker_id=? GROUP BY area ORDER BY cnt DESC",
        (wid,)).fetchall()

    # Polio stats
    polio_total = db.execute(
        "SELECT COUNT(*) FROM surveys WHERE worker_id=? AND disease='polio'", (wid,)).fetchone()[0]
    polio_given = db.execute(
        "SELECT COUNT(*) FROM surveys WHERE worker_id=? AND disease='polio' AND opv='yes'", (wid,)).fetchone()[0]
    polio_refused = db.execute(
        "SELECT COUNT(*) FROM surveys WHERE worker_id=? AND disease='polio' AND opv='no'", (wid,)).fetchone()[0]

    # Surveys over time
    time_data = db.execute(
        "SELECT strftime('%Y-%m', survey_date) as month, COUNT(*) as cnt FROM surveys WHERE worker_id=? GROUP BY month ORDER BY month",
        (wid,)).fetchall()

    return jsonify({
        'diseaseCounts': [dict(r) for r in disease_counts],
        'areaCounts': [dict(r) for r in area_counts],
        'polio': {'total': polio_total, 'given': polio_given, 'refused': polio_refused},
        'timeData': [dict(r) for r in time_data]
    })

# ─── Stats ──────────────────────────────────────────────────────────
@app.route('/api/stats', methods=['GET'])
@require_auth
def get_stats():
    db = get_db()
    wid = g.worker['id']
    total_homes = db.execute("SELECT COUNT(*) FROM homes WHERE worker_id=?", (wid,)).fetchone()[0]
    total_surveys = db.execute("SELECT COUNT(*) FROM surveys WHERE worker_id=?", (wid,)).fetchone()[0]
    disease_cases = db.execute("SELECT COUNT(*) FROM surveys WHERE worker_id=? AND disease != 'polio'", (wid,)).fetchone()[0]
    people_surveyed = total_surveys  # one person per survey
    photos_count = db.execute("""SELECT COUNT(*) FROM photos WHERE survey_id IN
        (SELECT id FROM surveys WHERE worker_id=?)""", (wid,)).fetchone()[0]
    polio_drops = db.execute(
        "SELECT COUNT(*) FROM surveys WHERE worker_id=? AND disease='polio' AND opv='yes'", (wid,)).fetchone()[0]

    return jsonify({
        'totalHomes': total_homes,
        'totalSurveys': total_surveys,
        'diseaseCases': disease_cases,
        'peopleSurveyed': people_surveyed,
        'photosCaptured': photos_count,
        'polioDrops': polio_drops
    })

# ─── All homes (for map - includes all workers' homes) ──────────────
@app.route('/api/homes/all', methods=['GET'])
@require_auth
def get_all_homes():
    db = get_db()
    rows = db.execute("SELECT * FROM homes ORDER BY created_at DESC").fetchall()
    return jsonify([dict(r) for r in rows])

# ─── Serve frontend ─────────────────────────────────────────────────
@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

# ─── Init & Run ─────────────────────────────────────────────────────
init_db()

if __name__ == '__main__':
    print("Sehat ASHA Home Survey System")
    print("Server running at http://localhost:5000")
    print("ASHA Demo: ASHA-1001 / sehat123")
    print("Supervisor Demo: SUP-1001 / super123")
    app.run(host='0.0.0.0', port=5000, debug=True)
