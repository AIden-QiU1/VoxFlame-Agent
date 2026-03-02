#
# Memory Layer Extension Addon
# Registers the extension with TEN Framework
#

from ten_runtime import (
    Addon,
    register_addon_as_extension,
    TenEnv,
)


@register_addon_as_extension("memory_layer_python")
class MemoryLayerExtensionAddon(Addon):
    def on_create_instance(self, ten_env: TenEnv, name: str, context) -> None:
        from .extension import MemoryLayerExtension
        ten_env.log_info("MemoryLayerExtensionAddon on_create_instance")
        ten_env.on_create_instance_done(MemoryLayerExtension(name), context)
