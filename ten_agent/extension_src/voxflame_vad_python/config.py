from pydantic import BaseModel


class VoxFlameVADConfig(BaseModel):
    prefix_padding_ms: int = 120
    silence_duration_ms: int = 720
    vad_threshold: float = 0.018
    hop_size_ms: int = 16
    dump: bool = False
    dump_path: str = ""
