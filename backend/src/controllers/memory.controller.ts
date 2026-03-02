import { Request, Response } from 'express';
import { SupabaseService, Memory } from '../services/supabase.service';

export class MemoryController {
  // POST /api/memory/add - Add new memory from TEN Agent
  async addMemory(req: Request, res: Response): Promise<void> {
    try {
      // 从认证中间件获取用户 ID
      const authenticatedUserId = req.user?.id
      const { user_id, session_id, content, metadata } = req.body;

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

      if (!session_id || !content) {
        res.status(400).json({ error: 'Missing required fields: session_id, content' });
        return;
      }

      const memory: Memory = {
        user_id: safeUserId,
        session_id,
        content,
        metadata,
        created_at: new Date().toISOString(),
      };

      const created = await SupabaseService.getInstance().addMemory(memory);

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

      // TODO: 添加 memory ownership 验证

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

      // TODO: 添加 memory ownership 验证

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

      const stats = await SupabaseService.getInstance().getUserStats(userId);

      res.json(stats);
    } catch (error) {
      console.error('Error in getUserStats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export const memoryController = new MemoryController();
