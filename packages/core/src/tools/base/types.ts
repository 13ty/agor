/**
 * Tool Types - Base types for agentic coding tools
 *
 * Tools: External agentic coding products (Claude Code, Cursor, Codex, Gemini)
 * Not to be confused with AI agents (internal personas)
 */

import type { Message, SessionID } from '../../types';

/**
 * Supported tool types
 */
export type ToolType = 'claude-code' | 'cursor' | 'codex' | 'gemini';

/**
 * Tool capabilities - feature flags for what each tool supports
 */
export interface ToolCapabilities {
  /** Can import historical sessions from tool's storage */
  supportsSessionImport: boolean;

  /** Can create new sessions via SDK/API */
  supportsSessionCreate: boolean;

  /** Can send prompts and stream responses */
  supportsLiveExecution: boolean;

  /** Can fork sessions at specific points */
  supportsSessionFork: boolean;

  /** Can spawn child sessions for subtasks */
  supportsChildSpawn: boolean;

  /** Tracks git state natively */
  supportsGitState: boolean;

  /** Streams responses in real-time */
  supportsStreaming: boolean;
}

/**
 * Options for importing sessions
 */
export interface ImportOptions {
  /** Project directory (for tools that organize by project) */
  projectDir?: string;

  /** Additional tool-specific options */
  [key: string]: unknown;
}

/**
 * Configuration for creating new sessions
 */
export interface CreateSessionConfig {
  /** Initial prompt to send */
  initialPrompt?: string;

  /** Working directory for the session */
  workingDirectory?: string;

  /** Git reference (branch/commit) to start from */
  gitRef?: string;

  /** Concepts to inject as context */
  concepts?: string[];

  /** Additional tool-specific config */
  [key: string]: unknown;
}

/**
 * Session handle - minimal identifier returned after creation/import
 */
export interface SessionHandle {
  sessionId: string;
  toolType: ToolType;
}

/**
 * Session data - rich data from import
 */
export interface SessionData extends SessionHandle {
  messages: Message[];
  metadata: SessionMetadata;
  workingDirectory?: string;
}

/**
 * Session metadata
 */
export interface SessionMetadata {
  sessionId: string;
  toolType: ToolType;
  status: 'active' | 'idle' | 'completed' | 'failed';
  createdAt: Date;
  lastUpdatedAt: Date;
  workingDirectory?: string;
  gitState?: {
    ref: string;
    baseSha: string;
    currentSha: string;
  };
  messageCount?: number;
  taskCount?: number;
}

/**
 * Task execution result
 */
export interface TaskResult {
  taskId: string;
  status: 'completed' | 'failed' | 'cancelled';
  messages: Message[];
  error?: Error;
  completedAt: Date;
}

/**
 * Message range for querying messages
 */
export interface MessageRange {
  startIndex?: number;
  endIndex?: number;
  limit?: number;
}
