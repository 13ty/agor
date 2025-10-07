/**
 * Claude Prompt Service
 *
 * Handles live execution of prompts against Claude sessions using Anthropic SDK.
 * Streams responses and returns complete messages for database storage.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Message as AnthropicMessage } from '@anthropic-ai/sdk/resources/messages';
import type { MessagesRepository } from '../../db/repositories/messages';
import type { SessionRepository } from '../../db/repositories/sessions';
import type { Message, SessionID } from '../../types';

/**
 * Convert Agor Message to Anthropic API format
 */
function toAnthropicMessage(message: Message): Anthropic.MessageParam {
  // Convert content to Anthropic format
  let content: string | Anthropic.ContentBlock[];

  if (typeof message.content === 'string') {
    content = message.content;
  } else {
    // Content is ContentBlock[] - cast to unknown first for type safety
    // biome-ignore lint/suspicious/noExplicitAny: Anthropic SDK types are structurally compatible
    content = message.content as any;
  }

  return {
    role: message.role === 'user' ? 'user' : 'assistant',
    content,
  };
}

export interface PromptResult {
  /** Complete assistant message from Anthropic */
  message: AnthropicMessage;
  /** Number of input tokens */
  inputTokens: number;
  /** Number of output tokens */
  outputTokens: number;
}

export class ClaudePromptService {
  private anthropic: Anthropic;

  constructor(
    private messagesRepo: MessagesRepository,
    private sessionsRepo: SessionRepository,
    apiKey?: string
  ) {
    this.anthropic = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Load conversation history for a session
   * Returns last N messages (default: 20) in Anthropic API format
   */
  async loadConversationHistory(
    sessionId: SessionID,
    limit: number = 20
  ): Promise<Anthropic.MessageParam[]> {
    const messages = await this.messagesRepo.findBySessionId(sessionId);

    // Take last N messages for context
    const recentMessages = messages.slice(-limit);

    // Convert to Anthropic format, filtering out system messages
    return recentMessages.filter(m => m.role !== 'system').map(m => toAnthropicMessage(m));
  }

  /**
   * Prompt a session with streaming support
   *
   * @param sessionId - Session to prompt
   * @param prompt - User prompt
   * @returns Complete assistant response with metadata
   */
  async promptSession(sessionId: SessionID, prompt: string): Promise<PromptResult> {
    // Load session to get repo context
    const session = await this.sessionsRepo.findById(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Load conversation history
    const conversationHistory = await this.loadConversationHistory(sessionId);

    // Append new user prompt
    const messages: Anthropic.MessageParam[] = [
      ...conversationHistory,
      {
        role: 'user',
        content: prompt,
      },
    ];

    // Stream response from Anthropic
    console.log(`🤖 Prompting Claude for session ${sessionId}...`);

    const stream = this.anthropic.messages.stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8000,
      messages,
      // System prompt could include repo context, concepts, etc.
      system: this.buildSystemPrompt({
        repo: session.repo.repo_slug ? { slug: session.repo.repo_slug } : undefined,
        git_state: session.git_state,
      }),
    });

    // Wait for complete message
    const finalMessage = await stream.finalMessage();

    console.log(`✅ Response complete (${finalMessage.usage.output_tokens} tokens)`);

    return {
      message: finalMessage,
      inputTokens: finalMessage.usage.input_tokens,
      outputTokens: finalMessage.usage.output_tokens,
    };
  }

  /**
   * Build system prompt with session context
   */
  private buildSystemPrompt(session: {
    repo?: { slug?: string };
    git_state?: { ref?: string };
  }): string {
    const repoInfo = session.repo?.slug ? `Repository: ${session.repo.slug}\n` : '';
    const branchInfo = session.git_state?.ref ? `Branch: ${session.git_state.ref}\n` : '';

    return `You are Claude, an AI assistant helping with software development.

${repoInfo}${branchInfo}
Provide clear, concise assistance with coding tasks.`;
  }
}
