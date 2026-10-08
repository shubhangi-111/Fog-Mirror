const cameraFeed =
    document.getElementById(
        "cameraFeed"
    );

const fogCanvas =
    document.getElementById(
        "fogCanvas"
    );

const fogButton =
    document.getElementById(
        "fogButton"
    );

const gestureStatus =
    document.getElementById(
        "gestureStatus"
    );

const fogContext =
    fogCanvas.getContext("2d");


let cameraStream = null;

let previousFinger = null;

let canvasWidth = 0;

let canvasHeight = 0;

let processingFrame = false;


/* =========================
   CANVAS SETUP
========================= */

function resizeFogCanvas() {

    const rect =
        fogCanvas.getBoundingClientRect();


    const pixelRatio =
        window.devicePixelRatio || 1;


    canvasWidth =
        rect.width;


    canvasHeight =
        rect.height;


    fogCanvas.width =
        rect.width *
        pixelRatio;


    fogCanvas.height =
        rect.height *
        pixelRatio;


    fogContext.setTransform(
        pixelRatio,
        0,
        0,
        pixelRatio,
        0,
        0
    );


    createFog();

}


/* =========================
   CREATE FOG
========================= */

function createFog() {

    fogContext.globalCompositeOperation =
        "source-over";


    fogContext.clearRect(
        0,
        0,
        canvasWidth,
        canvasHeight
    );


    /*
        Main fog layer.

        Light enough to allow
        the reflection to remain
        visible.
    */

    fogContext.fillStyle =
        "rgba(225, 232, 232, 0.48)";


    fogContext.fillRect(
        0,
        0,
        canvasWidth,
        canvasHeight
    );


    /*
        Uneven condensation.
    */

    const clouds = [

        {
            x: 0.25,
            y: 0.25,
            size: 0.55
        },

        {
            x: 0.75,
            y: 0.45,
            size: 0.65
        },

        {
            x: 0.45,
            y: 0.8,
            size: 0.7
        }

    ];


    clouds.forEach(
        (cloud) => {

            const gradient =
                fogContext
                    .createRadialGradient(

                        canvasWidth *
                            cloud.x,

                        canvasHeight *
                            cloud.y,

                        0,

                        canvasWidth *
                            cloud.x,

                        canvasHeight *
                            cloud.y,

                        canvasWidth *
                            cloud.size

                    );


            gradient.addColorStop(
                0,
                "rgba(255,255,255,0.20)"
            );


            gradient.addColorStop(
                0.6,
                "rgba(245,248,248,0.10)"
            );


            gradient.addColorStop(
                1,
                "rgba(255,255,255,0)"
            );


            fogContext.fillStyle =
                gradient;


            fogContext.fillRect(
                0,
                0,
                canvasWidth,
                canvasHeight
            );

        }
    );

}


/* =========================
   FOG BUTTON
========================= */

fogButton.addEventListener(
    "click",
    () => {

        createFog();

        previousFinger = null;

        gestureStatus.textContent =
            "WIPE TO CLEAR";

        gestureStatus.classList.remove(
            "active"
        );

    }
);


/* =========================
   WIPE FOG
========================= */

function wipeFog(
    x,
    y
) {

    fogContext.save();


    fogContext.globalCompositeOperation =
        "destination-out";


    /*
        This is the wipe size.

        KEEPING THIS AT 48 because
        this was already feeling
        perfect.
    */

    const radius = 48;


    const gradient =
        fogContext
            .createRadialGradient(
                x,
                y,
                0,
                x,
                y,
                radius
            );


    gradient.addColorStop(
        0,
        "rgba(0,0,0,0.95)"
    );


    gradient.addColorStop(
        0.55,
        "rgba(0,0,0,0.75)"
    );


    gradient.addColorStop(
        1,
        "rgba(0,0,0,0)"
    );


    fogContext.fillStyle =
        gradient;


    fogContext.beginPath();


    fogContext.arc(
        x,
        y,
        radius,
        0,
        Math.PI * 2
    );


    fogContext.fill();


    fogContext.restore();

}


/* =========================
   WIPE BETWEEN POINTS
========================= */

function wipeBetween(
    previous,
    current
) {

    const distance =
        Math.hypot(
            current.x -
                previous.x,

            current.y -
                previous.y
        );


    const steps =
        Math.max(
            1,
            Math.ceil(
                distance / 8
            )
        );


    for (
        let i = 0;
        i <= steps;
        i++
    ) {

        const progress =
            i / steps;


        const x =
            previous.x +
            (
                current.x -
                previous.x
            ) *
            progress;


        const y =
            previous.y +
            (
                current.y -
                previous.y
            ) *
            progress;


        wipeFog(
            x,
            y
        );

    }

}


/* =========================
   CAMERA
========================= */

async function startCamera() {

    try {

        cameraStream =
            await navigator.mediaDevices
                .getUserMedia({

                    video: {

                        facingMode:
                            "user",

                        /*
                            Lower resolution
                            makes hand tracking
                            faster.
                        */

                        width: {
                            ideal: 320
                        },

                        height: {
                            ideal: 240
                        },

                        frameRate: {
                            ideal: 30,

                            max: 30
                        }

                    },

                    audio: false

                });


        cameraFeed.srcObject =
            cameraStream;


        await cameraFeed.play();


        gestureStatus.textContent =
            "WIPE TO CLEAR";


        startHandTracking();

    }


    catch (error) {

        console.error(
            "Camera error:",
            error
        );


        gestureStatus.textContent =
            "CAMERA ACCESS REQUIRED";

    }

}


/* =========================
   MEDIAPIPE HANDS
========================= */

const hands =
    new Hands({

        locateFile:
            (file) => {

                return (
                    "https://cdn.jsdelivr.net/npm/" +
                    "@mediapipe/hands/" +
                    file
                );

            }

    });


hands.setOptions({

    maxNumHands: 1,

    /*
        Fastest MediaPipe model.
    */

    modelComplexity: 0,

    /*
        Slightly relaxed detection
        makes the interaction start
        sooner.
    */

    minDetectionConfidence:
        0.40,

    minTrackingConfidence:
        0.40

});


/* =========================
   HAND RESULTS
========================= */

hands.onResults(
    (results) => {


        /*
            No hand detected.
        */

        if (
            !results.multiHandLandmarks ||
            results.multiHandLandmarks
                .length === 0
        ) {

            previousFinger = null;


            gestureStatus.textContent =
                "WIPE TO CLEAR";


            gestureStatus.classList.remove(
                "active"
            );


            return;

        }


        /*
            First detected hand.
        */

        const hand =
            results.multiHandLandmarks[0];


        /*
            MediaPipe landmark 8
            is the index fingertip.
        */

        const fingertip =
            hand[8];


        /*
            Mirror the X coordinate
            because the camera is
            horizontally flipped.
        */

        const x =
            (
                1 -
                fingertip.x
            ) *
            canvasWidth;


        const y =
            fingertip.y *
            canvasHeight;


        const currentFinger = {

            x,
            y

        };


        gestureStatus.textContent =
            "WIPING...";


        gestureStatus.classList.add(
            "active"
        );


        /*
            Draw a continuous wipe
            between detection points.
        */

        if (
            previousFinger
        ) {

            wipeBetween(
                previousFinger,
                currentFinger
            );

        }


        else {

            wipeFog(
                x,
                y
            );

        }


        previousFinger =
            currentFinger;

    }
);


/* =========================
   HAND TRACKING
========================= */

async function startHandTracking() {


    async function processFrame() {


        /*
            Don't stack multiple
            MediaPipe inference calls.
        */

        if (
            cameraFeed.readyState >= 2 &&
            !processingFrame
        ) {

            processingFrame =
                true;


            try {

                await hands.send({

                    image:
                        cameraFeed

                });

            }


            catch (error) {

                console.error(
                    "Hand tracking error:",
                    error
                );

            }


            processingFrame =
                false;

        }


        requestAnimationFrame(
            processFrame
        );

    }


    processFrame();

}


/* =========================
   CLOCK
========================= */

function updateClock() {

    const now =
        new Date();


    document.getElementById(
        "time"
    ).textContent =

        now.toLocaleTimeString(
            [],
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );


    document.getElementById(
        "date"
    ).textContent =

        now.toLocaleDateString(
            [],
            {
                weekday: "long",
                month: "long",
                day: "numeric"
            }
        );

}


/* =========================
   INITIALIZATION
========================= */

updateClock();


setInterval(
    updateClock,
    1000
);


window.addEventListener(
    "resize",
    resizeFogCanvas
);


resizeFogCanvas();


startCamera();