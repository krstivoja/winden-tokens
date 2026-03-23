# CLAUDE.md

**AI Development Guide for Winden Tokens Figma Plugin**

---

## 📚 Read the `specs/` Folder

**All technical documentation is in [specs/](specs/):**

1. **[devnotes.md](specs/devnotes.md)** - Development commands and workflow
2. **[structure.md](specs/structure.md)** - File organization
3. **[styles.md](specs/styles.md)** - Tailwind CSS v4 styling
4. **[components.md](specs/components.md)** - Component inventory
5. **[functions.md](specs/functions.md)** - Plugin features
6. **[techstack.md](specs/techstack.md)** - Technologies used
7. **[testing.md](specs/testing.md)** - Testing approach

**Start here:** [specs/devnotes.md](specs/devnotes.md)

---

## 🤖 Use Agent Teams

This project uses **Claude Code Agent Teams** for coordinated development.

### Team

- **@orchestrator** - Coordinates all agents
- **@components-dev** - Creates React components
- **@functionality-dev** - Implements business logic
- **@testing-dev** - Tests code and maintains docs

### How It Works

**Just make your request.** The orchestrator will:
1. Analyze and break down your request
2. Delegate to specialized agents
3. Coordinate their work
4. Update documentation automatically
5. Deliver tested results

**Example:**
```
You: "Add a Badge component"
→ Orchestrator delegates to agents
→ Component created, tested, documented
→ Done!
```

**Agent configs:** [.claude/agents/](.claude/agents/)

---

**That's it! Read [specs/](specs/) for everything else.**
