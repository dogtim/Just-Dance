'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export type DetectionModel = 'Google Media Pipe' | 'Meta 3D Body';

interface SettingsContextType {
    detectionModel: DetectionModel;
    setDetectionModel: (model: DetectionModel) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
    // Initialize state with default, but try to update from localStorage if available
    const [detectionModel, setDetectionModel] = useState<DetectionModel>('Google Media Pipe');

    useEffect(() => {
        // Run only on client-side mount
        const savedModel = localStorage.getItem('just-dance-detection-model');
        if (savedModel && (savedModel === 'Google Media Pipe' || savedModel === 'Meta 3D Body')) {
            setDetectionModel(savedModel as DetectionModel);
        }
    }, []);

    const updateDetectionModel = (model: DetectionModel) => {
        setDetectionModel(model);
        localStorage.setItem('just-dance-detection-model', model);
    };

    return (
        <SettingsContext.Provider value={{ detectionModel, setDetectionModel: updateDetectionModel }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
