#!/bin/bash

# If tunnel id and access token are provided, do the following. unset is also fine
if [ -n "$TUNNEL_ID" ] && [ -n "$ACCESS_TOKEN" ]; then
  code tunnel --accept-server-license-terms --name $SALAD_CONTAINER_GROUP_ID --tunnel-id $TUNNEL_ID --host-token $ACCESS_TOKEN &
fi

# jupyter lab should listen on ipv6 interface, port 8888
jupyter lab --port=$JUPYTERLAB_PORT --no-browser --allow-root --NotebookApp.token='' --NotebookApp.password='' &

exec "$@"