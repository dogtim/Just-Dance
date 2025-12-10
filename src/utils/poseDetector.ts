import type { Pose, Results, Landmark } from '@mediapipe/pose';

// Manually define connections to avoid import issues
export const POSE_CONNECTIONS: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5],
    [5, 6], [6, 8], [9, 10], [11, 12], [11, 13],
    [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
    [12, 14], [14, 16], [16, 18], [16, 20], [16, 22],
    [18, 20], [11, 23], [12, 24], [23, 24], [23, 25],
    [24, 26], [25, 27], [26, 28], [27, 29], [28, 30],
    [29, 31], [30, 32], [27, 31], [28, 32]
];

// Interface for all pose detectors
export interface IPoseDetector {
    onResults(callback: (results: Results) => void): void;
    send(image: HTMLVideoElement | HTMLCanvasElement): Promise<void>;
    close(): void;
}

export class MediaPipeDetector implements IPoseDetector {
    private pose: Pose | null = null;
    private scriptLoaded: boolean = false;

    constructor() {
        this.loadScript();
    }

    private loadScript() {
        if (typeof window === 'undefined') return;

        if ((window as any).Pose) {
            this.initPose();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js';
        script.crossOrigin = 'anonymous';
        script.onload = () => {
            this.initPose();
        };
        document.body.appendChild(script);
    }

    private initPose() {
        if (!(window as any).Pose) return;

        const pose = new (window as any).Pose({
            locateFile: (file: string) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
            },
        });

        pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
        });

        this.pose = pose;
    }

    onResults(callback: (results: Results) => void) {
        // We might need to wait for initialization
        const interval = setInterval(() => {
            if (this.pose) {
                this.pose.onResults(callback);
                clearInterval(interval);
            }
        }, 100);
    }

    async send(image: HTMLVideoElement | HTMLCanvasElement) {
        if (this.pose) {
            await this.pose.send({ image });
        }
    }

    close() {
        if (this.pose) {
            this.pose.close();
        }
    }
}

// Stub implementation for Meta 3D Body (Simulation using MediaPipe)
export class Meta3DBodyDetector implements IPoseDetector {
    private internalDetector: MediaPipeDetector;

    constructor() {
        console.log("Meta 3D Body Detector (Simulation) Initialized");
        // We use MediaPipe to simulate the detection because the actual META 3D Body model 
        // requires a Python backend and cannot run in-browser via JS/ONNX currently.
        this.internalDetector = new MediaPipeDetector();
    }

    onResults(callback: (results: Results) => void) {
        this.internalDetector.onResults((results) => {
            // Pass through results
            callback(results);
        });
    }

    async send(image: HTMLVideoElement | HTMLCanvasElement) {
        await this.internalDetector.send(image);
    }

    close() {
        this.internalDetector.close();
        console.log("Meta 3D Body (Simulation): Closed");
    }
}

// Factory Function
export const createDetector = (modelName: string): IPoseDetector => {
    if (modelName === 'Meta 3D Body') {
        return new Meta3DBodyDetector();
    }
    return new MediaPipeDetector();
};

// Drawing Utilities can be exported here too
export const drawPose = (ctx: CanvasRenderingContext2D, results: Results, color: string = '#00FF00') => {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    if (results && results.poseLandmarks) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;

        // Draw connections
        for (const [start, end] of POSE_CONNECTIONS) {
            const startLm = results.poseLandmarks[start];
            const endLm = results.poseLandmarks[end];

            if (startLm && endLm && (startLm.visibility || 0) > 0.5 && (endLm.visibility || 0) > 0.5) {
                ctx.beginPath();
                ctx.moveTo(startLm.x * width, startLm.y * height);
                ctx.lineTo(endLm.x * width, endLm.y * height);
                ctx.stroke();
            }
        }

        // Draw Landmarks
        ctx.fillStyle = color;
        for (const lm of results.poseLandmarks) {
            if ((lm.visibility || 0) > 0.5) {
                ctx.beginPath();
                ctx.arc(lm.x * width, lm.y * height, 5, 0, 2 * Math.PI);
                ctx.fill();
            }
        }
    }
    ctx.restore();
};
