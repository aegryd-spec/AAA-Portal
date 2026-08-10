import React from 'react';

const LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  clarification_requested: 'Clarification sought',
  dvv_review: 'DVV in progress',
  dvv_verified: 'DVV verified',
  peer_review: 'Peer review',
  finalized: 'Finalized',
};

export default function StatusStamp({ status }) {
  return <span className={`stamp ${status}`}>{LABELS[status] || status}</span>;
}
