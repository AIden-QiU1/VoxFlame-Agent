/**
 * 常用短语控制器
 *
 * 提供短语的 CRUD 操作和 TTS 预生成功能
 */

import { Request, Response } from 'express'
import { SupabaseService, QuickPhrase } from '../services/supabase.service'

export class PhrasesController {
  /**
   * POST /api/phrases - 创建新短语
   */
  async createPhrase(req: Request, res: Response): Promise<void> {
    try {
      const { user_id, text, category } = req.body

      if (!user_id || !text || !category) {
        res.status(400).json({ error: '缺少必填字段: user_id, text, category' })
        return
      }

      // 获取用户当前最大 order_index
      const existingPhrases = await SupabaseService.getInstance().getUserPhrases(user_id)
      const maxOrder = existingPhrases.reduce((max, p) => Math.max(max, p.order_index || 0), 0)

      const phrase: Omit<QuickPhrase, 'id' | 'created_at' | 'updated_at'> = {
        user_id,
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
      const { phraseId } = req.params
      const { text, category, order_index } = req.body

      if (!phraseId) {
        res.status(400).json({ error: '缺少 phraseId 参数' })
        return
      }

      const updates: Partial<QuickPhrase> = {}
      if (text !== undefined) updates.text = text.trim()
      if (category !== undefined) updates.category = category
      if (order_index !== undefined) updates.order_index = order_index

      const updated = await SupabaseService.getInstance().updatePhrase(phraseId, updates)

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
      const { phraseId } = req.params

      if (!phraseId) {
        res.status(400).json({ error: '缺少 phraseId 参数' })
        return
      }

      const success = await SupabaseService.getInstance().deletePhrase(phraseId)

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
      const { phraseId } = req.params

      if (!phraseId) {
        res.status(400).json({ error: '缺少 phraseId 参数' })
        return
      }

      const updated = await SupabaseService.getInstance().incrementPhraseUsage(phraseId)

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
      const { user_id, phrase_orders } = req.body

      if (!user_id || !Array.isArray(phrase_orders)) {
        res.status(400).json({ error: '缺少必填字段: user_id, phrase_orders (数组)' })
        return
      }

      // phrase_orders 格式: [{ id: string, order_index: number }, ...]
      const success = await SupabaseService.getInstance().reorderPhrases(phrase_orders)

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
      const { user_id } = req.body

      if (!user_id) {
        res.status(400).json({ error: '缺少必填字段: user_id' })
        return
      }

      const phrases = await SupabaseService.getInstance().initializePresetPhrases(user_id)

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
