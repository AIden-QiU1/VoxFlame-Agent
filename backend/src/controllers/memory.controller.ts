import { Request, Response } from 'express';
import { SupabaseService, Memory, Session } from '../services/supabase.service';

interface MemoryAddRequestBody {
  user_id?: string;
  session_id?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  session?: Partial<Session>;
}

interface MemorySessionSyncRequestBody {
  user_id?: string;
  session_id?: string;
  metadata?: Record<string, unknown>;
  session?: Partial<Session>;
}

function readNumber(record: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readString(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function toIsoString(timestamp: number | undefined): string | undefined {
  return typeof timestamp === 'number' ? new Date(timestamp).toISOString() : undefined;
}

function markCompatMemorySlice(res: Response, route: string): void {
  res.set({
    'Cache-Control': 'no-store',
    Deprecation: 'true',
    'X-VoxFlame-Route-Class': 'compat',
    'X-VoxFlame-Replacement': '/api/memory/profile/:userId',
    'X-VoxFlame-Compat-Route': route,
  });
}

function buildSessionPayload(
  userId: string,
  sessionId: string,
  metadata: Record<string, unknown> | undefined,
  sessionInput: Partial<Session> | undefined,
  fallbackCreatedAt: string,
): Session {
  const startTime =
    sessionInput?.start_time ||
    toIsoString(readNumber(metadata, 'sessionStartedAt')) ||
    fallbackCreatedAt;
  const endTime =
    sessionInput?.end_time ||
    toIsoString(readNumber(metadata, 'sessionEndedAt'));
  const duration =
    sessionInput?.duration ||
    readNumber(metadata, 'sessionDurationSeconds');
  const transcript = sessionInput?.transcript;
  const sessionMetadata: Record<string, unknown> = {
    ...(sessionInput?.metadata || {}),
  };

  const sessionKind = readString(metadata, 'sessionKind');
  const sessionSource = readString(metadata, 'sessionSource');
  const turnCount = readNumber(metadata, 'sessionTurnCount');

  if (sessionKind) {
    sessionMetadata.kind = sessionKind;
  }
  if (sessionSource) {
    sessionMetadata.source = sessionSource;
  }
  if (typeof turnCount === 'number') {
    sessionMetadata.turnCount = turnCount;
  }

  return {
    id: sessionId,
    user_id: userId,
    start_time: startTime,
    end_time: endTime,
    duration,
    transcript,
    metadata: sessionMetadata,
  };
}

export class MemoryController {
  // POST /api/memory/session - Upsert session metadata used by unified memory profile
  async syncSession(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedUserId = req.user?.id;
      const {
        user_id,
        session_id,
        metadata,
        session,
      } = req.body as MemorySessionSyncRequestBody;

      if (!authenticatedUserId) {
        res.status(401).json({ error: 'Unauthorized - No user context' });
        return;
      }

      if (user_id && user_id !== authenticatedUserId) {
        console.warn(`[MemoryController] User ID mismatch: token=${authenticatedUserId}, body=${user_id}`);
        res.status(403).json({ error: 'Forbidden - User ID mismatch' });
        return;
      }

      const safeUserId = authenticatedUserId;
      const resolvedSessionId = session?.id || session_id;
      if (!resolvedSessionId) {
        res.status(400).json({ error: 'Missing required field: session_id' });
        return;
      }

      const ensuredSession = await SupabaseService.getInstance().ensureSession(
        buildSessionPayload(
          safeUserId,
          resolvedSessionId,
          metadata,
          session,
          new Date().toISOString(),
        ),
      );

      if (!ensuredSession) {
        res.status(500).json({ error: 'Failed to sync session' });
        return;
      }

      res.json(ensuredSession);
    } catch (error) {
      console.error('Error in syncSession:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // POST /api/memory/add - Add new memory from TEN Agent
  async addMemory(req: Request, res: Response): Promise<void> {
    try {
      // 从认证中间件获取用户 ID
      const authenticatedUserId = req.user?.id
      const {
        user_id,
        session_id,
        content,
        metadata,
        session,
      } = req.body as MemoryAddRequestBody;

      // 验证：请求的 user_id 必须与认证用户匹配
      if (!authenticatedUserId) {
        res.status(401).json({ error: 'Unauthorized - No user context' });
        return;
      }

      // 安全检查：确保 user_id 与 token 匹配
      if (user_id && user_id !== authenticatedUserId) {
        console.warn(`[MemoryController] User ID mismatch: token=${authenticatedUserId}, body=${user_id}`)
        res.status(403).json({ error: 'Forbidden - User ID mismatch' });
        return;
      }

      // 使用认证后的 user_id
      const safeUserId = authenticatedUserId;
      const createdAt = new Date().toISOString();

      if (!session_id || !content) {
        res.status(400).json({ error: 'Missing required fields: session_id, content' });
        return;
      }

      const service = SupabaseService.getInstance();
      const ensuredSession = await service.ensureSession(
        buildSessionPayload(safeUserId, session_id, metadata, session, createdAt),
      );

      if (!ensuredSession?.id) {
        res.status(500).json({ error: 'Failed to ensure session before adding memory' });
        return;
      }

      const memory: Memory = {
        user_id: safeUserId,
        session_id: ensuredSession.id,
        content,
        metadata,
        created_at: createdAt,
      };

      const created = await service.addMemory(memory);

      if (!created) {
        res.status(500).json({ error: 'Failed to add memory' });
        return;
      }

      res.status(201).json(created);
    } catch (error) {
      console.error('Error in addMemory:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // GET /api/memory/profile/:userId - Unified memory profile data
  async getUserMemoryProfile(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { memory_limit, session_limit } = req.query;

      if (!userId) {
        res.status(400).json({ error: 'Missing userId parameter' });
        return;
      }

      const profile = await SupabaseService.getInstance().getUserMemoryProfile(
        userId,
        memory_limit ? parseInt(memory_limit as string, 10) : 400,
        session_limit ? parseInt(session_limit as string, 10) : 120,
      );

      res.json(profile);
    } catch (error) {
      console.error('Error in getUserMemoryProfile:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // GET /api/memory/search?user_id=xxx&query=... - Semantic search memories
  async searchMemories(req: Request, res: Response): Promise<void> {
    try {
      // 从认证中间件获取用户 ID
      const authenticatedUserId = req.user?.id;
      const { query, limit } = req.query;

      if (!authenticatedUserId) {
        res.status(401).json({ error: 'Unauthorized - No user context' });
        return;
      }

      if (!query) {
        res.status(400).json({ error: 'Missing required parameter: query' });
        return;
      }

      // 使用认证后的 user_id，忽略请求参数中的 user_id
      const memories = await SupabaseService.getInstance().searchMemories(
        authenticatedUserId,
        query as string,
        limit ? parseInt(limit as string) : 10
      );

      res.json({ memories, count: memories.length });
    } catch (error) {
      console.error('Error in searchMemories:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // GET /api/memory/user/:userId - Get all user memories
  async getUserMemories(req: Request, res: Response): Promise<void> {
    try {
      // validateUserId 中间件已验证 userId 与 token 匹配
      const { userId } = req.params;
      const { limit } = req.query;

      if (!userId) {
        res.status(400).json({ error: 'Missing userId parameter' });
        return;
      }

      markCompatMemorySlice(res, '/api/memory/user/:userId');
      const memories = await SupabaseService.getInstance().getMemories(
        userId,
        limit ? parseInt(limit as string) : 50
      );

      res.json({ memories, count: memories.length });
    } catch (error) {
      console.error('Error in getUserMemories:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // PUT /api/memory/:memoryId - Update memory
  async updateMemory(req: Request, res: Response): Promise<void> {
    try {
      const { memoryId } = req.params;
      const updates = req.body;
      const authenticatedUserId = req.user?.id;

      if (!memoryId) {
        res.status(400).json({ error: 'Missing memoryId parameter' });
        return;
      }

      if (!authenticatedUserId) {
        res.status(401).json({ error: 'Unauthorized - No user context' });
        return;
      }

      const existing = await SupabaseService.getInstance().getMemoryById(memoryId);
      if (!existing) {
        res.status(404).json({ error: 'Memory not found' });
        return;
      }

      if (existing.user_id !== authenticatedUserId) {
        res.status(403).json({ error: 'Forbidden - Memory does not belong to current user' });
        return;
      }

      const updated = await SupabaseService.getInstance().updateMemory(memoryId, updates);

      if (!updated) {
        res.status(404).json({ error: 'Memory not found or update failed' });
        return;
      }

      res.json(updated);
    } catch (error) {
      console.error('Error in updateMemory:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // DELETE /api/memory/:memoryId - Delete memory
  async deleteMemory(req: Request, res: Response): Promise<void> {
    try {
      const { memoryId } = req.params;
      const authenticatedUserId = req.user?.id;

      if (!memoryId) {
        res.status(400).json({ error: 'Missing memoryId parameter' });
        return;
      }

      if (!authenticatedUserId) {
        res.status(401).json({ error: 'Unauthorized - No user context' });
        return;
      }

      const existing = await SupabaseService.getInstance().getMemoryById(memoryId);
      if (!existing) {
        res.status(404).json({ error: 'Memory not found' });
        return;
      }

      if (existing.user_id !== authenticatedUserId) {
        res.status(403).json({ error: 'Forbidden - Memory does not belong to current user' });
        return;
      }

      const success = await SupabaseService.getInstance().deleteMemory(memoryId);

      if (!success) {
        res.status(404).json({ error: 'Memory not found or deletion failed' });
        return;
      }

      res.json({ success: true, message: 'Memory deleted successfully' });
    } catch (error) {
      console.error('Error in deleteMemory:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // GET /api/memory/hotwords/:userId - Extract hotwords from user sessions
  async getHotwords(req: Request, res: Response): Promise<void> {
    try {
      // validateUserId 中间件已验证 userId 与 token 匹配
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({ error: 'Missing userId parameter' });
        return;
      }

      markCompatMemorySlice(res, '/api/memory/hotwords/:userId');
      const hotwords = await SupabaseService.getInstance().extractHotwords(userId);

      res.json({ hotwords, count: hotwords.length });
    } catch (error) {
      console.error('Error in getHotwords:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // GET /api/memory/stats/:userId - Get user statistics
  async getUserStats(req: Request, res: Response): Promise<void> {
    try {
      // validateUserId 中间件已验证 userId 与 token 匹配
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({ error: 'Missing userId parameter' });
        return;
      }

      markCompatMemorySlice(res, '/api/memory/stats/:userId');
      const stats = await SupabaseService.getInstance().getUserStats(userId);

      res.json(stats);
    } catch (error) {
      console.error('Error in getUserStats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export const memoryController = new MemoryController();
