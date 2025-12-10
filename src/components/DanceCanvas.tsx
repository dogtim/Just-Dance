'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import YouTube, { YouTubeProps, YouTubePlayer } from 'react-youtube';
import { PoseDetector, drawPose } from '../utils/poseDetector';
import { Results } from '@mediapipe/pose';

interface DanceCanvasProps {
    youtubeId: string;
    onScoreUpdate: (points: number, feedback: string) => void;
}

const DanceCanvas: React.FC<DanceCanvasProps> = ({ youtubeId, onScoreUpdate }) => {
    const webcamRef = useRef<Webcam>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [detector, setDetector] = useState<PoseDetector | null>(null);
    const requestRef = useRef<number>(null);
    const isRunning = useRef<boolean>(false);
    const [player, setPlayer] = useState<YouTubePlayer | null>(null);
    const [cameraLoaded, setCameraLoaded] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);

    // Initialize Detector
    useEffect(() => {
        const initDetector = async () => {
            const det = new PoseDetector();
            // Setup callback
            det.onResults((results) => {
                if (!canvasRef.current) return;
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    drawPose(ctx, results);
                    // Very simple scoring logic for now: PRESENCE check
                    // If we detect a pose, give points for "dancing"
                    if (results.poseLandmarks && results.poseLandmarks.length > 0) {
                        // Calculate movement or verify sync in future
                        // For now, minimal "Good" feedback if visible
                        const visibilitySum = results.poseLandmarks.reduce((acc, curr) => acc + (curr.visibility || 0), 0);
                        const avgVisibility = visibilitySum / results.poseLandmarks.length;

                        if (avgVisibility > 0.5) {
                            // Determine feedback based on random for demo 'feeling' or actual comparison later
                            // Simulating 'detection' as scoring event
                            // In real app, we compare with reference
                        }
                    }
                }
            });
            setDetector(det);
        };
        initDetector();

        return () => {
            // Cleanup if method existed
            if (detector) {
                detector.close();
            }
        };
    }, []);

    // Animation Loop - only runs when video is playing
    const loop = useCallback(async () => {
        if (
            isRunning.current &&
            webcamRef.current &&
            webcamRef.current.video &&
            webcamRef.current.video.readyState === 4 &&
            detector
        ) {
            // Send video frame to detector
            await detector.send(webcamRef.current.video);

            // Simulating score update every frame is too much, logic should be throttled or event based
            // We will do it in onResults or here.
            // Let's just randomly trigger score update for demo purposes if we are detecting
            if (Math.random() > 0.95) {
                const feedbacks = ['Perfect', 'Great', 'Good'];
                const feedback = feedbacks[Math.floor(Math.random() * feedbacks.length)];
                const points = feedback === 'Perfect' ? 100 : feedback === 'Great' ? 50 : 10;
                onScoreUpdate(points, feedback);
            }
        }
        requestRef.current = requestAnimationFrame(loop);
    }, [detector, onScoreUpdate]);

    useEffect(() => {
        if (isRunning.current && detector) {
            requestRef.current = requestAnimationFrame(loop);
        }
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [loop, detector]);

    const onPlayerReady: YouTubeProps['onReady'] = (event) => {
        setPlayer(event.target);
    };

    const onPlayerStateChange: YouTubeProps['onStateChange'] = (event) => {
        // 1 = Playing, 2 = Paused
        if (event.data === 1) {
            isRunning.current = true;
            loop();
        } else {
            isRunning.current = false;
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-[600px]">
            {/* Left: YouTube Player */}
            <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden border border-gray-800 shadow-2xl">
                <YouTube
                    videoId={youtubeId}
                    opts={{
                        width: '100%',
                        height: '100%',
                        playerVars: {
                            autoplay: 0,
                        },
                    }}
                    className="w-full h-full absolute top-0 left-0"
                    onReady={onPlayerReady}
                    onStateChange={onPlayerStateChange}
                />
            </div>

            {/* Right: User Camera & Skeleton */}
            <div className="relative w-full h-full bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 shadow-2xl">
                {/* Webcam Layer */}
                {/* Webcam Layer */}
                {!cameraLoaded && !cameraError && (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500 z-10">
                        <div className="flex flex-col items-center gap-2">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                            <p>Requesting Camera...</p>
                        </div>
                    </div>
                )}

                {cameraError && (
                    <div className="absolute inset-0 flex items-center justify-center text-red-400 z-10 p-6 text-center bg-gray-900/95 backdrop-blur-sm">
                        <div className="max-w-md space-y-4">
                            <p className="font-bold text-xl text-red-500">Camera Access Issue</p>
                            <p className="text-sm text-gray-300 bg-gray-800 p-3 rounded">{cameraError}</p>

                            <div className="text-xs text-gray-400 text-left space-y-2 border-t border-gray-700 pt-4">
                                <p><strong>Possible Solutions:</strong></p>
                                <ul className="list-disc pl-4 space-y-1">
                                    <li>Check your address bar. You <strong>MUST</strong> use <code className="text-white">http://localhost:3000</code>. <br />Using an IP like <code>192.168.x.x</code> will block the camera for security.</li>
                                    <li>Check browser permissions icon (usually in the address bar) to allow access.</li>
                                    <li>Refresh the page after changing settings.</li>
                                </ul>
                            </div>

                            <button
                                onClick={async () => {
                                    setCameraError(null);
                                    setCameraLoaded(false);
                                    try {
                                        await navigator.mediaDevices.getUserMedia({ video: true });
                                        setCameraLoaded(true);
                                    } catch (err: any) {
                                        setCameraError(err.message || 'Permission denied again.');
                                    }
                                }}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-semibold"
                            >
                                Try Requesting Again
                            </button>
                        </div>
                    </div>
                )}

                <Webcam
                    ref={webcamRef}
                    audio={false}
                    mirrored
                    className="absolute top-0 left-0 w-full h-full object-cover"
                    style={{ opacity: cameraLoaded ? 0.7 : 0 }}
                    onUserMedia={() => setCameraLoaded(true)}
                    onUserMediaError={(err) => {
                        console.error("Webcam Error:", err);
                        // Enhance error message based on location
                        let msg = typeof err === 'string' ? err : 'Could not access camera.';
                        if (window.location.hostname !== 'localhost' && window.location.protocol !== 'https:') {
                            msg = `Security Block: Camera only works on localhost or HTTPS. You are on ${window.location.hostname}.`;
                        }
                        setCameraError(msg);
                    }}
                />

                {/* Canvas Layer */}
                <canvas
                    ref={canvasRef}
                    className="absolute top-0 left-0 w-full h-full pointer-events-none"
                    width={640}
                    height={480}
                />
            </div>
        </div>
    );
};

export default DanceCanvas;
