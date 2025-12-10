
import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function POST(request: Request) {
    try {
        const { videoId, url } = await request.json();

        if (!videoId || !url) {
            return NextResponse.json({ error: 'Missing videoId or url' }, { status: 400 });
        }

        const processedPath = path.join(process.cwd(), 'public', 'processed', `${videoId}.mp4`);
        const processedUrl = `/processed/${videoId}.mp4`;

        // Check if checks if already exists
        if (fs.existsSync(processedPath)) {
            return NextResponse.json({ status: 'completed', videoUrl: processedUrl });
        }

        // Spawn python process
        // Note: Assuming 'python3' is in path and has deps installed.
        // Ideally we use a virtualenv python path, but for this simpler setup:
        const pythonScript = path.join(process.cwd(), 'scripts', 'process_video.py');
        console.log(`Starting processing for ${videoId}...`);

        // We don't await the process finishing to avoid timeout.
        // Ideally we should use a proper queue (Redis/Bull), but for now we'll spawn and return "processing".
        // However, since we want to wait for it for the simple user flow (or poll), 
        // let's try to just wait but with a timeout or just return "processing" and let client poll?
        // User requirement: "Loading Status... until ready".
        // Next.js API routes might time out on Vercel (10s), but locally it's fine.
        // Let's run it synchronously-ish for the MVP if it's not too long, OR better:
        // Return "processing" state immediately, and client can poll this same endpoint?

        // Let's implement a simple polling mechanism.
        // If not exists, check if process is running? Too complex for file check.
        // Let's just spawn it if not checking a lock file.

        const lockFile = path.join(process.cwd(), 'temp', `${videoId}.lock`);
        if (fs.existsSync(lockFile)) {
            return NextResponse.json({ status: 'processing' });
        }

        // Create lock
        if (!fs.existsSync(path.join(process.cwd(), 'temp'))) {
            fs.mkdirSync(path.join(process.cwd(), 'temp'));
        }
        fs.writeFileSync(lockFile, 'locked');

        const pythonProcess = spawn('python3', [pythonScript, url, videoId]);

        pythonProcess.stdout.on('data', (data) => {
            console.log(`[Python Script]: ${data}`);
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`[Python Script Error]: ${data}`);
        });

        pythonProcess.on('close', (code) => {
            console.log(`Python process exited with code ${code}`);
            // Remove lock
            if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
        });

        return NextResponse.json({ status: 'started' });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');

    if (!videoId) {
        return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
    }

    const processedPath = path.join(process.cwd(), 'public', 'processed', `${videoId}.mp4`);
    if (fs.existsSync(processedPath)) {
        return NextResponse.json({ status: 'completed', videoUrl: `/processed/${videoId}.mp4` });
    }

    const lockFile = path.join(process.cwd(), 'temp', `${videoId}.lock`);
    if (fs.existsSync(lockFile)) {
        return NextResponse.json({ status: 'processing' });
    }

    return NextResponse.json({ status: 'not_found' });
}
