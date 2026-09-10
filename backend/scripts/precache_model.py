"""
Pre-caches FastEmbed / Hugging Face model weights during build time.
Used in Dockerfile or Render build script to avoid cold-start delays.
"""
import sys
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

def precache(model_name: str = "BAAI/bge-small-en-v1.5"):
    logger.info("Pre-caching FastEmbed model '%s'...", model_name)
    try:
        from fastembed import TextEmbedding
        model = TextEmbedding(model_name=model_name)
        # Run a dummy inference to ensure ONNX session and tokenizers are fully initialized
        list(model.embed(["Initialization check."]))
        logger.info("Successfully pre-cached '%s'!", model_name)
    except Exception as e:
        logger.error("Failed to pre-cache model '%s': %s", model_name, str(e), exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    target_model = sys.argv[1] if len(sys.argv) > 1 else "BAAI/bge-small-en-v1.5"
    precache(target_model)
