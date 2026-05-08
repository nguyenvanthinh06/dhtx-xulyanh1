import os
import subprocess
import shutil

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

print(f"Total images: {len(input_files)}")
print(f"Already processed: {len(processed_files)}")
print(f"To process: {len(to_process)}")

# Process each file
for i, filename in enumerate(to_process, 1):
    filepath = os.path.join(input_dir, filename)
    dest = os.path.join(output_dir, filename)
    print(f"[{i}/{len(to_process)}] Processing {filename}")
    try:
        # Run the detection script with a timeout of 60 seconds per image
        result = subprocess.run(
            ['py', 'run.py', filepath, '--no-show'],
            capture_output=True,
            text=True,
            cwd=os.getcwd(),
            timeout=60
        )
        output = result.stdout + result.stderr
        if "Khong detect duoc bien so nao." in output:
            shutil.copy(filepath, dest)
            print(f"  -> Copied to {output_dir}")
        else:
            print(f"  -> Detected")
    except subprocess.TimeoutExpired:
        print(f"  -> Timeout (skipping, will retry later)")
    except Exception as e:
        print(f"  -> Error: {e}")

print("Done.")