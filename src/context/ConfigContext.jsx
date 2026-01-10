import { createContext, useState, useEffect, useContext } from 'react';

const ConfigContext = createContext();

export const ConfigProvider = ({ children }) => {
    const [config, setConfig] = useState({
        hospitalName: 'Jadwal Praktek Dokter',
        hospitalLogo: '/asset/logo/logo.png',
        hospitalLogo2: '/asset/logo/mysiloam-logo.png',
        refreshInterval: 24, // hours
        loading: true
    });

    const API_BASE = import.meta.env.VITE_API_BASE_URL || '/.netlify/functions';

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await fetch(`${API_BASE}/api/settings`); // Assuming generic settings endpoint
                if (response.ok) {
                    const settings = await response.json();
                    // Map generic settings to component config
                    // This depends on what the dashboard API returns. 
                    // For now, we fetch 'app_settings' if available, or just keep defaults.
                    // If dashboard supports /api/settings which returns array of { key, value }

                    if (Array.isArray(settings)) {
                        const newConfig = { ...config };
                        settings.forEach(item => {
                            if (item.setting_key === 'hospital_name') newConfig.hospitalName = item.setting_value;
                            if (item.setting_key === 'site_logo_url') newConfig.hospitalLogo = item.setting_value;
                            if (item.setting_key === 'slideshow_refresh_interval') newConfig.refreshInterval = parseInt(item.setting_value);
                        });
                        setConfig({ ...newConfig, loading: false });
                    }
                }
            } catch (error) {
                console.error("Failed to fetch settings, using defaults", error);
                setConfig(prev => ({ ...prev, loading: false }));
            }
        };

        fetchSettings();
    }, []);

    return (
        <ConfigContext.Provider value={config}>
            {children}
        </ConfigContext.Provider>
    );
};

export const useConfig = () => useContext(ConfigContext);
