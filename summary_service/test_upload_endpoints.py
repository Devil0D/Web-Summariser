"""
Test script for the new upload endpoints
Run with: python test_upload_endpoints.py
"""

import requests
import json
from pathlib import Path

BASE_URL = "http://localhost:5001"

def test_health():
    """Test the health endpoint"""
    print("Testing /health endpoint...")
    response = requests.get(f"{BASE_URL}/health")
    print(f"  Status: {response.status_code}")
    print(f"  Response: {response.json()}\n")

def test_models():
    """Test the models endpoint"""
    print("Testing /models endpoint...")
    response = requests.get(f"{BASE_URL}/models")
    print(f"  Status: {response.status_code}")
    data = response.json()
    print(f"  Available models: {[m['name'] for m in data['models']]}")
    print(f"  Capabilities: {json.dumps(data.get('capabilities', {}), indent=2)}\n")

def test_pdf_upload():
    """Test PDF upload endpoint"""
    print("Testing /upload/pdf endpoint...")
    
    # This requires a test PDF file
    test_pdf = Path("test_sample.pdf")
    if not test_pdf.exists():
        print("  ⚠ No test PDF found at 'test_sample.pdf' - skipping test")
        print("  To test, place a PDF file named 'test_sample.pdf' in the summary_service directory\n")
        return
    
    with open(test_pdf, "rb") as f:
        files = {"file": (test_pdf.name, f, "application/pdf")}
        data = {"model": "combined"}
        response = requests.post(f"{BASE_URL}/upload/pdf", files=files, data=data)
    
    print(f"  Status: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print(f"  File: {result.get('filename')}")
        print(f"  Model used: {result.get('model_used')}")
        print(f"  PDF pages: {result.get('pdf_metadata', {}).get('pages', 'N/A')}")
        print(f"  Summary preview: {result.get('summary', '')[:100]}...\n")
    else:
        print(f"  Error: {response.text}\n")

def test_image_upload():
    """Test image upload endpoint"""
    print("Testing /upload/image endpoint...")
    
    # This requires a test image file
    test_image = Path("test_sample.jpg")
    if not test_image.exists():
        print("  ⚠ No test image found at 'test_sample.jpg' - skipping test")
        print("  To test, place an image file named 'test_sample.jpg' in the summary_service directory\n")
        return
    
    with open(test_image, "rb") as f:
        files = {"file": (test_image.name, f, "image/jpeg")}
        response = requests.post(f"{BASE_URL}/upload/image", files=files)
    
    print(f"  Status: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print(f"  File: {result.get('filename')}")
        print(f"  Image size: {result.get('image_info', {}).get('size', 'N/A')}")
        print(f"  Analysis: {result.get('short_summary', '')}\n")
    else:
        print(f"  Error: {response.text}\n")

def test_image_text_extraction():
    """Test image text extraction endpoint"""
    print("Testing /upload/image/extract-text endpoint...")
    
    test_image = Path("test_sample.jpg")
    if not test_image.exists():
        print("  ⚠ No test image found - skipping test\n")
        return
    
    with open(test_image, "rb") as f:
        files = {"file": (test_image.name, f, "image/jpeg")}
        response = requests.post(f"{BASE_URL}/upload/image/extract-text", files=files)
    
    print(f"  Status: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print(f"  Extracted content: {result.get('content', '')[:100]}...\n")
    else:
        print(f"  Error: {response.text}\n")

if __name__ == "__main__":
    print("=" * 60)
    print("Websears Summary Service - Upload Endpoints Test")
    print("=" * 60 + "\n")
    
    try:
        test_health()
        test_models()
        test_pdf_upload()
        test_image_upload()
        test_image_text_extraction()
        
        print("=" * 60)
        print("Testing complete!")
        print("=" * 60)
    
    except requests.exceptions.ConnectionError:
        print("✗ Error: Could not connect to API at", BASE_URL)
        print("\nMake sure the API is running:")
        print("  cd summary_service")
        print("  uvicorn main:app --reload --port 5001")
    except Exception as e:
        print(f"✗ Error: {e}")
