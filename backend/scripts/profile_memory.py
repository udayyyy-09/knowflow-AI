"""
Memory Profiling Benchmark for KnowFlow AI Embedding Providers.
Measures baseline Django RAM vs FastEmbed ONNX memory consumption.
Validates stability under Render's 512MB RAM free tier limit.
"""
import os
import sys
import psutil

# Add backend directory to sys.path and configure django
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

import django
django.setup()

def get_current_memory_mb() -> float:
    process = psutil.Process(os.getpid())
    return process.memory_info().rss / (1024 * 1024)

def run_benchmark():
    print("=" * 60)
    print("      KNOWFLOW AI - MEMORY PROFILING BENCHMARK")
    print("=" * 60)

    # 1. Base Django Memory
    ram_base = get_current_memory_mb()
    print(f"[*] Base Django App RSS Memory:       {ram_base:.2f} MB")

    # 2. Instantiate Local Provider (Lazy Loading Check)
    from apps.documents.pipeline.embeddings.factory import EmbeddingProviderFactory
    provider = EmbeddingProviderFactory.get_provider("local")
    ram_after_init = get_current_memory_mb()
    print(f"[*] Memory after Provider Init:        {ram_after_init:.2f} MB  (Delta: +{ram_after_init - ram_base:.2f} MB)")
    assert ram_after_init - ram_base < 10.0, "Lazy loading failed! Memory was allocated during init."
    print("    -> Lazy loading verified: Model weights NOT loaded at init. [OK]")

    # 3. First Embedding Call (Triggers ONNX Model Load)
    sample_queries = [
        "What are the core office hours in peak time?",
        "How is annual leave calculated for full time employees?",
        "What is the company policy on remote work expense reimbursements?",
        "Health insurance and dental coverage details.",
        "Learning and development budget per employee per year."
    ]
    print("[*] Triggering first batch embedding (loads ONNX weights)...")
    vectors = provider.embed_batch(sample_queries)
    ram_after_model = get_current_memory_mb()
    model_delta_mb = ram_after_model - ram_after_init
    print(f"[*] Memory with ONNX Model Loaded:    {ram_after_model:.2f} MB  (Delta: +{model_delta_mb:.2f} MB)")

    # 4. Verify Dimensions and Invariants
    dims = len(vectors[0])
    print(f"[*] Vector Dimensions:                 {dims} (Expected: 384)")
    assert dims == 384, f"Dimension mismatch: got {dims}, expected 384"

    import math
    for i, vec in enumerate(vectors):
        norm = math.sqrt(sum(x * x for x in vec))
        assert abs(norm - 1.0) < 1e-3, f"Vector {i} not normalized: norm = {norm}"
    print("[*] Vector Unit Normalization:         ||v|| = 1.0000 [OK]")

    # 5. Render 512MB Budget Evaluation
    render_limit_mb = 512.0
    headroom_mb = render_limit_mb - ram_after_model
    percent_used = (ram_after_model / render_limit_mb) * 100

    print("-" * 60)
    print("                 RENDER FREE TIER BUDGET EVALUATION")
    print("-" * 60)
    print(f"Total Steady-State Process RAM:        {ram_after_model:.2f} MB")
    print(f"Render Free Tier Hard Cap:             {render_limit_mb:.2f} MB")
    print(f"Available Free Memory Headroom:        {headroom_mb:.2f} MB ({100 - percent_used:.1f}% free)")
    print(f"Render RAM Status:                     {'SAFE (NO OOM RISK) [OK]' if ram_after_model < 300 else 'WARNING'}")
    print("=" * 60)

if __name__ == "__main__":
    run_benchmark()
