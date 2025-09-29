

class ScreenRecorder {
    constructor() {
        this.startBtn = document.getElementById('start-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.pauseBtn = document.getElementById('pause-btn');
        this.previewVideo = document.getElementById('preview-video');
        this.previewPlaceholder = document.getElementById('preview-placeholder');
        this.statusIndicator = document.getElementById('status-indicator');
        this.statusText = document.getElementById('status-text');
        this.timer = document.getElementById('timer');
        this.qualitySelect = document.getElementById('quality-select');
        this.framerateSelect = document.getElementById('framerate-select');
        this.recordingsList = document.getElementById('recordings-list');

        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.stream = null;
        this.isRecording = false;
        this.isPaused = false;
        this.startTime = null;
        this.timerInterval = null;
        this.recordings = JSON.parse(localStorage.getItem('screenRecordings')) || [];

        this.init();
    }

    init() {
        this.startBtn.addEventListener('click', () => this.startRecording());
        this.stopBtn.addEventListener('click', () => this.stopRecording());
        this.pauseBtn.addEventListener('click', () => this.togglePause());

        this.displayRecordings();

        this.checkBrowserSupport();
    }

    checkBrowserSupport() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            this.showError('Your browser does not support screen recording. Please use a modern browser like Chrome, Firefox, or Edge.');
            this.startBtn.disabled = true;
        }
    }


    getVideoConstraints() {
        const quality = this.qualitySelect.value;
        const framerate = parseInt(this.framerateSelect.value);

        const constraints = {
            video: {
                frameRate: framerate
            },
            audio: true
        };

        switch (quality) {
            case '1080p':
                constraints.video.width = 1920;
                constraints.video.height = 1080;
                break;
            case '720p':
                constraints.video.width = 1280;
                constraints.video.height = 720;
                break;
            case '480p':
                constraints.video.width = 854;
                constraints.video.height = 480;
                break;
        }

        return constraints;
    }

    async startRecording() {
        try {
            const constraints = this.getVideoConstraints();
            this.stream = await navigator.mediaDevices.getDisplayMedia(constraints);

            this.previewVideo.srcObject = this.stream;
            this.previewPlaceholder.style.display = 'none';

            const options = {
                mimeType: 'video/webm;codecs=vp9',
                videoBitsPerSecond: this.getVideoBitrate()
            };

            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options.mimeType = 'video/webm;codecs=vp8';
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                    options.mimeType = 'video/webm';
                }
            }

            this.mediaRecorder = new MediaRecorder(this.stream, options);
            this.recordedChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.saveRecording();
            };

            this.stream.getVideoTracks()[0].addEventListener('ended', () => {
                if (this.isRecording) {
                    this.stopRecording();
                }
            });

            this.mediaRecorder.start(1000);
            this.isRecording = true;
            this.startTime = Date.now();

            this.updateRecordingState();
            this.startTimer();

        } catch (error) {
            console.error('Error starting recording:', error);
            this.showError('Failed to start recording. Please make sure you granted screen sharing permission.');
        }
    }


    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.isPaused = false;

            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
            }

            this.previewVideo.srcObject = null;
            this.previewPlaceholder.style.display = 'flex';

            this.updateRecordingState();
            this.stopTimer();
        }
    }

    togglePause() {
        if (!this.mediaRecorder || !this.isRecording) return;

        if (this.isPaused) {
            this.mediaRecorder.resume();
            this.isPaused = false;
            this.pauseBtn.innerHTML = '<i class="fas fa-pause"></i><span>Pause</span>';
        } else {
            this.mediaRecorder.pause();
            this.isPaused = true;
            this.pauseBtn.innerHTML = '<i class="fas fa-play"></i><span>Resume</span>';
        }

        this.updateRecordingState();
    }


    getVideoBitrate() {
        const quality = this.qualitySelect.value;
        switch (quality) {
            case '1080p': return 8000000;
            case '720p': return 5000000;
            case '480p': return 2500000;
            default: return 5000000;
        }
    }

    saveRecording() {
        if (this.recordedChunks.length === 0) return;

        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const duration = this.timer.textContent;
        const timestamp = new Date().toLocaleString();
        const quality = this.qualitySelect.value;
        const framerate = this.framerateSelect.value;

        const recording = {
            id: Date.now(),
            url: url,
            blob: blob,
            duration: duration,
            timestamp: timestamp,
            quality: quality,
            framerate: framerate,
            size: this.formatFileSize(blob.size)
        };

        this.recordings.unshift(recording);
        this.saveRecordingsToStorage();
        this.displayRecordings();

        this.showSuccess(`Recording saved successfully! Duration: ${duration}`);
    }

    displayRecordings() {
        if (this.recordings.length === 0) {
            this.recordingsList.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <i class="fas fa-film text-4xl mb-4"></i>
                    <p>No recordings yet. Start recording to see your videos here.</p>
                </div>
            `;
            return;
        }

        this.recordingsList.innerHTML = this.recordings.map(recording => `
            <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center space-x-3">
                        <i class="fas fa-video text-blue-600 text-xl"></i>
                        <div>
                            <h3 class="font-semibold text-gray-800">Recording ${recording.id}</h3>
                            <p class="text-sm text-gray-600">${recording.timestamp}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-sm text-gray-600">Duration: ${recording.duration}</div>
                        <div class="text-sm text-gray-600">${recording.quality} • ${recording.framerate}fps • ${recording.size}</div>
                    </div>
                </div>
                <div class="flex space-x-2">
                    <button onclick="screenRecorder.playRecording('${recording.url}')" 
                            class="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors">
                        <i class="fas fa-play"></i>
                        <span>Play</span>
                    </button>
                    <button onclick="screenRecorder.downloadRecording('${recording.url}', ${recording.id})" 
                            class="flex items-center space-x-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors">
                        <i class="fas fa-download"></i>
                        <span>Download</span>
                    </button>
                    <button onclick="screenRecorder.deleteRecording(${recording.id})" 
                            class="flex items-center space-x-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors">
                        <i class="fas fa-trash"></i>
                        <span>Delete</span>
                    </button>
                </div>
            </div>
        `).join('');
    }


    playRecording(url) {
        const newWindow = window.open('', '_blank', 'width=800,height=600');
        newWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Screen Recording Playback</title>
                <style>
                    body { margin: 0; padding: 20px; background: #000; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                    video { max-width: 100%; max-height: 100%; }
                </style>
            </head>
            <body>
                <video controls autoplay>
                    <source src="${url}" type="video/webm">
                    Your browser does not support the video tag.
                </video>
            </body>
            </html>
        `);
    }


    downloadRecording(url, id) {
        const a = document.createElement('a');
        a.href = url;
        a.download = `screen-recording-${id}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }


    deleteRecording(id) {
        if (confirm('Are you sure you want to delete this recording?')) {
            const recording = this.recordings.find(r => r.id === id);
            if (recording) {
                URL.revokeObjectURL(recording.url);
            }

            this.recordings = this.recordings.filter(r => r.id !== id);
            this.saveRecordingsToStorage();
            this.displayRecordings();
            this.showSuccess('Recording deleted successfully!');
        }
    }


    updateRecordingState() {
        if (this.isRecording) {
            if (this.isPaused) {
                this.statusIndicator.className = 'w-4 h-4 rounded-full bg-yellow-500';
                this.statusText.textContent = 'Recording Paused';
                this.startBtn.disabled = true;
                this.stopBtn.disabled = false;
                this.pauseBtn.disabled = false;
            } else {
                this.statusIndicator.className = 'w-4 h-4 rounded-full bg-red-500 recording-pulse';
                this.statusText.textContent = 'Recording...';
                this.startBtn.disabled = true;
                this.stopBtn.disabled = false;
                this.pauseBtn.disabled = false;
            }
        } else {
            this.statusIndicator.className = 'w-4 h-4 rounded-full bg-gray-400';
            this.statusText.textContent = 'Ready to Record';
            this.startBtn.disabled = false;
            this.stopBtn.disabled = true;
            this.pauseBtn.disabled = true;
            this.pauseBtn.innerHTML = '<i class="fas fa-pause"></i><span>Pause</span>';
        }
    }


    startTimer() {
        this.timerInterval = setInterval(() => {
            if (!this.isPaused && this.startTime) {
                const elapsed = Date.now() - this.startTime;
                const minutes = Math.floor(elapsed / 60000);
                const seconds = Math.floor((elapsed % 60000) / 1000);
                this.timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }


    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        setTimeout(() => {
            this.timer.textContent = '00:00';
        }, 2000);
    }


    saveRecordingsToStorage() {
        const recordingsMetadata = this.recordings.map(r => ({
            id: r.id,
            duration: r.duration,
            timestamp: r.timestamp,
            quality: r.quality,
            framerate: r.framerate,
            size: r.size
        }));
        localStorage.setItem('screenRecordings', JSON.stringify(recordingsMetadata));
    }


    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }


    showError(message) {
        this.showNotification(message, 'error');
    }


    showSuccess(message) {
        this.showNotification(message, 'success');
    }


    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm ${type === 'error' ? 'bg-red-500 text-white' :
                type === 'success' ? 'bg-green-500 text-white' :
                    'bg-blue-500 text-white'
            }`;
        notification.innerHTML = `
            <div class="flex items-center space-x-2">
                <i class="fas ${type === 'error' ? 'fa-exclamation-circle' :
                type === 'success' ? 'fa-check-circle' :
                    'fa-info-circle'
            }"></i>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }
}

let screenRecorder;
document.addEventListener('DOMContentLoaded', () => {
    screenRecorder = new ScreenRecorder();
});

window.addEventListener('beforeunload', () => {
    if (screenRecorder && screenRecorder.isRecording) {
        screenRecorder.stopRecording();
    }
});