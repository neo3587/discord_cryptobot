#!/bin/bash

mnres=$(resq-cli masternode list full $1 | grep -w $1 | grep -o '".*"' | sed 's/"//g' | awk '{print $2}')
if [[ ! -z $mnres ]]; then
	echo -e "{\"addr\":\"$1\",\"status\":\"$mnres\"}"
fi
