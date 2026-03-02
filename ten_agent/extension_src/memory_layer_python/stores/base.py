#
# Memory Store Base Classes
# Abstract interfaces and data models for memory storage
#

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
import json


@dataclass
class ConfusionPattern:
    """Pronunciation confusion pattern for dysarthric speech"""
    pattern_id: str
    source_phonemes: List[str]  # e.g., ["z", "zh"]
    target_phoneme: str         # e.g., "zh"
    confidence: float = 0.0
    examples: List[str] = field(default_factory=list)
    correction_count: int = 0
    last_updated: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "pattern_id": self.pattern_id,
            "source_phonemes": self.source_phonemes,
            "target_phoneme": self.target_phoneme,
            "confidence": self.confidence,
            "examples": self.examples,
            "correction_count": self.correction_count,
            "last_updated": self.last_updated.isoformat()
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ConfusionPattern":
        return cls(
            pattern_id=data["pattern_id"],
            source_phonemes=data["source_phonemes"],
            target_phoneme=data["target_phoneme"],
            confidence=data.get("confidence", 0.0),
            examples=data.get("examples", []),
            correction_count=data.get("correction_count", 0),
            last_updated=datetime.fromisoformat(data["last_updated"]) if isinstance(data.get("last_updated"), str) else data.get("last_updated", datetime.now())
        )


@dataclass
class Hotword:
    """Personal hotword for ASR enhancement"""
    word: str
    phonetic: str = ""
    category: str = "custom"  # person/place/medical/daily/custom
    frequency: int = 1
    last_used: datetime = field(default_factory=datetime.now)
    audio_sample_uri: str = ""
    variants: List[str] = field(default_factory=list)  # Common misrecognitions

    def to_dict(self) -> Dict[str, Any]:
        return {
            "word": self.word,
            "phonetic": self.phonetic,
            "category": self.category,
            "frequency": self.frequency,
            "last_used": self.last_used.isoformat(),
            "audio_sample_uri": self.audio_sample_uri,
            "variants": self.variants
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Hotword":
        return cls(
            word=data["word"],
            phonetic=data.get("phonetic", ""),
            category=data.get("category", "custom"),
            frequency=data.get("frequency", 1),
            last_used=datetime.fromisoformat(data["last_used"]) if isinstance(data.get("last_used"), str) else data.get("last_used", datetime.now()),
            audio_sample_uri=data.get("audio_sample_uri", ""),
            variants=data.get("variants", [])
        )


@dataclass
class ConversationTurn:
    """A single turn in a conversation"""
    role: str  # "user" or "assistant"
    content: str
    raw_asr: str = ""  # Original ASR result (for user turns)
    corrected_text: str = ""  # LLM corrected text
    timestamp: datetime = field(default_factory=datetime.now)
    clarity_score: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "role": self.role,
            "content": self.content,
            "raw_asr": self.raw_asr,
            "corrected_text": self.corrected_text,
            "timestamp": self.timestamp.isoformat(),
            "clarity_score": self.clarity_score,
            "metadata": self.metadata
        }


@dataclass
class ClarityScore:
    """Clarity score for speech assessment"""
    timestamp: datetime
    score: float  # 0.0 - 1.0
    asr_confidence: float = 0.0
    correction_rate: float = 0.0
    pause_score: float = 0.0
    repeat_count: int = 0
    session_id: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "score": self.score,
            "asr_confidence": self.asr_confidence,
            "correction_rate": self.correction_rate,
            "pause_score": self.pause_score,
            "repeat_count": self.repeat_count,
            "session_id": self.session_id
        }


@dataclass
class VoiceProfile:
    """User's voice profile for personalization"""
    user_id: str
    confusion_patterns: List[ConfusionPattern] = field(default_factory=list)
    hotwords: List[Hotword] = field(default_factory=list)
    clarity_trend: List[ClarityScore] = field(default_factory=list)
    preferences: Dict[str, Any] = field(default_factory=dict)
    
    # Speech characteristics
    speech_rate: str = "normal"  # slow/normal/fast
    pause_pattern: str = "regular"  # irregular/regular
    dysarthria_type: str = ""  # spastic/ataxic/hypokinetic/mixed

    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "confusion_patterns": [p.to_dict() for p in self.confusion_patterns],
            "hotwords": [h.to_dict() for h in self.hotwords],
            "clarity_trend": [s.to_dict() for s in self.clarity_trend],
            "preferences": self.preferences,
            "speech_rate": self.speech_rate,
            "pause_pattern": self.pause_pattern,
            "dysarthria_type": self.dysarthria_type
        }

    def get_hotwords_for_asr(self) -> List[str]:
        """Get hotword list for ASR enhancement"""
        return [h.word for h in self.hotwords if h.frequency > 0]

    def get_confusion_rules(self, min_confidence: float = 0.7) -> Dict[str, str]:
        """Get confusion pattern rules for correction"""
        rules = {}
        for pattern in self.confusion_patterns:
            if pattern.confidence >= min_confidence:
                for src in pattern.source_phonemes:
                    rules[src] = pattern.target_phoneme
        return rules


class MemoryStore(ABC):
    """
    Abstract base class for memory storage backends.
    
    Implementations can use:
    - Local SQLite + Markdown (LocalStore)
    - PowerMem cloud service (PowerMemStore)
    - Hybrid approach (HybridStore)
    """

    @abstractmethod
    async def initialize(self, user_id: str, agent_id: str) -> None:
        """Initialize memory store for a user session"""
        pass

    @abstractmethod
    async def add_conversation(self, turns: List[ConversationTurn]) -> None:
        """Add conversation turns to memory"""
        pass

    @abstractmethod
    async def search(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Search memory for relevant context"""
        pass

    @abstractmethod
    async def get_voice_profile(self) -> VoiceProfile:
        """Get user's voice profile"""
        pass

    @abstractmethod
    async def update_voice_profile(self, profile: VoiceProfile) -> None:
        """Update user's voice profile"""
        pass

    @abstractmethod
    async def record_correction(self, raw_text: str, corrected_text: str) -> None:
        """Record a correction event for learning"""
        pass

    @abstractmethod
    async def add_hotword(self, word: str, category: str = "custom") -> None:
        """Add or update a hotword"""
        pass

    @abstractmethod
    async def get_clarity_score(self) -> float:
        """Get current clarity score"""
        pass

    @abstractmethod
    async def close(self) -> None:
        """Close connections and flush data"""
        pass
