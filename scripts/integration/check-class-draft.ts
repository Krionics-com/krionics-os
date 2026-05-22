(async function(){
  const { sql } = (await import(new URL('../../packages/workers/src/db.js', import.meta.url).href));

  const rows = await sql`SELECT ri.id as reply_item_id, ri.status, rc.intent, rc.confidence, rd.subject, rd.body_text, rd.edited_body_text
    FROM reply_items ri
    LEFT JOIN reply_classifications rc ON rc.id = ri.classification_id
    LEFT JOIN reply_drafts rd ON rd.id = ri.draft_id
    JOIN leads l ON l.id = ri.lead_id
    WHERE l.email = 'reply-sender@example.com'
    ORDER BY ri.created_at DESC
    LIMIT 5`;

  console.log('Check results:', rows);
  process.exit(0);
})().catch(err=>{console.error(err); process.exit(1)});
