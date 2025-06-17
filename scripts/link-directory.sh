#!/bin/bash

# This is kind of a weird script, but you can't COPY a symbolically linked
# directory into a Docker container. So, we need to create a script that
# will create hard links to the source directory in the destination directory.
# This way, I have one directory for all of my ComfyUI models, and I can just
# link them in here instead of duplicating.

# Usage function to display help
usage() {
    echo "Usage: $0 <source_dir> <destination_dir>"
    echo "Creates hard links recursively from source_dir to destination_dir"
    echo
    echo "Arguments:"
    echo "  source_dir       Source directory containing original files"
    echo "  destination_dir  Destination directory where hard links will be created"
    exit 1
}

# Check if correct number of arguments is provided
if [ "$#" -ne 2 ]; then
    usage
fi

source_dir="$(cd "$(dirname "$1")"; pwd)/$(basename "$1")"
dest_dir="$(cd "$(dirname "$2")"; pwd)/$(basename "$2")"

# Check if source directory exists
if [ ! -d "$source_dir" ]; then
    echo "Error: Source directory '$source_dir' does not exist"
    exit 1
fi

# Check if source and destination are on the same filesystem
src_fs=$(df "$source_dir" | tail -1 | awk '{print $1}')
dst_fs=$(df "$(dirname "$dest_dir")" | tail -1 | awk '{print $1}')
if [ "$src_fs" != "$dst_fs" ]; then
    echo "Error: Source and destination must be on the same filesystem for hard linking"
    exit 1
fi

# Create destination directory if it doesn't exist
mkdir -p "$dest_dir"

# Function to create hard links recursively
create_hardlinks() {
    local src="$1"
    local dst="$2"
    
    # Process all files and directories in source
    find "$src" -depth -print0 | while IFS= read -r -d $'\0' item; do
        # Get relative path
        relative_path="${item#$source_dir/}"
        # Skip if we're at the root of the source
        [ "$item" = "$source_dir" ] && continue
        
        # Create target path
        target="$dst/$relative_path"
        
        if [ -d "$item" ]; then
            # Create directory if it doesn't exist
            mkdir -p "$target"
        else
            # Create directory for file if it doesn't exist
            mkdir -p "$(dirname "$target")"
            # Create hard link for file
            ln "$item" "$target"
        fi
    done
}

# Start the recursive hard linking process
echo "Creating hard links from '$source_dir' to '$dest_dir'..."
create_hardlinks "$source_dir" "$dest_dir"
echo "Hard linking complete!"