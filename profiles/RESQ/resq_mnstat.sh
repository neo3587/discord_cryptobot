#!/bin/bash

mnres=$(resq-cli masternode list full $1 | awk '{print $5, $3}'| grep '[a-zA-Z0-9]')
echo -e "{\"addr\":\"$(echo $mnres | awk '{print $1}')\",\"status\":\"$(echo $mnres | awk '{print $2}')\"}"
