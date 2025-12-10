'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import YouTube, { YouTubeProps, YouTubePlayer } from 'react-youtube';
import { createDetector, drawPose, IPoseDetector } from '../utils/poseDetector';
import { Results } from '@mediapipe/pose';
import { useSettings } from '../context/SettingsContext';
import {
    ActionMeshCheckpoint,
    calculatePoseSimilarity,
    getScoreFeedback,
    findNearestCheckpoint,
    resultsToLandmarks
} from '../utils/poseComparison';

interface DanceCanvasProps {
    youtubeId: string;
    onScoreUpdate: (points: number, feedback: string) => void;
    onScoreReset: () => void;
    processedVideoUrl: string | null;
}

const DanceCanvas: React.FC<DanceCanvasProps> = ({ youtubeId, onScoreUpdate, onScoreReset, processedVideoUrl }) => {
    const webcamRef = useRef<Webcam>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [detector, setDetector] = useState<IPoseDetector | null>(null);
    const requestRef = useRef<number>(null);
    const isRunning = useRef<boolean>(false);
    const [player, setPlayer] = useState<YouTubePlayer | null>(null);
    const [cameraLoaded, setCameraLoaded] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);

    // Video Analysis State
    const videoCanvasRef = useRef<HTMLCanvasElement>(null);
    const [videoDetector, setVideoDetector] = useState<IPoseDetector | null>(null);
    const screenVideoRef = useRef<HTMLVideoElement>(null);
    const isAnalyzing = useRef<boolean>(false);

    // Action Mesh (Target Pose) State
    const [actionMesh, setActionMesh] = useState<ActionMeshCheckpoint[] | null>(null);
    const processedVideoRef = useRef<HTMLVideoElement>(null);
    const lastScoredTimeRef = useRef<number>(0);
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);

    const { detectionModel } = useSettings();

    // Load Action Mesh when processedVideoUrl changes
    useEffect(() => {
        if (!processedVideoUrl || !youtubeId) {
            setActionMesh(null);
            return;
        }

        const meshUrl = `/processed/${youtubeId}_action_mesh.json`;
        fetch(meshUrl)
            .then(res => res.json())
            .then(data => {
                console.log(`Loaded ${data.length} action mesh checkpoints`);
                setActionMesh(data);
            })
            .catch(err => {
                console.error('Failed to load action mesh:', err);
                setActionMesh(null);
            });
    }, [processedVideoUrl, youtubeId]);

    // Initialize Detector
    useEffect(() => {
        const initDetector = async () => {
            const det = createDetector(detectionModel);
            // Setup callback
            det.onResults((results) => {
                if (!canvasRef.current) return;
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    const color = detectionModel === 'Meta 3D Body' ? '#00FFFF' : '#00FF00';
                    drawPose(ctx, results, color);

                    // NEW: Pose comparison and scoring
                    if (actionMesh && processedVideoUrl && results.poseLandmarks) {
                        const currentTime = processedVideoRef.current?.currentTime || 0;

                        // Only score once per checkpoint (avoid duplicate scoring)
                        const timeSinceLastScore = currentTime - lastScoredTimeRef.current;
                        if (timeSinceLastScore < 0.4) {
                            return; // Skip if we scored recently
                        }

                        const checkpoint = findNearestCheckpoint(actionMesh, currentTime);
                        if (checkpoint) {
                            const userLandmarks = resultsToLandmarks(results);
                            if (userLandmarks) {
                                const similarity = calculatePoseSimilarity(userLandmarks, checkpoint.landmarks);
                                const { feedback, points } = getScoreFeedback(similarity);

                                if (points > 0) {
                                    console.log(`Time: ${currentTime.toFixed(1)}s, Similarity: ${similarity.toFixed(1)}%, ${feedback}`);
                                    onScoreUpdate(points, feedback);
                                    lastScoredTimeRef.current = currentTime;
                                }
                            }
                        }
                    }
                }
            });
            setDetector(det);
        };
        const initVideoDetector = async () => {
            const det = createDetector(detectionModel);
            det.onResults((results) => {
                if (!videoCanvasRef.current) return;
                const ctx = videoCanvasRef.current.getContext('2d');
                if (ctx) {
                    const color = detectionModel === 'Meta 3D Body' ? '#0088FF' : 'red'; // Blue-ish for Meta Video, Red for MP Video
                    drawPose(ctx, results, color);
                }
            });
            setVideoDetector(det);
        };

        initDetector();
        initVideoDetector();

        return () => {
            // Cleanup if method existed
            if (detector) {
                detector.close();
            }
        };
        return () => {
            // Cleanup if method existed
            if (detector) {
                detector.close();
            }
            if (videoDetector) { // Clean up video detector too but videoDetector is not in scope here due to closures? 
                // Actually useEffect runs when detectionModel changes so we need to cleanup properly
            }
        };
    }, [detectionModel]); // Re-run when model changes

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

        // Analyze Screen Video if active
        if (isAnalyzing.current && screenVideoRef.current && screenVideoRef.current.readyState === 4 && videoDetector && videoCanvasRef.current) {
            const video = screenVideoRef.current;
            const canvasEl = videoCanvasRef.current;

            // Get DOM Position of the overlay canvas (which matches YouTube player)
            const rect = canvasEl.getBoundingClientRect();

            // Calculate scale between Screen Capture Native Resolution and Browser Window dimensions
            // getDisplayMedia often returns retina resolution or native screen res, which differs from innerWidth
            const scaleX = video.videoWidth / window.innerWidth;
            const scaleY = video.videoHeight / window.innerHeight;

            // Calculate precise crop coordinates
            const cropX = rect.left * scaleX;
            const cropY = rect.top * scaleY;
            const cropW = rect.width * scaleX;
            const cropH = rect.height * scaleY;

            // Ensure we don't go out of bounds (can happen with borders/browser UI)
            if (cropW > 0 && cropH > 0) {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = cropW;
                tempCanvas.height = cropH;
                const ctx = tempCanvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(
                        video,
                        cropX, cropY, cropW, cropH, // Source Crop
                        0, 0, tempCanvas.width, tempCanvas.height // Destination
                    );
                    await videoDetector.send(tempCanvas);
                }
            }
        }

        requestRef.current = requestAnimationFrame(loop);
    }, [detector, videoDetector, onScoreUpdate]);

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
            // Don't cancel immediately to keep analyzing potentially? No, sync with playback.
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        }
    };

    const startScreenShare = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false
            });
            if (screenVideoRef.current) {
                screenVideoRef.current.srcObject = stream;
                screenVideoRef.current.play();
                isAnalyzing.current = true;
            }
        } catch (err) {
            console.error("Error sharing screen:", err);
            alert("Could not start screen share for analysis.");
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-[600px]">
            {/* Left: YouTube Player */}
            <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden border border-gray-800 shadow-2xl">
                {processedVideoUrl ? (
                    <>
                        <video
                            ref={processedVideoRef}
                            src={processedVideoUrl}
                            className="w-full h-full absolute top-0 left-0 object-cover"
                            controls={false}
                            autoPlay
                            playsInline
                            onPlay={() => {
                                isRunning.current = true;
                                setIsVideoPlaying(true);
                                loop();
                            }}
                            onPause={() => {
                                isRunning.current = false;
                                setIsVideoPlaying(false);
                                if (requestRef.current) cancelAnimationFrame(requestRef.current);
                            }}
                            onEnded={() => {
                                isRunning.current = false;
                                setIsVideoPlaying(false);
                                if (requestRef.current) cancelAnimationFrame(requestRef.current);
                                // Reset score when video playback completes
                                onScoreReset();
                            }}
                        />

                        {/* Play/Pause Button Overlay */}
                        <button
                            onClick={() => {
                                if (processedVideoRef.current) {
                                    if (isVideoPlaying) {
                                        processedVideoRef.current.pause();
                                    } else {
                                        processedVideoRef.current.play();
                                    }
                                }
                            }}
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 bg-black/50 hover:bg-black/70 rounded-full p-4 transition-all duration-200 hover:scale-110"
                            title={isVideoPlaying ? "Pause" : "Play"}
                        >
                            {isVideoPlaying ? (
                                <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                                </svg>
                            ) : (
                                <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                            )}
                        </button>
                    </>
                ) : (
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
                )}

                {/* Overlay Canvas for Red Skeleton */}
                <canvas
                    ref={videoCanvasRef}
                    className="absolute top-0 left-0 w-full h-full pointer-events-none z-20"
                    width={640}
                    height={480}
                />

                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
                    <button
                        onClick={startScreenShare}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs opacity-50 hover:opacity-100 transition-opacity"
                    >
                        Start Video Analysis
                    </button>
                </div>
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
                    className="absolute top-0 left-0 w-full h-full pointer-events-none scale-x-[-1]"
                    width={640}
                    height={480}
                />
                {detectionModel === 'Meta 3D Body' && (
                    <div className="absolute top-4 right-4 bg-blue-600 text-white text-xs px-2 py-1 rounded opacity-80 pointer-events-none">
                        Meta 3D Body (Sim)
                    </div>
                )}
            </div>

            {/* Hidden Video for Screen Capture */}
            <video ref={screenVideoRef} className="hidden" playsInline muted />
        </div>
    );
};

export default DanceCanvas;
