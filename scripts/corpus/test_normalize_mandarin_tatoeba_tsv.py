import tempfile
import unittest
from pathlib import Path

from normalize_mandarin_tatoeba_tsv import normalize_tsv


class NormalizeMandarinTatoebaTsvTest(unittest.TestCase):
    def test_preserves_attribution_columns_and_converts_text(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.tsv"
            output = Path(directory) / "output.tsv"
            source.write_text("1\tcmn\t你的襯衫沒繫上扣子。\treviewer\n", encoding="utf-8")
            rows, changed = normalize_tsv(source, output)
            self.assertEqual(rows, 1)
            self.assertEqual(changed, 1)
            self.assertEqual(output.read_text(encoding="utf-8"), "1\tcmn\t你的衬衫没系上扣子。\treviewer\n")

    def test_keeps_quote_characters_as_plain_tsv_content(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.tsv"
            output = Path(directory) / "output.tsv"
            source.write_text('1\tcmn\t“這句話”仍是一行。\treviewer\n', encoding="utf-8")
            rows, _changed = normalize_tsv(source, output)
            self.assertEqual(rows, 1)
            self.assertEqual(output.read_text(encoding="utf-8").count("\n"), 1)


if __name__ == "__main__":
    unittest.main()
