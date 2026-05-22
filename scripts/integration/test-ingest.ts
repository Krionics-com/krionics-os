(async function main() {
  const { sql } = (await import(new URL('../../packages/workers/src/db.js', import.meta.url).href));
  const { ingestQueue } = (await import(new URL('../../packages/workers/src/queues.js', import.meta.url).href));

  console.log('Seeding test client/campaign/lead...');

  // find or create client
  const existingClient = await sql`SELECT id FROM clients WHERE slug = 'test-client' LIMIT 1`;
  let client = existingClient[0];
  if (!client) {
    const [newClient] = await sql`INSERT INTO clients (slug, company_name, contact_email, contact_name) VALUES ('test-client', 'Test Client Inc', 'ops@testclient.local', 'Test Ops') RETURNING id`;
    client = newClient;
  }

  // find or create campaign
  const existingCampaign = await sql`SELECT id FROM campaigns WHERE instantly_campaign_id = 'test-campaign-1' LIMIT 1`;
  let campaign = existingCampaign[0];
  if (!campaign) {
    const [newCampaign] = await sql`INSERT INTO campaigns (client_id, name, instantly_campaign_id) VALUES (${client.id}, 'Test Campaign', 'test-campaign-1') RETURNING id`;
    campaign = newCampaign;
  }

  // find or create lead
  const existingLead = await sql`SELECT id FROM leads WHERE campaign_id = ${campaign.id} AND email = 'reply-sender@example.com' LIMIT 1`;
  let lead = existingLead[0];
  if (!lead) {
    const [newLead] = await sql`INSERT INTO leads (client_id, campaign_id, email, first_name, last_name) VALUES (${client.id}, ${campaign.id}, 'reply-sender@example.com', 'Reply', 'Sender') RETURNING id`;
    lead = newLead;
  }

  console.log('Inserted client:', client.id);
  console.log('Inserted campaign:', campaign.id);
  console.log('Inserted lead:', lead.id);

  const payload = {
    reply_id: `test-reply-${Date.now()}`,
    email_id: `email-${Date.now()}`,
    campaign_id: 'test-campaign-1',
    from_email: 'reply-sender@example.com',
    from_name: 'Reply Sender',
    to_email: 'outbound@example.com',
    subject: 'Re: Test Campaign',
    body_text: 'Thanks for reaching out, I am interested.',
    received_at: new Date().toISOString()
  };

  console.log('Enqueuing ingest job...');
  await ingestQueue.add('test_ingest', payload);
  console.log('Job enqueued. Waiting 4s for workers to process...');

  await new Promise((r) => setTimeout(r, 4000));

  const replies = await sql`SELECT ri.id, ri.status, rr.body_text FROM reply_items ri JOIN raw_replies rr ON rr.id = ri.raw_reply_id WHERE ri.lead_id = ${lead.id} ORDER BY ri.created_at DESC LIMIT 5`;

  console.log('Found reply_items:', replies);

    process.exit(0);
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
