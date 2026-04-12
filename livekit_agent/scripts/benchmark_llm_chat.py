from __future__ import annotations

import argparse
import json
import os
import statistics
import sys
import time
from urllib import error, request


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Benchmark OpenAI-compatible chat/completions latency")
    parser.add_argument("--base-url", default=os.getenv("LLM_BASE_URL") or os.getenv("MINIMAX_BASE_URL") or "")
    parser.add_argument("--api-key", default=os.getenv("LLM_API_KEY") or os.getenv("MINIMAX_API_KEY") or "")
    parser.add_argument("--model", action="append", dest="models", required=True)
    parser.add_argument("--trials", type=int, default=3)
    parser.add_argument("--temperature", type=float, default=float(os.getenv("LLM_TEMPERATURE", "0.1")))
    parser.add_argument("--max-tokens", type=int, default=int(os.getenv("LLM_MAX_TOKENS", "96")))
    parser.add_argument("--reasoning-split", action="store_true", default=os.getenv("LLM_REASONING_SPLIT", "0") not in {"0", "false", "False", ""})
    parser.add_argument(
        "--system",
        default="你是 VoxFlame 的中文实时纠错助手。只输出纠正后的最终句子，不要解释，不要分析。",
    )
    parser.add_argument("--user", default="本轮 ASR 最终文本：您好")
    return parser.parse_args()


def run_once(
    *,
    base_url: str,
    api_key: str,
    model: str,
    temperature: float,
    max_tokens: int,
    reasoning_split: bool,
    system: str,
    user: str,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if reasoning_split:
        payload["reasoning_split"] = True

    req = request.Request(
        url=f"{base_url.rstrip('/')}/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )

    started_at = time.perf_counter()
    with request.urlopen(req, timeout=30) as resp:
        body = resp.read().decode("utf-8")
    elapsed_ms = round((time.perf_counter() - started_at) * 1000)
    parsed = json.loads(body)
    message = parsed.get("choices", [{}])[0].get("message", {})
    return {
        "elapsed_ms": elapsed_ms,
        "content": message.get("content"),
        "has_reasoning_details": "reasoning_details" in message,
        "usage": parsed.get("usage"),
    }


def main() -> int:
    args = parse_args()
    if not args.base_url or not args.api_key:
        print("Missing --base-url or --api-key", file=sys.stderr)
        return 1

    for model in args.models:
        latencies: list[int] = []
        for trial in range(1, args.trials + 1):
            try:
                result = run_once(
                    base_url=args.base_url,
                    api_key=args.api_key,
                    model=model,
                    temperature=args.temperature,
                    max_tokens=args.max_tokens,
                    reasoning_split=args.reasoning_split,
                    system=args.system,
                    user=args.user,
                )
                latencies.append(int(result["elapsed_ms"]))
                print(
                    json.dumps(
                        {
                            "model": model,
                            "trial": trial,
                            **result,
                        },
                        ensure_ascii=False,
                    )
                )
            except error.HTTPError as exc:
                detail = exc.read().decode("utf-8", errors="ignore")
                print(
                    json.dumps(
                        {
                            "model": model,
                            "trial": trial,
                            "error": f"HTTP {exc.code}",
                            "detail": detail,
                        },
                        ensure_ascii=False,
                    )
                )
            except Exception as exc:  # pragma: no cover - debug helper
                print(
                    json.dumps(
                        {
                            "model": model,
                            "trial": trial,
                            "error": str(exc),
                        },
                        ensure_ascii=False,
                    )
                )

        if latencies:
            print(
                json.dumps(
                    {
                        "model": model,
                        "min_ms": min(latencies),
                        "avg_ms": round(statistics.mean(latencies), 1),
                        "max_ms": max(latencies),
                    },
                    ensure_ascii=False,
                )
            )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
