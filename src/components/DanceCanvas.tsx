'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import YouTube, { YouTubeProps, YouTubePlayer } from 'react-youtube';
import { createDetector, drawPose, drawLandmarks, IPoseDetector } from '../utils/poseDetector';
import { Results } from '@mediapipe/pose';
import { useSettings } from '../context/SettingsContext';
import {
    ActionMeshCheckpoint,
    calculatePoseSimilarity,
    getScoreFeedback,
    findNearestCheckpoint,
    resultsToLandmarks,
    Landmark
} from '../utils/poseComparison';

interface DanceCanvasProps {
    youtubeId: string | null;  // Allow null!
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

    // Action Mesh (Target Pose) State
    const [actionMesh, setActionMesh] = useState<ActionMeshCheckpoint[] | null>(null);
    const actionMeshRef = useRef<ActionMeshCheckpoint[] | null>(null); // Ref for closure access

    // Debug: Log when actionMesh changes
    useEffect(() => {
        console.log('[ACTION MESH STATE] Changed to:', actionMesh ? `${actionMesh.length} checkpoints` : 'null');
        actionMeshRef.current = actionMesh; // Keep ref in sync
    }, [actionMesh]);

    const processedVideoRef = useRef<HTMLVideoElement>(null);
    const lastScoredTimeRef = useRef<number>(0);
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);
    const [isPersonDetected, setIsPersonDetected] = useState(false);
    const [currentCheckpoint, setCurrentCheckpoint] = useState<ActionMeshCheckpoint | null>(null);
    const currentCheckpointRef = useRef<ActionMeshCheckpoint | null>(null); // Ref for closure access
    const [currentUserLandmarks, setCurrentUserLandmarks] = useState<Landmark[] | null>(null);

    // Drag state for landmark panel
    const [panelPosition, setPanelPosition] = useState({ x: 0, y: 112 }); // Default: top-28 (112px)
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });

    const { detectionModel } = useSettings();

    // Load Action Mesh when processedVideoUrl changes
    useEffect(() => {
        console.log('[ACTION MESH] useEffect triggered', { processedVideoUrl, youtubeId });

        if (!processedVideoUrl || !youtubeId) {
            console.log('[ACTION MESH] Skipping - missing processedVideoUrl or youtubeId');
            //setActionMesh(null);
            return;
        }

        const meshUrl = `/processed/${youtubeId}_action_mesh.json`;
        console.log('[ACTION MESH] Fetching from:', meshUrl);

        fetch(meshUrl)
            .then(res => {
                console.log('[ACTION MESH] Fetch response status:', res.status, res.statusText);
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                return res.json();
            })
            .then(data => {
                console.log('[ACTION MESH] Successfully loaded:', data);
                console.log('[ACTION MESH] Checkpoints count:', data?.length);
                setActionMesh(data);
            })
            .catch(err => {
                console.error('[ACTION MESH] Failed to load action mesh:', err);
                console.error('[ACTION MESH] Attempted URL:', meshUrl);
                //setActionMesh(null);
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

                    // NEW: Pose comparison and scoring (use ref to get latest value)
                    if (actionMeshRef.current && processedVideoUrl && results.poseLandmarks) {
                        const currentTime = processedVideoRef.current?.currentTime || 0;

                        // Only score once per checkpoint (avoid duplicate scoring)
                        const timeSinceLastScore = currentTime - lastScoredTimeRef.current;
                        if (timeSinceLastScore < 0.4) {
                            return; // Skip if we scored recently
                        }

                        const checkpoint = findNearestCheckpoint(actionMeshRef.current, currentTime);
                        if (checkpoint) {
                            setCurrentCheckpoint(checkpoint); // Store for visualization
                            currentCheckpointRef.current = checkpoint; // Also store in ref for closure access

                            const userLandmarks = resultsToLandmarks(results);
                            if (userLandmarks) {
                                setCurrentUserLandmarks(userLandmarks); // Store for visualization

                                // CRITICAL: Validate that we actually detected a person
                                // Check visibility of key landmarks (torso + limbs)
                                const keyIndices = [11, 12, 13, 14, 23, 24, 25, 26]; // shoulders, elbows, hips, knees
                                const visibleCount = keyIndices.filter(i => userLandmarks[i]?.visibility > 0.5).length;
                                const visibilityRatio = visibleCount / keyIndices.length;

                                // Require at least 70% of key landmarks to be visible
                                if (visibilityRatio < 0.2) {
                                    setIsPersonDetected(false); // FIX: Set to FALSE when not enough landmarks
                                    console.log(`[SKIP] Not enough visible landmarks (need 70%, have ${(visibilityRatio * 100).toFixed(0)}%)`);
                                    return; // Don't score if person is not clearly detected
                                }

                                setIsPersonDetected(true); // Set to TRUE when person IS detected

                                const similarity = calculatePoseSimilarity(userLandmarks, checkpoint.landmarks);
                                const { feedback, points } = getScoreFeedback(similarity);

                                console.log(`[SCORE] Similarity: ${similarity.toFixed(1)}%, Feedback: ${feedback}, Points: ${points}`);

                                if (points > 0) {
                                    onScoreUpdate(points, feedback);
                                    lastScoredTimeRef.current = currentTime;
                                } else {
                                    console.log(`[SKIP] No points awarded (similarity too low)`);
                                }
                            } else {
                                console.log(`[SKIP] Could not convert landmarks`);
                            }
                        } else {
                            console.log(`[SKIP] No checkpoint found near time ${currentTime.toFixed(1)}s`);
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

                    // Also draw the reference checkpoint pose (if available) in a different color
                    // Use ref to get latest checkpoint value (avoids closure issues)
                    if (currentCheckpointRef.current) {
                        drawLandmarks(ctx, currentCheckpointRef.current.landmarks, '#FFFF00', false); // Yellow for reference pose
                    }
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
            if (videoDetector) {
                videoDetector.close();
            }
        };
    }, [detectionModel]); // Removed currentCheckpoint from dependencies

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
            // if (Math.random() > 0.95) {
            //     const feedbacks = ['Perfect', 'Great', 'Good'];
            //     const feedback = feedbacks[Math.floor(Math.random() * feedbacks.length)];
            //     const points = feedback === 'Perfect' ? 100 : feedback === 'Great' ? 50 : 10;
            //     onScoreUpdate(points, feedback);
            // }
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

    // Drag handlers for landmark panel
    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        dragStartRef.current = {
            x: e.clientX - panelPosition.x,
            y: e.clientY - panelPosition.y
        };
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isDragging) {
            setPanelPosition({
                x: e.clientX - dragStartRef.current.x,
                y: e.clientY - dragStartRef.current.y
            });
        }
    }, [isDragging]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    // Add global mouse event listeners for dragging
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-[600px] relative">
            {/* Floating Debug Info Panel */}
            {processedVideoUrl && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-black/70 backdrop-blur-md rounded-lg border border-yellow-600/30 p-2.5 shadow-2xl max-w-md">
                    <h3 className="text-yellow-400 font-semibold text-xs mb-1.5 flex items-center gap-1">
                        <span>🔍</span>
                        <span>Debug Info</span>
                    </h3>
                    <div className="text-xs font-mono space-y-0.5">
                        <div className="flex items-center gap-2">
                            <span className={processedVideoUrl ? 'text-green-400' : 'text-red-400'}>
                                {processedVideoUrl ? '✓' : '✗'}
                            </span>
                            <span className="text-gray-300">Video: {processedVideoUrl ? 'Loaded' : 'Not loaded'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={currentCheckpoint ? 'text-green-400' : 'text-red-400'}>
                                {currentCheckpoint ? '✓' : '✗'}
                            </span>
                            <span className="text-gray-300">
                                Checkpoint: {currentCheckpoint ? `${currentCheckpoint.time.toFixed(1)}s` : 'None'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={currentUserLandmarks ? 'text-green-400' : 'text-red-400'}>
                                {currentUserLandmarks ? '✓' : '✗'}
                            </span>
                            <span className="text-gray-300">
                                Landmarks: {currentUserLandmarks ? 'Detected' : 'None'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={actionMesh ? 'text-green-400' : 'text-red-400'}>
                                {actionMesh ? '✓' : '✗'}
                            </span>
                            <span className="text-gray-300">
                                Mesh: {actionMesh ? `${actionMesh.length} pts` : 'Not loaded'}
                            </span>
                        </div>
                        {processedVideoRef.current && (
                            <div className="flex items-center gap-2">
                                <span className="text-blue-400">⏱️</span>
                                <span className="text-gray-300">
                                    {processedVideoRef.current.currentTime.toFixed(1)}s / {processedVideoRef.current.duration.toFixed(1)}s
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}

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
                        videoId={youtubeId || undefined}
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


                {/* Color Legend for Pose Comparison */}
                {processedVideoUrl && currentCheckpoint && (
                    <div className="absolute bottom-4 left-4 z-30 bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2.5 text-sm space-y-2 shadow-lg border border-gray-700">
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full shadow-yellow-500/50 shadow-lg" style={{ backgroundColor: '#FFFF00' }}></div>
                            <span className="text-white font-semibold">Reference (Target)</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full bg-red-600 shadow-red-500/50 shadow-lg"></div>
                            <span className="text-white font-semibold">Video Pose</span>
                        </div>
                    </div>
                )}
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

                {/* Color Legend for User Pose */}
                {processedVideoUrl && (
                    <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2.5 text-sm shadow-lg border border-gray-700">
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full bg-green-500 shadow-green-500/50 shadow-lg"></div>
                            <span className="text-white font-semibold">Your Pose</span>
                        </div>
                    </div>
                )}
            </div>


            {/* Floating Debug Info Panel */}
            {processedVideoUrl && currentCheckpoint && currentUserLandmarks && (
                <div
                    className="absolute z-50 bg-gray-900/90 backdrop-blur-md rounded-xl border border-purple-600/30 shadow-2xl max-w-2xl max-h-[500px] overflow-hidden opacity-50"
                    style={{
                        left: panelPosition.x === 0 ? '50%' : `${panelPosition.x}px`,
                        top: `${panelPosition.y}px`,
                        transform: panelPosition.x === 0 ? 'translateX(-50%)' : 'none'
                    }}
                >
                    <div
                        className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-b border-gray-700 px-4 py-2 cursor-move select-none"
                        onMouseDown={handleMouseDown}
                    >
                        <h3 className="text-white font-semibold text-sm">📊 Landmark Data Comparison</h3>
                    </div>

                    <div className="p-4 max-h-[440px] overflow-y-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Reference Pose Data */}
                            <div className="space-y-2">
                                <h4 className="text-yellow-400 font-semibold text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                                    Reference Pose (Target)
                                </h4>

                                <div className="space-y-1.5 text-xs font-mono">
                                    {[
                                        { idx: 11, name: 'Left Shoulder' },
                                        { idx: 12, name: 'Right Shoulder' },
                                        { idx: 13, name: 'Left Elbow' },
                                        { idx: 14, name: 'Right Elbow' },
                                        { idx: 23, name: 'Left Hip' },
                                        { idx: 24, name: 'Right Hip' },
                                        { idx: 25, name: 'Left Knee' },
                                        { idx: 26, name: 'Right Knee' },
                                    ].map(({ idx, name }) => {
                                        const lm = currentCheckpoint.landmarks[idx];
                                        return (
                                            <div key={idx} className="bg-gray-800/50 rounded p-2">
                                                <div className="text-gray-300 font-semibold mb-1">{name} [{idx}]</div>
                                                <div className="grid grid-cols-2 gap-1 text-gray-400">
                                                    <div>x: {lm.x.toFixed(3)}</div>
                                                    <div>y: {lm.y.toFixed(3)}</div>
                                                    <div>z: {lm.z.toFixed(3)}</div>
                                                    <div className={lm.visibility > 0.5 ? 'text-green-400' : 'text-red-400'}>
                                                        vis: {lm.visibility.toFixed(3)}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* User Pose Data */}
                            <div className="space-y-2">
                                <h4 className="text-green-400 font-semibold text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                                    Your Pose (Current)
                                </h4>

                                <div className="space-y-1.5 text-xs font-mono">
                                    {[
                                        { idx: 11, name: 'Left Shoulder' },
                                        { idx: 12, name: 'Right Shoulder' },
                                        { idx: 13, name: 'Left Elbow' },
                                        { idx: 14, name: 'Right Elbow' },
                                        { idx: 23, name: 'Left Hip' },
                                        { idx: 24, name: 'Right Hip' },
                                        { idx: 25, name: 'Left Knee' },
                                        { idx: 26, name: 'Right Knee' },
                                    ].map(({ idx, name }) => {
                                        const lm = currentUserLandmarks[idx];
                                        const refLm = currentCheckpoint.landmarks[idx];

                                        // Calculate differences
                                        const dx = Math.abs(lm.x - refLm.x);
                                        const dy = Math.abs(lm.y - refLm.y);
                                        const dz = Math.abs(lm.z - refLm.z);
                                        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

                                        return (
                                            <div key={idx} className="bg-gray-800/50 rounded p-2">
                                                <div className="text-gray-300 font-semibold mb-1 flex justify-between">
                                                    <span>{name} [{idx}]</span>
                                                    <span className={distance < 0.1 ? 'text-green-400' : distance < 0.2 ? 'text-yellow-400' : 'text-red-400'}>
                                                        Δ {distance.toFixed(3)}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-1 text-gray-400">
                                                    <div>x: {lm.x.toFixed(3)}</div>
                                                    <div>y: {lm.y.toFixed(3)}</div>
                                                    <div>z: {lm.z.toFixed(3)}</div>
                                                    <div className={lm.visibility > 0.5 ? 'text-green-400' : 'text-red-400'}>
                                                        vis: {lm.visibility.toFixed(3)}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DanceCanvas;
