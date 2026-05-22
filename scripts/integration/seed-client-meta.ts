(async ()=>{
  const { sql } = (await import(new URL('../../packages/workers/src/db.js', import.meta.url).href));
  const [client] = await sql`SELECT id FROM clients WHERE slug = 'test-client' LIMIT 1`;
  if (!client) { console.error('no test-client found'); process.exit(1); }
  await sql`UPDATE clients SET service_description = ${'We help B2B teams grow'}, icp_description = ${'SaaS founders, 10-200 employees'} WHERE id = ${client.id}`;
  console.log('Updated client meta for', client.id);
  process.exit(0);
})().catch(err=>{console.error(err); process.exit(1)});
