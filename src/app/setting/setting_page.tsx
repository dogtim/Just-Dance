'use client';

import React from 'react';
import Link from 'next/link';
import { useSettings, DetectionModel } from '../../context/SettingsContext';

export default function Setting() {
    const { detectionModel, setDetectionModel } = useSettings();

    return (
        <div className="min-h-screen bg-black text-white font-sans p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-12">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500">
                        Settings
                    </h1>
                    <Link href="/" className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
                        Back to Home
                    </Link>
                </div>

                <div className="bg-gray-900/50 backdrop-blur rounded-2xl p-8 border border-gray-800">
                    <div className="space-y-6">
                        <div className="flex flex-col gap-2">
                            <label className="text-lg font-semibold text-gray-200">Detection Model</label>
                            <p className="text-sm text-gray-500 mb-2">Choose the AI model used for pose estimation.</p>

                            <select
                                value={detectionModel}
                                onChange={(e) => setDetectionModel(e.target.value as DetectionModel)}
                                className="w-full md:w-1/2 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white outline-none focus:border-purple-500 transition-colors appearance-none cursor-pointer"
                            >
                                <option value="Google Media Pipe">Google Media Pipe</option>
                                <option value="Meta 3D Body">Meta 3D Body</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
