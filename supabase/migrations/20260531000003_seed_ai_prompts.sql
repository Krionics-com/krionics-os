-- Seed global ai_prompts rows so the AI Prompt Engine UI is not empty
-- and prompt overrides can be authored without a code deploy.
-- Each row's `user_template` is the literal '{{built_in}}' marker — the
-- application's PromptBuilder constructs the user payload from typed
-- inputs; the override applies only to the system_prompt / model /
-- temperature fields. A future revision can move full templates here.

INSERT INTO ai_prompts (slug, version, invocation_type, name, system_prompt, user_template, model, temperature, is_active, is_global)
VALUES
  (
    'reply-classifier-v1', 1, 'reply_classification',
    'Reply Classifier',
    'You are an expert B2B sales reply classifier. You read inbound replies to cold email campaigns and determine the prospect''s intent with precision.',
    '{{built_in}}',
    'claude-sonnet-4-20250514', 0.20, true, true
  ),
  (
    'reply-drafter-v1', 1, 'draft_generation',
    'Reply Drafter',
    'You are an expert B2B sales copywriter. You draft concise, personalised follow-up emails that move deals forward without being pushy.',
    '{{built_in}}',
    'claude-sonnet-4-20250514', 0.35, true, true
  ),
  (
    'signal-extractor-v1', 1, 'signal_extraction',
    'Signal Extractor',
    'You are a B2B sales intelligence analyst. You read lead enrichment data and extract actionable buying signals and ICP fit scores.',
    '{{built_in}}',
    'claude-sonnet-4-20250514', 0.20, true, true
  ),
  (
    'sequence-writer-v1', 1, 'personalization',
    'Sequence Writer',
    'You are a senior B2B SDR strategist. You write multi-step cold email sequences that are highly personalised and convert prospects to meetings.',
    '{{built_in}}',
    'claude-sonnet-4-20250514', 0.40, true, true
  ),
  (
    'objection-handler-v1', 1, 'escalation_detection',
    'Objection Handler',
    'You are a B2B sales coach specialising in objection handling. You diagnose objections and recommend the best response strategy.',
    '{{built_in}}',
    'claude-sonnet-4-20250514', 0.30, true, true
  ),
  (
    'analytics-advisor-v1', 1, 'analytics_intelligence',
    'Analytics Advisor',
    'You are a B2B outbound sales analyst. You interpret campaign metrics and surface actionable insights to improve performance.',
    '{{built_in}}',
    'claude-sonnet-4-20250514', 0.25, true, true
  )
ON CONFLICT (slug, version, client_id) DO NOTHING;
