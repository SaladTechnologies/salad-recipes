#!/bin/bash
echo "This test will disable the ready status for this container instance for approximately 2 minutes. After which, it should resume being ready."
rm status
echo "Readiness disabled."
sleep 120
echo "200" > status
echo "Readiness is back to active."