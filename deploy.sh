#!/bin/bash

npm run build
echo "Built new release..."
firebase deploy
echo "Deployed new release to firebase!"