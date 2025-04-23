#!/bin/bash

# Script to save a snapshot of the current code state
# This creates a backup directory with the current date and version

VERSION="0.1.0-alpha"
DATE=$(date +"%Y-%m-%d")
SNAPSHOT_DIR="snapshots/v${VERSION}-${DATE}"

# Create the snapshot directory
mkdir -p "$SNAPSHOT_DIR"

# Copy the important files
cp -r client "$SNAPSHOT_DIR/"
cp -r server "$SNAPSHOT_DIR/"
cp -r shared "$SNAPSHOT_DIR/"
cp VERSION "$SNAPSHOT_DIR/"
cp CHANGELOG.md "$SNAPSHOT_DIR/"
cp README.md "$SNAPSHOT_DIR/"

echo "Snapshot saved to $SNAPSHOT_DIR"
echo "Current version: $VERSION"
echo "Date: $DATE"