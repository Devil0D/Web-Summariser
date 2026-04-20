"""
Llama Model Detector & System Prompts
======================================
Detects which Llama models (3.2, 3) are installed via Ollama.
Provides system prompts optimized for each model.

Usage:
  from llama_detector import detect_llama_models, get_system_prompt
  
  models = detect_llama_models()
  prompt = get_system_prompt("llama3.2")
"""

import requests
import logging
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)


# System prompts optimized for each Llama model
LLAMA_SYSTEM_PROMPTS = {
    "llama3.2": (
        "You are an expert summarizer. Your task is to create clear, concise summaries. "
        "Structure your response as:\n"
        "1. 4-6 key points (numbered list)\n"
        "2. A brief one-paragraph summary (2-3 sentences)\n"
        "Be direct and informative. Avoid unnecessary elaboration."
    ),
    "llama3": (
        "You are an expert summarizer. Your task is to create clear, concise summaries. "
        "Structure your response as:\n"
        "1. 4-6 key points (numbered list)\n"
        "2. A brief one-paragraph summary (2-3 sentences)\n"
        "Be direct and informative. Avoid unnecessary elaboration."
    ),
}


def detect_llama_models(ollama_url: str = "http://localhost:11434") -> Dict[str, List[str]]:
    """
    Detect which Llama models are available via Ollama.
    
    Returns:
        {
            "available": ["llama3.2", "llama3", ...],
            "recommended": "llama3.2",  # or "llama3" if 3.2 not found
            "status": "connected" or "error"
        }
    """
    result = {
        "available": [],
        "recommended": None,
        "status": "error",
        "error": None,
        "ollama_url": ollama_url,
    }
    
    try:
        # Test connection to Ollama
        response = requests.get(
            f"{ollama_url}/api/tags",
            timeout=5
        )
        
        if response.status_code != 200:
            result["error"] = f"Ollama returned status {response.status_code}"
            return result
        
        data = response.json()
        models = data.get("models", [])
        
        # Extract model names
        model_names = [m.get("name", "").split(":")[0] for m in models]
        
        # Check for Llama models
        llama_models = [m for m in model_names if "llama" in m.lower()]
        
        result["available"] = llama_models
        result["status"] = "connected"
        
        # Recommend based on availability (prefer 3.2)
        if "llama3.2" in llama_models:
            result["recommended"] = "llama3.2"
        elif "llama3" in llama_models:
            result["recommended"] = "llama3"
        elif llama_models:
            result["recommended"] = llama_models[0]
        
        logger.info(f"Ollama detected models: {llama_models}")
        
    except requests.exceptions.ConnectionError:
        result["status"] = "offline"
        result["error"] = f"Cannot connect to Ollama at {ollama_url}. Make sure Ollama is running."
    except requests.exceptions.Timeout:
        result["status"] = "timeout"
        result["error"] = f"Ollama connection timeout at {ollama_url}"
    except Exception as e:
        result["error"] = str(e)
        logger.error(f"Error detecting Llama models: {e}")
    
    return result


def get_system_prompt(model_name: str) -> str:
    """
    Get the optimized system prompt for a specific Llama model.
    
    Args:
        model_name: "llama3.2", "llama3", etc.
    
    Returns:
        System prompt string for the model
    """
    # Normalize model name (e.g., "llama3.2:latest" -> "llama3.2")
    base_model = model_name.split(":")[0].lower() if model_name else ""
    
    # Return specific prompt or default
    return LLAMA_SYSTEM_PROMPTS.get(
        base_model,
        LLAMA_SYSTEM_PROMPTS["llama3.2"]  # Default to llama3.2 prompt
    )


def validate_model(model_name: str, ollama_url: str = "http://localhost:11434") -> bool:
    """
    Check if a specific model is installed and available.
    
    Args:
        model_name: Model to check (e.g., "llama3.2")
        ollama_url: Ollama service URL
    
    Returns:
        True if model is available, False otherwise
    """
    try:
        detection = detect_llama_models(ollama_url)
        return model_name in detection.get("available", [])
    except Exception as e:
        logger.error(f"Error validating model {model_name}: {e}")
        return False


if __name__ == "__main__":
    # Test the detector
    print("Testing Llama Model Detector...")
    print("-" * 50)
    
    result = detect_llama_models()
    print(f"Status: {result['status']}")
    print(f"Available Llama Models: {result['available']}")
    print(f"Recommended Model: {result['recommended']}")
    
    if result.get("error"):
        print(f"Error: {result['error']}")
    
    if result["recommended"]:
        print(f"\nSystem Prompt for {result['recommended']}:")
        print("-" * 50)
        print(get_system_prompt(result["recommended"]))
