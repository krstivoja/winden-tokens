# Agent Teams Setup for Development Workflow

**Date:** 2024-12-23
**Status:** Accepted
**Decided by:** Orchestrator + Project Team

---

## Context

The project needed a structured development workflow to maintain code quality and ensure proper separation of concerns. We needed:

- Consistent component architecture following DRY principles
- Clear separation between UI components, business logic, and tests
- Systematic decision documentation for future reference
- Coordinated workflow between different development concerns

---

## Decision

We decided to implement Claude Code's experimental Agent Teams feature with a 4-agent structure:

1. **Orchestrator Agent** - Main coordinator and decision maker
2. **React Components Developer** - Specialized in reusable component creation
3. **Functionality Developer** - Handles business logic and integrations
4. **Testing Specialist** - Ensures comprehensive test coverage

**Sequential Workflow:** Components → Functionality → Tests → Review

**Documentation Requirement:** All major decisions documented in `docs/decisions/`

---

## Consequences

**Positive:**
- Clear separation of concerns between component creation, logic, and testing
- Enforced DRY principles through dedicated component specialist
- Systematic decision documentation for future maintainability
- Better test coverage through dedicated testing specialist
- Coordinated workflow reduces integration issues

**Trade-offs:**
- Requires restart of Claude Code to activate experimental feature
- Slightly more complex communication protocol between agents
- Need to maintain agent configuration files

**Risks:**
- **Experimental feature may change** - Mitigation: Document current setup thoroughly
- **Agents may miscommunicate** - Mitigation: Clear delegation format and output templates
- **Overhead for simple tasks** - Mitigation: Orchestrator can skip delegation for trivial work

---

## Alternatives Considered

### Alternative 1: Single Agent Approach
- Description: Use default Claude Code without teams
- Pros: Simpler, no configuration needed
- Cons: No enforced separation of concerns, harder to maintain consistency
- Why not chosen: Doesn't enforce DRY principles systematically

### Alternative 2: Manual Developer Roles
- Description: Document roles in CLAUDE.md, rely on human enforcement
- Pros: No experimental features, easier to understand
- Cons: No automated enforcement, prone to human error
- Why not chosen: Requires manual adherence to guidelines

### Alternative 3: External Build Tools
- Description: Use ESLint, Prettier, custom scripts for enforcement
- Pros: Automated linting and formatting
- Cons: Doesn't address component duplication or decision documentation
- Why not chosen: Complementary but insufficient for workflow coordination

---

## Implementation Notes

**Completed:**
- ✅ Enabled `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in `.claude/settings.local.json`
- ✅ Created 4 agent configurations in `.claude/agents/`
- ✅ Created decision template in `docs/decisions/TEMPLATE.md`
- ✅ Documented team structure in `.claude/AGENT_TEAMS.md`

**Next Steps:**
- Test agent workflow with a sample feature
- Refine agent instructions based on real usage
- Train team members on agent invocation syntax

**Responsible:** Project maintainers

**Timeline:** Immediate activation, iterative refinement over next 2 weeks

---

## References

- [Claude Code Agent Teams Documentation](https://code.claude.com/docs/en/agent-teams)
- Agent configurations: `.claude/agents/`
- Team documentation: `.claude/AGENT_TEAMS.md`
- Project specs: `specs/ARCHITECTURE.md`, `specs/STYLING.md`, `specs/TESTING.md`
