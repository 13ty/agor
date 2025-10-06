# Terminology: Agentic Tools vs Agents

**Date:** 2025-10-06
**Status:** Terminology Clarification
**Related:** [[agent-abstraction-analysis.md]], [[agent-interface.md]]

## The Problem with "Agent"

The term "agent" is heavily overloaded in the AI coding space:

### Current Conflicting Meanings

1. **AI Agent Persona** (within a tool)
   - "The agent is thinking..."
   - "Agent executed 3 tool calls"
   - Internal construct within Claude Code/Cursor/etc.
   - Has memory, goals, planning capabilities

2. **Agentic Coding Tool** (the product)
   - "Use Claude Code as your agent"
   - "Switch between different agents"
   - The software/service itself (Claude Code, Cursor, Codex, Gemini)

3. **Multi-Agent Systems** (AI architecture)
   - "Spawn a child agent for this subtask"
   - "Parent agent delegates to child agents"
   - Multiple AI personas collaborating

### Confusion in Current Codebase

```typescript
// What does "agent" mean here?
interface Session {
  agent: string; // "claude-code" - This is the TOOL, not the AI persona
}

interface IAgentClient {
  // This is a CLIENT for an agentic TOOL
  readonly agentType: 'claude-code' | 'cursor';
}
```

**The issue:** We're using "agent" to mean "agentic coding tool" but it reads like we're talking about AI agent personas.

## Proposed Terminology

### Primary: "Agentic Tool" → "Tool"

**Rationale:**

- Claude Code, Cursor, Codex are **tools** (products/services)
- They happen to be **agentic** (use AI agents internally)
- We're integrating with the tools, not the internal AI agents
- Shorter, clearer, less overloaded

**Examples:**

```typescript
// Clear and concise
interface Session {
  tool: ToolType; // "claude-code", "cursor", "codex"
}

interface IToolClient {
  readonly toolType: ToolType;
  createSession(): Promise<ToolSession>;
}
```

### Alternative: "Coding Tool" → Too Generic

**Problem:** Vim, VSCode, grep are also "coding tools"

**Why it fails:** Doesn't capture the agentic nature

### Alternative: "AI Coding Assistant" → Too Long

**Problem:** Verbose, acronym AICA is awkward

```typescript
interface IAICodingAssistantClient {
  // Too long
  readonly assistantType: AICodingAssistantType; // Unwieldy
}
```

### Alternative: "Agentic Tool" → Redundant in Context

**When explicit context exists:**

```typescript
// In @agor/core/tools/, "agentic" is implied
interface IToolClient { ... }  // Clear
```

**When explicit context is needed:**

```
// In general documentation
"Agor integrates with agentic tools like Claude Code and Cursor"
```

## Recommended Naming Scheme

### File Structure

```
packages/core/src/tools/           ← Renamed from "agents/"
├── base/
│   ├── tool.interface.ts          ← Single interface, not client/session split
│   └── types.ts
│       ├── ToolType = 'claude-code' | 'cursor' | 'codex' | 'gemini'
│       ├── ToolCapabilities
│       └── ToolMetadata
├── claude/
│   ├── index.ts
│   ├── claude-tool.ts             ← implements ITool
│   ├── import/                    ← Current: transcript parsing utilities
│   │   ├── transcript-parser.ts
│   │   ├── message-converter.ts
│   │   └── task-extractor.ts
│   └── types.ts
├── cursor/                        ← Future
│   └── cursor-tool.ts
├── codex/                         ← Future
│   └── codex-tool.ts
└── gemini/                        ← Future
    └── gemini-tool.ts
```

### Type Names

```typescript
// Tool Types
type ToolType = 'claude-code' | 'cursor' | 'codex' | 'gemini';

interface ToolMetadata {
  name: string; // "Claude Code"
  type: ToolType; // "claude-code"
  version?: string;
  installed: boolean;
}

// Capabilities (feature flags for what each tool supports)
interface ToolCapabilities {
  supportsSessionImport: boolean; // Can import historical sessions
  supportsSessionCreate: boolean; // Can create new sessions via SDK
  supportsLiveExecution: boolean; // Can send prompts and stream responses
  supportsSessionFork: boolean; // Can fork sessions
  supportsChildSpawn: boolean; // Can spawn child sessions
  supportsGitState: boolean; // Tracks git state natively
  supportsStreaming: boolean; // Streams responses in real-time
}

// Single unified interface - functionality-oriented
// Methods are optional based on capabilities
interface ITool {
  // Identity
  readonly toolType: ToolType;
  readonly name: string;

  // Capabilities
  getCapabilities(): ToolCapabilities;
  checkInstalled(): Promise<boolean>;

  // Session Import (if supportsSessionImport)
  importSession?(sessionId: string, options?: ImportOptions): Promise<SessionData>;

  // Session Creation (if supportsSessionCreate)
  createSession?(config: CreateSessionConfig): Promise<SessionHandle>;

  // Live Execution (if supportsLiveExecution)
  executeTask?(sessionId: string, prompt: string): Promise<TaskResult>;

  // Session Operations (if supported)
  getSessionMetadata?(sessionId: string): Promise<SessionMetadata>;
  getSessionMessages?(sessionId: string): Promise<Message[]>;
  listSessions?(): Promise<SessionMetadata[]>;

  // Advanced Features (if supported)
  forkSession?(sessionId: string, atMessageIndex?: number): Promise<SessionHandle>;
  spawnChildSession?(parentSessionId: string, prompt: string): Promise<SessionHandle>;
}

// Session handle - minimal identifier returned after creation/import
interface SessionHandle {
  sessionId: string;
  toolType: ToolType;
}

// Session data - rich data from import
interface SessionData extends SessionHandle {
  messages: Message[];
  metadata: SessionMetadata;
  workingDirectory?: string;
}

// Concrete implementations - start simple, expand as SDKs evolve
class ClaudeTool implements ITool {
  readonly toolType = 'claude-code';
  readonly name = 'Claude Code';

  getCapabilities(): ToolCapabilities {
    return {
      supportsSessionImport: true, // ✅ We have transcript parsing
      supportsSessionCreate: false, // ❌ Waiting for SDK
      supportsLiveExecution: false, // ❌ Waiting for SDK
      supportsSessionFork: false,
      supportsChildSpawn: false,
      supportsGitState: true,
      supportsStreaming: false,
    };
  }

  async importSession(sessionId: string, options?: ImportOptions): Promise<SessionData> {
    // Use existing transcript parsing logic
    const session = await loadClaudeSession(sessionId, options?.projectDir);
    return {
      sessionId: session.sessionId,
      toolType: 'claude-code',
      messages: convertMessages(session.messages),
      metadata: extractMetadata(session),
      workingDirectory: session.cwd || undefined,
    };
  }

  // createSession, executeTask not implemented yet
  // Will add when Claude SDK becomes available
}

class CodexTool implements ITool {
  readonly toolType = 'codex';
  readonly name = 'OpenAI Codex';

  getCapabilities(): ToolCapabilities {
    return {
      supportsSessionImport: false, // No native sessions
      supportsSessionCreate: true, // ✅ Can use OpenAI API
      supportsLiveExecution: true, // ✅ API available
      supportsSessionFork: true, // Easy (copy conversation history)
      supportsChildSpawn: true,
      supportsGitState: false, // No native git awareness
      supportsStreaming: true, // ✅ OpenAI API supports streaming
    };
  }

  async createSession(config: CreateSessionConfig): Promise<SessionHandle> {
    // Use OpenAI API to create conversation
    // Store conversation history in Agor state
    // Return handle
  }

  async executeTask(sessionId: string, prompt: string): Promise<TaskResult> {
    // Fetch conversation history from Agor state
    // Call OpenAI API with full context
    // Stream response back
  }
}
```

### Database Schema

```typescript
// sessions table
interface Session {
  session_id: string;
  tool: ToolType; // ← Renamed from "agent"
  tool_version?: string; // ← Renamed from "agent_version"
  status: SessionStatus;
  // ...
}

// No change needed (already correct)
interface Task {
  task_id: string;
  session_id: string;
  // ...
}
```

### UI Components

```typescript
// UI types
interface Tool {  // ← Renamed from "Agent"
  id: ToolType;
  name: string;           // "Claude Code"
  icon: string;
  installed: boolean;
  version?: string;
  description: string;
  installable: boolean;
}

// Components
<ToolSelectionCard tool={tool} />     // ← Renamed from AgentSelectionCard
<ToolSwitcher tools={availableTools} />
```

### CLI Commands

```bash
# Current
agor session load-claude <id>

# Future (no change needed - "claude" is clear)
agor session load-claude <id>
agor session load-cursor <id>

# Tool management commands
agor tool list                    # List installed agentic tools
agor tool install claude-code     # Install Claude Code integration
agor tool version                 # Show tool versions
```

## Migration Path

### Phase 1: Rename Core Abstractions

**Files to rename:**

```
src/agents/              → src/tools/
  base/
    agent-client.ts      → tool-client.ts
    agent-session.ts     → tool-session.ts

IAgentClient             → IToolClient
IAgentSession            → IToolSession
AgentCapabilities        → ToolCapabilities
AgentType                → ToolType
AgentMetadata            → ToolMetadata
```

**Database migration:**

```sql
-- sessions table
ALTER TABLE sessions RENAME COLUMN agent TO tool;
ALTER TABLE sessions RENAME COLUMN agent_version TO tool_version;
```

### Phase 2: Update UI

```typescript
// Before
interface Agent {
  id: string;
  name: string;
  installed: boolean;
}

// After
interface Tool {
  id: ToolType;
  name: string;
  installed: boolean;
}

// Components
AgentSelectionCard → ToolSelectionCard
availableAgents    → availableTools
selectedAgent      → selectedTool
```

### Phase 3: Update Documentation

```markdown
# Before

Agor integrates with multiple AI coding agents

# After

Agor integrates with multiple agentic coding tools
```

## Preserved Terminology

### Keep "Agent" for AI Personas (Future)

When/if we implement internal agent orchestration:

```typescript
// This is an AI agent persona (internal to Agor)
interface AgorAgent {
  agentId: string;
  role: 'planner' | 'executor' | 'reviewer';
  model: string;
  tools: Tool[]; // Uses external coding tools
}

// This is an external coding tool
interface Tool {
  toolType: ToolType;
  name: string;
}
```

**Example use case:**

```typescript
// Agor's internal "planner agent" uses Claude Code tool
const plannerAgent: AgorAgent = {
  agentId: 'planner-1',
  role: 'planner',
  model: 'claude-3.5-sonnet',
  tools: [claudeCodeTool, cursorTool],
};

// The planner agent creates a session in Claude Code
const session = await claudeCodeTool.createSession({
  initialPrompt: plannerAgent.generatePlan(),
});
```

### Keep "Session" and "Task"

These are clear and unambiguous:

```typescript
interface Session {
  session_id: string;
  tool: ToolType; // Which tool is running this session
  status: SessionStatus;
}

interface Task {
  task_id: string;
  session_id: string;
  description: string;
}
```

## Glossary

| Term                    | Definition                                    | Example                            |
| ----------------------- | --------------------------------------------- | ---------------------------------- |
| **Tool**                | External agentic coding product/service       | Claude Code, Cursor, Codex, Gemini |
| **Tool Type**           | Identifier for a specific tool                | `"claude-code"`, `"cursor"`        |
| **Tool Client**         | Interface to interact with a tool             | `ClaudeClient`, `CursorClient`     |
| **Tool Session**        | Active conversation/workflow in a tool        | `ClaudeSession`, `CursorSession`   |
| **Session**             | Agor's tracking of a tool session             | Database record with session_id    |
| **Task**                | User prompt + agent work within a session     | Database record with task_id       |
| **Agent** (reserved)    | AI persona within a tool (internal construct) | Claude's internal reasoning agent  |
| **Agor Agent** (future) | AI persona orchestrated by Agor               | Planner, executor, reviewer agents |

## Benefits of This Change

1. **Clarity**
   - "Tool" is unambiguous (it's the product/service)
   - Avoids confusion with AI agent personas
   - Shorter than "agentic tool" in code

2. **Consistency**
   - Industry: "Claude Code is a tool"
   - Not: "Claude Code is an agent" (Claude is the agent, Code is the tool)

3. **Future-Proof**
   - Reserves "agent" for internal Agor AI personas
   - Allows multi-agent architecture later
   - Clear separation: tools (external) vs agents (internal)

4. **Readability**

   ```typescript
   // Before (ambiguous)
   const agent = selectedAgent;
   await agent.createSession();

   // After (clear)
   const tool = selectedTool;
   await tool.createSession();
   ```

## Counterarguments & Responses

**Argument:** "But these products call themselves 'AI agents'"

**Response:** Marketing vs technical precision. They're products that use agents internally. We're integrating with the products (tools), not the internal agents.

**Argument:** "Tool is too generic"

**Response:** Context disambiguates. In `@agor/core/tools/`, it's clear we mean agentic coding tools, not generic software tools.

**Argument:** "Agentic tool is more explicit"

**Response:** Redundant in code. Use "agentic tool" in docs/marketing, "tool" in code for brevity.

## Interface Design Philosophy

### Single Interface, Not Client/Session Split

**Principle:** Keep it simple until complexity is necessary

**Rationale:**

- Each tool may have SDK, CLI wrapper, or API access (heterogeneous)
- Functionality varies widely (Claude has transcripts, Codex has API, Cursor has editor)
- Premature abstraction leads to awkward adapters
- Optional methods (`importSession?`, `createSession?`) handle capability variance

**Evolution Strategy:**

**Phase 1 (Current): Claude-specific**

- Implement `ClaudeTool` tightly coupled to what Claude Code can do
- Only `importSession()` works (parse transcripts)
- Other methods undefined until SDK available

**Phase 2 (Add Codex/Gemini): Find common denominator**

- Implement `CodexTool` and `GeminiTool`
- Discover which methods are common (likely `createSession`, `executeTask`)
- Refactor `ITool` interface based on real multi-tool patterns

**Phase 3 (SDK maturity): Expand capabilities**

- As SDKs improve (expected in coming months), add more methods
- `ClaudeTool` gains `createSession`, `executeTask` when SDK available
- Interface expands to support new features all tools share

**Anti-pattern to avoid:**

```typescript
// Don't split prematurely
interface IToolClient { ... }
interface IToolSession { ... }

// Keep unified until we see clear separation of concerns
interface ITool { ... }
```

**When to split:** Only if we find clear runtime separation:

- Example: "Client" manages multiple sessions, "Session" is per-conversation
- Reality: Most tools don't expose this abstraction
- Wait for evidence from 2-3 tool implementations before splitting

### Capability Flags Over Abstract Methods

**Use feature flags to handle heterogeneity:**

```typescript
// Good: Explicit capabilities
const tool = new ClaudeTool();
if (tool.getCapabilities().supportsSessionImport) {
  await tool.importSession(sessionId);
}

// Bad: Try/catch for missing functionality
try {
  await tool.importSession(sessionId);
} catch (e) {
  // Unclear if tool doesn't support or if there was an error
}
```

**Benefits:**

- UI can disable unavailable features
- Clear documentation of what each tool supports
- Type-safe with optional methods (`importSession?`)
- Easy to add new capabilities as tools evolve

### SDK Evolution Timeline

**Current state (Oct 2025):**

- Claude Code: Transcript files only, no public SDK
- Cursor: Editor-based, no programmatic API
- Codex: OpenAI API available, stable
- Gemini: Google API available, stable

**Expected evolution (Q1-Q2 2026):**

- Claude Code SDK likely to emerge (Anthropic pattern)
- Cursor may expose API for integrations
- Codex/Gemini continue to improve streaming, function calling

**Agor strategy:**

- Start with what works today (Claude transcript import, Codex API)
- Add SDK support as tools mature
- Refactor interface based on real multi-tool needs
- Don't over-engineer for hypothetical futures

## Decision

**Adopt "Tool" terminology:**

- ✅ Clear and concise
- ✅ Matches industry usage ("coding tools")
- ✅ Reserves "agent" for future AI personas
- ✅ Shorter than "agentic tool" in code

**Adopt single unified interface:**

- ✅ `ITool` not `IToolClient` + `IToolSession`
- ✅ Optional methods based on capabilities
- ✅ Start Claude-specific, generalize as we learn
- ✅ Split only when runtime separation is clear

**Implementation:**

- Immediate: Use in new code/docs
- Phase 1: Rename core abstractions (src/agents → src/tools)
- Phase 2: Database migration (agent → tool column)
- Phase 3: UI component updates
- Evolve: Expand `ITool` as SDKs mature

## References

- [[agent-abstraction-analysis.md]] - Will be updated to use "tool" terminology
- [[agent-interface.md]] - Historical reference (predates terminology fix)
- Industry: "Claude Code", "Cursor", "GitHub Copilot" are all referred to as "tools"
