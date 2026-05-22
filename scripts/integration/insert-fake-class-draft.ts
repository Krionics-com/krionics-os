(async ()=>{
  const { sql } = (await import(new URL('../../packages/workers/src/db.js', import.meta.url).href));
  const [ri] = await sql`SELECT ri.id, ri.raw_reply_id, ri.client_id, ri.lead_id FROM reply_items ri JOIN leads l ON l.id = ri.lead_id WHERE l.email = 'reply-sender@example.com' ORDER BY ri.created_at DESC LIMIT 1`;
  if (!ri) { console.error('no reply_item'); process.exit(1); }


  const [classification] = await sql`
    INSERT INTO reply_classifications (
      reply_item_id, intent, confidence, sentiment, urgency, key_signals, objection_type, reasoning, requires_draft, requires_human, routing_decision, model_used, prompt_version, raw_model_output, classification_ms
    ) VALUES (
      ${ri.id}, 'POSITIVE', 0.95, 'POSITIVE', 'LOW', ${[]}, NULL, 'Positive intent detected', true, false, 'auto-route', 'mock', 'v1', ${ {} }, 0
    ) RETURNING id
  `;

  await sql`
    UPDATE reply_items SET classification_id = ${classification.id}, status = 'CLASSIFIED' WHERE id = ${ri.id}
  `;

  const [draft] = await sql`
    INSERT INTO reply_drafts (
      reply_item_id, classification_id, client_id, lead_id, version, subject, body_text, body_html, tone, cta_type, model_used, prompt_version, raw_model_output, generated_at, trace_id
    ) VALUES (
      ${ri.id}, ${classification.id}, ${ri.client_id}, ${ri.lead_id}, 1, 'Re: Your message', 'Thanks for reaching out. Are you available next week?', NULL, 'WARM', 'BOOK_CALL', 'mock', 'v1', ${ {} }, NOW(), gen_random_uuid()
    ) RETURNING id
  `;

  await sql`
    UPDATE reply_items SET draft_id = ${draft.id}, status = 'PENDING_REVIEW' WHERE id = ${ri.id}
  `;

  console.log('Inserted fake classification:', classification.id, 'and draft:', draft.id);
  process.exit(0);
})().catch(err=>{console.error(err); process.exit(1)});
