import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from "@/api/base44Client";

const AppSettingsContext = createContext();

export const useAppSettings = () => useContext(AppSettingsContext);

export const AppSettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState({
        oz_interpretation: 'auto',
        id: null
    });
    const [isLoading, setIsLoading] = useState(true);

    const loadSettings = async () => {
        try {
            const user = await base44.auth.me();
            if (user) {
                // Try to find settings for this user
                const userSettings = await base44.entities.AppSetting.filter({ user_id: user.id });
                
                if (userSettings && userSettings.length > 0) {
                    setSettings(userSettings[0]);
                } else {
                    // Create default settings if none exist
                    const newSettings = await base44.entities.AppSetting.create({
                        user_id: user.id,
                        oz_interpretation: 'auto',
                        target_pour_cost: 20,
                        default_unit_preference: 'oz'
                    });
                    setSettings(newSettings);
                }
            }
        } catch (error) {
            console.error("Failed to load app settings:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadSettings();
    }, []);

    const updateSettings = async (newSettings) => {
        try {
            if (settings.id) {
                const updated = await base44.entities.AppSetting.update(settings.id, newSettings);
                setSettings(updated);
                return updated;
            }
        } catch (error) {
            console.error("Failed to update settings:", error);
            throw error;
        }
    };

    return (
        <AppSettingsContext.Provider value={{ settings, updateSettings, isLoading, refreshSettings: loadSettings }}>
            {children}
        </AppSettingsContext.Provider>
    );
};