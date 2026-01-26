import { Router } from 'express';
import { ossService } from '../services/oss.service';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// Init Supabase (Service Role for backend)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey)
    : null;

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
            contributorId,
            audioPath,
            text,
            sentenceId,
            duration,
            source,
            metadata
        } = req.body;

        console.log(`[Upload] Complete: ${audioPath} (${text})`);

        // 1. Insert into Supabase
        if (supabase) {
            const { error } = await supabase
                .from('voice_contributions')
                .insert({
                    contributor_id: contributorId,
                    audio_path: audioPath,
                    transcript: text,
                    sentence_id: sentenceId || null,
                    is_free_recording: source !== 'guided_recording',
                    duration_seconds: duration,
                    metadata: metadata || {}
                });

            if (error) {
                console.error('[Upload] DB Insert Error:', error);
                // Return 200 anyway? Or fail? 
                // If DB fails, we might want to retry.
                throw new Error(error.message);
            }
        } else {
            console.warn('[Upload] Supabase not configured, skipping DB insert');
        }

        // 2. Append to OSS Transcript Log
        // Format: UttID <tab> Path <tab> Text
        // Utterance ID must be unique. We use the filename (without extension).
        if (source === 'guided_recording' && sentenceId) {
            const fileName = audioPath.split('/').pop() || `${sentenceId}_${Date.now()}.wav`;
            const uttId = fileName.replace(/\.[^/.]+$/, ""); // Remove extension

            // Label file: dataset/{user_id}/transcripts.txt
            const line = `${uttId}\t${audioPath}\t${text}`;
            await ossService.appendTextLog(`dataset/${contributorId}/transcripts.txt`, line);
        }

        res.json({ success: true });

    } catch (error: any) {
        console.error('[Upload] Complete error:', error.message);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

export const uploadRouter = router;
