import { Router } from 'express';
import { ossService } from '../services/oss.service';
import { uploadArtifactService } from '../services/upload-artifact.service';
import {
    datasetReviewService,
    type DatasetEvaluationStatus,
    type DatasetExportReviewStatus,
    type DatasetReviewPriority,
    type DatasetReviewQueue,
} from '../services/dataset-review.service';

const router = Router();

/**
 * POST /api/upload/sign
 * Generate a signed URL for client-side upload
 */
router.post('/sign', async (req, res) => {
    try {
        const { filename, contentType } = req.body;

        if (!filename || !contentType) {
            return res.status(400).json({ error: 'Missing filename or contentType' });
        }

        const url = await ossService.generateUploadUrl(filename, contentType);

        if (!url) {
            return res.status(503).json({ error: 'OSS service unavailable' });
        }

        res.json({ url });
    } catch (error: any) {
        console.error('[Upload] Sign error:', error.message);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

/**
 * POST /api/upload/complete
 * Notify backend that upload is finished. 
 * 1. Insert into Database
 * 2. Append to OSS transcript manifest
 */
router.post('/complete', async (req, res) => {
    try {
        const {
            audioPath,
            text,
            recognizedText,
            sentenceId,
            duration,
            source,
            metadata
        } = req.body;
        const contributorId = req.user?.id;

        if (!contributorId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const result = await uploadArtifactService.persistCompletedUpload({
            contributorId,
            audioPath,
            text,
            recognizedText: typeof recognizedText === 'string' ? recognizedText : null,
            sentenceId,
            duration: typeof duration === 'number' ? duration : null,
            source,
            metadata: metadata || {},
        });

        console.log(
            `[Upload] Persisted audioPath=${audioPath} target="${text}" contributionId=${result.contributionId ?? 'null'} reusedContribution=${result.reusedContribution} manifestAlreadySynced=${result.manifestAlreadySynced} transcriptAlreadySynced=${result.transcriptAlreadySynced ?? 'n/a'}`,
        );

        res.json({
            success: true,
            contributionId: result.contributionId,
            recordingId: result.recordingId,
            manifestPath: result.manifestPath,
            reusedContribution: result.reusedContribution,
            manifestAlreadySynced: result.manifestAlreadySynced,
            transcriptAlreadySynced: result.transcriptAlreadySynced,
        });

    } catch (error: any) {
        console.error('[Upload] Complete error:', error.message);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

router.get('/review-queue', async (req, res) => {
    try {
        const contributorId = req.user?.id;

        if (!contributorId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const evaluationStatus = typeof req.query.evaluation_status === 'string'
            ? req.query.evaluation_status as DatasetEvaluationStatus | 'all'
            : 'all';
        const exportReviewStatus = typeof req.query.export_status === 'string'
            ? req.query.export_status as DatasetExportReviewStatus | 'all'
            : 'all';
        const limit = typeof req.query.limit === 'string'
            ? parseInt(req.query.limit, 10)
            : 20;

        const items = await datasetReviewService.listQueue({
            contributorId,
            evaluationStatus,
            exportReviewStatus,
            limit: Number.isFinite(limit) ? limit : 20,
        });

        res.json({
            items,
            count: items.length,
            filters: {
                evaluationStatus,
                exportReviewStatus,
            },
        });
    } catch (error: any) {
        console.error('[Upload] Review queue error:', error.message);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

router.patch('/review-queue/:contributionId', async (req, res) => {
    try {
        const contributorId = req.user?.id;
        const { contributionId } = req.params;

        if (!contributorId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!contributionId) {
            return res.status(400).json({ error: 'Missing contributionId' });
        }

        const {
            evaluationStatus,
            reviewQueue,
            reviewPriority,
            reviewRequired,
            reviewSummary,
            reviewReasonTags,
            acceptedForExport,
            rejectionReason,
            reviewer,
            reviewedAt,
        } = req.body as {
            evaluationStatus?: DatasetEvaluationStatus;
            reviewQueue?: DatasetReviewQueue;
            reviewPriority?: DatasetReviewPriority;
            reviewRequired?: boolean;
            reviewSummary?: string | null;
            reviewReasonTags?: string[];
            acceptedForExport?: boolean | null;
            rejectionReason?: string | null;
            reviewer?: string | null;
            reviewedAt?: string | null;
        };

        const item = await datasetReviewService.updateDecision({
            contributionId,
            contributorId,
            evaluationStatus,
            reviewQueue,
            reviewPriority,
            reviewRequired,
            reviewSummary,
            reviewReasonTags: Array.isArray(reviewReasonTags)
                ? reviewReasonTags.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
                : undefined,
            acceptedForExport:
                typeof acceptedForExport === 'boolean'
                    ? acceptedForExport
                    : acceptedForExport === null
                        ? null
                        : undefined,
            rejectionReason: typeof rejectionReason === 'string' || rejectionReason === null
                ? rejectionReason
                : undefined,
            reviewer: typeof reviewer === 'string' || reviewer === null
                ? reviewer
                : undefined,
            reviewedAt: typeof reviewedAt === 'string' || reviewedAt === null
                ? reviewedAt
                : undefined,
        });

        if (!item) {
            return res.status(404).json({ error: 'Contribution not found' });
        }

        res.json({ success: true, item });
    } catch (error: any) {
        console.error('[Upload] Review queue update error:', error.message);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

export const uploadRouter = router;
