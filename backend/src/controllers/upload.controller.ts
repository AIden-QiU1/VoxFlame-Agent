import { Router } from 'express';
import { ossService } from '../services/oss.service';
import { uploadArtifactService } from '../services/upload-artifact.service';

const router = Router();

/**
 * GET /api/upload/progress
 * Return only identifiers and aggregate durations needed by recording UI.
 */
router.get('/progress', async (req, res) => {
    try {
        const contributorId = req.user?.id;
        if (!contributorId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const rawOffset = Array.isArray(req.query.timezoneOffsetMinutes)
            ? req.query.timezoneOffsetMinutes[0]
            : req.query.timezoneOffsetMinutes;
        const parsedOffset = typeof rawOffset === 'string' ? Number(rawOffset) : 0;
        const timezoneOffsetMinutes = Number.isFinite(parsedOffset) ? parsedOffset : 0;
        const progress = await uploadArtifactService.getRecordingProgress(
            contributorId,
            timezoneOffsetMinutes,
        );

        res.json(progress);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        console.error('[Upload] Progress error:', message);
        res.status(500).json({ error: message });
    }
});

/** Advance one article to a new account-level cycle without deleting audio. */
router.post('/reading/reset', async (req, res) => {
    try {
        const contributorId = req.user?.id;
        if (!contributorId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const articleId = typeof req.body?.articleId === 'string'
            ? req.body.articleId.trim()
            : '';
        if (!/^reading-\d{3}$/.test(articleId)) {
            return res.status(400).json({ error: 'Invalid articleId' });
        }

        const result = await uploadArtifactService.resetReadingArticleProgress(
            contributorId,
            articleId,
        );
        res.json(result);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        console.error('[Upload] Reading reset error:', message);
        res.status(500).json({ error: message });
    }
});

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
            `[Upload] Persisted recordingId=${result.recordingId ?? 'null'} contributionId=${result.contributionId ?? 'null'} reusedContribution=${result.reusedContribution} manifestAlreadySynced=${result.manifestAlreadySynced} transcriptAlreadySynced=${result.transcriptAlreadySynced ?? 'n/a'}`,
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

/**
 * DELETE /api/upload/contribution
 * Remove one training recording from DB/OSS training material.
 */
router.delete('/contribution', async (req, res) => {
    try {
        const {
            contributionId,
            audioPath,
            recordingId,
        } = req.body as {
            contributionId?: unknown;
            audioPath?: unknown;
            recordingId?: unknown;
        };
        const contributorId = req.user?.id;

        if (!contributorId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (
            typeof contributionId !== 'string' &&
            typeof audioPath !== 'string' &&
            typeof recordingId !== 'string'
        ) {
            return res.status(400).json({ error: 'Missing contributionId, audioPath, or recordingId' });
        }

        const result = await uploadArtifactService.discardCompletedUpload({
            contributorId,
            contributionId: typeof contributionId === 'string' ? contributionId : null,
            audioPath: typeof audioPath === 'string' ? audioPath : null,
            recordingId: typeof recordingId === 'string' ? recordingId : null,
        });

        console.log(
            `[Upload] Discarded recordingId=${result.recordingId ?? 'null'} contributionId=${result.contributionId ?? 'null'}`,
        );

        res.json({
            success: true,
            ...result,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        console.error('[Upload] Discard error:', message);
        res.status(500).json({ error: message });
    }
});

export const uploadRouter = router;
