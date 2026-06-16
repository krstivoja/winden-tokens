# Conversation Logs

This folder contains logs of important AI development sessions.

## Purpose

- **Help agents learn** from previous sessions
- **Document decisions** and why they were made  
- **Track changes** to documentation structure
- **Preserve context** across computer restarts

## Format

Each log file is named: `YYYY-MM-DD-topic-name.md`

## What to Log

✅ **Log these sessions:**
- Major architecture changes
- Documentation restructures
- New patterns or conventions
- Important decisions
- Agent team updates
- Workflow changes

❌ **Don't log these:**
- Minor bug fixes
- Small component additions
- Regular development work
- Routine updates

## Who Creates These

The **@testing-dev** agent should create conversation logs when:
- Documentation structure changes
- New conventions are established
- Agent configurations are updated
- Important architectural decisions are made

## How Agents Use This

1. Agents read CLAUDE.md (entry point)
2. Agents check relevant specs/ files
3. For context on past decisions, agents can read `.conversations/`
4. This helps maintain consistency across sessions

---

**These logs help preserve institutional knowledge and context.**
