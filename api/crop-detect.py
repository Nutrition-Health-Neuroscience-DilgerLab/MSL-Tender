import json
import cv2
import numpy as np
import requests
from http.server import BaseHTTPRequestHandler

def handler(request):
    """Vercel serverless function handler"""
    if request.method != 'POST':
        return {
            'statusCode': 405,
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    try:
        # Parse request body
        body = request.body
        if isinstance(body, bytes):
            body = body.decode('utf-8')
        data = json.loads(body)
        
        image_urls = data.get('urls', [])
        results = []
        
        for url in image_urls:
            try:
                # Download image
                response = requests.get(url, timeout=10)
                image_array = np.asarray(bytearray(response.content), dtype=np.uint8)
                image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
                
                if image is None:
                    results.append({'image_url': url, 'error': 'Failed to decode image'})
                    continue
                
                # Get image dimensions
                height, width = image.shape[:2]
                
                # Convert to HSV for better color segmentation
                hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
                
                # Define range for pink/red meat color
                lower_red1 = np.array([0, 30, 50])
                upper_red1 = np.array([20, 255, 255])
                lower_red2 = np.array([160, 30, 50])
                upper_red2 = np.array([180, 255, 255])
                
                # Create masks
                mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
                mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
                mask = cv2.bitwise_or(mask1, mask2)
                
                # Morphological operations to remove noise
                kernel = np.ones((5, 5), np.uint8)
                mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=2)
                mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
                
                # Find contours
                contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                
                if not contours:
                    results.append({'image_url': url, 'error': 'No contours found'})
                    continue
                
                # Find largest contour (assumed to be the chop)
                largest_contour = max(contours, key=cv2.contourArea)
                area = cv2.contourArea(largest_contour)
                
                # Validate area (should be between 5% and 80% of image)
                image_area = width * height
                area_ratio = area / image_area
                
                if area_ratio < 0.05 or area_ratio > 0.8:
                    results.append({'image_url': url, 'error': f'Invalid area ratio: {area_ratio:.2f}'})
                    continue
                
                # Get bounding box
                x, y, w, h = cv2.boundingRect(largest_contour)
                
                # Add 5% margin
                margin_x = int(w * 0.05)
                margin_y = int(h * 0.05)
                
                x1 = max(0, x - margin_x)
                y1 = max(0, y - margin_y)
                x2 = min(width, x + w + margin_x)
                y2 = min(height, y + h + margin_y)
                
                # Calculate confidence score
                aspect_ratio = w / h if h > 0 else 0
                area_confidence = 1.0 - abs(0.4 - area_ratio) / 0.4  # Optimal around 40%
                aspect_confidence = 1.0 - abs(1.2 - aspect_ratio) / 1.2  # Optimal around 1.2
                confidence = (area_confidence + aspect_confidence) / 2
                confidence = max(0, min(1, confidence))
                
                results.append({
                    'image_url': url,
                    'x1': int(x1),
                    'y1': int(y1),
                    'x2': int(x2),
                    'y2': int(y2),
                    'confidence': round(confidence, 2),
                    'area_ratio': round(area_ratio, 3)
                })
                
            except Exception as e:
                results.append({'image_url': url, 'error': str(e)})
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps(results)
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': str(e)})
        }
