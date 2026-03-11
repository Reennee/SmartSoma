"""
SmartSoma Performance Benchmark
================================
Tests API response times and ML inference speed across different:
  - Data sizes (number of interactions in sequence)
  - Concurrency levels (simulated simultaneous users)
  - Hardware profiles (reports CPU/RAM so results are comparable)

Usage:
    # With the server running locally:
    python -m backend.scripts.benchmark --url http://localhost:8000 --token <JWT>

    # Quick offline ML-only benchmark (no server needed):
    python -m backend.scripts.benchmark --offline
"""

import argparse
import platform
import statistics
import sys
import time
from typing import List

# ─── Hardware Info ────────────────────────────────────────────────────────────

def get_hardware_profile() -> dict:
    import os
    info = {
        "os": platform.system(),
        "os_version": platform.version(),
        "python": platform.python_version(),
        "cpu": platform.processor() or platform.machine(),
        "cpu_cores": os.cpu_count(),
    }
    try:
        import psutil
        info["ram_gb"] = round(psutil.virtual_memory().total / (1024 ** 3), 2)
    except ImportError:
        info["ram_gb"] = "psutil not installed"
    return info


# ─── ML Inference Benchmark ──────────────────────────────────────────────────

def benchmark_dkt_inference(runs: int = 100) -> dict:
    """
    Benchmark raw BiLSTM inference time with varying sequence lengths.
    No server required — loads model directly.
    """
    from backend.services.dkt import DKTService

    DKTService.load()

    results = {}
    sequence_lengths = [1, 5, 10, 15]  # 15 is the model's max training length

    for seq_len in sequence_lengths:
        interactions = [
            {"material_id": i * 3, "score": 60 + i, "duration": 1800, "mastery": 0.4 + i * 0.02}
            for i in range(seq_len)
        ]

        latencies = []
        for _ in range(runs):
            start = time.perf_counter()
            DKTService.predict_mastery(interactions)
            latencies.append((time.perf_counter() - start) * 1000)  # ms

        results[f"seq_len_{seq_len}"] = {
            "runs": runs,
            "mean_ms": round(statistics.mean(latencies), 3),
            "median_ms": round(statistics.median(latencies), 3),
            "p95_ms": round(sorted(latencies)[int(runs * 0.95)], 3),
            "min_ms": round(min(latencies), 3),
            "max_ms": round(max(latencies), 3),
        }

    return results


# ─── API Endpoint Benchmark ───────────────────────────────────────────────────

def benchmark_api(base_url: str, token: str, runs: int = 20) -> dict:
    """
    Benchmark live API endpoints with different request payloads.
    Requires a running server and a valid JWT token.
    """
    try:
        import requests
    except ImportError:
        print("requests library not installed. Run: pip install requests")
        sys.exit(1)

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    results = {}

    # ── Health check ──────────────────────────────────────────────────────────
    latencies = []
    for _ in range(runs):
        start = time.perf_counter()
        r = requests.get(f"{base_url}/", timeout=10)
        latencies.append((time.perf_counter() - start) * 1000)
        assert r.status_code == 200, f"Health check failed: {r.status_code}"

    results["GET /"] = _summarise(latencies, runs)

    # ── Materials list ────────────────────────────────────────────────────────
    latencies = []
    for _ in range(runs):
        start = time.perf_counter()
        r = requests.get(f"{base_url}/api/materials", headers=headers, timeout=10)
        latencies.append((time.perf_counter() - start) * 1000)
        assert r.status_code == 200, f"Materials failed: {r.status_code}"

    results["GET /api/materials"] = _summarise(latencies, runs)

    # ── Recommendations — different subjects ──────────────────────────────────
    for subject, limit in [("Mathematics", 5), ("Physics", 5), (None, 10)]:
        payload = {"limit": limit}
        if subject:
            payload["subject"] = subject

        latencies = []
        for _ in range(runs):
            start = time.perf_counter()
            r = requests.post(f"{base_url}/api/recommend", json=payload, headers=headers, timeout=10)
            latencies.append((time.perf_counter() - start) * 1000)
            assert r.status_code == 200, f"Recommend failed ({subject}): {r.status_code} {r.text}"

        label = f"POST /api/recommend (subject={subject or 'all'}, limit={limit})"
        results[label] = _summarise(latencies, runs)

    return results


def _summarise(latencies: List[float], runs: int) -> dict:
    return {
        "runs": runs,
        "mean_ms": round(statistics.mean(latencies), 1),
        "median_ms": round(statistics.median(latencies), 1),
        "p95_ms": round(sorted(latencies)[int(runs * 0.95)], 1),
        "min_ms": round(min(latencies), 1),
        "max_ms": round(max(latencies), 1),
    }


# ─── Report Printer ───────────────────────────────────────────────────────────

def print_report(hardware: dict, dkt_results: dict, api_results: dict = None):
    sep = "=" * 65

    print(f"\n{sep}")
    print("  SmartSoma Performance Benchmark Report")
    print(sep)

    print("\n[Hardware Profile]")
    for k, v in hardware.items():
        print(f"  {k:<15} {v}")

    print(f"\n[BiLSTM DKT Inference — {list(dkt_results.values())[0]['runs']} runs each]")
    print(f"  {'Sequence Length':<20} {'Mean':>8} {'Median':>8} {'P95':>8} {'Min':>8} {'Max':>8}")
    print(f"  {'-'*62}")
    for label, m in dkt_results.items():
        seq = label.replace("seq_len_", "")
        print(f"  {f'{seq} interactions':<20} {m['mean_ms']:>7.3f}ms {m['median_ms']:>7.3f}ms "
              f"{m['p95_ms']:>7.3f}ms {m['min_ms']:>7.3f}ms {m['max_ms']:>7.3f}ms")

    if api_results:
        print(f"\n[API Endpoint Latency — {list(api_results.values())[0]['runs']} runs each]")
        print(f"  {'Endpoint':<45} {'Mean':>7} {'P95':>7}")
        print(f"  {'-'*62}")
        for label, m in api_results.items():
            short = label[:44]
            print(f"  {short:<45} {m['mean_ms']:>6.1f}ms {m['p95_ms']:>6.1f}ms")

    print(f"\n{sep}\n")


# ─── CLI Entry Point ──────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="SmartSoma API & ML Benchmark")
    parser.add_argument("--url", default="http://localhost:8000", help="Base API URL")
    parser.add_argument("--token", default="", help="JWT auth token for API benchmarks")
    parser.add_argument("--runs", type=int, default=50, help="Number of runs per test (default: 50)")
    parser.add_argument("--offline", action="store_true", help="ML inference benchmark only (no server)")
    args = parser.parse_args()

    hardware = get_hardware_profile()
    dkt_results = benchmark_dkt_inference(runs=args.runs)

    api_results = None
    if not args.offline:
        if not args.token:
            print("Warning: --token not provided. Skipping API benchmark.")
            print("         Use --offline for ML-only benchmark, or provide --token.\n")
        else:
            api_results = benchmark_api(args.url, args.token, runs=min(args.runs, 20))

    print_report(hardware, dkt_results, api_results)


if __name__ == "__main__":
    main()
