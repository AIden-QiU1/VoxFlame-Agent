from ten_runtime import Addon, TenEnv, register_addon_as_extension

from .extension import VoxFlameVADPythonExtension


@register_addon_as_extension("voxflame_vad_python")
class VoxFlameVADPythonExtensionAddon(Addon):
    def on_create_instance(self, ten_env: TenEnv, name: str, context) -> None:
        ten_env.log_info("VoxFlameVADPythonExtensionAddon on_create_instance")
        ten_env.on_create_instance_done(VoxFlameVADPythonExtension(name), context)
