# Documentation Rebuild - 2026-03-23

## What We Did

Completely rebuilt the documentation structure from scratch.

### Before
- CLAUDE.md: 300+ lines with everything mixed together
- specs/: 10+ files with outdated/inconsistent info
- No clear structure

### After
- **CLAUDE.md**: Ultra-simple entry point (~55 lines)
  - Points to specs/ folder
  - Explains agent teams
  - That's it!

- **specs/**: 7 focused files
  1. `devnotes.md` - Critical rules + dev commands + workflow
  2. `structure.md` - File organization
  3. `styles.md` - Tailwind CSS v4 and @theme
  4. `components.md` - Complete component inventory
  5. `functions.md` - Plugin features and logic
  6. `techstack.md` - Technologies and standards
  7. `testing.md` - Testing patterns

### Agent Updates

Updated agent configurations to work with new spec structure:

- **@testing-dev**: Maintains all 7 spec files automatically
- **@orchestrator**: Enforces spec updates for all changes
- Both reference new file names (not old ARCHITECTURE.md, etc.)

### Key Decisions

1. **CLAUDE.md is just a reference** - All details in specs/
2. **Critical rules in devnotes.md** - Where developers look first
3. **7 focused spec files** - Each has clear purpose
4. **Agent auto-maintenance** - @testing-dev keeps specs in sync
5. **Old files backed up** - In specs/.old-backup/

### Critical Rules (in devnotes.md)

1. **DRY**: If repeated > 2 times, extract component
2. **Tailwind only**: No custom CSS files
3. **Check components first**: Review components.md before creating
4. **Auto-docs**: @testing-dev maintains specs automatically

### File Locations

```
CLAUDE.md                          # Entry point
specs/
  devnotes.md                      # Critical rules + dev workflow
  structure.md                     # File organization
  styles.md                        # Tailwind CSS v4
  components.md                    # Component inventory
  functions.md                     # Plugin features
  techstack.md                     # Technologies
  testing.md                       # Testing patterns
  .conversations/                  # Session logs (this folder)
  .old-backup/                     # Old spec files
.claude/
  agents/
    orchestrator.md                # Updated for new specs
    components-dev.md
    functionality-dev.md
    testing-dev.md               # Updated to maintain 7 spec files
```

### What Changed in Agents

**testing-dev.md:**
- Now maintains 7 specific files (not ARCHITECTURE.md, etc.)
- Updates specs/components.md for new components
- Checks all 7 specs for relevance when things change

**orchestrator.md:**
- References new spec file names
- Enforces updates to correct files
- Example workflow uses specs/components.md

### User Preferences

- Keep CLAUDE.md minimal - just point to specs/
- Critical rules belong in devnotes.md
- All details in specs/
- Agent teams handle documentation maintenance

### Next Steps

None - everything is complete and ready to use!

The agents will:
1. Read CLAUDE.md on every session
2. Check relevant specs/ files as needed
3. Automatically maintain specs/ after changes
4. Follow the critical rules in devnotes.md

---

**This session log helps future agents understand the documentation structure and decisions made.**
