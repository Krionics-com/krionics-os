(async () => {
  const { sql } = (await import(new URL('../../packages/workers/src/db.js', import.meta.url).href));
  const { createAIProvider } = await import('../../packages/ai-provider/src/factory.js');

  // find latest reply_item for test lead
  const [ri] = await sql`SELECT ri.id, ri.raw_reply_id, ri.client_id FROM reply_items ri JOIN leads l ON l.id = ri.lead_id WHERE l.email = 'reply-sender@example.com' ORDER BY ri.created_at DESC LIMIT 1`;
  if (!ri) {
    console.error('No reply_item found');
    process.exit(1);
  }

  const [raw] = await sql`SELECT id, body_text, from_email, subject, raw_payload FROM raw_replies WHERE id = ${ri.raw_reply_id}`;
  if (!raw) { console.error('No raw_reply'); process.exit(1); }

  const [client] = await sql`SELECT company_name, service_description, icp_description FROM clients WHERE id = ${ri.client_id}`;
  if (!client) { console.error('No client'); process.exit(1); }

  const provider = createAIProvider();

  console.log('Calling provider.classify...');
  const out = await provider.classify({
    reply_body: raw.body_text,
    original_body: raw.body_text,
    original_subject: raw.subject ?? null,
    from_email: raw.from_email,
    client_context: {
      company_name: client.company_name,
      service_description: client.service_description ?? '',
      icp_description: client.icp_description ?? ''
    }
  });

  console.log('Provider output:', out);

  const [classification] = await sql`INSERT INTO reply_classifications (reply_item_id, intent, confidence, sentiment, urgency, key_signals, objection_type, faq_topic, reasoning, requires_draft, requires_human, routing_decision, model_used, prompt_version, raw_model_output, classification_ms) VALUES (${ri.id}, ${out.intent}, ${out.confidence}, ${out.sentiment_score}, ${out.urgency_score}, ${out.buying_signals}, ${out.objection_type}, NULL, ${out.reasoning}, TRUE, FALSE, 'manual', ${process.env.OPENAI_MODEL}, 'test', ${JSON.stringify(out)}, 0) RETURNING id`;

  await sql`UPDATE reply_items SET status = 'CLASSIFIED', classification_id = ${classification.id} WHERE id = ${ri.id}`;

  console.log('Inserted classification id:', classification.id);
  process.exit(0);
})().catch(err=>{console.error(err); process.exit(1)});
