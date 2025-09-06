FROM --platform=linux/amd64 python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    gdal-bin \
    libgdal-dev \
    python3-dev \
    build-essential \
 && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir --upgrade pip setuptools wheel --break-system-packages

WORKDIR /app
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt --break-system-packages

COPY worker.py /app/worker.py

