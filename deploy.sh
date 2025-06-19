#!/bin/bash

npm run build
echo "Built new release..."
firebase deploy --only hosting
echo "Deployed new release to firebase!"