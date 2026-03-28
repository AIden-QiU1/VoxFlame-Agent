from ten_runtime import Addon, TenEnv, register_addon_as_extension

from .extension import QwenRealtimeTTSExtension


@register_addon_as_extension("qwen_tts_realtime_python")
class QwenRealtimeTTSExtensionAddon(Addon):
    def on_create_instance(self, ten_env: TenEnv, name: str, context) -> None:
        ten_env.log_info("QwenRealtimeTTSExtensionAddon on_create_instance")
        ten_env.on_create_instance_done(
            QwenRealtimeTTSExtension(name), context
        )
