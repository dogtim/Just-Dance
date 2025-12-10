
import cv2
import mediapipe as mp
import numpy as np
import yt_dlp
import sys
import os
import subprocess
import argparse

def download_video(url, output_path):
    ydl_opts = {
        'format': 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]',
        'outtmpl': output_path,
        'quiet': True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])

def process_video(input_path, output_path):
    mp_pose = mp.solutions.pose
    pose = mp_pose.Pose(
        static_image_mode=False,
        model_complexity=1,
        smooth_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )
    mp_drawing = mp.solutions.drawing_utils

    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        print("Error opening video file")
        return

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)

    # FFmpeg command to combine processed video with original audio
    # Reads raw video from stdin
    command = [
        'ffmpeg',
        '-y', # Overwrite output file
        '-f', 'rawvideo',
        '-vcodec', 'rawvideo',
        '-s', f'{width}x{height}',
        '-pix_fmt', 'bgr24',
        '-r', str(fps),
        '-i', '-', # Input from pipe
        '-i', input_path, # Input audio from original file
        '-map', '0:v',
        '-map', '1:a',
        '-c:v', 'libx264',
        '-preset', 'ultrafast', # Fast encoding
        '-pix_fmt', 'yuv420p',
        '-c:a', 'copy', # Copy audio without re-encoding
        '-shortest',
        output_path
    ]

    process = subprocess.Popen(command, stdin=subprocess.PIPE)

    pose_connections = mp_pose.POSE_CONNECTIONS

    frame_count = 0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    print(f"Processing {total_frames} frames...")

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1
        if frame_count % 100 == 0:
            print(f"Processed {frame_count}/{total_frames}")

        # Recolor to RGB
        image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        image.flags.writeable = False

        results = pose.process(image)

        # Create black background
        black_frame = np.zeros((height, width, 3), dtype=np.uint8)

        # Draw landmarks
        if results.pose_landmarks:
            mp_drawing.draw_landmarks(
                black_frame,
                results.pose_landmarks,
                pose_connections,
                mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2, circle_radius=2),
                mp_drawing.DrawingSpec(color=(255, 255, 255), thickness=2, circle_radius=2)
            )

        # Write to ffmpeg
        try:
            process.stdin.write(black_frame.tobytes())
        except Exception as e:
            print(f"Error writing to ffmpeg: {e}")
            break

    cap.release()
    process.stdin.close()
    process.wait()
    pose.close()
    print("Processing complete.")

def main():
    parser = argparse.ArgumentParser(description='Process YouTube video to skeleton animation.')
    parser.add_argument('url', type=str, help='YouTube Video URL')
    parser.add_argument('video_id', type=str, help='Video ID (for naming)')
    
    args = parser.parse_args()
    
    # Ensure directories exist
    os.makedirs('temp', exist_ok=True)
    os.makedirs('public/processed', exist_ok=True)

    input_video_path = f'temp/{args.video_id}.mp4'
    output_video_path = f'public/processed/{args.video_id}.mp4'

    if os.path.exists(output_video_path):
        print(f"Video already processed: {output_video_path}")
        return

    print(f"Downloading {args.url}...")
    try:
        download_video(args.url, input_video_path)
    except Exception as e:
        print(f"Failed to download video: {e}")
        return

    print("Starting processing...")
    try:
        process_video(input_video_path, output_video_path)
    except Exception as e:
        print(f"Processing failed: {e}")
    finally:
        # Cleanup temp file
        if os.path.exists(input_video_path):
            os.remove(input_video_path)

if __name__ == "__main__":
    main()
