#!/bin/bash

# Check if directory argument is provided
if [ $# -ne 1 ]; then
  echo "Usage: $0 <directory>"
  exit 1
fi

directory="$1"

# Check if provided argument is a directory
if [ ! -d "$directory" ]; then
  echo "Error: '$directory' is not a directory"
  exit 1
fi

# Change to the specified directory
cd "$directory" || exit 1

# Initialize counter
count=1

# Process each file in the directory, sorted by name
for file in $(ls -1v); do
  # Skip if not a regular file
  if [ ! -f "$file" ]; then
    continue
  fi
  
  # Extract extension (if any)
  extension="${file##*.}"
  
  # Skip if not a regular file
  if [ ! -f "$file" ]; then
    continue
  fi
  
  # Extract extension (if any), lowercase everything
  extension="${file##*.}"
  
  # Handle files without extension
  if [ "$extension" = "$file" ]; then
    extension=""
    new_name=$(printf "%05d" $count)
  else
    new_name=$(printf "%05d.%s" $count "$extension")
  fi
  new_name=$(echo "$new_name" | tr '[:upper:]' '[:lower:]')
  # Rename the file
  mv "$file" "$new_name"
  
  # Increment counter
  ((count++))
done

echo "Renamed $(($count-1)) files in $directory"