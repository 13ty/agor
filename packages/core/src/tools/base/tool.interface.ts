/**
 * ITool - Base interface for agentic coding tool integrations
 *
 * Single unified interface for all tool interactions.
 * Methods are optional based on tool capabilities.
 *
 * Design philosophy:
 * - Functionality-oriented (what you can DO)
 * - Optional methods based on capabilities
 * - Start simple, expand as we learn from multiple tools
 * - Don't split into Client/Session unless runtime separation is clear
 */

import type { Message } from '../../types';
import type {
  CreateSessionConfig,
  ImportOptions,
  MessageRange,
  SessionData,
  SessionHandle,
  SessionMetadata,
  TaskResult,
  ToolCapabilities,
  ToolType,
} from './types';

export interface ITool {
  // ============================================================
  // Identity
  // ============================================================

  /** Tool type identifier */
  readonly toolType: ToolType;

  /** Human-readable tool name */
  readonly name: string;

  // ============================================================
  // Capabilities & Installation
  // ============================================================

  /**
   * Get tool capabilities (feature flags)
   */
  getCapabilities(): ToolCapabilities;

  /**
   * Check if tool is installed and accessible
   */
  checkInstalled(): Promise<boolean>;

  // ============================================================
  // Session Import (if supportsSessionImport)
  // ============================================================

  /**
   * Import existing session from tool's storage
   *
   * Example: Load Claude Code session from ~/.claude/projects/
   *
   * @param sessionId - Tool's session identifier
   * @param options - Import options (e.g., project directory)
   * @returns Rich session data with messages and metadata
   */
  importSession?(sessionId: string, options?: ImportOptions): Promise<SessionData>;

  // ============================================================
  // Session Creation (if supportsSessionCreate)
  // ============================================================

  /**
   * Create new session via SDK/API
   *
   * @param config - Session configuration
   * @returns Session handle (minimal identifier)
   */
  createSession?(config: CreateSessionConfig): Promise<SessionHandle>;

  // ============================================================
  // Live Execution (if supportsLiveExecution)
  // ============================================================

  /**
   * Execute task (send prompt) in existing session
   *
   * @param sessionId - Session identifier
   * @param prompt - User prompt
   * @returns Task result (may stream internally)
   */
  executeTask?(sessionId: string, prompt: string): Promise<TaskResult>;

  // ============================================================
  // Session Operations (if supported)
  // ============================================================

  /**
   * Get session metadata
   */
  getSessionMetadata?(sessionId: string): Promise<SessionMetadata>;

  /**
   * Get messages from session
   */
  getSessionMessages?(sessionId: string, range?: MessageRange): Promise<Message[]>;

  /**
   * List all available sessions
   */
  listSessions?(): Promise<SessionMetadata[]>;

  // ============================================================
  // Advanced Features (if supported)
  // ============================================================

  /**
   * Fork session at specific message index
   *
   * Creates divergent exploration path
   */
  forkSession?(sessionId: string, atMessageIndex?: number): Promise<SessionHandle>;

  /**
   * Spawn child session for subtask
   *
   * Creates focused subtask session with minimal context
   */
  spawnChildSession?(parentSessionId: string, prompt: string): Promise<SessionHandle>;
}
