import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../AuthContext';
import StatusStamp from '../components/StatusStamp';

const CROSS_SCHOOL_ROLES = ['super_admin', 'iqac', 'peer_team', 'viewer'];

// Roles allowed to trigger each forward transition — mirrors backend TRANSITIONS.
const NEXT_STEPS = {
  draft: [{ to: 'submitted', label: 'Submit for DVV', roles: ['school_coordinator', 'faculty', 'super_admin'], cls: 'seal' }],
  submitted: [
    { to: 'dvv_review', label: 'Begin DVV review', roles: ['iqac', 'super_admin'], cls: 'secondary' },
    { to: 'clarification_requested', label: 'Request clarification', roles: ['iqac', 'super_admin'], cls: 'alert' },
  ],
  clarification_requested: [{ to: 'submitted', label: 'Resubmit', roles: ['school_coordinator', 'faculty', 'super_admin'], cls: 'seal' }],
  dvv_review: [
    { to: 'dvv_verified', label: 'Mark DVV verified', roles: ['iqac', 'super_admin'], cls: 'verify' },
    { to: 'clarification_requested', label: 'Request clarification', roles: ['iqac', 'super_admin'], cls: 'alert' },
  ],
  dvv_verified: [{ to: 'peer_review', label: 'Send to Peer Team', roles: ['iqac', 'super_admin'], cls: 'secondary' }],
  peer_review: [{ to: 'finalized', label: 'Finalize score', roles: ['peer_team', 'iqac', 'super_admin'], cls: 'verify' }],
};

export default function Criteria() {
  const { user } = useAuth();
  const [tree, setTree] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [cycleId, setCycleId] = useState('');
  const [schools, setSchools] = useState([]);
  const [schoolId, setSchoolId] = useState(user.school_id || '');
  const [submissionsByMetric, setSubmissionsByMetric] = useState({});
  const [openMetricId, setOpenMetricId] = useState(null);

  useEffect(() => {
    api.criteriaTree().then(setTree);
    api.auditCycles().then((rows) => { setCycles(rows); if (rows[0]) setCycleId(rows[0].id); });
    if (CROSS_SCHOOL_ROLES.includes(user.role)) {
      api.schools().then((rows) => { setSchools(rows); if (rows[0] && !schoolId) setSchoolId(rows[0].id); });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshSubmissions() {
    if (!cycleId || !schoolId) return;
    const rows = await api.submissions({ audit_cycle_id: cycleId, school_id: schoolId });
    const map = {};
    rows.forEach((r) => { map[r.metric_id] = r; });
    setSubmissionsByMetric(map);
  }

  useEffect(() => { refreshSubmissions(); }, [cycleId, schoolId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Who may enter data / attach evidence: school roles on their own school,
  // plus super_admin and IQAC acting on behalf (they pick the school above).
  const canEditAsSchool = ['school_coordinator', 'faculty', 'super_admin', 'iqac'].includes(user.role);

  return (
    <div>
      <div className="page-kicker">Assessment Framework</div>
      <h1 className="page-title">Criteria &amp; Metrics</h1>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        {cycles.length > 0 && (
          <div>
            <label>Audit cycle</label>
            <select value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
              {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        {CROSS_SCHOOL_ROLES.includes(user.role) && schools.length > 0 && (
          <div>
            <label>School / Campus</label>
            <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {tree.map((criterion) => (
        <div className="card" key={criterion.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <strong style={{ fontFamily: 'var(--serif)', fontSize: 17 }}>
              {criterion.code}. {criterion.title}
            </strong>
            <span className="muted">Max {criterion.max_score}</span>
          </div>
          {criterion.key_indicators.map((ki) => (
            <div key={ki.id} style={{ marginTop: 14 }}>
              <div className="muted" style={{ fontWeight: 600, marginBottom: 4 }}>
                {ki.code} — {ki.title} <span style={{ fontFamily: 'var(--mono)' }}>(wt. {ki.weightage})</span>
              </div>
              {ki.metrics.length === 0 && <div className="muted" style={{ paddingLeft: 12 }}>No metrics seeded yet.</div>}
              {ki.metrics.map((m) => {
                const sub = submissionsByMetric[m.id];
                const isOpen = openMetricId === m.id;
                return (
                  <div key={m.id}>
                    <div className="ledger-row" style={{ cursor: 'pointer' }} onClick={() => setOpenMetricId(isOpen ? null : m.id)}>
                      <span className="ledger-code">{m.code}</span>
                      <span className="ledger-title">
                        {m.title} <span className="muted">[{m.metric_type}]</span>
                        {m.requires_document && (
                          <span className="doc-required" title="A supporting document must be uploaded before this can be submitted">
                            ⎘ document required
                          </span>
                        )}
                      </span>
                      {sub ? <StatusStamp status={sub.status} /> : <span className="muted">not started</span>}
                    </div>
                    {isOpen && (
                      <MetricPanel
                        metric={m}
                        submission={sub}
                        cycleId={cycleId}
                        schoolId={schoolId}
                        canEditAsSchool={canEditAsSchool}
                        user={user}
                        onChanged={refreshSubmissions}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function MetricPanel({ metric, submission, cycleId, schoolId, canEditAsSchool, user, onChanged }) {
  const [responseText, setResponseText] = useState(submission?.response_text || '');
  const [selfScore, setSelfScore] = useState(submission?.self_score ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [evidence, setEvidence] = useState([]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  const isEditable = !submission || ['draft', 'clarification_requested'].includes(submission.status);
  const editableNow = canEditAsSchool && isEditable;

  useEffect(() => {
    setResponseText(submission?.response_text || '');
    setSelfScore(submission?.self_score ?? '');
    if (submission) {
      api.evidenceList(submission.id).then(setEvidence);
      api.comments(submission.id).then(setComments);
    } else {
      setEvidence([]);
      setComments([]);
    }
  }, [submission?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setSaving(true); setError('');
    try {
      await api.upsertSubmission({
        audit_cycle_id: cycleId,
        metric_id: metric.id,
        school_id: schoolId,
        response_text: responseText,
        self_score: selfScore === '' ? null : Number(selfScore),
      });
      await onChanged();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  async function doTransition(to) {
    if (!submission) return;
    setSaving(true); setError('');
    try {
      await api.transition(submission.id, to);
      await onChanged();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  // Ensure a draft submission exists (create on demand), returning its row.
  async function ensureSubmission() {
    if (submission) return submission;
    const created = await api.upsertSubmission({
      audit_cycle_id: cycleId,
      metric_id: metric.id,
      school_id: schoolId,
      response_text: responseText,
      self_score: selfScore === '' ? null : Number(selfScore),
    });
    await onChanged();
    return created;
  }

  async function upload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setSaving(true); setError('');
    try {
      const sub = await ensureSubmission();
      await api.uploadEvidence(sub.id, file);
      setEvidence(await api.evidenceList(sub.id));
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSaving(false);
      e.target.value = ''; // allow re-selecting the same file name
    }
  }

  async function download(evidenceId) {
    const { url } = await api.evidenceDownload(evidenceId);
    window.open(url, '_blank');
  }

  async function postComment() {
    if (!newComment.trim() || !submission) return;
    await api.addComment(submission.id, newComment.trim());
    setNewComment('');
    setComments(await api.comments(submission.id));
  }

  const nextSteps = submission ? (NEXT_STEPS[submission.status] || []).filter((s) => s.roles.includes(user.role)) : [];

  // A "submit" step is blocked while a required document is still missing.
  const docMissing = metric.requires_document && evidence.length === 0;

  // ---- Task / document request ("new thread from the criteria") ----
  const canAssign = ['super_admin', 'iqac', 'school_coordinator'].includes(user.role);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignees, setAssignees] = useState([]);
  const [taskForm, setTaskForm] = useState({ assigned_to: '', task_type: 'document_request', title: '', description: '', due_date: '' });
  const [taskMsg, setTaskMsg] = useState('');

  async function openAssign() {
    setAssignOpen(!assignOpen);
    if (!assignOpen && assignees.length === 0) {
      try { setAssignees(await api.assignableUsers()); } catch { /* ignore */ }
    }
  }

  async function submitTask() {
    if (!taskForm.assigned_to || !taskForm.title) { setTaskMsg('Pick an assignee and enter a title.'); return; }
    setSaving(true); setTaskMsg('');
    try {
      await api.createTask({
        ...taskForm,
        metric_id: metric.id,
        submission_id: submission?.id || null,
        school_id: schoolId || null,
        audit_cycle_id: cycleId || null,
      });
      setTaskMsg('Task assigned and the user has been notified.');
      setTaskForm({ assigned_to: '', task_type: 'document_request', title: '', description: '', due_date: '' });
      setTimeout(() => { setAssignOpen(false); setTaskMsg(''); }, 1200);
    } catch (e) { setTaskMsg(e.message); } finally { setSaving(false); }
  }

  return (
    <div style={{ padding: '14px 12px 18px', background: '#fff', border: '1px solid var(--line)', borderRadius: 3, marginBottom: 10 }}>
      {error && <div className="error-banner">{error}</div>}

      <div className="grid-2">
        <div>
          <div className="muted" style={{ marginBottom: 8 }}>
            <strong>Documents required (SOP):</strong> {metric.documents_required || '—'}
            {metric.requires_document && <span className="doc-required" style={{ marginLeft: 6 }}>mandatory</span>}
          </div>
          <div className="muted" style={{ marginBottom: 8 }}><strong>Instructions:</strong> {metric.instructions || '—'}</div>
          {metric.not_to_be_included && <div className="muted" style={{ marginBottom: 8 }}><strong>Not to be included:</strong> {metric.not_to_be_included}</div>}
        </div>
        <div>
          {metric.benchmarks?.length > 0 && (
            <>
              <div className="muted" style={{ marginBottom: 6 }}><strong>Scoring bands</strong></div>
              {metric.benchmarks.map((b) => (
                <div key={b.band} className="muted" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                  Band {b.band}: {b.description}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <hr className="divider" />

      <label>Response / data (max score {metric.max_score})</label>
      <textarea value={responseText} onChange={(e) => setResponseText(e.target.value)} disabled={!editableNow}
        placeholder={metric.metric_type === 'QnM' ? 'Enter figures + calculation method…' : 'Enter narrative response…'} />

      <label>Self-assessed score / band</label>
      <input type="number" step="0.5" value={selfScore} onChange={(e) => setSelfScore(e.target.value)} disabled={!editableNow} style={{ maxWidth: 160 }} />

      {editableNow && (
        <button className="btn secondary" onClick={save} disabled={saving} style={{ marginRight: 10 }}>
          {saving ? 'Saving…' : 'Save draft'}
        </button>
      )}

      {nextSteps.map((s) => {
        const blocked = s.to === 'submitted' && docMissing;
        return (
          <button key={s.to} className={`btn ${s.cls}`} onClick={() => doTransition(s.to)}
            disabled={saving || blocked}
            title={blocked ? 'Upload a supporting document before submitting' : undefined}
            style={{ marginRight: 10 }}>
            {s.label}
          </button>
        );
      })}

      {docMissing && nextSteps.some((s) => s.to === 'submitted') && (
        <div className="doc-required-note">
          ⎘ This metric requires a supporting document. Upload at least one file below before submitting.
        </div>
      )}

      {(submission || editableNow) && (
        <>
          <hr className="divider" />
          <strong style={{ fontSize: 13 }}>Evidence</strong>
          {metric.requires_document && <span className="doc-required" style={{ marginLeft: 8 }}>mandatory</span>}
          <div style={{ marginTop: 8 }}>
            {evidence.map((ev) => (
              <div className="evidence-row" key={ev.id}>
                <span>⎘ {ev.file_name}</span>
                <button className="btn secondary" onClick={() => download(ev.id)} style={{ padding: '3px 10px', fontSize: 11 }}>Download</button>
              </div>
            ))}
            {evidence.length === 0 && <div className="muted">No document uploaded yet.</div>}
          </div>

          {editableNow && (
            <div style={{ marginTop: 12 }}>
              <label className="upload-btn">
                {saving ? 'Uploading…' : '⇪ Upload document'}
                <input type="file" onChange={upload} disabled={saving}
                  style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }} />
              </label>
              {!submission && (
                <span className="muted" style={{ marginLeft: 12 }}>
                  Uploading a file will start a draft for this metric.
                </span>
              )}
              <div className="muted" style={{ marginTop: 6, fontSize: 11.5 }}>
                PDF, images or Office files up to 25 MB. You can upload more than one.
              </div>
            </div>
          )}
        </>
      )}

      {submission && (
        <>
          <hr className="divider" />
          <strong style={{ fontSize: 13 }}>Review thread</strong>
          {comments.map((c) => (
            <div className="comment" key={c.id}>
              <div className="meta">{c.author_name} · {c.role_code}</div>
              {c.comment}
            </div>
          ))}
          <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Add a clarification / review note…" style={{ marginTop: 10 }} />
          <button className="btn secondary" onClick={postComment}>Post note</button>
        </>
      )}

      {canAssign && (
        <>
          <hr className="divider" />
          <button className="btn seal" onClick={openAssign}>
            {assignOpen ? 'Close' : '✦ Assign task / request document'}
          </button>
          {assignOpen && (
            <div className="assign-box">
              {taskMsg && <div className="assign-msg">{taskMsg}</div>}
              <div className="grid-2">
                <div>
                  <label>Assign to</label>
                  <select value={taskForm.assigned_to} onChange={(e) => setTaskForm({ ...taskForm, assigned_to: e.target.value })}>
                    <option value="">Select user…</option>
                    {assignees.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} — {u.role_code}{u.school_name ? ` · ${u.school_name}` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Request type</label>
                  <select value={taskForm.task_type} onChange={(e) => setTaskForm({ ...taskForm, task_type: e.target.value })}>
                    <option value="document_request">Document requested</option>
                    <option value="clarification">Clarification</option>
                    <option value="update">Update</option>
                    <option value="general">General task</option>
                  </select>
                </div>
              </div>
              <label>Title</label>
              <input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                placeholder={`e.g. Upload BoS minutes for metric ${metric.code}`} />
              <label>Details (optional)</label>
              <textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                placeholder="What exactly is needed…" />
              <label>Due date (optional)</label>
              <input type="date" value={taskForm.due_date} onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })} style={{ maxWidth: 200 }} />
              <div>
                <button className="btn seal" onClick={submitTask} disabled={saving}>Assign &amp; notify</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
