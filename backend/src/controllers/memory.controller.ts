import { Request, Response } from 'express';
import {
  SupabaseService,
  CommunicationPreferences,
  Memory,
  Session,
  HotwordProfileRecord,
  UserProfileMemoryRecord,
  normalizeCommunicationPreferences,
} from '../services/supabase.service';
import { MemoryMaintenanceService } from '../services/memory-maintenance.service';
import { normalizeWorkspaceSceneId } from '../services/expression-kit.service';

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

interface MemorySessionCloseRequestBody {
  user_id?: string;
  session_id?: string;
  session?: Partial<Session>;
  profile_update?: UserProfileMemoryRecord;
}

interface MemoryHotwordSyncRequestBody {
  user_id?: string;
  profiles?: HotwordProfileRecord[];
}

interface MemorySceneTemplateSelectionRequestBody {
  user_id?: string;
  selected_template_ids?: string[];
}

interface MemoryCommunicationPreferencesRequestBody {
  user_id?: string;
  communication_preferences?: CommunicationPreferences;
}

interface MemoryPreparedExpressionRequestBody {
  user_id?: string;
  title?: string;
  scene?: string | null;
  source?: string | null;
  content?: string;
}

interface MemoryPreparedExpressionSummarizeRequestBody {
  user_id?: string;
  trigger?: 'manual' | 'periodic_auto';
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
  private readonly memoryMaintenanceService = new MemoryMaintenanceService();

  async getPreparedExpressionAsset(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedUserId = req.user?.id;
      const { userId } = req.params;

      if (!authenticatedUserId) {
        res.status(401).json({ error: 'Unauthorized - No user context' });
        return;
      }

      if (!userId || userId !== authenticatedUserId) {
        res.status(403).json({ error: 'Forbidden - User ID mismatch' });
        return;
      }

      const asset = await SupabaseService.getInstance().getPreparedExpressionAsset(authenticatedUserId);
      res.json({ prepared_expression_asset: asset });
    } catch (error) {
      console.error('Error in getPreparedExpressionAsset:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async syncPreparedExpressionAsset(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedUserId = req.user?.id;
      const { userId } = req.params;
      const {
        user_id,
        title,
        scene,
        source,
        content,
      } = req.body as MemoryPreparedExpressionRequestBody;

      if (!authenticatedUserId) {
        res.status(401).json({ error: 'Unauthorized - No user context' });
        return;
      }

      if (!userId || userId !== authenticatedUserId || (user_id && user_id !== authenticatedUserId)) {
        res.status(403).json({ error: 'Forbidden - User ID mismatch' });
        return;
      }

      if (!content || !content.trim()) {
        res.status(400).json({ error: 'Missing required field: content' });
        return;
      }

      const asset = await SupabaseService.getInstance().savePreparedExpressionAsset(
        authenticatedUserId,
        {
          title,
          scene,
          source,
          content,
        },
      );

      if (!asset) {
        res.status(500).json({ error: 'Failed to save prepared expression asset' });
        return;
      }

      res.json({ prepared_expression_asset: asset });
    } catch (error) {
      console.error('Error in syncPreparedExpressionAsset:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async deletePreparedExpressionAsset(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedUserId = req.user?.id;
      const { userId } = req.params;

      if (!authenticatedUserId) {
        res.status(401).json({ error: 'Unauthorized - No user context' });
        return;
      }

      if (!userId || userId !== authenticatedUserId) {
        res.status(403).json({ error: 'Forbidden - User ID mismatch' });
        return;
      }

      await SupabaseService.getInstance().deletePreparedExpressionAsset(authenticatedUserId);
      res.status(204).send();
    } catch (error) {
      console.error('Error in deletePreparedExpressionAsset:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async summarizePreparedExpressionAsset(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedUserId = req.user?.id;
      const { userId } = req.params;
      const {
        user_id,
        trigger,
      } = req.body as MemoryPreparedExpressionSummarizeRequestBody;

      if (!authenticatedUserId) {
        res.status(401).json({ error: 'Unauthorized - No user context' });
        return;
      }

      if (!userId || userId !== authenticatedUserId || (user_id && user_id !== authenticatedUserId)) {
        res.status(403).json({ error: 'Forbidden - User ID mismatch' });
        return;
      }

      const asset = await SupabaseService.getInstance().summarizePreparedExpressionAsset(
        authenticatedUserId,
        trigger === 'periodic_auto' ? 'periodic_auto' : 'manual',
      );

      if (!asset) {
        res.status(400).json({ error: 'Missing prepared expression asset' });
        return;
      }

      res.json({ prepared_expression_asset: asset });
    } catch (error) {
      console.error('Error in summarizePreparedExpressionAsset:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // PUT /api/memory/workspace/:userId/preferences - Persist durable communication preferences via workspace owner
  async syncCommunicationPreferences(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedUserId = req.user?.id;
      const { userId } = req.params;
      const {
        user_id,
        communication_preferences,
      } = req.body as MemoryCommunicationPreferencesRequestBody;

      if (!authenticatedUserId) {
        res.status(401).json({ error: 'Unauthorized - No user context' });
        return;
      }

      if (!userId) {
        res.status(400).json({ error: 'Missing userId parameter' });
        return;
      }

      if (userId !== authenticatedUserId || (user_id && user_id !== authenticatedUserId)) {
        console.warn(`[MemoryController] User ID mismatch: token=${authenticatedUserId}, param=${userId}, body=${user_id}`);
        res.status(403).json({ error: 'Forbidden - User ID mismatch' });
        return;
      }

      const savedPreferences = await SupabaseService.getInstance().saveCommunicationPreferences(
        authenticatedUserId,
        normalizeCommunicationPreferences(communication_preferences),
      );

      res.json({
        communication_preferences: savedPreferences,
      });
    } catch (error) {
      console.error('Error in syncCommunicationPreferences:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getSceneTemplates(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedUserId = req.user?.id;
      const { userId } = req.params;

      if (!authenticatedUserId) {
        res.status(401).json({ error: 'Unauthorized - No user context' });
        return;
      }

      if (!userId || userId !== authenticatedUserId) {
        res.status(403).json({ error: 'Forbidden - User ID mismatch' });
        return;
      }

      const service = SupabaseService.getInstance();
      const [selectedTemplateIds, library] = await Promise.all([
        service.getSelectedSceneTemplateIds(authenticatedUserId),
        Promise.resolve(service.getSceneTemplateCatalog()),
      ]);

      res.json({
        selected_template_ids: selectedTemplateIds,
        library,
      });
    } catch (error) {
      console.error('Error in getSceneTemplates:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async syncSceneTemplates(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedUserId = req.user?.id;
      const { userId } = req.params;
      const {
        user_id,
        selected_template_ids,
      } = req.body as MemorySceneTemplateSelectionRequestBody;

      if (!authenticatedUserId) {
        res.status(401).json({ error: 'Unauthorized - No user context' });
        return;
      }

      if (!userId || userId !== authenticatedUserId || (user_id && user_id !== authenticatedUserId)) {
        res.status(403).json({ error: 'Forbidden - User ID mismatch' });
        return;
      }

      if (!Array.isArray(selected_template_ids)) {
        res.status(400).json({ error: 'Missing required field: selected_template_ids[]' });
        return;
      }

      const savedIds = await SupabaseService.getInstance().saveSelectedSceneTemplateIds(
        authenticatedUserId,
        selected_template_ids,
      );

      res.json({
        selected_template_ids: savedIds,
      });
    } catch (error) {
      console.error('Error in syncSceneTemplates:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // POST /api/memory/hotwords - Replace structured custom hotword profiles
  async syncHotwords(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedUserId = req.user?.id;
      const { user_id, profiles } = req.body as MemoryHotwordSyncRequestBody;

      if (!authenticatedUserId) {
        res.status(401).json({ error: 'Unauthorized - No user context' });
        return;
      }

      if (user_id && user_id !== authenticatedUserId) {
        console.warn(`[MemoryController] User ID mismatch: token=${authenticatedUserId}, body=${user_id}`);
        res.status(403).json({ error: 'Forbidden - User ID mismatch' });
        return;
      }

      if (!Array.isArray(profiles)) {
        res.status(400).json({ error: 'Missing required field: profiles[]' });
        return;
      }

      const savedProfiles = await SupabaseService.getInstance().saveHotwordProfiles(
        authenticatedUserId,
        profiles,
      );

      res.json({
        profiles: savedProfiles,
        hotwords: savedProfiles.map((profile) => profile.phrase),
        count: savedProfiles.length,
      });
    } catch (error) {
      console.error('Error in syncHotwords:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

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

  // POST /api/memory/add - Add new memory from runtime agent / background sync
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

  // POST /api/memory/session-close - Persist session-close user profile update via backend durable owner
  async persistSessionCloseProfileUpdate(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedUserId = req.user?.id;
      const {
        user_id,
        session_id,
        session,
        profile_update,
      } = req.body as MemorySessionCloseRequestBody;

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
      const updatedAt = profile_update?.updated_at || new Date().toISOString();

      if (!resolvedSessionId) {
        res.status(400).json({ error: 'Missing required field: session_id' });
        return;
      }

      if (
        !profile_update?.summary &&
        !(profile_update?.common_scenarios && profile_update.common_scenarios.length > 0) &&
        !(profile_update?.risky_terms && profile_update.risky_terms.length > 0) &&
        !(profile_update?.support_strategies && profile_update.support_strategies.length > 0)
      ) {
        res.status(400).json({ error: 'Missing required field: profile_update' });
        return;
      }

      const service = SupabaseService.getInstance();
      const sessionPayload = buildSessionPayload(
        safeUserId,
        resolvedSessionId,
        undefined,
        session,
        updatedAt,
      );
      const ensuredSession = await service.ensureSession(sessionPayload);

      if (!ensuredSession?.id) {
        res.status(500).json({ error: 'Failed to ensure session before updating user profile memory' });
        return;
      }

      const existingProfileMemory = await service.getUserProfileMemory(safeUserId);
      const maintainedProfileMemory = await this.memoryMaintenanceService.maintain({
        existingProfile: existingProfileMemory,
        proposedUpdate: {
          ...profile_update,
          updated_at: updatedAt,
        },
        session: {
          ...sessionPayload,
          id: ensuredSession.id,
        },
      });
      const userProfileMemory = await service.updateUserProfileMemory(safeUserId, {
        ...maintainedProfileMemory,
        updated_at: updatedAt,
      });

      res.status(201).json({
        session_id: ensuredSession.id,
        user_profile_memory: userProfileMemory,
      });
    } catch (error) {
      console.error('Error in persistSessionCloseProfileUpdate:', error);
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

  // GET /api/memory/workspace/:userId - Workspace-ready profile bundle + session review + expression kit
  async getWorkspaceMemorySnapshot(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const sceneId = normalizeWorkspaceSceneId(req.query.scene);

      if (!userId) {
        res.status(400).json({ error: 'Missing userId parameter' });
        return;
      }

      const snapshot = await SupabaseService.getInstance().getWorkspaceMemorySnapshot(userId, {
        sceneId,
      });
      res.json(snapshot);
    } catch (error) {
      console.error('Error in getWorkspaceMemorySnapshot:', error);
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

}

export const memoryController = new MemoryController();
