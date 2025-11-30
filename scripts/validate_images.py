"""
Image-to-Database Validation Script for Tender App

This script validates that:
1. All images in the photos folder have corresponding database records
2. All database records have corresponding images
3. Image filenames follow the standardized naming convention
4. Generates detailed reports on matches, mismatches, and orphaned records

Naming Convention: SSSSB##C####D##
- SSSS: 4-digit study number
- B##: 2-digit block number (00 if no block)
- C####: 4-digit chop number
- D##: 2-digit day of display (00 if no retail display)

Author: Ryan Dilger
Date: November 30, 2025
"""

import pandas as pd
import os
from pathlib import Path
from collections import defaultdict
import re

class ImageDatabaseValidator:
    """Validates matching between image files and database records"""
    
    def __init__(self, photos_dir, database_csv):
        self.photos_dir = Path(photos_dir)
        self.database_csv = database_csv
        self.df = None
        self.image_files = []
        self.validation_results = {}
        
    def load_database(self):
        """Load consolidated database CSV"""
        print("Loading database...")
        self.df = pd.read_csv(self.database_csv)
        print(f"  ✓ Loaded {len(self.df)} database records")
        print(f"  ✓ Columns: {', '.join(self.df.columns.tolist()[:5])}...")
        
    def scan_images(self):
        """Scan all image files in photos directory"""
        print("\nScanning image files...")
        
        # Common image extensions
        image_extensions = {'.jpg', '.jpeg', '.png', '.tif', '.tiff', '.bmp'}
        
        for root, dirs, files in os.walk(self.photos_dir):
            for file in files:
                ext = Path(file).suffix.lower()
                if ext in image_extensions:
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, self.photos_dir)
                    
                    # Extract chop ID from filename (before extension)
                    filename_base = Path(file).stem
                    
                    self.image_files.append({
                        'full_path': full_path,
                        'relative_path': rel_path,
                        'filename': file,
                        'filename_base': filename_base,
                        'folder': os.path.basename(root),
                        'extension': ext
                    })
        
        print(f"  ✓ Found {len(self.image_files)} image files")
        
    def parse_chop_id(self, chop_id_str):
        """
        Parse standardized chop ID into components
        Format: SSSSB##C####D##
        """
        if pd.isna(chop_id_str):
            return None
            
        chop_id_str = str(chop_id_str).strip()
        
        # Expected format: 2304B00C0001D00
        pattern = r'^(\d{4})B(\d{2})C(\d{4})D(\d{2})$'
        match = re.match(pattern, chop_id_str)
        
        if match:
            return {
                'study': match.group(1),
                'block': match.group(2),
                'chop': match.group(3),
                'day': match.group(4),
                'full_id': chop_id_str
            }
        return None
    
    def validate_matches(self):
        """Cross-reference images with database records"""
        print("\nValidating image-to-database matches...")
        
        # Create lookup sets
        db_chop_ids = set(self.df['standardized_chop_id'].dropna().astype(str))
        image_chop_ids = set(img['filename_base'] for img in self.image_files)
        
        # Find matches and mismatches
        matched_ids = db_chop_ids.intersection(image_chop_ids)
        db_only = db_chop_ids - image_chop_ids  # In DB but no image
        images_only = image_chop_ids - db_chop_ids  # Image but not in DB
        
        self.validation_results = {
            'matched': matched_ids,
            'db_only': db_only,
            'images_only': images_only,
            'total_db_records': len(self.df),
            'total_images': len(self.image_files),
            'db_chop_ids': db_chop_ids,
            'image_chop_ids': image_chop_ids
        }
        
        print(f"\n  ✓ Matched: {len(matched_ids)} records have both DB entry and image")
        print(f"  ⚠ DB only: {len(db_only)} records in database without images")
        print(f"  ⚠ Images only: {len(images_only)} images without database records")
        
    def analyze_by_study(self):
        """Analyze matches by study number"""
        print("\nAnalyzing by study...")
        
        study_stats = defaultdict(lambda: {
            'db_records': 0,
            'images': 0,
            'matched': 0,
            'db_only': [],
            'images_only': []
        })
        
        # Count DB records by study
        for _, row in self.df.iterrows():
            study_num = str(row['study_number'])
            study_stats[study_num]['db_records'] += 1
        
        # Count images by study (extracted from filename)
        for img in self.image_files:
            parsed = self.parse_chop_id(img['filename_base'])
            if parsed:
                study_num = parsed['study']
                study_stats[study_num]['images'] += 1
        
        # Count matches
        for chop_id in self.validation_results['matched']:
            parsed = self.parse_chop_id(chop_id)
            if parsed:
                study_num = parsed['study']
                study_stats[study_num]['matched'] += 1
        
        # Track unmatched by study
        for chop_id in self.validation_results['db_only']:
            parsed = self.parse_chop_id(chop_id)
            if parsed:
                study_num = parsed['study']
                study_stats[study_num]['db_only'].append(chop_id)
        
        for chop_id in self.validation_results['images_only']:
            parsed = self.parse_chop_id(chop_id)
            if parsed:
                study_num = parsed['study']
                study_stats[study_num]['images_only'].append(chop_id)
        
        return dict(study_stats)
    
    def validate_naming_convention(self):
        """Validate that image filenames follow naming convention"""
        print("\nValidating naming convention...")
        
        valid_names = []
        invalid_names = []
        
        for img in self.image_files:
            if self.parse_chop_id(img['filename_base']):
                valid_names.append(img['filename_base'])
            else:
                invalid_names.append(img)
        
        print(f"  ✓ Valid: {len(valid_names)} images follow naming convention")
        if invalid_names:
            print(f"  ⚠ Invalid: {len(invalid_names)} images don't follow convention")
        
        return valid_names, invalid_names
    
    def generate_report(self, output_dir):
        """Generate detailed validation reports"""
        print("\nGenerating validation reports...")
        
        output_dir = Path(output_dir)
        output_dir.mkdir(exist_ok=True)
        
        # 1. Summary report
        summary_path = output_dir / "validation_summary.txt"
        with open(summary_path, 'w') as f:
            f.write("="*80 + "\n")
            f.write("IMAGE-TO-DATABASE VALIDATION REPORT\n")
            f.write("Tender Application - Pork Sensory Evaluation\n")
            f.write("="*80 + "\n\n")
            
            f.write(f"Total database records: {self.validation_results['total_db_records']}\n")
            f.write(f"Total image files: {self.validation_results['total_images']}\n")
            f.write(f"Matched (both DB and image): {len(self.validation_results['matched'])}\n")
            f.write(f"Database only (no image): {len(self.validation_results['db_only'])}\n")
            f.write(f"Images only (no DB record): {len(self.validation_results['images_only'])}\n\n")
            
            match_rate = (len(self.validation_results['matched']) / 
                         max(self.validation_results['total_db_records'], 
                             self.validation_results['total_images']) * 100)
            f.write(f"Match rate: {match_rate:.2f}%\n\n")
            
            # Study breakdown
            study_stats = self.analyze_by_study()
            f.write("\n" + "="*80 + "\n")
            f.write("BREAKDOWN BY STUDY\n")
            f.write("="*80 + "\n\n")
            
            for study in sorted(study_stats.keys()):
                stats = study_stats[study]
                f.write(f"\nStudy {study}:\n")
                f.write(f"  DB Records: {stats['db_records']}\n")
                f.write(f"  Images: {stats['images']}\n")
                f.write(f"  Matched: {stats['matched']}\n")
                if stats['db_only']:
                    f.write(f"  Missing images: {len(stats['db_only'])}\n")
                if stats['images_only']:
                    f.write(f"  Missing DB records: {len(stats['images_only'])}\n")
        
        print(f"  ✓ Summary report: {summary_path}")
        
        # 2. DB records without images
        if self.validation_results['db_only']:
            db_only_path = output_dir / "db_records_without_images.csv"
            db_only_df = self.df[self.df['standardized_chop_id'].isin(
                self.validation_results['db_only']
            )]
            db_only_df.to_csv(db_only_path, index=False)
            print(f"  ⚠ DB records without images: {db_only_path}")
        
        # 3. Images without DB records
        if self.validation_results['images_only']:
            images_only_path = output_dir / "images_without_db_records.csv"
            orphaned_images = [
                img for img in self.image_files 
                if img['filename_base'] in self.validation_results['images_only']
            ]
            orphaned_df = pd.DataFrame(orphaned_images)
            orphaned_df.to_csv(images_only_path, index=False)
            print(f"  ⚠ Images without DB records: {images_only_path}")
        
        # 4. Successfully matched records
        matched_path = output_dir / "matched_records.csv"
        matched_df = self.df[self.df['standardized_chop_id'].isin(
            self.validation_results['matched']
        )]
        matched_df.to_csv(matched_path, index=False)
        print(f"  ✓ Matched records: {matched_path}")
        
        # 5. Invalid image names
        valid_names, invalid_names = self.validate_naming_convention()
        if invalid_names:
            invalid_path = output_dir / "invalid_image_names.csv"
            invalid_df = pd.DataFrame(invalid_names)
            invalid_df.to_csv(invalid_path, index=False)
            print(f"  ⚠ Invalid image names: {invalid_path}")
        
        # 6. Image inventory by folder
        inventory_path = output_dir / "image_inventory_by_folder.csv"
        folder_counts = defaultdict(int)
        for img in self.image_files:
            folder_counts[img['folder']] += 1
        
        inventory_df = pd.DataFrame([
            {'folder': folder, 'image_count': count}
            for folder, count in sorted(folder_counts.items())
        ])
        inventory_df.to_csv(inventory_path, index=False)
        print(f"  ✓ Image inventory: {inventory_path}")
        
        print(f"\n  All reports saved to: {output_dir}")


def main():
    """Main execution function"""
    
    # Define paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    photos_dir = os.path.join(project_root, "photos")
    database_csv = os.path.join(project_root, "database", "consolidated_data_latest.csv")
    output_dir = os.path.join(project_root, "database", "validation_reports")
    
    print("="*80)
    print("IMAGE-TO-DATABASE VALIDATION")
    print("="*80)
    print(f"\nPhotos directory: {photos_dir}")
    print(f"Database CSV: {database_csv}")
    print(f"Output directory: {output_dir}\n")
    
    # Initialize validator
    validator = ImageDatabaseValidator(photos_dir, database_csv)
    
    # Run validation
    validator.load_database()
    validator.scan_images()
    validator.validate_matches()
    
    # Generate reports
    validator.generate_report(output_dir)
    
    # Print summary to console
    print("\n" + "="*80)
    print("VALIDATION COMPLETE")
    print("="*80)
    
    results = validator.validation_results
    match_rate = (len(results['matched']) / 
                 max(results['total_db_records'], results['total_images']) * 100)
    
    print(f"\n✓ {len(results['matched'])} records successfully matched")
    print(f"✓ Match rate: {match_rate:.2f}%")
    
    if results['db_only']:
        print(f"\n⚠ WARNING: {len(results['db_only'])} database records missing images")
        print("  See: validation_reports/db_records_without_images.csv")
    
    if results['images_only']:
        print(f"\n⚠ WARNING: {len(results['images_only'])} images missing database records")
        print("  See: validation_reports/images_without_db_records.csv")
    
    if not results['db_only'] and not results['images_only']:
        print("\n✓ PERFECT MATCH: All records have images and all images have DB records!")
    
    print("\n" + "="*80)


if __name__ == "__main__":
    main()
