#!/bin/bash

set -ev

if [ ${START_EMU} = "1" ]; then
    android-wait-for-emulator
    adb shell input keyevent 82 &
fi

exit 0;
