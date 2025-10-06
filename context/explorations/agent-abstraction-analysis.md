# Agent Abstraction Analysis & Refactoring Plan

**Date:** 2025-10-06
**Status:** Analysis → Refactoring Required
**Related:** [[agent-interface.md]], [[models.md]], [[architecture.md]]

## Current State Analysis

### What We Have Now

**Location:** `packages/core/src/claude/`

```
claude/
├── index.ts                 # Exports
├── load-session.ts          # Load Claude Code session by ID
├── transcript-parser.ts     # Parse JSONL transcript files
├── task-extractor.ts        # Extract tasks from messages
└── message-converter.ts     # Convert transcript → Agor messages
```

**What it does:**

- ✅ Parses Claude Code JSONL transcripts from `~/.claude/projects/`
- ✅ Extracts messages and tasks from conversation history
- ✅ Converts Claude Code format → Agor database format
- ✅ Used by `agor session load-claude` CLI command

**What it is:**

- **Import-only utilities** (read existing Claude sessions)
- **Not a live agent client** (can't send prompts, stream responses)
- **Claude-specific file parsing** (tightly coupled to transcript format)

### The Problem

**Issue #1: Wrong Abstraction Level**

```
Current: claude/ = "Parse Claude Code transcript files"
Needed:  agents/claude/ = "Full Claude Code agent integration"
```

The `claude/` folder only handles **importing historical sessions**, not **running new sessions**. This is a subset of what agent-interface.md envisioned.

**Issue #2: No Base Abstraction**

- No `IAgentClient` interface
- No `AgentSession` base class
- No polymorphic agent handling
- Can't easily add Cursor, Codex, Gemini

**Issue #3: Location Confusion**

```
packages/core/src/
├── claude/          ← Claude-specific, but no agents/ parent
├── db/              ← Database layer
├── git/             ← Git utilities
├── api/             ← FeathersJS client
└── config/          ← Config management
```

Should be:

```
packages/core/src/
├── agents/
│   ├── base/        ← Abstract interfaces
│   ├── claude/      ← Claude Code implementation
│   ├── codex/       ← OpenAI Codex (future)
│   └── cursor/      ← Cursor (future)
├── db/
├── git/
├── api/
└── config/
```

**Issue #4: Mixing Concerns**
Current `claude/` folder mixes:

1. **Import utilities** (parse transcripts)
2. **Data conversion** (transcript → Agor format)
3. **Task extraction** (derive tasks from messages)

These should be separated:

- Import/conversion → `agents/claude/import/`
- Task extraction → Could be generic (any agent with message history)
- Live session handling → `agents/claude/client/` (future)

## Proposed Architecture

### Module Structure

```
packages/core/src/agents/
├── base/
│   ├── index.ts                    # Exports
│   ├── agent-client.interface.ts   # IAgentClient interface
│   ├── agent-session.interface.ts  # IAgentSession interface
│   ├── types.ts                    # Shared types (AgentCapabilities, etc.)
│   └── errors.ts                   # AgentError, SessionNotFoundError, etc.
│
├── claude/
│   ├── index.ts                    # Exports (ClaudeClient, import utils)
│   │
│   ├── client/                     # Future: Live Claude Code SDK client
│   │   ├── claude-client.ts        # implements IAgentClient
│   │   └── claude-session.ts       # implements IAgentSession
│   │
│   ├── import/                     # Current: Import historical sessions
│   │   ├── load-session.ts         # Load session by ID
│   │   ├── transcript-parser.ts    # Parse JSONL files
│   │   ├── message-converter.ts    # Convert to Agor messages
│   │   └── task-extractor.ts       # Extract tasks from messages
│   │
│   └── types.ts                    # Claude-specific types
│
├── codex/                          # Future
│   ├── index.ts
│   ├── client/
│   │   ├── codex-client.ts
│   │   └── codex-emulated-session.ts
│   └── types.ts
│
└── cursor/                         # Future
    └── (similar structure)
```

### Base Interfaces (Phase 1)

**File:** `packages/core/src/agents/base/agent-client.interface.ts`

```typescript
/**
 * Base interface for all agent integrations
 *
 * Implementations:
 * - ClaudeClient (Claude Code)
 * - CodexClient (OpenAI Codex)
 * - CursorClient (Cursor AI)
 * - GeminiClient (Google Gemini)
 */
export interface IAgentClient {
  /** Agent identifier */
  readonly agentType: AgentType;

  /** Check if agent is installed and accessible */
  checkInstalled(): Promise<boolean>;

  /** Get agent capabilities */
  getCapabilities(): AgentCapabilities;

  /** Import existing session (if supported) */
  importSession(sessionId: string, options?: ImportOptions): Promise<IAgentSession>;

  /** Create new session */
  createSession(config: CreateSessionConfig): Promise<IAgentSession>;

  /** List available sessions (if supported) */
  listSessions?(): Promise<AgentSessionMetadata[]>;
}

export type AgentType = 'claude-code' | 'cursor' | 'codex' | 'gemini';

export interface AgentCapabilities {
  /** Can import existing sessions from agent's storage */
  supportsSessionImport: boolean;

  /** Can create new live sessions */
  supportsSessionCreate: boolean;

  /** Can send prompts and stream responses */
  supportsLiveExecution: boolean;

  /** Supports forking sessions */
  supportsSessionFork: boolean;

  /** Supports spawning child sessions */
  supportsChildSpawn: boolean;

  /** Tracks git state natively */
  supportsGitState: boolean;

  /** Streams responses in real-time */
  supportsStreaming: boolean;
}
```

**File:** `packages/core/src/agents/base/agent-session.interface.ts`

```typescript
/**
 * Base interface for agent sessions
 *
 * Represents a single conversation/workflow with an agent
 */
export interface IAgentSession {
  /** Session identifier (agent-specific) */
  readonly sessionId: string;

  /** Agent type */
  readonly agentType: AgentType;

  /** Get session metadata */
  getMetadata(): Promise<SessionMetadata>;

  /** Get messages from session */
  getMessages(range?: MessageRange): Promise<AgentMessage[]>;

  /** Execute task (send prompt) - only if supportsLiveExecution */
  executeTask?(prompt: string, config?: TaskConfig): Promise<TaskExecution>;

  /** Fork session - only if supportsSessionFork */
  fork?(atMessageIndex?: number): Promise<IAgentSession>;

  /** Spawn child session - only if supportsChildSpawn */
  spawnChild?(prompt: string): Promise<IAgentSession>;

  /** Close session */
  close?(): Promise<void>;
}

export interface SessionMetadata {
  sessionId: string;
  agentType: AgentType;
  status: 'active' | 'idle' | 'completed' | 'failed';
  createdAt: Date;
  lastUpdatedAt: Date;

  // Optional fields
  workingDirectory?: string;
  gitState?: {
    ref: string;
    baseSha: string;
    currentSha: string;
  };
  messageCount?: number;
  taskCount?: number;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string; // Simplified for now
  timestamp: Date;
  metadata?: Record<string, unknown>;
}
```

### Claude Implementation (Current + Future)

**Phase 1: Extract Current Import Logic**

**File:** `packages/core/src/agents/claude/import/claude-importer.ts`

```typescript
import type { IAgentClient, IAgentSession } from '../../base';
import { loadClaudeSession } from './load-session';
import { convertMessages } from './message-converter';
import { extractTasks } from './task-extractor';

/**
 * Import-only client for Claude Code historical sessions
 *
 * Capabilities:
 * - ✅ Import sessions from transcript files
 * - ❌ Create new sessions (requires Claude SDK)
 * - ❌ Live execution (requires Claude SDK)
 */
export class ClaudeImporter implements IAgentClient {
  readonly agentType = 'claude-code' as const;

  async checkInstalled(): Promise<boolean> {
    // Check if ~/.claude directory exists
    const claudeDir = path.join(os.homedir(), '.claude');
    return fs.existsSync(claudeDir);
  }

  getCapabilities(): AgentCapabilities {
    return {
      supportsSessionImport: true,
      supportsSessionCreate: false, // Requires SDK
      supportsLiveExecution: false, // Requires SDK
      supportsSessionFork: false,
      supportsChildSpawn: false,
      supportsGitState: true, // Transcripts contain git state
      supportsStreaming: false, // Import is batch
    };
  }

  async importSession(sessionId: string, options?: ImportOptions): Promise<IAgentSession> {
    const session = await loadClaudeSession(sessionId, options?.projectDir);
    return new ClaudeImportedSession(session);
  }

  async createSession(): Promise<IAgentSession> {
    throw new Error(
      'ClaudeImporter does not support creating sessions. Use ClaudeClient (requires SDK).'
    );
  }
}

/**
 * Represents an imported Claude Code session (read-only)
 */
export class ClaudeImportedSession implements IAgentSession {
  readonly sessionId: string;
  readonly agentType = 'claude-code' as const;

  constructor(private session: ClaudeSession) {
    this.sessionId = session.sessionId;
  }

  async getMetadata(): Promise<SessionMetadata> {
    return {
      sessionId: this.sessionId,
      agentType: 'claude-code',
      status: 'completed', // Historical sessions are always completed
      createdAt: new Date(this.session.messages[0]?.timestamp || Date.now()),
      lastUpdatedAt: new Date(
        this.session.messages[this.session.messages.length - 1]?.timestamp || Date.now()
      ),
      workingDirectory: this.session.cwd || undefined,
      messageCount: this.session.messages.length,
    };
  }

  async getMessages(range?: MessageRange): Promise<AgentMessage[]> {
    return convertMessages(this.session.messages, range);
  }

  // No live execution methods (import-only)
}
```

**Phase 2: Future Live Client (requires Claude SDK)**

**File:** `packages/core/src/agents/claude/client/claude-client.ts`

```typescript
import type { IAgentClient, IAgentSession } from '../../base';
// import { ClaudeSDK } from '@anthropic/claude-code-sdk'; // Hypothetical

/**
 * Live Claude Code client (requires SDK)
 *
 * Capabilities:
 * - ✅ Import sessions
 * - ✅ Create new sessions
 * - ✅ Live execution with streaming
 * - ✅ Fork sessions (if SDK supports)
 */
export class ClaudeClient implements IAgentClient {
  readonly agentType = 'claude-code' as const;

  // constructor(private sdk: ClaudeSDK) {}

  getCapabilities(): AgentCapabilities {
    return {
      supportsSessionImport: true,
      supportsSessionCreate: true,
      supportsLiveExecution: true,
      supportsSessionFork: true, // If SDK supports
      supportsChildSpawn: true,
      supportsGitState: true,
      supportsStreaming: true,
    };
  }

  async createSession(config: CreateSessionConfig): Promise<IAgentSession> {
    // const sdkSession = await this.sdk.createSession({
    //   initialPrompt: config.initialPrompt,
    //   workingDirectory: config.workingDirectory,
    // });
    // return new ClaudeLiveSession(sdkSession);
    throw new Error('ClaudeClient requires Claude SDK (not yet implemented)');
  }

  // ... other methods
}
```

### Refactoring Steps

#### Step 1: Create Base Abstractions

1. Create `packages/core/src/agents/base/`
2. Define `IAgentClient` interface
3. Define `IAgentSession` interface
4. Define shared types (AgentCapabilities, SessionMetadata, etc.)

#### Step 2: Move Claude Import Utilities

1. Create `packages/core/src/agents/claude/import/`
2. Move current files:
   - `load-session.ts` → `agents/claude/import/load-session.ts`
   - `transcript-parser.ts` → `agents/claude/import/transcript-parser.ts`
   - `message-converter.ts` → `agents/claude/import/message-converter.ts`
   - `task-extractor.ts` → `agents/claude/import/task-extractor.ts`
3. Create `ClaudeImporter` class implementing `IAgentClient`
4. Create `ClaudeImportedSession` class implementing `IAgentSession`

#### Step 3: Update Exports

1. Update `packages/core/src/agents/index.ts`:
   ```typescript
   export * from './base';
   export * from './claude';
   ```
2. Update `packages/core/src/agents/claude/index.ts`:
   ```typescript
   export * from './import';
   // export * from './client';  // Future
   ```
3. Update `packages/core/package.json` exports:
   ```json
   "./agents": {
     "types": "./dist/agents/index.d.ts",
     "import": "./dist/agents/index.js",
     "require": "./dist/agents/index.cjs"
   }
   ```

#### Step 4: Update Consumers

1. Update CLI `load-claude` command:

   ```typescript
   // Before
   import { loadClaudeSession } from '@agor/core/claude';

   // After
   import { ClaudeImporter } from '@agor/core/agents';

   const importer = new ClaudeImporter();
   const session = await importer.importSession(sessionId, { projectDir });
   ```

#### Step 5: Delete Old Location

1. Remove `packages/core/src/claude/` directory
2. Update tsup config (remove `claude/index` entry)
3. Update package.json exports (remove `./claude` entry)

### Task Extraction: Generic or Agent-Specific?

**Question:** Should task extraction be agent-agnostic or Claude-specific?

**Current:** `task-extractor.ts` extracts tasks from Claude transcript messages

**Options:**

**Option A: Keep Claude-Specific**

- Location: `agents/claude/import/task-extractor.ts`
- Rationale: Logic is tightly coupled to Claude message format
- Pros: Simple, accurate for Claude
- Cons: Need to reimplement for each agent

**Option B: Make Generic with Adapters**

- Location: `agents/base/task-extraction/`
- Approach: Generic task extractor + agent-specific adapters
- Pros: Reusable logic across agents
- Cons: More abstraction, may not fit all agents

**Recommendation:** Start with Option A (Claude-specific), refactor to Option B when we add second agent and see common patterns.

## Implementation Checklist

### Phase 1: Immediate Refactoring (Now)

- [ ] Create `packages/core/src/agents/base/` directory
- [ ] Define `IAgentClient` interface
- [ ] Define `IAgentSession` interface
- [ ] Define shared types (AgentCapabilities, SessionMetadata, etc.)
- [ ] Create `packages/core/src/agents/claude/import/` directory
- [ ] Move `load-session.ts` to `agents/claude/import/`
- [ ] Move `transcript-parser.ts` to `agents/claude/import/`
- [ ] Move `message-converter.ts` to `agents/claude/import/`
- [ ] Move `task-extractor.ts` to `agents/claude/import/`
- [ ] Create `ClaudeImporter` class
- [ ] Create `ClaudeImportedSession` class
- [ ] Update package exports
- [ ] Update CLI `load-claude` command
- [ ] Update tsup config
- [ ] Delete old `packages/core/src/claude/` directory
- [ ] Update documentation

### Phase 2: Live Claude Client (Future)

- [ ] Research Claude Code SDK availability
- [ ] Create `agents/claude/client/` directory
- [ ] Implement `ClaudeClient` class
- [ ] Implement `ClaudeLiveSession` class
- [ ] Add streaming support
- [ ] Add fork/spawn support
- [ ] Test end-to-end live execution

### Phase 3: Additional Agents (Future)

- [ ] Implement `CodexClient` (OpenAI)
- [ ] Implement `CursorClient` (Cursor)
- [ ] Implement `GeminiClient` (Google)
- [ ] Document capability matrix
- [ ] Create agent selection logic in daemon

## Benefits of This Architecture

1. **Clear Separation of Concerns**
   - Import logic isolated from live client logic
   - Agent-specific code contained in `agents/{name}/`
   - Base abstractions prevent drift

2. **Incremental Implementation**
   - Phase 1: Just refactor current import utilities
   - Phase 2: Add live Claude client when SDK available
   - Phase 3: Add other agents as needed

3. **Type Safety**
   - Interfaces enforce consistent API across agents
   - Capabilities flag unsupported features at runtime
   - TypeScript catches misuse at compile time

4. **Testability**
   - Mock `IAgentClient` for testing
   - Test each agent in isolation
   - Integration tests use real clients

5. **Discoverability**
   - `packages/core/src/agents/` clearly shows supported agents
   - Each agent's capabilities documented in code
   - Import paths self-documenting: `@agor/core/agents`

## Migration Impact

### Breaking Changes

- `@agor/core/claude` → `@agor/core/agents` (import path change)
- `loadClaudeSession()` → `ClaudeImporter.importSession()` (API change)

### Non-Breaking (Internal)

- CLI commands continue to work (internal import updated)
- Database schema unchanged
- FeathersJS services unchanged

### Migration Script

```bash
# Find all imports of @agor/core/claude
grep -r "@agor/core/claude" apps/ packages/

# Update to @agor/core/agents
sed -i '' 's/@agor\/core\/claude/@agor\/core\/agents/g' apps/**/*.ts packages/**/*.ts
```

## Next Steps

1. **Immediate:** Implement Phase 1 refactoring (move files, create interfaces)
2. **Short-term:** Update CLI and test end-to-end
3. **Medium-term:** Research Claude SDK for Phase 2 (live client)
4. **Long-term:** Implement Codex/Cursor/Gemini clients

## References

- [[agent-interface.md]] - Original exploration
- [[models.md]] - Session and Task data models
- [[architecture.md]] - System architecture
