#!/usr/bin/env python3
"""
Test script to verify improved summary lengths with T5 and BART.
Tests with Wikipedia article excerpt about web pages.
"""

import sys
import time

# Test text from Wikipedia article about web pages
TEST_TEXT = """
A web page is often used as a metaphor of paper pages bound together into a book. 
Each web page is identified by a distinct Uniform Resource Locator (URL). 
A web browser is the client application used to view web pages, 
and web servers host the files that are requested. 
Browser features include bookmarks for storing favorite web page addresses. 
The features of web browsers are so extensive and varied that 
programming a browser is a monumental task. 
Web pages may be accessed through networks such as the Internet or a private computer network. 
Web pages usually contain references to documents, other resources, 
and information providers accessible via hyperlinks, and may be interactive. 
Dynamic web pages can be either generated on the client side by running JavaScript code 
within the user's web browser or generated on the server side before being sent to the user's web browser. 
Web pages are stored in web servers and displayed by a web browser on the user's computer and mobile devices.
"""

def test_t5():
    """Test T5 summary with optimized lengths."""
    print("=" * 60)
    print("TESTING T5 SUMMARIZATION")
    print("=" * 60)
    
    try:
        from T5 import t5_summary, _calculate_t5_lengths
        
        text_words = len(TEST_TEXT.split())
        print(f"\n📊 Input Text Stats:")
        print(f"   Words: {text_words}")
        print(f"   Characters: {len(TEST_TEXT)}")
        
        # Check the calculated lengths
        min_len, max_len = _calculate_t5_lengths(text_words)
        print(f"\n🎯 T5 Length Calculation:")
        print(f"   min_length: {min_len}")
        print(f"   max_length: {max_len}")
        print(f"   Expected retention: ~{int((min_len + max_len) / 2 / text_words * 100)}%")
        
        # Generate summary
        print(f"\n⏱️  Generating T5 summary...")
        start = time.time()
        summary = t5_summary(TEST_TEXT)
        elapsed = time.time() - start
        
        summary_words = len(summary.split())
        retention = (summary_words / text_words) * 100
        
        print(f"\n✅ T5 Summary Generated (in {elapsed:.2f}s):")
        print(f"   Words in summary: {summary_words}")
        print(f"   Retention: {retention:.1f}%")
        print(f"\n   📝 Summary:\n{summary}")
        
        return summary_words > 20  # T5 should produce more than 20 words
        
    except Exception as e:
        print(f"❌ T5 Test Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_bart():
    """Test BART summary with optimized lengths."""
    print("\n" + "=" * 60)
    print("TESTING BART SUMMARIZATION")
    print("=" * 60)
    
    try:
        from bart import (
            bart_summary,
            _chunk_text,
            _calculate_summary_lengths,
        )
        
        text_words = len(TEST_TEXT.split())
        print(f"\n📊 Input Text Stats:")
        print(f"   Words: {text_words}")
        print(f"   Characters: {len(TEST_TEXT)}")
        
        # Check the calculated lengths
        min_len, max_len = _calculate_summary_lengths(text_words)
        print(f"\n🎯 BART Length Calculation:")
        print(f"   min_length: {min_len}")
        print(f"   max_length: {max_len}")
        print(f"   Expected retention: ~{int((min_len + max_len) / 2 / text_words * 100)}%")
        
        # Check chunking
        chunks = _chunk_text(TEST_TEXT)
        print(f"\n📦 Text Chunking:")
        print(f"   Number of chunks: {len(chunks)}")
        if len(chunks) == 1:
            print(f"   Chunk size: {len(chunks[0].split())} words")
        
        # Generate summary
        print(f"\n⏱️  Generating BART summary...")
        start = time.time()
        summary = bart_summary(TEST_TEXT)
        elapsed = time.time() - start
        
        summary_words = len(summary.split())
        retention = (summary_words / text_words) * 100
        
        print(f"\n✅ BART Summary Generated (in {elapsed:.2f}s):")
        print(f"   Words in summary: {summary_words}")
        print(f"   Retention: {retention:.1f}%")
        print(f"\n   📝 Summary:\n{summary}")
        
        return summary_words > 20  # BART should produce more than 20 words
        
    except Exception as e:
        print(f"❌ BART Test Error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("\n🚀 Summary Length Optimization Tests\n")
    
    t5_pass = test_t5()
    bart_pass = test_bart()
    
    print("\n" + "=" * 60)
    print("RESULTS")
    print("=" * 60)
    print(f"T5 test:   {'✅ PASS' if t5_pass else '❌ FAIL'}")
    print(f"BART test: {'✅ PASS' if bart_pass else '❌ FAIL'}")
    print()
    
    sys.exit(0 if (t5_pass and bart_pass) else 1)
