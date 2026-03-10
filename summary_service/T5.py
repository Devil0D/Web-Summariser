from transformers import pipeline, logging
import torch
import warnings

warnings.filterwarnings("ignore")
logging.set_verbosity_error()

# 1. Load the model only ONCE when the script starts.
#    This also checks if a GPU is available.
device = "cuda:0" if torch.cuda.is_available() else "cpu"
summarizer = pipeline(
    "summarization",
    model="t5-base",
    device=device
)

def t5_summary(text: str) -> str:
    # 2. The function now reuses the already-loaded summarizer, making it fast.
    input_length = len(text.split())
    min_len = max(25, input_length // 4)
    max_len = max(min_len + 20, input_length // 2)

    summary = summarizer(
        text,
        max_length=max_len,
        min_length=min_len,
        do_sample=False
    )
    if summary and len(summary)>0:
        return summary[0]['summary_text']
    else:
        return "Could not generate a summary from the provided text."
    
def safe_summary(text:str)->str:
    if not text or len(text.strip())==0:
        return "No content to summarize"
    
    input_length=len(text.split())

    min_len=min(100,max(10,input_length//4))
    max_len=max(512,max(min_len+20,input_length//2))

    print("Extracted text length (words):", input_length)
    print("First 300 chars:", text[:300])

    try:
        summary=summarizer(
          text,
          max_length=max_len,
          min_length=min_len,
          do_sample=False
        )
        return summary[0]["summary_text"] if summary else "could not generate a summary"
    except Exception as e:
        return f"Summarization failed:{e}"
