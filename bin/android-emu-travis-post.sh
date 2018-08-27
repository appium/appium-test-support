#!/bin/bash

set -ev

if [ ${START_EMU} = "1" ]; then
    android-wait-for-emulator

    seconds_elapsed=0
    while [[ $seconds_elapsed -lt 60 ]]; do
        pm_state=`adb shell pm get-install-location 2>&1 || true`
        echo "$pm_state" | grep -Eq "\d+\[\w+\]" && break
        echo "Waiting for emulator to finish services startup"
        sleep 1
        ((seconds_elapsed++))
    done
    if [[ $seconds_elapsed -ge 60 ]]; then
        echo "Timeout of 60 seconds reached; failed to start emulator services"
        exit 1
    fi

    adb shell input keyevent 82 &
fi

exit 0;
