import math
import warnings
from sumy.parsers.plaintext import PlaintextParser
from sumy.nlp.tokenizers import Tokenizer
from sumy.summarizers.lex_rank import LexRankSummarizer

# Suppress annoying warnings
warnings.filterwarnings("ignore")

def extractive_summary(text: str) -> str:
    sentences = text.split(". ")
    total_sentences = len(sentences)

    if total_sentences <= 3:
        return text  # too short, return full text

    # Decide number of sentences dynamically
    min_len = math.ceil(total_sentences / 3)   # at least 1/3
    max_len = math.ceil(total_sentences / 2)   # at most half

    # Use middle point between min and max
    num_sentences = (min_len + max_len) // 2

    parser = PlaintextParser.from_string(text, Tokenizer("english"))
    summarizer = LexRankSummarizer()
    summary = summarizer(parser.document, num_sentences)

    return " ".join([str(sentence) for sentence in summary])
