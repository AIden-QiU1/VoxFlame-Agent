from __future__ import annotations

import asyncio
import json
import logging
import os

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import AgentServer, AutoSubscribe, JobContext, cli

from assistant_runtime import (
    AssistantReplyGenerationError,
    CommunicationAssistantRuntime,
    estimate_clarity_score,
)
from asr_runtime import LiveKitASRRuntime
from config import load_config, should_bypass_proxy_for_livekit
from data_contract import (
    build_audio_input_telemetry_output,
    build_assistant_text_output,
    build_error_output,
    build_session_init_ack,
    build_session_userdata_ack,
    build_speech_activity_output,
    build_voice_profile_updated_output,
    extract_caption_mode_update,
    decode_data_packet,
    extract_end_audio_reason,
    extract_user_text_input,
)
from session_context import build_session_context
from session_userdata import build_session_userdata
from tts_runtime import LiveKitAudioReplyRuntime

load_dotenv()

logger = logging.getLogger("voxflame-livekit-agent")
config = load_config()
logging.basicConfig(level=getattr(logging, config.log_level.upper(), logging.INFO))
REPLY_QUEUE_MAXSIZE = 8


def _sanitize_proxy_env_for_local_livekit() -> None:
    if not should_bypass_proxy_for_livekit(config.livekit_url):
        return

    for key in (
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "http_proxy",
        "https_proxy",
        "ALL_PROXY",
        "all_proxy",
    ):
        os.environ.pop(key, None)

    no_proxy_hosts = {"127.0.0.1", "localhost", "livekit-server"}
    for key in ("NO_PROXY", "no_proxy"):
        current = os.environ.get(key, "")
        merged = {host.strip() for host in current.split(",") if host.strip()}
        merged.update(no_proxy_hosts)
        os.environ[key] = ",".join(sorted(merged))


_sanitize_proxy_env_for_local_livekit()

# Self-hosted LiveKit worker registration should bypass shell-level HTTP proxies.
# The default AgentServer behavior inherits HTTP_PROXY/HTTPS_PROXY, which caused
# local `/agent` websocket registration to be routed to 127.0.0.1:7897 and fail.
server = AgentServer(http_proxy=None)


@server.on("worker_started")
def _on_worker_started() -> None:
    logger.info("LiveKit worker started agent_name=%s", config.agent_name)


@server.on("worker_registered")
def _on_worker_registered(worker_id: str, server_info: object) -> None:
    protocol = getattr(server_info, "protocol", None)
    region = getattr(server_info, "region", None)
    logger.info(
        "LiveKit worker registered agent_name=%s worker_id=%s protocol=%s region=%s",
        config.agent_name,
        worker_id,
        protocol,
        region,
    )


@server.rtc_session(agent_name=config.agent_name)
async def entrypoint(ctx: JobContext) -> None:
    ctx.log_context_fields = {
        "room": ctx.room.name,
        "agent_name": config.agent_name,
    }

    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    participant = await ctx.wait_for_participant()

    session_context = build_session_context(
        room_name=ctx.room.name,
        participant_identity=participant.identity,
        participant_name=participant.name,
        metadata=participant.metadata,
        job_metadata=ctx.job.metadata,
        attributes=participant.attributes,
    )

    logger.info(
        "LiveKit session connected room=%s participant=%s mode=%s surface=%s scene=%s strategy=%s request_id=%s",
        session_context.room_name,
        session_context.participant_identity,
        session_context.mode,
        session_context.surface,
        session_context.scene,
        session_context.session_strategy,
        session_context.request_id,
    )
    session_userdata = build_session_userdata(session_context)
    logger.info(
        "LiveKit session userdata prepared room=%s participant=%s source=%s scene=%s reference_lines=%s training_pairs=%s support_strategies=%s",
        session_context.room_name,
        session_context.participant_identity,
        session_userdata.preparation.source,
        session_userdata.preparation.scene,
        len(session_userdata.preparation.reference_lines),
        len(session_userdata.preparation.training_pairs),
        len(session_userdata.preparation.support_strategies),
    )
    assistant_runtime = CommunicationAssistantRuntime(
        config=config,
        ctx=session_context,
        userdata=session_userdata,
    )
    audio_runtime = LiveKitAudioReplyRuntime(config=config, room=ctx.room)
    reply_queue: asyncio.Queue[tuple[str, str | None]] = asyncio.Queue(
        maxsize=REPLY_QUEUE_MAXSIZE,
    )

    async def publish_payload(payload: dict[str, object]) -> None:
        await ctx.room.local_participant.publish_data(
            json.dumps(payload, ensure_ascii=True).encode("utf-8"),
            reliable=True,
            topic=ctx.room.name,
        )

    async def handle_speech_activity(state: str, auto_finalize: bool) -> None:
        interruption_requested = False

        if state == "barge_in_triggered":
            interrupted = await audio_runtime.interrupt()
            interruption_requested = interrupted
            logger.info(
                "LiveKit barge-in room=%s participant=%s interrupted_tts=%s",
                session_context.room_name,
                session_context.participant_identity,
                interrupted,
            )

        session_userdata.note_speech_activity(state, interruption_requested)

        await publish_payload(
            build_speech_activity_output(
                session_context,
                state=state,
                auto_finalize=auto_finalize,
                interruption_requested=interruption_requested,
                speech_duration_ms=0,
            ),
        )

    async def handle_audio_input_telemetry(
        normalized_level: float,
        peak_level: float,
        clipping_detected: bool,
        apm_enabled: bool,
        reason: str,
    ) -> None:
        await publish_payload(
            build_audio_input_telemetry_output(
                session_context,
                normalized_level=normalized_level,
                peak_level=peak_level,
                clipping_detected=clipping_detected,
                apm_enabled=apm_enabled,
                reason=reason,
            ),
        )

    async def process_user_text(
        user_text: str,
        *,
        correction_original: str | None = None,
    ) -> None:
        try:
            reply_text, source = await assistant_runtime.generate_reply(user_text)
        except AssistantReplyGenerationError as exc:
            logger.warning(
                "LiveKit assistant correction unavailable room=%s participant=%s code=%s detail=%s",
                session_context.room_name,
                session_context.participant_identity,
                exc.code,
                exc.detail,
            )
            await publish_payload(build_error_output(exc.user_message))
            return

        logger.info(
            "LiveKit assistant reply prepared room=%s participant=%s source=%s chars=%s",
            session_context.room_name,
            session_context.participant_identity,
            source,
            len(reply_text),
        )
        await publish_payload(
            build_assistant_text_output(
                session_context,
                reply_text,
                source=source,
                metadata_type="correction" if correction_original else "assistant_text_output",
                original_text=correction_original,
            ),
        )
        if correction_original:
            clarity_score = estimate_clarity_score(correction_original, reply_text)
            await publish_payload(
                build_voice_profile_updated_output(
                    session_context,
                    source="livekit_correction",
                    clarity_score=clarity_score,
                    confusion_patterns_count=1 if correction_original != reply_text else 0,
                ),
            )
        if session_userdata.caption_mode_enabled:
            logger.info(
                "LiveKit caption mode active, skipping TTS room=%s participant=%s",
                session_context.room_name,
                session_context.participant_identity,
            )
            return

        await audio_runtime.speak(reply_text)

    async def reply_worker() -> None:
        while True:
            user_text, correction_original = await reply_queue.get()
            try:
                await process_user_text(
                    user_text,
                    correction_original=correction_original,
                )
            except Exception:
                logger.exception(
                    "LiveKit reply worker failed room=%s participant=%s",
                    session_context.room_name,
                    session_context.participant_identity,
                )
            finally:
                reply_queue.task_done()

    def enqueue_user_text(
        user_text: str,
        *,
        correction_original: str | None = None,
    ) -> None:
        normalized = user_text.strip()
        if not normalized:
            return

        if reply_queue.full():
            try:
                dropped_text, _ = reply_queue.get_nowait()
            except asyncio.QueueEmpty:
                dropped_text = ""
            else:
                reply_queue.task_done()
                logger.warning(
                    "LiveKit reply queue full, dropped oldest pending transcript room=%s participant=%s chars=%s",
                    session_context.room_name,
                    session_context.participant_identity,
                    len(dropped_text),
                )

        try:
            reply_queue.put_nowait((normalized, correction_original))
        except asyncio.QueueFull:
            logger.warning(
                "LiveKit reply queue still full, dropped latest transcript room=%s participant=%s chars=%s",
                session_context.room_name,
                session_context.participant_identity,
                len(normalized),
            )
            return

        logger.info(
            "LiveKit transcript enqueued room=%s participant=%s queue_size=%s chars=%s",
            session_context.room_name,
            session_context.participant_identity,
            reply_queue.qsize(),
            len(normalized),
        )

    async def enqueue_user_text_async(
        user_text: str,
        *,
        correction_original: str | None = None,
    ) -> None:
        enqueue_user_text(
            user_text,
            correction_original=correction_original,
        )

    asr_runtime = LiveKitASRRuntime(
        config=config,
        ctx=session_context,
        participant=participant,
        publish_payload=publish_payload,
        on_final_transcript=lambda transcript: enqueue_user_text_async(
            transcript,
            correction_original=transcript,
        ),
        on_speech_activity=handle_speech_activity,
        on_audio_telemetry=handle_audio_input_telemetry,
    )
    await asr_runtime.start()
    asyncio.create_task(reply_worker())

    async def publish_init_ack() -> None:
        await publish_payload(build_session_init_ack(session_context))
        await publish_payload(
            build_session_userdata_ack(session_context, session_userdata.preparation),
        )

    @ctx.room.on("data_received")
    def _on_data_received(packet: rtc.DataPacket) -> None:
        if packet.topic != ctx.room.name:
            return
        if packet.participant is None:
            return
        if packet.participant.identity != session_context.participant_identity:
            return

        message = decode_data_packet(packet.data)
        if not message:
            return

        logger.info(
            "LiveKit room data received room=%s participant=%s type=%s",
            session_context.room_name,
            session_context.participant_identity,
            str(message.get("type", "") or "unknown"),
        )

        user_text = extract_user_text_input(message)
        if user_text:
            logger.info(
                "LiveKit user text input room=%s participant=%s chars=%s preview=%s",
                session_context.room_name,
                session_context.participant_identity,
                len(user_text),
                user_text[:80],
            )
            enqueue_user_text(user_text)
            return

        caption_mode_enabled = extract_caption_mode_update(message)
        if caption_mode_enabled is not None:
            session_userdata.set_caption_mode(caption_mode_enabled)
            logger.info(
                "LiveKit caption mode updated room=%s participant=%s enabled=%s",
                session_context.room_name,
                session_context.participant_identity,
                caption_mode_enabled,
            )
            if caption_mode_enabled:
                asyncio.create_task(audio_runtime.interrupt())
            return

        end_audio_reason = extract_end_audio_reason(message)
        if end_audio_reason:
            logger.info(
                "LiveKit end_audio received room=%s participant=%s reason=%s",
                session_context.room_name,
                session_context.participant_identity,
                end_audio_reason,
            )
            asyncio.create_task(asr_runtime.commit_audio(end_audio_reason))

    await publish_init_ack()

    logger.info(
        "LiveKit minimal data contract ready room=%s participant=%s",
        session_context.room_name,
        session_context.participant_identity,
    )


if __name__ == "__main__":
    cli.run_app(server)
