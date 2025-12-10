'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export type DetectionModel = 'Google Media Pipe' | 'Meta 3D Body';

interface SettingsContextType {
    detectionModel: DetectionModel;
    setDetectionModel: (model: DetectionModel) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
    const [detectionModel, setDetectionModel] = useState<DetectionModel>('Google Media Pipe');

    return (
        <SettingsContext.Provider value={{ detectionModel, setDetectionModel }}>
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
