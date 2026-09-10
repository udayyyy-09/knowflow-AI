
"""
Head-to-Head Comparative Benchmark: Google Gemini (1536d) vs FastEmbed ONNX (384d).
Measures inference latency, semantic similarity score, and retrieval accuracy.
"""
import os
import sys
import time
import math
import numpy as np

# Configure django
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

import django
django.setup()

from apps.documents.pipeline.embeddings.factory import EmbeddingProviderFactory

def cosine_similarity(v1, v2):
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot / (norm1 * norm2)

def run_comparison():
    print("=" * 80)
    print("      HEAD-TO-HEAD BENCHMARK: GEMINI (1536d) vs FASTEMBED (384d)")
    print("=" * 80)

    # Handbook chunk text
    chunk_text = (
        "Acme Corp - Employee Handbook & Benefits 2026 Welcome to Acme Corp! "
        "This handbook covers all company benefits and standard procedures. "
        "Health Care: Comprehensive dental, medical, and vision insurance begins on Day 1 of employment. "
        "Learning & Development: Every employee is allocated a $1,500 annual budget for courses and books. "
        "Office Hours: Core collaboration hours are 10:00 AM to 4:00 PM local time. "
        "Wellness Benefit: Monthly $100 gym and wellness subsidy claimable via payroll."
    )

    test_queries = [
        "what are office hours in peak time",
        "annual budget for learning and books",
        "health insurance and dental vision policy",
        "monthly gym subsidy claim",
    ]

    # Initialize providers
    gemini_provider = EmbeddingProviderFactory.get_provider("gemini", dimensions=1536, force_new=True)
    local_provider = EmbeddingProviderFactory.get_provider("local", dimensions=384, force_new=True)

    print("\n[*] Embedding document chunk...")
    t0 = time.perf_counter()
    gemini_chunk_vec = gemini_provider.embed_text(chunk_text)
    gemini_chunk_time = (time.perf_counter() - t0) * 1000

    t0 = time.perf_counter()
    local_chunk_vec = local_provider.embed_text(chunk_text)
    local_chunk_time = (time.perf_counter() - t0) * 1000

    print(f"    - Gemini Chunk Embed Time:    {gemini_chunk_time:.1f} ms (Cloud API)")
    print(f"    - FastEmbed Chunk Embed Time: {local_chunk_time:.1f} ms (Local ONNX)")

    results = []

    print("\n[*] Running query benchmarks...")
    for q in test_queries:
        # Gemini query
        t0 = time.perf_counter()
        g_vec = gemini_provider.embed_text(q)
        g_latency = (time.perf_counter() - t0) * 1000
        g_sim = cosine_similarity(g_vec, gemini_chunk_vec)

        # FastEmbed query
        t0 = time.perf_counter()
        l_vec = local_provider.embed_text(q)
        l_latency = (time.perf_counter() - t0) * 1000
        l_sim = cosine_similarity(l_vec, local_chunk_vec)

        results.append({
            "query": q,
            "gemini_sim": g_sim,
            "gemini_lat": g_latency,
            "local_sim": l_sim,
            "local_lat": l_latency,
        })

    # Print Table
    print("\n" + "-" * 88)
    print(f"{'Query Text':<42} | {'Gemini Score':<12} | {'Local Score':<12} | {'Speedup':<10}")
    print("-" * 88)
    for r in results:
        speedup = f"{r['gemini_lat'] / max(r['local_lat'], 0.001):.1f}x"
        print(f"{r['query']:<42} | {r['gemini_sim']*100:>5.1f}% ({r['gemini_lat']:>4.0f}ms) | {r['local_sim']*100:>5.1f}% ({r['local_lat']:>3.0f}ms) | {speedup:>8}")
    print("-" * 88)
    print("Benchmark complete.\n")

if __name__ == "__main__":
    run_comparison()
