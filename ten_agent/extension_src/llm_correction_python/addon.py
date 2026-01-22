#
# VoxFlame LLM Correction Extension
# Copyright (c) 2025 VoxFlame. All rights reserved.
#
from ten_runtime import (
    Addon,
    register_addon_as_extension,
    TenEnv,
)


@register_addon_as_extension("llm_correction_python")
class LLMCorrectionExtensionAddon(Addon):
    def on_create_instance(self, ten_env: TenEnv, name: str, context) -> None:
        from .extension import LLMCorrectionExtension

        ten_env.log_info("LLMCorrectionExtensionAddon on_create_instance")
        ten_env.on_create_instance_done(LLMCorrectionExtension(name), context)
