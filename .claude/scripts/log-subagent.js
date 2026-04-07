#!/usr/bin/env node
// SubagentStop hook: logs all subagent completions to .claude/logs/subagent-history.jsonl
// Claude Code passes event info via stdin as JSON

const chunks = [];
process.stdin.on('data', (d) => chunks.push(d));
process.stdin.on('end', () => {
  const raw = Buffer.concat(chunks).toString().trim();
  let parsed = {};
  try { parsed = JSON.parse(raw); } catch {}

  // Claude Code may pass agent info under various keys — try all
  const agentId =
    parsed.agent_name ||
    parsed.agent_id ||
    parsed.subagent_type ||
    parsed.name ||
    process.env.AGENT_ID ||
    'unknown';

  const entry = {
    event: 'subagent_stop',
    timestamp: new Date().toISOString(),
    agent_id: agentId,
    transcript_path: parsed.transcript_path || process.env.AGENT_TRANSCRIPT_PATH || '',
    // raw_keys helps debug what Claude Code actually sends
    raw_keys: Object.keys(parsed),
  };

  const fs = require('fs');
  const path = require('path');
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const logFile = path.join(projectDir, '.claude/logs/subagent-history.jsonl');

  try {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
  } catch {}

  // Hook must exit 0 (no blocking)
  process.exit(0);
});
