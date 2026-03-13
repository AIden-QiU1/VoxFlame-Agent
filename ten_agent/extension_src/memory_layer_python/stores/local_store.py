#
# Local Memory Store
# SQLite + Markdown based local-first memory storage
#

import json
import sqlite3
import asyncio
from datetime import datetime, date
from pathlib import Path
from typing import Optional, List, Dict, Any
import hashlib
import re

from .base import (
    MemoryStore,
    ConversationTurn,
    VoiceProfile,
    ConfusionPattern,
    Hotword,
    ClarityScore
)


class LocalStore(MemoryStore):
    """
    Local-first memory storage using SQLite + Markdown.
    
    Structure:
    ~/.voxflame/
    ├── MEMORY.md           # Long-term memory
    ├── VOICE_PROFILE.md    # Voice profile
    ├── memory.db           # SQLite index
    └── sessions/
        └── YYYY-MM-DD/
            └── session_*.md
    """

    # Common confusion patterns for Chinese dysarthric speech
    KNOWN_CONFUSION_PATTERNS = {
        ("z", "zh"): "zh",   # 舌尖前音 vs 舌尖后音
        ("c", "ch"): "ch",
        ("s", "sh"): "sh",
        ("l", "n"): "n",     # 边音 vs 鼻音
        ("r", "l"): "l",     # 卷舌音 vs 边音
        ("f", "h"): "h",     # 唇齿音 vs 喉音
        ("an", "ang"): "ang", # 前后鼻音
        ("en", "eng"): "eng",
        ("in", "ing"): "ing",
    }

    def __init__(self, base_path: str = "~/.voxflame", db_name: str = "memory.db"):
        self.root_path = Path(base_path).expanduser()
        self.user_path = self.root_path
        self.db_path = self.user_path / db_name
        self.db_name = db_name
        self.user_id: str = ""
        self.agent_id: str = ""
        self.session_id: str = ""
        self.db: Optional[sqlite3.Connection] = None
        self._pending_corrections: List[Dict[str, Any]] = []
        self._clarity_scores: List[float] = []

    async def initialize(self, user_id: str, agent_id: str) -> None:
        """Initialize local storage for user"""
        self.user_id = user_id
        self.agent_id = agent_id
        self.session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.user_path = self._build_user_path(user_id)
        self.db_path = self.user_path / self.db_name

        # Create directory structure
        self._ensure_directories()
        
        # Initialize SQLite database
        await self._init_database()
        
        # Load or create voice profile
        self._voice_profile = await self._load_voice_profile()
        self._clarity_scores = [
            item.score for item in self._voice_profile.clarity_trend[-100:]
        ]

    def _build_user_path(self, user_id: str) -> Path:
        """Create a stable per-user path to avoid shared anonymous artifacts."""
        normalized = re.sub(r"[^a-zA-Z0-9._-]+", "_", user_id).strip("._-") or "anonymous"
        digest = hashlib.md5(user_id.encode("utf-8")).hexdigest()[:8]
        return self.root_path / "users" / f"{normalized}_{digest}"

    def _ensure_directories(self) -> None:
        """Create directory structure if not exists"""
        dirs = [
            self.user_path,
            self.user_path / "sessions" / date.today().isoformat(),
            self.user_path / "analytics",
            self.user_path / "cache" / "embeddings",
        ]
        for d in dirs:
            d.mkdir(parents=True, exist_ok=True)

    async def _init_database(self) -> None:
        """Initialize SQLite database with schema"""
        def _create_db():
            # LocalStore uses executor threads for SQLite work, so the connection
            # must be allowed to cross thread boundaries.
            self.db = sqlite3.connect(str(self.db_path), check_same_thread=False)
            self.db.row_factory = sqlite3.Row
            
            # Create tables
            self.db.executescript("""
                -- Sessions table
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    ended_at TIMESTAMP,
                    mode TEXT DEFAULT 'communication',
                    clarity_avg REAL DEFAULT 0.0,
                    turn_count INTEGER DEFAULT 0
                );

                -- Utterances table
                CREATE TABLE IF NOT EXISTS utterances (
                    utt_id TEXT PRIMARY KEY,
                    session_id TEXT REFERENCES sessions(session_id),
                    speaker_role TEXT NOT NULL,
                    raw_asr TEXT,
                    corrected_text TEXT,
                    final_text TEXT,
                    clarity_score REAL DEFAULT 0.0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_utterances_session ON utterances(session_id);
                CREATE INDEX IF NOT EXISTS idx_utterances_time ON utterances(created_at);

                -- Corrections table (for learning)
                CREATE TABLE IF NOT EXISTS corrections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    raw_text TEXT NOT NULL,
                    corrected_text TEXT NOT NULL,
                    pattern_hint TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_corrections_user ON corrections(user_id, created_at DESC);

                -- Hotwords table
                CREATE TABLE IF NOT EXISTS hotwords (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    word TEXT NOT NULL,
                    phonetic TEXT,
                    category TEXT DEFAULT 'custom',
                    frequency INTEGER DEFAULT 1,
                    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, word)
                );
                CREATE INDEX IF NOT EXISTS idx_hotwords_user ON hotwords(user_id, frequency DESC);

                -- Confusion patterns table
                CREATE TABLE IF NOT EXISTS confusion_patterns (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    source_phonemes TEXT NOT NULL,
                    target_phoneme TEXT NOT NULL,
                    confidence REAL DEFAULT 0.0,
                    examples TEXT,
                    correction_count INTEGER DEFAULT 1,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_patterns_user ON confusion_patterns(user_id);

                -- Clarity scores table
                CREATE TABLE IF NOT EXISTS clarity_scores (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    session_id TEXT,
                    score REAL NOT NULL,
                    asr_confidence REAL,
                    correction_rate REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_clarity_user ON clarity_scores(user_id, created_at DESC);
            """)
            self.db.commit()

        # Run in thread pool for async compatibility
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _create_db)

        # Register current session
        await self._register_session()

    async def _register_session(self) -> None:
        """Register current session in database"""
        def _insert():
            self.db.execute(
                "INSERT OR IGNORE INTO sessions (session_id, user_id) VALUES (?, ?)",
                (self.session_id, self.user_id)
            )
            self.db.commit()
        
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _insert)

    async def _load_voice_profile(self) -> VoiceProfile:
        """Load voice profile from storage"""
        profile = VoiceProfile(user_id=self.user_id)
        
        def _load():
            # Load hotwords
            cursor = self.db.execute(
                "SELECT * FROM hotwords WHERE user_id = ? ORDER BY frequency DESC",
                (self.user_id,)
            )
            for row in cursor.fetchall():
                profile.hotwords.append(Hotword(
                    word=row["word"],
                    phonetic=row["phonetic"] or "",
                    category=row["category"],
                    frequency=row["frequency"],
                    last_used=datetime.fromisoformat(row["last_used"]) if row["last_used"] else datetime.now()
                ))

            # Load confusion patterns
            cursor = self.db.execute(
                "SELECT * FROM confusion_patterns WHERE user_id = ? AND confidence > 0.3",
                (self.user_id,)
            )
            for row in cursor.fetchall():
                profile.confusion_patterns.append(ConfusionPattern(
                    pattern_id=str(row["id"]),
                    source_phonemes=json.loads(row["source_phonemes"]),
                    target_phoneme=row["target_phoneme"],
                    confidence=row["confidence"],
                    examples=json.loads(row["examples"]) if row["examples"] else [],
                    correction_count=row["correction_count"]
                ))

            # Load recent clarity scores
            cursor = self.db.execute(
                "SELECT * FROM clarity_scores WHERE user_id = ? ORDER BY created_at DESC LIMIT 100",
                (self.user_id,)
            )
            for row in cursor.fetchall():
                profile.clarity_trend.append(ClarityScore(
                    timestamp=datetime.fromisoformat(row["created_at"]),
                    score=row["score"],
                    session_id=row["session_id"] or ""
                ))

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _load)

        profile.clarity_trend.sort(key=lambda item: item.timestamp)

        # Load preferences from VOICE_PROFILE.md if exists
        profile_path = self.user_path / "VOICE_PROFILE.md"
        if profile_path.exists():
            await self._load_profile_from_markdown(profile, profile_path)

        return profile

    async def _load_profile_from_markdown(self, profile: VoiceProfile, path: Path) -> None:
        """Load profile from Markdown file"""
        def _read():
            with open(path, "r", encoding="utf-8") as f:
                return f.read()
        
        loop = asyncio.get_event_loop()
        content = await loop.run_in_executor(None, _read)
        
        # Parse markdown sections
        lines = content.split("\n")
        current_section = ""
        
        for line in lines:
            if line.startswith("## "):
                current_section = line[3:].strip().lower()
            elif current_section == "发音特点" and line.startswith("- 障碍类型："):
                profile.dysarthria_type = line.split("：", 1)[1].strip()
            elif current_section == "发音特点" and line.startswith("- 语速："):
                profile.speech_rate = line.split("：", 1)[1].strip()
            elif current_section == "沟通偏好":
                if line.startswith("- "):
                    pref = line[2:].strip()
                    profile.preferences[pref] = True

    async def add_conversation(self, turns: List[ConversationTurn]) -> None:
        """Add conversation turns to memory"""
        def _insert():
            for turn in turns:
                utt_id = hashlib.md5(
                    f"{self.session_id}_{turn.timestamp.isoformat()}_{turn.role}".encode()
                ).hexdigest()[:12]
                
                self.db.execute(
                    """INSERT OR REPLACE INTO utterances 
                       (utt_id, session_id, speaker_role, raw_asr, corrected_text, final_text, clarity_score)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (utt_id, self.session_id, turn.role, turn.raw_asr, 
                     turn.corrected_text, turn.content, turn.clarity_score)
                )
            
            # Update session turn count
            self.db.execute(
                "UPDATE sessions SET turn_count = turn_count + ? WHERE session_id = ?",
                (len(turns), self.session_id)
            )
            self.db.commit()

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _insert)

        # Write to daily markdown log
        await self._append_to_daily_log(turns)

    async def _append_to_daily_log(self, turns: List[ConversationTurn]) -> None:
        """Append turns to daily markdown log"""
        log_path = self.user_path / "sessions" / date.today().isoformat() / f"{self.session_id}.md"
        
        def _write():
            with open(log_path, "a", encoding="utf-8") as f:
                for turn in turns:
                    timestamp = turn.timestamp.strftime("%H:%M:%S")
                    if turn.role == "user":
                        f.write(f"\n### [{timestamp}] 用户\n")
                        if turn.raw_asr and turn.raw_asr != turn.content:
                            f.write(f"- **识别**: {turn.raw_asr}\n")
                            f.write(f"- **纠正**: {turn.content}\n")
                        else:
                            f.write(f"{turn.content}\n")
                    else:
                        f.write(f"\n### [{timestamp}] 助手\n")
                        f.write(f"{turn.content}\n")

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _write)

    async def search(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Search memory for relevant context using SQLite FTS or LIKE"""
        results = []
        
        def _search():
            # Search in utterances
            cursor = self.db.execute(
                """SELECT u.*, s.started_at as session_start 
                   FROM utterances u 
                   JOIN sessions s ON u.session_id = s.session_id
                   WHERE s.user_id = ? AND (u.final_text LIKE ? OR u.corrected_text LIKE ? OR u.raw_asr LIKE ?)
                   ORDER BY u.created_at DESC LIMIT ?""",
                (self.user_id, f"%{query}%", f"%{query}%", f"%{query}%", limit)
            )
            
            for row in cursor.fetchall():
                results.append({
                    "type": "utterance",
                    "content": row["final_text"] or row["corrected_text"] or row["raw_asr"],
                    "role": row["speaker_role"],
                    "timestamp": row["created_at"],
                    "session_id": row["session_id"]
                })

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _search)
        
        return results

    async def get_voice_profile(self) -> VoiceProfile:
        """Get user's voice profile"""
        return self._voice_profile

    async def update_voice_profile(self, profile: VoiceProfile) -> None:
        """Update user's voice profile"""
        self._voice_profile = profile
        self._voice_profile.confusion_patterns.sort(
            key=lambda pattern: (-pattern.correction_count, -pattern.confidence, pattern.target_phoneme)
        )

        # Persist to database
        def _update():
            # Update hotwords
            for hw in profile.hotwords:
                self.db.execute(
                    """INSERT OR REPLACE INTO hotwords 
                       (user_id, word, phonetic, category, frequency, last_used)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (self.user_id, hw.word, hw.phonetic, hw.category, hw.frequency, hw.last_used.isoformat())
                )

            # Update confusion patterns
            self.db.execute(
                "DELETE FROM confusion_patterns WHERE user_id = ?",
                (self.user_id,),
            )
            for pattern in profile.confusion_patterns:
                self.db.execute(
                    """INSERT INTO confusion_patterns 
                       (user_id, source_phonemes, target_phoneme, confidence, examples, correction_count, last_updated)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (self.user_id, json.dumps(pattern.source_phonemes), pattern.target_phoneme,
                     pattern.confidence, json.dumps(pattern.examples), pattern.correction_count,
                     pattern.last_updated.isoformat())
                )
            self.db.commit()

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _update)

        # Update markdown file
        await self._write_voice_profile_markdown(profile)

    async def _write_voice_profile_markdown(self, profile: VoiceProfile) -> None:
        """Write voice profile to Markdown file"""
        path = self.user_path / "VOICE_PROFILE.md"
        
        def _write():
            with open(path, "w", encoding="utf-8") as f:
                f.write("# 语音画像\n\n")
                
                f.write("## 发音特点\n\n")
                if profile.dysarthria_type:
                    f.write(f"- 障碍类型：{profile.dysarthria_type}\n")
                f.write(f"- 语速：{profile.speech_rate}\n")
                f.write(f"- 停顿：{profile.pause_pattern}\n\n")

                f.write("## 混淆模式\n\n")
                f.write("| 混淆音 | 倾向 | 置信度 | 示例词 |\n")
                f.write("|--------|------|--------|--------|\n")
                for p in profile.confusion_patterns:
                    examples = ", ".join(p.examples[:3]) if p.examples else "-"
                    f.write(f"| {'/'.join(p.source_phonemes)} | {p.target_phoneme} | {p.confidence:.2f} | {examples} |\n")
                f.write("\n")

                f.write("## 高频热词\n\n")
                f.write("| 词汇 | 分类 | 频率/周 |\n")
                f.write("|------|------|--------|\n")
                for h in sorted(profile.hotwords, key=lambda x: x.frequency, reverse=True)[:20]:
                    f.write(f"| {h.word} | {h.category} | {h.frequency} |\n")
                f.write("\n")

                if profile.clarity_trend:
                    f.write("## 清晰度趋势\n\n")
                    recent = profile.clarity_trend[-7:]
                    for s in recent:
                        f.write(f"- {s.timestamp.strftime('%Y-%m-%d')}: {s.score:.2f}\n")
                    f.write("\n")

                if profile.preferences:
                    f.write("## 沟通偏好\n\n")
                    for pref, val in profile.preferences.items():
                        if isinstance(val, bool):
                            if val:
                                f.write(f"- {pref}\n")
                        elif isinstance(val, (int, float, str)) and str(val).strip():
                            f.write(f"- {pref}：{val}\n")
                        else:
                            f.write(f"- {pref}\n")

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _write)

    async def record_correction(self, raw_text: str, corrected_text: str) -> None:
        """Record a correction event for learning"""
        if raw_text == corrected_text:
            return

        # Detect potential confusion pattern
        pattern_hint = self._detect_confusion_pattern(raw_text, corrected_text)

        def _insert():
            self.db.execute(
                """INSERT INTO corrections (user_id, raw_text, corrected_text, pattern_hint)
                   VALUES (?, ?, ?, ?)""",
                (self.user_id, raw_text, corrected_text, pattern_hint)
            )
            self.db.commit()

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _insert)

        # Track for potential hotword
        self._pending_corrections.append({
            "raw": raw_text,
            "corrected": corrected_text,
            "timestamp": datetime.now()
        })

        # Update clarity score tracking
        await self._update_clarity_score(raw_text, corrected_text)

    def _detect_confusion_pattern(self, raw: str, corrected: str) -> Optional[str]:
        """Detect confusion pattern from correction"""
        # Simple heuristic: look for known pattern substitutions
        raw_lower = raw.lower()
        corrected_lower = corrected.lower()
        
        for (src, tgt), tendency in self.KNOWN_CONFUSION_PATTERNS.items():
            # Check if pattern might apply
            if src in raw_lower and tgt in corrected_lower:
                return f"{src}/{tgt}"
        
        return None

    async def _update_clarity_score(self, raw: str, corrected: str) -> None:
        """Update clarity score based on correction"""
        # Calculate correction rate
        if len(raw) == 0:
            return

        similarity = self._text_similarity(raw, corrected)
        await self.add_clarity_score(
            similarity,
            correction_rate=max(0.0, 1.0 - similarity),
        )

    def _text_similarity(self, text1: str, text2: str) -> float:
        """Calculate simple text similarity"""
        if not text1 or not text2:
            return 0.0
        
        # Simple character-level similarity
        chars1, chars2 = set(text1), set(text2)
        intersection = chars1 & chars2
        union = chars1 | chars2
        
        return len(intersection) / len(union) if union else 0.0

    async def add_hotword(self, word: str, category: str = "custom") -> None:
        """Add or update a hotword"""
        # Check if already exists
        existing = next((h for h in self._voice_profile.hotwords if h.word == word), None)
        
        if existing:
            existing.frequency += 1
            existing.last_used = datetime.now()
        else:
            self._voice_profile.hotwords.append(Hotword(
                word=word,
                category=category,
                frequency=1,
                last_used=datetime.now()
            ))

        await self.update_voice_profile(self._voice_profile)

    async def add_clarity_score(
        self,
        score: float,
        asr_confidence: float = 0.0,
        correction_rate: float = 0.0,
        session_id: str = "",
    ) -> None:
        """Persist one clarity score sample and refresh in-memory trend."""
        normalized_score = max(0.0, min(1.0, float(score)))
        target_session_id = session_id or self.session_id
        timestamp = datetime.now()

        def _insert():
            self.db.execute(
                """INSERT INTO clarity_scores
                   (user_id, session_id, score, asr_confidence, correction_rate, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    self.user_id,
                    target_session_id,
                    normalized_score,
                    asr_confidence,
                    correction_rate,
                    timestamp.isoformat(),
                )
            )
            self.db.commit()

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _insert)

        self._voice_profile.clarity_trend.append(
            ClarityScore(
                timestamp=timestamp,
                score=normalized_score,
                asr_confidence=asr_confidence,
                correction_rate=correction_rate,
                session_id=target_session_id,
            )
        )
        self._voice_profile.clarity_trend = self._voice_profile.clarity_trend[-100:]
        self._clarity_scores.append(normalized_score)
        if len(self._clarity_scores) > 100:
            self._clarity_scores = self._clarity_scores[-100:]

        await self._write_voice_profile_markdown(self._voice_profile)

    async def get_clarity_score(self) -> float:
        """Get current clarity score (rolling average)"""
        if not self._clarity_scores:
            return 0.0
        return sum(self._clarity_scores) / len(self._clarity_scores)

    async def close(self) -> None:
        """Close connections and flush data"""
        if self.db:
            # Update session end time
            self.db.execute(
                "UPDATE sessions SET ended_at = ?, clarity_avg = ? WHERE session_id = ?",
                (datetime.now().isoformat(), await self.get_clarity_score(), self.session_id)
            )
            self.db.commit()
            self.db.close()
            self.db = None

    async def learn_from_corrections(self, threshold: int = 5) -> None:
        """
        Analyze corrections and learn patterns/hotwords.
        Called periodically or on session end.
        """
        def _analyze():
            # Find words that are frequently corrected
            cursor = self.db.execute(
                """SELECT corrected_text, COUNT(*) as cnt 
                   FROM corrections 
                   WHERE user_id = ? 
                   GROUP BY corrected_text 
                   HAVING cnt >= ?
                   ORDER BY cnt DESC""",
                (self.user_id, threshold)
            )
            
            potential_hotwords = []
            for row in cursor.fetchall():
                word = row["corrected_text"]
                if len(word) >= 2:  # Ignore single chars
                    potential_hotwords.append((word, row["cnt"]))
            
            return potential_hotwords

        loop = asyncio.get_event_loop()
        hotwords = await loop.run_in_executor(None, _analyze)

        # Add as hotwords
        for word, count in hotwords:
            await self.add_hotword(word, "auto_learned")

        # Learn confusion patterns
        await self._learn_confusion_patterns()

    async def _learn_confusion_patterns(self) -> None:
        """Learn confusion patterns from correction history"""
        def _get_patterns():
            cursor = self.db.execute(
                """SELECT pattern_hint, COUNT(*) as cnt 
                   FROM corrections 
                   WHERE user_id = ? AND pattern_hint IS NOT NULL
                   GROUP BY pattern_hint 
                   HAVING cnt >= 5""",
                (self.user_id,)
            )
            return [(row["pattern_hint"], row["cnt"]) for row in cursor.fetchall()]

        loop = asyncio.get_event_loop()
        patterns = await loop.run_in_executor(None, _get_patterns)

        for pattern_hint, count in patterns:
            # Parse pattern hint (e.g., "z/zh")
            parts = pattern_hint.split("/")
            if len(parts) == 2:
                src, tgt = parts
                # Update or create pattern
                existing = next(
                    (p for p in self._voice_profile.confusion_patterns 
                     if src in p.source_phonemes),
                    None
                )
                
                if existing:
                    existing.correction_count += count
                    existing.confidence = min(1.0, existing.correction_count / 10)
                    existing.last_updated = datetime.now()
                else:
                    self._voice_profile.confusion_patterns.append(ConfusionPattern(
                        pattern_id=hashlib.md5(pattern_hint.encode()).hexdigest()[:8],
                        source_phonemes=[src, tgt],
                        target_phoneme=tgt,
                        confidence=min(1.0, count / 10),
                        correction_count=count
                    ))

        await self.update_voice_profile(self._voice_profile)
