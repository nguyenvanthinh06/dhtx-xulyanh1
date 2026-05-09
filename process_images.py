import os
import subprocess
import shutil
import time

input_dir = 'input'
output_dir = 'input-not-detect'

if not os.path.exists(output_dir):
    os.makedirs(output_dir)

# Get all image files in input_dir
image_extensions = ('.png', '.jpg', '.jpeg', '.webp')
input_files = [f for f in os.listdir(input_dir) if f.lower().endswith(image_extensions)]

# Get already processed files in output_dir
processed_files = set(os.listdir(output_dir))

# Files to process: those in input but not in output
to_process = [f for f in input_files if f not in processed_files]

print(f"Total images in input: {len(input_files)}")
print(f"Already processed (in input-not-detect): {len(processed_files)}")
print(f"To process: {len(to_process)}")

# Process each file
for i, filename in enumerate(to_process, 1):
    filepath = os.path.join(input_dir, filename)
    dest = os.path.join(output_dir, filename)
    print(f"[{i}/{len(to_process)}] Processing {filename}")
    try:
        # Run the detection script with a timeout of 30 seconds per image
        result = subprocess.run(
            ['py', 'run.py', filepath, '--no-show'],
            capture_output=True,
            text=True,
            cwd=os.getcwd(),
            timeout=30
        )
        output = result.stdout + result.stderr
        if "Khong detect duoc bien so nao." in output:
            shutil.copy(filepath, dest)
            print(f"  -> Copied to {output_dir} (failed detection)")
        else:
            print(f"  -> Detected")
    except subprocess.TimeoutExpired:
        print(f"  -> Timeout after 30 seconds (skipping for now)")
    except Exception as e:
        print(f"  -> Error: {e}")
    # Optional: small delay to avoid overloading
    time.sleep(0.5)

print("Done.")