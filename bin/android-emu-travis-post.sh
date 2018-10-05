#!/bin/bash

if [ ${START_EMU} = "1" ]; then
    # Fail fast if emulator process cannot start
    pgrep -nf avd || exit 1

    # make sure the emulator is ready
    adb wait-for-device get-serialno
    secondsStarted=`date +%s`
    TIMEOUT=360
    while [[ $(( `date +%s` - $secondsStarted )) -lt $TIMEOUT ]]; do
        processList=`adb shell ps`
        if [[ "$processList" =~ "com.android.systemui" ]]; then
            echo "System UI process is running. Checking IME services availability"
            adb shell ime list && break
        fi
        sleep 5
        secondsElapsed=$(( `date +%s` - $secondsStarted ))
        secondsLeft=$(( $TIMEOUT - $secondsElapsed ))
        echo "Waiting until emulator finishes services startup; ${secondsElapsed}s elapsed; ${secondsLeft}s left"
    done
    bootDuration=$(( `date +%s` - $secondsStarted ))
    echo "Emulator booting took ${bootDuration}s"

    adb shell input keyevent 82
fi

exit 0;
