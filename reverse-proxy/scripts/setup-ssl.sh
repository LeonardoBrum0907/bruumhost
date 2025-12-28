#!/bin/bash
certbot certonly \
   --manual \
   --preferred-challenges dns \
   --email $ACME_EMAIL \
   --agree-tos \
   -d "*.leobrum.run" \
   -d "leobrum.run"