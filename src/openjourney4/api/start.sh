#!/bin/bash
socat TCP6-LISTEN:8888,fork TCP4:127.0.0.1:8080 &
python3 -u server.py
