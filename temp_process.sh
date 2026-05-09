#!/bin/bash
mkdir -p input-not-detect
count=0
list=""
for file in input/*.{jpg,png,jpeg,webp}
do
  output=$(py run.py "$file" --no-show 2>&1)
  if echo "$output" | grep -q "Khong detect duoc bien so nao."
  then
    cp "$file" input-not-detect/
    count=$((count + 1))
    list="$list $(basename "$file")"
  fi
done
echo "Copied $count images: $list"