#!/bin/bash

set -ev

if [ ${START_EMU} = "1" ]; then
    echo no | android create avd --force -n ${ANDROID_EMU_NAME} -t ${ANDROID_EMU_TARGET} --abi ${ANDROID_EMU_ABI}
    emulator -avd test -no-audio -no-window &
fi

exit 0;
