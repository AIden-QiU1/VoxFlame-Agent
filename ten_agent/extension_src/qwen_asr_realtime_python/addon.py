from ten_runtime import Addon, TenEnv, register_addon_as_extension

from .extension import QwenRealtimeASRExtension


@register_addon_as_extension("qwen_asr_realtime_python")
class QwenRealtimeASRExtensionAddon(Addon):
    def on_create_instance(self, ten_env: TenEnv, name: str, context) -> None:
        ten_env.log_info("QwenRealtimeASRExtensionAddon on_create_instance")
        ten_env.on_create_instance_done(
            QwenRealtimeASRExtension(name), context
        )
