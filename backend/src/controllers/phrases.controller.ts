/**
 * 常用短语控制器
 *
 * 提供短语的 CRUD 操作和 TTS 预生成功能
 *
 * 安全：所有操作都需要认证，user_id 从 token 中获取
 */

import { Request, Response } from 'express'
import { SupabaseService, QuickPhrase } from '../services/supabase.service'

export class PhrasesController {
  /**
   * POST /api/phrases - 创建新短语
   */
  async createPhrase(req: Request, res: Response): Promise<void> {
    try {
      // 从认证中间件获取用户 ID
      const authenticatedUserId = req.user?.id
      const { user_id, text, category } = req.body

      if (!authenticatedUserId) {
        res.status(401).json({ error: '未授权 - 无用户上下文' })
        return
      }

      // 安全检查：确保 user_id 与 token 匹配
      if (user_id && user_id !== authenticatedUserId) {
        console.warn(`[PhrasesController] User ID mismatch: token=${authenticatedUserId}, body=${user_id}`)
        res.status(403).json({ error: '禁止访问 - User ID 不匹配' })
        return
      }

      // 使用认证后的 user_id
      const safeUserId = authenticatedUserId

      if (!text || !category) {
        res.status(400).json({ error: '缺少必填字段: text, category' })
        return
      }

      // 获取用户当前最大 order_index
      const existingPhrases = await SupabaseService.getInstance().getUserPhrases(safeUserId)
      const maxOrder = existingPhrases.reduce((max, p) => Math.max(max, p.order_index || 0), 0)

      const phrase: Omit<QuickPhrase, 'id' | 'created_at' | 'updated_at'> = {
        user_id: safeUserId,
        text: text.trim(),
        category,
        usage_count: 0,
        order_index: maxOrder + 1,
      }

      const created = await SupabaseService.getInstance().createPhrase(phrase)

      if (!created) {
        res.status(500).json({ error: '创建短语失败' })
        return
      }

      res.status(201).json(created)
    } catch (error) {
      console.error('Error in createPhrase:', error)
      res.status(500).json({ error: '服务器内部错误' })
    }
  }

  /**
   * GET /api/phrases/user/:userId - 获取用户所有短语
   * validateUserId 中间件已验证 userId 与 token 匹配
   */
  async getUserPhrases(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params
      const { category, limit } = req.query

      if (!userId) {
        res.status(400).json({ error: '缺少 userId 参数' })
        return
      }

      const phrases = await SupabaseService.getInstance().getUserPhrases(
        userId,
        category as string,
        limit ? parseInt(limit as string) : undefined
      )

      res.json({ phrases, count: phrases.length })
    } catch (error) {
      console.error('Error in getUserPhrases:', error)
      res.status(500).json({ error: '服务器内部错误' })
    }
  }

  /**
   * PUT /api/phrases/:phraseId - 更新短语
   */
  async updatePhrase(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedUserId = req.user?.id
      const { phraseId } = req.params
      const { text, category, order_index } = req.body

      if (!authenticatedUserId) {
        res.status(401).json({ error: '未授权 - 无用户上下文' })
        return
      }

      if (!phraseId) {
        res.status(400).json({ error: '缺少 phraseId 参数' })
        return
      }

      const updates: Partial<QuickPhrase> = {}
      if (text !== undefined) updates.text = text.trim()
      if (category !== undefined) updates.category = category
      if (order_index !== undefined) updates.order_index = order_index

      const updated = await SupabaseService.getInstance().updatePhrase(
        phraseId,
        authenticatedUserId,
        updates,
      )

      if (!updated) {
        res.status(404).json({ error: '短语不存在或更新失败' })
        return
      }

      res.json(updated)
    } catch (error) {
      console.error('Error in updatePhrase:', error)
      res.status(500).json({ error: '服务器内部错误' })
    }
  }

  /**
   * DELETE /api/phrases/:phraseId - 删除短语
   */
  async deletePhrase(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedUserId = req.user?.id
      const { phraseId } = req.params

      if (!authenticatedUserId) {
        res.status(401).json({ error: '未授权 - 无用户上下文' })
        return
      }

      if (!phraseId) {
        res.status(400).json({ error: '缺少 phraseId 参数' })
        return
      }

      const success = await SupabaseService.getInstance().deletePhrase(
        phraseId,
        authenticatedUserId,
      )

      if (!success) {
        res.status(404).json({ error: '短语不存在或删除失败' })
        return
      }

      res.json({ success: true, message: '短语已删除' })
    } catch (error) {
      console.error('Error in deletePhrase:', error)
      res.status(500).json({ error: '服务器内部错误' })
    }
  }

  /**
   * POST /api/phrases/:phraseId/use - 记录短语使用
   */
  async incrementUsage(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedUserId = req.user?.id
      const { phraseId } = req.params

      if (!authenticatedUserId) {
        res.status(401).json({ error: '未授权 - 无用户上下文' })
        return
      }

      if (!phraseId) {
        res.status(400).json({ error: '缺少 phraseId 参数' })
        return
      }

      const updated = await SupabaseService.getInstance().incrementPhraseUsage(
        phraseId,
        authenticatedUserId,
      )

      if (!updated) {
        res.status(404).json({ error: '短语不存在或更新失败' })
        return
      }

      res.json(updated)
    } catch (error) {
      console.error('Error in incrementUsage:', error)
      res.status(500).json({ error: '服务器内部错误' })
    }
  }

  /**
   * POST /api/phrases/reorder - 批量更新短语顺序
   */
  async reorderPhrases(req: Request, res: Response): Promise<void> {
    try {
      // 从认证中间件获取用户 ID
      const authenticatedUserId = req.user?.id
      const { user_id, phrase_orders } = req.body

      if (!authenticatedUserId) {
        res.status(401).json({ error: '未授权 - 无用户上下文' })
        return
      }

      // 安全检查：确保 user_id 与 token 匹配
      if (user_id && user_id !== authenticatedUserId) {
        res.status(403).json({ error: '禁止访问 - User ID 不匹配' })
        return
      }

      if (!Array.isArray(phrase_orders)) {
        res.status(400).json({ error: '缺少必填字段: phrase_orders (数组)' })
        return
      }

      // phrase_orders 格式: [{ id: string, order_index: number }, ...]
      const success = await SupabaseService.getInstance().reorderPhrases(
        authenticatedUserId,
        phrase_orders,
      )

      if (!success) {
        res.status(500).json({ error: '批量更新失败' })
        return
      }

      res.json({ success: true, message: '顺序已更新' })
    } catch (error) {
      console.error('Error in reorderPhrases:', error)
      res.status(500).json({ error: '服务器内部错误' })
    }
  }

  /**
   * POST /api/phrases/presets/initialize - 为用户初始化预设短语
   */
  async initializePresets(req: Request, res: Response): Promise<void> {
    try {
      // 从认证中间件获取用户 ID
      const authenticatedUserId = req.user?.id
      const { user_id } = req.body

      if (!authenticatedUserId) {
        res.status(401).json({ error: '未授权 - 无用户上下文' })
        return
      }

      // 安全检查：确保 user_id 与 token 匹配
      if (user_id && user_id !== authenticatedUserId) {
        res.status(403).json({ error: '禁止访问 - User ID 不匹配' })
        return
      }

      // 使用认证后的 user_id
      const safeUserId = authenticatedUserId

      const phrases = await SupabaseService.getInstance().initializePresetPhrases(safeUserId)

      res.json({
        success: true,
        message: `已初始化 ${phrases.length} 个预设短语`,
        phrases
      })
    } catch (error) {
      console.error('Error in initializePresets:', error)
      res.status(500).json({ error: '服务器内部错误' })
    }
  }
}

export const phrasesController = new PhrasesController()
