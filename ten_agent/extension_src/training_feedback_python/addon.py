from ten_runtime import Addon, TenEnv, register_addon_as_extension


@register_addon_as_extension("training_feedback_python")
class TrainingFeedbackExtensionAddon(Addon):
    def on_create_instance(self, ten_env: TenEnv, name: str, context) -> None:
        from .extension import TrainingFeedbackExtension

        ten_env.log_info("TrainingFeedbackExtensionAddon on_create_instance")
        ten_env.on_create_instance_done(TrainingFeedbackExtension(name), context)

