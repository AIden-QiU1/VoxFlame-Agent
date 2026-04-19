import { SupabaseService } from './supabase.service';

export class TrainingReportMaintenanceService {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  start(): void {
    const enabled = (process.env.TRAINING_REPORT_MAINTENANCE_ENABLED ?? '1').trim() !== '0';
    if (!enabled) {
      console.log('[training-report-maintenance] disabled by env');
      return;
    }

    const intervalMs = Math.max(
      5 * 60 * 1000,
      (Number.parseInt(process.env.TRAINING_REPORT_MAINTENANCE_INTERVAL_MS || '900000', 10) || 900000),
    );

    void this.runOnce();
    this.timer = setInterval(() => {
      void this.runOnce();
    }, intervalMs);

    console.log(`[training-report-maintenance] started; interval=${intervalMs}ms`);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runOnce(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    const batchSize = Math.max(
      1,
      Number.parseInt(process.env.TRAINING_REPORT_MAINTENANCE_BATCH_SIZE || '12', 10) || 12,
    );

    try {
      const service = SupabaseService.getInstance();
      const candidateUserIds = await service.listPreparedExpressionSummaryRefreshCandidates(batchSize);
      if (candidateUserIds.length === 0) {
        return;
      }

      for (const userId of candidateUserIds) {
        try {
          await service.summarizePreparedExpressionAsset(userId, 'periodic_auto');
          console.log(`[training-report-maintenance] refreshed ${userId}`);
        } catch (error) {
          console.error(`[training-report-maintenance] failed for ${userId}:`, error);
        }
      }
    } catch (error) {
      console.error('[training-report-maintenance] run failed:', error);
    } finally {
      this.isRunning = false;
    }
  }
}
