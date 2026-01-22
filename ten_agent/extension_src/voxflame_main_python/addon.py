#
# VoxFlame Main Control Extension Addon
# Registers the extension with TEN Framework
#

from ten_runtime import (
    Addon,
    register_addon_as_extension,
    TenEnv,
)


@register_addon_as_extension("voxflame_main_python")
class VoxFlameMainExtensionAddon(Addon):
    def on_create_instance(self, ten_env: TenEnv, name: str, context) -> None:
        from .extension import VoxFlameMainExtension
        ten_env.log_info("VoxFlameMainExtensionAddon on_create_instance")
        ten_env.on_create_instance_done(VoxFlameMainExtension(name), context)
