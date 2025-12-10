import { Results } from '@mediapipe/pose';

export interface Landmark {
    x: number;
    y: number;
    z: number;
    visibility: number;
}

export interface ActionMeshCheckpoint {
    time: number;
    landmarks: Landmark[];
}

/**
 * Calculate angle between two vectors
 */
function calculateAngle(v1: { x: number; y: number; z: number }, v2: { x: number; y: number; z: number }): number {
    const dotProduct = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);

    if (mag1 === 0 || mag2 === 0) return 0;

    const cosAngle = dotProduct / (mag1 * mag2);
    return Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI);
}

/**
 * Calculate similarity between two sets of pose landmarks
 * @param userLandmarks - User's current pose landmarks
 * @param targetLandmarks - Target pose landmarks from action mesh
 * @returns Similarity score (0-100, where 100 is perfect match)
 */
export function calculatePoseSimilarity(
    userLandmarks: Landmark[],
    targetLandmarks: Landmark[]
): number {
    if (!userLandmarks || !targetLandmarks || userLandmarks.length !== targetLandmarks.length) {
        return 0;
    }

    // Define important angle pairs (joint, parent1, parent2)
    const anglePairs = [
        // Left arm angles
        { joint: 13, parent1: 11, parent2: 15, name: 'left elbow', weight: 2.5 },      // left elbow
        { joint: 11, parent1: 13, parent2: 23, name: 'left shoulder', weight: 2.0 },   // left shoulder
        // Right arm angles
        { joint: 14, parent1: 12, parent2: 16, name: 'right elbow', weight: 2.5 },     // right elbow
        { joint: 12, parent1: 14, parent2: 24, name: 'right shoulder', weight: 2.0 },  // right shoulder
        // Left leg angles
        { joint: 25, parent1: 23, parent2: 27, name: 'left knee', weight: 2.5 },       // left knee
        { joint: 23, parent1: 25, parent2: 11, name: 'left hip', weight: 2.0 },        // left hip
        // Right leg angles
        { joint: 26, parent1: 24, parent2: 28, name: 'right knee', weight: 2.5 },      // right knee
        { joint: 24, parent1: 26, parent2: 12, name: 'right hip', weight: 2.0 },       // right hip
    ];

    // Position-based similarity
    let totalDistance = 0;
    let totalDistanceWeight = 0;

    for (let i = 0; i < userLandmarks.length; i++) {
        const user = userLandmarks[i];
        const target = targetLandmarks[i];

        // Skip if either landmark has low visibility
        if (user.visibility < 0.5 || target.visibility < 0.5) {
            continue;
        }

        // Calculate Euclidean distance
        const distance = Math.sqrt(
            Math.pow(user.x - target.x, 2) +
            Math.pow(user.y - target.y, 2) +
            Math.pow(user.z - target.z, 2)
        );

        totalDistance += distance;
        totalDistanceWeight += 1;
    }

    const avgDistance = totalDistanceWeight > 0 ? totalDistance / totalDistanceWeight : 1;

    // More strict distance threshold - only distances below 0.15 get high scores
    const distanceSimilarity = Math.max(0, Math.min(100, (1 - avgDistance / 0.15) * 100));

    // Angle-based similarity
    let totalAngleDiff = 0;
    let totalAngleWeight = 0;

    for (const pair of anglePairs) {
        const { joint, parent1, parent2, weight } = pair;

        // Check visibility
        if (userLandmarks[joint].visibility < 0.5 ||
            userLandmarks[parent1].visibility < 0.5 ||
            userLandmarks[parent2].visibility < 0.5 ||
            targetLandmarks[joint].visibility < 0.5 ||
            targetLandmarks[parent1].visibility < 0.5 ||
            targetLandmarks[parent2].visibility < 0.5) {
            continue;
        }

        // Calculate vectors for user pose
        const userVec1 = {
            x: userLandmarks[parent1].x - userLandmarks[joint].x,
            y: userLandmarks[parent1].y - userLandmarks[joint].y,
            z: userLandmarks[parent1].z - userLandmarks[joint].z,
        };
        const userVec2 = {
            x: userLandmarks[parent2].x - userLandmarks[joint].x,
            y: userLandmarks[parent2].y - userLandmarks[joint].y,
            z: userLandmarks[parent2].z - userLandmarks[joint].z,
        };

        // Calculate vectors for target pose
        const targetVec1 = {
            x: targetLandmarks[parent1].x - targetLandmarks[joint].x,
            y: targetLandmarks[parent1].y - targetLandmarks[joint].y,
            z: targetLandmarks[parent1].z - targetLandmarks[joint].z,
        };
        const targetVec2 = {
            x: targetLandmarks[parent2].x - targetLandmarks[joint].x,
            y: targetLandmarks[parent2].y - targetLandmarks[joint].y,
            z: targetLandmarks[parent2].z - targetLandmarks[joint].z,
        };

        const userAngle = calculateAngle(userVec1, userVec2);
        const targetAngle = calculateAngle(targetVec1, targetVec2);

        const angleDiff = Math.abs(userAngle - targetAngle);
        totalAngleDiff += angleDiff * weight;
        totalAngleWeight += weight;
    }

    const avgAngleDiff = totalAngleWeight > 0 ? totalAngleDiff / totalAngleWeight : 180;

    // Angle difference to similarity - 0 degrees = 100%, 30+ degrees = 0%
    const angleSimilarity = Math.max(0, Math.min(100, (1 - avgAngleDiff / 30) * 100));

    // Combine both metrics (60% angle, 40% distance)
    const finalSimilarity = angleSimilarity * 0.6 + distanceSimilarity * 0.4;

    return finalSimilarity;
}

/**
 * Get feedback text based on similarity score
 * @param similarity - Similarity percentage (0-100)
 * @returns Feedback text and points awarded
 */
export function getScoreFeedback(similarity: number): { feedback: string; points: number } {
    if (similarity >= 95) {
        return { feedback: 'Perfect! 🔥', points: 100 };
    } else if (similarity >= 85) {
        return { feedback: 'Great! ⭐', points: 60 };
    } else if (similarity >= 70) {
        return { feedback: 'Good! 👍', points: 30 };
    } else if (similarity >= 50) {
        return { feedback: 'Almost! 💪', points: 10 };
    } else {
        return { feedback: 'Keep trying! 💃', points: 0 };
    }
}

/**
 * Find the nearest checkpoint for a given time
 * @param checkpoints - Array of action mesh checkpoints
 * @param currentTime - Current playback time in seconds
 * @returns Nearest checkpoint or null
 */
export function findNearestCheckpoint(
    checkpoints: ActionMeshCheckpoint[],
    currentTime: number
): ActionMeshCheckpoint | null {
    if (!checkpoints || checkpoints.length === 0) {
        return null;
    }

    // Find checkpoint closest to current time
    let nearest = checkpoints[0];
    let minDiff = Math.abs(checkpoints[0].time - currentTime);

    for (const checkpoint of checkpoints) {
        const diff = Math.abs(checkpoint.time - currentTime);
        if (diff < minDiff) {
            minDiff = diff;
            nearest = checkpoint;
        }
    }

    // Only return if within 0.3 seconds of a checkpoint
    if (minDiff <= 0.3) {
        return nearest;
    }

    return null;
}

/**
 * Convert MediaPipe Results to Landmark array
 * @param results - MediaPipe pose detection results
 * @returns Array of landmarks or null
 */
export function resultsToLandmarks(results: Results): Landmark[] | null {
    if (!results.poseLandmarks) {
        return null;
    }

    return results.poseLandmarks.map(lm => ({
        x: lm.x,
        y: lm.y,
        z: lm.z,
        visibility: lm.visibility || 0
    }));
}
