let model, isDetecting = false;

const videoElement = document.getElementById('videoElement');
const outputCanvas = document.getElementById('outputCanvas');
const infoBox = document.getElementById('infoBox');
const objectLabel = document.getElementById('objectLabel');
const confidenceScore = document.getElementById('confidenceScore');
const inputSelection = document.getElementById('inputSelection');
const imageInput = document.getElementById('imageInput');
const videoInput = document.getElementById('videoInput');
const imageDisplay = document.getElementById('imageDisplay');
const videoDisplay = document.getElementById('videoDisplay');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const captureButton = document.getElementById('captureButton');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingMessage = document.getElementById('loadingMessage');

function showOverlay(message = 'Loading...') {
    loadingMessage.textContent = message;
    loadingOverlay.style.display = 'flex';
}

function hideOverlay() {
    loadingOverlay.style.display = 'none';
}

async function loadModel() {
    showOverlay('Loading object detection model...');
    try {
        model = await cocoSsd.load();
        console.log('Model loaded successfully.');
    } catch (error) {
        console.error('Error loading model:', error);
        alert('Error loading model. Please try again.');
    } finally {
        hideOverlay();
    }
}

async function startDetection() {
    showOverlay('Preparing input...');
    try {
        if (!model) await loadModel();
        inputSelection.style.display = 'none';

        const inputType = document.querySelector('input[name="inputType"]:checked').value;

        if (inputType === 'webcam') {
            startWebcamDetection();
        } else if (inputType === 'image') {
            imageInput.click();
        } else if (inputType === 'video') {
            videoInput.click();
        }
    } catch (error) {
        hideOverlay();
        alert('Error starting detection.');
        console.error(error);
    }
}

function stopDetection() {
    isDetecting = false;
    startButton.disabled = false;
    stopButton.disabled = true;
    captureButton.disabled = true;
    inputSelection.style.display = 'flex';

    if (videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach(track => track.stop());
    }

    videoElement.style.display = 'none';
    imageDisplay.style.display = 'none';
    videoDisplay.style.display = 'none';
    outputCanvas.style.display = 'none';
    infoBox.classList.remove('active');
}

async function startWebcamDetection() {
    showOverlay('Accessing webcam...');
    videoElement.style.display = 'block';
    startButton.disabled = true;
    stopButton.disabled = false;
    captureButton.disabled = false;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoElement.srcObject = stream;
        videoElement.onloadedmetadata = () => {
            videoElement.play();
            isDetecting = true;
            hideOverlay();
            detectObjects(videoElement);
        };
    } catch (error) {
        stopDetection();
        hideOverlay();
        alert('Error accessing webcam.');
        console.error(error);
    }
}

function handleFileInput(event, type) {
    const file = event.target.files[0];
    if (!file) return alert('Please select a valid file.');

    const mediaUrl = URL.createObjectURL(file);
    if (type === 'image') {
        displayImage(mediaUrl);
    } else if (type === 'video') {
        displayVideo(mediaUrl);
    }
}

function displayImage(mediaUrl) {
    imageDisplay.src = mediaUrl;
    imageDisplay.style.display = 'block';
    videoElement.style.display = 'none';
    videoDisplay.style.display = 'none';
    imageDisplay.onload = () => {
        isDetecting = true;
        hideOverlay();
        detectObjects(imageDisplay);
    };
}

function displayVideo(mediaUrl) {
    videoDisplay.src = mediaUrl;
    videoDisplay.style.display = 'block';
    videoElement.style.display = 'none';
    imageDisplay.style.display = 'none';
    videoDisplay.onloadedmetadata = () => {
        videoDisplay.play();
        isDetecting = true;
        hideOverlay();
        detectObjects(videoDisplay);
    };
}

async function detectObjects(inputElement) {
    if (!isDetecting) return;

    const outputCtx = outputCanvas.getContext('2d');
    const width = inputElement.videoWidth || inputElement.width;
    const height = inputElement.videoHeight || inputElement.height;

    if (!width || !height) {
        requestAnimationFrame(() => detectObjects(inputElement));
        return;
    }

    outputCanvas.width = width;
    outputCanvas.height = height;

    outputCtx.drawImage(inputElement, 0, 0, width, height);
    const inputTensor = tf.browser.fromPixels(outputCanvas);
    const predictions = await model.detect(inputTensor);

    drawBoundingBoxes(outputCtx, predictions);
    updateDetectionInfo(predictions);

    outputCanvas.style.display = 'block';

    if (inputElement.tagName === 'VIDEO' && !inputElement.paused && !inputElement.ended) {
        requestAnimationFrame(() => detectObjects(inputElement));
    }
}

function drawBoundingBoxes(ctx, predictions) {
    predictions.forEach(prediction => {
        const [x, y, width, height] = prediction.bbox;
        ctx.beginPath();
        ctx.rect(x, y, width, height);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'red';
        ctx.stroke();
        ctx.font = '16px Arial';
        ctx.fillStyle = 'red';
        ctx.fillText(
            `${prediction.class} (${(prediction.score * 100).toFixed(1)}%)`,
            x,
            y > 10 ? y - 5 : 10
        );
    });
}

function updateDetectionInfo(predictions) {
    if (predictions.length > 0) {
        const { class: detectedClass, score } = predictions[0];
        objectLabel.textContent = detectedClass;
        confidenceScore.textContent = `${(score * 100).toFixed(1)}%`;
        infoBox.classList.add('active');
    } else {
        infoBox.classList.remove('active');
    }
}

function captureScreenshot() {
    if (outputCanvas.style.display === 'block') {
        const link = document.createElement('a');
        link.href = outputCanvas.toDataURL('image/png');
        link.download = 'screenshot.png';
        link.click();
    } else {
        alert('No detection result to capture.');
    }
}

startButton.addEventListener('click', startDetection);
stopButton.addEventListener('click', stopDetection);
captureButton.addEventListener('click', captureScreenshot);
imageInput.addEventListener('change', (event) => handleFileInput(event, 'image'));
videoInput.addEventListener('change', (event) => handleFileInput(event, 'video'));
document.addEventListener('DOMContentLoaded', loadModel);

document.querySelectorAll('input[name="inputType"]').forEach((input) => {
    input.addEventListener('change', () => {
        imageInput.style.display = 'none';
        videoInput.style.display = 'none';
        if (input.value === 'image') {
            imageInput.style.display = 'block';
        } else if (input.value === 'video') {
            videoInput.style.display = 'block';
        }
    });
});
