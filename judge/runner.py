#!/usr/bin/env python3
"""
Runs inside the Docker sandbox.
Reads /sandbox/solution.py, executes it with provided stdin,
prints stdout. Stderr goes to stderr.
"""
import sys, subprocess, os

solution = '/sandbox/solution.py'
if not os.path.exists(solution):
    print("ERROR: solution.py not found", file=sys.stderr)
    sys.exit(1)

result = subprocess.run(
    ['python3', solution],
    stdin=sys.stdin,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
    timeout=5
)
sys.stdout.write(result.stdout)
sys.stderr.write(result.stderr)
sys.exit(result.returncode)
