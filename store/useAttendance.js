import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';

export const useAttendance = (classId) => {
    const [state, setState] = useState({
        isActive: false,
        sessionId: null,
        hasMarked: false,
        endTime: null,
        loading: true,
        error: null,
    });

    const refreshStatus = useCallback(async () => {
        try {
            setState((prev) => ({ ...prev, loading: true }));
            const response = await axios.get(`/api/classes/${classId}/attendance`);
            setState({
                isActive: response.data.active,
                sessionId: response.data.sessionId,
                hasMarked: response.data.hasMarked,
                endTime: response.data.endTime,
                loading: false,
                error: null,
            });
        } catch (error) {
            setState((prev) => ({
                ...prev,
                loading: false,
                error: error?.response?.data?.error || 'Failed to fetch attendance status',
            }));
        }
    }, [classId]);

    const startAttendance = async ({ location, duration, radius }) => {
        try {
            setState((prev) => ({ ...prev, loading: true }));
            await axios.post(`/api/classes/${classId}/attendance`, {
                location,
                radius, // Include radius in the request
                duration, // Include duration in the request
            });
            refreshStatus();
        } catch (error) {
            setState((prev) => ({
                ...prev,
                loading: false,
                error: error?.response?.data?.error || 'Failed to start attendance',
            }));
        }
    };

    const endAttendance = async () => {
        try {
            setState((prev) => ({ ...prev, loading: true }));
            await axios.patch(`/api/classes/${classId}/attendance`, {
                sessionId: state.sessionId,
            });
            refreshStatus();
        } catch (error) {
            setState((prev) => ({
                ...prev,
                loading: false,
                error: error?.response?.data?.error || 'Failed to end attendance',
            }));
        }
    };

    const markAttendance = async (location) => {
        try {
            setState((prev) => ({ ...prev, loading: true }));
            await axios.put(`/api/classes/${classId}/attendance`, {
                sessionId: state.sessionId,
                location,
            });
            refreshStatus();
        } catch (error) {
            setState((prev) => ({
                ...prev,
                loading: false,
                error: error?.response?.data?.error || 'Failed to mark attendance',
            }));
        }
    };

    useEffect(() => {
        if (classId) {
            refreshStatus();
        }
    }, [classId, refreshStatus]);

    const extendAttendance = async ({ duration }) => {
        try {
            setState((prev) => ({ ...prev, loading: true }));
            const response = await axios.put(`/api/classes/${classId}/attendance`, {
                sessionId: state.sessionId,
                duration, // Duration in seconds
            });
            refreshStatus();
        } catch (error) {
            setState((prev) => ({
                ...prev,
                loading: false,
                error: error?.response?.data?.error || 'Failed to extend attendance',
            }));
        }
    };
    return {
        ...state,
        startAttendance,
        endAttendance,
        markAttendance,
        refreshStatus,
        extendAttendance 
    };
};
