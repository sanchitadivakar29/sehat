/* Sehat - ASHA Home Survey System - Clean JS */

var useBackend = false;
var token = null;
var cu = null;
var homes = [];
var surveys = [];
var curDel = null;
var curEdit = null;
var addMap = null;
var mainMap = null;
var homeMarker = null;
var mapMarkers = [];
var aiPredictions = [];
var loginRole = 'worker';
var supervisorHomes = [];
var supervisorSurveys = [];
var supervisorWorkers = [];
var supervisorActivity = [];

/* ===== AI Disease Predictor ===== */
var DISEASE_KB = {
  dengue: {
    name: 'Dengue Fever', icon: '\uD83E\uDD9B',
    keywords: { 'high fever': 3, 'fever': 2, 'severe headache': 3, 'headache': 1.5, 'joint pain': 3, 'muscle pain': 2, 'body ache': 1.5, 'rash': 2, 'petechial rash': 3, 'bleeding': 2.5, 'gums bleeding': 3, 'nose bleed': 2.5, 'nausea': 1.5, 'vomiting': 1.5, 'fatigue': 1, 'low platelets': 3, 'skin rash': 2, 'dengue': 5, 'myalgia': 2, 'arthralgia': 2, 'abdominal pain': 1.5 },
    vitals: { platelets: { low: 100000, weight: 3 }, temperature: { min: 101, weight: 2 } },
    description: 'Viral infection spread by Aedes mosquitoes. Can cause severe bleeding and shock.'
  },
  malaria: {
    name: 'Malaria', icon: '\uD83E\uDD9B',
    keywords: { 'intermittent fever': 3, 'chills': 3, 'shivering': 2.5, 'sweating': 2, 'high fever': 2, 'fever': 2, 'headache': 1.5, 'fatigue': 2, 'vomiting': 1.5, 'body ache': 1.5, 'spleen': 3, 'spleen palpable': 4, 'malaria': 5, 'plasmodium': 4, 'anemia': 2, 'rigors': 3, 'night sweats': 1.5, 'jaundice': 2 },
    vitals: { temperature: { min: 101, weight: 2 } },
    description: 'Parasitic infection spread by Anopheles mosquitoes. Causes cyclical fever and chills.'
  },
  polio: {
    name: 'Polio', icon: '\uD83D\uDC89',
    keywords: { 'polio': 5, 'paralysis': 4, 'limb weakness': 4, 'flaccid paralysis': 5, 'difficulty walking': 2, 'opv': 3, 'vaccination': 2, 'nid campaign': 2, 'oral polio': 3, 'fever': 1, 'stiff neck': 2, 'vomiting': 1 },
    vitals: {},
    description: 'Viral disease causing paralysis. Prevented by OPV vaccination campaign.'
  },
  tb: {
    name: 'Tuberculosis (TB)', icon: '\uD83E\uDEC1',
    keywords: { 'persistent cough': 4, 'chronic cough': 4, 'cough': 2, 'cough for weeks': 5, 'weight loss': 3, 'night sweats': 3, 'hemoptysis': 4, 'blood in sputum': 4, 'sputum': 2, 'tb': 5, 'tuberculosis': 5, 'chest pain': 2, 'fatigue': 1.5, 'weakness': 1, 'fever': 1, 'loss of appetite': 2, 'lymph node': 2, 'dyspnea': 1.5 },
    vitals: { temperature: { min: 99, weight: 1 } },
    description: 'Bacterial infection affecting lungs. Spread through airborne droplets.'
  },
  cholera: {
    name: 'Cholera', icon: '\uD83D\uDCA7',
    keywords: { 'watery diarrhea': 4, 'diarrhea': 2, 'rice water stool': 5, 'vomiting': 2, 'dehydration': 3, 'severe dehydration': 4, 'muscle cramp': 2, 'cramps': 1.5, 'cholera': 5, 'oral rehydration': 2, 'profuse diarrhea': 4 },
    vitals: {},
    description: 'Bacterial infection causing severe watery diarrhea. Spread through contaminated water.'
  },
  measles: {
    name: 'Measles', icon: '\uD83D\uDD34',
    keywords: { 'rash': 2.5, 'maculopapular rash': 4, 'measles': 5, 'koplik spots': 5, 'high fever': 2, 'fever': 1.5, 'cough': 1.5, 'conjunctivitis': 2, 'red eyes': 2, 'runny nose': 1.5, 'rash on face': 3, 'rash spreading': 3, 'contact tracing': 2 },
    vitals: { temperature: { min: 102, weight: 2 } },
    description: 'Highly contagious viral infection. Prevented by MMR vaccine. Can be fatal.'
  },
  other: {
    name: 'Other / Undiagnosed', icon: '\uD83D\uDCCB',
    keywords: { 'fever': 1, 'headache': 1, 'cold': 1, 'cough': 1, 'fatigue': 1 },
    vitals: {},
    description: 'Other condition requiring further investigation.'
  }
};

function predictDisease(symptomsText, vitals) {
  if (!symptomsText || symptomsText.trim().length < 3) return [];
  var text = symptomsText.toLowerCase().replace(/[,;.!?]/g, ' ');
  var scores = {};
  var matches = {};

  var diseases = Object.keys(DISEASE_KB);
  for (var d = 0; d < diseases.length; d++) {
    var disease = diseases[d];
    if (disease === 'other') continue;
    var kb = DISEASE_KB[disease];
    var score = 0;
    var matched = [];
    var keywords = Object.keys(kb.keywords);
    for (var k = 0; k < keywords.length; k++) {
      if (text.indexOf(keywords[k].toLowerCase()) >= 0) {
        score += kb.keywords[keywords[k]];
        matched.push(keywords[k]);
      }
    }
    if (vitals && kb.vitals) {
      if (vitals.platelets && kb.vitals.platelets) {
        if (vitals.platelets < kb.vitals.platelets.low) {
          score += kb.vitals.platelets.weight;
          matched.push('low platelets');
        }
      }
      if (vitals.temperature && kb.vitals.temperature) {
        if (vitals.temperature >= kb.vitals.temperature.min) {
          score += kb.vitals.temperature.weight;
          matched.push('elevated temp');
        }
      }
    }
    if (score > 0) {
      scores[disease] = score;
      matches[disease] = matched;
    }
  }

  var totalScore = 0;
  var skeys = Object.keys(scores);
  for (var s = 0; s < skeys.length; s++) totalScore += scores[skeys[s]];
  if (totalScore === 0) return [];

  var results = [];
  for (var r = 0; r < skeys.length; r++) {
    var dk = skeys[r];
    var kb = DISEASE_KB[dk];
    results.push({
      disease: dk,
      name: kb.name,
      icon: kb.icon,
      confidence: Math.min(Math.round((scores[dk] / totalScore) * 100), 95),
      matchedSymptoms: matches[dk],
      description: kb.description
    });
  }
  results.sort(function(a, b) { return b.confidence - a.confidence; });
  return results.slice(0, 3);
}

function renderAIPredictions() {
  var symptoms = (document.getElementById('sv-symptoms') || {}).value || '';
  var platelets = parseInt((document.getElementById('sv-platelets') || {}).value) || null;
  var temperature = parseFloat((document.getElementById('sv-temp') || {}).value) || null;
  var container = document.getElementById('ai-predictions');
  if (!container) return;
  if (symptoms.trim().length < 3) {
    container.innerHTML = '<p style="color:var(--gray-400);font-size:13px;text-align:center;padding:16px">Type symptoms above to get AI disease predictions...</p>';
    return;
  }
  var predictions = predictDisease(symptoms, { platelets: platelets, temperature: temperature });
  aiPredictions = predictions;
  if (predictions.length === 0) {
    container.innerHTML = '<p style="color:var(--gray-400);font-size:13px;text-align:center;padding:16px">No strong matches found. Try adding more specific symptoms.</p>';
    return;
  }
  var colors = ['var(--danger)', 'var(--warning)', 'var(--primary)'];
  var bgColors = ['var(--red-light)', 'var(--warning-light)', 'var(--primary-bg)'];
  var html = '';
  for (var i = 0; i < predictions.length; i++) {
    var p = predictions[i];
    html += '<div class="ai-card" style="border-left:4px solid ' + colors[i] + ';background:' + bgColors[i] + '" onclick="selectPrediction(\'' + p.disease + '\')">';
    html += '<div class="ai-header">';
    html += '<span class="ai-icon">' + p.icon + '</span>';
    html += '<div class="ai-info"><strong>' + esc(p.name) + '</strong>';
    html += '<span class="ai-conf" style="color:' + colors[i] + '">' + p.confidence + '% match</span></div>';
    html += '<div class="ai-bar-bg"><div class="ai-bar-fill" style="width:' + p.confidence + '%;background:' + colors[i] + '"></div></div>';
    html += '</div>';
    html += '<div class="ai-symptoms"><small>Matched: ' + p.matchedSymptoms.join(', ') + '</small></div>';
    html += '<p class="ai-desc">' + esc(p.description) + '</p>';
    if (i === 0) html += '<span class="ai-recommended">Recommended</span>';
    html += '</div>';
  }
  container.innerHTML = html;
}

function selectPrediction(disease) {
  var sel = document.getElementById('sv-disease');
  if (sel) { sel.value = disease; updateDiseaseFields(); }
  toast('Disease selected: ' + DISEASE_KB[disease].name, 'ts');
}

/* ===== Backend detection ===== */
async function detectBackend() {
  try {
    var r = await fetch('/api/stats', { method: 'GET', signal: AbortSignal.timeout(2000) });
    if (r.ok || r.status === 401) { useBackend = true; return; }
  } catch (e) { }
  useBackend = false;
}

/* ===== API helper ===== */
async function api(path, opts) {
  opts = opts || {};
  var headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (opts.body && typeof FormData !== 'undefined' && opts.body instanceof FormData) delete headers['Content-Type'];
  var res = await fetch(path, { method: opts.method || 'GET', body: opts.body ? opts.body : undefined, headers: headers });
  var data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

/* ===== localStorage helpers ===== */
function lsLoad(key, fallback) {
  try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch (e) { return fallback; }
}
function lsSave(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

function getOfflineWorkers() {
  var extra = lsLoad('sehat_extra_workers', {});
  var merged = {};
  Object.keys(WORKERS_OFFLINE).forEach(function(id){ merged[id] = WORKERS_OFFLINE[id]; });
  Object.keys(extra).forEach(function(id){ merged[id] = extra[id]; });
  return merged;
}

/* ===== Seed data ===== */
function seedHomes() {
  return [
    { id: 'H-001', head_name: 'Rajesh Kumar', house_number: 'H-12', area: 'JP Nagar', city: 'Bengaluru', phone: '+91 98765 43210', family_members: 6, member_list: JSON.stringify([{ name: 'Rajesh Kumar', age: 45, gender: 'male' }, { name: 'Lakshmi Kumar', age: 40, gender: 'female' }]), lat: 12.9141, lng: 77.6446, created_at: '2026-08-10', worker_id: 'ASHA-1001' },
    { id: 'H-002', head_name: 'Suresh Gowda', house_number: 'H-34', area: 'Whitefield', city: 'Bengaluru', phone: '+91 87654 32109', family_members: 8, member_list: JSON.stringify([{ name: 'Suresh Gowda', age: 52, gender: 'male' }]), lat: 12.9698, lng: 77.7500, created_at: '2026-08-11', worker_id: 'ASHA-1001' },
    { id: 'H-003', head_name: 'Mahesh Sharma', house_number: 'H-56', area: 'Saraswathipuram', city: 'Mysuru', phone: '+91 76543 21098', family_members: 5, member_list: JSON.stringify([{ name: 'Mahesh Sharma', age: 38, gender: 'male' }]), lat: 12.3116, lng: 76.6530, created_at: '2026-08-12', worker_id: 'ASHA-1002' },
    { id: 'H-004', head_name: 'Lakshmi Devi', house_number: 'H-78', area: 'Gokulam', city: 'Mysuru', phone: '+91 65432 10987', family_members: 4, member_list: JSON.stringify([{ name: 'Lakshmi Devi', age: 60, gender: 'female' }]), lat: 12.3200, lng: 76.6150, created_at: '2026-08-13', worker_id: 'ASHA-1002' },
    { id: 'H-005', head_name: 'Venkatesh Reddy', house_number: 'H-90', area: 'Koramangala', city: 'Bengaluru', phone: '+91 54321 09876', family_members: 7, member_list: JSON.stringify([{ name: 'Venkatesh Reddy', age: 42, gender: 'male' }, { name: 'Sunitha Reddy', age: 38, gender: 'female' }, { name: 'Pranav Reddy', age: 12, gender: 'male' }]), lat: 12.9352, lng: 77.6245, created_at: '2026-08-14', worker_id: 'ASHA-1001' },
    { id: 'H-006', head_name: 'Girish Patil', house_number: 'H-15', area: 'Vidyanagar', city: 'Hubballi', phone: '+91 43210 98765', family_members: 5, member_list: JSON.stringify([{ name: 'Girish Patil', age: 50, gender: 'male' }]), lat: 15.3647, lng: 75.1240, created_at: '2026-08-14', worker_id: 'ASHA-1003' },
    { id: 'H-007', head_name: 'Sunita Kulkarni', house_number: 'H-28', area: 'Deshpande Nagar', city: 'Hubballi', phone: '+91 32109 87654', family_members: 4, member_list: JSON.stringify([{ name: 'Sunita Kulkarni', age: 35, gender: 'female' }]), lat: 15.3700, lng: 75.1100, created_at: '2026-08-15', worker_id: 'ASHA-1003' },
    { id: 'H-008', head_name: 'Prakash Naik', house_number: 'H-45', area: 'Indiranagar', city: 'Bengaluru', phone: '+91 21098 76543', family_members: 6, member_list: JSON.stringify([{ name: 'Prakash Naik', age: 48, gender: 'male' }]), lat: 12.9716, lng: 77.6412, created_at: '2026-08-16', worker_id: 'ASHA-1001' },
    { id: 'H-009', head_name: 'Shivanna M', house_number: 'H-67', area: 'Siddarthanagar', city: 'Mysuru', phone: '+91 10987 65432', family_members: 7, member_list: JSON.stringify([{ name: 'Shivanna M', age: 55, gender: 'male' }]), lat: 12.3000, lng: 76.6700, created_at: '2026-08-17', worker_id: 'ASHA-1002' },
    { id: 'H-010', head_name: 'Basavaraj Hunnur', house_number: 'H-82', area: 'Nava Nagar', city: 'Hubballi', phone: '+91 09876 54321', family_members: 5, member_list: JSON.stringify([{ name: 'Basavaraj Hunnur', age: 40, gender: 'male' }, { name: 'Sunanda Hunnur', age: 36, gender: 'female' }, { name: 'Darshan Hunnur', age: 10, gender: 'male' }]), lat: 15.3550, lng: 75.1350, created_at: '2026-08-18', worker_id: 'ASHA-1003' }
  ];
}

function seedSurveys() {
  return [
    { id: 'SVY-001', home_id: 'H-001', person_name: 'Rajesh Kumar', age: 45, gender: 'male', disease: 'dengue', survey_date: '2026-08-15', symptoms: 'High fever, severe headache, joint pain', platelets: 85000, fever_days: 5, bleeding: 'gums', opv: null, dose_num: null, finger_mark: null, temperature: 102.5, weight: 78, severity: 'moderate', findings: 'Suspected Dengue. Platelet count low.', treatment: 'Paracetamol. IV fluids.', followup: 'yes', notes: 'Fogging requested.', status: 'completed', created_at: '2026-08-15T10:00:00', worker_id: 'ASHA-1001', photos: [] },
    { id: 'SVY-002', home_id: 'H-005', person_name: 'Pranav Reddy', age: 12, gender: 'male', disease: 'polio', survey_date: '2026-08-16', symptoms: 'None - routine NID campaign', platelets: null, fever_days: null, bleeding: null, opv: 'yes', dose_num: '3', finger_mark: 'yes', temperature: 98.6, weight: 42, severity: 'mild', findings: 'Healthy child. OPV dose 3 administered.', treatment: 'OPV administered.', followup: 'no', notes: 'Finger marked.', status: 'completed', created_at: '2026-08-16T14:00:00', worker_id: 'ASHA-1001', photos: [] },
    { id: 'SVY-003', home_id: 'H-003', person_name: 'Mahesh Sharma', age: 38, gender: 'male', disease: 'malaria', survey_date: '2026-08-18', symptoms: 'Intermittent fever, chills, sweating, fatigue', platelets: null, fever_days: null, bleeding: null, opv: null, dose_num: null, finger_mark: null, temperature: 101.8, weight: 70, severity: 'moderate', findings: 'Rapid malaria test positive for P. vivax.', treatment: 'Chloroquine course started.', followup: 'yes', notes: 'Home inspected.', status: 'completed', created_at: '2026-08-18T09:00:00', worker_id: 'ASHA-1002', photos: [] },
    { id: 'SVY-004', home_id: 'H-004', person_name: 'Lakshmi Devi', age: 60, gender: 'female', disease: 'polio', survey_date: '2026-08-19', symptoms: 'None - NID campaign', platelets: null, fever_days: null, bleeding: null, opv: 'yes', dose_num: '1', finger_mark: 'yes', temperature: 98.4, weight: 55, severity: 'mild', findings: 'OPV dose administered during NID campaign.', treatment: 'OPV 1st dose.', followup: 'no', notes: 'Campaign team marked finger.', status: 'completed', created_at: '2026-08-19T11:00:00', worker_id: 'ASHA-1002', photos: [] },
    { id: 'SVY-005', home_id: 'H-002', person_name: 'Suresh Gowda', age: 52, gender: 'male', disease: 'dengue', survey_date: '2026-08-20', symptoms: 'Fever 3 days, severe headache, nausea', platelets: 120000, fever_days: 3, bleeding: 'none', opv: null, dose_num: null, finger_mark: null, temperature: 101.2, weight: 85, severity: 'mild', findings: 'Early dengue. Platelets borderline.', treatment: 'Paracetamol only.', followup: 'yes', notes: 'Home visit scheduled.', status: 'completed', created_at: '2026-08-20T16:00:00', worker_id: 'ASHA-1001', photos: [] },
    { id: 'SVY-006', home_id: 'H-006', person_name: 'Girish Patil', age: 50, gender: 'male', disease: 'tb', survey_date: '2026-08-20', symptoms: 'Persistent cough for 3 weeks, weight loss, night sweats', platelets: null, fever_days: null, bleeding: null, opv: null, dose_num: null, finger_mark: null, temperature: 99.8, weight: 65, severity: 'moderate', findings: 'Chronic cough, weight loss. Suspected pulmonary TB.', treatment: 'Referred to district TB centre.', followup: 'yes', notes: 'TB suspect registered.', status: 'completed', created_at: '2026-08-20T10:00:00', worker_id: 'ASHA-1003', photos: [] },
    { id: 'SVY-007', home_id: 'H-010', person_name: 'Darshan Hunnur', age: 10, gender: 'male', disease: 'measles', survey_date: '2026-08-21', symptoms: 'Rash on face and body, fever, red eyes', platelets: null, fever_days: null, bleeding: null, opv: null, dose_num: null, finger_mark: null, temperature: 103.2, weight: 30, severity: 'moderate', findings: 'Maculopapular rash starting from face.', treatment: 'Paracetamol. Vitamin A.', followup: 'yes', notes: 'Contact tracing done.', status: 'completed', created_at: '2026-08-21T12:00:00', worker_id: 'ASHA-1003', photos: [] },
    { id: 'SVY-008', home_id: 'H-008', person_name: 'Prakash Naik', age: 48, gender: 'male', disease: 'dengue', survey_date: '2026-08-22', symptoms: 'Mild fever, body ache, fatigue', platelets: 180000, fever_days: 2, bleeding: 'none', opv: null, dose_num: null, finger_mark: null, temperature: 100.2, weight: 72, severity: 'mild', findings: 'Mild dengue symptoms. Platelets normal.', treatment: 'Paracetamol. Rest.', followup: 'no', notes: 'Mild case.', status: 'completed', created_at: '2026-08-22T15:00:00', worker_id: 'ASHA-1001', photos: [] }
  ];
}

var WORKERS_OFFLINE = {
  'ASHA-1001': { pw: 'sehat123', name: 'Fatima Bibi', area: 'Bengaluru Urban' },
  'ASHA-1002': { pw: 'admin', name: 'Zainab Begum', area: 'Mysuru District' },
  'ASHA-1003': { pw: 'sehat456', name: 'Nadia Parveen', area: 'Hubballi-Dharwad' }
};
var SUPERVISORS_OFFLINE = {
  'SUP-1001': { pw: 'super123', name: 'Dr. Priya Sharma', area: 'All Areas' }
};

var AREA_LOCALITIES = {
  'Bengaluru Urban': ['JP Nagar', 'Whitefield', 'Koramangala', 'Indiranagar', 'HSR Layout', 'Electronic City'],
  'Mysuru District': ['Saraswathipuram', 'Gokulam', 'Siddarthanagar', 'Vani Mohalla', 'Hebbal', 'Kuvempunagar'],
  'Hubballi-Dharwad': ['Vidyanagar', 'Deshpande Nagar', 'Nava Nagar', 'Keshwapur', 'Station Road', 'Unkal']
};

function getWorkerLocalities() { return cu ? (AREA_LOCALITIES[cu.area] || []) : []; }

function prefillHomeArea() {
  var areaInput = document.getElementById('h-area');
  if (!areaInput || !cu) return;
  var locs = getWorkerLocalities();
  if (locs.length > 0 && !areaInput.value) { areaInput.placeholder = 'e.g. ' + locs.join(', '); }
  var hint = document.getElementById('area-hint');
  if (hint && cu.area) hint.textContent = 'Your area: ' + cu.area;
}

/* ===== Data loading ===== */
async function loadAllData() {
  if (useBackend) {
    try { homes = await api('/api/homes'); surveys = await api('/api/surveys'); }
    catch (e) { homes = []; surveys = []; }
  } else {
    homes = lsLoad('sehat_homes', null);
    if (!homes) { homes = seedHomes(); lsSave('sehat_homes', homes); }
    surveys = lsLoad('sehat_surveys', null);
    if (!surveys) { surveys = seedSurveys(); lsSave('sehat_surveys', surveys); }
  }
}

/* ===== Init ===== */
document.addEventListener('DOMContentLoaded', async function() {
  await detectBackend();
  token = localStorage.getItem('sehat_token');
  cu = JSON.parse(localStorage.getItem('sehat_user') || 'null');
  loginRole = localStorage.getItem('sehat_role') || (cu && cu.role) || 'worker';
  setLoginRole(loginRole);
  if (token && cu) showDash();
  var di = document.getElementById('sv-date');
  if (di) di.valueAsDate = new Date();
  document.getElementById('login-form').addEventListener('submit', doLogin);
});

/* ===== Auth ===== */
function setLoginRole(role) {
  loginRole = role;
  var workerBtn = document.getElementById('role-worker');
  var supervisorBtn = document.getElementById('role-supervisor');
  var label = document.getElementById('login-id-label');
  var subtitle = document.getElementById('login-subtitle');
  var input = document.getElementById('wid');
  var workerDemo = document.getElementById('worker-demo');
  var supervisorDemo = document.getElementById('supervisor-demo');
  if (workerBtn) workerBtn.classList.toggle('active', role === 'worker');
  if (supervisorBtn) supervisorBtn.classList.toggle('active', role === 'supervisor');
  if (label) label.textContent = role === 'supervisor' ? 'Supervisor ID' : 'Worker ID';
  if (subtitle) subtitle.textContent = role === 'supervisor' ? 'Enter your secure supervisor credentials' : 'Enter your ASHA worker credentials';
  if (input) input.placeholder = role === 'supervisor' ? 'e.g. SUP-1001' : 'e.g. ASHA-1001';
  if (workerDemo) workerDemo.classList.toggle('hidden', role !== 'worker');
  if (supervisorDemo) supervisorDemo.classList.toggle('hidden', role !== 'supervisor');
}

async function doLogin(e) {
  e.preventDefault();
  var id = document.getElementById('wid').value.trim().toUpperCase();
  var pw = document.getElementById('pw').value;
  var er = document.getElementById('le');
  try {
    if (useBackend) {
      var data = await api('/api/login', { method: 'POST', body: JSON.stringify({ workerId: id, password: pw, role: loginRole }) });
      token = data.token; cu = data.worker; cu.role = data.role || loginRole;
    } else {
      var w = loginRole === 'supervisor' ? SUPERVISORS_OFFLINE[id] : getOfflineWorkers()[id];
      if (!w || w.pw !== pw) throw new Error('Invalid ' + (loginRole === 'supervisor' ? 'supervisor' : 'worker') + ' ID or password.');
      token = id; cu = { id: id, name: w.name, area: w.area, role: loginRole };
    }
    er.classList.add('hidden');
    if (document.getElementById('rm').checked) {
      localStorage.setItem('sehat_token', token);
      localStorage.setItem('sehat_user', JSON.stringify(cu));
      localStorage.setItem('sehat_role', loginRole);
    }
    if (cu.role === 'supervisor') {
      await showSupervisorDash();
    } else {
      await showDash();
    }
    toast('Welcome, ' + cu.name + '!', 'ts');
  } catch (err) {
    er.textContent = err.message; er.classList.remove('hidden');
    document.getElementById('pw').value = '';
  }
}

function logout() {
  cu = null; token = null;
  localStorage.removeItem('sehat_token'); localStorage.removeItem('sehat_user'); localStorage.removeItem('sehat_role');
  document.getElementById('page-d').classList.remove('active');
  document.getElementById('page-s').classList.remove('active');
  document.getElementById('page-login').classList.add('active');
  document.getElementById('login-form').reset();
  setLoginRole('worker');
  if (mainMap) { mainMap.remove(); mainMap = null; }
  if (addMap) { addMap.remove(); addMap = null; }
  mapMarkers = []; homeMarker = null;
}

function togglePw() {
  var i = document.getElementById('pw'), e = document.getElementById('ei');
  if (i.type === 'password') { i.type = 'text'; e.textContent = '\uD83D\uDE48'; }
  else { i.type = 'password'; e.textContent = '\uD83D\uDC41'; }
}

/* ===== Dashboard ===== */
async function showDash() {
  if (cu && cu.role === 'supervisor') return showSupervisorDash();
  document.getElementById('page-login').classList.remove('active');
  document.getElementById('page-s').classList.remove('active');
  document.getElementById('page-d').classList.add('active');
  document.getElementById('wn').textContent = cu.name;
  document.getElementById('wn2').textContent = cu.name.split(' ').pop();
  document.getElementById('wa').textContent = cu.name.charAt(0);
  var areaBadge = document.getElementById('worker-area-badge');
  if (areaBadge) areaBadge.textContent = cu.area || 'Unassigned';
  await loadAllData();
  updateStats(); renderRecent(); renderDiseaseOverview(); populateHomeSelects();
}


/* ===== Supervisor Dashboard ===== */
async function loadSupervisorData() {
  if (useBackend) {
    supervisorHomes = await api('/api/supervisor/homes');
    supervisorSurveys = await api('/api/supervisor/surveys');
    supervisorWorkers = await api('/api/supervisor/workers');
    supervisorActivity = await api('/api/supervisor/activity');
  } else {
    supervisorHomes = homes.length ? homes : seedHomes();
    supervisorSurveys = surveys.length ? surveys : seedSurveys();
    supervisorWorkers = Object.keys(getOfflineWorkers()).map(function(id) {
      var w = getOfflineWorkers()[id];
      return { id:id, name:w.name, area:w.area,
        homes_count:supervisorHomes.filter(function(h){return h.worker_id===id;}).length,
        surveys_count:supervisorSurveys.filter(function(s){return s.worker_id===id;}).length };
    });
    supervisorActivity = [];
  }
}

async function showSupervisorDash() {
  document.getElementById('page-login').classList.remove('active');
  document.getElementById('page-d').classList.remove('active');
  document.getElementById('page-s').classList.add('active');
  document.getElementById('s-wn').textContent = cu.name;
  document.getElementById('s-wa').textContent = cu.name.charAt(0);
  await loadSupervisorData();
  renderSupervisorOverview();
  ssw('overview', document.querySelector('[data-sv=overview]'));
}

function ssw(v, n) {
  document.querySelectorAll('#page-s .ni').forEach(function(x){x.classList.remove('active');});
  if (n) n.classList.add('active');
  document.querySelectorAll('#page-s .v').forEach(function(x){x.classList.remove('active');});
  var el = document.getElementById('sv-' + v);
  if (el) el.classList.add('active');
  if (v === 'overview') renderSupervisorOverview();
  if (v === 'homes') renderSupervisorHomes();
  if (v === 'surveys') renderSupervisorSurveys();
  if (v === 'workers') renderSupervisorWorkers();
  if (v === 'activity') renderSupervisorActivity();
  var side = document.getElementById('supervisor-sidebar');
  if (side) side.classList.remove('open');
}

function renderSupervisorOverview() {
  var workerEl=document.getElementById('sup-workers');
  if (!workerEl) return;
  workerEl.textContent=supervisorWorkers.length;
  document.getElementById('sup-homes').textContent=supervisorHomes.length;
  document.getElementById('sup-surveys').textContent=supervisorSurveys.length;
  document.getElementById('sup-cases').textContent=supervisorSurveys.filter(function(s){return s.disease!=='polio';}).length;

  var recent=document.getElementById('sup-recent-surveys');
  var r=supervisorSurveys.slice().sort(function(a,b){return new Date(b.survey_date||b.created_at)-new Date(a.survey_date||a.created_at);}).slice(0,5);
  recent.innerHTML=r.length?r.map(function(s){
    return '<div class="si"><div class="si2"><span class="sin">'+esc(s.person_name)+' - '+diseaseName(s.disease)+'</span><span class="sim">'+esc(s.worker_name||s.worker_id)+' · '+fmtDate(s.survey_date)+'</span></div><span class="sbadge scom">'+esc(s.status||'completed')+'</span></div>';
  }).join(''):'<p class="es">No survey records.</p>';

  var summary=document.getElementById('sup-worker-summary');
  summary.innerHTML=supervisorWorkers.map(function(w){
    return '<div class="si"><div class="si2"><span class="sin">'+esc(w.name)+'</span><span class="sim">'+esc(w.area||'')+'</span></div><span><strong>'+w.homes_count+'</strong> homes · <strong>'+w.surveys_count+'</strong> surveys</span></div>';
  }).join('');
}

function renderSupervisorHomes() {
  var body=document.getElementById('sup-homes-body');
  if(!body)return;
  var qv=((document.getElementById('sup-home-search')||{}).value||'').toLowerCase();
  var rows=supervisorHomes.filter(function(h){
    return !qv || [h.head_name,h.area,h.city,h.worker_name,h.house_number].join(' ').toLowerCase().indexOf(qv)>=0;
  });
  body.innerHTML=rows.map(function(h){
    return '<tr><td><strong>'+esc(h.house_number)+'</strong><br><small>'+esc(h.id)+'</small></td><td>'+esc(h.head_name)+'</td><td>'+esc(h.area)+'</td><td>'+esc(h.city)+'</td><td>'+esc(h.worker_name||h.worker_id)+'</td><td>'+h.family_members+'</td></tr>';
  }).join('') || '<tr><td colspan="6" class="es">No homes found.</td></tr>';
}

function renderSupervisorSurveys() {
  var body=document.getElementById('sup-surveys-body');
  if(!body)return;
  var qv=((document.getElementById('sup-survey-search')||{}).value||'').toLowerCase();
  var rows=supervisorSurveys.filter(function(s){
    return !qv || [s.person_name,s.disease,s.worker_name,s.worker_id,s.severity].join(' ').toLowerCase().indexOf(qv)>=0;
  });
  body.innerHTML=rows.map(function(s){
    return '<tr><td>'+fmtDate(s.survey_date)+'</td><td><strong>'+esc(s.person_name)+'</strong></td><td>'+diseaseName(s.disease)+'</td><td><span class="sbadge '+(s.severity==='moderate'?'spen':s.severity==='severe'?'sus':'scom')+'">'+esc(s.severity||'mild')+'</span></td><td>'+esc(s.worker_name||s.worker_id)+'</td><td>'+esc(s.status||'completed')+'</td></tr>';
  }).join('') || '<tr><td colspan="6" class="es">No surveys found.</td></tr>';
}

function openAddWorkerModal() {
  var modal = document.getElementById('add-worker-modal');
  if (!modal) return;
  document.getElementById('add-worker-form').reset();
  modal.classList.remove('hidden');
  setTimeout(function(){ document.getElementById('add-worker-id').focus(); }, 50);
}

function closeAddWorkerModal(event) {
  if (event && event.target && event.target.id !== 'add-worker-modal') return;
  var modal = document.getElementById('add-worker-modal');
  if (modal) modal.classList.add('hidden');
}

async function submitAddWorker(event) {
  event.preventDefault();
  var id = document.getElementById('add-worker-id').value.trim().toUpperCase();
  var name = document.getElementById('add-worker-name').value.trim();
  var area = document.getElementById('add-worker-area').value.trim();
  var password = document.getElementById('add-worker-password').value;

  if (!/^ASHA-[A-Z0-9-]+$/.test(id)) { toast('Worker ID must start with ASHA- (example: ASHA-1004).', 'te'); return; }
  if (password.length < 4) { toast('Password must be at least 4 characters.', 'te'); return; }

  try {
    if (useBackend) {
      var data = await api('/api/supervisor/workers', { method:'POST', body:JSON.stringify({id:id,name:name,area:area,password:password}) });
      supervisorWorkers.push(data.worker);
    } else {
      var extra = lsLoad('sehat_extra_workers', {});
      if (getOfflineWorkers()[id]) { toast('An ASHA worker with this ID already exists.', 'te'); return; }
      extra[id] = { pw:password, name:name, area:area };
      lsSave('sehat_extra_workers', extra);
      supervisorWorkers.push({id:id,name:name,area:area,homes_count:0,surveys_count:0});
    }
    renderSupervisorWorkers();
    renderSupervisorOverview();
    closeAddWorkerModal();
    toast('ASHA worker ' + id + ' added successfully.', 'ts');
  } catch (e) {
    toast(e.message || 'Could not add ASHA worker.', 'te');
  }
}

function renderSupervisorWorkers() {
  var grid=document.getElementById('sup-workers-grid');
  if(!grid)return;
  grid.innerHTML=supervisorWorkers.map(function(w){
    return '<div class="cd sup-worker-card"><div class="sup-worker-head"><div class="wa">'+esc((w.name||'A').charAt(0))+'</div><div><h3>'+esc(w.name)+'</h3><p>'+esc(w.id)+' · '+esc(w.area||'')+'</p></div></div><div class="sup-metrics"><div><strong>'+w.homes_count+'</strong><span>Homes</span></div><div><strong>'+w.surveys_count+'</strong><span>Surveys</span></div></div></div>';
  }).join('');
}

function renderSupervisorActivity() {
  var body=document.getElementById('sup-activity-body');
  if(!body)return;
  body.innerHTML=supervisorActivity.map(function(a){
    return '<tr><td>'+esc(a.user_name)+'</td><td><span class="sup-role">'+esc(a.user_role)+'</span></td><td>'+esc(a.user_id)+'</td><td>'+esc(a.login_at||'')+'</td><td><span class="sbadge scom">Success</span></td></tr>';
  }).join('') || '<tr><td colspan="5" class="es">No login activity yet. Worker and supervisor logins will appear here.</td></tr>';
}

function getWid() { return cu ? (cu.id || cu.worker_id) : ''; }

function updateStats() {
  var wid = getWid();
  var myHomes = homes.filter(function(h) { return h.worker_id === wid; });
  var mySurveys = surveys.filter(function(s) { return s.worker_id === wid; });
  document.getElementById('st-h').textContent = myHomes.length;
  document.getElementById('st-s').textContent = mySurveys.length;
  document.getElementById('st-d').textContent = mySurveys.filter(function(s) { return s.disease !== 'polio'; }).length;
  document.getElementById('st-p').textContent = mySurveys.length;
  var ph = 0; mySurveys.forEach(function(s) { if (s.photos) ph += s.photos.length; });
  document.getElementById('st-ph').textContent = ph;
  document.getElementById('st-po').textContent = mySurveys.filter(function(s) { return s.disease === 'polio' && s.opv === 'yes'; }).length;
}

function renderRecent() {
  var c = document.getElementById('rsv');
  var wid = getWid();
  var mySurveys = surveys.filter(function(s) { return s.worker_id === wid; });
  var r = mySurveys.slice().sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); }).slice(0, 5);
  if (!r.length) { c.innerHTML = '<p class="es">No visits yet. Start with your first home survey!</p>'; return; }
  c.innerHTML = r.map(function(s) {
    var h = homes.find(function(x) { return x.id === s.home_id; });
    return '<div class="si" onclick="viewSurvey(\'' + s.id + '\')"><div class="si2"><span class="sin">' +
      esc(s.person_name) + ' - ' + diseaseName(s.disease) +
      '</span><span class="sim">' + (h ? h.area + ', ' + h.city : 'Unknown') + ' - ' +
      fmtDate(s.survey_date) + '</span></div><span class="sbadge scom">' + s.status + '</span></div>';
  }).join('');
}

function renderDiseaseOverview() {
  var c = document.getElementById('dov');
  var wid = getWid();
  var mySurveys = surveys.filter(function(s) { return s.worker_id === wid; });
  var dc = {};
  mySurveys.forEach(function(s) { dc[s.disease] = (dc[s.disease] || 0) + 1; });
  var keys = Object.keys(dc);
  if (!keys.length) { c.innerHTML = '<p class="es">No disease data yet.</p>'; return; }
  c.innerHTML = keys.sort(function(a, b) { return dc[b] - dc[a]; }).map(function(d) {
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--gray-50);border-radius:var(--r)"><span class="dtag d-' + d + '">' +
    diseaseName(d) + '</span><strong>' + dc[d] + ' case' + (dc[d] > 1 ? 's' : '') + '</strong></div>';
  }).join('');
}

/* ===== View Switch ===== */
function sw(v, n) {
  document.querySelectorAll('.ni').forEach(function(x) { x.classList.remove('active'); });
  if (n) n.classList.add('active');
  document.querySelectorAll('.v').forEach(function(x) { x.classList.remove('active'); });
  var t = document.getElementById('v-' + v);
  if (t) t.classList.add('active');
  if (v === 'homes') renderHomes();
  if (v === 'surveys') renderSurveyTable();
  if (v === 'map') initMainMap();
  if (v === 'reports') renderReports();
  if (v === 'add-home') { initAddMap(); prefillHomeArea(); }
  if (v === 'new-survey') { populateHomeSelects(); renderAIPredictions(); }
  document.getElementById('sidebar').classList.remove('open');
}

function q(s) { return document.querySelector(s); }

/* ===== Homes ===== */
function renderHomes() {
  var g = document.getElementById('homes-grid'), es = document.getElementById('homes-empty');
  var search = (document.getElementById('home-search') || {}).value || '';
  search = search.toLowerCase();
  var areaF = (document.getElementById('home-filter') || {}).value || 'all';
  var wid = getWid();
  var f = homes.filter(function(h) { return h.worker_id === wid; });
  if (search) f = f.filter(function(h) { return h.head_name.toLowerCase().indexOf(search) >= 0 || h.area.toLowerCase().indexOf(search) >= 0 || h.house_number.toLowerCase().indexOf(search) >= 0; });
  if (areaF !== 'all') f = f.filter(function(h) { return h.area === areaF; });
  if (!f.length) { g.innerHTML = ''; es.classList.remove('hidden'); return; }
  es.classList.add('hidden');
  var areas = [];
  homes.filter(function(h) { return h.worker_id === wid; }).forEach(function(h) { if (areas.indexOf(h.area) < 0) areas.push(h.area); });
  var sel = document.getElementById('home-filter');
  var cur = sel.value;
  sel.innerHTML = '<option value="all">All Areas</option>' + areas.map(function(a) {
    return '<option value="' + a + '"' + (a === cur ? ' selected' : '') + '>' + a + '</option>';
  }).join('');
  g.innerHTML = f.map(function(h) {
    var sc = surveys.filter(function(s) { return s.home_id === h.id; });
    var diseases = [];
    sc.forEach(function(s) { if (diseases.indexOf(s.disease) < 0) diseases.push(s.disease); });
    return '<div class="home-card" onclick="viewHome(\'' + h.id + '\')"><h4>' +
      esc(h.house_number) + ' - ' + esc(h.head_name) +
      '</h4><p>Location: ' + esc(h.area) + ', ' + esc(h.city) +
      '</p><p>Members: ' + h.family_members + ' | Surveys: ' + sc.length + '</p>' +
      (diseases.length ? '<div class="disease-tags">' + diseases.map(function(d) {
        return '<span class="dtag d-' + d + '" style="font-size:10px;padding:2px 8px">' + diseaseName(d) + '</span>';
      }).join('') + '</div>' : '') +
      '<div style="margin-top:10px;display:flex;gap:6px"><button class="btn-sm" onclick="event.stopPropagation();editHome(\'' + h.id + '\')">Edit</button><button class="btn-sm" style="color:var(--danger)" onclick="event.stopPropagation();deleteHome(\'' + h.id + '\')">Delete</button></div></div>';
  }).join('');
}
function filterHomes() { renderHomes(); }

async function viewHome(id) {
  var h = homes.find(function(x) { return x.id === id; });
  if (!h) return;
  curDel = { type: 'home', id: id };
  var memberList = [];
  try { memberList = JSON.parse(h.member_list || '[]'); } catch (e) {}
  var sc = surveys.filter(function(s) { return s.home_id === id; });
  var diseases = [];
  sc.forEach(function(s) { if (diseases.indexOf(s.disease) < 0) diseases.push(s.disease); });
  document.getElementById('mo-title').textContent = 'Home Details - ' + h.house_number;
  var html = '<div class="dg2">';
  html += '<div class="di"><span class="dil">Home ID</span><span class="div">' + esc(h.id) + '</span></div>';
  html += '<div class="di"><span class="dil">Head of Family</span><span class="div">' + esc(h.head_name) + '</span></div>';
  html += '<div class="di"><span class="dil">House Number</span><span class="div">' + esc(h.house_number) + '</span></div>';
  html += '<div class="di"><span class="dil">Area</span><span class="div">' + esc(h.area) + '</span></div>';
  html += '<div class="di"><span class="dil">City</span><span class="div">' + esc(h.city) + '</span></div>';
  html += '<div class="di"><span class="dil">Phone</span><span class="div">' + esc(h.phone || 'N/A') + '</span></div>';
  html += '<div class="di"><span class="dil">Family Members</span><span class="div">' + h.family_members + '</span></div>';
  html += '<div class="di"><span class="dil">Surveys Done</span><span class="div">' + sc.length + '</span></div>';
  html += '</div>';
  if (memberList.length) {
    html += '<div class="dst">Family Members</div><div class="dg2">';
    memberList.forEach(function(m) {
      html += '<div class="di"><span class="dil">' + esc(m.name) + '</span><span class="div">' + m.age + ' / ' + cap(m.gender) + '</span></div>';
    });
    html += '</div>';
  }
  if (diseases.length) {
    html += '<div class="dst">Diseases Detected</div><div style="display:flex;flex-wrap:wrap;gap:6px">';
    diseases.forEach(function(d) { html += '<span class="dtag d-' + d + '">' + diseaseName(d) + '</span>'; });
    html += '</div>';
  }
  if (h.lat && h.lng) {
    html += '<div class="dst">Location</div><div id="modal-map" style="width:100%;height:200px;border-radius:8px;overflow:hidden;border:1px solid var(--gray-200)"></div>';
  }
  document.getElementById('mo-body').innerHTML = html;
  document.getElementById('mo-edit').classList.remove('hidden');
  document.getElementById('mo-del').classList.remove('hidden');
  document.getElementById('mo').classList.remove('hidden');
  if (h.lat && h.lng) {
    setTimeout(function() {
      try {
        var m2 = L.map('modal-map', { zoomControl: true }).setView([h.lat, h.lng], 18);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: 'OSM', maxZoom: 19 }).addTo(m2);
        L.marker([h.lat, h.lng], { icon: makeLIcon('#1a7a4c', '\uD83D\uDCCD') }).addTo(m2).bindPopup(esc(h.house_number) + ' - ' + esc(h.head_name)).openPopup();
      } catch (e) {}
    }, 150);
  }
}

/* ===== Edit Home ===== */
function editHome(id) {
  var h = homes.find(function(x) { return x.id === id; });
  if (!h) return;
  curEdit = h;
  document.getElementById('edit-home-id').value = h.id;
  document.getElementById('edit-h-name').value = h.head_name;
  document.getElementById('edit-h-number').value = h.house_number;
  document.getElementById('edit-h-area').value = h.area;
  document.getElementById('edit-h-city').value = h.city;
  document.getElementById('edit-h-phone').value = h.phone || '';
  document.getElementById('edit-h-members').value = h.family_members;
  var memberList = [];
  try { memberList = JSON.parse(h.member_list || '[]'); } catch (e) {}
  var container = document.getElementById('edit-family-members');
  container.innerHTML = '';
  memberList.forEach(function(m) { addEditFamilyRow(m.name, m.age, m.gender); });
  document.getElementById('edit-h-lat').value = h.lat || '';
  document.getElementById('edit-h-lng').value = h.lng || '';
  document.getElementById('edit-home-modal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('edit-home-modal').classList.add('hidden');
  curEdit = null;
}

function addEditFamilyRow(name, age, gender) {
  var c = document.getElementById('edit-family-members');
  var d = document.createElement('div');
  d.className = 'fm-row fgr';
  d.style.marginBottom = '12px';
  d.innerHTML = '<div class="fg"><label>Name</label><input type="text" class="fm-name" placeholder="Member name" value="' + esc(name || '') + '"></div><div class="fg"><label>Age</label><input type="number" class="fm-age" min="0" max="120" placeholder="Age" value="' + (age || '') + '"></div><div class="fg"><label>Gender</label><select class="fm-gender"><option value="">Select</option><option value="male"' + (gender === 'male' ? ' selected' : '') + '>Male</option><option value="female"' + (gender === 'female' ? ' selected' : '') + '>Female</option></select></div><div class="fg" style="justify-content:flex-end"><button type="button" class="btn btn-sm" style="color:var(--danger)" onclick="this.closest(\'.fm-row\').remove()">Remove</button></div>';
  c.appendChild(d);
}

async function submitEditHome(e) {
  e.preventDefault();
  var id = document.getElementById('edit-home-id').value;
  var ml = [];
  document.querySelectorAll('#edit-family-members .fm-row').forEach(function(r) {
    var n = r.querySelector('.fm-name');
    var a = r.querySelector('.fm-age');
    var g = r.querySelector('.fm-gender');
    if (n && n.value) ml.push({ name: n.value, age: parseInt(a ? a.value : 0) || 0, gender: (g ? g.value : '') || 'unknown' });
  });
  var updatedData = {
    headName: document.getElementById('edit-h-name').value.trim(),
    houseNumber: document.getElementById('edit-h-number').value.trim(),
    area: document.getElementById('edit-h-area').value.trim(),
    city: document.getElementById('edit-h-city').value.trim(),
    phone: document.getElementById('edit-h-phone').value.trim(),
    familyMembers: parseInt(document.getElementById('edit-h-members').value) || 1,
    memberList: ml,
    lat: parseFloat(document.getElementById('edit-h-lat').value) || null,
    lng: parseFloat(document.getElementById('edit-h-lng').value) || null
  };
  try {
    if (useBackend) {
      await api('/api/homes/' + id, { method: 'PUT', body: JSON.stringify(updatedData) });
      await loadAllData();
    } else {
      var idx = homes.findIndex(function(h) { return h.id === id; });
      if (idx >= 0) {
        homes[idx].head_name = updatedData.headName;
        homes[idx].house_number = updatedData.houseNumber;
        homes[idx].area = updatedData.area;
        homes[idx].city = updatedData.city;
        homes[idx].phone = updatedData.phone;
        homes[idx].family_members = updatedData.familyMembers;
        homes[idx].member_list = JSON.stringify(ml);
        homes[idx].lat = updatedData.lat;
        homes[idx].lng = updatedData.lng;
        lsSave('sehat_homes', homes);
      }
    }
    closeEditModal();
    toast('Home updated successfully!', 'ts');
    renderHomes();
  } catch (err) { toast('Error: ' + err.message, 'te'); }
}

async function deleteHome(id) {
  if (!confirm('Delete this home and all its surveys?')) return;
  try {
    if (useBackend) {
      await api('/api/homes/' + id, { method: 'DELETE' });
      await loadAllData();
    } else {
      homes = homes.filter(function(h) { return h.id !== id; });
      surveys = surveys.filter(function(s) { return s.home_id !== id; });
      lsSave('sehat_homes', homes);
      lsSave('sehat_surveys', surveys);
    }
    toast('Home deleted.', 'ts');
    updateStats(); renderRecent(); renderDiseaseOverview();
  } catch (err) { toast('Error: ' + err.message, 'te'); }
}

async function submitHome(e) {
  e.preventDefault();
  var areaVal = document.getElementById('h-area').value.trim();
  var locs = getWorkerLocalities();
  if (locs.length > 0) {
    var validArea = false;
    for (var i = 0; i < locs.length; i++) {
      if (areaVal.toLowerCase().indexOf(locs[i].toLowerCase()) >= 0) { validArea = true; break; }
    }
    if (!validArea) { toast('Cannot add home outside your district. Allowed areas: ' + locs.join(', '), 'te'); return; }
  }
  var ml = [];
  document.querySelectorAll('#family-members .fm-row').forEach(function(r) {
    var n = r.querySelector('.fm-name');
    var a = r.querySelector('.fm-age');
    var g = r.querySelector('.fm-gender');
    if (n && n.value) ml.push({ name: n.value, age: parseInt(a ? a.value : 0) || 0, gender: (g ? g.value : '') || 'unknown' });
  });
  var latVal = parseFloat(document.getElementById('h-lat').value);
  var lngVal = parseFloat(document.getElementById('h-lng').value);
  if (isNaN(latVal) || isNaN(lngVal)) {
    toast('Please set a location by clicking on the map or using GPS', 'te');
    return;
  }
  var homeData = {
    head_name: document.getElementById('h-name').value.trim(),
    house_number: document.getElementById('h-number').value.trim(),
    area: areaVal, city: document.getElementById('h-city').value.trim(),
    phone: document.getElementById('h-phone').value.trim(),
    family_members: parseInt(document.getElementById('h-members').value) || 1,
    member_list: JSON.stringify(ml),
    lat: latVal,
    lng: lngVal,
    created_at: new Date().toISOString().split('T')[0],
    worker_id: getWid()
  };
  try {
    if (useBackend) {
      await api('/api/homes', { method: 'POST', body: JSON.stringify({ headName: homeData.head_name, houseNumber: homeData.house_number, area: homeData.area, city: homeData.city, phone: homeData.phone, familyMembers: homeData.family_members, memberList: ml, lat: homeData.lat, lng: homeData.lng }) });
      await loadAllData();
    } else {
      homeData.id = 'H-' + String(homes.length + 1).padStart(3, '0');
      homes.push(homeData);
      lsSave('sehat_homes', homes);
    }
    toast('Home registered!', 'ts');
    document.getElementById('home-form').reset();
    document.getElementById('family-members').innerHTML = '';
    populateHomeSelects(); prefillHomeArea();
    sw('homes', q('[data-v=homes]'));
  } catch (err) { toast('Error: ' + err.message, 'te'); }
}

function addFamilyRow() {
  var c = document.getElementById('family-members');
  var d = document.createElement('div');
  d.className = 'fm-row fgr'; d.style.marginBottom = '12px';
  d.innerHTML = '<div class="fg"><label>Name</label><input type="text" class="fm-name" placeholder="Member name"></div><div class="fg"><label>Age</label><input type="number" class="fm-age" min="0" max="120" placeholder="Age"></div><div class="fg"><label>Gender</label><select class="fm-gender"><option value="">Select</option><option value="male">Male</option><option value="female">Female</option></select></div><div class="fg" style="justify-content:flex-end"><button type="button" class="btn btn-sm" style="color:var(--danger)" onclick="this.closest(\'.fm-row\').remove()">Remove</button></div>';
  c.appendChild(d);
}

function populateHomeSelects() {
  var sel = document.getElementById('sv-home');
  if (!sel) return;
  var wid = getWid();
  var myHomes = homes.filter(function(h) { return h.worker_id === wid; });
  sel.innerHTML = '<option value="">Select a registered home</option>' + myHomes.map(function(h) {
    return '<option value="' + h.id + '">' + h.house_number + ' - ' + h.head_name + ' (' + h.area + ')</option>';
  }).join('');
}

/* ===== Survey ===== */
function updateDiseaseFields() {
  var d = document.getElementById('sv-disease').value;
  document.getElementById('dengue-fields').style.display = d === 'dengue' ? 'grid' : 'none';
  document.getElementById('polio-fields').style.display = d === 'polio' ? 'grid' : 'none';
}

async function submitSurvey(e) {
  e.preventDefault();
  var svData = {
    home_id: document.getElementById('sv-home').value,
    person_name: document.getElementById('sv-person').value.trim(),
    age: parseInt(document.getElementById('sv-age').value),
    gender: document.getElementById('sv-gender').value,
    disease: document.getElementById('sv-disease').value,
    survey_date: document.getElementById('sv-date').value,
    symptoms: document.getElementById('sv-symptoms').value.trim(),
    platelets: parseInt(document.getElementById('sv-platelets') ? document.getElementById('sv-platelets').value : '') || null,
    fever_days: parseInt(document.getElementById('sv-fever-days') ? document.getElementById('sv-fever-days').value : '') || null,
    bleeding: document.getElementById('sv-bleeding') ? document.getElementById('sv-bleeding').value : null,
    opv: document.getElementById('sv-opv') ? document.getElementById('sv-opv').value : null,
    dose_num: document.getElementById('sv-dose-num') ? document.getElementById('sv-dose-num').value : null,
    finger_mark: document.getElementById('sv-finger') ? document.getElementById('sv-finger').value : null,
    temperature: parseFloat(document.getElementById('sv-temp') ? document.getElementById('sv-temp').value : '') || null,
    weight: parseFloat(document.getElementById('sv-weight') ? document.getElementById('sv-weight').value : '') || null,
    severity: document.getElementById('sv-severity').value,
    findings: document.getElementById('sv-findings').value.trim(),
    treatment: document.getElementById('sv-treatment').value.trim(),
    followup: document.getElementById('sv-followup').value,
    notes: document.getElementById('sv-notes').value.trim(),
    status: 'completed', created_at: new Date().toISOString(), worker_id: getWid()
  };
  try {
    if (useBackend) {
      await api('/api/surveys', { method: 'POST', body: JSON.stringify(svData) });
      await loadAllData();
    } else {
      svData.id = 'SVY-' + String(surveys.length + 1).padStart(3, '0');
      svData.photos = [];
      surveys.push(svData);
      lsSave('sehat_surveys', surveys);
    }
    toast('Survey submitted!', 'ts');
    resetSurveyForm(); updateStats(); renderRecent(); renderDiseaseOverview();
    sw('surveys', q('[data-v=surveys]'));
  } catch (err) { toast('Error: ' + err.message, 'te'); }
}

function resetSurveyForm() {
  document.getElementById('survey-form').reset();
  document.getElementById('sv-date').valueAsDate = new Date();
  document.getElementById('dengue-fields').style.display = 'none';
  document.getElementById('polio-fields').style.display = 'none';
  document.getElementById('photo-section').innerHTML = '<div class="photo-card" onclick="document.getElementById(\'photo-input\').click()"><div class="photo-add"><span>Camera</span><span>Add Photo</span></div></div>';
  var aiContainer = document.getElementById('ai-predictions');
  if (aiContainer) aiContainer.innerHTML = '<p style="color:var(--gray-400);font-size:13px;text-align:center;padding:16px">Type symptoms above to get AI disease predictions...</p>';
}

function renderSurveyTable() {
  var tb = document.getElementById('stb'), es = document.getElementById('sv-empty');
  var df = document.getElementById('sf-disease').value, sf = document.getElementById('sf-status').value;
  var wid = getWid();
  var f = surveys.filter(function(s) { return s.worker_id === wid; });
  if (df !== 'all') f = f.filter(function(s) { return s.disease === df; });
  if (sf !== 'all') f = f.filter(function(s) { return s.status === sf; });
  f.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
  if (!f.length) { tb.innerHTML = ''; es.classList.remove('hidden'); return; }
  es.classList.add('hidden');
  tb.innerHTML = f.map(function(s) {
    var h = homes.find(function(x) { return x.id === s.home_id; });
    var pc = s.photos ? s.photos.length : 0;
    return '<tr><td><strong>' + esc(s.id) + '</strong></td><td>' + esc(s.person_name) +
      '<br><small style="color:var(--gray-500)">' + (h ? h.house_number + ' - ' + h.area : '-') + '</small></td><td><span class="dtag d-' +
      s.disease + '">' + diseaseName(s.disease) + '</span></td><td>' + fmtDate(s.survey_date) +
      '</td><td><span class="sbadge scom">' + s.status + '</span></td><td>' +
      (pc ? pc + ' photos' : '-') + '</td><td><button class="btn-sm" onclick="viewSurvey(\'' +
      s.id + '\')">View</button></td></tr>';
  }).join('');
}
function filterSurveys() { renderSurveyTable(); }

function viewSurvey(id) {
  var s = surveys.find(function(x) { return x.id === id; });
  if (!s) return;
  curDel = { type: 'survey', id: id };
  var h = homes.find(function(x) { return x.id === s.home_id; });
  document.getElementById('mo-title').textContent = 'Survey Details - ' + s.id;
  var html = '<div class="dg2">';
  html += '<div class="di"><span class="dil">Home</span><span class="div">' + (h ? esc(h.house_number) + ' - ' + esc(h.area) : 'N/A') + '</span></div>';
  html += '<div class="di"><span class="dil">Person</span><span class="div">' + esc(s.person_name) + '</span></div>';
  html += '<div class="di"><span class="dil">Age / Gender</span><span class="div">' + s.age + ' / ' + cap(s.gender) + '</span></div>';
  html += '<div class="di"><span class="dil">Disease</span><span class="div"><span class="dtag d-' + s.disease + '">' + diseaseName(s.disease) + '</span></span></div>';
  html += '<div class="di"><span class="dil">Date</span><span class="div">' + fmtDate(s.survey_date) + '</span></div>';
  html += '<div class="di"><span class="dil">Severity</span><span class="div">' + cap(s.severity) + '</span></div>';
  html += '</div>';
  html += '<div class="dst">Symptoms</div><p style="font-size:14px;color:var(--gray-700)">' + esc(s.symptoms) + '</p>';
  if (s.disease === 'dengue' && s.platelets) html += '<div class="dst">Dengue Details</div><div class="dg2"><div class="di"><span class="dil">Platelets</span><span class="div">' + s.platelets + '/uL</span></div><div class="di"><span class="dil">Fever Days</span><span class="div">' + (s.fever_days || '-') + '</span></div></div>';
  if (s.disease === 'polio') html += '<div class="dst">Polio Details</div><div class="dg2"><div class="di"><span class="dil">OPV Given</span><span class="div">' + cap(s.opv || 'N/A') + '</span></div><div class="di"><span class="dil">Dose #</span><span class="div">' + (s.dose_num || '-') + '</span></div></div>';
  if (s.temperature) html += '<div class="dst">Vitals</div><div class="dg2"><div class="di"><span class="dil">Temperature</span><span class="div">' + s.temperature + ' F</span></div></div>';
  html += '<div class="dst">Findings</div><p style="font-size:14px;color:var(--gray-700)">' + esc(s.findings) + '</p>';
  if (s.treatment) html += '<div class="dst">Treatment</div><p style="font-size:14px;color:var(--gray-700)">' + esc(s.treatment) + '</p>';
  if (s.followup !== 'no') html += '<div class="dst" style="color:var(--danger)">Follow-up: ' + cap(s.followup) + '</div>';
  document.getElementById('mo-body').innerHTML = html;
  document.getElementById('mo-edit').classList.add('hidden');
  document.getElementById('mo-del').classList.remove('hidden');
  document.getElementById('mo').classList.remove('hidden');
}

/* ===== Photo Handling ===== */
function handlePhotos(e) {
  var files = e.target.files;
  if (!files.length) return;
  for (var fi = 0; fi < files.length; fi++) {
    (function(file) {
      getPhotoLocation().then(function(gps) {
        var reader = new FileReader();
        reader.onload = function(ev) {
          var c = document.getElementById('photo-section');
          var placeholder = c.querySelector('.photo-card');
          if (placeholder && placeholder.querySelector('.photo-add')) placeholder.remove();
          var card = document.createElement('div');
          card.className = 'photo-card';
          var gpsHtml = '';
          if (gps) {
            gpsHtml = '<div class="photo-gps">' + gps.lat.toFixed(5) + ', ' + gps.lng.toFixed(5) + ' +/-' + Math.round(gps.accuracy) + 'm</div>';
          }
          card.innerHTML = '<img src="' + ev.target.result + '"><button class="photo-del" onclick="event.stopPropagation();removePhoto(this)">X</button>' + gpsHtml;
          c.appendChild(card);
          var addCard = document.createElement('div');
          addCard.className = 'photo-card';
          addCard.setAttribute('onclick', "document.getElementById('photo-input').click()");
          addCard.innerHTML = '<div class="photo-add"><span>Camera</span><span>Add Photo</span></div>';
          c.appendChild(addCard);
        };
        reader.readAsDataURL(file);
      });
    })(files[fi]);
  }
  e.target.value = '';
}

function removePhoto(btn) {
  var card = btn.parentElement;
  var section = card.parentElement;
  card.remove();
  if (!section.querySelector('.photo-card img')) {
    section.innerHTML = '<div class="photo-card" onclick="document.getElementById(\'photo-input\').click()"><div class="photo-add"><span>Camera</span><span>Add Photo</span></div></div>';
  }
}

function getPhotoLocation() {
  return new Promise(function(resolve) {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      function(pos) { resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, takenAt: new Date().toISOString() }); },
      function() { resolve(null); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  });
}

/* ===== Map ===== */
function makeLIcon(color, label) {
  return L.divIcon({
    className: '', iconSize: [40, 52], iconAnchor: [20, 52], popupAnchor: [0, -52],
    html: '<div style="position:relative;width:40px;height:52px"><svg width="40" height="52" viewBox="0 0 40 52"><path d="M20 0C9 0 0 9 0 20c0 15 20 32 20 32s20-17 20-32C40 9 31 0 20 0z" fill="' + color + '" stroke="#fff" stroke-width="2"/><text x="20" y="22" text-anchor="middle" dominant-baseline="middle" font-size="14" font-weight="bold" fill="#fff" font-family="Inter,sans-serif">' + label + '</text></svg></div>'
  });
}

function useMyLocation() {
  if (!navigator.geolocation) { toast('Geolocation not supported by your browser', 'te'); return; }
  toast('Detecting your GPS location...', 'ts');
  navigator.geolocation.getCurrentPosition(
    function(pos) {
      var lat = pos.coords.latitude;
      var lng = pos.coords.longitude;
      document.getElementById('h-lat').value = lat.toFixed(6);
      document.getElementById('h-lng').value = lng.toFixed(6);
      if (addMap) {
        if (homeMarker) addMap.removeLayer(homeMarker);
        addMap.setView([lat, lng], 18);
        homeMarker = L.marker([lat, lng], { icon: makeLIcon('#1a7a4c', 'M'), draggable: true }).addTo(addMap).bindPopup('Your location').openPopup();
        homeMarker.on('dragend', function(ev) {
          document.getElementById('h-lat').value = ev.target.getLatLng().lat.toFixed(6);
          document.getElementById('h-lng').value = ev.target.getLatLng().lng.toFixed(6);
        });
      }
      toast('GPS location set: ' + lat.toFixed(4) + ', ' + lng.toFixed(4), 'ts');
      showLocStatus(lat, lng);
    },
    function(err) {
      toast('Could not get GPS location: ' + err.message, 'te');
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
  );
}

function showLocStatus(lat, lng) {
  var s = document.getElementById('loc-status');
  if (!s) return;
  s.style.display = 'block';
  s.style.background = '#dcfce7';
  s.style.color = '#16a34a';
  s.innerHTML = '&#x1F4CD; Location set: ' + lat.toFixed(5) + ', ' + lng.toFixed(5);
}

function initAddMap() {
  if (addMap) { addMap.invalidateSize(); return; }
  setTimeout(function() {
    var el = document.getElementById('add-home-map');
    if (!el) return;
    el.style.width = '100%';
    el.style.height = '350px';
    addMap = L.map('add-home-map', { zoomControl: true }).setView([12.9716, 77.5946], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: 'OSM', maxZoom: 19 }).addTo(addMap);
    addMap.on('click', function(e) {
      if (homeMarker) addMap.removeLayer(homeMarker);
      homeMarker = L.marker(e.latlng, { icon: makeLIcon('#1a7a4c', 'M'), draggable: true }).addTo(addMap).bindPopup('Drag to adjust').openPopup();
      document.getElementById('h-lat').value = e.latlng.lat.toFixed(6);
      document.getElementById('h-lng').value = e.latlng.lng.toFixed(6);
      showLocStatus(e.latlng.lat, e.latlng.lng);
      homeMarker.on('dragend', function(ev) {
        document.getElementById('h-lat').value = ev.target.getLatLng().lat.toFixed(6);
        document.getElementById('h-lng').value = ev.target.getLatLng().lng.toFixed(6);
        showLocStatus(ev.target.getLatLng().lat, ev.target.getLatLng().lng);
      });
    });
    homes.forEach(function(h) {
      if (h.lat && h.lng) L.marker([h.lat, h.lng], { icon: makeLIcon('#6b7280', h.house_number.replace('H-', '')) }).addTo(addMap).bindPopup(esc(h.house_number) + ' - ' + esc(h.head_name));
    });
    setTimeout(function() { addMap.invalidateSize(); }, 100);
    setTimeout(function() { addMap.invalidateSize(); }, 500);
  }, 300);
}

function initMainMap() {
  if (mainMap) { mainMap.invalidateSize(); updateMapMarkers(); return; }
  setTimeout(function() {
    mainMap = L.map('main-map', { zoomControl: true }).setView([12.9716, 77.5946], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: 'OSM', maxZoom: 19 }).addTo(mainMap);
    updateMapMarkers();
    setTimeout(function() { mainMap.invalidateSize(); }, 500);
  }, 200);
}

function updateMapMarkers() {
  if (!mainMap) return;
  mapMarkers.forEach(function(m) { mainMap.removeLayer(m); });
  mapMarkers = [];
  var df = document.getElementById('map-disease').value;
  homes.forEach(function(h) {
    if (!h.lat || !h.lng) return;
    var sc = surveys.filter(function(s) { return s.home_id === h.id; });
    if (df !== 'all' && !sc.some(function(s) { return s.disease === df; })) return;
    var color = '#1a7a4c', label = 'V';
    if (sc.some(function(s) { return s.severity === 'critical' || s.severity === 'severe'; })) { color = '#dc2626'; label = '!'; }
    else if (sc.length > 0) { color = '#f59e0b'; label = sc.length + ''; }
    if (sc.some(function(s) { return s.disease === 'polio' && s.opv === 'yes'; })) { color = '#7c3aed'; label = 'P'; }
    var m = L.marker([h.lat, h.lng], { icon: makeLIcon(color, label) }).addTo(mainMap);
    var popHtml = '<div style="min-width:200px"><b style="font-size:15px">' + esc(h.house_number) + ' - ' + esc(h.head_name) + '</b><br><span style="color:#6b7280;font-size:12px">' + esc(h.area) + ', ' + esc(h.city) + '<br>' + h.family_members + ' members</span><br><span style="color:#1a7a4c;font-weight:600;font-size:13px">' + sc.length + ' survey' + (sc.length !== 1 ? 's' : '') + '</span></div>';
    m.bindPopup(popHtml);
    m.on('click', function() { showMapHomeInfo(h, sc); });
    mapMarkers.push(m);
  });
}
function filterMapMarkers() { updateMapMarkers(); }

function showMapHomeInfo(h, sc) {
  var c = document.getElementById('map-home-info');
  var diseases = [];
  sc.forEach(function(s) { if (diseases.indexOf(s.disease) < 0) diseases.push(s.disease); });
  var html = '<h4 style="margin-bottom:4px">' + esc(h.house_number) + ' - ' + esc(h.head_name) + '</h4>';
  html += '<p style="color:var(--gray-500);font-size:13px">' + esc(h.area) + ', ' + esc(h.city) + ' | ' + h.family_members + ' members</p>';
  html += '<p style="font-size:13px;margin-top:8px">' + sc.length + ' survey' + (sc.length !== 1 ? 's' : '') + '</p>';
  if (h.lat && h.lng) html += '<p class="gps-badge exact" style="margin-top:8px">' + parseFloat(h.lat).toFixed(5) + ', ' + parseFloat(h.lng).toFixed(5) + '</p>';
  if (diseases.length) {
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">';
    diseases.forEach(function(d) { html += '<span class="dtag d-' + d + '" style="font-size:10px;padding:2px 8px">' + diseaseName(d) + '</span>'; });
    html += '</div>';
  }
  html += '<div style="margin-top:10px"><button class="btn-sm" onclick="viewHome(\'' + h.id + '\')">View Details</button> <button class="btn-sm" onclick="closeMo();editHome(\'' + h.id + '\')">Edit</button></div>';
  c.innerHTML = html;
}

/* ===== Reports ===== */
function renderReports() {
  var wid = getWid();
  var mySurveys = surveys.filter(function(s) { return s.worker_id === wid; });
  var dc = {};
  mySurveys.forEach(function(s) { dc[s.disease] = (dc[s.disease] || 0) + 1; });
  var mx = Math.max.apply(null, Object.values(dc).concat([1]));
  var cl = ['#d97706', '#2563eb', '#16a34a', '#7c3aed', '#0891b2', '#dc2626', '#6b7280'];
  var diseaseHtml = '';
  var dk = Object.keys(dc);
  for (var i = 0; i < dk.length; i++) {
    diseaseHtml += '<div class="bar-item"><span class="bar-v">' + dc[dk[i]] + '</span><div class="bar" style="height:' + (dc[dk[i]] / mx) * 150 + 'px;background:' + cl[i % cl.length] + '"></div><span class="bar-l">' + diseaseName(dk[i]) + '</span></div>';
  }
  document.getElementById('chart-disease').innerHTML = diseaseHtml || '<p class="es">No data</p>';

  var ac = {};
  homes.filter(function(h) { return h.worker_id === wid; }).forEach(function(h) { ac[h.area] = (ac[h.area] || 0) + 1; });
  var amx = Math.max.apply(null, Object.values(ac).concat([1]));
  var areaHtml = '<div style="display:flex;flex-direction:column;gap:10px">';
  var ak = Object.keys(ac).sort(function(a, b) { return ac[b] - ac[a]; });
  for (var j = 0; j < ak.length; j++) {
    areaHtml += '<div style="display:flex;align-items:center;gap:12px"><span style="width:140px;font-size:13px;font-weight:500;color:var(--gray-600)">' + esc(ak[j]) + '</span><div style="flex:1;height:24px;background:var(--gray-100);border-radius:12px;overflow:hidden"><div style="height:100%;width:' + (ac[ak[j]] / amx) * 100 + '%;background:var(--primary);border-radius:12px;display:flex;align-items:center;justify-content:flex-end;padding-right:8px;font-size:11px;font-weight:700;color:#fff;min-width:30px">' + ac[ak[j]] + '</div></div></div>';
  }
  document.getElementById('chart-area').innerHTML = areaHtml + '</div>';

  var pt = mySurveys.filter(function(s) { return s.disease === 'polio'; }).length;
  var pg = mySurveys.filter(function(s) { return s.disease === 'polio' && s.opv === 'yes'; }).length;
  document.getElementById('chart-polio').innerHTML = pt ?
    '<div style="text-align:center;padding:20px"><div style="font-size:48px;font-weight:800;color:var(--primary)">' + (pt ? Math.round(pg / pt * 100) : 0) + '%</div><p style="color:var(--gray-500);margin-top:8px">' + pg + ' of ' + pt + ' vaccinated</p></div>' :
    '<p class="es">No polio data yet</p>';

  var tc = {};
  mySurveys.forEach(function(s) { var m = s.survey_date.substring(0, 7); tc[m] = (tc[m] || 0) + 1; });
  var tHtml = '';
  var tk = Object.keys(tc).sort();
  for (var k = 0; k < tk.length; k++) {
    tHtml += '<div class="bar-item"><span class="bar-v">' + tc[tk[k]] + '</span><div class="bar" style="height:' + Math.max(tc[tk[k]] * 20, 8) + 'px;background:var(--primary)"></div><span class="bar-l">' + tk[k] + '</span></div>';
  }
  document.getElementById('chart-time').innerHTML = tHtml || '<p class="es">No data</p>';
}

/* ===== Delete ===== */
async function deleteCurrent() {
  if (!curDel) return;
  if (!confirm('Delete this ' + curDel.type + '?')) return;
  try {
    if (useBackend) {
      if (curDel.type === 'home') await api('/api/homes/' + curDel.id, { method: 'DELETE' });
      else await api('/api/surveys/' + curDel.id, { method: 'DELETE' });
      await loadAllData();
    } else {
      if (curDel.type === 'home') { homes = homes.filter(function(h) { return h.id !== curDel.id; }); lsSave('sehat_homes', homes); }
      else { surveys = surveys.filter(function(s) { return s.id !== curDel.id; }); lsSave('sehat_surveys', surveys); }
    }
    closeMo(); updateStats(); renderRecent(); renderDiseaseOverview(); toast('Deleted.', 'ts');
  } catch (err) { toast('Error: ' + err.message, 'te'); }
}

/* ===== Search ===== */
function doSearch() {
  var query = document.getElementById('gs').value.trim().toLowerCase();
  if (!query) return;
  sw('surveys', q('[data-v=surveys]'));
  var tb = document.getElementById('stb');
  var wid = getWid();
  var mySurveys = surveys.filter(function(s) { return s.worker_id === wid; });
  var f = mySurveys.filter(function(s) {
    return s.person_name.toLowerCase().indexOf(query) >= 0 || s.id.toLowerCase().indexOf(query) >= 0 || (s.symptoms || '').toLowerCase().indexOf(query) >= 0;
  }).sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
  document.getElementById('sv-empty').classList.add('hidden');
  if (!f.length) { tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--gray-400)">No results found</td></tr>'; return; }
  tb.innerHTML = f.map(function(s) {
    var h = homes.find(function(x) { return x.id === s.home_id; });
    return '<tr><td><strong>' + esc(s.id) + '</strong></td><td>' + esc(s.person_name) +
      '<br><small style="color:var(--gray-500)">' + (h ? h.house_number : '-') + '</small></td><td><span class="dtag d-' +
      s.disease + '">' + diseaseName(s.disease) + '</span></td><td>' + fmtDate(s.survey_date) +
      '</td><td><span class="sbadge scom">' + s.status + '</span></td><td>' +
      '</td><td><button class="btn-sm" onclick="viewSurvey(\'' + s.id + '\')">View</button></td></tr>';
  }).join('');
}

/* ===== Modal ===== */
function closeMo(e) {
  if (e && e.target !== document.getElementById('mo')) return;
  document.getElementById('mo').classList.add('hidden');
  curDel = null;
}

/* ===== Helpers ===== */
function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function fmtDate(d) { if (!d) return 'N/A'; return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }); }
function diseaseName(d) {
  var m = { dengue: 'Dengue', malaria: 'Malaria', polio: 'Polio', tb: 'TB', cholera: 'Cholera', measles: 'Measles', other: 'Other' };
  return m[d] || d;
}
function toast(m, c) {
  c = c || '';
  var t = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = m;
  t.className = 'toast ' + c;
  setTimeout(function() { t.className = 'toast hidden'; }, 3000);
}
