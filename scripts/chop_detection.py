#!/usr/bin/env python3
"""
Chop Detection ML Service
Detects pork chops in images and calculates bounding boxes
"""

import os
import sys
import json
import cv2
import numpy as np
from typing import Dict, Tuple, Optional
import requests
from urllib.parse import urlparse
from io import BytesIO

def download_image(url: str) -> Optional[np.ndarray]:
    """Download image from URL and return as numpy array"""
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        image_array = np.asarray(bytearray(response.content), dtype=np.uint8)
        image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
        return image
    except Exception as e:
        print(f"Error downloading image from {url}: {e}", file=sys.stderr)
        return None

def detect_chop(image: np.ndarray) -> Optional[Dict]:
    """
    Detect pork chop in image and return bounding box coordinates.
    Uses color-based segmentation since chops are pink/red on blue background.
    
    Returns:
        dict with x1, y1, x2, y2, confidence or None if detection fails
    """
    if image is None:
        return None
    
    try:
        # Convert to HSV for better color segmentation
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        
        # Define range for pink/red meat (chop color)
        # Pork typically has:
        # - Hue: 0-20 (red) or 160-180 (red-pink)
        # - Saturation: 30-255 (not too gray)
        # - Value: 50-255 (not too dark)
        
        # Create masks for red ranges
        lower_red1 = np.array([0, 30, 50])
        upper_red1 = np.array([20, 255, 255])
        mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
        
        lower_red2 = np.array([160, 30, 50])
        upper_red2 = np.array([180, 255, 255])
        mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
        
        # Combine masks
        mask = cv2.bitwise_or(mask1, mask2)
        
        # Remove noise with morphological operations
        kernel = np.ones((5, 5), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=2)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
        
        # Find contours
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            return None
        
        # Find largest contour (assumed to be the chop)
        largest_contour = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(largest_contour)
        
        # Get image dimensions
        height, width = image.shape[:2]
        image_area = height * width
        
        # Chop should be significant portion of image (at least 5%, at most 80%)
        area_ratio = area / image_area
        if area_ratio < 0.05 or area_ratio > 0.80:
            return None
        
        # Get bounding rectangle
        x, y, w, h = cv2.boundingRect(largest_contour)
        
        # Add small margin (5%) to bounding box
        margin_x = int(w * 0.05)
        margin_y = int(h * 0.05)
        
        x1 = max(0, x - margin_x)
        y1 = max(0, y - margin_y)
        x2 = min(width, x + w + margin_x)
        y2 = min(height, y + h + margin_y)
        
        # Calculate confidence based on area ratio and contour characteristics
        # Perfect area ratio is around 0.3-0.5 (chop taking up 30-50% of image)
        area_confidence = 1.0 - abs(0.4 - area_ratio) / 0.4
        area_confidence = max(0.0, min(1.0, area_confidence))
        
        # Calculate aspect ratio confidence (chops are roughly oval, not too elongated)
        aspect_ratio = w / h if h > 0 else 1.0
        # Ideal aspect ratio is between 0.8 and 2.0
        if 0.8 <= aspect_ratio <= 2.0:
            aspect_confidence = 1.0
        else:
            aspect_confidence = max(0.0, 1.0 - abs(aspect_ratio - 1.4) / 2.0)
        
        # Combined confidence
        confidence = (area_confidence + aspect_confidence) / 2.0
        confidence = round(confidence, 2)
        
        return {
            'x1': int(x1),
            'y1': int(y1),
            'x2': int(x2),
            'y2': int(y2),
            'confidence': confidence,
            'area_ratio': round(area_ratio, 4)
        }
        
    except Exception as e:
        print(f"Error detecting chop: {e}", file=sys.stderr)
        return None

def process_image_from_url(image_url: str) -> Optional[Dict]:
    """
    Download and process image from URL
    
    Returns:
        Detection result dict or None
    """
    image = download_image(image_url)
    if image is None:
        return None
    
    result = detect_chop(image)
    if result:
        result['image_url'] = image_url
        result['width'] = image.shape[1]
        result['height'] = image.shape[0]
    
    return result

def process_batch(image_urls: list) -> list:
    """Process multiple images and return results"""
    results = []
    for url in image_urls:
        result = process_image_from_url(url)
        if result:
            results.append(result)
        else:
            results.append({
                'image_url': url,
                'error': 'Detection failed'
            })
    return results

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python chop_detection.py <image_url> [<image_url> ...]")
        print("Or pipe JSON array of URLs via stdin")
        sys.exit(1)
    
    # Check if input is from stdin (JSON array)
    if not sys.stdin.isatty():
        try:
            data = json.load(sys.stdin)
            if isinstance(data, list):
                results = process_batch(data)
                print(json.dumps(results, indent=2))
            else:
                print("Error: Expected JSON array of image URLs", file=sys.stderr)
                sys.exit(1)
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        # Process URLs from command line arguments
        results = process_batch(sys.argv[1:])
        print(json.dumps(results, indent=2))
