'use client';

import React from 'react';

interface ScoreBoardProps {
    score: number;
    feedback: string;
}

const ScoreBoard: React.FC<ScoreBoardProps> = ({ score, feedback }) => {
    return (
        <div className="flex flex-col gap-4 p-6 bg-gray-900/80 backdrop-blur-md rounded-2xl border border-gray-700 text-white shadow-xl min-w-[200px]">
            <div>
                <h3 className="text-gray-400 text-sm font-semibold uppercase tracking-wider">Total Score</h3>
                <div className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
                    {score.toLocaleString()}
                </div>
            </div>

            <div>
                <h3 className="text-gray-400 text-sm font-semibold uppercase tracking-wider">Feedback</h3>
                <div className={`text-2xl font-bold ${feedback === 'Perfect' ? 'text-purple-400' :
                        feedback === 'Great' ? 'text-green-400' :
                            feedback === 'Good' ? 'text-yellow-400' :
                                'text-red-400'
                    }`}>
                    {feedback || 'Ready'}
                </div>
            </div>
        </div>
    );
};

export default ScoreBoard;
