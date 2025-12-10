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

    // Important joint indices (weighted more heavily)
    const importantJoints = [
        11, 12, // shoulders
        23, 24, // hips
        13, 14, // elbows
        25, 26, // knees
    ];

    let totalDistance = 0;
    let totalWeight = 0;

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

        // Weight important joints more heavily
        const weight = importantJoints.includes(i) ? 2.0 : 1.0;
        totalDistance += distance * weight;
        totalWeight += weight;
    }

    if (totalWeight === 0) {
        return 0;
    }

    const avgDistance = totalDistance / totalWeight;

    // Convert distance to similarity (lower distance = higher similarity)
    // Typical distance range is 0 to ~1.5 for full body mismatch
    // We'll map 0 distance to 100% and 0.3+ distance to 0%
    const similarity = Math.max(0, Math.min(100, (1 - avgDistance / 0.3) * 100));

    return similarity;
}

/**
 * Get feedback text based on similarity score
 * @param similarity - Similarity percentage (0-100)
 * @returns Feedback text and points awarded
 */
export function getScoreFeedback(similarity: number): { feedback: string; points: number } {
    if (similarity >= 90) {
        return { feedback: 'Perfect! 🔥', points: 100 };
    } else if (similarity >= 70) {
        return { feedback: 'Great! ⭐', points: 50 };
    } else if (similarity >= 50) {
        return { feedback: 'Good! 👍', points: 25 };
    } else {
        return { feedback: 'Keep trying!', points: 0 };
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
