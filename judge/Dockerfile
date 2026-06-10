FROM python:3.11-slim

# No network access, minimal image
RUN useradd -m -u 1000 sandbox

# Pre-install common student libraries
RUN pip install --no-cache-dir numpy 2>/dev/null || true

WORKDIR /sandbox
USER sandbox

# The runner script
COPY --chown=sandbox:sandbox runner.py /sandbox/runner.py

ENTRYPOINT ["python3", "/sandbox/runner.py"]
