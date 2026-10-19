#!/usr/bin/env python3
"""Writes test/illness-test-graph.edn, the seed of the Illness Test Graph.

A fictional person, Daniel Okoro, through a colon cancer diagnosis, surgery and chemotherapy,
from 2026-06-22 to 2026-10-19 with appointments booked into December. Modelled by the rules in
docs/MODELLING.md: a tag says what a thing is, a field holds a fact to list or sort, a link in
the words is a mention; a child tag only where it has fields of its own.

Some records are shaped wrongly or left half-filled on purpose, so the plugin has something to
propose (each marked "on purpose" below). Run: python3 test/illness-test-graph.py
"""
import datetime as dt
import random
from pathlib import Path

random.seed(7)
OUT = Path(__file__).with_name('illness-test-graph.edn')
TODAY = dt.date(2026, 10, 19)


# ---------- EDN helpers ----------
def s(text):
    return '"' + text.replace('\\', '\\\\').replace('"', '\\"') + '"'

def uid(kind, n):
    return f'{kind}000000-0000-4000-8000-{n:012x}'

def ref(u):
    return f'[:block/uuid #uuid "{u}"]'

def refs(us):
    return '#{' + ' '.join(ref(u) for u in dict.fromkeys(us)) + '}'

def day(d):
    return f'[:build/page {{:build/journal {d:%Y%m%d}}}]'

def ms(d):
    return int(dt.datetime(d.year, d.month, d.day, tzinfo=dt.timezone.utc).timestamp() * 1000)

def D(text):
    """'2026-07-09' or 'Jul 9' style input → date."""
    return dt.date.fromisoformat(text)

def props(m):
    return '{' + ' '.join(f':user.property/{k} {v}' if not k.startswith(':') else f'{k} {v}' for k, v in m.items() if v is not None) + '}'


# ---------- Properties ----------
P = {}       # slug → edn of the property definition
CHOICE = {}  # (slug, value) → uuid
_choice_n = [0]

def prop(slug, title, typ, many=False, classes=None, choices=None):
    parts = [f':block/title {s(title)}', f':logseq.property/type :{typ}',
             f':db/cardinality :db.cardinality/{"many" if many else "one"}']
    if classes:
        parts.append(':build/property-classes [' + ' '.join(f':user.class/{c.replace(" ", "-")}' for c in classes) + ']')
    if choices:
        vals = []
        for v in choices:
            _choice_n[0] += 1
            u = uid('7a', _choice_n[0])
            CHOICE[(slug, v)] = u
            vals.append(f'{{:value {s(v) if isinstance(v, str) else v} :uuid #uuid "{u}"}}')
        parts.append(':build/closed-values [' + ' '.join(vals) + ']')
    P[slug] = '{' + ' '.join(parts) + '}'

MANY = {'tests'}
def ch(slug, *values):
    if len(values) == 1 and slug not in MANY:
        return ref(CHOICE[(slug, values[0])])
    return refs(CHOICE[(slug, v)] for v in values)

prop('date', 'Date', 'date')
prop('phone', 'phone', 'default')
prop('email', 'email', 'default')
prop('relation', 'relation', 'default', choices=['Wife', 'Daughter', 'Son', 'Friend', 'Neighbour'])
prop('insurer', 'insurer', 'node', classes=['Insurer'])
prop('specialty', 'specialty', 'default', choices=['Oncology', 'Colorectal surgery', 'Gastroenterology', 'Radiology', 'General practice', 'Anaesthesia'])
prop('works-at', 'works at', 'node', classes=['Organization'])
prop('website', 'website', 'url')
prop('address', 'address', 'default')
prop('portal', 'patient portal', 'url')
prop('dose', 'dose', 'default')
prop('how-often', 'how often', 'default', choices=['Once a day', 'Twice a day', 'Three times a day', 'As needed', 'Each cycle'])
prop('prescribed-by', 'prescribed by', 'node', classes=['Doctor'])
prop('treats', 'treats', 'node')  # no tag on purpose: points at a Condition or a Symptom
prop('started', 'started', 'date')
prop('stopped', 'stopped', 'date')
prop('still-taking', 'still taking', 'checkbox')
prop('file', 'file', 'url')
prop('kind', 'kind', 'default', choices=['Pathology', 'Imaging', 'Procedure', 'Lab results', 'Discharge summary', 'Letter'])
prop('ordered-by', 'ordered by', 'node', classes=['Doctor'])
prop('hospital', 'hospital', 'node', classes=['Hospital'])
prop('result', 'result', 'default', choices=['Normal', 'Abnormal', 'Unclear'])
prop('summary', 'summary', 'default')
prop('amount', 'amount', 'number')
prop('paid', 'paid', 'checkbox')
prop('how', 'how', 'default', choices=['In person', 'Video', 'Phone'])
prop('doctor', 'doctor', 'node', classes=['Doctor'])
prop('with', 'with', 'node', many=True, classes=['Person'])
prop('report', 'report', 'node', classes=['Report'])
prop('follows-up', 'follows up', 'node', classes=['Appointment'])
prop('ask', 'ask', 'node', many=True, classes=['Question'])
prop('decided', 'decided', 'default')
prop('next-step', 'next step', 'default')
prop('scan-type', 'scan type', 'default', choices=['CT', 'MRI', 'PET', 'X-ray', 'Ultrasound', 'Colonoscopy'])
prop('body-area', 'body area', 'default')
prop('contrast', 'contrast', 'checkbox')
prop('radiologist', 'radiologist', 'node', classes=['Doctor'])
prop('tests', 'tests', 'default', many=True, choices=['Blood count', 'CEA', 'Liver panel', 'Kidney panel', 'Magnesium'])
prop('fasting', 'fasting', 'checkbox')
prop('lab', 'lab', 'node', classes=['Organization'])
prop('procedure', 'procedure', 'default')
prop('anaesthesia', 'anaesthesia', 'default', choices=['General', 'Sedation', 'Local'])
prop('hospital-stay', 'hospital stay', 'node', classes=['Hospital stay'])
prop('cycle', 'cycle', 'number')
prop('drugs', 'drugs', 'node', many=True, classes=['Medication'])
prop('how-it-went', 'how it went', 'default')  # free text with three values on purpose: the shape box's choice-list hint
prop('from', 'from', 'date')
prop('to', 'to', 'date')
prop('ward', 'ward', 'default')
prop('symptoms', 'symptoms', 'node', many=True, classes=['Symptom'])
prop('pain', 'pain', 'number')
prop('energy', 'energy', 'default', choices=['Low', 'OK', 'Good'])
prop('about', 'about', 'default')
prop('diagnosed-on', 'diagnosed on', 'date')
prop('stage', 'stage', 'default', choices=['I', 'II', 'IIIA', 'IIIB', 'IIIC', 'IV'])
prop('cycles-planned', 'cycles planned', 'number')
prop('answered', 'answered', 'checkbox')
prop('visit-type', 'visit type', 'default')  # free-text sub-kind on the early records, on purpose (the wrong shape)

# ---------- Tags ----------
C = {}
def cls(name, parent=None, fields=(), extra=''):
    key = name.replace(' ', '-')
    parts = [f':block/title {s(name)}']
    if parent:
        parts.append(f':build/class-extends [:user.class/{parent.replace(" ", "-")}]')
    if fields:
        parts.append(':build/class-properties [' + ' '.join(f':user.property/{f}' for f in fields) + ']')
    if extra:
        parts.append(extra)
    C[key] = '{' + ' '.join(parts) + '}'

BIDI = ':build/properties {:logseq.property.class/enable-bidirectional? true}'
cls('Entity'); cls('Occurrence'); cls('Concept')
cls('Person', 'Entity', ['phone', 'email', 'relation', 'insurer'])
cls('Doctor', 'Person', ['specialty', 'works-at'])
cls('Nurse', 'Person', ['works-at'])
cls('Organization', 'Entity', ['website', 'phone', 'address'])
cls('Hospital', 'Organization', ['portal'])
cls('Pharmacy', 'Organization')
cls('Insurer', 'Organization')
cls('Medication', 'Entity', ['dose', 'how-often', 'prescribed-by', 'treats', 'started', 'stopped', 'still-taking'])
cls('Document', 'Entity', ['date', 'file'])
cls('Report', 'Document', ['kind', 'ordered-by', 'hospital', 'result', 'summary'], BIDI)
cls('Bill', 'Document', ['amount', 'insurer', 'paid'])
cls('Appointment', 'Occurrence', ['date', 'how', 'doctor', 'hospital', 'with', 'report', 'follows-up'], BIDI)
cls('Consultation', 'Appointment', ['ask', 'decided', 'next-step'])
cls('Scan', 'Appointment', ['scan-type', 'body-area', 'contrast', 'radiologist'])
cls('Blood test', 'Appointment', ['tests', 'fasting', 'lab'])
cls('Surgery', 'Appointment', ['procedure', 'anaesthesia', 'hospital-stay'])
cls('Infusion', 'Appointment', ['cycle', 'drugs', 'how-it-went'])
cls('Hospital stay', 'Occurrence', ['from', 'to', 'hospital', 'ward'])
cls('Symptom log', 'Occurrence', ['date', 'symptoms', 'pain', 'energy'])
cls('Call', 'Occurrence', ['date', 'with', 'about'])
cls('Condition', 'Concept', ['diagnosed-on', 'stage'])
cls('Treatment plan', 'Concept', ['treats', 'doctor', 'cycles-planned'])
cls('Question', 'Concept', ['answered'])
cls('Symptom', 'Concept')  # no fields on purpose: the shape box's "adds no field" hint

def tags(*names):
    return '[' + ' '.join(f':user.class/{n.replace(" ", "-")}' for n in names) + ']'


# ---------- Pages ----------
PAGES = []
ID = {}  # short name → uuid
_n = {}
def new_id(kind):
    _n[kind] = _n.get(kind, 0) + 1
    return uid(kind, _n[kind])

def page(key, title, tag=None, fields=None, blocks=(), alias=None, kind='1a'):
    u = ID[key] = new_id(kind)
    parts = [f':block/title {s(title)}', f':block/uuid #uuid "{u}"', ':build/keep-uuid? true']
    if tag:
        parts.append(f':build/tags {tags(tag)}')
    f = dict(fields or {})
    if alias:
        f[':block/alias'] = '#{' + f'[:build/page {{:block/title {s(alias)}}}]' + '}'
    if f:
        parts.append(f':build/properties {props(f)}')
    PAGES.append((key, '{:page {' + ' '.join(parts) + '} :blocks [' + ' '.join(blocks) + ']}'))
    return u

def B(title, tag=None, fields=None, children=(), uuid=None, collapsed=False):
    parts = [f':block/title {s(title)}']
    if uuid:
        parts += [f':block/uuid #uuid "{uuid}"', ':build/keep-uuid? true']
    if tag:
        parts.append(f':build/tags {tag if tag.startswith("[") else tags(tag)}')
    if fields:
        parts.append(f':build/properties {props(fields)}')
    if collapsed:
        parts.append(':block/collapsed? true')
    if children:
        parts.append(':build/children [' + ' '.join(children) + ']')
    return '{' + ' '.join(parts) + '}'

STATUS = {'todo': 'todo', 'doing': 'doing', 'done': 'done', 'canceled': 'canceled', 'backlog': 'backlog', 'review': 'in-review'}
def T(title, status='todo', priority=None, deadline=None, children=()):
    f = {':logseq.property/status': f':logseq.property/status.{STATUS[status]}'}
    if priority:
        f[':logseq.property/priority'] = f':logseq.property/priority.{priority}'
    if deadline:
        f[':logseq.property/deadline'] = ms(D(deadline))
    return B(title, '[:logseq.class/Task]', f, children)

# Organizations
page('meridian', 'Meridian Health Insurance', 'Insurer', {'website': s('https://meridian-health.example.com'), 'phone': s('0800 555 0142')},
     [B('Policy MH-55821-B. Covers 80% of hospital costs after the yearly excess.'), B('Claims line is open weekdays 8 to 6.')])
page('riverside', 'Riverside General Hospital', 'Hospital',
     {'website': s('https://riverside-general.example.org'), 'phone': s('020 7946 0310'), 'address': s('1 River Lane, Eastbridge'),
      'portal': s('https://portal.riverside-general.example.org')},
     [B('Parking is in the multi-storey on Mill Road; the endoscopy unit is on level 2.'), B('Ward 6B is the surgical ward.')])
page('northgate', 'Northgate Cancer Center', 'Hospital',
     {'website': s('https://northgate-cancer.example.org'), 'phone': s('020 7946 0877'), 'address': s('40 Northgate Road, Eastbridge'),
      'portal': s('https://my.northgate-cancer.example.org')},
     [B('Day unit on the ground floor. Chemo chairs by the window if you ask early.'), B('Acute oncology line, 24 hours: 020 7946 0999')],
     alias='Northgate')
page('elm', 'Elm Street Medical Centre', 'Hospital', {'phone': s('020 7946 0123'), 'address': s('12 Elm Street, Eastbridge')},
     [B('My GP practice. Repeat prescriptions take two working days.')])
page('lakeside', 'Lakeside Pharmacy (湖畔药房)', 'Pharmacy', {'phone': s('020 7946 0456'), 'address': s('3 Quay Parade')},
     [B('Mrs. Lin runs it; she keeps the anti-sickness tablets in stock for me.')])
page('medlab', 'Medlab Diagnostics', 'Organization', {'website': s('https://medlab.example.com')},
     [B('Blood tests without an appointment, 7:30 to 11 on weekdays.')])

# People
page('daniel', 'Daniel Okoro', 'Person', {'email': s('daniel.okoro@example.net'), 'phone': s('07700 900 214'), 'insurer': ref(ID['meridian'])},
     [B('Retired maths teacher, 58. Lives in Eastbridge with [[Ruth Okoro]].'),
      B('Care team', children=[B('[[Dr. Mei Chen]] (oncologist)'), B('[[Dr. Raj Patel]] (surgeon)'), B('[[Dr. Helen Brooks]] (GP)'),
                               B('[[Zoë Müller]] (chemo nurse)')]),
      B('NHS number 943 476 5919 (made up). Blood group O+.')])
page('ruth', 'Ruth Okoro', 'Person', {'relation': ch('relation', 'Wife'), 'phone': s('07700 900 388')},
     [B('Comes to most appointments and keeps the paper folder.')])
page('amara', 'Amara Okoro', 'Person', {'relation': ch('relation', 'Daughter'), 'email': s('amara.okoro@example.net')},
     [B('Lives in Leeds. Comes down for the surgery week and for cycle 1.')])
page('tunde', 'Tunde Okoro', 'Person', {'relation': ch('relation', 'Son')}, [])  # sparse on purpose
page('graham', 'Graham Whitlock', 'Person', {'relation': ch('relation', 'Friend'), 'phone': s('07700 900 721')},
     [B('Old colleague. Drives me when Ruth is at work.')])
page('chen', 'Dr. Mei Chen', 'Doctor', {'specialty': ch('specialty', 'Oncology'), 'works-at': ref(ID['northgate']),
     'email': s('m.chen@northgate-cancer.example.org')},
     [B('Consultant medical oncologist. Explains things with drawings.'), B('Secretary: Paula, 020 7946 0880.')], alias='Dr. Chen')
page('patel', 'Dr. Raj Patel', 'Doctor', {'specialty': ch('specialty', 'Colorectal surgery'), 'works-at': ref(ID['riverside'])},
     [B('Consultant colorectal surgeon. Did the operation on Aug 4.')])
page('alvarez', 'Dr. Sofia Alvarez', 'Doctor', {'specialty': ch('specialty', 'Gastroenterology'), 'works-at': ref(ID['riverside'])},
     [B('Did the colonoscopy and gave me the biopsy result.')])
page('oconnor', "Dr. Liam O'Connor", 'Doctor', {'specialty': ch('specialty', 'Radiology'), 'works-at': ref(ID['riverside'])}, [])
page('brooks', 'Dr. Helen Brooks', 'Doctor', {'specialty': ch('specialty', 'General practice'), 'works-at': ref(ID['elm'])},
     [B('My GP for twenty years. First to take the bleeding seriously.')])
page('watanabe', 'Dr. Kenji Watanabe', 'Doctor', {'specialty': ch('specialty', 'Anaesthesia')}, [])  # no workplace on purpose
page('zoe', 'Zoë Müller', 'Nurse', {'works-at': ref(ID['northgate'])}, [B('Chemo nurse on the day unit. Always remembers Ruth\'s name.')])
page('marcus', 'Marcus Bell', 'Nurse', {'works-at': ref(ID['riverside'])}, [B('Ward 6B. Pre-op assessment and the first night after surgery.')])
page('hannah', 'Hannah Reyes', None, None, [B('Dietitian at Northgate.')])  # no tag on purpose: "a new link gets the tag its field takes"

# Condition, plan, symptoms
page('crc', 'Colon cancer', 'Condition', {'diagnosed-on': day(D('2026-07-09')), 'stage': ch('stage', 'IIIB')},
     [B('Adenocarcinoma of the ascending colon. Spread to 3 of 18 lymph nodes, nothing further.'),
      B('Treatment: surgery, then eight cycles of chemotherapy.')], alias='CRC')
SYMPTOMS = ['Fatigue', 'Nausea', 'Abdominal pain', 'Diarrhoea', 'Tingling fingers', 'Cold sensitivity', 'Mouth sores',
            'Loss of appetite', 'Blood in stool', 'Weight loss']
for name in SYMPTOMS:
    page('sym:' + name, name, 'Symptom', None, [])

# Medications
def med(key, title, dose, often, by, treats, started, stopped=None, taking=True, blocks=()):
    page(key, title, 'Medication', {'dose': s(dose), 'how-often': ch('how-often', often), 'prescribed-by': ref(ID[by]) if by else None,
         'treats': ref(ID[treats]) if treats else None, 'started': day(D(started)) if started else None,
         'stopped': day(D(stopped)) if stopped else None, 'still-taking': 'true' if taking else 'false'}, blocks)
med('oxali', 'Oxaliplatin', '85 mg/m² (from cycle 4: 65 mg/m²)', 'Each cycle', 'chen', 'crc', '2026-09-02',
    blocks=[B('The one that causes the cold tingling. No cold drinks for three days after.')])
med('fu', 'Fluorouracil (5-FU)', 'pump over 46 hours', 'Each cycle', 'chen', 'crc', '2026-09-02', blocks=[B('Goes home in a bottle on my belt; district nurse takes it off on day 3.')])
med('leuco', 'Leucovorin', '400 mg/m²', 'Each cycle', 'chen', 'crc', '2026-09-02')
med('ondan', 'Ondansetron', '8 mg', 'As needed', 'chen', 'sym:Nausea', '2026-09-02')
med('dexa', 'Dexamethasone', '4 mg', 'Twice a day', 'chen', 'sym:Nausea', '2026-09-02', blocks=[B('Only days 1 to 3 of each cycle. Makes me wide awake at 3am.')])
med('oxy', 'Oxycodone', '5 mg', 'As needed', 'patel', 'sym:Abdominal pain', '2026-08-04', '2026-08-20', taking=False)
med('lopera', 'Loperamide', '2 mg', 'As needed', 'chen', 'sym:Diarrhoea', '2026-09-17')
med('omep', 'Omeprazole', '20 mg', 'Once a day', 'brooks', None, None)  # before the illness: no start day, treats nothing here
page('plan', 'Chemotherapy plan (FOLFOX)', 'Treatment plan', {'treats': ref(ID['crc']), 'doctor': ref(ID['chen']), 'cycles-planned': 8},
     [B('Every two weeks, eight cycles, starting Sep 2. Blood test the day before each one.'),
      B('Drugs: [[Oxaliplatin]], [[Fluorouracil (5-FU)]], [[Leucovorin]].'),
      B('Cycle 4 moved a week (neutrophils low on Oct 13).')])

# Questions
QUESTIONS = {
    'q-haem': ('Is this just haemorrhoids?', True, 'Dr. Brooks: probably not, worth checking.'),
    'q-stoma': ('Will I need a stoma?', True, 'No: the tumour is on the right side, so the bowel can be joined straight away.'),
    'q-recovery': ('How long is recovery after surgery?', True, 'About six weeks before lifting anything heavy.'),
    'q-chemo-why': ('Why chemo if the surgery got it all?', True, 'To mop up cells that may have spread through the lymph nodes. Cuts the risk of it coming back by about a third.'),
    'q-drive': ('Can I drive after chemo?', True, 'Not on day 1. After that if I feel fine.'),
    'q-tingle': ('Is the tingling permanent?', False, None),
    'q-work': ('Should I stop volunteering at the library?', False, None),
    'q-vaccine': ('Can I have the flu jab during chemo?', True, 'Yes, between cycles; Dr. Brooks will do it.'),
    'q-scan': ('When is the next CT scan?', True, 'Nov 12.'),
    'q-diet': ('Is there anything I should not eat?', False, None),  # asked at no appointment yet
}
for key, (title, answered, answer) in QUESTIONS.items():
    page(key, title, 'Question', {'answered': 'true' if answered else 'false'}, [B(answer)] if answer else [])


# ---------- Journals ----------
J = {}  # date → list of blocks
def add(d, *blocks):
    J.setdefault(D(d) if isinstance(d, str) else d, []).extend(blocks)

APPT = {}
def appt(key, written, title, tag, fields, children=(), collapsed=False):
    u = APPT[key] = new_id('6a')
    add(written, B(title, tag, fields, children, uuid=u, collapsed=collapsed))
    return u

REPORTS = {}
def report(key, title, kind, on, by, hospital, result, summary, blocks=()):
    REPORTS[key] = page(key, title, 'Report', {'date': day(D(on)), 'kind': ch('kind', kind), 'ordered-by': ref(ID[by]) if by else None,
                        'hospital': ref(ID[hospital]) if hospital else None, 'result': ch('result', result) if result else None,
                        'summary': s(summary) if summary else None,
                        'file': s(f'https://portal.example.org/docs/{key}.pdf')}, blocks, kind='5a')
    return REPORTS[key]

report('r-bc-0626', 'Blood count 2026-06-26', 'Lab results', '2026-06-26', 'brooks', 'elm', 'Abnormal', 'Haemoglobin 98 g/L, low. Iron low.')
report('r-colo', 'Colonoscopy report 2026-07-03', 'Procedure', '2026-07-03', 'alvarez', 'riverside', 'Abnormal',
       'Mass in the ascending colon, 4 cm. Biopsies taken.', [B('Two small polyps removed from the sigmoid as well.')])
report('r-biopsy', 'Biopsy pathology 2026-07-08', 'Pathology', '2026-07-03', 'alvarez', 'riverside', 'Abnormal', 'Moderately differentiated adenocarcinoma.')
report('r-ct-0714', 'CT chest abdomen pelvis 2026-07-14', 'Imaging', '2026-07-14', 'patel', 'riverside', 'Unclear',
       'Two enlarged lymph nodes near the tumour. No spread to liver or lungs.')
report('r-cea-0714', 'CEA 2026-07-14', 'Lab results', '2026-07-14', 'patel', 'riverside', 'Abnormal', 'CEA 9.2 (normal under 5).')
report('r-discharge', 'Discharge summary 2026-08-08', 'Discharge summary', '2026-08-08', 'patel', 'riverside', None,
       'Laparoscopic right hemicolectomy Aug 4. Uneventful recovery. Home on day 4.')
report('r-path', 'Surgical pathology 2026-08-11', 'Pathology', '2026-08-04', 'patel', 'riverside', 'Abnormal',
       'pT3 N1b: 3 of 18 lymph nodes involved. Margins clear. Stage IIIB.')
report('r-letter-0820', 'Letter from Dr. Chen 2026-08-20', 'Letter', '2026-08-20', 'chen', 'northgate', None,
       'Recommends eight cycles of FOLFOX starting early September.')
report('r-bc-0901', 'Blood count 2026-09-01', 'Lab results', '2026-09-01', 'chen', 'northgate', 'Normal', 'All counts fine for cycle 1.')
report('r-bc-0915', 'Blood count 2026-09-15', 'Lab results', '2026-09-15', 'chen', 'northgate', 'Normal', 'Neutrophils 2.1, fine.')
report('r-bc-0929', 'Blood count 2026-09-29', 'Lab results', '2026-09-29', 'chen', 'northgate', 'Normal', 'Neutrophils 1.6, borderline but fine.')
report('r-cea-0929', 'CEA 2026-09-29', 'Lab results', '2026-09-29', 'chen', 'northgate', 'Normal', 'CEA 2.8, back to normal since surgery.')
report('r-letter-1007', 'Clinic letter 2026-10-07', 'Letter', '2026-10-07', 'chen', 'northgate', None,
       'Grade 1 neuropathy. Oxaliplatin reduced by 25% from cycle 4.')
report('r-bc-1013', 'Blood count 2026-10-13', 'Lab results', '2026-10-13', 'chen', 'northgate', 'Abnormal', 'Neutrophils 0.9, too low: cycle 4 delayed a week.')
report('r-ecg', 'ECG 2026-07-21', 'Lab results', '2026-07-21', None, 'riverside', 'Normal', None)  # sparse on purpose

# Bills (pages)
page('bill-surgery', 'Riverside bill: surgery', 'Bill', {'date': day(D('2026-08-28')), 'amount': 1240, 'insurer': ref(ID['meridian']), 'paid': 'true'},
     [B('Excess for the operation and the stay. Paid by card Sep 3.')], kind='5a')
page('bill-c1', 'Northgate bill: cycle 1', 'Bill', {'date': day(D('2026-09-20')), 'amount': 320, 'insurer': ref(ID['meridian']), 'paid': 'true'}, [], kind='5a')
page('bill-c3', 'Northgate bill: cycles 2 and 3', 'Bill', {'date': day(D('2026-10-10')), 'amount': 410.5, 'insurer': ref(ID['meridian']), 'paid': 'false'},
     [B('Meridian says they need the clinic letter first. See the task on Oct 12.')], kind='5a')

who = lambda *keys: refs(ID[k] for k in keys)
P_ = lambda k: ref(ID[k])

# --- June: first signs. The early records use the free-text "visit type" (the wrong shape, on purpose).
add('2026-06-22', B('Blood again this morning. Third time this month. Not telling Ruth yet.'),
    B('Tired by 3pm every day lately', 'Symptom log', {'date': day(D('2026-06-22')), 'symptoms': refs(ID['sym:' + x] for x in ['Fatigue', 'Blood in stool']), 'pain': 1, 'energy': ch('energy', 'Low')}))
add('2026-06-23', B('Told [[Ruth Okoro]]. She made me promise to ring the surgery.'),
    T('Ring Elm Street for a GP appointment', 'done', 'high'))
add('2026-06-24', B('Got an appointment for tomorrow with [[Dr. Helen Brooks]].'))
appt('gp-0625', '2026-06-25', 'GP about the bleeding', 'Consultation',
     {'date': day(D('2026-06-25')), 'how': ch('how', 'In person'), 'doctor': P_('brooks'), 'hospital': P_('elm'), 'with': who('ruth'),
      'ask': refs([ID['q-haem']]), 'decided': s('Blood test, and a referral to gastroenterology'), 'next-step': s('Blood test tomorrow'),
      'visit-type': s('GP visit')},
     [B('She examined me and said she wants it looked at properly, two-week pathway.')])
appt('bt-0626', '2026-06-26', 'Blood test at Medlab', 'Blood test',
     {'date': day(D('2026-06-26')), 'how': ch('how', 'In person'), 'tests': ch('tests', 'Blood count', 'Liver panel'), 'fasting': 'false',
      'lab': P_('medlab'), 'report': ref(REPORTS['r-bc-0626']), 'visit-type': s('blood test')})
add('2026-06-27', B('Quiet weekend. Gardened a little, had to sit down after twenty minutes.'))
add('2026-06-29', B('Dr. Brooks rang: haemoglobin low. Iron tablets for now, colonoscopy being booked.'),
    T('Pick up iron tablets from [[Lakeside Pharmacy (湖畔药房)]]', 'done'))
add('2026-06-30', B('Booking call', 'Call', {'date': day(D('2026-06-30')), 'about': s('Colonoscopy on Jul 3, bowel prep instructions by post')}),
    T('Buy the bowel prep and clear fluids', 'done', deadline='2026-07-02'))
add('2026-07-01', B('Prep letter came. Low-fibre diet from today. No more toast with seeds, apparently.'))
add('2026-07-02', B('Prep day. Not pleasant. [[Graham Whitlock]] will drive tomorrow.'))
appt('colo', '2026-07-03', 'Colonoscopy', 'Scan',
     {'date': day(D('2026-07-03')), 'how': ch('how', 'In person'), 'doctor': P_('alvarez'), 'hospital': P_('riverside'),
      'with': who('ruth', 'graham'), 'scan-type': ch('scan-type', 'Colonoscopy'), 'body-area': s('Colon'), 'contrast': 'false',
      'report': ref(REPORTS['r-colo']), 'follows-up': ref(APPT['gp-0625']), 'visit-type': s('Scan')},
     [B('Under sedation. Dr. Alvarez said there is "something that needs a biopsy". Her face said more.')])
add('2026-07-04', B('Couldn\'t sleep. Read about colon cancer until 2am, which was a mistake.'))
add('2026-07-06', B('Waiting for the biopsy. Everything feels on hold.'),
    B('Low day', 'Symptom log', {'date': day(D('2026-07-06')), 'symptoms': refs([ID['sym:Fatigue']]), 'energy': ch('energy', 'Low')}))
add('2026-07-07', B('[[Amara Okoro]] called. I didn\'t tell her yet. I will once I know.'))
appt('biopsy-call', '2026-07-08', 'Biopsy result', 'Consultation',
     {'date': day(D('2026-07-08')), 'how': ch('how', 'Phone'), 'doctor': P_('alvarez'), 'hospital': P_('riverside'),
      'report': ref(REPORTS['r-biopsy']), 'follows-up': ref(APPT['colo']), 'decided': s('Referred to the colorectal team'),
      'next-step': s('See Dr. Patel tomorrow'), 'visit-type': s('phone call')},
     [B('It is cancer. Adenocarcinoma. She was kind about it.'), B('Rang Amara and [[Tunde Okoro]] in the evening.')])
appt('patel-0709', '2026-07-09', 'First visit with the surgeon', 'Consultation',
     {'date': day(D('2026-07-09')), 'how': ch('how', 'In person'), 'doctor': P_('patel'), 'hospital': P_('riverside'), 'with': who('ruth'),
      'ask': refs([ID['q-stoma'], ID['q-recovery']]), 'decided': s('CT scan first, then probably keyhole surgery'),
      'next-step': s('CT on Jul 14'), 'follows-up': ref(APPT['biopsy-call'])},
     [B('Diagnosis made official: [[Colon cancer]].'), B('He drew the colon on a napkin. Right side, which he says is the easier side.')])
add('2026-07-10', B('Told my book group. More hugs than I knew what to do with.'))
add('2026-07-11', T('Write down every question before the next appointment', 'done'),
    B('Morning', 'Symptom log', {'symptoms': refs(ID['sym:' + x] for x in ['Fatigue', 'Abdominal pain']), 'pain': 3, 'energy': ch('energy', 'OK')}))  # no date on purpose
add('2026-07-13', B('Nil by mouth from midnight for the CT.'))
appt('ct-0714', '2026-07-14', 'CT scan', 'Scan',
     {'date': day(D('2026-07-14')), 'how': ch('how', 'In person'), 'doctor': P_('patel'), 'hospital': P_('riverside'), 'with': who('graham'),
      'scan-type': ch('scan-type', 'CT'), 'body-area': s('Chest, abdomen and pelvis'), 'contrast': 'true', 'radiologist': P_('oconnor'),
      'report': ref(REPORTS['r-ct-0714'])},
     [B('The contrast makes you feel like you\'ve wet yourself. Nobody warns you.')])
appt('cea-0714', '2026-07-14', 'Bloods for the tumour marker', 'Blood test',
     {'date': day(D('2026-07-14')), 'hospital': P_('riverside'), 'tests': ch('tests', 'CEA', 'Blood count'), 'fasting': 'true',
      'report': ref(REPORTS['r-cea-0714'])})
add('2026-07-15', B('Garden again. Better day.'),
    B('Better', 'Symptom log', {'date': day(D('2026-07-15')), 'symptoms': refs([ID['sym:Fatigue']]), 'pain': 1, 'energy': ch('energy', 'Good')}))
# two doctors in the words, single-value field empty: the plugin should stay quiet (on purpose)
appt('mdt', '2026-07-17', 'Results of the team meeting', 'Consultation',
     {'date': day(D('2026-07-17')), 'how': ch('how', 'In person'), 'hospital': P_('riverside'), 'with': who('ruth', 'amara'),
      'ask': refs([ID['q-chemo-why']]), 'decided': s('Surgery on Aug 4, chemotherapy after'), 'follows-up': ref(APPT['ct-0714'])},
     [B('Saw [[Dr. Raj Patel]] and [[Dr. Mei Chen]] together. Surgery first, then chemo depending on the lymph nodes.')])
add('2026-07-18', B('Amara stayed the night. We watched old films and didn\'t talk about it.'))
add('2026-07-20', B('Before surgery', collapsed=True, children=[
        T('Pre-op assessment Jul 21', 'done'), T('Stop the omeprazole the day before', 'done'),
        T('Sort out power of attorney with Ruth', 'todo', 'medium', '2026-08-01'),
        T('Freeze some meals', 'done'), T('Ask the library to cover my Thursday shift', 'canceled')]))
appt('preop', '2026-07-21', 'Pre-op assessment', 'Appointment',
     {'date': day(D('2026-07-21')), 'how': ch('how', 'In person'), 'hospital': P_('riverside'), 'with': who('marcus'),
      'report': ref(REPORTS['r-ecg'])},
     [B('[[Marcus Bell]] did the ECG, bloods and the questionnaire. Swabs for MRSA.')])
for d, text in [('2026-07-23', 'Long walk by the river with Ruth.'), ('2026-07-24', 'Bad night. Scared about the anaesthetic.'),
                ('2026-07-27', 'Tunde video call from Lagos. He wants to fly over; I told him to wait for chemo.'),
                ('2026-07-29', 'Bought loose trousers for after the operation.'), ('2026-07-31', 'Hair cut. Silly thing to do but I wanted to.')]:
    add(d, B(text))
add('2026-07-30', B('Anaesthetist rang', 'Call', {'date': day(D('2026-07-30')), 'with': None, 'about': s('Allergies and the spinal block')},
    [B('It was [[Dr. Kenji Watanabe]]. Very calm voice.')]))
add('2026-08-03', T('Pack the hospital bag', 'done', 'high', '2026-08-03'), B('Shower with the pink antiseptic. Bed early.'))
stay = new_id('6a')
appt('surgery', '2026-08-04', 'Operation', 'Surgery',
     {'date': day(D('2026-08-04')), 'how': ch('how', 'In person'), 'doctor': P_('patel'), 'hospital': P_('riverside'), 'with': who('ruth', 'amara'),
      'procedure': s('Laparoscopic right hemicolectomy'), 'anaesthesia': ch('anaesthesia', 'General'), 'hospital-stay': ref(stay),
      'report': ref(REPORTS['r-path']), 'follows-up': ref(APPT['mdt'])},
     [B('In at 7, theatre at 9:30, awake by 2. Dr. Patel says it went well.')])
add('2026-08-04', B('Ward 6B', 'Hospital stay', {'from': day(D('2026-08-04')), 'to': day(D('2026-08-08')), 'hospital': P_('riverside'),
                                                'ward': s('6B, bed 14')}, uuid=stay))
add('2026-08-05', B('Walked to the window and back. Marcus cheered.'),
    B('Day 1 after', 'Symptom log', {'date': day(D('2026-08-05')), 'symptoms': refs([ID['sym:Abdominal pain']]), 'pain': 6, 'energy': ch('energy', 'Low')}))
add('2026-08-06', B('First cup of tea. Best tea of my life.'),
    B('Day 2 after', 'Symptom log', {'date': day(D('2026-08-06')), 'symptoms': refs([ID['sym:Abdominal pain']]), 'pain': 4, 'energy': ch('energy', 'Low')}))
add('2026-08-07', B('Bowels working. Everyone very pleased with me.'))
add('2026-08-08', B('Home. Report: [[Discharge summary 2026-08-08]].'), T('Book the post-op check for Aug 18', 'done'),
    T('Collect the oxycodone from [[Lakeside Pharmacy (湖畔药房)]]', 'done'))
for d, text in [('2026-08-09', 'Sleeping a lot. Ruth keeps checking I\'m breathing.'), ('2026-08-10', 'Short walk to the end of the road.')]:
    add(d, B(text))
appt('path-call', '2026-08-11', 'Pathology results', 'Consultation',
     {'date': day(D('2026-08-11')), 'how': ch('how', 'Phone'), 'doctor': P_('patel'), 'report': ref(REPORTS['r-path']),
      'decided': s('Refer to oncology for chemotherapy'), 'follows-up': ref(APPT['surgery'])},
     [B('Three lymph nodes. So chemo after all. Stage IIIB, see [[CRC]].')])
for d in ['2026-08-12', '2026-08-13', '2026-08-15', '2026-08-16']:
    add(d, B(random.choice(['Wound healing well.', 'Walked to the park bench and back.', 'Read in the garden.', 'Tired, but less sore.'])),
        B('Evening', 'Symptom log', {'date': day(D(d)) if d != '2026-08-15' else None, 'symptoms': refs([ID['sym:Fatigue'], ID['sym:Abdominal pain']]),
                                     'pain': random.choice([2, 3]), 'energy': ch('energy', 'OK')}))
add('2026-08-14', B('[[Amara Okoro]] went back to Leeds. House very quiet.'))
appt('postop', '2026-08-18', 'Post-op check', 'Appointment',
     {'date': day(D('2026-08-18')), 'how': ch('how', 'In person'), 'doctor': P_('patel'), 'hospital': P_('riverside'), 'with': who('graham'),
      'follows-up': ref(APPT['surgery'])},
     [B('Wounds fine. Allowed to drive in two weeks.')])
add('2026-08-19', B('Stopped the oxycodone. Paracetamol is enough now.'))
appt('chen-0820', '2026-08-20', 'First oncology appointment', 'Consultation',
     {'date': day(D('2026-08-20')), 'how': ch('how', 'In person'), 'doctor': P_('chen'), 'hospital': P_('northgate'), 'with': who('ruth'),
      'ask': refs([ID['q-chemo-why'], ID['q-drive']]), 'decided': s('Eight cycles of FOLFOX, every two weeks'),
      'next-step': s('Cycle 1 on Sep 2'), 'report': ref(REPORTS['r-letter-0820']), 'follows-up': ref(APPT['path-call'])},
     [B('Plan: [[Chemotherapy plan (FOLFOX)]].'), T('Get a thermometer', 'done'), T('Dentist check before chemo', 'done', deadline='2026-08-28')])
for d, text in [('2026-08-21', 'Told the library I\'ll be off until the new year.'), ('2026-08-22', 'Ruth and I had a proper dinner out.'),
                ('2026-08-24', 'Dentist: all fine.'), ('2026-08-26', 'Line fitted for the chemo. Arm is sore.'),
                ('2026-08-27', 'Read the chemo booklet twice.'), ('2026-08-29', 'Weekend by the sea with Ruth.'), ('2026-08-30', 'Sea air. Slept ten hours.')]:
    add(d, B(text))
# a link in the words to an untagged page, doctor field empty (on purpose)
appt('diet', '2026-08-25', 'Dietitian', 'Appointment',
     {'date': day(D('2026-08-25')), 'how': ch('how', 'Video'), 'hospital': P_('northgate')},
     [B('Talked to [[Hannah Reyes]] about eating through chemo. Little and often; ginger for the nausea.')])
add('2026-08-28', B('Bill from Riverside: [[Riverside bill: surgery]].'), T('Send the surgery bill to [[Meridian Health Insurance]]', 'done'))

# --- Chemo cycles. Blood test the day before, infusion, a rough few days after.
CYCLES = [(1, '2026-09-02', 'Fine'), (2, '2026-09-16', 'Rough'), (3, '2026-09-30', 'Fine'),
          (4, '2026-10-21', None), (5, '2026-11-04', None), (6, '2026-11-18', None), (7, '2026-12-02', None), (8, '2026-12-16', None)]
BLOOD_REPORT = {1: 'r-bc-0901', 2: 'r-bc-0915', 3: 'r-bc-0929'}
BOOKED_ON = {4: '2026-10-14', 5: '2026-10-14', 6: '2026-10-14', 7: '2026-10-19', 8: '2026-10-19'}
prev = None
for n, when, went in CYCLES:
    w = D(when)
    bt_day = w - dt.timedelta(days=1)
    past = w <= TODAY
    written_bt = bt_day if past else D(BOOKED_ON[n])
    written = w if past else D(BOOKED_ON[n])
    tests = ('Blood count', 'CEA') if n == 3 else ('Blood count', 'Magnesium')
    appt(f'bt-c{n}', written_bt, f'Bloods before cycle {n}', 'Blood test',
         {'date': day(bt_day), 'how': ch('how', 'In person'), 'hospital': P_('northgate'), 'tests': ch('tests', *tests), 'fasting': 'false',
          'lab': P_('medlab') if n % 2 else P_('northgate'), 'report': ref(REPORTS[BLOOD_REPORT[n]]) if n in BLOOD_REPORT else None})
    drugs = refs([ID['oxali'], ID['fu'], ID['leuco']])
    kids = [B('Cold cap on, [[Zoë Müller]] on the drip. Pump home for 46 hours.')] if past else [T('Bring the pump bag back', 'todo')] if n == 4 else []
    appt(f'c{n}', written, f'Chemo cycle {n}', 'Infusion',
         {'date': day(w), 'how': ch('how', 'In person'), 'doctor': P_('chen'), 'hospital': P_('northgate'),
          'with': who('ruth', 'zoe') if n != 2 else who('graham', 'zoe'), 'cycle': n, 'drugs': drugs,
          'how-it-went': s(went) if went else None, 'follows-up': ref(APPT[prev]) if prev else None},
         kids)
    prev = f'c{n}'
    if past:
        for k, (sym, pain, energy) in enumerate([(['Nausea', 'Fatigue', 'Cold sensitivity'], 2, 'Low'),
                                                 (['Nausea', 'Fatigue', 'Diarrhoea'], 3, 'Low'),
                                                 (['Fatigue', 'Loss of appetite'], 2, 'OK'),
                                                 (['Fatigue'], 1, 'OK')], start=1):
            dd = w + dt.timedelta(days=k)
            if dd > TODAY:
                break
            undated = (n == 2 and k in (1, 3)) or (n == 3 and k == 2)  # no date on purpose
            add(dd, B(random.choice(['After chemo', 'Today', 'Morning check']), 'Symptom log',
                      {'date': None if undated else day(dd), 'symptoms': refs(ID['sym:' + x] for x in sym + (['Tingling fingers'] if n == 3 else [])),
                       'pain': pain + (1 if went == 'Rough' else 0), 'energy': ch('energy', energy)}))

add('2026-09-01', B('Nervous about tomorrow. [[Amara Okoro]] drove down.'))
add('2026-09-02', B('Cycle 1 done. Easier than I feared, on the day at least.'), T('Take dexamethasone with breakfast days 1 to 3', 'done'))
add('2026-09-04', B('Pump off. Felt like a weight lifted, literally.'), T('Pick up the ondansetron refill', 'done'))
add('2026-09-06', B('Good day. Walked into town.'))
add('2026-09-08', B('Amara left. Ruth and I back to normal routine, sort of.'))
add('2026-09-10', B('Best day since the operation.'), B('Wrote a long email to the book group.'))
add('2026-09-12', B('Weekend. [[Graham Whitlock]] came for lunch.'))
add('2026-09-14', T('Fill in the Meridian claim form for cycle 1', 'done', 'medium', '2026-09-20'))
add('2026-09-17', B('Diarrhoea started. Rang the acute line, they said loperamide.'),
    B('Acute line', 'Call', {'date': day(D('2026-09-17')), 'about': s('Diarrhoea after cycle 2')}))
add('2026-09-18', T('Drink three litres a day', 'doing'))
add('2026-09-20', B('Northgate bill arrived: [[Northgate bill: cycle 1]].'))
add('2026-09-22', B('Picked up again. Cooked for Ruth.'))
add('2026-09-24', B('Haircut number two. Thinning a bit at the front.'))
add('2026-09-26', B('Long talk with [[Tunde Okoro]]. He\'s coming at Christmas.'))
add('2026-09-27', B('Quiet Sunday.'))
add('2026-10-01', B('Fingers tingle when I take milk from the fridge. Gloves on the fridge door now.'))
add('2026-10-03', B('Tingling worse. Ruth says I should mention it.'), T('Tell Dr. Chen about the tingling', 'done', 'high'))
add('2026-10-05', B('Walked the river loop again, slowly.'))
appt('chen-1007', '2026-10-07', 'Review with Dr. Chen', 'Consultation',
     {'date': day(D('2026-10-07')), 'how': ch('how', 'Video'), 'doctor': P_('chen'), 'hospital': P_('northgate'),
      'ask': refs([ID['q-tingle'], ID['q-scan'], ID['q-work']]), 'decided': s('Reduce oxaliplatin by a quarter from cycle 4'),
      'next-step': s('CT on Nov 12'), 'report': ref(REPORTS['r-letter-1007']), 'follows-up': ref(APPT['chen-0820'])},
     [B('She thinks the tingling will mostly fade, but not always fully.')])
ct2 = appt('ct-1112', '2026-10-07', 'CT scan after six cycles', 'Scan',
     {'date': day(D('2026-11-12')), 'how': ch('how', 'In person'), 'doctor': P_('chen'), 'hospital': P_('riverside'),
      'scan-type': ch('scan-type', 'CT'), 'body-area': s('Chest, abdomen and pelvis'), 'contrast': 'true', 'follows-up': ref(APPT['ct-0714'])},
     [T('Book the patient transport', 'todo', 'medium', '2026-11-05'), T('Nil by mouth from midnight', 'todo')], collapsed=True)
add('2026-10-08', B('Library sent flowers.'))
add('2026-10-09', B('Tired but OK.'), B('Evening', 'Symptom log', {'symptoms': refs([ID['sym:Fatigue'], ID['sym:Tingling fingers']]), 'pain': 1, 'energy': ch('energy', 'OK')}))  # no date on purpose
add('2026-10-10', B('Second Northgate bill: [[Northgate bill: cycles 2 and 3]].'))
add('2026-10-12', T('Send the clinic letter to Meridian so they pay the bill', 'todo', 'high', '2026-10-15'),
    T('Ask [[Dr. Helen Brooks]] about the flu jab', 'done'))
add('2026-10-13', B('Bloods for cycle 4 today.'))
appt('bt-1013', '2026-10-13', 'Bloods before cycle 4 (first try)', 'Blood test',
     {'date': day(D('2026-10-13')), 'how': ch('how', 'In person'), 'hospital': P_('northgate'), 'tests': ch('tests', 'Blood count'),
      'lab': P_('northgate'), 'report': ref(REPORTS['r-bc-1013'])})
add('2026-10-14', B('Northgate rang', 'Call', {'date': day(D('2026-10-14')), 'with': who('zoe'), 'about': s('Neutrophils too low; cycle 4 moved to Oct 21')}),
    B('Annoyed and relieved at the same time. A free week.'))
appt('gp-1106', '2026-10-14', 'Flu jab at the GP', 'Appointment',
     {'date': day(D('2026-11-06')), 'how': ch('how', 'In person'), 'doctor': P_('brooks'), 'hospital': P_('elm')})
add('2026-10-15', B('Free week. Went to the library to see everyone.'))
add('2026-10-16', B('Long lunch with [[Graham Whitlock]]. Talked about anything but this.'))
add('2026-10-17', B('Good energy', 'Symptom log', {'date': day(D('2026-10-17')), 'symptoms': refs([ID['sym:Tingling fingers']]), 'pain': 0, 'energy': ch('energy', 'Good')}))
add('2026-10-18', B('Sunday. Made a list for the week.'))
# today
add('2026-10-19', B('Back on track for Wednesday. Feeling strong.'),
    B('This week', children=[T('Bloods tomorrow at Northgate', 'todo', 'high', '2026-10-20'), T('Charge the tablet for the chemo chair', 'todo'),
                             T('Call Meridian about the unpaid bill', 'doing', 'high', '2026-10-19'), T('Order more loperamide', 'todo', 'low', '2026-10-23')],
      collapsed=True),
    T('Write up questions for the Nov 25 review', 'backlog'))
appt('chen-1125', '2026-10-19', 'Review after cycle 6', 'Consultation',
     {'date': day(D('2026-11-25')), 'how': ch('how', 'In person'), 'doctor': P_('chen'), 'hospital': P_('northgate'), 'with': who('ruth'),
      'ask': refs([ID['q-tingle']]), 'follows-up': ref(APPT['chen-1007'])})
# a record that names its doctor only in the words (on purpose)
appt('chen-1209', '2026-10-19', 'Phone check-in', 'Appointment',
     {'date': day(D('2026-12-09')), 'how': ch('how', 'Phone')},
     [B('[[Dr. Chen]] will ring between 10 and 12.')])
# a block link from the journal to a past record
add('2026-10-18', B(f'Rereading the first appointment with the surgeon: [[{APPT["patel-0709"]}]]'))


# Ordinary days: a line on most days in between, with some days skipped as real journals have.
FILLER = ['Slept badly.', 'Slept well for once.', 'Walked to the shop and back.', 'Ruth\'s sister rang.', 'Did the crossword with Ruth.',
          'Rain all day. Stayed in with a book.', 'Weeded the front bed.', 'Lunch with Graham.', 'Felt more like myself today.',
          'Watched the cricket.', 'Tired after lunch, napped.', 'Wrote a card to Tunde.', 'Made soup for the week.', 'Quiet day.']
d = D('2026-06-22')
while d <= TODAY:
    if d not in J and random.random() < 0.75:
        add(d, B(random.choice(FILLER)))
    d += dt.timedelta(days=1)


# ---------- Write ----------
journal_entries = []
for d in sorted(J):
    journal_entries.append('{:page {:build/journal ' + f'{d:%Y%m%d}' + '} :blocks [' + ' '.join(J[d]) + ']}')

home = ('{:page {:block/title "Care overview"} :blocks ['
        + B('Upcoming appointments', '[:logseq.class/Query]', {':logseq.property/query': s('(tags Appointment)')}) + ' '
        + B('Open to-dos', '[:logseq.class/Query]', {':logseq.property/query': s('(task todo doing)')}) + ' '
        + B('Medicines I am taking: [[Oxaliplatin]], [[Fluorouracil (5-FU)]], [[Leucovorin]], [[Ondansetron]], [[Loperamide]], [[Omeprazole]]') + ']}')

out = [';; Seed data for the Illness Test Graph (a fictional patient, Daniel Okoro). Made by test/illness-test-graph.py; edit that, not this.',
       ';; Modelling rules: docs/MODELLING.md. Import into a graph made in the app; see GUIDE.md, "Graph ownership".',
       '{:properties', ' {' + '\n  '.join(f':user.property/{k} {v}' for k, v in P.items()) + '}',
       ' :classes', ' {' + '\n  '.join(f':user.class/{k} {v}' for k, v in C.items()) + '}',
       ' :pages-and-blocks', ' [' + '\n  '.join([p for _, p in PAGES] + [home] + journal_entries) + ']}']
OUT.write_text('\n'.join(out) + '\n')
print(f'{OUT.name}: {OUT.stat().st_size // 1024} KB, {len(PAGES)} pages, {len(J)} journal days, {len(APPT)} appointments')

# The same seed in three smaller parts, for an import that times out on the whole file (GUIDE.md, "Chunk EDN imports"):
# part 1 the tags, fields and pages; parts 2 and 3 the journals, which only point back at part 1 or within themselves.
# Each part declares the tags and fields again, as the importer requires; a second declaration changes nothing.
split = TODAY.replace(month=9, day=1)
early = [e for d, e in zip(sorted(J), journal_entries) if d < split]
late = [e for d, e in zip(sorted(J), journal_entries) if d >= split]
parts = [out[:4] + [' :classes', ' {' + '\n  '.join(f':user.class/{k} {v}' for k, v in C.items()) + '}',
                    ' :pages-and-blocks', ' [' + '\n  '.join([p for _, p in PAGES] + [home]) + ']}'],
         out[:6] + [' :pages-and-blocks', ' [' + '\n  '.join(early) + ']}'],
         out[:6] + [' :pages-and-blocks', ' [' + '\n  '.join(late) + ']}']]
for i, lines in enumerate(parts, 1):
    path = OUT.with_name(f'illness-test-graph-{i}.edn')
    path.write_text('\n'.join(lines) + '\n')
    print(f'{path.name}: {path.stat().st_size // 1024} KB')
