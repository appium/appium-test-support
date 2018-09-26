#!/bin/bash

set -ev

if [ ${START_EMU} = "1" ]; then
    tag=""
    if [ -n "$ANDROID_EMU_TAG" ]; then
        tag="--tag $ANDROID_EMU_TAG"
    fi
    echo no | `which android || which emulator` create avd --force -n ${ANDROID_EMU_NAME} -t ${ANDROID_EMU_TARGET} --abi ${ANDROID_EMU_ABI} $tag
    emulator -avd ${ANDROID_EMU_NAME} -no-audio -no-window &
fi

exit 0;
