-- =====================================================================
-- Seed data
-- Criteria/Key-Indicators/weightages are taken directly from
-- "Table 2: Distribution of weightages across Key Indicators" in the
-- uploaded University Manual. Metrics below are illustrative samples
-- (a few per KI) wired up with sample benchmark bands from the
-- Benchmarks document — extend via the Admin UI / a bulk importer for
-- the full metric set.
-- =====================================================================

-- ---------- CRITERIA ----------
INSERT INTO criteria (code, title, max_score, sort_order) VALUES
 ('1','Curricular Aspects',150,1),
 ('2','Teaching - Learning and Evaluation',200,2),
 ('3','Research, Innovations and Extension',250,3),
 ('4','Infrastructure and Learning Resources',100,4),
 ('5','Student Support and Progression',100,5),
 ('6','Governance, Leadership and Management',100,6),
 ('7','Institutional Values and Best Practices',100,7);

-- ---------- KEY INDICATORS ----------
INSERT INTO key_indicators (criterion_id, code, title, weightage, sort_order)
SELECT c.id, v.code, v.title, v.weightage, v.sort_order FROM criteria c
JOIN (VALUES
 ('1','1.1','Curriculum Design, Development, Planning and Implementation',50,1),
 ('1','1.2','Academic Flexibility',30,2),
 ('1','1.3','Curriculum Enrichment',50,3),
 ('1','1.4','Feedback System',20,4),

 ('2','2.1','Student Enrolment and Profile',10,1),
 ('2','2.2','Catering to Student Diversity',20,2),
 ('2','2.3','Teaching-Learning Process',20,3),
 ('2','2.4','Teacher Profile and Quality',60,4),
 ('2','2.5','Evaluation Process and Reforms',30,5),
 ('2','2.6','Student Performance and Learning Outcomes',30,6),
 ('2','2.7','Student Satisfaction Survey',30,7),

 ('3','3.1','Promotion of Research and Facilities',20,1),
 ('3','3.2','Resource Mobilization for Research',40,2),
 ('3','3.3','Innovation Ecosystem',20,3),
 ('3','3.4','Research Publications and Awards',120,4),
 ('3','3.5','Consultancy',20,5),
 ('3','3.6','Extension Activities',20,6),
 ('3','3.7','Collaboration',10,7),

 ('4','4.1','Physical Facilities',30,1),
 ('4','4.2','Library as a Learning Resource',20,2),
 ('4','4.3','IT Infrastructure',30,3),
 ('4','4.4','Maintenance of School/Campus Infrastructure',20,4),

 ('5','5.1','Student Support',30,1),
 ('5','5.2','Student Progression',45,2),
 ('5','5.3','Student Participation and Activities',15,3),
 ('5','5.4','Alumni Engagement',10,4),

 ('6','6.1','Institutional Vision and Leadership',15,1),
 ('6','6.2','Strategy Development and Deployment',10,2),
 ('6','6.3','Faculty Empowerment Strategies',25,3),
 ('6','6.4','Financial Management and Resource Mobilization',20,4),
 ('6','6.5','Internal Quality Assurance System',30,5),

 ('7','7.1','Institutional Values and Social Responsibilities',50,1),
 ('7','7.2','Best Practices',30,2),
 ('7','7.3','Institutional Distinctiveness',20,3)
) AS v(crit_code, code, title, weightage, sort_order) ON v.crit_code = c.code;

-- ---------- SAMPLE METRICS (illustrative — a couple per KI to prove the model) ----------
INSERT INTO metrics (key_indicator_id, code, title, metric_type, max_score, documents_required, instructions, not_to_be_included, sort_order)
SELECT ki.id, v.code, v.title, v.mtype, v.max_score, v.docs, v.instr, v.excl, v.sort_order
FROM key_indicators ki
JOIN (VALUES
 ('1.2','1.2.1','Percentage of new courses introduced out of the total number of courses across all programmes offered during the last five years','QnM',30,
   'Minutes of Board of Studies/Academic Council; List of new courses with year of introduction',
   'Include total number of courses across all programmes for all assessment years',
   'Do not count courses that were merely renamed without content change',1),
 ('1.3','1.3.1','Number of certificate/value-added courses/Diploma/online courses (MOOCS/SWAYAM/e-Pathshala/NPTEL etc.) where students enrolled and benefitted','QnM',30,
   'List of add-on/certificate courses with duration; Certificates/completion proof',
   'Provide year-wise list with enrolled and completed student counts',
   'Courses that are part of the core curriculum are excluded',2),
 ('2.4','2.4.1','Percentage of full time teachers against sanctioned posts','QnM',20,
   'Sanctioned strength letter; List of full-time teachers with appointment orders',
   'Consider sanctioned posts as approved by competent authority/regulatory body',
   NULL,1),
 ('3.4','3.4.1','Number of research papers published per teacher in UGC-CARE/Scopus/Web of Science/PubMed listed journals','QnM',120,
   'List of publications with journal name, ISSN, indexing proof; Reprint/first page of each paper',
   'Count only papers published during the last five years by teachers currently on roll',
   'Papers published in predatory/non-indexed journals are excluded',1),
 ('4.3','4.3.1','Availability of IT infrastructure and facilities (Wi-Fi, LAN, bandwidth, computer-student ratio)','QlM',30,
   'Purchase orders/invoices for IT equipment; Network diagram; ISP bandwidth subscription proof',
   'Describe available facilities with quantum/specifications',
   NULL,1),
 ('5.2','5.2.1','Percentage of placement / progression to higher education','QnM',45,
   'Placement offer letters; Higher-education admission proof (mark sheets/admission letters)',
   'Consider students who graduated during the last academic year',
   'Internship offers are not counted as placements',1),
 ('6.5','6.5.1','The IQAC has contributed significantly for institutionalizing quality assurance strategies and processes','QlM',30,
   'IQAC meeting minutes; Annual Quality Assurance Report (AQAR)',
   'Describe the structure, mechanisms and outcomes of IQAC',
   NULL,1),
 ('7.1','7.1.1','Number of Extension and Outreach programs conducted in collaboration with industry, community and NGOs','QnM',20,
   'Geo-tagged photographs; Attendance sheets; Report of the activity signed by competent authority',
   'Report activities conducted during the last five years',
   'Government-sponsored one-time mandatory activities without institutional initiative are excluded',1)
) AS v(ki_code, code, title, mtype, max_score, docs, instr, excl, sort_order) ON ki.code = v.ki_code;

-- Any metric that lists required documents in its SOP must have a document
-- uploaded before its submission can be advanced. Flag them accordingly.
UPDATE metrics SET requires_document = true
WHERE documents_required IS NOT NULL AND btrim(documents_required) <> '';

-- ---------- BENCHMARK BANDS for the first metric (sample, from Benchmarks doc) ----------
INSERT INTO metric_benchmarks (metric_id, band, description)
SELECT id, 4, '>=20%' FROM metrics WHERE code = '1.2.1'
UNION ALL SELECT id, 3, '15-20%' FROM metrics WHERE code = '1.2.1'
UNION ALL SELECT id, 2, '10-15%' FROM metrics WHERE code = '1.2.1'
UNION ALL SELECT id, 1, '5-10%'  FROM metrics WHERE code = '1.2.1'
UNION ALL SELECT id, 0, '<5%'    FROM metrics WHERE code = '1.2.1';

-- ---------- SCHOOLS / CAMPUSES ----------
INSERT INTO schools (code, name, type) VALUES
 ('SASET','School of Advanced Sciences, Engineering & Security Technology','School'),
 ('CCS','Centre for Cyber Security Studies','Centre'),
 ('SLE','School of Law & Ethics','School');

-- ---------- AUDIT CYCLE ----------
INSERT INTO audit_cycles (name, academic_year, status, start_date, end_date) VALUES
 ('AAA 2025-26','2025-26','open','2026-04-01','2027-03-31');

-- ---------- DEMO USERS (all passwords: Passw0rd!) ----------
INSERT INTO users (name, email, password_hash, role_code, school_id) VALUES
 ('Super Admin',   'admin@rru.ac.in',   '$2b$10$IVxwK3YOwzidETL/FeQeKuif88TVlPKAN25TpewWwstKUttqBi0di', 'super_admin', NULL),
 ('IQAC Cell',     'iqac@rru.ac.in',    '$2b$10$IVxwK3YOwzidETL/FeQeKuif88TVlPKAN25TpewWwstKUttqBi0di', 'iqac', NULL),
 ('Peer Reviewer', 'peer@rru.ac.in',    '$2b$10$IVxwK3YOwzidETL/FeQeKuif88TVlPKAN25TpewWwstKUttqBi0di', 'peer_team', NULL),
 ('Registrar',     'registrar@rru.ac.in','$2b$10$IVxwK3YOwzidETL/FeQeKuif88TVlPKAN25TpewWwstKUttqBi0di', 'viewer', NULL),
 ('SASET Coordinator','saset.coord@rru.ac.in','$2b$10$IVxwK3YOwzidETL/FeQeKuif88TVlPKAN25TpewWwstKUttqBi0di','school_coordinator',
   (SELECT id FROM schools WHERE code='SASET')),
 ('SASET Faculty', 'saset.faculty@rru.ac.in','$2b$10$IVxwK3YOwzidETL/FeQeKuif88TVlPKAN25TpewWwstKUttqBi0di','faculty',
   (SELECT id FROM schools WHERE code='SASET'));
