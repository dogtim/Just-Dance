# Just Dance - Project Tasks

## 🌟 Feature Requirements

### 1. Video Input and Playback
- [ ] **1.1 YouTube Link Input**: Provide an input field for the user to paste any valid YouTube video link.
- [ ] **1.2 Embedded Player**: After successful video loading, embed the YouTube player in the center of the page.
- [ ] **1.3 Audio Synchronization**: The background music played for the user's practice must be perfectly synchronized with the provided YouTube video link.

### 2. Real-time Pose Detection
- [ ] **2.1 Camera Access**: Request and display the user's live camera feed on the webpage.
- [ ] **2.2 Keypoint Extraction**: Use a Pose Detection model to extract the key body point (Keypoints) coordinates from both the YouTube video and the user's live camera feed.
- [ ] **2.3 Movement Comparison Logic**: The agent must design a comparison algorithm to calculate the difference in keypoint positions (e.g., angle or distance similarity between the two pose skeletons) between the user and the standard video at the same point in time.

### 3. Gamified Feedback and Scoring
- [ ] **3.1 Real-time Feedback**: Provide immediate visual feedback overlaid on the user's camera feed (e.g., the user's pose skeleton turns green if the posture is correct, and red if incorrect).
- [ ] **3.2 Scoring System**: Assign a score based on the movement match accuracy (e.g., "Perfect," "Great," "Good," "Miss").
- [ ] **3.3 Score Accumulation**: Real-time accumulation of the total score, displayed in a sidebar.

### 4. Basic UI/UX
- [ ] **4.1 Dual Screen Display**: Ideally, the layout should include: the YouTube standard video on the left (or top), and the user's camera feed with the pose skeleton overlay on the right (or bottom).
- [ ] **4.2 Start/Pause Button**: Controls for starting and pausing both the video and the movement comparison.

## ⚡ Agent Implementation Plan

- [x] **Environment Setup**: Create the Next.js/React project structure and set up the basic development environment.
- [ ] **Media Integration**: Implement YouTube video loading and player control functionality.
- [ ] **Camera & Model Integration**: Integrate TensorFlow.js or Mediapipe to display the camera feed and perform real-time pose keypoint extraction.
- [ ] **Movement Comparison Core**: Develop and deploy the keypoint comparison algorithm to calculate pose similarity.
- [ ] **Visualization & Scoring**: Implement the UI feedback layer, overlaying the comparison results (skeleton rendering, real-time score) onto the user's feed.
- [ ] **End-to-End Testing**: The agent will use the integrated browser to validate full functionality with a simple test video.