import os
import subprocess
import shutil

input_dir = 'input'
output_dir = 'input-not-detect'

if not os.path.exists(output_dir):
    os.makedirs(output_dir)

for filename in os.listdir(input_dir):
    if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):  # Assuming image extensions
        filepath = os.path.join(input_dir, filename)
        dest = os.path.join(output_dir, filename)
        if os.path.exists(dest):
            print(f"Skipped {filename} (already processed)")
            continue
        print(f"Processing {filename}")
        result = subprocess.run(['py', 'run.py', filepath, '--no-show'], capture_output=True, text=True, cwd=os.getcwd())
        output = result.stdout + result.stderr
        if "Khong detect duoc bien so nao." in output:
            shutil.copy(filepath, os.path.join(output_dir, filename))
            print(f"Copied {filename} to {output_dir}")
        else:
            print(f"Detected for {filename}")