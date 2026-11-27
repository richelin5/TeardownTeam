#!/usr/bin/env python3
"""Validate the Company Teardown agent team.

Checks every .claude/agents/*.md and .claude/skills/*/SKILL.md for:
  - frontmatter on the first line that parses as YAML
  - required fields (agents: name, description) and only known field names
  - valid model / color / memory / effort values
  - preloaded skills exist and are not disable-model-invocation
  - each agent has a seeded knowledge folder (.claude/agent-memory/<name>/MEMORY.md)
  - every agent (except the orchestrator) is in the orchestrator's Agent(...) allowlist
  - every agent is listed in CLAUDE.md
Exit code 1 on any error.  Usage: python3 .claude/scripts/validate_team.py
"""
import re, sys, pathlib

try:
    import yaml
except ImportError:
    sys.exit("PyYAML missing: pip install pyyaml")

ROOT = pathlib.Path(__file__).resolve().parents[2]
AGENT_FIELDS = {"name", "description", "tools", "disallowedTools", "model", "permissionMode", "maxTurns",
                "autoCompactWindow", "skills", "mcpServers", "hooks", "memory", "background", "omitClaudeMd",
                "effort", "isolation", "color", "initialPrompt", "experimental"}
SKILL_FIELDS = {"name", "description", "when_to_use", "argument-hint", "arguments", "disable-model-invocation",
                "user-invocable", "allowed-tools", "disallowed-tools", "model", "effort", "context", "agent",
                "background", "hooks", "paths", "shell", "metadata", "license", "compatibility"}
MODELS = {"sonnet", "opus", "haiku", "fable", "inherit"}
COLORS = {"red", "blue", "green", "yellow", "purple", "orange", "pink", "cyan"}
EFFORTS = {"low", "medium", "high", "xhigh", "max"}
errors = []

def front(path):
    text = path.read_text()
    if not text.startswith("---\n"):
        errors.append(f"{path}: frontmatter must start on line 1"); return None
    end = text.find("\n---", 4)
    try:
        return yaml.safe_load(text[4:end]) or {}
    except yaml.YAMLError as e:
        errors.append(f"{path}: YAML error {e}"); return None

skills = {}
for p in sorted((ROOT / ".claude/skills").glob("*/SKILL.md")):
    fm = front(p)
    if fm is None: continue
    for k in fm:
        if k not in SKILL_FIELDS: errors.append(f"{p}: unknown skill field '{k}'")
    if not fm.get("description"): errors.append(f"{p}: missing description")
    skills[fm.get("name", p.parent.name)] = fm

agents = {}
for p in sorted((ROOT / ".claude/agents").glob("*.md")):
    fm = front(p)
    if fm is None: continue
    name = fm.get("name")
    if not name or not fm.get("description"):
        errors.append(f"{p}: name and description are required"); continue
    for k in fm:
        if k not in AGENT_FIELDS: errors.append(f"{p}: unknown agent field '{k}'")
    if fm.get("model") and fm["model"] not in MODELS and not str(fm["model"]).startswith("claude-"):
        errors.append(f"{p}: bad model {fm['model']}")
    if fm.get("color") and fm["color"] not in COLORS: errors.append(f"{p}: bad color {fm['color']}")
    if fm.get("effort") and fm["effort"] not in EFFORTS: errors.append(f"{p}: bad effort {fm['effort']}")
    if fm.get("memory") != "project": errors.append(f"{p}: team policy requires memory: project")
    for s in fm.get("skills") or []:
        if s not in skills: errors.append(f"{p}: preloads unknown skill '{s}'")
        elif str(skills[s].get("disable-model-invocation", "")).lower() in {"true", "yes", "on", "1"}:
            errors.append(f"{p}: cannot preload disable-model-invocation skill '{s}'")
    mem = ROOT / ".claude/agent-memory" / name / "MEMORY.md"
    if not mem.exists(): errors.append(f"{p}: knowledge folder missing ({mem.relative_to(ROOT)})")
    agents[name] = fm

orch = agents.get("orchestrator")
if not orch:
    errors.append("orchestrator agent missing")
else:
    m = re.search(r"Agent\(([^)]*)\)", str(orch.get("tools", "")))
    allowed = {a.strip() for a in m.group(1).split(",")} if m else set()
    for a in agents:
        if a != "orchestrator" and a not in allowed:
            errors.append(f"orchestrator allowlist is missing '{a}'")
    for a in allowed - set(agents):
        errors.append(f"orchestrator allowlist names unknown agent '{a}'")

claude_md = (ROOT / "CLAUDE.md").read_text() if (ROOT / "CLAUDE.md").exists() else ""
for a in agents:
    if f"`{a}`" not in claude_md: errors.append(f"CLAUDE.md roster is missing `{a}`")

print(f"agents: {len(agents)}  skills: {len(skills)}")
if errors:
    print("\n".join("ERROR " + e for e in errors)); sys.exit(1)
print("OK: team definition is valid")
