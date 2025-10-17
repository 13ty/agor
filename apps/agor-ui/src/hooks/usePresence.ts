/**
 * React hook for tracking active users and their cursor positions
 *
 * Subscribes to cursor-moved events and maintains active user state for Facepile
 */

import type { AgorClient } from '@agor/core/api';
import type { ActiveUser, BoardID, CursorMovedEvent, User } from '@agor/core/types';
import { useEffect, useMemo, useState } from 'react';
import { PRESENCE_CONFIG } from '../config/presence';

interface UsePresenceOptions {
  client: AgorClient | null;
  boardId: BoardID | null;
  users: User[]; // All users (for looking up user details by ID)
  enabled?: boolean;
}

interface UsePresenceResult {
  activeUsers: ActiveUser[];
  remoteCursors: Map<string, { x: number; y: number; user: User; timestamp: number }>;
}

/**
 * Track active users and remote cursor positions
 *
 * @param options - Client, boardId, users list, and enabled flag
 * @returns Active users for facepile and remote cursors for rendering
 */
export function usePresence(options: UsePresenceOptions): UsePresenceResult {
  const { client, boardId, users, enabled = true } = options;

  // Map of userId → cursor state
  const [cursorMap, setCursorMap] = useState<
    Map<string, { x: number; y: number; timestamp: number }>
  >(new Map());

  useEffect(() => {
    if (!enabled || !client?.io || !boardId) {
      setCursorMap(new Map());
      return;
    }

    // Handle cursor-moved events
    const handleCursorMoved = (event: CursorMovedEvent) => {
      // Only track cursors for this board
      if (event.boardId !== boardId) return;

      setCursorMap(prev => {
        const next = new Map(prev);
        const existing = prev.get(event.userId);

        // Only update if this event is newer than the existing one (prevent out-of-order updates)
        if (existing && event.timestamp < existing.timestamp) {
          return prev; // Reject stale update
        }

        next.set(event.userId, {
          x: event.x,
          y: event.y,
          timestamp: event.timestamp,
        });
        return next;
      });
    };

    // Handle cursor-left events (user navigated away)
    const handleCursorLeft = (event: { userId: string; boardId: BoardID }) => {
      if (event.boardId !== boardId) return;

      setCursorMap(prev => {
        const next = new Map(prev);
        next.delete(event.userId);
        return next;
      });
    };

    // Subscribe to WebSocket events
    client.io.on('cursor-moved', handleCursorMoved);
    client.io.on('cursor-left', handleCursorLeft);

    // Cleanup stale cursors every 5 seconds
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setCursorMap(prev => {
        const next = new Map(prev);
        let hasChanges = false;

        for (const [userId, cursor] of next.entries()) {
          if (now - cursor.timestamp > PRESENCE_CONFIG.CURSOR_HIDE_AFTER_MS) {
            next.delete(userId);
            hasChanges = true;
          }
        }

        return hasChanges ? next : prev;
      });
    }, 5000);

    // Cleanup
    return () => {
      client.io.off('cursor-moved', handleCursorMoved);
      client.io.off('cursor-left', handleCursorLeft);
      clearInterval(cleanupInterval);
    };
  }, [client, boardId, enabled]);

  // Derive active users and remote cursors from cursor map
  // Memoized to prevent unnecessary re-renders
  const { activeUsers, remoteCursors } = useMemo(() => {
    const activeUsers: ActiveUser[] = [];
    const remoteCursors = new Map<
      string,
      { x: number; y: number; user: User; timestamp: number }
    >();

    const now = Date.now();

    for (const [userId, cursor] of cursorMap.entries()) {
      // Find user details
      const user = users.find(u => u.user_id === userId);
      if (!user) continue; // Skip if user not found

      // Check if user is still active (within timeout)
      const isActive = now - cursor.timestamp < PRESENCE_CONFIG.ACTIVE_USER_TIMEOUT_MS;
      if (!isActive) continue;

      // Add to active users
      activeUsers.push({
        user,
        lastSeen: cursor.timestamp,
        cursor: {
          x: cursor.x,
          y: cursor.y,
        },
      });

      // Add to remote cursors map
      remoteCursors.set(userId, {
        x: cursor.x,
        y: cursor.y,
        user,
        timestamp: cursor.timestamp,
      });
    }

    return {
      activeUsers,
      remoteCursors,
    };
  }, [cursorMap, users]);

  return {
    activeUsers,
    remoteCursors,
  };
}
