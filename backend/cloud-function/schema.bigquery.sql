-- Agent activity analytics — BigQuery schema
--
-- Provision the dataset + table that backend/cloud-function/activity.js writes to
-- and queries. Adjust the dataset location to match your GCP region.
--
-- Run with:
--   bq --location=US mk --dataset "${GOOGLE_CLOUD_PROJECT}:agent_activity"
--   bq query --use_legacy_sql=false < backend/cloud-function/schema.bigquery.sql
--
-- Or paste into the BigQuery console. Env overrides: BQ_DATASET / BQ_TABLE.

CREATE TABLE IF NOT EXISTS `agent_activity.events`
(
  event_ts       TIMESTAMP   NOT NULL,   -- when the event occurred (client clock)
  agent_id       STRING      NOT NULL,   -- agent identifier
  agent_name     STRING,                 -- display name (nullable)
  session_id     STRING,                 -- per-load/shift id from the emitter
  interaction_id STRING      NOT NULL,   -- Webex CC interaction id (swim-lane key)
  channel        STRING,                 -- email | chat | voice | sms | telephony | workitem
  event_type     STRING      NOT NULL,   -- task_offered|task_accepted|focus_gained|
                                         -- focus_lost|wrapup|task_ended|rona|declined
  customer_id    STRING,                 -- resolved customer identity (nullable)
  queue          STRING,                 -- queue name (nullable)
  org_id         STRING,                 -- Webex org id (nullable)
  ingest_ts      TIMESTAMP   NOT NULL    -- server receive time
)
PARTITION BY DATE(event_ts)
CLUSTER BY agent_id, interaction_id;
